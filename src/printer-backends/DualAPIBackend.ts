/**
 * @fileoverview Abstract base class for dual-API printer backends using both FiveMClient and FlashForgeClient.
 *
 * Provides common implementation for modern printers that support both HTTP and TCP APIs:
 * - Dual client management (FiveMClient for HTTP, FlashForgeClient for G-code)
 * - Product information fetching and caching
 * - Automatic LED and filtration detection from product endpoint
 * - Enhanced job management (local/recent jobs, upload, start with leveling)
 * - Real-time status monitoring via new API
 * - Reduced code duplication across Adventurer 5M/Pro and AD5X backends
 *
 * Key exports:
 * - DualAPIBackend abstract class: Foundation for dual-API printers
 *
 * Child classes must implement:
 * - getChildBaseFeatures(): Define model-specific base features
 * - getMaterialStationStatus(): Material station support (or return empty status)
 *
 * This abstraction extracts common functionality from Adventurer5MBackend, Adventurer5MProBackend,
 * and AD5XBackend, reducing code duplication while maintaining model-specific feature differentiation.
 */

import { FiveMClient, FlashForgeClient, Product } from '@ghosttypes/ff-api';
import { BasePrinterBackend } from './BasePrinterBackend';
import {
  BackendInitOptions,
  CommandResult,
  GCodeCommandResult,
  StatusResult,
  JobListResult,
  JobStartResult,
  JobOperationParams,
  BasicJobInfo,
  PrinterFeatureSet
} from '../types/printer-backend';

/**
 * Abstract base class for dual-API printer backends
 * Provides common implementation for printers using both FiveMClient and FlashForgeClient
 */
export abstract class DualAPIBackend extends BasePrinterBackend {
  protected fiveMClient!: FiveMClient;
  protected legacyClient!: FlashForgeClient;
  protected productInfo: Product | null = null;
  
  constructor(options: BackendInitOptions) {
    super(options);
    this.initializeClients();
  }
  
  /**
   * Initialize and validate API clients
   * Common initialization logic for all dual-API backends
   */
  protected initializeClients(): void {
    // Validate primary client is FiveMClient
    if (!(this.primaryClient instanceof FiveMClient)) {
      throw new Error(`${this.constructor.name} requires FiveMClient as primary client`);
    }
    
    // Validate secondary client is FlashForgeClient
    if (!this.secondaryClient || !(this.secondaryClient instanceof FlashForgeClient)) {
      throw new Error(`${this.constructor.name} requires FlashForgeClient as secondary client`);
    }
    
    this.fiveMClient = this.primaryClient;
    this.legacyClient = this.secondaryClient;
  }
  
  /**
   * Initialize the backend with feature detection
   * Overrides parent to fetch product info before building features
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized()) {
      return;
    }
    
    try {
      // Validate primary client connection
      await this.validatePrimaryClient();
      
      // Initialize secondary client if available
      if (this.secondaryClient) {
        await this.validateSecondaryClient();
      }
      
      // Fetch product info BEFORE building feature set
      await this.fetchProductInfo();
      
      // Now call parent initialize which will build features using our product info
      await super.initialize();
      
    } catch (error) {
      this.emitEvent('error', null, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  
  /**
   * Check if backend is already initialized
   */
  private isInitialized(): boolean {
    return this.getBackendStatus().initialized;
  }
  
  /**
   * Perform backend-specific initialization
   * Override in subclasses for model-specific setup
   */
  protected async initializeBackend(): Promise<void> {
    // Log initialization with backend name
    console.log(`${this.constructor.name} initialized for ${this.printerName}`);
    console.log('- Primary client (FiveMClient): Available');
    console.log('- Secondary client (FlashForgeClient): Available');
    
    // Log detected features if we have product info
    if (this.productInfo) {
      console.log('Auto-detected features from product endpoint:');
      console.log(`- LED control: ${this.productInfo.lightCtrlState !== 0 ? 'Available' : 'Not available'}`);
      console.log(`- Filtration: ${(this.productInfo.internalFanCtrlState !== 0 || this.productInfo.externalFanCtrlState !== 0) ? 'Available' : 'Not available'}`);
      if (this.productInfo.internalFanCtrlState !== 0 || this.productInfo.externalFanCtrlState !== 0) {
        console.log(`  - Internal fan control: ${this.productInfo.internalFanCtrlState !== 0 ? 'Yes' : 'No'}`);
        console.log(`  - External fan control: ${this.productInfo.externalFanCtrlState !== 0 ? 'Yes' : 'No'}`);
      }
    }
    
    // Subclasses can extend this for additional initialization
  }
  
  /**
   * Fetch product info from printer for feature detection
   */
  protected async fetchProductInfo(): Promise<void> {
    try {
      // Call sendProductCommand to populate productInfo
      const success = await this.fiveMClient.sendProductCommand();
      
      if (!success || !this.fiveMClient.productInfo) {
        console.warn('Failed to retrieve product info for feature detection');
        return;
      }
      
      // Store product info for use in getBaseFeatures
      this.productInfo = this.fiveMClient.productInfo;
      
    } catch (error) {
      console.error('Error fetching product info:', error);
      // Continue without product info - features will use defaults
    }
  }
  
  /**
   * Get base features for dual-API backends
   * Uses product info to determine LED and filtration availability
   */
  protected getBaseFeatures(): PrinterFeatureSet {
    // Get child-specific features first
    const childFeatures = this.getChildBaseFeatures();
    
    // Override LED and filtration based on product info if available
    if (this.productInfo) {
      const hasFiltration = this.productInfo.internalFanCtrlState !== 0 || 
                           this.productInfo.externalFanCtrlState !== 0;
      
      // For AD5X, respect the child's LED settings (don't auto-detect)
      // AD5X requires CustomLeds to be enabled for any LED control
      const ledBuiltin = this.modelType === 'ad5x' 
        ? childFeatures.ledControl.builtin 
        : this.productInfo.lightCtrlState !== 0;
      
      // Return new object with overridden values
      return {
        ...childFeatures,
        ledControl: {
          ...childFeatures.ledControl,
          builtin: ledBuiltin
        },
        filtration: {
          available: hasFiltration,
          controllable: hasFiltration,
          reason: hasFiltration 
            ? 'Hardware supports filtration control' 
            : 'Hardware does not support filtration control'
        }
      };
    }
    
    return childFeatures;
  }
  
  /**
   * Get child-specific base features
   * Must be implemented by child classes
   */
  protected abstract getChildBaseFeatures(): PrinterFeatureSet;
  
  /**
   * Execute G-code command using legacy API
   * Common implementation for all dual-API backends
   */
  public async executeGCodeCommand(command: string): Promise<GCodeCommandResult> {
    const startTime = Date.now();
    
    try {
      // G-code commands always use legacy API
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
   * Get current printer status using new API with legacy fallback
   * Common implementation with hooks for backend-specific fields
   */
  public async getPrinterStatus(): Promise<StatusResult> {
    try {
      // Use new API for status monitoring
      const status = await this.fiveMClient.info.getStatus();
      
      if (!status) {
        throw new Error('Failed to get printer status');
      }
      
      // Get detailed machine info for additional data
      const machineInfo = await this.fiveMClient.info.get();
      
      // Allow subclasses to process machine info
      await this.processMachineInfo(machineInfo);
      
      // Calculate time estimates properly
      const estimatedTimeSeconds = machineInfo?.EstimatedTime || 0;
      const elapsedTimeSeconds = machineInfo?.PrintDuration || 0;
      const remainingTimeSeconds = estimatedTimeSeconds > elapsedTimeSeconds 
        ? estimatedTimeSeconds - elapsedTimeSeconds 
        : 0;
      
      const printerStatus = {
        printerState: status,
        bedTemperature: machineInfo?.PrintBed?.current || 0,
        bedTargetTemperature: machineInfo?.PrintBed?.set || 0,
        nozzleTemperature: machineInfo?.Extruder?.current || 0,
        nozzleTargetTemperature: machineInfo?.Extruder?.set || 0,
        progress: machineInfo?.PrintProgress || 0,
        currentJob: machineInfo?.PrintFileName || undefined,
        estimatedTime: estimatedTimeSeconds ? Math.round(estimatedTimeSeconds / 60) : undefined,
        remainingTime: remainingTimeSeconds ? Math.round(remainingTimeSeconds / 60) : undefined,
        printDuration: elapsedTimeSeconds,
        currentLayer: machineInfo?.CurrentPrintLayer || undefined,
        totalLayers: machineInfo?.TotalPrintLayers || undefined,
        estimatedRightLen: machineInfo?.EstLength || 0,
        estimatedRightWeight: machineInfo?.EstWeight || 0,
        printEta: machineInfo?.PrintEta || undefined,
        cumulativePrintTime: machineInfo?.CumulativePrintTime || 0,
        cumulativeFilament: machineInfo?.CumulativeFilament || 0,
        nozzleSize: machineInfo?.NozzleSize || '0.4mm',
        filamentType: machineInfo?.FilamentType || 'PLA',
        printSpeedAdjust: machineInfo?.PrintSpeedAdjust || 100,
        zAxisCompensation: machineInfo?.ZAxisCompensation || 0,
        coolingFanSpeed: machineInfo?.CoolingFanSpeed || 0,
        chamberFanSpeed: machineInfo?.ChamberFanSpeed || 0,
        tvoc: machineInfo?.Tvoc || 0,
        // Allow subclasses to add additional fields
        ...this.getAdditionalStatusFields(machineInfo)
      };
      
      return {
        success: true,
        status: printerStatus,
        timestamp: new Date()
      };
    } catch (error) {
      // Fallback to legacy API if new API fails
      return this.getPrinterStatusLegacy(error);
    }
  }
  
  /**
   * Get printer status using legacy API (fallback)
   */
  protected async getPrinterStatusLegacy(originalError: unknown): Promise<StatusResult> {
    try {
      const printerInfo = await this.legacyClient.getPrinterInfo();
      
      if (!printerInfo) {
        throw new Error('Failed to get printer information from legacy API');
      }
      
      const infoObj = printerInfo as unknown as Record<string, unknown>;
      
      const status = {
        printerState: String(infoObj.MachineStatus || infoObj.Status || 'unknown'),
        bedTemperature: parseFloat(String(infoObj.BedTemperature || infoObj.BedTemp || '0')),
        nozzleTemperature: parseFloat(String(infoObj.NozzleTemperature || infoObj.NozzleTemp || infoObj.ExtruderTemp || '0')),
        progress: parseFloat(String(infoObj.Progress || '0')),
        currentJob: infoObj.CurrentFile ? String(infoObj.CurrentFile) : undefined,
        estimatedTime: undefined,
        remainingTime: undefined,
        currentLayer: infoObj.CurrentPrintLayer ? parseInt(String(infoObj.CurrentPrintLayer)) : undefined,
        totalLayers: infoObj.TotalPrintLayers ? parseInt(String(infoObj.TotalPrintLayers)) : undefined
      };
      
      return {
        success: true,
        status,
        timestamp: new Date()
      };
    } catch (fallbackError) { // eslint-disable-line @typescript-eslint/no-unused-vars
      return {
        success: false,
        error: originalError instanceof Error ? originalError.message : String(originalError),
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
   * Get list of local jobs using new API
   */
  public async getLocalJobs(): Promise<JobListResult> {
    try {
      const localJobs = await this.fiveMClient.files.getLocalFileList();
      
      if (!localJobs || !Array.isArray(localJobs)) {
        throw new Error('Failed to get local jobs');
      }
      
      // Local file list returns string[] - convert to BasicJobInfo[]
      const jobs: BasicJobInfo[] = localJobs.map((fileName: string) => ({
        fileName,
        printingTime: 0 // Local file list doesn't provide timing information
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
   * Get list of recent jobs using new API
   */
  public async getRecentJobs(): Promise<JobListResult> {
    try {
      const recentJobs = await this.fiveMClient.files.getRecentFileList();
      
      if (!recentJobs || !Array.isArray(recentJobs)) {
        throw new Error('Failed to get recent jobs');
      }
      
      // Recent jobs return FFGcodeFileEntry[]
      const jobs: BasicJobInfo[] = recentJobs.map((fileEntry) => ({
        fileName: fileEntry.gcodeFileName,
        printingTime: fileEntry.printingTime
      }));
      
      // Allow subclasses to transform job data
      const transformedJobs = this.transformJobList(jobs, 'recent');
      
      return {
        success: true,
        jobs: transformedJobs,
        totalCount: transformedJobs.length,
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
   * Start a job using new API
   */
  public async startJob(params: JobOperationParams): Promise<JobStartResult> {
    try {
      // Handle file upload case
      if (params.filePath) {
        const success = await this.fiveMClient.jobControl.uploadFile(
          params.filePath,
          params.startNow,
          params.leveling
        );
        
        if (!success) {
          throw new Error('Failed to upload and start job');
        }
        
        return {
          success: true,
          fileName: params.fileName || params.filePath,
          started: params.startNow,
          timestamp: new Date()
        };
      }
      
      // Handle local file printing case
      if (!params.fileName) {
        throw new Error('fileName or filePath is required');
      }
      
      // Only proceed with printing if startNow is true
      if (!params.startNow) {
        return {
          success: true,
          fileName: params.fileName,
          started: false,
          timestamp: new Date()
        };
      }
      
      const success = await this.fiveMClient.jobControl.printLocalFile(params.fileName, params.leveling);
      
      if (!success) {
        throw new Error('Failed to start job');
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
   * Pause current job using new API with legacy fallback
   */
  public async pauseJob(): Promise<CommandResult> {
    try {
      const success = await this.fiveMClient.jobControl.pausePrintJob();
      
      if (!success) {
        throw new Error('Failed to pause job');
      }
      
      return {
        success: true,
        data: 'Job paused',
        timestamp: new Date()
      };
    } catch (error) {
      // Fallback to legacy API
      try {
        await this.legacyClient.sendRawCmd('M25');
        return {
          success: true,
          data: 'Job paused (via legacy API)',
          timestamp: new Date()
        };
      } catch (fallbackError) { // eslint-disable-line @typescript-eslint/no-unused-vars
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        };
      }
    }
  }
  
  /**
   * Resume paused job using new API with legacy fallback
   */
  public async resumeJob(): Promise<CommandResult> {
    try {
      const success = await this.fiveMClient.jobControl.resumePrintJob();
      
      if (!success) {
        throw new Error('Failed to resume job');
      }
      
      return {
        success: true,
        data: 'Job resumed',
        timestamp: new Date()
      };
    } catch (error) {
      // Fallback to legacy API
      try {
        await this.legacyClient.sendRawCmd('M24');
        return {
          success: true,
          data: 'Job resumed (via legacy API)',
          timestamp: new Date()
        };
      } catch (fallbackError) { // eslint-disable-line @typescript-eslint/no-unused-vars
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        };
      }
    }
  }
  
  /**
   * Cancel current job using new API with legacy fallback
   */
  public async cancelJob(): Promise<CommandResult> {
    try {
      const success = await this.fiveMClient.jobControl.cancelPrintJob();
      
      if (!success) {
        throw new Error('Failed to cancel job');
      }
      
      return {
        success: true,
        data: 'Job cancelled',
        timestamp: new Date()
      };
    } catch (error) {
      // Fallback to legacy API
      try {
        await this.legacyClient.sendRawCmd('M26');
        return {
          success: true,
          data: 'Job cancelled (via legacy API)',
          timestamp: new Date()
        };
      } catch (fallbackError) { // eslint-disable-line @typescript-eslint/no-unused-vars
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        };
      }
    }
  }
  
  /**
   * Get model preview image for current print job
   */
  public async getModelPreview(): Promise<string | null> {
    try {
      // First check if printer is currently printing
      const machineInfo = await this.fiveMClient.info.get();
      
      if (!machineInfo || !machineInfo.PrintFileName || machineInfo.PrintFileName === '') {
        // No active print job, no preview available
        return null;
      }
      
      // Use the general job thumbnail method for the current job
      return this.getJobThumbnail(machineInfo.PrintFileName);
      
    } catch (error) {
      console.error('Error getting model preview:', error);
      return null;
    }
  }

  /**
   * Get thumbnail image for any job file by filename
   */
  public async getJobThumbnail(fileName: string): Promise<string | null> {
    try {
      if (!fileName || fileName === '') {
        console.warn('getJobThumbnail: No filename provided');
        return null;
      }
      
      // Get the thumbnail for the specified file
      const thumbnailBuffer = await this.fiveMClient.files.getGCodeThumbnail(fileName);
      
      if (!thumbnailBuffer || thumbnailBuffer.length === 0) {
        console.warn(`No thumbnail available for file: ${fileName}`);
        return null;
      }
      
      // Convert buffer to base64 data URL
      const base64Data = thumbnailBuffer.toString('base64');
      return `data:image/png;base64,${base64Data}`;
      
    } catch (error) {
      console.error(`Error getting thumbnail for ${fileName}:`, error);
      return null;
    }
  }
  
  /**
   * Set LED enabled state with smart API routing based on printer model
   * Matches Main UI IPC handler logic for identical behavior across UIs
   *
   * Routing logic:
   * - 5M Pro with builtin LEDs → HTTP API (FiveMClient)
   * - 5M and AD5X → TCP API (FlashForgeClient, auto-enabled)
   * - Generic printers not supported by DualAPIBackend
   */
  public async setLedEnabled(enabled: boolean): Promise<CommandResult> {
    try {
      const features = this.getBackendStatus().features;

      if (!features) {
        return {
          success: false,
          error: 'Cannot determine printer features',
          timestamp: new Date()
        };
      }

      if (features.ledControl.builtin) {
        // 5M Pro with factory LEDs → Use HTTP API
        const success = enabled
          ? await this.fiveMClient.control.setLedOn()
          : await this.fiveMClient.control.setLedOff();

        return {
          success,
          data: enabled ? 'LED turned on (HTTP API)' : 'LED turned off (HTTP API)',
          error: success ? undefined : 'Failed to control LED',
          timestamp: new Date()
        };
      } else if (this.modelType === 'adventurer-5m' || this.modelType === 'ad5x') {
        // 5M and AD5X → Always use TCP API (auto-enabled)
        const success = enabled
          ? await this.legacyClient.ledOn()
          : await this.legacyClient.ledOff();

        return {
          success,
          data: enabled ? 'LED turned on (TCP API - auto-enabled)' : 'LED turned off (TCP API - auto-enabled)',
          error: success ? undefined : 'Failed to control LED',
          timestamp: new Date()
        };
      } else {
        // Should not reach here for dual-API backends, but handle gracefully
        return {
          success: false,
          error: 'LED control not available for this printer model',
          timestamp: new Date()
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
    }
  }
  
  // Feature detection methods - common implementations
  
  protected supportsNewAPI(): boolean {
    return true; // All dual-API backends support new API
  }
  
  protected supportsCustomLEDControl(): boolean {
    return true; // All current dual-API backends support custom LED control
  }
  
  protected supportsLocalJobs(): boolean {
    return true; // All dual-API backends support local jobs
  }
  
  protected supportsRecentJobs(): boolean {
    return true; // All dual-API backends support recent jobs
  }
  
  protected supportsUploadJobs(): boolean {
    return true; // All dual-API backends support upload jobs
  }
  
  protected supportsStartJobs(): boolean {
    return true; // All dual-API backends support starting jobs
  }
  
  protected getSupportedGCodeCommands(): readonly string[] {
    // Common G-code commands supported by all dual-API printers
    return [
      'G0', 'G1', 'G28', 'G29', 'G90', 'G91', 'G92',
      'M0', 'M1', 'M17', 'M18', 'M20', 'M21', 'M23', 'M24', 'M25', 'M26',
      'M104', 'M105', 'M106', 'M107', 'M109', 'M140', 'M190',
      'M200', 'M201', 'M203', 'M204', 'M205', 'M206', 'M207', 'M208', 'M209',
      'M220', 'M221', 'M301', 'M302', 'M303', 'M304', 'M400', 'M500', 'M501',
      'M502', 'M503', 'M504', 'M905', 'M906', 'M907', 'M908'
    ];
  }
  
  // Hooks for subclasses to customize behavior
  
  /**
   * Process machine info for backend-specific handling
   * Override in subclasses that need to store machine info (e.g., AD5X for material station)
   */
  protected async processMachineInfo(_machineInfo: unknown): Promise<void> {
    // Default implementation does nothing
    // AD5X backend will override to store for material station data
  }
  
  /**
   * Get additional status fields for backend-specific data
   * Override in subclasses to add model-specific fields
   */
  protected getAdditionalStatusFields(_machineInfo: unknown): Record<string, unknown> {
    // Default implementation returns empty object
    // 5M Pro backend will override to add filtration fan fields
    return {};
  }
  
  /**
   * Transform job list for backend-specific formatting
   * Override in subclasses that need custom job formatting (e.g., AD5X)
   */
  protected transformJobList(jobs: BasicJobInfo[], _source: 'local' | 'recent'): BasicJobInfo[] {
    // Default implementation returns jobs unchanged
    return jobs;
  }
}

