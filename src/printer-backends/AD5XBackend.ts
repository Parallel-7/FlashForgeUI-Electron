// src/printer-backends/AD5XBackend.ts
// Backend implementation for AD5X printer with material station support
// REFACTORED: Now extends DualAPIBackend to reduce code duplication
// UPDATED: Implements new job start methods using ff-api's AD5X-specific functionality

import { DualAPIBackend } from './DualAPIBackend';
import {
  PrinterFeatureSet,
  MaterialStationStatus,
  AD5XJobInfo,
  BasicJobInfo,
  JobListResult,
  JobStartResult,
  JobOperationParams
} from '../types/printer-backend';
import {
  isAD5XMachineInfo,
  extractMaterialStationStatus
} from './ad5x';
import type { AD5XMaterialMapping, AD5XUploadParams } from 'ff-api';
import * as path from 'path';

/**
 * Backend implementation for AD5X printer
 * Uses dual API with material station support
 */
export class AD5XBackend extends DualAPIBackend {
  private lastMachineInfo: unknown = null; // Store last machine info for material station data
  
  /**
   * Get child-specific base features for AD5X - includes material station functionality
   * LED and filtration will be auto-detected from product endpoint
   */
  protected getChildBaseFeatures(): PrinterFeatureSet {
    return {
      camera: {
        builtin: false,  // AD5X doesn't have built-in camera
        customUrl: null,
        customEnabled: false
      },
      ledControl: {
        builtin: false,  // AD5X requires CustomLeds to be enabled for any LED control
        customControlEnabled: false, // Will be overridden by settings
        usesLegacyAPI: true
      },
      filtration: {
        available: false,  // AD5X doesn't have built-in filtration
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
        usesNewAPI: true,
        usesLegacyAPI: true,
        realTimeUpdates: true
      },
      jobManagement: {
        localJobs: false,  // AD5X doesn't support local file listing
        recentJobs: true,
        uploadJobs: true,
        startJobs: true,  // AD5X now supports job starting with new ff-api
        pauseResume: true,
        cancelJobs: true,
        usesNewAPI: true
      },
      materialStation: {
        available: true,  // AD5X has material station - this is the key difference
        slotCount: 4,     // AD5X typically has 4 material slots
        perSlotInfo: true,
        materialDetection: true
      }
    };
  }
  
  /**
   * Perform AD5X-specific initialization
   */
  protected async initializeBackend(): Promise<void> {
    // Call parent initialization
    await super.initializeBackend();
    
    console.log('- Material station: Available with 4 slots');
    console.log('- Job starting: Enabled with material station support');
    
    // Initialize material station monitoring
    this.initializeMaterialStationMonitoring();
  }
  
  /**
   * Initialize material station monitoring
   */
  private initializeMaterialStationMonitoring(): void {
    try {
      // Get initial material station status
      const status = this.getMaterialStationStatus();
      if (status) {
        console.log(`Material station initialized with ${status.slots.length} slots`);
      }
    } catch (error) {
      console.warn('Failed to initialize material station monitoring:', error);
    }
  }
  
  /**
   * Process machine info for material station data extraction
   * Override from DualAPIBackend
   */
  protected async processMachineInfo(_machineInfo: unknown): Promise<void> {
    // Store machine info for material station data extraction with type validation
    if (isAD5XMachineInfo(_machineInfo)) {
      this.lastMachineInfo = _machineInfo;
    } else {
      console.warn('Invalid machine info structure received from API');
      this.lastMachineInfo = null;
    }
  }
  
  /**
   * Get additional status fields specific to AD5X
   * Override from DualAPIBackend
   */
  protected getAdditionalStatusFields(_machineInfo: unknown): Record<string, unknown> {
    // AD5X doesn't add any additional fields beyond the base implementation
    return {};
  }
  
  /**
   * Transform job list for AD5X-specific formatting
   * Override from DualAPIBackend to handle AD5XJobInfo
   */
  protected transformJobList(jobs: BasicJobInfo[], source: 'local' | 'recent'): BasicJobInfo[] {
    if (source === 'recent' && this.lastMachineInfo) {
      // AD5X returns AD5XJobInfo[] with additional fields for recent jobs
      // but we still return BasicJobInfo[] from the method
      return jobs;
    }
    return jobs;
  }

  /**
   * Override getRecentJobs to preserve full FFGcodeFileEntry data for AD5X
   */
  public async getRecentJobs(): Promise<JobListResult> {
    try {
      const recentJobs = await this.fiveMClient.files.getRecentFileList();
      
      if (!recentJobs || !Array.isArray(recentJobs)) {
        throw new Error('Failed to get recent jobs');
      }
      
      // For AD5X, preserve full FFGcodeFileEntry data as AD5XJobInfo
      const jobs: AD5XJobInfo[] = recentJobs.map((fileEntry) => ({
        fileName: fileEntry.gcodeFileName,
        printingTime: fileEntry.printingTime,
        toolCount: fileEntry.gcodeToolCnt,
        toolDatas: fileEntry.gcodeToolDatas,
        totalFilamentWeight: fileEntry.totalFilamentWeight,
        useMatlStation: fileEntry.useMatlStation,
        _type: 'ad5x' as const
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
   * Start a job on AD5X printer
   * Uses new ff-api methods for AD5X-specific job starting
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
      
      // Check if material mappings are provided for multi-color job
      const materialMappings = params.additionalParams?.materialMappings as AD5XMaterialMapping[] | undefined;
      
      if (materialMappings && materialMappings.length > 0) {
        // Multi-color job with material station
        console.log(`Starting AD5X multi-color job: ${params.fileName} with ${materialMappings.length} material mappings`);
        
        const success = await this.fiveMClient.jobControl.startAD5XMultiColorJob({
          fileName: params.fileName,
          levelingBeforePrint: params.leveling,
          materialMappings
        });
        
        if (!success) {
          throw new Error('Failed to start multi-color job');
        }
      } else {
        // Single-color job without material station
        console.log(`Starting AD5X single-color job: ${params.fileName}`);
        
        const success = await this.fiveMClient.jobControl.startAD5XSingleColorJob({
          fileName: params.fileName,
          levelingBeforePrint: params.leveling
        });
        
        if (!success) {
          throw new Error('Failed to start single-color job');
        }
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
   * Upload a file to AD5X printer with material station support
   * Uses the new ff-api uploadFileAD5X method for enhanced 3MF multi-color functionality
   */
  public async uploadFileAD5X(
    filePath: string,
    startPrint: boolean,
    levelingBeforePrint: boolean,
    materialMappings?: AD5XMaterialMapping[]
  ): Promise<JobStartResult> {
    try {
      const uploadParams: AD5XUploadParams = {
        filePath,
        startPrint,
        levelingBeforePrint,
        flowCalibration: false,
        firstLayerInspection: false,
        timeLapseVideo: false,
        materialMappings: materialMappings || []
      };
      
      console.log(`AD5X upload: ${path.basename(filePath)}, start: ${startPrint}, level: ${levelingBeforePrint}, mappings: ${materialMappings?.length || 0}`);
      
      const success = await this.fiveMClient.jobControl.uploadFileAD5X(uploadParams);
      
      if (!success) {
        throw new Error('Failed to upload file to AD5X printer');
      }
      
      return {
        success: true,
        fileName: path.basename(filePath),
        started: startPrint,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fileName: path.basename(filePath),
        started: false,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Get material station status (supported on AD5X)
   */
  public getMaterialStationStatus(): MaterialStationStatus | null {
    return extractMaterialStationStatus(this.lastMachineInfo);
  }
  
  // Feature detection methods specific to AD5X
  
  protected supportsMaterialStation(): boolean {
    return true; // AD5X has material station
  }
  
  protected supportsLocalJobs(): boolean {
    return false; // AD5X doesn't support local job listing
  }
  
  protected supportsStartJobs(): boolean {
    return true; // AD5X now supports job starting with new ff-api
  }
  
  protected getMaterialStationSlotCount(): number {
    return 4; // AD5X has 4 material slots
  }
}
