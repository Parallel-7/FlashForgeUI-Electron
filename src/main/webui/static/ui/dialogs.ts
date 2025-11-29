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

interface TemperatureDialogElement extends HTMLElement {
  temperatureType?: 'bed' | 'extruder';
}

export interface DialogHandlers {
  onStartPrintJob?: () => Promise<void> | void;
  onMaterialMatchingClosed?: () => void;
  onMaterialMatchingConfirm?: () => Promise<void> | void;
  onTemperatureSubmit?: (
    type: 'bed' | 'extruder',
    temperature: number,
  ) => Promise<void> | void;
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

export function showTemperatureDialog(type: 'bed' | 'extruder'): void {
  const dialog = $('temp-dialog');
  const title = $('temp-dialog-title');
  const message = $('temp-dialog-message');
  const input = $('temp-input') as HTMLInputElement | null;

  if (!dialog || !title || !message || !input) {
    return;
  }

  title.textContent = type === 'bed' ? 'Set Bed Temperature' : 'Set Extruder Temperature';
  message.textContent = `Enter ${type} temperature (°C):`;

  if (state.printerStatus) {
    const currentTarget =
      type === 'bed'
        ? state.printerStatus.bedTargetTemperature
        : state.printerStatus.nozzleTargetTemperature;
    input.value = Math.round(currentTarget).toString();
  } else {
    input.value = '0';
  }

  (dialog as TemperatureDialogElement).temperatureType = type;
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

  const type = dialog.temperatureType;
  const temperature = parseInt(input.value, 10);

  if (!type) {
    showToast('Unknown temperature target', 'error');
    return;
  }

  if (isNaN(temperature) || temperature < 0 || temperature > 300) {
    showToast('Invalid temperature value', 'error');
    return;
  }

  if (!dialogHandlers.onTemperatureSubmit) {
    showToast('Temperature control unavailable', 'error');
    return;
  }

  try {
    await dialogHandlers.onTemperatureSubmit(type, temperature);
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
