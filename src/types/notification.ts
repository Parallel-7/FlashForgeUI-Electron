/**
 * @fileoverview Comprehensive type system for desktop notification management
 *
 * Provides complete type definitions for the desktop notification system including
 * notification types, state management, configuration integration, and printer state
 * coordination. Uses discriminated unions and branded types for maximum type safety.
 *
 * Key Type Categories:
 * - Branded Types: NotificationId, NotificationTemperature for type safety
 * - Notification Types: PrintComplete, PrinterCooled, Upload, Connection notifications
 * - State Management: NotificationState, NotificationStateTransition for duplicate prevention
 * - Configuration: NotificationSettings extracted from AppConfig
 * - Printer Integration: State transitions, temperature thresholds, trigger conditions
 * - Events: NotificationEvent enum with typed event payloads
 *
 * Factory Functions:
 * - createPrintCompleteNotification: Print job completion alerts
 * - createPrinterCooledNotification: Bed temperature cooled alerts
 * - createUploadCompleteNotification: File upload success
 * - createUploadFailedNotification: File upload errors
 * - createConnectionLostNotification: Printer disconnection
 * - createConnectionErrorNotification: Connection failures
 *
 * Type Guards:
 * - isPrintCompleteNotification, isPrinterCooledNotification, etc.
 * - shouldSendNotification: Settings-based notification filtering
 * - shouldCheckForNotifications, shouldResetNotificationFlags: State-based logic
 *
 * Integration Points:
 * - PrinterNotificationCoordinator: Business logic and state tracking
 * - NotificationService: OS notification delivery
 * - PrinterPollingService: Real-time state monitoring
 * - ConfigManager: User notification preferences
 *
 * @module types/notification
 */

import type { PrinterState } from './polling';
import type { AppConfig } from './config';

// ============================================================================
// BRANDED TYPES FOR TYPE SAFETY
// ============================================================================

/**
 * Branded type for notification IDs to prevent mixing with other string types
 */
export type NotificationId = string & { readonly __brand: 'NotificationId' };

/**
 * Branded type for temperature values in notification context
 */
export type NotificationTemperature = number & { readonly __brand: 'NotificationTemperature' };

/**
 * Create a branded notification ID
 */
export function createNotificationId(id: string): NotificationId {
  return id as NotificationId;
}

/**
 * Create a branded notification temperature
 */
export function createNotificationTemperature(temp: number): NotificationTemperature {
  return temp as NotificationTemperature;
}

// ============================================================================
// NOTIFICATION TYPE DEFINITIONS
// ============================================================================

/**
 * Types of notifications the system can send
 */
export enum NotificationType {
  PrintComplete = 'PrintComplete',
  PrinterCooled = 'PrinterCooled',
  UploadComplete = 'UploadComplete',
  UploadFailed = 'UploadFailed',
  ConnectionLost = 'ConnectionLost',
  ConnectionError = 'ConnectionError'
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Critical = 'critical'
}

/**
 * Notification display options
 */
export interface NotificationOptions {
  readonly silent?: boolean;
  readonly requireInteraction?: boolean;
  readonly icon?: string;
  readonly tag?: string;
  readonly timestamp?: Date;
}

// ============================================================================
// BASE NOTIFICATION INTERFACES
// ============================================================================

/**
 * Base notification interface - all notifications extend this
 */
interface BaseNotification {
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly priority: NotificationPriority;
  readonly options?: NotificationOptions;
  readonly timestamp: Date;
  readonly id: NotificationId;
}

/**
 * Print complete notification data
 */
export interface PrintCompleteNotification extends BaseNotification {
  readonly type: NotificationType.PrintComplete;
  readonly printInfo: {
    readonly fileName: string;
    readonly duration?: number;
    readonly layerCount?: number;
  };
}

/**
 * Printer cooled notification data
 */
export interface PrinterCooledNotification extends BaseNotification {
  readonly type: NotificationType.PrinterCooled;
  readonly printInfo: {
    readonly fileName: string;
    readonly currentTemp: NotificationTemperature;
    readonly threshold: NotificationTemperature;
    readonly timeSincePrintComplete?: number;
  };
}

/**
 * Upload complete notification data
 */
export interface UploadCompleteNotification extends BaseNotification {
  readonly type: NotificationType.UploadComplete;
  readonly uploadInfo: {
    readonly fileName: string;
    readonly fileSize?: number;
    readonly uploadDuration?: number;
  };
}

/**
 * Upload failed notification data
 */
export interface UploadFailedNotification extends BaseNotification {
  readonly type: NotificationType.UploadFailed;
  readonly errorInfo: {
    readonly fileName: string;
    readonly errorMessage: string;
    readonly errorCode?: string;
  };
}

/**
 * Connection lost notification data
 */
export interface ConnectionLostNotification extends BaseNotification {
  readonly type: NotificationType.ConnectionLost;
  readonly connectionInfo: {
    readonly printerName: string;
    readonly ipAddress?: string;
    readonly lastSeen?: Date;
  };
}

/**
 * Connection error notification data
 */
export interface ConnectionErrorNotification extends BaseNotification {
  readonly type: NotificationType.ConnectionError;
  readonly errorInfo: {
    readonly errorMessage: string;
    readonly errorCode?: string;
    readonly printerName?: string;
  };
}

/**
 * Discriminated union of all notification types
 */
export type Notification = 
  | PrintCompleteNotification
  | PrinterCooledNotification
  | UploadCompleteNotification
  | UploadFailedNotification
  | ConnectionLostNotification
  | ConnectionErrorNotification;

// ============================================================================
// NOTIFICATION STATE MANAGEMENT
// ============================================================================

/**
 * State tracking for preventing duplicate notifications
 */
export interface NotificationState {
  readonly hasSentPrintCompleteNotification: boolean;
  readonly hasSentPrinterCooledNotification: boolean;
  readonly lastPrintCompleteTime: Date | null;
  readonly lastNotificationReset: Date;
}

/**
 * Create initial notification state
 */
export function createInitialNotificationState(): NotificationState {
  return {
    hasSentPrintCompleteNotification: false,
    hasSentPrinterCooledNotification: false,
    lastPrintCompleteTime: null,
    lastNotificationReset: new Date()
  };
}

/**
 * State transitions for notification management
 */
export enum NotificationStateTransition {
  PrintStarted = 'PrintStarted',
  PrintCompleted = 'PrintCompleted',
  PrinterCooled = 'PrinterCooled',
  PrintCancelled = 'PrintCancelled',
  ConnectionReset = 'ConnectionReset'
}

// ============================================================================
// CONFIGURATION INTEGRATION
// ============================================================================

/**
 * Notification-related configuration settings extracted from AppConfig
 */
export interface NotificationSettings {
  readonly AlertWhenComplete: boolean;
  readonly AlertWhenCooled: boolean;
  readonly AudioAlerts: boolean;
  readonly VisualAlerts: boolean;
}

/**
 * Extract notification settings from app configuration
 */
export function extractNotificationSettings(config: AppConfig): NotificationSettings {
  return {
    AlertWhenComplete: config.AlertWhenComplete,
    AlertWhenCooled: config.AlertWhenCooled,
    AudioAlerts: config.AudioAlerts,
    VisualAlerts: config.VisualAlerts
  };
}

/**
 * Check if a notification type should be sent based on settings
 */
export function shouldSendNotification(
  type: NotificationType,
  settings: NotificationSettings
): boolean {
  switch (type) {
    case NotificationType.PrintComplete:
      return settings.AlertWhenComplete;
    case NotificationType.PrinterCooled:
      return settings.AlertWhenCooled;
    case NotificationType.UploadComplete:
    case NotificationType.UploadFailed:
    case NotificationType.ConnectionLost:
    case NotificationType.ConnectionError:
      return true; // These are always shown
    default:
      return false;
  }
}

// ============================================================================
// PRINTER STATE INTEGRATION
// ============================================================================

/**
 * Printer states that trigger notification consideration
 */
export type NotificationTriggerState = Extract<PrinterState, 'Completed' | 'Cancelled' | 'Error'>;

/**
 * Printer states that reset notification flags
 */
export type NotificationResetState = Extract<PrinterState, 'Printing' | 'Heating' | 'Calibrating' | 'Busy'>;

/**
 * Temperature threshold for printer cooled notifications
 */
export const COOLED_TEMPERATURE_THRESHOLD = 40 as const;

/**
 * Check if printer state should trigger notifications
 */
export function shouldCheckForNotifications(state: PrinterState): state is NotificationTriggerState {
  return state === 'Completed' || state === 'Cancelled' || state === 'Error';
}

/**
 * Check if printer state should reset notification flags
 */
export function shouldResetNotificationFlags(state: PrinterState): state is NotificationResetState {
  return state === 'Printing' || state === 'Heating' || state === 'Calibrating' || state === 'Busy';
}

/**
 * Check if temperature qualifies for cooled notification
 */
export function isTemperatureCooled(temperature: number): boolean {
  return temperature <= COOLED_TEMPERATURE_THRESHOLD;
}

// ============================================================================
// EVENT SYSTEM INTEGRATION
// ============================================================================

/**
 * Events emitted by the notification system
 */
export enum NotificationEvent {
  NotificationSent = 'notification-sent',
  NotificationFailed = 'notification-failed',
  StateUpdated = 'state-updated',
  SettingsChanged = 'settings-changed'
}

/**
 * Event payloads for notification system events
 */
export interface NotificationEventPayloads {
  'notification-sent': {
    readonly notification: Notification;
    readonly success: boolean;
  };
  'notification-failed': {
    readonly type: NotificationType;
    readonly error: string;
  };
  'state-updated': {
    readonly previousState: NotificationState;
    readonly currentState: NotificationState;
    readonly transition: NotificationStateTransition;
  };
  'settings-changed': {
    readonly previousSettings: NotificationSettings;
    readonly currentSettings: NotificationSettings;
  };
}

// ============================================================================
// NOTIFICATION FACTORIES
// ============================================================================

/**
 * Factory function for creating print complete notifications
 */
export function createPrintCompleteNotification(
  printInfo: PrintCompleteNotification['printInfo']
): PrintCompleteNotification {
  return {
    type: NotificationType.PrintComplete,
    title: 'Print Complete',
    body: `Your print job "${printInfo.fileName}" has finished.`,
    priority: NotificationPriority.Normal,
    timestamp: new Date(),
    id: createNotificationId(`print-complete-${Date.now()}`),
    printInfo
  };
}

/**
 * Factory function for creating printer cooled notifications
 */
export function createPrinterCooledNotification(
  printInfo: PrinterCooledNotification['printInfo']
): PrinterCooledNotification {
  return {
    type: NotificationType.PrinterCooled,
    title: 'Printer Cooled',
    body: `${printInfo.fileName} ready for removal!`,
    priority: NotificationPriority.Low,
    timestamp: new Date(),
    id: createNotificationId(`printer-cooled-${Date.now()}`),
    printInfo
  };
}

/**
 * Factory function for creating upload complete notifications
 */
export function createUploadCompleteNotification(
  uploadInfo: UploadCompleteNotification['uploadInfo']
): UploadCompleteNotification {
  return {
    type: NotificationType.UploadComplete,
    title: 'Upload Complete',
    body: `File "${uploadInfo.fileName}" has been sent to the printer.`,
    priority: NotificationPriority.Normal,
    timestamp: new Date(),
    id: createNotificationId(`upload-complete-${Date.now()}`),
    uploadInfo
  };
}

/**
 * Factory function for creating upload failed notifications
 */
export function createUploadFailedNotification(
  errorInfo: UploadFailedNotification['errorInfo']
): UploadFailedNotification {
  return {
    type: NotificationType.UploadFailed,
    title: 'Upload Failed',
    body: `Failed to upload "${errorInfo.fileName}": ${errorInfo.errorMessage}`,
    priority: NotificationPriority.High,
    timestamp: new Date(),
    id: createNotificationId(`upload-failed-${Date.now()}`),
    errorInfo
  };
}

/**
 * Factory function for creating connection lost notifications
 */
export function createConnectionLostNotification(
  connectionInfo: ConnectionLostNotification['connectionInfo']
): ConnectionLostNotification {
  return {
    type: NotificationType.ConnectionLost,
    title: 'Connection Lost',
    body: `Lost connection to printer "${connectionInfo.printerName}".`,
    priority: NotificationPriority.High,
    timestamp: new Date(),
    id: createNotificationId(`connection-lost-${Date.now()}`),
    connectionInfo
  };
}

/**
 * Factory function for creating connection error notifications
 */
export function createConnectionErrorNotification(
  errorInfo: ConnectionErrorNotification['errorInfo']
): ConnectionErrorNotification {
  return {
    type: NotificationType.ConnectionError,
    title: 'Connection Error',
    body: `Connection error: ${errorInfo.errorMessage}`,
    priority: NotificationPriority.High,
    timestamp: new Date(),
    id: createNotificationId(`connection-error-${Date.now()}`),
    errorInfo
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for print complete notifications
 */
export function isPrintCompleteNotification(notification: Notification): notification is PrintCompleteNotification {
  return notification.type === NotificationType.PrintComplete;
}

/**
 * Type guard for printer cooled notifications
 */
export function isPrinterCooledNotification(notification: Notification): notification is PrinterCooledNotification {
  return notification.type === NotificationType.PrinterCooled;
}

/**
 * Type guard for upload notifications
 */
export function isUploadNotification(notification: Notification): notification is UploadCompleteNotification | UploadFailedNotification {
  return notification.type === NotificationType.UploadComplete || notification.type === NotificationType.UploadFailed;
}

/**
 * Type guard for connection notifications
 */
export function isConnectionNotification(notification: Notification): notification is ConnectionLostNotification | ConnectionErrorNotification {
  return notification.type === NotificationType.ConnectionLost || notification.type === NotificationType.ConnectionError;
}
