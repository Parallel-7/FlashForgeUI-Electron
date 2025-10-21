/**
 * @fileoverview Abstract base class for all printer-specific backend implementations.
 *
 * Provides common functionality and enforces interface contracts for printer backends:
 * - Client management (primary and optional secondary clients)
 * - Feature detection and capability reporting
 * - Command execution routing (G-code and printer control)
 * - Status monitoring and data retrieval
 * - Event emission for backend state changes
 * - Per-printer settings integration (camera, LEDs, legacy mode)
 * - Feature override mechanism for UI-driven capability changes
 *
 * Key exports:
 * - BasePrinterBackend abstract class: Foundation for all backend implementations
 *
 * All printer backends must extend this class and implement:
 * - getBaseFeatures(): Define printer-specific feature set
 * - getPrinterStatus(): Fetch current printer status
 * - Various operation methods (job control, material station, etc.)
 *
 * The backend system supports dual-API printers (FiveMClient + FlashForgeClient) and
 * legacy printers (FlashForgeClient only), providing a unified interface for UI operations
 * regardless of the underlying API implementation.
 */

import { EventEmitter } from 'events';
import { FiveMClient, FlashForgeClient } from '@ghosttypes/ff-api';
import { getConfigManager } from '../managers/ConfigManager';
import {
  PrinterModelType,
  PrinterFeatureSet,
  BackendInitOptions,
  CommandResult,
  GCodeCommandResult,
  StatusResult,
  JobListResult,
  JobStartResult,
  JobOperationParams,
  BackendCapabilities,
  BackendStatus,
  MaterialStationStatus,
  FeatureStubInfo,
  BackendEvent,
  BackendEventType
} from '../types/printer-backend';
import {
  getModelDisplayName,
  getFeatureStubMessage,
  canOverrideFeature,
  getFeatureOverrideSettingsKey,
  supportsDualAPI
} from '../utils/PrinterUtils';

/**
 * Abstract base class for all printer backends
 * Provides common functionality and enforces interface contracts
 */
export abstract class BasePrinterBackend extends EventEmitter {
  protected readonly modelType: PrinterModelType;
  protected readonly printerName: string;
  protected readonly ipAddress: string;
  protected readonly serialNumber: string;
  protected readonly typeName: string;

  protected primaryClient: FiveMClient | FlashForgeClient;
  protected secondaryClient: FlashForgeClient | null = null;
  protected readonly configManager = getConfigManager();

  private initialized = false;
  private connected = false;
  private features: PrinterFeatureSet | null = null;
  private lastStatusUpdate = new Date();
  private featureOverrides: Record<string, unknown> = {};

  // Per-printer settings
  protected readonly customCameraEnabled: boolean;
  protected readonly customCameraUrl: string;
  protected readonly customLedsEnabled: boolean;
  protected readonly forceLegacyMode: boolean;

  constructor(options: BackendInitOptions) {
    super();

    this.modelType = options.printerModel;
    this.printerName = options.printerDetails.name;
    this.ipAddress = options.printerDetails.ipAddress;
    this.serialNumber = options.printerDetails.serialNumber;
    this.typeName = options.printerDetails.typeName;

    // Store per-printer settings from printer details
    this.customCameraEnabled = options.printerDetails.customCameraEnabled ?? false;
    this.customCameraUrl = options.printerDetails.customCameraUrl ?? '';
    this.customLedsEnabled = options.printerDetails.customLedsEnabled ?? false;
    this.forceLegacyMode = options.printerDetails.forceLegacyMode ?? false;

    this.primaryClient = options.primaryClient;
    this.secondaryClient = options.secondaryClient || null;

    this.setupEventHandlers();
    this.loadFeatureOverrides();
  }
  
  /**
   * Setup event handlers for configuration changes
   */
  private setupEventHandlers(): void {
    // Monitor configuration changes that affect features
    this.configManager.on('configUpdated', (event: { changedKeys: string[] }) => {
      this.handleConfigUpdate(event.changedKeys);
    });
    
    // Monitor specific settings that affect features
    this.configManager.on('config:CustomCamera', () => {
      this.updateFeatureOverrides();
    });
    
    this.configManager.on('config:CustomCameraUrl', () => {
      this.updateFeatureOverrides();
    });
    
    this.configManager.on('config:CustomLeds', () => {
      this.updateFeatureOverrides();
    });
    
    this.configManager.on('config:ForceLegacyAPI', () => {
      this.updateFeatureOverrides();
    });
  }
  
  /**
   * Load current feature overrides from configuration
   */
  private loadFeatureOverrides(): void {
    this.featureOverrides = {
      customCameraEnabled: this.configManager.get('CustomCamera') || false,
      customCameraUrl: this.configManager.get('CustomCameraUrl') || '',
      customLEDControl: this.configManager.get('CustomLeds') || false,
      ForceLegacyAPI: this.configManager.get('ForceLegacyAPI') || false
    };
  }
  
  /**
   * Handle configuration updates that affect features
   */
  private handleConfigUpdate(changedKeys: string[]): void {
    const featureKeys = ['CustomCamera', 'CustomCameraUrl', 'CustomLeds', 'ForceLegacyAPI'];
    const hasFeatureChanges = changedKeys.some(key => featureKeys.includes(key));
    
    if (hasFeatureChanges) {
      this.updateFeatureOverrides();
    }
  }
  
  /**
   * Update feature overrides and refresh feature set
   */
  private updateFeatureOverrides(): void {
    this.loadFeatureOverrides();
    
    // Refresh feature set with new overrides
    this.features = this.buildFeatureSet();
    
    // Emit event for UI updates
    this.emitEvent('feature-updated', {
      features: this.features,
      overrides: this.featureOverrides
    });
  }
  
  /**
   * Emit backend event
   */
  protected emitEvent(type: BackendEventType, data?: unknown, error?: string): void {
    const event: BackendEvent = {
      type,
      timestamp: new Date(),
      data,
      error
    };
    
    this.emit(type, event);
    this.emit('backend-event', event);
  }
  
  /**
   * Initialize the backend
   * Sets up feature detection and validates connections
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      // Validate primary client connection
      await this.validatePrimaryClient();
      
      // Initialize secondary client if available
      if (this.secondaryClient) {
        await this.validateSecondaryClient();
      }
      
      // Build feature set
      this.features = this.buildFeatureSet();
      
      // Perform backend-specific initialization
      await this.initializeBackend();
      
      this.initialized = true;
      this.connected = true;
      this.lastStatusUpdate = new Date();
      
      this.emitEvent('initialized', {
        modelType: this.modelType,
        features: this.features
      });
      
      console.log(`Backend initialized for ${this.printerName} (${this.modelType})`);
      
    } catch (error) {
      this.emitEvent('error', null, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  
  /**
   * Validate primary client connection
   */
  protected async validatePrimaryClient(): Promise<void> {
    if (!this.primaryClient) {
      throw new Error('Primary client not provided');
    }
    
    console.log('Primary client validated');
  }
  
  /**
   * Validate secondary client connection (if present)
   */
  protected async validateSecondaryClient(): Promise<void> {
    if (!this.secondaryClient) {
      return;
    }
    
    console.log('Secondary client validated');
  }
  
  /**
   * Build feature set based on printer model and user settings
   */
  protected buildFeatureSet(): PrinterFeatureSet {
    const baseFeatures = this.getBaseFeatures();
    const settingsOverrides = this.getSettingsOverrides();
    
    return {
      camera: {
        builtin: baseFeatures.camera.builtin,
        customUrl: settingsOverrides.customCameraEnabled ? String(settingsOverrides.customCameraUrl) : null,
        customEnabled: Boolean(settingsOverrides.customCameraEnabled)
      },
      ledControl: {
        builtin: baseFeatures.ledControl.builtin,
        customControlEnabled: Boolean(settingsOverrides.customLEDControl) && this.supportsCustomLEDControl(),
        usesLegacyAPI: baseFeatures.ledControl.usesLegacyAPI
      },
      filtration: {
        available: baseFeatures.filtration.available,
        controllable: baseFeatures.filtration.controllable,
        reason: baseFeatures.filtration.reason
      },
      gcodeCommands: {
        available: true, // Always available
        usesLegacyAPI: true, // G-code always uses legacy API
        supportedCommands: this.getSupportedGCodeCommands()
      },
      statusMonitoring: {
        available: true, // Always available
        usesNewAPI: this.supportsNewAPI(),
        usesLegacyAPI: true, // Always available as fallback
        realTimeUpdates: this.supportsNewAPI()
      },
      jobManagement: {
        localJobs: this.supportsLocalJobs(),
        recentJobs: this.supportsRecentJobs(),
        uploadJobs: this.supportsUploadJobs(),
        startJobs: this.supportsStartJobs(),
        pauseResume: true, // Always available
        cancelJobs: true, // Always available
        usesNewAPI: this.supportsNewAPI()
      },
      materialStation: {
        available: this.supportsMaterialStation(),
        slotCount: this.getMaterialStationSlotCount(),
        perSlotInfo: this.supportsMaterialStation(),
        materialDetection: this.supportsMaterialStation()
      }
    };
  }
  
  /**
   * Get settings overrides from per-printer settings
   * NOTE: Per-printer settings are now stored in printer_details.json, not config.json
   */
  private getSettingsOverrides(): Record<string, unknown> {
    return {
      customCameraEnabled: this.customCameraEnabled,
      customCameraUrl: this.customCameraUrl,
      customLEDControl: this.customLedsEnabled,
      ForceLegacyAPI: this.forceLegacyMode
    };
  }
  
  /**
   * Check if feature is available (including overrides)
   */
  public isFeatureAvailable(feature: string): boolean {
    if (!this.features) {
      return false;
    }
    
    switch (feature) {
      case 'camera':
        return this.features.camera.builtin || this.features.camera.customEnabled;
      case 'led-control':
        return this.features.ledControl.builtin || this.features.ledControl.customControlEnabled;
      case 'filtration':
        return this.features.filtration.available;
      case 'gcode-commands':
        return this.features.gcodeCommands.available;
      case 'status-monitoring':
        return this.features.statusMonitoring.available;
      case 'job-management':
        return this.features.jobManagement.pauseResume || this.features.jobManagement.cancelJobs;
      case 'material-station':
        return this.features.materialStation.available;
      default:
        return false;
    }
  }
  
  /**
   * Get feature stub information for disabled features
   */
  public getFeatureStubInfo(feature: string): FeatureStubInfo {
    const available = this.isFeatureAvailable(feature);
    const canBeEnabled = canOverrideFeature(feature, this.modelType);
    const settingsKey = getFeatureOverrideSettingsKey(feature);
    
    return {
      feature,
      printerModel: getModelDisplayName(this.modelType),
      reason: available ? 'Available' : getFeatureStubMessage(feature, this.modelType),
      canBeEnabled,
      settingsPath: settingsKey || undefined
    };
  }
  
  /**
   * Get current backend status
   */
  public getBackendStatus(): BackendStatus {
    return {
      initialized: this.initialized,
      connected: this.connected,
      primaryClientConnected: this.primaryClient !== null,
      secondaryClientConnected: this.secondaryClient !== null,
      features: this.features || this.buildFeatureSet(),
      capabilities: this.getCapabilities(),
      materialStation: this.supportsMaterialStation() ? (this.getMaterialStationStatus() || undefined) : undefined,
      lastUpdate: this.lastStatusUpdate
    };
  }
  
  /**
   * Get backend capabilities
   */
  public getCapabilities(): BackendCapabilities {
    return {
      modelType: this.modelType,
      supportedFeatures: this.getSupportedFeatures(),
      apiClients: this.getApiClients(),
      materialStationSupport: this.supportsMaterialStation(),
      dualAPISupport: supportsDualAPI(this.modelType)
    };
  }
  
  /**
   * Get list of supported features
   */
  private getSupportedFeatures(): readonly string[] {
    const features: string[] = [];
    
    if (this.isFeatureAvailable('camera')) features.push('camera');
    if (this.isFeatureAvailable('led-control')) features.push('led-control');
    if (this.isFeatureAvailable('filtration')) features.push('filtration');
    if (this.isFeatureAvailable('gcode-commands')) features.push('gcode-commands');
    if (this.isFeatureAvailable('status-monitoring')) features.push('status-monitoring');
    if (this.isFeatureAvailable('job-management')) features.push('job-management');
    if (this.isFeatureAvailable('material-station')) features.push('material-station');
    
    return features;
  }
  
  /**
   * Get API clients used by this backend
   */
  private getApiClients(): readonly ('new' | 'legacy')[] {
    const clients: ('new' | 'legacy')[] = [];
    
    if (this.primaryClient instanceof FiveMClient) {
      clients.push('new');
    }
    
    if (this.primaryClient instanceof FlashForgeClient || this.secondaryClient) {
      clients.push('legacy');
    }
    
    return clients;
  }
  
  /**
   * Get the primary client (FiveMClient or FlashForgeClient)
   */
  public getPrimaryClient(): FiveMClient | FlashForgeClient {
    return this.primaryClient;
  }

  /**
   * Get the secondary client (FlashForgeClient for dual-API backends)
   */
  public getSecondaryClient(): FlashForgeClient | null {
    return this.secondaryClient;
  }

  /**
   * Dispose of backend resources
   */
  public async dispose(): Promise<void> {
    try {
      // Dispose of clients
      if (this.primaryClient) {
        await this.primaryClient.dispose();
      }
      
      if (this.secondaryClient) {
        await this.secondaryClient.dispose();
      }
      
      // Clean up state
      this.initialized = false;
      this.connected = false;
      this.features = null;
      
      // Remove event listeners
      this.removeAllListeners();
      
      this.emitEvent('disconnected');
      
      console.log(`Backend disposed for ${this.printerName}`);
      
    } catch (error) {
      console.error('Error during backend disposal:', error);
    }
  }
  
  // Abstract methods that must be implemented by concrete backends
  
  /**
   * Get base features for the printer model (without overrides)
   */
  protected abstract getBaseFeatures(): PrinterFeatureSet;
  
  /**
   * Perform backend-specific initialization
   */
  protected abstract initializeBackend(): Promise<void>;
  
  /**
   * Execute a G-code command
   */
  public abstract executeGCodeCommand(command: string): Promise<GCodeCommandResult>;
  
  /**
   * Get current printer status
   */
  public abstract getPrinterStatus(): Promise<StatusResult>;
  
  /**
   * Get list of local jobs
   */
  public abstract getLocalJobs(): Promise<JobListResult>;
  
  /**
   * Get list of recent jobs
   */
  public abstract getRecentJobs(): Promise<JobListResult>;
  
  /**
   * Start a job using fileName parameter (corrected from jobId)
   */
  public abstract startJob(params: JobOperationParams): Promise<JobStartResult>;
  
  /**
   * Pause current job
   */
  public abstract pauseJob(): Promise<CommandResult>;
  
  /**
   * Resume paused job
   */
  public abstract resumeJob(): Promise<CommandResult>;
  
  /**
   * Cancel current job
   */
  public abstract cancelJob(): Promise<CommandResult>;
  
  /**
   * Get material station status (if supported)
   */
  public abstract getMaterialStationStatus(): MaterialStationStatus | null;
  
  /**
   * Get model preview image for current print job
   * Returns base64 PNG string or null if no preview available
   */
  public abstract getModelPreview(): Promise<string | null>;

  /**
   * Get thumbnail image for any job file by filename
   * Returns base64 PNG string or null if no thumbnail available
   */
  public abstract getJobThumbnail(fileName: string): Promise<string | null>;
  
  /**
   * Set LED enabled state
   * @param enabled - true to turn on, false to turn off
   * @returns Command result with success/failure
   */
  public abstract setLedEnabled(enabled: boolean): Promise<CommandResult>;
  
  // Helper methods for feature detection
  
  protected abstract supportsNewAPI(): boolean;
  protected abstract supportsCustomLEDControl(): boolean;
  protected abstract supportsMaterialStation(): boolean;
  protected abstract supportsLocalJobs(): boolean;
  protected abstract supportsRecentJobs(): boolean;
  protected abstract supportsUploadJobs(): boolean;
  protected abstract supportsStartJobs(): boolean;
  protected abstract getSupportedGCodeCommands(): readonly string[];
  protected abstract getMaterialStationSlotCount(): number;
}

