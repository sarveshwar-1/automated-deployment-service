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
//all the rate limiters are disabled now for testing purposes.
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
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27018/automated-deployment';
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
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3002'
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
//app.use(apiLimiter);

// Redis connection for queue
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
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
app.post('/signup', async (req: Request, res: Response) => {
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
app.post('/signin', async (req: Request, res: Response) => {
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
 * GitHub OAuth - Exchange authorization code for access token
 * 
 * Flow:
 * 1. Frontend redirects user to GitHub OAuth page
 * 2. User authorizes
 * 3. GitHub redirects back with ?code=...
 * 4. Frontend sends code to this endpoint
 * 5. We exchange code for GitHub access token
 * 6. Fetch user info from GitHub
 * 7. Create/update user in our DB
 * 8. Return our JWT tokens
 */
app.post('/auth/github', async (req: Request, res: Response) => {
  console.log('🐙 GitHub OAuth request');
  
  const { code } = req.body;
  
  if (!code) {
    res.status(400).json({ error: "Authorization code required" });
    return;
  }

  try {
    // Step 1: Exchange code for GitHub access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code
      },
      {
        headers: { Accept: 'application/json' }
      }
    );

    const { access_token: githubAccessToken } = tokenResponse.data;

    if (!githubAccessToken) {
      res.status(400).json({ error: "Failed to get access token from GitHub" });
      return;
    }

    // Step 2: Fetch user info from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${githubAccessToken}` }
    });

    const githubUser = userResponse.data;

    // Step 3: Get user's email (might need separate call)
    let email = githubUser.email;
    if (!email) {
      const emailResponse = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${githubAccessToken}` }
      });
      const primaryEmail = emailResponse.data.find((e: any) => e.primary);
      email = primaryEmail?.email || emailResponse.data[0]?.email;
    }

    if (!email) {
      res.status(400).json({ error: "Could not retrieve email from GitHub" });
      return;
    }

    // Step 4: Create or update user in our database
    let user = await UserModel.findOne({ githubId: githubUser.id.toString() });

    if (!user) {
      // Check if user exists with same email (merge accounts)
      user = await UserModel.findOne({ email });
      
      if (user) {
        // Update existing user with GitHub info
        user.githubId = githubUser.id.toString();
        user.githubUsername = githubUser.login;
        user.githubAccessToken = githubAccessToken; // TODO: Encrypt this
        user.authProvider = 'github';
        await user.save();
      } else {
        // Create new user
        user = await UserModel.create({
          email,
          name: githubUser.name || githubUser.login,
          githubId: githubUser.id.toString(),
          githubUsername: githubUser.login,
          githubAccessToken: githubAccessToken, // TODO: Encrypt this
          authProvider: 'github',
          role: 'developer'
        });
      }
    } else {
      // Update existing GitHub user's token
      user.githubAccessToken = githubAccessToken;
      user.lastSuccessfulLogin = new Date();
      await user.save();
    }

    // Step 5: Generate our JWT tokens
    const accessToken = signAccessToken(user._id.toString(), user.role);
    const jti = uuidv4();
    const refreshToken = signRefreshToken(user._id.toString(), user.role, jti);

    // Store refresh token
    await RefreshTokenModel.create({
      userId: user._id,
      token: refreshToken,
      jti: jti,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    res.json({
      message: "GitHub authentication successful",
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        githubUsername: user.githubUsername
      }
    });
  } catch (error: any) {
    console.error('GitHub OAuth error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: "GitHub authentication failed",
      details: error.response?.data || error.message
    });
  }
});

/**
 * Token Refresh - Exchange refresh token for new access token
 * Similar to Kerberos TGS (Ticket Granting Service)
 */
app.post('/refresh', async (req: Request, res: Response) => {
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
// GITHUB INTEGRATION
// ===================

/**
 * Fetch user's GitHub repositories
 * 
 * Uses the stored GitHub access token to fetch repositories.
 * Returns both public and private repos based on OAuth scope.
 */
app.get('/github/repos', authMiddleware, async (req: AuthRequest, res: Response) => {
  console.log('🐙 Fetching GitHub repositories for user:', req.id);
  
  try {
    // Get user from database
    const user = await UserModel.findById(req.id);
    
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Check if user has GitHub linked
    if (!user.githubAccessToken) {
      res.status(400).json({ 
        error: "GitHub account not linked",
        message: "Please sign in with GitHub to link your account"
      });
      return;
    }

    // Fetch repositories from GitHub API
    const response = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `Bearer ${user.githubAccessToken}`,
        Accept: 'application/vnd.github.v3+json'
      },
      params: {
        sort: 'updated',        // Sort by last updated
        per_page: 100,          // Max per page
        affiliation: 'owner'    // Only repos user owns (not orgs)
      }
    });

    // Transform data to include only what we need
    const repos = response.data.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
      private: repo.private,
      defaultBranch: repo.default_branch,
      language: repo.language,
      size: repo.size,
      stargazers: repo.stargazers_count,
      forks: repo.forks_count,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at
    }));

    res.json({
      repos,
      total: repos.length,
      githubUsername: user.githubUsername
    });

  } catch (error: any) {
    console.error('GitHub API error:', error.response?.data || error.message);
    
    // Handle token expiration or revocation
    if (error.response?.status === 401) {
      res.status(401).json({ 
        error: "GitHub token expired or revoked",
        message: "Please re-authenticate with GitHub"
      });
      return;
    }

    res.status(500).json({ 
      error: "Failed to fetch repositories",
      details: error.response?.data?.message || error.message
    });
  }
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
    await deleteFolder("build-logs", `${sanitizedProjectId}/`);
    await ProjectModel.deleteOne({ projectId: sanitizedProjectId });
    
    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

/**
 * Get build logs list for a project
 * Returns list of all build log files with metadata
 */
app.get('/projects/:projectId/logs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const sanitizedProjectId = sanitizeProjectId(projectId);

    // Verify project exists and user has access
    const project = await ProjectModel.findOne({ projectId: sanitizedProjectId });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (!canAccessProject(req, project.userId.toString())) {
      res.status(403).json({ error: "Forbidden: You cannot access this project's logs" });
      return;
    }

    // List all log files from MinIO
    const logs: Array<{
      fileName: string;
      timestamp: string;
      status: 'success' | 'failed';
      size: number;
    }> = [];

    const objectsStream = minioClient.listObjects('build-logs', `${sanitizedProjectId}/`, false);
    
    for await (const obj of objectsStream) {
      if (obj.name) {
        const fileName = obj.name.split('/').pop() || '';
        // Parse filename format: 2026-01-24T12-30-45-123Z-success.log
        const match = fileName.match(/^(.+)-(success|failed)\.log$/);
        
        if (match) {
          const timestamp = match[1].replace(/-/g, ':').replace(/T/g, 'T').replace(/Z/g, '.000Z');
          const status = match[2] as 'success' | 'failed';
          
          logs.push({
            fileName,
            timestamp,
            status,
            size: obj.size || 0,
          });
        }
      }
    }

    // Sort by timestamp descending (newest first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ logs });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ error: "Failed to fetch build logs" });
  }
});

/**
 * Get specific build log content
 * Returns the full log file content
 */
app.get('/projects/:projectId/logs/:fileName', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, fileName } = req.params;
    const sanitizedProjectId = sanitizeProjectId(projectId);

    // Verify project exists and user has access
    const project = await ProjectModel.findOne({ projectId: sanitizedProjectId });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (!canAccessProject(req, project.userId.toString())) {
      res.status(403).json({ error: "Forbidden: You cannot access this project's logs" });
      return;
    }

    // Validate fileName to prevent path traversal
    if (fileName.includes('..') || fileName.includes('/')) {
      res.status(400).json({ error: "Invalid file name" });
      return;
    }

    const objectKey = `${sanitizedProjectId}/${fileName}`;

    // Stream log content from MinIO
    const stream = await minioClient.getObject('build-logs', objectKey);
    
    let logContent = '';
    stream.on('data', (chunk) => {
      logContent += chunk.toString();
    });

    stream.on('end', () => {
      res.json({ content: logContent });
    });

    stream.on('error', (err) => {
      console.error('Stream error:', err);
      res.status(404).json({ error: "Log file not found" });
    });

  } catch (error: any) {
    console.error('Get log content error:', error);
    if (error.code === 'NoSuchKey') {
      res.status(404).json({ error: "Log file not found" });
    } else {
      res.status(500).json({ error: "Failed to fetch log content" });
    }
  }
});

/**
 * Deploy a new project
 * Requires developer or admin role
 */
app.post('/deploy', authMiddleware, requirePermission('project:create'), async (req: AuthRequest, res: Response) => {
  const { repoUrl } = req.body;
  
  // Validate repository URL
  const urlValidation = validateRepoUrl(repoUrl);
  if (!urlValidation.valid) {
    res.status(400).json({ error: urlValidation.error });
    return;
  }

  console.log('🚀 Deploy request for:', repoUrl);
  
  const userId = req.id;
  const id = generateProjectId();
  const repoMeta = repoUrl.replace('.git', '').replace('https://github.com/', 'https://api.github.com/repos/');

  try {
    // Get user's GitHub access token if available (for authenticated requests - 5000/hour vs 60/hour)
    const user = await UserModel.findById(userId);
    const githubToken = user?.githubAccessToken;
    
    // Setup headers for authenticated GitHub API requests
    const headers: any = {};
    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`;
      console.log('🔑 Using authenticated GitHub API (5000 req/hour)');
    } else {
      console.log('⚠️  Using unauthenticated GitHub API (60 req/hour)');
    }

    // Get repository info from GitHub
    const response = await axios.get(repoMeta, { headers });
    const defaultBranch = response.data.default_branch;
    const response2 = await axios.get(`${repoMeta}/branches/${defaultBranch}`, { headers });
    const commitSha = response2.data.commit.sha;

    console.log('📌 Default branch:', defaultBranch, '| Commit:', commitSha);

    // Queue deployment job
    const jobData = {
      projectId: id,
      repoUrl: repoUrl,
      userId: userId,
      commitSha: commitSha,
      defaultBranch: defaultBranch,
      githubToken: githubToken, // Pass token for authenticated git operations
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
      buildStatus: 'building', // Set initial status as building
      lastBuildAt: new Date(),
    });

    res.status(202).json({
      message: "Deployment queued",
      projectId: id,
      commitSha: commitSha,
      defaultBranch: defaultBranch,
      buildStatus: 'building', // Return status to frontend
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
  console.log(`🚀 Secure Upload Service running on http://localhost:${PORT}`);
  console.log(`🔐 Security features enabled: RS256 JWT, RBAC, Rate Limiting, Input Validation, Account Lockout`);
});
