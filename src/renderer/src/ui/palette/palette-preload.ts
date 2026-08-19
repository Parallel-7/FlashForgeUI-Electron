/**
 * @fileoverview Preload for the Component Palette window. Exposes
 * window.paletteAPI through Electron's contextBridge: component queries,
 * open/close signals, add/remove requests, and grid-status updates pushed
 * from the main window. This is the palette renderer's only bridge to
 * main-process APIs.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Ensure this file is treated as a module
export {};

// Type definition for component definition
interface ComponentDefinition {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly category?: string;
}

/**
 * Validate that a value conforms to the ComponentDefinition[] structure
 * @param value - Unknown value received from ipcRenderer.invoke
 * @returns True when the value is an array of ComponentDefinition objects
 */
function isComponentDefinitionArray(value: unknown): value is ComponentDefinition[] {
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
      (candidate.category === undefined || typeof candidate.category === 'string')
    );
  });
}

// Type definition for the palette API
interface PaletteAPI {
  close: () => void;
  onUpdateStatus: (callback: (componentsInUse: string[]) => void) => void;
  notifyComponentRemove: (componentId: string) => void;
  notifyComponentAdd: (componentId: string) => void;
  getAvailableComponents: () => Promise<ComponentDefinition[]>;
  notifyOpened: () => void;
  toggleEditMode: () => void;
}

// Store the status update callback
let statusUpdateCallback: ((componentsInUse: string[], pinnedComponents?: string[]) => void) | null = null;

// Expose palette API to renderer process
contextBridge.exposeInMainWorld('paletteAPI', {
  /**
   * Close the palette window
   */
  close: (): void => {
    ipcRenderer.send('palette:close');
  },

  /**
   * Register callback for component status updates from main window
   * @param callback - Function to call when component status changes
   */
  onUpdateStatus: (callback: (componentsInUse: string[], pinnedComponents?: string[]) => void): void => {
    statusUpdateCallback = callback;

    // Listen for status updates from main process
    ipcRenderer.on('palette:update-status', (_event, componentsInUse: string[], pinnedComponents?: string[]) => {
      if (statusUpdateCallback) {
        statusUpdateCallback(componentsInUse, pinnedComponents);
      }
    });
  },

  /**
   * Notify main window that user wants to remove a component
   * @param componentId - ID of component to remove from grid
   */
  notifyComponentRemove: (componentId: string): void => {
    console.log('[Palette Preload] Notifying component removal:', componentId);
    ipcRenderer.send('palette:remove-component', componentId);
  },

  /**
   * Notify main window that user wants to add a component
   * @param componentId - ID of component to add to the grid
   */
  notifyComponentAdd: (componentId: string): void => {
    console.log('[Palette Preload] Notifying component add:', componentId);
    ipcRenderer.send('palette:add-component', componentId);
  },

  /**
   * Get all available component definitions
   * @returns Promise resolving to array of component definitions
   */
  getAvailableComponents: async (): Promise<ComponentDefinition[]> => {
    try {
      const result = (await ipcRenderer.invoke('palette:get-components')) as unknown;

      if (isComponentDefinitionArray(result)) {
        return result.map((component) => ({
          id: component.id,
          name: component.name,
          icon: component.icon,
          category: component.category,
        }));
      }

      console.error('[Palette Preload] Invalid component data received');
      return [];
    } catch (error) {
      console.error('[Palette Preload] Failed to get components:', error);
      return [];
    }
  },

  /**
   * Notify main process that palette window has opened
   */
  notifyOpened: (): void => {
    console.log('[Palette Preload] Notifying palette opened');
    ipcRenderer.send('palette:opened');
  },

  /**
   * Toggle edit mode via CTRL+E from palette window
   * Sends signal to main window to toggle edit mode
   */
  toggleEditMode: (): void => {
    console.log('[Palette Preload] Toggling edit mode from palette');
    ipcRenderer.send('palette:toggle-edit-mode');
  },

  /**
   * Listen for theme changes
   */
  receive: (channel: string, func: (...args: unknown[]) => void): void => {
    const validChannels = ['theme-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  },
} as PaletteAPI);

// Log preload initialization
console.log('[Palette Preload] Palette preload script initialized');
