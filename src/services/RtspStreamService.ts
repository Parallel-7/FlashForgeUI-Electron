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
 * const wsPort = await service.setupStream(contextId, rtspUrl, { frameRate: 30, quality: 3 });
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

// node-rtsp-stream doesn't have official TypeScript types
// Using custom type definitions from src/types/node-rtsp-stream.d.ts
import type { ChildProcess } from 'child_process';

// Import the Stream type - ts-expect-error is needed because TypeScript can't find the declaration
// even though it exists in src/types/node-rtsp-stream.d.ts. This is a known limitation with
// ambient module declarations for packages without native types.
// @ts-expect-error TS7016 - Using custom type definitions
type Stream = import('node-rtsp-stream').default;

// Import node-rtsp-stream library (no official types, using custom types)
const StreamConstructor = require('node-rtsp-stream') as { new(...args: unknown[]): Stream };

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
  stream: Stream;  // Stream instance from node-rtsp-stream
  isActive: boolean;
  ffmpegProcess?: ChildProcess;  // Reference to ffmpeg child process
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
   * On macOS, Electron apps don't inherit user PATH, so check common install locations explicitly
   * Also checks common paths on Linux (Snap, Flatpak, etc.) and Windows
   */
  private async checkFfmpegAvailability(): Promise<void> {
    // Common ffmpeg installation paths across platforms
    // Order matters: try PATH first, then check platform-specific locations
    const ffmpegPaths = [
      'ffmpeg', // Try PATH first (works if launched from terminal or properly configured)

      // ===== macOS =====
      // Homebrew (most common on macOS)
      '/opt/homebrew/bin/ffmpeg',        // Homebrew on Apple Silicon (M1/M2/M3)
      '/usr/local/bin/ffmpeg',           // Homebrew on Intel Mac
      '/opt/local/bin/ffmpeg',           // MacPorts

      // ===== Linux =====
      // Standard package manager locations (usually in PATH, but checking explicitly doesn't hurt)
      '/usr/bin/ffmpeg',                 // apt (Debian/Ubuntu), yum/dnf (Fedora/RHEL), pacman (Arch)

      // Universal package managers (often not in Electron's PATH)
      '/snap/bin/ffmpeg',                // Snap packages
      '/var/lib/flatpak/exports/bin/ffmpeg',      // Flatpak system-wide
      '~/.local/share/flatpak/exports/bin/ffmpeg', // Flatpak user install

      // Manual/compiled installations
      '/usr/local/bin/ffmpeg',           // Common manual install location
      '~/bin/ffmpeg',                    // User home bin directory

      // ===== Windows =====
      'C:\\ffmpeg\\bin\\ffmpeg.exe',                    // Common manual install
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',     // Program Files install
      'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe', // 32-bit on 64-bit system
    ];

    let lastError = '';

    // Try each path in order
    for (const ffmpegPath of ffmpegPaths) {
      try {
        // Expand ~ to home directory if present
        const expandedPath = ffmpegPath.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '');

        // Quote the path to handle spaces
        const { stdout } = await execAsync(`"${expandedPath}" -version`);
        const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';

        this.ffmpegStatus = {
          available: true,
          version
        };

        console.log(`[RtspStreamService] ffmpeg found at ${expandedPath}: version ${version}`);
        return; // Success! Exit the function
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        // Continue to next path
      }
    }

    // If we get here, ffmpeg wasn't found in any location
    this.ffmpegStatus = {
      available: false,
      error: `ffmpeg not found in any common location. Last error: ${lastError}`
    };

    console.warn('[RtspStreamService] ffmpeg not found in any location');
    console.warn('[RtspStreamService] Searched paths:', ffmpegPaths);
    console.warn('[RtspStreamService] Install ffmpeg to enable RTSP camera viewing:');
    console.warn('[RtspStreamService]   - macOS: brew install ffmpeg');
    console.warn('[RtspStreamService]   - Ubuntu/Debian: sudo apt install ffmpeg');
    console.warn('[RtspStreamService]   - Fedora/RHEL: sudo dnf install ffmpeg');
    console.warn('[RtspStreamService]   - Arch: sudo pacman -S ffmpeg');
    console.warn('[RtspStreamService]   - Windows: Download from ffmpeg.org');
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
   * @param options - Optional stream configuration (frame rate, quality)
   * @returns WebSocket port for client connection
   */
  public async setupStream(
    contextId: string,
    rtspUrl: string,
    options?: {
      frameRate?: number;
      quality?: number;
    }
  ): Promise<number> {
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

    // Get settings with defaults
    const frameRate = options?.frameRate ?? 30;
    const quality = options?.quality ?? 3;

    console.log(`[RtspStreamService] Stream settings: ${frameRate} FPS, quality ${quality}`);

    try {
      // Create node-rtsp-stream instance
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const stream = new StreamConstructor({
        name: contextId,
        streamUrl: rtspUrl,
        wsPort,
        ffmpegOptions: {
          // DO NOT include '-stats' - it enables verbose output
          '-nostats': '',  // Disable progress statistics output
          '-loglevel': 'quiet',  // Suppress ffmpeg banner and info
          '-r': frameRate,    // Use configurable frame rate
          '-q:v': String(quality)      // Use configurable quality
        }
      });

      // Suppress ffmpeg stderr output (node-rtsp-stream emits it as 'ffmpegStderr' event)
      // This prevents ffmpeg logs from appearing in console
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      stream.on('ffmpegStderr', () => {
        // Consume but don't log ffmpeg stderr output
      });

      // Get ffmpeg child process reference from node-rtsp-stream
      // The library exposes it as stream.mpeg1Muxer.stream
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const ffmpegProcess = stream.mpeg1Muxer?.stream;

      // Store stream configuration with ffmpeg process reference
      const streamConfig: RtspStreamConfig = {
        contextId,
        rtspUrl,
        wsPort,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stream,
        isActive: true,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ffmpegProcess
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
      const ffmpegProcess = streamConfig.ffmpegProcess;
      if (ffmpegProcess && !ffmpegProcess.killed) {
        console.log(`[RtspStreamService] Killing ffmpeg process for context ${contextId}`);

        // Wait for process to exit with timeout
        const killPromise = new Promise<void>((resolve) => {
          ffmpegProcess.once('exit', () => {
            console.log(`[RtspStreamService] ffmpeg process exited for context ${contextId}`);
            resolve();
          });

          // Force kill - on Windows, just use kill() without signal
          ffmpegProcess.kill();

          // Timeout after 2 seconds
          setTimeout(() => {
            if (!ffmpegProcess.killed) {
              console.warn('[RtspStreamService] ffmpeg process did not exit cleanly, force killing');
              ffmpegProcess.kill('SIGKILL');
            }
            resolve();
          }, 2000);
        });

        await killPromise;
      }

      // Then stop the stream (which will try to clean up WebSocket server)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const stream = streamConfig.stream;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (stream && typeof stream.stop === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        stream.stop();
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

