// src/web/auth.js
const { app } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Store tokens in memory (invalidated on server restart)
const activeTokens = new Set();

// Store persistent tokens (loaded/saved from disk)
const persistentTokens = new Set();

// File path for persistent tokens (in user data directory)
const tokensFilePath = path.join(app.getPath('userData'), 'tokens.json');

/**
 * Load persistent tokens from file
 */
function loadPersistentTokens() {
  try {
    if (fs.existsSync(tokensFilePath)) {
      const data = fs.readFileSync(tokensFilePath, 'utf8');
      const { tokens, expiry } = JSON.parse(data);
      
      // Filter out expired tokens
      const now = Date.now();
      const validTokens = tokens.filter(token => {
        return !token.expiry || token.expiry > now;
      });
      
      // Add valid tokens to the persistent set
      validTokens.forEach(token => {
        persistentTokens.add(token.value);
      });
      
      console.log(`Loaded ${validTokens.length} persistent tokens`);
      
      // If we filtered out expired tokens, save the updated list
      if (validTokens.length !== tokens.length) {
        savePersistentTokens();
      }
    }
  } catch (error) {
    console.error('Error loading persistent tokens:', error);
  }
}

/**
 * Save persistent tokens to file
 */
function savePersistentTokens() {
  try {
    // Convert Set to array with expiry dates
    const tokensArray = Array.from(persistentTokens).map(token => {
      return {
        value: token,
        // 30-day expiration for persistent tokens
        expiry: Date.now() + (30 * 24 * 60 * 60 * 1000)
      };
    });
    
    const data = JSON.stringify({ 
      tokens: tokensArray,
      updated: new Date().toISOString()
    }, null, 2);
    
    fs.writeFileSync(tokensFilePath, data, 'utf8');
    console.log(`Saved ${tokensArray.length} persistent tokens`);
  } catch (error) {
    console.error('Error saving persistent tokens:', error);
  }
}

// Load persistent tokens on module initialization
loadPersistentTokens();

/**
 * Generate a new authentication token
 * @param {boolean} persistent Whether this token should persist between server restarts
 * @returns {string} The generated token
 */
function generateToken(persistent = false) {
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Store token
  activeTokens.add(token);
  
  if (persistent) {
    // Add to persistent tokens
    persistentTokens.add(token);
    savePersistentTokens();
  } else {
    // Auto-expire after 24 hours
    setTimeout(() => {
      activeTokens.delete(token);
    }, 24 * 60 * 60 * 1000);
  }
  
  return token;
}

/**
 * Verify an authentication token
 * @param {string} token Token to verify
 * @returns {boolean} True if token is valid
 */
function verifyToken(token) {
  return activeTokens.has(token) || persistentTokens.has(token);
}

/**
 * Invalidate a token
 * @param {string} token Token to invalidate
 */
function invalidateToken(token) {
  activeTokens.delete(token);
  
  if (persistentTokens.has(token)) {
    persistentTokens.delete(token);
    savePersistentTokens();
  }
}

/**
 * Invalidate all tokens
 */
function invalidateAllTokens() {
  activeTokens.clear();
  persistentTokens.clear();
  savePersistentTokens();
}

module.exports = {
  generateToken,
  verifyToken,
  invalidateToken,
  invalidateAllTokens,
  loadPersistentTokens
};
