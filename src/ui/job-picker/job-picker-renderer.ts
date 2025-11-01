/**
 * @fileoverview Renderer process for job picker dialog with material info and selection.
 *
 * Implements interactive job selection interface with grid-based file display, thumbnail loading,
 * and material information visualization for multi-color prints. Handles printer capability
 * detection, job listing (local/recent), and intelligent routing to material matching dialogs
 * for AD5X multi-color jobs. Includes staggered thumbnail requests, job metadata display,
 * and auto-leveling/start-now configuration options.
 *
 * Key features:
 * - Grid-based file display with lazy-loaded thumbnails
 * - Material info (i) icon for multi-color jobs with toolData
 * - Automatic material matching dialog for AD5X multi-color prints
 * - Single-color confirmation workflow for AD5X printers
 * - Printer capability-aware UI (hides unsupported features)
 * - Job start with leveling and immediate start options
 */

// Job Picker Dialog Renderer
// Handles file grid display, selection, and thumbnail loading

import type { AD5XJobInfo } from '../../types/printer-backend';

// Global window type extension
declare global {
  interface Window {
    jobPickerAPI: JobPickerAPI;
  }
}

interface JobPickerAPI {
    readonly onInit: (callback: (data: JobPickerInitData) => void) => void;
    readonly onJobList: (callback: (data: JobListData) => void) => void;
    readonly onThumbnailResult: (callback: (data: ThumbnailData) => void) => void;
    readonly closeDialog: () => void;
    readonly selectJob: (data: JobSelectionData) => void;
    readonly requestThumbnail: (filename: string) => void;
    readonly getFeatures: () => Promise<unknown>;
    readonly getLocalJobs: () => Promise<{ success: boolean; jobs: readonly unknown[]; error?: string }>;
    readonly getRecentJobs: () => Promise<{ success: boolean; jobs: readonly unknown[]; error?: string }>;
    readonly startJob: (fileName: string, options: { leveling: boolean; startNow: boolean; materialMappings?: unknown[] }) => Promise<{ success: boolean; error?: string }>;
    readonly showMaterialInfo: (data: MaterialInfoData) => void;
    readonly showMaterialMatching: (data: { fileName: string; toolDatas: readonly unknown[]; leveling: boolean }) => Promise<unknown[] | null>;
    readonly showSingleColorConfirmation: (data: { fileName: string; leveling: boolean }) => Promise<boolean>;
}

interface JobPickerInitData {
    readonly isRecentFiles: boolean;
}

interface JobListData {
    readonly isRecentFiles: boolean;
    readonly files: readonly string[];
    readonly dialogTitle: string;
    readonly error?: string;
    readonly isLegacy: boolean;
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

interface MaterialInfoData {
    readonly fileName: string;
    readonly toolDatas: readonly {
        readonly toolId: number;
        readonly materialName: string;
        readonly materialColor: string;
        readonly filamentWeight: number;
        readonly slotId: number;
    }[];
    readonly totalFilamentWeight?: number;
    readonly useMatlStation?: boolean;
}

// Global state management
let selectedFile: string | null = null;
let printerCapabilities: PrinterJobManagementFeatures | null = null;
let selectedPrinterModel: string | null = null;
let currentJobsData: readonly unknown[] = []; // Store full job data for AD5X

// Type definitions for printer features
interface PrinterFeatures {
    readonly jobManagement: PrinterJobManagementFeatures;
    readonly modelType?: string;
}

interface PrinterJobManagementFeatures {
    readonly localJobs: boolean;
    readonly recentJobs: boolean;
    readonly uploadJobs: boolean;
    readonly startJobs: boolean;
    readonly pauseResume: boolean;
    readonly cancelJobs: boolean;
    readonly usesNewAPI: boolean;
}

// Type for job information
interface JobInfo {
    readonly fileName: string;
    readonly printingTime?: number;
    readonly toolCount?: number;
    readonly totalFilamentWeight?: number;
    readonly useMatlStation?: boolean;
}

// Type guards
function isPrinterFeatures(value: unknown): value is PrinterFeatures {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const obj = value as Record<string, unknown>;
    return 'jobManagement' in obj && typeof obj.jobManagement === 'object';
}

function isJobInfo(value: unknown): value is JobInfo {
    if (!value || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    return 'fileName' in obj && typeof obj.fileName === 'string';
}

function isAD5XJobInfo(value: unknown): value is AD5XJobInfo {
    if (!value || typeof value !== 'object') {
        console.log('Job picker: isAD5XJobInfo - not an object:', value);
        return false;
    }
    const obj = value as Record<string, unknown>;
    const result = 'fileName' in obj && typeof obj.fileName === 'string' && 
           ('toolDatas' in obj || '_type' in obj);
    console.log('Job picker: isAD5XJobInfo check - has fileName:', 'fileName' in obj, 
                ', has toolDatas:', 'toolDatas' in obj, 
                ', has _type:', '_type' in obj,
                ', result:', result);
    if ('toolDatas' in obj) {
        console.log('Job picker: toolDatas value:', obj.toolDatas);
    }
    return result;
}

function isMultiColorJob(job: AD5XJobInfo): boolean {
    return !!(job.toolDatas && job.toolDatas.length > 0);
}

// DOM element references
let loadingElement: HTMLElement | null = null;
let fileListElement: HTMLElement | null = null;
let dialogTitleElement: HTMLElement | null = null;
let selectButton: HTMLButtonElement | null = null;
let levelingCheckbox: HTMLInputElement | null = null;
let startNowCheckbox: HTMLInputElement | null = null;

/**
 * Initialize the job picker dialog when DOM is ready
 */
function initializeJobPicker(): void {
    window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['x']);
    // Get DOM element references
    loadingElement = document.getElementById('loading');
    fileListElement = document.getElementById('file-list');
    dialogTitleElement = document.querySelector('.dialog-title');
    selectButton = document.getElementById('btn-select') as HTMLButtonElement;
    levelingCheckbox = document.getElementById('cb-leveling') as HTMLInputElement;
    startNowCheckbox = document.getElementById('cb-start-now') as HTMLInputElement;

    // Validate critical elements exist
    if (!loadingElement || !fileListElement || !dialogTitleElement || 
        !selectButton || !levelingCheckbox || !startNowCheckbox) {
        console.error('Job picker: Failed to find required DOM elements');
        return;
    }

    setupEventListeners();
    setupIpcListeners();
    
    // Wait for initialization data from main process
    // The main process will tell us whether to load recent or local files
}

/**
 * Initialize dialog by checking capabilities and loading jobs
 * @param isRecentFiles - Whether to load recent files or local files
 */
async function initializeDialog(isRecentFiles: boolean): Promise<void> {
    await checkPrinterCapabilities();
    
    // Load the appropriate type of jobs based on the parameter
    
    if (isRecentFiles && printerCapabilities?.recentJobs) {
        await loadRecentJobs();
    } else if (!isRecentFiles && printerCapabilities?.localJobs) {
        await loadLocalJobs();
    } else {
        // Show appropriate message for unsupported features
        showCapabilityMessage(isRecentFiles);
    }
}

/**
 * Check printer capabilities and update UI accordingly
 */
async function checkPrinterCapabilities(): Promise<void> {
    try {
        const api = window.jobPickerAPI;
        if (!api) {
            console.error('Job picker: API not available for capabilities check');
            return;
        }
        
        const features = await api.getFeatures();
        if (isPrinterFeatures(features)) {
            printerCapabilities = features.jobManagement;
            
            // Update UI based on capabilities
            const localTab = document.getElementById('tab-local');
            const recentTab = document.getElementById('tab-recent');
            
            if (!printerCapabilities.localJobs && localTab) {
                localTab.style.display = 'none';
            }
            
            if (!printerCapabilities.recentJobs && recentTab) {
                recentTab.style.display = 'none';
            }
            
            // Store model type if available
            if ('modelType' in features && features.modelType) {
                selectedPrinterModel = features.modelType;
            }
            
            console.log('Job picker: Printer capabilities loaded', printerCapabilities);
            console.log('Job picker: Printer model type:', selectedPrinterModel);
        } else {
            console.error('Job picker: Invalid features format received');
        }
    } catch (error) {
        console.error('Failed to get printer capabilities:', error);
    }
}

/**
 * Set up event listeners for user interactions
 */
function setupEventListeners(): void {
    // Close button
    const closeButton = document.getElementById('btn-close');
    closeButton?.addEventListener('click', handleCloseDialog);

    // Cancel button
    const cancelButton = document.getElementById('btn-cancel');
    cancelButton?.addEventListener('click', handleCloseDialog);

    // Select button
    selectButton?.addEventListener('click', handleSelectJob);
}

/**
 * Set up IPC listeners for communication with main process
 */
function setupIpcListeners(): void {
    const api = window.jobPickerAPI;
    if (!api) {
        console.error('Job picker: API not available');
        return;
    }

    // Listen for initialization data
    api.onInit((data: JobPickerInitData) => {
        console.log('Job picker: Received init data', data);
        void initializeDialog(data.isRecentFiles);
    });

    // Listen for job list from main process (legacy support)
    api.onJobList((data: JobListData) => {
        console.log('Job picker: Received job list', data);
        handleJobListReceived(data);
    });

    // Listen for thumbnail results
    api.onThumbnailResult((data: ThumbnailData) => {
        console.log('Job picker: Received thumbnail for', data.filename);
        updateThumbnail(data.filename, data.thumbnail);
    });
}

/**
 * Handle received job list data from main process
 */
function handleJobListReceived(data: JobListData): void {
    if (!dialogTitleElement || !loadingElement || !fileListElement) {
        console.error('Job picker: DOM elements not available');
        return;
    }

    // Update dialog title
    let title = data.dialogTitle;
    if (data.isLegacy) {
        title += ' (Legacy Mode)';
    }
    dialogTitleElement.textContent = title;



    // Show error if present
    if (data.error) {
        console.error('Job picker: Error from main process:', data.error);
        showErrorState(data.error);
        return;
    }

    // Populate file grid
    populateFileList(data.files);
}

/**
 * Show error state in the dialog
 */
function showErrorState(error: string): void {
    if (!loadingElement || !fileListElement) return;

    loadingElement.style.display = 'none';
    fileListElement.style.display = 'flex';
    fileListElement.innerHTML = `<div class="no-files">Error: ${error}</div>`;
}

/**
 * Show message to user
 */
function showMessage(message: string): void {
    if (!loadingElement || !fileListElement) return;
    
    loadingElement.style.display = 'none';
    fileListElement.style.display = 'flex';
    fileListElement.innerHTML = `<div class="no-files">${message}</div>`;
}

/**
 * Populate the file grid with available files
 */
function populateFileList(files: readonly string[]): void {
    if (!loadingElement || !fileListElement) {
        console.error('Job picker: Cannot populate file list - DOM elements missing');
        return;
    }

    // Hide loading, show file list
    loadingElement.style.display = 'none';
    fileListElement.style.display = 'grid';

    // Clear existing content
    fileListElement.innerHTML = '';

    // Handle empty file list
    if (files.length === 0) {
        fileListElement.innerHTML = '<div class="no-files">No files found</div>';
        return;
    }

    // Create file items with staggered thumbnail requests
    files.forEach((file, index) => {
        const filename = extractFilename(file);
        const fileItem = createFileItem(filename);
        if (fileListElement) {
            fileListElement.appendChild(fileItem);
        }
        // Stagger thumbnail requests to avoid overwhelming the queue
        setTimeout(() => {
            requestThumbnailForFile(filename);
        }, index * 10); // 10ms delay between each request
    });
}

/**
 * Extract filename from file data (handles both string and object formats)
 */
function extractFilename(file: string | { filename?: string; name?: string }): string {
    if (typeof file === 'string') {
        return file;
    }
    return file.filename || file.name || 'Unknown File';
}

/**
 * Find job data by filename in the current jobs data
 */
function findJobDataByFilename(filename: string): unknown {
    console.log('Job picker: Finding job data for filename:', filename);
    console.log('Job picker: Current jobs data length:', currentJobsData.length);
    
    const found = currentJobsData.find(job => {
        if (isJobInfo(job)) {
            const matches = job.fileName === filename;
            console.log('Job picker: Comparing', job.fileName, 'with', filename, '- matches:', matches);
            return matches;
        }
        return false;
    });
    
    console.log('Job picker: Found job data:', found);
    return found;
}

/**
 * Show material information dialog for AD5X job
 */
function showMaterialInfoDialog(jobData: AD5XJobInfo): void {
    if (!jobData.toolDatas || jobData.toolDatas.length === 0) {
        console.warn('No material data available for', jobData.fileName);
        return;
    }

    const materialInfoData: MaterialInfoData = {
        fileName: jobData.fileName,
        toolDatas: jobData.toolDatas.map(tool => ({
            toolId: tool.toolId,
            materialName: tool.materialName,
            materialColor: tool.materialColor,
            filamentWeight: tool.filamentWeight,
            slotId: tool.slotId
        })),
        totalFilamentWeight: jobData.totalFilamentWeight,
        useMatlStation: jobData.useMatlStation
    };

    const api = window.jobPickerAPI;
    if (api) {
        api.showMaterialInfo(materialInfoData);
    }
}

/**
 * Create a file item element for the grid
 */
function createFileItem(filename: string): HTMLElement {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.filename = filename;

    // Create header with info icon for AD5X jobs with material data
    const header = document.createElement('div');
    header.className = 'file-item-header';

    const jobData = findJobDataByFilename(filename);
    console.log('Job picker: createFileItem - checking job data for', filename);
    if (isAD5XJobInfo(jobData) && isMultiColorJob(jobData)) {
        console.log('Job picker: createFileItem - Adding (i) icon for multi-color job:', filename, 'with', jobData.toolDatas?.length || 0, 'tools');
        const infoIcon = document.createElement('button');
        infoIcon.className = 'info-icon';
        infoIcon.innerHTML = 'i';
        infoIcon.title = 'View material information';
        infoIcon.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent file selection
            showMaterialInfoDialog(jobData);
        });
        header.appendChild(infoIcon);
    }

    const thumbnail = document.createElement('div');
    thumbnail.className = 'thumbnail';
    thumbnail.innerHTML = '<div class="no-preview">Loading...</div>';

    const filenameElement = document.createElement('div');
    filenameElement.className = 'filename';
    filenameElement.textContent = filename;

    fileItem.appendChild(header);
    fileItem.appendChild(thumbnail);
    fileItem.appendChild(filenameElement);

    // Add click handler for selection
    fileItem.addEventListener('click', () => handleFileSelection(filename, fileItem));

    return fileItem;
}

/**
 * Handle file selection by user click
 */
function handleFileSelection(filename: string, fileItem: HTMLElement): void {
    // Deselect previous selection
    const previouslySelected = document.querySelectorAll('.file-item.selected');
    previouslySelected.forEach(item => {
        item.classList.remove('selected');
    });

    // Select clicked file
    fileItem.classList.add('selected');
    selectedFile = filename;

    // Enable select button
    if (selectButton) {
        selectButton.disabled = false;
    }

    console.log('Job picker: File selected:', filename);
}

/**
 * Request thumbnail for a specific file from main process
 */
function requestThumbnailForFile(filename: string): void {
    const api = window.jobPickerAPI;
    if (!api) {
        console.error('Job picker: Cannot request thumbnail - API not available');
        return;
    }

    api.requestThumbnail(filename);
}

/**
 * Update thumbnail display when received from main process
 */
function updateThumbnail(filename: string, thumbnail: string | null): void {
    const fileItems = document.querySelectorAll('.file-item');

    for (let i = 0; i < fileItems.length; i++) {
        const item = fileItems[i];
        const element = item as HTMLElement;
        if (element.dataset.filename === filename) {
            const thumbnailDiv = element.querySelector('.thumbnail');
            if (!thumbnailDiv) continue;

            if (thumbnail) {
                // Display actual thumbnail
                thumbnailDiv.innerHTML = `<img src="data:image/png;base64,${thumbnail}" alt="${filename}" />`;
            } else {
                // Display no preview placeholder
                thumbnailDiv.innerHTML = '<div class="no-preview">No Preview</div>';
            }
            break;
        }
    }
}

/**
 * Handle dialog close action
 */
function handleCloseDialog(): void {
    const api = window.jobPickerAPI;
    if (!api) {
        console.error('Job picker: Cannot close dialog - API not available');
        return;
    }

    console.log('Job picker: Closing dialog');
    api.closeDialog();
}

/**
 * Handle job selection action
 */
async function handleSelectJob(): Promise<void> {
    console.log('\n=== Job picker: handleSelectJob START ===');
    console.log('Job picker: selectedFile:', selectedFile);
    console.log('Job picker: selectedPrinterModel:', selectedPrinterModel);
    console.log('Job picker: currentJobsData length:', currentJobsData.length);
    console.log('Job picker: All current job filenames:', currentJobsData.map(job => isJobInfo(job) ? job.fileName : 'unknown'));
    
    if (!selectedFile) {
        console.warn('Job picker: No file selected');
        return;
    }

    if (!levelingCheckbox || !startNowCheckbox) {
        console.error('Job picker: Checkbox elements not available');
        return;
    }

    const api = window.jobPickerAPI;
    if (!api) {
        console.error('Job picker: Cannot select job - API not available');
        return;
    }

    // Check if job starting is supported
    if (!printerCapabilities?.startJobs) {
        showMessage('Job starting is not available for your printer model');
        return;
    }

    // For AD5X printers, check if this is a multi-color job
    console.log('Job picker: Checking for AD5X multi-color - model:', selectedPrinterModel, ', startNow:', startNowCheckbox.checked);
    if (selectedPrinterModel === 'ad5x' && startNowCheckbox.checked) {
        const jobData = findJobDataByFilename(selectedFile);
        console.log('Job picker: Found job data for', selectedFile, ':', jobData);
        
        // Check if this is a multi-color job (same logic as (i) icon)
        const isAD5X = isAD5XJobInfo(jobData);
        const hasToolDatas = isAD5X && jobData.toolDatas;
        const toolDataLength = hasToolDatas ? jobData.toolDatas.length : 0;
        console.log('Job picker: Multi-color check - isAD5X:', isAD5X, ', hasToolDatas:', hasToolDatas, ', toolDataLength:', toolDataLength);
        
        if (isAD5XJobInfo(jobData) && isMultiColorJob(jobData)) {
            console.log('Job picker: Detected multi-color job with', jobData.toolDatas?.length || 0, 'tools');
            console.log('Job picker: toolDatas details:', jobData.toolDatas);
            // Multi-color job - show material matching dialog
            console.log('Job picker: AD5X multi-color job detected, showing material matching');
            
            try {
                const materialMappings = await api.showMaterialMatching({
                    fileName: selectedFile,
                    toolDatas: jobData.toolDatas || [],
                    leveling: levelingCheckbox.checked
                });
                
                if (!materialMappings) {
                    // User cancelled
                    return;
                }
                
                // Start job with material mappings
                if (loadingElement) {
                    loadingElement.style.display = 'flex';
                    loadingElement.innerHTML = '<div class="loading-spinner"></div><div>Starting multi-color job...</div>';
                }
                
                const result = await api.startJob(selectedFile, {
                    leveling: levelingCheckbox.checked,
                    startNow: true,
                    materialMappings
                });
                
                if (result.success) {
                    console.log('Multi-color job started successfully');
                    api.closeDialog();
                } else {
                    showErrorState(result.error || 'Failed to start multi-color job');
                }
            } catch (error) {
                showErrorState('Error with material matching: ' + (error instanceof Error ? error.message : 'Unknown error'));
            }
            return;
        } else {
            // Single-color job - show confirmation
            console.log('Job picker: AD5X single-color job detected, showing confirmation');
            console.log('Job picker: Job data details - isAD5XJobInfo:', isAD5XJobInfo(jobData), ', toolDatas:', jobData);
            
            try {
                const confirmed = await api.showSingleColorConfirmation({
                    fileName: selectedFile,
                    leveling: levelingCheckbox.checked
                });
                
                if (!confirmed) {
                    // User cancelled
                    return;
                }
                
                // User confirmed - start the single color job
                if (loadingElement) {
                    loadingElement.style.display = 'flex';
                    loadingElement.innerHTML = '<div class="loading-spinner"></div><div>Starting job...</div>';
                }
                
                const result = await api.startJob(selectedFile, {
                    leveling: levelingCheckbox.checked,
                    startNow: true
                });
                
                if (result.success) {
                    console.log('Single-color job started successfully');
                    api.closeDialog();
                } else {
                    showErrorState(result.error || 'Failed to start job');
                }
                return; // Don't continue to the normal flow
            } catch (error) {
                showErrorState('Error with confirmation: ' + (error instanceof Error ? error.message : 'Unknown error'));
                return;
            }
        }
    }

    // Normal job start flow (non-AD5X or AD5X after confirmation)
    const selectionData: JobSelectionData = {
        filename: selectedFile,
        leveling: levelingCheckbox.checked,
        startNow: startNowCheckbox.checked
    };

    console.log('Job picker: Starting job with data:', selectionData);
    
    try {
        if (loadingElement) {
            loadingElement.style.display = 'flex';
            loadingElement.innerHTML = '<div class="loading-spinner"></div><div>Starting job...</div>';
        }
        
        const result = await api.startJob(selectedFile, {
            leveling: levelingCheckbox.checked,
            startNow: startNowCheckbox.checked
        });
        
        if (result.success) {
            console.log('Job started successfully');
            api.closeDialog();
        } else {
            showErrorState(result.error || 'Failed to start job');
        }
    } catch (error) {
        showErrorState('Error starting job: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * Load local jobs from printer
 */
async function loadLocalJobs(): Promise<void> {
    const api = window.jobPickerAPI;
    if (!api) return;
    
    try {
        if (loadingElement) loadingElement.style.display = 'flex';
        
        const result = await api.getLocalJobs();
        if (result.success) {
            // Convert job objects to file names for display
            const fileNames = result.jobs.map(job => {
                if (isJobInfo(job)) {
                    return job.fileName;
                }
                return String(job);
            });
            populateFileList(fileNames);
        } else {
            showErrorState(result.error || 'Failed to load local jobs');
        }
    } catch (error) {
        showErrorState('Error loading local jobs: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * Load recent jobs from printer
 */
async function loadRecentJobs(): Promise<void> {
    const api = window.jobPickerAPI;
    if (!api) return;
    
    try {
        if (loadingElement) loadingElement.style.display = 'flex';
        
        const result = await api.getRecentJobs();
        console.log('Job picker: Recent jobs result:', result);
        
        if (result.success) {
            // Store full job data for AD5X material info
            currentJobsData = result.jobs;
            console.log('Job picker: Stored job data count:', currentJobsData.length);
            console.log('Job picker: First few jobs:', currentJobsData.slice(0, 3));
            
            // Convert job objects to file names for display
            const fileNames = result.jobs.map(job => {
                if (isJobInfo(job)) {
                    return job.fileName;
                }
                return String(job);
            });
            populateFileList(fileNames);
        } else {
            showErrorState(result.error || 'Failed to load recent jobs');
        }
    } catch (error) {
        showErrorState('Error loading recent jobs: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
}

/**
 * Show capability message when feature is not supported
 */
function showCapabilityMessage(isRecentFiles: boolean): void {
    const message = isRecentFiles 
        ? 'Recent job management is not available for your printer model'
        : 'Local job management is not available for your printer model';
    showErrorState(message);
}

/**
 * Cleanup function called when window is unloaded
 */
function cleanup(): void {
    selectedFile = null;
    console.log('Job picker: Cleaned up renderer state');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeJobPicker);

// Cleanup when window is unloaded
window.addEventListener('unload', cleanup);

// Export for module
export {};

