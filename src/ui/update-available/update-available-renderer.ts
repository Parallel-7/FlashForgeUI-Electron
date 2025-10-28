/**
 * @fileoverview Renderer logic for the auto-update dialog handling platform-specific UI states.
 *
 * Handles update lifecycle visualization, platform-aware actions, and IPC communication:
 * - Renders version comparison and release notes
 * - Drives download / install workflows for Windows and macOS
 * - Opens GitHub releases for Linux users
 * - Tracks download progress and error states in real time
 * - Persists dismissed versions via main process IPC
 */

type UpdateState = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

interface ReleaseNotesObject {
  readonly version?: string;
  readonly note?: string;
  readonly notes?: string;
}

interface UpdateInfoPayload {
  readonly version?: string;
  readonly releaseNotes?: string | ReleaseNotesObject[] | null;
}

interface DownloadProgressPayload {
  readonly percent?: number;
  readonly total?: number;
  readonly transferred?: number;
  readonly bytesPerSecond?: number;
}

interface UpdateStatePayload {
  readonly state: UpdateState;
  readonly updateInfo: UpdateInfoPayload | null;
  readonly downloadProgress: DownloadProgressPayload | null;
  readonly error: { readonly message: string } | null;
}

interface UpdateStatusResponse extends UpdateStatePayload {
  readonly currentVersion: string;
  readonly supportsDownload: boolean;
}

interface AutoUpdateActionResult {
  success: boolean;
  error?: string;
}

interface UpdateDialogAPI {
  getStatus: () => Promise<UpdateStatusResponse>;
  checkForUpdates: () => Promise<AutoUpdateActionResult>;
  downloadUpdate: () => Promise<AutoUpdateActionResult>;
  installUpdate: () => Promise<AutoUpdateActionResult>;
  openInstaller: () => Promise<AutoUpdateActionResult>;
  openReleasePage: () => Promise<{ success: boolean }>;
  dismissUpdate: (version: string) => Promise<{ success: boolean }>;
  onStateChanged: (callback: (payload: UpdateStatePayload) => void) => void;
  removeStateListeners: () => void;
  closeWindow: () => void;
}

declare global {
  interface Window {
    updateDialogAPI: UpdateDialogAPI;
    platform: NodeJS.Platform;
  }
}

export {};

class UpdateDialogController {
  private state: UpdateStatusResponse | null = null;
  private platform: NodeJS.Platform = window.platform || 'win32';

  private readonly statusBanner = document.getElementById('status-banner') as HTMLElement;
  private readonly currentVersionElement = document.getElementById('current-version') as HTMLElement;
  private readonly newVersionElement = document.getElementById('new-version') as HTMLElement;
  private readonly releaseNotesContainer = document.getElementById('release-notes') as HTMLElement;
  private readonly releaseNotesContent = document.getElementById('release-notes-content') as HTMLElement;
  private readonly progressContainer = document.getElementById('download-progress') as HTMLElement;
  private readonly progressBar = document.getElementById('progress-bar') as HTMLProgressElement;
  private readonly progressText = document.getElementById('progress-text') as HTMLElement;
  private readonly downloadSize = document.getElementById('download-size') as HTMLElement;
  private readonly platformNotice = document.getElementById('platform-notice') as HTMLElement;

  private readonly downloadButton = document.getElementById('btn-download') as HTMLButtonElement;
  private readonly installWindowsButton = document.getElementById('btn-install-windows') as HTMLButtonElement;
  private readonly installMacButton = document.getElementById('btn-install-mac') as HTMLButtonElement;
  private readonly remindLaterButton = document.getElementById('btn-later') as HTMLButtonElement;
  private readonly closeButton = document.getElementById('btn-close') as HTMLButtonElement;

  constructor() {
    document.body.classList.add(`platform-${this.platform}`);
    this.attachEventListeners();
    void this.initialize();
  }

  private attachEventListeners(): void {
    this.downloadButton?.addEventListener('click', () => void this.handlePrimaryAction());
    this.installWindowsButton?.addEventListener('click', () => void this.handleInstall());
    this.installMacButton?.addEventListener('click', () => void this.handleOpenInstaller());
    this.remindLaterButton?.addEventListener('click', () => void this.handleRemindLater());
    this.closeButton?.addEventListener('click', () => void this.handleRemindLater());

    window.addEventListener('beforeunload', () => {
      window.updateDialogAPI.removeStateListeners();
    });
  }

  private async initialize(): Promise<void> {
    try {
      const status = await window.updateDialogAPI.getStatus();
      this.state = status;
      this.render();

      window.updateDialogAPI.onStateChanged((payload) => {
        if (!this.state) {
          this.state = {
            currentVersion: '',
            supportsDownload: true,
            ...payload
          };
        } else {
          this.state = {
            ...this.state,
            ...payload
          };
        }
        this.render();
      });
    } catch (error) {
      this.setStatusBanner('Failed to load update status.', 'error');
      console.error('[Update Dialog] Failed to initialize dialog:', error);
    }
  }

  private async handlePrimaryAction(): Promise<void> {
    if (!this.state) {
      return;
    }

    const version = this.state.updateInfo?.version ?? null;

    if (!this.state.supportsDownload || this.platform === 'linux') {
      await window.updateDialogAPI.openReleasePage();
      if (version) {
        await window.updateDialogAPI.dismissUpdate(version);
      }
      window.updateDialogAPI.closeWindow();
      return;
    }

    this.downloadButton.disabled = true;
    this.setStatusBanner('Starting update download...', 'info');

    const result = await window.updateDialogAPI.downloadUpdate();
    if (!result.success) {
      this.downloadButton.disabled = false;
      this.setStatusBanner(result.error ?? 'Failed to start download.', 'error');
    }
  }

  private async handleInstall(): Promise<void> {
    this.installWindowsButton.disabled = true;
    const result = await window.updateDialogAPI.installUpdate();

    if (!result.success) {
      this.installWindowsButton.disabled = false;
      this.setStatusBanner(result.error ?? 'Failed to install update.', 'error');
    }
  }

  private async handleOpenInstaller(): Promise<void> {
    this.installMacButton.disabled = true;
    const result = await window.updateDialogAPI.openInstaller();

    if (!result.success) {
      this.installMacButton.disabled = false;
      this.setStatusBanner(result.error ?? 'Failed to open installer.', 'error');
    } else {
      this.setStatusBanner('Installer opened. Complete installation manually.', 'success');
    }
  }

  private async handleRemindLater(): Promise<void> {
    if (this.state?.updateInfo?.version) {
      await window.updateDialogAPI.dismissUpdate(this.state.updateInfo.version);
    }
    window.updateDialogAPI.closeWindow();
  }

  private render(): void {
    if (!this.state) {
      return;
    }

    this.currentVersionElement.textContent = this.state.currentVersion || '-';
    this.newVersionElement.textContent = this.state.updateInfo?.version || '-';

    this.renderReleaseNotes();
    this.renderProgress();
    this.renderButtons();
    this.renderStatusBanner();
    this.renderPlatformNotice();
  }

  private renderReleaseNotes(): void {
    if (!this.state?.updateInfo?.releaseNotes) {
      this.releaseNotesContainer.style.display = 'none';
      return;
    }

    const releaseNotes = this.formatReleaseNotes(this.state.updateInfo.releaseNotes);
    this.releaseNotesContent.textContent = releaseNotes || 'Release notes unavailable.';
    this.releaseNotesContainer.style.display = 'block';
  }

  private renderProgress(): void {
    const progress = this.state?.downloadProgress;

    if (!progress || !this.state?.supportsDownload) {
      this.progressContainer.style.display = 'none';
      return;
    }

    this.progressContainer.style.display = 'flex';
    const percent = Math.min(Math.max(progress.percent ?? 0, 0), 100);
    this.progressBar.value = percent;
    this.progressText.textContent = `${percent.toFixed(1)}%`;

    const transferred = this.formatBytes(progress.transferred ?? 0);
    const total = this.formatBytes(progress.total ?? 0);
    this.downloadSize.textContent = `${transferred} / ${total}`;
  }

  private renderButtons(): void {
    const state = this.state?.state ?? 'idle';
    const supportsDownload = Boolean(this.state?.supportsDownload);
    const isLinux = this.platform === 'linux';

    this.downloadButton.style.display = 'none';
    this.installWindowsButton.style.display = 'none';
    this.installMacButton.style.display = 'none';

    if (state === 'available') {
      this.downloadButton.style.display = 'inline-flex';
      this.downloadButton.disabled = !supportsDownload && !isLinux;
    } else if (state === 'downloading') {
      this.downloadButton.style.display = supportsDownload ? 'inline-flex' : 'none';
      this.downloadButton.disabled = true;
    } else if (state === 'downloaded') {
      if (this.platform === 'win32') {
        this.installWindowsButton.style.display = 'inline-flex';
        this.installWindowsButton.disabled = false;
      } else if (this.platform === 'darwin') {
        this.installMacButton.style.display = 'inline-flex';
        this.installMacButton.disabled = false;
      }
    } else if (state === 'not-available') {
      this.downloadButton.style.display = 'inline-flex';
      this.downloadButton.disabled = true;
    } else if (state === 'error') {
      if (supportsDownload || isLinux) {
        this.downloadButton.style.display = 'inline-flex';
        this.downloadButton.disabled = false;
      }
    } else if (state === 'idle' || state === 'checking') {
      if (supportsDownload) {
        this.downloadButton.style.display = 'inline-flex';
        this.downloadButton.disabled = state === 'checking';
      } else if (isLinux) {
        this.downloadButton.style.display = 'inline-flex';
        this.downloadButton.disabled = false;
      }
    }

    if (!supportsDownload && !isLinux) {
      this.downloadButton.disabled = true;
    }
  }

  private renderStatusBanner(): void {
    const state = this.state?.state ?? 'idle';
    const errorMessage = this.state?.error?.message;
    let message = 'Checking update status...';
    let variant: 'info' | 'success' | 'warning' | 'error' = 'info';

    switch (state) {
      case 'checking':
        message = 'Checking for updates...';
        variant = 'info';
        break;
      case 'available':
        message = `Update ${this.state?.updateInfo?.version ?? ''} is available.`;
        variant = 'info';
        break;
      case 'downloading':
        message = 'Downloading update...';
        variant = 'info';
        break;
      case 'downloaded':
        message = 'Update downloaded. Complete installation to finish.';
        variant = 'success';
        break;
      case 'not-available':
        message = 'You are running the latest version.';
        variant = 'success';
        break;
      case 'error':
        message = errorMessage ?? 'An error occurred while checking for updates.';
        variant = 'error';
        break;
      case 'idle':
      default:
        message = 'No update activity in progress.';
        variant = 'info';
        break;
    }

    this.setStatusBanner(message, variant);
  }

  private renderPlatformNotice(): void {
    const notices: Record<NodeJS.Platform, string> = {
      win32: '',
      darwin: 'After downloading, open the installer and drag FlashForgeUI into the Applications folder.',
      linux: 'Updates on Linux require manual installation from GitHub Releases.',
      aix: '',
      android: '',
      freebsd: '',
      haiku: '',
      openbsd: '',
      sunos: '',
      netbsd: '',
      cygwin: ''
    };

    const notice = notices[this.platform] || '';

    if (notice) {
      this.platformNotice.textContent = notice;
      this.platformNotice.style.display = 'block';
    } else {
      this.platformNotice.style.display = 'none';
    }
  }

  private setStatusBanner(message: string, variant: 'info' | 'success' | 'warning' | 'error'): void {
    if (!this.statusBanner) {
      return;
    }

    this.statusBanner.textContent = message;
    this.statusBanner.classList.remove('status-info', 'status-success', 'status-warning', 'status-error');

    if (variant === 'success') {
      this.statusBanner.classList.add('status-success');
    } else if (variant === 'warning') {
      this.statusBanner.classList.add('status-warning');
    } else if (variant === 'error') {
      this.statusBanner.classList.add('status-error');
    } else {
      this.statusBanner.classList.add('status-info');
    }
  }

  private formatReleaseNotes(releaseNotes: string | ReleaseNotesObject[] | null): string {
    if (!releaseNotes) {
      return '';
    }

    if (typeof releaseNotes === 'string') {
      return releaseNotes;
    }

    return releaseNotes
      .map(entry => entry.note ?? entry.notes ?? '')
      .filter(Boolean)
      .join('\n\n');
  }

  private formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) {
      return '0 MB';
    }

    const megabytes = bytes / (1024 * 1024);
    if (megabytes < 1) {
      const kilobytes = bytes / 1024;
      return `${kilobytes.toFixed(1)} KB`;
    }

    return `${megabytes.toFixed(2)} MB`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new UpdateDialogController();
});
