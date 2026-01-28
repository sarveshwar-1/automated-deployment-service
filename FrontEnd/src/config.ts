/**
 * Frontend Configuration
 * 
 * Centralized configuration for all environment variables.
 * Uses Vite environment variables - prefix with VITE_ to expose to client.
 * This ensures consistent IP/URL usage across the frontend.
 */

// Server IP - used to construct all URLs (can be overridden by full URLs)
export const SERVER_IP = import.meta.env.VITE_SERVER_IP || 'localhost';

// Service Ports
export const UPLOAD_SERVICE_PORT = parseInt(import.meta.env.VITE_UPLOAD_SERVICE_PORT || '3002', 10);
export const BUILD_SERVICE_PORT_NUM = parseInt(import.meta.env.VITE_BUILD_SERVICE_PORT || '3001', 10);
export const ANALYTICS_SERVICE_PORT = parseInt(import.meta.env.VITE_ANALYTICS_SERVICE_PORT || '5000', 10);
export const FRONTEND_PORT = parseInt(import.meta.env.VITE_FRONTEND_PORT || '5173', 10);

// API URLs - prefer explicit URL if set, otherwise construct from SERVER_IP
export const API_URL = import.meta.env.VITE_API_URL || `http://${SERVER_IP}:${UPLOAD_SERVICE_PORT}`;
export const BUILD_SERVICE_URL = import.meta.env.VITE_BUILD_SERVICE_URL || `http://${SERVER_IP}:${BUILD_SERVICE_PORT_NUM}`;
export const ANALYTICS_SERVICE_URL = import.meta.env.VITE_ANALYTICS_SERVICE_URL || `http://${SERVER_IP}:${ANALYTICS_SERVICE_PORT}`;
export const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || `http://${SERVER_IP}:${FRONTEND_PORT}`;

// GitHub OAuth callback URL
export const GITHUB_CALLBACK_URL = import.meta.env.VITE_GITHUB_CALLBACK_URL || `${FRONTEND_URL}/auth/github/callback`;

// Extract host and port for legacy compatibility
const apiUrl = new URL(API_URL);
const buildUrl = new URL(BUILD_SERVICE_URL);

export const API_HOST = apiUrl.hostname;
export const API_PORT = parseInt(apiUrl.port) || UPLOAD_SERVICE_PORT;
export const BUILD_SERVICE_HOST = buildUrl.hostname;
export const BUILD_SERVICE_PORT = parseInt(buildUrl.port) || BUILD_SERVICE_PORT_NUM;

// Export all config as a single object for convenience
export const config = {
  serverIp: SERVER_IP,
  ports: {
    uploadService: UPLOAD_SERVICE_PORT,
    buildService: BUILD_SERVICE_PORT_NUM,
    analyticsService: ANALYTICS_SERVICE_PORT,
    frontend: FRONTEND_PORT,
  },
  urls: {
    api: API_URL,
    buildService: BUILD_SERVICE_URL,
    analyticsService: ANALYTICS_SERVICE_URL,
    frontend: FRONTEND_URL,
  },
  github: {
    callbackUrl: GITHUB_CALLBACK_URL,
  },
};

export default config;
