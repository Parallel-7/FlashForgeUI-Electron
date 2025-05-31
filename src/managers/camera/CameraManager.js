// src/utils/CameraManager.js

const http = require('http');

const EventEmitter = require('events');

/**
 * Camera Manager Service
 * Handles connecting to the printer's camera stream and proxying it to clients
 */
class CameraManager extends EventEmitter {
  constructor() {
    super();
    this.printerStreamUrl = null;
    this.isStreaming = false;
    this.activeClients = new Set();
    this.streamBuffer = [];
    this.boundaryString = '';
    this.requestInProgress = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 2000;
    this.connectionReady = false;
  }

  /**
   * Set the printer's camera stream URL
   * @param {string} url - Camera stream URL from printer
   */
  setStreamUrl(url) {
    if (url === this.printerStreamUrl) return;
    
    console.log(`Setting camera stream URL: ${url}`);
    this.printerStreamUrl = url;
    
    // Reset streaming state when URL changes
    if (this.isStreaming) {
      this.stopStreaming();
      // If we have clients, restart streaming with the new URL
      if (this.activeClients.size > 0) {
        this.startStreaming();
      }
    }
  }

  /**
   * Start streaming from the printer's camera
   * @returns {boolean} Success state
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
    this.connectionReady = false;
    this.retryCount = 0;
    this.connectToStream();
    return true;
  }

  /**
   * Connect to the printer's camera stream
   * @private
   */
  connectToStream() {
    if (this.requestInProgress) return;
    this.requestInProgress = true;

    try {
      // Parse the URL
      const streamUrl = new URL(this.printerStreamUrl);
      
      const options = {
        hostname: streamUrl.hostname,
        port: streamUrl.port || 80,
        path: streamUrl.pathname + streamUrl.search,
        method: 'GET',
        headers: {
          'Connection': 'keep-alive',
          'Accept': 'multipart/x-mixed-replace;boundary=*'
        }
      };

      // Make the request to the printer's camera stream
      const req = http.request(options, (res) => {
        console.log(`Camera stream connected with status: ${res.statusCode}`);
        
        if (res.statusCode !== 200) {
          this.handleStreamError(new Error(`Invalid status code: ${res.statusCode}`));
          return;
        }

        // Extract the boundary string from the content-type header
        const contentType = res.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=([^;]*)/i);
        
        if (boundaryMatch && boundaryMatch[1]) {
          this.boundaryString = boundaryMatch[1];
          console.log(`Using boundary: ${this.boundaryString}`);
        } else {
          console.log('No boundary found in content-type, using default: "--jpgboundary"');
          this.boundaryString = '--jpgboundary';
        }

        // Reset the stream buffer
        this.streamBuffer = [];
        let inHeader = false;
        let frameBuffer = [];
        let headerData = [];

        // Handle the incoming data
        res.on('data', (chunk) => {
          // Check if we're properly connected now
          if (!this.connectionReady) {
            this.connectionReady = true;
            this.retryCount = 0;
            this.emit('stream-connected');
          }

          // Process the chunk
          this.processStreamChunk(chunk, frameBuffer, headerData, inHeader);
        });

        res.on('end', () => {
          console.log('Camera stream ended');
          this.requestInProgress = false;
          this.connectionReady = false;
          if (this.isStreaming) {
            this.retryConnection();
          }
        });
      });

      req.on('error', (error) => {
        this.handleStreamError(error);
      });

      req.end();

    } catch (error) {
      this.handleStreamError(error);
    }
  }

  /**
   * Process a chunk from the MJPEG stream
   * @private
   */
  processStreamChunk(chunk, frameBuffer, headerData, inHeader) {
    // Convert buffer to string for processing
    const data = chunk.toString('binary');
    
    // Check for the boundary marker
    const boundaryIdx = data.indexOf(this.boundaryString);
    
    if (boundaryIdx !== -1) {
      // We found a boundary, process what we have
      if (frameBuffer.length > 0) {
        // We have a complete frame, distribute it to clients
        const frameData = Buffer.concat(frameBuffer);
        this.distributeFrame(headerData.join(''), frameData);
        
        // Reset for next frame
      }
    } else if (data.indexOf('Content-Type:') !== -1) {
      // We're in the header section
      headerData.push(data);
    } else {
      // Must be frame data
      if (inHeader) {
        headerData.push(data);
        if (data.indexOf('\r\n\r\n') !== -1) {
        }
      } else {
        frameBuffer.push(chunk);
      }
    }
  }

  /**
   * Handle stream connection errors
   * @private
   */
  handleStreamError(error) {
    console.error('Camera stream error:', error.message);
    this.requestInProgress = false;
    this.connectionReady = false;
    this.emit('stream-error', error);
    
    if (this.isStreaming) {
      this.retryConnection();
    }
  }

  /**
   * Retry connection with exponential backoff
   * @private
   */
  retryConnection() {
    if (this.retryCount >= this.maxRetries) {
      console.log(`Max retries (${this.maxRetries}) reached, stopping camera stream`);
      this.stopStreaming();
      return;
    }

    const delay = this.retryDelay * Math.pow(2, this.retryCount);
    console.log(`Retrying camera connection in ${delay}ms (attempt ${this.retryCount + 1}/${this.maxRetries})`);
    
    setTimeout(() => {
      if (this.isStreaming) {
        this.retryCount++;
        this.connectToStream();
      }
    }, delay);
  }

  /**
   * Stop streaming from the printer's camera
   */
  stopStreaming() {
    if (!this.isStreaming) return;
    
    console.log('Stopping camera stream');
    this.isStreaming = false;
    this.requestInProgress = false;
    this.connectionReady = false;
    this.streamBuffer = [];
    this.emit('stream-stopped');
  }

  /**
   * Distribute a frame to all connected clients
   * @private
   */
  distributeFrame(header, frameData) {
    if (this.activeClients.size === 0) return;
    
    // Create the complete frame with headers and data
    const frameBuffer = Buffer.from(
      `${this.boundaryString}\r\n${header}\r\n`,
      'binary'
    );
    
    const fullFrame = Buffer.concat([frameBuffer, frameData, Buffer.from('\r\n', 'binary')]);
    
    // Send to all active clients
    for (const client of this.activeClients) {
      if (!client.destroyed) {
        client.write(fullFrame);
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
    this.activeClients.add(response);
    
    // Set appropriate headers for MJPEG stream
    response.writeHead(200, {
      'Content-Type': `multipart/x-mixed-replace;boundary=${this.boundaryString}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'close'
    });

    // Start streaming if not already active
    if (!this.isStreaming) {
      this.startStreaming();
    }

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
  }

  /**
   * Get the current streaming status
   * @returns {Object} Status object with stream information
   */
  getStatus() {
    return {
      url: this.printerStreamUrl,
      isStreaming: this.isStreaming,
      activeClients: this.activeClients.size,
      connectionReady: this.connectionReady
    };
  }
}

module.exports = CameraManager;
