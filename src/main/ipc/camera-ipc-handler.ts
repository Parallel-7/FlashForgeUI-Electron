/**
 * @fileoverview Camera IPC handler for managing camera streaming operations via go2rtc.
 *
 * Provides unified camera management through IPC handlers for all camera types (MJPEG and RTSP)
 * using go2rtc as the streaming gateway. This eliminates the rotation drift bug caused by
 * JSMpeg's canvas rendering and provides lower latency streaming via WebRTC/MSE.
 *
 * Key features:
 * - Unified handling for both MJPEG and RTSP cameras through go2rtc
 * - Multi-context camera support with per-printer stream management
 * - Automatic camera configuration resolution based on printer capabilities and user preferences
 * - Native <video> element playback (no canvas = no rotation drift)
 * - Automatic reconnection built into go2rtc
 *
 * Key exports:
 * - CameraIPCHandler class: Main handler for all camera-related IPC operations
 * - cameraIPCHandler singleton: Pre-initialized handler instance
 *
 * The handler coordinates with Go2rtcService and PrinterContextManager to provide seamless
 * camera streaming across multiple printer connections.
 *
 * @see src/main/services/Go2rtcService.ts for the streaming gateway
 * @see src/main/services/Go2rtcBinaryManager.ts for binary lifecycle
 */

import { logVerbose } from '@shared/logging.js';
import type { CameraSourceType } from '@shared/types/camera/index.js';
import { Go2rtcCameraStreamConfig, ResolvedCameraConfig } from '@shared/types/camera/index.js';
import { IpcMainInvokeEvent, ipcMain } from 'electron';
import { getPrinterBackendManager } from '../managers/PrinterBackendManager.js';
import { getPrinterContextManager } from '../managers/PrinterContextManager.js';
import { Go2rtcService, getGo2rtcService } from '../services/Go2rtcService.js';
import { getCameraUserConfig, resolveCameraConfig } from '../utils/camera-utils.js';

const CAMERA_IPC_LOG_NAMESPACE = 'CameraIPCHandler';

function isGo2rtcSourceType(sourceType: CameraSourceType): sourceType is 'builtin' | 'custom' {
  return sourceType === 'builtin' || sourceType === 'custom';
}

/**
 * Camera IPC handler class using go2rtc for unified streaming.
 */
export class CameraIPCHandler {
  private readonly go2rtcService: Go2rtcService;
  private readonly contextManager = getPrinterContextManager();

  constructor() {
    this.go2rtcService = getGo2rtcService();
  }

  private logDebug(message: string, ...args: unknown[]): void {
    logVerbose(CAMERA_IPC_LOG_NAMESPACE, message, ...args);
  }

  /**
   * Initialize camera IPC handlers
   */
  public initialize(): void {
    this.registerHandlers();
    this.setupConfigListeners();
    this.logDebug('Camera IPC handlers initialized (go2rtc mode)');
  }

  /**
   * Get the active context ID, or warn if none exists
   */
  private getActiveContextId(): string {
    const activeContextId = this.contextManager.getActiveContextId();
    if (activeContextId) {
      return activeContextId;
    }

    console.warn('No active context found, camera operations may not work correctly');
    return 'default-context';
  }

  /**
   * Register IPC handlers
   */
  private registerHandlers(): void {
    // Get go2rtc API port
    ipcMain.handle('camera:get-proxy-port', async (): Promise<number> => {
      return this.go2rtcService.getApiPort();
    });

    // Get service status (simplified for go2rtc)
    ipcMain.handle('camera:get-status', async (_event: IpcMainInvokeEvent, contextId?: string): Promise<unknown> => {
      const targetContextId =
        typeof contextId === 'string' && contextId.length > 0 ? contextId : this.getActiveContextId();
      const streamConfig = this.go2rtcService.getStreamConfig(targetContextId);
      const serviceStatus = this.go2rtcService.getServiceStatus();

      return {
        isRunning: serviceStatus.isRunning,
        port: serviceStatus.webrtcPort,
        proxyUrl: streamConfig?.wsUrl ?? '',
        isStreaming: streamConfig !== null,
        lastError: serviceStatus.lastError ?? null,
      };
    });

    // Enable/disable camera preview (no-op, kept for compatibility)
    ipcMain.handle('camera:set-enabled', async (_event: IpcMainInvokeEvent, enabled: boolean): Promise<void> => {
      this.logDebug(`Camera preview ${enabled ? 'enabled' : 'disabled'} by renderer`);
      // go2rtc handles client connections automatically, no action needed
    });

    // Get resolved camera configuration
    ipcMain.handle('camera:get-config', async (): Promise<ResolvedCameraConfig | null> => {
      const activeContextId = this.getActiveContextId();
      this.logDebug(`[camera:get-config] Active context ID: ${activeContextId}`);

      const config = await this.getCurrentCameraConfigForContext(activeContextId);
      this.logDebug(`[camera:get-config] Config for context ${activeContextId}:`, config);

      return config;
    });

    // Get go2rtc stream configuration for UI - the main handler for video-rtc element
    ipcMain.handle(
      'camera:get-stream-config',
      async (_event: IpcMainInvokeEvent, contextId?: string): Promise<Go2rtcCameraStreamConfig | null> => {
        const targetContextId =
          typeof contextId === 'string' && contextId.length > 0 ? contextId : this.getActiveContextId();
        this.logDebug(`[camera:get-stream-config] Getting stream config for context: ${targetContextId}`);

        const streamConfig = this.go2rtcService.getStreamConfig(targetContextId);

        if (!streamConfig) {
          this.logDebug(`[camera:get-stream-config] No stream found for context: ${targetContextId}`);
          return null;
        }

        this.logDebug(`[camera:get-stream-config] Returning stream config:`, streamConfig);

        return {
          wsUrl: streamConfig.wsUrl,
          sourceType: streamConfig.sourceType,
          streamType: streamConfig.streamType,
          mode: streamConfig.mode,
          isAvailable: streamConfig.isAvailable,
          streamName: streamConfig.streamName,
          apiPort: streamConfig.apiPort,
        };
      }
    );

    // Legacy handler - get proxy URL (returns go2rtc WebSocket URL)
    ipcMain.handle('camera:get-proxy-url', async (): Promise<string> => {
      const activeContextId = this.getActiveContextId();
      this.logDebug(`[camera:get-proxy-url] Active context ID: ${activeContextId}`);

      const wsUrl = this.go2rtcService.getStreamWsUrl(activeContextId);
      this.logDebug(`[camera:get-proxy-url] WebSocket URL: ${wsUrl}`);

      if (!wsUrl) {
        return 'ws://localhost:0/api/ws?src=none'; // Invalid URL signals no camera
      }

      return wsUrl;
    });

    // Manual camera stream restoration
    ipcMain.handle('camera:restore-stream', async (): Promise<boolean> => {
      try {
        this.logDebug('Manual camera stream restoration requested');

        const contextId = this.getActiveContextId();

        if (!this.go2rtcService.hasStream(contextId)) {
          this.logDebug('No stream to restore for context:', contextId);
          return false;
        }

        await this.go2rtcService.restartStream(contextId);
        return true;
      } catch (error) {
        console.error('Camera stream restoration failed:', error);
        return false;
      }
    });
  }

  /**
   * Setup configuration change listeners
   */
  private setupConfigListeners(): void {
    // Listen for printer context updates (per-printer settings changes)
    this.contextManager.on('context-updated', (contextId: string) => {
      this.logDebug(`Context ${contextId} updated, checking camera config...`);
      void this.handleContextUpdate(contextId);
    });
  }

  /**
   * Handle context update - check if camera config changed
   */
  private async handleContextUpdate(contextId: string): Promise<void> {
    const context = this.contextManager.getContext(contextId);
    if (!context) {
      this.logDebug(`Context ${contextId} not found`);
      return;
    }

    const config = await this.getCurrentCameraConfigForContext(contextId);

    if (config && config.isAvailable && config.streamUrl && config.streamType) {
      this.logDebug(`Camera config updated for ${contextId}: ${config.sourceType} - ${config.streamUrl}`);

      try {
        if (!isGo2rtcSourceType(config.sourceType)) {
          this.logDebug(`Camera source type ${config.sourceType} not supported for streaming`);
          await this.go2rtcService.removeStream(contextId);
          return;
        }

        await this.go2rtcService.addStream(contextId, config.streamUrl, config.sourceType, config.streamType);
        this.logDebug(`go2rtc stream setup for context ${contextId}`);
      } catch (error) {
        console.warn(`[CameraIPC] Failed to setup go2rtc stream for context ${contextId}:`, error);
      }
    } else {
      this.logDebug(`No camera available for context ${contextId}, removing stream`);
      await this.go2rtcService.removeStream(contextId);
    }
  }

  /**
   * Get current camera configuration for a specific context
   * @param contextId - The context ID to get camera config for
   */
  private async getCurrentCameraConfigForContext(contextId: string): Promise<ResolvedCameraConfig | null> {
    const backendManager = getPrinterBackendManager();

    // Get context
    const context = this.contextManager.getContext(contextId);
    if (!context) {
      console.warn(`Cannot get camera config: Context ${contextId} not found`);
      return null;
    }

    const printerIpAddress = context.printerDetails.IPAddress;
    if (!printerIpAddress) {
      console.warn(`Cannot determine printer IP address for context ${contextId}`);
      return null;
    }

    // Get backend for feature information
    const backend = backendManager.getBackendForContext(contextId);
    if (!backend) {
      console.warn(`Cannot get camera config: Backend not found for context ${contextId}`);
      return null;
    }

    const backendStatus = backend.getBackendStatus();

    return resolveCameraConfig({
      printerIpAddress,
      printerFeatures: backendStatus.features,
      userConfig: getCameraUserConfig(contextId),
    });
  }

  /**
   * Handle printer connection - setup camera stream
   * @param contextId - The context ID of the connected printer
   */
  public async handlePrinterConnected(contextId: string): Promise<void> {
    this.logDebug(`Handling printer connection for camera setup (context: ${contextId})`);

    // Ensure go2rtc service is initialized
    if (!this.go2rtcService.isRunning()) {
      try {
        await this.go2rtcService.initialize();
      } catch (error) {
        console.error('[CameraIPC] Failed to initialize go2rtc service:', error);
        return;
      }
    }

    // Get context from context manager
    const context = this.contextManager.getContext(contextId);
    if (!context) {
      console.error(`Cannot setup camera: Context ${contextId} not found`);
      return;
    }

    const config = await this.getCurrentCameraConfigForContext(contextId);

    if (config && config.isAvailable && config.streamUrl && config.streamType) {
      this.logDebug(
        `Setting camera stream for context ${contextId}: ${config.streamUrl} (${config.sourceType}, ${config.streamType})`
      );

      try {
        if (!isGo2rtcSourceType(config.sourceType)) {
          this.logDebug(`Camera source type ${config.sourceType} not supported for streaming`);
          await this.go2rtcService.removeStream(contextId);
          return;
        }

        await this.go2rtcService.addStream(contextId, config.streamUrl, config.sourceType, config.streamType);
        this.logDebug(`go2rtc stream setup for context ${contextId}`);
      } catch (error) {
        console.warn(`Failed to setup go2rtc stream for context ${contextId}:`, error);
        // Non-fatal - will retry on next connection attempt
      }
    } else {
      this.logDebug(`No camera available for context ${contextId}`);
      await this.go2rtcService.removeStream(contextId);
    }
  }

  /**
   * Handle printer disconnection - remove camera stream
   * @param contextId - Optional context ID (defaults to active context if not provided)
   */
  public async handlePrinterDisconnected(contextId?: string): Promise<void> {
    this.logDebug('Clearing camera stream due to printer disconnection');
    const targetContextId = contextId || this.getActiveContextId();
    await this.go2rtcService.removeStream(targetContextId);
  }

  /**
   * Dispose of IPC handlers
   */
  public dispose(): void {
    // Remove all handlers
    ipcMain.removeHandler('camera:get-proxy-port');
    ipcMain.removeHandler('camera:get-status');
    ipcMain.removeHandler('camera:set-enabled');
    ipcMain.removeHandler('camera:get-config');
    ipcMain.removeHandler('camera:get-stream-config');
    ipcMain.removeHandler('camera:get-proxy-url');
    ipcMain.removeHandler('camera:restore-stream');

    // Remove context update listeners
    this.contextManager.removeAllListeners('context-updated');
  }
}

// Export singleton instance
export const cameraIPCHandler = new CameraIPCHandler();
