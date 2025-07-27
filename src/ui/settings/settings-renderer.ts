// src/ui/settings/settings-renderer.ts

import { AppConfig } from '../../types/config';

interface ISettingsAPI {
  requestConfig: () => Promise<AppConfig>;
  saveConfig: (config: Partial<AppConfig>) => Promise<boolean>;
  closeWindow: () => void;
  receiveConfig: (callback: (config: AppConfig) => void) => void;
  removeListeners: () => void;
}

declare global {
  interface Window {
    settingsAPI?: ISettingsAPI;
  }
}

// Ensure this file is treated as a module
export {};

/**
 * Mapping from HTML input IDs to AppConfig property names
 * This ensures exact compatibility with legacy config format
 */
const INPUT_TO_CONFIG_MAP: Record<string, keyof AppConfig> = {
  'web-ui': 'WebUIEnabled',
  'web-ui-port': 'WebUIPort',
  'web-ui-password': 'WebUIPassword',
  'camera-proxy-port': 'CameraProxyPort',
  'discord-sync': 'DiscordSync',
  'always-on-top': 'AlwaysOnTop',
  'alert-when-complete': 'AlertWhenComplete',
  'alert-when-cooled': 'AlertWhenCooled',
  'audio-alerts': 'AudioAlerts',
  'visual-alerts': 'VisualAlerts',
  'debug-mode': 'DebugMode',
  'webhook-url': 'WebhookUrl',
  'custom-camera': 'CustomCamera',
  'custom-camera-url': 'CustomCameraUrl',
  'custom-leds': 'CustomLeds',
  'force-legacy-api': 'ForceLegacyAPI',
  'discord-update-interval': 'DiscordUpdateIntervalMinutes'
};

class SettingsRenderer {
  private readonly inputs: Map<string, HTMLInputElement> = new Map();
  private saveStatusElement: HTMLElement | null = null;
  private statusTimeout: NodeJS.Timeout | null = null;
  private currentConfig: Partial<AppConfig> = {};
  private hasUnsavedChanges: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    document.addEventListener('DOMContentLoaded', () => {
      this.initializeElements();
      this.setupEventListeners();
      void this.requestInitialConfig();
    });

    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  private initializeElements(): void {
    // Get all input elements
    for (const inputId of Object.keys(INPUT_TO_CONFIG_MAP)) {
      const element = document.getElementById(inputId) as HTMLInputElement;
      if (element) {
        this.inputs.set(inputId, element);
      } else {
        console.warn(`Input element not found: ${inputId}`);
      }
    }

    this.saveStatusElement = document.getElementById('save-status');
  }

  private setupEventListeners(): void {
    // Add change listeners to all inputs
    this.inputs.forEach((input, inputId) => {
      input.addEventListener('change', () => this.handleInputChange(inputId));
      if (input.type === 'text' || input.type === 'number' || input.type === 'password') {
        input.addEventListener('input', () => this.handleInputChange(inputId));
      }
    });

    // Button event listeners
    const headerCloseBtn = document.getElementById('btn-close'); // Header × button
    const footerCloseBtn = document.getElementById('btn-close-footer'); // Footer Close button
    const saveBtn = document.getElementById('btn-save');

    if (headerCloseBtn) {
      headerCloseBtn.addEventListener('click', () => this.handleClose());
    }

    if (footerCloseBtn) {
      footerCloseBtn.addEventListener('click', () => this.handleClose());
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSave());
    }
  }

  private async requestInitialConfig(): Promise<void> {
    if (window.settingsAPI) {
      try {
        const config = await window.settingsAPI.requestConfig();
        this.loadConfiguration(config);
      } catch (error) {
        console.error('Failed to request config:', error);
      }
    } else {
      console.warn('Settings API not available');
    }
  }

  private loadConfiguration(config: AppConfig): void {
    this.currentConfig = { ...config };

    // Populate form with current configuration
    this.inputs.forEach((input, inputId) => {
      const configKey = INPUT_TO_CONFIG_MAP[inputId];
      
      if (configKey && configKey in config) {
        const value = config[configKey];

        if (input.type === 'checkbox') {
          input.checked = Boolean(value);
        } else if (input.type === 'number') {
          input.value = String(value);
        } else {
          input.value = String(value || '');
        }
      }
    });

    // Update input states after loading
    this.updateInputStates();
    this.hasUnsavedChanges = false;
    this.updateSaveButtonState();
  }

  private handleInputChange(inputId: string): void {
    const input = this.inputs.get(inputId);
    const configKey = INPUT_TO_CONFIG_MAP[inputId];

    if (!input || !configKey) {
      return;
    }

    let value: string | number | boolean;

    if (input.type === 'checkbox') {
      value = input.checked;
    } else if (input.type === 'number') {
      value = parseInt(input.value) || 0;
      // Validate port numbers
      if (configKey === 'WebUIPort' || configKey === 'CameraProxyPort') {
        if (value < 1 || value > 65535) {
          this.showSaveStatus('Invalid port number (1-65535)', true);
          return;
        }
      }
    } else {
      value = input.value;
    }

    // Update current config
    this.currentConfig = {
      ...this.currentConfig,
      [configKey]: value as AppConfig[typeof configKey]
    };

    this.hasUnsavedChanges = true;
    this.updateSaveButtonState();
    this.updateInputStates();
  }

  private updateInputStates(): void {
    // Web UI settings
    const webUIEnabled = this.inputs.get('web-ui')?.checked || false;
    this.setInputEnabled('web-ui-port', webUIEnabled);
    this.setInputEnabled('web-ui-password', webUIEnabled);

    // Custom Camera settings
    const customCameraEnabled = this.inputs.get('custom-camera')?.checked || false;
    this.setInputEnabled('custom-camera-url', customCameraEnabled);

    // Discord settings
    const discordEnabled = this.inputs.get('discord-sync')?.checked || false;
    this.setInputEnabled('webhook-url', discordEnabled);
    this.setInputEnabled('discord-update-interval', discordEnabled);
  }

  private setInputEnabled(inputId: string, enabled: boolean): void {
    const input = this.inputs.get(inputId);
    if (input) {
      input.disabled = !enabled;
      input.style.opacity = enabled ? '1' : '0.5';
    }
  }

  private updateSaveButtonState(): void {
    const saveBtn = document.getElementById('btn-save') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.disabled = !this.hasUnsavedChanges;
      saveBtn.style.opacity = this.hasUnsavedChanges ? '1' : '0.6';
    }
  }

  private async handleSave(): Promise<void> {
    if (!this.hasUnsavedChanges) {
      return;
    }

    if (window.settingsAPI) {
      try {
        const success = await window.settingsAPI.saveConfig(this.currentConfig);
        if (success) {
          this.hasUnsavedChanges = false;
          this.updateSaveButtonState();
          this.showSaveStatus('Settings saved successfully');
        } else {
          this.showSaveStatus('Failed to save settings', true);
        }
      } catch (error) {
        console.error('Settings save error:', error);
        this.showSaveStatus('Error saving settings', true);
      }
    } else {
      this.showSaveStatus('Unable to save: API not available', true);
    }
  }

  private handleClose(): void {
    if (this.hasUnsavedChanges) {
      const shouldClose = confirm('You have unsaved changes. Are you sure you want to close without saving?');
      if (!shouldClose) {
        return;
      }
    }

    if (window.settingsAPI) {
      window.settingsAPI.closeWindow();
    }
  }

  private showSaveStatus(message: string, isError: boolean = false): void {
    if (this.saveStatusElement) {
      this.saveStatusElement.textContent = message;
      this.saveStatusElement.style.color = isError ? '#e53e3e' : '#4CAF50';
      this.saveStatusElement.classList.add('visible');

      if (this.statusTimeout) {
        clearTimeout(this.statusTimeout);
      }

      this.statusTimeout = setTimeout(() => {
        this.saveStatusElement?.classList.remove('visible');
      }, isError ? 3000 : 2000);
    }
  }

  private cleanup(): void {
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
    }
    // Note: No longer need to remove IPC listeners since we're using promises
  }
}

// Initialize the settings renderer
new SettingsRenderer();
