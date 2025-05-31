// src/web/core/AuthenticationService.js
const { generateToken, verifyToken } = require('../auth');
const sessionTokenManager = require('../../managers/SessionTokenManager');

/**
 * AuthenticationService - Handles all authentication and authorization logic
 * Centralizes token management and password validation
 */
class AuthenticationService {
  constructor(configManager) {
    this.configManager = configManager;
    this.config = null;
  }

  /**
   * Initialize service with current configuration
   */
  initialize() {
    this.config = this.configManager.getConfig();
  }

  /**
   * Validate login credentials and generate token
   */
  validateLogin(password, rememberMe = false) {
    const serverPassword = this.config.WebUIPassword || 'changeme';

    if (password === serverPassword) {
      // Generate token with persistence based on rememberMe flag
      const token = generateToken(rememberMe === true);
      return {
        success: true,
        token,
        message: 'Authentication successful'
      };
    } else {
      return {
        success: false,
        token: null,
        message: 'Invalid password'
      };
    }
  }

  /**
   * Verify authentication token
   */
  verifyToken(token) {
    if (!token) {
      return false;
    }

    // Handle special tokens
    if (this.isSpecialToken(token)) {
      return this.validateSpecialToken(token);
    }

    // Verify standard tokens
    return verifyToken(token);
  }

  /**
   * Check if token is a special system token
   */
  isSpecialToken(token) {
    if (!sessionTokenManager.isInitialized()) {
      console.warn('SessionTokenManager not initialized - rejecting token validation');
      return false;
    }
    return sessionTokenManager.isValidSessionToken(token);
  }

  /**
   * Validate special system tokens
   */
  validateSpecialToken(token) {
    if (!sessionTokenManager.isInitialized()) {
      console.warn('SessionTokenManager not initialized - rejecting token validation');
      return false;
    }

    const tokenType = sessionTokenManager.getTokenType(token);
    switch (tokenType) {
      case 'electron-app':
        // Main Electron app token - always valid for this session
        return true;
      case 'camera-proxy':
        // Camera proxy token - handled separately in camera endpoints
        return true;
      default:
        return false;
    }
  }

  /**
   * Extract token from request
   */
  extractToken(req) {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split('Bearer ')[1];
    }

    // Check query parameters (for special cases like camera proxy)
    if (req.query.token) {
      return req.query.token;
    }

    return null;
  }

  /**
   * Validate camera access token with special handling
   */
  validateCameraAccess(token) {
    // Check if it's the session Electron app token
    if (sessionTokenManager.isInitialized() && 
        token === sessionTokenManager.getElectronAppToken()) {
      // Main Electron app access - always allowed
      console.log('Session Electron app access to camera proxy - allowing without standard auth');
      return {
        valid: true,
        source: 'electron-app'
      };
    }

    if (this.verifyToken(token)) {
      return {
        valid: true,
        source: 'web-client'
      };
    }

    return {
      valid: false,
      source: 'unknown'
    };
  }

  /**
   * Get authentication status info
   */
  getAuthStatus() {
    return {
      hasPassword: !!this.config.WebUIPassword,
      defaultPassword: this.config.WebUIPassword === 'changeme',
      authRequired: true
    };
  }

  /**
   * Update configuration (call when config changes)
   */
  updateConfig() {
    this.config = this.configManager.getConfig();
  }

}

module.exports = AuthenticationService;
