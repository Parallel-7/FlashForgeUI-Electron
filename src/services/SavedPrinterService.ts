/**
 * @fileoverview Service for managing saved printer configurations and discovery matching
 *
 * Manages persistent storage and retrieval of printer configurations, providing matching
 * logic to correlate saved printers with network-discovered devices. Handles printer
 * persistence, IP address change detection, last-used tracking, and UI data preparation.
 *
 * Key Features:
 * - Persistent printer configuration storage via PrinterDetailsManager integration
 * - Serial number-based matching between saved and discovered printers
 * - IP address change detection and automatic update support
 * - Last connected timestamp tracking for connection priority
 * - Event emission for configuration changes and updates
 * - UI-ready data transformation for saved printer display
 *
 * Singleton Pattern:
 * Uses singleton pattern to ensure consistent printer data access across the application.
 * Access via getSavedPrinterService() factory function.
 *
 * @module services/SavedPrinterService
 */

import { EventEmitter } from 'events';
import { getPrinterDetailsManager } from '../managers/PrinterDetailsManager';
import {
  PrinterDetails,
  StoredPrinterDetails,
  SavedPrinterMatch,
  DiscoveredPrinter
} from '../types/printer';

/**
 * Service responsible for managing saved printer configurations
 * Handles persistence and matching of saved printers with discovered devices
 */
export class SavedPrinterService extends EventEmitter {
  private static instance: SavedPrinterService | null = null;
  private readonly printerDetailsManager = getPrinterDetailsManager();

  private constructor() {
    super();
  }

  /**
   * Get singleton instance of SavedPrinterService
   */
  public static getInstance(): SavedPrinterService {
    if (!SavedPrinterService.instance) {
      SavedPrinterService.instance = new SavedPrinterService();
    }
    return SavedPrinterService.instance;
  }

  /**
   * Get all saved printers
   */
  public getSavedPrinters(): StoredPrinterDetails[] {
    return this.printerDetailsManager.getAllSavedPrinters();
  }

  /**
   * Get a specific saved printer by serial number
   */
  public getSavedPrinter(serialNumber: string): StoredPrinterDetails | null {
    return this.printerDetailsManager.getSavedPrinter(serialNumber);
  }

  /**
   * Get the count of saved printers
   */
  public getSavedPrinterCount(): number {
    return this.printerDetailsManager.getPrinterCount();
  }

  /**
   * Get the last used printer
   */
  public getLastUsedPrinter(): StoredPrinterDetails | null {
    return this.printerDetailsManager.getLastUsedPrinter();
  }

  /**
   * Save or update a printer configuration
   */
  public async savePrinter(printer: PrinterDetails): Promise<void> {
    await this.printerDetailsManager.savePrinter(printer);
    this.emit('printer-saved', printer);
  }

  /**
   * Remove a saved printer by serial number
   */
  public removePrinter(serialNumber: string): void {
    const printer = this.getSavedPrinter(serialNumber);
    if (printer) {
      // Note: PrinterDetailsManager doesn't have a remove method yet
      // This would need to be implemented
      this.emit('printer-removed', serialNumber);
    }
  }

  /**
   * Update the last connected timestamp for a printer
   */
  public async updateLastConnected(serialNumber: string): Promise<void> {
    await this.printerDetailsManager.setLastUsedPrinter(serialNumber);
    this.emit('last-connected-updated', serialNumber);
  }

  /**
   * Clear all saved printers
   */
  public clearAllPrinters(): void {
    this.printerDetailsManager.clearAllPrinters();
    this.emit('all-printers-cleared');
  }

  /**
   * Find matches between discovered printers and saved printers
   * Matches are based on serial number comparison
   */
  public findMatchingPrinters(discoveredPrinters: DiscoveredPrinter[]): SavedPrinterMatch[] {
    const savedPrinters = this.getSavedPrinters();
    const matches: SavedPrinterMatch[] = [];

    for (const savedPrinter of savedPrinters) {
      const discoveredMatch = discoveredPrinters.find(
        discovered => discovered.serialNumber === savedPrinter.SerialNumber
      );

      if (discoveredMatch) {
        matches.push({
          savedDetails: savedPrinter,
          discoveredPrinter: discoveredMatch,
          ipAddressChanged: savedPrinter.IPAddress !== discoveredMatch.ipAddress
        });
      }
    }

    return matches;
  }

  /**
   * Prepare saved printer data for UI display
   * Includes online/offline status and IP change detection
   */
  public prepareSavedPrinterData(matches: SavedPrinterMatch[]): Array<{
    name: string;
    ipAddress: string;
    serialNumber: string;
    lastConnected: string;
    isOnline: boolean;
    ipAddressChanged: boolean;
    currentIpAddress?: string;
  }> {
    const allSavedPrinters = this.getSavedPrinters();
    
    return allSavedPrinters.map(savedPrinter => {
      const match = matches.find(m => m.savedDetails.SerialNumber === savedPrinter.SerialNumber);
      
      return {
        name: savedPrinter.Name,
        ipAddress: savedPrinter.IPAddress,
        serialNumber: savedPrinter.SerialNumber,
        lastConnected: savedPrinter.lastConnected,
        isOnline: !!match,
        ipAddressChanged: match?.ipAddressChanged || false,
        currentIpAddress: match?.discoveredPrinter?.ipAddress
      };
    });
  }

  /**
   * Check if a printer is already saved
   */
  public isPrinterSaved(serialNumber: string): boolean {
    return this.getSavedPrinter(serialNumber) !== null;
  }

  /**
   * Get saved check code for a printer
   */
  public getSavedCheckCode(serialNumber: string): string | null {
    const savedPrinter = this.getSavedPrinter(serialNumber);
    return savedPrinter?.CheckCode || null;
  }

  /**
   * Update printer IP address if it has changed
   */
  public async updatePrinterIP(serialNumber: string, newIP: string): Promise<void> {
    const savedPrinter = this.getSavedPrinter(serialNumber);
    if (savedPrinter && savedPrinter.IPAddress !== newIP) {
      const updatedPrinter: PrinterDetails = {
        ...savedPrinter,
        IPAddress: newIP
      };
      await this.savePrinter(updatedPrinter);
      this.emit('printer-ip-updated', { serialNumber, oldIP: savedPrinter.IPAddress, newIP });
    }
  }
}

// Export singleton getter function
export const getSavedPrinterService = (): SavedPrinterService => {
  return SavedPrinterService.getInstance();
};

