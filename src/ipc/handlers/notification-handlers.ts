/**
 * @fileoverview IPC handlers for desktop notification testing.
 *
 * Provides an IPC endpoint that allows the renderer to trigger a desktop
 * test notification via the existing NotificationService. Useful for manual
 * verification of notification functionality during development.
 */

import { ipcMain } from 'electron';
import { getNotificationService } from '../../services/notifications';
import { createPrintCompleteNotification } from '../../types/notification';
import { getWebPushService } from '../../webui/server/WebPushService';

export function registerNotificationHandlers(): void {
  ipcMain.handle('notifications:test-desktop', async () => {
    try {
      const notificationService = getNotificationService();
      const notification = createPrintCompleteNotification({
        fileName: 'Test Notification'
      });

      const sent = await notificationService.sendNotification(notification);

      const webPushService = getWebPushService();
      if (webPushService.isEnabled()) {
        await webPushService.sendNotificationToAll({
          type: 'print-complete',
          title: 'FlashForge UI Test',
          body: 'Toolbar test notification from FlashForge UI.',
          data: {
            url: '/',
            jobName: 'Test Notification'
          }
        });
      }

      if (!sent) {
        return {
          success: false,
          error: 'Desktop notifications are not supported on this platform.'
        };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Notifications] Failed to send test desktop notification:', error);
      return { success: false, error: message };
    }
  });
}
