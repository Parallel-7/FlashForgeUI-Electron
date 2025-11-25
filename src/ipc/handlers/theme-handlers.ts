/**
 * @fileoverview IPC handlers for theme-related operations.
 */

import { ipcMain } from 'electron';
import { getConfigManager } from '../../managers/ConfigManager.js';

export function registerThemeHandlers(): void {
  ipcMain.on('theme-profile-operation', (_event, { uiType, operation, data }) => {
    const configManager = getConfigManager();
    switch (operation) {
      case 'add':
        configManager.addThemeProfile(uiType, data.name, data.colors);
        break;
      case 'update':
        configManager.updateThemeProfile(uiType, data.originalName, data.updatedProfile);
        break;
      case 'delete':
        configManager.deleteThemeProfile(uiType, data.name);
        break;
    }
  });
}
