/**
 * @fileoverview Notifications module entry point for desktop notification system
 *
 * Provides centralized access to the complete desktop notification system for printer
 * events, upload status, and connection state changes. Manages initialization and disposal
 * of notification services, exports factory functions for creating typed notifications,
 * and provides convenient wrapper functions for common notification scenarios.
 *
 * Key Exports:
 * - NotificationService: Core Electron notification wrapper with OS support detection
 * - PrinterNotificationCoordinator: Business logic for printer state-based notifications
 * - Factory functions: Type-safe notification creation with proper data validation
 * - Utility functions: Settings extraction, state checking, and temperature monitoring
 * - Initialization: Complete system setup with error handling and headless mode support
 *
 * Integration Points:
 * - ConfigManager: Notification preferences and alert settings
 * - PrinterPollingService: Real-time printer state monitoring
 * - BasePrinterBackend: Upload completion and error notifications
 * - ConnectionEstablishmentService: Connection state change notifications
 *
 * @module services/notifications
 */

// Core services
export { NotificationService, getNotificationService, resetNotificationService } from './NotificationService.js';
export { 
  PrinterNotificationCoordinator, 
  getPrinterNotificationCoordinator, 
  resetPrinterNotificationCoordinator 
} from './PrinterNotificationCoordinator.js';

// Import services for internal use
import { getNotificationService, resetNotificationService } from './NotificationService.js';
import { getPrinterNotificationCoordinator, resetPrinterNotificationCoordinator } from './PrinterNotificationCoordinator.js';

// Type exports for external use
export type { NotificationTrackingInfo } from './NotificationService.js';
export type { CoordinatorEventMap } from './PrinterNotificationCoordinator.js';

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
} from '../../types/notification.js';

// Import types for internal use
import type { NotificationState, NotificationSettings } from '../../types/notification.js';

// Import headless detection
import { isHeadlessMode } from '../../utils/HeadlessDetection.js';

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
} from '../../types/notification.js';

// Re-export utility functions
export {
  extractNotificationSettings,
  shouldSendNotification,
  shouldCheckForNotifications,
  shouldResetNotificationFlags,
  isTemperatureCooled,
  createInitialNotificationState
} from '../../types/notification.js';

// ============================================================================
// NOTIFICATION SYSTEM INITIALIZATION
// ============================================================================

/**
 * Initialize the complete notification system
 * Note: Polling integration should be set up separately via coordinator.setPollingService()
 */
export function initializeNotificationSystem(): void {
  // Skip notification system in headless mode
  if (isHeadlessMode()) {
    console.log('[Headless] Skipping notification system initialization');
    return;
  }

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

