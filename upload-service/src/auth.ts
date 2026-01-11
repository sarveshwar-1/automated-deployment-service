import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getPrivateKey, getPublicKey } from './crypto/keyManager';

/**
 * Authentication Module with RS256 (Asymmetric) JWT Signing
 * 
 * Course Relevance:
 * - CO1: Public key algorithms (RSA), Key distribution
 * - CO2: Authentication protocols, Kerberos-like token refresh
 */

// Token expiration settings (Kerberos-style short-lived tokens)
export const ACCESS_TOKEN_EXPIRY = '15m';  // Short-lived access token
export const REFRESH_TOKEN_EXPIRY = '7d';  // Long-lived refresh token

// Type definitions
export interface TokenPayload {
  id: string;
  role: string;
  type: 'access' | 'refresh';
  jti?: string; // JWT ID for refresh token tracking
}

export interface AuthRequest extends Request {
  id?: string;
  role?: string;
  user?: TokenPayload;
}

/**
 * Sign an access token using RS256 (asymmetric cryptography)
 * Private key stays on auth server - demonstrates key distribution principle
 */
export function signAccessToken(userId: string, role: string): string {
  const privateKey = getPrivateKey();
  return jwt.sign(
    { 
      id: userId, 
      role: role,
      type: 'access' 
    } as TokenPayload,
    privateKey,
    { 
      algorithm: 'RS256',
      expiresIn: ACCESS_TOKEN_EXPIRY 
    }
  );
}

/**
 * Sign a refresh token with unique JWT ID for revocation capability
 */
export function signRefreshToken(userId: string, role: string, jti: string): string {
  const privateKey = getPrivateKey();
  return jwt.sign(
    { 
      id: userId, 
      role: role,
      type: 'refresh',
      jti: jti
    } as TokenPayload,
    privateKey,
    { 
      algorithm: 'RS256',
      expiresIn: REFRESH_TOKEN_EXPIRY 
    }
  );
}

/**
 * Verify a JWT token using public key
 * Public key can be distributed to all services - demonstrates key distribution
 */
export function verifyToken(token: string): TokenPayload {
  const publicKey = getPublicKey();
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as TokenPayload;
}

/**
 * Authentication middleware - verifies access tokens
 * Extracts user info and attaches to request
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  console.log("🔐 Auth middleware: Verifying token");
  
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers.token as string;
  
  if (!token) {
    res.status(401).json({ error: "Authorization token required" });
    return;
  }

  try {
    const decoded = verifyToken(token);
    
    // Ensure it's an access token, not a refresh token
    if (decoded.type !== 'access') {
      res.status(401).json({ error: "Invalid token type. Use access token." });
      return;
    }
    
    req.id = decoded.id;
    req.role = decoded.role;
    req.user = decoded;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: "Token expired. Please refresh your token." });
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    console.error("Auth error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
}

/**
 * Legacy JWT_SECRET export for backward compatibility during migration
 * @deprecated Use RS256 signing instead
 */
export const JWT_SECRET = process.env.JWT_SECRET || "deprecated-use-RS256";
