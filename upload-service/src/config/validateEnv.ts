/**
 * Environment Validation Module
 * Ensures all required security configurations are present
 * 
 * Course Relevance:
 * - CO3: Protection policies - fail-safe defaults
 */

interface EnvConfig {
  // Database
  MONGODB_URI: string;
  
  // Redis
  REDIS_HOST: string;
  REDIS_PORT: number;
  
  // MinIO
  MINIO_ENDPOINT: string;
  MINIO_PORT: number;
  MINIO_ACCESS_KEY: string;
  MINIO_SECRET_KEY: string;
  MINIO_USE_SSL: boolean;
  
  // Security
  NODE_ENV: string;
  FRONTEND_URL: string;
  
  // Optional
  PORT: number;
  KEYS_DIR?: string;
}

const requiredEnvVars = [
  'MONGODB_URI',
  'REDIS_HOST',
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY'
];

const warningEnvVars = [
  'FRONTEND_URL'
];

/**
 * Validate that all required environment variables are set
 * Fails fast if critical configuration is missing
 */
export function validateEnvironment(): void {
  console.log('🔍 Validating environment configuration...');
  
  const missing: string[] = [];
  const warnings: string[] = [];
  
  // Check required variables
  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  // Check warning-level variables
  for (const key of warningEnvVars) {
    if (!process.env[key]) {
      warnings.push(key);
    }
  }
  
  // Log warnings
  if (warnings.length > 0) {
    console.warn(`⚠️ Missing optional environment variables: ${warnings.join(', ')}`);
  }
  
  // Fail on missing required variables (only in production)
  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please set all required environment variables before starting the server.');
    process.exit(1);
  } else if (missing.length > 0) {
    console.warn(`⚠️ Missing environment variables (using defaults): ${missing.join(', ')}`);
  }
  
  // Security checks
  if (process.env.NODE_ENV === 'production') {
    // Check for insecure defaults
    if (process.env.MINIO_ACCESS_KEY === 'minioadmin') {
      console.warn('⚠️ SECURITY WARNING: Using default MinIO credentials in production!');
    }
  }
  
  console.log('✅ Environment validation complete');
}

/**
 * Get parsed environment configuration with defaults
 */
export function getConfig(): EnvConfig {
  return {
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/automated-deployment',
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'localhost',
    MINIO_PORT: parseInt(process.env.MINIO_PORT || '9000'),
    MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || 'minioadmin',
    MINIO_USE_SSL: process.env.MINIO_USE_SSL === 'true',
    NODE_ENV: process.env.NODE_ENV || 'development',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    PORT: parseInt(process.env.PORT || '3000'),
    KEYS_DIR: process.env.KEYS_DIR
  };
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
