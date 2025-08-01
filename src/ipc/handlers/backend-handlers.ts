/**
 * Backend-related IPC handlers for printer status and data operations.
 * Handles all backend data requests including status, preview, and feature queries.
 */

import { ipcMain } from 'electron';
import type { PrinterBackendManager } from '../../managers/PrinterBackendManager';
import type { getWindowManager } from '../../windows/WindowManager';

type WindowManager = ReturnType<typeof getWindowManager>;

/**
 * Register all backend-related IPC handlers
 */
export function registerBackendHandlers(
  backendManager: PrinterBackendManager,
  _windowManager: WindowManager
): void {
  // Note: Polling is now handled centrally in the main process via MainProcessPollingCoordinator
  // The renderer receives updates through the 'polling-update' IPC channel

  // Handle model preview requests
  ipcMain.handle('request-model-preview', async () => {
    try {
      if (!backendManager.isBackendReady()) {
        console.log('Backend not ready for model preview request');
        return null;
      }
      
      const preview = await backendManager.getModelPreview();
      console.log('IPC returning model preview:', preview ? 'Data available' : 'No preview');
      return preview;
    } catch (error) {
      console.error('Error getting model preview via IPC:', error);
      return null;
    }
  });

  // Handle general printer data requests (for legacy compatibility)
  ipcMain.on('request-printer-data', async (event) => {
    try {
      if (!backendManager.isBackendReady()) {
        event.sender.send('printer-data', null);
        return;
      }
      
      const [printerStatus, materialStatus] = await Promise.allSettled([
        backendManager.getPrinterStatus(),
        Promise.resolve(backendManager.getMaterialStationStatus())
      ]);
      
      const data = {
        printerStatus: printerStatus.status === 'fulfilled' ? printerStatus.value : null,
        materialStation: materialStatus.status === 'fulfilled' ? materialStatus.value : null,
        timestamp: new Date().toISOString()
      };
      
      event.sender.send('printer-data', data);
    } catch (error) {
      console.error('Error getting printer data via IPC:', error);
      event.sender.send('printer-data', null);
    }
  });

  // Get material station status handler
  ipcMain.handle('get-material-station-status', async () => {
    try {
      if (!backendManager.isBackendReady()) {
        console.log('Backend not ready for material station status request');
        return null;
      }
      
      const status = backendManager.getMaterialStationStatus();
      console.log('IPC returning material station status:', status);
      return status;
    } catch (error) {
      console.error('Error getting material station status via IPC:', error);
      return null;
    }
  });

  // Get printer features handler
  ipcMain.handle('printer:get-features', async () => {
    try {
      const backendManager = await import('../../managers/PrinterBackendManager').then(m => m.getPrinterBackendManager());
      const features = backendManager.getFeatures();
      const capabilities = backendManager.getBackendCapabilities();
      console.log('IPC printer:get-features - features:', features);
      console.log('IPC printer:get-features - capabilities:', capabilities);
      console.log('IPC printer:get-features - modelType:', capabilities?.modelType);
      
      // Return both features and modelType
      return {
        ...features,
        modelType: capabilities?.modelType
      };
    } catch (error) {
      console.error('Failed to get printer features:', error);
      return null;
    }
  });
}
