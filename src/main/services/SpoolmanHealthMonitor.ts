/**
 * @fileoverview Spoolman health monitor coordinating connectivity tests, refreshes, and UI events.
 *
 * Tracks Spoolman server availability, periodically pings the configured server,
 * refreshes cached spool data when connectivity is restored, and emits events
 * so the UI layer can surface offline dialogs or success notifications.
 *
 * Core responsibilities:
 * - Periodic connection tests with configurable interval
 * - Automatic clearing of cached spool data when the server becomes unreachable
 * - Automatic refresh of active spools when connectivity returns
 * - Event emission for offline/online transitions and status updates
 * - Manual retry support for the offline dialog
 */

import { EventEmitter } from 'events';
import { toAppError } from '../utils/error.utils.js';
import type { SpoolmanIntegrationService } from './SpoolmanIntegrationService.js';

export interface SpoolmanOfflineEvent {
  reason?: string;
}

export interface SpoolmanOnlineEvent {
  manual?: boolean;
  disabled?: boolean;
}

type HealthCheckResult = { connected: boolean; error?: string };

type HealthCheckOptions = {
  manual?: boolean;
  skipRefreshThrottle?: boolean;
};

const HEALTH_CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export class SpoolmanHealthMonitor extends EventEmitter {
  private service: SpoolmanIntegrationService | null = null;
  private interval: NodeJS.Timeout | null = null;
  private offline = false;
  private lastRefresh = 0;
  private currentCheck: Promise<HealthCheckResult> | null = null;

  initialize(service: SpoolmanIntegrationService): void {
    this.service = service;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    // Run an immediate health check, but don't await (fire and forget)
    void this.runHealthCheck();

    this.interval = setInterval(() => {
      void this.runHealthCheck();
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  dispose(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  isOffline(): boolean {
    return this.offline;
  }

  async manualRetry(): Promise<HealthCheckResult> {
    return await this.runHealthCheck({ manual: true, skipRefreshThrottle: true });
  }

  private async runHealthCheck(options: HealthCheckOptions = {}): Promise<HealthCheckResult> {
    if (this.currentCheck) {
      return await this.currentCheck;
    }

    if (!this.service || !this.service.isGloballyEnabled()) {
      if (this.offline) {
        this.offline = false;
        this.emit('online', { manual: options.manual, disabled: true } as SpoolmanOnlineEvent);
      }
      return { connected: false, error: 'Spoolman integration disabled' };
    }

    this.currentCheck = this.performHealthCheck(options)
      .finally(() => {
        this.currentCheck = null;
      });

    return await this.currentCheck;
  }

  private async performHealthCheck(options: HealthCheckOptions): Promise<HealthCheckResult> {
    try {
      const result = await this.service!.testConnection();
      if (result.connected) {
        await this.handleOnline(options);
        return result;
      }

      await this.handleOffline(result.error);
      return result;
    } catch (error) {
      const message = toAppError(error).message;
      await this.handleOffline(message);
      return { connected: false, error: message };
    }
  }

  private async handleOnline(options: HealthCheckOptions): Promise<void> {
    const now = Date.now();
    const shouldRefresh =
      options.skipRefreshThrottle ||
      now - this.lastRefresh >= HEALTH_CHECK_INTERVAL_MS ||
      this.offline;

    if (shouldRefresh) {
      await this.service!.refreshAllActiveSpools();
      this.lastRefresh = now;
    }

    if (this.offline) {
      this.offline = false;
      this.emit('online', { manual: options.manual } as SpoolmanOnlineEvent);
    }
  }

  private async handleOffline(reason?: string): Promise<void> {
    if (this.offline) {
      return;
    }

    this.offline = true;
    await this.service!.clearAllCachedSpools(reason ?? 'Spoolman server unreachable');
    this.emit('offline', { reason } as SpoolmanOfflineEvent);
  }
}

let instance: SpoolmanHealthMonitor | null = null;

export const getSpoolmanHealthMonitor = (): SpoolmanHealthMonitor => {
  if (!instance) {
    instance = new SpoolmanHealthMonitor();
  }
  return instance;
};
