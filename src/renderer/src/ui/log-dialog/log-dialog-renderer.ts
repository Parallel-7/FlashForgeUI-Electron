/**
 * @fileoverview Log Dialog Renderer
 * 
 * This renderer handles the log dialog window functionality including:
 * - Loading and displaying current log messages
 * - Real-time updates of new log messages
 * - Clearing log messages
 * - Auto-scrolling to show latest messages
 * - Message count display
 * - Window controls and event handling
 * 
 * The renderer integrates with the log panel component functionality
 * while providing a dedicated dialog interface for viewing logs.
 */

import { createLogPanel, type LogEntry, type LogPanelController } from '../shared/log-panel/index.js';
import type { ThemeColors } from '@shared/types/config.js';
import { applyDialogTheme } from '../shared/theme-utils.js';
import { initializeLucideIconsFromGlobal } from '../shared/lucide.js';

// Define interfaces for type safety
interface LogMessage {
  timestamp: string;
  message: string;
}

interface ILogDialogAPI {
  requestLogs: () => Promise<LogMessage[]>;
  clearLogs: () => Promise<boolean>;
  closeWindow: () => void;
  onLogMessage: (callback: (message: LogMessage) => void) => void;
  removeListeners: () => void;
  receive?: (channel: string, func: (...args: unknown[]) => void) => void;
}

const getLogDialogAPI = (): ILogDialogAPI => {
  const api = window.api?.dialog?.log as ILogDialogAPI | undefined;
  if (!api) {
    throw new Error('[LogDialog] dialog API bridge is not available');
  }
  return api;
};

// Ensure this file is treated as a module
export {};

class LogDialogRenderer {
  private logPanel: LogPanelController | null = null;
  private logCountElement: HTMLElement | null = null;
  private clearLogsButton: HTMLElement | null = null;
  private closeButton: HTMLElement | null = null;
  private closeFooterButton: HTMLElement | null = null;
  private messageCount: number = 0;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    void this.loadInitialLogs();
  }

  private initializeElements(): void {
    const logPanelHost = document.getElementById('log-panel-root');
    this.logCountElement = document.getElementById('log-count');
    this.clearLogsButton = document.getElementById('btn-clear-logs');
    this.closeButton = document.getElementById('btn-close');
    this.closeFooterButton = document.getElementById('btn-close-footer');

    if (!logPanelHost || !this.logCountElement) {
      console.error('Log Dialog: Failed to find required elements');
      return;
    }

    this.logPanel = createLogPanel({
      mountPoint: logPanelHost,
      showHeader: false,
      autoScroll: true,
      placeholder: 'No log messages to display',
      onCountChanged: (count) => {
        this.messageCount = count;
        this.updateMessageCount();
      }
    });

    console.log('Log Dialog: Elements initialized successfully');
  }

  private setupEventListeners(): void {
    // Clear logs button
    this.clearLogsButton?.addEventListener('click', () => {
      void this.handleClearLogs();
    });

    // Close buttons
    this.closeButton?.addEventListener('click', () => {
      this.handleClose();
    });

    this.closeFooterButton?.addEventListener('click', () => {
      this.handleClose();
    });

    // Listen for new log messages from main process
    getLogDialogAPI().onLogMessage((message: LogMessage) => {
      this.appendLogEntry(message);
    });

    // Handle window close event
    window.addEventListener('beforeunload', () => {
      getLogDialogAPI().removeListeners();
    });

    console.log('Log Dialog: Event listeners set up successfully');
  }

  private async loadInitialLogs(): Promise<void> {
    try {
      const logs = await getLogDialogAPI().requestLogs();
      
      if (logs && logs.length > 0) {
        this.logPanel?.load(logs, { scrollToLatest: true });
        this.messageCount = this.logPanel?.getEntryCount() ?? logs.length;
      } else {
        this.logPanel?.clear();
        this.messageCount = 0;
      }

      this.updateMessageCount();
      console.log(`Log Dialog: Loaded ${logs.length} existing messages`);
    } catch (error) {
      console.error('Log Dialog: Failed to load initial logs:', error);
    }
  }

  private appendLogEntry(message: LogEntry, shouldScroll: boolean = true): void {
    if (!this.logPanel) {
      return;
    }

    try {
      this.logPanel.appendEntry(message, { scroll: shouldScroll });
      this.messageCount = this.logPanel.getEntryCount();
      this.updateMessageCount();
    } catch (error) {
      console.error('Log Dialog: Failed to add log message:', error);
    }
  }

  private async handleClearLogs(): Promise<void> {
    try {
      const success = await getLogDialogAPI().clearLogs();
      
      if (success) {
        this.logPanel?.clear();
        this.messageCount = 0;
        this.updateMessageCount();
        console.log('Log Dialog: Logs cleared successfully');
      }
    } catch (error) {
      console.error('Log Dialog: Failed to clear logs:', error);
    }
  }

  private handleClose(): void {
    try {
      getLogDialogAPI().closeWindow();
    } catch (error) {
      console.error('Log Dialog: Failed to close window:', error);
      // Fallback to generic window close
      window.windowControls?.closeGeneric();
    }
  }

  private updateMessageCount(forcedCount?: number): void {
    if (typeof forcedCount === 'number') {
      this.messageCount = forcedCount;
    }

    if (this.logCountElement) {
      const messageText = this.messageCount === 1 ? 'message' : 'messages';
      this.logCountElement.textContent = `${this.messageCount} ${messageText}`;
    }
  }

  public registerThemeListener(): void {
    getLogDialogAPI().receive?.('theme-changed', (data: unknown) => {
      applyDialogTheme(data as ThemeColors);
    });
  }

  public dispose(): void {
    // Clean up event listeners
    getLogDialogAPI().removeListeners();
    console.log('Log Dialog: Renderer disposed');
  }
}

// Initialize the log dialog when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Log Dialog: DOM loaded, initializing renderer...');
  initializeLucideIconsFromGlobal(['x']);
  const renderer = new LogDialogRenderer();
  renderer.registerThemeListener();
});
