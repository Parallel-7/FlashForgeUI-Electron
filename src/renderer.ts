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

import { initializeLucideIcons, getLucideIcons } from './utils/icons.js';
import { logVerbose } from './utils/logging.js';

// Component system imports
import {
  componentManager,
  PrinterTabsComponent,
  type ComponentUpdateData
} from './ui/components/index.js';
import { logMessage, setLogPanelComponent } from './renderer/logging.js';
import { LegacyUiController } from './ui/legacy/LegacyUiController.js';

// GridStack system imports
import { gridStackManager } from './ui/gridstack/GridStackManager.js';
import { layoutPersistence } from './ui/gridstack/LayoutPersistence.js';
import { editModeController } from './ui/gridstack/EditModeController.js';

// Shortcut system imports
import { DEFAULT_SHORTCUT_CONFIG } from './ui/shortcuts/types.js';
import {
  loadLayoutForSerial,
  saveLayoutForSerial,
  loadShortcutsForSerial,
  saveShortcutsForSerial
} from './renderer/perPrinterStorage.js';

// Existing service imports
import { getGlobalStateTracker, STATE_EVENTS } from './services/printer-state.js';
import { resetUI, handleUIError } from './services/ui-updater.js';
import type { PollingData } from './types/polling.js';
import type { ThemeColors, AppConfig } from './types/config.js';
import { DEFAULT_THEME } from './types/config.js';
import { RendererGridController } from './renderer/gridController.js';
import { ShortcutButtonController } from './renderer/shortcutButtons.js';


// ============================================================================
// COMPONENT SYSTEM STATE
// ============================================================================

/** Global reference to PrinterTabsComponent for multi-printer support */
let printerTabsComponent: PrinterTabsComponent | null = null;

/** Tracks if configuration has completed loading */
let configLoaded = false;

/** Track last polling data for new components */
let lastPollingData: PollingData | null = null;

const gridController = new RendererGridController({
  getActiveSerial: () => activeContextSerial,
  getLastPollingData: () => lastPollingData,
  updateShortcutButtons: (config) => shortcutButtonController.updateButtons(config)
});
const shortcutButtonController = new ShortcutButtonController({
  getActiveSerial: () => activeContextSerial,
  gridController
});

const legacyUiController = new LegacyUiController(logMessage);
const RENDERER_LOG_NAMESPACE = 'Renderer';
const logDebug = (message: string, ...args: unknown[]): void => {
  logVerbose(RENDERER_LOG_NAMESPACE, message, ...args);
};

// ============================================================================
// PER-PRINTER LAYOUT & SHORTCUTS STATE
// ============================================================================

/** Map of context IDs to printer serial numbers (for stable storage keys) */
const printerSerialMap = new Map<string, string>();

/** Current active context ID */
let activeContextId: string | null = null;

/** Current active printer serial number (stable identifier for layouts/shortcuts) */
let activeContextSerial: string | null = null;

const handleConfigLoadedEvent = (): void => {
  if (configLoaded) {
    return;
  }
  configLoaded = true;
  logDebug('[Config] Renderer marked configuration as loaded');
};

if (window.api?.receive) {
  window.api.receive('config-loaded', () => {
    logDebug('[Config] Renderer received config-loaded IPC event');
    handleConfigLoadedEvent();
  });
} else {
  console.warn('[Config] Unable to register config-loaded listener (api unavailable)');
}

function showConnectPlaceholder(): void {
  const grid = document.querySelector('.grid-stack');
  const placeholder = document.getElementById('grid-placeholder');
  if (grid) {
    grid.classList.add('hidden');
  }
  if (placeholder) {
    placeholder.classList.remove('hidden');
  }
  editModeController.setAvailability(false);
}

function initializePlaceholderUI(): void {
  const button = document.getElementById('placeholder-connect-btn');
  if (button && !button.hasAttribute('data-initialized')) {
    button.setAttribute('data-initialized', 'true');
    button.addEventListener('click', () => {
      window.api?.send('open-printer-selection');
    });
  }
  showConnectPlaceholder();
}

function handleAllContextsRemoved(): void {
  logDebug('[PerPrinter] No active printer contexts; showing placeholder');

  activeContextId = null;
  activeContextSerial = null;
  editModeController.setActiveSerial(null);
  legacyUiController.setIfsMenuItemVisible(false);

  if (gridController.areComponentsInitialized()) {
    gridController.clearAllComponents();
  }

  shortcutButtonController.updateButtons(DEFAULT_SHORTCUT_CONFIG);
  showConnectPlaceholder();
}

/**
 * Initialize the PrinterTabsComponent for multi-printer support
 * Sets up the tabs UI and connects it to context events from main process
 */
async function initializePrinterTabs(): Promise<void> {
  logDebug('Initializing printer tabs component...');

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
      logDebug(`Tab clicked: ${contextId}`);
      void window.api.printerContexts.switch(contextId);
    });

    printerTabsComponent.on('tab-closed', (...args: unknown[]) => {
      const contextId = args[0] as string;
      logDebug(`Tab close requested: ${contextId}`);
      void window.api.printerContexts.remove(contextId);
    });

    printerTabsComponent.on('add-printer-clicked', () => {
      logDebug('Add printer button clicked');
      window.api.send('open-printer-selection');
    });

    // ========================================================================
    // PER-PRINTER LAYOUT & SHORTCUT HELPERS
    // ========================================================================

    // ========================================================================
    // CONTEXT EVENT LISTENERS
    // ========================================================================

    // Listen for context events from main process
    window.api.receive('printer-context-created', (...args: unknown[]) => {
      const event = args[0] as import('./types/PrinterContext.js').ContextCreatedEvent;
      logDebug('Renderer received context-created event:', event);
      logDebug('Event contextId:', event?.contextId);
      logDebug('Event contextInfo:', event?.contextInfo);

      // Track serial number for this context
      if (event?.contextInfo?.serialNumber) {
        printerSerialMap.set(event.contextId, event.contextInfo.serialNumber);
        logDebug(`[PerPrinter] Mapped context ${event.contextId} to serial ${event.contextInfo.serialNumber}`);
      }

      if (printerTabsComponent && event?.contextInfo) {
        printerTabsComponent.addTab(event.contextInfo);
      } else {
        console.error('Cannot add tab: event or contextInfo is missing', { event, hasComponent: !!printerTabsComponent });
      }
    });

    window.api.receive('printer-context-switched', async (...args: unknown[]) => {
      const event = args[0] as import('./types/PrinterContext.js').ContextSwitchEvent;
      logDebug('Renderer received context-switched event:', event);

      try {
        if (activeContextId && activeContextSerial) {
          logDebug(`[PerPrinter] Saving layout for context ${activeContextId} (serial: ${activeContextSerial})`);
          const currentLayout = loadLayoutForSerial(activeContextSerial);
          const serializedWidgets = gridController.serializeLayout();
          saveLayoutForSerial({ ...currentLayout, widgets: serializedWidgets }, activeContextSerial);

          const currentShortcutConfig = loadShortcutsForSerial(activeContextSerial);
          saveShortcutsForSerial(currentShortcutConfig, activeContextSerial);
        }

        activeContextId = event.contextId;
        activeContextSerial = event.contextInfo?.serialNumber || printerSerialMap.get(event.contextId) || null;
        editModeController.setActiveSerial(activeContextSerial);

        if (printerTabsComponent) {
          printerTabsComponent.setActiveTab(event.contextId);
        }

        legacyUiController.setIfsMenuItemVisible(false);

        const serialLabel = activeContextSerial ?? 'default';
        logDebug(`[PerPrinter] Switching UI to context ${event.contextId} (serial: ${serialLabel})`);

        if (!gridController.areComponentsInitialized()) {
          await gridController.initialize(activeContextSerial);
        } else {
          const newLayout = loadLayoutForSerial(activeContextSerial);
          const newShortcutConfig = loadShortcutsForSerial(activeContextSerial);
          await gridController.reloadGridForLayout(newLayout, serialLabel, newShortcutConfig);
        }
      } catch (error) {
        console.error('[PerPrinter] Failed to switch context:', error);
        handleUIError(error, 'context switch');
      }
    });

    window.api.receive('printer-context-removed', (...args: unknown[]) => {
      const event = args[0] as { contextId: string };
      logDebug('Renderer received context-removed event:', event);
      printerSerialMap.delete(event.contextId);
      if (printerTabsComponent) {
        printerTabsComponent.removeTab(event.contextId);
      }

      void (async () => {
        try {
          const contexts = (await window.api.printerContexts.getAll()) as unknown[];
          if (!Array.isArray(contexts) || contexts.length === 0) {
            handleAllContextsRemoved();
          }
        } catch (error) {
          console.error('[PerPrinter] Failed to evaluate remaining contexts:', error);
        }
      })();
    });

    window.api.receive('printer-context-updated', (...args: unknown[]) => {
      const event = args[0] as { contextId: string; updates: Partial<import('./types/PrinterContext.js').PrinterContextInfo> };
      logDebug('Renderer received context-updated event:', event);
      if (printerTabsComponent) {
        printerTabsComponent.updateTab(event.contextId, event.updates);
      }
    });

    logDebug('Printer tabs component initialized successfully');
    logMessage('Multi-printer tabs UI initialized');

  } catch (error) {
    console.error('Failed to initialize printer tabs component:', error);
    logMessage(`ERROR: Printer tabs initialization failed: ${error}`);
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
      // Update IFS menu item visibility for AD5X printers with material station
      const shouldShowIFS =
        Boolean(pollingData.materialStation?.connected) && Boolean(pollingData.isConnected);
      legacyUiController.setIfsMenuItemVisible(shouldShowIFS);
      
      // COMPONENT SYSTEM INTEGRATION: Replace updateAllPanels with componentManager.updateAll
      if (gridController.areComponentsInitialized() && componentManager.isInitialized()) {
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
      }
      
      // Update state tracker based on printer status (preserve existing logic)
      const stateTracker = getGlobalStateTracker();
      if (pollingData.printerStatus && pollingData.isConnected) {
        stateTracker.setState(pollingData.printerStatus.state, 'polling update');
      } else if (!pollingData.isConnected && !pollingData.isInitializing) {
        stateTracker.onDisconnected();
      }
      
    } catch (error) {
      handleUIError(error, 'polling update');
    }
  });

  logDebug('Enhanced polling listeners initialized - component system integration active');
}

/**
 * Initialize state tracking and backend event listeners
 */
function initializeStateAndEventListeners(): void {
  const stateTracker = getGlobalStateTracker();
  
  stateTracker.on(STATE_EVENTS.CONNECTED, () => {
    logDebug('Printer connected');

  });
  
  stateTracker.on(STATE_EVENTS.DISCONNECTED, () => {
    logDebug('Printer disconnected');
    logMessage('Printer disconnected');
    resetUI();
    legacyUiController.setIfsMenuItemVisible(false);
    logDebug('[LegacyUI] Reset legacy printer flag on state disconnect');
  });
  
  // Listen for backend events
  if (window.api) {
    window.api.receive('backend-initialized', (...args: unknown[]) => {
      const data = args[0] as { success: boolean; printerName: string; modelType: string; backendType?: string; timestamp: string };
      logDebug('Backend initialized:', data);
      logMessage(`Backend ready for ${data.printerName} (${data.modelType})`);
      
      const backendType = data.backendType || data.modelType || '';
      if (isLegacyBackendType(backendType)) {
        logDebug('[LegacyUI] Legacy printer detected:', backendType);
        logMessage('Legacy printer detected - some features may be unavailable');
      }
    });
    
    window.api.receive('backend-initialization-failed', (...args: unknown[]) => {
      const data = args[0] as { success: boolean; error: string; printerName: string; timestamp: string };
      console.error('Backend initialization failed:', data);
      logMessage(`Backend initialization failed for ${data.printerName}: ${data.error}`);
    });
    
    window.api.receive('backend-disposed', (...args: unknown[]) => {
      const data = args[0] as { timestamp: string };
      logDebug('Backend disposed:', data);
      logMessage('Backend disconnected');
      
      resetUI();
    });
    
    // Handle log messages from main process
    window.api.receive('log-message', (...args: unknown[]) => {
      const message = args[0] as string;
      logMessage(message);
    });
    
    window.api.receive('printer-connected', (...args: unknown[]) => {
      const data = args[0] as { name: string; ipAddress: string; serialNumber: string; clientType: string };
      logDebug('Printer connected event:', data);
      stateTracker.onConnected();
    });

    // Listen for config updates to reapply theme
    window.api.receive('config-updated', async (...args: unknown[]) => {
      const updatedConfig = args[0] as { DesktopTheme?: ThemeColors };
      if (updatedConfig.DesktopTheme) {
        logDebug('Config updated, reapplying desktop theme');
        applyDesktopTheme(updatedConfig.DesktopTheme);
      }
    });
  }

  logDebug('State tracking and event listeners initialized');
}

// ============================================================================
// THEME APPLICATION
// ============================================================================

/**
 * Applies theme colors to the document root CSS variables
 * @param theme The theme colors to apply
 */
function applyDesktopTheme(theme: ThemeColors): void {
  const root = document.documentElement;

  // Apply theme color variables
  root.style.setProperty('--theme-primary', theme.primary);
  root.style.setProperty('--theme-secondary', theme.secondary);
  root.style.setProperty('--theme-background', theme.background);
  root.style.setProperty('--theme-surface', theme.surface);
  root.style.setProperty('--theme-text', theme.text);

  // Compute hover states (slightly lighter for dark theme)
  const primaryHover = lightenColor(theme.primary, 15);
  const secondaryHover = lightenColor(theme.secondary, 15);
  root.style.setProperty('--theme-primary-hover', primaryHover);
  root.style.setProperty('--theme-secondary-hover', secondaryHover);

  logDebug('Desktop theme applied:', theme);
}

/**
 * Lightens a hex color by a percentage
 * @param hex Hex color string (e.g., '#4285f4')
 * @param percent Percentage to lighten (0-100)
 * @returns Lightened hex color
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);

  // Guard against invalid hex values
  if (isNaN(num)) {
    console.warn(`Invalid hex color for lightening: ${hex}, returning original`);
    return hex;
  }

  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * (percent / 100)));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * (percent / 100)));
  const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * (percent / 100)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Loads and applies the desktop theme from config
 */
async function loadAndApplyDesktopTheme(): Promise<void> {
  try {
    if (!window.api?.requestConfig) {
      console.warn('Cannot load theme: API not available');
      return;
    }

    const config = await window.api.requestConfig() as AppConfig;
    if (config.DesktopTheme) {
      applyDesktopTheme(config.DesktopTheme);
    }
  } catch (error) {
    console.error('Failed to load desktop theme:', error);
    // Apply default theme as fallback to ensure UI is styled
    applyDesktopTheme(DEFAULT_THEME);
  }
}

// ============================================================================
// MAIN INITIALIZATION SEQUENCE
// ============================================================================

/**
 * Main DOM Content Loaded handler - standard initialization
 */
document.addEventListener('DOMContentLoaded', async () => {
  logDebug('Renderer process started - DOM loaded');

  initializeLucideIcons(
    document,
    getLucideIcons(
      'menu',
      'printer',
      'settings',
      'bar-chart-3',
      'grid-3x3',
      'pin',
      'info',
      'minus',
      'square',
      'x',
      'check-circle',
      'x-circle',
      'pencil',
      'rotate-ccw',
      'plug'
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
    logDebug(`Platform-specific styling applied: platform-${window.PLATFORM}`);
    logMessage(`Platform detected: ${window.PLATFORM}`);
  }

  // Load and apply desktop theme
  await loadAndApplyDesktopTheme();

  logDebug('IPC listeners configured for component system integration');

  // Setup essential UI elements
  legacyUiController.initialize();

  // Initialize shortcut button system
  shortcutButtonController.initialize();
  initializePlaceholderUI();

  // Initialize enhanced polling update listeners AFTER components are ready
  // This prevents "Components not initialized yet" warnings during startup
  initializePollingListeners();

  // Initialize printer tabs for multi-printer support
  try {
    await initializePrinterTabs();
    logDebug('Printer tabs ready');
  } catch (error) {
    console.error('Printer tabs initialization failed:', error);
    logMessage(`ERROR: Printer tabs failed to initialize: ${error}`);
  }

  // Initialize state tracking and event listeners
  initializeStateAndEventListeners();

  // Signal to main process that renderer is ready
  try {
    await window.api.invoke('renderer-ready');
    logDebug('Renderer ready signal sent successfully');
    logMessage('Renderer ready signal sent successfully');
  } catch (error) {
    console.error('Failed to send renderer-ready signal:', error);
    logMessage(`ERROR: Failed to signal main process: ${error}`);
  }

  logDebug('Enhanced renderer initialization complete with component system');
});

// ============================================================================
// CLEANUP AND RESOURCE MANAGEMENT
// ============================================================================

/**
 * Enhanced cleanup handler with component system teardown
 * Ensures proper cleanup of both legacy resources and components
 */
window.addEventListener('beforeunload', () => {
  logDebug('Cleaning up resources in enhanced renderer with GridStack and component system');
  legacyUiController.dispose();

  // Clean up GridStack system
  try {
    logDebug('Destroying GridStack system...');
    editModeController.dispose();
    gridStackManager.destroy();
    layoutPersistence.dispose();
    logDebug('GridStack system cleanup complete');
  } catch (error) {
    console.error('Error during GridStack cleanup:', error);
  }

  // Clean up component system
  if (gridController.areComponentsInitialized()) {
    try {
      logDebug('Destroying component system...');
      componentManager.destroyAll();
      setLogPanelComponent(null);
      logDebug('Component system cleanup complete');
    } catch (error) {
      console.error('Error during component cleanup:', error);
    }
  }

  // Clean up state tracker (preserve existing functionality)
  try {
    const stateTracker = getGlobalStateTracker();
    stateTracker.dispose();
    logDebug('State tracker cleanup complete');
  } catch (error) {
    console.error('Error during state tracker cleanup:', error);
  }

  // Clean up IPC listeners (preserve existing functionality)
  if (window.api) {
    try {
      window.api.removeAllListeners();
      logDebug('IPC listeners cleanup complete');
    } catch (error) {
      console.error('Error during IPC cleanup:', error);
    }
  }

  logDebug('Enhanced renderer cleanup complete - all resources disposed');
});
