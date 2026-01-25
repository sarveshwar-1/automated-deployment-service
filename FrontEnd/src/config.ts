// API Configuration
// Uses Vite environment variables - prefix with VITE_ to expose to client
export const API_URL = import.meta.env.VITE_API_URL || 'http://172.17.9.74:3002';
export const BUILD_SERVICE_URL = import.meta.env.VITE_BUILD_SERVICE_URL || 'http://172.17.9.74:3001';

// Extract host and port for legacy compatibility
const apiUrl = new URL(API_URL);
const buildUrl = new URL(BUILD_SERVICE_URL);

export const API_HOST = apiUrl.hostname;
export const API_PORT = parseInt(apiUrl.port) || 3002;
export const BUILD_SERVICE_HOST = buildUrl.hostname;
export const BUILD_SERVICE_PORT = parseInt(buildUrl.port) || 3001;
