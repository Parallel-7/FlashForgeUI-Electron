/**
 * @fileoverview Spoolman Dialog Preload Script
 *
 * Exposes secure IPC API for the Spoolman spool selection dialog renderer process.
 * Provides methods for searching spools and selecting spools through the main process.
 *
 * Exposed API:
 * - searchSpools: Search for spools matching query criteria
 * - selectSpool: Notify main process of spool selection
 *
 * @module ui/spoolman-dialog/spoolman-dialog-preload
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { SpoolSearchQuery, SpoolResponse, ActiveSpoolData } from '../../types/spoolman.js';

// Expose safe API to renderer
contextBridge.exposeInMainWorld('spoolmanDialogAPI', {
  /**
   * Search for spools matching query
   * @param query - Search query parameters
   * @returns Promise resolving to array of matching spools
   */
  searchSpools: (query: SpoolSearchQuery): Promise<SpoolResponse[]> => {
    return ipcRenderer.invoke('spoolman:search-spools', query);
  },

  /**
   * Select a spool and notify main process
   * @param spool - Selected spool data
   * @returns Promise resolving when selection is broadcast
   */
  selectSpool: (spool: ActiveSpoolData): Promise<void> => {
    return ipcRenderer.invoke('spoolman:select-spool', spool);
  },

  receive: (channel: string, func: (...args: unknown[]) => void): void => {
    const validChannels = ['theme-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  }
});
