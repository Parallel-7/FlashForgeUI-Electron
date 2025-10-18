/**
 * @fileoverview Structured console logging for headless mode
 *
 * Provides formatted console output for headless mode operations including
 * connection status, WebUI status, errors, and general information.
 */

import type { PrinterContext } from '../managers/PrinterContextManager';

/**
 * WebUI server status information
 */
export interface WebUIServerStatus {
  running: boolean;
  port?: number;
  address?: string;
}

/**
 * Headless logger for structured console output
 */
export class HeadlessLogger {
  /**
   * Format timestamp for log messages
   */
  private getTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  /**
   * Log general information message
   *
   * @param message Information message
   */
  logInfo(message: string): void {
    console.log(`[${this.getTimestamp()}] [Headless] ${message}`);
  }

  /**
   * Log error message with optional error object
   *
   * @param message Error message
   * @param error Optional error object
   */
  logError(message: string, error?: Error): void {
    console.error(`[${this.getTimestamp()}] [Headless] ERROR: ${message}`);
    if (error) {
      console.error(`[${this.getTimestamp()}] [Headless]   ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
    }
  }

  /**
   * Log connection status for a single printer
   *
   * @param contextId Context ID of the printer
   * @param printerName Name of the printer
   * @param ipAddress IP address of the printer
   * @param success Whether connection was successful
   * @param error Optional error message if connection failed
   */
  logConnectionAttempt(
    contextId: string,
    printerName: string,
    ipAddress: string,
    success: boolean,
    error?: string
  ): void {
    if (success) {
      this.logInfo(`✓ Connected: ${contextId} - ${printerName} @ ${ipAddress}`);
    } else {
      this.logError(`✗ Connection failed: ${printerName} @ ${ipAddress}${error ? ` - ${error}` : ''}`);
    }
  }

  /**
   * Log summary of connected printers
   *
   * @param contexts Array of successfully connected printer contexts
   */
  logConnectionSummary(contexts: (PrinterContext | undefined)[]): void {
    const validContexts = contexts.filter((ctx): ctx is PrinterContext => ctx !== undefined);

    if (validContexts.length === 0) {
      this.logError('No printers connected');
      return;
    }

    this.logInfo(`Connected to ${validContexts.length} printer(s):`);
    validContexts.forEach((context) => {
      const name = context.printerDetails?.Name || 'Unknown';
      const ip = context.printerDetails?.IPAddress || 'Unknown';
      this.logInfo(`  - ${context.id}: ${name} @ ${ip}`);
    });
  }

  /**
   * Log active context information
   *
   * @param contextId ID of the active context
   */
  logActiveContext(contextId: string): void {
    this.logInfo(`Active context: ${contextId}`);
  }

  /**
   * Log WebUI server status
   *
   * @param status WebUI server status
   */
  logWebUIStatus(status: WebUIServerStatus): void {
    if (status.running && status.address) {
      this.logInfo(`WebUI running at http://${status.address}:${status.port || 3000}`);
    } else {
      this.logError('WebUI not running');
    }
  }

  /**
   * Log polling status information
   *
   * @param activeInterval Active context polling interval (seconds)
   * @param inactiveInterval Inactive context polling interval (seconds)
   */
  logPollingStatus(activeInterval: number, inactiveInterval: number): void {
    this.logInfo(`Polling: active=${activeInterval}s, inactive=${inactiveInterval}s`);
  }

  /**
   * Log shutdown message
   */
  logShutdown(): void {
    this.logInfo('Shutting down gracefully...');
  }

  /**
   * Log shutdown complete message
   */
  logShutdownComplete(): void {
    this.logInfo('Shutdown complete');
  }

  /**
   * Log ready message
   */
  logReady(): void {
    this.logInfo('Headless mode ready!');
  }
}
