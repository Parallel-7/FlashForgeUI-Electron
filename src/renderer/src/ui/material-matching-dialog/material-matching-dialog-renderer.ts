/**
 * @fileoverview Renderer process for interactive material-to-slot matching interface.
 *
 * Implements dual-panel selection UI for mapping print job material requirements to physical
 * material station slots. Validates material type compatibility, warns on color differences,
 * and prevents invalid mappings (empty slots, type mismatches, duplicate assignments). Provides
 * visual feedback through color swatches, selection states, and real-time mapping display.
 * Confirms mappings only - the caller decides whether the job is sent or started.
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

import type { ThemeColors } from '@shared/types/config.js';
import { initializeLucideIconsFromGlobal } from '../shared/lucide.js';
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
  /** Spoolman spool for the tool; null = do not track; absent = not asked. */
  readonly spoolId?: number | null;
}

/** Spool offered in the dialog for per-job Spoolman tracking. */
interface TrackingSpool {
  readonly id: number;
  readonly name: string;
  readonly vendor: string | null;
  readonly material: string | null;
  readonly remainingWeight: number | null;
}

// Utility functions (inlined to avoid require errors)
function validateMaterialCompatibility(tool: FFGcodeToolData, slot: MaterialSlotInfo): boolean {
  if (slot.isEmpty || !slot.materialType) return false;
  return tool.materialName === slot.materialType;
}

/** Shared wording - keep in step with the two web UIs. */
function createColorDifferenceWarning(toolId: number, toolColor: string, slotId: number, slotColor: string): string {
  return `Tool ${toolId + 1} expects ${toolColor} but Slot ${slotId} has ${slotColor}.`;
}

function createMaterialMismatchError(
  toolId: number,
  toolMaterial: string,
  slotId: number,
  slotMaterial: string | null
): string {
  return `Material type mismatch: Tool ${toolId + 1} requires ${toolMaterial}, but Slot ${slotId} contains ${slotMaterial || 'no material'}`;
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
  readonly getTrackingSpools?: () => Promise<TrackingSpool[] | null>;
  receive?: (channel: string, func: (...args: unknown[]) => void) => void;
}

interface MaterialMatchingInitData {
  readonly fileName: string;
  readonly toolDatas: readonly FFGcodeToolData[];
  readonly leveling: boolean;
  readonly context?: 'job-start' | 'file-upload'; // Which flow opened the dialog
  /** True when the caller starts the job now, so a spool per tool is asked. */
  readonly trackSpools?: boolean;
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
/** Spools offered for per-job tracking; null when tracking does not apply. */
let trackingSpools: TrackingSpool[] | null = null;
/** Spool choice per tool: a spool id, null for "do not track", or no entry. */
const spoolChoices: Map<number, number | null> = new Map();

const SPOOL_PLACEHOLDER_VALUE = '';
const SPOOL_UNTRACKED_VALUE = 'none';

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
  initializeLucideIconsFromGlobal(['x']);
  // Get DOM elements
  printRequirementsElement = document.getElementById('print-requirements');
  ifsSlotsElement = document.getElementById('ifs-slots');
  materialMappingsElement = document.getElementById('material-mappings');
  errorMessageElement = document.getElementById('error-message');
  warningMessageElement = document.getElementById('warning-message');
  confirmButton = document.getElementById('btn-confirm') as HTMLButtonElement;

  if (
    !printRequirementsElement ||
    !ifsSlotsElement ||
    !materialMappingsElement ||
    !errorMessageElement ||
    !warningMessageElement ||
    !confirmButton
  ) {
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

    // The label is the same in every flow and on every UI surface: this dialog
    // only confirms mappings, the caller decides what happens with them.
    if (confirmButton) {
      confirmButton.textContent = 'Confirm';
    }

    await loadMaterialStation(api);
    displayPrintRequirements();
    displayIFSSlots();
    updateMappingsDisplay();

    trackingSpools = null;
    spoolChoices.clear();
    if (data.trackSpools && api.getTrackingSpools) {
      try {
        trackingSpools = await api.getTrackingSpools();
      } catch (error) {
        console.warn('Material matching: could not load Spoolman spools', error);
        trackingSpools = null;
      }
    }
    const hint = document.getElementById('spool-hint');
    if (hint) {
      hint.style.display = trackingSpools !== null ? 'block' : 'none';
    }
    updateMappingsDisplay();
    updateConfirmButton();
  });
}

function normalizeMaterial(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function describeSpool(spool: TrackingSpool): string {
  const parts = [`#${spool.id}`, spool.vendor, spool.name].filter(Boolean);
  const remaining =
    typeof spool.remainingWeight === 'number' ? ` (${Math.round(spool.remainingWeight)} g left)` : '';
  return `${parts.join(' ')}${remaining}`;
}

/**
 * Spool picker for one mapping. Spools whose material matches the tool come
 * first, so the usual choice is near the top.
 */
function createSpoolSelect(mapping: AD5XMaterialMapping, spools: readonly TrackingSpool[]): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'mapping-spool';
  select.dataset.toolId = String(mapping.toolId);
  select.setAttribute('aria-label', `Spoolman spool for tool ${mapping.toolId + 1}`);

  const placeholder = document.createElement('option');
  placeholder.value = SPOOL_PLACEHOLDER_VALUE;
  placeholder.textContent = 'Choose a spool\u2026';
  placeholder.disabled = true;
  select.appendChild(placeholder);

  const untracked = document.createElement('option');
  untracked.value = SPOOL_UNTRACKED_VALUE;
  untracked.textContent = 'Do not track';
  select.appendChild(untracked);

  const wanted = normalizeMaterial(mapping.materialName);
  const sorted = [...spools].sort((a, b) => {
    const aMatch = normalizeMaterial(a.material) === wanted ? 0 : 1;
    const bMatch = normalizeMaterial(b.material) === wanted ? 0 : 1;
    return aMatch - bMatch || a.id - b.id;
  });
  for (const spool of sorted) {
    const option = document.createElement('option');
    option.value = String(spool.id);
    option.textContent = describeSpool(spool);
    select.appendChild(option);
  }

  const choice = spoolChoices.get(mapping.toolId);
  select.value =
    choice === undefined ? SPOOL_PLACEHOLDER_VALUE : choice === null ? SPOOL_UNTRACKED_VALUE : String(choice);

  select.addEventListener('click', (event) => event.stopPropagation());
  select.addEventListener('change', () => {
    if (select.value === SPOOL_UNTRACKED_VALUE) {
      spoolChoices.set(mapping.toolId, null);
    } else if (select.value === SPOOL_PLACEHOLDER_VALUE) {
      spoolChoices.delete(mapping.toolId);
    } else {
      spoolChoices.set(mapping.toolId, Number(select.value));
    }
    updateConfirmButton();
  });
  return select;
}

/** True when tracking does not apply, or every mapped tool has a spool choice. */
function allSpoolsChosen(): boolean {
  if (trackingSpools === null) {
    return true;
  }
  for (const toolId of currentMappings.keys()) {
    if (!spoolChoices.has(toolId)) {
      return false;
    }
  }
  return true;
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

  // Use slot.slotId which is 1-based from API
  materialStation.slots.forEach((slot) => {
    const item = createSlotItem(slot);
    if (ifsSlotsElement) {
      ifsSlotsElement.appendChild(item);
    }
  });
}

/**
 * Create a slot item element
 * Slot IDs are 1-based from the API
 */
function createSlotItem(slot: MaterialSlotInfo): HTMLElement {
  const item = document.createElement('div');
  item.className = 'slot-item';
  item.dataset.slotId = String(slot.slotId);

  if (slot.isEmpty) {
    item.classList.add('disabled');
  }

  // Check if already assigned
  const isAssigned = Array.from(currentMappings.values()).some((m) => m.slotId === slot.slotId);
  if (isAssigned) {
    item.classList.add('assigned');
  }

  const swatch = document.createElement('div');
  swatch.className = 'slot-swatch';
  if (slot.materialColor) {
    swatch.style.backgroundColor = slot.materialColor;
  } else {
    // Use theme-aware fallback color for empty material swatches
    swatch.style.backgroundColor = 'var(--surface-muted)';
  }

  const info = document.createElement('div');
  info.className = 'slot-info';

  const label = document.createElement('div');
  label.className = 'slot-label';
  label.textContent = `Slot ${slot.slotId}`;

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
    item.addEventListener('click', () => handleSlotSelection(slot.slotId));
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
  document.querySelectorAll('.requirement-item').forEach((item) => {
    const element = item as HTMLElement;
    if (element.dataset.toolId === String(toolId)) {
      element.classList.add('selected');
    } else {
      element.classList.remove('selected');
    }
  });

  // Clear slot selections
  document.querySelectorAll('.slot-item').forEach((item) => {
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
  document.querySelectorAll('.slot-item').forEach((item) => {
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

  // Find tool and slot by ID (slotId is 1-based from API)
  const tool = initData.toolDatas.find((t) => t.toolId === selectedTool);
  const slot = materialStation.slots.find((s) => s.slotId === selectedSlot);

  if (!tool || !slot || slot.isEmpty) return;

  const mapping: AD5XMaterialMapping = {
    toolId: tool.toolId,
    slotId: selectedSlot,
    materialName: tool.materialName,
    toolMaterialColor: tool.materialColor,
    // Note: Backend expects actual color value, not CSS var, so using neutral gray
    slotMaterialColor: slot.materialColor || '#808080',
  };

  // Validate material compatibility
  const isCompatible = validateMaterialCompatibility(tool, slot);

  if (!isCompatible) {
    showError(createMaterialMismatchError(tool.toolId, tool.materialName, selectedSlot, slot.materialType));
    return;
  }

  // Add mapping - the colour warnings are rebuilt from the whole set below
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
  refreshColorWarnings();
}

/**
 * Update mappings display
 */
function updateMappingsDisplay(): void {
  if (!materialMappingsElement) return;

  materialMappingsElement.innerHTML = '';

  if (currentMappings.size === 0) {
    materialMappingsElement.innerHTML =
      '<div class="empty-mappings">Select a tool and then a slot to create mappings</div>';
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
  const hasWarning = hasColorDifference(mapping.toolMaterialColor, mapping.slotMaterialColor);
  if (hasWarning) {
    item.classList.add('mapping-warning');
  }

  // Create content container
  const content = document.createElement('div');
  content.className = 'mapping-content';

  // Add warning icon if colors differ
  if (hasWarning) {
    const warningIcon = document.createElement('i');
    warningIcon.className = 'mapping-warning-icon';
    warningIcon.setAttribute('data-lucide', 'alert-triangle');
    content.appendChild(warningIcon);
    initializeLucideIconsFromGlobal(['alert-triangle'], content);
  }

  // Add tool color swatch
  const toolSwatch = document.createElement('div');
  toolSwatch.className = 'mapping-swatch';
  toolSwatch.style.backgroundColor = mapping.toolMaterialColor;
  toolSwatch.title = `Tool ${mapping.toolId + 1} color: ${mapping.toolMaterialColor}`;
  content.appendChild(toolSwatch);

  // Add text with arrow
  const text = document.createElement('div');
  text.className = 'mapping-text';
  text.innerHTML = `Tool ${mapping.toolId + 1} <span class="mapping-arrow">→</span> Slot ${mapping.slotId}`;
  content.appendChild(text);

  // Add slot color swatch
  const slotSwatch = document.createElement('div');
  slotSwatch.className = 'mapping-swatch';
  slotSwatch.style.backgroundColor = mapping.slotMaterialColor;
  slotSwatch.title = `Slot ${mapping.slotId} color: ${mapping.slotMaterialColor}`;
  content.appendChild(slotSwatch);

  // Add remove button
  const removeButton = document.createElement('button');
  removeButton.className = 'remove-mapping';
  const removeIcon = document.createElement('i');
  removeIcon.setAttribute('data-lucide', 'x');
  removeButton.appendChild(removeIcon);
  initializeLucideIconsFromGlobal(['x'], removeButton);
  removeButton.title = 'Remove mapping';
  removeButton.addEventListener('click', () => removeMapping(mapping.toolId));

  item.appendChild(content);
  if (trackingSpools !== null) {
    item.appendChild(createSpoolSelect(mapping, trackingSpools));
  }
  item.appendChild(removeButton);

  return item;
}

/**
 * Remove a mapping
 */
function removeMapping(toolId: number): void {
  currentMappings.delete(toolId);
  spoolChoices.delete(toolId);
  updateAllDisplays();
  hideMessages();
}

/**
 * Update confirm button state
 */
function updateConfirmButton(): void {
  if (!confirmButton || !initData) return;

  // Enable only if all tools are mapped
  const allMapped = initData.toolDatas.every((tool) => currentMappings.has(tool.toolId));
  confirmButton.disabled = !allMapped || !allSpoolsChosen();
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
 * One line per mapping whose tool color does not match the slot it was mapped
 * to. Rebuilt from the current mappings on every change, so the card always
 * reflects the whole set rather than the last click.
 */
function refreshColorWarnings(): void {
  const list = document.getElementById('warning-message-list');
  if (!warningMessageElement || !list) return;

  list.textContent = '';

  const mismatched = Array.from(currentMappings.values()).filter((mapping) =>
    hasColorDifference(mapping.toolMaterialColor, mapping.slotMaterialColor)
  );

  if (mismatched.length === 0) {
    warningMessageElement.style.display = 'none';
    return;
  }

  mismatched.forEach((mapping) => {
    const item = document.createElement('div');
    item.className = 'warning-card-item';
    item.textContent = createColorDifferenceWarning(
      mapping.toolId,
      mapping.toolMaterialColor,
      mapping.slotId,
      mapping.slotMaterialColor
    );
    list.appendChild(item);
  });

  warningMessageElement.style.display = 'block';
}

/**
 * Hide all messages
 */
function hideMessages(): void {
  if (errorMessageElement) errorMessageElement.style.display = 'none';
  refreshColorWarnings();
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

  if (!allSpoolsChosen()) {
    showError('Choose a Spoolman spool for each tool, or choose "Do not track".');
    return;
  }

  // Convert mappings to array; attach the spool choice when one was asked.
  const mappings = Array.from(currentMappings.values()).map((mapping) =>
    trackingSpools === null ? mapping : { ...mapping, spoolId: spoolChoices.get(mapping.toolId) ?? null }
  );

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
  trackingSpools = null;
  spoolChoices.clear();
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
