/**
 * @fileoverview Multi-context Spoolman tracker for managing filament usage tracking across multiple printer contexts.
 *
 * This service manages per-context usage tracker instances, ensuring that each
 * connected printer gets its own tracker that monitors filament consumption
 * independently. Spoolman tracking works for ALL connected printers in both
 * GUI and headless modes.
 *
 * Tracker routing per context:
 * - Material-station contexts (Creator 5 series, AD5X with station attached)
 *   get the estimate-based {@link StationUsageTracker}: the firmware exposes
 *   no per-tool usage over HTTP, so consumption is deducted from upload-time
 *   per-tool estimates through the slot→spool assignments.
 * - Every other context keeps the progress-based single-spool
 *   {@link SpoolmanUsageTracker}. This includes AD5X printers WITHOUT a
 *   material station, which now flow through the standard single-spool path.
 *
 * The station stores (estimates + slot assignments, both serial-keyed) are
 * pruned when their context is removed.
 *
 * Key Features:
 * - Creates a usage tracker for each printer context (station-aware routing)
 * - Connects trackers to their print state + polling monitors
 * - Handles tracker cleanup when contexts are removed
 * - Works in both GUI and headless modes (no mode-specific checks)
 * - Singleton pattern with global instance management
 *
 * Usage:
 * ```typescript
 * const tracker = getMultiContextSpoolmanTracker();
 * tracker.initialize();
 *
 * // Trackers are created automatically when print state monitors are ready
 * ```
 *
 * @exports MultiContextSpoolmanTracker - Main coordinator class
 * @exports getMultiContextSpoolmanTracker - Singleton instance accessor
 */

import { EventEmitter } from 'events';
import type { DeductionSummary } from '@shared/types/spoolman-tracking';
import { getPrinterContextManager } from '../managers/PrinterContextManager.js';
import { getPrinterBackendManager } from '../managers/PrinterBackendManager.js';
import { ConfigManager } from '../managers/ConfigManager.js';
import type { PrintStateMonitor } from './PrintStateMonitor.js';
import type { PrinterPollingService } from './PrinterPollingService.js';
import { StationUsageTracker } from './StationUsageTracker.js';
import { SpoolmanUsageTracker } from './SpoolmanUsageTracker.js';
import { getJobEstimateStore } from './JobEstimateStore.js';
import { getSlotSpoolStore } from './SlotSpoolStore.js';
import { getSpoolmanIntegrationService } from './SpoolmanIntegrationService.js';
import { pruneStationStores } from './station-store-key.js';
import { SpoolmanService } from './SpoolmanService.js';

/** Events emitted by the coordinator itself. */
interface MultiContextSpoolmanEventMap extends Record<string, unknown[]> {
  'tracker-created': [{ contextId: string }];
  'tracker-removed': [{ contextId: string }];
  'station-deduction': [{ contextId: string; summary: DeductionSummary }];
}

/**
 * Either tracker flavor; station contexts get {@link StationUsageTracker},
 * all others {@link SpoolmanUsageTracker}.
 */
export type ContextUsageTracker = SpoolmanUsageTracker | StationUsageTracker;

// ============================================================================
// MULTI-CONTEXT SPOOLMAN TRACKER
// ============================================================================

/**
 * Manages Spoolman usage trackers for all printer contexts
 */
export class MultiContextSpoolmanTracker extends EventEmitter<MultiContextSpoolmanEventMap> {
  private readonly trackers = new Map<string, ContextUsageTracker>();
  private readonly contextManager = getPrinterContextManager();
  private readonly handleContextRemovedBound = (event: { contextId: string }): void => {
    // Drop the tracker and prune the serial-keyed station stores (estimates,
    // ledger, slot→spool assignments) for the removed context.
    pruneStationStores(event.contextId);
    this.removeTrackerForContext(event.contextId);
  };
  private isInitialized = false;

  constructor() {
    super();
  }

  /**
   * Initialize the multi-context Spoolman tracker
   * Sets up event listeners for context lifecycle events
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.log('[MultiContextSpoolmanTracker] Already initialized');
      return;
    }

    this.contextManager.on('context-removed', this.handleContextRemovedBound);

    this.isInitialized = true;
    console.log('[MultiContextSpoolmanTracker] Initialized');
  }

  /**
   * Create and configure a usage tracker for a context.
   * Called when print state monitor is ready for a context.
   *
   * Material-station contexts get the estimate-based StationUsageTracker;
   * every other context (including AD5X without a station) keeps the
   * legacy progress-based single-spool SpoolmanUsageTracker.
   *
   * @param contextId - Context ID to create tracker for
   * @param printStateMonitor - Print state monitor to attach to tracker
   * @param pollingService - Per-context polling service (drives the station
   *   tracker's last-known progress snapshots); optional for legacy callers
   */
  public createTrackerForContext(
    contextId: string,
    printStateMonitor: PrintStateMonitor,
    pollingService?: PrinterPollingService
  ): void {
    if (this.trackers.has(contextId)) {
      console.warn(`[MultiContextSpoolmanTracker] Tracker already exists for context ${contextId}`);
      return;
    }

    const tracker = this.isStationContext(contextId)
      ? this.createStationTracker(contextId)
      : new SpoolmanUsageTracker(contextId);

    // Wire print state monitor (+ polling service for station trackers)
    if (tracker instanceof SpoolmanUsageTracker) {
      tracker.setPrintStateMonitor(printStateMonitor);
      this.setupTrackerEventForwarding(tracker);
    } else {
      tracker.setMonitors(printStateMonitor, pollingService ?? null);
    }

    this.trackers.set(contextId, tracker);

    console.log(
      `[MultiContextSpoolmanTracker] Created ${tracker instanceof StationUsageTracker ? 'station' : 'single-spool'} tracker for context ${contextId}`
    );

    this.emit('tracker-created', { contextId });
  }

  /** Material-station capability check for tracker routing. */
  private isStationContext(contextId: string): boolean {
    try {
      return getPrinterBackendManager().isFeatureAvailable(contextId, 'material-station');
    } catch (error) {
      console.warn(
        `[MultiContextSpoolmanTracker] Feature lookup failed for context ${contextId}:`,
        error
      );
      return false;
    }
  }

  /** Build the estimate-based tracker for a station context. */
  private createStationTracker(contextId: string): StationUsageTracker {
    return new StationUsageTracker({
      contextId,
      estimates: getJobEstimateStore(),
      slots: getSlotSpoolStore(),
      integrationService: getSpoolmanIntegrationService(),
      createSpoolmanService: () => {
        const config = ConfigManager.getInstance().getConfig();
        return config.SpoolmanEnabled && config.SpoolmanServerUrl
          ? new SpoolmanService(config.SpoolmanServerUrl)
          : null;
      },
      onSummary: (summary) => {
        this.emit('station-deduction', { contextId, summary });
      },
    });
  }

  /**
   * Setup event forwarding from individual tracker to global listeners
   */
  private setupTrackerEventForwarding(tracker: SpoolmanUsageTracker): void {
    const contextId = tracker.getContextId();

    // Forward usage-updated events
    tracker.on('usage-updated', (event: unknown) => {
      this.emit('usage-updated', event);
    });

    // Forward usage-update-failed events
    tracker.on('usage-update-failed', (event: unknown) => {
      this.emit('usage-update-failed', event);
    });

    console.log(`[MultiContextSpoolmanTracker] Event forwarding setup for context ${contextId}`);
  }

  /**
   * Destroy tracker for a specific context (public API)
   * @param contextId - Context ID to destroy tracker for
   */
  public destroyTracker(contextId: string): void {
    this.removeTrackerForContext(contextId);
  }

  /**
   * Remove and dispose tracker for a context
   * Called when context is removed
   *
   * @param contextId - Context ID to remove tracker for
   */
  private removeTrackerForContext(contextId: string): void {
    const tracker = this.trackers.get(contextId);
    if (!tracker) {
      return;
    }

    tracker.dispose();

    this.trackers.delete(contextId);

    console.log(`[MultiContextSpoolmanTracker] Removed tracker for context ${contextId}`);

    this.emit('tracker-removed', { contextId });
  }

  /**
   * Get tracker for a specific context
   *
   * @param contextId - Context ID
   * @returns Tracker instance or undefined
   */
  public getTracker(contextId: string): ContextUsageTracker | undefined {
    return this.trackers.get(contextId);
  }

  /**
   * Get the estimate-based station tracker for a context, if it has one.
   *
   * @param contextId - Context ID
   * @returns Station tracker instance or undefined (non-station contexts)
   */
  public getStationTracker(contextId: string): StationUsageTracker | undefined {
    const tracker = this.trackers.get(contextId);
    return tracker instanceof StationUsageTracker ? tracker : undefined;
  }

  /**
   * Most recent station deduction summary for a context (for UI display).
   */
  public getLastDeduction(contextId: string): DeductionSummary | null {
    return this.getStationTracker(contextId)?.getLastSummary() ?? null;
  }

  /**
   * Get all active trackers
   *
   * @returns Array of all tracker instances
   */
  public getAllTrackers(): ContextUsageTracker[] {
    return Array.from(this.trackers.values());
  }

  /**
   * Get number of active trackers
   *
   * @returns Count of trackers
   */
  public getTrackerCount(): number {
    return this.trackers.size;
  }

  /**
   * Dispose all trackers and cleanup
   */
  public dispose(): void {
    console.log('[MultiContextSpoolmanTracker] Disposing all trackers...');

    for (const [contextId, tracker] of this.trackers) {
      tracker.dispose();
      console.log(`[MultiContextSpoolmanTracker] Disposed tracker for context ${contextId}`);
    }

    this.trackers.clear();

    this.removeAllListeners();

    if (this.isInitialized) {
      this.contextManager.off('context-removed', this.handleContextRemovedBound);
    }
    this.isInitialized = false;
    console.log('[MultiContextSpoolmanTracker] Disposed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global multi-context Spoolman tracker instance
 */
let globalMultiContextSpoolmanTracker: MultiContextSpoolmanTracker | null = null;

/**
 * Get global multi-context Spoolman tracker instance
 */
export function getMultiContextSpoolmanTracker(): MultiContextSpoolmanTracker {
  if (!globalMultiContextSpoolmanTracker) {
    globalMultiContextSpoolmanTracker = new MultiContextSpoolmanTracker();
  }
  return globalMultiContextSpoolmanTracker;
}
