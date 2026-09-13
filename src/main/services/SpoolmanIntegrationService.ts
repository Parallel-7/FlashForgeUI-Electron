/**
 * @fileoverview Spoolman integration service with persistence and station-aware gating
 *
 * Manages active spool selections across printer contexts with per-printer persistence,
 * station-aware context gating, and event broadcasting for desktop/WebUI synchronization.
 * This service acts as the single source of truth for active spool data and for the
 * material-station slot→spool assignments used by estimate-based tracking.
 *
 * Key Features:
 * - Persistent storage of active spool selections per printer in printer_details.json
 * - Station-aware gating: material-station contexts (Creator 5 series, AD5X with
 *   station) use the estimate-based tracking path (slot→spool assignments +
 *   upload-time estimates) instead of the single active-spool flow
 * - Slot→spool assignments persisted per printer serial in spoolman_slot_spools.json
 * - Event-driven updates for real-time synchronization
 * - Integration with SpoolmanService for spool search and details
 * - Spoolman configuration validation and connection testing
 *
 * Gating predicates:
 * - isContextSupported: context is known (assignment operations allowed)
 * - isStationContext: material station attached (estimate-based tracking path)
 * - isUsageTrackingEligible: single-spool deduction path (non-station contexts,
 *   including AD5X printers WITHOUT a station)
 */

import type { ConfigUpdateEvent } from '@shared/types/config.js';
import type { PrinterDetails } from '@shared/types/printer.js';
import type { ActiveSpoolData, SpoolResponse, SpoolSearchQuery } from '@shared/types/spoolman.js';
import { EventEmitter } from 'events';
import type { ConfigManager } from '../managers/ConfigManager.js';
import { getConfigManager } from '../managers/ConfigManager.js';
import type { PrinterBackendManager } from '../managers/PrinterBackendManager.js';
import { getPrinterBackendManager } from '../managers/PrinterBackendManager.js';
import type { PrinterContextManager } from '../managers/PrinterContextManager.js';
import { getPrinterContextManager } from '../managers/PrinterContextManager.js';
import { getPrinterDetailsManager } from '../managers/PrinterDetailsManager.js';
import { toAppError } from '../utils/error.utils.js';
import { getSlotSpoolStore } from './SlotSpoolStore.js';
import { resolveStationStoreKey } from './station-store-key.js';
import { SpoolmanService } from './SpoolmanService.js';

/**
 * Event payload for spool selection changes
 */
export interface SpoolmanChangedEvent {
  contextId: string;
  spool: ActiveSpoolData | null;
}

/**
 * Spoolman integration service
 * Emits: 'spoolman-changed' with SpoolmanChangedEvent
 */
export class SpoolmanIntegrationService extends EventEmitter {
  private readonly configManager: ConfigManager;
  private readonly contextManager: PrinterContextManager;
  private readonly backendManager: PrinterBackendManager;
  private readonly handleConfigUpdatedBound: (event: ConfigUpdateEvent) => void;

  constructor(
    configManager: ConfigManager,
    contextManager: PrinterContextManager,
    backendManager: PrinterBackendManager
  ) {
    super();
    this.configManager = configManager;
    this.contextManager = contextManager;
    this.backendManager = backendManager;

    this.handleConfigUpdatedBound = (event: ConfigUpdateEvent) => {
      this.handleConfigUpdated(event).catch((error) => {
        console.error('[SpoolmanIntegrationService] Failed to handle config update:', error);
      });
    };

    this.configManager.on('configUpdated', this.handleConfigUpdatedBound);
  }

  /**
   * Check if Spoolman integration is globally enabled
   */
  isGloballyEnabled(): boolean {
    const config = this.configManager.getConfig();
    return config.SpoolmanEnabled && Boolean(config.SpoolmanServerUrl);
  }

  /**
   * Get the configured Spoolman server URL
   */
  getServerUrl(): string {
    return this.configManager.getConfig().SpoolmanServerUrl;
  }

  /**
   * Get the configured update mode (length or weight)
   */
  getUpdateMode(): 'length' | 'weight' {
    return this.configManager.getConfig().SpoolmanUpdateMode;
  }

  /**
   * Check if a specific printer context supports Spoolman integration
   * (assignment operations: active-spool selection, slot→spool assignment).
   *
   * Station printers are SUPPORTED: they use the estimate-based tracking
   * path (slot→spool assignments + upload-time estimates) instead of the
   * single active-spool flow. Use {@link isUsageTrackingEligible} to gate
   * the single-spool deduction path and {@link isStationContext} to route
   * to the station tracker.
   *
   * @param contextId - Printer context ID to check
   * @returns true if the context is known and supports Spoolman
   */
  isContextSupported(contextId: string): boolean {
    try {
      // Check if context exists
      const context = this.contextManager.getContext(contextId);
      return Boolean(context);
    } catch (error) {
      console.error('[SpoolmanIntegrationService] Error checking context support:', toAppError(error).message);
      return false;
    }
  }

  /**
   * True when the context's printer has a material station attached
   * (Creator 5 series, AD5X with station). Station contexts use the
   * estimate-based deduction path.
   */
  isStationContext(contextId: string): boolean {
    try {
      return this.backendManager.isFeatureAvailable(contextId, 'material-station');
    } catch (error) {
      console.error('[SpoolmanIntegrationService] Error checking station context:', toAppError(error).message);
      return false;
    }
  }

  /**
   * True when the context may use the legacy progress-based single-spool
   * deduction path. Station contexts are excluded — they get the
   * estimate-based StationUsageTracker instead.
   */
  isUsageTrackingEligible(contextId: string): boolean {
    return this.isContextSupported(contextId) && !this.isStationContext(contextId);
  }

  /**
   * Assign (or, with null, clear) the Spoolman spool for one material
   * station slot. Station contexts pull each tool's filament from a slot,
   * so deduction resolves tool → slot → spool through this mapping.
   *
   * @param contextId - Printer context ID (station context)
   * @param slotId - 1-based material station slot
   * @param spoolId - Spoolman spool id, or null to clear
   */
  setSpoolForSlot(contextId: string, slotId: number, spoolId: number | null): void {
    getSlotSpoolStore().setSpoolForSlot(resolveStationStoreKey(contextId), slotId, spoolId);
    this.emit('spoolman-changed', { contextId });
  }

  /**
   * Spoolman spool assigned to a material station slot, or null.
   */
  getSpoolForSlot(contextId: string, slotId: number): number | null {
    return getSlotSpoolStore().getSpoolForSlot(resolveStationStoreKey(contextId), slotId);
  }

  /**
   * Full slot→spool assignment map for a station context.
   */
  getSlotSpoolMap(contextId: string): ReadonlyMap<number, number> {
    return getSlotSpoolStore().getSlotMap(resolveStationStoreKey(contextId));
  }

  /**
   * Get disabled reason for a context (if unsupported)
   *
   * @param contextId - Printer context ID
   * @returns Human-readable reason or null if supported
   */
  getDisabledReason(contextId: string): string | null {
    if (!this.isGloballyEnabled()) {
      return 'Spoolman integration is disabled. Enable it in Settings.';
    }

    if (!this.isContextSupported(contextId)) {
      return 'Spoolman integration is not available for this printer.';
    }

    return null;
  }

  /**
   * Get active spool for a context (or active context if not specified)
   *
   * @param contextId - Optional context ID (defaults to active context)
   * @returns Active spool data or null
   */
  getActiveSpool(contextId?: string): ActiveSpoolData | null {
    const targetContextId = contextId || this.contextManager.getActiveContextId();
    if (!targetContextId) {
      return null;
    }

    const context = this.contextManager.getContext(targetContextId);
    return context?.printerDetails?.activeSpoolData || null;
  }

  /**
   * Set active spool for a context
   * Persists to printer details and emits 'spoolman-changed' event
   *
   * @param contextId - Context ID to set spool for (defaults to active context)
   * @param spoolData - Spool data to set
   * @throws Error if context is unsupported (AD5X)
   */
  async setActiveSpool(contextId: string | undefined, spoolData: ActiveSpoolData): Promise<void> {
    const targetContextId = contextId || this.contextManager.getActiveContextId();
    if (!targetContextId) {
      throw new Error('No active printer context');
    }

    // Validate context support
    if (!this.isContextSupported(targetContextId)) {
      throw new Error('Spoolman integration is disabled for this printer (AD5X with material station)');
    }

    // Get context and current printer details
    const context = this.contextManager.getContext(targetContextId);
    if (!context) {
      throw new Error(`Context ${targetContextId} not found`);
    }

    // Get PrinterDetailsManager
    // Update printer details with new spool data
    const updatedSpoolData = {
      ...spoolData,
      lastUpdated: new Date().toISOString(),
    };

    await this.persistSpoolData(targetContextId, updatedSpoolData);
  }

  /**
   * Clear active spool for a context
   * Removes from printer details and emits 'spoolman-changed' event
   *
   * @param contextId - Context ID to clear spool for (defaults to active context)
   * @throws Error if context is unsupported (AD5X)
   */
  async clearActiveSpool(contextId?: string): Promise<void> {
    const targetContextId = contextId || this.contextManager.getActiveContextId();
    if (!targetContextId) {
      throw new Error('No active printer context');
    }

    // Validate context support (still block AD5X from clearing)
    if (!this.isContextSupported(targetContextId)) {
      throw new Error('Spoolman integration is disabled for this printer (AD5X with material station)');
    }

    // Get context and current printer details
    const context = this.contextManager.getContext(targetContextId);
    if (!context) {
      throw new Error(`Context ${targetContextId} not found`);
    }

    // Get PrinterDetailsManager
    await this.persistSpoolData(targetContextId, null);
  }

  /**
   * Search for spools using Spoolman API
   * Proxies to SpoolmanService with current server URL
   *
   * @param query - Search query parameters
   * @returns Array of matching spools
   * @throws Error if Spoolman is not enabled or request fails
   */
  async fetchSpools(query: SpoolSearchQuery): Promise<SpoolResponse[]> {
    if (!this.isGloballyEnabled()) {
      throw new Error('Spoolman integration is not enabled');
    }

    const serverUrl = this.getServerUrl();
    const service = new SpoolmanService(serverUrl);

    return await service.searchSpools(query);
  }

  /**
   * Get a single spool by ID and convert to ActiveSpoolData
   * Used when selecting a spool to fetch full details
   *
   * @param spoolId - Spoolman spool ID
   * @returns Active spool data ready for storage
   * @throws Error if Spoolman is not enabled or request fails
   */
  async getSpoolById(spoolId: number): Promise<ActiveSpoolData> {
    if (!this.isGloballyEnabled()) {
      throw new Error('Spoolman integration is not enabled');
    }

    const serverUrl = this.getServerUrl();
    const service = new SpoolmanService(serverUrl);

    // Get spool directly by ID using concrete endpoint
    const spool = await service.getSpoolById(spoolId);

    return this.convertToActiveSpoolData(spool);
  }

  /**
   * Convert SpoolResponse to ActiveSpoolData
   *
   * @param spool - Full spool response from Spoolman API
   * @returns Simplified active spool data for UI
   */
  convertToActiveSpoolData(spool: SpoolResponse): ActiveSpoolData {
    return {
      id: spool.id,
      name: spool.filament.name || `Spool #${spool.id}`,
      vendor: spool.filament.vendor?.name || null,
      material: spool.filament.material || null,
      colorHex: spool.filament.color_hex || '#808080', // Default gray
      remainingWeight: spool.remaining_weight || 0,
      remainingLength: spool.remaining_length || 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Test connection to Spoolman server
   *
   * @returns Connection test result
   */
  async testConnection(): Promise<{ connected: boolean; error?: string }> {
    if (!this.isGloballyEnabled()) {
      return { connected: false, error: 'Spoolman integration is not enabled' };
    }

    try {
      const serverUrl = this.getServerUrl();
      const service = new SpoolmanService(serverUrl);
      return await service.testConnection();
    } catch (error) {
      return { connected: false, error: toAppError(error).message };
    }
  }

  /**
   * Force clear active spool for a context regardless of support status
   */
  async forceClearActiveSpool(contextId: string): Promise<void> {
    try {
      await this.persistSpoolData(contextId, null, { updateLastUsed: false });
    } catch (error) {
      console.error(`[SpoolmanIntegrationService] Failed to force clear spool for ${contextId}:`, error);
    }
  }

  /**
   * Clear cached spool data for all contexts and saved printers
   */
  async clearAllCachedSpools(reason?: string): Promise<void> {
    if (reason) {
      console.log(`[SpoolmanIntegrationService] Clearing cached spools: ${reason}`);
    } else {
      console.log('[SpoolmanIntegrationService] Clearing cached spools');
    }

    const contexts = this.contextManager.getAllContexts();
    for (const context of contexts) {
      if (!context.printerDetails.activeSpoolData) {
        continue;
      }
      await this.forceClearActiveSpool(context.id);
    }

    await this.clearSavedPrintersSpoolData();
  }

  /**
   * Refresh active spool data for all contexts from the Spoolman server
   */
  async refreshAllActiveSpools(): Promise<void> {
    if (!this.isGloballyEnabled()) {
      return;
    }

    const contexts = this.contextManager.getAllContexts();
    for (const context of contexts) {
      if (!context.printerDetails.activeSpoolData) {
        continue;
      }

      try {
        await this.refreshActiveSpoolFromServer(context.id);
      } catch (error) {
        console.error(
          `[SpoolmanIntegrationService] Failed to refresh spool for ${context.id}:`,
          toAppError(error).message
        );
      }
    }
  }

  /**
   * Refresh a single context's active spool from Spoolman
   */
  async refreshActiveSpoolFromServer(contextId: string): Promise<void> {
    if (!this.isGloballyEnabled() || !this.isContextSupported(contextId)) {
      return;
    }

    const currentSpool = this.getActiveSpool(contextId);
    if (!currentSpool) {
      return;
    }

    const serverUrl = this.getServerUrl();
    const service = new SpoolmanService(serverUrl);
    const spool = await service.getSpoolById(currentSpool.id);
    const updatedSpool = this.convertToActiveSpoolData(spool);
    await this.persistSpoolData(contextId, updatedSpool, { updateLastUsed: false });
  }

  private async persistSpoolData(
    targetContextId: string,
    spoolData: ActiveSpoolData | null,
    options?: { updateLastUsed?: boolean }
  ): Promise<void> {
    const context = this.contextManager.getContext(targetContextId);
    if (!context) {
      throw new Error(`Context ${targetContextId} not found`);
    }

    const printerDetailsManager = getPrinterDetailsManager();
    const updatedDetails = {
      ...context.printerDetails,
      activeSpoolData: spoolData,
    };

    await printerDetailsManager.savePrinter(updatedDetails, targetContextId, options);
    this.contextManager.updatePrinterDetails(targetContextId, updatedDetails);

    this.emit('spoolman-changed', {
      contextId: targetContextId,
      spool: spoolData,
    } as SpoolmanChangedEvent);
  }

  private async clearSavedPrintersSpoolData(): Promise<void> {
    const printerDetailsManager = getPrinterDetailsManager();
    const savedPrinters = printerDetailsManager.getAllSavedPrinters();
    if (!savedPrinters.length) {
      return;
    }

    const previousLastUsed = printerDetailsManager.getLastUsedPrinter()?.SerialNumber ?? null;
    let updated = false;

    for (const printer of savedPrinters) {
      if (!printer.activeSpoolData) {
        continue;
      }

      const { lastConnected: _lastConnected, ...printerDetails } = printer;
      void _lastConnected;
      const updatedDetails: PrinterDetails = {
        ...printerDetails,
        activeSpoolData: null,
      };

      await printerDetailsManager.savePrinter(updatedDetails, undefined, { updateLastUsed: false });
      updated = true;
    }

    if (updated) {
      if (previousLastUsed) {
        await printerDetailsManager.setLastUsedPrinter(previousLastUsed);
      } else {
        await printerDetailsManager.clearLastUsedPrinter();
      }
    }
  }

  private async handleConfigUpdated(event: ConfigUpdateEvent): Promise<void> {
    if (event.changedKeys.includes('SpoolmanServerUrl')) {
      await this.clearAllCachedSpools('Server URL changed');
    }
  }

  /**
   * Dispose the service and release singleton event subscriptions.
   */
  public dispose(): void {
    this.configManager.off('configUpdated', this.handleConfigUpdatedBound);
    this.removeAllListeners();
  }
}

/**
 * Singleton instance
 */
let instance: SpoolmanIntegrationService | null = null;

/**
 * Initialize the Spoolman integration service singleton.
 * If not called explicitly, the service will auto-initialize on first access.
 * Can be called to reinitialize with specific dependency instances.
 *
 * @param configManager - Config manager instance
 * @param contextManager - Printer context manager instance
 * @param backendManager - Printer backend manager instance
 */
export function initializeSpoolmanIntegrationService(
  configManager: ConfigManager,
  contextManager: PrinterContextManager,
  backendManager: PrinterBackendManager
): SpoolmanIntegrationService {
  if (instance) {
    console.warn('[SpoolmanIntegrationService] Already initialized - returning existing instance');
    return instance;
  }
  instance = new SpoolmanIntegrationService(configManager, contextManager, backendManager);
  console.log('[SpoolmanIntegrationService] Initialized');
  return instance;
}

/**
 * Get the Spoolman integration service singleton.
 * Auto-initializes if not already initialized (lazy initialization pattern).
 * Follows the same pattern as other multi-context services in the codebase.
 */
export function getSpoolmanIntegrationService(): SpoolmanIntegrationService {
  if (!instance) {
    console.log('[SpoolmanIntegrationService] Auto-initializing on first access');
    instance = new SpoolmanIntegrationService(
      getConfigManager(),
      getPrinterContextManager(),
      getPrinterBackendManager()
    );
  }
  return instance;
}

/**
 * Dispose the Spoolman integration singleton.
 */
export function disposeSpoolmanIntegrationService(): void {
  if (!instance) {
    return;
  }

  instance.dispose();
  instance = null;
}
