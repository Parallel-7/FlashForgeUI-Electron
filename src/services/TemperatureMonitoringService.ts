/**
 * @fileoverview Temperature monitoring service for tracking printer bed cooling after print completion.
 *
 * This service provides shared temperature monitoring functionality that can be used by multiple
 * systems (notifications, Spoolman tracking, etc.) without coupling them to each other.
 *
 * Key Features:
 * - Per-context temperature monitoring with configurable intervals
 * - State tracking for print completion and cooling status
 * - Event emissions when printer bed reaches cooling threshold
 * - Integration with PrinterPollingService for real-time temperature data
 * - Integration with PrintStateMonitor for state transition detection
 * - Automatic state reset on new print start
 *
 * Core Responsibilities:
 * - Listen to PrintStateMonitor for print lifecycle events
 * - Start temperature monitoring when print completes
 * - Check bed temperature at regular intervals (default: 10 seconds)
 * - Emit events when bed temperature falls below threshold (default: 35°C)
 * - Stop monitoring after cooling threshold is met
 * - Reset state when new print starts
 *
 * @exports TemperatureMonitoringService - Main temperature monitoring class
 */

import { EventEmitter } from '../utils/EventEmitter';
import type { PrinterPollingService } from './PrinterPollingService';
import type { PrintStateMonitor } from './PrintStateMonitor';
import type { PrinterStatus } from '../types/polling';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Temperature threshold for "cooled" detection (in Celsius)
 */
const COOLED_TEMPERATURE_THRESHOLD = 35;

/**
 * Default temperature monitoring configuration
 */
const DEFAULT_TEMP_MONITOR_CONFIG = {
  checkIntervalMs: 10 * 1000, // Check every 10 seconds
  temperatureThreshold: COOLED_TEMPERATURE_THRESHOLD
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Temperature monitoring configuration
 */
export interface TemperatureMonitorConfig {
  readonly checkIntervalMs: number;
  readonly temperatureThreshold: number;
}

/**
 * Temperature monitoring state for a context
 */
interface TemperatureMonitorState {
  printCompleteTime: Date | null;
  hasCooled: boolean;
  lastCheckedTemp: number | null;
  monitoringActive: boolean;
}

/**
 * Event map for TemperatureMonitoringService
 */
interface TempMonitorEventMap extends Record<string, unknown[]> {
  'temperature-checked': [{
    contextId: string;
    temperature: number;
    coolingThreshold: number;
    hasCooled: boolean;
  }];
  'printer-cooled': [{
    contextId: string;
    temperature: number;
    bedCooledAt: Date;
    status: PrinterStatus;
  }];
  'monitoring-started': [{ contextId: string }];
  'monitoring-stopped': [{ contextId: string }];
}

// ============================================================================
// TEMPERATURE MONITORING SERVICE
// ============================================================================

/**
 * Service for monitoring printer bed temperature and detecting cooling
 */
export class TemperatureMonitoringService extends EventEmitter<TempMonitorEventMap> {
  private readonly contextId: string;
  private readonly config: TemperatureMonitorConfig;
  private pollingService: PrinterPollingService | null = null;
  private printStateMonitor: PrintStateMonitor | null = null;

  private state: TemperatureMonitorState = {
    printCompleteTime: null,
    hasCooled: false,
    lastCheckedTemp: null,
    monitoringActive: false
  };

  private temperatureCheckTimer: NodeJS.Timeout | null = null;
  private lastPrinterStatus: PrinterStatus | null = null;

  constructor(contextId: string, config?: Partial<TemperatureMonitorConfig>) {
    super();
    this.contextId = contextId;
    this.config = { ...DEFAULT_TEMP_MONITOR_CONFIG, ...config };

    console.log(`[TemperatureMonitor] Created for context ${contextId}`);
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

    console.log(`[TemperatureMonitor] Polling service connected for context ${this.contextId}`);
  }

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

    console.log(`[TemperatureMonitor] Print state monitor connected for context ${this.contextId}`);
  }

  /**
   * Setup polling service event listeners
   */
  private setupPollingServiceListeners(): void {
    if (!this.pollingService) return;

    // Listen for status updates to track current temperature
    this.pollingService.on('status-updated', (status: PrinterStatus) => {
      this.lastPrinterStatus = status;

      // Update temperature monitoring if active
      if (this.state.monitoringActive) {
        void this.checkTemperature(status);
      }
    });
  }

  /**
   * Remove polling service event listeners
   */
  private removePollingServiceListeners(): void {
    if (!this.pollingService) return;

    this.pollingService.removeAllListeners('status-updated');
  }

  /**
   * Setup print state monitor event listeners
   */
  private setupPrintStateMonitorListeners(): void {
    if (!this.printStateMonitor) return;

    // Start monitoring when print completes
    this.printStateMonitor.on('print-completed', (event) => {
      if (event.contextId === this.contextId) {
        console.log('[TemperatureMonitor] Print completed, starting temperature monitoring');
        this.startMonitoring();
      }
    });

    // Reset state when print starts
    this.printStateMonitor.on('print-started', (event) => {
      if (event.contextId === this.contextId) {
        console.log('[TemperatureMonitor] Print started, resetting state');
        this.resetState();
      }
    });

    // Reset state when print cancelled
    this.printStateMonitor.on('print-cancelled', (event) => {
      if (event.contextId === this.contextId) {
        console.log('[TemperatureMonitor] Print cancelled, resetting state');
        this.resetState();
      }
    });

    // Reset state when print error
    this.printStateMonitor.on('print-error', (event) => {
      if (event.contextId === this.contextId) {
        console.log('[TemperatureMonitor] Print error, resetting state');
        this.resetState();
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
    this.printStateMonitor.removeAllListeners('print-cancelled');
    this.printStateMonitor.removeAllListeners('print-error');
  }


  // ============================================================================
  // TEMPERATURE MONITORING
  // ============================================================================

  /**
   * Start temperature monitoring
   */
  private startMonitoring(): void {
    // Stop any existing timer
    this.stopMonitoring();

    // Update state
    this.state.printCompleteTime = new Date();
    this.state.monitoringActive = true;
    this.state.hasCooled = false;

    // Emit event
    this.emit('monitoring-started', { contextId: this.contextId });
    console.log(`[TemperatureMonitor] Started monitoring for context ${this.contextId}`);

    // Start timer
    this.temperatureCheckTimer = setInterval(() => {
      if (this.lastPrinterStatus) {
        void this.checkTemperature(this.lastPrinterStatus);
      }
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop temperature monitoring
   */
  private stopMonitoring(): void {
    if (this.temperatureCheckTimer) {
      clearInterval(this.temperatureCheckTimer);
      this.temperatureCheckTimer = null;
    }

    if (this.state.monitoringActive) {
      this.state.monitoringActive = false;
      this.emit('monitoring-stopped', { contextId: this.contextId });
      console.log(`[TemperatureMonitor] Stopped monitoring for context ${this.contextId}`);
    }
  }

  /**
   * Check current temperature against cooling threshold
   */
  private async checkTemperature(status: PrinterStatus): Promise<void> {
    // Skip if already cooled
    if (this.state.hasCooled) {
      return;
    }

    // Skip if print complete time not set
    if (!this.state.printCompleteTime) {
      return;
    }

    const bedTemp = status.temperatures.bed.current;
    this.state.lastCheckedTemp = bedTemp;
    const hasCooled = bedTemp < this.config.temperatureThreshold;

    // Emit temperature check event
    this.emit('temperature-checked', {
      contextId: this.contextId,
      temperature: bedTemp,
      coolingThreshold: this.config.temperatureThreshold,
      hasCooled
    });

    // If cooled, emit cooled event and stop monitoring
    if (hasCooled) {
      this.state.hasCooled = true;

      this.emit('printer-cooled', {
        contextId: this.contextId,
        temperature: bedTemp,
        bedCooledAt: new Date(),
        status
      });

      console.log(`[TemperatureMonitor] Printer cooled for context ${this.contextId}: ${bedTemp}°C`);

      this.stopMonitoring();
    }
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  /**
   * Reset monitoring state
   */
  private resetState(): void {
    this.stopMonitoring();

    this.state = {
      printCompleteTime: null,
      hasCooled: false,
      lastCheckedTemp: null,
      monitoringActive: false
    };

    console.log(`[TemperatureMonitor] State reset for context ${this.contextId}`);
  }

  /**
   * Get current monitoring state
   */
  public getState(): Readonly<TemperatureMonitorState> {
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
   * Dispose of the service and clean up resources
   */
  public dispose(): void {
    console.log(`[TemperatureMonitor] Disposing for context ${this.contextId}`);

    this.stopMonitoring();
    this.removePollingServiceListeners();
    this.removePrintStateMonitorListeners();
    this.removeAllListeners();

    this.pollingService = null;
    this.printStateMonitor = null;
    this.lastPrinterStatus = null;
  }
}
