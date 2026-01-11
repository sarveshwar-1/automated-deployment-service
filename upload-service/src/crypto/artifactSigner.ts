import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPrivateKey, getPublicKey } from './keyManager';

/**
 * Artifact Signing Module
 * Digitally signs deployment packages to ensure integrity and authenticity
 * 
 * Course Relevance:
 * - CO1: Digital signatures
 * - Ensures integrity of deployment artifacts
 */

interface SignedArtifact {
  signature: string;
  signedAt: string;
  algorithm: string;
}

/**
 * Sign a deployment artifact (file or buffer) using RSA-SHA256
 * @param artifact - File path or Buffer to sign
 */
export function signArtifact(artifact: string | Buffer): SignedArtifact {
  const privateKey = getPrivateKey();
  
  let data: Buffer;
  if (typeof artifact === 'string') {
    // It's a file path
    data = fs.readFileSync(artifact);
  } else {
    data = artifact;
  }
  
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data);
  const signature = signer.sign(privateKey, 'base64');
  
  return {
    signature,
    signedAt: new Date().toISOString(),
    algorithm: 'RSA-SHA256'
  };
}

/**
 * Verify a signed artifact
 * @param artifact - File path or Buffer to verify
 * @param signature - Base64 encoded signature
 */
export function verifyArtifact(artifact: string | Buffer, signature: string): boolean {
  const publicKey = getPublicKey();
  
  let data: Buffer;
  if (typeof artifact === 'string') {
    data = fs.readFileSync(artifact);
  } else {
    data = artifact;
  }
  
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(data);
  
  try {
    return verifier.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Sign multiple files and create a manifest
 */
export function signDirectory(dirPath: string): Record<string, SignedArtifact> {
  const manifest: Record<string, SignedArtifact> = {};
  
  const files = getAllFilesRecursive(dirPath);
  for (const file of files) {
    const relativePath = path.relative(dirPath, file);
    manifest[relativePath] = signArtifact(file);
  }
  
  return manifest;
}

/**
 * Verify all files in a directory against a manifest
 */
export function verifyDirectory(dirPath: string, manifest: Record<string, SignedArtifact>): {
  valid: boolean;
  details: Record<string, boolean>;
} {
  const details: Record<string, boolean> = {};
  let allValid = true;
  
  for (const [relativePath, signedArtifact] of Object.entries(manifest)) {
    const fullPath = path.join(dirPath, relativePath);
    
    if (!fs.existsSync(fullPath)) {
      details[relativePath] = false;
      allValid = false;
      continue;
    }
    
    const isValid = verifyArtifact(fullPath, signedArtifact.signature);
    details[relativePath] = isValid;
    if (!isValid) allValid = false;
  }
  
  return { valid: allValid, details };
}

/**
 * Calculate SHA-256 hash of a file
 */
export function hashFile(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Helper: Get all files in directory recursively
 */
function getAllFilesRecursive(dirPath: string): string[] {
  const files: string[] = [];
  
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllFilesRecursive(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}
