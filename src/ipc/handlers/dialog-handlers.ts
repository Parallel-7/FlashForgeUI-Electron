/**
 * Dialog-related IPC handlers for window management and dialog-specific operations.
 * Handles opening dialogs, dialog-specific data requests, and window controls.
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as os from 'os';
import type { ConfigManager } from '../../managers/ConfigManager';
import type { getWindowManager } from '../../windows/WindowManager';
import { getPrinterBackendManager } from '../../managers/PrinterBackendManager';
import { getPrinterConnectionManager } from '../../managers/ConnectionFlowManager';
import { getWebUIManager } from '../../webui/server/WebUIManager';
import { cameraProxyService } from '../../services/CameraProxyService';
import { getModelDisplayName } from '../../utils/PrinterUtils';
import { FiveMClient, FlashForgeClient } from 'ff-api';

type WindowManager = ReturnType<typeof getWindowManager>;
import type { AppConfig } from '../../types/config';
import { 
  createSettingsWindow, 
  createStatusWindow, 
  createInputDialog, 
  createJobUploaderWindow, 
  createJobPickerWindow, 
  createSendCommandsWindow,
  createIFSDialog,
  createMaterialInfoDialog,
  createMaterialMatchingDialog,
  createSingleColorConfirmationDialog,
  type InputDialogOptions
} from '../../windows/WindowFactory';

// Type definitions for window data structures
interface WindowWithResolver<T> extends BrowserWindow {
  readonly windowData?: {
    readonly resolve?: (value: T) => void;
  };
}

/**
 * Register all dialog-related IPC handlers
 */
export function registerDialogHandlers(
  configManager: ConfigManager,
  windowManager: WindowManager
): void {
  // Settings window handlers
  ipcMain.on('open-settings-window', () => {
    createSettingsWindow();
  });

  ipcMain.on('settings-close-window', () => {
    const settingsWindow = windowManager.getSettingsWindow();
    if (settingsWindow) {
      settingsWindow.close();
    }
  });

  ipcMain.handle('settings-request-config', async (): Promise<AppConfig> => {
    return configManager.getConfig();
  });

  ipcMain.handle('settings-save-config', async (_, config: Partial<AppConfig>): Promise<boolean> => {
    try {
      configManager.replaceConfig(config);
      await configManager.forceSave();
      return true;
    } catch (error) {
      console.error('Failed to save configuration:', error);
      return false;
    }
  });

  // Status dialog handlers
  ipcMain.on('open-status-dialog', () => {
    createStatusWindow();
  });

  ipcMain.on('status-close-window', () => {
    const statusWindow = windowManager.getStatusWindow();
    if (statusWindow) {
      statusWindow.close();
    }
  });

  ipcMain.handle('status-request-stats', async () => {
    console.log('Status request stats handler called');
    try {
      // Get printer information
      const connectionManager = getPrinterConnectionManager();
      const backendManager = getPrinterBackendManager();
      const isConnected = connectionManager.isConnected();
      
      let printerInfo = {
        model: 'Not Connected',
        machineType: 'Unknown',
        firmwareVersion: 'Unknown',
        serialNumber: 'Unknown',
        toolCount: 0,
        ipAddress: 'Not Connected',
        isConnected: false
      };
      
      if (isConnected && backendManager.isBackendReady()) {
        const backend = backendManager.getBackend();
        if (backend) {
          const backendStatus = backend.getBackendStatus();
          const connectionState = connectionManager.getConnectionState();
          const capabilities = backendStatus.capabilities;
          
          // Get model display name from capabilities
          const modelDisplayName = getModelDisplayName(capabilities.modelType);
          
          // Determine tool count based on model type
          let toolCount = 1; // Default to single extruder
          if (capabilities.modelType === 'ad5x') {
            toolCount = 1; // AD5X has single extruder but uses material station
          }
          
          // Determine machine type from client type
          const machineType = connectionState.clientType === 'new' ? '5M Series' : 'Legacy';
          
          // Get firmware version and serial number from the backend clients
          let firmwareVersion = 'Unknown';
          let serialNumber = 'Unknown';
          
          // Get the primary client
          const primaryClient = backend.getPrimaryClient();
          
          // For dual API backends using FiveMClient
          if (primaryClient instanceof FiveMClient) {
            firmwareVersion = primaryClient.firmwareVersion || 'Unknown';
            serialNumber = primaryClient.serialNumber || 'Unknown';
          }
          // For legacy backends using FlashForgeClient
          else if (primaryClient instanceof FlashForgeClient) {
            try {
              const printerInfo = await primaryClient.getPrinterInfo();
              if (printerInfo) {
                firmwareVersion = printerInfo.FirmwareVersion || 'Unknown';
                serialNumber = printerInfo.SerialNumber || 'Unknown';
              }
            } catch (error) {
              console.error('Failed to get printer info from legacy client:', error);
            }
          }
          
          printerInfo = {
            model: connectionState.printerName || modelDisplayName || 'Unknown',
            machineType: machineType,
            firmwareVersion: firmwareVersion,
            serialNumber: serialNumber,
            toolCount: toolCount,
            ipAddress: connectionState.ipAddress || 'Unknown',
            isConnected: true
          };
        }
      }
      
      // Get WebUI status
      const webUIManager = getWebUIManager();
      const webUIStatus = webUIManager.getStatus();
      
      // Get camera proxy status
      const cameraStatus = cameraProxyService.getStatus();
      
      // Get network interfaces for WebUI URL
      const networkInterfaces = os.networkInterfaces();
      let localIP = 'localhost';
      
      // Find the first non-internal IPv4 address
      for (const [, interfaces] of Object.entries(networkInterfaces)) {
        if (!interfaces) continue;
        for (const iface of interfaces) {
          if (iface.family === 'IPv4' && !iface.internal) {
            localIP = iface.address;
            break;
          }
        }
        if (localIP !== 'localhost') break;
      }
      
      return {
        printerInfo,
        webuiStatus: webUIStatus.isRunning,
        webuiClients: webUIStatus.clientCount,
        webuiUrl: webUIStatus.isRunning ? `http://${localIP}:${webUIStatus.port}` : 'None',
        cameraStatus: cameraStatus.isRunning,
        cameraPort: cameraStatus.port,
        cameraClients: cameraStatus.clientCount,
        cameraStreaming: cameraStatus.isStreaming,
        cameraUrl: cameraStatus.isStreaming ? `http://${localIP}:${cameraStatus.port}/camera` : 'None',
        appUptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed
      };
    } catch (error) {
      console.error('Error gathering status stats:', error);
      // Return safe defaults on error
      return {
        printerInfo: {
          model: 'Error',
          machineType: 'Error',
          firmwareVersion: 'Error',
          serialNumber: 'Error',
          toolCount: 0,
          ipAddress: 'Error',
          isConnected: false
        },
        webuiStatus: false,
        webuiClients: 0,
        webuiUrl: 'None',
        cameraStatus: false,
        cameraPort: 0,
        cameraClients: 0,
        cameraStreaming: false,
        cameraUrl: 'None',
        appUptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed
      };
    }
  });

  // Input dialog handlers
  ipcMain.handle('show-input-dialog', async (_, options: InputDialogOptions) => {
    return createInputDialog(options);
  });

  // Job uploader dialog handler
  ipcMain.on('open-job-uploader', () => {
    createJobUploaderWindow();
  });

  // Job picker dialog handlers
  ipcMain.on('show-recent-files', () => {
    createJobPickerWindow(true);
  });

  ipcMain.on('show-local-files', () => {
    createJobPickerWindow(false);
  });

  // Send commands dialog handlers
  ipcMain.on('open-send-commands', () => {
    createSendCommandsWindow();
  });

  ipcMain.handle('send-cmds:send-command', async (_, command: string) => {
    console.log('Sending command:', command);
    
    try {
      // Get the backend manager instance
      const backendManager = getPrinterBackendManager();
      
      // Check if backend is ready
      if (!backendManager.isBackendReady()) {
        return { success: false, error: 'Printer not connected' };
      }
      
      // Execute the G-code command using the backend manager
      const result = await backendManager.executeGCodeCommand(command);
      
      if (result.success) {
        return { 
          success: true, 
          response: result.response || 'Command executed successfully' 
        };
      } else {
        return { 
          success: false, 
          error: result.error || 'Command execution failed' 
        };
      }
    } catch (error) {
      console.error('Error sending command:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  });

  ipcMain.on('send-cmds:close', () => {
    const sendCommandsWindow = windowManager.getSendCommandsWindow();
    if (sendCommandsWindow) {
      sendCommandsWindow.close();
    }
  });

  // AD5X printer detection handler
  ipcMain.handle('is-ad5x-printer', async (): Promise<boolean> => {
    try {
      const backendManager = getPrinterBackendManager();
      if (!backendManager.isBackendReady()) {
        return false;
      }
      
      const backend = backendManager.getBackend();
      // Check if the backend is an instance of AD5XBackend
      return backend?.constructor.name === 'AD5XBackend';
    } catch (error) {
      console.warn('Error checking AD5X printer status:', error);
      return false;
    }
  });

  // IFS dialog handlers
  ipcMain.on('open-ifs-dialog', () => {
    console.log('IFS dialog handler called - creating IFS dialog');
    createIFSDialog();
  });

  ipcMain.on('ifs-close-window', () => {
    const ifsWindow = windowManager.getIFSDialogWindow();
    if (ifsWindow) {
      ifsWindow.close();
    }
  });

  ipcMain.on('ifs-request-material-station', (event) => {
    const backendManager = getPrinterBackendManager();
    const materialStationData = backendManager.getMaterialStationStatus();
    
    if (materialStationData) {
      // Transform backend data to dialog format
      const dialogData = {
        connected: materialStationData.connected,
        slots: materialStationData.slots.map(slot => ({
          slotId: slot.slotId,
          materialType: slot.materialType,
          materialColor: slot.materialColor,
          isEmpty: slot.isEmpty,
          isActive: slot.slotId === materialStationData.activeSlot
        })),
        activeSlot: materialStationData.activeSlot,
        errorMessage: materialStationData.errorMessage
      };
      
      event.sender.send('ifs-dialog-update-material-station', dialogData);
    } else {
      // Send empty/disconnected state
      const emptyData = {
        connected: false,
        slots: [],
        activeSlot: null,
        errorMessage: 'Material station not available'
      };
      
      event.sender.send('ifs-dialog-update-material-station', emptyData);
    }
  });

  // Material info dialog handlers
  ipcMain.on('show-material-info-dialog', (_, materialData) => {
    console.log('Material info dialog handler called - creating material info dialog');
    createMaterialInfoDialog(materialData);
  });

  ipcMain.on('close-material-info-dialog', () => {
    const materialInfoWindow = windowManager.getMaterialInfoDialogWindow();
    if (materialInfoWindow) {
      materialInfoWindow.close();
    }
  });

  // Material matching dialog handlers
  ipcMain.handle('show-material-matching-dialog', async (_, data: { fileName: string; toolDatas: readonly unknown[]; leveling: boolean; context?: 'job-start' | 'file-upload' }) => {
    console.log('Material matching dialog handler called');
    const result = await createMaterialMatchingDialog(data);
    return result; // Returns material mappings or null if cancelled
  });

  ipcMain.on('material-matching:close', () => {
    const materialMatchingWindow = windowManager.getMaterialMatchingDialogWindow();
    if (materialMatchingWindow) {
      materialMatchingWindow.close();
    }
  });

  ipcMain.on('material-matching:confirm', (_, mappings: unknown) => {
    const materialMatchingWindow = windowManager.getMaterialMatchingDialogWindow() as WindowWithResolver<unknown> | null;
    if (materialMatchingWindow) {
      // Store the result and close the window
      const windowData = materialMatchingWindow.windowData;
      if (windowData?.resolve) {
        windowData.resolve(mappings);
      }
      materialMatchingWindow.close();
    }
  });

  // Single color confirmation dialog handlers
  ipcMain.handle('show-single-color-confirmation-dialog', async (_, data: { fileName: string; leveling: boolean }) => {
    console.log('Single color confirmation dialog handler called');
    const result = await createSingleColorConfirmationDialog(data);
    return result; // Returns true if confirmed, false if cancelled
  });

  ipcMain.on('single-color-confirm:close', () => {
    const singleColorConfirmWindow = windowManager.getSingleColorConfirmationDialogWindow();
    if (singleColorConfirmWindow) {
      singleColorConfirmWindow.close();
    }
  });

  ipcMain.on('single-color-confirm:confirm', () => {
    const singleColorConfirmWindow = windowManager.getSingleColorConfirmationDialogWindow() as WindowWithResolver<boolean> | null;
    if (singleColorConfirmWindow) {
      // Store the result and close the window
      const windowData = singleColorConfirmWindow.windowData;
      if (windowData?.resolve) {
        windowData.resolve(true);
      }
      singleColorConfirmWindow.close();
    }
  });

  // Generic window close handlers for sub-windows
  ipcMain.on('close-current-window', (event) => {
    const webContents = event.sender;
    const window = BrowserWindow.fromWebContents(webContents);
    if (window) {
      window.close();
    }
  });

  // Specific sub-window control handlers
  ipcMain.on('dialog-window-minimize', (event) => {
    const webContents = event.sender;
    const window = BrowserWindow.fromWebContents(webContents);
    if (window) {
      window.minimize();
    }
  });

  ipcMain.on('dialog-window-close', (event) => {
    const webContents = event.sender;
    const window = BrowserWindow.fromWebContents(webContents);
    if (window) {
      window.close();
    }
  });
}
