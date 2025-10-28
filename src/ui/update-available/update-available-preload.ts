/**
 * @fileoverview Preload script for the auto-update dialog exposing safe IPC bridges.
 *
 * Provides typed wrappers around update-related IPC channels:
 * - Status queries (`get-update-status`)
 * - Manual check/download/install operations
 * - Release page fallback and dismissal controls
 * - Real-time state change subscription for progress updates
 */

import { contextBridge, ipcRenderer } from 'electron';

type UpdateState = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

interface UpdateInfoPayload {
  readonly version?: string;
  readonly releaseNotes?: unknown;
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

export {};

contextBridge.exposeInMainWorld('updateDialogAPI', {
  async getStatus(): Promise<UpdateStatusResponse> {
    return await ipcRenderer.invoke('get-update-status');
  },

  async checkForUpdates(): Promise<AutoUpdateActionResult> {
    return await ipcRenderer.invoke('check-for-updates');
  },

  async downloadUpdate(): Promise<AutoUpdateActionResult> {
    return await ipcRenderer.invoke('download-update');
  },

  async installUpdate(): Promise<AutoUpdateActionResult> {
    return await ipcRenderer.invoke('install-update');
  },

  async openInstaller(): Promise<AutoUpdateActionResult> {
    return await ipcRenderer.invoke('open-installer');
  },

  async openReleasePage(): Promise<{ success: boolean }> {
    return await ipcRenderer.invoke('open-release-page');
  },

  async dismissUpdate(version: string): Promise<{ success: boolean }> {
    return await ipcRenderer.invoke('dismiss-update', version);
  },

  onStateChanged(callback: (payload: UpdateStatePayload) => void): void {
    ipcRenderer.on('update-state-changed', (_event, payload: UpdateStatePayload) => {
      callback(payload);
    });
  },

  removeStateListeners(): void {
    ipcRenderer.removeAllListeners('update-state-changed');
  },

  closeWindow(): void {
    ipcRenderer.send('close-current-window');
  }
});

contextBridge.exposeInMainWorld('platform', process.platform);

