/**
 * @fileoverview Middleware for adding security headers to HTTP responses.
 *
 * Implements "Defense in Depth" by adding standard security headers to all WebUI responses.
 * These headers help prevent common attacks such as XSS, clickjacking, and MIME sniffing.
 */

import { NextFunction, Request, Response } from 'express';

/**
 * Creates middleware that adds security headers to the response.
 */
export function createSecurityHeadersMiddleware() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking by denying framing (or allowing sameorigin)
    // We use SAMEORIGIN to allow the UI to potentially frame itself if needed,
    // though typically it's better to verify if this is needed.
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Enable XSS filtering in browsers that support it (mostly legacy, but good for depth)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    next();
  };
}
