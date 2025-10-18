/**
 * @fileoverview Preload script for job picker dialog with printer feature integration.
 *
 * Establishes secure IPC communication for browsing and starting print jobs from printer storage.
 * Supports both local and recent job lists with thumbnail retrieval, material information display
 * for multi-color prints, and material matching dialog integration for AD5X printers. Provides
 * printer capability queries and job start operations with leveling and auto-start options.
 *
 * Key exports:
 * - jobPickerAPI: Comprehensive API for job listing, selection, and starting
 * - Material matching integration for multi-color AD5X prints
 * - Thumbnail request/response system with async loading
 * - Printer feature and capability queries
 * - Single-color confirmation dialog support
 */

// Job Picker Dialog Preload Script
// Provides secure IPC bridge between renderer and main process

import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for job picker data
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

// Valid IPC channels are defined directly in the API methods below

/**
 * Secure API interface exposed to renderer process with job management capabilities
 */
const jobPickerAPI = {
    /**
     * Listen for initialization data from main process
     */
    onInit: (callback: (data: JobPickerInitData) => void): void => {
        ipcRenderer.on('job-picker-init', (_event, data) => {
            callback(data);
        });
    },

    /**
     * Listen for job list data from main process
     */
    onJobList: (callback: (data: JobListData) => void): void => {
        ipcRenderer.on('job-list', (_event, data) => {
            callback(data);
        });
    },

    /**
     * Listen for thumbnail results from main process
     */
    onThumbnailResult: (callback: (data: ThumbnailData) => void): void => {
        ipcRenderer.on('thumbnail-result', (_event, data) => {
            callback(data);
        });
    },

    /**
     * Close the job picker dialog
     */
    closeDialog: (): void => {
        console.log('Job picker preload: Sending close dialog request');
        ipcRenderer.send('close-job-picker');
    },

    /**
     * Send selected job data to main process
     */
    selectJob: (data: JobSelectionData): void => {
        console.log('Job picker preload: Sending job selection:', data);
        ipcRenderer.send('job-selected', data);
    },

    /**
     * Request thumbnail for a specific file
     */
    requestThumbnail: (filename: string): void => {
        console.log('Job picker preload: Requesting thumbnail for:', filename);
        ipcRenderer.send('request-thumbnail', filename);
    },

    /**
     * Get printer features and capabilities
     */
    getFeatures: async (): Promise<unknown> => {
        const result: unknown = await ipcRenderer.invoke('printer:get-features');
        return result;
    },

    /**
     * Get local jobs from printer
     */
    getLocalJobs: async (): Promise<{ success: boolean; jobs: readonly unknown[]; error?: string }> => {
        const result: unknown = await ipcRenderer.invoke('job-picker:get-local-jobs');
        // Type assertion after validation would be ideal, but for now trust the backend
        return result as { success: boolean; jobs: readonly unknown[]; error?: string };
    },

    /**
     * Get recent jobs from printer
     */
    getRecentJobs: async (): Promise<{ success: boolean; jobs: readonly unknown[]; error?: string }> => {
        const result: unknown = await ipcRenderer.invoke('job-picker:get-recent-jobs');
        // Type assertion after validation would be ideal, but for now trust the backend
        return result as { success: boolean; jobs: readonly unknown[]; error?: string };
    },

    /**
     * Start a print job
     */
    startJob: async (fileName: string, options: { leveling: boolean; startNow: boolean; materialMappings?: unknown[] }): Promise<{ success: boolean; error?: string }> => {
        const result: unknown = await ipcRenderer.invoke('job-picker:start-job', fileName, options);
        // Type assertion after validation would be ideal, but for now trust the backend
        return result as { success: boolean; error?: string };
    },

    /**
     * Show material information dialog
     */
    showMaterialInfo: (data: unknown): void => {
        console.log('Job picker preload: Sending show material info request');
        ipcRenderer.send('show-material-info-dialog', data);
    },

    /**
     * Show material matching dialog for multi-color prints
     */
    showMaterialMatching: async (data: { fileName: string; toolDatas: readonly unknown[]; leveling: boolean }): Promise<unknown[] | null> => {
        // Add context for job-start to show "Start Print" button
        const dataWithContext = {
            ...data,
            context: 'job-start' as const
        };
        const result: unknown = await ipcRenderer.invoke('show-material-matching-dialog', dataWithContext);
        return result as unknown[] | null;
    },

    /**
     * Show single color confirmation dialog
     */
    showSingleColorConfirmation: async (data: { fileName: string; leveling: boolean }): Promise<boolean> => {
        const result: unknown = await ipcRenderer.invoke('show-single-color-confirmation-dialog', data);
        return result as boolean;
    }
} as const;

// Expose secure API to renderer process
contextBridge.exposeInMainWorld('jobPickerAPI', jobPickerAPI);

// Log successful preload initialization
console.log('Job picker preload: API exposed to renderer process');

export {};
