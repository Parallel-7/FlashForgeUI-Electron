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
 * - Platform compatibility handling (Rounded UI disabled when unsupported)
 * - Port number validation with range checking (1-65535)
 *
 * Settings Categories:
 * - Global Settings: WebUI, Discord, alerts, Spoolman, debug mode
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

import { AppConfig, ThemeColors, DEFAULT_THEME } from '../../types/config.js';
import type { MutableSettings } from './types.js';
import type { ISettingsAPI, IPrinterSettingsAPI, IAutoUpdateAPI } from './types/external.js';
import { DesktopThemeSection } from './sections/DesktopThemeSection.js';
import { TabSection } from './sections/TabSection.js';
import { InputDependencySection } from './sections/InputDependencySection.js';
import { AutoUpdateSection } from './sections/AutoUpdateSection.js';
import { SpoolmanTestSection } from './sections/SpoolmanTestSection.js';
import { DiscordWebhookSection } from './sections/DiscordWebhookSection.js';
import { PrinterContextSection } from './sections/PrinterContextSection.js';
import { RoundedUISection } from './sections/RoundedUISection.js';

declare global {
  interface Window {
    settingsAPI?: ISettingsAPI;
    printerSettingsAPI?: IPrinterSettingsAPI;
    autoUpdateAPI?: IAutoUpdateAPI;
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
  'web-ui-password-required': 'WebUIPasswordRequired',
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
  'discord-update-interval': 'DiscordUpdateIntervalMinutes',
  'rounded-ui': 'RoundedUI',
  'rtsp-frame-rate': 'RtspFrameRate',
  'rtsp-quality': 'RtspQuality',
  'check-updates-on-launch': 'CheckForUpdatesOnLaunch',
  'update-channel': 'UpdateChannel',
  'auto-download-updates': 'AutoDownloadUpdates',
  'spoolman-enabled': 'SpoolmanEnabled',
  'spoolman-server-url': 'SpoolmanServerUrl',
  'spoolman-update-mode': 'SpoolmanUpdateMode'
};

class SettingsRenderer {
  private readonly inputs: Map<string, HTMLInputElement> = new Map();
  private saveStatusElement: HTMLElement | null = null;
  private updateStatusElement: HTMLElement | null = null;
  private updateCheckButton: HTMLButtonElement | null = null;
  private testSpoolmanButton: HTMLButtonElement | null = null;
  private spoolmanTestResultElement: HTMLElement | null = null;
  private testDiscordButton: HTMLButtonElement | null = null;
  private discordTestResultElement: HTMLElement | null = null;
  private statusTimeout: NodeJS.Timeout | null = null;
  private readonly settings: MutableSettings = { global: {}, perPrinter: {} };
  private printerName: string | null = null;
  private hasUnsavedChanges: boolean = false;
  private autoDownloadSupported: boolean = true;
  private perPrinterControlsEnabled: boolean = true;
  private desktopThemeSection: DesktopThemeSection | null = null;
  private tabSection: TabSection | null = null;
  private dependencySection: InputDependencySection | null = null;
  private autoUpdateSection: AutoUpdateSection | null = null;
  private spoolmanTestSection: SpoolmanTestSection | null = null;
  private discordWebhookSection: DiscordWebhookSection | null = null;
  private printerContextSection: PrinterContextSection | null = null;
  private roundedUISection: RoundedUISection | null = null;
  private webUIEnabledToggle: HTMLInputElement | null = null;

  private static readonly TAB_STORAGE_KEY = 'settingsDialogActiveTab';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    document.addEventListener('DOMContentLoaded', () => {
      window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['x', 'alert-triangle']);
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
    this.updateStatusElement = document.getElementById('update-check-result');
    this.updateCheckButton = document.getElementById('btn-check-updates') as HTMLButtonElement | null;

    this.testSpoolmanButton = document.getElementById('btn-test-spoolman') as HTMLButtonElement | null;
    this.spoolmanTestResultElement = document.getElementById('spoolman-test-result');

    this.testDiscordButton = document.getElementById('btn-test-discord') as HTMLButtonElement | null;
    this.discordTestResultElement = document.getElementById('discord-test-result');

    this.webUIEnabledToggle = document.getElementById('webui-enabled-toggle') as HTMLInputElement | null;

    this.desktopThemeSection = new DesktopThemeSection({
      document,
      defaultTheme: DEFAULT_THEME,
      onThemeChange: (theme) => this.handleDesktopThemeUpdated(theme)
    });
    this.desktopThemeSection.initialize();

    this.tabSection = new TabSection({
      document,
      storageKey: SettingsRenderer.TAB_STORAGE_KEY
    });
    this.tabSection.initialize();

    this.dependencySection = new InputDependencySection({
      inputs: this.inputs,
      webUIEnabledToggle: this.webUIEnabledToggle
    });

    this.printerContextSection = new PrinterContextSection({
      document,
      onPerPrinterToggle: (enabled) => {
        this.perPrinterControlsEnabled = enabled;
        this.updateInputStates();
      }
    });
    this.printerContextSection.initialize();

    this.spoolmanTestSection = new SpoolmanTestSection({
      settingsAPI: window.settingsAPI,
      testButton: this.testSpoolmanButton,
      resultElement: this.spoolmanTestResultElement,
      serverUrlInput: this.inputs.get('spoolman-server-url')
    });
    this.spoolmanTestSection.initialize();

    this.discordWebhookSection = new DiscordWebhookSection({
      settingsAPI: window.settingsAPI,
      testButton: this.testDiscordButton,
      resultElement: this.discordTestResultElement,
      webhookInput: this.inputs.get('webhook-url')
    });
    this.discordWebhookSection.initialize();

    this.autoUpdateSection = new AutoUpdateSection({
      autoUpdateAPI: window.autoUpdateAPI,
      updateCheckButton: this.updateCheckButton,
      updateStatusElement: this.updateStatusElement,
      autoDownloadInput: this.inputs.get('auto-download-updates'),
      settings: this.settings
    });

    this.roundedUISection = new RoundedUISection({
      settingsAPI: window.settingsAPI,
      roundedUIInput: this.inputs.get('rounded-ui'),
      document,
      settings: this.settings
    });
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

    if (this.webUIEnabledToggle) {
      this.webUIEnabledToggle.addEventListener('change', () => this.handleWebUIEnabledToggle());
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
        this.printerContextSection?.update(this.printerName);

        if (this.autoUpdateSection) {
          await this.autoUpdateSection.initialize();
          this.autoDownloadSupported = this.autoUpdateSection.isAutoDownloadSupported();
        } else {
          this.autoDownloadSupported = true;
        }

        if (this.roundedUISection) {
          await this.roundedUISection.initialize();
        }

        this.updateInputStates();
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
            // No value set - read HTML default value from input element
            console.log(`[Settings] No value for ${configKey}, reading HTML default from input`);

            if (input.type === 'checkbox') {
              value = input.checked; // HTML checked attribute
            } else if (input.type === 'number') {
              // Read HTML value attribute and parse as number
              const htmlValue = input.getAttribute('value');
              value = htmlValue ? parseInt(htmlValue, 10) : 0;
            } else {
              // Read HTML value attribute for text/password inputs
              value = input.getAttribute('value') || '';
            }

            // Store this default in our settings object so it gets saved
            this.settings.perPrinter[perPrinterKey] = value;
            console.log(`[Settings] Using HTML default for ${perPrinterKey}:`, value);
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

    // Load desktop theme values
    this.desktopThemeSection?.applyTheme(this.settings.global['DesktopTheme'] as ThemeColors | undefined);
    this.applyWebUIEnabledSetting();

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
      if (configKey === 'UpdateChannel' && typeof value === 'string') {
        if (value !== 'stable' && value !== 'alpha') {
          value = 'stable';
          input.value = 'stable';
        }
      }
      if (configKey === 'SpoolmanUpdateMode' && typeof value === 'string') {
        if (value !== 'length' && value !== 'weight') {
          value = 'weight';
          input.value = 'weight';
        }
      }
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
    this.dependencySection?.updateStates(this.perPrinterControlsEnabled, this.autoDownloadSupported);
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

          const channelValue = this.settings.global['UpdateChannel'];
          if (typeof channelValue === 'string' && window.autoUpdateAPI) {
            const normalizedChannel = channelValue === 'alpha' ? 'alpha' : 'stable';
            void window.autoUpdateAPI.setUpdateChannel(normalizedChannel);
          }
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

  private applyWebUIEnabledSetting(): void {
    if (!this.webUIEnabledToggle) {
      return;
    }

    const storedValue = this.settings.perPrinter.webUIEnabled;
    const isEnabled = storedValue !== false;
    this.webUIEnabledToggle.checked = isEnabled;
  }

  private handleWebUIEnabledToggle(): void {
    if (!this.webUIEnabledToggle) {
      return;
    }

    this.settings.perPrinter.webUIEnabled = this.webUIEnabledToggle.checked;
    console.log('[Settings] Updated per-printer webUIEnabled:', this.webUIEnabledToggle.checked);
    this.hasUnsavedChanges = true;
    this.updateSaveButtonState();
  }

  private handleDesktopThemeUpdated(theme: ThemeColors): void {
    this.settings.global['DesktopTheme'] = theme;
    this.hasUnsavedChanges = true;
    this.updateSaveButtonState();
    console.log('[Settings] Desktop theme updated:', theme);
  }

  private cleanup(): void {
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
    }
    this.desktopThemeSection?.dispose();
    this.tabSection?.dispose();
    this.spoolmanTestSection?.dispose();
    this.discordWebhookSection?.dispose();
    this.autoUpdateSection?.dispose();
    this.printerContextSection?.dispose();
    // Note: No longer need to remove IPC listeners since we're using promises
  }
}

// Initialize the settings renderer
new SettingsRenderer();

