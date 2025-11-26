/**
 * @fileoverview IPC handlers for theme-related operations.
 */

import { ipcMain } from 'electron';
import { getConfigManager } from '../../managers/ConfigManager.js';
import type {
  ThemeProfileAddData,
  ThemeProfileUpdateData,
  ThemeProfileDeleteData,
} from '../../types/config.js';

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
}
