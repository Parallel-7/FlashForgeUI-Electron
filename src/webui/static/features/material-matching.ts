/**
 * @fileoverview AD5X material matching workflow for multi-color jobs.
 *
 * Manages the modal experience for mapping tool requirements to material
 * station slots including validation, warnings, and final job start submission.
 * Encapsulates all DOM rendering plus state management so callers only need
 * to trigger the modal or respond to confirmation events.
 */

import type {
  MaterialMapping,
  MaterialSlotInfo,
  MaterialStationStatus,
  MaterialStationStatusResponse,
  PendingJobStart,
  WebUIJobFile,
} from '../app.js';
import {
  getMaterialMatchingState,
  setMaterialMatchingState,
  state,
} from '../core/AppState.js';
import { apiRequest } from '../core/Transport.js';
import { $, hideElement, showElement, showToast } from '../shared/dom.js';
import { colorsDiffer, isAD5XJobFile, materialsMatch } from '../shared/formatting.js';
import { sendJobStartRequest } from './job-control.js';

type MaterialMessageType = 'error' | 'warning';

let materialHandlersRegistered = false;

function getMaterialMatchingElement<T extends HTMLElement>(id: string): T | null {
  return $(id) as T | null;
}

function getMaterialMessageElement(type: MaterialMessageType): HTMLDivElement | null {
  const id = type === 'error' ? 'material-matching-error' : 'material-matching-warning';
  return getMaterialMatchingElement<HTMLDivElement>(id);
}

export function clearMaterialMessages(): void {
  (['error', 'warning'] as const).forEach((type) => {
    const messageEl = getMaterialMessageElement(type);
    if (messageEl) {
      messageEl.classList.add('hidden');
      messageEl.textContent = '';
    }
  });
}

export function showMaterialError(text: string): void {
  const errorEl = getMaterialMessageElement('error');
  const warningEl = getMaterialMessageElement('warning');
  if (warningEl) {
    warningEl.classList.add('hidden');
    warningEl.textContent = '';
  }
  if (errorEl) {
    errorEl.textContent = text;
    errorEl.classList.remove('hidden');
  }
}

export function showMaterialWarning(text: string): void {
  const warningEl = getMaterialMessageElement('warning');
  if (warningEl) {
    warningEl.textContent = text;
    warningEl.classList.remove('hidden');
  }
}

export function updateMaterialMatchingConfirmState(): void {
  const confirmButton = getMaterialMatchingElement<HTMLButtonElement>('material-matching-confirm');
  if (!confirmButton) {
    return;
  }

  const matchingState = getMaterialMatchingState();
  if (!matchingState) {
    confirmButton.disabled = true;
    return;
  }

  const job = matchingState.pending.job;
  const requiredMappings = isAD5XJobFile(job) ? job.toolDatas.length : 0;
  confirmButton.disabled = matchingState.mappings.size !== requiredMappings;
}

export function renderMaterialMappings(): void {
  const container = getMaterialMatchingElement<HTMLDivElement>('material-mappings');
  if (!container) {
    return;
  }

  container.innerHTML = '';
  const matchingState = getMaterialMatchingState();

  if (!matchingState || matchingState.mappings.size === 0) {
    const empty = document.createElement('div');
    empty.className = 'material-mapping-empty';
    empty.textContent = 'Select a tool and then choose a matching slot to create mappings.';
    container.appendChild(empty);
    return;
  }

  matchingState.mappings.forEach((mapping) => {
    const item = document.createElement('div');
    item.className = 'material-mapping-item';

    if (colorsDiffer(mapping.toolMaterialColor, mapping.slotMaterialColor)) {
      item.classList.add('warning');
    }

    const text = document.createElement('span');
    text.className = 'material-mapping-text';
    text.innerHTML = `Tool ${mapping.toolId + 1} <span class="material-mapping-arrow">&rarr;</span> Slot ${mapping.slotId}`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'material-mapping-remove';
    removeBtn.type = 'button';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove mapping';
    removeBtn.addEventListener('click', () => {
      handleRemoveMapping(mapping.toolId);
    });

    item.appendChild(text);
    item.appendChild(removeBtn);
    container.appendChild(item);
  });
}

function handleRemoveMapping(toolId: number): void {
  const matchingState = getMaterialMatchingState();
  if (!matchingState) {
    return;
  }

  matchingState.mappings.delete(toolId);
  renderMaterialRequirements(matchingState.pending.job);
  renderMaterialSlots(matchingState.materialStation);
  renderMaterialMappings();
  updateMaterialMatchingConfirmState();
  clearMaterialMessages();
}

export function renderMaterialRequirements(job: WebUIJobFile | undefined): void {
  const container = getMaterialMatchingElement<HTMLDivElement>('material-job-requirements');
  if (!container) {
    return;
  }

  container.innerHTML = '';
  const matchingState = getMaterialMatchingState();

  if (!job || !isAD5XJobFile(job) || job.toolDatas.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'material-placeholder';
    empty.textContent = 'No material requirements available for this job.';
    container.appendChild(empty);
    return;
  }

  job.toolDatas.forEach((tool) => {
    const item = document.createElement('div');
    item.className = 'material-tool-item';
    item.dataset.toolId = `${tool.toolId}`;

    if (matchingState?.selectedToolId === tool.toolId) {
      item.classList.add('selected');
    }

    if (matchingState?.mappings.has(tool.toolId)) {
      item.classList.add('mapped');
    }

    const header = document.createElement('div');
    header.className = 'material-tool-header';

    const label = document.createElement('span');
    label.className = 'material-tool-label';
    label.textContent = `Tool ${tool.toolId + 1}`;

    const color = document.createElement('span');
    color.className = 'material-tool-color';
    color.style.backgroundColor = tool.materialColor || '#cccccc';

    header.appendChild(label);
    header.appendChild(color);

    const details = document.createElement('div');
    details.className = 'material-tool-details';
    details.textContent = tool.materialName || 'Unknown Material';

    if (matchingState?.mappings.has(tool.toolId)) {
      const mapping = matchingState.mappings.get(tool.toolId);
      if (mapping) {
        const mappingInfo = document.createElement('div');
        mappingInfo.className = 'material-tool-mapping';
        mappingInfo.textContent = `Mapped to Slot ${mapping.slotId}`;
        details.appendChild(mappingInfo);
      }
    }

    item.appendChild(header);
    item.appendChild(details);
    container.appendChild(item);
  });
}

function handleToolSelection(toolId: number): void {
  const matchingState = getMaterialMatchingState();
  if (!matchingState) {
    return;
  }

  if (matchingState.selectedToolId === toolId) {
    matchingState.selectedToolId = null;
  } else {
    matchingState.selectedToolId = toolId;
  }

  clearMaterialMessages();
  renderMaterialRequirements(matchingState.pending.job);
  renderMaterialSlots(matchingState.materialStation);
}

function isSlotAlreadyAssigned(slotDisplayId: number): boolean {
  const matchingState = getMaterialMatchingState();
  if (!matchingState) {
    return false;
  }

  for (const mapping of matchingState.mappings.values()) {
    if (mapping.slotId === slotDisplayId) {
      return true;
    }
  }

  return false;
}

export function renderMaterialSlots(status: MaterialStationStatus | null): void {
  const container = getMaterialMatchingElement<HTMLDivElement>('material-slot-list');
  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (!status) {
    const empty = document.createElement('div');
    empty.className = 'material-placeholder';
    empty.textContent = 'Material station status unavailable.';
    container.appendChild(empty);
    return;
  }

  if (!status.connected || status.slots.length === 0) {
    const disconnected = document.createElement('div');
    disconnected.className = 'material-placeholder';
    disconnected.textContent = status.errorMessage || 'Material station not connected.';
    container.appendChild(disconnected);
    return;
  }

  status.slots.forEach((slot) => {
    const displaySlotId = slot.slotId + 1;
    const item = document.createElement('div');
    item.className = 'material-slot-item';
    item.dataset.slotId = `${displaySlotId}`;
    item.dataset.rawSlotId = `${slot.slotId}`;
    item.dataset.materialType = slot.materialType ?? '';
    item.dataset.materialColor = slot.materialColor ?? '';
    item.dataset.isEmpty = slot.isEmpty ? 'true' : 'false';

    if (slot.isEmpty) {
      item.classList.add('empty');
    }

    if (isSlotAlreadyAssigned(displaySlotId)) {
      item.classList.add('assigned');
    }

    const swatch = document.createElement('span');
    swatch.className = 'material-slot-swatch';
    if (slot.materialColor) {
      swatch.style.backgroundColor = slot.materialColor;
    }

    const info = document.createElement('div');
    info.className = 'material-slot-info';

    const label = document.createElement('div');
    label.className = 'material-slot-label';
    label.textContent = `Slot ${displaySlotId}`;

    const material = document.createElement('div');
    material.className = 'material-slot-material';
    material.textContent = slot.isEmpty ? 'Empty' : slot.materialType || 'Unknown';

    info.appendChild(label);
    info.appendChild(material);

    item.appendChild(swatch);
    item.appendChild(info);

    if (slot.isEmpty || isSlotAlreadyAssigned(displaySlotId)) {
      item.classList.add('disabled');
    }

    container.appendChild(item);
  });
}

function createSlotInfoFromElement(element: HTMLElement): MaterialSlotInfo | null {
  const rawSlotId = element.dataset.rawSlotId;
  if (rawSlotId === undefined) {
    return null;
  }

  return {
    slotId: Number(rawSlotId),
    isEmpty: element.dataset.isEmpty === 'true',
    materialType: element.dataset.materialType || null,
    materialColor: element.dataset.materialColor || null,
  };
}

function handleSlotSelection(slotInfo: MaterialSlotInfo): void {
  const matchingState = getMaterialMatchingState();
  if (!matchingState) {
    return;
  }

  const job = matchingState.pending.job;
  if (!job || !isAD5XJobFile(job)) {
    return;
  }

  const selectedToolId = matchingState.selectedToolId;
  if (selectedToolId === null) {
    showMaterialError('Select a tool on the left before choosing a slot.');
    return;
  }

  if (slotInfo.isEmpty) {
    showMaterialError('Cannot assign an empty slot. Load filament before starting the print.');
    return;
  }

  const tool = job.toolDatas.find((t) => t.toolId === selectedToolId);
  if (!tool) {
    showMaterialError('Selected tool data is unavailable.');
    return;
  }

  if (!materialsMatch(tool.materialName, slotInfo.materialType)) {
    showMaterialError(
      `Material mismatch: Tool ${tool.toolId + 1} requires ${tool.materialName}, but Slot ${
        slotInfo.slotId + 1
      } contains ${slotInfo.materialType || 'no material'}.`,
    );
    return;
  }

  const displaySlotId = slotInfo.slotId + 1;

  if (isSlotAlreadyAssigned(displaySlotId)) {
    showMaterialError(`Slot ${displaySlotId} is already assigned to another tool.`);
    return;
  }

  const mapping: MaterialMapping = {
    toolId: tool.toolId,
    slotId: displaySlotId,
    materialName: tool.materialName,
    toolMaterialColor: tool.materialColor,
    slotMaterialColor: slotInfo.materialColor || '#333333',
  };

  matchingState.mappings.set(tool.toolId, mapping);
  matchingState.selectedToolId = null;

  if (colorsDiffer(tool.materialColor, slotInfo.materialColor || '')) {
    showMaterialWarning(
      `Tool ${tool.toolId + 1} color (${tool.materialColor}) does not match Slot ${displaySlotId} color (${slotInfo.materialColor || 'unknown'}). The print will succeed, but appearance may differ.`,
    );
  } else {
    clearMaterialMessages();
  }

  renderMaterialRequirements(job);
  renderMaterialSlots(matchingState.materialStation);
  renderMaterialMappings();
  updateMaterialMatchingConfirmState();
}

async function fetchMaterialStationStatus(): Promise<MaterialStationStatus | null> {
  if (state.authRequired && !state.authToken) {
    return null;
  }

  try {
    const result = await apiRequest<MaterialStationStatusResponse>('/api/printer/material-station');
    if (result.success) {
      return result.status ?? null;
    }

    showMaterialError(result.error || 'Material station not available.');
    return null;
  } catch (error) {
    console.error('Failed to fetch material station status:', error);
    showMaterialError('Failed to load material station status.');
    return null;
  }
}

export function resetMaterialMatchingState(): void {
  setMaterialMatchingState(null);
  state.pendingJobStart = null;
  clearMaterialMessages();
  updateMaterialMatchingConfirmState();
}

export function closeMaterialMatchingModal(): void {
  hideElement('material-matching-modal');
  resetMaterialMatchingState();
}

export async function openMaterialMatchingModal(pending: PendingJobStart): Promise<void> {
  const modal = getMaterialMatchingElement<HTMLDivElement>('material-matching-modal');
  const title = getMaterialMatchingElement<HTMLHeadingElement>('material-matching-title');

  if (!modal || !pending || !pending.job || !isAD5XJobFile(pending.job)) {
    showToast('Material matching is not available for this job.', 'error');
    resetMaterialMatchingState();
    return;
  }

  state.pendingJobStart = pending;
  setMaterialMatchingState({
    pending,
    materialStation: null,
    selectedToolId: null,
    mappings: new Map(),
  });

  if (title) {
    title.textContent = `Match Materials – ${pending.job.displayName || pending.job.fileName}`;
  }

  renderMaterialRequirements(pending.job);
  renderMaterialSlots(null);
  renderMaterialMappings();
  updateMaterialMatchingConfirmState();
  clearMaterialMessages();
  showElement('material-matching-modal');

  const status = await fetchMaterialStationStatus();
  const matchingState = getMaterialMatchingState();
  if (!matchingState) {
    return;
  }

  matchingState.materialStation = status;
  renderMaterialSlots(status);

  if (!status || !status.connected) {
    showMaterialError(status?.errorMessage || 'Material station not connected.');
  }
}

export async function confirmMaterialMatching(): Promise<void> {
  const matchingState = getMaterialMatchingState();
  if (!matchingState || !matchingState.pending.job || !isAD5XJobFile(matchingState.pending.job)) {
    return;
  }

  const job = matchingState.pending.job;
  const requiredMappings = job.toolDatas.length;

  if (matchingState.mappings.size !== requiredMappings) {
    showMaterialError('Map every tool to a material slot before starting the job.');
    return;
  }

  const mappings = Array.from(matchingState.mappings.values());
  const confirmButton = getMaterialMatchingElement<HTMLButtonElement>('material-matching-confirm');

  if (confirmButton) {
    confirmButton.disabled = true;
  }

  const success = await sendJobStartRequest({
    filename: matchingState.pending.filename,
    leveling: matchingState.pending.leveling,
    startNow: true,
    materialMappings: mappings,
  });

  if (confirmButton) {
    confirmButton.disabled = false;
  }

  if (success) {
    hideElement('file-modal');
    closeMaterialMatchingModal();
  }
}

export function setupMaterialMatchingHandlers(): void {
  if (materialHandlersRegistered) {
    return;
  }
  materialHandlersRegistered = true;

  const requirements = $('material-job-requirements');
  requirements?.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement | null)?.closest(
      '.material-tool-item',
    ) as HTMLElement | null;
    if (!target || !target.dataset.toolId) {
      return;
    }
    handleToolSelection(Number(target.dataset.toolId));
  });

  const slotList = $('material-slot-list');
  slotList?.addEventListener('click', (event) => {
    const slotElement = (event.target as HTMLElement | null)?.closest(
      '.material-slot-item',
    ) as HTMLElement | null;
    if (!slotElement || slotElement.classList.contains('disabled')) {
      return;
    }

    const slotInfo = createSlotInfoFromElement(slotElement);
    if (!slotInfo) {
      return;
    }
    handleSlotSelection(slotInfo);
  });
}
