/**
 * @fileoverview Settings section for centralized per-printer SSH credentials.
 *
 * Manages the SSH tab of the settings dialog: loads the active printer's
 * resolved SSH settings (easy-SSH defaults applied), tracks edits to
 * username/password/port/key-path, saves them through the ssh-settings IPC
 * surface, and offers a one-click reset back to the flashforge-easyssh
 * defaults. These credentials feed every SSH consumer (file manager,
 * calibration assistant, WebUI calibration routes).
 */

import type { SSHSettingsResponse, SSHSettingsUpdate } from '@shared/types/ssh-settings.js';

/** Preload bridge for the SSH settings IPC surface. */
export interface ISSHSettingsAPI {
  readonly get: () => Promise<SSHSettingsResponse>;
  readonly save: (update: SSHSettingsUpdate) => Promise<boolean>;
  readonly reset: () => Promise<boolean>;
  readonly browseKeyFile: () => Promise<{ filePath?: string } | null>;
}

interface SSHSectionDependencies {
  readonly document: Document;
  readonly sshSettingsAPI?: ISSHSettingsAPI;
  /** Notify the settings renderer that there are unsaved SSH changes. */
  readonly onDirty: () => void;
}

/**
 * Settings dialog section handling the SSH tab.
 */
export class SSHSection {
  private readonly deps: SSHSectionDependencies;

  private emptyState: HTMLElement | null = null;
  private content: HTMLElement | null = null;
  private usernameInput: HTMLInputElement | null = null;
  private passwordInput: HTMLInputElement | null = null;
  private portInput: HTMLInputElement | null = null;
  private keyPathInput: HTMLInputElement | null = null;
  private browseButton: HTMLButtonElement | null = null;
  private resetButton: HTMLButtonElement | null = null;
  private statusElement: HTMLElement | null = null;
  private statusTimeout: ReturnType<typeof setTimeout> | null = null;

  private dirty = false;
  private hasPrinter = false;

  constructor(deps: SSHSectionDependencies) {
    this.deps = deps;
  }

  initialize(): void {
    const doc = this.deps.document;
    this.emptyState = doc.getElementById('ssh-settings-empty-state');
    this.content = doc.getElementById('ssh-settings-content');
    this.usernameInput = doc.getElementById('ssh-settings-username') as HTMLInputElement | null;
    this.passwordInput = doc.getElementById('ssh-settings-password') as HTMLInputElement | null;
    this.portInput = doc.getElementById('ssh-settings-port') as HTMLInputElement | null;
    this.keyPathInput = doc.getElementById('ssh-settings-key-path') as HTMLInputElement | null;
    this.browseButton = doc.getElementById('btn-ssh-settings-key-browse') as HTMLButtonElement | null;
    this.resetButton = doc.getElementById('btn-ssh-settings-reset') as HTMLButtonElement | null;
    this.statusElement = doc.getElementById('ssh-settings-status');

    const markDirty = (): void => this.markDirty();
    for (const input of [this.usernameInput, this.passwordInput, this.portInput, this.keyPathInput]) {
      input?.addEventListener('input', markDirty);
      input?.addEventListener('change', markDirty);
    }

    this.browseButton?.addEventListener('click', () => void this.handleBrowseKey());
    this.resetButton?.addEventListener('click', () => void this.handleReset());
  }

  /** Load current settings for the active printer into the form. */
  async load(): Promise<void> {
    const api = this.deps.sshSettingsAPI;
    if (!api) {
      this.setPrinterAvailable(false);
      return;
    }

    try {
      const response = await api.get();
      if (!response.settings) {
        this.setPrinterAvailable(false);
        return;
      }

      this.setPrinterAvailable(true);
      if (this.usernameInput) this.usernameInput.value = response.settings.username;
      if (this.passwordInput) this.passwordInput.value = response.settings.password;
      if (this.portInput) this.portInput.value = String(response.settings.port);
      if (this.keyPathInput) this.keyPathInput.value = response.settings.keyPath || '';
      this.dirty = false;
    } catch (error) {
      console.error('[Settings] Failed to load SSH settings:', error);
      this.setPrinterAvailable(false);
    }
  }

  /** Whether there are unsaved SSH changes. */
  isDirty(): boolean {
    return this.dirty;
  }

  /** Persist the current form values. Returns false on validation/save failure. */
  async save(): Promise<boolean> {
    const api = this.deps.sshSettingsAPI;
    if (!api || !this.hasPrinter || !this.dirty) {
      return true;
    }

    const port = Number.parseInt(this.portInput?.value || '', 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      this.showStatus('Invalid SSH port (1-65535)', true);
      return false;
    }

    const update: SSHSettingsUpdate = {
      username: this.usernameInput?.value ?? '',
      password: this.passwordInput?.value ?? '',
      port,
      keyPath: this.keyPathInput?.value ?? '',
    };

    const success = await api.save(update);
    if (success) {
      this.dirty = false;
    } else {
      this.showStatus('Failed to save SSH settings', true);
    }
    return success;
  }

  dispose(): void {
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
    }
  }

  private markDirty(): void {
    if (!this.hasPrinter) {
      return;
    }
    this.dirty = true;
    this.deps.onDirty();
  }

  private setPrinterAvailable(available: boolean): void {
    this.hasPrinter = available;
    if (this.emptyState) this.emptyState.hidden = available;
    if (this.content) this.content.hidden = !available;
  }

  private async handleBrowseKey(): Promise<void> {
    const api = this.deps.sshSettingsAPI;
    if (!api) {
      return;
    }

    try {
      const result = await api.browseKeyFile();
      if (result?.filePath && this.keyPathInput) {
        this.keyPathInput.value = result.filePath;
        this.markDirty();
      }
    } catch (error) {
      console.error('[Settings] Failed to browse for SSH key:', error);
    }
  }

  private async handleReset(): Promise<void> {
    const api = this.deps.sshSettingsAPI;
    if (!api || !this.hasPrinter) {
      return;
    }

    try {
      const success = await api.reset();
      if (success) {
        await this.load();
        this.showStatus('SSH settings reset to defaults');
      } else {
        this.showStatus('Failed to reset SSH settings', true);
      }
    } catch (error) {
      console.error('[Settings] Failed to reset SSH settings:', error);
      this.showStatus('Failed to reset SSH settings', true);
    }
  }

  private showStatus(message: string, isError: boolean = false): void {
    if (!this.statusElement) {
      return;
    }
    this.statusElement.textContent = message;
    this.statusElement.style.color = isError ? 'var(--error-color, #e53e3e)' : 'var(--success-color, #4CAF50)';

    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
    }
    this.statusTimeout = setTimeout(() => {
      if (this.statusElement) {
        this.statusElement.textContent = '';
      }
    }, 3000);
  }
}
