// src/services/notifications/index.ts

/**
 * Notifications module entry point providing centralized access to the desktop
 * notification system for printer events, upload status, and connection changes.
 * 
 * Core Responsibilities:
 * - Export all notification services and types
 * - Provide easy access to global instances
 * - Centralize notification system initialization
 * - Support both singleton and custom instances
 */

// Core services
export { NotificationService, getNotificationService, resetNotificationService } from './NotificationService';
export { 
  PrinterNotificationCoordinator, 
  getPrinterNotificationCoordinator, 
  resetPrinterNotificationCoordinator 
} from './PrinterNotificationCoordinator';

// Import services for internal use
import { getNotificationService, resetNotificationService } from './NotificationService';
import { getPrinterNotificationCoordinator, resetPrinterNotificationCoordinator } from './PrinterNotificationCoordinator';

// Type exports for external use
export type { NotificationTrackingInfo } from './NotificationService';
export type { TemperatureMonitorConfig, CoordinatorEventMap } from './PrinterNotificationCoordinator';

// Re-export important types from notification types
export type {
  Notification,
  NotificationId,
  NotificationType,
  NotificationPriority,
  NotificationOptions,
  NotificationState,
  NotificationSettings,
  NotificationStateTransition,
  NotificationEventPayloads
} from '../../types/notification';

// Import types for internal use
import type { NotificationState, NotificationSettings } from '../../types/notification';

// Re-export factory functions for creating notifications
export {
  createNotificationId,
  createNotificationTemperature,
  createPrintCompleteNotification,
  createPrinterCooledNotification,
  createUploadCompleteNotification,
  createUploadFailedNotification,
  createConnectionLostNotification,
  createConnectionErrorNotification
} from '../../types/notification';

// Re-export utility functions
export {
  extractNotificationSettings,
  shouldSendNotification,
  shouldCheckForNotifications,
  shouldResetNotificationFlags,
  isTemperatureCooled,
  createInitialNotificationState
} from '../../types/notification';

// ============================================================================
// NOTIFICATION SYSTEM INITIALIZATION
// ============================================================================

/**
 * Initialize the complete notification system
 * Note: Polling integration should be set up separately via coordinator.setPollingService()
 */
export function initializeNotificationSystem(): void {
  console.log('Initializing notification system...');
  
  // Get global instances
  const notificationService = getNotificationService();
  const coordinator = getPrinterNotificationCoordinator();
  
  // Setup error handling
  notificationService.on('notification-failed', (event: { type: string; error: string }) => {
    console.error('Notification failed:', event);
  });
  
  coordinator.on('state-changed', (event: { transition: string }) => {
    console.log('Notification state changed:', event.transition);
  });
  
  console.log('Notification system initialized successfully');
  console.log('Note: Use getPrinterNotificationCoordinator().setPollingService() to connect polling');
}

/**
 * Dispose of the complete notification system
 */
export function disposeNotificationSystem(): void {
  console.log('Disposing notification system...');
  
  resetPrinterNotificationCoordinator();
  resetNotificationService();
  
  console.log('Notification system disposed');
}

/**
 * Get notification system status
 */
export function getNotificationSystemStatus(): {
  notificationService: {
    supported: boolean;
    activeCount: number;
    totalSent: number;
  };
  coordinator: {
    state: NotificationState;
    settings: NotificationSettings;
  };
} {
  const notificationService = getNotificationService();
  const coordinator = getPrinterNotificationCoordinator();
  
  const serviceStats = notificationService.getNotificationStats();
  
  return {
    notificationService: {
      supported: serviceStats.supportedPlatform,
      activeCount: serviceStats.activeCount,
      totalSent: serviceStats.totalSent
    },
    coordinator: {
      state: coordinator.getNotificationState(),
      settings: coordinator.getNotificationSettings()
    }
  };
}

// ============================================================================
// CONVENIENT UPLOAD NOTIFICATION HELPERS
// ============================================================================

/**
 * Send upload complete notification
 * Convenient wrapper for backend integration
 */
export async function notifyUploadComplete(fileName: string, fileSize?: number, uploadDuration?: number): Promise<void> {
  const coordinator = getPrinterNotificationCoordinator();
  await coordinator.sendUploadCompleteNotification(fileName, fileSize, uploadDuration);
}

/**
 * Send upload failed notification
 * Convenient wrapper for backend integration
 */
export async function notifyUploadFailed(fileName: string, errorMessage: string, errorCode?: string): Promise<void> {
  const coordinator = getPrinterNotificationCoordinator();
  await coordinator.sendUploadFailedNotification(fileName, errorMessage, errorCode);
}

/**
 * Send connection lost notification
 * Convenient wrapper for connection managers
 */
export async function notifyConnectionLost(printerName: string, ipAddress?: string): Promise<void> {
  const coordinator = getPrinterNotificationCoordinator();
  await coordinator.sendConnectionLostNotification(printerName, ipAddress);
}

/**
 * Send connection error notification
 * Convenient wrapper for connection managers
 */
export async function notifyConnectionError(errorMessage: string, errorCode?: string, printerName?: string): Promise<void> {
  const coordinator = getPrinterNotificationCoordinator();
  await coordinator.sendConnectionErrorNotification(errorMessage, errorCode, printerName);
}
