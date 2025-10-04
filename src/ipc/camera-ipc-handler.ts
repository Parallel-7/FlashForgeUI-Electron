/**
 * Camera IPC Handler
 * 
 * Manages IPC communication for camera-related operations between main and renderer processes.
 * Handles camera proxy status, configuration, and control operations.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { getCameraProxyService } from '../services/CameraProxyService';
import {
  resolveCameraConfig,
  getCameraUserConfig,
  formatCameraProxyUrl
} from '../utils/camera-utils';
import { getConfigManager } from '../managers/ConfigManager';
import { getPrinterConnectionManager } from '../managers/ConnectionFlowManager';
import { getPrinterBackendManager } from '../managers/PrinterBackendManager';
import { getPrinterContextManager } from '../managers/PrinterContextManager';
import { ResolvedCameraConfig, CameraProxyStatus } from '../types/camera';

/**
 * Camera IPC handler class
 */
export class CameraIPCHandler {
  private readonly configManager = getConfigManager();
  private readonly cameraProxyService = getCameraProxyService();
  private readonly contextManager = getPrinterContextManager();
  private currentPrinterIpAddress: string | null = null;

  /**
   * Initialize camera IPC handlers
   */
  public initialize(): void {
    this.registerHandlers();
    this.setupConfigListeners();

    console.log('Camera IPC handlers initialized');
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
    ipcMain.handle('camera:get-status', async (): Promise<CameraProxyStatus> => {
      return this.cameraProxyService.getStatus();
    });
    
    // Enable/disable camera preview
    ipcMain.handle('camera:set-enabled', async (event: IpcMainInvokeEvent, enabled: boolean): Promise<void> => {
      // This controls whether the UI should display the camera preview
      // The camera proxy server continues running - only the client disconnects
      console.log(`Camera preview ${enabled ? 'enabled' : 'disabled'} by renderer`);

      // NOTE: We don't remove the camera proxy context here
      // The proxy stays running for the printer context until the printer disconnects
      // This allows instant camera switching when tabbing between printers
    });
    
    // Get resolved camera configuration
    ipcMain.handle('camera:get-config', async (): Promise<ResolvedCameraConfig | null> => {
      const activeContextId = this.getActiveContextId();
      console.log(`[camera:get-config] Active context ID: ${activeContextId}`);

      const config = await this.getCurrentCameraConfigForContext(activeContextId);
      console.log(`[camera:get-config] Config for context ${activeContextId}:`, config);

      return config;
    });
    
    // Get camera proxy URL
    ipcMain.handle('camera:get-proxy-url', async (): Promise<string> => {
      const activeContextId = this.getActiveContextId();
      console.log(`[camera:get-proxy-url] Active context ID: ${activeContextId}`);

      const status = this.cameraProxyService.getStatusForContext(activeContextId);
      console.log(`[camera:get-proxy-url] Status for context ${activeContextId}:`, status);

      if (!status || !status.isRunning) {
        console.log(`[camera:get-proxy-url] No camera running, returning invalid URL`);
        return 'http://localhost:0/camera'; // Invalid port signals no camera
      }

      const proxyUrl = formatCameraProxyUrl(status.port);
      console.log(`[camera:get-proxy-url] Returning proxy URL: ${proxyUrl}`);
      return proxyUrl;
    });
    
    // Manual camera stream restoration (for stuck streams)
    ipcMain.handle('camera:restore-stream', async (): Promise<boolean> => {
      try {
        console.log('Manual camera stream restoration requested');

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
    // Listen for custom camera configuration changes
    this.configManager.on('config:CustomCamera', () => {
      void this.updateCameraConfiguration();
    });
    
    this.configManager.on('config:CustomCameraUrl', () => {
      void this.updateCameraConfiguration();
    });
  }
  
  /**
   * Update camera configuration when settings change
   */
  private async updateCameraConfiguration(): Promise<void> {
    const config = await this.getCurrentCameraConfig();
    const contextId = this.getActiveContextId();

    if (config && config.isAvailable && config.streamUrl) {
      console.log(`Camera configuration updated: ${config.sourceType} - ${config.streamUrl}`);
      await this.cameraProxyService.setStreamUrl(contextId, config.streamUrl);
    } else {
      console.log('Camera configuration updated: No camera available');
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
      userConfig: getCameraUserConfig()
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
    console.log(`Handling printer connection for camera setup (context: ${contextId})`);

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
      console.log(`Setting camera stream URL for context ${contextId}: ${config.streamUrl} (${config.sourceType})`);
      await this.cameraProxyService.setStreamUrl(contextId, config.streamUrl);
    } else {
      console.log(`No camera available for context ${contextId}`);
      await this.cameraProxyService.removeContext(contextId);
    }
  }
  
  /**
   * Handle printer disconnection - clear camera URL
   */
  public async handlePrinterDisconnected(): Promise<void> {
    console.log('Clearing camera stream URL due to printer disconnection');
    this.currentPrinterIpAddress = null;
    const contextId = this.getActiveContextId();
    await this.cameraProxyService.removeContext(contextId);
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
    ipcMain.removeHandler('camera:restore-stream');
    
    // Remove config listeners
    this.configManager.removeAllListeners('config:CustomCamera');
    this.configManager.removeAllListeners('config:CustomCameraUrl');
  }
}

// Export singleton instance
export const cameraIPCHandler = new CameraIPCHandler();
