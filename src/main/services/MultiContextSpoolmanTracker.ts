/**
 * @fileoverview Multi-context Spoolman tracker for managing filament usage tracking across multiple printer contexts.
 *
 * This service manages per-context SpoolmanUsageTracker instances, ensuring that each
 * connected printer gets its own usage tracker that monitors filament consumption independently.
 * Spoolman tracking works for ALL connected printers in both GUI and headless modes.
 *
 * Key Features:
 * - Creates Spoolman usage tracker for each printer context
 * - Connects trackers to their respective temperature monitors
 * - Handles tracker cleanup when contexts are removed
 * - Works in both GUI and headless modes (no mode-specific checks)
 * - Singleton pattern with global instance management
 *
 * Architecture:
 * - Maps context IDs to SpoolmanUsageTracker instances
 * - Listens to PrinterContextManager events for context lifecycle
 * - Independent usage tracking per printer context
 * - Integrates with MultiContextTemperatureMonitor for cooling events
 *
 * Usage:
 * ```typescript
 * const tracker = getMultiContextSpoolmanTracker();
 * tracker.initialize();
 *
 * // Trackers are created automatically when temperature monitors are ready
 * ```
 *
 * @exports MultiContextSpoolmanTracker - Main coordinator class
 * @exports getMultiContextSpoolmanTracker - Singleton instance accessor
 */

import { EventEmitter } from 'events';
import { getPrinterContextManager } from '../managers/PrinterContextManager.js';
import { SpoolmanUsageTracker } from './SpoolmanUsageTracker.js';
import type { PrintStateMonitor } from './PrintStateMonitor.js';

// ============================================================================
// MULTI-CONTEXT SPOOLMAN TRACKER
// ============================================================================

/**
 * Manages Spoolman usage trackers for all printer contexts
 */
export class MultiContextSpoolmanTracker extends EventEmitter {
  private readonly trackers = new Map<string, SpoolmanUsageTracker>();
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

    const contextManager = getPrinterContextManager();

    // Listen for context removal to cleanup trackers
    contextManager.on('context-removed', (event: unknown) => {
      const removeEvent = event as { contextId: string };
      this.removeTrackerForContext(removeEvent.contextId);
    });

    this.isInitialized = true;
    console.log('[MultiContextSpoolmanTracker] Initialized');
  }

  /**
   * Create and configure Spoolman usage tracker for a context
   * Called when print state monitor is ready for a context
   *
   * @param contextId - Context ID to create tracker for
   * @param printStateMonitor - Print state monitor to attach to tracker
   */
  public createTrackerForContext(contextId: string, printStateMonitor: PrintStateMonitor): void {
    // Check if tracker already exists
    if (this.trackers.has(contextId)) {
      console.warn(`[MultiContextSpoolmanTracker] Tracker already exists for context ${contextId}`);
      return;
    }

    // Create new tracker for this context
    const tracker = new SpoolmanUsageTracker(contextId);

    // Wire print state monitor
    tracker.setPrintStateMonitor(printStateMonitor);

    // Forward events from this tracker
    this.setupTrackerEventForwarding(tracker);

    // Store tracker
    this.trackers.set(contextId, tracker);

    console.log(`[MultiContextSpoolmanTracker] Created tracker for context ${contextId}`);

    // Emit event
    this.emit('tracker-created', { contextId });
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

    // Dispose tracker
    tracker.dispose();

    // Remove from map
    this.trackers.delete(contextId);

    console.log(`[MultiContextSpoolmanTracker] Removed tracker for context ${contextId}`);

    // Emit event
    this.emit('tracker-removed', { contextId });
  }

  /**
   * Get tracker for a specific context
   *
   * @param contextId - Context ID
   * @returns Tracker instance or undefined
   */
  public getTracker(contextId: string): SpoolmanUsageTracker | undefined {
    return this.trackers.get(contextId);
  }

  /**
   * Get all active trackers
   *
   * @returns Array of all tracker instances
   */
  public getAllTrackers(): SpoolmanUsageTracker[] {
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

    // Dispose all trackers
    for (const [contextId, tracker] of this.trackers) {
      tracker.dispose();
      console.log(`[MultiContextSpoolmanTracker] Disposed tracker for context ${contextId}`);
    }

    // Clear map
    this.trackers.clear();

    // Remove all event listeners
    this.removeAllListeners();

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

