/**
 * @fileoverview Print state monitoring service for tracking printer state transitions.
 *
 * This service provides centralized state change detection that can be used by multiple
 * systems (notifications, Spoolman tracking, temperature monitoring, etc.) without
 * coupling them to the polling service or duplicating state-tracking logic.
 *
 * Key Features:
 * - Per-context state monitoring with centralized detection
 * - State transition tracking (previousState → currentState)
 * - Event emissions for all state changes
 * - Specialized events for print lifecycle (started, completed, cancelled, error)
 * - Integration with PrinterPollingService for real-time status data
 * - Multi-context safe (per-instance tracking)
 *
 * Core Responsibilities:
 * - Monitor printer status updates from polling service
 * - Detect state transitions and emit generic 'state-changed' events
 * - Detect print lifecycle events and emit specialized events
 * - Track current job name for print lifecycle detection
 * - Provide current state access for consumers
 *
 * @exports PrintStateMonitor - Main state monitoring class
 */

import { EventEmitter } from '../utils/EventEmitter';
import type { PrinterPollingService } from './PrinterPollingService';
import type { PrinterStatus, PollingData } from '../types/polling';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Event map for PrintStateMonitor
 */
interface PrintStateEventMap extends Record<string, unknown[]> {
  /**
   * Emitted on any state change
   */
  'state-changed': [{
    contextId: string;
    previousState: string;
    currentState: string;
    status: PrinterStatus;
    timestamp: Date;
  }];

  /**
   * Emitted when a print job starts (transition TO Busy/Printing/Heating)
   */
  'print-started': [{
    contextId: string;
    jobName: string;
    status: PrinterStatus;
    timestamp: Date;
  }];

  /**
   * Emitted when a print job completes successfully
   */
  'print-completed': [{
    contextId: string;
    jobName: string;
    status: PrinterStatus;
    completedAt: Date;
  }];

  /**
   * Emitted when a print job is cancelled
   */
  'print-cancelled': [{
    contextId: string;
    jobName: string | null;
    status: PrinterStatus;
    timestamp: Date;
  }];

  /**
   * Emitted when a print job encounters an error
   */
  'print-error': [{
    contextId: string;
    jobName: string | null;
    status: PrinterStatus;
    timestamp: Date;
  }];
}

/**
 * Print state monitoring state for a context
 */
interface PrintStateMonitorState {
  currentState: string | null;
  previousState: string | null;
  currentJobName: string | null;
  lastStateChangeTime: Date | null;
}

// ============================================================================
// PRINT STATE MONITOR SERVICE
// ============================================================================

/**
 * Service for monitoring printer state transitions and emitting domain events
 */
export class PrintStateMonitor extends EventEmitter<PrintStateEventMap> {
  private readonly contextId: string;
  private pollingService: PrinterPollingService | null = null;

  private state: PrintStateMonitorState = {
    currentState: null,
    previousState: null,
    currentJobName: null,
    lastStateChangeTime: null
  };

  constructor(contextId: string) {
    super();
    this.contextId = contextId;
    console.log(`[PrintStateMonitor] Created for context ${contextId}`);
  }

  // ============================================================================
  // POLLING SERVICE INTEGRATION
  // ============================================================================

  /**
   * Set the printer polling service to monitor
   */
  public setPollingService(pollingService: PrinterPollingService): void {
    // Remove listeners from old service
    if (this.pollingService) {
      this.removePollingServiceListeners();
    }

    this.pollingService = pollingService;
    this.setupPollingServiceListeners();

    console.log(`[PrintStateMonitor] Polling service connected for context ${this.contextId}`);
  }

  /**
   * Setup polling service event listeners
   */
  private setupPollingServiceListeners(): void {
    if (!this.pollingService) return;

    // Listen for data updates
    this.pollingService.on('data-updated', (data: PollingData) => {
      void this.handlePollingDataUpdate(data);
    });

    // Listen for status updates
    this.pollingService.on('status-updated', (status: PrinterStatus) => {
      void this.handlePrinterStatusUpdate(status);
    });
  }

  /**
   * Remove polling service event listeners
   */
  private removePollingServiceListeners(): void {
    if (!this.pollingService) return;

    this.pollingService.removeAllListeners('data-updated');
    this.pollingService.removeAllListeners('status-updated');
  }

  // ============================================================================
  // STATUS HANDLING
  // ============================================================================

  /**
   * Handle polling data update
   */
  private async handlePollingDataUpdate(data: PollingData): Promise<void> {
    if (data.printerStatus) {
      await this.handlePrinterStatusUpdate(data.printerStatus);
    }
  }

  /**
   * Handle printer status update
   */
  private async handlePrinterStatusUpdate(status: PrinterStatus): Promise<void> {
    const previousState = this.state.currentState;
    const currentState = status.state;

    // Update current state
    this.state.currentState = currentState;

    // Update job name tracking
    const currentJobName = status.currentJob?.fileName || null;
    this.state.currentJobName = currentJobName;

    // Check for state transitions
    if (previousState !== currentState && previousState !== null) {
      await this.handleStateTransition(previousState, currentState, status);
    }

    // Update previous state for next iteration
    this.state.previousState = currentState;
  }

  /**
   * Handle state transition
   */
  private async handleStateTransition(
    previousState: string,
    currentState: string,
    status: PrinterStatus
  ): Promise<void> {
    const timestamp = new Date();
    this.state.lastStateChangeTime = timestamp;

    console.log(`[PrintStateMonitor] State change for ${this.contextId}: ${previousState} → ${currentState}`);

    // Emit generic state-changed event
    this.emit('state-changed', {
      contextId: this.contextId,
      previousState,
      currentState,
      status,
      timestamp
    });

    // Emit specialized lifecycle events
    await this.detectPrintLifecycleEvents(previousState, currentState, status, timestamp);
  }

  /**
   * Detect and emit print lifecycle events
   */
  private async detectPrintLifecycleEvents(
    previousState: string,
    currentState: string,
    status: PrinterStatus,
    timestamp: Date
  ): Promise<void> {
    // Print started: Transition TO an active printing state
    if (this.isActivePrintingState(currentState) && !this.isActivePrintingState(previousState)) {
      if (this.state.currentJobName) {
        this.emit('print-started', {
          contextId: this.contextId,
          jobName: this.state.currentJobName,
          status,
          timestamp
        });
        console.log(`[PrintStateMonitor] Print started: ${this.state.currentJobName}`);
      }
    }

    // Print completed: Transition TO "Completed" state
    if (currentState === 'Completed' && previousState !== 'Completed') {
      const jobName = this.state.currentJobName || 'Unknown';
      this.emit('print-completed', {
        contextId: this.contextId,
        jobName,
        status,
        completedAt: timestamp
      });
      console.log(`[PrintStateMonitor] Print completed: ${jobName}`);
    }

    // Print cancelled: Transition TO "Cancelled" state
    if (currentState === 'Cancelled' && previousState !== 'Cancelled') {
      this.emit('print-cancelled', {
        contextId: this.contextId,
        jobName: this.state.currentJobName,
        status,
        timestamp
      });
      console.log(`[PrintStateMonitor] Print cancelled: ${this.state.currentJobName || 'Unknown'}`);
    }

    // Print error: Transition TO "Error" state
    if (currentState === 'Error' && previousState !== 'Error') {
      this.emit('print-error', {
        contextId: this.contextId,
        jobName: this.state.currentJobName,
        status,
        timestamp
      });
      console.log(`[PrintStateMonitor] Print error: ${this.state.currentJobName || 'Unknown'}`);
    }
  }

  /**
   * Check if state represents active printing
   */
  private isActivePrintingState(state: string): boolean {
    return state === 'Busy' ||
           state === 'Printing' ||
           state === 'Heating' ||
           state === 'Calibrating' ||
           state === 'Paused' ||
           state === 'Pausing';
  }

  // ============================================================================
  // STATE ACCESS
  // ============================================================================

  /**
   * Get current state
   */
  public getCurrentState(): string | null {
    return this.state.currentState;
  }

  /**
   * Get current job name
   */
  public getCurrentJobName(): string | null {
    return this.state.currentJobName;
  }

  /**
   * Get context ID
   */
  public getContextId(): string {
    return this.contextId;
  }

  /**
   * Get full state snapshot
   */
  public getState(): Readonly<PrintStateMonitorState> {
    return { ...this.state };
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Dispose of the service and clean up resources
   */
  public dispose(): void {
    console.log(`[PrintStateMonitor] Disposing for context ${this.contextId}`);

    this.removePollingServiceListeners();
    this.removeAllListeners();

    this.pollingService = null;
    this.state = {
      currentState: null,
      previousState: null,
      currentJobName: null,
      lastStateChangeTime: null
    };
  }
}
