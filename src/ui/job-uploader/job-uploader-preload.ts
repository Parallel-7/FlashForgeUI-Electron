/**
 * @fileoverview Preload script for job uploader dialog with 3MF multi-color support.
 *
 * Provides secure IPC bridge for uploading print jobs with comprehensive slicer metadata parsing.
 * Enhanced with AD5X 3MF multi-color upload capabilities including material matching dialog
 * integration, progress reporting, and intelligent routing based on printer model and file type.
 * Supports file browsing, metadata extraction, and upload completion notifications.
 *
 * Key exports:
 * - uploaderAPI: Complete API for file upload workflow
 * - Material matching integration for 3MF multi-color files
 * - AD5X-specific upload path with material mappings
 * - Progress reporting with percentage and status updates
 * - Metadata parsing from slicer-meta library integration
 * - Single-color confirmation dialog support
 */

// job-uploader-preload.ts
// IPC bridge for Job Uploader Dialog communication between main and renderer processes
// ENHANCED: Now supports 3MF multi-color upload for AD5X printers

import { contextBridge, ipcRenderer } from 'electron';
import type { ParseResult, FilamentInfo } from 'slicer-meta';
import type { AD5XMaterialMapping } from 'ff-api';

// Valid IPC channels are defined directly in the event listeners below

// Interface for upload job payload
interface UploadJobPayload {
    filePath: string;
    startNow: boolean;
    autoLevel: boolean;
}

// Tool data format expected by material matching dialog
interface FFGcodeToolData {
    readonly toolId: number;
    readonly materialName: string;
    readonly materialColor: string;
    readonly filamentWeight: number;
    readonly slotId: number;
}

// AD5X upload result type
interface AD5XUploadResult {
    success: boolean;
    fileName: string;
    started: boolean;
    error?: string;
    timestamp: Date;
}

// Use ParseResult from slicer-meta, extend with error handling
type MetadataResult = ParseResult & {
    error?: string;
};

// Upload progress information
interface UploadProgress {
    percentage: number;
    status: string;
    stage: 'preparing' | 'uploading' | 'completing' | 'completed' | 'error';
}

// Upload completion result
interface UploadCompletionResult {
    success: boolean;
    fileName: string;
    error?: string;
}

// API exposed to renderer process
interface JobUploaderAPI {
    browseFile: () => void;
    uploadJob: (payload: UploadJobPayload) => void;
    cancelUpload: () => void;
    receiveFile: (func: (filePath: string | null) => void) => void;
    receiveMetadata: (func: (result: MetadataResult) => void) => void;
    removeListeners: () => void;
    // New methods for 3MF multi-color support
    showMaterialMatchingDialog: (filePath: string, toolData: FFGcodeToolData[]) => Promise<AD5XMaterialMapping[] | null>;
    showSingleColorDialog: (filePath: string, filament: FilamentInfo) => void;
    uploadFileAD5X: (filePath: string, startNow: boolean, autoLevel: boolean, materialMappings?: AD5XMaterialMapping[]) => Promise<AD5XUploadResult>;
    // Helper methods
    isAD5XPrinter: () => Promise<boolean>;
    // Progress reporting methods
    receiveUploadProgress: (func: (progress: UploadProgress) => void) => void;
    receiveUploadComplete: (func: (result: UploadCompletionResult) => void) => void;
}

// Expose the job uploader API to the renderer process
contextBridge.exposeInMainWorld('uploaderAPI', {
    // Renderer to Main Process
    browseFile: (): void => {
        ipcRenderer.send('uploader:browse-file');
    },

    uploadJob: (payload: UploadJobPayload): void => {
        ipcRenderer.send('uploader:upload-job', payload);
    },

    cancelUpload: (): void => {
        ipcRenderer.send('uploader:cancel');
    },

    // Main Process to Renderer
    receiveFile: (func: (filePath: string | null) => void): void => {
        ipcRenderer.on('uploader:file-selected', (event, filePath: string | null) => {
            func(filePath);
        });
    },

    receiveMetadata: (func: (result: MetadataResult) => void): void => {
        ipcRenderer.on('uploader:metadata-result', (event, result: MetadataResult) => {
            func(result);
        });
    },

    // New methods for 3MF multi-color support
    showMaterialMatchingDialog: async (filePath: string, toolData: FFGcodeToolData[]): Promise<AD5XMaterialMapping[] | null> => {
        const fileName = filePath.split(/[\\/]/).pop() || filePath;
        const dialogData = {
            fileName,
            toolDatas: toolData,
            leveling: true, // Default to enabled
            context: 'file-upload' as const // Specify context for button text
        };
        
        try {
            // Call IPC handler to show material matching dialog and return mappings
            const mappings = await ipcRenderer.invoke('show-material-matching-dialog', dialogData) as AD5XMaterialMapping[] | null;
            
            if (mappings && Array.isArray(mappings)) {
                console.log('Material mappings received from dialog:', mappings);
                return mappings;
            } else {
                console.log('Material matching cancelled by user');
                return null;
            }
        } catch (error) {
            console.error('Error showing material matching dialog:', error);
            alert('Failed to open material matching dialog. Please try again.');
            return null;
        }
    },

    showSingleColorDialog: (filePath: string, _filament: FilamentInfo): void => {
        const fileName = filePath.split(/[\\/]/).pop() || filePath;
        const dialogData = {
            fileName,
            leveling: true // Default to enabled
        };
        
        // Call IPC handler to show single-color confirmation dialog
        ipcRenderer.invoke('show-single-color-confirmation-dialog', dialogData)
            .then((confirmed: unknown) => {
                if (confirmed === true) {
                    // User confirmed - proceed with upload
                    console.log('Single-color print confirmed');
                    void window.uploaderAPI?.uploadFileAD5X?.(filePath, true, true);
                } else {
                    // User cancelled - no action needed
                    console.log('Single-color print cancelled by user');
                }
            })
            .catch((error: unknown) => {
                console.error('Error showing single-color confirmation dialog:', error);
                alert('Failed to open single-color confirmation dialog. Please try again.');
            });
    },

    uploadFileAD5X: async (
        filePath: string,
        startNow: boolean,
        autoLevel: boolean,
        materialMappings?: AD5XMaterialMapping[]
    ): Promise<AD5XUploadResult> => {
        try {
            const result = await ipcRenderer.invoke('upload-file-ad5x', {
                filePath,
                startPrint: startNow,
                levelingBeforePrint: autoLevel,
                materialMappings
            }) as AD5XUploadResult;
            return result;
        } catch (error) {
            return {
                success: false,
                fileName: '',
                started: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date()
            };
        }
    },

    isAD5XPrinter: async (): Promise<boolean> => {
        try {
            const isAD5X = await ipcRenderer.invoke('is-ad5x-printer') as boolean;
            console.log('isAD5XPrinter result:', isAD5X);
            return isAD5X;
        } catch (error) {
            console.warn('Error checking AD5X printer status:', error);
            return false;
        }
    },

    // Progress reporting methods
    receiveUploadProgress: (func: (progress: UploadProgress) => void): void => {
        ipcRenderer.on('uploader:upload-progress', (event, progress: UploadProgress) => {
            func(progress);
        });
    },

    receiveUploadComplete: (func: (result: UploadCompletionResult) => void): void => {
        ipcRenderer.on('uploader:upload-complete', (event, result: UploadCompletionResult) => {
            func(result);
        });
    },

    // Cleanup
    removeListeners: (): void => {
        ipcRenderer.removeAllListeners('uploader:file-selected');
        ipcRenderer.removeAllListeners('uploader:metadata-result');
        ipcRenderer.removeAllListeners('uploader:upload-progress');
        ipcRenderer.removeAllListeners('uploader:upload-complete');
    }
} as JobUploaderAPI);

// Export types for use in renderer
export { UploadJobPayload, MetadataResult, JobUploaderAPI, FFGcodeToolData, AD5XUploadResult, UploadProgress, UploadCompletionResult };