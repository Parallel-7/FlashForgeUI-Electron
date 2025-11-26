/**
 * @fileoverview Status Dialog renderer process providing comprehensive system and printer
 * status monitoring with auto-refresh capabilities. Displays printer information, WebUI server
 * status, camera proxy status, and application health metrics in a formatted dashboard interface.
 *
 * Key Features:
 * - Auto-refreshing status display (5-second intervals)
 * - Comprehensive printer information panel (model, firmware, serial, IP, connection state)
 * - WebUI server monitoring (status, active clients, access URL)
 * - Camera proxy status tracking (enabled, streaming, clients, ports)
 * - System health metrics (uptime, memory usage)
 * - Visual status indicators with color-coded states
 * - Human-readable formatting for durations and memory values
 *
 * Display Sections:
 * - Printer Information: Hardware details and connection status
 * - WebUI Server: Server availability and client connections
 * - Camera System: Proxy status and streaming state
 * - System Information: Application health metrics
 *
 * Auto-Refresh:
 * - 5-second polling interval for real-time updates
 * - Automatic start on dialog load
 * - Cleanup on window unload to prevent memory leaks
 *
 * Formatting Utilities:
 * - formatUptime(): Converts seconds to "Xh Ym Zs" format
 * - formatMemory(): Converts bytes to "X.X MB" format
 * - Status indicators: Active (green) / Inactive (gray) visual cues
 *
 * Context:
 * Used for system diagnostics, troubleshooting connectivity issues, monitoring resource
 * usage, and verifying WebUI/camera server availability. Essential for technical support.
 */

// src/ui/status-dialog/status-dialog-renderer.ts

import type { ThemeColors } from '../../types/config.js';
import { applyDialogTheme } from '../shared/theme-utils.js';

interface StatusDialogAPI {
  readonly requestStats: () => Promise<StatusStats | null>;
  readonly closeWindow: () => void;
  readonly receiveStats: (callback: (stats: StatusStats) => void) => void;
  readonly removeListeners: () => void;
  receive?: (channel: string, func: (...args: unknown[]) => void) => void;
}

const resolveStatusDialogAPI = (): StatusDialogAPI | undefined => {
  return window.api?.dialog?.status as StatusDialogAPI | undefined;
};

// Ensure this file is treated as a module
export {};

interface PrinterInfo {
  readonly model: string;
  readonly machineType: string;
  readonly firmwareVersion: string;
  readonly serialNumber: string;
  readonly toolCount: number;
  readonly ipAddress: string;
  readonly isConnected: boolean;
}

interface StatusStats {
  readonly printerInfo: PrinterInfo;
  readonly webuiStatus: boolean;
  readonly webuiClients: number;
  readonly webuiUrl: string;
  readonly cameraStatus: boolean;
  readonly cameraPort: number;
  readonly cameraClients: number;
  readonly cameraStreaming: boolean;
  readonly cameraUrl: string;
  readonly appUptime: number;
  readonly memoryUsage: number;
}

class StatusDialogRenderer {
  private static readonly AUTO_REFRESH_DELAY = 5000;
  private static readonly TAB_STORAGE_KEY = 'statusDialogActiveTab';

  private readonly statusAPI = resolveStatusDialogAPI();
  private autoRefreshInterval: NodeJS.Timeout | null = null;
  private tabButtons: HTMLButtonElement[] = [];
  private readonly tabPanels: Map<string, HTMLElement> = new Map();
  private activeTabId = 'overview';

  constructor() {
    document.addEventListener('DOMContentLoaded', () => {
      this.initialize();
    });

    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  private initialize(): void {
    window.lucideHelpers?.initializeLucideIconsFromGlobal?.(['x']);
    this.initializeTabs();
    this.setupCloseButtons();
    this.registerThemeListener();

    if (this.statusAPI) {
      this.statusAPI.receiveStats((stats) => this.updateStats(stats));
      void this.requestStats();
      this.startAutoRefresh();
    } else {
      console.warn('[StatusDialog] statusAPI bridge unavailable, rendering fallback data');
      this.updateStats(this.createFallbackStats());
    }
  }

  private setupCloseButtons(): void {
    const closeButtons: (HTMLElement | null)[] = [
      document.getElementById('btn-close'),
      document.getElementById('btn-close-footer')
    ];

    closeButtons.forEach((button) => {
      if (!button) {
        return;
      }
      button.addEventListener('click', () => {
        this.statusAPI?.closeWindow();
      });
    });
  }

  private initializeTabs(): void {
    this.tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.status-tab-button'));
    const panelElements = document.querySelectorAll<HTMLElement>('.tab-panel');

    panelElements.forEach((panel) => {
      const panelId = panel.id.replace('tab-panel-', '');
      this.tabPanels.set(panelId, panel);
    });

    this.tabButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        const tabId = button.dataset.tab;
        if (tabId) {
          this.setActiveTab(tabId, true, true);
        }
      });

      button.addEventListener('keydown', (event) => {
        this.handleTabKeydown(event, index);
      });
    });

    const persistedTab = this.loadPersistedTabId();
    if (persistedTab && this.tabPanels.has(persistedTab)) {
      this.setActiveTab(persistedTab, false, false);
    } else if (this.tabButtons.length > 0) {
      const fallbackTab = this.tabButtons[0].dataset.tab ?? 'overview';
      this.setActiveTab(fallbackTab, true, false);
    }
  }

  private handleTabKeydown(event: KeyboardEvent, currentIndex: number): void {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();

    if (event.key === 'Home') {
      const firstTab = this.tabButtons[0];
      if (firstTab?.dataset.tab) {
        this.setActiveTab(firstTab.dataset.tab, true, true);
      }
      return;
    }

    if (event.key === 'End') {
      const lastTab = this.tabButtons[this.tabButtons.length - 1];
      if (lastTab?.dataset.tab) {
        this.setActiveTab(lastTab.dataset.tab, true, true);
      }
      return;
    }

    const increment = event.key === 'ArrowRight' ? 1 : -1;
    const newIndex = (currentIndex + increment + this.tabButtons.length) % this.tabButtons.length;
    const nextTab = this.tabButtons[newIndex];
    if (nextTab?.dataset.tab) {
      this.setActiveTab(nextTab.dataset.tab, true, true);
    }
  }

  private setActiveTab(tabId: string, persist: boolean, focusTab: boolean): void {
    if (!this.tabPanels.has(tabId)) {
      return;
    }

    this.tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tabId;
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
      if (isActive && focusTab) {
        button.focus();
      }
    });

    this.tabPanels.forEach((panel, id) => {
      if (id === tabId) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', 'true');
      }
    });

    this.activeTabId = tabId;
    if (persist) {
      this.persistTabId(tabId);
    }
  }

  private persistTabId(tabId: string): void {
    try {
      window.localStorage.setItem(StatusDialogRenderer.TAB_STORAGE_KEY, tabId);
    } catch (error) {
      console.warn('[StatusDialog] Unable to persist tab selection:', error);
    }
  }

  private loadPersistedTabId(): string | null {
    try {
      return window.localStorage.getItem(StatusDialogRenderer.TAB_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private async requestStats(): Promise<void> {
    try {
      await this.statusAPI?.requestStats();
    } catch (error) {
      console.error('[StatusDialog] Failed to fetch stats:', error);
    }
  }

  private startAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
    this.autoRefreshInterval = setInterval(() => {
      void this.requestStats();
    }, StatusDialogRenderer.AUTO_REFRESH_DELAY);
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  private updateStats(stats: StatusStats): void {
    this.updatePrinterTab(stats.printerInfo);
    this.updateWebUITab(stats);
    this.updateCameraTab(stats);
    this.updateSystemTab(stats);
    this.updateOverviewTab(stats);
  }

  private updatePrinterTab(printerInfo: PrinterInfo): void {
    this.setText('printer-model', printerInfo.model || 'Unknown');
    this.setText('printer-machine-type', printerInfo.machineType || 'Unknown');
    this.setText('printer-firmware', printerInfo.firmwareVersion || 'Unknown');
    this.setText('printer-serial', printerInfo.serialNumber || 'Unknown');
    this.setText('printer-tool-count', printerInfo.toolCount?.toString() ?? '0');
    this.setText('printer-ip', printerInfo.ipAddress || 'Not Connected');
    this.setIndicatorValue('printer-connection-status', printerInfo.isConnected, 'Connected', 'Disconnected');
  }

  private updateWebUITab(stats: StatusStats): void {
    this.setIndicatorValue('webui-status', stats.webuiStatus, 'Active', 'Inactive');
    this.setText('webui-clients', stats.webuiClients.toString());
    this.setText('webui-url', stats.webuiUrl || 'None');
  }

  private updateCameraTab(stats: StatusStats): void {
    this.setIndicatorValue('camera-status', stats.cameraStatus, 'Active', 'Inactive');
    this.setText('camera-port', stats.cameraPort ? stats.cameraPort.toString() : 'Unknown');
    this.setText('camera-clients', stats.cameraClients?.toString() ?? '0');
    this.setIndicatorValue('camera-streaming', stats.cameraStreaming, 'Yes', 'No');
    this.setText('camera-url', stats.cameraUrl || 'None');
  }

  private updateSystemTab(stats: StatusStats): void {
    this.setText('app-uptime', StatusDialogRenderer.formatUptime(stats.appUptime));
    this.setText('memory-usage', StatusDialogRenderer.formatMemory(stats.memoryUsage));
  }

  private updateOverviewTab(stats: StatusStats): void {
    const { printerInfo } = stats;
    this.setIndicatorClass('overview-printer-indicator', printerInfo.isConnected);
    this.setText('overview-printer-status', printerInfo.isConnected ? 'Connected' : 'Disconnected');
    this.setText('overview-printer-model', `Model: ${printerInfo.model || 'Unknown'}`);

    this.setIndicatorClass('overview-webui-indicator', stats.webuiStatus);
    this.setText('overview-webui-status', stats.webuiStatus ? 'Active' : 'Inactive');
    this.setText('overview-webui-clients', stats.webuiClients.toString());

    this.setIndicatorClass('overview-camera-indicator', stats.cameraStatus);
    this.setText('overview-camera-status', stats.cameraStatus ? 'Active' : 'Offline');
    this.setText('overview-camera-stream', stats.cameraStreaming ? 'Yes' : 'No');

    this.setText('overview-system-uptime', StatusDialogRenderer.formatUptime(stats.appUptime));
    this.setText('overview-system-memory', StatusDialogRenderer.formatMemory(stats.memoryUsage));
  }

  private setIndicatorValue(elementId: string, isActive: boolean, activeLabel: string, inactiveLabel: string): void {
    const container = document.getElementById(elementId);
    if (!container) {
      return;
    }

    const statusClass = isActive ? 'status-active' : 'status-inactive';
    const label = isActive ? activeLabel : inactiveLabel;
    container.innerHTML = `<span class="status-indicator ${statusClass}"></span>${label}`;
  }

  private setIndicatorClass(elementId: string, isActive: boolean): void {
    const indicator = document.getElementById(elementId);
    if (!indicator) {
      return;
    }

    indicator.classList.toggle('status-active', isActive);
    indicator.classList.toggle('status-inactive', !isActive);
  }

  private setText(elementId: string, value: string): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
    }
  }

  private registerThemeListener(): void {
    this.statusAPI?.receive?.('theme-changed', (data: unknown) => {
      applyDialogTheme(data as ThemeColors);
    });
  }

  private cleanup(): void {
    this.stopAutoRefresh();
    this.statusAPI?.removeListeners();
  }

  private createFallbackStats(): StatusStats {
    return {
      printerInfo: {
        model: 'Not Connected',
        machineType: 'Unknown',
        firmwareVersion: 'Unknown',
        serialNumber: 'Unknown',
        toolCount: 0,
        ipAddress: 'Not Connected',
        isConnected: false
      },
      webuiStatus: false,
      webuiClients: 0,
      webuiUrl: 'None',
      cameraStatus: false,
      cameraPort: 0,
      cameraClients: 0,
      cameraStreaming: false,
      cameraUrl: 'None',
      appUptime: 0,
      memoryUsage: 0
    };
  }

  private static formatUptime(uptimeSeconds: number): string {
    if (!uptimeSeconds || uptimeSeconds < 0) {
      return 'Unknown';
    }

    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const secs = Math.floor(uptimeSeconds % 60);

    return `${hours}h ${minutes}m ${secs}s`;
  }

  private static formatMemory(memoryBytes: number): string {
    if (!memoryBytes || memoryBytes < 0) {
      return 'Unknown';
    }

    const mb = (memoryBytes / (1024 * 1024)).toFixed(1);
    return `${mb} MB`;
  }
}

// Instantiate immediately so DOM listeners are registered
new StatusDialogRenderer();
