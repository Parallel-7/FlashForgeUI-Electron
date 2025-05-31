// src/managers/SessionTokenManager.js
const crypto = require('crypto');

/**
 * SessionTokenManager - Manages session-specific authentication tokens
 * 
 * Replaces hard-coded 'APP' and 'PROXY' tokens with dynamically generated
 * session tokens for improved security. Tokens are generated once per 
 * application run and remain valid for the duration of the session.
 */
class SessionTokenManager {
  constructor() {
    this.electronAppToken = null;
    this.cameraProxyToken = null;
    this.initialized = false;
  }

  /**
   * Initialize session tokens - call once at application startup
   */
  initialize() {
    if (this.initialized) {
      console.warn('SessionTokenManager already initialized');
      return;
    }

    // Generate secure random tokens
    this.electronAppToken = this.generateSecureToken();
    this.cameraProxyToken = this.generateSecureToken();
    this.initialized = true;

    console.log('SessionTokenManager initialized with new session tokens');
    console.log(`Electron App Token: ${this.electronAppToken.substring(0, 8)}...`);
    console.log(`Camera Proxy Token: ${this.cameraProxyToken.substring(0, 8)}...`);
  }

  /**
   * Generate a cryptographically secure token
   * @returns {string} Secure token string
   */
  generateSecureToken() {
    // Generate 32 random bytes and convert to hex string
    // This creates a 64-character hexadecimal token
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get the Electron app session token
   * @returns {string} Electron app token
   */
  getElectronAppToken() {
    if (!this.initialized) {
      throw new Error('SessionTokenManager not initialized. Call initialize() first.');
    }
    return this.electronAppToken;
  }

  /**
   * Get the camera proxy session token  
   * @returns {string} Camera proxy token
   */
  getCameraProxyToken() {
    if (!this.initialized) {
      throw new Error('SessionTokenManager not initialized. Call initialize() first.');
    }
    return this.cameraProxyToken;
  }

  /**
   * Check if a token is a valid session token
   * @param {string} token Token to validate
   * @returns {boolean} True if token is valid session token
   */
  isValidSessionToken(token) {
    if (!this.initialized || !token) {
      return false;
    }

    return token === this.electronAppToken || token === this.cameraProxyToken;
  }

  /**
   * Get token type for a given token
   * @param {string} token Token to identify
   * @returns {string|null} Token type ('electron-app', 'camera-proxy') or null if invalid
   */
  getTokenType(token) {
    if (!this.initialized || !token) {
      return null;
    }

    if (token === this.electronAppToken) {
      return 'electron-app';
    }

    if (token === this.cameraProxyToken) {
      return 'camera-proxy';
    }

    return null;
  }

  /**
   * Check if manager is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Cleanup tokens (called on application shutdown)
   */
  cleanup() {
    console.log('Cleaning up session tokens');
    this.electronAppToken = null;
    this.cameraProxyToken = null;
    this.initialized = false;
  }
}

// Create singleton instance
const sessionTokenManager = new SessionTokenManager();

module.exports = sessionTokenManager;
