/**
 * Camera IPC Handler
 * 
 * Manages IPC communication for camera-related operations between main and renderer processes.
 * Handles camera proxy status, configuration, and control operations.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { cameraProxyService } from '../services/CameraProxyService';
import { 
  resolveCameraConfig, 
  getCameraUserConfig,
  formatCameraProxyUrl 
} from '../utils/camera-utils';
import { getConfigManager } from '../managers/ConfigManager';
import { getPrinterConnectionManager } from '../managers/ConnectionFlowManager';
import { getPrinterBackendManager } from '../managers/PrinterBackendManager';
import { ResolvedCameraConfig, CameraProxyStatus } from '../types/camera';

/**
 * Camera IPC handler class
 */
export class CameraIPCHandler {
  private readonly configManager = getConfigManager();
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
   * Register IPC handlers
   */
  private registerHandlers(): void {
    // Get camera proxy port
    ipcMain.handle('camera:get-proxy-port', async (): Promise<number> => {
      const status = cameraProxyService.getStatus();
      return status.port;
    });
    
    // Get camera proxy status
    ipcMain.handle('camera:get-status', async (): Promise<CameraProxyStatus> => {
      return cameraProxyService.getStatus();
    });
    
    // Enable/disable camera preview
    ipcMain.handle('camera:set-enabled', async (event: IpcMainInvokeEvent, enabled: boolean): Promise<void> => {
      // This controls whether the UI should display the camera preview
      // The actual proxy continues running for other potential clients
      console.log(`Camera preview ${enabled ? 'enabled' : 'disabled'} by renderer`);
      
      // If disabling and no other clients connected, we could stop streaming
      if (!enabled) {
        const status = cameraProxyService.getStatus();
        if (status.clientCount === 0) {
          cameraProxyService.setStreamUrl(null);
        }
      }
    });
    
    // Get resolved camera configuration
    ipcMain.handle('camera:get-config', async (): Promise<ResolvedCameraConfig | null> => {
      return this.getCurrentCameraConfig();
    });
    
    // Get camera proxy URL
    ipcMain.handle('camera:get-proxy-url', async (): Promise<string> => {
      const status = cameraProxyService.getStatus();
      return formatCameraProxyUrl(status.port);
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
        
        // Force reconnect by resetting the stream URL
        cameraProxyService.setStreamUrl(null);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        cameraProxyService.setStreamUrl(config.streamUrl);
        
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
    
    if (config && config.isAvailable && config.streamUrl) {
      console.log(`Camera configuration updated: ${config.sourceType} - ${config.streamUrl}`);
      cameraProxyService.setStreamUrl(config.streamUrl);
    } else {
      console.log('Camera configuration updated: No camera available');
      cameraProxyService.setStreamUrl(null);
    }
  }
  
  /**
   * Get current camera configuration
   */
  private async getCurrentCameraConfig(): Promise<ResolvedCameraConfig | null> {
    const connectionManager = getPrinterConnectionManager();
    const backendManager = getPrinterBackendManager();
    
    // Check if connected
    if (!connectionManager.isConnected()) {
      return null;
    }
    
    // Try to get IP address from stored value or connection state
    let printerIpAddress = this.currentPrinterIpAddress;
    
    if (!printerIpAddress) {
      const connectionState = connectionManager.getConnectionState();
      printerIpAddress = connectionState.ipAddress || null;
    }
    
    if (!printerIpAddress) {
      console.warn('Cannot determine printer IP address for camera configuration');
      return null;
    }
    
    // Get backend for feature information
    const backend = backendManager.getBackend();
    if (!backend) {
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
   * Handle printer connection - update camera URL
   */
  public async handlePrinterConnected(printerIpAddress?: string): Promise<void> {
    console.log('Handling printer connection for camera setup');
    
    // Store IP address if provided
    if (printerIpAddress) {
      this.currentPrinterIpAddress = printerIpAddress;
    }
    
    const config = await this.getCurrentCameraConfig();
    
    if (config && config.isAvailable && config.streamUrl) {
      console.log(`Setting camera stream URL: ${config.streamUrl} (${config.sourceType})`);
      cameraProxyService.setStreamUrl(config.streamUrl);
    } else {
      console.log('No camera available for connected printer');
      cameraProxyService.setStreamUrl(null);
    }
  }
  
  /**
   * Handle printer disconnection - clear camera URL
   */
  public handlePrinterDisconnected(): void {
    console.log('Clearing camera stream URL due to printer disconnection');
    this.currentPrinterIpAddress = null;
    cameraProxyService.setStreamUrl(null);
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
