// job-uploader-renderer.ts
// TypeScript renderer logic for the Job Uploader Dialog
// Handles file selection, metadata parsing, and job uploading with full slicer-meta integration
// ENHANCED: Now supports 3MF multi-color upload for AD5X printers

import type { ParseResult, FilamentInfo } from 'slicer-meta';
import type { AD5XMaterialMapping } from 'ff-api';
import type { UploadProgress, UploadCompletionResult } from './job-uploader-preload';

// Import types from ff-api for material station functionality
type FFGcodeToolData = {
    readonly toolId: number;
    readonly materialName: string;
    readonly materialColor: string;
    readonly filamentWeight: number;
    readonly slotId: number;
};

// Ensure this file is treated as a module
export {};

// Interface for upload job payload
interface UploadJobPayload {
    filePath: string;
    startNow: boolean;
    autoLevel: boolean;
}

// Use the ParseResult type from slicer-meta, but allow for error property
type MetadataResult = ParseResult & {
    error?: string;
};

// Extend Window interface to include our job uploader API
declare global {
    interface Window {
        uploaderAPI?: {
            browseFile: () => void;
            uploadJob: (payload: UploadJobPayload) => void;
            cancelUpload: () => void;
            receiveFile: (func: (filePath: string | null) => void) => void;
            receiveMetadata: (func: (result: MetadataResult) => void) => void;
            removeListeners: () => void;
            // New methods for 3MF multi-color support
            showMaterialMatchingDialog: (filePath: string, toolData: FFGcodeToolData[]) => Promise<AD5XMaterialMapping[] | null>;
            showSingleColorDialog: (filePath: string, filament: FilamentInfo) => void;
            uploadFileAD5X: (filePath: string, startNow: boolean, autoLevel: boolean, materialMappings?: AD5XMaterialMapping[]) => Promise<unknown>;
            // Helper methods
            isAD5XPrinter: () => Promise<boolean>;
            // Progress reporting methods
            receiveUploadProgress: (func: (progress: UploadProgress) => void) => void;
            receiveUploadComplete: (func: (result: UploadCompletionResult) => void) => void;
        };
    }
}

// DOM element references with proper typing
interface DialogElements {
    filePathDisplay: HTMLElement | null;
    browseButton: HTMLButtonElement | null;
    startNowCheckbox: HTMLInputElement | null;
    autoLevelCheckbox: HTMLInputElement | null;
    printerModel: HTMLElement | null;
    filamentType: HTMLElement | null;
    filamentLen: HTMLElement | null;
    filamentWt: HTMLElement | null;
    supportUsed: HTMLElement | null;
    slicerName: HTMLElement | null;
    slicerVer: HTMLElement | null;
    sliceDate: HTMLElement | null;
    sliceTime: HTMLElement | null;
    thumbnailBox: HTMLElement | null;
    eta: HTMLElement | null;
    okButton: HTMLButtonElement | null;
    cancelButton: HTMLButtonElement | null;
    closeButton: HTMLButtonElement | null;
    loadingOverlay: HTMLElement | null;
    uploadProgressOverlay: HTMLElement | null;
    progressBar: HTMLElement | null;
    progressPercentage: HTMLElement | null;
    progressStatus: HTMLElement | null;
}

// Global state for material mappings (for 3MF multi-color uploads)
let savedMaterialMappings: AD5XMaterialMapping[] | null = null;
let currentFilePath: string | null = null;

/**
 * Convert FilamentInfo array from slicer-meta to FFGcodeToolData format
 * expected by the material matching dialog
 */
function convertFilamentsToToolData(filaments: FilamentInfo[]): FFGcodeToolData[] {
    return filaments.map((filament, index) => ({
        toolId: index,
        materialName: filament.type || 'Unknown',
        materialColor: filament.color || '#FFFFFF', // Default to white if no color specified
        filamentWeight: parseFloat(filament.usedG || '0'),
        slotId: 0 // Will be set by user selection in material matching dialog
    }));
}

/**
 * Determine if file is a 3MF and should use enhanced upload flow
 */
async function shouldUseEnhanced3MFFlow(filePath: string): Promise<boolean> {
    if (!window.uploaderAPI?.isAD5XPrinter) {
        return false;
    }
    
    const isAD5X = await window.uploaderAPI.isAD5XPrinter();
    if (!isAD5X) {
        return false;
    }
    
    return filePath.toLowerCase().endsWith('.3mf');
}

/**
 * Show warning dialog for 3MF files without filament data
 */
function showNoFilamentDataWarning(filePath: string): void {
    const filename = filePath.split(/[\\/]/).pop() || filePath;
    const message = `The 3MF file "${filename}" does not contain filament data.\n\nThis may happen with:` +
        '\n• Files not sliced for multi-color printing' +
        '\n• Older slicer versions' +
        '\n• Corrupted or incomplete files' +
        '\n\nThe file will be uploaded using the standard upload process.';
    
    alert(message);
    
    // Continue with regular upload flow
    // The metadata should already be displayed, just enable the OK button
    const okButton = document.getElementById('btn-ok') as HTMLButtonElement;
    if (okButton) {
        okButton.disabled = false;
    }
}

// Initialize dialog when DOM is loaded
document.addEventListener('DOMContentLoaded', (): void => {
    // Get DOM element references with proper type safety
    const elements: DialogElements = {
        filePathDisplay: document.getElementById('file-path-display'),
        browseButton: document.getElementById('btn-browse') as HTMLButtonElement,
        startNowCheckbox: document.getElementById('cb-start-now') as HTMLInputElement,
        autoLevelCheckbox: document.getElementById('cb-auto-level') as HTMLInputElement,
        printerModel: document.getElementById('meta-printer'),
        filamentType: document.getElementById('meta-filament-type'),
        filamentLen: document.getElementById('meta-filament-len'),
        filamentWt: document.getElementById('meta-filament-wt'),
        supportUsed: document.getElementById('meta-support'),
        slicerName: document.getElementById('meta-slicer-name'),
        slicerVer: document.getElementById('meta-slicer-ver'),
        sliceDate: document.getElementById('meta-slice-date'),
        sliceTime: document.getElementById('meta-slice-time'),
        thumbnailBox: document.getElementById('meta-thumbnail'),
        eta: document.getElementById('meta-eta'),
        okButton: document.getElementById('btn-ok') as HTMLButtonElement,
        cancelButton: document.getElementById('btn-cancel') as HTMLButtonElement,
        closeButton: document.getElementById('btn-close') as HTMLButtonElement,
        loadingOverlay: document.getElementById('loading-overlay'),
        uploadProgressOverlay: document.getElementById('upload-progress-overlay'),
        progressBar: document.getElementById('progress-bar'),
        progressPercentage: document.getElementById('progress-percentage'),
        progressStatus: document.getElementById('progress-status')
    };

    // Verify required elements exist
    if (!elements.browseButton || !elements.okButton || !elements.cancelButton || !elements.closeButton) {
        console.error('Job Uploader: Required DOM elements not found');
        return;
    }

    // Check if uploader API is available
    if (!window.uploaderAPI) {
        console.error('Job Uploader: Uploader API not available');
        return;
    }

    // Set up event handlers
    setupEventHandlers(elements);

    // Set up IPC message handlers
    setupIPCHandlers(elements);

    // Initialize UI state
    resetMetadata(elements);
    setOKButtonState(elements, false);

    console.log('Job Uploader Dialog initialized successfully');
});

/**
 * Set up all event handlers for dialog interaction
 */
function setupEventHandlers(elements: DialogElements): void {
    if (!window.uploaderAPI) return;

    // Browse button click handler
    if (elements.browseButton) {
        elements.browseButton.addEventListener('click', (): void => {
            resetMetadata(elements);
            window.uploaderAPI!.browseFile();
        });
    }

    // OK button click handler
    if (elements.okButton) {
        elements.okButton.addEventListener('click', (): void => {
            void handleUploadJob(elements);
        });
    }

    // Cancel button click handler
    if (elements.cancelButton) {
        elements.cancelButton.addEventListener('click', (): void => {
            handleCancel();
        });
    }

    // Close button click handler
    if (elements.closeButton) {
        elements.closeButton.addEventListener('click', (): void => {
            handleCancel();
        });
    }
}

/**
 * Set up IPC message handlers for communication with main process
 */
function setupIPCHandlers(elements: DialogElements): void {
    if (!window.uploaderAPI) return;

    // Handle file selection result
    window.uploaderAPI.receiveFile((filePath: string | null): void => {
        handleFileSelected(elements, filePath);
    });

    // Handle metadata parsing result
    window.uploaderAPI.receiveMetadata((result: MetadataResult): void => {
        void handleMetadataResult(elements, result);
    });

    // Handle upload progress updates
    window.uploaderAPI.receiveUploadProgress((progress: UploadProgress): void => {
        updateUploadProgress(elements, progress);
    });

    // Handle upload completion
    window.uploaderAPI.receiveUploadComplete((result: UploadCompletionResult): void => {
        void handleUploadComplete(elements, result);
    });
}

/**
 * Handle file selection from file browser
 */
function handleFileSelected(elements: DialogElements, filePath: string | null): void {
    console.log('File selected:', filePath);

    // Clear any previously saved material mappings when a new file is selected
    savedMaterialMappings = null;

    if (filePath) {
        currentFilePath = filePath;
        
        // Display filename, not full path for brevity
        const filename = filePath.split(/[\\/]/).pop() || filePath;
        if (elements.filePathDisplay) {
            elements.filePathDisplay.textContent = filename;
            elements.filePathDisplay.title = filePath; // Show full path on hover
        }

        // OK button remains disabled until metadata is parsed
        setOKButtonState(elements, false);

        // Show loading overlay while main process parses metadata
        showLoading(elements, true);
    } else {
        // User cancelled file browser
        currentFilePath = null;
        if (elements.filePathDisplay) {
            elements.filePathDisplay.textContent = 'No file selected...';
            elements.filePathDisplay.title = '';
        }
        resetMetadata(elements);
        setOKButtonState(elements, false);
        showLoading(elements, false);
    }
}

/**
 * Handle metadata parsing result from main process
 */
async function handleMetadataResult(elements: DialogElements, result: MetadataResult): Promise<void> {
    console.log('Metadata received:', result);
    
    // Hide loading overlay
    showLoading(elements, false);

    if (result && !result.error) {
        // Check if this is an AD5X printer with a non-3MF file
        const isAD5X = await window.uploaderAPI?.isAD5XPrinter();
        const is3MF = currentFilePath?.toLowerCase().endsWith('.3mf');
        
        if (isAD5X && !is3MF) {
            // AD5X printers only support 3MF files
            const fileName = currentFilePath?.split(/[\\/]/).pop() || 'file';
            const fileExtension = fileName.split('.').pop()?.toUpperCase() || 'unknown';
            
            if (elements.filePathDisplay) {
                elements.filePathDisplay.textContent = 'Unsupported file type for AD5X printer';
            }
            
            resetMetadata(elements);
            setOKButtonState(elements, false);
            currentFilePath = null;
            
            alert(`AD5X printers only support 3MF files.\n\nThe selected ${fileExtension} file cannot be uploaded to this printer.\n\nPlease select a 3MF file that has been sliced specifically for the AD5X printer.`);
            return;
        }
        
        // Successfully parsed metadata - populate the display
        populateMetadata(elements, result);
        
        // Check if this is a 3MF file for AD5X that should use enhanced upload flow
        if (currentFilePath && await shouldUseEnhanced3MFFlow(currentFilePath)) {
            try {
                const filaments = result.threeMf?.filaments || [];
                
                if (filaments.length > 1) {
                    // Multi-color file - route to material matching dialog
                    console.log(`3MF multi-color file detected with ${filaments.length} filaments`);
                    const toolData = convertFilamentsToToolData(filaments);
                    
                    if (window.uploaderAPI?.showMaterialMatchingDialog) {
                        const mappings = await window.uploaderAPI.showMaterialMatchingDialog(currentFilePath, toolData);
                        if (mappings && Array.isArray(mappings)) {
                            // Save material mappings for later use
                            savedMaterialMappings = mappings;
                            console.log('Material mappings saved:', mappings);
                            // Enable OK button now that mappings are confirmed
                            setOKButtonState(elements, true);
                        } else {
                            // User cancelled - disable OK button
                            console.log('Material matching cancelled by user');
                            setOKButtonState(elements, false);
                        }
                        return; // Don't enable OK button here, handled above
                    }
                } else if (filaments.length === 1) {
                    // Single-color file - just save the filament info and continue to main dialog
                    // The user will see the metadata and can choose auto level/start now options
                    console.log('3MF single-color file detected');
                    // No need to show single-color dialog, just enable OK button
                    // The upload will use AD5X path when OK is clicked
                } else {
                    // No filament data - show warning and fall back to regular upload
                    console.log('3MF file has no filament data, falling back to regular upload');
                    showNoFilamentDataWarning(currentFilePath);
                    return; // Warning function handles enabling OK button
                }
            } catch (error) {
                console.warn('Error processing 3MF file for enhanced upload:', error);
                // Fall through to regular upload flow
            }
        }
        
        // Regular upload flow - enable OK button
        setOKButtonState(elements, true);
    } else {
        // Handle parsing error
        const errorMessage = result?.error || 'Unknown error';
        console.error('Metadata parsing error:', errorMessage);
        
        if (elements.filePathDisplay) {
            elements.filePathDisplay.textContent = `Error parsing file: ${errorMessage}`;
        }
        
        resetMetadata(elements);
        setOKButtonState(elements, false);
        currentFilePath = null;

        // Show error message to user
        alert(`Could not parse file metadata:\n${errorMessage}`);
    }
}

/**
 * Handle upload job button click
 */
async function handleUploadJob(elements: DialogElements): Promise<void> {
    if (!window.uploaderAPI || !currentFilePath) return;

    // Check if this should use AD5X upload path
    const isAD5X = await window.uploaderAPI.isAD5XPrinter();
    const is3MF = currentFilePath.toLowerCase().endsWith('.3mf');
    const useAD5XUpload = isAD5X && is3MF;

    if (useAD5XUpload) {
        // Use AD5X upload for 3MF files on AD5X printer
        console.log('Using AD5X upload for 3MF file');
        
        try {
            const result = await window.uploaderAPI.uploadFileAD5X(
                currentFilePath,
                elements.startNowCheckbox?.checked || false,
                elements.autoLevelCheckbox?.checked || false,
                savedMaterialMappings || undefined // Use mappings if available (multi-color), undefined for single-color
            );
            
            console.log('AD5X upload result:', result);
            // Clear saved mappings after upload attempt
            savedMaterialMappings = null;
        } catch (error) {
            console.error('AD5X upload failed:', error);
            alert(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    } else if (isAD5X && !is3MF) {
        // This should not happen due to earlier validation, but safety check
        alert('AD5X printers only support 3MF files. Please select a valid 3MF file.');
        return;
    } else {
        // Use regular upload for non-AD5X printers or non-3MF files
        const payload: UploadJobPayload = {
            filePath: currentFilePath,
            startNow: elements.startNowCheckbox?.checked || false,
            autoLevel: elements.autoLevelCheckbox?.checked || false
        };

        console.log('Uploading job with regular upload:', payload);
        window.uploaderAPI.uploadJob(payload);
    }
}

/**
 * Handle cancel/close actions
 */
function handleCancel(): void {
    if (!window.uploaderAPI) return;
    
    window.uploaderAPI.cancelUpload();
}

/**
 * Populate metadata display with parsed data
 */
function populateMetadata(elements: DialogElements, data: MetadataResult): void {
    // Left Column: Details
    if (elements.printerModel) {
        elements.printerModel.textContent = 
            data.file?.printerModel || 
            data.threeMf?.printerModelId || 
            '-';
    }

    if (elements.filamentType) {
        elements.filamentType.textContent = 
            data.file?.filamentType || 
            data.threeMf?.filaments?.[0]?.type || 
            '-';
    }

    if (elements.filamentLen) {
        let lengthText = '-';
        if (data.file?.filamentUsedMM) {
            lengthText = `${data.file.filamentUsedMM.toFixed(2)} mm`;
        } else if (data.threeMf?.filaments?.[0]?.usedM) {
            const usedM = parseFloat(data.threeMf.filaments[0].usedM);
            lengthText = `${usedM.toFixed(2)} mm`;
        }
        elements.filamentLen.textContent = lengthText;
    }

    if (elements.filamentWt) {
        let weightText = '-';
        if (data.file?.filamentUsedG) {
            weightText = `${data.file.filamentUsedG.toFixed(2)} g`;
        } else if (data.threeMf?.filaments?.[0]?.usedG) {
            const usedG = parseFloat(data.threeMf.filaments[0].usedG);
            weightText = `${usedG.toFixed(2)} g`;
        }
        elements.filamentWt.textContent = weightText;
    }

    if (elements.supportUsed) {
        elements.supportUsed.textContent = data.threeMf ? 
            (data.threeMf.supportUsed ? 'Yes' : 'No') : 
            '-';
    }

    // Middle Column: Slicer Info
    if (elements.slicerName) {
        elements.slicerName.textContent = data.slicer?.slicerName || '-';
    }

    if (elements.slicerVer) {
        elements.slicerVer.textContent = data.slicer?.slicerVersion || '-';
    }

    if (elements.sliceDate) {
        elements.sliceDate.textContent = data.slicer?.sliceDate || '-';
    }

    if (elements.sliceTime) {
        elements.sliceTime.textContent = data.slicer?.sliceTime || '-';
    }

    if (elements.eta) {
        elements.eta.textContent = data.slicer?.printEta || '-';
    }

    // Right Column: Thumbnail
    if (elements.thumbnailBox) {
        const thumbnailData = data.threeMf?.plateImage || data.file?.thumbnail;
        if (thumbnailData) {
            // Check if it already has the data URL prefix
            const src = thumbnailData.startsWith('data:image') ? 
                thumbnailData : 
                `data:image/png;base64,${thumbnailData}`;
            
            elements.thumbnailBox.innerHTML = `<img src="${src}" alt="Preview" />`;
        } else {
            elements.thumbnailBox.innerHTML = '<span class="no-preview-text">No Preview</span>';
        }
    }
}

/**
 * Reset all metadata fields to default state
 */
function resetMetadata(elements: DialogElements): void {
    const metadataElements = [
        elements.printerModel,
        elements.filamentType,
        elements.filamentLen,
        elements.filamentWt,
        elements.supportUsed,
        elements.slicerName,
        elements.slicerVer,
        elements.sliceDate,
        elements.sliceTime,
        elements.eta
    ];

    metadataElements.forEach(element => {
        if (element) {
            element.textContent = '-';
        }
    });

    if (elements.thumbnailBox) {
        elements.thumbnailBox.innerHTML = '<span class="no-preview-text">No Preview</span>';
    }
}

/**
 * Show or hide loading overlay
 */
function showLoading(elements: DialogElements, show: boolean): void {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

/**
 * Enable or disable OK button
 */
function setOKButtonState(elements: DialogElements, enabled: boolean): void {
    if (elements.okButton) {
        elements.okButton.disabled = !enabled;
    }
}

/**
 * Show or hide upload progress overlay
 */
function showUploadProgress(elements: DialogElements, show: boolean): void {
    if (elements.uploadProgressOverlay) {
        elements.uploadProgressOverlay.style.display = show ? 'flex' : 'none';
    }
}

/**
 * Update upload progress bar and status
 */
function updateUploadProgress(elements: DialogElements, progress: UploadProgress): void {
    console.log('Upload progress:', progress);
    
    // Show progress overlay if not already visible
    showUploadProgress(elements, true);
    
    // Update progress bar width
    if (elements.progressBar) {
        elements.progressBar.style.width = `${progress.percentage}%`;
    }
    
    // Update percentage text
    if (elements.progressPercentage) {
        elements.progressPercentage.textContent = `${Math.round(progress.percentage)}%`;
    }
    
    // Update status text
    if (elements.progressStatus) {
        elements.progressStatus.textContent = progress.status;
    }
}

/**
 * Handle upload completion and auto-close functionality
 */
async function handleUploadComplete(elements: DialogElements, result: UploadCompletionResult): Promise<void> {
    console.log('Upload complete:', result);
    
    if (result.success) {
        // Show success state
        updateUploadProgress(elements, {
            percentage: 100,
            status: `Successfully uploaded ${result.fileName}`,
            stage: 'completed'
        });
        
        // Auto-close after 2 seconds
        setTimeout(() => {
            if (window.uploaderAPI) {
                window.uploaderAPI.cancelUpload();
            }
        }, 2000);
    } else {
        // Show error state
        updateUploadProgress(elements, {
            percentage: 0,
            status: `Upload failed: ${result.error || 'Unknown error'}`,
            stage: 'error'
        });
        
        // Hide progress overlay after 5 seconds to show error
        setTimeout(() => {
            showUploadProgress(elements, false);
            if (result.error) {
                alert(`Upload failed: ${result.error}`);
            }
        }, 5000);
    }
}

// Cleanup on window unload
window.addEventListener('beforeunload', (): void => {
    console.log('Cleaning up Job Uploader Dialog resources');
    
    // Clear saved material mappings
    savedMaterialMappings = null;
    
    if (window.uploaderAPI) {
        window.uploaderAPI.removeListeners();
    }
});