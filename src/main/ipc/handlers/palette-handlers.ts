/**
 * @fileoverview IPC bridge between the Component Palette window and the main
 * window's grid: palette open/close, component queries against the shared
 * component definitions, add/remove requests, and grid-status broadcasts
 * back to the palette so it can reflect which components are in use.
 * registerPaletteHandlers() wires all channels at startup.
 */

import { getGridComponentDefinitions } from '@shared/component-definitions.js';
import { ipcMain } from 'electron';
import {
  closeComponentPaletteWindow,
  createComponentPaletteWindow,
} from '../../windows/factories/ComponentPaletteWindowFactory.js';
import { getWindowManager } from '../../windows/WindowManager.js';

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
    console.log('[Palette Handlers] Fetching available components from shared registry');

    try {
      // Map to the format expected by palette (grid-capable components only;
      // shortcut-only entries like the file manager never appear here)
      const components: ComponentDefinition[] = getGridComponentDefinitions().map((comp) => ({
        id: comp.id,
        name: comp.name,
        icon: comp.icon,
        category: comp.category,
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
  ipcMain.on(
    'palette:update-status',
    (_event, statusData: string[] | { componentsInUse: string[]; pinnedComponents: string[] }) => {
      const windowManager = getWindowManager();
      const paletteWindow = windowManager.getPaletteWindow();

      if (paletteWindow && !paletteWindow.isDestroyed()) {
        // Support both old format (array) and new format (object)
        if (Array.isArray(statusData)) {
          console.log(`[Palette Handlers] Broadcasting status update: ${statusData.length} components in use`);
          paletteWindow.webContents.send('palette:update-status', statusData);
        } else {
          console.log(
            `[Palette Handlers] Broadcasting status update: ${statusData.componentsInUse.length} in use, ${statusData.pinnedComponents.length} pinned`
          );
          paletteWindow.webContents.send(
            'palette:update-status',
            statusData.componentsInUse,
            statusData.pinnedComponents
          );
        }
      }
    }
  );

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

  console.log('[Palette Handlers] Palette IPC handlers registered successfully');
}
