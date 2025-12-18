/**
 * @fileoverview Spoolman Dialog Preload Script
 *
 * Exposes secure IPC API for the Spoolman spool selection dialog renderer process.
 * Provides methods for searching spools and selecting spools through the main process.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { SpoolSearchQuery, SpoolResponse, ActiveSpoolData } from '@shared/types/spoolman.js';

const spoolmanDialogAPI = {
  searchSpools: (query: SpoolSearchQuery): Promise<SpoolResponse[]> => {
    return ipcRenderer.invoke('spoolman:search-spools', query);
  },

  selectSpool: (spool: ActiveSpoolData): Promise<void> => {
    return ipcRenderer.invoke('spoolman:select-spool', spool);
  },

  receive: (channel: string, func: (...args: unknown[]) => void): void => {
    const validChannels = ['theme-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  }
} as const;

contextBridge.exposeInMainWorld('api', {
  dialog: {
    spoolman: spoolmanDialogAPI
  }
});

export {};
