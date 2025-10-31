/**
 * @fileoverview IPC handlers coordinating auto-update operations between renderer dialogs and the main process.
 *
 * Registers invoke handlers and event forwarding for the AutoUpdateService:
 * - Manual update checks and downloads triggered from settings or dialogs
 * - Platform-aware installation commands (auto on Windows, manual on macOS/Linux)
 * - Release page fallback for Linux users
 * - Channel switching between stable and alpha streams
 * - State change broadcasting to main window and update dialog renderer
 *
 * Integration Points:
 * - AutoUpdateService for core update lifecycle
 * - ConfigManager for storing user preferences (channel)
 * - WindowManager + Dialog factory for update notification dialog management
 */

import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { ConfigManager } from '../../managers/ConfigManager';
import type { getWindowManager } from '../../windows/WindowManager';
import { getAutoUpdateService, UpdateState, type UpdateStatePayload } from '../../services/AutoUpdateService';
import { createUpdateAvailableDialog } from '../../windows/factories/DialogWindowFactory';

type WindowManager = ReturnType<typeof getWindowManager>;

let handlersRegistered = false;

/**
 * Register auto-update IPC handlers (idempotent).
 */
export function registerUpdateHandlers(configManager: ConfigManager, windowManager: WindowManager): void {
  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  const updateService = getAutoUpdateService();

  ipcMain.handle('check-for-updates', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await updateService.checkForUpdates();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('download-update', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await updateService.downloadUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('install-update', (): { success: boolean; error?: string } => {
    try {
      updateService.quitAndInstall();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('open-installer', (): { success: boolean; error?: string } => {
    try {
      updateService.openDownloadedFile();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('open-release-page', (): { success: boolean } => {
    updateService.openReleasePage();
    return { success: true };
  });

  ipcMain.handle('get-update-status', () => {
    const error = updateService.getLastError();
    return {
      state: updateService.getState(),
      updateInfo: updateService.getUpdateInfo(),
      downloadProgress: updateService.getDownloadProgress(),
      error: error ? { message: error.message } : null,
      currentVersion: app.getVersion(),
      supportsDownload: updateService.supportsDownload()
    };
  });

  ipcMain.handle('set-update-channel', async (_event: IpcMainInvokeEvent, channel: 'stable' | 'alpha') => {
    const normalized = channel === 'alpha' ? 'alpha' : 'stable';
    configManager.set('UpdateChannel', normalized);
    updateService.setUpdateChannel(normalized);
    return { success: true };
  });

  const broadcastState = (payload: UpdateStatePayload): void => {
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-state-changed', payload);
    }

    const dialogWindow = windowManager.getUpdateDialogWindow();
    if (dialogWindow && !dialogWindow.isDestroyed()) {
      dialogWindow.webContents.send('update-state-changed', payload);
    }
  };

  updateService.on('state-changed', (payload) => {
    broadcastState(payload);

    if (payload.state === UpdateState.AVAILABLE || payload.state === UpdateState.DOWNLOADED) {
      const updateVersion = payload.updateInfo?.version;

      if (updateVersion && !windowManager.hasUpdateDialogWindow()) {
        void createUpdateAvailableDialog();
      }
    }
  });
}
