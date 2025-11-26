/**
 * @fileoverview Single Color Confirmation Dialog renderer process for material verification
 * before starting single-color print jobs on material-station-equipped printers. Displays the
 * active material slot's type and color, validates material availability, and collects user
 * confirmation with optional bed leveling toggle.
 *
 * Key Features:
 * - Material station status integration for active slot detection
 * - Visual material type and color display from active IFS slot
 * - Empty slot detection with error messaging and print blocking
 * - Bed leveling toggle with default preference handling
 * - Real-time material station communication errors
 * - Graceful handling of disconnected material stations
 *
 * Workflow:
 * 1. Receives initialization data (file name, default leveling state)
 * 2. Queries material station for active slot information
 * 3. Displays active slot material type and color swatch
 * 4. Validates material is loaded (blocks print if empty)
 * 5. Collects confirmation with optional leveling adjustment
 *
 * Error Handling:
 * - Material station not connected
 * - No active slot selected
 * - Active slot is empty
 * - Material station query failures
 *
 * UI Components:
 * - File name display
 * - Slot label and material type indicator
 * - Color swatch visualization
 * - Leveling checkbox
 * - Start/Cancel buttons with conditional enablement
 *
 * Context:
 * Specifically designed for AD5X and similar printers with Intelligent Filament System (IFS)
 * material stations to prevent print failures from incorrect material selection.
 */

// Single Color Confirmation Dialog Renderer
// Shows active IFS slot material before starting single-color print

import type { ThemeColors } from '../../types/config.js';
import { applyDialogTheme } from '../shared/theme-utils.js';

// Type definitions (inlined to avoid require errors)
interface MaterialStationStatus {
  readonly connected: boolean;
  readonly activeSlot: number | null;
  readonly slots: readonly MaterialSlotInfo[];
}

interface MaterialSlotInfo {
  readonly slotId: number;
  readonly isEmpty: boolean;
  readonly materialType: string | null;
  readonly materialColor: string | null;
}

// Utility functions (inlined to avoid require errors)
function getSlotDisplayName(slotId: number): string {
  return `Slot ${slotId + 1}`;
}

interface SingleColorConfirmDialogAPI {
  readonly onInit: (callback: (data: SingleColorConfirmInitData) => void) => void;
  readonly closeDialog: () => void;
  readonly confirmPrint: (leveling: boolean) => void;
  readonly getMaterialStationStatus: () => Promise<MaterialStationStatus | null>;
  receive?: (channel: string, func: (...args: unknown[]) => void) => void;
}

interface SingleColorConfirmInitData {
  readonly fileName: string;
  readonly leveling: boolean;
}

let cachedSingleColorAPI: SingleColorConfirmDialogAPI | null = null;

const getSingleColorConfirmAPI = (): SingleColorConfirmDialogAPI => {
  if (cachedSingleColorAPI) {
    return cachedSingleColorAPI;
  }
  const api = window.api?.dialog?.singleColor as SingleColorConfirmDialogAPI | undefined;
  if (!api) {
    throw new Error('[SingleColorConfirmDialog] dialog API bridge is not available');
  }
  cachedSingleColorAPI = api;
  return api;
};

// Global state
let initData: SingleColorConfirmInitData | null = null;
let activeSlotInfo: MaterialSlotInfo | null = null;

// DOM elements
let fileNameElement: HTMLElement | null = null;
let slotLabelElement: HTMLElement | null = null;
let materialTypeElement: HTMLElement | null = null;
let spoolColorElement: HTMLElement | null = null;
let levelingCheckbox: HTMLInputElement | null = null;
let errorMessageElement: HTMLElement | null = null;
let startButton: HTMLButtonElement | null = null;

/**
 * Initialize the dialog
 */
function initializeDialog(): void {
  window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['x']);
  // Get DOM elements
  fileNameElement = document.getElementById('file-name');
  slotLabelElement = document.getElementById('slot-label');
  materialTypeElement = document.getElementById('material-type');
  spoolColorElement = document.getElementById('spool-color');
  levelingCheckbox = document.getElementById('cb-leveling') as HTMLInputElement;
  errorMessageElement = document.getElementById('error-message');
  startButton = document.getElementById('btn-start') as HTMLButtonElement;

  if (!fileNameElement || !slotLabelElement || !materialTypeElement || 
      !spoolColorElement || !levelingCheckbox || !errorMessageElement || !startButton) {
    console.error('Single color confirm: Failed to find required DOM elements');
    return;
  }

  setupEventListeners();
  const api = getSingleColorConfirmAPI();
  setupIpcListeners(api);
  registerThemeListener(api);
}

/**
 * Set up event listeners
 */
function setupEventListeners(): void {
  // Close button
  const closeButton = document.getElementById('btn-close');
  closeButton?.addEventListener('click', handleClose);

  // Cancel button
  const cancelButton = document.getElementById('btn-cancel');
  cancelButton?.addEventListener('click', handleClose);

  // Start button
  startButton?.addEventListener('click', handleStart);
}

/**
 * Set up IPC listeners
 */
function setupIpcListeners(api: SingleColorConfirmDialogAPI): void {
  api.onInit(async (data: SingleColorConfirmInitData) => {
    console.log('Single color confirm: Received init data', data);
    initData = data;
    await loadActiveSlotInfo(api);
    displayFileInfo();
    displayMaterialInfo();
  });
}

/**
 * Load active slot information
 */
async function loadActiveSlotInfo(api: SingleColorConfirmDialogAPI): Promise<void> {
  try {
    const materialStation = await api.getMaterialStationStatus();
    
    if (!materialStation || !materialStation.connected) {
      showError('Material station is not connected');
      return;
    }

    // Get the active slot
    if (materialStation.activeSlot !== null && materialStation.activeSlot >= 0 && materialStation.activeSlot < materialStation.slots.length) {
      activeSlotInfo = materialStation.slots[materialStation.activeSlot];
      
      if (activeSlotInfo && activeSlotInfo.isEmpty) {
        showError(`Active slot ${materialStation.activeSlot + 1} is empty. Please load material before printing.`);
        if (startButton) startButton.disabled = true;
      }
    } else {
      showError('No active material slot selected');
      if (startButton) startButton.disabled = true;
    }
  } catch (error) {
    showError('Failed to load material station status');
    console.error('Material station error:', error);
    if (startButton) startButton.disabled = true;
  }
}

/**
 * Display file information
 */
function displayFileInfo(): void {
  if (!fileNameElement || !levelingCheckbox || !initData) return;

  fileNameElement.textContent = initData.fileName;
  levelingCheckbox.checked = initData.leveling;
}

/**
 * Display material information
 */
function displayMaterialInfo(): void {
  if (!slotLabelElement || !materialTypeElement || !spoolColorElement) return;

  if (activeSlotInfo) {
    // Update slot label
    slotLabelElement.textContent = getSlotDisplayName(activeSlotInfo.slotId);
    
    // Update material type
    if (activeSlotInfo.materialType) {
      materialTypeElement.textContent = activeSlotInfo.materialType;
      materialTypeElement.parentElement?.parentElement?.classList.remove('no-material');
    } else {
      materialTypeElement.textContent = 'No material';
      materialTypeElement.parentElement?.parentElement?.classList.add('no-material');
    }
    
    // Update spool color
    if (activeSlotInfo.materialColor) {
      spoolColorElement.style.backgroundColor = activeSlotInfo.materialColor;
    } else {
      spoolColorElement.style.backgroundColor = '#333333';
    }
  } else {
    // No active slot
    slotLabelElement.textContent = 'No active slot';
    materialTypeElement.textContent = 'No material';
    spoolColorElement.style.backgroundColor = '#333333';
    materialTypeElement.parentElement?.parentElement?.classList.add('no-material');
  }
}

/**
 * Show error message
 */
function showError(message: string): void {
  if (!errorMessageElement) return;
  errorMessageElement.textContent = message;
  errorMessageElement.style.display = 'block';
}


/**
 * Handle close
 */
function handleClose(): void {
  getSingleColorConfirmAPI().closeDialog();
}

/**
 * Handle start print
 */
function handleStart(): void {
  if (!levelingCheckbox) return;

  if (!activeSlotInfo || activeSlotInfo.isEmpty) {
    showError('Cannot start print without active material');
    return;
  }

  getSingleColorConfirmAPI().confirmPrint(levelingCheckbox.checked);
}

/**
 * Cleanup
 */
function cleanup(): void {
  initData = null;
  activeSlotInfo = null;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeDialog();
});

function registerThemeListener(api: SingleColorConfirmDialogAPI): void {
    api.receive?.('theme-changed', (data: unknown) => {
        applyDialogTheme(data as ThemeColors);
    });
}

// Cleanup when window is unloaded
window.addEventListener('unload', cleanup);

// Export for module
export {};

