/**
 * @fileoverview Job-related IPC handlers for print job management and file operations.
 *
 * Provides comprehensive job management IPC handlers with support for different printer types:
 * - Local job listing and retrieval from printer storage
 * - Recent job listing from printer history
 * - Job starting with leveling and material mapping support
 * - File upload with progress tracking (standard and AD5X workflows)
 * - Thumbnail retrieval with caching and queue management
 * - Slicer file metadata parsing and validation
 *
 * Key exports:
 * - registerJobHandlers(): Registers all job-related IPC handlers
 *
 * Special features:
 * - AD5X upload workflow with material station integration
 * - Progress simulation for user feedback during uploads
 * - Thumbnail caching with printer serial number keying
 * - Request queue management for efficient thumbnail fetching
 * - Integration with ThumbnailCacheService and ThumbnailRequestQueue
 *
 * All handlers are context-aware and operate on the active printer context, with feature
 * detection to ensure operations are only available on supported printer models.
 */

import { ipcMain, dialog } from 'electron';
import { parseSlicerFile } from 'slicer-meta';
import type { PrinterBackendManager } from '../../managers/PrinterBackendManager';
import type { getWindowManager } from '../../windows/WindowManager';
import { getThumbnailCacheService } from '../../services/ThumbnailCacheService';
import { getThumbnailRequestQueue } from '../../services/ThumbnailRequestQueue';
import type { AD5XUploadParams, UploadJobPayload, SlicerMetadata } from '../../types/ipc';
import { getPrinterContextManager } from '../../managers/PrinterContextManager';

type WindowManager = ReturnType<typeof getWindowManager>;

/**
 * Register all job-related IPC handlers
 */
export function registerJobHandlers(
  backendManager: PrinterBackendManager,
  windowManager: WindowManager
): void {
  // Get local jobs handler
  ipcMain.handle('job-picker:get-local-jobs', async (): Promise<{ success: boolean; jobs: readonly unknown[]; error?: string }> => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, jobs: [], error: 'No active printer context' };
      }

      const features = backendManager.getFeatures(contextId);

      if (!features || !features.jobManagement.localJobs) {
        return { success: false, jobs: [], error: 'Local job management not supported on this printer' };
      }

      const result = await backendManager.getLocalJobs(contextId);
      return { success: result.success, jobs: result.jobs, error: result.error };
    } catch (error) {
      return { success: false, jobs: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get recent jobs handler
  ipcMain.handle('job-picker:get-recent-jobs', async (): Promise<{ success: boolean; jobs: readonly unknown[]; error?: string }> => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, jobs: [], error: 'No active printer context' };
      }

      const features = backendManager.getFeatures(contextId);

      if (!features || !features.jobManagement.recentJobs) {
        return { success: false, jobs: [], error: 'Recent job management not supported on this printer' };
      }

      const result = await backendManager.getRecentJobs(contextId);
      return { success: result.success, jobs: result.jobs, error: result.error };
    } catch (error) {
      return { success: false, jobs: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Start job handler
  ipcMain.handle('job-picker:start-job', async (_event, fileName: string, options: { leveling: boolean; startNow: boolean; materialMappings?: unknown[] }): Promise<{ success: boolean; error?: string }> => {
    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        return { success: false, error: 'No active printer context' };
      }

      const features = backendManager.getFeatures(contextId);

      if (!features || !features.jobManagement.startJobs) {
        return { success: false, error: 'Job starting not supported on this printer' };
      }

      const result = await backendManager.startJob(contextId, {
        operation: 'start',
        fileName,
        leveling: options.leveling,
        startNow: options.startNow,
        additionalParams: options.materialMappings ? { materialMappings: options.materialMappings } : undefined
      });

      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Job uploader browse file handler
  ipcMain.on('uploader:browse-file', async (event) => {
    const jobUploaderWindow = windowManager.getJobUploaderWindow();
    if (!jobUploaderWindow) {
      return;
    }

    try {
      const result = await dialog.showOpenDialog(jobUploaderWindow, {
        title: 'Select Job File',
        filters: [
          { name: 'Job Files', extensions: ['gcode', 'gx', '3mf'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      const filePath = result.canceled ? null : result.filePaths[0] || null;
      event.sender.send('uploader:file-selected', filePath);

      if (filePath) {
        try {
          const metadata = await parseSlicerFile(filePath) as SlicerMetadata;
          event.sender.send('uploader:metadata-result', metadata);
        } catch (error) {
          console.error('Metadata parsing error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
          event.sender.send('uploader:metadata-result', { error: errorMessage });
        }
      }
    } catch (error) {
      console.error('File dialog error:', error);
      event.sender.send('uploader:file-selected', null);
      const errorMessage = error instanceof Error ? error.message : 'Unknown dialog error';
      event.sender.send('uploader:metadata-result', { error: errorMessage });
    }
  });

  // AD5X file upload handler
  ipcMain.handle('upload-file-ad5x', async (event, params: AD5XUploadParams) => {
    try {
      const { filePath, startPrint, levelingBeforePrint, materialMappings } = params;

      // Validate required parameters
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('filePath is required and must be a string');
      }

      if (typeof startPrint !== 'boolean') {
        throw new Error('startPrint must be a boolean');
      }

      if (typeof levelingBeforePrint !== 'boolean') {
        throw new Error('levelingBeforePrint must be a boolean');
      }

      // Validate material mappings if provided
      if (materialMappings !== undefined && !Array.isArray(materialMappings)) {
        throw new Error('materialMappings must be an array if provided');
      }

      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        throw new Error('No active printer context');
      }

      // Check if backend is ready
      if (!backendManager.isBackendReady(contextId)) {
        throw new Error('Printer backend is not ready');
      }

      // Check if the current printer supports AD5X features
      const features = backendManager.getFeatures(contextId);
      if (!features || !features.materialStation?.available) {
        throw new Error('Current printer does not support AD5X upload functionality');
      }
      
      console.log(`AD5X upload request: ${filePath}, start: ${startPrint}, level: ${levelingBeforePrint}, mappings: ${materialMappings?.length ?? 0}`);
      
      // Send initial progress update
      event.sender.send('uploader:upload-progress', {
        percentage: 0,
        status: 'Preparing AD5X upload...',
        stage: 'preparing'
      });
      
      // Simulate progress updates during upload
      // Since ff-api doesn't provide granular progress, we'll simulate it
      const progressUpdates = [
        { percentage: 15, status: 'Validating material mappings...', stage: 'preparing' },
        { percentage: 30, status: 'Connecting to material station...', stage: 'uploading' },
        { percentage: 50, status: 'Uploading file to printer...', stage: 'uploading' },
        { percentage: 70, status: 'Processing 3MF data...', stage: 'uploading' },
        { percentage: 90, status: 'Finalizing upload...', stage: 'completing' }
      ];
      
      // Send progress updates with small delays
      for (const update of progressUpdates) {
        event.sender.send('uploader:upload-progress', update);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Call the PrinterBackendManager method which delegates to the AD5X backend
      const result = await backendManager.uploadFileAD5X(
        contextId,
        filePath,
        startPrint,
        levelingBeforePrint,
        materialMappings
      );
      
      if (result.success) {
        // Send completion progress
        event.sender.send('uploader:upload-progress', {
          percentage: 100,
          status: 'Upload complete',
          stage: 'completed'
        });
        
        // Send completion event
        event.sender.send('uploader:upload-complete', {
          success: true,
          fileName: result.fileName
        });
      } else {
        // Send error completion event
        event.sender.send('uploader:upload-complete', {
          success: false,
          fileName: result.fileName,
          error: result.error || 'AD5X upload failed'
        });
      }
      
      return {
        success: result.success,
        fileName: result.fileName,
        started: result.started,
        error: result.error,
        timestamp: result.timestamp
      };
      
    } catch (error) {
      console.error('AD5X upload error:', error);
      
      // Send error completion event
      event.sender.send('uploader:upload-complete', {
        success: false,
        fileName: '',
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fileName: '',
        started: false,
        timestamp: new Date()
      };
    }
  });

  // Upload job handler
  ipcMain.on('uploader:upload-job', async (event, payload: UploadJobPayload) => {
    const { filePath, startNow, autoLevel } = payload;
    console.log('Upload job requested:', payload);

    const jobUploaderWindow = windowManager.getJobUploaderWindow();
    if (!jobUploaderWindow) {
      return;
    }

    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        event.sender.send('uploader:upload-complete', {
          success: false,
          fileName: '',
          error: 'No active printer context'
        });
        return;
      }

      // Check if backend is ready
      if (!backendManager.isBackendReady(contextId)) {
        event.sender.send('uploader:upload-complete', {
          success: false,
          fileName: '',
          error: 'Printer not connected'
        });
        return;
      }
      
      // Start upload with progress reporting
      event.sender.send('uploader:upload-progress', {
        percentage: 0,
        status: 'Preparing upload...',
        stage: 'preparing'
      });
      
      // Use startJob with filePath for regular printers
      const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
      const result = await backendManager.startJob(contextId, {
        operation: 'start',
        filePath,
        fileName,
        leveling: autoLevel,
        startNow
      });
      
      if (result.success) {
        // Simulate upload progress for user feedback
        // Since we don't have granular progress from the backend, simulate it
        for (let i = 10; i <= 90; i += 20) {
          event.sender.send('uploader:upload-progress', {
            percentage: i,
            status: 'Uploading file...',
            stage: 'uploading'
          });
          // Small delay to show progress
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        event.sender.send('uploader:upload-progress', {
          percentage: 100,
          status: 'Upload complete',
          stage: 'completed'
        });
        
        event.sender.send('uploader:upload-complete', {
          success: true,
          fileName: result.fileName
        });
      } else {
        event.sender.send('uploader:upload-complete', {
          success: false,
          fileName: result.fileName,
          error: result.error || 'Upload failed'
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      event.sender.send('uploader:upload-complete', {
        success: false,
        fileName: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Cancel upload handler
  ipcMain.on('uploader:cancel', () => {
    const jobUploaderWindow = windowManager.getJobUploaderWindow();
    if (jobUploaderWindow) {
      jobUploaderWindow.close();
    }
  });

  // Request thumbnail handler with caching and queue integration
  ipcMain.on('request-thumbnail', async (_, filename: string) => {
    const jobPickerWindow = windowManager.getJobPickerWindow();
    const thumbnailCache = getThumbnailCacheService();
    const thumbnailQueue = getThumbnailRequestQueue();

    // Helper to send result to renderer
    const sendResult = (thumbnail: string | null): void => {
      if (jobPickerWindow && !jobPickerWindow.isDestroyed()) {
        jobPickerWindow.webContents.send('thumbnail-result', {
          filename,
          thumbnail: thumbnail ? thumbnail.replace('data:image/png;base64,', '') : null
        });
      }
    };

    try {
      const contextManager = getPrinterContextManager();
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        console.log(`[ThumbnailHandler] No active context for ${filename}`);
        sendResult(null);
        return;
      }

      // Check if backend is ready
      if (!backendManager.isBackendReady(contextId)) {
        console.log(`[ThumbnailHandler] Backend not ready for ${filename}`);
        sendResult(null);
        return;
      }

      // Get printer serial number for cache key
      const printerDetails = backendManager.getPrinterDetailsForContext(contextId);
      if (!printerDetails?.SerialNumber) {
        console.warn('[ThumbnailHandler] No printer serial number available');
        sendResult(null);
        return;
      }
      
      // 1. Check cache first
      const cachedResult = await thumbnailCache.get(printerDetails.SerialNumber, filename);
      if (cachedResult.success && cachedResult.data) {
        console.log(`[ThumbnailHandler] Cache hit for ${filename}`);
        sendResult(cachedResult.data);
        return;
      }
      
      // 2. If cache miss, enqueue request
      console.log(`[ThumbnailHandler] Cache miss for ${filename}, queueing request`);
      const queueResult = await thumbnailQueue.enqueue(filename);
      
      // 3. Handle queue result
      if (queueResult.success && queueResult.thumbnail) {
        // Store in cache
        await thumbnailCache.set(
          printerDetails.SerialNumber, 
          filename, 
          queueResult.thumbnail
        );
        sendResult(queueResult.thumbnail);
      } else {
        console.error(`[ThumbnailHandler] Failed to get thumbnail for ${filename}:`, queueResult.error);
        sendResult(null);
      }
      
    } catch (error) {
      console.error(`[ThumbnailHandler] Error processing thumbnail request for ${filename}:`, error);
      sendResult(null);
    }
  });

  // Job selected handler
  ipcMain.on('job-selected', (_, data) => {
    console.log('Job selected:', data);
    // TODO: Implement actual job handling logic
    // For now, just close the dialog
    const jobPickerWindow = windowManager.getJobPickerWindow();
    if (jobPickerWindow) {
      jobPickerWindow.close();
    }
  });

  // Close job picker handler
  ipcMain.on('close-job-picker', () => {
    const jobPickerWindow = windowManager.getJobPickerWindow();
    if (jobPickerWindow) {
      jobPickerWindow.close();
    }
  });
}
