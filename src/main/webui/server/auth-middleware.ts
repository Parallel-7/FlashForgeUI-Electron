/**
 * @fileoverview Express middleware for WebUI authentication, rate limiting, and request logging.
 *
 * Provides comprehensive middleware stack for securing and monitoring WebUI API endpoints including
 * authentication token validation, login rate limiting to prevent brute force attacks, error handling
 * with standardized responses, and request logging for debugging. The authentication middleware extends
 * Express Request with auth information and validates Bearer tokens on all protected routes. Rate limiting
 * middleware tracks login attempts by IP address with configurable thresholds and time windows.
 *
 * Key exports:
 * - createAuthMiddleware(): Required authentication for protected routes
 * - createLoginRateLimiter(): Rate limiting for login endpoint (5 attempts per 15 minutes)
 * - createErrorMiddleware(): Centralized error handling with standardized responses
 * - createRequestLogger(): Request logging with method, path, status code, and duration
 * - AuthenticatedRequest: Extended Request interface with auth property
 */

import { Request, Response, NextFunction } from 'express';
import { getAuthManager } from './AuthManager.js';
import { StandardAPIResponse } from '@shared/types/web-api.types.js';

/**
 * Extended Express Request with auth info
 */
export interface AuthenticatedRequest extends Request {
  auth?: {
    token: string;
    authenticated: boolean;
  };
}

/**
 * Authentication middleware factory
 */
export function createAuthMiddleware() {
  const authManager = getAuthManager();
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!authManager.isAuthenticationRequired()) {
      req.auth = {
        token: '',
        authenticated: true
      };
      next();
      return;
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authManager.extractTokenFromHeader(authHeader);
    
    if (!token) {
      const response: StandardAPIResponse = {
        success: false,
        error: 'Missing authentication token'
      };
      res.status(401).json(response);
      return;
    }
    
    // Verify token
    if (!authManager.verifyToken(token)) {
      const response: StandardAPIResponse = {
        success: false,
        error: 'Invalid or expired token'
      };
      res.status(401).json(response);
      return;
    }
    
    // Attach auth info to request
    req.auth = {
      token,
      authenticated: true
    };
    
    next();
  };
}

/**
 * Rate limiting middleware for login attempts
 */
export function createLoginRateLimiter() {
  const attempts = new Map<string, { count: number; resetTime: number }>();
  const maxAttempts = 5;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    
    // Get or create attempt record
    let record = attempts.get(ip);
    
    if (!record || record.resetTime < now) {
      record = {
        count: 0,
        resetTime: now + windowMs
      };
      attempts.set(ip, record);
    }
    
    // Check if limit exceeded
    if (record.count >= maxAttempts) {
      const response: StandardAPIResponse = {
        success: false,
        error: 'Too many login attempts. Please try again later.'
      };
      res.status(429).json(response);
      return;
    }
    
    // Increment attempt count
    record.count++;
    
    // Clean up old entries periodically
    if (Math.random() < 0.1) { // 10% chance
      for (const [key, value] of attempts.entries()) {
        if (value.resetTime < now) {
          attempts.delete(key);
        }
      }
    }
    
    next();
  };
}

/**
 * Error handling middleware
 */
export function createErrorMiddleware() {
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    console.error('Express error:', err);
    
    const response: StandardAPIResponse = {
      success: false,
      error: 'Internal server error'
    };
    
    res.status(500).json(response);
  };
}

/**
 * Request logging middleware
 */
export function createRequestLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[WebUI] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    
    next();
  };
}

