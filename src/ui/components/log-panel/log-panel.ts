/**
 * @fileoverview Log Panel Component
 * 
 * This component provides a real-time log display panel that shows application
 * events, printer status changes, and system messages. It extends the BaseComponent
 * class and implements the log message display functionality that was previously
 * part of the monolithic UI.
 * 
 * Key features:
 * - Real-time log message display with timestamps
 * - Auto-scrolling to show latest messages
 * - Monospace font for consistent formatting
 * - Component-scoped styling and behavior
 * - Integration with existing global logMessage function
 * 
 * Usage:
 *   const logPanel = new LogPanelComponent(parentElement);
 *   await logPanel.initialize();
 *   logPanel.addLogMessage('Status update: Printer connected');
 */

import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import './log-panel.css';

/**
 * Log Panel Component class that handles display of system log messages
 */
export class LogPanelComponent extends BaseComponent {
  /** Component identifier for the log panel */
  public readonly componentId: string = 'log-panel';

  /** HTML template for the log panel component */
  public readonly templateHTML: string = `
    <div class="log-container">
      <div class="log-output" id="log-output"></div>
    </div>
  `;

  /** Reference to the log output container element */
  private logOutputElement: HTMLElement | null = null;

  /**
   * Creates a new LogPanelComponent instance
   * @param parentElement - The parent DOM element where this component will be rendered
   */
  constructor(parentElement: HTMLElement) {
    super(parentElement);
  }

  /**
   * Called after component is initialized to set up the log output element reference
   */
  protected async onInitialized(): Promise<void> {
    this.logOutputElement = this.findElementById('log-output');
    
    if (!this.logOutputElement) {
      console.error('Log Panel Component: Failed to find log output element');
      throw new Error('Log output element not found');
    }

    console.log('Log Panel Component: Successfully initialized');
  }

  /**
   * Setup component-specific event listeners
   * Currently no specific event listeners needed for the log panel
   */
  protected async setupEventListeners(): Promise<void> {
    // No specific event listeners needed for log panel
    // This component is primarily output-only
  }

  /**
   * Update component with new data
   * The log panel doesn't need to process polling data updates,
   * but implements this method as required by the BaseComponent
   * 
   * @param data - Component update data (not used by log panel)
   */
  public update(data: ComponentUpdateData): void {
    // Log panel is primarily output-only and doesn't need to process
    // polling data updates. Messages are added via addLogMessage method.
    this.updateState(data);
  }

  /**
   * Add a log message to the display with timestamp
   * This is the primary public method for adding messages to the log
   * 
   * @param message - The log message to display
   */
  public addLogMessage(message: string): void {
    this.assertInitialized();

    if (!this.logOutputElement) {
      console.warn('Log Panel Component: Cannot add message - log output element not available');
      return;
    }

    try {
      // Create timestamp in the same format as the original implementation
      const timestamp = new Date().toLocaleTimeString();
      
      // Create message element
      const messageElement = document.createElement('div');
      messageElement.textContent = `[${timestamp}] ${message}`;
      
      // Add message to log output
      this.logOutputElement.appendChild(messageElement);
      
      // Auto-scroll to show latest message
      this.scrollToBottom();
      
    } catch (error) {
      console.error('Log Panel Component: Failed to add log message:', error);
    }
  }

  /**
   * Clear all log messages from the display
   * Provides ability to clear the log output
   */
  public clearLogs(): void {
    this.assertInitialized();

    if (!this.logOutputElement) {
      console.warn('Log Panel Component: Cannot clear logs - log output element not available');
      return;
    }

    try {
      this.logOutputElement.innerHTML = '';
      console.log('Log Panel Component: Logs cleared');
    } catch (error) {
      console.error('Log Panel Component: Failed to clear logs:', error);
    }
  }

  /**
   * Scroll the log output to show the latest messages
   * Ensures the most recent log message is visible
   */
  private scrollToBottom(): void {
    if (!this.logOutputElement) {
      return;
    }

    try {
      // Scroll the container to the bottom to show latest message
      const container = this.logOutputElement.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    } catch (error) {
      console.error('Log Panel Component: Failed to scroll to bottom:', error);
    }
  }

  /**
   * Get the current number of log messages
   * Useful for monitoring log message count
   * 
   * @returns The number of log messages currently displayed
   */
  public getMessageCount(): number {
    this.assertInitialized();

    if (!this.logOutputElement) {
      return 0;
    }

    return this.logOutputElement.children.length;
  }

  /**
   * Component-specific cleanup logic
   * Clears the log output element reference
   */
  protected cleanup(): void {
    this.logOutputElement = null;
    console.log('Log Panel Component: Cleanup completed');
  }
}