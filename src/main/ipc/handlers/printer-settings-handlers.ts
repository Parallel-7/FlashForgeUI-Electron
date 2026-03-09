/**
 * @fileoverview Per-Printer Settings IPC Handlers
 *
 * Handles IPC communication for per-printer settings (camera, LEDs, legacy mode).
 * Settings are stored per-printer in printer_details.json.
 */

import {
  applyPerPrinterDefaults,
  normalizeCustomCameraSettings,
  PER_PRINTER_SETTINGS_DEFAULTS,
} from '@shared/utils/printerSettingsDefaults.js';
import { ipcMain } from 'electron';
import { getPrinterContextManager } from '../../managers/PrinterContextManager.js';
import { getPrinterDetailsManager } from '../../managers/PrinterDetailsManager.js';

/**
 * Per-printer settings interface
 */
export interface PrinterSettings {
  customCameraEnabled?: boolean;
  customCameraUrl?: string;
  customLedsEnabled?: boolean;
  forceLegacyMode?: boolean;
  webUIEnabled?: boolean;
  showCameraFps?: boolean;
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

      const details = activeContext.printerDetails;

      // Apply defaults for any missing per-printer settings
      const settings: PrinterSettings = applyPerPrinterDefaults({
        customCameraEnabled: details.customCameraEnabled ?? PER_PRINTER_SETTINGS_DEFAULTS.customCameraEnabled,
        customCameraUrl: details.customCameraUrl ?? PER_PRINTER_SETTINGS_DEFAULTS.customCameraUrl,
        customLedsEnabled: details.customLedsEnabled ?? PER_PRINTER_SETTINGS_DEFAULTS.customLedsEnabled,
        forceLegacyMode: details.forceLegacyMode ?? PER_PRINTER_SETTINGS_DEFAULTS.forceLegacyMode,
        webUIEnabled: details.webUIEnabled ?? PER_PRINTER_SETTINGS_DEFAULTS.webUIEnabled,
        showCameraFps: details.showCameraFps ?? PER_PRINTER_SETTINGS_DEFAULTS.showCameraFps,
      });

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

      // Get current printer details
      const currentDetails = activeContext.printerDetails;

      // Apply centralized defaults for any missing per-printer settings
      const settingsWithDefaults: PrinterSettings = applyPerPrinterDefaults({
        ...settings,
        customCameraEnabled: settings.customCameraEnabled ?? PER_PRINTER_SETTINGS_DEFAULTS.customCameraEnabled,
        customCameraUrl: settings.customCameraUrl ?? PER_PRINTER_SETTINGS_DEFAULTS.customCameraUrl,
        customLedsEnabled: settings.customLedsEnabled ?? PER_PRINTER_SETTINGS_DEFAULTS.customLedsEnabled,
        forceLegacyMode: settings.forceLegacyMode ?? PER_PRINTER_SETTINGS_DEFAULTS.forceLegacyMode,
        webUIEnabled: settings.webUIEnabled ?? PER_PRINTER_SETTINGS_DEFAULTS.webUIEnabled,
        showCameraFps: settings.showCameraFps ?? PER_PRINTER_SETTINGS_DEFAULTS.showCameraFps,
      });

      // Remove explicit undefined values so validation sees either a boolean or the existing value
      for (const key of Object.keys(settingsWithDefaults) as Array<keyof PrinterSettings>) {
        if (settingsWithDefaults[key] === undefined) {
          delete settingsWithDefaults[key];
        }
      }

      const updatedDetails = normalizeCustomCameraSettings({
        ...currentDetails,
        ...settingsWithDefaults,
      });

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
