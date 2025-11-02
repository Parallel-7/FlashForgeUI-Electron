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
 * Validate payload for shortcut button configuration
 * @param value - Unknown value received from IPC
 * @returns True when value matches ShortcutButtonConfig shape
 */
function isShortcutButtonConfig(value: unknown): value is ShortcutButtonConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.version !== 'number' || typeof candidate.lastModified !== 'string') {
    return false;
  }

  if (typeof candidate.slots !== 'object' || candidate.slots === null) {
    return false;
  }

  const slots = candidate.slots as Record<string, unknown>;
  return ['slot1', 'slot2', 'slot3'].every((slotKey) => {
    const slotValue = slots[slotKey];
    return typeof slotValue === 'string' || slotValue === null;
  });
}

/**
 * Validate response payload for saveConfig action
 * @param value - Unknown value received from IPC
 * @returns True when value includes a success flag and optional error message
 */
function isSaveConfigResult(
  value: unknown
): value is { success: boolean; error?: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.success !== 'boolean') {
    return false;
  }

  if (candidate.error !== undefined && typeof candidate.error !== 'string') {
    return false;
  }

  return true;
}

/**
 * Validate component info arrays returned from IPC
 * @param value - Unknown value received from IPC
 * @returns True when array members match ComponentInfo structure
 */
function isComponentInfoArray(value: unknown): value is ComponentInfo[] {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return false;
    }

    const candidate = entry as Record<string, unknown>;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.name === 'string' &&
      typeof candidate.icon === 'string' &&
      typeof candidate.category === 'string' &&
      typeof candidate.isPinned === 'boolean'
    );
  });
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
    const result = await ipcRenderer.invoke('shortcut-config:get-current') as unknown;

    if (result === null) {
      return null;
    }

    if (isShortcutButtonConfig(result)) {
      return {
        version: result.version,
        slots: {
          slot1: result.slots.slot1 ?? null,
          slot2: result.slots.slot2 ?? null,
          slot3: result.slots.slot3 ?? null,
        },
        lastModified: result.lastModified,
      };
    }

    console.error('[ShortcutConfigPreload] Invalid shortcut configuration payload received', result);
    return null;
  },

  /**
   * Save shortcut configuration
   */
  saveConfig: async (
    config: ShortcutButtonConfig
  ): Promise<{ success: boolean; error?: string }> => {
    const response = await ipcRenderer.invoke('shortcut-config:save', config) as unknown;

    if (isSaveConfigResult(response)) {
      return response;
    }

    console.error('[ShortcutConfigPreload] Invalid save response payload received', response);
    return { success: false, error: 'Invalid response from main process' };
  },

  /**
   * Get available components with pinned status
   */
  getAvailableComponents: async (): Promise<ComponentInfo[]> => {
    const result = await ipcRenderer.invoke('shortcut-config:get-available-components') as unknown;

    if (isComponentInfoArray(result)) {
      return result.map((component) => ({
        id: component.id,
        name: component.name,
        icon: component.icon,
        category: component.category,
        isPinned: component.isPinned,
      }));
    }

    console.error('[ShortcutConfigPreload] Invalid component list payload received', result);
    return [];
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
