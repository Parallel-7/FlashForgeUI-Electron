/**
 * @fileoverview Renderer shortcut button controller.
 *
 * Handles top-bar shortcut slots, IPC wiring with the shortcut config dialog,
 * and grid reloads when pins change.
 */

import { componentManager } from '../ui/components';
import { gridStackManager } from '../ui/gridstack/GridStackManager';
import { getComponentDefinition, getAllComponents } from '../ui/gridstack/ComponentRegistry';
import { DEFAULT_SHORTCUT_CONFIG, type ShortcutButtonConfig } from '../ui/shortcuts/types';
import { logMessage } from './logging';
import {
  loadLayoutForSerial,
  loadShortcutsForSerial,
  saveLayoutForSerial,
  saveShortcutsForSerial
} from './perPrinterStorage';
import type { RendererGridController } from './gridController';

interface ShortcutButtonDependencies {
  getActiveSerial: () => string | null;
  gridController: RendererGridController;
}

export class ShortcutButtonController {
  constructor(private readonly deps: ShortcutButtonDependencies) {}

  initialize(): void {
    console.log('[ShortcutButtons] Initializing topbar shortcuts');

    this.updateButtons(DEFAULT_SHORTCUT_CONFIG);
    this.setupButtonClickHandlers();
    this.setupDialogListeners();
    console.log('[ShortcutButtons] Initialization complete');
  }

  updateButtons(config: ShortcutButtonConfig): void {
    console.log('[ShortcutButtons] Updating button visibility and content');

    for (let i = 1; i <= 3; i++) {
      const slotKey = `slot${i}` as keyof typeof config.slots;
      const componentId = config.slots[slotKey];
      const btn = document.getElementById(`btn-shortcut-${i}`);

      if (!btn) {
        console.warn(`[ShortcutButtons] Shortcut button ${i} not found in DOM`);
        continue;
      }

      if (componentId) {
        const componentDef = getComponentDefinition(componentId);
        if (componentDef) {
          btn.setAttribute('data-component-id', componentId);
          btn.textContent = componentDef.name;
          btn.classList.remove('hidden');
          console.log(`[ShortcutButtons] Slot ${i} configured: ${componentDef.name}`);
        } else {
          console.warn(`[ShortcutButtons] Component definition not found for: ${componentId}`);
          btn.setAttribute('data-component-id', '');
          btn.classList.add('hidden');
        }
      } else {
        btn.setAttribute('data-component-id', '');
        btn.classList.add('hidden');
      }
    }
  }

  private setupButtonClickHandlers(): void {
    for (let i = 1; i <= 3; i++) {
      const btn = document.getElementById(`btn-shortcut-${i}`);
      if (btn) {
        btn.addEventListener('click', () => {
          const componentId = btn.getAttribute('data-component-id');
          console.log(`[ShortcutButtons] Slot ${i} clicked, component: ${componentId}`);
          if (componentId && window.api?.send) {
            window.api.send('component-dialog:open', componentId);
          }
        });
      }
    }
  }

  private setupDialogListeners(): void {
    if (!window.api) {
      return;
    }

    window.api.receive('shortcut-config:updated', (data: unknown) => {
      console.log('[ShortcutButtons] Configuration updated:', data);
      const config = data as ShortcutButtonConfig;
      this.updateButtons(config);
      void this.reloadGridLayout();
    });

    window.api.receive('shortcut-config:get-current-request', (data: unknown) => {
      const responseChannel = data as string;
      const config = loadShortcutsForSerial(this.deps.getActiveSerial());

      if (window.api?.send) {
        window.api.send(responseChannel, config);
      }
    });

    window.api.receive('shortcut-config:save-request', (data: unknown) => {
      const { config, responseChannel } = data as {
        config: ShortcutButtonConfig;
        responseChannel: string;
      };

      try {
        saveShortcutsForSerial(config, this.deps.getActiveSerial());
        console.log(`[PerPrinter] Saved shortcuts for serial: ${this.deps.getActiveSerial() || 'global'}`);
        if (window.api?.send) {
          window.api.send(responseChannel, { success: true });
        }
      } catch (error) {
        if (window.api?.send) {
          window.api.send(responseChannel, {
            success: false,
            error: String(error)
          });
        }
      }
    });

    window.api.receive('shortcut-config:get-components-request', (data: unknown) => {
      const responseChannel = data as string;
      const componentsWithStatus = this.getAvailableComponentsForShortcutConfig();
      if (window.api?.send) {
        window.api.send(responseChannel, componentsWithStatus);
      }
    });
  }

  private getAvailableComponentsForShortcutConfig(): Array<{
    id: string;
    name: string;
    icon: string;
    category: string;
    isPinned: boolean;
  }> {
    const config = loadShortcutsForSerial(this.deps.getActiveSerial());
    const pinnedIds = new Set(
      Object.values(config.slots).filter((id): id is string => id !== null)
    );

    const activeGridComponents = this.getActiveGridComponentIds();

    return getAllComponents()
      .filter((component) => {
        if (pinnedIds.has(component.id)) {
          return true;
        }

        return !activeGridComponents.has(component.id);
      })
      .map((component) => ({
        ...component,
        isPinned: pinnedIds.has(component.id)
      }));
  }

  private getActiveGridComponentIds(): Set<string> {
    const ids = new Set<string>();
    const grid = gridStackManager.getGrid();
    if (!grid) {
      return ids;
    }

    const gridItems = grid.getGridItems?.() ?? [];
    gridItems.forEach((item) => {
      const componentId = item.getAttribute('data-component-id');
      if (componentId) {
        ids.add(componentId);
      }
    });

    return ids;
  }

  private async reloadGridLayout(): Promise<void> {
    console.log('[ShortcutButtons] Reloading grid layout');

    try {
      const serial = this.deps.getActiveSerial();
      const config = loadShortcutsForSerial(serial);
      const pinnedIds = Object.values(config.slots).filter((id): id is string => id !== null);

      console.log('[ShortcutButtons] Pinned component IDs:', pinnedIds);

      const grid = gridStackManager.getGrid();
      if (!grid) {
        console.warn('[ShortcutButtons] Grid not initialized yet');
        return;
      }

      const gridItems = Array.from(grid.getGridItems() || []);

      for (const item of gridItems) {
        const componentId = item.getAttribute('data-component-id');
        if (componentId && pinnedIds.includes(componentId)) {
          console.log(`[ShortcutButtons] Removing pinned component from grid: ${componentId}`);

          const component = componentManager.getComponent(componentId);
          if (component) {
            componentManager.removeComponent(componentId);
            component.destroy();
          }

          gridStackManager.removeWidget(item as HTMLElement);

          if (componentId === 'log-panel') {
            logMessage('Log panel removed from grid due to pinning');
          }
        }
      }

      const layout = loadLayoutForSerial(serial);
      const currentGridComponentIds = gridItems
        .map((item) => item.getAttribute('data-component-id'))
        .filter((id): id is string => id !== null);

      for (const widgetConfig of layout.widgets) {
        const componentId = widgetConfig.componentId;
        if (pinnedIds.includes(componentId) || currentGridComponentIds.includes(componentId)) {
          continue;
        }

        console.log(`[ShortcutButtons] Adding unpinned component back to grid: ${componentId}`);
        await this.deps.gridController.addComponentToGrid(componentId, widgetConfig);
      }

      const currentLayout = loadLayoutForSerial(serial);
      const updatedLayout = gridStackManager.serialize();
      saveLayoutForSerial(
        {
          ...currentLayout,
          widgets: updatedLayout
        },
        serial
      );

      console.log('[ShortcutButtons] Grid reload complete');
    } catch (error) {
      console.error('[ShortcutButtons] Error reloading grid:', error);
    }
  }
}
