/**
 * @fileoverview Per-Printer Settings IPC Handlers
 *
 * Handles IPC communication for per-printer settings (camera, LEDs, legacy mode).
 * Settings are stored per-printer in printer_details.json.
 */

import { ipcMain } from 'electron';
import { getPrinterDetailsManager } from '../../managers/PrinterDetailsManager';
import { getPrinterContextManager } from '../../managers/PrinterContextManager';

/**
 * Per-printer settings interface
 */
export interface PrinterSettings {
  customCameraEnabled?: boolean;
  customCameraUrl?: string;
  customLedsEnabled?: boolean;
  forceLegacyMode?: boolean;
}

/**
 * Initialize per-printer settings IPC handlers
 */
export function initializePrinterSettingsHandlers(): void {
  const printerDetailsManager = getPrinterDetailsManager();
  const contextManager = getPrinterContextManager();

  /**
   * Get per-printer settings for active context
   */
  ipcMain.handle('printer-settings:get', async (): Promise<PrinterSettings | null> => {
    try {
      const activeContext = contextManager.getActiveContext();
      if (!activeContext) {
        console.warn('[printer-settings:get] No active context');
        return null;
      }

      console.log('[printer-settings:get] Active context:', activeContext.id);
      console.log('[printer-settings:get] Printer details:', activeContext.printerDetails);

      const { customCameraEnabled, customCameraUrl, customLedsEnabled, forceLegacyMode } = activeContext.printerDetails;

      const settings = {
        customCameraEnabled,
        customCameraUrl,
        customLedsEnabled,
        forceLegacyMode
      };

      console.log('[printer-settings:get] Returning settings:', settings);
      return settings;
    } catch (error) {
      console.error('[printer-settings:get] Error:', error);
      return null;
    }
  });

  /**
   * Update per-printer settings for active context
   */
  ipcMain.handle('printer-settings:update', async (_event, settings: PrinterSettings): Promise<boolean> => {
    try {
      console.log('[printer-settings:update] Received settings update:', settings);

      const activeContext = contextManager.getActiveContext();
      if (!activeContext) {
        console.warn('[printer-settings:update] No active context');
        return false;
      }

      console.log('[printer-settings:update] Active context:', activeContext.id);
      console.log('[printer-settings:update] Current printer details:', activeContext.printerDetails);

      // Get current printer details
      const currentDetails = activeContext.printerDetails;

      // Merge with new settings
      const updatedDetails = {
        ...currentDetails,
        ...settings
      };

      console.log('[printer-settings:update] Updated details to save:', updatedDetails);

      // Save updated details
      await printerDetailsManager.savePrinter(updatedDetails, activeContext.id);

      // Update the context's printer details in memory
      contextManager.updatePrinterDetails(activeContext.id, updatedDetails);

      console.log(`[printer-settings:update] Successfully updated settings for ${currentDetails.Name}`);
      return true;
    } catch (error) {
      console.error('[printer-settings:update] Error:', error);
      return false;
    }
  });

  /**
   * Get printer name for active context (for UI display)
   */
  ipcMain.handle('printer-settings:get-printer-name', async (): Promise<string | null> => {
    try {
      const activeContext = contextManager.getActiveContext();
      if (!activeContext) {
        return null;
      }

      return activeContext.printerDetails.Name;
    } catch (error) {
      console.error('[printer-settings:get-printer-name] Error:', error);
      return null;
    }
  });

  console.log('Per-printer settings IPC handlers initialized');
}

/**
 * Cleanup per-printer settings handlers
 */
export function disposePrinterSettingsHandlers(): void {
  ipcMain.removeHandler('printer-settings:get');
  ipcMain.removeHandler('printer-settings:update');
  ipcMain.removeHandler('printer-settings:get-printer-name');
}
