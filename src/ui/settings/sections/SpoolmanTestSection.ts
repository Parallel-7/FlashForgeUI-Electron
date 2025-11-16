/**
 * @fileoverview Handles the Spoolman connection test controls.
 */

// src/ui/settings/sections/SpoolmanTestSection.ts

import type { SettingsSection } from './SettingsSection';
import type { ISettingsAPI } from '../types/external';

interface SpoolmanTestSectionOptions {
  readonly settingsAPI?: ISettingsAPI;
  readonly testButton: HTMLButtonElement | null;
  readonly resultElement: HTMLElement | null;
  readonly serverUrlInput: HTMLInputElement | undefined;
}

export class SpoolmanTestSection implements SettingsSection {
  private readonly settingsAPI?: ISettingsAPI;
  private readonly testButton: HTMLButtonElement | null;
  private readonly resultElement: HTMLElement | null;
  private readonly serverUrlInput?: HTMLInputElement;
  private buttonHandler: (() => void) | null = null;

  constructor(options: SpoolmanTestSectionOptions) {
    this.settingsAPI = options.settingsAPI;
    this.testButton = options.testButton;
    this.resultElement = options.resultElement;
    this.serverUrlInput = options.serverUrlInput;
  }

  initialize(): void {
    this.buttonHandler = () => {
      void this.handleTestSpoolmanConnection();
    };
    if (this.testButton && this.buttonHandler) {
      this.testButton.addEventListener('click', this.buttonHandler);
    }
  }

  dispose(): void {
    if (this.testButton && this.buttonHandler) {
      this.testButton.removeEventListener('click', this.buttonHandler);
    }
  }

  private async handleTestSpoolmanConnection(): Promise<void> {
    if (!this.settingsAPI) {
      this.showResult('Settings API not available.', 'error');
      return;
    }

    if (!this.serverUrlInput) {
      this.showResult('Server URL input not found.', 'error');
      return;
    }

    const serverUrl = this.serverUrlInput.value.trim();
    if (!serverUrl) {
      this.showResult('Please enter a Spoolman server URL.', 'error');
      return;
    }

    if (this.testButton) {
      this.testButton.disabled = true;
    }

    this.showResult('Testing connection...', 'info');

    try {
      const result = await this.settingsAPI.testSpoolmanConnection(serverUrl);
      if (result.connected) {
        this.showResult('✓ Connection successful!', 'success');
      } else {
        this.showResult(`✗ Connection failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('[Settings][SpoolmanTestSection] Connection test failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.showResult(`✗ Connection failed: ${errorMsg}`, 'error');
    } finally {
      if (this.testButton) {
        this.testButton.disabled = false;
      }
    }
  }

  private showResult(message: string, type: 'success' | 'error' | 'info'): void {
    if (!this.resultElement) {
      return;
    }

    this.resultElement.textContent = message;
    this.resultElement.style.color =
      type === 'success' ? '#4ade80' :
      type === 'error' ? '#f87171' :
      '#60a5fa';
  }
}
