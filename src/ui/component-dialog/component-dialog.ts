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

/// <reference types="../../types/global.d.ts" />

// Component system imports
import './component-dialog.css' with { type: 'css' };
import type { ThemeColors } from '../../types/config.js';
import { applyDialogTheme } from '../shared/theme-utils.js';
import { ComponentManager } from '../components/ComponentManager.js';
import { getComponentDefinition } from '../gridstack/ComponentRegistry.js';
import { initializeLucideIconsFromGlobal } from '../shared/lucide.js';
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
  SpoolmanComponent,
} from '../components/index.js';
import { parseLogEntry } from '../shared/log-panel/index.js';
import type { ComponentUpdateData } from '../components/base/types.js';
import type { PollingData } from '../../types/polling.js';

interface ComponentDialogBridge {
  receive: (channel: 'component-dialog:init' | 'polling-update' | 'theme-changed', func: (data: unknown) => void) => (() => void) | undefined;
  send: (channel: 'component-dialog:close', ...data: unknown[]) => void;
  invoke: (channel: 'component-dialog:get-info', ...data: unknown[]) => Promise<unknown>;
}

const getComponentDialogAPI = (): ComponentDialogBridge => {
  const api = window.api?.dialog?.component as ComponentDialogBridge | undefined;
  if (!api) {
    throw new Error('[ComponentDialog] API bridge is not available');
  }
  return api;
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/** Local component manager for this dialog */
const dialogComponentManager = new ComponentManager();

/** Current component info */
let currentComponentId: string | null = null;

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
    iconElement.innerHTML = '';
    const iconName = componentDef.icon?.trim() || 'package';
    const iconNode = document.createElement('i');
    iconNode.setAttribute('data-lucide', iconName);
    iconElement.appendChild(iconNode);
    initializeLucideIconsFromGlobal([iconName], iconElement);
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
    await dialogComponentManager.initializeAll();
    await initializeComponentIntegrations(componentId, component);

    // Send initial config update to component
    if (!window.api?.config) {
      throw new Error('Config API unavailable');
    }
    const config = await window.api.config.get();
    const updateData: ComponentUpdateData = {
      config: config,
      timestamp: new Date().toISOString()
    };
    dialogComponentManager.updateAll(updateData);

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
    case 'spoolman-tracker':
      return new SpoolmanComponent(container);
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

  const closeBtn = document.getElementById('btn-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('[ComponentDialog] Close button clicked');
      window.close();
    });
  }

  try {
    const api = getComponentDialogAPI();

    const pollingDisposer = api.receive('polling-update', (payload: unknown) => {
      if (!isPollingData(payload)) {
        console.warn('[ComponentDialog] Ignoring invalid polling update payload', payload);
        return;
      }

      const pollingData = payload;

      if (dialogComponentManager.isInitialized()) {
        const updateData: ComponentUpdateData = {
          pollingData,
          timestamp: new Date().toISOString(),
          printerState: pollingData.printerStatus?.state,
          connectionState: pollingData.isConnected,
        };

        dialogComponentManager.updateAll(updateData);
        if (pollingData?.logMessages && Array.isArray(pollingData.logMessages)) {
          updateLogPanelComponent(pollingData.logMessages);
        }
      } else {
        console.log('[ComponentDialog] Components not initialized, ignoring polling data');
      }
    });
    if (pollingDisposer) {
      cleanupCallbacks.push(pollingDisposer);
    }

    const initDisposer = api.receive('component-dialog:init', async (data: unknown) => {
      const componentId = data as string;
      if (typeof componentId === 'string') {
        await initializeDialog(componentId);
      } else {
        console.error('[ComponentDialog] Invalid component ID received:', data);
      }
    });
    if (initDisposer) {
      cleanupCallbacks.push(initDisposer);
    }

    const themeDisposer = api.receive('theme-changed', (payload: unknown) => {
      applyDialogTheme(payload as ThemeColors);
    });
    if (themeDisposer) {
      cleanupCallbacks.push(themeDisposer);
    }
  } catch (error) {
    console.error('[ComponentDialog] API unavailable:', error);
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
          <div style="margin-bottom: 16px; display: flex; justify-content: center;">
            <i data-lucide="alert-triangle" aria-hidden="true" style="width: 48px; height: 48px; stroke-width: 1.75;"></i>
          </div>
          <div>${message}</div>
        </div>
      </div>
    `;
    initializeLucideIconsFromGlobal(['alert-triangle'], container);
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
  window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['x']);
  setupEventListeners();
});

/**
 * Cleanup on window unload
 */
window.addEventListener('beforeunload', () => {
  const componentLabel = currentComponentId ?? 'unknown';
  console.log(`[ComponentDialog] Cleaning up component manager (${componentLabel})`);
  cleanupCallbacks.forEach((fn) => {
    try {
      fn();
    } catch (error) {
      console.error('[ComponentDialog] Cleanup handler failed:', error);
    }
  });
  cleanupCallbacks.length = 0;
  dialogComponentManager.destroyAll();
  currentComponentId = null;
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

function updateLogPanelComponent(logMessages: unknown[]): void {
  const logPanel = dialogComponentManager.getComponent<LogPanelComponent>('log-panel');
  if (!logPanel || !(logPanel instanceof LogPanelComponent)) {
    return;
  }

  const entries = logMessages
    .map((entry) => parseLogEntry(entry))
    .filter((entry): entry is NonNullable<ReturnType<typeof parseLogEntry>> => entry !== null);

  if (entries.length === 0) {
    return;
  }

  entries.forEach((entry) => {
    logPanel.addLogEntry(entry);
  });
}

/**
 * Minimal type guard for polling data payloads
 * @param payload - Incoming data from the main process
 * @returns True when payload matches PollingData shape
 */
function isPollingData(payload: unknown): payload is PollingData {
  return typeof payload === 'object' && payload !== null && 'isConnected' in payload;
}
