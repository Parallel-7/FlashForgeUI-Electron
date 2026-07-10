/**
 * @fileoverview Per-printer SSH settings section for the WebUI settings modal.
 *
 * Mirrors the desktop Settings -> SSH tab against the /api/ssh-settings REST
 * surface. Settings apply to the ACTIVE printer context and are stored by
 * serial number, so they follow the printer across IP changes.
 *
 * Passwords are write-only over the WebUI: the server never returns the
 * stored value. The password field stays blank on load; a placeholder hints
 * whether a custom password is set. Typing a new value overwrites it,
 * clearing the field (submitting an empty string) resets it to the easy-SSH
 * default, and leaving it untouched keeps the current one.
 *
 * Key exports:
 * - setupSSHSettings(): wire the save/reset buttons
 * - refreshSSHSettings(): (re)load the section for the active printer
 */

import { showToast } from '../shared/dom.js';
import { apiRequest } from '../core/Transport.js';

interface WebUISSHSettings {
  readonly username: string;
  readonly port: number;
  readonly keyPath?: string;
  readonly isCustom: boolean;
  readonly passwordIsCustom: boolean;
}

interface SSHSettingsGetResponse {
  readonly success: boolean;
  readonly settings?: WebUISSHSettings;
  readonly printerName?: string;
  readonly error?: string;
}

interface SSHSettingsSaveResponse {
  readonly success: boolean;
  readonly error?: string;
}

const DEFAULT_HINT = 'Using the easy-SSH default password (flashforge). Leave blank to keep it.';
const CUSTOM_HINT = 'A custom password is saved (not shown). Leave blank to keep it, or type a new one to replace it. Clear and save resets to the default.';

/** Tracks whether the password field was intentionally edited this session. */
let passwordDirty = false;

function input(id: string): HTMLInputElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`[SSHSettings] Missing input #${id}`);
  }
  return element;
}

function setUnavailable(unavailable: boolean, reason?: string): void {
  const form = document.getElementById('ssh-settings-form');
  const message = document.getElementById('ssh-settings-unavailable');
  const buttons = [document.getElementById('ssh-save-btn'), document.getElementById('ssh-reset-btn')];

  form?.classList.toggle('hidden', unavailable);
  if (message) {
    message.classList.toggle('hidden', !unavailable);
    message.textContent = reason || 'No printer is connected.';
  }
  buttons.forEach((button) => {
    if (button instanceof HTMLButtonElement) {
      button.disabled = unavailable;
    }
  });
}

/**
 * (Re)load the SSH section for the active printer. Call when the settings
 * modal opens and after context switches.
 */
export async function refreshSSHSettings(): Promise<void> {
  passwordDirty = false;

  let response: SSHSettingsGetResponse;
  try {
    response = await apiRequest<SSHSettingsGetResponse>('/api/ssh-settings');
  } catch {
    setUnavailable(true, 'Failed to load SSH settings.');
    return;
  }

  if (!response.success || !response.settings) {
    setUnavailable(true, response.error || 'No printer is connected.');
    return;
  }

  setUnavailable(false);

  const settings = response.settings;
  input('ssh-username').value = settings.username;
  input('ssh-port').value = String(settings.port);
  input('ssh-keypath').value = settings.keyPath ?? '';

  const password = input('ssh-password');
  password.value = '';
  password.placeholder = settings.passwordIsCustom ? '••••••••  (custom saved)' : 'flashforge (default)';

  const hint = document.getElementById('ssh-password-hint');
  if (hint) {
    hint.textContent = settings.passwordIsCustom ? CUSTOM_HINT : DEFAULT_HINT;
  }

  const heading = document.querySelector('#ssh-settings-section h3');
  if (heading) {
    heading.textContent = response.printerName ? `SSH — ${response.printerName}` : 'SSH (Current Printer)';
  }
}

async function saveSSHSettings(): Promise<void> {
  const port = Number(input('ssh-port').value);
  const payload: Record<string, unknown> = {
    username: input('ssh-username').value,
    keyPath: input('ssh-keypath').value,
  };
  if (Number.isInteger(port) && port > 0) {
    payload.port = port;
  } else if (input('ssh-port').value.trim() === '') {
    payload.port = 0; // 0 = reset to default on the server
  } else {
    showToast('Port must be a number between 1 and 65535', 'error');
    return;
  }

  // Write-only password: only send it when the user actually touched the field.
  if (passwordDirty) {
    payload.password = input('ssh-password').value;
  }

  try {
    const result = await apiRequest<SSHSettingsSaveResponse>('/api/ssh-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!result.success) {
      showToast(result.error || 'Failed to save SSH settings', 'error');
      return;
    }
    showToast('SSH settings saved', 'success');
    await refreshSSHSettings();
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Failed to save SSH settings', 'error');
  }
}

async function resetSSHSettings(): Promise<void> {
  try {
    const result = await apiRequest<SSHSettingsSaveResponse>('/api/ssh-settings/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!result.success) {
      showToast(result.error || 'Failed to reset SSH settings', 'error');
      return;
    }
    showToast('SSH settings reset to defaults', 'success');
    await refreshSSHSettings();
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Failed to reset SSH settings', 'error');
  }
}

/** Wire the SSH section buttons. Call once at startup. */
export function setupSSHSettings(): void {
  input('ssh-password').addEventListener('input', () => {
    passwordDirty = true;
  });
  document.getElementById('ssh-save-btn')?.addEventListener('click', () => void saveSSHSettings());
  document.getElementById('ssh-reset-btn')?.addEventListener('click', () => void resetSSHSettings());
}
