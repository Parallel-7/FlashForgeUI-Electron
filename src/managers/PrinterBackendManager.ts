/**
 * @fileoverview Central coordinator for printer backend operations in multi-context environment.
 *
 * Provides unified management of printer backends with support for multiple concurrent connections:
 * - Backend selection and instantiation based on printer model type
 * - Multi-context backend lifecycle management (initialization/disposal)
 * - Feature detection and capability queries for UI adaptation
 * - Job operations routing to appropriate backend (start/pause/resume/cancel)
 * - Material station operations for AD5X printers
 * - G-code command execution with client type routing
 * - Event forwarding for backend state changes
 *
 * Supported backends:
 * - Adventurer5MBackend: For Adventurer 5M printers
 * - Adventurer5MProBackend: For Adventurer 5M Pro printers
 * - AD5XBackend: For AD5X series printers with material station
 * - GenericLegacyBackend: Fallback for legacy/unknown printers
 *
 * Key exports:
 * - PrinterBackendManager class: Main backend coordinator
 * - getPrinterBackendManager(): Singleton accessor function
 *
 * The manager maintains a context-to-backend mapping, enabling independent backend operations
 * for each connected printer. All operations accept an optional contextId parameter, defaulting
 * to the active context if not provided.
 */

import { EventEmitter } from 'events';
import { FiveMClient, FlashForgeClient, AD5XMaterialMapping } from '@ghosttypes/ff-api';
import { BasePrinterBackend } from '../printer-backends/BasePrinterBackend';
import { GenericLegacyBackend } from '../printer-backends/GenericLegacyBackend';
import { Adventurer5MBackend } from '../printer-backends/Adventurer5MBackend';
import { Adventurer5MProBackend } from '../printer-backends/Adventurer5MProBackend';
import { AD5XBackend } from '../printer-backends/AD5XBackend';
import { getConfigManager } from './ConfigManager';
import { getLoadingManager } from './LoadingManager';
import { getPrinterContextManager } from './PrinterContextManager';
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
  private readonly contextManager = getPrinterContextManager();

  // Multi-context backend storage
  private readonly contextBackends = new Map<string, BasePrinterBackend>();
  private readonly contextPrinterDetails = new Map<string, PrinterDetails>();
  private readonly contextInitPromises = new Map<string, Promise<BackendInitializationResult>>();

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
      this.handleConfigurationChange(event.changedKeys);
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

    if (hasFeatureChanges) {
      const activeContextId = this.contextManager.getActiveContextId();
      if (activeContextId) {
        const backend = this.contextBackends.get(activeContextId);
        if (backend) {
          console.log('Configuration changes detected, backend features may be affected');
          this.emit('backend-features-changed', {
            backend,
            contextId: activeContextId,
            changedKeys
          });
        }
      }
    }
  }
  
  /**
   * Initialize backend based on printer details
   * Now context-aware - requires contextId
   *
   * @param contextId - Context ID for this backend
   * @param options - Backend initialization options
   * @returns Promise resolving to initialization result
   */
  public async initializeBackend(
    contextId: string,
    options: BackendInitializationOptions
  ): Promise<BackendInitializationResult> {
    // Prevent multiple simultaneous initialization attempts for same context
    if (this.contextInitPromises.has(contextId)) {
      console.log(`Backend initialization already in progress for context ${contextId}, waiting for completion`);
      return await this.contextInitPromises.get(contextId)!;
    }

    const initPromise = this.performBackendInitialization(contextId, options);
    this.contextInitPromises.set(contextId, initPromise);

    try {
      const result = await initPromise;
      return result;
    } finally {
      this.contextInitPromises.delete(contextId);
    }
  }
  
  /**
   * Perform the actual backend initialization
   * Context-aware implementation
   */
  private async performBackendInitialization(
    contextId: string,
    options: BackendInitializationOptions
  ): Promise<BackendInitializationResult> {
    try {
      // Check if we had an old backend before disposal
      const hadOldBackend = this.contextBackends.has(contextId);

      // Dispose of existing backend for this context if any
      if (hadOldBackend) {
        await this.disposeContext(contextId);

        // Add delay to ensure old client cleanup completes
        // This prevents the old client's keepalive from interfering with new connection
        console.log(`PrinterBackendManager: Waiting for old backend cleanup to complete for context ${contextId}...`);
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

      // Store references in context map
      this.contextBackends.set(contextId, backend);
      this.contextPrinterDetails.set(contextId, options.printerDetails);

      // Update context manager with backend reference
      this.contextManager.updateBackend(contextId, backend);

      // Setup backend event forwarding
      this.setupBackendEventForwarding(backend, contextId);
      
      // Success!
      this.loadingManager.showSuccess(`Backend initialized for ${getModelDisplayName(modelType)}`, 3000);
      
      this.emit('backend-initialized', {
        contextId,
        backend,
        modelType,
        printerDetails: options.printerDetails
      });

      console.log(`PrinterBackendManager: Successfully initialized ${getModelDisplayName(modelType)} backend for context ${contextId}`);

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
        typeName: options.printerDetails.printerModel,
        customCameraEnabled: options.printerDetails.customCameraEnabled,
        customCameraUrl: options.printerDetails.customCameraUrl,
        customLedsEnabled: options.printerDetails.customLedsEnabled,
        forceLegacyMode: options.printerDetails.forceLegacyMode
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
   * Now includes contextId for multi-context support
   */
  private setupBackendEventForwarding(backend: BasePrinterBackend, contextId: string): void {
    // Forward all backend events with context ID
    backend.on('backend-event', (event) => {
      this.emit('backend-event', { ...event, contextId });
    });

    // Forward specific events with context ID
    backend.on('feature-updated', (data) => {
      this.emit('feature-updated', { ...data, contextId });
    });

    backend.on('error', (event) => {
      this.emit('backend-error', { ...event, contextId });
    });

    backend.on('disconnected', () => {
      this.emit('backend-disconnected', { contextId });
    });
  }
  
  /**
   * Dispose of backend for a specific context
   *
   * @param contextId - Context ID to dispose
   */
  public async disposeContext(contextId: string): Promise<void> {
    const backend = this.contextBackends.get(contextId);
    if (backend) {
      try {
        const printerDetails = this.contextPrinterDetails.get(contextId);
        const printerName = printerDetails?.Name || 'unknown printer';

        console.log(`Disposing backend for context ${contextId} (${printerName})...`);

        // Remove from maps first
        this.contextBackends.delete(contextId);
        this.contextPrinterDetails.delete(contextId);

        // Update context manager
        this.contextManager.updateBackend(contextId, null);

        // Dispose the backend (this calls client.dispose())
        await backend.dispose();

        // Additional cleanup delay to ensure ff-api client internal timers stop
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log(`Backend disposed for context ${contextId} (${printerName})`);
        this.emit('backend-disposed', { contextId });

      } catch (error) {
        console.error(`Error disposing backend for context ${contextId}:`, error);
        // Clear references even if disposal fails
        this.contextBackends.delete(contextId);
        this.contextPrinterDetails.delete(contextId);
      }
    }
  }

  
  /**
   * Get backend instance for a specific context
   *
   * @param contextId - Context ID (required)
   * @returns Backend instance or null
   */
  public getBackendForContext(contextId: string): BasePrinterBackend | null {
    return this.contextBackends.get(contextId) || null;
  }

  /**
   * Get printer details for a specific context
   *
   * @param contextId - Context ID (required)
   * @returns Printer details or null
   */
  public getPrinterDetailsForContext(contextId: string): PrinterDetails | null {
    return this.contextPrinterDetails.get(contextId) || null;
  }
  
  /**
   * Check if backend is initialized and ready for a specific context
   *
   * @param contextId - Context ID to check
   * @returns True if backend is ready
   */
  public isBackendReady(contextId: string): boolean {
    return this.contextBackends.has(contextId);
  }

  /**
   * Check if a specific feature is available for a context
   *
   * @param contextId - Context ID
   * @param feature - Feature to check
   * @returns True if feature is available
   */
  public isFeatureAvailable(contextId: string, feature: PrinterFeatureType): boolean {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return false;
    }

    return backend.isFeatureAvailable(feature);
  }

  /**
   * Get feature stub information for UI
   *
   * @param contextId - Context ID
   * @param feature - Feature to get info for
   * @returns Feature stub info or null
   */
  public getFeatureStubInfo(contextId: string, feature: PrinterFeatureType): FeatureStubInfo | null {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return {
        feature,
        printerModel: 'No Printer Connected',
        reason: 'No printer backend is currently initialized',
        canBeEnabled: false
      };
    }

    return backend.getFeatureStubInfo(feature);
  }

  /**
   * Get backend status for monitoring
   *
   * @param contextId - Context ID
   * @returns Backend status or null
   */
  public getBackendStatus(contextId: string): BackendStatus | null {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return null;
    }

    return backend.getBackendStatus();
  }

  /**
   * Get backend capabilities
   *
   * @param contextId - Context ID
   * @returns Backend capabilities or null
   */
  public getBackendCapabilities(contextId: string): BackendCapabilities | null {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return null;
    }

    return backend.getCapabilities();
  }

  // Forward backend operations to context backend

  /**
   * Execute G-code command
   *
   * @param contextId - Context ID
   * @param command - G-code command to execute
   * @returns Command result
   */
  public async executeGCodeCommand(contextId: string, command: string): Promise<GCodeCommandResult> {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return {
        success: false,
        command,
        error: 'No backend initialized',
        executionTime: 0,
        timestamp: new Date()
      };
    }

    return await backend.executeGCodeCommand(command);
  }

  /**
   * Get current printer status
   *
   * @param contextId - Context ID
   * @returns Printer status
   */
  public async getPrinterStatus(contextId: string): Promise<StatusResult> {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
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

    return await backend.getPrinterStatus();
  }

  /**
   * Get list of local jobs
   *
   * @param contextId - Context ID
   * @returns Job list result
   */
  public async getLocalJobs(contextId: string): Promise<JobListResult> {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return {
        success: false,
        error: 'No backend initialized',
        jobs: [],
        totalCount: 0,
        source: 'local',
        timestamp: new Date()
      };
    }

    return await backend.getLocalJobs();
  }

  /**
   * Get list of recent jobs
   *
   * @param contextId - Context ID
   * @returns Job list result
   */
  public async getRecentJobs(contextId: string): Promise<JobListResult> {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return {
        success: false,
        error: 'No backend initialized',
        jobs: [],
        totalCount: 0,
        source: 'recent',
        timestamp: new Date()
      };
    }

    return await backend.getRecentJobs();
  }

  /**
   * Start a job
   *
   * @param contextId - Context ID
   * @param params - Job operation parameters
   * @returns Job start result
   */
  public async startJob(contextId: string, params: JobOperationParams): Promise<JobStartResult> {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return {
        success: false,
        error: 'No backend initialized',
        fileName: params.fileName || '',
        started: false,
        timestamp: new Date()
      };
    }

    return await backend.startJob(params);
  }

  /**
   * Pause current job
   *
   * @param contextId - Context ID
   * @returns Command result
   */
  public async pauseJob(contextId: string): Promise<CommandResult> {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return {
        success: false,
        error: 'No backend initialized',
        timestamp: new Date()
      };
    }

    return await backend.pauseJob();
  }

  /**
   * Resume paused job
   *
   * @param contextId - Context ID
   * @returns Command result
   */
  public async resumeJob(contextId: string): Promise<CommandResult> {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return {
        success: false,
        error: 'No backend initialized',
        timestamp: new Date()
      };
    }

    return await backend.resumeJob();
  }

  /**
   * Cancel current job
   *
   * @param contextId - Context ID
   * @returns Command result
   */
  public async cancelJob(contextId: string): Promise<CommandResult> {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return {
        success: false,
        error: 'No backend initialized',
        timestamp: new Date()
      };
    }

    return await backend.cancelJob();
  }

  /**
   * Get material station status (if supported)
   *
   * @param contextId - Context ID
   * @returns Material station status or null
   */
  public getMaterialStationStatus(contextId: string): MaterialStationStatus | null {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return null;
    }

    return backend.getMaterialStationStatus();
  }

  /**
   * Upload file to AD5X printer with material station support
   * Only available for AD5X printers with material station functionality
   *
   * @param contextId - Context ID
   * @param filePath - Path to file to upload
   * @param startPrint - Whether to start printing after upload
   * @param levelingBeforePrint - Whether to level before printing
   * @param materialMappings - Material mappings for multi-material prints
   * @returns Job start result
   */
  public async uploadFileAD5X(
    contextId: string,
    filePath: string,
    startPrint: boolean,
    levelingBeforePrint: boolean,
    materialMappings?: AD5XMaterialMapping[]
  ): Promise<JobStartResult> {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return {
        success: false,
        error: 'No backend initialized',
        fileName: '',
        started: false,
        timestamp: new Date()
      };
    }

    // Check if backend supports AD5X upload
    if (!('uploadFileAD5X' in backend)) {
      return {
        success: false,
        error: 'Current printer does not support AD5X upload functionality',
        fileName: '',
        started: false,
        timestamp: new Date()
      };
    }

    // Use interface assertion for better type safety
    const ad5xBackend = backend as { uploadFileAD5X: (filePath: string, startPrint: boolean, levelingBeforePrint: boolean, materialMappings?: AD5XMaterialMapping[]) => Promise<JobStartResult> };
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
   *
   * @param contextId - Context ID
   * @returns Base64 PNG string or null
   */
  public async getModelPreview(contextId: string): Promise<string | null> {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      throw new Error('No printer backend initialized');
    }

    return backend.getModelPreview();
  }

  /**
   * Get thumbnail image for any job file by filename
   * Returns base64 PNG string or null if no preview available
   *
   * @param contextId - Context ID
   * @param fileName - Job filename to get thumbnail for
   * @returns Base64 PNG string or null
   */
  public async getJobThumbnail(contextId: string, fileName: string): Promise<string | null> {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      throw new Error('No printer backend initialized');
    }

    return backend.getJobThumbnail(fileName);
  }

  /**
   * Get printer features for UI integration
   * Convenience method to get features from backend status
   *
   * @param contextId - Context ID
   * @returns Printer feature set or null
   */
  public getFeatures(contextId: string): PrinterFeatureSet | null {
    const backend = this.contextBackends.get(contextId);
    if (!backend) {
      return null;
    }

    const status = backend.getBackendStatus();
    return status.features;
  }
  
  /**
   * Handle connection established event
   * Now requires contextId parameter
   *
   * @param contextId - Context ID for this connection
   * @param printerDetails - Printer details from connection
   * @param primaryClient - Primary API client
   * @param secondaryClient - Optional secondary API client
   */
  public async onConnectionEstablished(
    contextId: string,
    printerDetails: PrinterDetails,
    primaryClient: FiveMClient | FlashForgeClient,
    secondaryClient?: FlashForgeClient
  ): Promise<void> {
    try {
      console.log(`PrinterBackendManager: Connection established for context ${contextId}, initializing backend...`);

      // Check if ForceLegacyAPI mode is enabled
      const ForceLegacyAPI = this.configManager.get('ForceLegacyAPI') || false;

      const initResult = await this.initializeBackend(contextId, {
        printerDetails,
        primaryClient,
        secondaryClient,
        ForceLegacyAPI
      });

      if (initResult.success) {
        console.log(`PrinterBackendManager: Backend successfully initialized for context ${contextId}`);
        this.emit('connection-backend-ready', {
          contextId,
          backend: initResult.backend,
          printerDetails
        });
      } else {
        console.error(`PrinterBackendManager: Failed to initialize backend for context ${contextId}:`, initResult.error);
        this.emit('connection-backend-failed', {
          contextId,
          error: initResult.error,
          printerDetails
        });
      }

    } catch (error) {
      console.error(`PrinterBackendManager: Error during connection backend initialization for context ${contextId}:`, error);
      this.emit('connection-backend-failed', {
        contextId,
        error: error instanceof Error ? error.message : String(error),
        printerDetails
      });
    }
  }
  
  /**
   * Handle connection lost event
   * Now requires contextId parameter
   *
   * @param contextId - Context ID for the lost connection
   */
  public async onConnectionLost(contextId: string): Promise<void> {
    console.log(`PrinterBackendManager: Connection lost for context ${contextId}, disposing backend...`);

    await this.disposeContext(contextId);

    this.emit('connection-backend-disposed', { contextId });
  }
  
  /**
   * Cleanup and dispose of all resources
   */
  public async cleanup(): Promise<void> {
    console.log('PrinterBackendManager: Cleaning up all contexts...');

    // Dispose of all context backends
    const contextIds = Array.from(this.contextBackends.keys());
    for (const contextId of contextIds) {
      await this.disposeContext(contextId);
    }

    // Clear all maps
    this.contextBackends.clear();
    this.contextPrinterDetails.clear();
    this.contextInitPromises.clear();

    // Remove all event listeners
    this.removeAllListeners();

    // Clear singleton instance
    PrinterBackendManager.instance = null;

    console.log('PrinterBackendManager: Cleanup complete');
  }
}

/**
 * Get singleton instance of PrinterBackendManager
 */
export function getPrinterBackendManager(): PrinterBackendManagerInstance {
  return PrinterBackendManager.getInstance();
}

