/**
 * @fileoverview Unified camera streaming service using go2rtc as the streaming gateway.
 * This service replaces both CameraProxyService (MJPEG) and RtspStreamService (RTSP)
 * with a single, consistent interface.
 *
 * go2rtc handles all protocol conversion, allowing browsers to consume any camera
 * source via WebRTC, MSE, or MJPEG fallback - eliminating the rotation bug caused
 * by JSMpeg's canvas rendering.
 *
 * Key improvements over previous implementation:
 * - No ffmpeg dependency for basic streaming
 * - ~500ms latency via WebRTC (vs 1-3s with transcoding)
 * - Native <video> element (no canvas = no rotation drift)
 * - Automatic reconnection built into go2rtc
 * - Unified handling for all camera types
 *
 * @see src/main/services/Go2rtcBinaryManager.ts for binary lifecycle
 * @see src/main/types/go2rtc.types.ts for type definitions
 */

import { EventEmitter } from 'node:events';
import type {
  CameraStreamConfig,
  Go2rtcServiceStatus,
  Go2rtcStreamInfo,
  Go2rtcStreamsResponse,
} from '../types/go2rtc.types.js';
import { Go2rtcBinaryManager, getGo2rtcBinaryManager } from './Go2rtcBinaryManager.js';

/**
 * Internal stream configuration
 */
interface ManagedStream {
  /** Printer context ID */
  contextId: string;
  /** Stream name in go2rtc (derived from contextId) */
  streamName: string;
  /** Source URL (RTSP or MJPEG) */
  sourceUrl: string;
  /** Original source type */
  sourceType: 'oem' | 'custom';
  /** Original stream type */
  streamType: 'mjpeg' | 'rtsp';
  /** Timestamp when stream was added */
  addedAt: number;
}

/**
 * Unified camera streaming service using go2rtc.
 *
 * Usage:
 * ```typescript
 * const service = getGo2rtcService();
 * await service.initialize();
 *
 * // Add a stream for a printer context
 * await service.addStream('context-1', 'rtsp://camera/stream', 'custom', 'rtsp');
 *
 * // Get stream URL for UI
 * const config = service.getStreamConfig('context-1');
 * // config.wsUrl = 'ws://localhost:1984/api/ws?src=printer_context_1_...'
 *
 * // Remove stream when printer disconnects
 * await service.removeStream('context-1');
 * ```
 */
export class Go2rtcService extends EventEmitter {
  private static instance: Go2rtcService | null = null;

  /** Binary manager instance */
  private readonly binaryManager: Go2rtcBinaryManager;

  /** Managed streams by context ID */
  private readonly streams = new Map<string, ManagedStream>();

  /** Whether service has been initialized */
  private initialized = false;

  /** Last error encountered */
  private lastError: string | null = null;

  private constructor() {
    super();
    this.binaryManager = getGo2rtcBinaryManager();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): Go2rtcService {
    if (!Go2rtcService.instance) {
      Go2rtcService.instance = new Go2rtcService();
    }
    return Go2rtcService.instance;
  }

  /**
   * Initialize the service by starting go2rtc
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[Go2rtcService] Already initialized');
      return;
    }

    try {
      console.log('[Go2rtcService] Initializing...');
      await this.binaryManager.start();
      this.initialized = true;
      this.lastError = null;
      this.emit('service-ready');
      console.log('[Go2rtcService] Initialized successfully');
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.emit('service-error', error);
      throw error;
    }
  }

  /**
   * Check if the service is running
   */
  public isRunning(): boolean {
    return this.initialized && this.binaryManager.isRunning();
  }

  /**
   * Convert context ID to a valid go2rtc stream name.
   * Stream names in go2rtc can contain alphanumeric characters, underscores, and hyphens.
   */
  private contextToStreamName(contextId: string): string {
    // Replace any non-alphanumeric characters (except underscore/hyphen) with underscore
    return `printer_${contextId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }

  /**
   * Add a camera stream for a printer context
   */
  public async addStream(
    contextId: string,
    sourceUrl: string,
    sourceType: 'oem' | 'custom',
    streamType: 'mjpeg' | 'rtsp'
  ): Promise<void> {
    if (!this.isRunning()) {
      await this.initialize();
    }

    // Remove existing stream if any
    if (this.streams.has(contextId)) {
      await this.removeStream(contextId);
    }

    const streamName = this.contextToStreamName(contextId);

    // go2rtc auto-detects source format from Content-Type header:
    // - MJPEG: detected from multipart/x-mixed-replace content type
    // - RTSP: detected from rtsp:// protocol
    // No prefix transformation needed - pass URLs directly
    console.log(`[Go2rtcService] Adding stream: ${streamName} -> ${sourceUrl}`);

    try {
      // Add stream to go2rtc via REST API
      // API format: PUT /api/streams?name=<stream_name>&src=<source_url>
      // Both parameters go in query string, no body needed
      const apiUrl = this.binaryManager.getApiUrl();
      const response = await fetch(
        `${apiUrl}/api/streams?name=${encodeURIComponent(streamName)}&src=${encodeURIComponent(sourceUrl)}`,
        { method: 'PUT' }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to add stream: ${response.status} ${text}`);
      }

      // Store stream info
      const managedStream: ManagedStream = {
        contextId,
        streamName,
        sourceUrl,
        sourceType,
        streamType,
        addedAt: Date.now(),
      };

      this.streams.set(contextId, managedStream);
      this.emit('stream-added', contextId, streamName);

      console.log(`[Go2rtcService] Stream added: ${streamName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Go2rtcService] Failed to add stream ${streamName}:`, errorMessage);
      this.emit('stream-error', contextId, error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }

  /**
   * Remove a camera stream for a printer context
   */
  public async removeStream(contextId: string): Promise<void> {
    const stream = this.streams.get(contextId);
    if (!stream) {
      return;
    }

    console.log(`[Go2rtcService] Removing stream: ${stream.streamName}`);

    try {
      if (this.binaryManager.isRunning()) {
        const apiUrl = this.binaryManager.getApiUrl();
        const response = await fetch(`${apiUrl}/api/streams?name=${encodeURIComponent(stream.streamName)}`, {
          method: 'DELETE',
        });

        if (!response.ok && response.status !== 404) {
          console.warn(`[Go2rtcService] Failed to remove stream from go2rtc: ${response.status}`);
        }
      }
    } catch (error) {
      console.warn(`[Go2rtcService] Error removing stream from go2rtc:`, error);
    }

    this.streams.delete(contextId);
    this.emit('stream-removed', contextId);

    console.log(`[Go2rtcService] Stream removed: ${stream.streamName}`);
  }

  /**
   * Restart a stream (remove and re-add)
   */
  public async restartStream(contextId: string): Promise<void> {
    const stream = this.streams.get(contextId);
    if (!stream) {
      throw new Error(`No stream found for context: ${contextId}`);
    }

    console.log(`[Go2rtcService] Restarting stream: ${stream.streamName}`);

    const { sourceUrl, sourceType, streamType } = stream;
    await this.removeStream(contextId);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await this.addStream(contextId, sourceUrl, sourceType, streamType);
  }

  /**
   * Get stream configuration for UI consumption
   */
  public getStreamConfig(contextId: string): CameraStreamConfig | null {
    const stream = this.streams.get(contextId);
    if (!stream) {
      return null;
    }

    const apiPort = this.binaryManager.getApiPort();
    const wsUrl = `ws://localhost:${apiPort}/api/ws?src=${encodeURIComponent(stream.streamName)}`;

    // Determine playback mode based on stream type:
    // - MJPEG: Use mjpeg mode directly (go2rtc can't transcode JPEG to H264 without ffmpeg)
    // - RTSP: Try WebRTC/MSE first (typically H264), fall back to mjpeg
    const mode = stream.streamType === 'mjpeg' ? 'mjpeg' : 'webrtc,mse,mjpeg';

    return {
      wsUrl,
      sourceType: stream.sourceType,
      streamType: stream.streamType,
      mode,
      isAvailable: this.isRunning(),
      streamName: stream.streamName,
      apiPort,
    };
  }

  /**
   * Get WebSocket URL for a stream
   */
  public getStreamWsUrl(contextId: string): string | null {
    const config = this.getStreamConfig(contextId);
    return config?.wsUrl ?? null;
  }

  /**
   * Get MJPEG snapshot URL for a stream
   */
  public getStreamMjpegUrl(contextId: string): string | null {
    const stream = this.streams.get(contextId);
    if (!stream) {
      return null;
    }

    const apiUrl = this.binaryManager.getApiUrl();
    return `${apiUrl}/api/frame.jpeg?src=${encodeURIComponent(stream.streamName)}`;
  }

  /**
   * Get stream info from go2rtc API
   */
  public async getStreamInfo(contextId: string): Promise<Go2rtcStreamInfo | null> {
    const stream = this.streams.get(contextId);
    if (!stream || !this.binaryManager.isRunning()) {
      return null;
    }

    try {
      const apiUrl = this.binaryManager.getApiUrl();
      const response = await fetch(`${apiUrl}/api/streams?src=${encodeURIComponent(stream.streamName)}`);

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as Go2rtcStreamsResponse;
      return data[stream.streamName] ?? null;
    } catch (error) {
      console.warn(`[Go2rtcService] Failed to get stream info:`, error);
      return null;
    }
  }

  /**
   * Get all active streams from go2rtc API
   */
  public async getAllStreams(): Promise<Go2rtcStreamsResponse> {
    if (!this.binaryManager.isRunning()) {
      return {};
    }

    try {
      const apiUrl = this.binaryManager.getApiUrl();
      const response = await fetch(`${apiUrl}/api/streams`);

      if (!response.ok) {
        return {};
      }

      return (await response.json()) as Go2rtcStreamsResponse;
    } catch (error) {
      console.warn(`[Go2rtcService] Failed to get all streams:`, error);
      return {};
    }
  }

  /**
   * Get list of active context IDs
   */
  public getActiveContexts(): string[] {
    return Array.from(this.streams.keys());
  }

  /**
   * Check if a context has an active stream
   */
  public hasStream(contextId: string): boolean {
    return this.streams.has(contextId);
  }

  /**
   * Get service status information
   */
  public getServiceStatus(): Go2rtcServiceStatus {
    return {
      isRunning: this.isRunning(),
      apiUrl: this.binaryManager.getApiUrl(),
      webrtcPort: this.binaryManager.getWebRtcPort(),
      pid: this.binaryManager.getPid(),
      activeStreams: this.streams.size,
      lastError: this.lastError ?? undefined,
    };
  }

  /**
   * Get the API port
   */
  public getApiPort(): number {
    return this.binaryManager.getApiPort();
  }

  /**
   * Get the API URL
   */
  public getApiUrl(): string {
    return this.binaryManager.getApiUrl();
  }

  /**
   * Shutdown the service
   */
  public async shutdown(): Promise<void> {
    console.log('[Go2rtcService] Shutting down...');

    // Clear all streams
    this.streams.clear();

    // Stop go2rtc process
    await this.binaryManager.stop();

    this.initialized = false;
    this.emit('service-stopped');

    console.log('[Go2rtcService] Shutdown complete');
  }
}

/**
 * Get the singleton Go2rtcService instance
 */
export function getGo2rtcService(): Go2rtcService {
  return Go2rtcService.getInstance();
}
