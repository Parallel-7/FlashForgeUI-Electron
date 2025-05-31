const http = require('http');
const { EventEmitter } = require('events');

/**
 * Simple Camera Proxy that directly pipes the camera stream to clients
 * without attempting to parse or modify the MJPEG stream
 */
class SimpleCameraProxy extends EventEmitter {
  constructor() {
    super();
    this.printerStreamUrl = null;
    this.isStreaming = false;
    this.activeClients = new Set();
    this.currentRequest = null;
    this.currentResponse = null;
  }

  /**
   * Set the printer's camera stream URL
   * @param {string} url - Camera stream URL from printer
   */
  setStreamUrl(url) {
    if (url === this.printerStreamUrl) return;
    
    console.log(`Setting camera stream URL: ${url}`);
    this.printerStreamUrl = url;
    
    // If we're already streaming, restart with the new URL
    if (this.isStreaming) {
      this.stopStreaming();
      if (this.activeClients.size > 0) {
        this.startStreaming();
      }
    }
  }

  /**
   * Add a client to receive the stream
   * @param {http.ServerResponse} response - HTTP Response object
   */
  addClient(response) {
    if (!this.printerStreamUrl) {
      response.writeHead(503, { 'Content-Type': 'text/plain' });
      response.end('Camera stream not available');
      return;
    }

    console.log('Adding new client to camera stream');
    
    // Add client to active set
    this.activeClients.add(response);
    
    // Handle client disconnect
    response.on('close', () => {
      console.log('Client disconnected from camera stream');
      this.activeClients.delete(response);
      
      // Stop streaming if no more clients
      if (this.activeClients.size === 0) {
        console.log('No more clients, stopping camera stream');
        this.stopStreaming();
      }
    });
    
    // Handle errors
    response.on('error', (err) => {
      console.error('Client error:', err.message);
      this.activeClients.delete(response);
    });
    
    // Start streaming if not already active
    if (!this.isStreaming) {
      this.startStreaming();
    } else if (this.currentResponse) {
      // If already streaming, copy the headers from the printer stream
      const headers = this.currentResponse.headers;
      for (const key in headers) {
        // Skip connection header
        if (key.toLowerCase() !== 'connection') {
          response.setHeader(key, headers[key]);
        }
      }
      response.setHeader('Connection', 'close');
      response.writeHead(200);
    }
  }

  /**
   * Restore camera stream by mimicking Orca-FlashForge's restoration request
   * This sends the same type of request that Orca-FlashForge uses to "kick" stuck streams
   * This is not (yet) working , and may be removed. The printer webcam can also de-sync to a point where even
   * Orca-FlashForge cannot restore it.
   */
  async restoreStream() {
    if (!this.printerStreamUrl) {
      console.log('Cannot restore camera stream: No URL provided');
      return false;
    }

    try {
      const url = new URL(this.printerStreamUrl);
      
      console.log(`Attempting to restore camera stream for ${url.hostname}:${url.port}`);
      
      // Create restoration request that mimics Orca-FlashForge
      const options = {
        method: 'GET',
        hostname: url.hostname,
        port: url.port || 8080,
        path: '/?action=stream', // Key path from Wireshark capture
        headers: {
          'Host': `${url.hostname}:${url.port || 8080}`,
          'Connection': 'keep-alive',
          'User-Agent': 'BBL-Slicer/v01.09.05.51 (dark) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.52',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 5000 // 5 second timeout
      };
      
      return new Promise((resolve) => {
        const restoreRequest = http.request(options, (response) => {
          console.log(`Camera restoration response: ${response.statusCode}`);
          
          // Consume the response to complete the request
          response.on('data', () => {}); // Ignore data
          response.on('end', () => {
            console.log('Camera stream restoration completed');
            this.emit('stream-restored');
            resolve(true);
          });
        });
        
        restoreRequest.on('error', (err) => {
          console.log(`Camera restoration attempt failed: ${err.message}`);
          resolve(false);
        });
        
        restoreRequest.on('timeout', () => {
          console.log('Camera restoration timeout');
          restoreRequest.destroy();
          resolve(false);
        });
        
        restoreRequest.end();
      });
      
    } catch (err) {
      console.error('Error in camera restoration:', err);
      return false;
    }
  }

  /**
   * Start streaming directly from printer to clients
   * using a direct pipe approach
   */
  startStreaming() {
    if (!this.printerStreamUrl) {
      console.log('Cannot start camera stream: No URL provided');
      return false;
    }

    if (this.isStreaming) {
      console.log('Camera stream already running');
      return true;
    }

    console.log(`Starting camera stream from ${this.printerStreamUrl}`);
    this.isStreaming = true;
    
    try {
      // Parse URL
      const url = new URL(this.printerStreamUrl);
      
      // Setup options for the proxy request
      const options = {
        method: 'GET',
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        headers: {
          'Accept': '*/*',
          'Connection': 'keep-alive',
          'User-Agent': 'FlashForge-UI-Proxy'
        }
      };
      
      // Create request to camera
      this.currentRequest = http.get(options, (response) => {
        this.currentResponse = response;
        
        if (response.statusCode !== 200) {
          console.error(`Camera returned status code: ${response.statusCode}`);
          this.emit('stream-error', new Error(`Invalid status code: ${response.statusCode}`));
          this.stopStreaming();
          setTimeout(() => this.reconnect(), 2000);
          return;
        }
        
        console.log('Connected to camera stream');
        this.emit('stream-connected');
        
        // Set headers and status code for all clients
        this.activeClients.forEach(client => {
          if (!client.headersSent) {
            // Copy all headers from the original response
            const headers = response.headers;
            for (const key in headers) {
              // Skip connection header
              if (key.toLowerCase() !== 'connection') {
                client.setHeader(key, headers[key]);
              }
            }
            client.setHeader('Connection', 'close');
            client.writeHead(200);
          }
        });
        
        // Pipe the data directly to all clients
        response.on('data', (chunk) => {
          this.activeClients.forEach(client => {
            try {
              if (!client.destroyed) {
                client.write(chunk);
              }
            } catch (err) {
              console.error('Error sending data to client:', err.message);
              // Remove problematic client
              this.activeClients.delete(client);
            }
          });
        });
        
        // Handle end of stream
        response.on('end', () => {
          console.log('Camera stream ended');
          this.stopStreaming();
          setTimeout(() => this.reconnect(), 2000);
        });
        
        // Handle errors
        response.on('error', (err) => {
          console.error('Error receiving camera stream:', err);
          this.emit('stream-error', err);
          this.stopStreaming();
          setTimeout(() => this.reconnect(), 2000);
        });
      });
      
      // Handle request errors
      this.currentRequest.on('error', (err) => {
        console.error('Error connecting to camera stream:', err);
        this.emit('stream-error', err);
        this.stopStreaming();
        
        // Check if this is a "socket hang up" error that might need restoration
        if (err.code === 'ECONNRESET' || err.message.includes('socket hang up')) {
          console.log('Detected socket hang up - attempting stream restoration...');
          this.attemptStreamRestoration();
        } else {
          setTimeout(() => this.reconnect(), 2000);
        }
      });
      
      return true;
    } catch (err) {
      console.error('Error starting camera stream:', err);
      this.emit('stream-error', err);
      this.isStreaming = false;
      setTimeout(() => this.reconnect(), 2000);
      return false;
    }
  }

  /**
   * Attempt stream restoration when socket hang up is detected
   * @private
   */
  async attemptStreamRestoration() {
    console.log('Attempting automatic stream restoration...');
    
    const restored = await this.restoreStream();
    
    if (restored) {
      console.log('Stream restoration successful, reconnecting in 1 second...');
      setTimeout(() => this.reconnect(), 1000);
    } else {
      console.log('Stream restoration failed, trying normal reconnect in 3 seconds...');
      setTimeout(() => this.reconnect(), 3000);
    }
  }

  /**
   * Reconnect to the camera stream
   * @private
   */
  reconnect() {
    if (this.activeClients.size > 0 && !this.isStreaming) {
      console.log('Reconnecting to camera stream');
      this.startStreaming();
    }
  }

  /**
   * Stop streaming from the printer's camera
   */
  stopStreaming() {
    if (!this.isStreaming) return;
    
    console.log('Stopping camera stream');
    this.isStreaming = false;
    
    // Clean up request
    if (this.currentRequest) {
      this.currentRequest.destroy();
      this.currentRequest = null;
    }
    
    this.currentResponse = null;
    
    this.emit('stream-stopped');
  }

  /**
   * Get the current streaming status
   * @returns {Object} Status object with stream information
   */
  getStatus() {
    return {
      url: this.printerStreamUrl,
      isStreaming: this.isStreaming,
      activeClients: this.activeClients.size
    };
  }

  /**
   * Destroy all client connections
   */
  destroyAllClients() {
    console.log(`Destroying ${this.activeClients.size} client connections`);
    for (const client of this.activeClients) {
      try {
        if (!client.destroyed) {
          client.end();
        }
      } catch (err) {
        console.error('Error ending client connection:', err);
      }
    }
    this.activeClients.clear();
  }
}

module.exports = SimpleCameraProxy;
