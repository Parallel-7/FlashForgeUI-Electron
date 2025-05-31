const http = require('http');
const express = require('express');
const EventEmitter = require('events');
const SimpleCameraProxy = require('./SimpleCameraProxy');

/**
 * CameraService - A unified service for handling camera proxy operations
 * 
 * This service manages the connection to the printer's camera stream and 
 * proxies it to both the Electron UI and web clients.
 */
class CameraService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.port = config.CameraProxyPort || 8181;
    this.server = null;
    this.app = null;
    this.isInitialized = false;
    
    // Create our camera proxy
    this.cameraProxy = new SimpleCameraProxy();
    
    // Forward events from the camera proxy
    this.cameraProxy.on('stream-connected', () => this.emit('stream-connected'));
    this.cameraProxy.on('stream-error', (err) => this.emit('stream-error', err));
    this.cameraProxy.on('stream-stopped', () => this.emit('stream-stopped'));
    this.cameraProxy.on('stream-restored', () => this.emit('stream-restored'));
  }

  /**
   * Initialize the camera service
   * @param {Object} config - Configuration object
   * @returns {Promise<boolean>} Success state
   */
  async initialize(config = {}) {
    if (this.isInitialized) {
      console.log('Camera service already initialized');
      return true;
    }

    try {
      this.port = config.CameraProxyPort || this.port;
      
      // Create Express app and HTTP server
      this.app = express();
      
      // Set up the camera proxy endpoint
      this.app.get('/camera', (req, res) => {
        console.log('Client connecting to camera proxy');
        this.addClient(res);
      });
      
      // Create and start the server
      this.server = http.createServer(this.app);
      
      // Handle server errors
      this.server.on('error', (err) => {
        console.error(`Camera proxy server error: ${err.message}`);
        // Try fallback port if the specified port is in use
        if (err.code === 'EADDRINUSE') {
          const fallbackPort = this.port + 1;
          console.log(`Camera proxy port ${this.port} in use, trying fallback port ${fallbackPort}`);
          this.port = fallbackPort;
          this.server.listen(this.port, () => {
            console.log(`Camera proxy server running on http://localhost:${this.port}`);
          });
        }
      });
      
      // Start the server
      await new Promise((resolve, reject) => {
        this.server.listen(this.port, (err) => {
          if (err) {
            reject(err);
          } else {
            console.log(`Camera proxy server running on http://localhost:${this.port}`);
            resolve();
          }
        });
      });
      
      this.isInitialized = true;
      this.emit('initialized', { port: this.port });
      return true;
    } catch (error) {
      console.error('Error initializing camera service:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Set the printer's camera stream URL
   * @param {string} url - Camera stream URL from printer
   */
  setStreamUrl(url) {
    if (!this.cameraProxy) return;
    this.cameraProxy.setStreamUrl(url);
    this.emit('stream-url-changed', url);
  }

  /**
   * Add a client to receive the stream
   * @param {http.ServerResponse} response - HTTP Response object
   */
  addClient(response) {
    if (!this.cameraProxy) {
      response.writeHead(503, { 'Content-Type': 'text/plain' });
      response.end('Camera service not available');
      return;
    }
    
    this.cameraProxy.addClient(response);
  }

  /**
   * Stop streaming from the printer's camera
   */
  stopStreaming() {
    if (!this.cameraProxy) return;
    this.cameraProxy.stopStreaming();
  }

  /**
   * Manually restore camera stream (useful when stream gets stuck)
   * This mimics the restoration request that Orca-FlashForge uses
   * @returns {Promise<boolean>} Success status
   */
  async restoreStream() {
    if (!this.cameraProxy) {
      console.log('Cannot restore stream: Camera proxy not available');
      return false;
    }
    
    console.log('Manual camera stream restoration initiated');
    const result = await this.cameraProxy.restoreStream();
    
    if (result) {
      this.emit('stream-restored');
      console.log('Manual camera stream restoration successful');
    } else {
      console.log('Manual camera stream restoration failed');
    }
    
    return result;
  }

  /**
   * Get the current streaming status
   * @returns {Object} Status object with stream information
   */
  getStatus() {
    if (!this.cameraProxy) {
      return {
        url: null,
        isStreaming: false,
        activeClients: 0,
        port: this.port
      };
    }
    
    const proxyStatus = this.cameraProxy.getStatus();
    return {
      ...proxyStatus,
      port: this.port
    };
  }

  /**
   * Get stream URL
   * @returns {string|null} Current printer stream URL
   */
  get printerStreamUrl() {
    return this.cameraProxy ? this.cameraProxy.printerStreamUrl : null;
  }

  /**
   * Get streaming status
   * @returns {boolean} Whether currently streaming
   */
  get isStreaming() {
    return this.cameraProxy ? this.cameraProxy.isStreaming : false;
  }

  /**
   * Get active client count
   * @returns {number} Number of active clients
   */
  get activeClients() {
    return this.cameraProxy ? this.cameraProxy.activeClients.size : 0;
  }

  /**
   * Stop the camera service and release resources
   */
  shutdown() {
    // Stop streaming
    this.stopStreaming();
    
    // Destroy all client connections
    if (this.cameraProxy) {
      this.cameraProxy.destroyAllClients();
    }
    
    // Close HTTP server
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    
    this.app = null;
    this.isInitialized = false;
    
    this.emit('shutdown');
  }
}

// Create and export a singleton instance
const cameraService = new CameraService();

module.exports = cameraService;
