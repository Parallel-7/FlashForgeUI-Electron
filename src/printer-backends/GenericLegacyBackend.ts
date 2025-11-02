/**
 * @fileoverview Backend implementation for legacy FlashForge printers using FlashForgeClient only.
 *
 * Provides backend support for legacy printers that only support the legacy TCP API:
 * - Single client operation (FlashForgeClient only, no FiveMClient)
 * - Basic job control (pause/resume/cancel via G-code)
 * - G-code command execution
 * - Status monitoring through legacy status parsing
 * - Custom camera URL support (no built-in camera)
 * - Custom LED control via G-code (when enabled)
 * - No built-in features (filtration, material station)
 *
 * Key exports:
 * - GenericLegacyBackend class: Backend for legacy printer models
 *
 * This backend serves as a fallback for older printer models that don't support the
 * newer HTTP-based FiveMClient API. It provides basic functionality through G-code
 * commands and legacy status parsing, ensuring compatibility with all FlashForge printers.
 */

import { FlashForgeClient, TempInfo, TempData, EndstopStatus, MachineStatus, PrintStatus } from '@ghosttypes/ff-api';
import { BasePrinterBackend } from './BasePrinterBackend';
import {
  PrinterFeatureSet,
  CommandResult,
  GCodeCommandResult,
  StatusResult,
  JobListResult,
  JobStartResult,
  JobOperationParams,
  MaterialStationStatus,
  BasicJobInfo
} from '../types/printer-backend';

/**
 * Backend implementation for legacy printers
 * Uses FlashForgeClient only with no built-in features
 */
export class GenericLegacyBackend extends BasePrinterBackend {
  private readonly legacyClient: FlashForgeClient;
  
  constructor(options: import('../types/printer-backend').BackendInitOptions) {
    super(options);
    
    // Legacy backend only uses FlashForgeClient
    if (!(this.primaryClient instanceof FlashForgeClient)) {
      throw new Error('GenericLegacyBackend requires FlashForgeClient as primary client');
    }
    
    this.legacyClient = this.primaryClient;
  }
  
  /**
   * Get base features for legacy printers (no built-in features)
   */
  protected getBaseFeatures(): PrinterFeatureSet {
    return {
      camera: {
        builtin: false,
        customUrl: null,
        customEnabled: false
      },
      ledControl: {
        builtin: false,
        customControlEnabled: false,
        usesLegacyAPI: true
      },
      filtration: {
        available: false,
        controllable: false,
        reason: 'Hardware does not support filtration control'
      },
      gcodeCommands: {
        available: true,
        usesLegacyAPI: true,
        supportedCommands: this.getSupportedGCodeCommands()
      },
      statusMonitoring: {
        available: true,
        usesNewAPI: false,
        usesLegacyAPI: true,
        realTimeUpdates: false
      },
      jobManagement: {
        localJobs: true,
        recentJobs: true,
        uploadJobs: false,
        startJobs: true,
        pauseResume: true,
        cancelJobs: true,
        usesNewAPI: false
      },
      materialStation: {
        available: false,
        slotCount: 0,
        perSlotInfo: false,
        materialDetection: false
      }
    };
  }
  
  /**
   * Perform legacy-specific initialization
   */
  protected async initializeBackend(): Promise<void> {
    // Legacy printers don't require additional initialization
    // Connection is already established by PrinterConnectionManager
    console.log(`GenericLegacyBackend initialized for ${this.printerName}`);
  }
  
  /**
   * Execute G-code command using legacy API
   */
  public async executeGCodeCommand(command: string): Promise<GCodeCommandResult> {
    const startTime = Date.now();
    
    try {
      const response = await this.legacyClient.sendRawCmd(command);
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        command,
        response: String(response),
        executionTime,
        timestamp: new Date()
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        command,
        error: errorMessage,
        executionTime,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Get current printer status using legacy API
   */
  public async getPrinterStatus(): Promise<StatusResult> {
    try {
      // === RAW API DATA FETCHING (like legacy JavaScript version) ===
      
      // Get basic printer info
      const printerInfo = await this.legacyClient.getPrinterInfo();
      console.log('[DEBUG] Raw printerInfo response:', {
        type: typeof printerInfo,
        isNull: printerInfo === null,
        isUndefined: printerInfo === undefined,
        keys: printerInfo ? Object.keys(printerInfo) : [],
        printerInfo: printerInfo ? JSON.stringify(printerInfo, null, 2) : 'null/undefined'
      });
      
      // Get temperature info (like legacy version)
      let tempInfo: TempInfo | null = null;
      try {
        tempInfo = await this.legacyClient.getTempInfo();
      } catch {
        // Silently handle tempInfo errors
      }
      
      // Get endstop status (like legacy version)
      let endstopStatus: EndstopStatus | null = null;
      try {
        endstopStatus = await this.legacyClient.getEndstopInfo();
      } catch {
        // Silently handle endstopStatus errors
      }
      
      if (!printerInfo) {
        throw new Error('Failed to get printer information');
      }
      
      // === BUILDING STATUS OBJECT (using proper ff-api types) ===
      
      // Use proper ff-api temperature extraction
      let bedTemp = 0;
      let bedTarget = 0;
      let nozzleTemp = 0;
      let nozzleTarget = 0;
      
      if (tempInfo) {
        // Get bed temperature using proper types
        const bedTempData: TempData | null = tempInfo.getBedTemp();
        if (bedTempData) {
          bedTemp = bedTempData.getCurrent();
          bedTarget = bedTempData.getSet();
        }
        
        // Get extruder temperature using proper types
        const extruderTempData: TempData | null = tempInfo.getExtruderTemp();
        if (extruderTempData) {
          nozzleTemp = extruderTempData.getCurrent();
          nozzleTarget = extruderTempData.getSet();
        }
      }
      // If tempInfo is null, temperatures remain at default 0 values
      
      // Use proper ff-api state extraction with explicit switch
      let printerState = 'unknown';
      if (endstopStatus) {
        // Use explicit switch for reliable core parsing logic
        const machineStatus: MachineStatus = endstopStatus._MachineStatus;
        
        switch (machineStatus) {
          case MachineStatus.BUILDING_FROM_SD:
            printerState = 'printing';
            break;
          case MachineStatus.BUILDING_COMPLETED:
            printerState = 'completed';
            break;
          case MachineStatus.PAUSED:
            printerState = 'paused';
            break;
          case MachineStatus.READY:
            printerState = 'ready';
            break;
          case MachineStatus.BUSY:
            printerState = 'busy';
            break;
          case MachineStatus.DEFAULT:
          default:
            printerState = 'unknown';
            break;
        }
      }
      // If endstopStatus is null, printerState remains 'unknown'
      
      // === ENHANCED PRINT STATUS INTEGRATION ===
      // Conditionally get detailed print status when printer is actively printing
      let progress = 0;
      let currentLayer: number | undefined = undefined;
      let totalLayers: number | undefined = undefined;
      const enhancedJobName: string | undefined = endstopStatus?._CurrentFile || undefined;
      
      const isActivePrinting = printerState === 'printing' || printerState === 'paused';
      if (isActivePrinting) {
        try {
          console.log('[GenericLegacyBackend] Fetching PrintStatus for active print...');
          const printStatus: PrintStatus | null = await this.legacyClient.getPrintStatus();
          
          if (printStatus) {
            // Extract progress percentage
            const progressPercent = printStatus.getPrintPercent();
            if (!isNaN(progressPercent)) {
              progress = progressPercent;
              console.log(`[GenericLegacyBackend] Progress: ${progress}%`);
            }
            
            // Extract layer information
            const layerProgress = printStatus.getLayerProgress();
            if (layerProgress && layerProgress.includes('/')) {
              const layerParts = layerProgress.split('/');
              const current = parseInt(layerParts[0]?.trim() || '0', 10);
              const total = parseInt(layerParts[1]?.trim() || '0', 10);
              
              if (!isNaN(current) && current > 0) {
                currentLayer = current;
              }
              if (!isNaN(total) && total > 0) {
                totalLayers = total;
              }
              
              console.log(`[GenericLegacyBackend] Layers: ${currentLayer}/${totalLayers}`);
            }
            
            // Enhanced job name could be extracted from PrintStatus if needed
            // For now, keep using endstopStatus._CurrentFile as it's reliable
          } else {
            console.log('[GenericLegacyBackend] PrintStatus returned null');
          }
        } catch (error) {
          // Don't fail the entire status call if PrintStatus fails
          console.warn('[GenericLegacyBackend] Failed to get PrintStatus:', error instanceof Error ? error.message : String(error));
        }
      }
      
      const status = {
        printerState,
        bedTemperature: bedTemp,
        bedTargetTemperature: bedTarget,
        nozzleTemperature: nozzleTemp,
        nozzleTargetTemperature: nozzleTarget,
        progress, // Now using PrintStatus.getPrintPercent() when available
        currentJob: enhancedJobName,
        // Legacy API does NOT provide estimatedTime or remainingTime
        estimatedTime: undefined,
        remainingTime: undefined,
        // Now using PrintStatus.getLayerProgress() when available
        currentLayer,
        totalLayers,
        // Legacy printers don't provide these fields
        cumulativePrintTime: 0,
        cumulativeFilament: 0,
        nozzleSize: undefined,
        filamentType: undefined,
        printSpeedAdjust: undefined,
        zAxisCompensation: undefined,
        coolingFanSpeed: undefined,
        chamberFanSpeed: undefined,
        tvoc: undefined
      };
      
      return {
        success: true,
        status,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        status: {
          printerState: 'error',
          bedTemperature: 0,
          nozzleTemperature: 0,
          progress: 0,
          currentLayer: undefined,
          totalLayers: undefined
        }
      };
    }
  }
  
  /**
   * Get list of local jobs stored on the printer
   */
  public async getLocalJobs(): Promise<JobListResult> {
    try {
      // Use M661 command via ff-api to list all files on SD card
      const fileNames = await this.legacyClient.getFileListAsync();
      
      // Convert filenames to BasicJobInfo objects
      const jobs: BasicJobInfo[] = fileNames.map(fileName => ({
        fileName,
        printingTime: 0 // Legacy printers don't provide time estimates via M661
      }));
      
      return {
        success: true,
        jobs,
        totalCount: jobs.length,
        source: 'local',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        jobs: [],
        totalCount: 0,
        source: 'local',
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Get list of recent jobs from the printer
   * Returns the first 10 files from the SD card via M661
   */
  public async getRecentJobs(): Promise<JobListResult> {
    try {
      // Use M661 command via ff-api to list files, then limit to first 10
      const fileNames = await this.legacyClient.getFileListAsync();
      const recentFileNames = fileNames.slice(0, 10);
      
      // Convert filenames to BasicJobInfo objects
      const jobs: BasicJobInfo[] = recentFileNames.map(fileName => ({
        fileName,
        printingTime: 0 // Legacy printers don't provide time estimates via M661
      }));
      
      return {
        success: true,
        jobs,
        totalCount: jobs.length,
        source: 'recent',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        jobs: [],
        totalCount: 0,
        source: 'recent',
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Start a job on legacy printer using proper ff-api method
   */
  public async startJob(params: JobOperationParams): Promise<JobStartResult> {
    try {
      if (!params.fileName) {
        return {
          success: false,
          error: 'fileName is required for legacy printers',
          fileName: '',
          started: false,
          timestamp: new Date()
        };
      }
      
      // Use the proper FlashForgeClient.startJob method which handles
      // the correct M23 0:/user/filename format automatically
      const result = await this.legacyClient.startJob(params.fileName);
      
      if (!result) {
        return {
          success: false,
          error: 'Failed to start print job - printer rejected command',
          fileName: params.fileName,
          started: false,
          timestamp: new Date()
        };
      }
      
      return {
        success: true,
        fileName: params.fileName,
        started: true,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fileName: params.fileName || '',
        started: false,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Pause current job using proper ff-api method
   */
  public async pauseJob(): Promise<CommandResult> {
    try {
      const result = await this.legacyClient.pauseJob();
      
      if (!result) {
        return {
          success: false,
          error: 'Failed to pause job - printer rejected command',
          timestamp: new Date()
        };
      }
      
      return {
        success: true,
        data: 'Job paused',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Resume paused job using proper ff-api method
   */
  public async resumeJob(): Promise<CommandResult> {
    try {
      const result = await this.legacyClient.resumeJob();
      
      if (!result) {
        return {
          success: false,
          error: 'Failed to resume job - printer rejected command',
          timestamp: new Date()
        };
      }
      
      return {
        success: true,
        data: 'Job resumed',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Cancel current job using proper ff-api method
   */
  public async cancelJob(): Promise<CommandResult> {
    try {
      const result = await this.legacyClient.stopJob();
      
      if (!result) {
        return {
          success: false,
          error: 'Failed to cancel job - printer rejected command',
          timestamp: new Date()
        };
      }
      
      return {
        success: true,
        data: 'Job cancelled',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Get material station status (not supported on legacy printers)
   */
  public getMaterialStationStatus(): MaterialStationStatus | null {
    return null;
  }
  
  /**
   * Get model preview image using M662 command
   * M662 has a unique response format where PNG data comes AFTER the "ok" response
   */
  public async getModelPreview(): Promise<string | null> {
    try {
      // Check if printer is currently printing
      const status = await this.getPrinterStatus();
      if (!status.success || !status.status.currentJob) {
        // No active print job, no preview available
        return null;
      }
      
      // Use the general job thumbnail method for the current job
      return this.getJobThumbnail(status.status.currentJob);
      
    } catch (error) {
      console.error('Error getting model preview:', error);
      return null;
    }
  }

  /**
   * Get thumbnail image for any job file by filename
   * Uses FlashForgeClient getThumbnail method with M662 command
   */
  public async getJobThumbnail(fileName: string): Promise<string | null> {
    try {
      if (!fileName || fileName === '') {
        console.warn('getJobThumbnail: No filename provided');
        return null;
      }
      
      console.log(`[ThumbnailRequest] Starting thumbnail request for: ${fileName}`);
      
      // Use the FlashForgeClient getThumbnail method
      const thumbnailInfo = await this.legacyClient.getThumbnail(fileName);
      
      if (!thumbnailInfo) {
        console.warn(`No thumbnail available for file: ${fileName}`);
        return null;
      }
      
      // Get the base64 data using the proper method
      const base64Data = thumbnailInfo.getImageData();
      if (!base64Data) {
        console.warn(`Thumbnail data is empty for file: ${fileName}`);
        return null;
      }
      
      console.log(`[ThumbnailRequest] Successfully fetched thumbnail for: ${fileName}`);
      
      // Convert to base64 data URL
      return `data:image/png;base64,${base64Data}`;
      
    } catch (error) {
      console.error(`Error getting thumbnail for ${fileName}:`, error);
      return null;
    }
  }
  
  /**
   * Set LED enabled state using proper ff-api methods
   * Requires Custom LEDs setting to be enabled (user must opt-in)
   * Matches Main UI IPC handler logic for identical behavior across UIs
   */
  public async setLedEnabled(enabled: boolean): Promise<CommandResult> {
    try {
      // Check if LED control is available (requires Custom LEDs setting for Generic Legacy)
      if (!this.isFeatureAvailable('led-control')) {
        return {
          success: false,
          error: 'LED control not available on this printer. Enable "Custom LEDs" in printer settings to use LED control.',
          timestamp: new Date()
        };
      }

      // Use proper FlashForgeClient LED methods
      const result = enabled ? await this.legacyClient.ledOn() : await this.legacyClient.ledOff();

      if (!result) {
        return {
          success: false,
          error: `Failed to ${enabled ? 'turn on' : 'turn off'} LED - printer rejected command`,
          timestamp: new Date()
        };
      }

      return {
        success: true,
        data: enabled ? 'LED turned on (TCP API)' : 'LED turned off (TCP API)',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }
  
  // Feature detection methods
  
  protected supportsNewAPI(): boolean {
    return false;
  }
  
  protected supportsCustomLEDControl(): boolean {
    // Legacy printers expose LED control through the legacy API when enabled via settings
    return true;
  }
  
  protected supportsMaterialStation(): boolean {
    return false;
  }
  
  protected supportsLocalJobs(): boolean {
    return true;
  }
  
  protected supportsRecentJobs(): boolean {
    return true; // Legacy printers now support recent jobs via M661 (first 10 files)
  }
  
  protected supportsUploadJobs(): boolean {
    return false;
  }
  
  protected supportsStartJobs(): boolean {
    return true;
  }
  
  protected getSupportedGCodeCommands(): readonly string[] {
    return [
      'G0', 'G1', 'G28', 'G29', 'G90', 'G91', 'G92',
      'M0', 'M1', 'M17', 'M18', 'M20', 'M21', 'M23', 'M24', 'M25', 'M26',
      'M104', 'M105', 'M106', 'M107', 'M109', 'M140', 'M190',
      'M200', 'M201', 'M203', 'M204', 'M205', 'M206', 'M207', 'M208', 'M209',
      'M220', 'M221', 'M301', 'M302', 'M303', 'M304', 'M400', 'M500', 'M501',
      'M502', 'M503', 'M504', 'M905', 'M906', 'M907', 'M908'
    ];
  }
  
  protected getMaterialStationSlotCount(): number {
    return 0;
  }
}

