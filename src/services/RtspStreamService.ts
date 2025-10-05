/**
 * @fileoverview RTSP Stream Service using node-rtsp-stream
 *
 * Provides RTSP-to-WebSocket streaming using node-rtsp-stream library.
 * Converts RTSP streams to MPEG1 via ffmpeg and streams via WebSocket for browser playback
 * using JSMpeg on the client side.
 *
 * Key Responsibilities:
 * - Check for ffmpeg availability
 * - Setup RTSP streams with dedicated WebSocket ports per context
 * - Manage multiple RTSP streams per printer context
 * - Handle graceful stream cleanup on disconnect
 *
 * Usage:
 * ```typescript
 * const service = getRtspStreamService();
 * await service.initialize();
 *
 * // Setup RTSP stream for a context
 * const wsPort = await service.setupStream(contextId, rtspUrl);
 * // Client connects to ws://localhost:${wsPort}
 *
 * // Stop stream when context disconnects
 * await service.stopStream(contextId);
 * ```
 *
 * Related:
 * - CameraProxyService: Handles MJPEG streaming
 * - camera-preview component: JSMpeg player for RTSP streams
 */

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// node-rtsp-stream doesn't have TypeScript types
// @ts-ignore
import Stream from 'node-rtsp-stream';

// ============================================================================
// TYPES
// ============================================================================

/**
 * RTSP stream configuration for a single context
 */
interface RtspStreamConfig {
  contextId: string;
  rtspUrl: string;
  wsPort: number;
  stream: any;  // Stream instance from node-rtsp-stream
  isActive: boolean;
  ffmpegProcess?: any;  // Reference to ffmpeg child process
}

/**
 * ffmpeg availability status
 */
interface FfmpegStatus {
  available: boolean;
  version?: string;
  error?: string;
}

// ============================================================================
// RTSP STREAM SERVICE
// ============================================================================

/**
 * Singleton service for RTSP-to-WebSocket streaming
 */
export class RtspStreamService extends EventEmitter {
  private static instance: RtspStreamService | null = null;

  /** Active RTSP stream configurations indexed by context ID */
  private readonly streams = new Map<string, RtspStreamConfig>();

  /** ffmpeg availability cache */
  private ffmpegStatus: FfmpegStatus | null = null;

  /** Base port for WebSocket streams - each context gets a unique port */
  private readonly BASE_WS_PORT = 9000;

  /** Maximum number of concurrent streams */
  private readonly MAX_STREAMS = 10;

  private constructor() {
    super();
    console.log('[RtspStreamService] RTSP stream service created');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RtspStreamService {
    if (!RtspStreamService.instance) {
      RtspStreamService.instance = new RtspStreamService();
    }
    return RtspStreamService.instance;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the RTSP stream service
   * Checks for ffmpeg availability
   */
  public async initialize(): Promise<void> {
    console.log('[RtspStreamService] Initializing RTSP stream service');

    // Check ffmpeg availability
    await this.checkFfmpegAvailability();

    if (!this.ffmpegStatus?.available) {
      console.warn('[RtspStreamService] ffmpeg not available - RTSP streaming will not work');
      console.warn('[RtspStreamService] Install ffmpeg to enable RTSP camera viewing');
      return;
    }

    console.log(`[RtspStreamService] ffmpeg available: ${this.ffmpegStatus.version}`);
    console.log('[RtspStreamService] Waiting for stream setup requests');
  }

  /**
   * Check if ffmpeg is available on the system
   */
  private async checkFfmpegAvailability(): Promise<void> {
    try {
      const { stdout } = await execAsync('ffmpeg -version');
      const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      this.ffmpegStatus = {
        available: true,
        version
      };

      console.log(`[RtspStreamService] ffmpeg found: version ${version}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.ffmpegStatus = {
        available: false,
        error: errorMessage
      };

      console.warn('[RtspStreamService] ffmpeg not found:', errorMessage);
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get ffmpeg availability status
   */
  public getFfmpegStatus(): FfmpegStatus {
    return this.ffmpegStatus || { available: false, error: 'Not checked yet' };
  }

  /**
   * Setup RTSP stream for a context
   *
   * @param contextId - Context ID for this stream
   * @param rtspUrl - RTSP stream URL
   * @returns WebSocket port for client connection
   */
  public async setupStream(contextId: string, rtspUrl: string): Promise<number> {
    if (!this.ffmpegStatus?.available) {
      throw new Error('ffmpeg not available - cannot setup RTSP stream');
    }

    console.log(`[RtspStreamService] Setting up RTSP stream for context ${contextId}: ${rtspUrl}`);

    // If stream already exists for this context, stop it first
    if (this.streams.has(contextId)) {
      console.log(`[RtspStreamService] Stopping existing stream for context ${contextId}`);
      await this.stopStream(contextId);
    }

    // Check if we've hit the maximum number of streams
    if (this.streams.size >= this.MAX_STREAMS) {
      throw new Error(`Maximum number of concurrent streams (${this.MAX_STREAMS}) reached`);
    }

    // Allocate a unique WebSocket port for this stream
    const wsPort = this.allocatePort();

    try {
      // Create node-rtsp-stream instance
      const stream = new Stream({
        name: contextId,
        streamUrl: rtspUrl,
        wsPort,
        ffmpegOptions: {
          '-stats': '',
          '-r': 30,  // 30 fps
          '-q:v': '3'  // Quality (1-5, lower is better)
        }
      });

      // Store stream configuration with ffmpeg process reference
      const streamConfig: RtspStreamConfig = {
        contextId,
        rtspUrl,
        wsPort,
        stream,
        isActive: true,
        ffmpegProcess: stream.mpeg1Muxer?.stream  // Store ffmpeg child process reference
      };

      this.streams.set(contextId, streamConfig);

      console.log(`[RtspStreamService] RTSP stream active for context ${contextId} on ws://localhost:${wsPort}`);
      this.emit('stream-started', { contextId, wsPort });

      return wsPort;
    } catch (error) {
      console.error(`[RtspStreamService] Failed to setup stream for context ${contextId}:`, error);
      throw error;
    }
  }

  /**
   * Stop RTSP stream for a context
   *
   * @param contextId - Context ID to stop stream for
   */
  public async stopStream(contextId: string): Promise<void> {
    const streamConfig = this.streams.get(contextId);
    if (!streamConfig) {
      console.log(`[RtspStreamService] No active stream for context ${contextId}`);
      return;
    }

    console.log(`[RtspStreamService] Stopping RTSP stream for context ${contextId}`);

    try {
      // First, explicitly kill the ffmpeg process if we have a reference
      if (streamConfig.ffmpegProcess) {
        console.log(`[RtspStreamService] Killing ffmpeg process for context ${contextId}`);
        streamConfig.ffmpegProcess.kill('SIGKILL');  // Force kill ffmpeg
      }

      // Then stop the stream (which will try to clean up WebSocket server)
      if (streamConfig.stream && typeof streamConfig.stream.stop === 'function') {
        streamConfig.stream.stop();
      }
    } catch (error) {
      console.error(`[RtspStreamService] Error stopping stream for context ${contextId}:`, error);
    }

    // Remove from active streams
    this.streams.delete(contextId);

    this.emit('stream-stopped', { contextId });
    console.log(`[RtspStreamService] RTSP stream stopped for context ${contextId}`);
  }

  /**
   * Get stream status for a context
   *
   * @param contextId - Context ID to check
   * @returns Stream configuration or null if not found
   */
  public getStreamStatus(contextId: string): RtspStreamConfig | null {
    return this.streams.get(contextId) || null;
  }

  /**
   * Get WebSocket port for a context's stream
   *
   * @param contextId - Context ID
   * @returns WebSocket port or null if no stream exists
   */
  public getStreamPort(contextId: string): number | null {
    const stream = this.streams.get(contextId);
    return stream ? stream.wsPort : null;
  }

  /**
   * Get all active stream context IDs
   *
   * @returns Array of active context IDs
   */
  public getActiveStreams(): string[] {
    return Array.from(this.streams.keys());
  }

  /**
   * Check if a URL is an RTSP URL
   *
   * @param url - URL to check
   * @returns true if RTSP URL
   */
  public static isRtspUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'rtsp:';
    } catch {
      return false;
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Allocate a unique port for a new stream
   * Finds the next available port starting from BASE_WS_PORT
   */
  private allocatePort(): number {
    const usedPorts = new Set(
      Array.from(this.streams.values()).map(s => s.wsPort)
    );

    for (let i = 0; i < this.MAX_STREAMS; i++) {
      const port = this.BASE_WS_PORT + i;
      if (!usedPorts.has(port)) {
        return port;
      }
    }

    throw new Error('No available ports for new stream');
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Shutdown the service and cleanup all streams
   */
  public async shutdown(): Promise<void> {
    console.log(`[RtspStreamService] Shutting down (${this.streams.size} active streams)`);

    // Stop all streams
    const contextIds = Array.from(this.streams.keys());
    for (const contextId of contextIds) {
      await this.stopStream(contextId);
    }

    this.removeAllListeners();

    console.log('[RtspStreamService] Shutdown complete');
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Get singleton instance of RtspStreamService
 */
export function getRtspStreamService(): RtspStreamService {
  return RtspStreamService.getInstance();
}
