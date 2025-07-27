// src/managers/PrinterBackendManager.ts
// Single coordinator for all printer backend operations
// Manages backend selection, lifecycle, and feature queries for UI integration

import { EventEmitter } from 'events';
import { FiveMClient, FlashForgeClient, AD5XMaterialMapping } from 'ff-api';
import { BasePrinterBackend } from '../printer-backends/BasePrinterBackend';
import { GenericLegacyBackend } from '../printer-backends/GenericLegacyBackend';
import { Adventurer5MBackend } from '../printer-backends/Adventurer5MBackend';
import { Adventurer5MProBackend } from '../printer-backends/Adventurer5MProBackend';
import { AD5XBackend } from '../printer-backends/AD5XBackend';
import { getConfigManager } from './ConfigManager';
import { getLoadingManager } from './LoadingManager';
import { PrinterDetails } from '../types/printer';
import {
  PrinterModelType,
  PrinterFeatureType,
  PrinterFeatureSet,
  BackendInitOptions,
  CommandResult,
  GCodeCommandResult,
  StatusResult,
  JobListResult,
  JobStartResult,
  JobOperationParams,
  MaterialStationStatus,
  FeatureStubInfo,
  BackendStatus,
  BackendCapabilities
} from '../types/printer-backend';
import { 
  detectPrinterModelType, 
  getModelDisplayName
} from '../utils/PrinterUtils';

/**
 * Branded type for PrinterBackendManager to ensure singleton pattern
 */
type PrinterBackendManagerBrand = { readonly __brand: 'PrinterBackendManager' };
type PrinterBackendManagerInstance = PrinterBackendManager & PrinterBackendManagerBrand;

/**
 * Options for initializing backend
 */
interface BackendInitializationOptions {
  readonly printerDetails: PrinterDetails;
  readonly primaryClient: FiveMClient | FlashForgeClient;
  readonly secondaryClient?: FlashForgeClient;
  readonly ForceLegacyAPI?: boolean;
}

/**
 * Results from backend initialization
 */
interface BackendInitializationResult {
  readonly success: boolean;
  readonly backend?: BasePrinterBackend;
  readonly error?: string;
  readonly modelType?: PrinterModelType;
}

/**
 * Single coordinator for all printer backend operations
 * Manages backend selection, lifecycle, and feature queries for UI integration
 */
export class PrinterBackendManager extends EventEmitter {
  private static instance: PrinterBackendManagerInstance | null = null;
  
  private readonly configManager = getConfigManager();
  private readonly loadingManager = getLoadingManager();
  
  private currentBackend: BasePrinterBackend | null = null;
  private currentPrinterDetails: PrinterDetails | null = null;
  private initializationPromise: Promise<BackendInitializationResult> | null = null;
  
  private constructor() {
    super();
    this.setupEventHandlers();
  }
  
  /**
   * Get singleton instance of PrinterBackendManager
   */
  public static getInstance(): PrinterBackendManagerInstance {
    if (!PrinterBackendManager.instance) {
      PrinterBackendManager.instance = new PrinterBackendManager() as PrinterBackendManagerInstance;
    }
    return PrinterBackendManager.instance;
  }
  
  /**
   * Setup event handlers for configuration changes
   */
  private setupEventHandlers(): void {
    // Monitor configuration changes that affect backend features
    this.configManager.on('configUpdated', (event: { changedKeys: string[] }) => {
      if (this.currentBackend) {
        this.handleConfigurationChange(event.changedKeys);
      }
    });
    
    // Monitor loading manager for UI coordination
    this.loadingManager.on('loadingStateChanged', (state: string) => {
      this.emit('loading-state-changed', state);
    });
  }
  
  /**
   * Handle configuration changes that affect backend features
   */
  private handleConfigurationChange(changedKeys: string[]): void {
    const featureKeys = ['CustomCamera', 'CustomCameraUrl', 'CustomLeds', 'ForceLegacyAPI'];
    const hasFeatureChanges = changedKeys.some(key => featureKeys.includes(key));
    
    if (hasFeatureChanges && this.currentBackend) {
      console.log('Configuration changes detected, backend features may be affected');
      this.emit('backend-features-changed', {
        backend: this.currentBackend,
        changedKeys
      });
    }
  }
  
  /**
   * Initialize backend based on printer details
   */
  public async initializeBackend(options: BackendInitializationOptions): Promise<BackendInitializationResult> {
    // Prevent multiple simultaneous initialization attempts
    if (this.initializationPromise) {
      console.log('Backend initialization already in progress, waiting for completion');
      return await this.initializationPromise;
    }
    
    this.initializationPromise = this.performBackendInitialization(options);
    
    try {
      const result = await this.initializationPromise;
      return result;
    } finally {
      this.initializationPromise = null;
    }
  }
  
  /**
   * Perform the actual backend initialization
   */
  private async performBackendInitialization(options: BackendInitializationOptions): Promise<BackendInitializationResult> {
    try {
      // RACE CONDITION FIX: Check if we had an old backend before disposal
      const hadOldBackend = this.currentBackend !== null;
      
      // Dispose of existing backend if any
      await this.disposeBackend();
      
      // Add delay to ensure old client cleanup completes
      // This prevents the old client's keepalive from interfering with new connection
      if (hadOldBackend) {
        console.log('PrinterBackendManager: Waiting for old backend cleanup to complete...');
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
      
      // Show loading state
      this.loadingManager.show({
        message: 'Initializing printer backend...',
        canCancel: false
      });
      
      // Detect printer model from details
      let modelType = detectPrinterModelType(options.printerDetails.printerModel);
      
      // Override to generic legacy if ForceLegacyAPI is enabled
      if (options.ForceLegacyAPI) {
        console.log('Force legacy mode enabled - using GenericLegacyBackend regardless of printer type');
        modelType = 'generic-legacy';
      }
      
      this.loadingManager.updateMessage(`Initializing ${getModelDisplayName(modelType)} backend...`);
      
      // Create backend instance
      const backend = this.createBackend(modelType, options);
      
      // Initialize the backend
      await backend.initialize();
      
      // Store references
      this.currentBackend = backend;
      this.currentPrinterDetails = options.printerDetails;
      
      // Setup backend event forwarding
      this.setupBackendEventForwarding(backend);
      
      // Success!
      this.loadingManager.showSuccess(`Backend initialized for ${getModelDisplayName(modelType)}`, 3000);
      
      this.emit('backend-initialized', {
        backend,
        modelType,
        printerDetails: options.printerDetails
      });
      
      console.log(`PrinterBackendManager: Successfully initialized ${getModelDisplayName(modelType)} backend`);
      
      return {
        success: true,
        backend,
        modelType
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.loadingManager.showError(`Backend initialization failed: ${errorMessage}`, 5000);
      
      this.emit('backend-initialization-failed', {
        error: errorMessage,
        printerDetails: options.printerDetails
      });
      
      console.error('PrinterBackendManager: Backend initialization failed:', error);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Create backend instance based on printer model
   */
  private createBackend(modelType: PrinterModelType, options: BackendInitializationOptions): BasePrinterBackend {
    const backendOptions: BackendInitOptions = {
      printerModel: modelType,
      printerDetails: {
        name: options.printerDetails.Name,
        ipAddress: options.printerDetails.IPAddress,
        serialNumber: options.printerDetails.SerialNumber,
        typeName: options.printerDetails.printerModel
      },
      primaryClient: options.primaryClient,
      secondaryClient: options.secondaryClient
    };
    
    // Backend factory pattern based on model type
    switch (modelType) {
      case 'generic-legacy':
        return new GenericLegacyBackend(backendOptions);
      
      case 'adventurer-5m':
        return new Adventurer5MBackend(backendOptions);
      
      case 'adventurer-5m-pro':
        return new Adventurer5MProBackend(backendOptions);
      
      case 'ad5x':
        return new AD5XBackend(backendOptions);
      
      default:
        // Fallback to generic legacy for unknown models
        console.warn(`Unknown printer model: ${modelType}, falling back to generic legacy backend`);
        return new GenericLegacyBackend({
          ...backendOptions,
          printerModel: 'generic-legacy'
        });
    }
  }
  
  /**
   * Setup event forwarding from backend to manager
   */
  private setupBackendEventForwarding(backend: BasePrinterBackend): void {
    // Forward all backend events
    backend.on('backend-event', (event) => {
      this.emit('backend-event', event);
    });
    
    // Forward specific events
    backend.on('feature-updated', (data) => {
      this.emit('feature-updated', data);
    });
    
    backend.on('error', (event) => {
      this.emit('backend-error', event);
    });
    
    backend.on('disconnected', () => {
      this.emit('backend-disconnected');
    });
  }
  
  /**
   * Dispose of current backend
   */
  public async disposeBackend(): Promise<void> {
    if (this.currentBackend) {
      try {
        console.log('Disposing current backend...');
        
        // Enhanced cleanup coordination - capture references before clearing
        const backendToDispose = this.currentBackend;
        const printerName = this.currentPrinterDetails?.Name || 'unknown printer';
        
        this.currentBackend = null;
        this.currentPrinterDetails = null;
        
        // Dispose the backend (this calls client.dispose())
        await backendToDispose.dispose();
        
        // Additional cleanup delay to ensure ff-api client internal timers stop
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('Backend disposed for', printerName);
        this.emit('backend-disposed');
        
      } catch (error) {
        console.error('Error disposing backend:', error);
        // Clear references even if disposal fails
        this.currentBackend = null;
        this.currentPrinterDetails = null;
      }
    }
  }
  
  /**
   * Get current backend instance
   */
  public getBackend(): BasePrinterBackend | null {
    return this.currentBackend;
  }
  
  /**
   * Get current printer details
   */
  public getCurrentPrinterDetails(): PrinterDetails | null {
    return this.currentPrinterDetails;
  }
  
  /**
   * Check if backend is initialized and ready
   */
  public isBackendReady(): boolean {
    return this.currentBackend !== null;
  }
  
  /**
   * Check if a specific feature is available
   */
  public isFeatureAvailable(feature: PrinterFeatureType): boolean {
    if (!this.currentBackend) {
      return false;
    }
    
    return this.currentBackend.isFeatureAvailable(feature);
  }
  
  /**
   * Get feature stub information for UI
   */
  public getFeatureStubInfo(feature: PrinterFeatureType): FeatureStubInfo | null {
    if (!this.currentBackend) {
      return {
        feature,
        printerModel: 'No Printer Connected',
        reason: 'No printer backend is currently initialized',
        canBeEnabled: false
      };
    }
    
    return this.currentBackend.getFeatureStubInfo(feature);
  }
  
  /**
   * Get backend status for monitoring
   */
  public getBackendStatus(): BackendStatus | null {
    if (!this.currentBackend) {
      return null;
    }
    
    return this.currentBackend.getBackendStatus();
  }
  
  /**
   * Get backend capabilities
   */
  public getBackendCapabilities(): BackendCapabilities | null {
    if (!this.currentBackend) {
      return null;
    }
    
    return this.currentBackend.getCapabilities();
  }
  
  // Forward backend operations to current backend
  
  /**
   * Execute G-code command
   */
  public async executeGCodeCommand(command: string): Promise<GCodeCommandResult> {
    if (!this.currentBackend) {
      return {
        success: false,
        command,
        error: 'No backend initialized',
        executionTime: 0,
        timestamp: new Date()
      };
    }
    
    return await this.currentBackend.executeGCodeCommand(command);
  }
  
  /**
   * Get current printer status
   */
  public async getPrinterStatus(): Promise<StatusResult> {
    if (!this.currentBackend) {
      return {
        success: false,
        error: 'No backend initialized',
        timestamp: new Date(),
        status: {
          printerState: 'disconnected',
          bedTemperature: 0,
          nozzleTemperature: 0,
          progress: 0,
          currentLayer: undefined,
          totalLayers: undefined
        }
      };
    }
    
    return await this.currentBackend.getPrinterStatus();
  }
  
  /**
   * Get list of local jobs
   */
  public async getLocalJobs(): Promise<JobListResult> {
    if (!this.currentBackend) {
      return {
        success: false,
        error: 'No backend initialized',
        jobs: [],
        totalCount: 0,
        source: 'local',
        timestamp: new Date()
      };
    }
    
    return await this.currentBackend.getLocalJobs();
  }
  
  /**
   * Get list of recent jobs
   */
  public async getRecentJobs(): Promise<JobListResult> {
    if (!this.currentBackend) {
      return {
        success: false,
        error: 'No backend initialized',
        jobs: [],
        totalCount: 0,
        source: 'recent',
        timestamp: new Date()
      };
    }
    
    return await this.currentBackend.getRecentJobs();
  }
  
  /**
   * Start a job
   */
  public async startJob(params: JobOperationParams): Promise<JobStartResult> {
    if (!this.currentBackend) {
      return {
        success: false,
        error: 'No backend initialized',
        fileName: params.fileName || '',
        started: false,
        timestamp: new Date()
      };
    }
    
    return await this.currentBackend.startJob(params);
  }
  
  /**
   * Pause current job
   */
  public async pauseJob(): Promise<CommandResult> {
    if (!this.currentBackend) {
      return {
        success: false,
        error: 'No backend initialized',
        timestamp: new Date()
      };
    }
    
    return await this.currentBackend.pauseJob();
  }
  
  /**
   * Resume paused job
   */
  public async resumeJob(): Promise<CommandResult> {
    if (!this.currentBackend) {
      return {
        success: false,
        error: 'No backend initialized',
        timestamp: new Date()
      };
    }
    
    return await this.currentBackend.resumeJob();
  }
  
  /**
   * Cancel current job
   */
  public async cancelJob(): Promise<CommandResult> {
    if (!this.currentBackend) {
      return {
        success: false,
        error: 'No backend initialized',
        timestamp: new Date()
      };
    }
    
    return await this.currentBackend.cancelJob();
  }
  
  /**
   * Get material station status (if supported)
   */
  public getMaterialStationStatus(): MaterialStationStatus | null {
    if (!this.currentBackend) {
      return null;
    }
    
    return this.currentBackend.getMaterialStationStatus();
  }
  
  /**
   * Upload file to AD5X printer with material station support
   * Only available for AD5X printers with material station functionality
   */
  public async uploadFileAD5X(
    filePath: string,
    startPrint: boolean,
    levelingBeforePrint: boolean,
    materialMappings?: AD5XMaterialMapping[]
  ): Promise<JobStartResult> {
    if (!this.currentBackend) {
      return {
        success: false,
        error: 'No backend initialized',
        fileName: '',
        started: false,
        timestamp: new Date()
      };
    }
    
    // Check if backend supports AD5X upload
    if (!('uploadFileAD5X' in this.currentBackend)) {
      return {
        success: false,
        error: 'Current printer does not support AD5X upload functionality',
        fileName: '',
        started: false,
        timestamp: new Date()
      };
    }
    
    // Use interface assertion for better type safety
    const ad5xBackend = this.currentBackend as { uploadFileAD5X: (filePath: string, startPrint: boolean, levelingBeforePrint: boolean, materialMappings?: AD5XMaterialMapping[]) => Promise<JobStartResult> };
    return await ad5xBackend.uploadFileAD5X(
      filePath,
      startPrint,
      levelingBeforePrint,
      materialMappings
    );
  }
  
  /**
   * Get model preview image for current print job
   * Returns base64 PNG string or null if no preview available
   */
  public async getModelPreview(): Promise<string | null> {
    if (!this.currentBackend) {
      throw new Error('No printer backend initialized');
    }
    
    return this.currentBackend.getModelPreview();
  }

  /**
   * Get thumbnail image for any job file by filename
   * Returns base64 PNG string or null if no preview available
   */
  public async getJobThumbnail(fileName: string): Promise<string | null> {
    if (!this.currentBackend) {
      throw new Error('No printer backend initialized');
    }
    
    return this.currentBackend.getJobThumbnail(fileName);
  }
  
  /**
   * Get printer features for UI integration
   * Convenience method to get features from backend status
   */
  public getFeatures(): PrinterFeatureSet | null {
    if (!this.currentBackend) {
      return null;
    }
    
    const status = this.currentBackend.getBackendStatus();
    return status.features;
  }
  
  /**
   * Handle connection established event
   */
  public async onConnectionEstablished(printerDetails: PrinterDetails, primaryClient: FiveMClient | FlashForgeClient, secondaryClient?: FlashForgeClient): Promise<void> {
    try {
      console.log('PrinterBackendManager: Connection established, initializing backend...');
      
      // Check if ForceLegacyAPI mode is enabled
      const ForceLegacyAPI = this.configManager.get('ForceLegacyAPI') || false;
      
      const initResult = await this.initializeBackend({
        printerDetails,
        primaryClient,
        secondaryClient,
        ForceLegacyAPI
      });
      
      if (initResult.success) {
        console.log('PrinterBackendManager: Backend successfully initialized after connection');
        this.emit('connection-backend-ready', {
          backend: initResult.backend,
          printerDetails
        });
      } else {
        console.error('PrinterBackendManager: Failed to initialize backend after connection:', initResult.error);
        this.emit('connection-backend-failed', {
          error: initResult.error,
          printerDetails
        });
      }
      
    } catch (error) {
      console.error('PrinterBackendManager: Error during connection backend initialization:', error);
      this.emit('connection-backend-failed', {
        error: error instanceof Error ? error.message : String(error),
        printerDetails
      });
    }
  }
  
  /**
   * Handle connection lost event
   */
  public async onConnectionLost(): Promise<void> {
    console.log('PrinterBackendManager: Connection lost, disposing backend...');
    
    await this.disposeBackend();
    
    this.emit('connection-backend-disposed');
  }
  
  /**
   * Cleanup and dispose of all resources
   */
  public async cleanup(): Promise<void> {
    console.log('PrinterBackendManager: Cleaning up...');
    
    // Dispose of current backend
    await this.disposeBackend();
    
    // Remove all event listeners
    this.removeAllListeners();
    
    // Clear singleton instance
    PrinterBackendManager.instance = null;
  }
}

/**
 * Get singleton instance of PrinterBackendManager
 */
export function getPrinterBackendManager(): PrinterBackendManagerInstance {
  return PrinterBackendManager.getInstance();
}
