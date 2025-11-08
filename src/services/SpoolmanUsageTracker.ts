/**
 * @fileoverview Spoolman usage tracker for updating filament usage when prints complete.
 *
 * This service tracks filament usage and updates Spoolman immediately when prints complete, extracted from
 * PrinterNotificationCoordinator to enable functionality in both GUI and headless modes.
 *
 * Key Features:
 * - Listens to PrintStateMonitor 'print-completed' events
 * - Extracts usage data from printer status (weight/length based on config)
 * - Updates Spoolman via SpoolmanService API
 * - Persists updated spool data via SpoolmanIntegrationService
 * - Per-context tracking with duplicate prevention
 * - Works in both GUI and headless modes
 *
 * Core Responsibilities:
 * - Monitor print state for completion events
 * - Verify Spoolman is enabled and configured
 * - Resolve context ID and active spool assignment
 * - Extract filament usage from print job data
 * - Update Spoolman server with usage data
 * - Update local active spool state
 * - Prevent duplicate updates for the same print
 *
 * Usage Flow:
 * 1. Print completes
 * 2. PrintStateMonitor emits 'print-completed' event
 * 3. SpoolmanUsageTracker receives event
 * 4. Checks if usage already recorded for this print
 * 5. Verifies Spoolman configuration and active spool
 * 6. Extracts usage data from printer status
 * 7. Calls SpoolmanService.updateUsage() API
 * 8. Updates local state via SpoolmanIntegrationService
 * 9. Marks usage as recorded
 *
 * @exports SpoolmanUsageTracker - Main tracker class
 */

import { EventEmitter } from 'events';
import { getConfigManager } from '../managers/ConfigManager';
import { getPrinterContextManager } from '../managers/PrinterContextManager';
import { getSpoolmanIntegrationService } from './SpoolmanIntegrationService';
import { SpoolmanService } from './SpoolmanService';
import type { PrintStateMonitor } from './PrintStateMonitor';
import type { PrinterStatus } from '../types/polling';

// ============================================================================
// SPOOLMAN USAGE TRACKER
// ============================================================================

/**
 * Tracks filament usage and updates Spoolman when prints cool down
 */
export class SpoolmanUsageTracker extends EventEmitter {
  private readonly contextId: string;
  private readonly configManager = getConfigManager();
  private printStateMonitor: PrintStateMonitor | null = null;
  private usageRecordedForPrint: string | null = null;

  constructor(contextId: string) {
    super();
    this.contextId = contextId;

    console.log(`[SpoolmanUsageTracker] Created for context ${contextId}`);
  }

  // ============================================================================
  // PRINT STATE MONITOR INTEGRATION
  // ============================================================================

  /**
   * Set the print state monitor to listen to
   */
  public setPrintStateMonitor(monitor: PrintStateMonitor): void {
    // Remove listeners from old monitor
    if (this.printStateMonitor) {
      this.removePrintStateMonitorListeners();
    }

    this.printStateMonitor = monitor;
    this.setupPrintStateMonitorListeners();

    console.log(`[SpoolmanTracker] Print state monitor connected for context ${this.contextId}`);
  }

  /**
   * Setup print state monitor event listeners
   */
  private setupPrintStateMonitorListeners(): void {
    if (!this.printStateMonitor) return;

    // Trigger Spoolman deduction immediately when print completes
    this.printStateMonitor.on('print-completed', (event) => {
      if (event.contextId === this.contextId) {
        void this.handlePrintCompleted(event);
      }
    });

    // Reset tracking when new print starts
    this.printStateMonitor.on('print-started', (event) => {
      if (event.contextId === this.contextId) {
        this.resetTracking();
      }
    });
  }

  /**
   * Remove print state monitor event listeners
   */
  private removePrintStateMonitorListeners(): void {
    if (!this.printStateMonitor) return;

    this.printStateMonitor.removeAllListeners('print-completed');
    this.printStateMonitor.removeAllListeners('print-started');
  }

  // ============================================================================
  // PRINT COMPLETED HANDLING
  // ============================================================================

  /**
   * Handle print completed event
   */
  private async handlePrintCompleted(event: { contextId: string; jobName: string; status: PrinterStatus; completedAt: Date }): Promise<void> {
    console.log(`[SpoolmanTracker] Print completed: ${event.jobName}`);

    // Validate context
    if (event.contextId !== this.contextId) {
      console.warn('[SpoolmanTracker] Context mismatch in print-completed event');
      return;
    }

    // Check if already recorded for this print
    if (this.usageRecordedForPrint === event.jobName) {
      console.log(`[SpoolmanTracker] Usage already recorded for: ${event.jobName}`);
      return;
    }

    // Update Spoolman with cached filament data from backend
    await this.updateSpoolmanUsage(event.status);

    // Mark as recorded
    this.usageRecordedForPrint = event.jobName;
  }

  /**
   * Reset tracking state
   */
  private resetTracking(): void {
    this.usageRecordedForPrint = null;
    console.log('[SpoolmanTracker] Tracking state reset');
  }

  /**
   * Update Spoolman filament usage when a print has cooled.
   * Resolves the associated context, derives usage from polling data, and persists updates.
   *
   * This is extracted from PrinterNotificationCoordinator.updateSpoolmanUsage() (lines 354-436)
   */
  private async updateSpoolmanUsage(status: PrinterStatus): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      if (!config.SpoolmanEnabled || !config.SpoolmanServerUrl) {
        console.log(`[SpoolmanUsageTracker] Spoolman not enabled or configured for context ${this.contextId}`);
        return;
      }

      let integrationService: ReturnType<typeof getSpoolmanIntegrationService>;
      try {
        integrationService = getSpoolmanIntegrationService();
      } catch {
        console.warn('[SpoolmanUsageTracker] Integration service not initialized - skipping usage update');
        return;
      }

      if (!integrationService.isGloballyEnabled() || !integrationService.isContextSupported(this.contextId)) {
        console.log(`[SpoolmanUsageTracker] Context ${this.contextId} is not eligible for usage updates`);
        return;
      }

      const activeSpool = integrationService.getActiveSpool(this.contextId);
      if (!activeSpool) {
        console.log(`[SpoolmanUsageTracker] No active spool for context ${this.contextId} - skipping usage update`);
        return;
      }

      const job = status.currentJob;
      const progress = job?.progress;
      if (!progress) {
        console.warn('[SpoolmanUsageTracker] Unable to determine job progress for usage update');
        return;
      }

      const weightUsed = progress.weightUsed ?? 0;
      const lengthUsedMeters = progress.lengthUsed ?? 0;
      const lengthUsedMillimeters = Number((lengthUsedMeters * 1000).toFixed(2));

      let updatePayload: { use_weight?: number; use_length?: number } | null = null;
      if (config.SpoolmanUpdateMode === 'weight') {
        if (weightUsed > 0) {
          updatePayload = { use_weight: weightUsed };
        } else if (lengthUsedMillimeters > 0) {
          updatePayload = { use_length: lengthUsedMillimeters };
        }
      } else {
        if (lengthUsedMillimeters > 0) {
          updatePayload = { use_length: lengthUsedMillimeters };
        } else if (weightUsed > 0) {
          updatePayload = { use_weight: weightUsed };
        }
      }

      if (!updatePayload) {
        console.warn('[SpoolmanUsageTracker] No filament usage recorded for this print');
        return;
      }

      const service = new SpoolmanService(config.SpoolmanServerUrl);
      console.log(`[SpoolmanUsageTracker] Updating spool ${activeSpool.id} for context ${this.contextId}`, updatePayload);

      const updatedSpool = await service.updateUsage(activeSpool.id, updatePayload);
      const updatedActiveSpool = integrationService.convertToActiveSpoolData(updatedSpool);
      await integrationService.setActiveSpool(this.contextId, updatedActiveSpool);

      console.log(`[SpoolmanUsageTracker] Successfully updated spool usage for context ${this.contextId}`);

      // Emit success event
      this.emit('usage-updated', {
        contextId: this.contextId,
        spoolId: activeSpool.id,
        usage: updatePayload
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[SpoolmanUsageTracker] Failed to update filament usage:', message);

      // Emit error event
      this.emit('usage-update-failed', {
        contextId: this.contextId,
        error: message
      });
    }
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  /**
   * Get context ID
   */
  public getContextId(): string {
    return this.contextId;
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Dispose of the tracker and clean up resources
   */
  public dispose(): void {
    console.log(`[SpoolmanUsageTracker] Disposing for context ${this.contextId}`);

    this.removePrintStateMonitorListeners();
    this.removeAllListeners();

    this.printStateMonitor = null;
  }
}
