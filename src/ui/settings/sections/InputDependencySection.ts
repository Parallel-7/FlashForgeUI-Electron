/**
 * @fileoverview Handles enable/disable logic for dependent settings inputs.
 *
 * Centralizes state transitions for the WebUI, Spoolman, Discord, and per-printer
 * fields so the main settings renderer can simply call `updateStates` when
 * relevant toggles change.
 */

// src/ui/settings/sections/InputDependencySection.ts

interface InputDependencySectionOptions {
  readonly inputs: Map<string, HTMLInputElement>;
  readonly webUIEnabledToggle: HTMLInputElement | null;
}

export class InputDependencySection {
  private readonly inputs: Map<string, HTMLInputElement>;
  private readonly webUIEnabledToggle: HTMLInputElement | null;

  constructor(options: InputDependencySectionOptions) {
    this.inputs = options.inputs;
    this.webUIEnabledToggle = options.webUIEnabledToggle;
  }

  updateStates(perPrinterControlsEnabled: boolean, autoDownloadSupported: boolean): void {
    const webUIEnabled = this.inputs.get('web-ui')?.checked || false;
    const passwordRequired = this.inputs.get('web-ui-password-required')?.checked ?? true;
    this.setInputEnabled('web-ui-port', webUIEnabled);
    this.setInputEnabled('web-ui-password-required', webUIEnabled);
    this.setInputEnabled('web-ui-password', webUIEnabled && passwordRequired);

    const spoolmanEnabled = this.inputs.get('spoolman-enabled')?.checked || false;
    this.setInputEnabled('spoolman-server-url', spoolmanEnabled);
    this.setInputEnabled('spoolman-update-mode', spoolmanEnabled);

    if (perPrinterControlsEnabled) {
      const customCameraEnabled = this.inputs.get('custom-camera')?.checked || false;
      this.setInputEnabled('custom-camera', true);
      this.setInputEnabled('custom-camera-url', customCameraEnabled);
      this.setInputEnabled('custom-leds', true);
      this.setInputEnabled('force-legacy-api', true);
      this.setInputEnabled('rtsp-frame-rate', true);
      this.setInputEnabled('rtsp-quality', true);
    } else {
      this.setInputEnabled('custom-camera', false);
      this.setInputEnabled('custom-camera-url', false);
      this.setInputEnabled('custom-leds', false);
      this.setInputEnabled('force-legacy-api', false);
      this.setInputEnabled('rtsp-frame-rate', false);
      this.setInputEnabled('rtsp-quality', false);
    }

    if (this.webUIEnabledToggle) {
      this.webUIEnabledToggle.disabled = !perPrinterControlsEnabled;
    }

    const discordEnabled = this.inputs.get('discord-sync')?.checked || false;
    this.setInputEnabled('webhook-url', discordEnabled);
    this.setInputEnabled('discord-update-interval', discordEnabled);

    if (!autoDownloadSupported) {
      this.setInputEnabled('auto-download-updates', false);
    }
  }

  private setInputEnabled(inputId: string, enabled: boolean): void {
    const input = this.inputs.get(inputId);
    if (input) {
      input.disabled = !enabled;
      input.style.opacity = enabled ? '1' : '0.5';
    }
  }
}
