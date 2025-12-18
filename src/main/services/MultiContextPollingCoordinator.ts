/**
 * @fileoverview Multi-context polling coordinator for managing polling across multiple printer contexts.
 *
 * This service coordinates multiple PrinterPollingService instances, one per printer context,
 * with dynamic polling frequency based on whether a context is active or inactive.
 * Active contexts poll every 3 seconds, inactive contexts poll every 30 seconds to reduce
 * load while maintaining status awareness across all connected printers.
 *
 * Key Responsibilities:
 * - Create and manage polling service instances per context
 * - Adjust polling frequencies based on active/inactive context state
 * - Forward polling events with context identification
 * - Clean up polling services when contexts are removed
 * - Listen to PrinterContextManager events for automatic coordination
 *
 * Architecture:
 * - Singleton pattern for centralized polling coordination
 * - Event-driven integration with PrinterContextManager
 * - Map-based storage of polling services indexed by context ID
 * - Automatic frequency adjustment on context switch
 *
 * Usage:
 * ```typescript
 * const coordinator = MultiContextPollingCoordinator.getInstance();
 *
 * // Start polling for a context
 * coordinator.startPollingForContext(contextId);
 *
 * // Context switching automatically adjusts polling frequencies
 * // via PrinterContextManager event listeners
 *
 * // Stop polling for a context
 * coordinator.stopPollingForContext(contextId);
 * ```
 *
 * Events:
 * - 'polling-data': (contextId: string, data: PollingData) - Polling data updated for a context
 * - 'polling-error': (contextId: string, error: string) - Polling error occurred
 * - 'polling-started': (contextId: string) - Polling started for context
 * - 'polling-stopped': (contextId: string) - Polling stopped for context
 *
 * Related:
 * - PrinterPollingService: Per-context polling service
 * - PrinterContextManager: Context lifecycle management
 * - PrinterBackendManager: Backend instances for polling
 */

import { EventEmitter } from 'events';
import { PrinterPollingService, POLLING_EVENTS } from './PrinterPollingService.js';
import { getPrinterContextManager } from '../managers/PrinterContextManager.js';
import type { PollingData, PollingConfig } from '@shared/types/polling.js';
import type { ContextSwitchEvent, ContextRemovedEvent } from '@shared/types/PrinterContext.js';
import { logVerbose } from '@shared/logging.js';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/**
 * Polling interval for the active (visible) context
 * Fast polling ensures responsive UI updates for the printer being monitored
 */
const ACTIVE_CONTEXT_POLLING_INTERVAL_MS = 3000; // 3 seconds

/**
 * Polling interval for inactive (background) contexts
 * Set to 3 seconds to keep TCP connections alive and prevent keep-alive failures
 * Previously 30 seconds caused TCP timeouts
 */
const INACTIVE_CONTEXT_POLLING_INTERVAL_MS = 3000; // 3 seconds

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Event map for type safety
 * Export for consumers who need typed event listeners
 */
export interface MultiContextPollingEventMap extends Record<string, unknown[]> {
  'polling-data': [contextId: string, data: PollingData];
  'polling-error': [contextId: string, error: string];
  'polling-started': [contextId: string];
  'polling-stopped': [contextId: string];
}

// ============================================================================
// POLLING COORDINATOR
// ============================================================================

/**
 * Branded type for MultiContextPollingCoordinator to ensure singleton pattern
 */
type MultiContextPollingCoordinatorBrand = { readonly __brand: 'MultiContextPollingCoordinator' };
type MultiContextPollingCoordinatorInstance = MultiContextPollingCoordinator & MultiContextPollingCoordinatorBrand;
const COORDINATOR_LOG_NAMESPACE = 'MultiContextPollingCoordinator';

/**
 * Coordinates polling services across multiple printer contexts
 * Manages per-context polling services with dynamic frequency adjustment
 */
export class MultiContextPollingCoordinator extends EventEmitter {
  private static instance: MultiContextPollingCoordinatorInstance | null = null;

  /** Map of polling services indexed by context ID */
  private readonly pollingServices = new Map<string, PrinterPollingService>();

  /** Reference to context manager for event listening */
  private readonly contextManager = getPrinterContextManager();

  /** Flag to track if event listeners are registered */
  private listenersRegistered = false;

  private logDebug(message: string, ...args: unknown[]): void {
    logVerbose(COORDINATOR_LOG_NAMESPACE, message, ...args);
  }

  private constructor() {
    super();
    this.setupContextManagerListeners();
  }

  /**
   * Get singleton instance of MultiContextPollingCoordinator
   */
  public static getInstance(): MultiContextPollingCoordinatorInstance {
    if (!MultiContextPollingCoordinator.instance) {
      MultiContextPollingCoordinator.instance = new MultiContextPollingCoordinator() as MultiContextPollingCoordinatorInstance;
    }
    return MultiContextPollingCoordinator.instance;
  }

  // ============================================================================
  // CONTEXT MANAGER INTEGRATION
  // ============================================================================

  /**
   * Set up listeners for PrinterContextManager events
   * Automatically adjusts polling when contexts are switched or removed
   */
  private setupContextManagerListeners(): void {
    if (this.listenersRegistered) {
      return;
    }

    // Listen for context switches to adjust polling frequencies
    this.contextManager.on('context-switched', (event: ContextSwitchEvent) => {
      this.handleContextSwitch(event.contextId, event.previousContextId);
    });

    // Listen for context removal to clean up polling services
    this.contextManager.on('context-removed', (event: ContextRemovedEvent) => {
      this.stopPollingForContext(event.contextId);
    });

    this.listenersRegistered = true;
    this.logDebug('Context manager listeners registered');
  }

  /**
   * Handle context switch by adjusting polling frequencies
   * Active context gets fast polling, previous context gets slow polling
   *
   * @param newContextId - ID of newly active context
   * @param previousContextId - ID of previously active context (null if none)
   */
  private handleContextSwitch(newContextId: string, previousContextId: string | null): void {
    this.logDebug(`Context switched from ${previousContextId || 'none'} to ${newContextId}`);

    // Set new active context to fast polling
    const newContextPoller = this.pollingServices.get(newContextId);
    if (newContextPoller) {
      newContextPoller.updateConfig({ intervalMs: ACTIVE_CONTEXT_POLLING_INTERVAL_MS });
      this.logDebug(`Updated ${newContextId} to fast polling (${ACTIVE_CONTEXT_POLLING_INTERVAL_MS}ms)`);

      // Immediately emit cached polling data for the new active context
      // This ensures the UI updates instantly when switching tabs instead of waiting for the next poll cycle
      const cachedData = newContextPoller.getCurrentData();
      if (cachedData) {
        this.logDebug(`Emitting cached polling data for context ${newContextId}`);
        this.emit('polling-data', newContextId, cachedData);
      }
    }

    // Set previous active context to slow polling
    if (previousContextId) {
      const previousContextPoller = this.pollingServices.get(previousContextId);
      if (previousContextPoller) {
        previousContextPoller.updateConfig({ intervalMs: INACTIVE_CONTEXT_POLLING_INTERVAL_MS });
        this.logDebug(`Updated ${previousContextId} to slow polling (${INACTIVE_CONTEXT_POLLING_INTERVAL_MS}ms)`);
      }
    }
  }

  // ============================================================================
  // POLLING SERVICE MANAGEMENT
  // ============================================================================

  /**
   * Start polling for a specific context
   * Creates a new polling service instance and starts it with appropriate frequency
   *
   * @param contextId - Context ID to start polling for
   * @throws Error if context doesn't exist
   * @throws Error if backend is not available for context
   */
  public startPollingForContext(contextId: string): void {
    // Check if already polling
    if (this.pollingServices.has(contextId)) {
      this.logDebug(`Already polling for context ${contextId}`);
      return;
    }

    // Get context from manager
    const context = this.contextManager.getContext(contextId);
    if (!context) {
      throw new Error(`Cannot start polling: Context ${contextId} does not exist`);
    }

    // Verify backend is available
    if (!context.backend) {
      throw new Error(`Cannot start polling: Context ${contextId} has no backend`);
    }

    // Determine polling interval based on active state
    const isActive = context.isActive;
    const intervalMs = isActive ? ACTIVE_CONTEXT_POLLING_INTERVAL_MS : INACTIVE_CONTEXT_POLLING_INTERVAL_MS;

    // Create polling configuration
    const config: Partial<PollingConfig> = {
      intervalMs,
      maxRetries: 3,
      retryDelayMs: 2000
    };

    // Create and configure polling service
    const pollingService = new PrinterPollingService(config);

    // Create a wrapper that adapts the context-aware backend to the polling service's interface
    // PrinterPollingService expects methods without contextId, so we bind the contextId here
    const backendWrapper = {
      getPrinterStatus: async () => {
        return await context.backend!.getPrinterStatus();
      },
      getMaterialStationStatus: async () => {
        // Backend method is synchronous, wrap in Promise.resolve
        return Promise.resolve(context.backend!.getMaterialStationStatus());
      },
      getModelPreview: async () => {
        return await context.backend!.getModelPreview();
      },
      getJobThumbnail: async (fileName: string) => {
        return await context.backend!.getJobThumbnail(fileName);
      }
    };

    pollingService.setBackendManager(backendWrapper as Parameters<typeof pollingService.setBackendManager>[0]);

    // Set up event forwarding with context identification
    this.setupPollingServiceEvents(contextId, pollingService);

    // Store and start the polling service
    this.pollingServices.set(contextId, pollingService);

    // Update context manager reference
    this.contextManager.updatePollingService(contextId, pollingService);

    const started = pollingService.start();

    if (started) {
      this.logDebug(`Started ${isActive ? 'fast' : 'slow'} polling for context ${contextId} (${intervalMs}ms)`);
      this.emit('polling-started', contextId);
    } else {
      console.error(`[MultiContextPollingCoordinator] Failed to start polling for context ${contextId}`);
    }
  }

  /**
   * Stop polling for a specific context
   * Cleans up the polling service and removes it from the map
   *
   * @param contextId - Context ID to stop polling for
   */
  public stopPollingForContext(contextId: string): void {
    const pollingService = this.pollingServices.get(contextId);
    if (!pollingService) {
      this.logDebug(`No polling service for context ${contextId}`);
      return;
    }

    // Stop and dispose of the polling service
    pollingService.stop();
    pollingService.dispose();

    // Remove from map
    this.pollingServices.delete(contextId);

    this.logDebug(`Stopped polling for context ${contextId}`);
    this.emit('polling-stopped', contextId);
  }

  /**
   * Set up event forwarding from a polling service
   * Adds context ID to all events for identification
   *
   * @param contextId - Context ID for event tagging
   * @param pollingService - Polling service to listen to
   */
  private setupPollingServiceEvents(contextId: string, pollingService: PrinterPollingService): void {
    // Forward data updates with context ID
    pollingService.on(POLLING_EVENTS.DATA_UPDATED, (data: PollingData) => {
      this.emit('polling-data', contextId, data);
    });

    // Forward polling errors with context ID
    pollingService.on(POLLING_EVENTS.POLLING_ERROR, (errorData: { error: string }) => {
      this.emit('polling-error', contextId, errorData.error);
    });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Check if polling is active for a context
   *
   * @param contextId - Context ID to check
   * @returns True if polling is running for this context
   */
  public isPollingForContext(contextId: string): boolean {
    const pollingService = this.pollingServices.get(contextId);
    return pollingService ? pollingService.isRunning() : false;
  }

  /**
   * Get current polling data for a context
   *
   * @param contextId - Context ID to get data for
   * @returns Current polling data or null if not polling
   */
  public getPollingDataForContext(contextId: string): PollingData | null {
    const pollingService = this.pollingServices.get(contextId);
    return pollingService ? pollingService.getCurrentData() : null;
  }

  /**
   * Get polling statistics for a context
   *
   * @param contextId - Context ID to get stats for
   * @returns Polling stats or null if not polling
   */
  public getPollingStatsForContext(contextId: string): ReturnType<PrinterPollingService['getStats']> | null {
    const pollingService = this.pollingServices.get(contextId);
    return pollingService ? pollingService.getStats() : null;
  }

  /**
   * Get all active polling contexts
   *
   * @returns Array of context IDs that have active polling
   */
  public getActivePollingContexts(): string[] {
    return Array.from(this.pollingServices.keys());
  }

  /**
   * Get total number of active polling services
   *
   * @returns Count of active polling services
   */
  public getActivePollingCount(): number {
    return this.pollingServices.size;
  }

  /**
   * Update polling configuration for a specific context
   * Useful for dynamically adjusting polling behavior
   *
   * @param contextId - Context ID to update
   * @param config - Partial configuration to apply
   * @returns True if configuration was updated, false if context not found
   */
  public updatePollingConfigForContext(contextId: string, config: Partial<PollingConfig>): boolean {
    const pollingService = this.pollingServices.get(contextId);
    if (!pollingService) {
      return false;
    }

    pollingService.updateConfig(config);
    this.logDebug(`Updated polling config for context ${contextId}`, config);
    return true;
  }

  /**
   * Stop all polling services
   * Useful for application shutdown or reset
   */
  public stopAllPolling(): void {
    console.info(`[MultiContextPollingCoordinator] Stopping all polling services (${this.pollingServices.size} active)`);

    const contextIds = Array.from(this.pollingServices.keys());
    for (const contextId of contextIds) {
      this.stopPollingForContext(contextId);
    }
  }

  /**
   * Clean up coordinator resources
   * Stops all polling and removes event listeners
   */
  public dispose(): void {
    this.stopAllPolling();
    this.removeAllListeners();
    this.listenersRegistered = false;
    console.info('[MultiContextPollingCoordinator] Disposed');
  }

  /**
   * Get comprehensive status of the coordinator
   * Useful for debugging and monitoring
   *
   * @returns Status object with coordinator information
   */
  public getStatus(): {
    activePollingCount: number;
    activeContexts: string[];
    listenersRegistered: boolean;
    pollingConfigs: Record<string, { intervalMs: number; isPolling: boolean; retryCount: number }>;
  } {
    const pollingConfigs: Record<string, { intervalMs: number; isPolling: boolean; retryCount: number }> = {};

    this.pollingServices.forEach((pollingService, contextId) => {
      const stats = pollingService.getStats();
      pollingConfigs[contextId] = {
        intervalMs: stats.intervalMs,
        isPolling: stats.isPolling,
        retryCount: stats.retryCount
      };
    });

    return {
      activePollingCount: this.pollingServices.size,
      activeContexts: Array.from(this.pollingServices.keys()),
      listenersRegistered: this.listenersRegistered,
      pollingConfigs
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Get singleton instance of MultiContextPollingCoordinator
 * Convenience function for imports
 */
export function getMultiContextPollingCoordinator(): MultiContextPollingCoordinatorInstance {
  return MultiContextPollingCoordinator.getInstance();
}

