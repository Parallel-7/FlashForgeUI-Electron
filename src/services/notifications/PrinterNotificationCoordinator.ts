/**
 * @fileoverview Printer notification coordinator that manages notification business logic,
 * state tracking, and integration with printer polling and configuration systems.
 *
 * This coordinator acts as the bridge between printer state monitoring (PrinterPollingService),
 * user notification preferences (ConfigManager), and notification delivery (NotificationService).
 * It implements intelligent notification logic including duplicate prevention, temperature
 * monitoring for cooled notifications, and state-based notification triggers tied to the
 * printer's operational lifecycle.
 *
 * Key Features:
 * - Integration with PrinterPollingService for real-time printer state monitoring
 * - Configuration-driven notification behavior based on user preferences from ConfigManager
 * - Stateful notification tracking to prevent duplicate notifications during a print job
 * - Temperature monitoring system with configurable intervals and thresholds for cooled notifications
 * - Automatic state reset on print start/cancel/error to ensure clean notification cycles
 * - Support for multiple notification types: print complete, printer cooled, upload complete/failed, connection events
 * - Event emitter pattern for notification triggers, state changes, and temperature checks
 * - Singleton pattern with global instance management and test-friendly dependency injection
 *
 * Core Responsibilities:
 * - Monitor printer state changes from PrinterPollingService and handle state transitions
 * - Check notification settings from ConfigManager to respect user preferences
 * - Manage notification state to prevent duplicate notifications within a print cycle
 * - Coordinate notification sending through NotificationService based on state and settings
 * - Handle temperature monitoring for cooled notifications with configurable intervals and thresholds
 * - Reset state appropriately during print cycles (start, complete, cancel, error transitions)
 * - Handle connection changes and cleanup resources on disconnect
 *
 * Temperature Monitoring:
 * - Starts automatically after print completion if cooled notifications are enabled
 * - Checks bed temperature at configurable intervals (default: 30 seconds)
 * - Waits minimum cool time (2 minutes) before checking to avoid premature notifications
 * - Sends notification when bed temperature falls below threshold (default: 35°C)
 * - Automatically stops monitoring after sending cooled notification
 *
 * @exports PrinterNotificationCoordinator - Main coordinator class for printer notifications
 * @exports getPrinterNotificationCoordinator - Singleton instance accessor
 * @exports resetPrinterNotificationCoordinator - Test helper for instance reset
 * @exports TemperatureMonitorConfig - Type for temperature monitoring configuration
 * @exports CoordinatorEventMap - Type for coordinator event emissions
 */

import { EventEmitter } from '../../utils/EventEmitter';
import { getNotificationService, NotificationService } from './NotificationService';
import { getConfigManager, ConfigManager } from '../../managers/ConfigManager';
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
  isTemperatureCooled,
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
  'temperature-checked': [{ temperature: number; coolingThreshold: number; shouldNotify: boolean }];
}

// ============================================================================
// COOLED TEMPERATURE MONITORING
// ============================================================================

/**
 * Temperature monitoring configuration
 */
interface TemperatureMonitorConfig {
  readonly checkIntervalMs: number;
  readonly temperatureThreshold: number;
  readonly minimumCoolTime: number; // Minimum time after print complete before checking
}

/**
 * Default temperature monitoring settings
 */
const DEFAULT_TEMP_MONITOR_CONFIG: TemperatureMonitorConfig = {
  checkIntervalMs: 30 * 1000, // Check every 30 seconds
  temperatureThreshold: COOLED_TEMPERATURE_THRESHOLD,
  minimumCoolTime: 2 * 60 * 1000 // Wait 2 minutes after print complete
};

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

  // State management
  private notificationState: NotificationState;
  private currentSettings: NotificationSettings;
  private lastPrinterStatus: PrinterStatus | null = null;
  

  
  // Temperature monitoring
  private temperatureCheckTimer: NodeJS.Timeout | null = null;
  private readonly tempConfig: TemperatureMonitorConfig;

  constructor(
    notificationService?: NotificationService,
    configManager?: ConfigManager,
    tempConfig?: Partial<TemperatureMonitorConfig>
  ) {
    super();
    
    // Use provided services or get global instances
    this.notificationService = notificationService ?? getNotificationService();
    this.configManager = configManager ?? getConfigManager();
    
    // Initialize configuration
    this.tempConfig = { ...DEFAULT_TEMP_MONITOR_CONFIG, ...tempConfig };
    
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

    // Always update temperature monitoring if we have status
    this.updateTemperatureMonitoring(status);
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

    // Start temperature monitoring for cooled notification
    this.startTemperatureMonitoring();
  }

  // ============================================================================
  // TEMPERATURE MONITORING
  // ============================================================================

  /**
   * Update temperature monitoring based on current status
   */
  private updateTemperatureMonitoring(status: PrinterStatus): void {
    // Only monitor temperature if we've sent print complete notification
    if (this.notificationState.hasSentPrintCompleteNotification && 
        !this.notificationState.hasSentPrinterCooledNotification) {
      
      void this.checkTemperatureForCooledNotification(status);
    }
  }

  /**
   * Start temperature monitoring timer
   */
  private startTemperatureMonitoring(): void {
    // Clear existing timer
    this.stopTemperatureMonitoring();

    // Only start if cooled notifications are enabled
    if (!shouldSendNotification(NotificationType.PrinterCooled, this.currentSettings)) {
      return;
    }

    console.log('Starting temperature monitoring for cooled notification');
    
    this.temperatureCheckTimer = setInterval(() => {
      if (this.lastPrinterStatus) {
        void this.checkTemperatureForCooledNotification(this.lastPrinterStatus);
      }
    }, this.tempConfig.checkIntervalMs);
  }

  /**
   * Stop temperature monitoring timer
   */
  private stopTemperatureMonitoring(): void {
    if (this.temperatureCheckTimer) {
      clearInterval(this.temperatureCheckTimer);
      this.temperatureCheckTimer = null;
    }
  }

  /**
   * Check if temperature qualifies for cooled notification
   */
  private async checkTemperatureForCooledNotification(status: PrinterStatus): Promise<void> {
    // Skip if already sent cooled notification
    if (this.notificationState.hasSentPrinterCooledNotification) {
      return;
    }

    // Skip if print complete notification not sent yet
    if (!this.notificationState.hasSentPrintCompleteNotification) {
      return;
    }

    // Check minimum cool time has passed
    const timeSincePrintComplete = this.notificationState.lastPrintCompleteTime 
      ? Date.now() - this.notificationState.lastPrintCompleteTime.getTime()
      : 0;

    if (timeSincePrintComplete < this.tempConfig.minimumCoolTime) {
      return;
    }

    const bedTemp = status.temperatures.bed.current;
    const shouldNotify = isTemperatureCooled(bedTemp);

    // Emit temperature check event for monitoring
    this.emit('temperature-checked', {
      temperature: bedTemp,
      coolingThreshold: this.tempConfig.temperatureThreshold,
      shouldNotify
    });

    if (shouldNotify && shouldSendNotification(NotificationType.PrinterCooled, this.currentSettings)) {
      await this.sendPrinterCooledNotification(status);
      this.updateNotificationState({
        hasSentPrinterCooledNotification: true
      }, NotificationStateTransition.PrinterCooled);
      
      // Stop temperature monitoring
      this.stopTemperatureMonitoring();
    }
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
      threshold: createNotificationTemperature(this.tempConfig.temperatureThreshold),
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
      this.stopTemperatureMonitoring();
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

    // Stop temperature monitoring when resetting
    this.stopTemperatureMonitoring();
    
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
    
    // Stop temperature monitoring
    this.stopTemperatureMonitoring();
    
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

export type { TemperatureMonitorConfig, CoordinatorEventMap };
