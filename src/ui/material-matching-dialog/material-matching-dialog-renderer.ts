/**
 * @fileoverview Renderer process for interactive material-to-slot matching interface.
 *
 * Implements dual-panel selection UI for mapping print job material requirements to physical
 * material station slots. Validates material type compatibility, warns on color differences,
 * and prevents invalid mappings (empty slots, type mismatches, duplicate assignments). Provides
 * visual feedback through color swatches, selection states, and real-time mapping display.
 * Context-aware button text (Start Print vs Confirm) based on workflow origin.
 *
 * Key features:
 * - Dual-panel selection: print requirements and available IFS slots
 * - Material type compatibility validation with error messages
 * - Color difference warnings (allowed but highlighted)
 * - Real-time mapping visualization with removal capability
 * - Disabled states for empty and already-assigned slots
 * - Complete mapping requirement before confirmation
 * - Context-aware UI (job-start vs file-upload workflows)
 */

// Material Matching Dialog Renderer
// Handles material mapping between print requirements and IFS slots

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

interface FFGcodeToolData {
  readonly toolId: number;
  readonly materialName: string;
  readonly materialColor: string;
  readonly filamentWeight: number;
  readonly slotId: number;
}

interface AD5XMaterialMapping {
  readonly toolId: number;
  readonly slotId: number;
  readonly materialName: string;
  readonly toolMaterialColor: string;
  readonly slotMaterialColor: string;
}

// Utility functions (inlined to avoid require errors)
function validateMaterialCompatibility(tool: FFGcodeToolData, slot: MaterialSlotInfo): boolean {
  if (slot.isEmpty || !slot.materialType) return false;
  return tool.materialName === slot.materialType;
}

function createColorDifferenceWarning(toolId: number, toolColor: string, slotId: number, slotColor: string): string {
  return `Color difference detected: Tool ${toolId + 1} expects ${toolColor} but Slot ${slotId + 1} has ${slotColor}. This is allowed but may affect print appearance.`;
}

function createMaterialMismatchError(toolId: number, toolMaterial: string, slotId: number, slotMaterial: string | null): string {
  return `Material type mismatch: Tool ${toolId + 1} requires ${toolMaterial}, but Slot ${slotId + 1} contains ${slotMaterial || 'no material'}`;
}


function hasColorDifference(toolColor: string, slotColor: string | null): boolean {
  if (!slotColor) return false;
  return toolColor.toLowerCase() !== slotColor.toLowerCase();
}

interface MaterialMatchingDialogAPI {
  readonly onInit: (callback: (data: MaterialMatchingInitData) => void) => void;
  readonly closeDialog: () => void;
  readonly confirmMappings: (mappings: AD5XMaterialMapping[]) => void;
  readonly getMaterialStationStatus: () => Promise<MaterialStationStatus | null>;
  receive?: (channel: string, func: (...args: unknown[]) => void) => void;
}

interface MaterialMatchingInitData {
  readonly fileName: string;
  readonly toolDatas: readonly FFGcodeToolData[];
  readonly leveling: boolean;
  readonly context?: 'job-start' | 'file-upload'; // Context to determine button text
}

let cachedMaterialMatchingAPI: MaterialMatchingDialogAPI | null = null;

const getMaterialMatchingAPI = (): MaterialMatchingDialogAPI => {
  if (cachedMaterialMatchingAPI) {
    return cachedMaterialMatchingAPI;
  }
  const api = window.api?.dialog?.materialMatching as MaterialMatchingDialogAPI | undefined;
  if (!api) {
    throw new Error('[MaterialMatchingDialog] dialog API bridge is not available');
  }
  cachedMaterialMatchingAPI = api;
  return api;
};

// Global state
let initData: MaterialMatchingInitData | null = null;
let materialStation: MaterialStationStatus | null = null;
let selectedTool: number | null = null;
let selectedSlot: number | null = null;
const currentMappings: Map<number, AD5XMaterialMapping> = new Map();

// DOM elements
let printRequirementsElement: HTMLElement | null = null;
let ifsSlotsElement: HTMLElement | null = null;
let materialMappingsElement: HTMLElement | null = null;
let errorMessageElement: HTMLElement | null = null;
let warningMessageElement: HTMLElement | null = null;
let confirmButton: HTMLButtonElement | null = null;

/**
 * Initialize the material matching dialog
 */
function initializeDialog(): void {
  window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['x']);
  // Get DOM elements
  printRequirementsElement = document.getElementById('print-requirements');
  ifsSlotsElement = document.getElementById('ifs-slots');
  materialMappingsElement = document.getElementById('material-mappings');
  errorMessageElement = document.getElementById('error-message');
  warningMessageElement = document.getElementById('warning-message');
  confirmButton = document.getElementById('btn-confirm') as HTMLButtonElement;

  if (!printRequirementsElement || !ifsSlotsElement || !materialMappingsElement || 
      !errorMessageElement || !warningMessageElement || !confirmButton) {
    console.error('Material matching: Failed to find required DOM elements');
    return;
  }

  setupEventListeners();
  const api = getMaterialMatchingAPI();
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

  // Confirm button
  confirmButton?.addEventListener('click', handleConfirm);
}

/**
 * Set up IPC listeners
 */
function setupIpcListeners(api: MaterialMatchingDialogAPI): void {
  api.onInit(async (data: MaterialMatchingInitData) => {
    console.log('Material matching: Received init data', data);
    initData = data;
    
    // Set button text based on context
    if (confirmButton) {
      if (data.context === 'file-upload') {
        confirmButton.textContent = 'Confirm';
      } else {
        confirmButton.textContent = 'Start Print'; // Default for job-start context
      }
    }
    
    await loadMaterialStation(api);
    displayPrintRequirements();
    displayIFSSlots();
    updateMappingsDisplay();
  });
}

/**
 * Load material station status
 */
async function loadMaterialStation(api: MaterialMatchingDialogAPI): Promise<void> {
  try {
    materialStation = await api.getMaterialStationStatus();
    if (!materialStation || !materialStation.connected) {
      showError('Material station is not connected or available');
    }
  } catch (error) {
    showError('Failed to load material station status');
    console.error('Material station error:', error);
  }
}

/**
 * Display print requirements
 */
function displayPrintRequirements(): void {
  if (!printRequirementsElement || !initData) return;

  printRequirementsElement.innerHTML = '';

  initData.toolDatas.forEach((tool) => {
    const item = createRequirementItem(tool);
    if (printRequirementsElement) {
      printRequirementsElement.appendChild(item);
    }
  });
}

/**
 * Create a requirement item element
 */
function createRequirementItem(tool: FFGcodeToolData): HTMLElement {
  const item = document.createElement('div');
  item.className = 'requirement-item';
  item.dataset.toolId = String(tool.toolId);

  const header = document.createElement('div');
  header.className = 'requirement-header';

  const label = document.createElement('div');
  label.className = 'tool-label';
  label.textContent = `Tool ${tool.toolId + 1}`; // Display as 1-based

  const swatch = document.createElement('div');
  swatch.className = 'material-swatch';
  swatch.style.backgroundColor = tool.materialColor;

  header.appendChild(label);
  header.appendChild(swatch);

  const details = document.createElement('div');
  details.className = 'requirement-details';
  details.innerHTML = `
    <div>Material: ${tool.materialName}</div>
    <div>Weight: ${tool.filamentWeight.toFixed(1)}g</div>
  `;

  item.appendChild(header);
  item.appendChild(details);

  // Click handler
  item.addEventListener('click', () => handleToolSelection(tool.toolId));

  return item;
}

/**
 * Display IFS slots
 */
function displayIFSSlots(): void {
  if (!ifsSlotsElement || !materialStation) return;

  ifsSlotsElement.innerHTML = '';

  materialStation.slots.forEach((slot, index) => {
    const item = createSlotItem(slot, index + 1); // Slots are 1-based in UI
    if (ifsSlotsElement) {
      ifsSlotsElement.appendChild(item);
    }
  });
}

/**
 * Create a slot item element
 */
function createSlotItem(slot: MaterialSlotInfo, slotNumber: number): HTMLElement {
  const item = document.createElement('div');
  item.className = 'slot-item';
  item.dataset.slotId = String(slotNumber);

  if (slot.isEmpty) {
    item.classList.add('disabled');
  }

  // Check if already assigned
  const isAssigned = Array.from(currentMappings.values()).some(m => m.slotId === slotNumber);
  if (isAssigned) {
    item.classList.add('assigned');
  }

  const swatch = document.createElement('div');
  swatch.className = 'slot-swatch';
  if (slot.materialColor) {
    swatch.style.backgroundColor = slot.materialColor;
  } else {
    swatch.style.backgroundColor = '#333333';
  }

  const info = document.createElement('div');
  info.className = 'slot-info';

  const label = document.createElement('div');
  label.className = 'slot-label';
  label.textContent = `Slot ${slotNumber}`;

  const material = document.createElement('div');
  if (slot.isEmpty) {
    material.className = 'slot-empty';
    material.textContent = 'Empty';
  } else {
    material.className = 'slot-material';
    material.textContent = slot.materialType || 'Unknown';
  }

  info.appendChild(label);
  info.appendChild(material);

  item.appendChild(swatch);
  item.appendChild(info);

  // Click handler
  if (!slot.isEmpty && !isAssigned) {
    item.addEventListener('click', () => handleSlotSelection(slotNumber));
  }

  return item;
}

/**
 * Handle tool selection
 */
function handleToolSelection(toolId: number): void {
  selectedTool = toolId;
  selectedSlot = null;

  // Update UI
  document.querySelectorAll('.requirement-item').forEach(item => {
    const element = item as HTMLElement;
    if (element.dataset.toolId === String(toolId)) {
      element.classList.add('selected');
    } else {
      element.classList.remove('selected');
    }
  });

  // Clear slot selections
  document.querySelectorAll('.slot-item').forEach(item => {
    item.classList.remove('selected');
  });
}

/**
 * Handle slot selection
 */
function handleSlotSelection(slotId: number): void {
  if (selectedTool === null) {
    showError('Please select a tool first');
    return;
  }

  selectedSlot = slotId;

  // Update UI
  document.querySelectorAll('.slot-item').forEach(item => {
    const element = item as HTMLElement;
    if (element.dataset.slotId === String(slotId)) {
      element.classList.add('selected');
    } else {
      element.classList.remove('selected');
    }
  });

  // Create mapping
  createMapping();
}

/**
 * Create a material mapping
 */
function createMapping(): void {
  if (selectedTool === null || selectedSlot === null || !initData || !materialStation) return;

  const tool = initData.toolDatas.find(t => t.toolId === selectedTool);
  const slot = materialStation.slots[selectedSlot - 1]; // Convert to 0-based

  if (!tool || !slot || slot.isEmpty) return;

  const mapping: AD5XMaterialMapping = {
    toolId: tool.toolId,
    slotId: selectedSlot,
    materialName: tool.materialName,
    toolMaterialColor: tool.materialColor,
    slotMaterialColor: slot.materialColor || '#333333'
  };

  // Validate material compatibility
  const isCompatible = validateMaterialCompatibility(tool, slot);
  
  if (!isCompatible) {
    showError(createMaterialMismatchError(
      tool.toolId,
      tool.materialName,
      selectedSlot,
      slot.materialType
    ));
    return;
  }

  // Check for color differences
  if (hasColorDifference(tool.materialColor, slot.materialColor)) {
    showWarning(createColorDifferenceWarning(
      tool.toolId,
      tool.materialColor,
      selectedSlot,
      slot.materialColor || ''
    ));
  }

  // Add mapping
  currentMappings.set(tool.toolId, mapping);

  // Reset selections
  selectedTool = null;
  selectedSlot = null;

  // Update UI
  updateAllDisplays();
}

/**
 * Update all displays
 */
function updateAllDisplays(): void {
  displayPrintRequirements();
  displayIFSSlots();
  updateMappingsDisplay();
  updateConfirmButton();
}

/**
 * Update mappings display
 */
function updateMappingsDisplay(): void {
  if (!materialMappingsElement) return;

  materialMappingsElement.innerHTML = '';

  if (currentMappings.size === 0) {
    materialMappingsElement.innerHTML = '<div class="empty-mappings">Select a tool and then a slot to create mappings</div>';
    return;
  }

  currentMappings.forEach((mapping) => {
    const item = createMappingItem(mapping);
    if (materialMappingsElement) {
      materialMappingsElement.appendChild(item);
    }
  });
}

/**
 * Create a mapping item element
 */
function createMappingItem(mapping: AD5XMaterialMapping): HTMLElement {
  const item = document.createElement('div');
  item.className = 'mapping-item';

  // Check for color difference
  if (hasColorDifference(mapping.toolMaterialColor, mapping.slotMaterialColor)) {
    item.classList.add('mapping-warning');
  }

  const text = document.createElement('div');
  text.className = 'mapping-text';
  text.innerHTML = `Tool ${mapping.toolId + 1} <span class="mapping-arrow">→</span> Slot ${mapping.slotId}`;

    const removeButton = document.createElement('button');
    removeButton.className = 'remove-mapping';
    const removeIcon = document.createElement('i');
    removeIcon.setAttribute('data-lucide', 'x');
    removeButton.appendChild(removeIcon);
    window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['x'], removeButton);
    removeButton.title = 'Remove mapping';
    removeButton.addEventListener('click', () => removeMapping(mapping.toolId));

  item.appendChild(text);
  item.appendChild(removeButton);

  return item;
}

/**
 * Remove a mapping
 */
function removeMapping(toolId: number): void {
  currentMappings.delete(toolId);
  updateAllDisplays();
  hideMessages();
}

/**
 * Update confirm button state
 */
function updateConfirmButton(): void {
  if (!confirmButton || !initData) return;

  // Enable only if all tools are mapped
  const allMapped = initData.toolDatas.every(tool => currentMappings.has(tool.toolId));
  confirmButton.disabled = !allMapped;
}

/**
 * Show error message
 */
function showError(message: string): void {
  if (!errorMessageElement) return;
  errorMessageElement.textContent = message;
  errorMessageElement.style.display = 'block';
  if (warningMessageElement) warningMessageElement.style.display = 'none';
}

/**
 * Show warning message
 */
function showWarning(message: string): void {
  if (!warningMessageElement) return;
  warningMessageElement.textContent = message;
  warningMessageElement.style.display = 'block';
  if (errorMessageElement) errorMessageElement.style.display = 'none';
}

/**
 * Hide all messages
 */
function hideMessages(): void {
  if (errorMessageElement) errorMessageElement.style.display = 'none';
  if (warningMessageElement) warningMessageElement.style.display = 'none';
}

/**
 * Handle close
 */
function handleClose(): void {
  getMaterialMatchingAPI().closeDialog();
}

/**
 * Handle confirm
 */
function handleConfirm(): void {
  if (!initData) return;

  // Convert mappings to array
  const mappings = Array.from(currentMappings.values());
  
  // Ensure all tools are mapped
  if (mappings.length !== initData.toolDatas.length) {
    showError('Please map all tools before starting the print');
    return;
  }

  getMaterialMatchingAPI().confirmMappings(mappings);
}

/**
 * Cleanup
 */
function cleanup(): void {
  initData = null;
  materialStation = null;
  selectedTool = null;
  selectedSlot = null;
  currentMappings.clear();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeDialog();
});

function registerThemeListener(api: MaterialMatchingDialogAPI): void {
    api.receive?.('theme-changed', (data: unknown) => {
        applyDialogTheme(data as ThemeColors);
    });
}

// Cleanup when window is unloaded
window.addEventListener('unload', cleanup);

// Export for module
export {};

