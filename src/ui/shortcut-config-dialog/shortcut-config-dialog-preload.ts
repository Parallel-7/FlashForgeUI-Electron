/**
 * @fileoverview Preload script for shortcut configuration dialog
 *
 * Provides secure IPC communication bridge between the dialog renderer
 * and the main process. Exposes minimal API surface for dialog operations.
 *
 * @author FlashForgeUI Team
 * @module ui/shortcut-config-dialog/shortcut-config-dialog-preload
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Dialog initialization data
 */
interface DialogInitData {
  responseChannel: string;
}

/**
 * Shortcut configuration data structure
 */
interface ShortcutButtonConfig {
  version: number;
  slots: {
    slot1: string | null;
    slot2: string | null;
    slot3: string | null;
  };
  lastModified: string;
}

/**
 * Component info with pinned status
 */
interface ComponentInfo {
  id: string;
  name: string;
  icon: string;
  isPinned: boolean;
  category: string;
}

/**
 * Expose safe IPC API to renderer
 */
contextBridge.exposeInMainWorld('shortcutConfigAPI', {
  /**
   * Receive dialog initialization data
   */
  onDialogInit: (callback: (data: DialogInitData) => void) => {
    ipcRenderer.on('dialog-init', (_event, data: DialogInitData) => {
      callback(data);
    });
  },

  /**
   * Get current shortcut configuration
   */
  getCurrentConfig: async (): Promise<ShortcutButtonConfig | null> => {
    return ipcRenderer.invoke('shortcut-config:get-current');
  },

  /**
   * Save shortcut configuration
   */
  saveConfig: async (
    config: ShortcutButtonConfig
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('shortcut-config:save', config);
  },

  /**
   * Get available components with pinned status
   */
  getAvailableComponents: async (): Promise<ComponentInfo[]> => {
    return ipcRenderer.invoke('shortcut-config:get-available-components');
  },

  /**
   * Close the dialog
   */
  closeDialog: (responseChannel: string) => {
    void ipcRenderer.invoke(responseChannel);
  },
});

/**
 * Type declaration for window.shortcutConfigAPI
 */
declare global {
  interface Window {
    shortcutConfigAPI: {
      onDialogInit: (callback: (data: DialogInitData) => void) => void;
      getCurrentConfig: () => Promise<ShortcutButtonConfig | null>;
      saveConfig: (
        config: ShortcutButtonConfig
      ) => Promise<{ success: boolean; error?: string }>;
      getAvailableComponents: () => Promise<ComponentInfo[]>;
      closeDialog: (responseChannel: string) => void;
    };
  }
}
