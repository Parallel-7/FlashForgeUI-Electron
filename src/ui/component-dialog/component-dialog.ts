/**
 * @fileoverview Component Dialog Renderer
 *
 * Handles rendering and lifecycle management of components in standalone dialog windows.
 * Creates a local ComponentManager instance to manage the component and receives
 * real-time polling updates from the main process.
 *
 * Key features:
 * - Component instantiation and initialization
 * - Real-time polling data updates
 * - Proper cleanup on window close
 * - Dialog header customization based on component type
 *
 * @author FlashForgeUI Team
 * @module ui/component-dialog/component-dialog
 */

// Component system imports
import './component-dialog.css';
import { ComponentManager } from '../components/ComponentManager';
import { getComponentDefinition } from '../gridstack/ComponentRegistry';
import {
  BaseComponent,
  CameraPreviewComponent,
  TemperatureControlsComponent,
  JobStatsComponent,
  PrinterStatusComponent,
  ModelPreviewComponent,
  AdditionalInfoComponent,
  LogPanelComponent,
  ControlsGridComponent,
  FiltrationControlsComponent,
} from '../components';
import type { ComponentUpdateData } from '../components/base/types';
import type { PollingData } from '../../types/polling';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/** Local component manager for this dialog */
const dialogComponentManager = new ComponentManager();

/** Current component info */
let currentComponentId: string | null = null;

/** Active component instance */
let activeComponent: BaseComponent | null = null;

/** Cleanup handlers executed on window unload */
const cleanupCallbacks: Array<() => void> = [];

// ============================================================================
// COMPONENT INITIALIZATION
// ============================================================================

/**
 * Initialize component dialog with specified component
 * @param componentId - ID of component to display
 */
async function initializeDialog(componentId: string): Promise<void> {
  console.log(`[ComponentDialog] Initializing with component: ${componentId}`);

  currentComponentId = componentId;

  // Get component definition
  const componentDef = getComponentDefinition(componentId);
  if (!componentDef) {
    console.error(`[ComponentDialog] Component definition not found: ${componentId}`);
    showError('Component not found');
    return;
  }

  // Update dialog title and icon
  const titleElement = document.getElementById('dialog-title');
  const iconElement = document.getElementById('dialog-icon');

  if (titleElement) {
    titleElement.textContent = componentDef.name;
  }
  if (iconElement) {
    iconElement.textContent = componentDef.icon || '📦';
  }

  // Get component container
  const container = document.getElementById('component-container');
  if (!container) {
    console.error('[ComponentDialog] Component container not found');
    showError('Container element missing');
    return;
  }

  // Create component instance
  const component = createComponentInstance(componentId, container as HTMLElement);
  if (!component) {
    console.error(`[ComponentDialog] Failed to create component instance: ${componentId}`);
    showError('Failed to create component');
    return;
  }

  // Register and initialize
  try {
    dialogComponentManager.registerComponent(component);
    activeComponent = component;
    await dialogComponentManager.initializeAll();
    await initializeComponentIntegrations(componentId, component);
    console.log(`[ComponentDialog] Component initialized: ${componentId}`);
  } catch (error) {
    console.error('[ComponentDialog] Component initialization failed:', error);
    showError(`Initialization failed: ${error}`);
  }
}

/**
 * Create component instance based on component ID
 * @param componentId - Component identifier
 * @param container - HTML container element
 * @returns Component instance or null
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
    case 'log-panel':
      return new LogPanelComponent(container);
    case 'controls-grid':
      return new ControlsGridComponent(container);
    case 'filtration-controls':
      return new FiltrationControlsComponent(container);
    default:
      console.error(`[ComponentDialog] Unknown component ID: ${componentId}`);
      return null;
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Setup event listeners for dialog interaction and polling updates
 */
function setupEventListeners(): void {
  console.log('[ComponentDialog] Setting up event listeners');

  // Close button
  const closeBtn = document.getElementById('btn-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('[ComponentDialog] Close button clicked');
      window.close();
    });
  }

  // Listen for polling updates from main process
  if (window.componentDialogAPI) {
    window.componentDialogAPI.receive('polling-update', (data: unknown) => {
      const pollingData = data as PollingData;

      if (dialogComponentManager.isInitialized()) {
        const updateData: ComponentUpdateData = {
          pollingData: pollingData,
          timestamp: new Date().toISOString(),
          printerState: (pollingData as any)?.printerStatus?.state,
          connectionState: (pollingData as any)?.isConnected,
        };

        dialogComponentManager.updateAll(updateData);
      }
    });
  } else {
    console.warn('[ComponentDialog] window.componentDialogAPI not available');
  }

  // Listen for initialization from main process
  if (window.componentDialogAPI) {
    window.componentDialogAPI.receive('component-dialog:init', async (data: unknown) => {
      const componentId = data as string;
      if (typeof componentId === 'string') {
        await initializeDialog(componentId);
      } else {
        console.error('[ComponentDialog] Invalid component ID received:', data);
      }
    });
  }
}

/**
 * Show error message in dialog
 * @param message - Error message to display
 */
function showError(message: string): void {
  const container = document.getElementById('component-container');
  if (container) {
    container.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #f44336;
        font-size: 14px;
        text-align: center;
        padding: 20px;
      ">
        <div>
          <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
          <div>${message}</div>
        </div>
      </div>
    `;
  }
}

// ============================================================================
// LIFECYCLE MANAGEMENT
// ============================================================================

/**
 * Initialize on DOM ready
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('[ComponentDialog] DOM ready, setting up event listeners');
  setupEventListeners();
});

/**
 * Cleanup on window unload
 */
window.addEventListener('beforeunload', () => {
  console.log('[ComponentDialog] Cleaning up component manager');
  cleanupCallbacks.forEach((fn) => {
    try {
      fn();
    } catch (error) {
      console.error('[ComponentDialog] Cleanup handler failed:', error);
    }
  });
  cleanupCallbacks.length = 0;
  dialogComponentManager.destroyAll();
  activeComponent = null;
});

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Perform component-specific integration once the instance is ready
 * @param componentId - Component identifier
 * @param component - Initialized component instance
 */
async function initializeComponentIntegrations(
  componentId: string,
  component: BaseComponent
): Promise<void> {
  if (componentId === 'log-panel' && component instanceof LogPanelComponent) {
    await setupLogPanelIntegration(component);
  }
}

/**
 * Setup log service integration for the log panel component
 * @param logPanel - Initialized log panel component
 */
async function setupLogPanelIntegration(logPanel: LogPanelComponent): Promise<void> {
  console.log('[ComponentDialog] Setting up log panel integration');

  try {
    const result = await window.api.invoke('log-dialog-request-logs');
    if (Array.isArray(result)) {
      const entries = result
        .filter((entry): entry is { timestamp: string; message: string } => {
          return (
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as { timestamp?: unknown }).timestamp === 'string' &&
            typeof (entry as { message?: unknown }).message === 'string'
          );
        });

      if (entries.length > 0) {
        logPanel.loadInitialEntries(entries);
      }
    }
  } catch (error) {
    console.error('[ComponentDialog] Failed to load existing log entries:', error);
  }

  const handleLogUpdate = (data: unknown) => {
    if (!logPanel.isDestroyed()) {
      const entry = parseLogEntry(data);
      if (entry) {
        logPanel.addLogEntry(entry);
      }
    }
  };

  const handleLogsCleared = () => {
    if (!logPanel.isDestroyed()) {
      logPanel.clearLogs();
    }
  };

  window.api.receive('log-dialog-new-message', handleLogUpdate);
  window.api.receive('log-dialog-cleared', handleLogsCleared);

  cleanupCallbacks.push(() => window.api.removeListener('log-dialog-new-message'));
  cleanupCallbacks.push(() => window.api.removeListener('log-dialog-cleared'));
}

/**
 * Parse unknown payload into a log entry structure
 * @param data - Payload from IPC
 * @returns Log entry or null
 */
function parseLogEntry(data: unknown): { timestamp: string; message: string } | null {
  if (typeof data === 'string') {
    const timestamp = new Date().toLocaleTimeString();
    return { timestamp, message: data };
  }

  if (
    typeof data === 'object' &&
    data !== null &&
    'timestamp' in data &&
    'message' in data &&
    typeof (data as { timestamp: unknown }).timestamp === 'string' &&
    typeof (data as { message: unknown }).message === 'string'
  ) {
    const entry = data as { timestamp: string; message: string };
    return entry;
  }

  return null;
}
