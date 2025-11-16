/**
 * @fileoverview Helper for creating and managing the Spoolman offline warning dialog.
 */

import { BrowserWindow } from 'electron';
import * as path from 'path';
import { getWindowManager } from '../WindowManager';
import { createModalWindow, loadWindowHTML, setupDevTools, setupWindowLifecycle, validateParentWindow } from '../shared/WindowConfig';
import { createPreloadPath, createWindowHeight, createWindowMinHeight, createWindowMinWidth, createWindowWidth } from '../shared/WindowTypes';
import type { WindowDimensions } from '../shared/WindowTypes';
import { isHeadlessMode } from '../../utils/HeadlessDetection';

let offlineDialogWindow: BrowserWindow | null = null;

const DIALOG_SIZE: WindowDimensions = {
  width: createWindowWidth(420),
  height: createWindowHeight(420),
  minWidth: createWindowMinWidth(360),
  minHeight: createWindowMinHeight(340)
};

export const showSpoolmanOfflineDialog = (message?: string | null): void => {
  if (isHeadlessMode()) {
    console.warn('[SpoolmanOfflineDialog] Attempted to show dialog in headless mode');
    return;
  }

  const windowManager = getWindowManager();
  const parentWindow = windowManager.getMainWindow();

  if (!validateParentWindow(parentWindow, 'Spoolman offline dialog')) {
    return;
  }

  if (offlineDialogWindow && !offlineDialogWindow.isDestroyed()) {
    offlineDialogWindow.focus();
    if (message) {
      offlineDialogWindow.webContents.send('spoolman-offline:update-status', message);
    }
    return;
  }

  offlineDialogWindow = createModalWindow(
    parentWindow,
    DIALOG_SIZE,
    createPreloadPath(path.join(__dirname, '../../ui/spoolman-offline-dialog/spoolman-offline-dialog-preload.js')),
    { resizable: false, frame: false }
  );

  void loadWindowHTML(offlineDialogWindow, 'spoolman-offline-dialog');

  setupWindowLifecycle(
    offlineDialogWindow,
    () => {
      offlineDialogWindow = null;
    }
  );

  setupDevTools(offlineDialogWindow);

  if (message) {
    offlineDialogWindow.webContents.once('did-finish-load', () => {
      offlineDialogWindow?.webContents.send('spoolman-offline:update-status', message);
    });
  }
};

export const hideSpoolmanOfflineDialog = (): void => {
  if (offlineDialogWindow && !offlineDialogWindow.isDestroyed()) {
    offlineDialogWindow.close();
    offlineDialogWindow = null;
  }
};

export const isSpoolmanOfflineDialogVisible = (): boolean => {
  return Boolean(offlineDialogWindow && !offlineDialogWindow.isDestroyed());
};
