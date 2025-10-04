/**
 * Printer control IPC handlers for temperature, LED, print control, and other operations.
 * Handles all direct printer control commands including G-code operations.
 */

import { ipcMain } from 'electron';
import { FiveMClient, FlashForgeClient } from 'ff-api';
import type { PrinterBackendManager } from '../../managers/PrinterBackendManager';
import type { BasePrinterBackend } from '../../printer-backends/BasePrinterBackend';
import { getPrinterContextManager } from '../../managers/PrinterContextManager';

/**
 * Helper to get the legacy client (for G-code operations)
 */
function getLegacyClient(backend: BasePrinterBackend): FlashForgeClient | null {
  // For dual-API backends, use secondary client
  // For legacy backends, primary client IS the legacy client
  const client = backend.getSecondaryClient() || backend.getPrimaryClient();

  // Ensure it's a FlashForgeClient
  if (client instanceof FlashForgeClient) {
    return client;
  }

  return null;
}

/**
 * Register all printer control related IPC handlers
 */
export function registerControlHandlers(backendManager: PrinterBackendManager): void {
  // Temperature control handlers - always use legacy client for G-code
  ipcMain.handle('set-bed-temp', async (event, temperature: number) => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      if (!backendManager.isBackendReady(contextId)) {
        return { success: false, error: 'Printer not connected' };
      }

      const backend = backendManager.getBackendForContext(contextId);
      if (!backend) {
        return { success: false, error: 'Backend not available' };
      }

      const legacyClient = getLegacyClient(backend);
      if (!legacyClient) {
        return { success: false, error: 'Temperature control not available' };
      }

      const result = await legacyClient.setBedTemp(temperature);
      console.log(`Set bed temperature to ${temperature}°C`, result);
      return { success: result, data: result };
    } catch (error) {
      console.error('Error setting bed temperature:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('set-extruder-temp', async (event, temperature: number) => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      if (!backendManager.isBackendReady(contextId)) {
        return { success: false, error: 'Printer not connected' };
      }

      const backend = backendManager.getBackendForContext(contextId);
      if (!backend) {
        return { success: false, error: 'Backend not available' };
      }

      const legacyClient = getLegacyClient(backend);
      if (!legacyClient) {
        return { success: false, error: 'Temperature control not available' };
      }

      const result = await legacyClient.setExtruderTemp(temperature);
      console.log(`Set extruder temperature to ${temperature}°C`, result);
      return { success: result, data: result };
    } catch (error) {
      console.error('Error setting extruder temperature:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('turn-off-bed-temp', async () => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      if (!backendManager.isBackendReady(contextId)) {
        return { success: false, error: 'Printer not connected' };
      }

      const backend = backendManager.getBackendForContext(contextId);
      if (!backend) {
        return { success: false, error: 'Backend not available' };
      }

      const legacyClient = getLegacyClient(backend);
      if (!legacyClient) {
        return { success: false, error: 'Temperature control not available' };
      }

      const result = await legacyClient.cancelBedTemp();
      console.log('Turned off bed temperature', result);
      return { success: result, data: result };
    } catch (error) {
      console.error('Error turning off bed temperature:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('turn-off-extruder-temp', async () => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      if (!backendManager.isBackendReady(contextId)) {
        return { success: false, error: 'Printer not connected' };
      }

      const backend = backendManager.getBackendForContext(contextId);
      if (!backend) {
        return { success: false, error: 'Backend not available' };
      }

      const legacyClient = getLegacyClient(backend);
      if (!legacyClient) {
        return { success: false, error: 'Temperature control not available' };
      }

      const result = await legacyClient.cancelExtruderTemp();
      console.log('Turned off extruder temperature', result);
      return { success: result, data: result };
    } catch (error) {
      console.error('Error turning off extruder temperature:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Clear status handler (new API only - not available on legacy)
  ipcMain.handle('clear-status', async () => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      if (!backendManager.isBackendReady(contextId)) {
        return { success: false, error: 'Printer not connected' };
      }

      const backend = backendManager.getBackendForContext(contextId);
      if (!backend) {
        return { success: false, error: 'Backend not available' };
      }

      // Check if this printer supports new API (needed for clearPlatform)
      const features = backend.getBackendStatus().features;
      if (!features?.statusMonitoring.usesNewAPI) {
        return { success: false, error: 'Clear status not supported on legacy printers' };
      }

      // Use primary client (FiveMClient) for clearPlatform
      const primaryClient = backend.getPrimaryClient();
      if (!(primaryClient instanceof FiveMClient)) {
        return { success: false, error: 'Clear status requires new API client' };
      }

      const result = await primaryClient.jobControl.clearPlatform();
      console.log('Cleared platform status', result);
      return { success: result, data: result };
    } catch (error) {
      console.error('Error clearing status:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // LED control handlers
  ipcMain.handle('led-on', async () => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      if (!backendManager.isBackendReady(contextId)) {
        return { success: false, error: 'Printer not connected' };
      }

      const backend = backendManager.getBackendForContext(contextId);
      if (!backend) {
        return { success: false, error: 'Backend not available' };
      }

      const features = backend.getBackendStatus().features;
      if (!features) {
        return { success: false, error: 'Cannot determine printer features' };
      }

      if (features.ledControl.builtin) {
        // Use new API method for built-in LED (5M Pro)
        const primaryClient = backend.getPrimaryClient();
        if (!(primaryClient instanceof FiveMClient)) {
          return { success: false, error: 'Built-in LED requires new API client' };
        }

        const result = await primaryClient.control.setLedOn();
        console.log('Turned on built-in LED', result);
        return { success: result, data: result };
      } else if (features.ledControl.customControlEnabled || features.ledControl.usesLegacyAPI) {
        // Use legacy client for custom LED G-code or legacy printer LED control
        const legacyClient = getLegacyClient(backend);
        if (!legacyClient) {
          return { success: false, error: 'LED control not available' };
        }

        const result = await legacyClient.ledOn();
        console.log(`Turned on ${features.ledControl.customControlEnabled ? 'custom' : 'legacy'} LED`, result);
        return { success: result, data: result };
      }

      return { success: false, error: 'LED control not available' };
    } catch (error) {
      console.error('Error turning on LED:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('led-off', async () => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      if (!backendManager.isBackendReady(contextId)) {
        return { success: false, error: 'Printer not connected' };
      }

      const backend = backendManager.getBackendForContext(contextId);
      if (!backend) {
        return { success: false, error: 'Backend not available' };
      }

      const features = backend.getBackendStatus().features;
      if (!features) {
        return { success: false, error: 'Cannot determine printer features' };
      }

      if (features.ledControl.builtin) {
        // Use new API method for built-in LED (5M Pro)
        const primaryClient = backend.getPrimaryClient();
        if (!(primaryClient instanceof FiveMClient)) {
          return { success: false, error: 'Built-in LED requires new API client' };
        }

        const result = await primaryClient.control.setLedOff();
        console.log('Turned off built-in LED', result);
        return { success: result, data: result };
      } else if (features.ledControl.customControlEnabled || features.ledControl.usesLegacyAPI) {
        // Use legacy client for custom LED G-code or legacy printer LED control
        const legacyClient = getLegacyClient(backend);
        if (!legacyClient) {
          return { success: false, error: 'LED control not available' };
        }

        const result = await legacyClient.ledOff();
        console.log(`Turned off ${features.ledControl.customControlEnabled ? 'custom' : 'legacy'} LED`, result);
        return { success: result, data: result };
      }

      return { success: false, error: 'LED control not available' };
    } catch (error) {
      console.error('Error turning off LED:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Print control handlers - use backend manager methods which handle the routing
  ipcMain.handle('pause-print', async () => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      if (!backendManager.isBackendReady(contextId)) {
        return { success: false, error: 'Printer not connected' };
      }

      const result = await backendManager.pauseJob(contextId);
      console.log('Paused print job', result);
      return result;
    } catch (error) {
      console.error('Error pausing print:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('resume-print', async () => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      if (!backendManager.isBackendReady(contextId)) {
        return { success: false, error: 'Printer not connected' };
      }

      const result = await backendManager.resumeJob(contextId);
      console.log('Resumed print job', result);
      return result;
    } catch (error) {
      console.error('Error resuming print:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('cancel-print', async () => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      if (!backendManager.isBackendReady(contextId)) {
        return { success: false, error: 'Printer not connected' };
      }

      const result = await backendManager.cancelJob(contextId);
      console.log('Cancelled print job', result);
      return result;
    } catch (error) {
      console.error('Error cancelling print:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Home axes handler - use legacy client for G-code
  ipcMain.handle('home-axes', async () => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      if (!backendManager.isBackendReady(contextId)) {
        return { success: false, error: 'Printer not connected' };
      }

      const backend = backendManager.getBackendForContext(contextId);
      if (!backend) {
        return { success: false, error: 'Backend not available' };
      }

      const legacyClient = getLegacyClient(backend);
      if (!legacyClient) {
        return { success: false, error: 'Home axes not available' };
      }

      const result = await legacyClient.homeAxes();
      console.log('Homing all axes', result);
      return { success: result, data: result };
    } catch (error) {
      console.error('Error homing axes:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Filtration control handler (5M Pro only)
  ipcMain.handle('set-filtration', async (_event, mode: 'off' | 'internal' | 'external') => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      if (!backendManager.isBackendReady(contextId)) {
        return { success: false, error: 'Printer not connected' };
      }

      const backend = backendManager.getBackendForContext(contextId);
      if (!backend) {
        return { success: false, error: 'Backend not available' };
      }

      const features = backend.getBackendStatus().features;
      if (!features?.filtration.available) {
        return { success: false, error: 'Filtration control not available on this printer' };
      }

      // Use primary client for filtration control
      const primaryClient = backend.getPrimaryClient();
      if (!(primaryClient instanceof FiveMClient)) {
        return { success: false, error: 'Filtration control requires new API client' };
      }

      let result: boolean;
      switch (mode) {
        case 'off':
          result = await primaryClient.control.setFiltrationOff();
          console.log('Set filtration off', result);
          return { success: result, data: result };

        case 'internal':
          result = await primaryClient.control.setInternalFiltrationOn();
          console.log('Set internal filtration on', result);
          return { success: result, data: result };

        case 'external':
          result = await primaryClient.control.setExternalFiltrationOn();
          console.log('Set external filtration on', result);
          return { success: result, data: result };

        default:
          return { success: false, error: 'Invalid filtration mode' };
      }
    } catch (error) {
      console.error('Error setting filtration mode:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}
