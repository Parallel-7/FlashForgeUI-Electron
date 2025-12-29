/**
 * @fileoverview IPC handlers for theme-related operations.
 */

import type {
  ThemeColors,
  ThemeProfileAddData,
  ThemeProfileDeleteData,
  ThemeProfileUpdateData,
} from '@shared/types/config.js';
import { BrowserWindow, ipcMain } from 'electron';
import { getConfigManager } from '../../managers/ConfigManager.js';

interface ThemeProfileOperationEvent {
  uiType: 'desktop' | 'web';
  operation: 'add' | 'update' | 'delete';
  data: ThemeProfileAddData | ThemeProfileUpdateData | ThemeProfileDeleteData;
}

export function registerThemeHandlers(): void {
  ipcMain.on('theme-profile-operation', (_event, payload: ThemeProfileOperationEvent) => {
    const configManager = getConfigManager();
    const { uiType, operation, data } = payload;

    switch (operation) {
      case 'add': {
        const addData = data as ThemeProfileAddData;
        configManager.addThemeProfile(uiType, addData.name, addData.colors);
        break;
      }
      case 'update': {
        const updateData = data as ThemeProfileUpdateData;
        configManager.updateThemeProfile(uiType, updateData.originalName, updateData.updatedProfile);
        break;
      }
      case 'delete': {
        const deleteData = data as ThemeProfileDeleteData;
        configManager.deleteThemeProfile(uiType, deleteData.name);
        break;
      }
    }
  });

  // Broadcast theme changes to all open windows (main window + dialogs)
  ipcMain.on('theme-updated', (_event, theme: ThemeColors) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('theme-changed', theme);
      }
    });
  });
}
