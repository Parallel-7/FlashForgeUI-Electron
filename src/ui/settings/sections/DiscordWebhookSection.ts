/**
 * @fileoverview Handles the Discord webhook test controls.
 */

// src/ui/settings/sections/DiscordWebhookSection.ts

import type { SettingsSection } from './SettingsSection';
import type { ISettingsAPI } from '../types/external';

interface DiscordWebhookSectionOptions {
  readonly settingsAPI?: ISettingsAPI;
  readonly testButton: HTMLButtonElement | null;
  readonly resultElement: HTMLElement | null;
  readonly webhookInput: HTMLInputElement | undefined;
}

export class DiscordWebhookSection implements SettingsSection {
  private readonly settingsAPI?: ISettingsAPI;
  private readonly testButton: HTMLButtonElement | null;
  private readonly resultElement: HTMLElement | null;
  private readonly webhookInput?: HTMLInputElement;
  private buttonHandler: (() => void) | null = null;

  constructor(options: DiscordWebhookSectionOptions) {
    this.settingsAPI = options.settingsAPI;
    this.testButton = options.testButton;
    this.resultElement = options.resultElement;
    this.webhookInput = options.webhookInput;
  }

  initialize(): void {
    this.buttonHandler = () => {
      void this.handleTestDiscordWebhook();
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

  private async handleTestDiscordWebhook(): Promise<void> {
    if (!this.settingsAPI) {
      this.showResult('Settings API not available.', 'error');
      return;
    }

    if (!this.webhookInput) {
      this.showResult('Webhook URL input not found.', 'error');
      return;
    }

    const webhookUrl = this.webhookInput.value.trim();
    if (!webhookUrl) {
      this.showResult('Please enter a Discord webhook URL.', 'error');
      return;
    }

    if (this.testButton) {
      this.testButton.disabled = true;
    }

    this.showResult('Testing webhook...', 'info');

    try {
      const result = await this.settingsAPI.testDiscordWebhook(webhookUrl);
      if (result.success) {
        this.showResult('✓ Webhook test successful!', 'success');
      } else {
        this.showResult(`✗ Webhook test failed: ${result.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('[Settings][DiscordWebhookSection] Webhook test failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.showResult(`✗ Webhook test failed: ${errorMsg}`, 'error');
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
