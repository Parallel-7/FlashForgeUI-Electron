/**
 * Camera Proxy Service
 * 
 * Manages HTTP proxy server for camera streaming using Express. Maintains a single 
 * connection to the camera source (printer or custom URL) and distributes the stream 
 * to multiple clients. Uses direct pipe approach for optimal performance.
 * 
 * Architecture:
 * - Express HTTP server on configurable port (default 8181)
 * - Single upstream connection to camera source
 * - Multiple downstream connections to clients
 * - Automatic reconnection with exponential backoff
 * - No MJPEG parsing for better performance
 */

import express from 'express';
import * as http from 'http';
import { EventEmitter } from 'events';
import { 
  CameraProxyConfig, 
  CameraProxyStatus, 
  CameraProxyClient,
  CameraProxyEventType,
  ICameraProxyService 
} from '../types/camera';

/**
 * Camera proxy service implementation
 */
export class CameraProxyService extends EventEmitter implements ICameraProxyService {
  private config: CameraProxyConfig;
  private currentPort: number; // Mutable port for fallback handling
  private app: express.Application | null = null;
  private server: http.Server | null = null;
  private streamUrl: string | null = null;
  private isStreaming = false;
  private readonly activeClients = new Map<string, { client: CameraProxyClient; response: express.Response }>();
  private currentRequest: http.ClientRequest | null = null;
  private currentResponse: http.IncomingMessage | null = null;
  private retryCount = 0;
  private retryTimer: NodeJS.Timeout | null = null;
  
  // Statistics
  private readonly stats = {
    bytesReceived: 0,
    bytesSent: 0,
    successfulConnections: 0,
    failedConnections: 0,
    currentRetryCount: 0
  };
  
  private lastError: string | null = null;
  
  constructor() {
    super();
    
    // Default configuration
    this.config = {
      port: 8181,
      fallbackPort: 8182,
      autoStart: true,
      reconnection: {
        enabled: true,
        maxRetries: 5,
        retryDelay: 2000,
        exponentialBackoff: true
      }
    };
    this.currentPort = this.config.port;
  }
  
  /**
   * Initialize the camera proxy service
   */
  public async initialize(config: CameraProxyConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    this.currentPort = this.config.port;
    
    if (this.config.autoStart) {
      await this.start();
    }
  }
  
  /**
   * Start the proxy server
   */
  public async start(): Promise<void> {
    if (this.server) {
      console.log('Camera proxy server already running');
      return;
    }
    
    // Create Express app
    this.app = express();
    
    // Set up camera endpoint
    this.app.get('/camera', (req, res) => {
      this.handleCameraRequest(req, res);
    });
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json(this.getStatus());
    });
    
    // Create HTTP server
    this.server = http.createServer(this.app);
    
    return new Promise((resolve, reject) => {
      this.server!.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${this.currentPort} in use, trying fallback port ${this.config.fallbackPort}`);
          const oldPort = this.currentPort;
          this.currentPort = this.config.fallbackPort;
          
          // Retry with fallback port
          this.server!.listen(this.currentPort, () => {
            console.log(`Camera proxy server running on http://localhost:${this.currentPort}`);
            this.emitEvent('proxy-started', { port: this.currentPort });
            this.emitEvent('port-changed', { oldPort, newPort: this.currentPort });
            resolve();
          });
        } else {
          console.error('Camera proxy server error:', err);
          this.lastError = err.message;
          reject(err);
        }
      });
      
      this.server!.listen(this.currentPort, () => {
        console.log(`Camera proxy server running on http://localhost:${this.currentPort}`);
        this.emitEvent('proxy-started', { port: this.currentPort });
        resolve();
      });
    });
  }
  
  /**
   * Stop the proxy server
   */
  public async stop(): Promise<void> {
    // Stop streaming
    this.stopStreaming();
    
    // Close all client connections
    this.activeClients.forEach(({ response }) => {
      try {
        response.end();
      } catch {
        // Ignore errors during cleanup
      }
    });
    this.activeClients.clear();
    
    // Close server
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = null;
          this.app = null;
          console.log('Camera proxy server stopped');
          this.emitEvent('proxy-stopped');
          resolve();
        });
      });
    }
  }
  
  /**
   * Set the camera stream URL
   */
  public setStreamUrl(url: string | null): void {
    if (url === this.streamUrl) return;
    
    console.log(`Setting camera stream URL: ${url || 'null'}`);
    this.streamUrl = url;
    
    // If streaming, restart with new URL
    if (this.isStreaming) {
      this.stopStreaming();
      if (this.activeClients.size > 0 && url) {
        this.startStreaming();
      }
    }
  }
  
  /**
   * Handle incoming camera request
   */
  private handleCameraRequest(req: express.Request, res: express.Response): void {
    if (!this.streamUrl) {
      res.status(503).send('Camera stream not available');
      return;
    }
    
    const clientId = this.generateClientId();
    const client: CameraProxyClient = {
      id: clientId,
      connectedAt: new Date(),
      remoteAddress: req.socket.remoteAddress || 'unknown',
      isConnected: true
    };
    
    console.log(`New camera client connected: ${client.remoteAddress}`);
    this.activeClients.set(clientId, { client, response: res });
    
    // Handle client disconnect
    res.on('close', () => {
      console.log(`Camera client disconnected: ${client.remoteAddress}`);
      this.activeClients.delete(clientId);
      this.emitEvent('client-disconnected', { clientId });
      
      // Stop streaming if no more clients
      if (this.activeClients.size === 0) {
        console.log('No more clients, stopping camera stream');
        this.stopStreaming();
      }
    });
    
    // Handle errors
    res.on('error', (err) => {
      console.error('Client error:', err.message);
      this.activeClients.delete(clientId);
    });
    
    this.emitEvent('client-connected', { clientId, remoteAddress: client.remoteAddress });
    
    // Start streaming if not already active
    if (!this.isStreaming) {
      this.startStreaming();
    } else if (this.currentResponse) {
      // If already streaming, copy headers from upstream
      this.copyHeadersToClient(res);
    }
  }
  
  /**
   * Start streaming from camera source
   */
  private startStreaming(): void {
    if (!this.streamUrl) {
      console.log('Cannot start camera stream: No URL provided');
      return;
    }
    
    if (this.isStreaming) {
      console.log('Camera stream already running');
      return;
    }
    
    console.log(`Starting camera stream from ${this.streamUrl}`);
    this.isStreaming = true;
    this.retryCount = 0;
    this.connectToStream();
  }
  
  /**
   * Connect to camera stream
   */
  private connectToStream(): void {
    try {
      const url = new URL(this.streamUrl!);
      
      const options: http.RequestOptions = {
        method: 'GET',
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        headers: {
          'Accept': '*/*',
          'Connection': 'keep-alive',
          'User-Agent': 'FlashForge-Camera-Proxy'
        }
      };
      
      this.currentRequest = http.get(options, (response) => {
        this.currentResponse = response;
        
        if (response.statusCode !== 200) {
          const error = `Camera returned status code: ${response.statusCode}`;
          console.error(error);
          this.lastError = error;
          this.stats.failedConnections++;
          this.emitEvent('stream-error', null, error);
          this.handleStreamError();
          return;
        }
        
        console.log('Connected to camera stream');
        this.lastError = null;
        this.stats.successfulConnections++;
        this.stats.currentRetryCount = 0;
        this.emitEvent('stream-connected');
        
        // Copy headers to all connected clients
        this.activeClients.forEach(({ response }) => {
          if (!response.headersSent) {
            this.copyHeadersToClient(response);
          }
        });
        
        // Pipe data to all clients
        response.on('data', (chunk: Buffer) => {
          this.stats.bytesReceived += chunk.length;
          this.distributeToClients(chunk);
        });
        
        response.on('end', () => {
          console.log('Camera stream ended');
          this.emitEvent('stream-disconnected');
          this.handleStreamError();
        });
        
        response.on('error', (err) => {
          console.error('Error receiving camera stream:', err);
          this.lastError = err.message;
          this.emitEvent('stream-error', null, err.message);
          this.handleStreamError();
        });
      });
      
      this.currentRequest.on('error', (err) => {
        console.error('Error connecting to camera stream:', err);
        this.lastError = err.message;
        this.stats.failedConnections++;
        this.emitEvent('stream-error', null, err.message);
        this.handleStreamError();
      });
      
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error('Error starting camera stream:', error);
      this.lastError = error;
      this.stats.failedConnections++;
      this.emitEvent('stream-error', null, error);
      this.isStreaming = false;
      this.handleStreamError();
    }
  }
  
  /**
   * Copy headers from upstream to client
   */
  private copyHeadersToClient(res: express.Response): void {
    if (!this.currentResponse || res.headersSent) return;
    
    const headers = this.currentResponse.headers;
    Object.keys(headers).forEach(key => {
      if (key.toLowerCase() !== 'connection') {
        res.setHeader(key, headers[key]!);
      }
    });
    
    // Set connection close to prevent keep-alive issues
    res.setHeader('Connection', 'close');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Don't use res.status() as it will trigger Express to send headers
    // Just set the status code directly
    res.statusCode = 200;
  }
  
  /**
   * Distribute data chunk to all clients
   */
  private distributeToClients(chunk: Buffer): void {
    const failedClients: string[] = [];
    
    this.activeClients.forEach(({ response }, clientId) => {
      try {
        if (!response.destroyed && response.writable) {
          response.write(chunk);
          this.stats.bytesSent += chunk.length;
        } else {
          failedClients.push(clientId);
        }
      } catch (err) {
        console.error('Error sending data to client:', err);
        failedClients.push(clientId);
      }
    });
    
    // Clean up failed clients
    failedClients.forEach(clientId => {
      this.activeClients.delete(clientId);
    });
  }
  
  /**
   * Handle stream errors and reconnection
   */
  private handleStreamError(): void {
    this.stopStreaming();
    
    if (this.config.reconnection.enabled && 
        this.activeClients.size > 0 && 
        this.retryCount < this.config.reconnection.maxRetries) {
      
      const delay = this.config.reconnection.exponentialBackoff
        ? this.config.reconnection.retryDelay * Math.pow(2, this.retryCount)
        : this.config.reconnection.retryDelay;
      
      this.retryCount++;
      this.stats.currentRetryCount = this.retryCount;
      
      console.log(`Retrying camera connection in ${delay}ms (attempt ${this.retryCount}/${this.config.reconnection.maxRetries})`);
      this.emitEvent('retry-attempt', { attempt: this.retryCount, maxRetries: this.config.reconnection.maxRetries });
      
      this.retryTimer = setTimeout(() => {
        if (this.activeClients.size > 0) {
          this.isStreaming = true;
          this.connectToStream();
        }
      }, delay);
    }
  }
  
  /**
   * Stop streaming from camera
   */
  private stopStreaming(): void {
    if (!this.isStreaming) return;
    
    console.log('Stopping camera stream');
    this.isStreaming = false;
    
    // Clear retry timer
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    
    // Clean up request
    if (this.currentRequest) {
      this.currentRequest.destroy();
      this.currentRequest = null;
    }
    
    this.currentResponse = null;
  }
  
  /**
   * Get current proxy status
   */
  public getStatus(): CameraProxyStatus {
    return {
      isRunning: this.server !== null,
      port: this.currentPort,
      proxyUrl: `http://localhost:${this.currentPort}/camera`,
      isStreaming: this.isStreaming,
      sourceUrl: this.streamUrl,
      clientCount: this.activeClients.size,
      clients: Array.from(this.activeClients.values()).map(({ client }) => client),
      lastError: this.lastError,
      stats: { ...this.stats }
    };
  }
  
  /**
   * Shutdown the service and cleanup
   */
  public async shutdown(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
  }
  
  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Emit camera proxy event
   */
  private emitEvent(type: CameraProxyEventType, data?: unknown, error?: string): void {
    this.emit(type, {
      type,
      timestamp: new Date(),
      data,
      error
    });
  }
}

// Export singleton instance
export const cameraProxyService = new CameraProxyService();
