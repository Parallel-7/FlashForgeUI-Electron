/**
 * @fileoverview Web push notification service for the WebUI Express server.
 *
 * Provides a thin wrapper around the `web-push` library that knows how to read
 * configuration from ConfigManager, broadcast to registered subscriptions, and
 * handle error conditions like expired endpoints. The service keeps VAPID
 * credentials configured, enforces basic rate limiting, and exposes helpers
 * for sending to all clients or a specific client ID.
 */

import webpush from 'web-push';
import type { ConfigUpdateEvent } from '../../types/config';
import { getConfigManager } from '../../managers/ConfigManager';
import {
  getWebPushSubscriptionManager,
  WebPushSubscription,
  PushSubscriptionPayload
} from './WebPushSubscriptionManager';

export interface NotificationPayload {
  readonly type: 'print-complete' | 'printer-cooled' | 'upload-complete' | 'connection-lost';
  readonly title: string;
  readonly body: string;
  readonly icon?: string;
  readonly badge?: string;
  readonly data?: {
    readonly contextId?: string;
    readonly printerName?: string;
    readonly url?: string;
    readonly jobName?: string;
    readonly fileName?: string;
  };
}

class WebPushService {
  private static readonly MIN_INTERVAL_MS = 30_000;

  private readonly subscriptionManager = getWebPushSubscriptionManager();
  private readonly configManager = getConfigManager();

  private isConfigured = false;
  private readonly lastNotificationTime = new Map<string, number>();

  constructor() {
    this.configureVapid();

    this.configManager.on('configUpdated', (event: ConfigUpdateEvent) => {
      if (
        event.changedKeys.includes('WebPushEnabled') ||
        event.changedKeys.includes('WebUIEnabled') ||
        event.changedKeys.includes('WebPushVapidPublicKey') ||
        event.changedKeys.includes('WebPushVapidPrivateKey')
      ) {
        this.configureVapid();
      }
    });

    this.configManager.on('config-loaded', () => {
      this.configureVapid();
    });
  }

  /**
   * Returns whether web push notifications can be sent.
   */
  public isEnabled(): boolean {
    const config = this.configManager.getConfig();
    return (
      this.isConfigured &&
      config.WebUIEnabled &&
      config.WebPushEnabled &&
      config.WebPushVapidPublicKey.length > 0 &&
      config.WebPushVapidPrivateKey.length > 0
    );
  }

  /**
   * Retrieve the public VAPID key for clients.
   */
  public getPublicKey(): string {
    const config = this.configManager.getConfig();
    return config.WebPushVapidPublicKey;
  }

  /**
   * Send a notification to all registered subscriptions.
   */
  public async sendNotificationToAll(payload: NotificationPayload): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    if (!this.shouldSend(payload.type)) {
      return;
    }

    const subscriptions = this.subscriptionManager.getAllSubscriptions();
    if (subscriptions.length === 0) {
      console.log('[WebPushService] No subscriptions registered. Skipping broadcast.');
      return;
    }

    console.log(`[WebPushService] Sending ${payload.type} notification to ${subscriptions.length} subscription(s).`);
    await this.sendToSubscriptions(subscriptions, payload);
  }

  /**
   * Send a notification to a single client ID.
   */
  public async sendNotificationToClient(clientId: string, payload: NotificationPayload): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    if (!clientId) {
      console.warn('[WebPushService] Missing clientId for targeted notification.');
      return;
    }

    const subscriptions = this.subscriptionManager.getSubscriptionsByClientId(clientId);
    if (subscriptions.length === 0) {
      console.log(`[WebPushService] No subscriptions for client ${clientId}.`);
      return;
    }

    await this.sendToSubscriptions(subscriptions, payload);
  }

  /**
   * Send a test notification. If clientId provided, send to that client, otherwise broadcast.
   */
  public async sendTestNotification(clientId?: string): Promise<void> {
    const payload: NotificationPayload = {
      type: 'print-complete',
      title: 'FlashForge UI Test Notification',
      body: 'Test notification from FlashForge UI WebUI push service.',
      icon: '/icon-notification.png',
      badge: '/icon-notification.png'
    };

    if (clientId) {
      await this.sendNotificationToClient(clientId, payload);
    } else {
      await this.sendNotificationToAll(payload);
    }
  }

  /**
   * Remove a subscription when it is known to be invalid.
   */
  public removeSubscription(clientId: string, endpoint?: string): void {
    this.subscriptionManager.removeSubscription(clientId, endpoint);
  }

  /**
   * Register a subscription payload for a client ID.
   */
  public addSubscription(clientId: string, payload: PushSubscriptionPayload): void {
    this.subscriptionManager.addSubscription(clientId, payload);
  }

  private configureVapid(): void {
    const config = this.configManager.getConfig();
    if (
      config.WebPushVapidPublicKey.length === 0 ||
      config.WebPushVapidPrivateKey.length === 0
    ) {
      this.isConfigured = false;
      return;
    }

    try {
      webpush.setVapidDetails(
        'mailto:notifications@flashforgeui.local',
        config.WebPushVapidPublicKey,
        config.WebPushVapidPrivateKey
      );

      this.isConfigured = true;
      console.log('[WebPushService] VAPID credentials configured.');
    } catch (error) {
      this.isConfigured = false;
      console.error('[WebPushService] Failed to configure VAPID credentials:', error);
    }
  }

  private async sendToSubscriptions(subscriptions: WebPushSubscription[], payload: NotificationPayload): Promise<void> {
    const results = await Promise.allSettled(
      subscriptions.map((subscription) => this.sendToSubscription(subscription, payload))
    );

    let fulfilled = 0;
    let rejected = 0;

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        fulfilled += 1;
      } else {
        rejected += 1;
      }
    });

    console.log(`[WebPushService] Notification delivery summary => success: ${fulfilled}, failed: ${rejected}`);
  }

  private async sendToSubscription(subscription: WebPushSubscription, payload: NotificationPayload): Promise<void> {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys
        },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 }
      );

      this.subscriptionManager.markSubscriptionDelivered(subscription.clientId, subscription.endpoint);
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;

      if (statusCode === 410 || statusCode === 404) {
        console.warn(`[WebPushService] Removing expired subscription for client ${subscription.clientId}`);
        this.subscriptionManager.removeSubscription(subscription.clientId, subscription.endpoint);
      } else {
        console.error('[WebPushService] Failed to send web push notification:', error);
      }

      throw error;
    }
  }

  private shouldSend(type: NotificationPayload['type']): boolean {
    const now = Date.now();
    const lastSent = this.lastNotificationTime.get(type) ?? 0;

    if (now - lastSent < WebPushService.MIN_INTERVAL_MS) {
      console.log(`[WebPushService] Rate limiting notification type ${type}`);
      return false;
    }

    this.lastNotificationTime.set(type, now);
    return true;
  }
}

let webPushServiceInstance: WebPushService | null = null;

export function getWebPushService(): WebPushService {
  if (!webPushServiceInstance) {
    webPushServiceInstance = new WebPushService();
  }
  return webPushServiceInstance;
}
