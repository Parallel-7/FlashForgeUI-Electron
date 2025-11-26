/**
 * @fileoverview Camera IPC handler for managing camera streaming operations across printer contexts.
 *
 * Provides comprehensive camera management through IPC handlers for both MJPEG and RTSP streaming:
 * - Multi-context camera support with per-printer camera proxy servers
 * - Automatic camera configuration resolution based on printer capabilities and user preferences
 * - RTSP stream relay for streaming RTSP camera feeds via WebSocket (5M Pro)
 * - MJPEG camera proxy setup with unique port allocation per context
 * - Camera stream restoration and error recovery mechanisms
 * - Integration with per-printer settings for camera source configuration
 *
 * Key exports:
 * - CameraIPCHandler class: Main handler for all camera-related IPC operations
 * - cameraIPCHandler singleton: Pre-initialized handler instance
 *
 * The handler coordinates with CameraProxyService, RtspStreamService, and PrinterContextManager
 * to provide seamless camera streaming across multiple printer connections. Each printer context
 * maintains its own camera proxy on a unique port (8181-8191 range).
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getCameraProxyService } from '../services/CameraProxyService.js';
import { getRtspStreamService } from '../services/RtspStreamService.js';
import {
  resolveCameraConfig,
  getCameraUserConfig,
  formatCameraProxyUrl
} from '../utils/camera-utils.js';
import { getConfigManager } from '../managers/ConfigManager.js';
import { getPrinterBackendManager } from '../managers/PrinterBackendManager.js';
import { getPrinterContextManager } from '../managers/PrinterContextManager.js';
import { ResolvedCameraConfig, CameraProxyStatus } from '../types/camera/index.js';
import { logVerbose } from '../utils/logging.js';

/**
 * Camera IPC handler class
 */
const CAMERA_IPC_LOG_NAMESPACE = 'CameraIPCHandler';

export class CameraIPCHandler {
  private readonly configManager = getConfigManager();
  private readonly cameraProxyService = getCameraProxyService();
  private readonly rtspStreamService = getRtspStreamService();
  private readonly contextManager = getPrinterContextManager();
  private currentPrinterIpAddress: string | null = null;
  private logDebug(message: string, ...args: unknown[]): void {
    logVerbose(CAMERA_IPC_LOG_NAMESPACE, message, ...args);
  }

  /**
   * Initialize camera IPC handlers
   */
  public initialize(): void {
    this.registerHandlers();
    this.setupConfigListeners();

    this.logDebug('Camera IPC handlers initialized');
  }

  /**
   * Get the active context ID, or create a default context if none exists
   */
  private getActiveContextId(): string {
    const activeContextId = this.contextManager.getActiveContextId();
    if (activeContextId) {
      return activeContextId;
    }

    // For backward compatibility with single-printer mode,
    // create a default context if none exists
    console.warn('No active context found, camera operations may not work correctly');
    return 'default-context';
  }
  
  /**
   * Register IPC handlers
   */
  private registerHandlers(): void {
    // Get camera proxy port
    ipcMain.handle('camera:get-proxy-port', async (): Promise<number> => {
      const status = this.cameraProxyService.getStatus();
      return status.port;
    });

    // Get camera proxy status
    ipcMain.handle(
      'camera:get-status',
      async (_event: IpcMainInvokeEvent, contextId?: string): Promise<CameraProxyStatus | null> => {
        if (typeof contextId === 'string' && contextId.length > 0) {
          return this.cameraProxyService.getStatusForContext(contextId);
        }

        return this.cameraProxyService.getStatus();
      }
    );
    
    // Enable/disable camera preview
    ipcMain.handle('camera:set-enabled', async (event: IpcMainInvokeEvent, enabled: boolean): Promise<void> => {
      // This controls whether the UI should display the camera preview
      // The camera proxy server continues running - only the client disconnects
      this.logDebug(`Camera preview ${enabled ? 'enabled' : 'disabled'} by renderer`);

      // NOTE: We don't remove the camera proxy context here
      // The proxy stays running for the printer context until the printer disconnects
      // This allows instant camera switching when tabbing between printers
    });
    
    // Get resolved camera configuration
    ipcMain.handle('camera:get-config', async (): Promise<ResolvedCameraConfig | null> => {
      const activeContextId = this.getActiveContextId();
      this.logDebug(`[camera:get-config] Active context ID: ${activeContextId}`);

      const config = await this.getCurrentCameraConfigForContext(activeContextId);
      this.logDebug(`[camera:get-config] Config for context ${activeContextId}:`, config);

      return config;
    });
    
    // Get camera proxy URL
    ipcMain.handle('camera:get-proxy-url', async (): Promise<string> => {
      const activeContextId = this.getActiveContextId();
      this.logDebug(`[camera:get-proxy-url] Active context ID: ${activeContextId}`);

      const status = this.cameraProxyService.getStatusForContext(activeContextId);
      this.logDebug(`[camera:get-proxy-url] Status for context ${activeContextId}:`, status);

      if (!status || !status.isRunning) {
        this.logDebug('[camera:get-proxy-url] No camera running, returning invalid URL');
        return 'http://localhost:0/camera'; // Invalid port signals no camera
      }

      const proxyUrl = formatCameraProxyUrl(status.port);
      this.logDebug(`[camera:get-proxy-url] Returning proxy URL: ${proxyUrl}`);
      return proxyUrl;
    });

    // Get RTSP stream info (for RTSP cameras) - used by WebUI
    ipcMain.handle('camera:get-rtsp-info', async (): Promise<{ wsPort: number; ffmpegAvailable: boolean } | null> => {
      const activeContextId = this.getActiveContextId();
      const streamStatus = this.rtspStreamService.getStreamStatus(activeContextId);
      const ffmpegStatus = this.rtspStreamService.getFfmpegStatus();

      if (!streamStatus) {
        return null;
      }

      return {
        wsPort: streamStatus.wsPort,
        ffmpegAvailable: ffmpegStatus.available
      };
    });

    // Get RTSP stream WebSocket URL for desktop app (full ws:// URL)
    ipcMain.handle('camera:get-rtsp-relay-info', async (): Promise<{ wsUrl: string } | null> => {
      const activeContextId = this.getActiveContextId();
      const streamStatus = this.rtspStreamService.getStreamStatus(activeContextId);

      if (!streamStatus || !streamStatus.isActive) {
        this.logDebug(`[camera:get-rtsp-relay-info] No RTSP stream active for context ${activeContextId}`);
        return null;
      }

      // Construct full WebSocket URL for desktop JSMpeg player
      // node-rtsp-stream creates a direct WebSocket server on the allocated port
      const wsUrl = `ws://localhost:${streamStatus.wsPort}`;
      this.logDebug(`[camera:get-rtsp-relay-info] RTSP stream URL for context ${activeContextId}: ${wsUrl}`);

      return { wsUrl };
    });
    
    // Manual camera stream restoration (for stuck streams)
    ipcMain.handle('camera:restore-stream', async (): Promise<boolean> => {
      try {
        this.logDebug('Manual camera stream restoration requested');

        // Get current camera config
        const config = await this.getCurrentCameraConfig();
        if (!config || !config.streamUrl) {
          return false;
        }

        const contextId = this.getActiveContextId();

        // Force reconnect by resetting the stream URL
        await this.cameraProxyService.removeContext(contextId);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        await this.cameraProxyService.setStreamUrl(contextId, config.streamUrl);

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
      this.logDebug(`[CameraIPC] Context ${contextId} updated, checking camera config...`);
      void this.handleContextUpdate(contextId);
    });
  }

  /**
   * Handle context update - check if camera config changed
   */
  private async handleContextUpdate(contextId: string): Promise<void> {
    const context = this.contextManager.getContext(contextId);
    if (!context) {
      this.logDebug(`[CameraIPC] Context ${contextId} not found`);
      return;
    }

    const config = await this.getCurrentCameraConfigForContext(contextId);

    if (config && config.isAvailable && config.streamUrl) {
      this.logDebug(`[CameraIPC] Camera config updated for ${contextId}: ${config.sourceType} - ${config.streamUrl}`);

      // Handle based on stream type
      if (config.streamType === 'rtsp') {
        try {
          // Get RTSP settings from printer details
          const { rtspFrameRate, rtspQuality } = context.printerDetails;

          await this.rtspStreamService.setupStream(contextId, config.streamUrl, {
            frameRate: rtspFrameRate,
            quality: rtspQuality
          });
          this.logDebug(`[CameraIPC] RTSP stream setup for context ${contextId}`);
        } catch (error) {
          console.warn(`[CameraIPC] Failed to setup RTSP stream for context ${contextId}:`, error);
        }
      } else {
        // MJPEG: Use camera proxy service
        await this.cameraProxyService.setStreamUrl(contextId, config.streamUrl);
        this.logDebug(`[CameraIPC] Camera proxy setup for context ${contextId}`);
      }
    } else {
      this.logDebug(`[CameraIPC] No camera available for context ${contextId}, removing proxy`);
      await this.cameraProxyService.removeContext(contextId);
      await this.rtspStreamService.stopStream(contextId);
    }
  }
  
  /**
   * Update camera configuration when settings change
   */
  private async updateCameraConfiguration(): Promise<void> {
    const config = await this.getCurrentCameraConfig();
    const contextId = this.getActiveContextId();

    if (config && config.isAvailable && config.streamUrl) {
      this.logDebug(`Camera configuration updated: ${config.sourceType} - ${config.streamUrl}`);
      await this.cameraProxyService.setStreamUrl(contextId, config.streamUrl);
    } else {
      this.logDebug('Camera configuration updated: No camera available');
      await this.cameraProxyService.removeContext(contextId);
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
      userConfig: getCameraUserConfig(contextId)
    });
  }

  /**
   * Get current camera configuration for the active context
   * @deprecated Use getCurrentCameraConfigForContext(contextId) instead
   */
  private async getCurrentCameraConfig(): Promise<ResolvedCameraConfig | null> {
    const activeContextId = this.getActiveContextId();
    return this.getCurrentCameraConfigForContext(activeContextId);
  }
  
  /**
   * Handle printer connection - update camera URL
   * @param contextId - The context ID of the connected printer
   */
  public async handlePrinterConnected(contextId: string): Promise<void> {
    this.logDebug(`Handling printer connection for camera setup (context: ${contextId})`);

    // Get context from context manager
    const context = this.contextManager.getContext(contextId);
    if (!context) {
      console.error(`Cannot setup camera: Context ${contextId} not found`);
      return;
    }

    // Store IP address from context
    this.currentPrinterIpAddress = context.printerDetails.IPAddress;

    const config = await this.getCurrentCameraConfigForContext(contextId);

    if (config && config.isAvailable && config.streamUrl) {
      this.logDebug(`Setting camera stream URL for context ${contextId}: ${config.streamUrl} (${config.sourceType}, ${config.streamType})`);

      // Handle based on stream type
      if (config.streamType === 'rtsp') {
        // RTSP: Setup stream for desktop JSMpeg player
        try {
          // Get RTSP settings from printer details
          const { rtspFrameRate, rtspQuality } = context.printerDetails;

          await this.rtspStreamService.setupStream(contextId, config.streamUrl, {
            frameRate: rtspFrameRate,
            quality: rtspQuality
          });
          this.logDebug(`RTSP stream setup for context ${contextId}`);
        } catch (error) {
          console.warn(`Failed to setup RTSP stream for context ${contextId}:`, error);
          // Non-fatal - will retry on next connection attempt
        }
      } else {
        // MJPEG: Use camera proxy service
        await this.cameraProxyService.setStreamUrl(contextId, config.streamUrl);
      }
    } else {
      this.logDebug(`No camera available for context ${contextId}`);
      await this.cameraProxyService.removeContext(contextId);
      await this.rtspStreamService.stopStream(contextId);
    }
  }
  
  /**
   * Handle printer disconnection - clear camera URL
   * @param contextId - Optional context ID (defaults to active context if not provided)
   */
  public async handlePrinterDisconnected(contextId?: string): Promise<void> {
    this.logDebug('Clearing camera stream URL due to printer disconnection');
    this.currentPrinterIpAddress = null;
    const targetContextId = contextId || this.getActiveContextId();
    await this.cameraProxyService.removeContext(targetContextId);
    await this.rtspStreamService.stopStream(targetContextId);
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
    ipcMain.removeHandler('camera:get-proxy-url');
    ipcMain.removeHandler('camera:get-rtsp-info');
    ipcMain.removeHandler('camera:restore-stream');

    // Remove context update listeners
    this.contextManager.removeAllListeners('context-updated');
  }
}

// Export singleton instance
export const cameraIPCHandler = new CameraIPCHandler();
