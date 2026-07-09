/**
 * @fileoverview IPC handlers for the SFTP-based printer file manager dialog.
 *
 * Bridges the file manager dialog renderer to the main-process
 * FileManagerService, always operating on the active printer context:
 * - 'file-manager:open' (send): open the file manager window
 * - 'file-manager:get-capabilities' (invoke): model support + USB probe
 * - 'file-manager:list-files' (invoke): list a storage location
 * - 'file-manager:delete-files' (invoke): batch delete with per-file outcomes
 * - 'file-manager:rename-file' (invoke): rename a file in place
 * - 'file-manager:get-thumbnail' (invoke): cached/remote thumbnail fetch
 *
 * Key exports:
 * - registerFileManagerHandlers(): called once during app initialization
 */

import { ipcMain } from 'electron';
import type { FileManagerStorageKind } from '@shared/types/file-manager.js';
import { getPrinterContextManager } from '../../managers/PrinterContextManager.js';
import { type FileManagerTarget, getFileManagerService } from '../../services/FileManagerService.js';
import { createFileManagerWindow } from '../../windows/factories/UtilityWindowFactory.js';

/** Resolve the active printer context into a FileManagerTarget. */
function resolveActiveTarget(): FileManagerTarget | null {
  const context = getPrinterContextManager().getActiveContext();
  if (!context) {
    return null;
  }

  const details = context.printerDetails;
  return {
    contextId: context.id,
    ipAddress: details.IPAddress,
    serialNumber: details.SerialNumber,
    printerName: details.Name,
    modelType: details.modelType,
  };
}

const NO_PRINTER_ERROR = 'No printer is connected';

/**
 * Register all file manager IPC handlers.
 */
export function registerFileManagerHandlers(): void {
  console.log('[FileManager Handlers] Registering file manager IPC handlers...');

  ipcMain.on('file-manager:open', () => {
    createFileManagerWindow();
  });

  ipcMain.handle('file-manager:get-capabilities', async () => {
    const target = resolveActiveTarget();
    if (!target) {
      return { supported: false, reason: NO_PRINTER_ERROR, usbPresent: false, usbMounts: [] };
    }
    return getFileManagerService().getCapabilities(target);
  });

  ipcMain.handle('file-manager:list-files', async (_event, storage: FileManagerStorageKind, path: string) => {
    const target = resolveActiveTarget();
    if (!target) {
      return { success: false, storage, path, rootPath: '', entries: [], error: NO_PRINTER_ERROR };
    }
    return getFileManagerService().listFiles(target, storage, typeof path === 'string' ? path : '');
  });

  ipcMain.handle('file-manager:delete-files', async (_event, storage: FileManagerStorageKind, paths: string[]) => {
    const target = resolveActiveTarget();
    if (!target) {
      return { success: false, outcomes: [], error: NO_PRINTER_ERROR };
    }
    if (!Array.isArray(paths) || paths.some((path) => typeof path !== 'string')) {
      return { success: false, outcomes: [], error: 'Invalid delete request' };
    }
    return getFileManagerService().deleteFiles(target, storage, paths);
  });

  ipcMain.handle(
    'file-manager:rename-file',
    async (_event, storage: FileManagerStorageKind, path: string, newName: string) => {
      const target = resolveActiveTarget();
      if (!target) {
        return { success: false, error: NO_PRINTER_ERROR };
      }
      if (typeof path !== 'string' || typeof newName !== 'string') {
        return { success: false, error: 'Invalid rename request' };
      }
      return getFileManagerService().renameFile(target, storage, path, newName);
    }
  );

  ipcMain.handle('file-manager:get-thumbnail', async (_event, storage: FileManagerStorageKind, path: string) => {
    const target = resolveActiveTarget();
    if (!target) {
      return { success: false, error: NO_PRINTER_ERROR };
    }
    if (typeof path !== 'string') {
      return { success: false, error: 'Invalid thumbnail request' };
    }
    return getFileManagerService().getThumbnail(target, storage, path);
  });

  console.log('[FileManager Handlers] File manager IPC handlers registered');
}
