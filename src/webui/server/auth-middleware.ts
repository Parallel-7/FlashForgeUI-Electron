/**
 * @fileoverview Express middleware for WebUI authentication, CORS, rate limiting, and request logging.
 *
 * Provides comprehensive middleware stack for securing and monitoring WebUI API endpoints including
 * authentication token validation, login rate limiting to prevent brute force attacks, CORS policy
 * enforcement restricted to private network origins, error handling with standardized responses,
 * and request logging for debugging. The authentication middleware extends Express Request with
 * auth information and validates Bearer tokens on all protected routes. Rate limiting middleware
 * tracks login attempts by IP address with configurable thresholds and time windows. CORS middleware
 * restricts access to localhost and RFC 1918 private network ranges for security while enabling
 * local development and deployment scenarios.
 *
 * Key exports:
 * - createAuthMiddleware(): Required authentication for protected routes
 * - createOptionalAuthMiddleware(): Optional authentication that checks but doesn't require tokens
 * - createLoginRateLimiter(): Rate limiting for login endpoint (5 attempts per 15 minutes)
 * - createCorsMiddleware(): CORS policy for private network and localhost origins
 * - createErrorMiddleware(): Centralized error handling with standardized responses
 * - createRequestLogger(): Request logging with method, path, status code, and duration
 * - AuthenticatedRequest: Extended Request interface with auth property
 */

import { Request, Response, NextFunction } from 'express';
import { getAuthManager } from './AuthManager';
import { StandardAPIResponse } from '../types/web-api.types';

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
 * Optional auth middleware - doesn't require auth but checks if provided
 */
export function createOptionalAuthMiddleware() {
  const authManager = getAuthManager();
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authManager.extractTokenFromHeader(authHeader);
    
    if (token && authManager.verifyToken(token)) {
      req.auth = {
        token,
        authenticated: true
      };
    } else {
      req.auth = {
        token: '',
        authenticated: false
      };
    }
    
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
 * CORS middleware for web UI
 * Restricts to localhost and private network origins for security while allowing local apps
 */
export function createCorsMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    // Allow localhost, 127.0.0.1, and private network ranges (RFC 1918)
    const allowedOriginPatterns = [
      // Localhost
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      // Private network Class A: 10.0.0.0 - 10.255.255.255
      /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      // Private network Class B: 172.16.0.0 - 172.31.255.255
      /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      // Private network Class C: 192.168.0.0 - 192.168.255.255
      /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/
    ];

    // Check if origin matches allowed patterns or is undefined (non-browser requests)
    const isAllowed = !origin || allowedOriginPatterns.some(pattern => pattern.test(origin));

    if (isAllowed && origin) {
      res.header('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      // No origin header (curl, Electron, native apps) - allow by not setting CORS header
      res.header('Access-Control-Allow-Origin', '*');
    } else {
      // Reject non-private network origins
      res.status(403).json({ success: false, error: 'Origin not allowed' });
      return;
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
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
