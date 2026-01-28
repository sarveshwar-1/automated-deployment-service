/**
 * Environment Configuration
 * 
 * Centralized configuration for all environment variables.
 * Reads from .env file and exports typed configuration values.
 * This ensures consistent IP/URL usage across the entire service.
 */
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Server IP - used to construct all URLs
export const SERVER_IP = process.env.SERVER_IP || 'localhost';

// Service Ports
export const UPLOAD_SERVICE_PORT = parseInt(process.env.UPLOAD_SERVICE_PORT || '3002', 10);
export const BUILD_SERVICE_PORT = parseInt(process.env.BUILD_SERVICE_PORT || '3001', 10);
export const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '5173', 10);

// Constructed URLs using SERVER_IP
export const UPLOAD_SERVICE_URL = `http://${SERVER_IP}:${UPLOAD_SERVICE_PORT}`;
export const BUILD_SERVICE_URL = `http://${SERVER_IP}:${BUILD_SERVICE_PORT}`;
export const FRONTEND_URL = process.env.FRONTEND_URL || `http://${SERVER_IP}:${FRONTEND_PORT}`;

// Database Configuration
export const MONGODB_URI = process.env.MONGODB_URI || `mongodb://${SERVER_IP}:27017/automated-deployment`;
export const REDIS_HOST = process.env.REDIS_HOST || SERVER_IP;
export const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

// MinIO Configuration
export const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || SERVER_IP;
export const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
export const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
export const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
export const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';

// Kafka Configuration
export const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:29092';

// Allowed Origins for CORS
export const ALLOWED_ORIGINS = [
  FRONTEND_URL,
  `http://${SERVER_IP}:${FRONTEND_PORT}`,
  `http://${SERVER_IP}:${UPLOAD_SERVICE_PORT}`,
  `http://localhost:${FRONTEND_PORT}`,
  `http://localhost:${UPLOAD_SERVICE_PORT}`,
];

// Export all config as a single object for convenience
export const config = {
  serverIp: SERVER_IP,
  ports: {
    uploadService: UPLOAD_SERVICE_PORT,
    buildService: BUILD_SERVICE_PORT,
    frontend: FRONTEND_PORT,
  },
  urls: {
    uploadService: UPLOAD_SERVICE_URL,
    buildService: BUILD_SERVICE_URL,
    frontend: FRONTEND_URL,
  },
  database: {
    mongoUri: MONGODB_URI,
    redisHost: REDIS_HOST,
    redisPort: REDIS_PORT,
  },
  minio: {
    endpoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY,
    useSSL: MINIO_USE_SSL,
  },
  kafka: {
    broker: KAFKA_BROKER,
  },
  allowedOrigins: ALLOWED_ORIGINS,
};

export default config;
