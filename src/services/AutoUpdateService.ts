/**
 * @fileoverview Auto update service orchestrating electron-updater across platforms.
 *
 * Provides centralized state management and IPC-friendly events for application updates:
 * - Configures electron-updater for GitHub-based release channels
 * - Manages stable/alpha channel switching with downgrade control
 * - Handles update lifecycle states (checking, available, downloading, downloaded, error)
 * - Tracks download progress and exposes current status snapshots
 * - Respects configuration preferences (auto download, dismissed versions, launch checks)
 * - Provides platform-aware installation helpers (auto-install on Windows, manual on macOS/Linux)
 *
 * Key exports:
 * - UpdateState enum describing lifecycle stages
 * - getAutoUpdateService(): singleton accessor for AutoUpdateService
 *
 * The service defers UI responsibilities to IPC handlers while ensuring consistent logging,
 * platform-specific behavior, and graceful degradation when running in development builds.
 */

import { EventEmitter } from 'events';
import { app, shell } from 'electron';
import log from 'electron-log';
import {
  autoUpdater,
  type UpdateInfo,
  type ProgressInfo,
  type UpdateDownloadedEvent
} from 'electron-updater';
import { getConfigManager } from '../managers/ConfigManager';
import type { ConfigManager } from '../managers/ConfigManager';

/**
 * Update lifecycle states exposed to renderers.
 */
export enum UpdateState {
  IDLE = 'idle',
  CHECKING = 'checking',
  AVAILABLE = 'available',
  NOT_AVAILABLE = 'not-available',
  DOWNLOADING = 'downloading',
  DOWNLOADED = 'downloaded',
  ERROR = 'error'
}

/**
 * Payload emitted on every state change for downstream listeners.
 */
export interface UpdateStatePayload {
  readonly state: UpdateState;
  readonly updateInfo: UpdateInfo | null;
  readonly downloadProgress: ProgressInfo | null;
  readonly error: Error | null;
}

type AllowedChannel = 'stable' | 'alpha';

/**
 * Auto update orchestration service.
 */
class AutoUpdateService extends EventEmitter {
  private static instance: AutoUpdateService | null = null;

  private readonly configManager: ConfigManager;
  private currentState: UpdateState = UpdateState.IDLE;
  private updateInfo: UpdateInfo | null = null;
  private downloadProgress: ProgressInfo | null = null;
  private lastError: Error | null = null;
  private downloadedFilePath: string | null = null;
  private isChecking: boolean = false;
  private isDownloading: boolean = false;
  private autoDownloadEnabled: boolean = false;
  private initialized: boolean = false;

  private constructor() {
    super();
    this.configManager = getConfigManager();
    this.configureLogger();
    this.setupAutoUpdater();
  }

  /**
   * Get singleton instance.
   */
  public static getInstance(): AutoUpdateService {
    if (!AutoUpdateService.instance) {
      AutoUpdateService.instance = new AutoUpdateService();
    }
    return AutoUpdateService.instance;
  }

  /**
   * Configure logger integration for auto updater.
   */
  private configureLogger(): void {
    log.transports.file.level = 'info';
    log.transports.console.level = 'warn';
    autoUpdater.logger = log;
  }

  /**
   * Initialize auto updater event listeners and defaults.
   */
  private setupAutoUpdater(): void {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      this.downloadProgress = null;
      this.setState(UpdateState.CHECKING);
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      log.info('[AutoUpdate] Update available:', info.version);
      this.updateInfo = info;
      this.downloadProgress = null;
      this.setState(UpdateState.AVAILABLE);

      if (this.shouldAutoDownload()) {
        if (this.supportsDownload()) {
          void this.downloadUpdate().catch((error) => {
            log.error('[AutoUpdate] Auto download failed:', error);
          });
        } else {
          log.info('[AutoUpdate] Auto download skipped - platform does not support downloads');
        }
      }
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      log.info('[AutoUpdate] No update available:', info.version);
      this.updateInfo = info;
      this.downloadProgress = null;
      this.setState(UpdateState.NOT_AVAILABLE);
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.downloadProgress = progress;
      this.setState(UpdateState.DOWNLOADING);
    });

    autoUpdater.on('update-downloaded', (event: UpdateDownloadedEvent) => {
      log.info('[AutoUpdate] Update downloaded:', event.version, 'file:', event.downloadedFile);
      this.downloadedFilePath = event.downloadedFile;
      this.updateInfo = event;
      this.downloadProgress = null;
      this.isDownloading = false;
      this.setState(UpdateState.DOWNLOADED);
    });

    autoUpdater.on('error', (error: Error) => {
      log.error('[AutoUpdate] Error:', error);
      this.handleError(error);
    });
  }

  /**
   * Initialize configuration bindings and optional launch check.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    const config = this.configManager.getConfig();
    this.autoDownloadEnabled = config.AutoDownloadUpdates;
    this.applyUpdateChannel(config.UpdateChannel);

    this.configManager.on('config:UpdateChannel', (newChannel: AllowedChannel) => {
      this.applyUpdateChannel(newChannel);
    });

    this.configManager.on('config:AutoDownloadUpdates', (autoDownload: boolean) => {
      this.autoDownloadEnabled = Boolean(autoDownload);
      log.info('[AutoUpdate] Auto download preference updated:', this.autoDownloadEnabled);
    });

    if (!app.isPackaged) {
      log.info('[AutoUpdate] Application is not packaged; update checks are disabled.');
      return;
    }

    if (config.CheckForUpdatesOnLaunch) {
      setTimeout(() => {
        void this.checkForUpdates();
      }, 3000);
    }
  }

  /**
   * Toggle update channel.
   */
  public setUpdateChannel(channel: AllowedChannel): void {
    this.applyUpdateChannel(channel);
  }

  /**
   * Retrieve current state.
   */
  public getState(): UpdateState {
    return this.currentState;
  }

  /**
   * Retrieve latest update information.
   */
  public getUpdateInfo(): UpdateInfo | null {
    return this.updateInfo;
  }

  /**
   * Retrieve last download progress snapshot.
   */
  public getDownloadProgress(): ProgressInfo | null {
    return this.downloadProgress;
  }

  /**
   * Retrieve last recorded error.
   */
  public getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * Check for updates unless already checking/downloading.
   */
  public async checkForUpdates(): Promise<void> {
    if (!app.isPackaged) {
      log.warn('[AutoUpdate] Ignoring update check in development mode.');
      return;
    }

    if (this.isChecking || this.isDownloading) {
      log.info('[AutoUpdate] Update check skipped (already in progress).');
      return;
    }

    this.isChecking = true;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.handleError(error as Error);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Start downloading an available update.
   */
  public async downloadUpdate(): Promise<void> {
    if (!this.supportsDownload()) {
      throw new Error('Update downloads are not supported on this platform');
    }

    if (this.currentState !== UpdateState.AVAILABLE || !this.updateInfo) {
      throw new Error('No update available to download');
    }

    if (this.isDownloading) {
      log.info('[AutoUpdate] Download already in progress.');
      return;
    }

    this.isDownloading = true;
    this.downloadedFilePath = null;
    this.setState(UpdateState.DOWNLOADING);

    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.isDownloading = false;
      this.handleError(error as Error);
    }
  }

  /**
   * Install downloaded update or reveal installer depending on platform.
   */
  public quitAndInstall(): void {
    if (this.currentState !== UpdateState.DOWNLOADED) {
      throw new Error('No downloaded update to install');
    }

    if (process.platform === 'win32') {
      autoUpdater.quitAndInstall(false, true);
      return;
    }

    this.openDownloadedFile();
  }

  /**
   * Reveal downloaded installer in file manager.
   */
  public openDownloadedFile(): void {
    const filePath = this.getDownloadedFilePath();
    if (!filePath) {
      throw new Error('No downloaded update file available');
    }

    shell.showItemInFolder(filePath);
  }

  /**
   * Open release page for manual installation.
   */
  public openReleasePage(): void {
    void shell.openExternal('https://github.com/Parallel-7/FlashForgeUI-Electron/releases');
  }

  /**
   * Current downloaded file path, if any.
   */
  public getDownloadedFilePath(): string | null {
    return this.downloadedFilePath;
  }

  /**
   * Determine whether downloads are supported on current platform.
   */
  public supportsDownload(): boolean {
    return process.platform === 'win32' || process.platform === 'darwin';
  }

  private shouldAutoDownload(): boolean {
    return this.autoDownloadEnabled && this.supportsDownload();
  }

  private applyUpdateChannel(channel: AllowedChannel): void {
    if (channel === 'alpha') {
      autoUpdater.allowPrerelease = true;
      autoUpdater.allowDowngrade = true;
      log.info('[AutoUpdate] Channel set to alpha (pre-releases enabled).');
    } else {
      autoUpdater.allowPrerelease = false;
      autoUpdater.allowDowngrade = false;
      log.info('[AutoUpdate] Channel set to stable (pre-releases disabled).');
    }
  }

  private handleError(error: Error): void {
    this.lastError = error;
    this.isChecking = false;
    this.isDownloading = false;
    this.downloadProgress = null;
    this.setState(UpdateState.ERROR);
  }

  private setState(state: UpdateState): void {
    this.currentState = state;
    this.emit('state-changed', {
      state,
      updateInfo: this.updateInfo,
      downloadProgress: this.downloadProgress,
      error: this.lastError
    });
  }
}

let instance: AutoUpdateService | null = null;

/**
 * Singleton accessor.
 */
export const getAutoUpdateService = (): AutoUpdateService => {
  if (!instance) {
    instance = AutoUpdateService.getInstance();
  }
  return instance;
};
