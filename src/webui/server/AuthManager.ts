/**
 * AuthManager - Handles authentication for the web UI.
 * Manages password validation, token generation, and session management.
 * Integrates with ConfigManager for password storage and validation.
 */

import * as crypto from 'crypto';
import { getConfigManager } from '../../managers/ConfigManager';
import { 
  WebUILoginRequest, 
  WebUILoginResponse, 
  WebUIAuthStatus
} from '../types/web-api.types';
import { validateAuthToken } from '../schemas/web-api.schemas';

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
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Start periodic cleanup of expired sessions
    this.startSessionCleanup();
  }
  
  /**
   * Validate login credentials and generate token
   */
  public async validateLogin(request: WebUILoginRequest): Promise<WebUILoginResponse> {
    const config = this.configManager.getConfig();
    const serverPassword = config.WebUIPassword;
    
    // Check if password matches
    if (request.password !== serverPassword) {
      return {
        success: false,
        message: 'Invalid password'
      };
    }
    
    // Generate session token
    const token = this.generateToken(request.rememberMe || false);
    
    return {
      success: true,
      token,
      message: 'Authentication successful'
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
      persistent
    };
    
    // Encode payload as base64
    const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
    
    // Create signature using config as secret
    const secret = this.getTokenSecret();
    const signature = crypto
      .createHmac('sha256', secret)
      .update(tokenData)
      .digest('hex');
    
    // Combine token data and signature
    const token = `${tokenData}.${signature}`;
    
    // Store session info
    const sessionInfo: SessionInfo = {
      token,
      createdAt: new Date(now),
      expiresAt: new Date(expiresAt),
      lastActivity: new Date(now),
      persistent
    };
    
    this.sessions.set(sessionId, sessionInfo);
    
    return token;
  }
  
  /**
   * Validate token and return validation result
   */
  public validateToken(token: string): { isValid: boolean; sessionId?: string } {
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
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(tokenData)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return { isValid: false };
      }
      
      // Decode payload
      const payload = JSON.parse(
        Buffer.from(tokenData, 'base64').toString()
      ) as TokenPayload;
      
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
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(tokenData)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return false;
      }
      
      // Decode payload
      const payload = JSON.parse(
        Buffer.from(tokenData, 'base64').toString()
      ) as TokenPayload;
      
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
      hasPassword: !!config.WebUIPassword,
      defaultPassword: config.WebUIPassword === 'changeme',
      authRequired: true
    };
  }
  
  /**
   * Revoke a token
   */
  public revokeToken(token: string): void {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return;
      
      const payload = JSON.parse(
        Buffer.from(parts[0], 'base64').toString()
      ) as TokenPayload;
      
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
    // Use a combination of password and a fixed salt for the secret
    return crypto
      .createHash('sha256')
      .update(config.WebUIPassword)
      .update('ffui-webui-2025')
      .digest('hex');
  }
  
  /**
   * Start periodic cleanup of expired sessions
   */
  private startSessionCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.expiresAt.getTime() < now) {
          this.sessions.delete(sessionId);
        }
      }
    }, 5 * 60 * 1000);
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
