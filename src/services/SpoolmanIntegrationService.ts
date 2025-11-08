/**
 * @fileoverview Spoolman integration service with persistence and AD5X protection
 *
 * Manages active spool selections across printer contexts with per-printer persistence,
 * AD5X printer detection/blocking, and event broadcasting for desktop/WebUI synchronization.
 * This service acts as the single source of truth for active spool data.
 *
 * Key Features:
 * - Persistent storage of active spool selections per printer in printer_details.json
 * - AD5X printer detection and automatic disablement
 * - Event-driven updates for real-time synchronization
 * - Integration with SpoolmanService for spool search and details
 * - Spoolman configuration validation and connection testing
 *
 * AD5X Detection Logic:
 * - Material station feature flag (materialStation.available === true), OR
 * - Printer model string starts with "AD5"
 *
 * @module services/SpoolmanIntegrationService
 */

import { EventEmitter } from 'events';
import type { ConfigManager } from '../managers/ConfigManager';
import type { PrinterContextManager } from '../managers/PrinterContextManager';
import type { PrinterBackendManager } from '../managers/PrinterBackendManager';
import { getPrinterDetailsManager } from '../managers/PrinterDetailsManager';
import { SpoolmanService } from './SpoolmanService';
import type { ActiveSpoolData, SpoolResponse, SpoolSearchQuery } from '../types/spoolman';
import { toAppError } from '../utils/error.utils';

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

  constructor(
    configManager: ConfigManager,
    contextManager: PrinterContextManager,
    backendManager: PrinterBackendManager
  ) {
    super();
    this.configManager = configManager;
    this.contextManager = contextManager;
    this.backendManager = backendManager;
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
   * Returns false for AD5X printers (material station or model name)
   *
   * @param contextId - Printer context ID to check
   * @returns true if context supports Spoolman, false if AD5X or unsupported
   */
  isContextSupported(contextId: string): boolean {
    try {
      // Check if context exists
      const context = this.contextManager.getContext(contextId);
      if (!context) {
        return false;
      }

      // Check for material station feature (AD5X indicator)
      const features = this.backendManager.getFeatures(contextId);
      if (features?.materialStation?.available === true) {
        return false; // AD5X with material station
      }

      // Check for AD5X model name
      const printerModel = context.printerDetails?.printerModel || '';
      if (printerModel.startsWith('AD5')) {
        return false; // AD5X model
      }

      return true;
    } catch (error) {
      console.error('[SpoolmanIntegrationService] Error checking context support:', toAppError(error).message);
      return false;
    }
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
      return 'Spoolman integration is not available for AD5X printers with material stations.';
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
    const printerDetailsManager = getPrinterDetailsManager();

    // Update printer details with new spool data
    const updatedSpoolData = {
      ...spoolData,
      lastUpdated: new Date().toISOString()
    };

    const updatedDetails = {
      ...context.printerDetails,
      activeSpoolData: updatedSpoolData
    };

    // Save to printer_details.json
    await printerDetailsManager.savePrinter(updatedDetails, targetContextId);

    // Update in-memory context
    this.contextManager.updatePrinterDetails(targetContextId, updatedDetails);

    // Emit change event
    this.emit('spoolman-changed', {
      contextId: targetContextId,
      spool: updatedSpoolData
    } as SpoolmanChangedEvent);
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
    const printerDetailsManager = getPrinterDetailsManager();

    // Update printer details with cleared spool data
    const updatedDetails = {
      ...context.printerDetails,
      activeSpoolData: null
    };

    // Save to printer_details.json
    await printerDetailsManager.savePrinter(updatedDetails, targetContextId);

    // Update in-memory context
    this.contextManager.updatePrinterDetails(targetContextId, updatedDetails);

    // Emit change event
    this.emit('spoolman-changed', {
      contextId: targetContextId,
      spool: null
    } as SpoolmanChangedEvent);
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
      lastUpdated: new Date().toISOString()
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
}

/**
 * Singleton instance
 */
let instance: SpoolmanIntegrationService | null = null;

/**
 * Initialize the Spoolman integration service singleton
 * Must be called before getSpoolmanIntegrationService()
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
  instance = new SpoolmanIntegrationService(configManager, contextManager, backendManager);
  return instance;
}

/**
 * Get the Spoolman integration service singleton
 * @throws Error if service not initialized
 */
export function getSpoolmanIntegrationService(): SpoolmanIntegrationService {
  if (!instance) {
    throw new Error('SpoolmanIntegrationService not initialized. Call initializeSpoolmanIntegrationService() first.');
  }
  return instance;
}
