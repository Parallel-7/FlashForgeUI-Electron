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

interface GridDragPointer {
  readonly screenX: number;
  readonly screenY: number;
}

interface GridDragState {
  readonly componentId: string | null;
  readonly dragging: boolean;
  readonly pointer?: GridDragPointer;
}

// Type definition for the palette API
interface PaletteAPI {
  close: () => void;
  onUpdateStatus: (callback: (componentsInUse: string[]) => void) => void;
  notifyComponentRemove: (componentId: string) => void;
  getAvailableComponents: () => Promise<ComponentDefinition[]>;
  notifyOpened: () => void;
  toggleEditMode: () => void;
  onGridDragStateChange: (
    callback: (state: GridDragState) => void
  ) => (() => void) | void;
  getCurrentDragComponent: () => string | null;
}

// Store the status update callback
let statusUpdateCallback: ((componentsInUse: string[]) => void) | null = null;
let currentGridDragState: GridDragState = { componentId: null, dragging: false };
const gridDragCallbacks = new Set<(state: GridDragState) => void>();

// Listen for grid drag state updates from main process
ipcRenderer.on('palette:grid-drag-state', (_event, payload: unknown) => {
  const rawState = payload as {
    componentId?: unknown;
    dragging?: unknown;
    pointer?: { screenX?: unknown; screenY?: unknown };
  };

  const pointerPayload = rawState?.pointer;
  const pointer =
    pointerPayload &&
    typeof pointerPayload.screenX === 'number' &&
    typeof pointerPayload.screenY === 'number'
      ? {
          screenX: pointerPayload.screenX,
          screenY: pointerPayload.screenY
        }
      : undefined;

  const nextState: GridDragState = {
    componentId: typeof rawState?.componentId === 'string' ? rawState.componentId : null,
    dragging: Boolean(rawState?.dragging),
    pointer
  };

  currentGridDragState = nextState;

  gridDragCallbacks.forEach((callback) => {
    try {
      callback({ ...nextState });
    } catch (error) {
      console.error('[Palette Preload] Grid drag callback error:', error);
    }
  });
});

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
  onUpdateStatus: (callback: (componentsInUse: string[]) => void): void => {
    statusUpdateCallback = callback;

    // Listen for status updates from main process
    ipcRenderer.on('palette:update-status', (_event, componentsInUse: string[]) => {
      if (statusUpdateCallback) {
        statusUpdateCallback(componentsInUse);
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
   * Get all available component definitions
   * @returns Promise resolving to array of component definitions
   */
  getAvailableComponents: async (): Promise<ComponentDefinition[]> => {
    try {
      const components = await ipcRenderer.invoke('palette:get-components');

      // Validate response structure
      if (Array.isArray(components)) {
        return components as ComponentDefinition[];
      } else {
        console.error('[Palette Preload] Invalid component data received');
        return [];
      }
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
   * Listen for grid drag state changes from the main window
   * @param callback - function invoked with current drag state updates
   * @returns Optional unsubscribe function to remove the listener
   */
  onGridDragStateChange: (
    callback: (state: GridDragState) => void
  ): (() => void) | void => {
    if (typeof callback !== 'function') {
      console.warn('[Palette Preload] Ignoring non-function grid drag callback');
      return;
    }

    gridDragCallbacks.add(callback);

    // Emit current state immediately so listeners have initial value
    try {
      callback({ ...currentGridDragState });
    } catch (error) {
      console.error('[Palette Preload] Grid drag callback error:', error);
    }

    return () => {
      gridDragCallbacks.delete(callback);
    };
  },

  /**
   * Get the component ID currently being dragged from the grid, if any
   * @returns Component ID or null when no drag is active
   */
  getCurrentDragComponent: (): string | null => {
    return currentGridDragState.componentId;
  }
} as PaletteAPI);

// Log preload initialization
console.log('[Palette Preload] Palette preload script initialized');
