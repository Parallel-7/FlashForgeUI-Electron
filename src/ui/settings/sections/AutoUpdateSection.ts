/**
 * @fileoverview Manages auto-update support detection and manual update checks.
 *
 * Abstracts away IPC calls, button state, and status messages so the main
 * settings renderer only needs to consume a boolean indicating whether auto
 * download is supported.
 */

// src/ui/settings/sections/AutoUpdateSection.ts

import type { MutableSettings } from '../types.js';
import type { IAutoUpdateAPI } from '../types/external.js';
import type { SettingsSection } from './SettingsSection.js';

interface AutoUpdateSectionOptions {
  readonly autoUpdateAPI?: IAutoUpdateAPI;
  readonly updateCheckButton: HTMLButtonElement | null;
  readonly updateStatusElement: HTMLElement | null;
  readonly autoDownloadInput: HTMLInputElement | undefined;
  readonly settings: MutableSettings;
}

export class AutoUpdateSection implements SettingsSection {
  private readonly autoUpdateAPI?: IAutoUpdateAPI;
  private readonly updateCheckButton: HTMLButtonElement | null;
  private readonly updateStatusElement: HTMLElement | null;
  private readonly autoDownloadInput: HTMLInputElement | undefined;
  private readonly settings: MutableSettings;
  private autoDownloadSupported = true;
  private buttonHandler: (() => void) | null = null;

  constructor(options: AutoUpdateSectionOptions) {
    this.autoUpdateAPI = options.autoUpdateAPI;
    this.updateCheckButton = options.updateCheckButton;
    this.updateStatusElement = options.updateStatusElement;
    this.autoDownloadInput = options.autoDownloadInput;
    this.settings = options.settings;
  }

  async initialize(): Promise<void> {
    this.buttonHandler = () => {
      void this.handleManualCheck();
    };
    if (this.updateCheckButton && this.buttonHandler) {
      this.updateCheckButton.addEventListener('click', this.buttonHandler);
    }

    await this.determineAutoDownloadSupport();
  }

  dispose(): void {
    if (this.updateCheckButton && this.buttonHandler) {
      this.updateCheckButton.removeEventListener('click', this.buttonHandler);
    }
  }

  isAutoDownloadSupported(): boolean {
    return this.autoDownloadSupported;
  }

  private async determineAutoDownloadSupport(): Promise<void> {
    if (!this.autoUpdateAPI) {
      this.autoDownloadSupported = true;
      return;
    }

    try {
      const status = await this.autoUpdateAPI.getStatus();
      this.autoDownloadSupported = Boolean(status.supportsDownload);

      if (!this.autoDownloadSupported) {
        if (this.autoDownloadInput) {
          this.autoDownloadInput.checked = false;
        }
        this.settings.global['AutoDownloadUpdates'] = false;
      }
    } catch (error) {
      console.warn('[Settings][AutoUpdateSection] Unable to determine auto-update capabilities:', error);
      this.autoDownloadSupported = true;
    }
  }

  private async handleManualCheck(): Promise<void> {
    if (!this.autoUpdateAPI) {
      this.showUpdateStatus('Auto-update service is not available.', 'error');
      return;
    }

    if (this.updateCheckButton) {
      this.updateCheckButton.disabled = true;
    }

    this.showUpdateStatus('Checking for updates...', 'info');

    try {
      const result = await this.autoUpdateAPI.checkForUpdates();
      if (!result.success) {
        this.showUpdateStatus(result.error ?? 'Failed to start update check.', 'error');
        return;
      }

      const status = await this.autoUpdateAPI.getStatus();
      const availableVersion = status.updateInfo?.version;

      if (status.state === 'available' && availableVersion) {
        this.showUpdateStatus(`Update ${availableVersion} is available.`, 'success');
      } else if (status.state === 'downloaded' && availableVersion) {
        this.showUpdateStatus(`Update ${availableVersion} is ready to install.`, 'success');
      } else if (status.state === 'error') {
        this.showUpdateStatus(status.error?.message ?? 'Update check failed.', 'error');
      } else {
        this.showUpdateStatus('No updates available.', 'success');
      }
    } catch (error) {
      console.error('[Settings][AutoUpdateSection] Auto-update check failed:', error);
      this.showUpdateStatus('Failed to check for updates.', 'error');
    } finally {
      if (this.updateCheckButton) {
        this.updateCheckButton.disabled = false;
      }
    }
  }

  private showUpdateStatus(message: string, level: 'info' | 'success' | 'error'): void {
    if (!this.updateStatusElement) {
      return;
    }

    this.updateStatusElement.textContent = message;
    if (level === 'error') {
      this.updateStatusElement.style.color = 'var(--error-color, #e53e3e)';
    } else if (level === 'success') {
      this.updateStatusElement.style.color = 'var(--success-color, #4CAF50)';
    } else {
      this.updateStatusElement.style.color = 'var(--text-color-muted, #aaa)';
    }
  }
}
