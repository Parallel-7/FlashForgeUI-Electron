/**
 * @fileoverview Core notification service that wraps Electron's Notification API with proper error handling,
 * OS support checking, and TypeScript type safety.
 *
 * This service provides a robust abstraction layer over Electron's native notification system,
 * managing the entire notification lifecycle from creation to cleanup. It handles platform-specific
 * compatibility checks, tracks notification state, and provides event-based notification management
 * with comprehensive error handling.
 *
 * Key Features:
 * - Platform compatibility detection using Electron's isSupported() API
 * - Type-safe wrapper around Electron Notification API with custom notification types
 * - Event emitter pattern for notification lifecycle events (sent, failed, clicked, closed)
 * - Automatic notification tracking with metadata (sent time, active status, notification data)
 * - Priority-based notification timeout configuration (default vs. never timeout)
 * - Automatic cleanup of old notification tracking data (24-hour retention)
 * - Support for silent notifications and custom icons
 * - Singleton pattern with global instance management and test-friendly reset functionality
 *
 * Core Responsibilities:
 * - Wrap Electron Notification API with type safety and consistent error handling
 * - Handle OS compatibility and feature detection before attempting notification display
 * - Provide comprehensive error handling and fallback behavior for unsupported platforms
 * - Support notification options including silent mode, icons, and timeout configuration
 * - Track sent notifications with metadata for management and debugging purposes
 * - Emit events for notification lifecycle stages (sent, failed, clicked, closed)
 * - Manage notification cleanup and disposal with automatic resource release
 *
 * @exports NotificationService - Main service class for notification management
 * @exports getNotificationService - Singleton instance accessor
 * @exports resetNotificationService - Test helper for instance reset
 * @exports NotificationTrackingInfo - Type for notification tracking data
 */

import { Notification as ElectronNotification } from 'electron';
import { EventEmitter } from '../../utils/EventEmitter';
import type {
  Notification,
  NotificationId,
  NotificationEventPayloads
} from '../../types/notification';

// ============================================================================
// NOTIFICATION SERVICE EVENTS
// ============================================================================

/**
 * Event map for NotificationService
 */
interface NotificationServiceEventMap extends Record<string, unknown[]> {
  'notification-sent': [NotificationEventPayloads['notification-sent']];
  'notification-failed': [NotificationEventPayloads['notification-failed']];
  'notification-clicked': [{ notificationId: NotificationId }];
  'notification-closed': [{ notificationId: NotificationId }];
}

// ============================================================================
// NOTIFICATION TRACKING
// ============================================================================

/**
 * Tracking information for sent notifications
 */
interface NotificationTrackingInfo {
  readonly notification: Notification;
  readonly electronNotification: ElectronNotification;
  readonly sentAt: Date;
  readonly isActive: boolean;
}

// ============================================================================
// NOTIFICATION SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Core notification service for desktop notifications
 */
export class NotificationService extends EventEmitter<NotificationServiceEventMap> {
  private readonly sentNotifications = new Map<NotificationId, NotificationTrackingInfo>();
  private isSupported: boolean | null = null;

  constructor() {
    super();
    this.checkNotificationSupport();
  }

  // ============================================================================
  // SUPPORT DETECTION
  // ============================================================================

  /**
   * Check if desktop notifications are supported on this platform
   */
  private checkNotificationSupport(): void {
    try {
      this.isSupported = ElectronNotification.isSupported();
      
      if (!this.isSupported) {
        console.warn('Desktop notifications are not supported on this platform');
      }
    } catch (error) {
      console.error('Error checking notification support:', error);
      this.isSupported = false;
    }
  }

  /**
   * Get notification support status
   */
  public isNotificationSupported(): boolean {
    return this.isSupported === true;
  }

  // ============================================================================
  // CORE NOTIFICATION METHODS
  // ============================================================================

  /**
   * Send a desktop notification
   */
  public async sendNotification(notification: Notification): Promise<boolean> {
    try {
      // Check if notifications are supported
      if (!this.isNotificationSupported()) {
        console.warn('Cannot send notification: Desktop notifications not supported');
        this.emitNotificationFailed(notification, 'Desktop notifications not supported on this platform');
        return false;
      }

      // Create Electron notification options
      const electronOptions = this.createElectronNotificationOptions(notification);

      // Create and configure Electron notification
      const electronNotification = new ElectronNotification(electronOptions);

      // Set up event listeners
      this.setupNotificationEventListeners(notification, electronNotification);

      // Show the notification
      electronNotification.show();

      // Track the notification
      this.trackNotification(notification, electronNotification);

      // Emit success event
      this.emit('notification-sent', {
        notification,
        success: true
      });

      console.log(`Notification sent: ${notification.type} - ${notification.title}`);
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to send notification:', errorMessage);
      
      this.emitNotificationFailed(notification, errorMessage);
      return false;
    }
  }

  /**
   * Close a specific notification
   */
  public closeNotification(notificationId: NotificationId): boolean {
    const trackingInfo = this.sentNotifications.get(notificationId);
    
    if (!trackingInfo || !trackingInfo.isActive) {
      return false;
    }

    try {
      trackingInfo.electronNotification.close();
      return true;
    } catch (error) {
      console.error('Error closing notification:', error);
      return false;
    }
  }

  /**
   * Close all active notifications
   */
  public closeAllNotifications(): number {
    let closedCount = 0;

    for (const [notificationId, trackingInfo] of this.sentNotifications) {
      if (trackingInfo.isActive) {
        if (this.closeNotification(notificationId)) {
          closedCount++;
        }
      }
    }

    return closedCount;
  }

  // ============================================================================
  // ELECTRON NOTIFICATION CONFIGURATION
  // ============================================================================

  /**
   * Create Electron notification options from our notification type
   */
  private createElectronNotificationOptions(notification: Notification): Electron.NotificationConstructorOptions {
    const baseOptions: Electron.NotificationConstructorOptions = {
      title: notification.title,
      body: notification.body,
      silent: notification.options?.silent ?? false,
      timeoutType: this.getTimeoutType(notification.priority)
    };

    // Add icon if specified
    if (notification.options?.icon) {
      baseOptions.icon = notification.options.icon;
    }

    return baseOptions;
  }

  /**
   * Get timeout type based on notification priority
   */
  private getTimeoutType(priority: Notification['priority']): 'default' | 'never' {
    // High priority notifications stay longer
    return priority === 'high' || priority === 'critical' ? 'never' : 'default';
  }

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================

  /**
   * Set up event listeners for an Electron notification
   */
  private setupNotificationEventListeners(
    notification: Notification,
    electronNotification: ElectronNotification
  ): void {
    // Handle notification click
    electronNotification.on('click', () => {
      this.emit('notification-clicked', { notificationId: notification.id });
      console.log(`Notification clicked: ${notification.id}`);
    });

    // Handle notification close
    electronNotification.on('close', () => {
      this.handleNotificationClosed(notification.id);
    });

    // Handle notification show (when actually displayed)
    electronNotification.on('show', () => {
      console.log(`Notification displayed: ${notification.id}`);
    });

    // Handle notification failed
    electronNotification.on('failed', (event, error) => {
      console.error(`Notification failed: ${notification.id}`, error);
      this.emitNotificationFailed(notification, error);
    });
  }

  /**
   * Handle notification closed event
   */
  private handleNotificationClosed(notificationId: NotificationId): void {
    // Update tracking info
    const trackingInfo = this.sentNotifications.get(notificationId);
    if (trackingInfo) {
      // Mark as inactive (we can't modify the readonly object, so we recreate)
      this.sentNotifications.set(notificationId, {
        ...trackingInfo,
        isActive: false
      });
    }

    // Emit closed event
    this.emit('notification-closed', { notificationId });
    console.log(`Notification closed: ${notificationId}`);
  }

  // ============================================================================
  // NOTIFICATION TRACKING
  // ============================================================================

  /**
   * Track a sent notification
   */
  private trackNotification(
    notification: Notification,
    electronNotification: ElectronNotification
  ): void {
    const trackingInfo: NotificationTrackingInfo = {
      notification,
      electronNotification,
      sentAt: new Date(),
      isActive: true
    };

    this.sentNotifications.set(notification.id, trackingInfo);

    // Clean up old notifications periodically
    this.cleanupOldNotifications();
  }

  /**
   * Clean up old notification tracking data
   */
  private cleanupOldNotifications(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    for (const [notificationId, trackingInfo] of this.sentNotifications) {
      const age = now - trackingInfo.sentAt.getTime();
      
      if (age > maxAge && !trackingInfo.isActive) {
        this.sentNotifications.delete(notificationId);
      }
    }
  }

  /**
   * Get notification tracking information
   */
  public getNotificationInfo(notificationId: NotificationId): NotificationTrackingInfo | null {
    return this.sentNotifications.get(notificationId) ?? null;
  }

  /**
   * Get all active notifications
   */
  public getActiveNotifications(): NotificationTrackingInfo[] {
    return Array.from(this.sentNotifications.values())
      .filter(info => info.isActive);
  }

  /**
   * Get notification statistics
   */
  public getNotificationStats(): {
    totalSent: number;
    activeCount: number;
    supportedPlatform: boolean;
  } {
    const activeNotifications = this.getActiveNotifications();

    return {
      totalSent: this.sentNotifications.size,
      activeCount: activeNotifications.length,
      supportedPlatform: this.isNotificationSupported()
    };
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  /**
   * Emit notification failed event
   */
  private emitNotificationFailed(notification: Notification, error: string): void {
    this.emit('notification-failed', {
      type: notification.type,
      error
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Test notification support by sending a test notification
   */
  public async testNotificationSupport(): Promise<boolean> {
    if (!this.isNotificationSupported()) {
      return false;
    }

    try {
      const testNotification = new ElectronNotification({
        title: 'Notification Test',
        body: 'This is a test notification to verify functionality.',
        silent: true
      });

      testNotification.show();
      testNotification.close();
      
      return true;
    } catch (error) {
      console.error('Notification test failed:', error);
      return false;
    }
  }

  /**
   * Cleanup and dispose of the service
   */
  public dispose(): void {
    // Close all active notifications
    this.closeAllNotifications();

    // Clear tracking data
    this.sentNotifications.clear();

    // Remove all event listeners
    this.removeAllListeners();

    console.log('NotificationService disposed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global notification service instance
 */
let globalNotificationService: NotificationService | null = null;

/**
 * Get global notification service instance
 */
export function getNotificationService(): NotificationService {
  if (!globalNotificationService) {
    globalNotificationService = new NotificationService();
  }
  return globalNotificationService;
}

/**
 * Reset global notification service (for testing)
 */
export function resetNotificationService(): void {
  if (globalNotificationService) {
    globalNotificationService.dispose();
    globalNotificationService = null;
  }
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { NotificationTrackingInfo };
