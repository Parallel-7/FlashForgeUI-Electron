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
}

declare global {
  interface Window {
    logDialogAPI?: ILogDialogAPI;
  }
}

// Ensure this file is treated as a module
export {};

class LogDialogRenderer {
  private logOutputElement: HTMLElement | null = null;
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
    this.logOutputElement = document.getElementById('log-output');
    this.logCountElement = document.getElementById('log-count');
    this.clearLogsButton = document.getElementById('btn-clear-logs');
    this.closeButton = document.getElementById('btn-close');
    this.closeFooterButton = document.getElementById('btn-close-footer');

    if (!this.logOutputElement || !this.logCountElement) {
      console.error('Log Dialog: Failed to find required elements');
      return;
    }

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
    window.logDialogAPI?.onLogMessage((message: LogMessage) => {
      this.addLogMessage(message);
    });

    // Handle window close event
    window.addEventListener('beforeunload', () => {
      window.logDialogAPI?.removeListeners();
    });

    console.log('Log Dialog: Event listeners set up successfully');
  }

  private async loadInitialLogs(): Promise<void> {
    try {
      if (!window.logDialogAPI) {
        console.warn('Log Dialog: API not available');
        return;
      }

      const logs = await window.logDialogAPI.requestLogs();
      
      if (logs && logs.length > 0) {
        // Clear any existing content
        if (this.logOutputElement) {
          this.logOutputElement.innerHTML = '';
          this.messageCount = 0;
        }

        // Add all existing logs
        logs.forEach(log => {
          this.addLogMessage(log, false); // Don't scroll for each message
        });

        // Scroll to bottom after adding all messages
        this.scrollToBottom();
      }

      this.updateMessageCount();
      console.log(`Log Dialog: Loaded ${logs.length} existing messages`);
    } catch (error) {
      console.error('Log Dialog: Failed to load initial logs:', error);
    }
  }

  private addLogMessage(message: LogMessage, shouldScroll: boolean = true): void {
    if (!this.logOutputElement) {
      return;
    }

    try {
      // Create message element
      const messageElement = document.createElement('div');
      messageElement.textContent = `[${message.timestamp}] ${message.message}`;
      
      // Add message to log output
      this.logOutputElement.appendChild(messageElement);
      this.messageCount++;

      // Update message count
      this.updateMessageCount();
      
      // Auto-scroll to show latest message if requested
      if (shouldScroll) {
        this.scrollToBottom();
      }
    } catch (error) {
      console.error('Log Dialog: Failed to add log message:', error);
    }
  }

  private async handleClearLogs(): Promise<void> {
    try {
      if (!window.logDialogAPI) {
        console.warn('Log Dialog: API not available for clearing logs');
        return;
      }

      const success = await window.logDialogAPI.clearLogs();
      
      if (success && this.logOutputElement) {
        this.logOutputElement.innerHTML = '';
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
      window.logDialogAPI?.closeWindow();
    } catch (error) {
      console.error('Log Dialog: Failed to close window:', error);
      // Fallback to generic window close
      window.windowControls?.closeGeneric();
    }
  }

  private scrollToBottom(): void {
    if (!this.logOutputElement) {
      return;
    }

    try {
      // Scroll to the bottom of the log output
      this.logOutputElement.scrollTop = this.logOutputElement.scrollHeight;
    } catch (error) {
      console.error('Log Dialog: Failed to scroll to bottom:', error);
    }
  }

  private updateMessageCount(): void {
    if (this.logCountElement) {
      const messageText = this.messageCount === 1 ? 'message' : 'messages';
      this.logCountElement.textContent = `${this.messageCount} ${messageText}`;
    }
  }

  public dispose(): void {
    // Clean up event listeners
    window.logDialogAPI?.removeListeners();
    console.log('Log Dialog: Renderer disposed');
  }
}

// Initialize the log dialog when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Log Dialog: DOM loaded, initializing renderer...');
  new LogDialogRenderer();
});