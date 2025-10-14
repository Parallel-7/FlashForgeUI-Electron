/**
 * @fileoverview Settings Dialog renderer process managing both global application settings
 * and per-printer configuration through a unified UI. Implements intelligent settings routing
 * (global vs. per-printer), real-time validation, dependency-aware input state management,
 * and unsaved changes protection.
 *
 * Key Features:
 * - Dual settings management: global config (config.json) and per-printer settings (printer_details.json)
 * - Automatic settings categorization and routing based on setting type
 * - Real-time input validation with visual feedback
 * - Dependent input state management (e.g., port fields enabled only when feature is enabled)
 * - Unsaved changes detection with confirmation prompts
 * - Per-printer context indicator showing which printer's settings are being edited
 * - macOS compatibility handling (rounded UI disabled on macOS)
 * - Port number validation with range checking (1-65535)
 *
 * Settings Categories:
 * - Global Settings: WebUI, Discord, alerts, filament tracker, debug mode
 * - Per-Printer Settings: Custom camera, custom LEDs, force legacy mode
 *
 * UI State Management:
 * - Dynamic enable/disable of dependent fields
 * - Save button state based on unsaved changes
 * - Status message display with auto-hide timers
 * - Input-to-config property mapping for consistency
 *
 * Dependencies:
 * Integrates with ConfigManager for global settings and PrinterDetailsManager for per-printer
 * settings through the exposed IPC APIs.
 */

// src/ui/settings/settings-renderer.ts

import { AppConfig } from '../../types/config';

interface ISettingsAPI {
  requestConfig: () => Promise<AppConfig>;
  saveConfig: (config: Partial<AppConfig>) => Promise<boolean>;
  closeWindow: () => void;
  receiveConfig: (callback: (config: AppConfig) => void) => void;
  removeListeners: () => void;
}

interface IPrinterSettingsAPI {
  get: () => Promise<unknown>;
  update: (settings: unknown) => Promise<boolean>;
  getPrinterName: () => Promise<string | null>;
}

declare global {
  interface Window {
    settingsAPI?: ISettingsAPI;
    printerSettingsAPI?: IPrinterSettingsAPI;
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
  'filament-tracker-enabled': 'FilamentTrackerIntegrationEnabled',
  'filament-tracker-api-key': 'FilamentTrackerAPIKey',
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
  'discord-update-interval': 'DiscordUpdateIntervalMinutes',
  'rounded-ui': 'RoundedUI',
  'rtsp-frame-rate': 'RtspFrameRate',
  'rtsp-quality': 'RtspQuality'
};

/**
 * Mutable settings tracker for internal use during editing session
 */
interface MutableSettings {
  // Global settings (stored in config.json)
  global: Record<string, unknown>;
  // Per-printer settings (stored in printer_details.json)
  perPrinter: Record<string, unknown>;
}

class SettingsRenderer {
  private readonly inputs: Map<string, HTMLInputElement> = new Map();
  private saveStatusElement: HTMLElement | null = null;
  private statusTimeout: NodeJS.Timeout | null = null;
  private readonly settings: MutableSettings = { global: {}, perPrinter: {} };
  private printerName: string | null = null;
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
        console.log('[Settings] Loaded config from config.json:', config);

        // Load global settings
        this.settings.global = { ...config };

        // Also load per-printer settings if available
        if (window.printerSettingsAPI) {
          const printerSettings = await window.printerSettingsAPI.get() as Record<string, unknown> | null;
          this.printerName = await window.printerSettingsAPI.getPrinterName();
          console.log('[Settings] Loaded per-printer settings:', printerSettings);
          console.log('[Settings] Printer name:', this.printerName);

          if (printerSettings) {
            this.settings.perPrinter = { ...printerSettings };
          }
        } else {
          console.log('[Settings] No printerSettings API available');
        }

        this.loadConfiguration();
        this.updatePrinterContextIndicator();
      } catch (error) {
        console.error('Failed to request config:', error);
      }
    } else {
      console.warn('Settings API not available');
    }
  }

  private loadConfiguration(): void {
    // Populate form with current configuration
    this.inputs.forEach((input, inputId) => {
      const configKey = INPUT_TO_CONFIG_MAP[inputId];

      if (configKey) {
        let value: unknown;

        // For per-printer settings, ONLY use printer settings (never config.json)
        if (this.isPerPrinterSetting(configKey)) {
          const perPrinterKey = this.configKeyToPerPrinterKey(configKey);

          if (this.settings.perPrinter[perPrinterKey] !== undefined) {
            // Use per-printer value
            value = this.settings.perPrinter[perPrinterKey];
            console.log(`[Settings] Loading per-printer setting ${configKey} (${perPrinterKey}):`, value);
          } else {
            // No value set - skip this setting (let input use its HTML default value)
            console.log(`[Settings] No value for ${configKey}, using input default`);
            return;
          }
        } else {
          // For global settings, use config.json
          value = this.settings.global[configKey];
        }

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
    this.handleMacOSCompatibility();
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
      // Validate RTSP frame rate
      if (configKey === 'RtspFrameRate') {
        if (value < 1 || value > 60) {
          this.showSaveStatus('Frame rate must be between 1-60 FPS', true);
          return;
        }
      }
      // Validate RTSP quality
      if (configKey === 'RtspQuality') {
        if (value < 1 || value > 5) {
          this.showSaveStatus('Quality must be between 1-5', true);
          return;
        }
      }
    } else {
      value = input.value;
    }

    // Update appropriate settings store
    if (this.isPerPrinterSetting(configKey)) {
      const perPrinterKey = this.configKeyToPerPrinterKey(configKey);
      this.settings.perPrinter[perPrinterKey] = value;
      console.log(`[Settings] Updated per-printer setting ${perPrinterKey}:`, value);
    } else {
      this.settings.global[configKey] = value;
      console.log(`[Settings] Updated global setting ${configKey}:`, value);
    }

    this.hasUnsavedChanges = true;
    this.updateSaveButtonState();
    this.updateInputStates();
  }

  private updateInputStates(): void {
    // Web UI settings
    const webUIEnabled = this.inputs.get('web-ui')?.checked || false;
    this.setInputEnabled('web-ui-port', webUIEnabled);
    this.setInputEnabled('web-ui-password', webUIEnabled);

    // Filament Tracker Integration settings
    const filamentTrackerEnabled = this.inputs.get('filament-tracker-enabled')?.checked || false;
    this.setInputEnabled('filament-tracker-api-key', filamentTrackerEnabled);

    // Custom Camera settings
    const customCameraEnabled = this.inputs.get('custom-camera')?.checked || false;
    this.setInputEnabled('custom-camera-url', customCameraEnabled);

    // Discord settings
    const discordEnabled = this.inputs.get('discord-sync')?.checked || false;
    this.setInputEnabled('webhook-url', discordEnabled);
    this.setInputEnabled('discord-update-interval', discordEnabled);
  }

  private handleMacOSCompatibility(): void {
    // Check if running on macOS
    const isMacOS = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    
    if (isMacOS) {
      // Disable the rounded UI checkbox on macOS
      const roundedUIInput = this.inputs.get('rounded-ui');
      if (roundedUIInput) {
        roundedUIInput.disabled = true;
        roundedUIInput.checked = false;
        roundedUIInput.style.opacity = '0.5';
      }
      
      // Show the macOS warning message
      const macosWarning = document.querySelector('.macos-warning');
      if (macosWarning) {
        (macosWarning as HTMLElement).style.display = 'block';
      }
    }
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
        // Save global config
        console.log('[Settings] Saving global config:', this.settings.global);
        const success = await window.settingsAPI.saveConfig(this.settings.global as Partial<AppConfig>);

        // Save per-printer settings if we have any and a printer is connected
        if (Object.keys(this.settings.perPrinter).length > 0 && window.printerSettingsAPI && this.printerName) {
          console.log('[Settings] Saving per-printer settings:', this.settings.perPrinter);
          const perPrinterSuccess = await window.printerSettingsAPI.update(this.settings.perPrinter);
          console.log('[Settings] Per-printer save result:', perPrinterSuccess);

          if (!perPrinterSuccess) {
            this.showSaveStatus('Failed to save per-printer settings', true);
            return;
          }
        }

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

  /**
   * Check if a config key is a per-printer setting
   */
  private isPerPrinterSetting(configKey: keyof AppConfig): boolean {
    return [
      'CustomCamera',
      'CustomCameraUrl',
      'CustomLeds',
      'ForceLegacyAPI',
      'RtspFrameRate',
      'RtspQuality'
    ].includes(configKey);
  }

  /**
   * Convert AppConfig key to per-printer settings key
   */
  private configKeyToPerPrinterKey(configKey: keyof AppConfig): string {
    const map: Record<string, string> = {
      'CustomCamera': 'customCameraEnabled',
      'CustomCameraUrl': 'customCameraUrl',
      'CustomLeds': 'customLedsEnabled',
      'ForceLegacyAPI': 'forceLegacyMode',
      'RtspFrameRate': 'rtspFrameRate',
      'RtspQuality': 'rtspQuality'
    };
    return map[configKey] || configKey;
  }

  /**
   * Update printer context indicator in the UI
   */
  private updatePrinterContextIndicator(): void {
    // Find or create the context indicator element
    let indicator = document.getElementById('printer-context-indicator');

    if (!indicator) {
      // Create indicator if it doesn't exist
      const settingsHeader = document.querySelector('.settings-header');
      if (settingsHeader) {
        indicator = document.createElement('div');
        indicator.id = 'printer-context-indicator';
        indicator.style.cssText = 'margin-top: 10px; padding: 8px; background: #f0f0f0; border-radius: 4px; font-size: 12px; color: #666;';
        settingsHeader.appendChild(indicator);
      }
    }

    if (indicator) {
      if (this.printerName) {
        indicator.textContent = `Per-printer settings for: ${this.printerName}`;
        indicator.style.display = 'block';
      } else {
        indicator.textContent = 'Global settings (no printer connected)';
        indicator.style.display = 'block';
      }
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
