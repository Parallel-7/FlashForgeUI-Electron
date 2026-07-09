/**
 * @fileoverview IPC handlers for the SFTP-based printer file manager dialog.
 *
 * Bridges the file manager dialog renderer to the main-process
 * FileManagerService, pinned to the printer context that was active when the
 * dialog was opened (see pinnedContextId). Switching the active printer tab
 * while the dialog is open does NOT retarget subsequent operations onto the
 * new printer; each operation resolves the pinned context, not the active one:
 * - 'file-manager:open' (send): open the file manager window (captures pin)
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
import { getWindowManager } from '../../windows/WindowManager.js';

/**
 * Context pinned to the file manager window. Captured at 'file-manager:open'
 * time from the then-active context and held for the window's lifetime so that
 * switching the active printer tab while the dialog is open does NOT silently
 * retarget delete/rename/list/thumbnail calls onto a different printer. Reset
 * to null when the window closes (see the open handler's 'closed' hook).
 * Single-instance dialog: one window <-> one pinned context.
 */
let pinnedContextId: string | null = null;

/**
 * Resolve the PINNED printer context into a FileManagerTarget. Returns null
 * when no pin is set (window not open) or the pinned context was removed
 * (disconnected while the dialog was open); callers surface NO_PRINTER_ERROR.
 */
function resolvePinnedTarget(): FileManagerTarget | null {
  if (pinnedContextId === null) {
    return null;
  }

  // getContext returns undefined for a removed context -> null (safe error path).
  const context = getPrinterContextManager().getContext(pinnedContextId);
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
    // Single-instance dialog: if a window is already open, the factory focuses
    // it and we preserve the existing pin (one window <-> one pinned context).
    if (getWindowManager().hasFileManagerWindow()) {
      createFileManagerWindow();
      return;
    }

    // Capture the context that is active at open time (may be null if no
    // printer is connected yet -- the dialog then shows "no printer").
    const activeContext = getPrinterContextManager().getActiveContext();

    createFileManagerWindow();

    const window = getWindowManager().getFileManagerWindow();
    if (!window || window.isDestroyed()) {
      return; // Window creation failed; leave the pin unset.
    }

    // Pin all subsequent operations to this context for the window's lifetime.
    pinnedContextId = activeContext ? activeContext.id : null;

    // Release the pin on close so the next open re-captures the active context.
    window.on('closed', () => {
      pinnedContextId = null;
    });
  });

  ipcMain.handle('file-manager:get-capabilities', async () => {
    const target = resolvePinnedTarget();
    if (!target) {
      return { supported: false, reason: NO_PRINTER_ERROR, usbPresent: false, usbMounts: [] };
    }
    return getFileManagerService().getCapabilities(target);
  });

  ipcMain.handle('file-manager:list-files', async (_event, storage: FileManagerStorageKind, path: string) => {
    const target = resolvePinnedTarget();
    if (!target) {
      return { success: false, storage, path, rootPath: '', entries: [], error: NO_PRINTER_ERROR };
    }
    return getFileManagerService().listFiles(target, storage, typeof path === 'string' ? path : '');
  });

  ipcMain.handle('file-manager:delete-files', async (_event, storage: FileManagerStorageKind, paths: string[]) => {
    const target = resolvePinnedTarget();
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
      const target = resolvePinnedTarget();
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
    const target = resolvePinnedTarget();
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
