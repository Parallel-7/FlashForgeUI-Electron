/**
 * @fileoverview Printer notification coordinator that manages notification business logic,
 * state tracking, and integration with printer polling and configuration systems.
 *
 * This coordinator acts as the bridge between printer state monitoring (PrinterPollingService),
 * user notification preferences (ConfigManager), and notification delivery (NotificationService).
 * It implements intelligent notification logic including duplicate prevention and state-based
 * notification triggers tied to the printer's operational lifecycle.
 *
 * Key Features:
 * - Integration with PrinterPollingService for real-time printer state monitoring
 * - Configuration-driven notification behavior based on user preferences from ConfigManager
 * - Stateful notification tracking to prevent duplicate notifications during a print job
 * - Temperature monitoring coordination via TemperatureMonitoringService for cooled notifications
 * - Automatic state reset on print start/cancel/error to ensure clean notification cycles
 * - Support for multiple notification types: print complete, printer cooled, upload complete/failed, connection events
 * - Event emitter pattern for notification triggers and state changes
 * - Singleton pattern with global instance management and test-friendly dependency injection
 *
 * Core Responsibilities:
 * - Monitor printer state changes from PrinterPollingService and handle state transitions
 * - Check notification settings from ConfigManager to respect user preferences
 * - Manage notification state to prevent duplicate notifications within a print cycle
 * - Coordinate notification sending through NotificationService based on state and settings
 * - Delegate temperature monitoring to TemperatureMonitoringService for cooled notifications
 * - Reset state appropriately during print cycles (start, complete, cancel, error transitions)
 * - Handle connection changes and cleanup resources on disconnect
 *
 * Temperature Monitoring Coordination:
 * - Delegates to TemperatureMonitoringService for bed cooling detection
 * - Listens for 'printer-cooled' events from temperature monitor
 * - Sends cooled notifications when temperature threshold is met
 * - Respects notification settings for cooled notifications
 *
 * @exports PrinterNotificationCoordinator - Main coordinator class for printer notifications
 * @exports getPrinterNotificationCoordinator - Singleton instance accessor
 * @exports resetPrinterNotificationCoordinator - Test helper for instance reset
 * @exports CoordinatorEventMap - Type for coordinator event emissions
 */

import { EventEmitter } from '../../utils/EventEmitter';
import { getNotificationService, NotificationService } from './NotificationService';
import { getConfigManager, ConfigManager } from '../../managers/ConfigManager';
import type { TemperatureMonitoringService } from '../TemperatureMonitoringService';
import type { PrinterCooledEvent } from '../MultiContextTemperatureMonitor';
import type { PrintStateMonitor } from '../PrintStateMonitor';
import type { PrinterPollingService } from '../PrinterPollingService';
import type {
  PollingData,
  PrinterStatus,
  PrinterState
} from '../../types/polling';
import {
  NotificationState,
  NotificationSettings,
  NotificationStateTransition,
  NotificationEventPayloads,
  createInitialNotificationState,
  extractNotificationSettings,
  shouldSendNotification,
  shouldCheckForNotifications,
  shouldResetNotificationFlags,
  createPrintCompleteNotification,
  createPrinterCooledNotification,
  createUploadCompleteNotification,
  createUploadFailedNotification,
  createConnectionLostNotification,
  createConnectionErrorNotification,
  createNotificationTemperature,
  NotificationType,
  COOLED_TEMPERATURE_THRESHOLD
} from '../../types/notification';

// ============================================================================
// COORDINATOR EVENTS
// ============================================================================

/**
 * Event map for PrinterNotificationCoordinator
 */
interface CoordinatorEventMap extends Record<string, unknown[]> {
  'notification-triggered': [NotificationEventPayloads['notification-sent']];
  'state-changed': [NotificationEventPayloads['state-updated']];
  'settings-updated': [NotificationEventPayloads['settings-changed']];
}

// ============================================================================
// PRINTER NOTIFICATION COORDINATOR
// ============================================================================

/**
 * Manages printer notification business logic and coordination
 */
export class PrinterNotificationCoordinator extends EventEmitter<CoordinatorEventMap> {
  private readonly notificationService: NotificationService;
  private readonly configManager: ConfigManager;
  private pollingService: PrinterPollingService | null = null;
  private printStateMonitor: PrintStateMonitor | null = null;
  private temperatureMonitor: TemperatureMonitoringService | null = null;

  // State management
  private notificationState: NotificationState;
  private currentSettings: NotificationSettings;
  private lastPrinterStatus: PrinterStatus | null = null;
  private contextId: string | null = null;

  constructor(
    notificationService?: NotificationService,
    configManager?: ConfigManager
  ) {
    super();

    // Use provided services or get global instances
    this.notificationService = notificationService ?? getNotificationService();
    this.configManager = configManager ?? getConfigManager();

    // Initialize state
    this.notificationState = createInitialNotificationState();
    this.currentSettings = extractNotificationSettings(this.configManager.getConfig());

    // Setup event handlers
    this.setupConfigurationListener();
    this.setupNotificationServiceListener();

    console.log('PrinterNotificationCoordinator initialized');
  }

  // ============================================================================
  // SERVICE INTEGRATION
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

    console.log('PrinterNotificationCoordinator: Polling service connected');
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
    this.contextId = monitor.getContextId();
    this.setupPrintStateMonitorListeners();

    console.log(`[NotificationCoordinator] Print state monitor connected for context ${this.contextId}`);
  }

  /**
   * Set the temperature monitoring service
   */
  public setTemperatureMonitor(monitor: TemperatureMonitoringService): void {
    // Remove listeners from old monitor
    if (this.temperatureMonitor) {
      this.removeTemperatureMonitorListeners();
    }

    this.temperatureMonitor = monitor;
    this.setupTemperatureMonitorListeners();

    console.log('PrinterNotificationCoordinator: Temperature monitor connected');
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

    // Listen for connection changes
    this.pollingService.on('connection-changed', (event: { connected: boolean }) => {
      this.handleConnectionChange(event.connected);
    });
  }

  /**
   * Remove polling service event listeners
   */
  private removePollingServiceListeners(): void {
    if (!this.pollingService) return;

    this.pollingService.removeAllListeners('data-updated');
    this.pollingService.removeAllListeners('status-updated');
    this.pollingService.removeAllListeners('connection-changed');
  }

  /**
   * Setup print state monitor event listeners
   */
  private setupPrintStateMonitorListeners(): void {
    if (!this.printStateMonitor) return;

    // Listen for print started to reset notification flags
    this.printStateMonitor.on('print-started', (event) => {
      if (event.contextId === this.contextId) {
        void this.handlePrintStarted(event);
      }
    });

    // Listen for print completed to send notification
    this.printStateMonitor.on('print-completed', (event) => {
      if (event.contextId === this.contextId) {
        void this.handlePrintCompletedEvent(event);
      }
    });

    // Listen for print cancelled to reset state
    this.printStateMonitor.on('print-cancelled', (event) => {
      if (event.contextId === this.contextId) {
        void this.handlePrintCancelled(event);
      }
    });

    // Listen for print error to reset state
    this.printStateMonitor.on('print-error', (event) => {
      if (event.contextId === this.contextId) {
        void this.handlePrintError(event);
      }
    });
  }

  /**
   * Remove print state monitor event listeners
   */
  private removePrintStateMonitorListeners(): void {
    if (!this.printStateMonitor) return;

    this.printStateMonitor.removeAllListeners('print-started');
    this.printStateMonitor.removeAllListeners('print-completed');
    this.printStateMonitor.removeAllListeners('print-cancelled');
    this.printStateMonitor.removeAllListeners('print-error');
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

  /**
   * Setup configuration change listener
   */
  private setupConfigurationListener(): void {
    this.configManager.on('configUpdated', (_event) => {
      const newConfig = this.configManager.getConfig();
      const newSettings = extractNotificationSettings(newConfig);

      if (this.hasSettingsChanged(newSettings)) {
        const previousSettings = this.currentSettings;
        this.currentSettings = newSettings;

        this.emit('settings-updated', {
          previousSettings,
          currentSettings: newSettings
        });

        console.log('Notification settings updated:', newSettings);
      }
    });
  }

  /**
   * Setup notification service event listener
   */
  private setupNotificationServiceListener(): void {
    this.notificationService.on('notification-sent', (event) => {
      this.emit('notification-triggered', event);
    });
  }

  /**
   * Check if notification settings have changed
   */
  private hasSettingsChanged(newSettings: NotificationSettings): boolean {
    return (
      newSettings.AlertWhenComplete !== this.currentSettings.AlertWhenComplete ||
      newSettings.AlertWhenCooled !== this.currentSettings.AlertWhenCooled ||
      newSettings.AudioAlerts !== this.currentSettings.AudioAlerts ||
      newSettings.VisualAlerts !== this.currentSettings.VisualAlerts
    );
  }

  // ============================================================================
  // PRINTER STATUS HANDLING
  // ============================================================================

  /**
   * Handle polling data update
   * Made public to allow direct integration with MainProcessPollingCoordinator
   */
  public async handlePollingDataUpdate(data: PollingData): Promise<void> {
    if (data.printerStatus) {
      await this.handlePrinterStatusUpdate(data.printerStatus);
    }
  }

  /**
   * Handle printer status update
   *
   * Note: This method only tracks the current status for reference.
   * State change detection and notification logic is now handled by PrintStateMonitor.
   */
  private async handlePrinterStatusUpdate(status: PrinterStatus): Promise<void> {
    // Only track status reference - used by notification templates and other consumers
    this.lastPrinterStatus = status;

    // PrintStateMonitor now handles all state transition detection and notification triggering
    // This eliminates duplicate state detection logic and race conditions
  }

  /**
   * Handle print started event from PrintStateMonitor
   */
  private async handlePrintStarted(event: { contextId: string; jobName: string; status: PrinterStatus; timestamp: Date }): Promise<void> {
    console.log(`[NotificationCoordinator] Print started: ${event.jobName}`);

    // Reset notification sent flags for active printing states
    this.resetNotificationState(NotificationStateTransition.PrintStarted);
  }

  /**
   * Handle print completed event from PrintStateMonitor
   */
  private async handlePrintCompletedEvent(event: { contextId: string; jobName: string; status: PrinterStatus; completedAt: Date }): Promise<void> {
    console.log(`[NotificationCoordinator] Print completed: ${event.jobName}`);

    // Check if notification should be sent
    if (!this.notificationState.hasSentPrintCompleteNotification &&
        shouldSendNotification(NotificationType.PrintComplete, this.currentSettings)) {
      await this.sendPrintCompleteNotification(event.status);
      this.updateNotificationState({
        hasSentPrintCompleteNotification: true,
        lastPrintCompleteTime: new Date()
      }, NotificationStateTransition.PrintCompleted);
    }
  }

  /**
   * Handle print cancelled event from PrintStateMonitor
   */
  private async handlePrintCancelled(event: { contextId: string; jobName: string | null; status: PrinterStatus; timestamp: Date }): Promise<void> {
    console.log(`[NotificationCoordinator] Print cancelled`);
    this.resetNotificationState(NotificationStateTransition.PrintCancelled);
  }

  /**
   * Handle print error event from PrintStateMonitor
   */
  private async handlePrintError(event: { contextId: string; jobName: string | null; status: PrinterStatus; timestamp: Date }): Promise<void> {
    console.log(`[NotificationCoordinator] Print error`);
    this.resetNotificationState(NotificationStateTransition.PrintCancelled);
  }

  /**
   * Handle printer cooled event from temperature monitor
   */
  private async handlePrinterCooled(event: PrinterCooledEvent): Promise<void> {
    // Skip if already sent cooled notification
    if (this.notificationState.hasSentPrinterCooledNotification) {
      return;
    }

    // Verify notification should be sent
    if (!shouldSendNotification(NotificationType.PrinterCooled, this.currentSettings)) {
      return;
    }

    // Update state BEFORE sending to prevent race condition
    this.updateNotificationState({
      hasSentPrinterCooledNotification: true
    }, NotificationStateTransition.PrinterCooled);

    // Send notification
    await this.sendPrinterCooledNotification(event.status);
  }

  // ============================================================================
  // NOTIFICATION SENDING
  // ============================================================================

  /**
   * Send print complete notification
   */
  private async sendPrintCompleteNotification(status: PrinterStatus): Promise<void> {
    // Use current job name directly, fallback to 'Unknown Job'
    const jobName = status.currentJob?.fileName ?? 'Unknown Job';

    const printInfo = {
      fileName: jobName,
      duration: status.currentJob?.progress.elapsedTime,
      layerCount: status.currentJob?.progress.totalLayers ?? undefined
    };

    const notification = createPrintCompleteNotification(printInfo);

    try {
      await this.notificationService.sendNotification(notification);
      console.log(`Print complete notification sent for job: ${jobName}`);
    } catch (error) {
      console.error('Failed to send print complete notification:', error);
    }
  }

  /**
   * Send printer cooled notification
   */
  private async sendPrinterCooledNotification(status: PrinterStatus): Promise<void> {
    // Use current job name directly, fallback to 'Unknown Job'
    const jobName = status.currentJob?.fileName ?? 'Unknown Job';

    const printInfo = {
      fileName: jobName,
      currentTemp: createNotificationTemperature(status.temperatures.bed.current),
      threshold: createNotificationTemperature(COOLED_TEMPERATURE_THRESHOLD),
      timeSincePrintComplete: this.notificationState.lastPrintCompleteTime
        ? Date.now() - this.notificationState.lastPrintCompleteTime.getTime()
        : undefined
    };

    const notification = createPrinterCooledNotification(printInfo);

    try {
      await this.notificationService.sendNotification(notification);
      console.log(`Printer cooled notification sent for job: ${jobName}`);
    } catch (error) {
      console.error('Failed to send printer cooled notification:', error);
    }
  }

  // ============================================================================
  // UPLOAD NOTIFICATIONS
  // ============================================================================

  /**
   * Send upload complete notification
   */
  public async sendUploadCompleteNotification(fileName: string, fileSize?: number, uploadDuration?: number): Promise<void> {
    const uploadInfo = { fileName, fileSize, uploadDuration };
    const notification = createUploadCompleteNotification(uploadInfo);

    try {
      await this.notificationService.sendNotification(notification);
      console.log('Upload complete notification sent');
    } catch (error) {
      console.error('Failed to send upload complete notification:', error);
    }
  }

  /**
   * Send upload failed notification
   */
  public async sendUploadFailedNotification(fileName: string, errorMessage: string, errorCode?: string): Promise<void> {
    const errorInfo = { fileName, errorMessage, errorCode };
    const notification = createUploadFailedNotification(errorInfo);

    try {
      await this.notificationService.sendNotification(notification);
      console.log('Upload failed notification sent');
    } catch (error) {
      console.error('Failed to send upload failed notification:', error);
    }
  }

  // ============================================================================
  // CONNECTION NOTIFICATIONS
  // ============================================================================

  /**
   * Handle connection change events
   */
  private handleConnectionChange(connected: boolean): void {
    if (!connected) {
      // Reset all notification state when connection is lost
      this.resetNotificationState(NotificationStateTransition.ConnectionReset);
    }
  }

  /**
   * Send connection lost notification
   */
  public async sendConnectionLostNotification(printerName: string, ipAddress?: string): Promise<void> {
    const connectionInfo = { printerName, ipAddress, lastSeen: new Date() };
    const notification = createConnectionLostNotification(connectionInfo);

    try {
      await this.notificationService.sendNotification(notification);
      console.log('Connection lost notification sent');
    } catch (error) {
      console.error('Failed to send connection lost notification:', error);
    }
  }

  /**
   * Send connection error notification
   */
  public async sendConnectionErrorNotification(errorMessage: string, errorCode?: string, printerName?: string): Promise<void> {
    const errorInfo = { errorMessage, errorCode, printerName };
    const notification = createConnectionErrorNotification(errorInfo);

    try {
      await this.notificationService.sendNotification(notification);
      console.log('Connection error notification sent');
    } catch (error) {
      console.error('Failed to send connection error notification:', error);
    }
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  /**
   * Reset notification state
   */
  private resetNotificationState(transition: NotificationStateTransition): void {
    const previousState = { ...this.notificationState };

    this.notificationState = createInitialNotificationState();

    this.emit('state-changed', {
      previousState,
      currentState: this.notificationState,
      transition
    });

    console.log(`Notification state reset: ${transition}`);
  }

  /**
   * Update notification state partially
   */
  private updateNotificationState(
    updates: Partial<NotificationState>,
    transition: NotificationStateTransition
  ): void {
    const previousState = { ...this.notificationState };

    this.notificationState = {
      ...this.notificationState,
      ...updates
    };

    this.emit('state-changed', {
      previousState,
      currentState: this.notificationState,
      transition
    });
  }

  /**
   * Get current notification state
   */
  public getNotificationState(): Readonly<NotificationState> {
    return { ...this.notificationState };
  }

  /**
   * Get current notification settings
   */
  public getNotificationSettings(): Readonly<NotificationSettings> {
    return { ...this.currentSettings };
  }

  // ============================================================================
  // LIFECYCLE MANAGEMENT
  // ============================================================================

  /**
   * Dispose of the coordinator and clean up resources
   */
  public dispose(): void {
    console.log('PrinterNotificationCoordinator: Disposing...');

    // Remove print state monitor listeners
    this.removePrintStateMonitorListeners();
    this.printStateMonitor = null;

    // Remove temperature monitor listeners
    this.removeTemperatureMonitorListeners();
    this.temperatureMonitor = null;

    // Remove polling service listeners
    this.removePollingServiceListeners();

    // Remove all event listeners
    this.removeAllListeners();

    // Clear references
    this.pollingService = null;
    this.lastPrinterStatus = null;
    this.contextId = null;

    console.log('PrinterNotificationCoordinator disposed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global printer notification coordinator instance
 */
let globalPrinterNotificationCoordinator: PrinterNotificationCoordinator | null = null;

/**
 * Get global printer notification coordinator instance
 */
export function getPrinterNotificationCoordinator(): PrinterNotificationCoordinator {
  if (!globalPrinterNotificationCoordinator) {
    globalPrinterNotificationCoordinator = new PrinterNotificationCoordinator();
  }
  return globalPrinterNotificationCoordinator;
}

/**
 * Reset global printer notification coordinator (for testing)
 */
export function resetPrinterNotificationCoordinator(): void {
  if (globalPrinterNotificationCoordinator) {
    globalPrinterNotificationCoordinator.dispose();
    globalPrinterNotificationCoordinator = null;
  }
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { CoordinatorEventMap };
