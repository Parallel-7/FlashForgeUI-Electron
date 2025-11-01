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

interface UpdateInfoSummary {
  readonly version?: string;
  readonly releaseNotes?: unknown;
}

interface UpdateDownloadProgress {
  readonly percent?: number;
  readonly total?: number;
  readonly transferred?: number;
}

interface UpdateStatusResponse {
  readonly state: string;
  readonly updateInfo: UpdateInfoSummary | null;
  readonly downloadProgress: UpdateDownloadProgress | null;
  readonly error: { readonly message: string } | null;
  readonly currentVersion: string;
  readonly supportsDownload: boolean;
}

interface IAutoUpdateAPI {
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
  getStatus: () => Promise<UpdateStatusResponse>;
  setUpdateChannel: (channel: 'stable' | 'alpha') => Promise<{ success: boolean }>;
}

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
  'rtsp-quality': 'RtspQuality',
  'check-updates-on-launch': 'CheckForUpdatesOnLaunch',
  'update-channel': 'UpdateChannel',
  'auto-download-updates': 'AutoDownloadUpdates'
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
  private updateStatusElement: HTMLElement | null = null;
  private updateCheckButton: HTMLButtonElement | null = null;
  private statusTimeout: NodeJS.Timeout | null = null;
  private readonly settings: MutableSettings = { global: {}, perPrinter: {} };
  private printerName: string | null = null;
  private hasUnsavedChanges: boolean = false;
  private autoDownloadSupported: boolean = true;
  private tabButtons: HTMLButtonElement[] = [];
  private readonly tabPanels: Map<string, HTMLElement> = new Map();
  private activeTabId: string = 'camera';
  private perPrinterControlsEnabled: boolean = true;

  private static readonly TAB_STORAGE_KEY = 'settingsDialogActiveTab';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    document.addEventListener('DOMContentLoaded', () => {
      window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['x']);
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
    const checkButton = document.getElementById('btn-check-updates') as HTMLButtonElement | null;
    if (checkButton) {
      this.updateCheckButton = checkButton;
    }

    this.initializeTabs();
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

    if (this.updateCheckButton) {
      this.updateCheckButton.addEventListener('click', () => {
        void this.handleCheckForUpdates();
      });
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
        await this.initializeAutoUpdateSupport();
        this.updatePrinterSettingsAvailability();
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

    // Update input states after loading
    this.updateInputStates();
    this.handleMacOSCompatibility();
    this.hasUnsavedChanges = false;
    this.updateSaveButtonState();
  }

  private initializeTabs(): void {
    this.tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.settings-tab-button'));
    const panelElements = document.querySelectorAll<HTMLElement>('.tab-panel');

    panelElements.forEach((panel) => {
      const dataTab = panel.id.replace('tab-panel-', '');
      this.tabPanels.set(dataTab, panel);
    });

    this.tabButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        const tabId = button.dataset.tab;
        if (tabId) {
          this.setActiveTab(tabId, true, true);
        }
      });

      button.addEventListener('keydown', (event) => {
        this.handleTabKeydown(event, index);
      });
    });

    const persistedTab = this.loadPersistedTabId();
    if (persistedTab && this.tabPanels.has(persistedTab)) {
      this.setActiveTab(persistedTab, false, false);
    } else if (this.tabButtons.length > 0) {
      const fallbackTab = this.tabButtons[0].dataset.tab ?? 'camera';
      this.setActiveTab(fallbackTab, true, false);
    }
  }

  private setActiveTab(tabId: string, persist: boolean, focusTab: boolean): void {
    if (!this.tabPanels.has(tabId)) {
      return;
    }

    this.tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tabId;
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
      if (isActive && focusTab) {
        button.focus();
      }
    });

    this.tabPanels.forEach((panel, id) => {
      if (id === tabId) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', 'true');
      }
    });

    this.activeTabId = tabId;
    if (persist) {
      this.persistTabId(tabId);
    }
  }

  private handleTabKeydown(event: KeyboardEvent, currentIndex: number): void {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();

    if (event.key === 'Home') {
      const firstTab = this.tabButtons[0];
      if (firstTab?.dataset.tab) {
        this.setActiveTab(firstTab.dataset.tab, true, true);
      }
      return;
    }

    if (event.key === 'End') {
      const lastTab = this.tabButtons[this.tabButtons.length - 1];
      if (lastTab?.dataset.tab) {
        this.setActiveTab(lastTab.dataset.tab, true, true);
      }
      return;
    }

    const increment = event.key === 'ArrowRight' ? 1 : -1;
    const newIndex = (currentIndex + increment + this.tabButtons.length) % this.tabButtons.length;
    const nextTab = this.tabButtons[newIndex];
    if (nextTab?.dataset.tab) {
      this.setActiveTab(nextTab.dataset.tab, true, true);
    }
  }

  private persistTabId(tabId: string): void {
    try {
      window.localStorage.setItem(SettingsRenderer.TAB_STORAGE_KEY, tabId);
    } catch (error) {
      console.warn('[Settings] Unable to persist tab selection:', error);
    }
  }

  private loadPersistedTabId(): string | null {
    try {
      return window.localStorage.getItem(SettingsRenderer.TAB_STORAGE_KEY);
    } catch {
      return null;
    }
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
    const passwordRequired = this.inputs.get('web-ui-password-required')?.checked ?? true;
    this.setInputEnabled('web-ui-port', webUIEnabled);
    this.setInputEnabled('web-ui-password-required', webUIEnabled);
    this.setInputEnabled('web-ui-password', webUIEnabled && passwordRequired);

    // Filament Tracker Integration settings
    const filamentTrackerEnabled = this.inputs.get('filament-tracker-enabled')?.checked || false;
    this.setInputEnabled('filament-tracker-api-key', filamentTrackerEnabled);

    // Custom Camera settings
    if (this.perPrinterControlsEnabled) {
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

    // Discord settings
    const discordEnabled = this.inputs.get('discord-sync')?.checked || false;
    this.setInputEnabled('webhook-url', discordEnabled);
    this.setInputEnabled('discord-update-interval', discordEnabled);

    if (!this.autoDownloadSupported) {
      this.setInputEnabled('auto-download-updates', false);
    }
  }

  private async initializeAutoUpdateSupport(): Promise<void> {
    if (!window.autoUpdateAPI) {
      this.autoDownloadSupported = true;
      return;
    }

    try {
      const status = await window.autoUpdateAPI.getStatus();
      this.autoDownloadSupported = Boolean(status.supportsDownload);

      if (!this.autoDownloadSupported) {
        const autoDownloadInput = this.inputs.get('auto-download-updates');
        if (autoDownloadInput) {
          autoDownloadInput.checked = false;
        }
        this.settings.global['AutoDownloadUpdates'] = false;
      }
    } catch (error) {
      console.warn('[Settings] Unable to determine auto-update capabilities:', error);
      this.autoDownloadSupported = true;
    }
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

  private async handleCheckForUpdates(): Promise<void> {
    if (!window.autoUpdateAPI) {
      this.showUpdateStatus('Auto-update service is not available.', 'error');
      return;
    }

    if (this.updateCheckButton) {
      this.updateCheckButton.disabled = true;
    }

    this.showUpdateStatus('Checking for updates...', 'info');

    try {
      const result = await window.autoUpdateAPI.checkForUpdates();

      if (!result.success) {
        this.showUpdateStatus(result.error ?? 'Failed to start update check.', 'error');
        return;
      }

      const status = await window.autoUpdateAPI.getStatus();
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
      console.error('[Settings] Auto-update check failed:', error);
      this.showUpdateStatus('Failed to check for updates.', 'error');
    } finally {
      if (this.updateCheckButton) {
        this.updateCheckButton.disabled = false;
      }
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

  private showUpdateStatus(message: string, level: 'info' | 'success' | 'error'): void {
    if (!this.updateStatusElement) {
      return;
    }

    this.updateStatusElement.textContent = message;
    if (level === 'error') {
      this.updateStatusElement.style.color = '#e53e3e';
    } else if (level === 'success') {
      this.updateStatusElement.style.color = '#4CAF50';
    } else {
      this.updateStatusElement.style.color = '#aaa';
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

  private updatePrinterSettingsAvailability(): void {
    const content = document.getElementById('printer-settings-content');
    const emptyState = document.getElementById('printer-settings-empty-state');
    const cameraContent = document.getElementById('camera-printer-settings');
    const cameraEmptyState = document.getElementById('camera-printer-empty-state');

    const hasPrinter = Boolean(this.printerName);
    this.perPrinterControlsEnabled = hasPrinter;

    if (content) {
      content.style.display = hasPrinter ? 'flex' : 'none';
    }

    if (emptyState) {
      emptyState.hidden = hasPrinter;
    }

    if (cameraContent) {
      cameraContent.style.display = hasPrinter ? 'flex' : 'none';
    }

    if (cameraEmptyState) {
      cameraEmptyState.hidden = hasPrinter;
    }

    this.updateInputStates();
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

