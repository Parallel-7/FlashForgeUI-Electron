// src/web/core/WebServerCore.js
const http = require('http');
const express = require('express');
const os = require('os');

/**
 * WebServerCore - Handles HTTP server setup and orchestration
 * Coordinates all server components and manages server lifecycle
 */
class WebServerCore {
  constructor(configManager) {
    this.configManager = configManager;
    this.config = null;
    this.httpServer = null;
    this.expressApp = null;
    
    // Server state
    this.isRunning = false;
    this.serverIP = 'localhost';
    this.port = 3000;
    
    // Component references
    this.authService = null;
    this.apiRouteHandler = null;
    this.webSocketManager = null;
    
    // Callbacks
    this.startupCallback = null;
    this.shutdownCallback = null;
  }

  /**
   * Initialize server with dependencies
   */
  initialize(authService, apiRouteHandler, webSocketManager) {
    this.authService = authService;
    this.apiRouteHandler = apiRouteHandler;
    this.webSocketManager = webSocketManager;
    
    // Initialize configuration
    this.config = this.configManager.getConfig();
    this.port = this.config.WebUIPort || 3000;
    
    // Initialize services
    this.authService.initialize();
    this.apiRouteHandler.initialize();
    
    console.log('WebServerCore initialized');
  }

  /**
   * Start the HTTP server
   */
  async start() {
    try {
      // Check if WebUI is enabled
      const webUIEnabled = this.config.WebUIEnabled !== false;
      if (!webUIEnabled) {
        console.log('Web UI is disabled in settings');
        return false;
      }

      // Create Express application
      this.expressApp = express();

      // Setup API routes
      this.apiRouteHandler.setupRoutes(this.expressApp);

      // Create HTTP server
      this.httpServer = http.createServer(this.expressApp);

      // Initialize WebSocket server
      this.webSocketManager.initialize(this.httpServer, this.authService);

      // Determine server IP
      this.serverIP = this.determineServerIP();

      // Start listening
      const success = await this.startListening();
      
      if (success) {
        this.isRunning = true;
        
        // Trigger startup callback if provided
        if (this.startupCallback) {
          this.startupCallback();
        }
      }

      return success;
    } catch (error) {
      console.error('Failed to start WebServerCore:', error);
      return false;
    }
  }

  /**
   * Stop the HTTP server
   */
  async stop() {
    try {
      // Trigger shutdown callback if provided
      if (this.shutdownCallback) {
        this.shutdownCallback();
      }

      // Shutdown WebSocket manager
      if (this.webSocketManager) {
        this.webSocketManager.shutdown();
      }

      // Close HTTP server
      if (this.httpServer) {
        await new Promise((resolve) => {
          this.httpServer.close(() => {
            console.log('HTTP server closed');
            resolve();
          });
        });
        this.httpServer = null;
      }

      this.isRunning = false;
      this.expressApp = null;
      
      console.log('WebServerCore stopped');
      return true;
    } catch (error) {
      console.error('Error stopping WebServerCore:', error);
      return false;
    }
  }

  /**
   * Start listening on configured port
   */
  startListening() {
    return new Promise((resolve) => {
      const onError = (err) => {
        console.error(`Server error: ${err.code} - ${err.message}`);
        
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          const fallbackPort = 8000;
          console.log(`Port ${this.port} in use or access denied. Trying fallback port ${fallbackPort}...`);
          
          // Try fallback port
          this.httpServer.removeListener('error', onError);
          this.httpServer.listen(fallbackPort, '0.0.0.0', () => {
            this.port = fallbackPort;
            console.log(`WebUI server running on fallback http://${this.serverIP}:${fallbackPort}`);
            resolve(true);
          });
        } else {
          resolve(false);
        }
      };

      this.httpServer.on('error', onError);

      this.httpServer.listen(this.port, '0.0.0.0', () => {
        console.log(`WebUI server running on http://${this.serverIP}:${this.port}`);
        resolve(true);
      });
    });
  }

  /**
   * Determine the best IP address for the server
   */
  determineServerIP() {
    try {
      const networkInterfaces = os.networkInterfaces();
      let serverIP = 'localhost';

      // Look for the best IP address (prefer 192.168.x.x for home networks)
      for (const key in networkInterfaces) {
        const interfaces = networkInterfaces[key];
        for (const iface of interfaces) {
          if (!iface.internal && iface.family === 'IPv4') {
            if (iface.address.startsWith('192.168.')) {
              serverIP = iface.address;
              break;
            } else if (serverIP === 'localhost') {
              serverIP = iface.address;
            }
          }
        }
        if (serverIP.startsWith('192.168.')) break;
      }

      return serverIP;
    } catch (error) {
      console.error('Error determining server IP:', error);
      return 'localhost';
    }
  }

  /**
   * Get server status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      serverIP: this.serverIP,
      port: this.port,
      url: `http://${this.serverIP}:${this.port}`,
      webUIEnabled: this.config ? this.config.WebUIEnabled !== false : true,
      clientCount: this.webSocketManager ? this.webSocketManager.getClientCount() : 0
    };
  }

  /**
   * Register startup callback
   */
  onStartup(callback) {
    this.startupCallback = callback;
  }

  /**
   * Register shutdown callback
   */
  onShutdown(callback) {
    this.shutdownCallback = callback;
  }

  /**
   * Update configuration and restart if needed
   */
  async updateConfig() {
    const oldConfig = this.config;
    this.config = this.configManager.getConfig();
    
    // Update dependent services
    this.authService.updateConfig();
    this.apiRouteHandler.updateConfig();
    
    // Check if server needs restart
    const needsRestart = this.needsRestart(oldConfig, this.config);
    
    if (needsRestart && this.isRunning) {
      console.log('Configuration changed - restarting server...');
      await this.stop();
      await this.start();
    }
  }

  /**
   * Check if server needs restart due to config changes
   */
  needsRestart(oldConfig, newConfig) {
    if (!oldConfig) return false;
    
    // Check for changes that require restart
    const restartTriggers = [
      'WebUIPort',
      'WebUIEnabled',
      'UseSSL'
    ];
    
    for (const key of restartTriggers) {
      if (oldConfig[key] !== newConfig[key]) {
        return true;
      }
    }
    
    return false;
  }

}

module.exports = WebServerCore;
