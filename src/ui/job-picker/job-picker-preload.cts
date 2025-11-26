/**
 * @fileoverview Job Picker Dialog Preload Script
 */

import { contextBridge, ipcRenderer } from 'electron';

interface JobListData {
  readonly isRecentFiles: boolean;
  readonly files: readonly string[];
  readonly dialogTitle: string;
  readonly error?: string;
  readonly isLegacy: boolean;
}

interface JobPickerInitData {
  readonly isRecentFiles: boolean;
}

interface ThumbnailData {
  readonly filename: string;
  readonly thumbnail: string | null;
}

interface JobSelectionData {
  readonly filename: string;
  readonly leveling: boolean;
  readonly startNow: boolean;
}

const jobPickerAPI = {
  onInit: (callback: (data: JobPickerInitData) => void): void => {
    ipcRenderer.on('job-picker-init', (_event, data) => callback(data));
  },
  onJobList: (callback: (data: JobListData) => void): void => {
    ipcRenderer.on('job-list', (_event, data) => callback(data));
  },
  onThumbnailResult: (callback: (data: ThumbnailData) => void): void => {
    ipcRenderer.on('thumbnail-result', (_event, data) => callback(data));
  },
  closeDialog: (): void => {
    ipcRenderer.send('close-job-picker');
  },
  selectJob: (data: JobSelectionData): void => {
    ipcRenderer.send('job-selected', data);
  },
  requestThumbnail: (filename: string): void => {
    ipcRenderer.send('request-thumbnail', filename);
  },
  getFeatures: async (): Promise<unknown> => {
    return await ipcRenderer.invoke('printer:get-features');
  },
  getLocalJobs: async (): Promise<{ success: boolean; jobs: readonly unknown[]; error?: string }> => {
    return await ipcRenderer.invoke('job-picker:get-local-jobs') as { success: boolean; jobs: readonly unknown[]; error?: string };
  },
  getRecentJobs: async (): Promise<{ success: boolean; jobs: readonly unknown[]; error?: string }> => {
    return await ipcRenderer.invoke('job-picker:get-recent-jobs') as { success: boolean; jobs: readonly unknown[]; error?: string };
  },
  startJob: async (fileName: string, options: { leveling: boolean; startNow: boolean; materialMappings?: unknown[] }): Promise<{ success: boolean; error?: string }> => {
    return await ipcRenderer.invoke('job-picker:start-job', fileName, options) as { success: boolean; error?: string };
  },
  showMaterialInfo: (data: unknown): void => {
    ipcRenderer.send('show-material-info-dialog', data);
  },
  showMaterialMatching: async (data: { fileName: string; toolDatas: readonly unknown[]; leveling: boolean }): Promise<unknown[] | null> => {
    const payload = { ...data, context: 'job-start' as const };
    return await ipcRenderer.invoke('show-material-matching-dialog', payload) as unknown[] | null;
  },
  showSingleColorConfirmation: async (data: { fileName: string; leveling: boolean }): Promise<boolean> => {
    return await ipcRenderer.invoke('show-single-color-confirmation-dialog', data) as boolean;
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
    jobPicker: jobPickerAPI
  }
});

export {};
