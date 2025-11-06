/**
 * @fileoverview Spoolman usage tracker for updating filament usage when prints complete and cool.
 *
 * This service tracks filament usage and updates Spoolman when prints cool down, extracted from
 * PrinterNotificationCoordinator to enable functionality in both GUI and headless modes.
 *
 * Key Features:
 * - Listens to TemperatureMonitoringService 'printer-cooled' events
 * - Extracts usage data from printer status (weight/length based on config)
 * - Updates Spoolman via SpoolmanService API
 * - Persists updated spool data via SpoolmanIntegrationService
 * - Per-context tracking with duplicate prevention
 * - Works in both GUI and headless modes
 *
 * Core Responsibilities:
 * - Monitor temperature cooling events for print completion
 * - Verify Spoolman is enabled and configured
 * - Resolve context ID and active spool assignment
 * - Extract filament usage from print job data
 * - Update Spoolman server with usage data
 * - Update local active spool state
 * - Prevent duplicate updates for the same print
 *
 * Usage Flow:
 * 1. Print completes and bed starts cooling
 * 2. TemperatureMonitoringService emits 'printer-cooled' event
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
import type { TemperatureMonitoringService } from './TemperatureMonitoringService';
import type { PrinterCooledEvent } from './MultiContextTemperatureMonitor';
import type { PrinterStatus } from '../types/polling';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Usage tracking state for a context
 */
interface UsageTrackingState {
  printCompleted: boolean;
  usageRecorded: boolean;
  lastRecordedJob: string | null;
}

// ============================================================================
// SPOOLMAN USAGE TRACKER
// ============================================================================

/**
 * Tracks filament usage and updates Spoolman when prints cool down
 */
export class SpoolmanUsageTracker extends EventEmitter {
  private readonly contextId: string;
  private readonly configManager = getConfigManager();
  private temperatureMonitor: TemperatureMonitoringService | null = null;

  private state: UsageTrackingState = {
    printCompleted: false,
    usageRecorded: false,
    lastRecordedJob: null
  };

  constructor(contextId: string) {
    super();
    this.contextId = contextId;

    console.log(`[SpoolmanUsageTracker] Created for context ${contextId}`);
  }

  // ============================================================================
  // TEMPERATURE MONITOR INTEGRATION
  // ============================================================================

  /**
   * Set the temperature monitoring service to listen to
   */
  public setTemperatureMonitor(monitor: TemperatureMonitoringService): void {
    // Remove listeners from old monitor
    if (this.temperatureMonitor) {
      this.removeTemperatureMonitorListeners();
    }

    this.temperatureMonitor = monitor;
    this.setupTemperatureMonitorListeners();

    console.log(`[SpoolmanUsageTracker] Temperature monitor connected for context ${this.contextId}`);
  }

  /**
   * Setup temperature monitor event listeners
   */
  private setupTemperatureMonitorListeners(): void {
    if (!this.temperatureMonitor) return;

    // Listen for printer-cooled events
    this.temperatureMonitor.on('printer-cooled', (event: PrinterCooledEvent) => {
      void this.handlePrinterCooled(event);
    });
  }

  /**
   * Remove temperature monitor event listeners
   */
  private removeTemperatureMonitorListeners(): void {
    if (!this.temperatureMonitor) return;

    this.temperatureMonitor.removeAllListeners('printer-cooled');
  }

  // ============================================================================
  // PRINTER COOLED HANDLING
  // ============================================================================

  /**
   * Handle printer cooled event
   */
  private async handlePrinterCooled(event: PrinterCooledEvent): Promise<void> {
    // Only handle events for our context
    if (event.contextId !== this.contextId) {
      return;
    }

    console.log(`[SpoolmanUsageTracker] Printer cooled for context ${this.contextId}, checking for Spoolman update`);

    // Check if usage already recorded for this print
    const currentJob = event.status.currentJob?.fileName;
    if (this.state.usageRecorded && this.state.lastRecordedJob === currentJob) {
      console.log(`[SpoolmanUsageTracker] Usage already recorded for job: ${currentJob}`);
      return;
    }

    // Update Spoolman usage
    await this.updateSpoolmanUsage(event.status);

    // Mark as recorded
    this.state.usageRecorded = true;
    this.state.lastRecordedJob = currentJob ?? null;
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
   * Reset tracking state
   * Called when new print starts
   */
  public resetState(): void {
    this.state = {
      printCompleted: false,
      usageRecorded: false,
      lastRecordedJob: null
    };

    console.log(`[SpoolmanUsageTracker] State reset for context ${this.contextId}`);
  }

  /**
   * Get current tracking state
   */
  public getState(): Readonly<UsageTrackingState> {
    return { ...this.state };
  }

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

    this.removeTemperatureMonitorListeners();
    this.removeAllListeners();

    this.temperatureMonitor = null;
  }
}
