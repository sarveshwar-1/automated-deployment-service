import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate Limiting Module
 * Prevents brute-force attacks and DoS
 * 
 * Course Relevance:
 * - CO2: Intrusion prevention
 * - CO3: Threat mitigation
 */

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 attempts per 15 minutes per IP
 * Prevents brute-force password attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req: Request): string => {
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  }
});

/**
 * Rate limiter for signup endpoint
 * 10 signups per hour per IP
 * Prevents mass account creation
 */
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many accounts created. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  }
});

/**
 * Rate limiter for deployment operations
 * 20 deployments per hour per user
 */
export const deployLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { error: 'Too many deployments. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    // Use user ID if authenticated, otherwise IP
    return (req as any).id || req.ip || 'unknown';
  }
});

/**
 * Rate limiter for token refresh
 * 30 refreshes per hour per user
 */
export const refreshLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: { error: 'Too many token refresh requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  }
});
