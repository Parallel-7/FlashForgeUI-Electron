/**
 * @fileoverview Headless Mode Manager - Orchestrates headless mode initialization
 *
 * Manages the complete lifecycle of headless mode operation including:
 * - Connection to printers (saved, last-used, or explicit)
 * - WebUI server startup and monitoring
 * - Polling coordination across multiple printers
 * - Graceful shutdown with resource cleanup
 */

import { EventEmitter } from 'events';
import type { HeadlessConfig, PrinterSpec } from '../utils/HeadlessArguments.js';
import { HeadlessLogger } from '../utils/HeadlessLogger.js';
import { getConfigManager } from './ConfigManager.js';
import { getConnectionFlowManager } from './ConnectionFlowManager.js';
import { getPrinterContextManager } from './PrinterContextManager.js';
import { getWebUIManager } from '../webui/server/WebUIManager.js';
import { getMultiContextPollingCoordinator } from '../services/MultiContextPollingCoordinator.js';
import { getSavedPrinterService } from '../services/SavedPrinterService.js';
import { cameraIPCHandler } from '../ipc/camera-ipc-handler.js';
import type { PrinterDetails } from '@shared/types/printer.js';
import type { PrinterClientType } from '@shared/types/printer.js';

/**
 * HeadlessManager - Orchestrates all headless mode operations
 *
 * Coordinates printer connections, WebUI server, polling services,
 * and graceful shutdown in headless mode.
 */
export class HeadlessManager extends EventEmitter {
  private readonly logger = new HeadlessLogger();
  private readonly configManager = getConfigManager();
  private readonly connectionManager = getConnectionFlowManager();
  private readonly contextManager = getPrinterContextManager();
  private readonly webUIManager = getWebUIManager();
  private readonly pollingCoordinator = getMultiContextPollingCoordinator();
  private readonly savedPrinterService = getSavedPrinterService();

  private connectedContexts: string[] = [];
  private isInitialized = false;

  /**
   * Initialize headless mode with the provided configuration
   *
   * @param config Parsed headless configuration from CLI arguments
   */
  public async initialize(config: HeadlessConfig): Promise<void> {
    try {
      this.logger.logInfo('Starting FlashForgeUI in headless mode');

      // Apply configuration overrides
      await this.applyConfigOverrides(config);

      // Connect to printers based on mode
      const contexts = await this.connectPrinters(config);

      if (contexts.length === 0) {
        this.logger.logError('No printers connected');
        process.exit(1);
      }

      this.connectedContexts = contexts;
      this.logger.logConnectionSummary(
        contexts.map(contextId => this.contextManager.getContext(contextId)).filter(Boolean)
      );

      // Log active context
      const activeContextId = this.contextManager.getActiveContextId();
      if (activeContextId) {
        this.logger.logActiveContext(activeContextId);
      }

      // Start WebUI server
      await this.startWebUI();

      // Setup event forwarding for WebUI and camera services
      this.setupEventForwarding();

      // Start polling for all connected contexts
      this.startPolling();

      // Initialize camera proxies for all connected contexts
      await this.initializeCameraProxies();

      // Log polling status
      this.logger.logPollingStatus(3, 3);

      this.logger.logReady();
      this.isInitialized = true;

      // Setup signal handlers for graceful shutdown
      this.setupSignalHandlers();
    } catch (error) {
      this.logger.logError('Headless initialization failed', error as Error);
      process.exit(1);
    }
  }

  /**
   * Apply configuration overrides from CLI arguments
   */
  private async applyConfigOverrides(config: HeadlessConfig): Promise<void> {
    if (config.webUIPort !== undefined) {
      this.configManager.set('WebUIPort', config.webUIPort);
      this.logger.logInfo(`WebUI port override: ${config.webUIPort}`);
    }

    if (config.webUIPassword !== undefined) {
      this.configManager.set('WebUIPassword', config.webUIPassword);
      this.logger.logInfo('WebUI password override applied');
    }

    // Force enable WebUI for headless mode
    this.configManager.set('WebUIEnabled', true);
  }

  /**
   * Connect to printers based on headless mode
   */
  private async connectPrinters(config: HeadlessConfig): Promise<string[]> {
    switch (config.mode) {
      case 'last-used':
        return await this.connectLastUsed();

      case 'all-saved':
        return await this.connectAllSaved();

      case 'explicit-printers':
        return await this.connectExplicit(config.printers || []);

      default:
        this.logger.logError(`Unknown headless mode: ${config.mode}`);
        return [];
    }
  }

  /**
   * Connect to the last used printer
   */
  private async connectLastUsed(): Promise<string[]> {
    this.logger.logInfo('Connecting to last used printer...');

    const lastUsedPrinter = this.savedPrinterService.getLastUsedPrinter();
    if (!lastUsedPrinter) {
      this.logger.logError('No last used printer found in saved printer details');
      return [];
    }

    // Convert StoredPrinterDetails to PrinterDetails
    const printerDetails: PrinterDetails = {
      Name: lastUsedPrinter.Name,
      IPAddress: lastUsedPrinter.IPAddress,
      SerialNumber: lastUsedPrinter.SerialNumber,
      CheckCode: lastUsedPrinter.CheckCode,
      ClientType: lastUsedPrinter.ClientType as PrinterClientType,
      printerModel: lastUsedPrinter.printerModel,
      modelType: lastUsedPrinter.modelType,
      customCameraEnabled: lastUsedPrinter.customCameraEnabled,
      customCameraUrl: lastUsedPrinter.customCameraUrl,
      customLedsEnabled: lastUsedPrinter.customLedsEnabled,
      forceLegacyMode: lastUsedPrinter.forceLegacyMode
    };

    const results = await this.connectionManager.connectHeadlessFromSaved([printerDetails]);

    return results.map(r => r.contextId);
  }

  /**
   * Connect to all saved printers
   */
  private async connectAllSaved(): Promise<string[]> {
    const savedPrinters = this.savedPrinterService.getSavedPrinters();

    if (savedPrinters.length === 0) {
      this.logger.logError('No saved printers found');
      return [];
    }

    this.logger.logInfo(`Connecting to ${savedPrinters.length} saved printer(s)...`);

    // Convert StoredPrinterDetails to PrinterDetails
    const printerDetailsList: PrinterDetails[] = savedPrinters.map(saved => ({
      Name: saved.Name,
      IPAddress: saved.IPAddress,
      SerialNumber: saved.SerialNumber,
      CheckCode: saved.CheckCode,
      ClientType: saved.ClientType as PrinterClientType,
      printerModel: saved.printerModel,
      modelType: saved.modelType,
      customCameraEnabled: saved.customCameraEnabled,
      customCameraUrl: saved.customCameraUrl,
      customLedsEnabled: saved.customLedsEnabled,
      forceLegacyMode: saved.forceLegacyMode
    }));

    const results = await this.connectionManager.connectHeadlessFromSaved(printerDetailsList);

    return results.map(r => r.contextId);
  }

  /**
   * Connect to explicitly specified printers
   */
  private async connectExplicit(printerSpecs: PrinterSpec[]): Promise<string[]> {
    if (printerSpecs.length === 0) {
      this.logger.logError('No printer specifications provided');
      return [];
    }

    this.logger.logInfo(`Connecting to ${printerSpecs.length} explicitly specified printer(s)...`);

    const results = await this.connectionManager.connectHeadlessDirect(printerSpecs);

    return results.map(r => r.contextId);
  }

  /**
   * Start WebUI server and verify it's running
   */
  private async startWebUI(): Promise<void> {
    try {
      // Check if WebUI is already running (it may have started during backend initialization)
      let status = this.webUIManager.getStatus();

      if (!status.isRunning) {
        this.logger.logInfo('Starting WebUI server...');
        const success = await this.webUIManager.start();

        if (!success) {
          this.logger.logError('WebUI failed to start - this may be due to missing administrator privileges');
          process.exit(1);
        }

        // Get updated status
        status = this.webUIManager.getStatus();
      } else {
        this.logger.logInfo('WebUI server already running');
      }

      // Log WebUI status
      this.logger.logWebUIStatus({
        running: status.isRunning,
        port: status.port,
        address: status.serverIP
      });

      // Verify it's running
      if (!status.isRunning) {
        this.logger.logError('WebUI server is not running after start attempt');
        process.exit(1);
      }
    } catch (error) {
      this.logger.logError('Failed to start WebUI server', error as Error);
      process.exit(1);
    }
  }

  /**
   * Setup event forwarding from polling coordinator to WebUI
   */
  private setupEventForwarding(): void {
    // Forward polling data to WebUI for real-time updates
    // Note: MultiContextPollingCoordinator emits (contextId, data) - we need both parameters
    this.pollingCoordinator.on('polling-data', (contextId: string, data) => {
      const activeContextId = this.contextManager.getActiveContextId();
      const isActiveContext = activeContextId === contextId;

      if (isActiveContext) {
        console.log(`[HeadlessManager] Forwarding polling data for active context ${contextId} to WebUI`);
        this.webUIManager.handlePollingUpdate(data);
      } else {
        console.log(`[HeadlessManager] Skipping polling data for inactive context ${contextId}; active context is ${activeContextId ?? 'none'}`);
      }
    });

    this.logger.logInfo('Event forwarding configured for WebUI');
  }

  /**
   * Start polling for all connected contexts
   */
  private startPolling(): void {
    for (const contextId of this.connectedContexts) {
      try {
        this.pollingCoordinator.startPollingForContext(contextId);
        this.logger.logInfo(`Started polling for context: ${contextId}`);
      } catch (error) {
        this.logger.logError(`Failed to start polling for context ${contextId}`, error as Error);
      }
    }
  }

  /**
   * Initialize camera proxies for all connected contexts
   */
  private async initializeCameraProxies(): Promise<void> {
    for (const contextId of this.connectedContexts) {
      try {
        await cameraIPCHandler.handlePrinterConnected(contextId);
        this.logger.logInfo(`Camera proxy initialized for context: ${contextId}`);
      } catch (error) {
        this.logger.logError(`Failed to initialize camera for context ${contextId}`, error as Error);
      }
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    process.on('SIGINT', () => {
      this.logger.logInfo('Received SIGINT signal');
      void this.shutdown().then(() => process.exit(0));
    });

    process.on('SIGTERM', () => {
      this.logger.logInfo('Received SIGTERM signal');
      void this.shutdown().then(() => process.exit(0));
    });
  }

  /**
   * Gracefully shutdown headless mode
   */
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger.logShutdown();

    try {
      // Stop all polling
      this.pollingCoordinator.stopAllPolling();

      // Disconnect all printers
      for (const contextId of this.connectedContexts) {
        try {
          await this.connectionManager.disconnectContext(contextId);
        } catch (error) {
          this.logger.logError(`Error disconnecting context ${contextId}`, error as Error);
        }
      }

      // Stop WebUI
      await this.webUIManager.stop();

      this.logger.logShutdownComplete();
      this.isInitialized = false;
    } catch (error) {
      this.logger.logError('Error during shutdown', error as Error);
    }
  }

  /**
   * Get health status of headless mode
   */
  public getHealthStatus(): {
    initialized: boolean;
    connectedPrinters: number;
    webUIRunning: boolean;
    activeContext: string | null;
  } {
    const status = this.webUIManager.getStatus();

    return {
      initialized: this.isInitialized,
      connectedPrinters: this.connectedContexts.length,
      webUIRunning: status.isRunning,
      activeContext: this.contextManager.getActiveContextId()
    };
  }
}

// Export singleton instance
let headlessManager: HeadlessManager | null = null;

export const getHeadlessManager = (): HeadlessManager => {
  if (!headlessManager) {
    headlessManager = new HeadlessManager();
  }
  return headlessManager;
};

