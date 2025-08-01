// Single Color Confirmation Dialog Renderer
// Shows active IFS slot material before starting single-color print

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

// Global window type extension
declare global {
  interface Window {
    singleColorConfirmAPI: SingleColorConfirmAPI;
  }
}

interface SingleColorConfirmAPI {
  readonly onInit: (callback: (data: SingleColorConfirmInitData) => void) => void;
  readonly closeDialog: () => void;
  readonly confirmPrint: (leveling: boolean) => void;
  readonly getMaterialStationStatus: () => Promise<MaterialStationStatus | null>;
}

interface SingleColorConfirmInitData {
  readonly fileName: string;
  readonly leveling: boolean;
}

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
  setupIpcListeners();
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
function setupIpcListeners(): void {
  const api = window.singleColorConfirmAPI;
  if (!api) {
    console.error('Single color confirm: API not available');
    return;
  }

  api.onInit(async (data: SingleColorConfirmInitData) => {
    console.log('Single color confirm: Received init data', data);
    initData = data;
    await loadActiveSlotInfo();
    displayFileInfo();
    displayMaterialInfo();
  });
}

/**
 * Load active slot information
 */
async function loadActiveSlotInfo(): Promise<void> {
  const api = window.singleColorConfirmAPI;
  if (!api) return;

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
  const api = window.singleColorConfirmAPI;
  if (api) {
    api.closeDialog();
  }
}

/**
 * Handle start print
 */
function handleStart(): void {
  const api = window.singleColorConfirmAPI;
  if (!api || !levelingCheckbox) return;

  if (!activeSlotInfo || activeSlotInfo.isEmpty) {
    showError('Cannot start print without active material');
    return;
  }

  api.confirmPrint(levelingCheckbox.checked);
}

/**
 * Cleanup
 */
function cleanup(): void {
  initData = null;
  activeSlotInfo = null;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeDialog);

// Cleanup when window is unloaded
window.addEventListener('unload', cleanup);

// Export for module
export {};
