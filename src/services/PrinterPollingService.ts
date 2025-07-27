// src/services/PrinterPollingService.ts
// Focused polling service that manages the polling loop and delegates data transformation
// Simplified from the original printer-polling.ts to focus on single responsibility

import { EventEmitter } from '../utils/EventEmitter';
import { printerDataTransformer } from './PrinterDataTransformer';
import type { 
  PollingData, 
  PollingConfig, 
  PrinterStatus, 
  CurrentJobInfo, 
  MaterialStationStatus
} from '../types/polling';
import { DEFAULT_POLLING_CONFIG, createEmptyPollingData } from '../types/polling';

// ============================================================================
// BACKEND INTERFACES
// ============================================================================

/**
 * Backend response types
 */
interface BackendStatusResponse {
  success: boolean;
  status?: unknown;
  error?: string;
  timestamp: Date;
}

interface BackendMaterialResponse {
  connected: boolean;
  slots: unknown[];
  activeSlot: number | null;
  errorMessage: string | null;
}

/**
 * Backend manager interface for type safety
 */
interface BackendManager {
  getPrinterStatus(): Promise<BackendStatusResponse | null>;
  getMaterialStationStatus(): Promise<BackendMaterialResponse | null>;
  getModelPreview?(): Promise<string | null>;
  getJobThumbnail?(fileName: string): Promise<string | null>;
}

// ============================================================================
// EVENTS
// ============================================================================

/**
 * Polling service event names
 */
export const POLLING_EVENTS = {
  DATA_UPDATED: 'data-updated',
  STATUS_UPDATED: 'status-updated',
  JOB_UPDATED: 'job-updated',
  MATERIAL_STATION_UPDATED: 'material-station-updated',
  POLLING_STARTED: 'polling-started',
  POLLING_STOPPED: 'polling-stopped',
  POLLING_ERROR: 'polling-error',
  CONNECTION_CHANGED: 'connection-changed'
} as const;

/**
 * Event map for type safety
 */
interface PollingServiceEventMap extends Record<string, unknown[]> {
  'data-updated': [PollingData];
  'status-updated': [PrinterStatus];
  'job-updated': [CurrentJobInfo];
  'material-station-updated': [MaterialStationStatus];
  'polling-started': [{ timestamp: Date; intervalMs: number }];
  'polling-stopped': [{ timestamp: Date }];
  'polling-error': [{ error: string; timestamp: Date; retryCount: number; willRetry: boolean }];
  'connection-changed': [{ connected: boolean }];
}

// ============================================================================
// POLLING SERVICE
// ============================================================================

/**
 * Focused polling service that manages the polling loop
 * Delegates data transformation to PrinterDataTransformer
 */
export class PrinterPollingService extends EventEmitter<PollingServiceEventMap> {
  private config: PollingConfig;
  private isPolling = false;
  private pollingTimer: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private lastSuccessfulPoll: Date | null = null;
  private currentData: PollingData;
  private backendManager: BackendManager | null = null;
  
  // Enhanced thumbnail caching
  private lastJobName: string | null = null;
  private currentThumbnail: string | null = null;
  private readonly thumbnailCache: Map<string, string | null> = new Map(); // filename -> thumbnail data (null = failed)
  private readonly thumbnailFailureCache: Set<string> = new Set(); // track failed fetches to avoid retries

  constructor(config: Partial<PollingConfig> = {}) {
    super();
    
    this.config = {
      ...DEFAULT_POLLING_CONFIG,
      ...config
    };
    
    this.currentData = createEmptyPollingData();
  }

  // ============================================================================
  // BACKEND MANAGEMENT
  // ============================================================================

  /**
   * Set the backend manager for data fetching
   */
  public setBackendManager(backendManager: BackendManager): void {
    this.backendManager = backendManager;
  }

  /**
   * Check if backend is available
   */
  private hasBackend(): boolean {
    return this.backendManager !== null;
  }

  // ============================================================================
  // POLLING CONTROL
  // ============================================================================

  /**
   * Start polling
   */
  public start(): boolean {
    if (this.isPolling) {
      console.log('Polling already running');
      return true;
    }

    if (!this.hasBackend()) {
      console.error('Cannot start polling: Backend manager not set');
      return false;
    }

    console.log(`Starting polling service (interval: ${this.config.intervalMs}ms)`);
    
    this.isPolling = true;
    this.retryCount = 0;
    this.scheduleNextPoll();
    
    this.emit(POLLING_EVENTS.POLLING_STARTED, {
      timestamp: new Date(),
      intervalMs: this.config.intervalMs
    });

    return true;
  }

  /**
   * Stop polling
   */
  public stop(): void {
    if (!this.isPolling) {
      return;
    }

    console.log('Stopping polling service');
    
    this.isPolling = false;
    this.retryCount = 0;
    
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.emit(POLLING_EVENTS.POLLING_STOPPED, {
      timestamp: new Date()
    });
  }

  /**
   * Check if currently polling
   */
  public isRunning(): boolean {
    return this.isPolling;
  }

  /**
   * Update polling configuration
   */
  public updateConfig(newConfig: Partial<PollingConfig>): void {
    const wasPolling = this.isPolling;
    
    if (wasPolling) {
      this.stop();
    }
    
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    if (wasPolling) {
      this.start();
    }
  }

  // ============================================================================
  // POLLING LOGIC
  // ============================================================================

  /**
   * Schedule next poll
   */
  private scheduleNextPoll(): void {
    if (!this.isPolling) {
      return;
    }

    const delay = this.retryCount > 0 
      ? this.calculateRetryDelay() 
      : this.config.intervalMs;

    this.pollingTimer = setTimeout(() => {
      void this.performPoll();
    }, delay);
  }

  /**
   * Perform a single poll operation
   */
  private async performPoll(): Promise<void> {
    if (!this.isPolling || !this.hasBackend()) {
      return;
    }

    try {
      console.log('Polling printer data...');
      
      // Fetch all data in parallel
      const [printerStatus, materialStation] = await Promise.allSettled([
        this.fetchPrinterStatus(),
        this.fetchMaterialStation()
      ]);

      // Process results
      let hasChanges = false;
      const newData: PollingData = {
        ...this.currentData,
        lastPolled: new Date()
      };

      // Process printer status
      if (printerStatus.status === 'fulfilled' && printerStatus.value) {
        newData.printerStatus = printerStatus.value;
        newData.isConnected = true;
        hasChanges = true;
        
        // Handle job changes and thumbnails
        await this.handleJobChange(printerStatus.value, newData);
        
        this.emit(POLLING_EVENTS.STATUS_UPDATED, printerStatus.value);
        
        if (printerStatus.value.currentJob && printerStatus.value.currentJob.isActive) {
          this.emit(POLLING_EVENTS.JOB_UPDATED, printerStatus.value.currentJob);
        }
      } else {
        // Connection lost
        newData.isConnected = false;
        newData.thumbnailData = null;
        
        if (this.currentData.isConnected) {
          hasChanges = true;
          this.emit(POLLING_EVENTS.CONNECTION_CHANGED, { connected: false });
          
          // Clear thumbnail on disconnect and clean cache
          this.clearThumbnailState();
        }
      }

      // Process material station
      if (materialStation.status === 'fulfilled' && materialStation.value) {
        newData.materialStation = materialStation.value;
        hasChanges = true;
        this.emit(POLLING_EVENTS.MATERIAL_STATION_UPDATED, materialStation.value);
      }

      // Update current data and emit if changed
      if (hasChanges) {
        this.currentData = newData;
        this.emit(POLLING_EVENTS.DATA_UPDATED, newData);
      }

      // Reset retry count on success
      this.retryCount = 0;
      this.lastSuccessfulPoll = new Date();
      
    } catch (error) {
      this.handlePollingError(error);
    } finally {
      // Schedule next poll
      this.scheduleNextPoll();
    }
  }

  /**
   * Fetch printer status
   */
  private async fetchPrinterStatus(): Promise<PrinterStatus | null> {
    if (!this.backendManager) {
      return null;
    }

    const response = await this.backendManager.getPrinterStatus();
    
    if (!response?.success || !response.status) {
      return null;
    }

    const transformedStatus = printerDataTransformer.transformPrinterStatus(response.status);
    
    return transformedStatus;
  }

  /**
   * Fetch material station status
   */
  private async fetchMaterialStation(): Promise<MaterialStationStatus | null> {
    if (!this.backendManager) {
      return null;
    }

    const response = await this.backendManager.getMaterialStationStatus();
    
    if (!response) {
      return null;
    }

    return printerDataTransformer.transformMaterialStation(response);
  }

  /**
   * Handle job changes and enhanced thumbnail fetching with caching
   */
  private async handleJobChange(status: PrinterStatus, data: PollingData): Promise<void> {
    const currentJob = status.currentJob;
    
    if (currentJob && currentJob.isActive && currentJob.fileName) {
      const fileName = currentJob.fileName;
      
      // Job is active, check if it's a new job
      if (fileName !== this.lastJobName) {
        console.log(`[ThumbnailCache] New job detected: ${fileName}`);
        this.lastJobName = fileName;
        
        // Check cache first
        if (this.thumbnailCache.has(fileName)) {
          const cachedThumbnail = this.thumbnailCache.get(fileName);
          this.currentThumbnail = cachedThumbnail ?? null; // Handle undefined case
          console.log(`[ThumbnailCache] Using cached thumbnail for ${fileName}: ${this.currentThumbnail ? 'Available' : 'Failed (cached)'}`);
        } else if (this.thumbnailFailureCache.has(fileName)) {
          // Previous failure, don't retry
          this.currentThumbnail = null;
          console.log(`[ThumbnailCache] Skipping ${fileName} - previous fetch failed`);
        } else {
          // Fetch new thumbnail using direct filename to avoid redundant status calls
          console.log(`[ThumbnailCache] Fetching thumbnail for ${fileName}...`);
          try {
            if (this.backendManager?.getJobThumbnail) {
              const thumbnail = await this.backendManager.getJobThumbnail(fileName);
              
              // Cache the result (success or null)
              this.thumbnailCache.set(fileName, thumbnail);
              this.currentThumbnail = thumbnail;
              
              if (thumbnail) {
                console.log(`[ThumbnailCache] Thumbnail fetched and cached for ${fileName}`);
              } else {
                console.log(`[ThumbnailCache] No thumbnail available for ${fileName} (cached null)`);
              }
            } else {
              // No thumbnail support
              this.currentThumbnail = null;
              this.thumbnailCache.set(fileName, null);
            }
          } catch (error) {
            console.error(`[ThumbnailCache] Failed to fetch thumbnail for ${fileName}:`, error);
            
            // Cache the failure to avoid retries
            this.currentThumbnail = null;
            this.thumbnailFailureCache.add(fileName);
            this.thumbnailCache.set(fileName, null);
          }
        }
      } else {
        // Same job, use current thumbnail (already fetched or cached)
        // No action needed, this.currentThumbnail is already set correctly
      }
    } else {
      // No active job, clear current thumbnail reference
      if (this.lastJobName !== null) {
        console.log('[ThumbnailCache] Job completed or no active job, clearing current thumbnail reference');
        this.clearCurrentThumbnail();
        // Note: Keep cache intact for potential job restart
      }
    }
    
    // Include thumbnail in data
    data.thumbnailData = this.currentThumbnail;
  }

  /**
   * Clear all thumbnail state and cache
   */
  private clearThumbnailState(): void {
    console.log('[ThumbnailCache] Clearing all thumbnail state and cache');
    this.lastJobName = null;
    this.currentThumbnail = null;
    this.thumbnailCache.clear();
    this.thumbnailFailureCache.clear();
  }

  /**
   * Clear only current thumbnail state (keep cache for potential restart)
   */
  private clearCurrentThumbnail(): void {
    console.log('[ThumbnailCache] Clearing current thumbnail state');
    this.lastJobName = null;
    this.currentThumbnail = null;
  }

  /**
   * Get cache statistics for debugging
   */
  private getThumbnailCacheStats(): {
    cacheSize: number;
    failureCacheSize: number;
    currentJob: string | null;
    hasThumbnail: boolean;
  } {
    return {
      cacheSize: this.thumbnailCache.size,
      failureCacheSize: this.thumbnailFailureCache.size,
      currentJob: this.lastJobName,
      hasThumbnail: this.currentThumbnail !== null
    };
  }

  /**
   * Handle polling errors
   */
  private handlePollingError(error: unknown): void {
    this.retryCount++;
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown polling error';
    const willRetry = this.retryCount <= this.config.maxRetries;
    
    console.error(`Polling error (attempt ${this.retryCount}/${this.config.maxRetries}):`, errorMessage);
    
    this.emit(POLLING_EVENTS.POLLING_ERROR, {
      error: errorMessage,
      timestamp: new Date(),
      retryCount: this.retryCount,
      willRetry
    });
    
    if (!willRetry) {
      console.error('Max polling retries reached, stopping polling');
      this.stop();
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(): number {
    const baseDelay = this.config.retryDelayMs;
    const backoffMultiplier = Math.pow(2, this.retryCount - 1);
    const maxDelay = 30000; // 30 seconds max
    
    return Math.min(baseDelay * backoffMultiplier, maxDelay);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get current polling data
   */
  public getCurrentData(): PollingData {
    return { ...this.currentData };
  }

  /**
   * Get polling statistics
   */
  public getStats(): {
    isPolling: boolean;
    retryCount: number;
    lastSuccessfulPoll: Date | null;
    intervalMs: number;
    isConnected: boolean;
  } {
    return {
      isPolling: this.isPolling,
      retryCount: this.retryCount,
      lastSuccessfulPoll: this.lastSuccessfulPoll,
      intervalMs: this.config.intervalMs,
      isConnected: this.currentData.isConnected
    };
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stop();
    this.clearThumbnailState(); // Clean up thumbnail cache
    this.removeAllListeners();
    this.backendManager = null;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create new polling service instance
 */
export function createPollingService(config?: Partial<PollingConfig>): PrinterPollingService {
  return new PrinterPollingService(config);
}

/**
 * Global polling service instance
 */
let globalPollingService: PrinterPollingService | null = null;

/**
 * Get global polling service instance
 */
export function getGlobalPollingService(): PrinterPollingService {
  if (!globalPollingService) {
    globalPollingService = new PrinterPollingService();
  }
  return globalPollingService;
}

/**
 * Reset global polling service
 */
export function resetGlobalPollingService(): void {
  if (globalPollingService) {
    globalPollingService.dispose();
    globalPollingService = null;
  }
}
