/**
 * @fileoverview Camera Proxy Service for multi-context camera streaming.
 *
 * Manages HTTP proxy servers for camera streaming using Express. In multi-context mode,
 * each printer context gets its own camera proxy server on a unique port, allowing
 * simultaneous viewing of multiple printer cameras.
 *
 * Key Responsibilities:
 * - Allocate unique ports for each context's camera stream (8181-8191 range)
 * - Manage multiple camera proxy servers, one per context
 * - Maintain upstream connection to camera sources
 * - Distribute streams to multiple downstream clients
 * - Automatic reconnection with exponential backoff
 * - Clean up resources when contexts are removed
 *
 * Architecture:
 * - Multiple Express HTTP servers, one per context
 * - Port allocation using PortAllocator utility
 * - Map-based storage of stream info indexed by context ID
 * - Integration with PrinterContextManager for lifecycle management
 *
 * Usage:
 * ```typescript
 * const service = CameraProxyService.getInstance();
 *
 * // Set stream URL for a context, returns local proxy URL
 * const localUrl = await service.setStreamUrl(contextId, 'http://printer-ip/camera');
 *
 * // Get stream URL for active context
 * const activeUrl = service.getCurrentStreamUrl();
 *
 * // Remove context stream when disconnecting
 * await service.removeContext(contextId);
 * ```
 *
 * Events:
 * - 'proxy-started': { contextId: string, port: number }
 * - 'proxy-stopped': { contextId: string }
 * - 'stream-connected': { contextId: string }
 * - 'stream-error': { contextId: string, error: string }
 *
 * Related:
 * - PortAllocator: Manages port allocation for camera streams
 * - PrinterContextManager: Context lifecycle management
 */

import express from 'express';
import * as http from 'http';
import { EventEmitter } from 'events';
import {
  CameraProxyConfig,
  CameraProxyStatus,
  CameraProxyClient,
  CameraProxyEventType
} from '../types/camera';
import { PortAllocator } from '../utils/PortAllocator';
import { getPrinterContextManager } from '../managers/PrinterContextManager';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Information about a single context's camera stream
 */
interface ContextStreamInfo {
  /** Allocated port for this context */
  port: number;
  /** Express app instance */
  app: express.Application;
  /** HTTP server instance */
  server: http.Server;
  /** Source camera URL */
  streamUrl: string;
  /** Local proxy URL for clients */
  localUrl: string;
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Active client connections */
  activeClients: Map<string, { client: CameraProxyClient; response: express.Response }>;
  /** Current HTTP request to camera */
  currentRequest: http.ClientRequest | null;
  /** Current HTTP response from camera */
  currentResponse: http.IncomingMessage | null;
  /** Retry count for reconnection */
  retryCount: number;
  /** Retry timer handle */
  retryTimer: NodeJS.Timeout | null;
  /** Delay before tearing down upstream after last client disconnects */
  idleTimeout: NodeJS.Timeout | null;
  /** Last error message */
  lastError: string | null;
  /** Statistics for this stream */
  stats: {
    bytesReceived: number;
    bytesSent: number;
    successfulConnections: number;
    failedConnections: number;
  };
}

/**
 * Branded type for CameraProxyService to ensure singleton pattern
 */
type CameraProxyServiceBrand = { readonly __brand: 'CameraProxyService' };
type CameraProxyServiceInstance = CameraProxyService & CameraProxyServiceBrand;

// ============================================================================
// CAMERA PROXY SERVICE
// ============================================================================

/**
 * Multi-context camera proxy service
 * Manages separate camera streams for multiple printer contexts
 */
export class CameraProxyService extends EventEmitter {
  private static instance: CameraProxyServiceInstance | null = null;

  /** Default configuration for camera proxies */
  private readonly config: CameraProxyConfig;

  /** Port allocator for camera proxy servers (8181-8191 range) */
  private readonly portAllocator = new PortAllocator(8181, 8191);

  /** Map of context streams indexed by context ID */
  private readonly contextStreams = new Map<string, ContextStreamInfo>();

  /** Reference to context manager */
  private readonly contextManager = getPrinterContextManager();

  /** Delay before stopping upstream stream after last renderer disconnects */
  private readonly noClientGracePeriodMs = 5000;

  private constructor() {
    super();

    // Default configuration
    this.config = {
      port: 8181, // Not used in multi-context mode, kept for interface compatibility
      fallbackPort: 8182,
      autoStart: true,
      reconnection: {
        enabled: true,
        maxRetries: 5,
        retryDelay: 2000,
        exponentialBackoff: true
      }
    };

    console.log('[CameraProxyService] Multi-context camera proxy service initialized');
  }

  /**
   * Get singleton instance of CameraProxyService
   */
  public static getInstance(): CameraProxyServiceInstance {
    if (!CameraProxyService.instance) {
      CameraProxyService.instance = new CameraProxyService() as CameraProxyServiceInstance;
    }
    return CameraProxyService.instance;
  }
  
  // ============================================================================
  // MULTI-CONTEXT STREAM MANAGEMENT
  // ============================================================================

  /**
   * Set camera stream URL for a specific context
   * Creates a new camera proxy server for the context if needed
   *
   * @param contextId - Context ID to set stream for
   * @param url - Camera stream URL
   * @returns Local proxy URL for accessing the stream
   */
  public async setStreamUrl(contextId: string, url: string): Promise<string> {
    console.log(`[CameraProxyService] Setting stream URL for context ${contextId}: ${url}`);

    // If stream already exists, clean it up first
    if (this.contextStreams.has(contextId)) {
      await this.removeContext(contextId);
    }

    // Allocate port for this context
    const port = this.portAllocator.allocatePort();
    const localUrl = `http://localhost:${port}/stream`;

    // Create Express app and server for this context
    const app = express();
    const server = http.createServer(app);

    // Set up stream endpoint
    app.get('/stream', (req, res) => {
      this.handleCameraRequest(contextId, req, res);
    });

    // Set up health check endpoint
    app.get('/health', (req, res) => {
      const streamInfo = this.contextStreams.get(contextId);
      res.json({
        contextId,
        port,
        isStreaming: streamInfo?.isStreaming || false,
        sourceUrl: streamInfo?.streamUrl || null,
        clientCount: streamInfo?.activeClients.size || 0,
        lastError: streamInfo?.lastError || null
      });
    });

    // Create stream info object
    const streamInfo: ContextStreamInfo = {
      port,
      app,
      server,
      streamUrl: url,
      localUrl,
      isStreaming: false,
      activeClients: new Map(),
      currentRequest: null,
      currentResponse: null,
      retryCount: 0,
      retryTimer: null,
      idleTimeout: null,
      lastError: null,
      stats: {
        bytesReceived: 0,
        bytesSent: 0,
        successfulConnections: 0,
        failedConnections: 0
      }
    };

    // Start the server
    await new Promise<void>((resolve, reject) => {
      server.on('error', (err: Error) => {
        console.error(`[CameraProxyService] Server error for context ${contextId}:`, err);
        streamInfo.lastError = err.message;
        this.emitContextEvent(contextId, 'stream-error', null, err.message);
        reject(err);
      });

      server.listen(port, () => {
        console.log(`[CameraProxyService] Camera proxy running for context ${contextId} on port ${port}`);
        this.emitContextEvent(contextId, 'proxy-started', { port });
        resolve();
      });
    });

    // Store stream info
    this.contextStreams.set(contextId, streamInfo);

    // Update context manager with camera port
    this.contextManager.updateCameraPort(contextId, port);

    return localUrl;
  }

  /**
   * Get stream URL for the active context
   *
   * @returns Local proxy URL for active context or null if none
   */
  public getCurrentStreamUrl(): string | null {
    const activeContextId = this.contextManager.getActiveContextId();
    if (!activeContextId) {
      return null;
    }

    const streamInfo = this.contextStreams.get(activeContextId);
    return streamInfo ? streamInfo.localUrl : null;
  }

  /**
   * Get stream URL for a specific context
   *
   * @param contextId - Context ID to get URL for
   * @returns Local proxy URL or null if not found
   */
  public getStreamUrlForContext(contextId: string): string | null {
    const streamInfo = this.contextStreams.get(contextId);
    return streamInfo ? streamInfo.localUrl : null;
  }

  /**
   * Remove camera stream for a context and clean up resources
   *
   * @param contextId - Context ID to remove stream for
   */
  public async removeContext(contextId: string): Promise<void> {
    const streamInfo = this.contextStreams.get(contextId);
    if (!streamInfo) {
      console.log(`[CameraProxyService] No stream for context ${contextId}`);
      return;
    }

    console.log(`[CameraProxyService] Removing stream for context ${contextId}`);

    this.clearIdleTimeout(streamInfo);

    // Stop streaming
    this.stopStreamingForContext(contextId, streamInfo);

    // Close all client connections
    streamInfo.activeClients.forEach(({ response }) => {
      try {
        response.end();
      } catch {
        // Ignore errors during cleanup
      }
    });
    streamInfo.activeClients.clear();

    // Close server
    await new Promise<void>((resolve) => {
      streamInfo.server.close(() => {
        console.log(`[CameraProxyService] Server closed for context ${contextId}`);
        this.emitContextEvent(contextId, 'proxy-stopped');
        resolve();
      });
    });

    // Release port
    this.portAllocator.releasePort(streamInfo.port);

    // Update context manager
    this.contextManager.updateCameraPort(contextId, null);

    // Remove from map
    this.contextStreams.delete(contextId);
  }
  
  // ============================================================================
  // CAMERA REQUEST HANDLING
  // ============================================================================

  /**
   * Handle incoming camera request for a specific context
   *
   * @param contextId - Context ID this request is for
   * @param req - Express request object
   * @param res - Express response object
   */
  private handleCameraRequest(contextId: string, req: express.Request, res: express.Response): void {
    const streamInfo = this.contextStreams.get(contextId);
    if (!streamInfo) {
      res.status(503).send('Camera stream not available');
      return;
    }

    this.clearIdleTimeout(streamInfo);

    const clientId = this.generateClientId();
    const client: CameraProxyClient = {
      id: clientId,
      connectedAt: new Date(),
      remoteAddress: req.socket.remoteAddress || 'unknown',
      isConnected: true
    };

    console.log(`[CameraProxyService] New camera client connected for context ${contextId}: ${client.remoteAddress}`);
    streamInfo.activeClients.set(clientId, { client, response: res });

    // Handle client disconnect
    res.on('close', () => {
      console.log(`[CameraProxyService] Camera client disconnected for context ${contextId}: ${client.remoteAddress}`);
      streamInfo.activeClients.delete(clientId);
      this.emitContextEvent(contextId, 'client-disconnected', { clientId });

      // Stop streaming if no more clients
      if (streamInfo.activeClients.size === 0) {
        console.log(`[CameraProxyService] No more clients for context ${contextId}, scheduling stream stop`);
        this.scheduleIdleStreamStop(contextId, streamInfo);
      }
    });

    // Handle errors
    res.on('error', (err) => {
      console.error(`[CameraProxyService] Client error for context ${contextId}:`, err.message);
      streamInfo.activeClients.delete(clientId);
    });

    this.emitContextEvent(contextId, 'client-connected', { clientId, remoteAddress: client.remoteAddress });

    // Start streaming if not already active
    if (!streamInfo.isStreaming) {
      this.startStreamingForContext(contextId, streamInfo);
    } else if (streamInfo.currentResponse) {
      // If already streaming, copy headers from upstream
      this.copyHeadersToClient(streamInfo, res);
    }
  }

  // ============================================================================
  // STREAMING LOGIC
  // ============================================================================

  /**
   * Start streaming from camera source for a context
   *
   * @param contextId - Context ID to start streaming for
   * @param streamInfo - Stream info object
   */
  private startStreamingForContext(contextId: string, streamInfo: ContextStreamInfo): void {
    if (streamInfo.isStreaming) {
      console.log(`[CameraProxyService] Camera stream already running for context ${contextId}`);
      return;
    }

    console.log(`[CameraProxyService] Starting camera stream for context ${contextId} from ${streamInfo.streamUrl}`);
    streamInfo.isStreaming = true;
    streamInfo.retryCount = 0;
    this.connectToStreamForContext(contextId, streamInfo);
  }

  /**
   * Connect to camera stream for a context
   *
   * @param contextId - Context ID
   * @param streamInfo - Stream info object
   */
  private connectToStreamForContext(contextId: string, streamInfo: ContextStreamInfo): void {
    try {
      const url = new URL(streamInfo.streamUrl);

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

      streamInfo.currentRequest = http.get(options, (response) => {
        streamInfo.currentResponse = response;
        
        if (response.statusCode !== 200) {
          const error = `Camera returned status code: ${response.statusCode}`;
          console.error(`[CameraProxyService] Error for context ${contextId}:`, error);
          streamInfo.lastError = error;
          streamInfo.stats.failedConnections++;
          this.emitContextEvent(contextId, 'stream-error', null, error);
          this.handleStreamErrorForContext(contextId, streamInfo);
          return;
        }

        console.log(`[CameraProxyService] Connected to camera stream for context ${contextId}`);
        streamInfo.lastError = null;
        streamInfo.stats.successfulConnections++;
        streamInfo.retryCount = 0;
        this.emitContextEvent(contextId, 'stream-connected');

        // Copy headers to all connected clients
        streamInfo.activeClients.forEach(({ response: clientRes }) => {
          if (!clientRes.headersSent) {
            this.copyHeadersToClient(streamInfo, clientRes);
          }
        });

        // Pipe data to all clients
        response.on('data', (chunk: Buffer) => {
          streamInfo.stats.bytesReceived += chunk.length;
          this.distributeToClientsForContext(streamInfo, chunk);
        });

        response.on('end', () => {
          console.log(`[CameraProxyService] Camera stream ended for context ${contextId}`);
          this.emitContextEvent(contextId, 'stream-disconnected');
          this.handleStreamErrorForContext(contextId, streamInfo);
        });

        response.on('error', (err) => {
          console.error(`[CameraProxyService] Error receiving camera stream for context ${contextId}:`, err);
          streamInfo.lastError = err.message;
          this.emitContextEvent(contextId, 'stream-error', null, err.message);
          this.handleStreamErrorForContext(contextId, streamInfo);
        });
      });

      streamInfo.currentRequest.on('error', (err) => {
        console.error(`[CameraProxyService] Error connecting to camera stream for context ${contextId}:`, err);
        streamInfo.lastError = err.message;
        streamInfo.stats.failedConnections++;
        this.emitContextEvent(contextId, 'stream-error', null, err.message);
        this.handleStreamErrorForContext(contextId, streamInfo);
      });

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[CameraProxyService] Error starting camera stream for context ${contextId}:`, error);
      streamInfo.lastError = error;
      streamInfo.stats.failedConnections++;
      this.emitContextEvent(contextId, 'stream-error', null, error);
      streamInfo.isStreaming = false;
      this.handleStreamErrorForContext(contextId, streamInfo);
    }
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Copy headers from upstream to client
   *
   * @param streamInfo - Stream info object
   * @param res - Client response object
   */
  private copyHeadersToClient(streamInfo: ContextStreamInfo, res: express.Response): void {
    if (!streamInfo.currentResponse || res.headersSent) return;

    const headers = streamInfo.currentResponse.headers;
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
   * Distribute data chunk to all clients for a context
   *
   * @param streamInfo - Stream info object
   * @param chunk - Data chunk to distribute
   */
  private distributeToClientsForContext(streamInfo: ContextStreamInfo, chunk: Buffer): void {
    const failedClients: string[] = [];

    streamInfo.activeClients.forEach(({ response }, clientId) => {
      try {
        if (!response.destroyed && response.writable) {
          response.write(chunk);
          streamInfo.stats.bytesSent += chunk.length;
        } else {
          failedClients.push(clientId);
        }
      } catch (err) {
        console.error('[CameraProxyService] Error sending data to client:', err);
        failedClients.push(clientId);
      }
    });

    // Clean up failed clients
    failedClients.forEach(clientId => {
      streamInfo.activeClients.delete(clientId);
    });
  }

  /**
   * Schedule stream shutdown after a grace period when all clients disconnect
   */
  private scheduleIdleStreamStop(contextId: string, streamInfo: ContextStreamInfo): void {
    if (streamInfo.idleTimeout) {
      return;
    }

    streamInfo.idleTimeout = setTimeout(() => {
      streamInfo.idleTimeout = null;

      if (streamInfo.activeClients.size === 0) {
        console.log(
          `[CameraProxyService] Idle timeout reached for context ${contextId}, stopping upstream stream`
        );
        this.stopStreamingForContext(contextId, streamInfo);
      }
    }, this.noClientGracePeriodMs);
  }

  /**
   * Clear pending idle shutdown timers when new clients connect or service stops
   */
  private clearIdleTimeout(streamInfo: ContextStreamInfo): void {
    if (streamInfo.idleTimeout) {
      clearTimeout(streamInfo.idleTimeout);
      streamInfo.idleTimeout = null;
    }
  }

  /**
   * Handle stream errors and reconnection for a context
   *
   * @param contextId - Context ID
   * @param streamInfo - Stream info object
   */
  private handleStreamErrorForContext(contextId: string, streamInfo: ContextStreamInfo): void {
    this.stopStreamingForContext(contextId, streamInfo);

    if (this.config.reconnection.enabled &&
        streamInfo.activeClients.size > 0 &&
        streamInfo.retryCount < this.config.reconnection.maxRetries) {

      const delay = this.config.reconnection.exponentialBackoff
        ? this.config.reconnection.retryDelay * Math.pow(2, streamInfo.retryCount)
        : this.config.reconnection.retryDelay;

      streamInfo.retryCount++;

      console.log(`[CameraProxyService] Retrying camera connection for context ${contextId} in ${delay}ms (attempt ${streamInfo.retryCount}/${this.config.reconnection.maxRetries})`);
      this.emitContextEvent(contextId, 'retry-attempt', { attempt: streamInfo.retryCount, maxRetries: this.config.reconnection.maxRetries });

      streamInfo.retryTimer = setTimeout(() => {
        if (streamInfo.activeClients.size > 0) {
          streamInfo.isStreaming = true;
          this.connectToStreamForContext(contextId, streamInfo);
        }
      }, delay);
    }
  }

  /**
   * Stop streaming from camera for a context
   *
   * @param contextId - Context ID
   * @param streamInfo - Stream info object
   */
  private stopStreamingForContext(contextId: string, streamInfo: ContextStreamInfo): void {
    if (!streamInfo.isStreaming) return;

    console.log(`[CameraProxyService] Stopping camera stream for context ${contextId}`);
    streamInfo.isStreaming = false;

    this.clearIdleTimeout(streamInfo);

    // Clear retry timer
    if (streamInfo.retryTimer) {
      clearTimeout(streamInfo.retryTimer);
      streamInfo.retryTimer = null;
    }

    // Clean up request
    if (streamInfo.currentRequest) {
      streamInfo.currentRequest.destroy();
      streamInfo.currentRequest = null;
    }

    streamInfo.currentResponse = null;
  }
  
  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * @deprecated Use getStatusForContext(contextId) instead
   * Get current proxy status (legacy compatibility)
   */
  public getStatus(): CameraProxyStatus {
    console.warn('[CameraProxyService] getStatus() is deprecated in multi-context mode');

    // Return status for active context if available
    const activeContextId = this.contextManager.getActiveContextId();
    if (activeContextId) {
      const streamInfo = this.contextStreams.get(activeContextId);
      if (streamInfo) {
        return {
          isRunning: true,
          port: streamInfo.port,
          proxyUrl: streamInfo.localUrl,
          isStreaming: streamInfo.isStreaming,
          sourceUrl: streamInfo.streamUrl,
          clientCount: streamInfo.activeClients.size,
          clients: Array.from(streamInfo.activeClients.values()).map(({ client }) => client),
          lastError: streamInfo.lastError,
          stats: {
            bytesReceived: streamInfo.stats.bytesReceived,
            bytesSent: streamInfo.stats.bytesSent,
            successfulConnections: streamInfo.stats.successfulConnections,
            failedConnections: streamInfo.stats.failedConnections,
            currentRetryCount: streamInfo.retryCount
          }
        };
      }
    }

    // No active context
    return {
      isRunning: false,
      port: 0,
      proxyUrl: '',
      isStreaming: false,
      sourceUrl: null,
      clientCount: 0,
      clients: [],
      lastError: null,
      stats: {
        bytesReceived: 0,
        bytesSent: 0,
        successfulConnections: 0,
        failedConnections: 0,
        currentRetryCount: 0
      }
    };
  }

  /**
   * Get status for a specific context
   *
   * @param contextId - Context ID to get status for
   * @returns Camera proxy status or null if not found
   */
  public getStatusForContext(contextId: string): CameraProxyStatus | null {
    const streamInfo = this.contextStreams.get(contextId);
    if (!streamInfo) {
      return null;
    }

    return {
      isRunning: true,
      port: streamInfo.port,
      proxyUrl: streamInfo.localUrl,
      isStreaming: streamInfo.isStreaming,
      sourceUrl: streamInfo.streamUrl,
      clientCount: streamInfo.activeClients.size,
      clients: Array.from(streamInfo.activeClients.values()).map(({ client }) => client),
      lastError: streamInfo.lastError,
      stats: {
        ...streamInfo.stats,
        currentRetryCount: streamInfo.retryCount
      }
    };
  }

  /**
   * Get all active context IDs with camera streams
   *
   * @returns Array of context IDs with camera streams
   */
  public getActiveContexts(): string[] {
    return Array.from(this.contextStreams.keys());
  }

  /**
   * Get total number of active camera streams
   *
   * @returns Count of active camera streams
   */
  public getActiveStreamCount(): number {
    return this.contextStreams.size;
  }

  /**
   * Shutdown the service and cleanup all streams
   */
  public async shutdown(): Promise<void> {
    console.log(`[CameraProxyService] Shutting down all camera streams (${this.contextStreams.size} active)`);

    // Remove all contexts
    const contextIds = Array.from(this.contextStreams.keys());
    for (const contextId of contextIds) {
      await this.removeContext(contextId);
    }

    // Reset port allocator
    this.portAllocator.reset();

    this.removeAllListeners();
    console.log('[CameraProxyService] Shutdown complete');
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate unique client ID
   *
   * @returns Unique client identifier
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit camera proxy event with context identification
   *
   * @param contextId - Context ID for the event
   * @param type - Event type
   * @param data - Event data
   * @param error - Error message if applicable
   */
  private emitContextEvent(contextId: string, type: CameraProxyEventType, data?: unknown, error?: string): void {
    this.emit(type, {
      contextId,
      type,
      timestamp: new Date(),
      data,
      error
    });
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Get singleton instance of CameraProxyService
 * Convenience function for imports
 */
export function getCameraProxyService(): CameraProxyServiceInstance {
  return CameraProxyService.getInstance();
}
