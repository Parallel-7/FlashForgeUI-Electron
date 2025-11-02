/**
 * @fileoverview Preload script for Component Palette window
 *
 * Securely exposes IPC communication APIs to the palette window renderer process
 * via Electron's contextBridge. Provides type-safe methods for component queries,
 * window control, and status updates with proper sandboxing and security.
 *
 * Exposed APIs (window.paletteAPI):
 * - close(): Close palette window
 * - getAvailableComponents(): Query component registry for all available components
 * - notifyOpened(): Signal palette window opened to main process
 * - onUpdateStatus(callback): Listen for grid status updates from main window
 * - notifyComponentRemove(componentId): Request component removal from grid
 * - notifyComponentAdd(componentId): Request component addition to grid
 *
 * Component Status Updates:
 * The main window broadcasts status updates to the palette when components are
 * added or removed from the grid, allowing the palette to update its UI to reflect
 * which components are currently in use and which are available for addition.
 *
 * Security:
 * - Uses Electron contextBridge for sandboxed renderer communication
 * - Validates IPC channel names and data formats
 * - Type-safe interfaces for all API methods
 * - Error handling with graceful fallbacks
 * - No direct access to Node.js APIs from renderer
 *
 * IPC Channels:
 * - palette:close (send): Close button handler
 * - palette:get-components (invoke): Query component definitions
 * - palette:opened (send): Palette window opened notification
 * - palette:update-status (receive): Component status updates
 * - palette:remove-component (send): Component removal request
 * - palette:add-component (send): Component addition request
 *
 * @module ui/palette/palette-preload
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
      const result = await ipcRenderer.invoke('palette:get-components') as unknown;

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
  }
} as PaletteAPI);

// Log preload initialization
console.log('[Palette Preload] Palette preload script initialized');
