// Environment configuration for host-service
import dotenv from 'dotenv';
dotenv.config();

export const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
export const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/automated-deployment';
export const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
export const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
export const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
export const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
export const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
export const SERVER_IP = process.env.SERVER_IP || 'localhost';
export const HOST_SERVICE_PORT = parseInt(process.env.HOST_SERVICE_PORT || '3001');

// Port ranges for projects and isolated endpoints
export const PROJECT_PORT_START = 4001;
export const PROJECT_PORT_END = 4999;
export const ISOLATED_PORT_START = 5001;
export const ISOLATED_PORT_END = 5999;

// Paths
export const REGISTRY_PATH = process.env.REGISTRY_PATH || '/app/registry/port-registry.json';
export const PROJECTS_PATH = process.env.PROJECTS_PATH || '/app/projects';

// Traffic monitoring thresholds
export const ISOLATION_THRESHOLD_RPM = parseInt(process.env.ISOLATION_THRESHOLD_RPM || '100'); // requests per minute
