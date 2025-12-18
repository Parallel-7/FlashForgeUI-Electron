/**
 * @fileoverview Printer Tabs Component for Multi-Printer Support
 *
 * This component provides a tabbed interface for managing multiple printer connections
 * similar to Orca-FlashForge's tabbed interface. It extends EventEmitter to notify
 * the renderer process of user interactions with tabs.
 *
 * Key features:
 * - Tab management (add, remove, switch, update)
 * - Connection status indicators (connected, connecting, disconnected, error)
 * - Close buttons on tabs with hover effects
 * - "Add Printer" button for creating new connections
 * - Event emission for tab interactions (click, close, add)
 * - Visual distinction between active and inactive tabs
 *
 * Events:
 * - 'tab-clicked': Emitted when a tab is clicked (contextId: string)
 * - 'tab-closed': Emitted when a tab's close button is clicked (contextId: string)
 * - 'add-printer-clicked': Emitted when the add printer button is clicked
 */

import type { PrinterContextInfo } from '@shared/types/PrinterContext.js';
import './printer-tabs.css';

/**
 * Simple event emitter for browser environment
 */
class SimpleEventEmitter {
  private readonly events: Map<string, Array<(...args: unknown[]) => void>> = new Map();

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    const handlers = this.events.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

/**
 * PrinterTabsComponent manages the tabbed interface for multiple printers
 * Does not extend BaseComponent as it has different lifecycle requirements
 */
export class PrinterTabsComponent extends SimpleEventEmitter {
  private tabsContainer: HTMLElement | null = null;
  private addTabButton: HTMLElement | null = null;
  private readonly tabs = new Map<string, HTMLElement>();
  private isInitialized = false;

  /**
   * Initialize the tabs component in the specified container
   * @param containerElement - The parent element where tabs will be rendered
   */
  async initialize(containerElement: HTMLElement): Promise<void> {
    if (this.isInitialized) {
      console.warn('PrinterTabsComponent already initialized');
      return;
    }

    try {
      // Create the tabs bar structure
      containerElement.innerHTML = this.getTemplateHTML();

      // Get references to key elements
      this.tabsContainer = containerElement.querySelector('.tabs-list');
      this.addTabButton = containerElement.querySelector('#add-printer-tab');

      if (!this.tabsContainer || !this.addTabButton) {
        throw new Error('Failed to find required tab elements');
      }

      // Setup event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log('PrinterTabsComponent initialized successfully');

    } catch (error) {
      console.error('Failed to initialize PrinterTabsComponent:', error);
      throw error;
    }
  }

  /**
   * Get the HTML template for the tabs bar
   */
  private getTemplateHTML(): string {
    return `
      <div class="printer-tabs-bar">
        <div class="tabs-list"></div>
        <button id="add-printer-tab" class="add-tab-button" title="Add Printer">
          <span class="add-tab-icon">+</span>
          <span class="add-tab-text">Add Printer</span>
        </button>
      </div>
    `;
  }

  /**
   * Setup event listeners for the add printer button
   */
  private setupEventListeners(): void {
    if (this.addTabButton) {
      this.addTabButton.addEventListener('click', () => {
        this.emit('add-printer-clicked');
      });
    }
  }

  /**
   * Add a new tab for a printer context
   * @param context - Printer context information
   */
  addTab(context: PrinterContextInfo): void {
    if (!this.isInitialized || !this.tabsContainer) {
      console.error('PrinterTabsComponent not initialized');
      return;
    }

    // Check if tab already exists
    if (this.tabs.has(context.id)) {
      console.warn(`Tab for context ${context.id} already exists`);
      return;
    }

    // Create tab element
    const tab = this.createTabElement(context);
    this.tabs.set(context.id, tab);
    this.tabsContainer.appendChild(tab);

    console.log(`Added tab for context ${context.id}`);
  }

  /**
   * Create a tab element for a printer context
   * @param context - Printer context information
   * @returns The created tab element
   */
  private createTabElement(context: PrinterContextInfo): HTMLElement {
    const tab = document.createElement('div');
    tab.className = 'printer-tab';
    tab.dataset.contextId = context.id;

    // Add active class if this is the active context
    if (context.isActive) {
      tab.classList.add('active');
    }

    // Add status class
    tab.classList.add(`status-${context.status}`);

    // Tab content
    tab.innerHTML = `
      <div class="tab-content">
        <div class="status-indicator status-${context.status}"></div>
        <div class="tab-info">
          <div class="tab-name">${this.escapeHTML(context.name)}</div>
          <div class="tab-details">${this.escapeHTML(context.ip)} - ${this.escapeHTML(context.model)}</div>
        </div>
        <button class="tab-close-button" title="Close connection" aria-label="Close ${context.name}">×</button>
      </div>
    `;

    // Add event listeners
    const closeButton = tab.querySelector('.tab-close-button');
    if (closeButton) {
      closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.emit('tab-closed', context.id);
      });
    }

    tab.addEventListener('click', () => {
      this.emit('tab-clicked', context.id);
    });

    return tab;
  }

  /**
   * Remove a tab by context ID
   * @param contextId - The ID of the context to remove
   */
  removeTab(contextId: string): void {
    if (!this.isInitialized) {
      console.error('PrinterTabsComponent not initialized');
      return;
    }

    const tab = this.tabs.get(contextId);
    if (tab) {
      tab.remove();
      this.tabs.delete(contextId);
      console.log(`Removed tab for context ${contextId}`);
    } else {
      console.warn(`Tab for context ${contextId} not found`);
    }
  }

  /**
   * Update a tab with new context information
   * @param contextId - The ID of the context to update
   * @param updates - Partial context information to update
   */
  updateTab(contextId: string, updates: Partial<PrinterContextInfo>): void {
    if (!this.isInitialized) {
      console.error('PrinterTabsComponent not initialized');
      return;
    }

    const tab = this.tabs.get(contextId);
    if (!tab) {
      console.warn(`Tab for context ${contextId} not found`);
      return;
    }

    // Update status class if status changed
    if (updates.status) {
      // Remove old status classes
      tab.classList.remove('status-connected', 'status-connecting', 'status-disconnected', 'status-error');
      tab.classList.add(`status-${updates.status}`);

      // Update status indicator
      const indicator = tab.querySelector('.status-indicator');
      if (indicator) {
        indicator.className = `status-indicator status-${updates.status}`;
      }
    }

    // Update active state if changed
    if (updates.isActive !== undefined) {
      tab.classList.toggle('active', updates.isActive);
    }

    // Update tab name if changed
    if (updates.name) {
      const nameElement = tab.querySelector('.tab-name');
      if (nameElement) {
        nameElement.textContent = updates.name;
      }
    }

    // Update tab details if IP or model changed
    if (updates.ip || updates.model) {
      const detailsElement = tab.querySelector('.tab-details');
      if (detailsElement) {
        const ip = updates.ip || detailsElement.textContent?.split(' - ')[0] || '';
        const model = updates.model || detailsElement.textContent?.split(' - ')[1] || '';
        detailsElement.textContent = `${ip} - ${model}`;
      }
    }

    console.log(`Updated tab for context ${contextId}`);
  }

  /**
   * Set the active tab by context ID
   * @param contextId - The ID of the context to activate
   */
  setActiveTab(contextId: string): void {
    if (!this.isInitialized) {
      console.error('PrinterTabsComponent not initialized');
      return;
    }

    // Remove active class from all tabs
    this.tabs.forEach((tab) => {
      tab.classList.remove('active');
    });

    // Add active class to the specified tab
    const activeTab = this.tabs.get(contextId);
    if (activeTab) {
      activeTab.classList.add('active');
      console.log(`Set active tab to context ${contextId}`);
    } else {
      console.warn(`Tab for context ${contextId} not found`);
    }
  }

  /**
   * Remove all tabs
   */
  clearTabs(): void {
    if (!this.isInitialized) {
      console.error('PrinterTabsComponent not initialized');
      return;
    }

    this.tabs.forEach((tab) => tab.remove());
    this.tabs.clear();
    console.log('Cleared all tabs');
  }

  /**
   * Get the number of tabs
   */
  getTabCount(): number {
    return this.tabs.size;
  }

  /**
   * Check if a tab exists for a context ID
   * @param contextId - The ID of the context to check
   */
  hasTab(contextId: string): boolean {
    return this.tabs.has(contextId);
  }

  /**
   * Escape HTML to prevent XSS
   * @param text - Text to escape
   */
  private escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy the component and clean up resources
   */
  destroy(): void {
    if (!this.isInitialized) {
      return;
    }

    this.clearTabs();
    this.removeAllListeners();
    this.tabsContainer = null;
    this.addTabButton = null;
    this.isInitialized = false;

    console.log('PrinterTabsComponent destroyed');
  }
}

