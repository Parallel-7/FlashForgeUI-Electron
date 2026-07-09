/**
 * @fileoverview IPC handlers for the centralized per-printer SSH settings.
 *
 * Backs the Settings dialog's SSH tab. All handlers operate on the active
 * printer context and store credentials by serial number via SSHSettingsService:
 * - 'ssh-settings:get' (invoke): resolved settings + printer name
 * - 'ssh-settings:save' (invoke): apply a partial update from the settings UI
 * - 'ssh-settings:reset' (invoke): restore the easy-SSH defaults
 *
 * Key exports:
 * - registerSSHSettingsHandlers(): called once during app initialization
 */

import { ipcMain } from 'electron';
import type { SSHSettingsResponse, SSHSettingsUpdate } from '@shared/types/ssh-settings.js';
import { getPrinterContextManager } from '../../managers/PrinterContextManager.js';
import { getSSHSettingsService } from '../../services/SSHSettingsService.js';

/** Resolve the active printer's serial number and display name. */
function resolveActivePrinter(): { serialNumber: string; printerName: string } | null {
  const context = getPrinterContextManager().getActiveContext();
  if (!context) {
    return null;
  }
  return {
    serialNumber: context.printerDetails.SerialNumber,
    printerName: context.printerDetails.Name,
  };
}

/**
 * Register SSH settings IPC handlers.
 */
export function registerSSHSettingsHandlers(): void {
  ipcMain.handle('ssh-settings:get', async (): Promise<SSHSettingsResponse> => {
    const printer = resolveActivePrinter();
    if (!printer) {
      return { settings: null, error: 'No printer is connected' };
    }

    const settings = await getSSHSettingsService().getSettings(printer.serialNumber);
    return { settings, printerName: printer.printerName };
  });

  ipcMain.handle('ssh-settings:save', async (_event, update: SSHSettingsUpdate): Promise<boolean> => {
    const printer = resolveActivePrinter();
    if (!printer || !update || typeof update !== 'object') {
      return false;
    }

    try {
      await getSSHSettingsService().updateSettings(printer.serialNumber, update);
      return true;
    } catch (error) {
      console.error('[SSHSettings Handlers] Failed to save SSH settings:', error);
      return false;
    }
  });

  ipcMain.handle('ssh-settings:reset', async (): Promise<boolean> => {
    const printer = resolveActivePrinter();
    if (!printer) {
      return false;
    }

    try {
      await getSSHSettingsService().resetSettings(printer.serialNumber);
      return true;
    } catch (error) {
      console.error('[SSHSettings Handlers] Failed to reset SSH settings:', error);
      return false;
    }
  });

  console.log('[SSHSettings Handlers] SSH settings IPC handlers registered');
}
