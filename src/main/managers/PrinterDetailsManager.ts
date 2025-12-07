/**
 * @fileoverview Multi-printer details persistence manager for storing printer connection information.
 *
 * Provides comprehensive printer details storage and retrieval with multi-printer support:
 * - Multi-printer configuration persistence to printer_details.json
 * - Printer details validation and sanitization
 * - Last-used printer tracking (global and per-context)
 * - Per-printer settings storage (camera, LEDs, legacy mode)
 * - Runtime per-context last-used tracking
 * - Automatic migration of legacy single-printer configurations
 *
 * Key exports:
 * - PrinterDetailsManager class: Main persistence manager
 * - getPrinterDetailsManager(): Singleton accessor function
 *
 * Storage structure:
 * - Global last-used printer serial number
 * - Per-printer details keyed by serial number
 * - Per-printer custom settings (camera URLs, LED configuration)
 * - Runtime context-to-printer mapping (not persisted)
 *
 * The manager validates all printer details before persistence, ensuring required fields
 * (Name, IPAddress, SerialNumber, CheckCode, ClientType, printerModel) are present and
 * properly formatted. Supports backward compatibility with legacy single-printer storage.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import {
  PrinterDetails,
  StoredPrinterDetails,
  MultiPrinterConfig,
  ValidatedPrinterDetails
} from '@shared/types/printer.js';
import { detectPrinterModelType } from '../utils/PrinterUtils.js';
import { getPrinterContextManager } from './PrinterContextManager.js';

/**
 * Manager for multi-printer details persistence
 * Handles printer_details.json file operations with multi-printer support
 * Supports per-context last-used tracking
 */
export class PrinterDetailsManager {
  private readonly filePath: string;
  private currentConfig: MultiPrinterConfig;
  private readonly contextManager = getPrinterContextManager();

  // Per-context last-used tracking (not persisted, runtime only)
  private readonly contextLastUsed = new Map<string, string>(); // contextId -> serialNumber

  constructor() {
    // Store printer details in userData directory
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'printer_details.json');

    // Initialize with empty config
    this.currentConfig = {
      lastUsedPrinterSerial: null,
      printers: {}
    };

    this.loadPrinterConfig();
  }

  /**
   * Validate PrinterDetails structure
   * Ensures all required fields are present and properly formatted
   */
  private validatePrinterDetails(details: unknown): details is PrinterDetails {
    if (!details || typeof details !== 'object') {
      return false;
    }

    const detailsObj = details as Record<string, unknown>;
    const required = ['Name', 'IPAddress', 'SerialNumber', 'CheckCode', 'ClientType', 'printerModel'];
    const hasAllFields = required.every(field =>
      field in detailsObj && typeof detailsObj[field] === 'string' && (detailsObj[field] as string).length > 0
    );

    if (!hasAllFields) {
      return false;
    }

    // Validate ClientType is one of the expected values
    const clientType = detailsObj.ClientType as string;
    if (clientType !== 'legacy' && clientType !== 'new') {
      return false;
    }

    // Basic IP address format validation
    const ipAddress = detailsObj.IPAddress as string;
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ipAddress)) {
      return false;
    }

    // Validate optional per-printer settings fields if present
    if ('customCameraEnabled' in detailsObj && typeof detailsObj.customCameraEnabled !== 'boolean') {
      return false;
    }
    if ('customCameraUrl' in detailsObj && typeof detailsObj.customCameraUrl !== 'string') {
      return false;
    }
    if ('customLedsEnabled' in detailsObj && typeof detailsObj.customLedsEnabled !== 'boolean') {
      return false;
    }
    if ('forceLegacyMode' in detailsObj && typeof detailsObj.forceLegacyMode !== 'boolean') {
      return false;
    }
    if ('webUIEnabled' in detailsObj && typeof detailsObj.webUIEnabled !== 'boolean') {
      return false;
    }
    if ('activeSpoolData' in detailsObj) {
      // activeSpoolData can be null or an object with specific shape
      if (detailsObj.activeSpoolData !== null && typeof detailsObj.activeSpoolData !== 'object') {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate MultiPrinterConfig structure
   */
  private validateMultiPrinterConfig(config: unknown): config is MultiPrinterConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const configObj = config as Record<string, unknown>;
    
    // Check top-level structure
    if (!('lastUsedPrinterSerial' in configObj) || !('printers' in configObj)) {
      return false;
    }

    const { lastUsedPrinterSerial, printers } = configObj;
    
    // Validate lastUsedPrinterSerial
    if (lastUsedPrinterSerial !== null && typeof lastUsedPrinterSerial !== 'string') {
      return false;
    }

    // Validate printers object
    if (!printers || typeof printers !== 'object') {
      return false;
    }

    const printersObj = printers as Record<string, unknown>;
    
    // Validate each printer entry
    for (const [serialNumber, printerData] of Object.entries(printersObj)) {
      if (!serialNumber || typeof serialNumber !== 'string') {
        return false;
      }

      if (!this.validateStoredPrinterDetails(printerData)) {
        return false;
      }
    }

    // Validate lastUsedPrinterSerial exists in printers if not null
    if (lastUsedPrinterSerial && !(lastUsedPrinterSerial in printersObj)) {
      return false;
    }

    return true;
  }

  /**
   * Validate StoredPrinterDetails structure
   */
  private validateStoredPrinterDetails(details: unknown): details is StoredPrinterDetails {
    if (!this.validatePrinterDetails(details)) {
      return false;
    }

    const detailsObj = details as unknown as Record<string, unknown>;
    
    // Check for lastConnected field
    if (!('lastConnected' in detailsObj) || typeof detailsObj.lastConnected !== 'string') {
      return false;
    }

    // Validate it's a valid ISO date string
    const date = new Date(detailsObj.lastConnected as string);
    if (isNaN(date.getTime())) {
      return false;
    }

    return true;
  }

  /**
   * Check if data is in old single-printer format
   */
  private isOldFormat(data: unknown): data is PrinterDetails {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const dataObj = data as Record<string, unknown>;
    
    // Old format has printer fields at top level, no 'printers' or 'lastUsedPrinterSerial'
    return 'Name' in dataObj && 
           'IPAddress' in dataObj && 
           'SerialNumber' in dataObj &&
           !('printers' in dataObj) &&
           !('lastUsedPrinterSerial' in dataObj);
  }

  /**
   * Migrate from old single-printer format to new multi-printer format
   */
  private migrateFromOldFormat(oldData: PrinterDetails): MultiPrinterConfig {
    console.log(`Migrating old printer format for: ${oldData.Name}`);
    
    // Ensure modelType is set if missing
    const modelType = oldData.modelType || detectPrinterModelType(oldData.printerModel);
    
    const storedDetails: StoredPrinterDetails = {
      ...oldData,
      modelType,
      lastConnected: new Date().toISOString()
    };

    const newConfig: MultiPrinterConfig = {
      lastUsedPrinterSerial: oldData.SerialNumber,
      printers: {
        [oldData.SerialNumber]: storedDetails
      }
    };

    console.log(`Migration complete: ${oldData.Name} -> ${oldData.SerialNumber}`);
    return newConfig;
  }

  /**
   * Load printer configuration from file
   */
  private loadPrinterConfig(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        console.log('No printer details file found - starting fresh');
        return;
      }

      const fileContent = fs.readFileSync(this.filePath, 'utf8');
      const parsedData: unknown = JSON.parse(fileContent);

      // Check if old format and migrate
      if (this.isOldFormat(parsedData)) {
        console.log('Detected old single-printer format - migrating to multi-printer format');
        this.currentConfig = this.migrateFromOldFormat(parsedData);
        
        // Save migrated config immediately
        this.saveConfigToFile()
          .then(() => {
            console.log('Successfully migrated and saved multi-printer configuration');
          })
          .catch(error => {
            console.warn('Failed to save migrated configuration:', error);
          });
        return;
      }

      // Validate new format
      if (this.validateMultiPrinterConfig(parsedData)) {
        this.currentConfig = parsedData;
        
        // Validate lastUsedPrinterSerial integrity
        if (this.currentConfig.lastUsedPrinterSerial && 
            !(this.currentConfig.lastUsedPrinterSerial in this.currentConfig.printers)) {
          console.warn('lastUsedPrinterSerial references non-existent printer - clearing');
          this.currentConfig = {
            ...this.currentConfig,
            lastUsedPrinterSerial: null
          };
        }
        
        const printerCount = Object.keys(this.currentConfig.printers).length;
        console.log(`Loaded multi-printer configuration with ${printerCount} saved printers`);
      } else {
        console.warn('Invalid printer configuration found - starting fresh');
        this.currentConfig = {
          lastUsedPrinterSerial: null,
          printers: {}
        };
        // Remove invalid file
        this.clearAllPrinters();
      }
    } catch (error) {
      console.error('Error loading printer configuration:', error);
      this.currentConfig = {
        lastUsedPrinterSerial: null,
        printers: {}
      };
      // Try to remove corrupted file
      this.clearAllPrinters();
    }
  }

  /**
   * Save configuration to file
   */
  private async saveConfigToFile(): Promise<void> {
    try {
      const json = JSON.stringify(this.currentConfig, null, 2);
      await fs.promises.writeFile(this.filePath, json, 'utf8');
      console.log('Saved printer configuration');
    } catch (error) {
      console.error('Error saving printer configuration:', error);
      throw error;
    }
  }

  /**
   * Convert PrinterDetails to StoredPrinterDetails with current timestamp
   */
  private toStoredPrinterDetails(details: PrinterDetails): StoredPrinterDetails {
    return {
      ...details,
      lastConnected: new Date().toISOString()
    };
  }

  // =============================================================================
  // PUBLIC API METHODS
  // =============================================================================

  /**
   * Get all saved printers
   */
  public getAllSavedPrinters(): StoredPrinterDetails[] {
    return Object.values(this.currentConfig.printers);
  }

  /**
   * Get a specific saved printer by serial number
   */
  public getSavedPrinter(serialNumber: string): StoredPrinterDetails | null {
    return this.currentConfig.printers[serialNumber] || null;
  }

  /**
   * Get the last used printer (context-aware)
   *
   * @param contextId - Optional context ID for context-specific tracking
   * @returns Last used printer details or null
   */
  public getLastUsedPrinter(contextId?: string): StoredPrinterDetails | null {
    // If contextId provided, use context-specific tracking
    if (contextId) {
      const serialNumber = this.contextLastUsed.get(contextId);
      if (serialNumber) {
        return this.getSavedPrinter(serialNumber);
      }
      return null;
    }

    // Otherwise use global last used (for backward compatibility)
    if (!this.currentConfig.lastUsedPrinterSerial) {
      return null;
    }
    return this.getSavedPrinter(this.currentConfig.lastUsedPrinterSerial);
  }

  /**
   * Save a printer (add new or update existing)
   * Context-aware version
   *
   * @param details - Printer details to save
   * @param contextId - Optional context ID for context-specific last-used tracking
   */
  public async savePrinter(
    details: PrinterDetails,
    contextId?: string,
    options?: { updateLastUsed?: boolean }
  ): Promise<void> {
    console.log('[PrinterDetailsManager] savePrinter called with:', {
      details,
      contextId,
      hasCustomCamera: 'customCameraEnabled' in details,
      customCameraEnabled: details.customCameraEnabled,
      customCameraUrl: details.customCameraUrl
    });

    if (!this.validatePrinterDetails(details)) {
      console.error('[PrinterDetailsManager] Validation failed for printer details:', details);
      throw new Error('Invalid printer details provided');
    }

    const storedDetails = this.toStoredPrinterDetails(details);
    console.log('[PrinterDetailsManager] Stored details after conversion:', storedDetails);

    const shouldUpdateLastUsed = options?.updateLastUsed ?? true;

    this.currentConfig = {
      ...this.currentConfig,
      printers: {
        ...this.currentConfig.printers,
        [details.SerialNumber]: storedDetails
      },
      lastUsedPrinterSerial: shouldUpdateLastUsed
        ? details.SerialNumber
        : this.currentConfig.lastUsedPrinterSerial
    };

    console.log('[PrinterDetailsManager] Updated config in memory:', this.currentConfig.printers[details.SerialNumber]);

    // If contextId provided, track context-specific last used
    if (contextId) {
      this.contextLastUsed.set(contextId, details.SerialNumber);
      console.log(`Saved printer for context ${contextId}: ${details.Name} (${details.SerialNumber})`);
    } else {
      console.log(`Saved printer: ${details.Name} (${details.SerialNumber})`);
    }

    await this.saveConfigToFile();
    console.log('[PrinterDetailsManager] File saved successfully');
  }

  /**
   * Remove a printer by serial number
   */
  public async removePrinter(serialNumber: string): Promise<void> {
    if (!(serialNumber in this.currentConfig.printers)) {
      throw new Error(`Printer with serial ${serialNumber} not found`);
    }

    const { [serialNumber]: _removed, ...remainingPrinters } = this.currentConfig.printers;
    
    let newLastUsed = this.currentConfig.lastUsedPrinterSerial;
    if (newLastUsed === serialNumber) {
      // If we're removing the last used printer, clear the reference
      newLastUsed = null;
    }

    this.currentConfig = {
      lastUsedPrinterSerial: newLastUsed,
      printers: remainingPrinters
    };

    await this.saveConfigToFile();
    console.log(`Removed printer: ${serialNumber}`);
  }

  /**
   * Set the last used printer
   */
  public async setLastUsedPrinter(serialNumber: string): Promise<void> {
    if (!(serialNumber in this.currentConfig.printers)) {
      throw new Error(`Printer with serial ${serialNumber} not found`);
    }

    this.currentConfig = {
      ...this.currentConfig,
      lastUsedPrinterSerial: serialNumber
    };

    await this.saveConfigToFile();
    console.log(`Set last used printer: ${serialNumber}`);
  }

  /**
   * Clear the last used printer reference
   */
  public async clearLastUsedPrinter(): Promise<void> {
    this.currentConfig = {
      ...this.currentConfig,
      lastUsedPrinterSerial: null
    };

    await this.saveConfigToFile();
    console.log('Cleared last used printer reference');
  }

  /**
   * Check if any printers are saved
   */
  public hasPrinters(): boolean {
    return Object.keys(this.currentConfig.printers).length > 0;
  }

  /**
   * Get count of saved printers
   */
  public getPrinterCount(): number {
    return Object.keys(this.currentConfig.printers).length;
  }

  /**
   * Clear all saved printers
   */
  public clearAllPrinters(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
        console.log('Cleared printer details file');
      }
    } catch (error) {
      console.error('Error clearing printer details file:', error);
    }

    this.currentConfig = {
      lastUsedPrinterSerial: null,
      printers: {}
    };

    // Clear context-specific tracking
    this.contextLastUsed.clear();
  }

  /**
   * Clear context-specific last-used tracking
   *
   * @param contextId - Context ID to clear tracking for
   */
  public clearContextTracking(contextId: string): void {
    this.contextLastUsed.delete(contextId);
    console.log(`Cleared context tracking for ${contextId}`);
  }

  // =============================================================================
  // LEGACY API METHODS (for backward compatibility during transition)
  // =============================================================================

  /**
   * Get current printer details (backward compatibility)
   * Returns the last used printer or null
   */
  public getPrinterDetails(): PrinterDetails | null {
    const lastUsed = this.getLastUsedPrinter();
    if (!lastUsed) {
      return null;
    }

    // Convert StoredPrinterDetails back to PrinterDetails (remove lastConnected)
    const { lastConnected: _lastConnected, ...printerDetails } = lastUsed;
    return printerDetails;
  }

  /**
   * Save new printer details (backward compatibility)
   * Saves printer and sets as last used
   */
  public async saveNewPrinterDetails(details: PrinterDetails): Promise<void> {
    await this.savePrinter(details);
  }

  /**
   * Check if printer details exist (backward compatibility)
   */
  public hasPrinterDetails(): boolean {
    return this.getLastUsedPrinter() !== null;
  }

  /**
   * Clear stored printer details (backward compatibility)
   * Clears all printers
   */
  public clearPrinterDetails(): void {
    this.clearAllPrinters();
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Validate printer details without saving
   */
  public static isValidPrinterDetails(details: unknown): details is ValidatedPrinterDetails {
    if (!details || typeof details !== 'object') {
      return false;
    }

    const manager = new PrinterDetailsManager();
    return manager.validatePrinterDetails(details);
  }

  /**
   * Get file path for debugging
   */
  public getFilePath(): string {
    return this.filePath;
  }

  /**
   * Reload configuration from file
   */
  public reload(): void {
    this.loadPrinterConfig();
  }
}

// Export singleton instance
let printerDetailsManager: PrinterDetailsManager | null = null;

export const getPrinterDetailsManager = (): PrinterDetailsManager => {
  if (!printerDetailsManager) {
    printerDetailsManager = new PrinterDetailsManager();
  }
  return printerDetailsManager;
};

