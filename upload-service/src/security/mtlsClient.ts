import https from 'https';
import fs from 'fs';
import path from 'path';

/**
 * Mutual TLS (mTLS) Client Module
 * Enables secure service-to-service communication with certificate authentication
 * 
 * Course Relevance:
 * - CO4: Client-side certificates, Trusted Systems
 * - CO2: DS (Directory Service) Authentication
 */

const CERTS_DIR = process.env.CERTS_DIR || path.join(__dirname, '../../certs');

interface MTLSConfig {
  cert: Buffer;
  key: Buffer;
  ca: Buffer;
  rejectUnauthorized: boolean;
}

/**
 * Load mTLS certificates from filesystem
 */
export function loadMTLSConfig(): MTLSConfig | null {
  const certPath = path.join(CERTS_DIR, 'client.crt');
  const keyPath = path.join(CERTS_DIR, 'client.key');
  const caPath = path.join(CERTS_DIR, 'ca.crt');
  
  // Check if all certs exist
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath) || !fs.existsSync(caPath)) {
    console.warn('⚠️ mTLS certificates not found. Service-to-service auth disabled.');
    return null;
  }
  
  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
    ca: fs.readFileSync(caPath),
    rejectUnauthorized: true
  };
}

/**
 * Create an HTTPS agent with mTLS for secure service-to-service calls
 */
export function createMTLSAgent(): https.Agent | null {
  const config = loadMTLSConfig();
  
  if (!config) {
    return null;
  }
  
  return new https.Agent({
    cert: config.cert,
    key: config.key,
    ca: config.ca,
    rejectUnauthorized: config.rejectUnauthorized
  });
}

/**
 * Make an mTLS-authenticated request to another service
 * Falls back to regular HTTP if mTLS is not configured
 */
export async function mtlsRequest(url: string, options: https.RequestOptions = {}): Promise<string> {
  const agent = createMTLSAgent();
  
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      ...options,
      agent: agent || undefined
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.end();
  });
}

/**
 * Verify if mTLS is properly configured
 */
export function isMTLSEnabled(): boolean {
  return loadMTLSConfig() !== null;
}

/**
 * Generate self-signed certificates for development
 * In production, use proper CA-signed certificates
 */
export function generateDevCerts(): void {
  console.log(`
  To generate development certificates, run:
  
  # Create CA
  openssl genrsa -out ca.key 4096
  openssl req -new -x509 -days 365 -key ca.key -out ca.crt -subj "/CN=Dev CA"
  
  # Create server certificate
  openssl genrsa -out server.key 2048
  openssl req -new -key server.key -out server.csr -subj "/CN=localhost"
  openssl x509 -req -days 365 -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt
  
  # Create client certificate
  openssl genrsa -out client.key 2048
  openssl req -new -key client.key -out client.csr -subj "/CN=upload-service"
  openssl x509 -req -days 365 -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt
  `);
}
