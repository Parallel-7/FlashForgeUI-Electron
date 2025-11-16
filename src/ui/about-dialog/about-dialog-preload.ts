/**
 * @fileoverview Preload script for the About dialog providing app/version metadata.
 *
 * Bridges renderer requests for application info and ensures external links are opened
 * securely through the main process. Also exposes a close helper wired to the shared
 * dialog shutdown channel so the dialog matches the rest of the UI windows.
 */

import { contextBridge, ipcRenderer } from 'electron';

export {};

interface AboutDialogLink {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly url: string;
  readonly icon: string;
}

export interface AboutDialogInfo {
  readonly appName: string;
  readonly version: string;
  readonly releaseTag: 'stable' | 'beta';
  readonly releaseLabel: string;
  readonly developerName: string;
  readonly links: readonly AboutDialogLink[];
}

contextBridge.exposeInMainWorld('aboutAPI', {
  getAppInfo: async (): Promise<AboutDialogInfo | null> => {
    try {
      return await ipcRenderer.invoke('about-dialog:get-info');
    } catch (error) {
      console.error('[AboutDialog] Failed to fetch app info', error);
      return null;
    }
  },
  openExternalLink: async (url: string): Promise<void> => {
    try {
      await ipcRenderer.invoke('about-dialog:open-link', url);
    } catch (error) {
      console.error('[AboutDialog] Failed to open link', error);
    }
  },
  closeWindow: (): void => {
    ipcRenderer.send('close-current-window');
  }
});
