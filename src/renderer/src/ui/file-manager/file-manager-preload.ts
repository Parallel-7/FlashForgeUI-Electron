/**
 * @fileoverview Preload script for the SFTP printer file manager dialog.
 *
 * Exposes a typed, promise-based bridge (window.api.dialog.fileManager) for the
 * file manager renderer: capability probing, storage listings, batch deletion,
 * renaming, and thumbnail retrieval — all routed through the main-process
 * FileManagerService against the active printer context. Also wires the shared
 * close channel and live theme updates.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  FileManagerCapabilities,
  FileManagerDeleteResult,
  FileManagerListing,
  FileManagerRenameResult,
  FileManagerStorageKind,
  FileManagerThumbnailResult,
} from '@shared/types/file-manager.js';

const fileManagerAPI = {
  getCapabilities: async (): Promise<FileManagerCapabilities> => {
    return (await ipcRenderer.invoke('file-manager:get-capabilities')) as FileManagerCapabilities;
  },
  listFiles: async (storage: FileManagerStorageKind, path: string): Promise<FileManagerListing> => {
    return (await ipcRenderer.invoke('file-manager:list-files', storage, path)) as FileManagerListing;
  },
  deleteFiles: async (storage: FileManagerStorageKind, paths: string[]): Promise<FileManagerDeleteResult> => {
    return (await ipcRenderer.invoke('file-manager:delete-files', storage, paths)) as FileManagerDeleteResult;
  },
  renameFile: async (
    storage: FileManagerStorageKind,
    path: string,
    newName: string
  ): Promise<FileManagerRenameResult> => {
    return (await ipcRenderer.invoke('file-manager:rename-file', storage, path, newName)) as FileManagerRenameResult;
  },
  getThumbnail: async (storage: FileManagerStorageKind, path: string): Promise<FileManagerThumbnailResult> => {
    return (await ipcRenderer.invoke('file-manager:get-thumbnail', storage, path)) as FileManagerThumbnailResult;
  },
  closeWindow: (): void => {
    ipcRenderer.send('close-current-window');
  },
  receive: (channel: string, func: (...args: unknown[]) => void): void => {
    const validChannels = ['theme-changed'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => func(...args));
    }
  },
} as const;

contextBridge.exposeInMainWorld('api', {
  dialog: {
    fileManager: fileManagerAPI,
  },
});

export type FileManagerDialogAPI = typeof fileManagerAPI;

export {};
