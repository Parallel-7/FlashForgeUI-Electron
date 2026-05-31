/**
 * @fileoverview Middleware for adding security headers to HTTP responses.
 *
 * Implements a defense-in-depth strategy by adding HTTP headers that protect against
 * common web vulnerabilities:
 * - X-Content-Type-Options: Prevents MIME-sniffing attacks.
 * - X-Frame-Options: Protects against clickjacking by restricting iframe embedding.
 * - Referrer-Policy: Controls how much referrer information is included with requests.
 * - Content-Security-Policy: Restricts sources of executable scripts, styles, and other resources.
 *
 * The Content-Security-Policy is configured to be compatible with the application's
 * use of inline scripts/styles (GridStack, etc.) and WebSocket connections for video streaming,
 * while still providing significant protection against object injection and base URI hijacking.
 */

import { NextFunction, Request, Response } from 'express';

/**
 * Creates a middleware that adds security headers to every response.
 */
export function createSecurityMiddleware() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Prevent MIME-sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Protect against clickjacking (allow same origin)
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy
    // We allow 'unsafe-inline' for scripts and styles because the current architecture
    // uses inline scripts/styles (e.g., GridStack, video player).
    // We allow ws: and wss: for WebSocket connections.
    // We allow blob: and data: for media (HLS, MJPEG).
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self' ws: wss: http: https:", // http/https needed for HLS playlist construction if applicable
      "media-src 'self' blob: data:",
      "object-src 'none'", // Block <object>, <embed>, <applet>
      "base-uri 'self'", // Restrict <base> tag
    ];

    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

    next();
  };
}
