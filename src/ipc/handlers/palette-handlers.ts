/**
 * @fileoverview IPC handlers for Component Palette window
 *
 * Registers IPC handlers for communication between the Component Palette window
 * and the main application window. Handles palette open/close, component queries,
 * status updates, and component removal requests with proper coordination.
 *
 * Handlers:
 * - open-component-palette: Open palette window (or focus if exists)
 * - close-component-palette: Close palette window programmatically
 * - palette:close: Close button handler from palette window
 * - palette:get-components: Query available component definitions from registry
 * - palette:opened: Palette window opened notification to main window
 * - palette:update-status: Broadcast grid status to palette (receive & forward)
 * - palette:remove-component: Remove component from grid via grid controls
 * - palette:add-component: Add component to grid via palette button
 *
 * Key exports:
 * - registerPaletteHandlers(): Register all palette IPC handlers on app startup
 * - broadcastPaletteStatus(): Broadcast component status updates to palette
 *
 * Component Registry Integration:
 * - Queries ComponentRegistry for all available components
 * - Provides component metadata (id, name, icon, category)
 * - Maps registry format to palette-expected format
 *
 * Grid State Synchronization:
 * - Main window broadcasts component additions/removals
 * - Palette updates UI to reflect component availability
 * - Prevents duplicate singleton component additions
 * - Supports button-driven add/remove workflow
 *
 * Communication Flow:
 * 1. Palette requests components via palette:get-components
 * 2. Main process queries ComponentRegistry and returns definitions
 * 3. Main window broadcasts status updates via palette:update-status
 * 4. Palette receives updates and re-renders component list
 * 5. Palette sends add/remove requests via palette:add-component / palette:remove-component
 * 6. Main window updates grid and broadcasts new status
 *
 * Usage:
 * ```typescript
 * import { registerPaletteHandlers } from './palette-handlers';
 *
 * // Register handlers on app startup
 * registerPaletteHandlers();
 *
 * // Broadcast status update from main window
 * broadcastPaletteStatus(['camera-preview', 'controls-grid']);
 * ```
 *
 * @module ipc/handlers/palette-handlers
 */

import { ipcMain } from 'electron';
import {
  createComponentPaletteWindow,
  closeComponentPaletteWindow
} from '../../windows/factories/ComponentPaletteWindowFactory';
import { getWindowManager } from '../../windows/WindowManager';
import { getAllComponents } from '../../ui/gridstack/ComponentRegistry';

/**
 * Component definition interface (matches palette-preload.ts and ComponentRegistry)
 */
interface ComponentDefinition {
  id: string;
  name: string;
  icon: string;
  category?: string;
}

/**
 * Register all palette-related IPC handlers
 */
export function registerPaletteHandlers(): void {
  console.log('[Palette Handlers] Registering palette IPC handlers...');

  // Open component palette window
  ipcMain.on('open-component-palette', () => {
    console.log('[Palette Handlers] Opening component palette window');
    createComponentPaletteWindow();
  });

  // Close component palette window
  ipcMain.on('close-component-palette', () => {
    console.log('[Palette Handlers] Closing component palette window');
    closeComponentPaletteWindow();
  });

  // Close button handler from palette window
  ipcMain.on('palette:close', () => {
    console.log('[Palette Handlers] Palette close button clicked');
    closeComponentPaletteWindow();
  });

  // Get available components
  ipcMain.handle('palette:get-components', async (): Promise<ComponentDefinition[]> => {
    console.log('[Palette Handlers] Fetching available components from ComponentRegistry');

    try {
      // Get components from the ComponentRegistry
      const allComponents = getAllComponents();

      // Map to the format expected by palette
      const components: ComponentDefinition[] = allComponents.map(comp => ({
        id: comp.id,
        name: comp.name,
        icon: comp.icon,
        category: comp.category
      }));

      console.log(`[Palette Handlers] Returning ${components.length} components from registry`);
      return components;
    } catch (error) {
      console.error('[Palette Handlers] Failed to get components:', error);
      return [];
    }
  });

  // Handle component removal from trash zone
  ipcMain.on('palette:remove-component', (_event, componentId: string) => {
    console.log('[Palette Handlers] Component removal requested:', componentId);

    // Get main window and broadcast removal request
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[Palette Handlers] Broadcasting component removal to main window');
      mainWindow.webContents.send('grid:remove-component', componentId);
    } else {
      console.warn('[Palette Handlers] Main window not available for component removal');
    }
  });

  // Handle add requests from palette buttons
  ipcMain.on('palette:add-component', (_event, componentId: string) => {
    console.log('[Palette Handlers] Component add requested:', componentId);

    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[Palette Handlers] Broadcasting component add to main window');
      mainWindow.webContents.send('grid:add-component', componentId);
    } else {
      console.warn('[Palette Handlers] Main window not available for component add');
    }
  });

  // Broadcast component status update to palette window
  ipcMain.on('palette:update-status', (_event, componentsInUse: string[]) => {
    const windowManager = getWindowManager();
    const paletteWindow = windowManager.getPaletteWindow();

    if (paletteWindow && !paletteWindow.isDestroyed()) {
      console.log(`[Palette Handlers] Broadcasting status update: ${componentsInUse.length} components in use`);
      paletteWindow.webContents.send('palette:update-status', componentsInUse);
    }
  });

  // Notify main window when palette opens
  ipcMain.on('palette:opened', () => {
    console.log('[Palette Handlers] Palette opened, notifying main window');
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('palette:opened');
    }
  });

  // Toggle edit mode from palette window (CTRL+E handler)
  ipcMain.on('palette:toggle-edit-mode', () => {
    console.log('[Palette Handlers] CTRL+E from palette - toggling edit mode in main window');
    const windowManager = getWindowManager();
    const mainWindow = windowManager.getMainWindow();

    if (mainWindow && !mainWindow.isDestroyed()) {
      // Send toggle signal to main window renderer
      mainWindow.webContents.send('edit-mode:toggle');
    } else {
      console.warn('[Palette Handlers] Main window not available for edit mode toggle');
    }
  });

  // Drag forwarding no longer required with button-based workflow

  console.log('[Palette Handlers] Palette IPC handlers registered successfully');
}

/**
 * Broadcast component status update to palette window
 * Called by main window when components are added or removed from grid
 *
 * @param componentsInUse - Array of component IDs currently in the grid
 */
export function broadcastPaletteStatus(componentsInUse: string[]): void {
  const windowManager = getWindowManager();
  const paletteWindow = windowManager.getPaletteWindow();

  if (paletteWindow && !paletteWindow.isDestroyed()) {
    console.log(`[Palette Handlers] Broadcasting status update: ${componentsInUse.length} components in use`);
    paletteWindow.webContents.send('palette:update-status', componentsInUse);
  }
}
