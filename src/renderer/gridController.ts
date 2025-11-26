/**
 * @fileoverview Renderer GridStack controller.
 *
 * Encapsulates GridStack/component initialization, palette integration, and
 * helpers for reloading layouts when printer contexts change.
 */

import {
  componentManager,
  CameraPreviewComponent,
  ControlsGridComponent,
  ModelPreviewComponent,
  JobStatsComponent,
  PrinterStatusComponent,
  TemperatureControlsComponent,
  FiltrationControlsComponent,
  AdditionalInfoComponent,
  LogPanelComponent,
  SpoolmanComponent,
  type BaseComponent,
  type ComponentUpdateData
} from '../ui/components/index.js';
import { gridStackManager } from '../ui/gridstack/GridStackManager.js';
import { layoutPersistence } from '../ui/gridstack/LayoutPersistence.js';
import { editModeController } from '../ui/gridstack/EditModeController.js';
import { getComponentDefinition } from '../ui/gridstack/ComponentRegistry.js';
import type { GridStackWidgetConfig, LayoutConfig } from '../ui/gridstack/types.js';
import type { ShortcutButtonConfig } from '../ui/shortcuts/types.js';
import type { PollingData } from '../types/polling.js';
import type { AppConfig } from '../types/config.js';
import {
  getPinnedComponentIdsForSerial,
  loadLayoutForSerial,
  saveLayoutForSerial,
  loadShortcutsForSerial
} from './perPrinterStorage.js';
import { hydrateLogPanelWithHistory, logMessage, setLogPanelComponent } from './logging.js';
import { logVerbose } from '../utils/logging.js';

interface GridControllerOptions {
  getActiveSerial: () => string | null;
  getLastPollingData: () => PollingData | null;
  updateShortcutButtons: (config: ShortcutButtonConfig) => void;
}

const GRID_CONTROLLER_LOG_NAMESPACE = 'RendererGridController';

export class RendererGridController {
  private componentsInitialized = false;
  private gridInitializationPromise: Promise<void> | null = null;
  private pendingGridInitializationSerial: string | null = null;

  constructor(private readonly options: GridControllerOptions) {}

  private logDebug(message: string, ...args: unknown[]): void {
    logVerbose(GRID_CONTROLLER_LOG_NAMESPACE, message, ...args);
  }

  areComponentsInitialized(): boolean {
    return this.componentsInitialized;
  }

  async initialize(initialSerial?: string | null): Promise<void> {
    if (this.componentsInitialized) {
      return;
    }

    if (initialSerial !== undefined) {
      this.pendingGridInitializationSerial = initialSerial;
    }

    if (!this.gridInitializationPromise) {
      this.gridInitializationPromise = (async () => {
        try {
          await this.performGridStackInitialization(this.pendingGridInitializationSerial ?? undefined);
        } finally {
          this.gridInitializationPromise = null;
          this.pendingGridInitializationSerial = null;
        }
      })();
    }

    await this.gridInitializationPromise;
  }

  clearAllComponents(): void {
    const componentIds = componentManager.getComponentIds();
    for (const id of componentIds) {
      const component = componentManager.getComponent(id);
      if (component) {
        componentManager.removeComponent(id);
        try {
          component.destroy();
        } catch (error) {
          console.error(`[PerPrinter] Failed to destroy component ${id}:`, error);
        }
      }
    }

    setLogPanelComponent(null);
    gridStackManager.clear(true);
  }

  serializeLayout(): GridStackWidgetConfig[] {
    return gridStackManager.serialize();
  }

  async reloadGridForLayout(
    layout: LayoutConfig,
    serialLabel: string,
    shortcutConfig: ShortcutButtonConfig
  ): Promise<void> {
    const grid = gridStackManager.getGrid();
    if (!grid) {
      console.error('[PerPrinter] Grid not initialized');
      return;
    }

    this.clearAllComponents();

    const pinnedIds = Object.values(shortcutConfig.slots).filter((id): id is string => id !== null);
    const filteredWidgets = layout.widgets.filter((w) => !pinnedIds.includes(w.componentId));

    let printerConfig: AppConfig | null = null;
    try {
      if (!window.api?.config) {
        console.warn('[PerPrinter] Config API unavailable for context reload');
      } else {
        printerConfig = await window.api.config.get();
      }
    } catch (error) {
      console.warn('[PerPrinter] Failed to load printer config for context reload:', error);
    }

    for (const widgetConfig of filteredWidgets) {
      await this.addComponentToGrid(widgetConfig.componentId, widgetConfig, printerConfig);
    }

    this.options.updateShortcutButtons(shortcutConfig);
    this.hideConnectPlaceholder();

    this.logDebug(`[PerPrinter] Grid reload complete for serial: ${serialLabel}`);
  }

  async addComponentFromPalette(
    componentId: string,
    dropPosition?: { x: number; y: number }
  ): Promise<void> {
    this.logDebug('[GridStack] Attempting to add component from palette', componentId);

    const definition = getComponentDefinition(componentId);
    if (!definition) {
      console.error('[GridStack] Unknown component:', componentId);
      logMessage(`ERROR: Unknown component: ${componentId}`);
      return;
    }

    if (componentManager.getComponent(componentId)) {
      console.warn('[GridStack] Component already exists on grid:', componentId);
      logMessage(`Component ${definition.name} is already on the grid`);
      this.updatePaletteStatus();
      return;
    }

    if (document.querySelector(`[data-component-id="${componentId}"]`)) {
      console.warn('[GridStack] DOM already contains widget for component:', componentId);
      this.updatePaletteStatus();
      return;
    }

    const config: GridStackWidgetConfig = {
      componentId,
      x: dropPosition?.x,
      y: dropPosition?.y,
      w: definition.defaultSize.w,
      h: definition.defaultSize.h,
      minW: definition.minSize?.w,
      minH: definition.minSize?.h,
      maxW: definition.maxSize?.w,
      maxH: definition.maxSize?.h,
      id: `widget-${componentId}`,
      autoPosition: dropPosition ? false : true
    };

    try {
      const widgetElement = this.createGridWidget(componentId);
      const addedWidget = gridStackManager.addWidget(config, widgetElement);

      if (!addedWidget) {
        throw new Error('GridStackManager.addWidget returned null');
      }

      const contentContainer = addedWidget.querySelector('.grid-stack-item-content') as HTMLElement | null;
      if (!contentContainer) {
        throw new Error('Grid widget missing content container');
      }

      const component = this.createComponentForGrid(componentId, contentContainer);
      if (!component) {
        throw new Error(`Unable to create component instance for ${componentId}`);
      }

      componentManager.registerComponent(component);
      await component.initialize();
      if (component instanceof LogPanelComponent) {
        await hydrateLogPanelWithHistory(component);
      }

      const lastPollingData = this.options.getLastPollingData();
      if (lastPollingData && window.api?.config) {
        const configData = await window.api.config.get();
        const updateData: ComponentUpdateData = {
          pollingData: lastPollingData,
          config: configData,
          timestamp: new Date().toISOString(),
          printerState: lastPollingData.printerStatus?.state,
          connectionState: lastPollingData.isConnected
        };
        component.update(updateData);
      }

      const serial = this.options.getActiveSerial();
      const currentLayout = loadLayoutForSerial(serial);
      const updatedWidgets = gridStackManager.serialize();
      saveLayoutForSerial(
        {
          ...currentLayout,
          widgets: updatedWidgets
        },
        serial
      );

      this.logDebug(`[PerPrinter] Saved layout after adding component for serial: ${serial || 'global'}`);
      this.updatePaletteStatus();

      this.logDebug('[GridStack] Component added from palette', componentId);
      logMessage(`Component ${definition.name} added to grid`);
    } catch (error) {
      console.error('[GridStack] Failed to add component from palette:', error);
      logMessage(`ERROR: Failed to add component ${componentId}: ${error}`);
    }
  }

  removeComponentFromGrid(componentId: string): void {
    const widgetElement = document.querySelector(`[data-component-id="${componentId}"]`) as HTMLElement | null;
    if (!widgetElement) {
      console.warn('[GridStack] Widget element not found:', componentId);
      return;
    }

    const removed = componentManager.removeComponent(componentId);
    if (!removed) {
      console.warn('[GridStack] Component not found in ComponentManager:', componentId);
    }

    gridStackManager.removeWidget(widgetElement);

    const serial = this.options.getActiveSerial();
    const currentLayout = loadLayoutForSerial(serial);
    const updatedWidgets = gridStackManager.serialize();
    saveLayoutForSerial(
      {
        ...currentLayout,
        widgets: updatedWidgets
      },
      serial
    );

    this.updatePaletteStatus();

    this.logDebug('[GridStack] Component removed successfully', componentId);
    logMessage(`Component ${componentId} removed from grid`);
  }

  private async performGridStackInitialization(initialSerial?: string | null): Promise<void> {
    if (this.componentsInitialized) {
      this.logDebug('GridStack already initialized, skipping base setup');
      return;
    }

    this.logDebug('Initializing GridStack layout system...');

    layoutPersistence.initialize();

    const serialForLoad = initialSerial ?? this.options.getActiveSerial();

    const layout = loadLayoutForSerial(serialForLoad);
    this.logDebug('Loaded layout configuration', layout);

    const shortcutConfig = loadShortcutsForSerial(serialForLoad);
    const pinnedIds = Object.values(shortcutConfig.slots).filter((id): id is string => id !== null);
    const filteredWidgets = layout.widgets.filter((widget) => !pinnedIds.includes(widget.componentId));

    this.logDebug('Pinned components excluded from grid', pinnedIds);
    this.logDebug('Filtered widgets for grid', `${filteredWidgets.length} of ${layout.widgets.length}`);

    gridStackManager.initialize(layout.gridOptions);

    let widgetCount = 0;
    for (const widgetConfig of filteredWidgets) {
      try {
        const widgetElement = this.createGridWidget(widgetConfig.componentId);
        const addedWidget = gridStackManager.addWidget(widgetConfig, widgetElement);

        if (addedWidget) {
          const contentContainer = addedWidget.querySelector('.grid-stack-item-content') as HTMLElement;

          if (contentContainer) {
            const component = this.createComponentForGrid(widgetConfig.componentId, contentContainer);

            if (component) {
              componentManager.registerComponent(component);
              await component.initialize();
              if (component instanceof LogPanelComponent) {
                await hydrateLogPanelWithHistory(component);
              }
              widgetCount++;
              this.logDebug(`GridStack: Added widget '${widgetConfig.componentId}'`);
            }
          }
        }
      } catch (error) {
        console.error(`GridStack: Failed to create widget '${widgetConfig.componentId}':`, error);
        logMessage(`ERROR: Failed to create widget '${widgetConfig.componentId}'`);
      }
    }

    this.logDebug(`GridStack: Created ${widgetCount}/${layout.widgets.length} widgets`);

    const lastPollingData = this.options.getLastPollingData();
    if (lastPollingData && window.api?.config) {
      const config = await window.api.config.get();
      const updateData: ComponentUpdateData = {
        pollingData: lastPollingData,
        config,
        timestamp: new Date().toISOString(),
        printerState: lastPollingData.printerStatus?.state,
        connectionState: lastPollingData.isConnected
      };
      componentManager.updateAll(updateData);
      this.logDebug('GridStack: Sent initial config update to all components (or queued if not ready)');
    }

    gridStackManager.onChange(() => {
      this.logDebug('GridStack: Layout changed, auto-saving...');
      const serial = this.options.getActiveSerial();
      const currentLayout = loadLayoutForSerial(serial);
      const updatedWidgets = gridStackManager.serialize();
      saveLayoutForSerial(
        {
          ...currentLayout,
          widgets: updatedWidgets
        },
        serial
      );
      this.logDebug(`[PerPrinter] Saved layout for serial: ${serial || 'global'}`);
    });

    editModeController.initialize(gridStackManager, layoutPersistence);
    gridStackManager.disable();
    this.setupPaletteIntegration();

    if (!componentManager.isInitialized()) {
      this.logDebug('GridStack: Finalizing component manager initialization...');
      await componentManager.initializeAll();
    }

    this.componentsInitialized = true;
    this.hideConnectPlaceholder();
    this.options.updateShortcutButtons(shortcutConfig);

    this.logDebug('GridStack initialization complete');
    logMessage(`GridStack layout system initialized: ${widgetCount} widgets loaded`);
  }

  private createGridWidget(componentId: string): HTMLElement {
    const item = document.createElement('div');
    item.className = 'grid-stack-item';
    item.setAttribute('data-component-id', componentId);

    const content = document.createElement('div');
    content.className = 'grid-stack-item-content';
    content.id = `grid-${componentId}-content`;

    item.appendChild(content);
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'grid-stack-item-remove';
    removeButton.setAttribute('aria-label', `Remove ${componentId}`);
    removeButton.title = 'Remove component';
    removeButton.innerHTML = '&times;';
    removeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (!editModeController.isEnabled()) {
        logMessage('Enable edit mode (CTRL+E) to remove components.');
        return;
      }

      if (window.api?.send) {
        window.api.send('palette:remove-component', componentId);
      } else {
        console.warn('[GridStack] Removal API unavailable');
      }
    });
    item.appendChild(removeButton);
    return item;
  }

  private createComponentForGrid(componentId: string, container: HTMLElement): BaseComponent | null {
    switch (componentId) {
      case 'camera-preview':
        return new CameraPreviewComponent(container);
      case 'controls-grid':
        return new ControlsGridComponent(container);
      case 'model-preview':
        return new ModelPreviewComponent(container);
      case 'job-stats':
        return new JobStatsComponent(container);
      case 'printer-status':
        return new PrinterStatusComponent(container);
      case 'temperature-controls':
        return new TemperatureControlsComponent(container);
      case 'filtration-controls':
        return new FiltrationControlsComponent(container);
      case 'additional-info':
        return new AdditionalInfoComponent(container);
      case 'log-panel': {
        const logPanel = new LogPanelComponent(container);
        setLogPanelComponent(logPanel);
        return logPanel;
      }
      case 'spoolman-tracker':
        return new SpoolmanComponent(container);
      default:
        console.error(`Unknown component ID: ${componentId}`);
        return null;
    }
  }

  async addComponentToGrid(
    componentId: string,
    widgetConfig?: GridStackWidgetConfig,
    configData?: AppConfig | null
  ): Promise<void> {
    const componentDef = getComponentDefinition(componentId);
    if (!componentDef) {
      console.error(`[ShortcutButtons] Component definition not found: ${componentId}`);
      return;
    }

    const widgetElement = document.createElement('div');
    widgetElement.className = 'grid-stack-item';
    widgetElement.setAttribute('data-component-id', componentId);
    widgetElement.setAttribute('gs-id', `widget-${componentId}`);

    const contentContainer = document.createElement('div');
    contentContainer.className = 'grid-stack-item-content';
    widgetElement.appendChild(contentContainer);

    const config: GridStackWidgetConfig = widgetConfig || {
      componentId,
      w: componentDef.defaultSize?.w || 4,
      h: componentDef.defaultSize?.h || 3,
      minW: componentDef.minSize?.w,
      minH: componentDef.minSize?.h,
      id: `widget-${componentId}`,
      autoPosition: true
    };

    const addedWidget = gridStackManager.addWidget(config, widgetElement);

    if (addedWidget) {
      const component = this.createComponentInstance(componentId, contentContainer);

      if (component) {
        componentManager.registerComponent(component);
        await component.initialize();

        const lastPollingData = this.options.getLastPollingData();
        if (lastPollingData) {
          const updateData: ComponentUpdateData = {
            pollingData: lastPollingData,
            timestamp: new Date().toISOString(),
            printerState: lastPollingData.printerStatus?.state,
            connectionState: lastPollingData.isConnected
          };
          if (configData) {
            updateData.config = configData;
          }
          component.update(updateData);
        }
      }
    }
  }

  private createComponentInstance(componentId: string, container: HTMLElement) {
    switch (componentId) {
      case 'camera-preview':
        return new CameraPreviewComponent(container);
      case 'temperature-controls':
        return new TemperatureControlsComponent(container);
      case 'job-stats':
        return new JobStatsComponent(container);
      case 'printer-status':
        return new PrinterStatusComponent(container);
      case 'model-preview':
        return new ModelPreviewComponent(container);
      case 'additional-info':
        return new AdditionalInfoComponent(container);
      case 'log-panel': {
        const logPanel = new LogPanelComponent(container);
        setLogPanelComponent(logPanel);
        return logPanel;
      }
      case 'controls-grid':
        return new ControlsGridComponent(container);
      case 'filtration-controls':
        return new FiltrationControlsComponent(container);
      case 'spoolman-tracker':
        return new SpoolmanComponent(container);
      default:
        console.error(`[ShortcutButtons] Unknown component ID: ${componentId}`);
        return null;
    }
  }

  private updatePaletteStatus(): void {
    if (!window.api?.send) {
      return;
    }

    const componentsInUse = gridStackManager.serialize().map((w) => w.componentId || w.id || '');
    const pinnedComponentIds = getPinnedComponentIdsForSerial(this.options.getActiveSerial());

    window.api.send('palette:update-status', {
      componentsInUse,
      pinnedComponents: pinnedComponentIds
    });
  }

  private setupPaletteIntegration(): void {
    if (!window.api) {
      return;
    }

    window.api.receive('palette:opened', () => {
      this.logDebug('[GridStack] Palette opened, sending current status');
      this.updatePaletteStatus();
    });

    window.api.receive('edit-mode:toggle', () => {
      this.logDebug('[GridStack] Edit mode toggle triggered from palette window');
      editModeController.toggle();
    });

    window.api.receive('grid:add-component', async (componentId: unknown) => {
      const id = typeof componentId === 'string' ? componentId : null;
      if (!id) {
        console.warn('[GridStack] Add request ignored - invalid component ID', componentId);
        return;
      }

      if (!editModeController.isEnabled()) {
        console.warn('[GridStack] Cannot add component while edit mode is disabled');
        logMessage('Enable edit mode (CTRL+E) to add components.');
        return;
      }

      await this.addComponentFromPalette(id);
    });

    window.api.receive('grid:remove-component', (componentId: unknown) => {
      const id = componentId as string;
      this.removeComponentFromGrid(id);
    });

    this.logDebug('[GridStack] Palette integration setup complete');
  }

  private hideConnectPlaceholder(): void {
    const grid = document.querySelector('.grid-stack');
    const placeholder = document.getElementById('grid-placeholder');
    if (grid) {
      grid.classList.remove('hidden');
    }
    if (placeholder) {
      placeholder.classList.add('hidden');
    }
    editModeController.setAvailability(true);
  }
}
