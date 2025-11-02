# WebUI Push Notifications – Refined Implementation Plan

**Status:** Ready for Implementation  
**Updated:** 2025-01-16  
**Author:** Codex  
**Priority:** Medium  

## Overview

Add web push notifications to the FlashForge UI WebUI so users receive the same printer alerts they get on desktop (print complete, printer cooled, etc.) even when the browser tab is closed. This release targets localhost usage only, leveraging browser secure-context exemptions for `http://localhost`. Support includes background delivery via service workers, opt-in controls, and deep links that open the correct printer context when possible.

## Goals

1. Mirror existing desktop notifications to subscribed WebUI clients.  
2. Allow mobile and desktop browsers on localhost to receive notifications while backgrounded or closed.  
3. Respect notification preferences and offer explicit opt-in/out within the WebUI settings modal.  
4. Keep the integration isolated so desktop notifications continue to function without regression.  
5. Maintain privacy by never exposing VAPID private keys to clients and persisting subscriptions on the server.  
6. Ensure push functionality stays disabled unless users enable both WebUI and push notifications.

## Architectural Summary

```
PrinterNotificationCoordinator
  └─> Notification events (print complete, printer cooled, etc.)
       ├─> NotificationService (desktop, existing)
       └─> WebPushService (new)
             └─> WebPushSubscriptionManager (in-memory stores by clientId)
                   └─> Browser Service Worker (sw.js)
                         └─> Displays Notification API toast, focuses correct printer context when tapped
```

### Key Components

**Main Process / WebUI Server**
- `WebPushSubscriptionManager`: tracks subscriptions keyed by `clientId`.  
- `WebPushService`: wraps `web-push` package for sending notifications and handling rate limiting.  
- REST endpoints: `/api/notifications/vapid-public-key`, `/subscribe`, `/unsubscribe`, `/test`.  
- Config updates: lazy VAPID key generation, guarded by opt-in flags.  
- Notification integration: propagate payloads from `PrinterNotificationCoordinator` to the web push service while preserving current desktop behavior.

**WebUI Client**
- `sw.js`: service worker listening for push events, displaying notifications, and focusing/opening the right context.  
- `app.ts`: helper utilities for service worker registration, subscription lifecycle, opt-in UI, and deep-link handling.  
- Settings UI: controls placed in existing Notifications tab.  
- Persistent `webuiPushClientId` generated per browser, stored in `localStorage`.

**Configuration & Assets**
- `AppConfig` gains `WebPushEnabled`, `WebPushVapidPublicKey?`, `WebPushVapidPrivateKey?`. Defaults keep push disabled.  
- Icons reuse current desktop notification PNG assets; no extra splash screens or screenshots.  
- No remote HTTPS support required for this phase; deployment remains localhost-only.

## Technical Requirements

### Dependencies
- Add `web-push@^3.6.7` to runtime dependencies.

### Configuration Management

- Extend `AppConfig` / `DEFAULT_CONFIG` with:
  ```ts
  WebPushEnabled: boolean; // default false
  WebPushVapidPublicKey?: string;
  WebPushVapidPrivateKey?: string;
  ```
- VAPID keys generate lazily when:
  1. `WebUIEnabled` is true, and  
  2. `WebPushEnabled` transitions to true.  
  Store keys via `ConfigManager.updateConfig`. Never expose the private key to clients.
- Provide optional `WEBPUSH_VAPID_PUBLIC_KEY` / `WEBPUSH_VAPID_PRIVATE_KEY` environment overrides for deployments that pre-provision keys.

### Subscription Persistence

- `WebPushSubscriptionManager` holds:
  ```ts
  interface WebPushSubscription {
    clientId: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
    createdAt: Date;
    lastSuccessAt?: Date;
  }
  ```
- Methods:
  - `addSubscription(clientId, PushSubscriptionJSON)`
  - `removeSubscription(clientId, endpoint?)`
  - `getSubscriptionsByClientId(clientId)`
  - `getAllSubscriptions()`
  - `cleanupExpiredSubscriptions(validClientIds: Set<string>)`
- Multiple subscriptions per client supported (e.g., different browsers).  
- No persistence beyond process lifetime in this phase; Phase 2 may add database storage.

### Web Push Service

- Responsibilities:
  - Configure VAPID on start; log helpful warnings when disabled.
  - Provide `isEnabled()`, `sendNotificationToAll(payload)`, `sendNotificationToClient(clientId, payload)`, `sendTestNotification(clientId?)`.
  - Rate limit by notification `type` (minimum 30s) to avoid spamming.
  - Remove expired subscriptions on `410 Gone`.
- Payload contract:
  ```ts
  interface NotificationPayload {
    type: 'print-complete' | 'printer-cooled' | 'upload-complete' | 'connection-lost';
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: {
      contextId?: string;
      printerName?: string;
    };
  }
  ```
- Notification coordinator supplies `contextId` and `printerName` based on current state; missing context falls back gracefully.

### API Routes (`src/webui/server/api-routes.ts`)

- All routes remain behind existing auth middleware; clients must attach bearer tokens.  
- Endpoints:
  - `GET /api/notifications/vapid-public-key` → `{ success, publicKey }` or `503` if disabled.  
  - `POST /api/notifications/subscribe` → body `{ clientId, subscription }`.  
  - `POST /api/notifications/unsubscribe` → body `{ clientId, endpoint? }`.  
  - `POST /api/notifications/test` → triggers targeted test notification to caller’s `clientId`.  
- Validate input with Zod schema reuse or inline guards, return `StandardAPIResponse`.  
- Add server-side logging for auditing.

### Notification Coordinator Integration

- Add `forwardToWebPush(payload)` helper.
- When sending print complete / printer cooled / upload complete / connection lost notifications:
  - Continue current desktop flow.
  - If push enabled, send structured payload:
    ```ts
    await this.forwardToWebPush({
      type: 'print-complete',
      title: 'Print Complete',
      body: `Job "${jobName}" finished`,
      data: {
        contextId: contextManager.getActiveContextId() ?? undefined,
        printerName: status.printerName ?? undefined
      }
    });
    ```
- Ensure push failures never throw upstream; log and continue.

### Client Implementation (`src/webui/static`)

#### Service Worker `sw.js`
- Listen for `push`, `notificationclick`, `install`, `activate`.  
- Parse payload JSON, apply defaults for icon/badge (`/icon-notification.png` reused asset).  
- Use `clients.matchAll` to focus matching window if open; otherwise `clients.openWindow('/')`.  
- Keep `requireInteraction` true for visibility on desktop.

#### `app.ts`
- Generate `webuiPushClientId` (UUID v4 or similar) and store in `localStorage`.  
- Wrap service worker registration and subscription logic:
  - `initPushNotifications()` (called on `DOMContentLoaded` alongside other bootstraps).  
  - `subscribeToNotifications()` / `unsubscribeFromNotifications()` send auth’d fetch requests with `clientId`.  
  - Update settings UI states (enabled/disabled/unsupported/denied/error).  
  - Deep-link handler listens for `message` events from service worker (if needed) to select printers after focus.  
- Ensure fetch calls use `buildAuthHeaders`.  
- Guard with feature detection so unsupported browsers see explanatory messaging.  
- Provide “Send Test Notification” button calling `/api/notifications/test`.

#### Settings UI
- In existing Notifications tab:
  - Toggle switch to enable/disable push.  
  - Status indicator text.  
  - Test button.  
  - Help details summarizing platform support and localhost requirement.  
- Styling integrated into `webui.css`.

### Assets

- Reuse existing PNG used for desktop notifications as both `icon` and `badge` (export to `src/webui/static/icon-notification.png`).  
- No additional splash screens or screenshots required.

## Testing & Validation

### Automated / Scripted
- `npm run type-check`  
- `npm run lint`  
- (Optional) lightweight unit tests for subscription manager logic.

### Manual Scenarios (Localhost)
- Chrome/Edge desktop: subscribe, trigger notifications, close tab, verify toast.  
- Chrome Android (over USB debugging hitting localhost via port forwarding) if available.  
- Safari desktop: ensure graceful degradation (push support limited).  
- Permission denied path updates UI correctly.  
- Rapid duplicate events respect rate limiting.  
- Toggle disables push and unsubscribes.  
- Test button delivers notification only to requesting client.

### Recovery & Telemetry
- Ensure enabling/disabling push properly updates config and VAPID state.  
- Confirm logs show key generation once per environment.  
- Validate that stale subscriptions are removed automatically after failures.

## Out of Scope / Future Enhancements

- Persistent subscription storage across restarts (database or file).  
- Granular per-printer or per-notification-type preferences.  
- Remote HTTPS deployment with valid certificates.  
- Rich notifications (images, actions beyond focus).  
- Background Sync or offline caching for broader PWA functionality.

## File Checklist

- `package.json` – add `web-push` dependency.  
- `src/types/config.ts` – new config fields and defaults.  
- `src/managers/ConfigManager.ts` – VAPID key generation logic during opt-in.  
- `src/webui/server/WebPushSubscriptionManager.ts` – new file.  
- `src/webui/server/WebPushService.ts` – new file.  
- `src/webui/server/api-routes.ts` – notification endpoints.  
- `src/services/notifications/PrinterNotificationCoordinator.ts` – push forwarding.  
- `src/webui/static/sw.js` – service worker.  
- `src/webui/static/app.ts` – subscription logic + UI hooks.  
- `src/webui/static/index.html` – add manifest links/meta.  
- `src/webui/static/webui.css` – styles for new controls.  
- `scripts/copy-webui-assets.js` – ensure new static assets copied.  
- `ai_reference` updates (if new architecture notes needed).

Implementation can proceed once this plan is approved.
