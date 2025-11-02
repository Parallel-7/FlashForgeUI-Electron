/**
 * @fileoverview In-memory manager for WebUI web push subscriptions keyed by browser client ID.
 *
 * Maintains push subscription data for WebUI clients so notifications can be broadcast
 * to every subscribed browser. Each client ID can register multiple subscriptions (for
 * example, different browsers or devices) and duplicate endpoints are ignored. The manager
 * supports add/remove operations, enumeration helpers, and cleanup for stale client IDs.
 *
 * Key responsibilities:
 * - Store push endpoints with associated encryption keys and metadata
 * - Prevent duplicate subscriptions for the same endpoint
 * - Remove subscriptions per-endpoint or entire client
 * - Provide enumeration helpers for broadcasting notifications
 * - Allow periodic cleanup when a client ID is no longer active
 */

export interface WebPushSubscription {
  readonly clientId: string;
  readonly endpoint: string;
  readonly keys: {
    readonly p256dh: string;
    readonly auth: string;
  };
  readonly createdAt: Date;
  lastSuccessAt?: Date;
}

export interface PushSubscriptionPayload {
  readonly endpoint?: string;
  readonly expirationTime?: number | null;
  readonly keys?: {
    readonly p256dh?: string;
    readonly auth?: string;
  };
}

/**
 * Tracks subscriptions for each client ID. Subscriptions are stored in memory for the
 * lifetime of the process. Future iterations may persist the data to disk or database.
 */
export class WebPushSubscriptionManager {
  private readonly subscriptions = new Map<string, Map<string, WebPushSubscription>>();

  /**
   * Add or update a subscription for the given client ID.
   */
  public addSubscription(clientId: string, payload: PushSubscriptionPayload): void {
    if (!clientId || typeof clientId !== 'string') {
      throw new Error('Invalid clientId for web push subscription');
    }

    if (!payload?.endpoint || !payload.keys?.p256dh || !payload.keys.auth) {
      throw new Error('Invalid push subscription payload');
    }

    const endpointKey = payload.endpoint;
    const existingForClient = this.subscriptions.get(clientId) ?? new Map<string, WebPushSubscription>();

    if (existingForClient.has(endpointKey)) {
      console.log(`[WebPushSubscriptionManager] Subscription already exists for client ${clientId}`);
      return;
    }

    const subscription: WebPushSubscription = {
      clientId,
      endpoint: endpointKey,
      keys: {
        p256dh: payload.keys.p256dh,
        auth: payload.keys.auth
      },
      createdAt: new Date()
    };

    existingForClient.set(endpointKey, subscription);
    this.subscriptions.set(clientId, existingForClient);

    console.log(`[WebPushSubscriptionManager] Added subscription for client ${clientId} (total: ${existingForClient.size})`);
  }

  /**
   * Remove a subscription for a client. If endpoint is omitted, all client subscriptions are cleared.
   */
  public removeSubscription(clientId: string, endpoint?: string): void {
    const existingForClient = this.subscriptions.get(clientId);
    if (!existingForClient) {
      return;
    }

    if (endpoint) {
      existingForClient.delete(endpoint);
      console.log(`[WebPushSubscriptionManager] Removed subscription for client ${clientId}`);

      if (existingForClient.size === 0) {
        this.subscriptions.delete(clientId);
      }
      return;
    }

    this.subscriptions.delete(clientId);
    console.log(`[WebPushSubscriptionManager] Removed all subscriptions for client ${clientId}`);
  }

  /**
   * Retrieve all subscriptions registered for a specific client ID.
   */
  public getSubscriptionsByClientId(clientId: string): WebPushSubscription[] {
    return Array.from(this.subscriptions.get(clientId)?.values() ?? []);
  }

  /**
   * Return all stored subscriptions across every client.
   */
  public getAllSubscriptions(): WebPushSubscription[] {
    const allSubscriptions: WebPushSubscription[] = [];
    for (const clientSubscriptions of this.subscriptions.values()) {
      allSubscriptions.push(...clientSubscriptions.values());
    }
    return allSubscriptions;
  }

  /**
   * Update the last success time for a subscription.
   */
  public markSubscriptionDelivered(clientId: string, endpoint: string): void {
    const subscription = this.subscriptions.get(clientId)?.get(endpoint);
    if (subscription) {
      subscription.lastSuccessAt = new Date();
    }
  }

  /**
   * Remove any subscriptions for clients that are no longer considered active.
   */
  public cleanupExpiredSubscriptions(activeClientIds: Set<string>): void {
    for (const clientId of this.subscriptions.keys()) {
      if (!activeClientIds.has(clientId)) {
        this.subscriptions.delete(clientId);
        console.log(`[WebPushSubscriptionManager] Cleaned up inactive client ${clientId}`);
      }
    }
  }

  /**
   * Count the total number of stored subscriptions.
   */
  public getSubscriptionCount(): number {
    let total = 0;
    for (const clientSubscriptions of this.subscriptions.values()) {
      total += clientSubscriptions.size;
    }
    return total;
  }
}

let subscriptionManagerInstance: WebPushSubscriptionManager | null = null;

export function getWebPushSubscriptionManager(): WebPushSubscriptionManager {
  if (!subscriptionManagerInstance) {
    subscriptionManagerInstance = new WebPushSubscriptionManager();
  }
  return subscriptionManagerInstance;
}
