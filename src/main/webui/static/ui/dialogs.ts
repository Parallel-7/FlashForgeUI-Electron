/**
 * @fileoverview Dialog orchestration utilities for the WebUI client.
 *
 * Handles file selection, temperature prompts, and shared modal event
 * registration. These helpers keep `app.ts` focused on orchestration by
 * centralizing DOM interactions while delegating business logic (job start,
 * material matching, printer commands) through dependency callbacks.
 */

import type { FileListResponse, WebUIJobFile } from '../app.js';
import { state } from '../core/AppState.js';
import { apiRequest } from '../core/Transport.js';
import { $, hideElement, showElement, showToast } from '../shared/dom.js';
import {
  buildMaterialBadgeTooltip,
  formatJobPrintingTime,
  isAD5XJobFile,
  isMultiColorJobFile,
} from '../shared/formatting.js';

/**
 * A settable heater target. Single-nozzle printers use `bed`/`extruder`; the
 * Creator 5 series adds `chamber` and per-`tool` heaters (index is 0-based on the
 * wire, displayed as T1..Tn in the UI).
 */
export type TemperatureTarget =
  | { kind: 'bed' }
  | { kind: 'extruder' }
  | { kind: 'chamber' }
  | { kind: 'tool'; index: number };

interface TemperatureDialogElement extends HTMLElement {
  temperatureTarget?: TemperatureTarget;
}

/** Firmware chamber temperature ceiling (matches the desktop Creator 5 card). */
const CHAMBER_MAX_TEMP = 80;

export interface DialogHandlers {
  onStartPrintJob?: () => Promise<void> | void;
  onMaterialMatchingClosed?: () => void;
  onMaterialMatchingConfirm?: () => Promise<void> | void;
  onTemperatureSubmit?: (target: TemperatureTarget, temperature: number) => Promise<void> | void;
}

function temperatureTargetLabel(target: TemperatureTarget): string {
  switch (target.kind) {
    case 'bed':
      return 'Bed';
    case 'extruder':
      return 'Extruder';
    case 'chamber':
      return 'Chamber';
    case 'tool':
      return `Tool T${target.index + 1}`;
  }
}

function currentTargetTemperature(target: TemperatureTarget): number {
  const status = state.printerStatus;
  if (!status) {
    return 0;
  }
  switch (target.kind) {
    case 'bed':
      return status.bedTargetTemperature;
    case 'extruder':
      return status.nozzleTargetTemperature;
    case 'chamber':
      return status.chamberTargetTemperature ?? 0;
    case 'tool':
      return status.toolTemps?.[target.index]?.target ?? 0;
  }
}

let dialogHandlers: DialogHandlers = {};

export async function loadFileList(source: 'recent' | 'local'): Promise<void> {
  if (state.authRequired && !state.authToken) {
    return;
  }

  try {
    const result = await apiRequest<FileListResponse>(`/api/jobs/${source}`);

    if (result.success && result.files) {
      state.jobMetadata.clear();
      result.files.forEach((file) => {
        state.jobMetadata.set(file.fileName, file);
      });
      showFileModal(result.files, source);
    } else {
      showToast('Failed to load files', 'error');
    }
  } catch (error) {
    console.error('Failed to load files:', error);
    showToast('Failed to load files', 'error');
  }
}

export function showFileModal(files: WebUIJobFile[], source: 'recent' | 'local'): void {
  const modal = $('file-modal');
  const fileList = $('file-list');
  const title = $('modal-title');

  if (!modal || !fileList || !title) {
    return;
  }

  title.textContent = source === 'recent' ? 'Recent Files' : 'Local Files';

  fileList.innerHTML = '';
  state.selectedFile = null;

  const printBtn = $('print-file-btn') as HTMLButtonElement | null;
  if (printBtn) {
    printBtn.disabled = true;
  }

  files.forEach((file) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.filename = file.fileName;

    const header = document.createElement('div');
    header.className = 'file-item-header';

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.displayName || file.fileName;
    header.appendChild(name);

    if (isMultiColorJobFile(file)) {
      const badge = document.createElement('span');
      badge.className = 'file-badge multi-color';
      badge.textContent = 'Multi-color';
      badge.title = buildMaterialBadgeTooltip(file);
      header.appendChild(badge);
    }

    item.appendChild(header);

    const meta = document.createElement('div');
    meta.className = 'file-meta';

    const printingTimeLabel = formatJobPrintingTime(file.printingTime);
    if (printingTimeLabel) {
      const printingTime = document.createElement('span');
      printingTime.className = 'file-meta-item';
      printingTime.textContent = printingTimeLabel;
      meta.appendChild(printingTime);
    }

    if (file.totalFilamentWeight) {
      const material = document.createElement('span');
      material.className = 'file-meta-item';
      material.textContent = `${file.totalFilamentWeight.toFixed(1)} g`;
      meta.appendChild(material);
    }

    if (isAD5XJobFile(file) && file.toolDatas.length > 0) {
      const requirementSummary = document.createElement('div');
      requirementSummary.className = 'file-material-requirements';

      file.toolDatas.forEach((tool) => {
        const chip = document.createElement('div');
        chip.className = 'material-chip';

        const swatch = document.createElement('span');
        swatch.className = 'material-color';
        swatch.style.backgroundColor = tool.materialColor;

        const label = document.createElement('span');
        label.className = 'material-label';
        label.textContent = tool.materialName;

        chip.appendChild(swatch);
        chip.appendChild(label);
        requirementSummary.appendChild(chip);
      });

      meta.appendChild(requirementSummary);
    }

    if (meta.childElementCount > 0) {
      item.appendChild(meta);
    }

    item.addEventListener('click', () => {
      fileList.querySelectorAll('.file-item').forEach((el) => el.classList.remove('selected'));
      item.classList.add('selected');
      state.selectedFile = file.fileName;

      const button = $('print-file-btn') as HTMLButtonElement | null;
      if (button) {
        button.disabled = false;
      }
    });

    fileList.appendChild(item);
  });

  showElement('file-modal');
}

export function showTemperatureDialog(target: TemperatureTarget): void {
  const dialog = $('temp-dialog');
  const title = $('temp-dialog-title');
  const message = $('temp-dialog-message');
  const input = $('temp-input') as HTMLInputElement | null;

  if (!dialog || !title || !message || !input) {
    return;
  }

  const label = temperatureTargetLabel(target);
  const maxNote = target.kind === 'chamber' ? `, max ${CHAMBER_MAX_TEMP}` : '';
  title.textContent = `Set ${label} Temperature`;
  message.textContent = `Enter ${label} temperature (°C)${maxNote}:`;

  input.value = state.printerStatus ? Math.round(currentTargetTemperature(target)).toString() : '0';

  (dialog as TemperatureDialogElement).temperatureTarget = target;
  showElement('temp-dialog');
  input.focus();
  input.select();
}

export async function setTemperature(): Promise<void> {
  const dialog = $('temp-dialog') as TemperatureDialogElement | null;
  const input = $('temp-input') as HTMLInputElement | null;

  if (!dialog || !input) {
    return;
  }

  const target = dialog.temperatureTarget;
  const temperature = parseInt(input.value, 10);

  if (!target) {
    showToast('Unknown temperature target', 'error');
    return;
  }

  // Chamber is capped at CHAMBER_MAX_TEMP by the range check below (no separate clamp needed).
  const maxTemperature = target.kind === 'chamber' ? CHAMBER_MAX_TEMP : 300;
  if (isNaN(temperature) || temperature < 0 || temperature > maxTemperature) {
    showToast('Invalid temperature value', 'error');
    return;
  }

  if (!dialogHandlers.onTemperatureSubmit) {
    showToast('Temperature control unavailable', 'error');
    return;
  }

  try {
    await dialogHandlers.onTemperatureSubmit(target, temperature);
    hideElement('temp-dialog');
  } catch (error) {
    console.error('Failed to submit temperature command:', error);
    showToast('Failed to set temperature', 'error');
  }
}

export function setupDialogEventHandlers(handlers: DialogHandlers = {}): void {
  dialogHandlers = handlers;

  const closeModalBtn = $('close-modal');
  const printFileBtn = $('print-file-btn');

  closeModalBtn?.addEventListener('click', () => {
    closeFileModal();
  });

  printFileBtn?.addEventListener('click', () => {
    if (dialogHandlers.onStartPrintJob) {
      void dialogHandlers.onStartPrintJob();
    }
  });

  const materialModalClose = $('material-matching-close');
  materialModalClose?.addEventListener('click', () => {
    dialogHandlers.onMaterialMatchingClosed?.();
  });

  const materialModalCancel = $('material-matching-cancel');
  materialModalCancel?.addEventListener('click', () => {
    dialogHandlers.onMaterialMatchingClosed?.();
  });

  const materialModalConfirm = $('material-matching-confirm');
  materialModalConfirm?.addEventListener('click', () => {
    if (dialogHandlers.onMaterialMatchingConfirm) {
      void dialogHandlers.onMaterialMatchingConfirm();
    }
  });

  const closeTempBtn = $('close-temp-dialog');
  const tempCancelBtn = $('temp-cancel');
  const tempConfirmBtn = $('temp-confirm');
  const tempInput = $('temp-input') as HTMLInputElement | null;

  closeTempBtn?.addEventListener('click', () => hideElement('temp-dialog'));
  tempCancelBtn?.addEventListener('click', () => hideElement('temp-dialog'));
  tempConfirmBtn?.addEventListener('click', () => {
    void setTemperature();
  });

  tempInput?.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      void setTemperature();
    }
  });
}

function closeFileModal(): void {
  hideElement('file-modal');
  state.selectedFile = null;

  if (isMaterialMatchingVisible()) {
    dialogHandlers.onMaterialMatchingClosed?.();
  } else {
    state.pendingJobStart = null;
  }
}

function isMaterialMatchingVisible(): boolean {
  const modal = document.getElementById('material-matching-modal');
  return Boolean(modal && !modal.classList.contains('hidden'));
}
