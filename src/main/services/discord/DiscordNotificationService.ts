/**
 * @fileoverview Discord webhook notification service for multi-printer status updates
 *
 * Provides Discord webhook integration with support for multiple printer contexts.
 * Sends rich embeds with printer status, temperatures, progress, and print information
 * to a configured Discord webhook URL. Supports both timer-based periodic updates
 * and event-driven immediate notifications.
 *
 * Key Features:
 * - Multi-context support: Shared periodic timer and per-printer state tracking
 * - Hybrid update mode: Global timer-based intervals + event-driven state changes
 * - Rate limiting: Sequential message sending with configurable delays
 * - 1:1 embed structure: Matches original JavaScript implementation exactly
 * - Idle transition detection: Sends notification when transitioning to idle state
 * - Config-driven: Respects DiscordSync, WebhookUrl, and interval settings
 * - Error handling: Network failures don't crash the service
 *
 * Architecture:
 * - Single global periodic update timer
 * - Per-context state tracking for idle transition detection
 * - Integration with PrinterContextManager for multi-printer iteration
 * - Integration with ConfigManager for settings and change detection
 * - Event emitter pattern for state changes and notifications sent
 *
 * Update Behavior:
 * - Timer-based: Send updates for all contexts at configured interval (default 5 min)
 * - Event-driven: Immediate updates on print complete, printer cooled, idle transition
 * - Idle logic: Only send idle notification when transitioning FROM active TO idle
 * - Skip idle on timers: Timer updates skip idle printers, only send when printing
 *
 * @module services/discord/DiscordNotificationService
 */

import type {
  DiscordEmbed,
  DiscordEmbedField,
  DiscordServiceConfig,
  DiscordWebhookPayload,
} from '@shared/types/discord.js';
import type { ContextRemovedEvent } from '@shared/types/PrinterContext.js';
import type { PrinterState, PrinterStatus } from '@shared/types/polling.js';
import { EventEmitter } from 'events';
import { type ConfigManager, getConfigManager } from '../../managers/ConfigManager.js';
import {
  getPrinterContextManager,
  type PrinterContext,
  type PrinterContextManager,
} from '../../managers/PrinterContextManager.js';
import { getGo2rtcService } from '../Go2rtcService.js';
import type { PrintStateMonitor } from '../PrintStateMonitor.js';
import type { TemperatureMonitoringService } from '../TemperatureMonitoringService.js';

/**
 * Printer state for Discord notifications
 * Simplified from PrinterState enum for Discord logic
 */
type DiscordPrinterState = 'idle' | 'printing' | 'paused' | 'unknown';

interface DiscordWebhookRequest {
  readonly payload: DiscordWebhookPayload;
  readonly contextId?: string;
}

/**
 * Discord notification service for multi-printer webhook updates
 */
export class DiscordNotificationService extends EventEmitter {
  private readonly configManager: ConfigManager;
  private readonly contextManager: PrinterContextManager;
  private go2rtcService: Pick<ReturnType<typeof getGo2rtcService>, 'captureSnapshot'> | null = null;
  private readonly handleConfigUpdatedBound: () => void;
  private readonly handleContextRemovedBound: (event: ContextRemovedEvent) => void;

  // Per-context state tracking
  private readonly lastPrinterState = new Map<string, DiscordPrinterState>();
  private readonly cachedStatuses = new Map<string, PrinterStatus>();
  private readonly monitorListeners = new Map<
    string,
    {
      stateMonitor: PrintStateMonitor;
      printCompletedListener: (event: { contextId: string; jobName: string; status: PrinterStatus }) => void;
      temperatureMonitor?: TemperatureMonitoringService;
      printerCooledListener?: (event: { contextId: string }) => void;
    }
  >();

  // Rate limiting
  private readonly RATE_LIMIT_DELAY_MS = 1000; // 1 second between multi-printer messages

  // Service state
  private isInitialized = false;
  private periodicUpdateTimer: NodeJS.Timeout | null = null;
  private periodicUpdateIntervalMs: number | null = null;
  private isPeriodicUpdateInProgress = false;
  private shouldRunPeriodicUpdateAgain = false;
  private currentConfig: DiscordServiceConfig;

  constructor(configManager?: ConfigManager, contextManager?: PrinterContextManager) {
    super();

    this.configManager = configManager ?? getConfigManager();
    this.contextManager = contextManager ?? getPrinterContextManager();

    // Initialize config
    this.currentConfig = this.extractDiscordConfig();
    this.handleConfigUpdatedBound = () => {
      this.handleConfigUpdate();
    };
    this.handleContextRemovedBound = (event: ContextRemovedEvent) => {
      this.unregisterContext(event.contextId);
    };
  }

  // ============================================================================
  // INITIALIZATION AND LIFECYCLE
  // ============================================================================

  /**
   * Initialize the Discord notification service
   * Sets up config listener and starts timers if enabled
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.log('[DiscordNotificationService] Already initialized');
      return;
    }

    // Listen for config changes
    this.configManager.on('configUpdated', this.handleConfigUpdatedBound);
    this.contextManager.on('context-removed', this.handleContextRemovedBound);

    // Start timers if Discord sync is enabled
    this.reconcilePeriodicTimer({ sendImmediateUpdate: true });

    this.isInitialized = true;
    console.log('[DiscordNotificationService] Initialized');
  }

  /**
   * Register a printer context for Discord notifications
   * Reconciles the shared periodic timer when contexts change
   */
  public registerContext(contextId: string): void {
    console.log(`[DiscordNotificationService] Registering context ${contextId}`);

    if (this.lastPrinterState.has(contextId)) {
      console.log(`[DiscordNotificationService] Context ${contextId} already registered`);
      return;
    }

    // Initialize state tracking
    this.lastPrinterState.set(contextId, 'unknown');

    this.reconcilePeriodicTimer();
  }

  /**
   * Unregister a printer context
   * Cleans up state and stops the shared timer when no contexts remain
   */
  public unregisterContext(contextId: string): void {
    console.log(`[DiscordNotificationService] Unregistering context ${contextId}`);

    this.detachContextMonitors(contextId);
    this.lastPrinterState.delete(contextId);
    this.cachedStatuses.delete(contextId);
    this.reconcilePeriodicTimer();
  }

  /**
   * Attach event-driven monitor listeners for a context
   */
  public attachContextMonitors(
    contextId: string,
    stateMonitor: PrintStateMonitor,
    temperatureMonitor?: TemperatureMonitoringService
  ): void {
    this.detachContextMonitors(contextId);

    const printCompletedListener = (event: { contextId: string; jobName: string; status: PrinterStatus }): void => {
      const duration = event.status.currentJob?.progress.elapsedTimeSeconds;
      void this.notifyPrintComplete(event.contextId, event.jobName, duration);
    };

    stateMonitor.on('print-completed', printCompletedListener);

    let printerCooledListener: ((event: { contextId: string }) => void) | undefined;
    if (temperatureMonitor) {
      printerCooledListener = (event: { contextId: string }): void => {
        void this.notifyPrinterCooled(event.contextId);
      };
      temperatureMonitor.on('printer-cooled', printerCooledListener);
    }

    this.monitorListeners.set(contextId, {
      stateMonitor,
      printCompletedListener,
      temperatureMonitor,
      printerCooledListener,
    });
  }

  /**
   * Dispose of service and clean up all resources
   */
  public dispose(): void {
    console.log('[DiscordNotificationService] Disposing...');

    this.stopPeriodicTimer();

    // Clear state
    for (const contextId of this.monitorListeners.keys()) {
      this.detachContextMonitors(contextId);
    }
    this.lastPrinterState.clear();
    this.cachedStatuses.clear();
    this.shouldRunPeriodicUpdateAgain = false;
    this.isPeriodicUpdateInProgress = false;

    // Remove listeners
    this.configManager.off('configUpdated', this.handleConfigUpdatedBound);
    this.contextManager.off('context-removed', this.handleContextRemovedBound);
    this.removeAllListeners();

    this.isInitialized = false;
    console.log('[DiscordNotificationService] Disposed');
  }

  // ============================================================================
  // CONFIGURATION MANAGEMENT
  // ============================================================================

  /**
   * Extract Discord-specific config from AppConfig
   */
  private extractDiscordConfig(): DiscordServiceConfig {
    const config = this.configManager.getConfig();

    return {
      enabled: config.DiscordSync,
      includeCameraSnapshots: config.DiscordIncludeCameraSnapshots,
      webhookUrl: config.WebhookUrl,
      updateIntervalMinutes: config.DiscordUpdateIntervalMinutes,
    };
  }

  /**
   * Handle config update
   * Detects Discord setting changes and restarts timers if needed
   */
  private handleConfigUpdate(): void {
    const newConfig = this.extractDiscordConfig();

    // Check if Discord-specific settings changed
    const configChanged =
      this.currentConfig.enabled !== newConfig.enabled ||
      this.currentConfig.includeCameraSnapshots !== newConfig.includeCameraSnapshots ||
      this.currentConfig.webhookUrl !== newConfig.webhookUrl ||
      this.currentConfig.updateIntervalMinutes !== newConfig.updateIntervalMinutes;

    if (!configChanged) {
      return;
    }

    console.log('[DiscordNotificationService] Config changed, restarting timers');

    // Update config
    this.currentConfig = newConfig;

    this.reconcilePeriodicTimer({ sendImmediateUpdate: true });
  }

  // ============================================================================
  // TIMER MANAGEMENT
  // ============================================================================

  /**
   * Start update timer for a specific context
   */
  private reconcilePeriodicTimer(options?: { sendImmediateUpdate?: boolean }): void {
    const shouldRunTimer = this.shouldRunPeriodicTimer();
    if (!shouldRunTimer) {
      this.stopPeriodicTimer();
      return;
    }

    const intervalMs = this.currentConfig.updateIntervalMinutes * 60 * 1000;
    const timerNeedsRestart = this.periodicUpdateTimer === null || this.periodicUpdateIntervalMs !== intervalMs;
    if (!timerNeedsRestart) {
      if (options?.sendImmediateUpdate) {
        void this.runPeriodicStatusUpdates();
      }
      return;
    }

    this.stopPeriodicTimer();
    this.startPeriodicTimer(intervalMs, options?.sendImmediateUpdate === true);
  }

  /**
   * Determine whether the periodic timer should be running
   */
  private shouldRunPeriodicTimer(): boolean {
    return this.currentConfig.enabled && Boolean(this.currentConfig.webhookUrl) && this.lastPrinterState.size > 0;
  }

  /**
   * Start the single periodic update timer
   */
  private startPeriodicTimer(intervalMs: number, sendImmediateUpdate: boolean): void {
    if (sendImmediateUpdate) {
      void this.runPeriodicStatusUpdates();
    }

    this.periodicUpdateTimer = setInterval(() => {
      void this.runPeriodicStatusUpdates();
    }, intervalMs);
    this.periodicUpdateIntervalMs = intervalMs;

    console.log(
      `[DiscordNotificationService] Started global timer (${this.currentConfig.updateIntervalMinutes} min interval)`
    );
  }

  /**
   * Stop the single periodic update timer
   */
  private stopPeriodicTimer(): void {
    if (this.periodicUpdateTimer) {
      clearInterval(this.periodicUpdateTimer);
      this.periodicUpdateTimer = null;
      this.periodicUpdateIntervalMs = null;
      console.log('[DiscordNotificationService] Stopped global timer');
    }
  }

  /**
   * Run periodic status updates without overlapping executions
   */
  private async runPeriodicStatusUpdates(): Promise<void> {
    if (this.isPeriodicUpdateInProgress) {
      this.shouldRunPeriodicUpdateAgain = true;
      return;
    }

    this.isPeriodicUpdateInProgress = true;

    try {
      do {
        this.shouldRunPeriodicUpdateAgain = false;
        await this.sendStatusUpdatesForAllContexts();
      } while (this.shouldRunPeriodicUpdateAgain && this.shouldRunPeriodicTimer());
    } finally {
      this.isPeriodicUpdateInProgress = false;
    }
  }

  /**
   * Remove monitor listeners for a specific context
   */
  private detachContextMonitors(contextId: string): void {
    const listeners = this.monitorListeners.get(contextId);
    if (!listeners) {
      return;
    }

    listeners.stateMonitor.off('print-completed', listeners.printCompletedListener);
    if (listeners.temperatureMonitor && listeners.printerCooledListener) {
      listeners.temperatureMonitor.off('printer-cooled', listeners.printerCooledListener);
    }

    this.monitorListeners.delete(contextId);
  }

  // ============================================================================
  // STATUS UPDATE HANDLING
  // ============================================================================

  /**
   * Update cached printer status for a context
   * Called by polling service or state monitors
   */
  public updatePrinterStatus(contextId: string, status: PrinterStatus): void {
    this.cachedStatuses.set(contextId, status);

    // Check for state transitions
    this.checkStateTransition(contextId, status);
  }

  /**
   * Send the latest cached status for a context immediately.
   * Used by hardware E2E coverage to exercise the real webhook path without waiting for the timer.
   */
  public async sendCurrentStatusNow(contextId: string): Promise<void> {
    this.assertWebhookEnabled();

    const context = this.contextManager.getContext(contextId);
    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }

    const status = this.cachedStatuses.get(contextId);
    if (!status) {
      throw new Error(`No cached printer status available for context: ${contextId}`);
    }

    await this.sendStatusNotification(contextId, status, context);
    this.emit('notification-sent', { contextId, type: 'manual-status' });
  }

  /**
   * Send a print-complete notification immediately and surface failures to the caller.
   * Used by hardware E2E coverage to verify event-driven payloads without manipulating the printer.
   */
  public async sendPrintCompleteNow(
    contextId: string,
    fileName: string,
    durationSeconds?: number
  ): Promise<void> {
    this.assertWebhookEnabled();
    await this.sendPrintCompleteNotification(contextId, fileName, durationSeconds);
    this.emit('notification-sent', { contextId, type: 'print-complete' });
  }

  /**
   * Check for state transitions and send event-driven notifications
   */
  private checkStateTransition(contextId: string, status: PrinterStatus): void {
    const currentState = this.mapPrinterState(status.state);
    const previousState = this.lastPrinterState.get(contextId) ?? 'unknown';

    // Detect transition to idle
    if (previousState !== 'idle' && currentState === 'idle' && previousState !== 'unknown') {
      console.log(`[DiscordNotificationService] Detected idle transition for context ${contextId}`);
      void this.sendIdleNotification(contextId, status);
    }

    // Update state tracking
    this.lastPrinterState.set(contextId, currentState);
  }

  /**
   * Map PrinterState to simplified Discord state
   */
  private mapPrinterState(state: PrinterState): DiscordPrinterState {
    switch (state) {
      case 'Ready':
        return 'idle';
      case 'Printing':
        return 'printing';
      case 'Paused':
        return 'paused';
      default:
        return 'unknown';
    }
  }

  /**
   * Send status updates for all connected contexts
   * Sends sequentially with rate limit delay
   */
  private async sendStatusUpdatesForAllContexts(): Promise<void> {
    if (!this.currentConfig.enabled || !this.currentConfig.webhookUrl) {
      return;
    }

    const contexts = this.contextManager.getAllContexts();
    const connectedContexts = contexts.filter(
      (ctx) => ctx.connectionState === 'connected' && this.cachedStatuses.has(ctx.id)
    );

    console.log(`[DiscordNotificationService] Sending updates for ${connectedContexts.length} contexts`);

    // Send updates sequentially with delay
    for (let i = 0; i < connectedContexts.length; i++) {
      const context = connectedContexts[i];
      const status = this.cachedStatuses.get(context.id);

      if (status) {
        const currentState = this.mapPrinterState(status.state);

        // Skip idle printers on timer updates
        if (currentState === 'idle') {
          console.log(`[DiscordNotificationService] Skipping idle printer on timer update: ${context.id}`);
          continue;
        }

        await this.sendStatusUpdate(context.id, status, context);

        // Add delay between messages (except after last)
        if (i < connectedContexts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, this.RATE_LIMIT_DELAY_MS));
        }
      }
    }
  }

  /**
   * Send status update for a single context
   */
  private async sendStatusUpdate(contextId: string, status: PrinterStatus, context?: PrinterContext): Promise<void> {
    try {
      // Get context if not provided
      if (!context) {
        context = this.contextManager.getContext(contextId);
        if (!context) {
          console.warn(`[DiscordNotificationService] Context not found: ${contextId}`);
          return;
        }
      }

      await this.sendStatusNotification(contextId, status, context);

      console.log(`[DiscordNotificationService] Sent status update for ${contextId}`);
      this.emit('notification-sent', { contextId, type: 'status' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DiscordNotificationService] Failed to send status update: ${errorMessage}`);
      this.emit('notification-failed', { contextId, error: errorMessage });
    }
  }

  /**
   * Send idle transition notification
   */
  private async sendIdleNotification(contextId: string, status: PrinterStatus): Promise<void> {
    if (!this.currentConfig.enabled || !this.currentConfig.webhookUrl) {
      return;
    }

    try {
      const context = this.contextManager.getContext(contextId);
      if (!context) {
        return;
      }

      const embed = this.createStatusEmbed(status, context);
      const payload: DiscordWebhookPayload = {
        embeds: [embed],
      };

      await this.sendWebhook({ payload, contextId });

      console.log(`[DiscordNotificationService] Sent idle transition notification for ${contextId}`);
      this.emit('notification-sent', { contextId, type: 'idle-transition' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DiscordNotificationService] Failed to send idle notification: ${errorMessage}`);
    }
  }

  // ============================================================================
  // EVENT-DRIVEN NOTIFICATIONS
  // ============================================================================

  /**
   * Send print complete notification
   * Called by external systems on print completion
   */
  public async notifyPrintComplete(contextId: string, fileName: string, durationSeconds?: number): Promise<void> {
    if (!this.currentConfig.enabled || !this.currentConfig.webhookUrl) {
      return;
    }

    try {
      await this.sendPrintCompleteNotification(contextId, fileName, durationSeconds);

      console.log(`[DiscordNotificationService] Sent print complete notification for ${contextId}`);
      this.emit('notification-sent', { contextId, type: 'print-complete' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DiscordNotificationService] Failed to send print complete notification: ${errorMessage}`);
    }
  }

  /**
   * Send printer cooled notification
   * Called by external systems when printer has cooled down
   */
  public async notifyPrinterCooled(contextId: string): Promise<void> {
    if (!this.currentConfig.enabled || !this.currentConfig.webhookUrl) {
      return;
    }

    try {
      const embed: DiscordEmbed = {
        title: '❄️ Printer Cooled Down',
        color: 0x3498db, // Blue
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: 'Status',
            value: 'The printer has cooled down and is ready for the next print.',
            inline: false,
          },
        ],
      };

      const payload: DiscordWebhookPayload = {
        embeds: [embed],
      };

      await this.sendWebhook({ payload, contextId });

      console.log(`[DiscordNotificationService] Sent printer cooled notification for ${contextId}`);
      this.emit('notification-sent', { contextId, type: 'printer-cooled' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DiscordNotificationService] Failed to send printer cooled notification: ${errorMessage}`);
    }
  }

  // ============================================================================
  // EMBED CREATION (1:1 MATCH WITH ORIGINAL)
  // ============================================================================

  /**
   * Create Discord embed from printer status
   * Matches original JavaScript implementation exactly
   */
  private createStatusEmbed(status: PrinterStatus, context: PrinterContext): DiscordEmbed {
    const embed: DiscordEmbed = {
      title: `🖨️ ${context.name || 'FlashForge Printer'}`,
      color: this.getStatusColor(status.state),
      timestamp: new Date().toISOString(),
      fields: [],
    };

    const fields: DiscordEmbedField[] = [];

    // Add machine status
    fields.push({
      name: 'Status',
      value: this.formatMachineStatus(status.state),
      inline: true,
    });

    // Add extruder temperature
    if (status.temperatures?.extruder) {
      fields.push({
        name: 'Extruder Temp',
        value: `${this.roundTemperature(status.temperatures.extruder.current)}°C / ${this.roundTemperature(status.temperatures.extruder.target)}°C`,
        inline: true,
      });
    }

    // Add bed temperature
    if (status.temperatures?.bed) {
      fields.push({
        name: 'Bed Temp',
        value: `${this.roundTemperature(status.temperatures.bed.current)}°C / ${this.roundTemperature(status.temperatures.bed.target)}°C`,
        inline: true,
      });
    }

    // Add print info if printing
    if (status.currentJob) {
      const progress = status.currentJob.progress.percentage / 100; // Convert to 0-1 range
      const progressBar = this.createProgressBar(progress);

      fields.push({
        name: 'Progress',
        value: `${progressBar} ${Math.round(progress * 100)}%`,
        inline: false,
      });

      // Print time (elapsed) — use elapsedTimeSeconds (seconds) for formatDuration
      if (status.currentJob.progress.elapsedTimeSeconds !== undefined) {
        fields.push({
          name: 'Print Time',
          value: this.formatDuration(status.currentJob.progress.elapsedTimeSeconds),
          inline: true,
        });
      }

      // ETA — prefer formattedEta (firmware), fall back to timeRemaining (minutes)
      {
        const { formattedEta, timeRemaining } = status.currentJob.progress;
        let etaDate: Date | null = null;
        if (formattedEta && formattedEta !== '--:--') {
          const [h, m] = formattedEta.split(':').map(Number);
          etaDate = new Date(Date.now() + (h * 60 + m) * 60_000);
        } else if (timeRemaining != null) {
          etaDate = new Date(Date.now() + timeRemaining * 60_000); // timeRemaining is minutes
        }
        if (etaDate) {
          const formattedETA = etaDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          fields.push({
            name: 'ETA',
            value: formattedETA,
            inline: true,
          });
        }
      }

      // Layer info
      if (
        status.currentJob.progress.currentLayer !== undefined &&
        status.currentJob.progress.totalLayers !== undefined
      ) {
        fields.push({
          name: 'Layer',
          value: `${status.currentJob.progress.currentLayer} / ${status.currentJob.progress.totalLayers}`,
          inline: true,
        });
      }

      // File name
      if (status.currentJob.fileName) {
        fields.push({
          name: 'File',
          value: status.currentJob.fileName,
          inline: false,
        });
      }
    }

    return {
      ...embed,
      fields,
    };
  }

  /**
   * Get status color based on machine state
   * Matches original implementation
   */
  private getStatusColor(state: PrinterState): number {
    switch (state) {
      case 'Printing':
        return 0x00ff00; // Green for printing
      case 'Ready':
        return 0x3498db; // Blue for ready
      case 'Paused':
        return 0xf39c12; // Orange for paused
      default:
        return 0x95a5a6; // Gray for other states
    }
  }

  /**
   * Format machine status for display
   * Matches original implementation
   */
  private formatMachineStatus(state: PrinterState): string {
    const statusMap: Record<string, string> = {
      Ready: '✅ Ready',
      Printing: '🖨️ Printing',
      Paused: '⏸️ Paused',
      Completed: '✅ Completed',
      Error: '❌ Error',
      Busy: '⏳ Busy',
      Calibrating: '🔧 Calibrating',
      Heating: '🔥 Heating',
      Pausing: '⏸️ Pausing',
      Cancelled: '🚫 Cancelled',
    };

    return statusMap[state] || state;
  }

  /**
   * Create progress bar
   * Matches original implementation exactly
   */
  private createProgressBar(progress: number): string {
    // progress is a decimal (0-1)
    const percentage = progress * 100;
    const filled = Math.floor(percentage / 10);
    const empty = 10 - filled;

    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Format duration from seconds
   * Matches original implementation
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${hours}h ${minutes}m`;
  }

  /**
   * Round temperature to 2 decimal places
   * Matches original implementation
   */
  private roundTemperature(temp: number): string {
    if (typeof temp !== 'number' || isNaN(temp)) {
      return '0.00';
    }
    return temp.toFixed(2);
  }

  // ============================================================================
  // WEBHOOK COMMUNICATION
  // ============================================================================

  /**
   * Send webhook payload to Discord
   * Uses native fetch API with timeout
   */
  private async sendWebhook(request: DiscordWebhookRequest): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const snapshot = await this.resolveSnapshotAttachment(request.contextId);
      const response = await fetch(
        this.currentConfig.webhookUrl,
        snapshot
          ? {
              method: 'POST',
              body: this.createMultipartBody(request.payload, snapshot),
              signal: controller.signal,
            }
          : {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(request.payload),
              signal: controller.signal,
            }
      );

      if (!response.ok) {
        throw new Error(`Discord webhook returned ${response.status}: ${response.statusText}`);
      }

      console.log('[DiscordNotificationService] Webhook sent successfully');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async resolveSnapshotAttachment(
    contextId?: string
  ): Promise<{ bytes: Uint8Array; contentType: string; filename: string } | null> {
    if (!this.currentConfig.includeCameraSnapshots || !contextId) {
      return null;
    }

    return this.getSnapshotService().captureSnapshot(contextId);
  }

  private createMultipartBody(
    payload: DiscordWebhookPayload,
    snapshot: { bytes: Uint8Array; contentType: string; filename: string }
  ): FormData {
    const formData = new FormData();
    const payloadWithImage: DiscordWebhookPayload = {
      embeds: payload.embeds.map((embed, index) =>
        index === 0
          ? {
              ...embed,
              image: {
                url: `attachment://${snapshot.filename}`,
              },
            }
          : embed
      ),
    };

    formData.append('payload_json', JSON.stringify(payloadWithImage));
    formData.append('files[0]', new Blob([snapshot.bytes], { type: snapshot.contentType }), snapshot.filename);

    return formData;
  }

  private getSnapshotService(): Pick<ReturnType<typeof getGo2rtcService>, 'captureSnapshot'> {
    if (!this.go2rtcService) {
      this.go2rtcService = getGo2rtcService();
    }

    return this.go2rtcService;
  }

  private assertWebhookEnabled(): void {
    if (!this.currentConfig.enabled || !this.currentConfig.webhookUrl) {
      throw new Error('Discord webhook notifications are disabled');
    }
  }

  private async sendStatusNotification(
    contextId: string,
    status: PrinterStatus,
    context: PrinterContext
  ): Promise<void> {
    const embed = this.createStatusEmbed(status, context);
    const payload: DiscordWebhookPayload = {
      embeds: [embed],
    };

    await this.sendWebhook({ payload, contextId });
  }

  private async sendPrintCompleteNotification(
    contextId: string,
    fileName: string,
    durationSeconds?: number
  ): Promise<void> {
    const embed: DiscordEmbed = {
      title: '\u2705 Print Complete!',
      color: 0x00ff00,
      timestamp: new Date().toISOString(),
      fields: [
        {
          name: 'File',
          value: fileName,
          inline: false,
        },
        {
          name: 'Total Time',
          value: durationSeconds ? this.formatDuration(durationSeconds) : 'Unknown',
          inline: true,
        },
      ],
    };

    await this.sendWebhook({
      payload: {
        embeds: [embed],
      },
      contextId,
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global Discord notification service instance
 */
let globalDiscordNotificationService: DiscordNotificationService | null = null;

/**
 * Get global Discord notification service instance
 */
export function getDiscordNotificationService(): DiscordNotificationService {
  if (!globalDiscordNotificationService) {
    globalDiscordNotificationService = new DiscordNotificationService();
  }
  return globalDiscordNotificationService;
}

/**
 * Reset global Discord notification service (for testing)
 */
export function resetDiscordNotificationService(): void {
  if (globalDiscordNotificationService) {
    globalDiscordNotificationService.dispose();
    globalDiscordNotificationService = null;
  }
}
