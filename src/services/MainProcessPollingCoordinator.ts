/**
 * @fileoverview Centralized polling coordinator running in main process for single-printer mode.
 *
 * Manages centralized printer status polling and distribution to all consumers:
 * - Direct backend polling without IPC chains
 * - Update distribution to renderer process via IPC
 * - Update distribution to WebUI clients via WebSocket
 * - Polling pause/resume control
 * - Polling data caching for immediate access
 * - Notification coordination for status changes
 *
 * Key exports:
 * - MainProcessPollingCoordinator class: Centralized polling manager
 * - getMainProcessPollingCoordinator(): Singleton accessor
 *
 * Note: This coordinator is used for single-printer mode. For multi-printer support,
 * see MultiContextPollingCoordinator which handles polling across multiple printer
 * contexts with dynamic frequency adjustment based on active context.
 */

import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import { getPrinterBackendManager } from '../managers/PrinterBackendManager.js';
import { getPrinterContextManager } from '../managers/PrinterContextManager.js';
import { getWebUIManager } from '../webui/server/WebUIManager.js';
import { getPrinterNotificationCoordinator } from './notifications/index.js';
import { printerDataTransformer } from './PrinterDataTransformer.js';
import type { PollingData, PrinterStatus, MaterialStationStatus } from '../types/polling.js';


/**
 * Polling coordinator that runs in the main process
 */
export class MainProcessPollingCoordinator extends EventEmitter {
  private static instance: MainProcessPollingCoordinator | null = null;
  
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private isPaused = false;
  private readonly POLLING_INTERVAL = 2500; // 2.5 seconds
  
  private readonly backendManager = getPrinterBackendManager();
  private readonly contextManager = getPrinterContextManager();
  private readonly webUIManager = getWebUIManager();
  private readonly notificationCoordinator = getPrinterNotificationCoordinator();
  
  // Cache for last polling data
  private lastPollingData: PollingData = {
    printerStatus: printerDataTransformer.createDefaultStatus(),
    materialStation: printerDataTransformer.createDefaultMaterialStation(),
    thumbnailData: null,
    isConnected: false,
    isInitializing: false,
    lastPolled: new Date()
  };
  
  private constructor() {
    super();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): MainProcessPollingCoordinator {
    if (!MainProcessPollingCoordinator.instance) {
      MainProcessPollingCoordinator.instance = new MainProcessPollingCoordinator();
    }
    return MainProcessPollingCoordinator.instance;
  }
  
  /**
   * Start polling when backend is ready
   */
  public startPolling(): void {
    if (this.isPolling) {
      console.log('[MainPolling] Already polling, skipping start');
      return;
    }

    // Get active context ID
    const contextId = this.contextManager.getActiveContextId();
    if (!contextId) {
      console.log('[MainPolling] No active context, cannot start polling');
      return;
    }

    if (!this.backendManager.isBackendReady(contextId)) {
      console.log('[MainPolling] Backend not ready, cannot start polling');
      return;
    }

    console.log('[MainPolling] Starting polling service');
    this.isPolling = true;

    // Start immediate poll
    void this.performPoll();

    // Set up interval
    this.pollingInterval = setInterval(() => {
      void this.performPoll();
    }, this.POLLING_INTERVAL);
  }
  
  /**
   * Stop polling
   */
  public stopPolling(): void {
    if (!this.isPolling) {
      return;
    }
    
    console.log('[MainPolling] Stopping polling service');
    this.isPolling = false;
    this.isPaused = false; // Reset pause state when stopping
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    // Clear cached data with defaults
    this.lastPollingData = {
      printerStatus: printerDataTransformer.createDefaultStatus(),
      materialStation: printerDataTransformer.createDefaultMaterialStation(),
      thumbnailData: null,
      isConnected: false,
      isInitializing: false,
      lastPolled: new Date()
    };
  }
  
  /**
   * Pause polling while keeping the service active
   * Used during operations that need exclusive access to the printer connection
   */
  public pausePolling(): void {
    if (!this.isPolling || this.isPaused) {
      return;
    }
    
    console.log('[MainPolling] Pausing polling for job picker');
    this.isPaused = true;
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
  
  /**
   * Resume polling if it was paused
   */
  public resumePolling(): void {
    if (!this.isPolling || !this.isPaused) {
      return;
    }
    
    console.log('[MainPolling] Resuming polling after job picker');
    this.isPaused = false;
    
    // Restart the polling interval
    this.pollingInterval = setInterval(() => {
      void this.performPoll();
    }, this.POLLING_INTERVAL);
    
    // Perform immediate poll to get current state
    void this.performPoll();
  }
  
  /**
   * Perform a single poll
   */
  private async performPoll(): Promise<void> {
    // Get active context ID
    const contextId = this.contextManager.getActiveContextId();

    // Skip polling if no active context
    if (!contextId) {
      return;
    }

    if (!this.isPolling || this.isPaused || !this.backendManager.isBackendReady(contextId)) {
      return;
    }

    try {
      // Get printer status from backend
      const statusResult = await this.backendManager.getPrinterStatus(contextId);

      // Get material station status
      const materialStationRaw = this.backendManager.getMaterialStationStatus(contextId);
      let materialStation: MaterialStationStatus | null = null;

      if (materialStationRaw) {
        // Transform to polling type format
        materialStation = {
          connected: materialStationRaw.connected,
          slots: materialStationRaw.slots.map(slot => ({
            slotId: slot.slotId,
            isEmpty: slot.isEmpty,
            materialType: slot.materialType,
            materialColor: slot.materialColor,
            isActive: slot.slotId === materialStationRaw.activeSlot
          })),
          activeSlot: materialStationRaw.activeSlot,
          errorMessage: materialStationRaw.errorMessage,
          lastUpdate: new Date()
        };
      }

      // Get model preview if available
      let thumbnailData: string | null = null;
      try {
        thumbnailData = await this.backendManager.getModelPreview(contextId);
      } catch {
        // Ignore thumbnail errors
      }
      
      // Transform the data
      let printerStatus: PrinterStatus | null = null;
      if (statusResult.success && statusResult.status) {
        printerStatus = printerDataTransformer.transformPrinterStatus(statusResult.status);
      } else {
        // Always provide default status structure when not connected or no data
        printerStatus = printerDataTransformer.createDefaultStatus();
      }
      
      // Create polling data with all fields populated
      const pollingData: PollingData = {
        printerStatus, // Always non-null now
        materialStation: materialStation || printerDataTransformer.createDefaultMaterialStation(),
        thumbnailData,
        isConnected: statusResult.success && !!statusResult.status,
        isInitializing: false,
        lastPolled: new Date()
      };
      
      // Cache the data
      this.lastPollingData = pollingData;
      
      // Distribute updates
      this.distributeUpdates(pollingData);
      
    } catch (error) {
      console.error('[MainPolling] Polling error:', error);
    }
  }
  
  /**
   * Distribute updates to all consumers
   */
  private distributeUpdates(data: PollingData): void {
    // Send to renderer via IPC
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('polling-update', data);
      }
    });
    
    // Send to WebUI
    this.webUIManager.handlePollingUpdate(data);
    
    // Send to notification coordinator
    void this.notificationCoordinator.handlePollingDataUpdate(data);
    
    // Log for debugging
    if (data.printerStatus) {
      console.log('[MainPolling] Distributed update:', {
        state: data.printerStatus.state,
        bedTemp: `${data.printerStatus.temperatures.bed.current}°C`,
        extruderTemp: `${data.printerStatus.temperatures.extruder.current}°C`,
        hasJob: !!data.printerStatus.currentJob,
        webUIClients: this.webUIManager.getStatus().clientCount
      });
    }
  }
  
  /**
   * Get last polling data (for new connections)
   */
  public getLastPollingData(): PollingData {
    return this.lastPollingData;
  }
  
  /**
   * Check if currently polling
   */
  public isPollingActive(): boolean {
    return this.isPolling;
  }
}

// Export singleton getter
export function getMainProcessPollingCoordinator(): MainProcessPollingCoordinator {
  return MainProcessPollingCoordinator.getInstance();
}

