import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { minioClient } from "./minio";
import { generateProjectId } from "./utils";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import axios from "axios";
import { Queue } from "bullmq";
import Redis from "ioredis";

// Security imports
import {
  authMiddleware,
  signAccessToken,
  signRefreshToken,
  verifyToken,
  AuthRequest,
  REFRESH_TOKEN_EXPIRY
} from "./auth";
import { UserModel, ProjectModel, RefreshTokenModel } from "./db";
import { requirePermission, requireRole, canAccessProject } from "./middleware/rbac";
import { apiLimiter, authLimiter, signupLimiter, deployLimiter, refreshLimiter } from "./middleware/rateLimiter";
import {
  validateRepoUrl,
  validateEmail,
  validateUsername,
  validatePassword,
  sanitizeProjectId
} from "./security/inputValidator";
import { checkLockout, recordFailedAttempt, resetFailedAttempts } from "./security/accountLockout";

/**
 * SECURE ARCHITECTURE:
 * - RS256 JWT with short-lived access tokens and refresh tokens (Kerberos-like)
 * - RBAC with admin/developer/viewer roles
 * - Rate limiting on all endpoints
 * - Input validation and sanitization
 * - Account lockout after failed attempts
 * - Security headers via Helmet
 * - Hardened CORS
 */

// MongoDB connection
async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://172.17.9.74:27018/automated-deployment';
  await mongoose.connect(mongoUri);
  console.log('📦 Connected to MongoDB');
}
connectDB();

const app = express();

// ===================
// SECURITY MIDDLEWARE
// ===================

// Security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }
}));

// Hardened CORS - only allow specific origins
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://172.17.9.74:5173',
  'http://172.17.9.74:3002'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'token']
}));

app.use(express.json({ limit: '10mb' }));

// Apply general rate limiting to all routes
app.use(apiLimiter);

// Redis connection for queue
const redis = new Redis({
  host: process.env.REDIS_HOST || '172.17.9.74',
  port: parseInt(process.env.REDIS_PORT || '6380'),
  maxRetriesPerRequest: null,
});

const deploymentQueue = new Queue('deployments', { connection: redis });

// ===================
// HEALTH CHECK
// ===================
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ===================
// AUTHENTICATION ENDPOINTS
// ===================

/**
 * User Signup with validation
 * Rate limited: 10 signups per hour per IP
 */
app.post('/signup', signupLimiter, async (req: Request, res: Response) => {
  console.log('📝 Signup request received');

  const { username, password, email } = req.body;

  // Input validation
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    res.status(400).json({ error: usernameValidation.error });
    return;
  }

  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    res.status(400).json({ error: emailValidation.error });
    return;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    res.status(400).json({ error: passwordValidation.error });
    return;
  }

  try {
    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12); // Increased cost factor

    await UserModel.create({
      name: username,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'developer' // Default role
    });

    res.status(201).json({ message: "User successfully signed up" });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * User Signin with account lockout protection
 * Rate limited: 5 attempts per 15 minutes per IP
 */
app.post('/signin', authLimiter, async (req: Request, res: Response) => {
  console.log('🔑 Signin request received');

  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const user = await UserModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Check account lockout
    const lockoutStatus = checkLockout(user);
    if (lockoutStatus.isLocked) {
      res.status(423).json({ error: lockoutStatus.message });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      // Record failed attempt
      const lockoutResult = await recordFailedAttempt(user);
      res.status(401).json({ error: lockoutResult.message || "Invalid credentials" });
      return;
    }

    // Successful login - reset failed attempts
    await resetFailedAttempts(user);

    // Generate tokens (Kerberos-style: short access + long refresh)
    const accessToken = signAccessToken(user._id.toString(), user.role);
    const jti = uuidv4();
    const refreshToken = signRefreshToken(user._id.toString(), user.role, jti);

    // Store refresh token in database for revocation capability
    await RefreshTokenModel.create({
      userId: user._id,
      token: refreshToken,
      jti: jti,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    res.json({
      message: "Signed in successfully",
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('Signin error:', error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

/**
 * Token Refresh - Exchange refresh token for new access token
 * Similar to Kerberos TGS (Ticket Granting Service)
 */
app.post('/refresh', refreshLimiter, async (req: Request, res: Response) => {
  console.log('🔄 Token refresh request');

  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ error: "Refresh token required" });
    return;
  }

  try {
    // Verify the refresh token
    const decoded = verifyToken(refreshToken);

    if (decoded.type !== 'refresh') {
      res.status(401).json({ error: "Invalid token type" });
      return;
    }

    // Check if token exists in database and is not revoked
    const storedToken = await RefreshTokenModel.findOne({
      jti: decoded.jti,
      isRevoked: false
    });

    if (!storedToken) {
      res.status(401).json({ error: "Token revoked or invalid" });
      return;
    }

    // Get user for latest role info
    const user = await UserModel.findById(decoded.id);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Generate new access token
    const newAccessToken = signAccessToken(user._id.toString(), user.role);

    res.json({
      accessToken: newAccessToken,
      expiresIn: 900 // 15 minutes
    });
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: "Refresh token expired. Please sign in again." });
      return;
    }
    console.error('Token refresh error:', error);
    res.status(401).json({ error: "Token refresh failed" });
  }
});

/**
 * Logout - Revoke refresh token
 */
app.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    try {
      const decoded = verifyToken(refreshToken);
      await RefreshTokenModel.updateOne(
        { jti: decoded.jti },
        { isRevoked: true }
      );
    } catch (error) {
      // Token invalid, but logout anyway
    }
  }

  res.json({ message: "Logged out successfully" });
});

// ===================
// PROJECT ENDPOINTS
// ===================

/**
 * List user's projects
 * Admins can see all, others only their own
 */
app.get('/viewProjects', authMiddleware, async (req: AuthRequest, res: Response) => {
  console.log('📋 Fetching projects');

  try {
    let query = {};

    // Admins can see all projects
    if (req.role !== 'admin') {
      query = { userId: req.id };
    }

    const projects = await ProjectModel.find(query);
    res.json({ results: projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

/**
 * Delete a project
 * Users can delete their own, admins can delete any
 */
app.delete('/deleteProject', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { projectId } = req.body;

  if (!projectId) {
    res.status(400).json({ error: "Project ID required" });
    return;
  }

  const sanitizedProjectId = sanitizeProjectId(projectId);

  try {
    // Find the project first
    const project = await ProjectModel.findOne({ projectId: sanitizedProjectId });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Check access (admins can delete any, others only their own)
    if (!canAccessProject(req, project.userId.toString())) {
      res.status(403).json({ error: "Forbidden: You cannot delete this project" });
      return;
    }

    // Delete from MinIO
    const deleteFolder = async (bucket: string, prefix: string) => {
      const objects: string[] = [];
      const stream = minioClient.listObjects(bucket, prefix, true);
      for await (const obj of stream) {
        objects.push(obj.name);
      }
      if (objects.length > 0) {
        await minioClient.removeObjects(bucket, objects);
      }
    };

    await deleteFolder("source-code", `${sanitizedProjectId}/`);
    await deleteFolder("static-builds", `${sanitizedProjectId}/`);
    await ProjectModel.deleteOne({ projectId: sanitizedProjectId });

    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

/**
 * Deploy a new project
 * Requires developer or admin role
 */
app.post('/deploy', authMiddleware, requirePermission('project:create'), deployLimiter, async (req: AuthRequest, res: Response) => {
  const { repoUrl, deploymentType, buildCommand, outputDir, envVars } = req.body;

  // Validate repository URL
  const urlValidation = validateRepoUrl(repoUrl);
  if (!urlValidation.valid) {
    res.status(400).json({ error: urlValidation.error });
    return;
  }

  // Validate deployment type
  const validDeploymentTypes = ['vite-react-ts', 'vite-react', 'create-react-app', 'nextjs', 'static', 'custom'];
  const selectedDeploymentType = deploymentType || 'vite-react-ts';
  if (!validDeploymentTypes.includes(selectedDeploymentType)) {
    res.status(400).json({ error: `Invalid deployment type. Must be one of: ${validDeploymentTypes.join(', ')}` });
    return;
  }

  // Validate envVars if provided
  if (envVars && typeof envVars !== 'object') {
    res.status(400).json({ error: 'Environment variables must be an object' });
    return;
  }

  console.log('🚀 Deploy request for:', repoUrl, '| Type:', selectedDeploymentType);

  const userId = req.id;
  const id = generateProjectId();
  const repoMeta = repoUrl.replace('.git', '').replace('https://github.com/', 'https://api.github.com/repos/');

  try {
    // Get repository info from GitHub
    const response = await axios.get(repoMeta);
    const defaultBranch = response.data.default_branch;
    const response2 = await axios.get(`${repoMeta}/branches/${defaultBranch}`);
    const commitSha = response2.data.commit.sha;

    console.log('📌 Default branch:', defaultBranch, '| Commit:', commitSha);

    // Queue deployment job with deployment configuration
    const jobData = {
      projectId: id,
      repoUrl: repoUrl,
      userId: userId,
      commitSha: commitSha,
      defaultBranch: defaultBranch,
      deploymentType: selectedDeploymentType,
      buildCommand: buildCommand || null,
      outputDir: outputDir || null,
      envVars: envVars || {},
    };

    await deploymentQueue.add('deploy', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    });

    // Save project to database
    await ProjectModel.create({
      url: repoUrl,
      userId: userId,
      projectId: id,
      commitSha: commitSha,
      defaultBranch: defaultBranch,
      deploymentType: selectedDeploymentType,
      buildCommand: buildCommand || null,
      outputDir: outputDir || null,
      envVars: envVars || {},
    });

    res.status(202).json({
      message: "Deployment queued",
      projectId: id,
      commitSha: commitSha,
      defaultBranch: defaultBranch,
      deploymentType: selectedDeploymentType,
    });
  } catch (error: any) {
    console.error('Deploy error:', error);

    if (error.response?.status === 404) {
      res.status(404).json({ error: "Repository not found or is private" });
      return;
    }

    res.status(500).json({ error: "Deployment failed" });
  }
});

// ===================
// ADMIN ENDPOINTS
// ===================

/**
 * Get all users (admin only)
 */
app.get('/admin/users', authMiddleware, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const users = await UserModel.find({}, '-password'); // Exclude passwords
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/**
 * Update user role (admin only)
 */
app.put('/admin/users/:userId/role', authMiddleware, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!['admin', 'developer', 'viewer'].includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  try {
    await UserModel.updateOne({ _id: userId }, { role });
    res.json({ message: "Role updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update role" });
  }
});

// ===================
// START SERVER
// ===================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  const serverIp = process.env.SERVER_IP || '172.17.9.74';
  console.log(`🚀 Secure Upload Service running on http://${serverIp}:${PORT}`);
  console.log(`🔐 Security features enabled: RS256 JWT, RBAC, Rate Limiting, Input Validation, Account Lockout`);
});
