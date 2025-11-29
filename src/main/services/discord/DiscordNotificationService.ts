/**
 * @fileoverview Discord webhook notification service for multi-printer status updates
 *
 * Provides Discord webhook integration with support for multiple printer contexts.
 * Sends rich embeds with printer status, temperatures, progress, and print information
 * to a configured Discord webhook URL. Supports both timer-based periodic updates
 * and event-driven immediate notifications.
 *
 * Key Features:
 * - Multi-context support: Independent timers and state tracking per printer
 * - Hybrid update mode: Timer-based intervals + event-driven state changes
 * - Rate limiting: Sequential message sending with configurable delays
 * - 1:1 embed structure: Matches original JavaScript implementation exactly
 * - Idle transition detection: Sends notification when transitioning to idle state
 * - Config-driven: Respects DiscordSync, WebhookUrl, and interval settings
 * - Error handling: Network failures don't crash the service
 *
 * Architecture:
 * - Per-context update timers (Map<contextId, timer>)
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

import { EventEmitter } from 'events';
import type { PrinterStatus, PrinterState } from '@shared/types/polling.js';
import type { DiscordEmbed, DiscordEmbedField, DiscordWebhookPayload, DiscordServiceConfig } from '@shared/types/discord.js';
import { getConfigManager, type ConfigManager } from '../../managers/ConfigManager.js';
import { getPrinterContextManager, type PrinterContextManager, type PrinterContext } from '../../managers/PrinterContextManager.js';

/**
 * Printer state for Discord notifications
 * Simplified from PrinterState enum for Discord logic
 */
type DiscordPrinterState = 'idle' | 'printing' | 'paused' | 'unknown';

/**
 * Discord notification service for multi-printer webhook updates
 */
export class DiscordNotificationService extends EventEmitter {
  private readonly configManager: ConfigManager;
  private readonly contextManager: PrinterContextManager;

  // Per-context state tracking
  private readonly updateTimers = new Map<string, NodeJS.Timeout>();
  private readonly lastPrinterState = new Map<string, DiscordPrinterState>();
  private readonly cachedStatuses = new Map<string, PrinterStatus>();

  // Rate limiting
  private readonly RATE_LIMIT_DELAY_MS = 1000; // 1 second between multi-printer messages

  // Service state
  private isInitialized = false;
  private currentConfig: DiscordServiceConfig;

  constructor(
    configManager?: ConfigManager,
    contextManager?: PrinterContextManager
  ) {
    super();

    this.configManager = configManager ?? getConfigManager();
    this.contextManager = contextManager ?? getPrinterContextManager();

    // Initialize config
    this.currentConfig = this.extractDiscordConfig();
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
    this.configManager.on('configUpdated', () => {
      this.handleConfigUpdate();
    });

    // Start timers if Discord sync is enabled
    if (this.currentConfig.enabled && this.currentConfig.webhookUrl) {
      this.startAllTimers();
    }

    this.isInitialized = true;
    console.log('[DiscordNotificationService] Initialized');
  }

  /**
   * Register a printer context for Discord notifications
   * Starts update timer for this context
   */
  public registerContext(contextId: string): void {
    console.log(`[DiscordNotificationService] Registering context ${contextId}`);

    // Initialize state tracking
    this.lastPrinterState.set(contextId, 'unknown');

    // Start timer if Discord sync enabled
    if (this.currentConfig.enabled && this.currentConfig.webhookUrl) {
      this.startTimerForContext(contextId);
    }
  }

  /**
   * Unregister a printer context
   * Stops timer and cleans up state
   */
  public unregisterContext(contextId: string): void {
    console.log(`[DiscordNotificationService] Unregistering context ${contextId}`);

    this.stopTimerForContext(contextId);
    this.lastPrinterState.delete(contextId);
    this.cachedStatuses.delete(contextId);
  }

  /**
   * Dispose of service and clean up all resources
   */
  public dispose(): void {
    console.log('[DiscordNotificationService] Disposing...');

    // Stop all timers
    for (const contextId of this.updateTimers.keys()) {
      this.stopTimerForContext(contextId);
    }

    // Clear state
    this.lastPrinterState.clear();
    this.cachedStatuses.clear();

    // Remove listeners
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
      webhookUrl: config.WebhookUrl,
      updateIntervalMinutes: config.DiscordUpdateIntervalMinutes
    };
  }

  /**
   * Handle config update
   * Detects Discord setting changes and restarts timers if needed
   */
  private handleConfigUpdate(): void {
    const newConfig = this.extractDiscordConfig();

    // Check if Discord-specific settings changed
    const configChanged = (
      this.currentConfig.enabled !== newConfig.enabled ||
      this.currentConfig.webhookUrl !== newConfig.webhookUrl ||
      this.currentConfig.updateIntervalMinutes !== newConfig.updateIntervalMinutes
    );

    if (!configChanged) {
      return;
    }

    console.log('[DiscordNotificationService] Config changed, restarting timers');

    // Stop all existing timers
    this.stopAllTimers();

    // Update config
    this.currentConfig = newConfig;

    // Restart timers if enabled
    if (newConfig.enabled && newConfig.webhookUrl) {
      this.startAllTimers();
    }
  }

  // ============================================================================
  // TIMER MANAGEMENT
  // ============================================================================

  /**
   * Start update timer for a specific context
   */
  private startTimerForContext(contextId: string): void {
    // Stop existing timer if any
    this.stopTimerForContext(contextId);

    const intervalMs = this.currentConfig.updateIntervalMinutes * 60 * 1000;

    // Create new timer
    const timer = setInterval(() => {
      void this.sendStatusUpdatesForAllContexts();
    }, intervalMs);

    this.updateTimers.set(contextId, timer);

    console.log(`[DiscordNotificationService] Started timer for context ${contextId} (${this.currentConfig.updateIntervalMinutes} min interval)`);
  }

  /**
   * Stop update timer for a specific context
   */
  private stopTimerForContext(contextId: string): void {
    const timer = this.updateTimers.get(contextId);

    if (timer) {
      clearInterval(timer);
      this.updateTimers.delete(contextId);
      console.log(`[DiscordNotificationService] Stopped timer for context ${contextId}`);
    }
  }

  /**
   * Start timers for all registered contexts
   */
  private startAllTimers(): void {
    const contexts = this.contextManager.getAllContexts();

    // Only need one global timer that fires for all contexts
    // We'll use a synthetic "global" timer key
    if (contexts.length > 0) {
      const intervalMs = this.currentConfig.updateIntervalMinutes * 60 * 1000;

      // Send initial update
      void this.sendStatusUpdatesForAllContexts();

      // Create recurring timer
      const timer = setInterval(() => {
        void this.sendStatusUpdatesForAllContexts();
      }, intervalMs);

      this.updateTimers.set('__global__', timer);

      console.log(`[DiscordNotificationService] Started global timer (${this.currentConfig.updateIntervalMinutes} min interval)`);
    }
  }

  /**
   * Stop all update timers
   */
  private stopAllTimers(): void {
    for (const [contextId, timer] of this.updateTimers) {
      clearInterval(timer);
      console.log(`[DiscordNotificationService] Stopped timer for ${contextId}`);
    }

    this.updateTimers.clear();
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
    const connectedContexts = contexts.filter(ctx =>
      ctx.connectionState === 'connected' && this.cachedStatuses.has(ctx.id)
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
          await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_DELAY_MS));
        }
      }
    }
  }

  /**
   * Send status update for a single context
   */
  private async sendStatusUpdate(
    contextId: string,
    status: PrinterStatus,
    context?: PrinterContext
  ): Promise<void> {
    try {
      // Get context if not provided
      if (!context) {
        context = this.contextManager.getContext(contextId);
        if (!context) {
          console.warn(`[DiscordNotificationService] Context not found: ${contextId}`);
          return;
        }
      }

      const embed = this.createStatusEmbed(status, context);
      const payload: DiscordWebhookPayload = {
        embeds: [embed]
      };

      await this.sendWebhook(payload);

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
    try {
      const context = this.contextManager.getContext(contextId);
      if (!context) {
        return;
      }

      const embed = this.createStatusEmbed(status, context);
      const payload: DiscordWebhookPayload = {
        embeds: [embed]
      };

      await this.sendWebhook(payload);

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
      const embed: DiscordEmbed = {
        title: '✅ Print Complete!',
        color: 0x00ff00, // Green
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: 'File',
            value: fileName,
            inline: false
          },
          {
            name: 'Total Time',
            value: durationSeconds ? this.formatDuration(durationSeconds) : 'Unknown',
            inline: true
          }
        ]
      };

      const payload: DiscordWebhookPayload = {
        embeds: [embed]
      };

      await this.sendWebhook(payload);

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
            inline: false
          }
        ]
      };

      const payload: DiscordWebhookPayload = {
        embeds: [embed]
      };

      await this.sendWebhook(payload);

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
      fields: []
    };

    const fields: DiscordEmbedField[] = [];

    // Add machine status
    fields.push({
      name: 'Status',
      value: this.formatMachineStatus(status.state),
      inline: true
    });

    // Add extruder temperature
    if (status.temperatures?.extruder) {
      fields.push({
        name: 'Extruder Temp',
        value: `${this.roundTemperature(status.temperatures.extruder.current)}°C / ${this.roundTemperature(status.temperatures.extruder.target)}°C`,
        inline: true
      });
    }

    // Add bed temperature
    if (status.temperatures?.bed) {
      fields.push({
        name: 'Bed Temp',
        value: `${this.roundTemperature(status.temperatures.bed.current)}°C / ${this.roundTemperature(status.temperatures.bed.target)}°C`,
        inline: true
      });
    }

    // Add print info if printing
    if (status.currentJob) {
      const progress = status.currentJob.progress.percentage / 100; // Convert to 0-1 range
      const progressBar = this.createProgressBar(progress);

      fields.push({
        name: 'Progress',
        value: `${progressBar} ${Math.round(progress * 100)}%`,
        inline: false
      });

      // Print time (elapsed)
      if (status.currentJob.progress.elapsedTime !== undefined) {
        fields.push({
          name: 'Print Time',
          value: this.formatDuration(status.currentJob.progress.elapsedTime),
          inline: true
        });
      }

      // ETA (estimated time remaining)
      if (status.currentJob.progress.timeRemaining !== undefined && status.currentJob.progress.timeRemaining !== null) {
        const etaDate = new Date(Date.now() + status.currentJob.progress.timeRemaining * 1000);
        const formattedETA = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        fields.push({
          name: 'ETA',
          value: formattedETA,
          inline: true
        });
      }

      // Layer info
      if (status.currentJob.progress.currentLayer !== undefined && status.currentJob.progress.totalLayers !== undefined) {
        fields.push({
          name: 'Layer',
          value: `${status.currentJob.progress.currentLayer} / ${status.currentJob.progress.totalLayers}`,
          inline: true
        });
      }

      // File name
      if (status.currentJob.fileName) {
        fields.push({
          name: 'File',
          value: status.currentJob.fileName,
          inline: false
        });
      }
    }

    return {
      ...embed,
      fields
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
      'Ready': '✅ Ready',
      'Printing': '🖨️ Printing',
      'Paused': '⏸️ Paused',
      'Completed': '✅ Completed',
      'Error': '❌ Error',
      'Busy': '⏳ Busy',
      'Calibrating': '🔧 Calibrating',
      'Heating': '🔥 Heating',
      'Pausing': '⏸️ Pausing',
      'Cancelled': '🚫 Cancelled'
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
  private async sendWebhook(payload: DiscordWebhookPayload): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(this.currentConfig.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Discord webhook returned ${response.status}: ${response.statusText}`);
      }

      console.log('[DiscordNotificationService] Webhook sent successfully');

    } finally {
      clearTimeout(timeoutId);
    }
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
