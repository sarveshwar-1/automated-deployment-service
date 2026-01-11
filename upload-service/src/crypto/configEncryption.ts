import crypto from 'crypto';

/**
 * Configuration Encryption Module
 * Encrypts sensitive configuration data at rest using AES-256-GCM
 * 
 * Course Relevance:
 * - CO1: Ciphers (symmetric encryption)
 * - Confidentiality of credentials
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const TAG_LENGTH = 16; // GCM auth tag length

interface EncryptedData {
  iv: string;
  data: string;
  tag: string;
}

/**
 * Derive a key from a password using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param plaintext - The data to encrypt
 * @param masterKey - 32-byte encryption key (or password to derive from)
 */
export function encrypt(plaintext: string, masterKey: string | Buffer): EncryptedData {
  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Use key directly if Buffer, otherwise derive from password
  const key = Buffer.isBuffer(masterKey) 
    ? masterKey 
    : deriveKey(masterKey, Buffer.from('deployment-service-salt'));
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  
  // Get auth tag
  const tag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    data: encrypted.toString('hex'),
    tag: tag.toString('hex')
  };
}

/**
 * Decrypt data encrypted with AES-256-GCM
 * @param encryptedData - The encrypted data object
 * @param masterKey - 32-byte encryption key (or password to derive from)
 */
export function decrypt(encryptedData: EncryptedData, masterKey: string | Buffer): string {
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const data = Buffer.from(encryptedData.data, 'hex');
  const tag = Buffer.from(encryptedData.tag, 'hex');
  
  // Use key directly if Buffer, otherwise derive from password
  const key = Buffer.isBuffer(masterKey) 
    ? masterKey 
    : deriveKey(masterKey, Buffer.from('deployment-service-salt'));
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(data),
    decipher.final()
  ]);
  
  return decrypted.toString('utf8');
}

/**
 * Encrypt a configuration object
 */
export function encryptConfig(config: Record<string, string>, masterKey: string): Record<string, EncryptedData> {
  const encrypted: Record<string, EncryptedData> = {};
  
  for (const [key, value] of Object.entries(config)) {
    encrypted[key] = encrypt(value, masterKey);
  }
  
  return encrypted;
}

/**
 * Decrypt a configuration object
 */
export function decryptConfig(encryptedConfig: Record<string, EncryptedData>, masterKey: string): Record<string, string> {
  const decrypted: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(encryptedConfig)) {
    decrypted[key] = decrypt(value, masterKey);
  }
  
  return decrypted;
}

/**
 * Generate a secure random master key
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
