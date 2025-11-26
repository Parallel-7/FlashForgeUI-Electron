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

import { BaseComponent } from '../base/component.js';
import type { ComponentUpdateData } from '../base/types.js';
import { createLogPanel, type LogEntry, type LogPanelController } from '../../shared/log-panel/index.js';
import './log-panel.css';

/**
 * Log Panel Component class that handles display of system log messages
 */
export class LogPanelComponent extends BaseComponent {
  /** Component identifier for the log panel */
  public readonly componentId: string = 'log-panel';

  /** HTML template for the log panel component */
  public readonly templateHTML: string = `
    <div class="log-panel-component-root" data-log-panel-root></div>
  `;

  /** Shared log panel controller */
  private panelController: LogPanelController | null = null;

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
    const mountPoint = this.findElement<HTMLDivElement>('[data-log-panel-root]');

    if (!mountPoint) {
      console.error('Log Panel Component: Failed to locate mount point');
      throw new Error('Log panel mount point not found');
    }

    this.panelController = createLogPanel({
      mountPoint,
      title: 'Application Logs',
      showHeader: true,
      placeholder: 'No log messages yet',
      autoScroll: true
    });

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

    if (!this.panelController) {
      console.warn('Log Panel Component: Panel controller unavailable during addLogMessage');
      return;
    }

    this.panelController.appendMessage(message);
  }

  /**
   * Add a preformatted log entry (typically from persisted history)
   * @param entry - Log entry containing timestamp and message
   */
  public addLogEntry(entry: LogEntry): void {
    this.assertInitialized();

    if (!this.panelController) {
      console.warn('Log Panel Component: Panel controller unavailable during addLogEntry');
      return;
    }

    this.panelController.appendEntry(entry);
  }

  /**
   * Populate the log output with an initial set of entries
   * @param entries - Log entries in chronological order
   */
  public loadInitialEntries(entries: LogEntry[]): void {
    this.assertInitialized();

    if (!this.panelController) {
      console.warn('Log Panel Component: Cannot load entries - controller unavailable');
      return;
    }

    try {
      this.panelController.load(entries);
    } catch (error) {
      console.error('Log Panel Component: Failed to load initial entries:', error);
    }
  }

  /**
   * Clear all log messages from the display
   * Provides ability to clear the log output
   */
  public clearLogs(): void {
    this.assertInitialized();

    if (!this.panelController) {
      console.warn('Log Panel Component: Cannot clear logs - controller unavailable');
      return;
    }

    try {
      this.panelController.clear();
      console.log('Log Panel Component: Logs cleared');
    } catch (error) {
      console.error('Log Panel Component: Failed to clear logs:', error);
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

    if (!this.panelController) {
      return 0;
    }

    return this.panelController.getEntryCount();
  }

  /**
   * Component-specific cleanup logic
   * Clears the log output element reference
   */
  protected cleanup(): void {
    if (this.panelController) {
      this.panelController.destroy();
      this.panelController = null;
    }
    console.log('Log Panel Component: Cleanup completed');
  }
}
