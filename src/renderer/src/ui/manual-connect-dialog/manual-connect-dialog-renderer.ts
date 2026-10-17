/**
 * @fileoverview Renderer process for the manual printer-connection dialog.
 *
 * Collects everything a manual connect needs now that modern printers are typed
 * from their USB product ID instead of being TCP-probed: IP address, printer type,
 * and — for modern models — the serial number and check code the discovery
 * broadcast would otherwise have supplied. Legacy selections hide the serial and
 * check-code fields since those printers are still probed over TCP.
 *
 * Key features:
 * - Printer-type dropdown driven by the shared MANUAL_CONNECT_PRINTER_TYPES list
 * - Per-type field visibility and validation (serial + check code for modern)
 * - Inline validation errors, Enter to submit, Escape to cancel
 */

export {};

import type { ThemeColors } from '@shared/types/config.js';
import {
  isModernManualConnectType,
  MANUAL_CONNECT_PRINTER_TYPES,
  type ManualConnectPrinterType,
  type ManualConnectResult,
} from '@shared/types/manual-connect.js';
import { initializeLucideIconsFromGlobal } from '../shared/lucide.js';
import { applyDialogTheme } from '../shared/theme-utils.js';
import type {
  ManualConnectDialogAPI,
  ManualConnectDialogInitOptions,
} from './manual-connect-dialog-preload.cts';

const IPV4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

interface DialogElements {
  readonly title: HTMLElement | null;
  readonly message: HTMLElement | null;
  readonly ipInput: HTMLInputElement;
  readonly typeSelect: HTMLSelectElement;
  readonly serialField: HTMLElement;
  readonly serialInput: HTMLInputElement;
  readonly checkCodeField: HTMLElement;
  readonly checkCodeInput: HTMLInputElement;
  readonly hint: HTMLElement;
  readonly error: HTMLElement;
  readonly connectButton: HTMLButtonElement;
  readonly cancelButton: HTMLButtonElement;
  readonly closeButton: HTMLButtonElement;
}

const getManualConnectAPI = (): ManualConnectDialogAPI => {
  const api = window.api?.dialog?.manualConnect as ManualConnectDialogAPI | undefined;
  if (!api) {
    throw new Error('[ManualConnectDialog] dialog API bridge is not available');
  }
  return api;
};

document.addEventListener('DOMContentLoaded', (): void => {
  initializeLucideIconsFromGlobal(['x']);

  const elements = resolveElements();
  if (!elements) {
    console.error('Manual connect dialog: required DOM elements not found');
    return;
  }

  populatePrinterTypes(elements.typeSelect);
  applyTypeVisibility(elements);

  const api = getManualConnectAPI();

  api.receive('manual-connect:init', (data: unknown): void => {
    initializeDialog(elements, data as ManualConnectDialogInitOptions);
  });

  api.receive('theme-changed', (data: unknown): void => {
    applyDialogTheme(data as ThemeColors);
  });

  setupEventHandlers(elements, api);
});

function resolveElements(): DialogElements | null {
  const ipInput = document.getElementById('input-ip') as HTMLInputElement | null;
  const typeSelect = document.getElementById('input-type') as HTMLSelectElement | null;
  const serialField = document.getElementById('field-serial');
  const serialInput = document.getElementById('input-serial') as HTMLInputElement | null;
  const checkCodeField = document.getElementById('field-check-code');
  const checkCodeInput = document.getElementById('input-check-code') as HTMLInputElement | null;
  const hint = document.getElementById('field-hint');
  const error = document.getElementById('dialog-error');
  const connectButton = document.getElementById('dialog-connect') as HTMLButtonElement | null;
  const cancelButton = document.getElementById('dialog-cancel') as HTMLButtonElement | null;
  const closeButton = document.getElementById('dialog-close') as HTMLButtonElement | null;

  if (
    !ipInput ||
    !typeSelect ||
    !serialField ||
    !serialInput ||
    !checkCodeField ||
    !checkCodeInput ||
    !hint ||
    !error ||
    !connectButton ||
    !cancelButton ||
    !closeButton
  ) {
    return null;
  }

  return {
    title: document.getElementById('dialog-title'),
    message: document.getElementById('dialog-message'),
    ipInput,
    typeSelect,
    serialField,
    serialInput,
    checkCodeField,
    checkCodeInput,
    hint,
    error,
    connectButton,
    cancelButton,
    closeButton,
  };
}

function populatePrinterTypes(select: HTMLSelectElement): void {
  for (const { value, label } of MANUAL_CONNECT_PRINTER_TYPES) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }
}

function initializeDialog(elements: DialogElements, options: ManualConnectDialogInitOptions): void {
  if (elements.title && options.title) {
    elements.title.textContent = options.title;
  }
  if (elements.message && options.message) {
    elements.message.textContent = options.message;
  }
  if (options.defaultIpAddress) {
    elements.ipInput.value = options.defaultIpAddress;
  }

  elements.ipInput.focus();
  if (elements.ipInput.value) {
    elements.ipInput.select();
  }
}

/** Show serial + check code only for modern models; legacy printers are still probed. */
function applyTypeVisibility(elements: DialogElements): void {
  const isModern = isModernManualConnectType(selectedType(elements));

  elements.serialField.classList.toggle('hidden', !isModern);
  elements.checkCodeField.classList.toggle('hidden', !isModern);
  elements.hint.classList.toggle('hidden', !isModern);
}

function selectedType(elements: DialogElements): ManualConnectPrinterType {
  return elements.typeSelect.value as ManualConnectPrinterType;
}

function setupEventHandlers(elements: DialogElements, api: ManualConnectDialogAPI): void {
  elements.typeSelect.addEventListener('change', (): void => {
    applyTypeVisibility(elements);
    clearError(elements);
  });

  elements.connectButton.addEventListener('click', (): void => {
    submitDialog(elements, api);
  });

  for (const button of [elements.cancelButton, elements.closeButton]) {
    button.addEventListener('click', (): void => {
      cancelDialog(api);
    });
  }

  // Enter submits from any text field
  for (const input of [elements.ipInput, elements.serialInput, elements.checkCodeInput]) {
    input.addEventListener('keydown', (event: KeyboardEvent): void => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitDialog(elements, api);
      }
    });
    input.addEventListener('input', (): void => {
      input.classList.remove('invalid');
      clearError(elements);
    });
  }

  document.addEventListener('keydown', (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelDialog(api);
    }
  });
}

function submitDialog(elements: DialogElements, api: ManualConnectDialogAPI): void {
  const result = validate(elements);
  if (!result) {
    return;
  }

  api.submit(result).catch((error: unknown) => {
    console.error('Error submitting manual connect dialog:', error);
  });
}

/**
 * Validate the form, highlighting the first offending field. Returns null when
 * the form is not yet submittable.
 */
function validate(elements: DialogElements): ManualConnectResult | null {
  clearError(elements);

  const ipAddress = elements.ipInput.value.trim();
  if (!IPV4_PATTERN.test(ipAddress)) {
    return failValidation(elements, elements.ipInput, 'Enter a valid IPv4 address.');
  }

  const printerType = selectedType(elements);

  if (!isModernManualConnectType(printerType)) {
    return { ipAddress, printerType };
  }

  // Modern printers are typed from their product ID and never TCP-probed, so the
  // serial can no longer be recovered automatically — it has to be supplied here.
  const serialNumber = elements.serialInput.value.trim();
  if (!serialNumber) {
    return failValidation(
      elements,
      elements.serialInput,
      'Serial number is required for modern printers.'
    );
  }

  const checkCode = elements.checkCodeInput.value.trim();
  if (!checkCode) {
    return failValidation(
      elements,
      elements.checkCodeInput,
      'Check code is required for modern printers.'
    );
  }

  return { ipAddress, printerType, serialNumber, checkCode };
}

function failValidation(
  elements: DialogElements,
  field: HTMLInputElement,
  message: string
): null {
  elements.error.textContent = message;
  elements.error.hidden = false;
  field.classList.add('invalid');
  field.focus();
  return null;
}

function clearError(elements: DialogElements): void {
  elements.error.hidden = true;
  elements.error.textContent = '';
}

function cancelDialog(api: ManualConnectDialogAPI): void {
  api.cancel().catch((error: unknown) => {
    console.error('Error cancelling manual connect dialog:', error);
  });
}
