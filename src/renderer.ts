/**
 * @fileoverview Main Renderer Process - Component System Integration
 * 
 * This file serves as the main entry point for the renderer process and integrates
 * the new component system with existing functionality. It replaces the monolithic
 * UI approach with a clean component-based architecture while preserving all
 * existing features and behaviors.
 * 
 * Key responsibilities:
 * - Component system initialization and lifecycle management
 * - IPC event handling and data flow
 * - Window controls and basic UI functionality
 * - Platform detection and styling
 * - Loading state management
 * - State tracking integration
 * 
 * Integration approach:
 * - Uses ComponentManager for centralized component updates
 * - Preserves all existing event handlers and IPC communication
 * - Maintains backward compatibility with logging and state tracking
 * - Provides graceful degradation if components fail to initialize
 */

// Core styles and dependencies
import './index.css';

import { initializeLucideIcons, getLucideIcons } from './utils/icons';

// Component system imports
import {
  componentManager,
  JobStatsComponent,
  CameraPreviewComponent,
  ControlsGridComponent,
  ModelPreviewComponent,
  LogPanelComponent,
  PrinterStatusComponent,
  TemperatureControlsComponent,
  FiltrationControlsComponent,
  AdditionalInfoComponent,
  PrinterTabsComponent,
  SpoolmanComponent,
  type ComponentUpdateData,
  type BaseComponent
} from './ui/components';

// GridStack system imports
import { gridStackManager } from './ui/gridstack/GridStackManager';
import { layoutPersistence } from './ui/gridstack/LayoutPersistence';
import { editModeController } from './ui/gridstack/EditModeController';
import { getComponentDefinition, getAllComponents } from './ui/gridstack/ComponentRegistry';
import type { GridStackWidgetConfig } from './ui/gridstack/types';

// Shortcut system imports
import { shortcutConfigManager } from './ui/shortcuts/ShortcutConfigManager';
import type { ShortcutButtonConfig } from './ui/shortcuts/types';

// Existing service imports
import { getGlobalStateTracker, STATE_EVENTS, type StateChangeEvent } from './services/printer-state';
import { initializeUIAnimations, resetUI, handleUIError } from './services/ui-updater';
import type { PollingData } from './types/polling';
import type { ResolvedCameraConfig } from './types/camera';


// ============================================================================
// COMPONENT SYSTEM STATE
// ============================================================================

/** Global reference to LogPanelComponent for backward compatibility */
let logPanelComponent: LogPanelComponent | null = null;

/** Global reference to PrinterTabsComponent for multi-printer support */
let printerTabsComponent: PrinterTabsComponent | null = null;

/** Whether components have been initialized */
let componentsInitialized = false;

/** Track last polling data for new components */
let lastPollingData: PollingData | null = null;

// ============================================================================
// EXISTING STATE TRACKING (preserved for compatibility)
// ============================================================================

/** Camera preview state */
let previewEnabled = false;
let cameraStreamElement: HTMLImageElement | null = null;

// Hamburger menu state references
let isMainMenuOpen = false;
let mainMenuButton: HTMLButtonElement | null = null;
let mainMenuDropdown: HTMLDivElement | null = null;
let mainMenuCloseTimeout: number | null = null;

const MAIN_MENU_ACTIONS = ['connect', 'settings', 'status', 'ifs', 'pin-config'] as const;
type MainMenuAction = typeof MAIN_MENU_ACTIONS[number];

const MAIN_MENU_ACTION_CHANNELS: Record<MainMenuAction, string> = {
  connect: 'open-printer-selection',
  settings: 'open-settings-window',
  status: 'open-status-dialog',
  ifs: 'open-ifs-dialog',
  'pin-config': 'shortcut-config:open'
};

const MAIN_MENU_SHORTCUTS: Record<MainMenuAction, { key: string; label: string }> = {
  connect: { key: 'k', label: 'K' },
  settings: { key: ',', label: ',' },
  status: { key: 'i', label: 'I' },
  ifs: { key: 'm', label: 'M' },
  'pin-config': { key: 'p', label: 'P' }
};

const TEXT_INPUT_TYPES = new Set([
  'text',
  'email',
  'search',
  'password',
  'url',
  'tel',
  'number'
]);

function isMainMenuAction(action: string | null): action is MainMenuAction {
  return MAIN_MENU_ACTIONS.includes(action as MainMenuAction);
}

class MenuShortcutManager {
  private initialized = false;
  private isMac = false;
  private enabledActions: Record<MainMenuAction, boolean> = {
    connect: true,
    settings: true,
    status: true,
    ifs: false,
    'pin-config': true
  };

  initialize(): void {
    this.isMac = window.PLATFORM === 'darwin';
    this.enabledActions.ifs = ifsMenuItemVisible;
    this.updateShortcutLabels();

    if (this.initialized) {
      return;
    }

    document.addEventListener('keydown', this.handleKeydown);
    this.initialized = true;
  }

  dispose(): void {
    if (!this.initialized) {
      return;
    }

    document.removeEventListener('keydown', this.handleKeydown);
    this.initialized = false;
  }

  setActionEnabled(action: MainMenuAction, enabled: boolean): void {
    this.enabledActions[action] = enabled;
  }

  updateShortcutLabels(): void {
    const displayPrefix = this.isMac ? '⌘' : 'Ctrl+';
    const ariaPrefix = this.isMac ? 'Meta+' : 'Control+';

    MAIN_MENU_ACTIONS.forEach((action) => {
      const config = MAIN_MENU_SHORTCUTS[action];
      const displayValue = this.isMac ? `${displayPrefix}${config.label}` : `${displayPrefix}${config.label}`;
      const ariaValue = `${ariaPrefix}${config.label}`;

      const shortcutEl = document.querySelector<HTMLSpanElement>(
        `.menu-item-shortcut[data-shortcut-id="${action}"]`
      );
      if (shortcutEl) {
        shortcutEl.textContent = displayValue;
      }

      const button = document.querySelector<HTMLButtonElement>(`.menu-item[data-action="${action}"]`);
      if (button) {
        button.setAttribute('aria-keyshortcuts', ariaValue);
      }
    });
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (!this.initialized) {
      return;
    }

    if (event.defaultPrevented || event.repeat) {
      return;
    }

    if (!this.isRelevantModifier(event)) {
      return;
    }

    if (event.altKey || event.shiftKey) {
      return;
    }

    if (this.isEditableContext()) {
      return;
    }

    const action = this.getActionFromEvent(event);
    if (!action || !this.enabledActions[action]) {
      return;
    }

    const channel = MAIN_MENU_ACTION_CHANNELS[action];
    if (!channel || !window.api?.send) {
      return;
    }

    event.preventDefault();

    window.api.send(channel);
    closeMainMenu();
  };

  private isRelevantModifier(event: KeyboardEvent): boolean {
    return this.isMac ? event.metaKey : event.ctrlKey;
  }

  private isEditableContext(): boolean {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) {
      return false;
    }

    if (activeElement instanceof HTMLInputElement) {
      if (!TEXT_INPUT_TYPES.has(activeElement.type)) {
        return false;
      }

      return !activeElement.readOnly && !activeElement.disabled;
    }

    if (activeElement instanceof HTMLTextAreaElement) {
      return !activeElement.readOnly && !activeElement.disabled;
    }

    if (activeElement instanceof HTMLSelectElement) {
      return !activeElement.disabled;
    }

    if (activeElement.isContentEditable) {
      return true;
    }

    return Boolean(activeElement.closest('[contenteditable="true"]'));
  }

  private getActionFromEvent(event: KeyboardEvent): MainMenuAction | null {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    for (const action of MAIN_MENU_ACTIONS) {
      const shortcut = MAIN_MENU_SHORTCUTS[action];
      if (shortcut.key === ',') {
        if (event.key === ',') {
          return action;
        }
        continue;
      }

      if (key === shortcut.key) {
        return action;
      }
    }

    return null;
  }
}

const menuShortcutManager = new MenuShortcutManager();

// Track filtration availability from backend
let filtrationAvailable = false;

// Track IFS menu item visibility for AD5X printers
let ifsMenuItemVisible = false;

// Track legacy printer status for feature detection
let isLegacyPrinter = false;

// Note: UIState interface removed - components handle their own state now

// Loading state management
interface LoadingState {
  isVisible: boolean;
  state: 'hidden' | 'loading' | 'success' | 'error';
  message: string;
  progress: number;
  canCancel: boolean;
}

// Note: defaultUIState removed - components handle their own default states

const defaultLoadingState: LoadingState = {
  isVisible: false,
  state: 'hidden',
  message: '',
  progress: 0,
  canCancel: false
};

// Current loading state
let currentLoadingState: LoadingState = { ...defaultLoadingState };

// Loading management functions
function updateLoadingOverlay(): void {
  const overlay = document.getElementById('loading-overlay');
  const messageEl = document.getElementById('loading-message');
  const progressContainer = document.getElementById('loading-progress-container');
  const progressFill = document.getElementById('loading-progress-fill');
  const progressText = document.getElementById('loading-progress-text');
  const cancelBtn = document.getElementById('loading-cancel-btn');

  if (!overlay || !messageEl) {
    console.error('Loading overlay elements not found');
    return;
  }

  // Update visibility
  if (currentLoadingState.isVisible) {
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
    return;
  }

  // Update state class
  overlay.className = `loading-overlay state-${currentLoadingState.state}`;

  // Update message
  messageEl.textContent = currentLoadingState.message;

  // Update progress
  if (progressContainer && progressFill && progressText) {
    if (currentLoadingState.state === 'loading' && currentLoadingState.progress > 0) {
      progressContainer.classList.add('visible');
      progressFill.style.width = `${currentLoadingState.progress}%`;
      progressText.textContent = `${Math.round(currentLoadingState.progress)}%`;
    } else {
      progressContainer.classList.remove('visible');
    }
  }

  // Update cancel button
  if (cancelBtn) {
    if (currentLoadingState.canCancel && currentLoadingState.state === 'loading') {
      cancelBtn.classList.add('visible');
    } else {
      cancelBtn.classList.remove('visible');
    }
  }
}



function setupLoadingEventListeners(): void {
  if (!window.api) {
    console.error('API not available for loading event listeners');
    return;
  }

  // Listen for loading state changes from main process
  window.api.receive('loading-state-changed', (eventData: unknown) => {
    const data = eventData as {
      state: 'hidden' | 'loading' | 'success' | 'error';
      message?: string;
      progress?: number;
      canCancel?: boolean;
    };

    currentLoadingState = {
      isVisible: data.state !== 'hidden',
      state: data.state,
      message: data.message || '',
      progress: data.progress || 0,
      canCancel: data.canCancel || false
    };
    updateLoadingOverlay();
  });

  // Setup cancel button event listener
  const cancelBtn = document.getElementById('loading-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (currentLoadingState.canCancel && window.api?.loading) {
        window.api.loading.cancel();
        logMessage('Loading operation cancelled by user');
      }
    });
  }
}

// ============================================================================
// GRIDSTACK SYSTEM INTEGRATION
// ============================================================================

/**
 * Create a component instance for GridStack integration
 * Maps component IDs to their class instantiations
 * @param componentId - The component ID to create
 * @param container - The container element for the component
 * @returns Component instance or null if unknown component
 */
function createComponentForGrid(componentId: string, container: HTMLElement): BaseComponent | null {
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
      logPanelComponent = logPanel;
      return logPanel;
    }
    case 'spoolman-tracker':
      return new SpoolmanComponent(container);
    default:
      console.error(`Unknown component ID: ${componentId}`);
      return null;
  }
}

/**
 * Create a grid widget element for a component
 * @param componentId - The component ID
 * @returns Grid widget element
 */
function createGridWidget(componentId: string): HTMLElement {
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

/**
 * Initialize GridStack layout system
 * Sets up grid, loads layout, creates widgets, and initializes edit mode
 */
async function initializeGridStack(): Promise<void> {
  console.log('Initializing GridStack layout system...');

  try {
    // 1. Initialize layout persistence
    layoutPersistence.initialize();

    // 2. Load layout configuration (from localStorage or default)
    const layout = layoutPersistence.load();
    console.log('Loaded layout configuration:', layout);

    // 2.5. Filter out pinned components from layout
    const shortcutConfig = shortcutConfigManager.load();
    const pinnedIds = Object.values(shortcutConfig.slots).filter((id): id is string => id !== null);
    const filteredWidgets = layout.widgets.filter(widget => !pinnedIds.includes(widget.componentId));

    console.log('Pinned components excluded from grid:', pinnedIds);
    console.log('Filtered widgets for grid:', filteredWidgets.length, 'of', layout.widgets.length);

    // 3. Initialize GridStack with grid options
    gridStackManager.initialize(layout.gridOptions);

    // 4. Create widgets from filtered layout
    let widgetCount = 0;
    for (const widgetConfig of filteredWidgets) {
      try {
        // Create the grid widget element
        const widgetElement = createGridWidget(widgetConfig.componentId);

        // Add widget to grid (this positions it)
        const addedWidget = gridStackManager.addWidget(widgetConfig, widgetElement);

        if (addedWidget) {
          // Get the content container
          const contentContainer = addedWidget.querySelector('.grid-stack-item-content') as HTMLElement;

          if (contentContainer) {
            // Create and register the component
            const component = createComponentForGrid(widgetConfig.componentId, contentContainer);

            if (component) {
              componentManager.registerComponent(component);
              await component.initialize();
              if (component instanceof LogPanelComponent) {
                await hydrateLogPanelWithHistory(component);
              }
              widgetCount++;
              console.log(`GridStack: Added widget '${widgetConfig.componentId}'`);

            }
          }
        }
      } catch (error) {
        console.error(`GridStack: Failed to create widget '${widgetConfig.componentId}':`, error);
        logMessage(`ERROR: Failed to create widget '${widgetConfig.componentId}'`);
      }
    }

    console.log(`GridStack: Created ${widgetCount}/${layout.widgets.length} widgets`);

    // Send initial update with config to all components
    if (lastPollingData) {
      const config = await window.api.requestConfig();
      const updateData: ComponentUpdateData = {
        pollingData: lastPollingData,
        config: config,
        timestamp: new Date().toISOString(),
        printerState: lastPollingData.printerStatus?.state,
        connectionState: lastPollingData.isConnected
      };
      componentManager.updateAll(updateData);
      console.log('GridStack: Sent initial config update to all components');
    }

    // 5. Setup GridStack event handlers for auto-save
    gridStackManager.onChange(() => {
      console.log('GridStack: Layout changed, auto-saving...');
      const currentLayout = layoutPersistence.load();
      const updatedWidgets = gridStackManager.serialize();
      layoutPersistence.save({
        ...currentLayout,
        widgets: updatedWidgets,
      });
    });

    // 6. Initialize edit mode controller (but keep editing disabled by default)
    editModeController.initialize(gridStackManager, layoutPersistence);

    // 7. Disable editing by default (grid should be static for normal use)
    gridStackManager.disable();

    // 8. Setup palette integration (drag-drop and communication)
    setupPaletteIntegration();

    // Ensure the component manager transitions into initialized state
    if (!componentManager.isInitialized()) {
      console.log('GridStack: Finalizing component manager initialization...');
      await componentManager.initializeAll();
    }

    console.log('GridStack initialization complete');
    logMessage(`GridStack layout system initialized: ${widgetCount} widgets loaded`);

  } catch (error) {
    console.error('GridStack initialization failed:', error);
    logMessage(`ERROR: GridStack initialization failed: ${error}`);
    throw error;
  }
}

/**
 * Setup palette integration for component drag-drop and status synchronization
 */
function setupPaletteIntegration(): void {
  console.log('[GridStack] Setting up palette integration...');

  // Helper function to update palette with current grid state
  function updatePaletteStatus(): void {
    const componentsInUse = gridStackManager.serialize().map(w => w.componentId || w.id || '');
    const pinnedComponentIds = shortcutConfigManager.getPinnedComponentIds();

    if (window.api?.send) {
      window.api.send('palette:update-status', {
        componentsInUse,
        pinnedComponents: pinnedComponentIds
      });
      console.log(`[GridStack] Sent status update to palette: ${componentsInUse.length} in use, ${pinnedComponentIds.length} pinned`);
    }
  }

  /**
   * Add a component from the palette into the grid and component system
   */
  async function addComponentFromPalette(
    componentId: string,
    dropPosition?: { x: number; y: number }
  ): Promise<void> {
    console.log('[GridStack] Attempting to add component from palette:', componentId);

    const definition = getComponentDefinition(componentId);
    if (!definition) {
      console.error('[GridStack] Unknown component:', componentId);
      logMessage(`ERROR: Unknown component: ${componentId}`);
      return;
    }

    if (componentManager.getComponent(componentId)) {
      console.warn('[GridStack] Component already exists on grid:', componentId);
      logMessage(`Component ${definition.name} is already on the grid`);
      updatePaletteStatus();
      return;
    }

    if (document.querySelector(`[data-component-id="${componentId}"]`)) {
      console.warn('[GridStack] DOM already contains widget for component:', componentId);
      updatePaletteStatus();
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
      const widgetElement = createGridWidget(componentId);
      const addedWidget = gridStackManager.addWidget(config, widgetElement);

      if (!addedWidget) {
        throw new Error('GridStackManager.addWidget returned null');
      }

      const contentContainer = addedWidget.querySelector('.grid-stack-item-content') as HTMLElement | null;
      if (!contentContainer) {
        throw new Error('Grid widget missing content container');
      }

      const component = createComponentForGrid(componentId, contentContainer);
      if (!component) {
        throw new Error(`Unable to create component instance for ${componentId}`);
      }

      componentManager.registerComponent(component);
      await component.initialize();
      if (component instanceof LogPanelComponent) {
        await hydrateLogPanelWithHistory(component);
      }

      if (lastPollingData) {
        const config = await window.api.requestConfig();
        const updateData: ComponentUpdateData = {
          pollingData: lastPollingData,
          config: config,
          timestamp: new Date().toISOString(),
          printerState: lastPollingData.printerStatus?.state,
          connectionState: lastPollingData.isConnected
        };
        component.update(updateData);
      }

      const currentLayout = layoutPersistence.load();
      const updatedWidgets = gridStackManager.serialize();
      layoutPersistence.save({
        ...currentLayout,
        widgets: updatedWidgets,
      });

      updatePaletteStatus();

      console.log('[GridStack] Component added from palette:', componentId);
      logMessage(`Component ${definition.name} added to grid`);
    } catch (error) {
      console.error('[GridStack] Failed to add component from palette:', error);
      logMessage(`ERROR: Failed to add component ${componentId}: ${error}`);
    }
  }

  function removeComponentFromGrid(componentId: string): void {
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

    const currentLayout = layoutPersistence.load();
    const updatedWidgets = gridStackManager.serialize();
    layoutPersistence.save({
      ...currentLayout,
      widgets: updatedWidgets,
    });

    updatePaletteStatus();

    console.log('[GridStack] Component removed successfully:', componentId);
    logMessage(`Component ${componentId} removed from grid`);
  }

  // Listen for palette opened event
  if (window.api) {
    window.api.receive('palette:opened', () => {
      console.log('[GridStack] Palette opened, sending current status');
      updatePaletteStatus();
    });

    // Listen for edit mode toggle from palette window (CTRL+E)
    window.api.receive('edit-mode:toggle', () => {
      console.log('[GridStack] Edit mode toggle triggered from palette window');
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

      await addComponentFromPalette(id);
    });

    // Listen for component remove requests
    window.api.receive('grid:remove-component', (componentId: unknown) => {
      const id = componentId as string;
      removeComponentFromGrid(id);
    });
  }

  console.log('[GridStack] Palette integration setup complete');
}

/**
 * Initialize the PrinterTabsComponent for multi-printer support
 * Sets up the tabs UI and connects it to context events from main process
 */
async function initializePrinterTabs(): Promise<void> {
  console.log('Initializing printer tabs component...');

  try {
    const tabsContainer = document.getElementById('printer-tabs-container');
    if (!tabsContainer) {
      console.warn('Printer tabs container not found in DOM');
      return;
    }

    // Create and initialize tabs component
    printerTabsComponent = new PrinterTabsComponent();
    await printerTabsComponent.initialize(tabsContainer);

    // Listen for tab interaction events
    printerTabsComponent.on('tab-clicked', (...args: unknown[]) => {
      const contextId = args[0] as string;
      console.log(`Tab clicked: ${contextId}`);
      void window.api.printerContexts.switch(contextId);
    });

    printerTabsComponent.on('tab-closed', (...args: unknown[]) => {
      const contextId = args[0] as string;
      console.log(`Tab close requested: ${contextId}`);
      void window.api.printerContexts.remove(contextId);
    });

    printerTabsComponent.on('add-printer-clicked', () => {
      console.log('Add printer button clicked');
      window.api.send('open-printer-selection');
    });

    // Listen for context events from main process
    window.api.receive('printer-context-created', (...args: unknown[]) => {
      const event = args[0] as import('./types/PrinterContext').ContextCreatedEvent;
      console.log('Renderer received context-created event:', event);
      console.log('Event contextId:', event?.contextId);
      console.log('Event contextInfo:', event?.contextInfo);
      if (printerTabsComponent && event?.contextInfo) {
        printerTabsComponent.addTab(event.contextInfo);
      } else {
        console.error('Cannot add tab: event or contextInfo is missing', { event, hasComponent: !!printerTabsComponent });
      }
    });

    window.api.receive('printer-context-switched', (...args: unknown[]) => {
      const event = args[0] as { contextId: string };
      console.log('Renderer received context-switched event:', event);

      // Update active tab
      if (printerTabsComponent) {
        printerTabsComponent.setActiveTab(event.contextId);
      }

      // Clear printer-specific state from previous context
      // Note: filtrationAvailable will be updated by polling data
      filtrationAvailable = false;
      ifsMenuItemVisible = false;
      isLegacyPrinter = false;

      // Update button states to reflect cleared state
      // Note: Filtration buttons are managed by FiltrationControlsComponent
      updateIFSMenuItemVisibility();
      updateLegacyPrinterButtonStates();

      //       // Request fresh printer data for the new context
      //       // The polling-update event will automatically update the UI when data arrives
      //       void window.api.requestPrinterStatus().then(() => {
      //         console.log('Requested printer status for new context');
      //       }).catch((error: unknown) => {
      //         console.error('Failed to request printer status for new context:', error);
      //       });
    });

    window.api.receive('printer-context-removed', (...args: unknown[]) => {
      const event = args[0] as { contextId: string };
      console.log('Renderer received context-removed event:', event);
      if (printerTabsComponent) {
        printerTabsComponent.removeTab(event.contextId);
      }
    });

    window.api.receive('printer-context-updated', (...args: unknown[]) => {
      const event = args[0] as { contextId: string; updates: Partial<import('./types/PrinterContext').PrinterContextInfo> };
      console.log('Renderer received context-updated event:', event);
      if (printerTabsComponent) {
        printerTabsComponent.updateTab(event.contextId, event.updates);
      }
    });

    console.log('Printer tabs component initialized successfully');
    logMessage('Multi-printer tabs UI initialized');

  } catch (error) {
    console.error('Failed to initialize printer tabs component:', error);
    logMessage(`ERROR: Printer tabs initialization failed: ${error}`);
  }
}

// ============================================================================
// ENHANCED LOGGING FUNCTION
// ============================================================================

/**
 * Enhanced logging function that integrates with LogPanelComponent
 * Falls back to DOM manipulation if component is not available
 * @param message - The message to log
 */
function logMessage(message: string): void {
  // Always send to main process LogService for centralized storage
  if (window.api) {
    window.api.send('add-log-message', message);
  }
  
  // Try to use LogPanelComponent if available (for backward compatibility while log panel is hidden)
  if (logPanelComponent && logPanelComponent.isInitialized()) {
    try {
      logPanelComponent.addLogMessage(message);
      return;
    } catch (error) {
      console.error('LogPanelComponent failed, falling back to DOM:', error);
    }
  }
  
  // Fallback to direct DOM manipulation (for early initialization or component failure)
  const logOutput = document.getElementById('log-output');
  if (logOutput) {
    const timestamp = new Date().toLocaleTimeString();
    logOutput.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    logOutput.scrollTop = logOutput.scrollHeight;
  } else {
    // Last resort - console only
    console.log(`[FALLBACK] ${message}`);
  }
}

async function hydrateLogPanelWithHistory(logPanel: LogPanelComponent): Promise<void> {
  if (!window.api?.invoke) {
    return;
  }

  try {
    const result = await window.api.invoke('log-dialog-request-logs');
    if (!Array.isArray(result)) {
      return;
    }

    const entries = result.filter(
      (entry): entry is { timestamp: string; message: string } =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { timestamp?: unknown }).timestamp === 'string' &&
        typeof (entry as { message?: unknown }).message === 'string'
    );

    if (entries.length === 0 || logPanel.isDestroyed()) {
      return;
    }

    logPanel.loadInitialEntries(
      entries.map((entry) => ({
        timestamp: entry.timestamp,
        message: entry.message,
      }))
    );
  } catch (error) {
    console.error('Failed to hydrate log panel with history:', error);
  }
}

// Note: updateUIElement function removed - components handle their own DOM updates

function setupWindowControls(): void {
  // Standard window controls (for non-macOS)
  const minimizeBtn = document.getElementById('btn-minimize');
  const maximizeBtn = document.getElementById('btn-maximize');
  const closeBtn = document.getElementById('btn-close');

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      logMessage('Minimize button clicked');
      if (window.api) {
        window.api.send('window-minimize');
      } else {
        logMessage('ERROR: API not available for minimize');
      }
    });
  }

  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', () => {
      logMessage('Maximize button clicked');
      if (window.api) {
        window.api.send('window-maximize');
      } else {
        logMessage('ERROR: API not available for maximize');
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      logMessage('Close button clicked');
      if (window.api) {
        window.api.send('window-close');
      } else {
        logMessage('ERROR: API not available for close');
      }
    });
  }

  // MacOS traffic light controls
  const trafficCloseBtn = document.getElementById('traffic-close');
  const trafficMinimizeBtn = document.getElementById('traffic-minimize');
  const trafficMaximizeBtn = document.getElementById('traffic-maximize');

  if (trafficCloseBtn) {
    trafficCloseBtn.addEventListener('click', () => {
      logMessage('Traffic light close clicked');
      if (window.api) {
        window.api.send('window-close');
      } else {
        logMessage('ERROR: API not available for traffic close');
      }
    });
  }

  if (trafficMinimizeBtn) {
    trafficMinimizeBtn.addEventListener('click', () => {
      logMessage('Traffic light minimize clicked');
      if (window.api) {
        window.api.send('window-minimize');
      } else {
        logMessage('ERROR: API not available for traffic minimize');
      }
    });
  }

  if (trafficMaximizeBtn) {
    trafficMaximizeBtn.addEventListener('click', () => {
      logMessage('Traffic light maximize clicked');
      if (window.api) {
        window.api.send('window-maximize');
      } else {
        logMessage('ERROR: API not available for traffic maximize');
      }
    });
  }
}

async function handleTemperatureDialog(buttonId: string): Promise<void> {
  if (!window.api || !window.api.showInputDialog) {
    logMessage('ERROR: Input dialog API not available');
    return;
  }

  const isBedTemp = buttonId === 'btn-bed-set';
  const targetType = isBedTemp ? 'bed' : 'extruder';
  const maxTemp = isBedTemp ? 120 : 300;
  const defaultTemp = isBedTemp ? 60 : 200;

  try {
    const result = await window.api.showInputDialog({
      title: `Set ${targetType.charAt(0).toUpperCase() + targetType.slice(1)} Temperature`,
      message: `Enter target temperature (0-${maxTemp}°C):`,
      defaultValue: defaultTemp.toString(),
      inputType: 'text',
      placeholder: `e.g. ${defaultTemp}`
    });

    if (result !== null) {
      const temperature = parseInt(result, 10);
      
      if (isNaN(temperature)) {
        logMessage(`ERROR: Invalid temperature value: ${result}`);
        return;
      }
      
      if (temperature < 0 || temperature > maxTemp) {
        logMessage(`ERROR: Temperature out of range (0-${maxTemp}°C): ${temperature}`);
        return;
      }
      
      logMessage(`Setting ${targetType} temperature to ${temperature}°C`);
      
      // Send IPC message to actually set the temperature
      if (window.api) {
        const response = await window.api.invoke(isBedTemp ? 'set-bed-temp' : 'set-extruder-temp', temperature) as { success: boolean; error?: string };
        if (response.success) {
          logMessage(`${targetType.charAt(0).toUpperCase() + targetType.slice(1)} temperature command sent successfully`);
        } else {
          logMessage(`ERROR: Failed to set ${targetType} temperature: ${response.error || 'Unknown error'}`);
        }
      }
    } else {
      logMessage(`${targetType.charAt(0).toUpperCase() + targetType.slice(1)} temperature setting cancelled`);
    }
  } catch (error) {
    logMessage(`ERROR: Failed to show temperature dialog: ${error}`);
  }
}

async function handleCameraToggle(button: HTMLElement): Promise<void> {
  const cameraView = document.querySelector('.camera-view');
  
  if (!cameraView || !window.api?.camera) {
    logMessage('ERROR: Camera view or API not available');
    return;
  }
  
  try {
    // Toggle preview state
    previewEnabled = !previewEnabled;
    button.textContent = previewEnabled ? 'Preview Off' : 'Preview On';
    
    if (previewEnabled) {
      // Check camera availability
      const cameraConfigRaw = await window.api.camera.getConfig();
      const cameraConfig = cameraConfigRaw as ResolvedCameraConfig | null;
      
      if (!cameraConfig) {
        // No printer connected
        cameraView.innerHTML = '<div class="no-camera">Please connect to a printer first</div>';
        (cameraView as HTMLElement).style.backgroundColor = 'var(--darker-bg)';
        previewEnabled = false;
        button.textContent = 'Preview On';
        logMessage('Cannot enable camera - no printer connected');
        return;
      }
      
      if (!cameraConfig.isAvailable) {
        // Camera not available
        const reason = cameraConfig.unavailableReason || 'Camera not available';
        cameraView.innerHTML = `<div class="no-camera">${reason}</div>`;
        (cameraView as HTMLElement).style.backgroundColor = 'var(--darker-bg)';
        previewEnabled = false;
        button.textContent = 'Preview On';
        logMessage(`Cannot enable camera: ${reason}`);
        
        // Show helpful message based on reason
        if (reason.includes('does not have a built-in camera')) {
          logMessage('Enable custom camera in settings to use an external camera');
        } else if (reason.includes('URL')) {
          logMessage('Please configure camera URL in settings');
        }
        return;
      }
      
      // Camera is available - get proxy URL and show stream
      const proxyUrl = await window.api.camera.getProxyUrl();
      const streamUrl = `${proxyUrl}`; // The proxy URL already includes /camera
      
      logMessage(`Enabling camera preview from: ${cameraConfig.sourceType} camera`);
      
      // Clear existing content
      cameraView.innerHTML = '';
      
      // Create image element for MJPEG stream
      cameraStreamElement = document.createElement('img');
      cameraStreamElement.src = streamUrl;
      cameraStreamElement.style.width = '100%';
      cameraStreamElement.style.height = '100%';
      cameraStreamElement.style.objectFit = 'fill'; // Stretch to fill entire space
      cameraStreamElement.alt = 'Camera Stream';
      
      // Handle stream errors
      cameraStreamElement.onerror = () => {
        logMessage('Camera stream error - attempting to restore...');
        // Try to restore the stream
        void window.api.camera.restoreStream().then(restored => {
          if (!restored) {
            cameraView.innerHTML = '<div class="no-camera">Camera stream error</div>';
          }
        });
      };
      
      // Handle successful load
      cameraStreamElement.onload = () => {
        logMessage('Camera stream connected successfully');
      };
      
      cameraView.appendChild(cameraStreamElement);
      (cameraView as HTMLElement).style.backgroundColor = 'var(--darker-bg)';
      
    } else {
      // Disable camera preview
      logMessage('Disabling camera preview');
      
      // Stop the stream by properly cleaning up the image element
      if (cameraStreamElement) {
        // Remove error handlers to prevent false error events when clearing src
        cameraStreamElement.onerror = null;
        cameraStreamElement.onload = null;
        
        // Clear the source to stop the stream
        cameraStreamElement.src = '';
        cameraStreamElement = null;
      }
      
      // Restore the no-camera message
      cameraView.innerHTML = '<div class="no-camera">Preview Disabled</div>';
      (cameraView as HTMLElement).style.backgroundColor = 'var(--darker-bg)';
      
      // Notify backend that preview is disabled
      await window.api.camera.setEnabled(false);
    }
    
  } catch (error) {
    logMessage(`ERROR: Camera toggle failed: ${error}`);
    previewEnabled = false;
    button.textContent = 'Preview On';
    cameraView.innerHTML = '<div class="no-camera">Camera error</div>';
  }
}

// ============================================================================
// SHORTCUT BUTTON SYSTEM
// ============================================================================

/**
 * Initialize shortcut buttons in topbar
 * Sets up shortcut slots and IPC listeners for config updates
 */
function initializeShortcutButtons(): void {
  console.log('[ShortcutButtons] Initializing topbar shortcuts');

  // Load and apply current configuration
  const config = shortcutConfigManager.load();
  updateShortcutButtons(config);

  // Setup shortcut button click handlers
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

  // Listen for configuration updates from shortcut config dialog
  if (window.api) {
    window.api.receive('shortcut-config:updated', (data: unknown) => {
      console.log('[ShortcutButtons] Configuration updated:', data);
      const config = data as ShortcutButtonConfig;
      updateShortcutButtons(config);

      // Reload grid to reflect pinned/unpinned components
      void reloadGridLayout();
    });
  }

  // Setup IPC request handlers for shortcut config dialog
  setupShortcutConfigRequestHandlers();

  console.log('[ShortcutButtons] Initialization complete');
}

/**
 * Setup IPC request handlers for shortcut configuration
 * These handlers respond to requests from the shortcut config dialog
 */
function setupShortcutConfigRequestHandlers(): void {
  if (!window.api) {
    return;
  }

  // Handle get-current-request
  window.api.receive('shortcut-config:get-current-request', (data: unknown) => {
    const responseChannel = data as string;
    const config = shortcutConfigManager.load();

    if (window.api?.send) {
      window.api.send(responseChannel, config);
    }
  });

  // Handle save-request
  window.api.receive('shortcut-config:save-request', (data: unknown) => {
    const { config, responseChannel } = data as {
      config: ShortcutButtonConfig;
      responseChannel: string;
    };

    try {
      shortcutConfigManager.save(config);
      if (window.api?.send) {
        window.api.send(responseChannel, { success: true });
      }
    } catch (error) {
      if (window.api?.send) {
        window.api.send(responseChannel, {
          success: false,
          error: String(error),
        });
      }
    }
  });

  // Handle get-components-request
  window.api.receive('shortcut-config:get-components-request', (data: unknown) => {
    const responseChannel = data as string;

    const componentsWithStatus = getAvailableComponentsForShortcutConfig();
    if (window.api?.send) {
      window.api.send(responseChannel, componentsWithStatus);
    }
  });
}

/**
 * Get all components eligible for shortcut assignment.
 * Only return components that are not currently present in the grid layout,
 * while always including components that are already pinned to a shortcut slot.
 */
function getAvailableComponentsForShortcutConfig(): Array<{
  id: string;
  name: string;
  icon: string;
  category: string;
  isPinned: boolean;
}> {
  const config = shortcutConfigManager.load();
  const pinnedIds = new Set(
    Object.values(config.slots).filter((id): id is string => id !== null)
  );

  const activeGridComponents = getActiveGridComponentIds();

  const selectableComponents = getAllComponents()
    .filter((component) => {
      if (pinnedIds.has(component.id)) {
        return true;
      }

      return !activeGridComponents.has(component.id);
    })
    .map((component) => ({
      id: component.id,
      name: component.name,
      icon: component.icon ?? '',
      category: component.category,
      isPinned: pinnedIds.has(component.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return selectableComponents;
}

/**
 * Collect component IDs currently rendered within the GridStack layout.
 */
function getActiveGridComponentIds(): Set<string> {
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

/**
 * Update topbar shortcut buttons based on configuration
 * Shows/hides buttons and updates their labels and icons
 */
function updateShortcutButtons(config: ShortcutButtonConfig): void {
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

/**
 * Reload grid layout excluding pinned components
 * Called when shortcut configuration changes to update grid contents
 */
async function reloadGridLayout(): Promise<void> {
  console.log('[ShortcutButtons] Reloading grid layout');

  try {
    const config = shortcutConfigManager.load();
    const pinnedIds = Object.values(config.slots).filter((id): id is string => id !== null);

    console.log('[ShortcutButtons] Pinned component IDs:', pinnedIds);

    // Get current grid state
    const grid = gridStackManager.getGrid();
    if (!grid) {
      console.warn('[ShortcutButtons] Grid not initialized yet');
      return;
    }

    // Get all grid items
    const gridItems = Array.from(grid.getGridItems() || []);

    // Remove pinned components from grid
    for (const item of gridItems) {
      const componentId = item.getAttribute('data-component-id');
      if (componentId && pinnedIds.includes(componentId)) {
        console.log(`[ShortcutButtons] Removing pinned component from grid: ${componentId}`);

        // Destroy component instance before removing widget
        const component = componentManager.getComponent(componentId);
        if (component) {
          componentManager.removeComponent(componentId);
          component.destroy();
        }

        // Remove widget from grid
        gridStackManager.removeWidget(item as HTMLElement);

        if (componentId === 'log-panel') {
          logPanelComponent = null;
        }
      }
    }

    // Check if any unpinned components should be added back to grid
    // (This handles the case where a component was unpinned)
    const layout = layoutPersistence.load();
    const currentGridComponentIds = gridItems
      .map(item => item.getAttribute('data-component-id'))
      .filter((id): id is string => id !== null);

    for (const widgetConfig of layout.widgets) {
      const componentId = widgetConfig.componentId;

      // Skip if pinned or already in grid
      if (pinnedIds.includes(componentId) || currentGridComponentIds.includes(componentId)) {
        continue;
      }

      // Add back to grid
      console.log(`[ShortcutButtons] Adding unpinned component back to grid: ${componentId}`);
      await addComponentToGrid(componentId, widgetConfig);
    }

    // Save updated layout
    const currentLayout = layoutPersistence.load();
    const updatedLayout = gridStackManager.serialize();
    layoutPersistence.save({
      ...currentLayout,
      widgets: updatedLayout
    });

    console.log('[ShortcutButtons] Grid reload complete');
  } catch (error) {
    console.error('[ShortcutButtons] Error reloading grid:', error);
  }
}

/**
 * Helper function to add a component to the grid
 */
async function addComponentToGrid(componentId: string, widgetConfig?: GridStackWidgetConfig): Promise<void> {
  const componentDef = getComponentDefinition(componentId);
  if (!componentDef) {
    console.error(`[ShortcutButtons] Component definition not found: ${componentId}`);
    return;
  }

  // Create widget element
  const widgetElement = document.createElement('div');
  widgetElement.className = 'grid-stack-item';
  widgetElement.setAttribute('data-component-id', componentId);
  widgetElement.setAttribute('gs-id', `widget-${componentId}`);

  // Add content container
  const contentContainer = document.createElement('div');
  contentContainer.className = 'grid-stack-item-content';
  widgetElement.appendChild(contentContainer);

  // Use provided config or create default
  const config: GridStackWidgetConfig = widgetConfig || {
    componentId,
    w: componentDef.defaultSize?.w || 4,
    h: componentDef.defaultSize?.h || 3,
    minW: componentDef.minSize?.w,
    minH: componentDef.minSize?.h,
    id: `widget-${componentId}`,
    autoPosition: true
  };

  // Add to grid
  const addedWidget = gridStackManager.addWidget(config, widgetElement);

  if (addedWidget) {
    // Create component instance
    const component = createComponentInstance(componentId, contentContainer);

    if (component) {
      componentManager.registerComponent(component);
      await component.initialize();

      // Update with last polling data if available
      if (lastPollingData) {
        const updateData: ComponentUpdateData = {
          pollingData: lastPollingData,
          timestamp: new Date().toISOString(),
          printerState: lastPollingData.printerStatus?.state,
          connectionState: lastPollingData.isConnected
        };
        component.update(updateData);
      }
    }
  }
}

/**
 * Helper function to create component instance by ID
 */
function createComponentInstance(componentId: string, container: HTMLElement) {
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
      logPanelComponent = logPanel;
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

function setupBasicButtons(): void {
  // Add click listeners to all buttons for visual feedback
  const buttons = [
    'btn-led-on', 'btn-led-off', 'btn-clear-status', 'btn-home-axes',
    'btn-pause', 'btn-resume', 'btn-stop', 'btn-upload-job',
    'btn-start-recent', 'btn-start-local', 'btn-swap-filament', 'btn-send-cmds',
    'btn-preview',
    'btn-bed-set', 'btn-bed-off', 'btn-extruder-set', 'btn-extruder-off',
    'btn-external-filtration', 'btn-internal-filtration', 'btn-no-filtration'
  ];

  buttons.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.addEventListener('click', async () => {


        // Special handling for preview button
        if (buttonId === 'btn-preview') {
          void handleCameraToggle(button);
          return;
        }

        // Special handling for temperature setting buttons
        if (buttonId === 'btn-bed-set' || buttonId === 'btn-extruder-set') {
          void handleTemperatureDialog(buttonId);
          return;
        }
        
        // Send IPC message if API is available
        if (window.api) {
          // Map button IDs to IPC channels (for dialogs and simple sends only)
          const channelMap: { [key: string]: string | { channel: string; data?: unknown } } = {
            'btn-upload-job': 'open-job-uploader',
            'btn-start-recent': 'show-recent-files',
            'btn-start-local': 'show-local-files',
            'btn-send-cmds': 'open-send-commands',
            'btn-external-filtration': { channel: 'set-filtration', data: 'external' },
            'btn-internal-filtration': { channel: 'set-filtration', data: 'internal' },
            'btn-no-filtration': { channel: 'set-filtration', data: 'off' }
          };
          
          const mapping = channelMap[buttonId];
          if (mapping) {
            if (typeof mapping === 'string') {
              // Simple send for most buttons
              console.log(`Sending IPC message: ${mapping}`);
              window.api.send(mapping);
            } else if (typeof mapping === 'object' && mapping.channel) {
              // Handle buttons that need invoke with data (like filtration)
              if (mapping.channel === 'set-filtration') {
                try {
                  const response = await window.api.invoke(mapping.channel, mapping.data) as { success: boolean; error?: string };
                  if (response.success) {
                    logMessage(`Filtration mode set to ${mapping.data}`);
                  } else {
                    logMessage(`ERROR: Failed to set filtration: ${response.error || 'Unknown error'}`);
                  }
                } catch (error) {
                  logMessage(`ERROR: Filtration control failed: ${error}`);
                }
              }
            }
          } else {
            // For buttons that need invoke (control commands that return responses)
            const invokeMap: { [key: string]: string } = {
              'btn-led-on': 'led-on',
              'btn-led-off': 'led-off',
              'btn-home-axes': 'home-axes',
              'btn-pause': 'pause-print',
              'btn-resume': 'resume-print',
              'btn-stop': 'cancel-print',
              'btn-clear-status': 'clear-status',
              'btn-bed-off': 'turn-off-bed-temp',
              'btn-extruder-off': 'turn-off-extruder-temp'
            };
            
            const invokeChannel = invokeMap[buttonId];
            if (invokeChannel) {
              try {
                const response = await window.api.invoke(invokeChannel) as { success: boolean; error?: string };
                if (response.success) {
                  logMessage(`Command ${invokeChannel} executed successfully`);
                } else {
                  logMessage(`ERROR: Command ${invokeChannel} failed: ${response.error || 'Unknown error'}`);
                }
              } catch (error) {
                logMessage(`ERROR: Failed to execute ${invokeChannel}: ${error}`);
              }
            }
          }
        }
      });
    }
  });
}

// ============================================================================
// HAMBURGER MENU FUNCTIONALITY
// ============================================================================

/**
 * Closes the hamburger menu with fade-out timing
 */
function closeMainMenu(): void {
  if (!isMainMenuOpen || !mainMenuDropdown) {
    return;
  }

  isMainMenuOpen = false;
  mainMenuDropdown.classList.remove('show');
  mainMenuButton?.setAttribute('aria-expanded', 'false');

  if (mainMenuCloseTimeout !== null) {
    window.clearTimeout(mainMenuCloseTimeout);
    mainMenuCloseTimeout = null;
  }

  // Hide the dropdown after the fade-out animation completes
  mainMenuCloseTimeout = window.setTimeout(() => {
    if (!isMainMenuOpen && mainMenuDropdown) {
      mainMenuDropdown.classList.add('hidden');
    }
    mainMenuCloseTimeout = null;
  }, 150);
}

/**
 * Opens the hamburger menu and prepares animation state
 */
function openMainMenu(): void {
  if (isMainMenuOpen || !mainMenuDropdown) {
    return;
  }

  if (mainMenuCloseTimeout !== null) {
    window.clearTimeout(mainMenuCloseTimeout);
    mainMenuCloseTimeout = null;
  }

  isMainMenuOpen = true;
  mainMenuDropdown.classList.remove('hidden');

  // Trigger reflow to ensure the transition runs
  void mainMenuDropdown.offsetHeight;

  mainMenuDropdown.classList.add('show');
  mainMenuButton?.setAttribute('aria-expanded', 'true');
}

/**
 * Toggles hamburger menu visibility
 */
function toggleMainMenu(): void {
  if (isMainMenuOpen) {
    closeMainMenu();
  } else {
    openMainMenu();
  }
}

/**
 * Initializes hamburger menu interactions and IPC wiring
 */
function initializeMainMenu(): void {
  mainMenuButton = document.getElementById('btn-main-menu') as HTMLButtonElement | null;
  mainMenuDropdown = document.getElementById('main-menu-dropdown') as HTMLDivElement | null;

  if (!mainMenuButton || !mainMenuDropdown) {
    console.warn('[MainMenu] Hamburger menu elements not found in DOM');
    return;
  }

  mainMenuButton.setAttribute('aria-expanded', 'false');
  mainMenuDropdown.classList.add('hidden');

  mainMenuButton.addEventListener('click', (event: MouseEvent) => {
    event.stopPropagation();
    toggleMainMenu();
  });

  const menuItems = mainMenuDropdown.querySelectorAll<HTMLButtonElement>('.menu-item');
  menuItems.forEach((item) => {
    item.addEventListener('click', () => {
      const action = item.getAttribute('data-action');
      const channel = isMainMenuAction(action) ? MAIN_MENU_ACTION_CHANNELS[action] : undefined;
      if (channel && window.api?.send) {
        window.api.send(channel);
      }
      closeMainMenu();
    });
  });

  // Close menu when clicking outside of it
  document.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as Node | null;
    const button = mainMenuButton;
    const dropdown = mainMenuDropdown;
    if (
      isMainMenuOpen &&
      target &&
      button &&
      dropdown &&
      !button.contains(target) &&
      !dropdown.contains(target)
    ) {
      closeMainMenu();
    }
  });

  // Close menu on Escape and return focus to trigger
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isMainMenuOpen) {
      closeMainMenu();
      mainMenuButton?.focus();
    }
  });
}

/**
 * Initialize UI with default state and prepare for component system
 * This function now serves as a bridge between legacy initialization and components
 */
function initializeUI(): void {
  // Initialize UI animations for smooth updates (preserve existing functionality)
  initializeUIAnimations();
  
  // Set initial preview button state (non-componentized)
  const previewBtn = document.getElementById('btn-preview');
  if (previewBtn) {
    previewBtn.textContent = 'Preview On';
  }
  
  // Initialize filtration button states (disabled by default until backend reports availability)
  updateFiltrationButtonStates();
  
  // Initialize legacy printer button states (disabled by default until backend is initialized)
  updateLegacyPrinterButtonStates();
  
  // Component initialization occurs during GridStack setup
  logMessage('UI initialization complete - awaiting component system');
}

/**
 * Update button states based on printer state and backend features
 * Disables certain buttons during printing/paused states for safety
 * Disables print control buttons when printer is ready/completed
 */
function updateButtonStates(printerState: string): void {
  // Use the new state categories
  const isActiveState = printerState === 'Printing' || 
                       printerState === 'Paused' ||
                       printerState === 'Calibrating' ||
                       printerState === 'Heating' ||
                       printerState === 'Pausing';
                       

                      
  const canControlPrint = printerState === 'Printing' ||
                         printerState === 'Paused' ||
                         printerState === 'Heating' ||
                         printerState === 'Calibrating';
                         
  const isBusy = printerState === 'Busy' || printerState === 'Error';
  
  // Buttons that should be disabled during active states
  const buttonsToDisable = [
    'btn-bed-set',
    'btn-bed-off',
    'btn-extruder-set',
    'btn-extruder-off',
    'btn-start-recent',
    'btn-start-local',
    'btn-upload-job',
    'btn-home-axes'
  ];
  
  // Buttons that should be disabled when printer is in ready/completed states
  const printControlButtons = [
    'btn-pause',
    'btn-resume',
    'btn-stop'
  ];
  
  // Disable safety buttons during active states
  buttonsToDisable.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      if (isActiveState || isBusy) {
        // Disable button
        button.classList.add('disabled');
        button.setAttribute('disabled', 'true');
        (button as HTMLButtonElement).disabled = true;
      } else {
        // Enable button
        button.classList.remove('disabled');
        button.removeAttribute('disabled');
        (button as HTMLButtonElement).disabled = false;
      }
    }
  });
  
  // Handle print control buttons with more specific logic
  printControlButtons.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      let shouldDisable = false;
      
      // Specific logic for each print control button
      if (buttonId === 'btn-pause') {
        shouldDisable = printerState !== 'Printing';
      } else if (buttonId === 'btn-resume') {
        shouldDisable = printerState !== 'Paused';
      } else if (buttonId === 'btn-stop') {
        shouldDisable = !canControlPrint;
      }
      
      if (shouldDisable) {
        button.classList.add('disabled');
        button.setAttribute('disabled', 'true');
        (button as HTMLButtonElement).disabled = true;
      } else {
        button.classList.remove('disabled');
        button.removeAttribute('disabled');
        (button as HTMLButtonElement).disabled = false;
      }
    }
  });
  
  // Update filtration button states based on backend features
  updateFiltrationButtonStates();
  
  // Update legacy printer button states based on printer type
  updateLegacyPrinterButtonStates();
  

}

/**
 * Update filtration button states based on backend feature availability
 */
function updateFiltrationButtonStates(): void {
  const filtrationButtons = [
    'btn-external-filtration',
    'btn-internal-filtration', 
    'btn-no-filtration'
  ];
  
  filtrationButtons.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      if (filtrationAvailable) {
        button.classList.remove('disabled');
        (button as HTMLButtonElement).disabled = false;
      } else {
        button.classList.add('disabled');
        (button as HTMLButtonElement).disabled = true;
      }
    }
  });
}

/**
 * Update IFS menu item visibility based on material station availability
 */
function updateIFSMenuItemVisibility(): void {
  const ifsMenuItem = document.getElementById('menu-item-ifs');
  if (!ifsMenuItem) {
    return;
  }

  if (ifsMenuItemVisible) {
    ifsMenuItem.classList.remove('hidden');
  } else {
    ifsMenuItem.classList.add('hidden');
  }

  menuShortcutManager.setActionEnabled('ifs', ifsMenuItemVisible);
}

/**
 * Update legacy printer button states based on printer backend type
 * Disables unsupported features for legacy printers
 */
function updateLegacyPrinterButtonStates(): void {
  // Buttons that should be disabled for legacy printers
  const legacyUnsupportedButtons = [
    'btn-clear-status',  // Clear Status - not supported on legacy printers
    'btn-upload-job'     // Upload Job - not supported on legacy printers
  ];
  
  // Buttons that should remain enabled for legacy printers
  const legacySupportedButtons = [
    'btn-start-local'    // Start Local Job - supported on legacy printers
  ];
  
  if (isLegacyPrinter) {
    // Disable unsupported buttons for legacy printers
    legacyUnsupportedButtons.forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.classList.add('disabled', 'legacy-unsupported');
        button.setAttribute('disabled', 'true');
        (button as HTMLButtonElement).disabled = true;
        
        // Add title attribute to show why button is disabled
        button.setAttribute('title', 'Not supported on legacy printers');
        
        console.log(`[LegacyUI] Disabled ${buttonId} for legacy printer`);
      }
    });
    
    // Ensure supported buttons remain enabled (unless disabled by other logic)
    legacySupportedButtons.forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button) {
        // Only enable if not disabled by other state logic
        if (!button.classList.contains('disabled') || button.classList.contains('legacy-unsupported')) {
          button.classList.remove('disabled', 'legacy-unsupported');
          button.removeAttribute('disabled');
          (button as HTMLButtonElement).disabled = false;
          button.removeAttribute('title');
          
          console.log(`[LegacyUI] Ensured ${buttonId} is enabled for legacy printer`);
        }
      }
    });
    
    logMessage('Legacy printer detected - unsupported buttons disabled');
  } else {
    // For modern printers, remove legacy-specific restrictions
    [...legacyUnsupportedButtons, ...legacySupportedButtons].forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button && button.classList.contains('legacy-unsupported')) {
        button.classList.remove('legacy-unsupported');
        button.removeAttribute('disabled');
        (button as HTMLButtonElement).disabled = false;
        button.removeAttribute('title');
        
        console.log(`[LegacyUI] Removed legacy restrictions from ${buttonId} for modern printer`);
      }
    });
  }
}

/**
 * Detect if a printer backend type indicates a legacy printer
 */
function isLegacyBackendType(backendType: string): boolean {
  // Legacy printers use GenericLegacyBackend
  return backendType.toLowerCase().includes('legacy') || 
         backendType.toLowerCase().includes('generic');
}

// ============================================================================
// REAL-TIME POLLING INTEGRATION
// ============================================================================

// ============================================================================
// COMPONENT SYSTEM DATA UPDATES
// ============================================================================

/**
 * Initialize event listeners for polling updates from main process
 * This function is enhanced to work with the component system
 */
function initializePollingListeners(): void {
  if (!window.api) {
    console.error('API not available for polling listeners');
    return;
  }
  
  // Listen for polling updates from main process
  window.api.receive('polling-update', (data: unknown) => {
    const pollingData = data as PollingData;

    // Store for new components
    lastPollingData = pollingData;

    try {
      // Update filtration availability from backend data (preserve existing logic)
      if (pollingData.printerStatus && pollingData.printerStatus.filtration) {
        const newFiltrationAvailable = pollingData.printerStatus.filtration.available;
        if (newFiltrationAvailable !== filtrationAvailable) {
          filtrationAvailable = newFiltrationAvailable;
          logMessage(`Filtration ${filtrationAvailable ? 'available' : 'not available'} on this printer`);
          updateFiltrationButtonStates();
        }
      }
      
      // Update IFS menu item visibility for AD5X printers with material station
      if (pollingData.materialStation && pollingData.isConnected) {
        const shouldShowIFS = pollingData.materialStation.connected;
        if (shouldShowIFS !== ifsMenuItemVisible) {
          ifsMenuItemVisible = shouldShowIFS;
          updateIFSMenuItemVisibility();
        }
      } else if (ifsMenuItemVisible) {
        // Hide IFS menu item when disconnected or no material station
        ifsMenuItemVisible = false;
        updateIFSMenuItemVisibility();
      }
      
      // COMPONENT SYSTEM INTEGRATION: Replace updateAllPanels with componentManager.updateAll
      if (componentsInitialized && componentManager.isInitialized()) {
        try {
          // Create component update data from polling data
          const updateData: ComponentUpdateData = {
            pollingData: pollingData,
            timestamp: new Date().toISOString(),
            // Add any other update data fields as needed by components
            printerState: pollingData.printerStatus?.state,
            connectionState: pollingData.isConnected
          };
          
          // Update all components with centralized manager
          componentManager.updateAll(updateData);
        } catch (error) {
          console.error('Component system update failed:', error);
          logMessage(`ERROR: Component update failed: ${error}`);
          
          // Fallback to legacy update system if components fail
          console.warn('Falling back to legacy UI update system');
          // Note: updateAllPanels is removed, so we'll handle this gracefully
          handleUIError(error, 'component system failure');
        }
      } else {
        // Components not ready yet - log but don't fail
        console.warn('Components not initialized yet, skipping update');
      }
      
      // Update state tracker based on printer status (preserve existing logic)
      const stateTracker = getGlobalStateTracker();
      if (pollingData.printerStatus && pollingData.isConnected) {
        stateTracker.setState(pollingData.printerStatus.state, 'polling update');
      } else if (!pollingData.isConnected) {
        stateTracker.onDisconnected();
      }
      
    } catch (error) {
      handleUIError(error, 'polling update');
    }
  });

  console.log('Enhanced polling listeners initialized - component system integration active');
}

/**
 * Initialize state tracking and backend event listeners
 */
function initializeStateAndEventListeners(): void {
  const stateTracker = getGlobalStateTracker();
  
  // Set up state change listeners
  stateTracker.on(STATE_EVENTS.CHANGED, (event: StateChangeEvent) => {
    console.log('Printer state changed:', event.previousState, '→', event.currentState);

    updateButtonStates(event.currentState);
  });
  
  stateTracker.on(STATE_EVENTS.CONNECTED, () => {
    console.log('Printer connected');

  });
  
  stateTracker.on(STATE_EVENTS.DISCONNECTED, () => {
    console.log('Printer disconnected');
    logMessage('Printer disconnected');
    resetUI();
    
    // Reset filtration availability on disconnect
    filtrationAvailable = false;
    updateFiltrationButtonStates();
    
    // Reset IFS menu visibility on disconnect
    ifsMenuItemVisible = false;
    updateIFSMenuItemVisibility();
    
    // Reset legacy printer flag on disconnect
    isLegacyPrinter = false;
    updateLegacyPrinterButtonStates();
    console.log('[LegacyUI] Reset legacy printer flag on state disconnect');
  });
  
  // Listen for backend events
  if (window.api) {
    window.api.receive('backend-initialized', (...args: unknown[]) => {
      const data = args[0] as { success: boolean; printerName: string; modelType: string; backendType?: string; timestamp: string };
      console.log('Backend initialized:', data);
      logMessage(`Backend ready for ${data.printerName} (${data.modelType})`);
      
      // Detect legacy printer based on backend type or model type
      const backendType = data.backendType || data.modelType || '';
      isLegacyPrinter = isLegacyBackendType(backendType);
      
      if (isLegacyPrinter) {
        console.log('[LegacyUI] Legacy printer detected:', backendType);
        logMessage('Legacy printer detected - some features will be disabled');
      } else {
        console.log('[LegacyUI] Modern printer detected:', backendType);
      }
      
      // Update button states for legacy printer compatibility
      updateLegacyPrinterButtonStates();
    });
    
    window.api.receive('backend-initialization-failed', (...args: unknown[]) => {
      const data = args[0] as { success: boolean; error: string; printerName: string; timestamp: string };
      console.error('Backend initialization failed:', data);
      logMessage(`Backend initialization failed for ${data.printerName}: ${data.error}`);
    });
    
    window.api.receive('backend-disposed', (...args: unknown[]) => {
      const data = args[0] as { timestamp: string };
      console.log('Backend disposed:', data);
      logMessage('Backend disconnected');
      
      // Reset legacy printer flag on disconnect
      isLegacyPrinter = false;
      console.log('[LegacyUI] Reset legacy printer flag on disconnect');
      
      resetUI();
    });
    
    // Handle log messages from main process
    window.api.receive('log-message', (...args: unknown[]) => {
      const message = args[0] as string;
      logMessage(message);
    });
    
    window.api.receive('printer-connected', (...args: unknown[]) => {
      const data = args[0] as { name: string; ipAddress: string; serialNumber: string; clientType: string };
      console.log('Printer connected event:', data);
      stateTracker.onConnected();
    });
  }
  
  console.log('State tracking and event listeners initialized');
}

// ============================================================================
// MAIN INITIALIZATION SEQUENCE
// ============================================================================

/**
 * Main DOM Content Loaded handler - standard initialization
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Renderer process started - DOM loaded');

  initializeLucideIcons(
    document,
    getLucideIcons(
      'menu',
      'printer',
      'settings',
      'bar-chart-3',
      'grid-3x3',
      'pin',
      'minus',
      'square',
      'x',
      'check-circle',
      'x-circle'
    )
  );

  // Check if window.api is available
  if (!window.api) {
    console.error('API is not available. Preload script might not be loaded correctly.');
    logMessage('ERROR: API not available - some features may not work');
    return;
  }

  // Apply platform-specific styling IMMEDIATELY (no IPC needed)
  if (window.PLATFORM) {
    document.body.classList.add(`platform-${window.PLATFORM}`);
    console.log(`Platform-specific styling applied: platform-${window.PLATFORM}`);
    logMessage(`Platform detected: ${window.PLATFORM}`);
  }

  console.log('IPC listeners configured for component system integration');

  // Setup essential UI elements
  setupWindowControls();
  setupBasicButtons();
  setupLoadingEventListeners();
  initializeUI();
  initializeMainMenu();
  menuShortcutManager.initialize();

  // Initialize shortcut button system
  initializeShortcutButtons();

  // GridStack + Component system initialization
  try {
    await initializeGridStack();
    componentsInitialized = true;
    console.log('GridStack and component system ready');
    logMessage('GridStack layout system initialized: ' + componentManager.getComponentCount() + ' components');
  } catch (error) {
    console.error('GridStack initialization failed:', error);
    logMessage(`ERROR: GridStack initialization failed: ${error}`);
  }

  // Initialize enhanced polling update listeners AFTER components are ready
  // This prevents "Components not initialized yet" warnings during startup
  initializePollingListeners();

  // Initialize printer tabs for multi-printer support
  try {
    await initializePrinterTabs();
    console.log('Printer tabs ready');
  } catch (error) {
    console.error('Printer tabs initialization failed:', error);
    logMessage(`ERROR: Printer tabs failed to initialize: ${error}`);
  }

  // Initialize state tracking and event listeners
  initializeStateAndEventListeners();

  // Signal to main process that renderer is ready
  try {
    await window.api.invoke('renderer-ready');
    console.log('Renderer ready signal sent successfully');
    logMessage('Renderer ready signal sent successfully');
  } catch (error) {
    console.error('Failed to send renderer-ready signal:', error);
    logMessage(`ERROR: Failed to signal main process: ${error}`);
  }

  console.log('Enhanced renderer initialization complete with component system');
});

// ============================================================================
// CLEANUP AND RESOURCE MANAGEMENT
// ============================================================================

/**
 * Enhanced cleanup handler with component system teardown
 * Ensures proper cleanup of both legacy resources and components
 */
window.addEventListener('beforeunload', () => {
  console.log('Cleaning up resources in enhanced renderer with GridStack and component system');
  menuShortcutManager.dispose();

  // Clean up GridStack system
  try {
    console.log('Destroying GridStack system...');
    editModeController.dispose();
    gridStackManager.destroy();
    layoutPersistence.dispose();
    console.log('GridStack system cleanup complete');
  } catch (error) {
    console.error('Error during GridStack cleanup:', error);
  }

  // Clean up component system
  if (componentsInitialized) {
    try {
      console.log('Destroying component system...');
      componentManager.destroyAll();
      logPanelComponent = null;
      componentsInitialized = false;
      console.log('Component system cleanup complete');
    } catch (error) {
      console.error('Error during component cleanup:', error);
    }
  }

  // Clean up state tracker (preserve existing functionality)
  try {
    const stateTracker = getGlobalStateTracker();
    stateTracker.dispose();
    console.log('State tracker cleanup complete');
  } catch (error) {
    console.error('Error during state tracker cleanup:', error);
  }

  // Clean up IPC listeners (preserve existing functionality)
  if (window.api) {
    try {
      window.api.removeAllListeners();
      console.log('IPC listeners cleanup complete');
    } catch (error) {
      console.error('Error during IPC cleanup:', error);
    }
  }

  console.log('Enhanced renderer cleanup complete - all resources disposed');
});

