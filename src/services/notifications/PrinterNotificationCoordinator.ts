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
  private temperatureMonitor: TemperatureMonitoringService | null = null;

  // State management
  private notificationState: NotificationState;
  private currentSettings: NotificationSettings;
  private lastPrinterStatus: PrinterStatus | null = null;

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
   */
  private async handlePrinterStatusUpdate(status: PrinterStatus): Promise<void> {
    const previousStatus = this.lastPrinterStatus;
    this.lastPrinterStatus = status;

    // Check for state transitions that require notification handling
    if (previousStatus?.state !== status.state) {
      await this.handlePrinterStateChange(previousStatus?.state ?? 'Busy', status.state, status);
    }
  }

  /**
   * Handle printer state changes
   */
  private async handlePrinterStateChange(
    previousState: string,
    currentState: string,
    status: PrinterStatus
  ): Promise<void> {
    console.log(`Printer state changed: ${previousState} → ${currentState}`);

    // Reset notification flags for active states
    if (shouldResetNotificationFlags(currentState as PrinterState)) {
      this.resetNotificationState(NotificationStateTransition.PrintStarted);
      return;
    }

    // Check for notification triggers
    if (shouldCheckForNotifications(currentState as PrinterState)) {
      await this.checkNotificationTriggers(currentState, status);
    }
  }

  /**
   * Check for notification triggers based on state
   */
  private async checkNotificationTriggers(
    state: string,
    status: PrinterStatus
  ): Promise<void> {
    switch (state) {
      case 'Completed':
        await this.handlePrintCompleted(status);
        break;
      case 'Cancelled':
        this.resetNotificationState(NotificationStateTransition.PrintCancelled);
        break;
      case 'Error':
        // Reset flags but don't send notifications for error states
        this.resetNotificationState(NotificationStateTransition.PrintCancelled);
        break;
    }
  }

  /**
   * Handle print completion
   */
  private async handlePrintCompleted(status: PrinterStatus): Promise<void> {
    // Only send notification if not already sent and setting is enabled
    if (!this.notificationState.hasSentPrintCompleteNotification &&
        shouldSendNotification(NotificationType.PrintComplete, this.currentSettings)) {

      await this.sendPrintCompleteNotification(status);
      this.updateNotificationState({
        hasSentPrintCompleteNotification: true,
        lastPrintCompleteTime: new Date()
      }, NotificationStateTransition.PrintCompleted);
    }
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
