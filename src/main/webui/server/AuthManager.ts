/**
 * @fileoverview Authentication manager for WebUI providing password validation and session token management.
 *
 * Manages all aspects of WebUI authentication including password validation against configured
 * credentials, secure JWT-style token generation with HMAC signatures, session lifecycle tracking,
 * and automatic session cleanup. Supports both persistent (24-hour) and temporary (1-hour) sessions
 * based on "remember me" preferences. Tokens are cryptographically signed using SHA-256 HMAC with
 * a secret derived from the WebUI password, preventing tampering and ensuring secure authentication.
 * Integrates with ConfigManager for password storage and provides session management including
 * token revocation, activity tracking, and automatic expiration cleanup.
 *
 * Key exports:
 * - AuthManager class: Main authentication service with singleton pattern
 * - getAuthManager(): Singleton accessor function
 * - Session management: validateLogin, validateToken, revokeToken, getActiveSessionCount
 * - Token utilities: extractTokenFromHeader, getAuthStatus
 * - Cleanup: Automatic session expiration every 5 minutes, manual clearAllSessions
 */

import { WebUIAuthStatus, WebUILoginRequest, WebUILoginResponse } from '@shared/types/web-api.types.js';
import * as crypto from 'crypto';
import { getConfigManager } from '../../managers/ConfigManager.js';
import { validateAuthToken } from '../schemas/web-api.schemas.js';

/**
 * Token payload structure
 */
interface TokenPayload {
  readonly sessionId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly persistent: boolean;
}

/**
 * Stored session information
 */
interface SessionInfo {
  readonly token: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  lastActivity: Date; // Mutable for updates
  readonly persistent: boolean;
}

/**
 * Authentication manager for web UI
 */
export class AuthManager {
  private readonly configManager = getConfigManager();
  private readonly sessions = new Map<string, SessionInfo>();
  private readonly sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours for persistent
  private readonly tempSessionTimeout = 60 * 60 * 1000; // 1 hour for temporary
  private readonly PBKDF2_ITERATIONS = 210000; // OWASP recommended minimum for PBKDF2-HMAC-SHA512
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic cleanup of expired sessions
    this.startSessionCleanup();
  }

  /**
   * Initialize authentication manager and migrate password if needed
   */
  public initialize(): void {
    const config = this.configManager.getConfig();
    const currentPassword = config.WebUIPassword;

    // Check if password needs migration (is not hashed)
    if (currentPassword && !currentPassword.startsWith('pbkdf2:')) {
      console.log('Migrating WebUI password to secure hash...');
      const hashedPassword = this.hashPassword(currentPassword);
      this.configManager.set('WebUIPassword', hashedPassword);
    }
  }

  /**
   * Hash a password using PBKDF2
   */
  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const iterations = this.PBKDF2_ITERATIONS;
    const keylen = 64;
    const digest = 'sha512';

    const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
    return `pbkdf2:${digest}:${iterations}:${salt}:${hash}`;
  }

  /**
   * Verify a password against a stored hash (or plaintext for legacy)
   */
  private verifyPassword(password: string, storedPassword: string): boolean {
    // Handle legacy plaintext passwords
    if (!storedPassword.startsWith('pbkdf2:')) {
      const passwordBuffer = Buffer.from(password);
      const storedBuffer = Buffer.from(storedPassword);
      if (passwordBuffer.length !== storedBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(passwordBuffer, storedBuffer);
    }

    try {
      const parts = storedPassword.split(':');
      if (parts.length !== 5) {
        return false;
      }

      const [scheme, digest, iterationsStr, salt, expectedHash] = parts;
      if (scheme !== 'pbkdf2') {
        return false;
      }

      const iterations = parseInt(iterationsStr, 10);
      const keylen = Buffer.from(expectedHash, 'hex').length;

      const hash = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');

      const hashBuffer = Buffer.from(hash, 'hex');
      const expectedHashBuffer = Buffer.from(expectedHash, 'hex');

      return crypto.timingSafeEqual(hashBuffer, expectedHashBuffer);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Validate login credentials and generate token
   */
  public async validateLogin(request: WebUILoginRequest): Promise<WebUILoginResponse> {
    if (!this.isAuthenticationRequired()) {
      return {
        success: false,
        message: 'Authentication is currently disabled',
      };
    }

    const config = this.configManager.getConfig();
    const serverPassword = config.WebUIPassword;

    // Check if password matches
    // Ensure password is a string to prevent Buffer.from throwing on undefined/null
    const passwordInput = typeof request.password === 'string' ? request.password : '';

    if (!this.verifyPassword(passwordInput, serverPassword)) {
      return {
        success: false,
        message: 'Invalid password',
      };
    }

    // Opportunistic migration: if we just successfully logged in with a plaintext password, hash it now
    if (!serverPassword.startsWith('pbkdf2:')) {
      console.log('Migrating WebUI password to secure hash after successful login');
      const hashedPassword = this.hashPassword(passwordInput);
      this.configManager.set('WebUIPassword', hashedPassword);
    }

    // Generate session token
    const token = this.generateToken(request.rememberMe || false);

    return {
      success: true,
      token,
      message: 'Authentication successful',
    };
  }

  /**
   * Generate a secure session token
   */
  private generateToken(persistent: boolean): string {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const timeout = persistent ? this.sessionTimeout : this.tempSessionTimeout;
    const expiresAt = now + timeout;

    // Create token payload
    const payload: TokenPayload = {
      sessionId,
      createdAt: now,
      expiresAt,
      persistent,
    };

    // Encode payload as base64
    const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');

    // Create signature using config as secret
    const secret = this.getTokenSecret();
    const signature = crypto.createHmac('sha256', secret).update(tokenData).digest('hex');

    // Combine token data and signature
    const token = `${tokenData}.${signature}`;

    // Store session info
    const sessionInfo: SessionInfo = {
      token,
      createdAt: new Date(now),
      expiresAt: new Date(expiresAt),
      lastActivity: new Date(now),
      persistent,
    };

    this.sessions.set(sessionId, sessionInfo);

    return token;
  }

  /**
   * Validate token and return validation result
   */
  public validateToken(token: string): { isValid: boolean; sessionId?: string } {
    if (!this.isAuthenticationRequired()) {
      return { isValid: true };
    }

    try {
      // Validate token format
      const validatedToken = validateAuthToken(token);
      if (!validatedToken) {
        return { isValid: false };
      }

      // Split token and signature
      const parts = token.split('.');
      if (parts.length !== 2) {
        return { isValid: false };
      }

      const [tokenData, signature] = parts;

      // Verify signature
      const secret = this.getTokenSecret();
      const expectedSignature = crypto.createHmac('sha256', secret).update(tokenData).digest('hex');
      const signatureBuffer = Buffer.from(signature);
      const expectedSignatureBuffer = Buffer.from(expectedSignature);

      if (
        signatureBuffer.length !== expectedSignatureBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
      ) {
        return { isValid: false };
      }

      // Decode payload
      const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString()) as TokenPayload;

      // Check expiration
      if (payload.expiresAt < Date.now()) {
        this.sessions.delete(payload.sessionId);
        return { isValid: false };
      }

      // Check if session exists
      const session = this.sessions.get(payload.sessionId);
      if (!session) {
        return { isValid: false };
      }

      // Update last activity
      session.lastActivity = new Date();

      return { isValid: true, sessionId: payload.sessionId };
    } catch {
      console.error('Token validation error');
      return { isValid: false };
    }
  }

  /**
   * Verify and decode a token
   */
  public verifyToken(token: string): boolean {
    if (!this.isAuthenticationRequired()) {
      return true;
    }

    try {
      // Validate token format
      const validatedToken = validateAuthToken(token);
      if (!validatedToken) {
        return false;
      }

      // Split token and signature
      const parts = token.split('.');
      if (parts.length !== 2) {
        return false;
      }

      const [tokenData, signature] = parts;

      // Verify signature
      const secret = this.getTokenSecret();
      const expectedSignature = crypto.createHmac('sha256', secret).update(tokenData).digest('hex');
      const signatureBuffer = Buffer.from(signature);
      const expectedSignatureBuffer = Buffer.from(expectedSignature);

      if (
        signatureBuffer.length !== expectedSignatureBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
      ) {
        return false;
      }

      // Decode payload
      const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString()) as TokenPayload;

      // Check expiration
      if (payload.expiresAt < Date.now()) {
        this.sessions.delete(payload.sessionId);
        return false;
      }

      // Check if session exists
      const session = this.sessions.get(payload.sessionId);
      if (!session) {
        return false;
      }

      // Update last activity
      session.lastActivity = new Date();

      return true;
    } catch {
      console.error('Token verification error');
      return false;
    }
  }

  /**
   * Extract token from Authorization header
   */
  public extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
  }

  /**
   * Get authentication status
   */
  public getAuthStatus(): WebUIAuthStatus {
    const config = this.configManager.getConfig();

    return {
      hasPassword: config.WebUIPasswordRequired && !!config.WebUIPassword,
      defaultPassword: this.verifyPassword('changeme', config.WebUIPassword),
      authRequired: config.WebUIPasswordRequired,
    };
  }

  /**
   * Revoke a token
   */
  public revokeToken(token: string): void {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return;

      const payload = JSON.parse(Buffer.from(parts[0], 'base64').toString()) as TokenPayload;

      this.sessions.delete(payload.sessionId);
    } catch {
      // Ignore errors during revocation
    }
  }

  /**
   * Get active session count
   */
  public getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clear all sessions
   */
  public clearAllSessions(): void {
    this.sessions.clear();
  }

  /**
   * Get token secret based on configuration
   */
  private getTokenSecret(): string {
    const config = this.configManager.getConfig();
    let secret = config.WebUISecret;

    // Generate and save new secret if missing
    if (!secret) {
      secret = crypto.randomBytes(32).toString('hex');
      this.configManager.set('WebUISecret', secret);
    }

    // Use a combination of password and the unique secret
    return crypto.createHash('sha256').update(config.WebUIPassword).update(secret).digest('hex');
  }

  /**
   * Check if authentication is required based on configuration
   */
  public isAuthenticationRequired(): boolean {
    const config = this.configManager.getConfig();
    return config.WebUIPasswordRequired;
  }

  /**
   * Start periodic cleanup of expired sessions
   */
  private startSessionCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        const now = Date.now();

        for (const [sessionId, session] of this.sessions.entries()) {
          if (session.expiresAt.getTime() < now) {
            this.sessions.delete(sessionId);
          }
        }
      },
      5 * 60 * 1000
    );
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
  }
}

// Export singleton instance
let authManager: AuthManager | null = null;

export function getAuthManager(): AuthManager {
  if (!authManager) {
    authManager = new AuthManager();
  }
  return authManager;
}
