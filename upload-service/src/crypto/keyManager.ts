import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Key Manager for RSA key pair management
 * Handles loading, generating, and caching of cryptographic keys
 */

const KEYS_DIR = process.env.KEYS_DIR || path.join(__dirname, '../../keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

let privateKeyCache: string | null = null;
let publicKeyCache: string | null = null;

/**
 * Generate a new RSA key pair if none exists
 */
export function generateKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Create keys directory if it doesn't exist
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 }); // Only owner can read
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });

  console.log('🔐 Generated new RSA key pair');
  return { privateKey, publicKey };
}

/**
 * Load private key from file system
 * Generates new key pair if not found
 */
export function getPrivateKey(): string {
  if (privateKeyCache) {
    return privateKeyCache;
  }

  try {
    if (fs.existsSync(PRIVATE_KEY_PATH)) {
      privateKeyCache = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
      return privateKeyCache;
    }
  } catch (error) {
    console.warn('⚠️ Could not load private key, generating new pair...');
  }

  const { privateKey } = generateKeyPair();
  privateKeyCache = privateKey;
  return privateKey;
}

/**
 * Load public key from file system
 * Generates new key pair if not found
 */
export function getPublicKey(): string {
  if (publicKeyCache) {
    return publicKeyCache;
  }

  try {
    if (fs.existsSync(PUBLIC_KEY_PATH)) {
      publicKeyCache = fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8');
      return publicKeyCache;
    }
  } catch (error) {
    console.warn('⚠️ Could not load public key, generating new pair...');
  }

  const { publicKey } = generateKeyPair();
  publicKeyCache = publicKey;
  return publicKey;
}

/**
 * Clear key cache (useful for testing or key rotation)
 */
export function clearKeyCache(): void {
  privateKeyCache = null;
  publicKeyCache = null;
}

/**
 * Check if keys exist
 */
export function keysExist(): boolean {
  return fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH);
}
