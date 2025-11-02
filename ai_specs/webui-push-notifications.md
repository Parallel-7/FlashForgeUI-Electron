# WebUI Push Notifications Implementation Spec

**Status:** Planning
**Created:** 2025-11-01
**Author:** Claude
**Priority:** Medium

## Overview

Implement web push notifications for the FlashForge UI WebUI to forward existing desktop notifications (print complete, printer cooled) to web clients. Notifications will work even when the browser is closed or backgrounded on mobile devices using the VAPID protocol and Service Workers.

## Goals

1. **Forward Desktop Notifications**: When the Electron app sends a desktop notification, also send it to connected WebUI clients
2. **Mobile Support**: Enable notifications on mobile devices (Android Chrome, iOS Safari PWA)
3. **Background Operation**: Notifications work when browser tab is closed or app is backgrounded
4. **Seamless Integration**: Hook into existing `PrinterNotificationCoordinator` without breaking current functionality
5. **User Control**: Respect existing notification settings and provide opt-in/opt-out for web push
6. **Full PWA Support**: Make WebUI a proper Progressive Web App with iOS support

## Architecture

### High-Level Flow

```
PrinterNotificationCoordinator
  └─> Notification Event (Print Complete/Cooled)
       ├─> NotificationService (Electron Desktop Notification) [existing]
       └─> WebPushService (Web Push Notification) [new]
            └─> Sends to all subscribed WebUI clients
                 └─> Browser Service Worker receives push
                      └─> Displays notification via Notification API
```

### Components

**Server-Side (Main Process & WebUI Server):**
- `WebPushService` - Manages sending notifications via VAPID
- `WebPushSubscriptionManager` - Stores and manages client subscriptions
- API routes for subscription management
- VAPID key generation and storage

**Client-Side (WebUI Browser):**
- Service Worker (`sw.js`) - Receives push events, displays notifications
- Subscription management UI - Request permission, subscribe/unsubscribe
- PWA manifest and meta tags for iOS support

**Integration:**
- Modify `PrinterNotificationCoordinator` to forward events
- Add config options for VAPID keys and enable/disable

---

## Technical Implementation

### 1. Dependencies

**npm Package:**
```bash
npm install web-push
```

**Package Details:**
- Name: `web-push`
- Version: `^3.6.7`
- Size: ~50KB
- Purpose: VAPID authentication, encryption, sending push notifications

### 2. VAPID Key Management

#### Storage in Config

**File:** `src/types/config.ts`

```typescript
interface AppConfig {
  // ... existing fields

  // Web Push Settings
  WebPushVapidPublicKey?: string;
  WebPushVapidPrivateKey?: string;
  WebPushEnabled: boolean; // Default: true
}
```

#### Key Generation

**Location:** Bootstrap or ConfigManager initialization

```typescript
import webpush from 'web-push';

// Check if keys exist on startup
if (!config.WebPushVapidPublicKey || !config.WebPushVapidPrivateKey) {
  console.log('Generating VAPID keys for web push notifications...');

  const vapidKeys = webpush.generateVAPIDKeys();

  config.WebPushVapidPublicKey = vapidKeys.publicKey;
  config.WebPushVapidPrivateKey = vapidKeys.privateKey;
  config.WebPushEnabled = true;

  configManager.updateConfig(config);

  console.log('VAPID keys generated successfully');
  console.log('Public key:', vapidKeys.publicKey);
}
```

**Note:** Keys are generated once and stored in config. Private key must NEVER be exposed to clients.

### 3. Subscription Management

**File:** `src/webui/server/WebPushSubscriptionManager.ts`

```typescript
/**
 * Manages web push subscriptions for WebUI clients
 */

export interface WebPushSubscription {
  /** Browser push endpoint URL */
  endpoint: string;

  /** Encryption keys from browser */
  keys: {
    p256dh: string;  // Public key for encryption
    auth: string;    // Authentication secret
  };

  /** WebUI session ID for cleanup */
  sessionId: string;

  /** When subscription was created */
  subscribedAt: Date;
}

export class WebPushSubscriptionManager {
  private subscriptions = new Map<string, WebPushSubscription[]>();

  /**
   * Add a new subscription for a session
   */
  addSubscription(sessionId: string, subscription: PushSubscriptionJSON): void {
    if (!subscription.endpoint || !subscription.keys) {
      throw new Error('Invalid push subscription');
    }

    const webPushSub: WebPushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      },
      sessionId,
      subscribedAt: new Date()
    };

    // Store multiple subscriptions per session (multiple devices)
    const existing = this.subscriptions.get(sessionId) || [];

    // Check for duplicate endpoint
    if (existing.some(s => s.endpoint === subscription.endpoint)) {
      console.log('Subscription already exists for session:', sessionId);
      return;
    }

    existing.push(webPushSub);
    this.subscriptions.set(sessionId, existing);

    console.log(`Added web push subscription for session: ${sessionId}`);
  }

  /**
   * Remove subscription by endpoint
   */
  removeSubscription(sessionId: string, endpoint?: string): void {
    const existing = this.subscriptions.get(sessionId);
    if (!existing) return;

    if (endpoint) {
      // Remove specific endpoint
      const filtered = existing.filter(s => s.endpoint !== endpoint);
      if (filtered.length > 0) {
        this.subscriptions.set(sessionId, filtered);
      } else {
        this.subscriptions.delete(sessionId);
      }
    } else {
      // Remove all subscriptions for session
      this.subscriptions.delete(sessionId);
    }

    console.log(`Removed web push subscription for session: ${sessionId}`);
  }

  /**
   * Get all subscriptions for a specific session
   */
  getSubscriptionsForSession(sessionId: string): WebPushSubscription[] {
    return this.subscriptions.get(sessionId) || [];
  }

  /**
   * Get all subscriptions across all sessions
   */
  getAllSubscriptions(): WebPushSubscription[] {
    const all: WebPushSubscription[] = [];
    for (const subs of this.subscriptions.values()) {
      all.push(...subs);
    }
    return all;
  }

  /**
   * Clean up subscriptions for expired sessions
   */
  cleanupExpiredSubscriptions(activeSessions: Set<string>): void {
    const sessionsToRemove: string[] = [];

    for (const sessionId of this.subscriptions.keys()) {
      if (!activeSessions.has(sessionId)) {
        sessionsToRemove.push(sessionId);
      }
    }

    for (const sessionId of sessionsToRemove) {
      this.subscriptions.delete(sessionId);
      console.log(`Cleaned up web push subscriptions for expired session: ${sessionId}`);
    }
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.getAllSubscriptions().length;
  }
}

// Singleton instance
let subscriptionManager: WebPushSubscriptionManager | null = null;

export function getWebPushSubscriptionManager(): WebPushSubscriptionManager {
  if (!subscriptionManager) {
    subscriptionManager = new WebPushSubscriptionManager();
  }
  return subscriptionManager;
}
```

### 4. Web Push Service

**File:** `src/webui/server/WebPushService.ts`

```typescript
/**
 * Service for sending web push notifications via VAPID
 */

import webpush from 'web-push';
import { getConfigManager } from '../../managers/ConfigManager';
import { getWebPushSubscriptionManager, WebPushSubscription } from './WebPushSubscriptionManager';

export interface NotificationPayload {
  /** Notification type */
  type: 'print-complete' | 'printer-cooled' | 'upload-complete' | 'connection-lost';

  /** Notification title */
  title: string;

  /** Notification body text */
  body: string;

  /** Icon URL (optional) */
  icon?: string;

  /** Badge icon URL (optional) */
  badge?: string;

  /** Additional data for notification click handling */
  data?: {
    contextId?: string;
    printerName?: string;
    url?: string; // Deep link to specific printer
  };
}

export class WebPushService {
  private subscriptionManager = getWebPushSubscriptionManager();
  private configManager = getConfigManager();
  private isConfigured = false;
  private lastNotificationTime = new Map<string, number>();

  constructor() {
    this.configureVapid();
  }

  /**
   * Configure VAPID credentials from config
   */
  private configureVapid(): void {
    const config = this.configManager.getConfig();

    if (!config.WebPushVapidPublicKey || !config.WebPushVapidPrivateKey) {
      console.warn('VAPID keys not configured. Web push notifications disabled.');
      this.isConfigured = false;
      return;
    }

    webpush.setVapidDetails(
      'mailto:noreply@flashforgeui.local',
      config.WebPushVapidPublicKey,
      config.WebPushVapidPrivateKey
    );

    this.isConfigured = true;
    console.log('Web push service configured with VAPID');
  }

  /**
   * Check if web push is enabled and configured
   */
  isEnabled(): boolean {
    const config = this.configManager.getConfig();
    return this.isConfigured && config.WebPushEnabled && config.WebUIEnabled;
  }

  /**
   * Rate limiting check to prevent notification spam
   */
  private shouldSendNotification(type: string): boolean {
    const now = Date.now();
    const last = this.lastNotificationTime.get(type) || 0;
    const MIN_INTERVAL = 30 * 1000; // 30 seconds minimum between same notification type

    if (now - last < MIN_INTERVAL) {
      console.log(`Rate limiting web push notification type: ${type}`);
      return false;
    }

    this.lastNotificationTime.set(type, now);
    return true;
  }

  /**
   * Send notification to all subscribed clients
   */
  async sendNotificationToAll(payload: NotificationPayload): Promise<void> {
    if (!this.isEnabled()) {
      console.log('Web push disabled, skipping notification');
      return;
    }

    if (!this.shouldSendNotification(payload.type)) {
      return;
    }

    const subscriptions = this.subscriptionManager.getAllSubscriptions();

    if (subscriptions.length === 0) {
      console.log('No web push subscriptions, skipping notification');
      return;
    }

    console.log(`Sending web push notification to ${subscriptions.length} clients:`, payload.title);

    const results = await Promise.allSettled(
      subscriptions.map(sub => this.sendToSubscription(sub, payload))
    );

    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Web push sent: ${successful} successful, ${failed} failed`);
  }

  /**
   * Send notification to a specific session
   */
  async sendNotificationToSession(sessionId: string, payload: NotificationPayload): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const subscriptions = this.subscriptionManager.getSubscriptionsForSession(sessionId);

    if (subscriptions.length === 0) {
      console.log(`No web push subscriptions for session: ${sessionId}`);
      return;
    }

    console.log(`Sending web push notification to session ${sessionId} (${subscriptions.length} devices)`);

    await Promise.allSettled(
      subscriptions.map(sub => this.sendToSubscription(sub, payload))
    );
  }

  /**
   * Send to a single subscription
   */
  private async sendToSubscription(
    subscription: WebPushSubscription,
    payload: NotificationPayload
  ): Promise<void> {
    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: subscription.keys
      };

      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload),
        {
          TTL: 24 * 60 * 60 // 24 hours
        }
      );

    } catch (error: any) {
      // Handle subscription expiration (410 Gone)
      if (error.statusCode === 410) {
        console.log('Subscription expired, removing:', subscription.endpoint);
        this.subscriptionManager.removeSubscription(subscription.sessionId, subscription.endpoint);
      } else {
        console.error('Failed to send web push notification:', error.message);
      }
      throw error;
    }
  }

  /**
   * Test notification (for debugging)
   */
  async sendTestNotification(sessionId?: string): Promise<void> {
    const payload: NotificationPayload = {
      type: 'print-complete',
      title: 'Test Notification',
      body: 'This is a test notification from FlashForge UI',
      icon: '/icon-192.png',
      data: {
        url: '/'
      }
    };

    if (sessionId) {
      await this.sendNotificationToSession(sessionId, payload);
    } else {
      await this.sendNotificationToAll(payload);
    }
  }
}

// Singleton instance
let webPushService: WebPushService | null = null;

export function getWebPushService(): WebPushService {
  if (!webPushService) {
    webPushService = new WebPushService();
  }
  return webPushService;
}
```

### 5. API Routes

**File:** `src/webui/server/api-routes.ts`

Add the following routes:

```typescript
// GET /api/notifications/vapid-public-key
// Returns the VAPID public key for client subscription
router.get('/notifications/vapid-public-key', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = getConfigManager().getConfig();

    if (!config.WebPushVapidPublicKey) {
      const response: StandardAPIResponse = {
        success: false,
        error: 'Web push not configured'
      };
      return res.status(503).json(response);
    }

    return res.json({
      success: true,
      publicKey: config.WebPushVapidPublicKey
    });
  } catch (error) {
    const appError = toAppError(error);
    const response: StandardAPIResponse = {
      success: false,
      error: appError.message
    };
    return res.status(500).json(response);
  }
});

// POST /api/notifications/subscribe
// Subscribe to web push notifications
router.post('/notifications/subscribe', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subscription = req.body as PushSubscriptionJSON;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      const response: StandardAPIResponse = {
        success: false,
        error: 'Invalid subscription data'
      };
      return res.status(400).json(response);
    }

    const sessionId = req.session?.id || 'unknown';
    const subscriptionManager = getWebPushSubscriptionManager();

    subscriptionManager.addSubscription(sessionId, subscription);

    const response: StandardAPIResponse = {
      success: true,
      message: 'Subscribed to push notifications'
    };

    return res.json(response);
  } catch (error) {
    const appError = toAppError(error);
    const response: StandardAPIResponse = {
      success: false,
      error: appError.message
    };
    return res.status(500).json(response);
  }
});

// POST /api/notifications/unsubscribe
// Unsubscribe from web push notifications
router.post('/notifications/unsubscribe', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { endpoint } = req.body as { endpoint?: string };
    const sessionId = req.session?.id || 'unknown';
    const subscriptionManager = getWebPushSubscriptionManager();

    subscriptionManager.removeSubscription(sessionId, endpoint);

    const response: StandardAPIResponse = {
      success: true,
      message: 'Unsubscribed from push notifications'
    };

    return res.json(response);
  } catch (error) {
    const appError = toAppError(error);
    const response: StandardAPIResponse = {
      success: false,
      error: appError.message
    };
    return res.status(500).json(response);
  }
});

// POST /api/notifications/test (development/debugging only)
router.post('/notifications/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionId = req.session?.id || 'unknown';
    const webPushService = getWebPushService();

    await webPushService.sendTestNotification(sessionId);

    const response: StandardAPIResponse = {
      success: true,
      message: 'Test notification sent'
    };

    return res.json(response);
  } catch (error) {
    const appError = toAppError(error);
    const response: StandardAPIResponse = {
      success: false,
      error: appError.message
    };
    return res.status(500).json(response);
  }
});
```

### 6. Integration with Notification Coordinator

**File:** `src/services/notifications/PrinterNotificationCoordinator.ts`

Modify existing notification methods to forward to web push:

```typescript
/**
 * Send print complete notification
 */
private async sendPrintCompleteNotification(status: PrinterStatus): Promise<void> {
  const jobName = status.currentJob?.fileName ?? 'Unknown Job';

  const printInfo = {
    fileName: jobName,
    duration: status.currentJob?.progress.elapsedTime,
    layerCount: status.currentJob?.progress.totalLayers ?? undefined
  };

  const notification = createPrintCompleteNotification(printInfo);

  try {
    // Send desktop notification (existing)
    await this.notificationService.sendNotification(notification);
    console.log(`Print complete notification sent for job: ${jobName}`);

    // Forward to web push (new)
    await this.forwardToWebPush({
      type: 'print-complete',
      title: 'Print Complete',
      body: `Your print job "${jobName}" has finished.`,
      icon: '/icon-192.png',
      badge: '/icon-monochrome.png',
      data: {
        contextId: this.currentContextId,
        printerName: status.printerName,
        url: this.currentContextId ? `/printer/${this.currentContextId}` : '/'
      }
    });
  } catch (error) {
    console.error('Failed to send print complete notification:', error);
  }
}

/**
 * Send printer cooled notification
 */
private async sendPrinterCooledNotification(status: PrinterStatus): Promise<void> {
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
    // Send desktop notification (existing)
    await this.notificationService.sendNotification(notification);
    console.log(`Printer cooled notification sent for job: ${jobName}`);

    // Forward to web push (new)
    await this.forwardToWebPush({
      type: 'printer-cooled',
      title: 'Printer Cooled',
      body: `${jobName} ready for removal!`,
      icon: '/icon-192.png',
      badge: '/icon-monochrome.png',
      data: {
        contextId: this.currentContextId,
        printerName: status.printerName,
        url: this.currentContextId ? `/printer/${this.currentContextId}` : '/'
      }
    });
  } catch (error) {
    console.error('Failed to send printer cooled notification:', error);
  }
}

/**
 * Forward notification to web push service
 */
private async forwardToWebPush(payload: NotificationPayload): Promise<void> {
  try {
    const { getWebPushService } = await import('../../webui/server/WebPushService');
    const webPushService = getWebPushService();

    if (!webPushService.isEnabled()) {
      return;
    }

    await webPushService.sendNotificationToAll(payload);
  } catch (error) {
    // Don't let web push errors break desktop notifications
    console.error('Failed to forward to web push:', error);
  }
}
```

**Note:** Add `forwardToWebPush` helper and import at top of file:
```typescript
import type { NotificationPayload } from '../../webui/server/WebPushService';
```

### 7. Client-Side Service Worker

**File:** `src/webui/static/sw.js`

```javascript
/**
 * Service Worker for Web Push Notifications
 * Handles push events and displays notifications
 */

console.log('FlashForge UI Service Worker loaded');

// Handle push events from server
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error('Failed to parse push data:', error);
  }

  const title = data.title || 'FlashForge Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-monochrome.png',
    data: data.data || {},
    requireInteraction: true, // Keep visible until user interacts
    tag: data.type, // Replace previous notification of same type
    vibrate: [200, 100, 200], // Vibration pattern for mobile
    actions: [
      {
        action: 'open',
        title: 'View Printer'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  // Handle action buttons
  if (event.action === 'close') {
    return;
  }

  // Get URL to open (default to root)
  const urlToOpen = event.notification.data?.url || '/';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if WebUI is already open
        for (const client of clientList) {
          if (client.url === fullUrl && 'focus' in client) {
            return client.focus();
          }
        }

        // Open new window if available
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});

// Handle installation
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});
```

### 8. Client-Side Subscription Management

**File:** `src/webui/static/app.ts`

Add the following code:

```typescript
// =============================================================================
// WEB PUSH NOTIFICATIONS
// =============================================================================

/**
 * Check if push notifications are supported
 */
function isPushSupported(): { supported: boolean; reason?: string } {
  if (!('serviceWorker' in navigator)) {
    return { supported: false, reason: 'Service workers not supported' };
  }
  if (!('PushManager' in window)) {
    return { supported: false, reason: 'Push API not supported' };
  }
  if (!('Notification' in window)) {
    return { supported: false, reason: 'Notifications API not supported' };
  }
  return { supported: true };
}

/**
 * Check if running as iOS PWA
 */
function isIOSPWA(): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = (window.navigator as any).standalone === true ||
                       window.matchMedia('(display-mode: standalone)').matches;
  return isIOS && isStandalone;
}

/**
 * Initialize service worker
 */
async function initServiceWorker(): Promise<void> {
  const support = isPushSupported();

  if (!support.supported) {
    console.warn('Push notifications not supported:', support.reason);
    updateNotificationUI('unsupported', support.reason);
    return;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('Service worker registered:', registration.scope);

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;
    console.log('Service worker ready');

    // Check if already subscribed
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      console.log('Already subscribed to push notifications');
      updateNotificationUI('enabled');
    } else {
      updateNotificationUI('disabled');
    }

  } catch (error) {
    console.error('Service worker registration failed:', error);
    updateNotificationUI('error', String(error));
  }
}

/**
 * Subscribe to push notifications
 */
async function subscribeToNotifications(): Promise<boolean> {
  try {
    // Check support
    const support = isPushSupported();
    if (!support.supported) {
      alert(support.reason);
      return false;
    }

    // Request permission
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.log('Notification permission denied');
      updateNotificationUI('denied');
      return false;
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log('Already subscribed');
      updateNotificationUI('enabled');
      return true;
    }

    // Get VAPID public key from server
    const keyResponse = await fetch('/api/notifications/vapid-public-key');
    const keyData = await keyResponse.json();

    if (!keyData.success || !keyData.publicKey) {
      throw new Error('Failed to get VAPID public key');
    }

    // Subscribe to push
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
    });

    console.log('Push subscription created:', subscription);

    // Send subscription to server
    const subscribeResponse = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });

    const subscribeData = await subscribeResponse.json();

    if (!subscribeData.success) {
      throw new Error(subscribeData.error || 'Failed to subscribe');
    }

    console.log('Subscribed to push notifications');
    updateNotificationUI('enabled');
    return true;

  } catch (error) {
    console.error('Failed to subscribe to notifications:', error);
    updateNotificationUI('error', String(error));
    return false;
  }
}

/**
 * Unsubscribe from push notifications
 */
async function unsubscribeFromNotifications(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Unsubscribe from browser
      await subscription.unsubscribe();

      // Notify server
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });

      console.log('Unsubscribed from push notifications');
    }

    updateNotificationUI('disabled');

  } catch (error) {
    console.error('Failed to unsubscribe:', error);
  }
}

/**
 * Send test notification
 */
async function sendTestNotification(): Promise<void> {
  try {
    const response = await fetch('/api/notifications/test', {
      method: 'POST'
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to send test notification');
    }

    console.log('Test notification sent');
  } catch (error) {
    console.error('Failed to send test notification:', error);
    alert('Failed to send test notification: ' + error);
  }
}

/**
 * Convert VAPID public key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Update notification UI status
 */
function updateNotificationUI(
  status: 'enabled' | 'disabled' | 'unsupported' | 'denied' | 'error',
  message?: string
): void {
  const checkbox = document.getElementById('enable-notifications') as HTMLInputElement;
  const statusSpan = document.getElementById('notification-status');
  const testButton = document.getElementById('test-notification') as HTMLButtonElement;

  if (!checkbox || !statusSpan || !testButton) return;

  switch (status) {
    case 'enabled':
      checkbox.checked = true;
      checkbox.disabled = false;
      statusSpan.textContent = '✓ Enabled';
      statusSpan.className = 'status-enabled';
      testButton.disabled = false;
      break;

    case 'disabled':
      checkbox.checked = false;
      checkbox.disabled = false;
      statusSpan.textContent = 'Disabled';
      statusSpan.className = 'status-disabled';
      testButton.disabled = true;
      break;

    case 'unsupported':
      checkbox.checked = false;
      checkbox.disabled = true;
      statusSpan.textContent = `Not supported: ${message}`;
      statusSpan.className = 'status-error';
      testButton.disabled = true;
      break;

    case 'denied':
      checkbox.checked = false;
      checkbox.disabled = false;
      statusSpan.textContent = 'Permission denied';
      statusSpan.className = 'status-error';
      testButton.disabled = true;
      break;

    case 'error':
      checkbox.checked = false;
      checkbox.disabled = false;
      statusSpan.textContent = `Error: ${message}`;
      statusSpan.className = 'status-error';
      testButton.disabled = true;
      break;
  }
}

/**
 * Setup notification UI event handlers
 */
function setupNotificationUI(): void {
  const checkbox = document.getElementById('enable-notifications') as HTMLInputElement;
  const testButton = document.getElementById('test-notification') as HTMLButtonElement;

  if (checkbox) {
    checkbox.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      if (target.checked) {
        const success = await subscribeToNotifications();
        if (!success) {
          target.checked = false;
        }
      } else {
        await unsubscribeFromNotifications();
      }
    });
  }

  if (testButton) {
    testButton.addEventListener('click', async () => {
      await sendTestNotification();
    });
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  setupNotificationUI();
});
```

### 9. PWA Manifest for iOS Support

**File:** `src/webui/static/manifest.json`

```json
{
  "name": "FlashForge UI",
  "short_name": "FlashForge",
  "description": "Remote 3D printer control and monitoring",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#0066cc",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshot-wide.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshot-narrow.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "categories": ["utilities", "productivity"],
  "shortcuts": [
    {
      "name": "Printer Status",
      "url": "/",
      "description": "View current printer status"
    }
  ]
}
```

### 10. HTML Meta Tags for iOS PWA

**File:** `src/webui/static/index.html`

Add to `<head>` section:

```html
<!-- PWA Manifest -->
<link rel="manifest" href="/manifest.json">

<!-- Theme color -->
<meta name="theme-color" content="#0066cc">
<meta name="color-scheme" content="light dark">

<!-- Apple iOS PWA support -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="FlashForge">

<!-- Apple touch icons (required for iOS) -->
<link rel="apple-touch-icon" href="/icon-180.png" sizes="180x180">
<link rel="apple-touch-icon" href="/icon-167.png" sizes="167x167">
<link rel="apple-touch-icon" href="/icon-152.png" sizes="152x152">
<link rel="apple-touch-icon" href="/icon-120.png" sizes="120x120">

<!-- Apple splash screens (optional but recommended) -->
<link rel="apple-touch-startup-image" href="/splash-2048x2732.png" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)">
<link rel="apple-touch-startup-image" href="/splash-1668x2388.png" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)">
<link rel="apple-touch-startup-image" href="/splash-1536x2048.png" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)">
<link rel="apple-touch-startup-image" href="/splash-1125x2436.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)">
<link rel="apple-touch-startup-image" href="/splash-1242x2688.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)">
<link rel="apple-touch-startup-image" href="/splash-828x1792.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)">
<link rel="apple-touch-startup-image" href="/splash-1242x2208.png" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)">
<link rel="apple-touch-startup-image" href="/splash-750x1334.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)">
<link rel="apple-touch-startup-image" href="/splash-640x1136.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)">

<!-- Viewport -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

<!-- Description -->
<meta name="description" content="Remote 3D printer control and monitoring for FlashForge printers">
```

### 11. UI Components HTML

Add notification settings section to WebUI (location TBD):

```html
<div class="notification-settings-section">
  <h3>Push Notifications</h3>
  <p class="notification-description">
    Get notified when your prints complete, even when this tab is closed.
  </p>

  <div class="notification-toggle">
    <label class="checkbox-label">
      <input type="checkbox" id="enable-notifications" />
      <span>Enable push notifications</span>
    </label>
    <span id="notification-status" class="status-indicator"></span>
  </div>

  <button id="test-notification" class="btn-secondary" disabled>
    Test Notification
  </button>

  <div class="notification-help">
    <details>
      <summary>Help & Requirements</summary>
      <ul>
        <li><strong>Desktop:</strong> Works in Chrome, Firefox, Edge, Safari</li>
        <li><strong>Android:</strong> Works in Chrome, Firefox</li>
        <li><strong>iOS:</strong> Add FlashForge UI to your home screen first</li>
      </ul>
      <p>
        Notifications work even when your browser is closed or in the background.
      </p>
    </details>
  </div>
</div>
```

**CSS styling:**

```css
.notification-settings-section {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin: 1rem 0;
}

.notification-description {
  color: var(--text-secondary);
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.notification-toggle {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.status-indicator {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.status-enabled {
  background-color: #d4edda;
  color: #155724;
}

.status-disabled {
  background-color: #f8f9fa;
  color: #6c757d;
}

.status-error {
  background-color: #f8d7da;
  color: #721c24;
}

.notification-help {
  margin-top: 1rem;
  font-size: 0.85rem;
}

.notification-help summary {
  cursor: pointer;
  color: var(--primary-color);
}

.notification-help ul {
  margin-top: 0.5rem;
  padding-left: 1.5rem;
}

.notification-help li {
  margin-bottom: 0.25rem;
}
```

### 12. Icon Assets

Create the following icon files in `src/webui/static/`:

**Required Icons:**
- `icon-192.png` - 192x192px (PWA manifest, Android)
- `icon-512.png` - 512x512px (PWA manifest, Android)
- `icon-180.png` - 180x180px (iPhone Retina)
- `icon-167.png` - 167x167px (iPad Pro)
- `icon-152.png` - 152x152px (iPad Retina)
- `icon-120.png` - 120x120px (iPhone non-Retina)
- `icon-monochrome.png` - 96x96px (Notification badge, monochrome)

**Optional but Recommended:**
- `splash-*.png` - Various sizes for iOS splash screens
- `screenshot-wide.png` - 1280x720px (PWA install prompt)
- `screenshot-narrow.png` - 750x1334px (PWA install prompt)

**Icon Requirements:**
- All icons should have opaque backgrounds (no transparency)
- iOS icons automatically get rounded corners
- Use consistent branding and colors
- Monochrome badge should be white foreground on transparent background

---

## Testing Plan

### Desktop Testing

**Chrome/Edge:**
1. Open WebUI in browser
2. Check service worker registration in DevTools
3. Enable notifications via toggle
4. Trigger print complete notification
5. Verify notification appears
6. Close browser tab
7. Trigger notification again
8. Verify notification still appears
9. Click notification → should open/focus WebUI

**Firefox:**
- Same steps as Chrome

**Safari (macOS):**
- Same steps as Chrome
- Note: No notification when browser fully closed

### Mobile Testing

**Android Chrome:**
1. Open WebUI on mobile device
2. Enable notifications
3. Background the browser
4. Trigger notification from printer
5. Verify notification appears
6. Tap notification → should open WebUI

**iOS Safari PWA:**
1. Open WebUI in Safari
2. Tap Share → Add to Home Screen
3. Open app from home screen
4. Enable notifications
5. Close app (swipe up)
6. Trigger notification
7. Verify notification appears
8. Tap notification → should open app

**iOS Safari Browser (should show limitations):**
- Open WebUI in Safari browser (not installed)
- Try to enable notifications
- Should show message: "Add to home screen for push notifications"

### Notification Types to Test

1. Print Complete
2. Printer Cooled
3. Upload Complete (if implemented)
4. Connection Lost (if implemented)
5. Test notification via button

### Edge Cases

- Multiple devices subscribed to same session
- Subscription expiration (410 error)
- VAPID keys not configured
- Web push disabled in config
- Permission denied
- Browser doesn't support push
- Network offline when notification sent
- Rapid repeated notifications (rate limiting)

---

## Browser Compatibility

| Browser | Platform | Push Support | PWA Support | Notes |
|---------|----------|--------------|-------------|-------|
| Chrome 42+ | Desktop | ✅ Full | ✅ Full | Best support |
| Chrome 42+ | Android | ✅ Full | ✅ Full | Works in background |
| Firefox 44+ | Desktop | ✅ Full | ✅ Full | Good support |
| Firefox 44+ | Android | ✅ Full | ✅ Full | Works in background |
| Edge 17+ | Desktop | ✅ Full | ✅ Full | Chromium-based |
| Safari 16+ | macOS | ✅ Full | ✅ Full | Recent versions only |
| Safari 16.4+ | iOS | ⚠️ PWA Only | ⚠️ Limited | Must install to home screen |
| Opera | Desktop/Android | ✅ Full | ✅ Full | Chromium-based |
| Samsung Internet | Android | ✅ Full | ✅ Full | Good support |
| IE11 | Windows | ❌ None | ❌ None | Not supported |

**Key Limitations:**
- **iOS Safari Browser**: No push notifications (only PWA)
- **iOS PWA**: Must be installed to home screen first
- **Safari (all)**: No push when browser completely closed (unlike Chrome/Firefox)

---

## Security Considerations

### VAPID Key Security

**CRITICAL:** Private VAPID key must NEVER be exposed to clients

- Store in server-side config only
- Never send in API responses
- Never commit to version control (if using external config)
- Only public key is sent to clients

### Subscription Validation

- Validate subscription endpoint URLs
- Check for required fields (endpoint, keys.p256dh, keys.auth)
- Rate limit subscription endpoints
- Clean up expired subscriptions automatically

### Session Management

- Tie subscriptions to authenticated WebUI sessions
- Remove subscriptions when session expires/logs out
- Don't allow anonymous subscriptions

### Content Security

- Notification payloads should not contain sensitive data
- Use notification IDs that don't reveal information
- Deep links should not expose sensitive parameters

### Rate Limiting

- Limit notification frequency per type (30 second minimum)
- Prevent notification spam from rapid state changes
- Implement per-session rate limits

---

## Configuration

### App Config Schema

```typescript
interface AppConfig {
  // ... existing fields

  // Web Push Notifications
  WebPushVapidPublicKey?: string;    // Auto-generated on first run
  WebPushVapidPrivateKey?: string;   // Auto-generated on first run
  WebPushEnabled: boolean;           // Default: true
}
```

### Environment Variables (Optional)

For production deployments, may want to set VAPID keys via environment:

```bash
WEBPUSH_VAPID_PUBLIC_KEY=...
WEBPUSH_VAPID_PRIVATE_KEY=...
```

### User Settings

Notifications respect existing user settings:
- `AlertWhenComplete` - Enable/disable print complete notifications
- `AlertWhenCooled` - Enable/disable printer cooled notifications
- `WebUIEnabled` - Web push only works when WebUI is enabled

---

## Error Handling

### Subscription Errors

**410 Gone (Expired Subscription):**
- Automatically remove from subscription manager
- Log removal
- User can re-subscribe if they refresh

**Other HTTP Errors:**
- Log error message
- Don't remove subscription
- Retry may succeed later

### Service Worker Errors

**Registration Failure:**
- Show error in UI
- Disable notification toggle
- Log detailed error for debugging

**Push Event Failure:**
- Log error in service worker console
- Notification may not display
- Browser may show generic notification

### Permission Errors

**Permission Denied:**
- Update UI to show denied status
- Provide instructions to reset in browser settings
- Don't spam permission requests

**Permission Dismissed:**
- Show neutral state
- Allow user to try again
- Provide help text

---

## Performance Considerations

### Server-Side

- Use `Promise.allSettled()` to send to all subscriptions in parallel
- Don't block notification coordinator on web push failures
- Clean up expired subscriptions periodically
- Rate limit to prevent spam

### Client-Side

- Service worker runs in background (no impact on main page)
- Subscription stored by browser (not in memory)
- Minimal JavaScript bundle size increase (~5KB)

### Network

- Push notifications are small (~1-2KB per notification)
- TTL set to 24 hours (notifications expire if undelivered)
- Uses browser's push service (Google FCM, Mozilla, Apple APNS)

---

## Deployment Considerations

### First Deployment

1. Install `web-push` dependency
2. VAPID keys auto-generate on first run
3. Keys stored in config file
4. No database migrations needed
5. Existing users need to opt-in

### Updates

- Service worker updates automatically when `sw.js` changes
- Browser refetches service worker periodically
- No user action required for updates
- Subscriptions persist across updates

### Rollback

- Disable via config: `WebPushEnabled: false`
- Service worker continues to work (just won't receive pushes)
- Can remove service worker registration from client code
- Subscriptions remain in storage (harmless)

---

## Future Enhancements

### Phase 2 Features (Not in initial scope)

1. **Persistent Subscription Storage**
   - Store subscriptions in SQLite database
   - Survive server restarts
   - Export/import functionality

2. **Advanced Notification Options**
   - Notification sound selection
   - Custom vibration patterns
   - Rich media (images, progress bars)
   - Interactive action buttons

3. **Notification Preferences**
   - Per-printer notification settings
   - Per-notification-type settings
   - Quiet hours configuration
   - Notification grouping

4. **Multi-User Support**
   - Per-user subscriptions
   - User-specific notification preferences
   - Admin can disable for specific users

5. **Analytics**
   - Track notification delivery rates
   - Monitor subscription churn
   - A/B test notification content

6. **Advanced PWA Features**
   - Offline functionality
   - Background sync
   - Periodic background sync
   - Web Share Target

---

## File Checklist

### New Files

- [ ] `src/webui/server/WebPushService.ts`
- [ ] `src/webui/server/WebPushSubscriptionManager.ts`
- [ ] `src/webui/static/sw.js`
- [ ] `src/webui/static/manifest.json`
- [ ] `src/webui/static/icon-192.png`
- [ ] `src/webui/static/icon-512.png`
- [ ] `src/webui/static/icon-180.png`
- [ ] `src/webui/static/icon-167.png`
- [ ] `src/webui/static/icon-152.png`
- [ ] `src/webui/static/icon-120.png`
- [ ] `src/webui/static/icon-monochrome.png`

### Modified Files

- [ ] `src/types/config.ts` - Add VAPID key fields
- [ ] `src/webui/server/api-routes.ts` - Add notification API routes
- [ ] `src/webui/static/app.ts` - Add service worker and subscription code
- [ ] `src/webui/static/index.html` - Add PWA meta tags and manifest link
- [ ] `src/services/notifications/PrinterNotificationCoordinator.ts` - Forward to web push
- [ ] `package.json` - Add `web-push` dependency
- [ ] Bootstrap/initialization code - Generate VAPID keys on first run

---

## Success Criteria

Implementation is complete when:

1. ✅ Desktop notifications continue to work as before
2. ✅ Web push notifications sent to subscribed WebUI clients
3. ✅ Notifications work when browser tab closed
4. ✅ Notifications work on Android Chrome background
5. ✅ Notifications work on iOS Safari PWA (when installed)
6. ✅ iOS browser shows "install PWA" message
7. ✅ User can enable/disable notifications via toggle
8. ✅ Test notification button works
9. ✅ Clicking notification opens/focuses WebUI
10. ✅ VAPID keys auto-generate on first run
11. ✅ Expired subscriptions automatically removed
12. ✅ Rate limiting prevents notification spam
13. ✅ Existing notification settings respected
14. ✅ No errors in browser console
15. ✅ Service worker registers successfully
16. ✅ PWA manifest valid and functional

---

## References

- [Web Push Protocol (Mozilla)](https://blog.mozilla.org/services/2016/08/23/sending-vapid-identified-webpush-notifications-via-mozillas-push-service/)
- [web-push npm package](https://www.npmjs.com/package/web-push)
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [iOS PWA Requirements](https://firt.dev/notes/pwa-ios/)
- [PWA Install Criteria](https://web.dev/learn/pwa/installation/)
- [Example Implementation (pirminrehm)](https://github.com/pirminrehm/service-worker-web-push-example)
- [Example Implementation (soonick)](https://github.com/soonick/web-push-example)
