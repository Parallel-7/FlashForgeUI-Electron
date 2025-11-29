/**
 * @fileoverview Backend-related IPC handlers for printer status and data retrieval operations.
 *
 * Provides IPC handlers for accessing printer backend data in multi-context environment:
 * - Model preview retrieval for current print jobs
 * - General printer data requests (legacy compatibility)
 * - Material station status queries
 * - Printer feature detection and capability information
 *
 * Key exports:
 * - registerBackendHandlers(): Registers all backend-related IPC handlers
 *
 * All handlers are context-aware and operate on the active printer context by default.
 * The centralized polling system (MainProcessPollingCoordinator) provides real-time updates
 * via the 'polling-update' IPC channel, reducing the need for manual polling from renderer.
 */

import { ipcMain } from 'electron';
import type { PrinterBackendManager } from '../../managers/PrinterBackendManager.js';
import type { getWindowManager } from '../../windows/WindowManager.js';
import { getPrinterContextManager } from '../../managers/PrinterContextManager.js';

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
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        console.log('No active printer context for model preview request');
        return null;
      }

      if (!backendManager.isBackendReady(contextId)) {
        console.log('Backend not ready for model preview request');
        return null;
      }

      const preview = await backendManager.getModelPreview(contextId);
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
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        event.sender.send('printer-data', null);
        return;
      }

      if (!backendManager.isBackendReady(contextId)) {
        event.sender.send('printer-data', null);
        return;
      }

      const [printerStatus, materialStatus] = await Promise.allSettled([
        backendManager.getPrinterStatus(contextId),
        Promise.resolve(backendManager.getMaterialStationStatus(contextId))
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
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        console.log('No active printer context for material station status request');
        return null;
      }

      if (!backendManager.isBackendReady(contextId)) {
        console.log('Backend not ready for material station status request');
        return null;
      }

      const status = backendManager.getMaterialStationStatus(contextId);
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
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        console.log('No active printer context for features request');
        return null;
      }

      const backendManager = await import('../../managers/PrinterBackendManager.js').then(m => m.getPrinterBackendManager());
      const features = backendManager.getFeatures(contextId);
      const capabilities = backendManager.getBackendCapabilities(contextId);
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

