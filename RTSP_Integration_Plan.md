# RTSP Camera Support Integration Plan

## Executive Summary

This document outlines a comprehensive plan to add RTSP camera support to FlashForgeUI-Electron while maintaining full backward compatibility with existing MJPEG camera functionality. The integration will support both desktop and web clients through a hybrid proxy architecture.

## Current Architecture Analysis

### Existing Camera System Strengths
- **Robust Proxy Service**: CameraProxyService provides single upstream, multiple downstream architecture
- **Protocol Support**: URL validation already supports `rtsp://` protocol
- **Multi-client Distribution**: Efficient stream distribution to desktop and web clients
- **Automatic Reconnection**: Exponential backoff retry mechanism
- **Configuration Priority**: Custom camera → Built-in camera → No camera resolution
- **WebUI Integration**: Token-based authentication and real-time status updates

### Current Limitations for RTSP
- **HTTP-only Streaming**: Proxy service designed for HTTP/MJPEG streams
- **Image Element Constraints**: WebUI uses `<img>` tags unsuitable for RTSP
- **Single Protocol Support**: No stream type detection or multi-protocol handling
- **Missing RTSP Endpoints**: No RTSP-specific API endpoints or controls

## Technical Requirements

### Core Requirements
1. **Backward Compatibility**: Zero breaking changes to existing MJPEG functionality
2. **Dual Protocol Support**: Seamless handling of both MJPEG and RTSP streams
3. **Cross-Platform Compatibility**: Support for desktop (Electron) and web clients
4. **Automatic Detection**: URL-based automatic protocol selection
5. **Performance Optimization**: Minimal overhead for existing functionality

### Integration Requirements
1. **Library Integration**: Modern, maintained RTSP client library
2. **Stream Conversion**: RTSP to web-compatible format (WebSocket/WebRTC)
3. **Authentication Support**: RTSP credential management and forwarding
4. **Error Handling**: Robust fallback and retry mechanisms
5. **Resource Management**: Efficient handling of multiple concurrent streams

## Architecture Design

### Hybrid Proxy Architecture

```
┌─────────────────┐    ┌─────────────────────────────────────┐    ┌─────────────────┐
│   MJPEG Camera  │───►│         CameraProxyService          │───►│  Desktop/Web    │
│                 │    │                                     │    │    Clients      │
└─────────────────┘    │  ┌─────────────┐ ┌─────────────┐   │    └─────────────────┘
                       │  │   MJPEG     │ │    RTSP     │   │
┌─────────────────┐    │  │   Handler   │ │   Handler   │   │
│   RTSP Camera   │───►│  │             │ │             │   │
│                 │    │  └─────────────┘ └─────────────┘   │
└─────────────────┘    └─────────────────────────────────────┘
```

### Protocol Detection Flow

```
Camera URL Input
       │
       ▼
┌──────────────────┐     ┌─────────────────┐
│ URL.startsWith   │────►│ RTSP Handler    │
│ ('rtsp://')      │     │ - WebSocket     │
│                  │     │ - JS-MPEG       │
└──────────────────┘     │ - rtsp-relay    │
       │                 └─────────────────┘
       ▼
┌──────────────────┐     ┌─────────────────┐
│ HTTP/HTTPS URL   │────►│ MJPEG Handler   │
│                  │     │ - Direct Pipe   │
│                  │     │ - <img> tag     │
└──────────────────┘     │ - HTTP Proxy    │
                         └─────────────────┘
```

## Implementation Plan

### Phase 1: Foundation and Library Integration

#### 1.1 Dependency Installation
- **Primary Library**: `rtsp-relay` - Express.js integrated RTSP streaming
- **WebSocket Support**: `express-ws` - WebSocket middleware for Express
- **Type Definitions**: `@types/express-ws` - TypeScript support
- **Validation**: Verify library compatibility with current Node.js version

#### 1.2 Core Type System Enhancement
**File**: `src/types/camera/index.ts`

```typescript
// New stream type enumeration
export type CameraStreamType = 'mjpeg' | 'rtsp';

// Enhanced camera configuration
export interface ResolvedCameraConfig {
  sourceType: CameraSourceType;
  streamType: CameraStreamType;  // NEW
  streamUrl: string | null;
  isAvailable: boolean;
  unavailableReason?: string;
  rtspConfig?: RtspStreamConfig;  // NEW
}

// RTSP-specific configuration
export interface RtspStreamConfig {
  requiresAuthentication: boolean;
  credentials?: {
    username: string;
    password: string;
  };
  streamFormat: 'h264' | 'h265' | 'mjpeg';
  transport: 'tcp' | 'udp';
}

// Proxy status enhancement
export interface CameraProxyStatus {
  isRunning: boolean;
  port: number;
  proxyUrl: string;
  isStreaming: boolean;
  sourceUrl: string | null;
  streamType: CameraStreamType;  // NEW
  clientCount: number;
  clients: CameraProxyClient[];
  lastError: string | null;
  stats: CameraProxyStats;
  rtspStatus?: RtspStreamStatus;  // NEW
}

// RTSP stream status
export interface RtspStreamStatus {
  isConnected: boolean;
  streamFormat: string;
  resolution?: string;
  bitrate?: number;
  transport: 'tcp' | 'udp';
}
```

#### 1.3 Stream Type Detection Utility
**File**: `src/utils/stream-detection.ts`

```typescript
/**
 * Stream type detection and configuration utilities
 *
 * Provides protocol detection, stream format analysis, and configuration
 * generation for different camera stream types.
 */

export function detectStreamType(url: string): CameraStreamType {
  if (!url) return 'mjpeg';

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'rtsp:' ? 'rtsp' : 'mjpeg';
  } catch {
    return 'mjpeg';
  }
}

export function generateStreamConfig(url: string, userConfig?: Partial<RtspStreamConfig>): ResolvedCameraConfig {
  const streamType = detectStreamType(url);

  if (streamType === 'rtsp') {
    return {
      sourceType: 'custom',
      streamType: 'rtsp',
      streamUrl: url,
      isAvailable: true,
      rtspConfig: {
        requiresAuthentication: url.includes('@'),
        streamFormat: 'h264', // Default
        transport: 'tcp',     // Default
        ...userConfig
      }
    };
  }

  // MJPEG configuration (existing logic)
  return {
    sourceType: 'custom',
    streamType: 'mjpeg',
    streamUrl: url,
    isAvailable: true
  };
}
```

### Phase 2: RTSP Stream Handler Implementation

#### 2.1 RTSP Stream Handler Service
**File**: `src/services/RtspStreamHandler.ts`

```typescript
/**
 * RTSP Stream Handler
 *
 * Manages RTSP stream connections and conversion to web-compatible formats
 * using rtsp-relay library. Provides WebSocket-based streaming for browser
 * compatibility with automatic reconnection and error handling.
 */

import { EventEmitter } from 'events';
import express from 'express';
import { RtspStreamConfig, RtspStreamStatus } from '../types/camera';

export class RtspStreamHandler extends EventEmitter {
  private app: express.Application;
  private activeStreams = new Map<string, any>(); // rtsp-relay proxy instances
  private streamConfigs = new Map<string, RtspStreamConfig>();

  constructor(app: express.Application) {
    super();
    this.app = app;
  }

  public async setupRtspStream(streamId: string, rtspUrl: string, config: RtspStreamConfig): Promise<void> {
    try {
      // Dynamic import of rtsp-relay (ES module)
      const rtspRelay = await import('rtsp-relay');
      const { proxy } = rtspRelay.default(this.app);

      const handler = proxy({
        url: rtspUrl,
        verbose: false,
        transport: config.transport,
        ...(config.credentials && {
          username: config.credentials.username,
          password: config.credentials.password
        })
      });

      // Create WebSocket endpoint for this stream
      const wsPath = `/camera/rtsp/${streamId}`;
      this.app.ws(wsPath, handler);

      this.activeStreams.set(streamId, handler);
      this.streamConfigs.set(streamId, config);

      this.emit('stream-started', { streamId, wsPath });

    } catch (error) {
      this.emit('stream-error', { streamId, error: error.message });
      throw error;
    }
  }

  public stopRtspStream(streamId: string): void {
    const handler = this.activeStreams.get(streamId);
    if (handler) {
      // Cleanup WebSocket endpoint
      this.activeStreams.delete(streamId);
      this.streamConfigs.delete(streamId);
      this.emit('stream-stopped', { streamId });
    }
  }

  public getStreamStatus(streamId: string): RtspStreamStatus | null {
    const config = this.streamConfigs.get(streamId);
    if (!config) return null;

    return {
      isConnected: this.activeStreams.has(streamId),
      streamFormat: config.streamFormat,
      transport: config.transport
    };
  }

  public listActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys());
  }
}
```

#### 2.2 Enhanced Camera Proxy Service
**File**: `src/services/CameraProxyService.ts` (modifications)

```typescript
// Add imports
import { RtspStreamHandler } from './RtspStreamHandler';
import { detectStreamType, generateStreamConfig } from '../utils/stream-detection';

export class CameraProxyService extends EventEmitter implements ICameraProxyService {
  // Add new properties
  private rtspHandler: RtspStreamHandler | null = null;
  private currentStreamType: CameraStreamType = 'mjpeg';
  private currentStreamId: string | null = null;

  // Modify initialization
  public async initialize(config: CameraProxyConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    this.currentPort = this.config.port;

    if (this.config.autoStart) {
      await this.start();
    }

    // Initialize RTSP handler
    if (this.app) {
      this.rtspHandler = new RtspStreamHandler(this.app);
      this.setupRtspEventHandlers();
    }
  }

  // Enhanced setStreamUrl method
  public setStreamUrl(url: string | null): void {
    if (url === this.streamUrl) return;

    console.log(`Setting camera stream URL: ${url || 'null'}`);

    // Stop current stream if switching types
    if (this.streamUrl && url) {
      const oldType = detectStreamType(this.streamUrl);
      const newType = detectStreamType(url);

      if (oldType !== newType) {
        this.stopCurrentStream();
      }
    }

    this.streamUrl = url;
    this.currentStreamType = url ? detectStreamType(url) : 'mjpeg';

    // Restart streaming if clients are connected
    if (this.activeClients.size > 0 && url) {
      this.startStreamingByType();
    }
  }

  // New method for type-specific streaming
  private startStreamingByType(): void {
    if (this.currentStreamType === 'rtsp') {
      this.startRtspStreaming();
    } else {
      this.startStreaming(); // Existing MJPEG method
    }
  }

  // New RTSP streaming method
  private async startRtspStreaming(): Promise<void> {
    if (!this.streamUrl || !this.rtspHandler) {
      console.log('Cannot start RTSP stream: Missing URL or handler');
      return;
    }

    try {
      this.currentStreamId = `stream-${Date.now()}`;
      const streamConfig = generateStreamConfig(this.streamUrl);

      await this.rtspHandler.setupRtspStream(
        this.currentStreamId,
        this.streamUrl,
        streamConfig.rtspConfig!
      );

      this.isStreaming = true;
      this.emitEvent('rtsp-stream-started', {
        streamId: this.currentStreamId,
        wsPath: `/camera/rtsp/${this.currentStreamId}`
      });

    } catch (error) {
      console.error('Failed to start RTSP stream:', error);
      this.lastError = error.message;
      this.emitEvent('stream-error', null, error.message);
    }
  }

  // Enhanced status method
  public getStatus(): CameraProxyStatus {
    const baseStatus = {
      isRunning: this.server !== null,
      port: this.currentPort,
      proxyUrl: `http://localhost:${this.currentPort}/camera`,
      isStreaming: this.isStreaming,
      sourceUrl: this.streamUrl,
      streamType: this.currentStreamType,
      clientCount: this.activeClients.size,
      clients: Array.from(this.activeClients.values()).map(({ client }) => client),
      lastError: this.lastError,
      stats: { ...this.stats }
    };

    // Add RTSP status if applicable
    if (this.currentStreamType === 'rtsp' && this.currentStreamId && this.rtspHandler) {
      return {
        ...baseStatus,
        rtspStatus: this.rtspHandler.getStreamStatus(this.currentStreamId)
      };
    }

    return baseStatus;
  }

  private setupRtspEventHandlers(): void {
    if (!this.rtspHandler) return;

    this.rtspHandler.on('stream-started', (data) => {
      this.emitEvent('rtsp-stream-started', data);
    });

    this.rtspHandler.on('stream-error', (data) => {
      this.lastError = data.error;
      this.emitEvent('stream-error', null, data.error);
    });

    this.rtspHandler.on('stream-stopped', (data) => {
      this.emitEvent('rtsp-stream-stopped', data);
    });
  }

  private stopCurrentStream(): void {
    if (this.currentStreamType === 'rtsp' && this.currentStreamId && this.rtspHandler) {
      this.rtspHandler.stopRtspStream(this.currentStreamId);
      this.currentStreamId = null;
    } else {
      this.stopStreaming(); // Existing MJPEG method
    }
  }
}
```

### Phase 3: Desktop Client Integration

#### 3.1 Enhanced Camera Preview Component
**File**: `src/ui/components/camera-preview/camera-preview.ts` (modifications)

```typescript
// Add new imports and types
import { CameraStreamType } from '../../../types/camera';

export class CameraPreview {
  // Add new properties
  private videoElement: HTMLVideoElement | null = null;
  private wsConnection: WebSocket | null = null;
  private currentStreamType: CameraStreamType = 'mjpeg';

  // Enhanced render method
  private updateTemplate(): void {
    this.templateHTML = `
      <div class="camera-preview-container">
        <div class="camera-header">
          <span class="camera-status">${this.getCameraStatusText()}</span>
          <button class="camera-toggle ${this.isEnabled ? 'enabled' : 'disabled'}">
            ${this.isEnabled ? 'Preview On' : 'Preview Off'}
          </button>
        </div>

        <div class="camera-content">
          <!-- MJPEG Stream -->
          <img class="camera-stream mjpeg-stream ${this.currentStreamType === 'mjpeg' ? 'active' : 'hidden'}"
               alt="Camera stream" />

          <!-- RTSP Stream -->
          <video class="camera-stream rtsp-stream ${this.currentStreamType === 'rtsp' ? 'active' : 'hidden'}"
                 autoplay muted playsinline>
            Your browser doesn't support video streaming.
          </video>

          <!-- No Camera Placeholder -->
          <div class="no-camera ${this.cameraStatus === 'no-camera' ? 'active' : 'hidden'}">
            Camera Unavailable
          </div>

          <!-- Loading State -->
          <div class="camera-loading ${this.cameraStatus === 'loading' ? 'active' : 'hidden'}">
            <div class="spinner"></div>
            <span>Connecting to camera...</span>
          </div>
        </div>

        <div class="job-info-overlay ${this.showJobInfo ? 'visible' : 'hidden'}">
          ${this.renderJobInfo()}
        </div>
      </div>
    `;
  }

  // Enhanced stream setup
  private async setupCameraStream(): Promise<void> {
    try {
      // Get camera configuration
      const cameraConfig = await this.getCameraConfig();

      if (!cameraConfig || !cameraConfig.isAvailable) {
        this.setCameraStatus('no-camera');
        return;
      }

      this.currentStreamType = cameraConfig.streamType;
      this.setCameraStatus('loading');

      if (this.currentStreamType === 'rtsp') {
        await this.setupRtspStream(cameraConfig);
      } else {
        await this.setupMjpegStream(cameraConfig);
      }

    } catch (error) {
      console.error('Failed to setup camera stream:', error);
      this.setCameraStatus('error');
    }
  }

  // New RTSP stream setup
  private async setupRtspStream(config: ResolvedCameraConfig): Promise<void> {
    const proxyStatus = await window.electronAPI.camera.getStatus();

    if (!proxyStatus.rtspStatus || !proxyStatus.rtspStatus.isConnected) {
      throw new Error('RTSP stream not available');
    }

    // Connect to WebSocket stream
    const wsUrl = `ws://localhost:${proxyStatus.port}/camera/rtsp/${config.streamId}`;
    this.wsConnection = new WebSocket(wsUrl);

    this.wsConnection.onopen = () => {
      console.log('RTSP WebSocket connected');
      this.setCameraStatus('streaming');
    };

    this.wsConnection.onmessage = (event) => {
      // Handle video stream data
      this.handleRtspStreamData(event.data);
    };

    this.wsConnection.onerror = (error) => {
      console.error('RTSP WebSocket error:', error);
      this.setCameraStatus('error');
    };

    this.wsConnection.onclose = () => {
      console.log('RTSP WebSocket disconnected');
      if (this.cameraStatus === 'streaming') {
        this.setCameraStatus('error');
        this.scheduleRetry();
      }
    };
  }

  // Handle RTSP stream data
  private handleRtspStreamData(data: ArrayBuffer): void {
    if (!this.videoElement) {
      this.videoElement = this.container.querySelector('.rtsp-stream');
    }

    if (this.videoElement) {
      // Convert ArrayBuffer to Blob and create object URL
      const blob = new Blob([data], { type: 'video/mp4' });
      const videoUrl = URL.createObjectURL(blob);

      // Update video source
      this.videoElement.src = videoUrl;

      // Cleanup old object URLs to prevent memory leaks
      this.videoElement.addEventListener('loadstart', () => {
        URL.revokeObjectURL(videoUrl);
      }, { once: true });
    }
  }

  // Enhanced cleanup
  private cleanup(): void {
    // Close WebSocket connection
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }

    // Cleanup video element
    if (this.videoElement) {
      this.videoElement.src = '';
      this.videoElement = null;
    }

    // Existing MJPEG cleanup
    this.stopMjpegStream();
  }
}
```

#### 3.2 Enhanced Camera IPC Handler
**File**: `src/ipc-handlers/camera-ipc-handler.ts` (modifications)

```typescript
// Add new IPC methods
ipcMain.handle('camera:get-stream-type', async (): Promise<CameraStreamType | null> => {
  const status = cameraProxyService.getStatus();
  return status.streamType;
});

ipcMain.handle('camera:get-stream-info', async (): Promise<any> => {
  const status = cameraProxyService.getStatus();

  if (status.streamType === 'rtsp' && status.rtspStatus) {
    return {
      type: 'rtsp',
      wsPath: `/camera/rtsp/${status.rtspStatus.streamId}`,
      format: status.rtspStatus.streamFormat,
      transport: status.rtspStatus.transport
    };
  }

  return {
    type: 'mjpeg',
    proxyUrl: status.proxyUrl
  };
});

ipcMain.handle('camera:restart-stream', async (): Promise<void> => {
  // Force restart current stream (useful for RTSP reconnection)
  const status = cameraProxyService.getStatus();
  if (status.sourceUrl) {
    cameraProxyService.setStreamUrl(null);
    await new Promise(resolve => setTimeout(resolve, 100));
    cameraProxyService.setStreamUrl(status.sourceUrl);
  }
});
```

### Phase 4: WebUI Integration

#### 4.1 Enhanced WebUI API Endpoints
**File**: `src/webui/routes/camera.ts` (new file)

```typescript
/**
 * Camera API routes for WebUI
 *
 * Provides comprehensive camera management endpoints including stream type
 * detection, RTSP configuration, and real-time status monitoring.
 */

import { Router } from 'express';
import { cameraProxyService } from '../../services/CameraProxyService';
import { detectStreamType } from '../../utils/stream-detection';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Apply authentication to all camera routes
router.use(requireAuth);

// Get comprehensive camera status
router.get('/status', (req, res) => {
  const status = cameraProxyService.getStatus();
  res.json({
    success: true,
    data: status
  });
});

// Get camera proxy configuration
router.get('/proxy-config', (req, res) => {
  const status = cameraProxyService.getStatus();
  res.json({
    success: true,
    data: {
      port: status.port,
      proxyUrl: status.proxyUrl,
      streamType: status.streamType,
      isStreaming: status.isStreaming
    }
  });
});

// Get stream type for current camera
router.get('/stream-type', (req, res) => {
  const status = cameraProxyService.getStatus();
  res.json({
    success: true,
    data: {
      streamType: status.streamType,
      sourceUrl: status.sourceUrl
    }
  });
});

// Get RTSP stream information
router.get('/rtsp/info', (req, res) => {
  const status = cameraProxyService.getStatus();

  if (status.streamType !== 'rtsp') {
    return res.status(400).json({
      success: false,
      error: 'Current stream is not RTSP'
    });
  }

  res.json({
    success: true,
    data: {
      wsPath: `/camera/rtsp/${status.rtspStatus?.streamId || 'unknown'}`,
      streamFormat: status.rtspStatus?.streamFormat,
      transport: status.rtspStatus?.transport,
      isConnected: status.rtspStatus?.isConnected || false
    }
  });
});

// Restart current stream (force reconnection)
router.post('/restart', async (req, res) => {
  try {
    const status = cameraProxyService.getStatus();

    if (!status.sourceUrl) {
      return res.status(400).json({
        success: false,
        error: 'No active stream to restart'
      });
    }

    // Force restart by clearing and resetting URL
    cameraProxyService.setStreamUrl(null);
    await new Promise(resolve => setTimeout(resolve, 100));
    cameraProxyService.setStreamUrl(status.sourceUrl);

    res.json({
      success: true,
      message: 'Stream restart initiated'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get supported stream types
router.get('/supported-types', (req, res) => {
  res.json({
    success: true,
    data: {
      supported: ['mjpeg', 'rtsp'],
      default: 'mjpeg'
    }
  });
});

export default router;
```

#### 4.2 Enhanced WebUI Frontend
**File**: `src/webui/static/app.ts` (modifications)

```typescript
// Add new interfaces and types
interface CameraStreamInfo {
  type: 'mjpeg' | 'rtsp';
  proxyUrl?: string;
  wsPath?: string;
  format?: string;
  transport?: string;
}

interface CameraManager {
  currentStreamType: 'mjpeg' | 'rtsp' | null;
  imageElement: HTMLImageElement | null;
  videoElement: HTMLVideoElement | null;
  wsConnection: WebSocket | null;
  isStreaming: boolean;

  init(): void;
  setupCamera(): Promise<void>;
  setupMjpegStream(proxyUrl: string): void;
  setupRtspStream(wsPath: string): Promise<void>;
  stopCamera(): void;
  restartCamera(): Promise<void>;
}

// Enhanced camera manager implementation
const cameraManager: CameraManager = {
  currentStreamType: null,
  imageElement: null,
  videoElement: null,
  wsConnection: null,
  isStreaming: false,

  init() {
    this.imageElement = document.getElementById('camera-stream') as HTMLImageElement;
    this.videoElement = document.getElementById('camera-video') as HTMLVideoElement;

    // Initially hide both elements
    if (this.imageElement) this.imageElement.style.display = 'none';
    if (this.videoElement) this.videoElement.style.display = 'none';
  },

  async setupCamera() {
    try {
      // Get stream type first
      const streamTypeResponse = await authenticatedFetch('/api/camera/stream-type');
      const streamTypeData = await streamTypeResponse.json();

      if (!streamTypeData.success || !streamTypeData.data.sourceUrl) {
        this.showCameraPlaceholder('Camera not configured');
        return;
      }

      this.currentStreamType = streamTypeData.data.streamType;

      if (this.currentStreamType === 'rtsp') {
        await this.setupRtspStream();
      } else {
        await this.setupMjpegStream();
      }

    } catch (error) {
      console.error('Failed to setup camera:', error);
      this.showCameraPlaceholder('Camera connection failed');
    }
  },

  async setupMjpegStream() {
    try {
      const response = await authenticatedFetch('/api/camera/proxy-config');
      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to get camera proxy config');
      }

      const timestamp = Date.now();
      const streamUrl = `${data.data.proxyUrl}?t=${timestamp}`;

      if (this.imageElement) {
        this.imageElement.onload = () => {
          this.showImageStream();
          this.isStreaming = true;
        };

        this.imageElement.onerror = () => {
          console.error('MJPEG stream failed to load');
          this.showCameraPlaceholder('MJPEG stream unavailable');
          // Retry after delay
          setTimeout(() => this.setupCamera(), 5000);
        };

        this.imageElement.src = streamUrl;
      }

    } catch (error) {
      console.error('MJPEG setup failed:', error);
      this.showCameraPlaceholder('MJPEG stream failed');
    }
  },

  async setupRtspStream() {
    try {
      const response = await authenticatedFetch('/api/camera/rtsp/info');
      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to get RTSP stream info');
      }

      const wsUrl = `ws://${window.location.hostname}:${window.location.port}${data.data.wsPath}`;

      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.onopen = () => {
        console.log('RTSP WebSocket connected');
        this.showVideoStream();
        this.isStreaming = true;
      };

      this.wsConnection.onmessage = (event) => {
        this.handleRtspData(event.data);
      };

      this.wsConnection.onerror = (error) => {
        console.error('RTSP WebSocket error:', error);
        this.showCameraPlaceholder('RTSP stream error');
      };

      this.wsConnection.onclose = () => {
        console.log('RTSP WebSocket disconnected');
        this.isStreaming = false;
        this.showCameraPlaceholder('RTSP stream disconnected');
        // Retry after delay
        setTimeout(() => this.setupCamera(), 5000);
      };

    } catch (error) {
      console.error('RTSP setup failed:', error);
      this.showCameraPlaceholder('RTSP stream failed');
    }
  },

  handleRtspData(data: ArrayBuffer) {
    if (this.videoElement && data.byteLength > 0) {
      // Convert ArrayBuffer to Blob for video element
      const blob = new Blob([data], { type: 'video/mp4' });
      const videoUrl = URL.createObjectURL(blob);

      // Update video source
      this.videoElement.src = videoUrl;

      // Cleanup old URLs to prevent memory leaks
      this.videoElement.addEventListener('loadstart', () => {
        URL.revokeObjectURL(videoUrl);
      }, { once: true });
    }
  },

  showImageStream() {
    if (this.imageElement) {
      this.imageElement.style.display = 'block';
    }
    if (this.videoElement) {
      this.videoElement.style.display = 'none';
    }
    this.hideCameraPlaceholder();
  },

  showVideoStream() {
    if (this.videoElement) {
      this.videoElement.style.display = 'block';
    }
    if (this.imageElement) {
      this.imageElement.style.display = 'none';
    }
    this.hideCameraPlaceholder();
  },

  showCameraPlaceholder(message: string) {
    const placeholder = document.getElementById('camera-placeholder');
    if (placeholder) {
      placeholder.textContent = message;
      placeholder.style.display = 'block';
    }

    if (this.imageElement) this.imageElement.style.display = 'none';
    if (this.videoElement) this.videoElement.style.display = 'none';
  },

  hideCameraPlaceholder() {
    const placeholder = document.getElementById('camera-placeholder');
    if (placeholder) {
      placeholder.style.display = 'none';
    }
  },

  stopCamera() {
    this.isStreaming = false;

    // Stop WebSocket connection
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }

    // Clear image source
    if (this.imageElement) {
      this.imageElement.src = '';
    }

    // Clear video source
    if (this.videoElement) {
      this.videoElement.src = '';
    }

    this.showCameraPlaceholder('Camera stopped');
  },

  async restartCamera() {
    this.stopCamera();

    try {
      // Request server-side restart
      const response = await authenticatedFetch('/api/camera/restart', {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        // Wait a moment then restart
        setTimeout(() => this.setupCamera(), 1000);
      } else {
        this.showCameraPlaceholder('Restart failed');
      }
    } catch (error) {
      console.error('Failed to restart camera:', error);
      this.showCameraPlaceholder('Restart failed');
    }
  }
};

// Enhanced HTML template
const enhancedCameraHTML = `
  <div class="camera-view">
    <!-- Camera placeholder -->
    <div id="camera-placeholder" class="no-camera">
      Camera Unavailable
    </div>

    <!-- MJPEG stream -->
    <img id="camera-stream" class="camera-stream"
         alt="Printer camera stream"
         style="display: none;">

    <!-- RTSP stream -->
    <video id="camera-video" class="camera-stream"
           autoplay muted playsinline
           style="display: none;">
      Your browser doesn't support video streaming.
    </video>

    <!-- Camera controls -->
    <div class="camera-controls">
      <button id="restart-camera" class="btn-secondary">
        Restart Camera
      </button>
    </div>
  </div>
`;

// Update initialization
document.addEventListener('DOMContentLoaded', () => {
  // Update camera view HTML
  const cameraView = document.querySelector('.camera-view');
  if (cameraView) {
    cameraView.innerHTML = enhancedCameraHTML;
  }

  // Initialize camera manager
  cameraManager.init();

  // Setup restart button
  const restartButton = document.getElementById('restart-camera');
  if (restartButton) {
    restartButton.addEventListener('click', () => {
      cameraManager.restartCamera();
    });
  }

  // Start camera when printer is connected
  if (printerData.isConnected) {
    cameraManager.setupCamera();
  }
});

// Update printer connection handling
function handlePrinterConnection(isConnected: boolean) {
  if (isConnected) {
    cameraManager.setupCamera();
  } else {
    cameraManager.stopCamera();
  }
}
```

### Phase 5: Configuration and User Experience

#### 5.1 Enhanced Settings Dialog
**File**: `src/ui/dialogs/settings/settings.ts` (modifications)

```typescript
// Add RTSP-specific settings
const rtspSettingsHTML = `
  <div class="setting-group camera-settings">
    <h3>Camera Configuration</h3>

    <div class="setting-item">
      <label class="setting-label">
        <input type="checkbox" id="custom-camera-enabled">
        Enable Custom Camera
      </label>
      <span class="setting-description">
        Override printer's built-in camera with custom URL
      </span>
    </div>

    <div class="setting-item" id="custom-camera-url-setting">
      <label class="setting-label">Custom Camera URL:</label>
      <input type="text" id="custom-camera-url" placeholder="http://192.168.1.100:8080/stream or rtsp://192.168.1.100:554/stream">
      <span class="setting-description">
        Supports HTTP/HTTPS (MJPEG) and RTSP protocols
      </span>
    </div>

    <div class="setting-group rtsp-advanced" id="rtsp-advanced-settings">
      <h4>RTSP Advanced Settings</h4>

      <div class="setting-item">
        <label class="setting-label">Transport Protocol:</label>
        <select id="rtsp-transport">
          <option value="tcp">TCP (Recommended)</option>
          <option value="udp">UDP</option>
        </select>
      </div>

      <div class="setting-item">
        <label class="setting-label">Stream Format:</label>
        <select id="rtsp-format">
          <option value="h264">H.264 (Default)</option>
          <option value="h265">H.265/HEVC</option>
          <option value="mjpeg">MJPEG</option>
        </select>
      </div>

      <div class="setting-item">
        <label class="setting-label">
          <input type="checkbox" id="rtsp-auth-enabled">
          Requires Authentication
        </label>
      </div>

      <div class="setting-group rtsp-auth" id="rtsp-auth-settings">
        <div class="setting-item">
          <label class="setting-label">Username:</label>
          <input type="text" id="rtsp-username" placeholder="Username">
        </div>

        <div class="setting-item">
          <label class="setting-label">Password:</label>
          <input type="password" id="rtsp-password" placeholder="Password">
        </div>
      </div>
    </div>

    <div class="setting-item">
      <button id="test-camera-connection" class="btn-primary">
        Test Camera Connection
      </button>
      <span id="camera-test-result" class="test-result"></span>
    </div>
  </div>
`;

// Enhanced settings logic
class SettingsDialog {
  private setupCameraSettings(): void {
    const customCameraEnabled = document.getElementById('custom-camera-enabled') as HTMLInputElement;
    const customCameraUrl = document.getElementById('custom-camera-url') as HTMLInputElement;
    const rtspAdvanced = document.getElementById('rtsp-advanced-settings');
    const rtspAuth = document.getElementById('rtsp-auth-settings');
    const testButton = document.getElementById('test-camera-connection');

    // Show/hide URL settings based on checkbox
    customCameraEnabled.addEventListener('change', () => {
      const urlSetting = document.getElementById('custom-camera-url-setting');
      if (urlSetting) {
        urlSetting.style.display = customCameraEnabled.checked ? 'block' : 'none';
      }
    });

    // Show/hide RTSP advanced settings based on URL
    customCameraUrl.addEventListener('input', () => {
      const isRtsp = customCameraUrl.value.startsWith('rtsp://');
      if (rtspAdvanced) {
        rtspAdvanced.style.display = isRtsp ? 'block' : 'none';
      }
    });

    // Show/hide RTSP auth settings
    const rtspAuthEnabled = document.getElementById('rtsp-auth-enabled') as HTMLInputElement;
    rtspAuthEnabled?.addEventListener('change', () => {
      if (rtspAuth) {
        rtspAuth.style.display = rtspAuthEnabled.checked ? 'block' : 'none';
      }
    });

    // Test camera connection
    testButton?.addEventListener('click', async () => {
      await this.testCameraConnection();
    });
  }

  private async testCameraConnection(): Promise<void> {
    const resultElement = document.getElementById('camera-test-result');
    if (!resultElement) return;

    const customCameraUrl = (document.getElementById('custom-camera-url') as HTMLInputElement).value;

    if (!customCameraUrl) {
      resultElement.textContent = 'Please enter a camera URL';
      resultElement.className = 'test-result error';
      return;
    }

    resultElement.textContent = 'Testing connection...';
    resultElement.className = 'test-result testing';

    try {
      // Validate URL format
      const validation = await window.electronAPI.camera.validateUrl(customCameraUrl);

      if (!validation.isValid) {
        resultElement.textContent = `Invalid URL: ${validation.error}`;
        resultElement.className = 'test-result error';
        return;
      }

      // Test actual connection
      const testResult = await window.electronAPI.camera.testConnection(customCameraUrl);

      if (testResult.success) {
        resultElement.textContent = `✓ Connection successful (${testResult.streamType})`;
        resultElement.className = 'test-result success';
      } else {
        resultElement.textContent = `✗ Connection failed: ${testResult.error}`;
        resultElement.className = 'test-result error';
      }

    } catch (error) {
      resultElement.textContent = `✗ Test failed: ${error.message}`;
      resultElement.className = 'test-result error';
    }
  }
}
```

#### 5.2 Enhanced CSS Styles
**File**: `src/ui/dialogs/settings/settings.css` (additions)

```css
/* RTSP-specific setting styles */
.rtsp-advanced {
  margin-left: 20px;
  border-left: 2px solid var(--accent-color);
  padding-left: 15px;
  margin-top: 10px;
}

.rtsp-auth {
  margin-left: 20px;
  border-left: 2px solid #666;
  padding-left: 15px;
  margin-top: 10px;
}

.camera-settings .setting-description {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
  display: block;
}

.test-result {
  margin-left: 10px;
  font-weight: bold;
}

.test-result.success {
  color: #4CAF50;
}

.test-result.error {
  color: #f44336;
}

.test-result.testing {
  color: #ff9800;
}

#test-camera-connection {
  min-width: 150px;
}

/* WebUI camera controls */
.camera-controls {
  position: absolute;
  bottom: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
}

.camera-controls button {
  padding: 6px 12px;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid #555;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.camera-controls button:hover {
  background: rgba(0, 0, 0, 0.9);
}

/* Video element styling */
.camera-stream.rtsp-stream {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 4px;
  background: #000;
}

/* Hide controls for autoplay */
.camera-stream.rtsp-stream::-webkit-media-controls {
  display: none !important;
}
```

### Phase 6: Testing and Validation

#### 6.1 Automated Testing Framework
**File**: `src/services/__tests__/rtsp-integration.test.ts` (new file)

```typescript
/**
 * RTSP Integration Test Suite
 *
 * Comprehensive tests for RTSP camera support including stream detection,
 * proxy service integration, and client compatibility.
 */

import { CameraProxyService } from '../CameraProxyService';
import { RtspStreamHandler } from '../RtspStreamHandler';
import { detectStreamType, generateStreamConfig } from '../../utils/stream-detection';

describe('RTSP Integration Tests', () => {
  let cameraProxy: CameraProxyService;
  let mockApp: any;

  beforeEach(() => {
    cameraProxy = new CameraProxyService();
    mockApp = {
      ws: jest.fn(),
      get: jest.fn(),
      use: jest.fn()
    };
  });

  afterEach(async () => {
    await cameraProxy.shutdown();
  });

  describe('Stream Type Detection', () => {
    test('should detect RTSP URLs correctly', () => {
      expect(detectStreamType('rtsp://192.168.1.100:554/stream')).toBe('rtsp');
      expect(detectStreamType('rtsp://user:pass@camera.local/stream')).toBe('rtsp');
    });

    test('should detect MJPEG URLs correctly', () => {
      expect(detectStreamType('http://192.168.1.100:8080/stream')).toBe('mjpeg');
      expect(detectStreamType('https://camera.local/mjpeg')).toBe('mjpeg');
    });

    test('should default to MJPEG for invalid URLs', () => {
      expect(detectStreamType('')).toBe('mjpeg');
      expect(detectStreamType('invalid-url')).toBe('mjpeg');
    });
  });

  describe('Stream Configuration Generation', () => {
    test('should generate RTSP configuration', () => {
      const config = generateStreamConfig('rtsp://192.168.1.100:554/stream');

      expect(config.streamType).toBe('rtsp');
      expect(config.isAvailable).toBe(true);
      expect(config.rtspConfig).toBeDefined();
      expect(config.rtspConfig?.streamFormat).toBe('h264');
      expect(config.rtspConfig?.transport).toBe('tcp');
    });

    test('should detect authentication requirements', () => {
      const config = generateStreamConfig('rtsp://user:pass@192.168.1.100:554/stream');

      expect(config.rtspConfig?.requiresAuthentication).toBe(true);
    });
  });

  describe('RTSP Stream Handler', () => {
    test('should initialize RTSP handler', () => {
      const handler = new RtspStreamHandler(mockApp);
      expect(handler).toBeDefined();
      expect(handler.listActiveStreams()).toEqual([]);
    });

    test('should setup RTSP stream endpoint', async () => {
      const handler = new RtspStreamHandler(mockApp);

      // Mock rtsp-relay module
      jest.doMock('rtsp-relay', () => ({
        default: () => ({
          proxy: jest.fn(() => jest.fn())
        })
      }));

      await handler.setupRtspStream('test-stream', 'rtsp://test.local/stream', {
        requiresAuthentication: false,
        streamFormat: 'h264',
        transport: 'tcp'
      });

      expect(mockApp.ws).toHaveBeenCalledWith('/camera/rtsp/test-stream', expect.any(Function));
    });
  });

  describe('Camera Proxy Integration', () => {
    test('should handle RTSP URL setting', async () => {
      await cameraProxy.initialize({
        port: 8181,
        fallbackPort: 8182,
        autoStart: false
      });

      const rtspUrl = 'rtsp://192.168.1.100:554/stream';
      cameraProxy.setStreamUrl(rtspUrl);

      const status = cameraProxy.getStatus();
      expect(status.sourceUrl).toBe(rtspUrl);
      expect(status.streamType).toBe('rtsp');
    });

    test('should switch between MJPEG and RTSP', async () => {
      await cameraProxy.initialize({
        port: 8181,
        fallbackPort: 8182,
        autoStart: false
      });

      // Start with MJPEG
      cameraProxy.setStreamUrl('http://192.168.1.100:8080/stream');
      expect(cameraProxy.getStatus().streamType).toBe('mjpeg');

      // Switch to RTSP
      cameraProxy.setStreamUrl('rtsp://192.168.1.100:554/stream');
      expect(cameraProxy.getStatus().streamType).toBe('rtsp');
    });
  });
});
```

#### 6.2 Manual Testing Checklist
**File**: `RTSP_Testing_Checklist.md` (new file)

```markdown
# RTSP Integration Testing Checklist

## Pre-Testing Setup
- [ ] Install test RTSP camera or use public RTSP stream
- [ ] Verify network connectivity to RTSP source
- [ ] Backup current configuration
- [ ] Install required dependencies

## Desktop Application Testing

### Basic RTSP Support
- [ ] Configure custom camera with RTSP URL
- [ ] Verify stream type detection (RTSP vs MJPEG)
- [ ] Test camera preview component with RTSP stream
- [ ] Verify automatic reconnection on stream failure
- [ ] Test switching between MJPEG and RTSP cameras

### Authentication Testing
- [ ] Test RTSP streams requiring authentication
- [ ] Verify credential storage and security
- [ ] Test authentication failure handling
- [ ] Verify credential updates without restart

### Error Handling
- [ ] Test invalid RTSP URLs
- [ ] Test network disconnection scenarios
- [ ] Test RTSP server unavailability
- [ ] Verify error messages and user feedback
- [ ] Test graceful fallback mechanisms

## WebUI Testing

### Stream Playback
- [ ] Test RTSP stream in web browser
- [ ] Verify video element functionality
- [ ] Test WebSocket connection stability
- [ ] Verify cross-browser compatibility
- [ ] Test mobile browser support

### API Endpoints
- [ ] Test /api/camera/stream-type endpoint
- [ ] Test /api/camera/rtsp/info endpoint
- [ ] Test /api/camera/restart endpoint
- [ ] Verify authentication on all endpoints
- [ ] Test error responses and status codes

### User Interface
- [ ] Verify camera controls in WebUI
- [ ] Test stream restart functionality
- [ ] Verify status indicators
- [ ] Test responsive design with video element
- [ ] Verify camera placeholder states

## Configuration Testing

### Settings Dialog
- [ ] Test RTSP advanced settings visibility
- [ ] Test authentication settings toggle
- [ ] Test camera connection testing
- [ ] Verify configuration persistence
- [ ] Test URL validation feedback

### URL Validation
- [ ] Test various RTSP URL formats
- [ ] Test URL with authentication credentials
- [ ] Test invalid URL handling
- [ ] Test mixed protocol switching
- [ ] Verify validation error messages

## Performance Testing

### Resource Usage
- [ ] Monitor CPU usage during RTSP streaming
- [ ] Monitor memory usage with multiple clients
- [ ] Test network bandwidth utilization
- [ ] Verify stream quality consistency
- [ ] Test concurrent desktop + web clients

### Stream Quality
- [ ] Test different video resolutions
- [ ] Test various bitrates and quality settings
- [ ] Verify latency measurements
- [ ] Test stream format negotiation
- [ ] Verify color accuracy and frame rate

## Integration Testing

### Printer Integration
- [ ] Test RTSP with connected printer
- [ ] Verify printer status integration
- [ ] Test job monitoring with RTSP camera
- [ ] Test print completion notifications
- [ ] Verify camera state persistence

### Multi-Client Support
- [ ] Test multiple desktop clients
- [ ] Test multiple web clients simultaneously
- [ ] Test mixed MJPEG/RTSP client scenarios
- [ ] Verify client disconnection handling
- [ ] Test load balancing behavior

## Regression Testing

### Existing Functionality
- [ ] Verify MJPEG cameras still work
- [ ] Test built-in printer cameras
- [ ] Verify configuration migration
- [ ] Test existing API compatibility
- [ ] Verify WebUI backward compatibility

### Edge Cases
- [ ] Test empty/null URLs
- [ ] Test very long URLs
- [ ] Test special characters in URLs
- [ ] Test concurrent configuration changes
- [ ] Test rapid connection/disconnection cycles

## Security Testing

### Authentication
- [ ] Test secure credential storage
- [ ] Verify no credential logging
- [ ] Test authentication bypass attempts
- [ ] Verify HTTPS upgrade behavior
- [ ] Test token validation for WebSocket

### Network Security
- [ ] Test RTSP over VPN connections
- [ ] Verify firewall compatibility
- [ ] Test NAT/router compatibility
- [ ] Verify no credential transmission in clear
- [ ] Test SSL/TLS for WebSocket connections

## Documentation Testing

### User Documentation
- [ ] Verify setup instructions accuracy
- [ ] Test troubleshooting guides
- [ ] Verify configuration examples
- [ ] Test URL format documentation
- [ ] Verify error message documentation

### Developer Documentation
- [ ] Verify API documentation accuracy
- [ ] Test code examples
- [ ] Verify type definitions
- [ ] Test integration examples
- [ ] Verify architecture documentation
```

## Implementation Priorities

### High Priority (Core Functionality)
1. **Library Integration**: Install and integrate rtsp-relay
2. **Stream Detection**: Implement URL-based protocol detection
3. **Proxy Enhancement**: Add dual protocol support to CameraProxyService
4. **Desktop Integration**: Update camera preview component

### Medium Priority (Web Support)
1. **WebUI API**: Add RTSP-specific endpoints
2. **Frontend Enhancement**: Add video element support
3. **WebSocket Integration**: Implement RTSP streaming for web
4. **Authentication**: Add RTSP credential management

### Low Priority (Polish and Advanced Features)
1. **Advanced Settings**: RTSP configuration options
2. **Performance Optimization**: Stream quality negotiation
3. **Testing Framework**: Comprehensive test suite
4. **Documentation**: User and developer guides

## Success Criteria

### Functional Requirements
- [ ] RTSP cameras work seamlessly alongside MJPEG cameras
- [ ] Automatic protocol detection based on URL
- [ ] Both desktop and web clients support RTSP streams
- [ ] Zero breaking changes to existing functionality
- [ ] Robust error handling and reconnection

### Performance Requirements
- [ ] RTSP streaming latency < 2 seconds
- [ ] No performance degradation for MJPEG streams
- [ ] Support for 5+ concurrent clients
- [ ] Memory usage increase < 50MB per stream
- [ ] CPU usage increase < 10% per stream

### User Experience Requirements
- [ ] Seamless switching between camera types
- [ ] Clear error messages and troubleshooting
- [ ] Intuitive configuration interface
- [ ] Consistent behavior across platforms
- [ ] Comprehensive documentation and examples

This comprehensive plan provides a structured approach to implementing RTSP camera support while maintaining the high quality and reliability of the existing camera system. The modular design ensures that each phase can be developed and tested independently, reducing risk and enabling iterative improvement.