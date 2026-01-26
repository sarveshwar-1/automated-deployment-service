const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.ObjectId;

/**
 * User Schema with security enhancements:
 * - Role-based access control (RBAC)
 * - Account lockout after failed attempts
 * - Password change tracking
 */
const userSchema = new Schema({
  email: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  password: { type: String, required: false }, // Optional for GitHub OAuth users
  
  // GitHub OAuth fields
  githubId: { type: String, unique: true, sparse: true }, // GitHub user ID
  githubUsername: { type: String }, // GitHub username
  githubAccessToken: { type: String }, // Encrypted token for API access
  authProvider: { 
    type: String, 
    enum: ['local', 'github'], 
    default: 'local' 
  },
  
  // RBAC - Role-based access control
  role: {
    type: String,
    enum: ['admin', 'developer', 'viewer'],
    default: 'developer'
  },
  // Account lockout fields
  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },
  lastFailedLogin: { type: Date, default: null },
  lastSuccessfulLogin: { type: Date, default: null },
  // Password management
  lastPasswordChange: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const projectSchema = new Schema({
  url: String,
  projectId: String,
  userId: ObjectId,
  commitSha: String,
  defaultBranch: String,
  // Deployment configuration
  deploymentType: {
    type: String,
    enum: ['vite-react-ts', 'vite-react', 'create-react-app', 'nextjs', 'static', 'custom'],
    default: 'vite-react-ts'
  },
  buildCommand: { type: String, default: null }, // Custom build command override
  outputDir: { type: String, default: null }, // Custom output directory
  envVars: { type: Map, of: String, default: {} }, // Build-time environment variables
  // Build status tracking
  buildStatus: { 
    type: String, 
    enum: ['pending', 'building', 'success', 'failed'], 
    default: 'pending' 
  },
  buildError: { type: String, default: null },
  lastBuildAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

/**
 * Refresh Token Schema for secure token refresh mechanism
 * Similar to Kerberos ticket-granting tickets
 */
const refreshTokenSchema = new Schema({
  userId: { type: ObjectId, required: true, ref: 'users' },
  token: { type: String, required: true, unique: true },
  jti: { type: String, required: true, unique: true }, // JWT ID for revocation
  expiresAt: { type: Date, required: true },
  isRevoked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  userAgent: String,
  ipAddress: String
});

// Index for efficient token lookup and cleanup
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1 });

// Define the collection models
export const UserModel = mongoose.model('users', userSchema);
export const ProjectModel = mongoose.model('projects', projectSchema);
export const RefreshTokenModel = mongoose.model('refreshTokens', refreshTokenSchema);
