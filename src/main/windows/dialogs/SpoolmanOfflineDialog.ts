/**
 * @fileoverview Helper for creating and managing the Spoolman offline warning dialog.
 */

import { BrowserWindow } from 'electron';
import { isHeadlessMode } from '../../utils/HeadlessDetection.js';
import {
  createModalWindow,
  createUIPreloadPath,
  loadWindowHTML,
  setupDevTools,
  setupWindowLifecycle,
  validateParentWindow,
} from '../shared/WindowConfig.js';
import type { WindowDimensions } from '../shared/WindowTypes.js';
import {
  createWindowHeight,
  createWindowMinHeight,
  createWindowMinWidth,
  createWindowWidth,
} from '../shared/WindowTypes.js';
import { getWindowManager } from '../WindowManager.js';

let offlineDialogWindow: BrowserWindow | null = null;

const DIALOG_SIZE: WindowDimensions = {
  width: createWindowWidth(420),
  height: createWindowHeight(420),
  minWidth: createWindowMinWidth(360),
  minHeight: createWindowMinHeight(340),
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

  offlineDialogWindow = createModalWindow(parentWindow, DIALOG_SIZE, createUIPreloadPath('spoolman-offline-dialog'), {
    resizable: false,
    frame: false,
  });

  void loadWindowHTML(offlineDialogWindow, 'spoolman-offline-dialog');

  setupWindowLifecycle(offlineDialogWindow, () => {
    offlineDialogWindow = null;
  });

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
