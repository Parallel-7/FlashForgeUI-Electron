/**
 * @fileoverview Handles Rounded UI capability detection + warnings.
 */

// src/ui/settings/sections/RoundedUISection.ts

import type { RoundedUISupportInfo, ISettingsAPI } from '@shared/types/external.js';
import type { MutableSettings } from '../types.js';

interface RoundedUISectionOptions {
  readonly settingsAPI?: ISettingsAPI;
  readonly roundedUIInput: HTMLInputElement | undefined;
  readonly document: Document;
  readonly settings: MutableSettings;
}

export class RoundedUISection {
  private readonly settingsAPI?: ISettingsAPI;
  private readonly roundedUIInput?: HTMLInputElement;
  private readonly doc: Document;
  private readonly settings: MutableSettings;
  private supportInfo: RoundedUISupportInfo = { supported: true, reason: null };

  constructor(options: RoundedUISectionOptions) {
    this.settingsAPI = options.settingsAPI;
    this.roundedUIInput = options.roundedUIInput;
    this.doc = options.document;
    this.settings = options.settings;
  }

  async initialize(): Promise<void> {
    if (!this.settingsAPI?.getRoundedUISupportInfo) {
      return;
    }

    try {
      this.supportInfo = await this.settingsAPI.getRoundedUISupportInfo();
      this.applyRoundedUIRestrictions();
    } catch (error) {
      console.warn('[Settings][RoundedUISection] Unable to determine Rounded UI support:', error);
    }
  }

  dispose(): void {
    // no-op
  }

  private applyRoundedUIRestrictions(): void {
    if (!this.roundedUIInput) {
      return;
    }

    const warningElement = this.doc.querySelector('.rounded-ui-warning') as HTMLElement | null;

    if (this.supportInfo.supported) {
      this.roundedUIInput.disabled = false;
      this.roundedUIInput.style.opacity = '';
      if (warningElement) {
        warningElement.style.display = 'none';
      }
      return;
    }

    this.roundedUIInput.disabled = true;
    this.roundedUIInput.checked = false;
    this.roundedUIInput.style.opacity = '0.5';
    this.settings.global['RoundedUI'] = false;

    if (warningElement) {
      const textElement = warningElement.querySelector('.rounded-ui-warning-text');
      const message = this.getRoundedUIWarningMessage();
      if (textElement) {
        textElement.textContent = message;
      } else {
        warningElement.textContent = message;
      }
      warningElement.style.display = 'inline-flex';
    }
  }

  private getRoundedUIWarningMessage(): string {
    switch (this.supportInfo.reason) {
      case 'macos':
        return 'Disabled on macOS due to system compatibility issues.';
      case 'windows11':
        return 'Disabled on Windows 11 because native rounded chrome conflicts with this mode.';
      default:
        return 'Rounded UI is not available on this platform.';
    }
  }
}
