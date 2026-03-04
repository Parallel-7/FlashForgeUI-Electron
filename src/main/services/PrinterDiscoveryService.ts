/**
 * @fileoverview Service for network scanning and printer discovery operations.
 *
 * Provides network-based printer discovery functionality:
 * - Network-wide printer scanning
 * - Specific IP address printer detection
 * - Discovery timeout and interval configuration
 * - Discovered printer data normalization
 * - Discovery state management (in-progress tracking)
 * - Integration with ff-api's PrinterDiscovery
 *
 * Key exports:
 * - PrinterDiscoveryService class: Network discovery coordinator
 * - getPrinterDiscoveryService(): Singleton accessor
 *
 * This service encapsulates all network scanning logic, providing a simple interface
 * for discovering FlashForge printers on the local network. Used by ConnectionFlowManager
 * during the printer connection workflow to present available printers to the user.
 */

import { type DiscoveredPrinter as FFDiscoveredPrinter, PrinterDiscovery } from '@ghosttypes/ff-api';
import { DiscoveredPrinter } from '@shared/types/printer.js';
import { EventEmitter } from 'events';

/**
 * Service responsible for discovering printers on the network
 * Encapsulates all network scanning logic
 */
export class PrinterDiscoveryService extends EventEmitter {
  private static instance: PrinterDiscoveryService | null = null;
  private discoveryInProgress = false;

  private constructor() {
    super();
  }

  /**
   * Get singleton instance of PrinterDiscoveryService
   */
  public static getInstance(): PrinterDiscoveryService {
    if (!PrinterDiscoveryService.instance) {
      PrinterDiscoveryService.instance = new PrinterDiscoveryService();
    }
    return PrinterDiscoveryService.instance;
  }

  /**
   * Discover all printers on the network
   * @param timeout - Discovery timeout in milliseconds (default: 10000)
   * @param interval - Discovery interval in milliseconds (default: 2000)
   * @param retries - Number of discovery retries (default: 3)
   * @returns Array of discovered printers
   */
  public async scanNetwork(timeout = 10000, interval = 2000, retries = 3): Promise<DiscoveredPrinter[]> {
    if (this.discoveryInProgress) {
      throw new Error('Discovery already in progress');
    }

    this.discoveryInProgress = true;
    this.emit('discovery-started');

    try {
      const discovery = new PrinterDiscovery();
      const rawPrinters = await discovery.discover({
        timeout,
        idleTimeout: interval,
        maxRetries: retries,
      });

      const discoveredPrinters: DiscoveredPrinter[] = rawPrinters.map((printer: FFDiscoveredPrinter) => ({
        name: printer.name || 'Unknown Printer',
        ipAddress: printer.ipAddress,
        serialNumber: printer.serialNumber || '',
        model: 'Unknown', // Will be determined during connection
        status: 'Discovered',
      }));

      this.emit('discovery-completed', discoveredPrinters);
      return discoveredPrinters;
    } catch (error) {
      this.emit('discovery-failed', error);
      throw error;
    } finally {
      this.discoveryInProgress = false;
    }
  }

  /**
   * Scan a specific IP address for a printer
   * @param ipAddress - The IP address to scan
   * @returns Discovered printer or null if not found
   */
  public async scanSingleIP(ipAddress: string): Promise<DiscoveredPrinter | null> {
    this.emit('single-scan-started', ipAddress);

    try {
      const discovery = new PrinterDiscovery();
      const rawPrinters = await discovery.discover({
        timeout: 5000,
        idleTimeout: 1000,
        maxRetries: 1,
      });

      // Filter for the specific IP
      const matchingPrinter = rawPrinters.find((printer: FFDiscoveredPrinter) => printer.ipAddress === ipAddress);

      if (matchingPrinter) {
        const discoveredPrinter: DiscoveredPrinter = {
          name: matchingPrinter.name || 'Unknown Printer',
          ipAddress: matchingPrinter.ipAddress,
          serialNumber: matchingPrinter.serialNumber || '',
          model: 'Unknown',
          status: 'Discovered',
        };

        this.emit('single-scan-completed', discoveredPrinter);
        return discoveredPrinter;
      }

      this.emit('single-scan-completed', null);
      return null;
    } catch (error) {
      this.emit('single-scan-failed', { ipAddress, error });
      return null;
    }
  }

  /**
   * Check if discovery is currently in progress
   */
  public isDiscoveryInProgress(): boolean {
    return this.discoveryInProgress;
  }

  /**
   * Cancel ongoing discovery (if supported by the API)
   */
  public cancelDiscovery(): void {
    if (this.discoveryInProgress) {
      // Note: ff-api might not support cancellation
      // This is a placeholder for future implementation
      this.discoveryInProgress = false;
      this.emit('discovery-cancelled');
    }
  }
}

// Export singleton getter function
export const getPrinterDiscoveryService = (): PrinterDiscoveryService => {
  return PrinterDiscoveryService.getInstance();
};
