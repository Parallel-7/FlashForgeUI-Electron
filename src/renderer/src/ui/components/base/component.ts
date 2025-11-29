/**
 * @fileoverview Base Component Class for UI Components
 * 
 * This file provides the abstract BaseComponent class that serves as the foundation
 * for all UI components in the FlashForgeUI component system. It handles common
 * functionality including lifecycle management, DOM manipulation, event handling,
 * and error handling patterns. All components extend this base class to ensure
 * consistent behavior and interfaces across the application.
 * 
 * Key features:
 * - Component lifecycle management (initialize, update, destroy)
 * - DOM manipulation utilities with null safety
 * - Event handling setup and cleanup
 * - Error handling and state validation
 * - Type-safe helper methods for common operations
 */

import type { ComponentUpdateData, ComponentState, IComponent } from './types.js';

/**
 * Abstract base class for all UI components
 * Provides common functionality for component lifecycle, DOM manipulation, and event handling
 */
export abstract class BaseComponent implements IComponent {
  /** Container element for this component */
  protected container: HTMLElement | null = null;
  
  /** Component state tracking */
  protected state: ComponentState = {
    isInitialized: false,
    isDestroyed: false
  };

  /** Parent element where the component will be rendered */
  protected readonly parentElement: HTMLElement;

  /** Unique component identifier (must be implemented by subclasses) */
  abstract readonly componentId: string;
  
  /** HTML template for the component (must be implemented by subclasses) */
  abstract readonly templateHTML: string;

  /**
   * Creates a new component instance
   * @param parentElement - The parent DOM element where this component will be rendered
   */
  constructor(parentElement: HTMLElement) {
    this.parentElement = parentElement;
  }

  /**
   * Initialize the component - creates DOM structure and sets up event listeners
   * This method is idempotent and can be called multiple times safely
   */
  async initialize(): Promise<void> {
    if (this.state.isInitialized || this.state.isDestroyed) {
      return;
    }
    
    try {
      // Create and setup container
      this.container = this.createContainer();
      this.container.innerHTML = this.templateHTML;
      this.parentElement.appendChild(this.container);
      
      // Setup component-specific event listeners
      await this.setupEventListeners();
      
      // Call component-specific initialization hook
      await this.onInitialized();
      
      // Update state
      this.state.isInitialized = true;
      this.state.lastUpdate = new Date();
      
      console.log(`Component ${this.componentId} initialized successfully`);
      
    } catch (error) {
      console.error(`Failed to initialize component ${this.componentId}:`, error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Update component with new data
   * Must be implemented by subclasses to handle their specific data requirements
   * @param data - The update data containing polling info, state changes, etc.
   */
  abstract update(data: ComponentUpdateData): void;

  /**
   * Setup component-specific event listeners
   * Must be implemented by subclasses to handle their specific events
   */
  protected abstract setupEventListeners(): Promise<void>;

  /**
   * Called after component is initialized
   * Override in subclasses for custom initialization logic
   */
  protected async onInitialized(): Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Create the container element for this component
   * Adds appropriate classes and data attributes for styling and identification
   */
  protected createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `component-${this.componentId}`;
    container.setAttribute('data-component', this.componentId);
    return container;
  }

  /**
   * Find element within component scope using CSS selector
   * Provides null-safe element selection within the component's DOM tree
   * @param selector - CSS selector string
   * @returns The found element or null if not found
   */
  protected findElement<T extends HTMLElement>(selector: string): T | null {
    if (!this.container) {
      console.warn(`Component ${this.componentId}: Cannot find element '${selector}' - container not initialized`);
      return null;
    }
    return this.container.querySelector<T>(selector);
  }

  /**
   * Find element by ID within component scope
   * Provides null-safe element selection by ID within the component's DOM tree
   * @param id - Element ID (without # prefix)
   * @returns The found element or null if not found
   */
  protected findElementById<T extends HTMLElement>(id: string): T | null {
    if (!this.container) {
      console.warn(`Component ${this.componentId}: Cannot find element with ID '${id}' - container not initialized`);
      return null;
    }
    return this.container.querySelector<T>(`#${id}`);
  }

  /**
   * Find all elements within component scope using CSS selector
   * @param selector - CSS selector string
   * @returns NodeList of matching elements
   */
  protected findElements<T extends HTMLElement>(selector: string): NodeListOf<T> | null {
    if (!this.container) {
      console.warn(`Component ${this.componentId}: Cannot find elements '${selector}' - container not initialized`);
      return null;
    }
    return this.container.querySelectorAll<T>(selector);
  }

  /**
   * Safely set text content of element
   * Provides null-safe text content setting with logging for debugging
   * @param selector - CSS selector or element
   * @param text - Text content to set
   */
  protected setElementText(selector: string | HTMLElement, text: string): void {
    let element: HTMLElement | null;
    
    if (typeof selector === 'string') {
      element = this.findElement(selector);
    } else {
      element = selector;
    }

    if (element) {
      element.textContent = text;
    } else if (typeof selector === 'string') {
      console.warn(`Component ${this.componentId}: Cannot set text for element '${selector}' - element not found`);
    }
  }

  /**
   * Safely set innerHTML of element
   * Provides null-safe innerHTML setting with logging for debugging
   * @param selector - CSS selector or element
   * @param html - HTML content to set
   */
  protected setElementHTML(selector: string | HTMLElement, html: string): void {
    let element: HTMLElement | null;
    
    if (typeof selector === 'string') {
      element = this.findElement(selector);
    } else {
      element = selector;
    }

    if (element) {
      element.innerHTML = html;
    } else if (typeof selector === 'string') {
      console.warn(`Component ${this.componentId}: Cannot set HTML for element '${selector}' - element not found`);
    }
  }

  /**
   * Safely set element attribute
   * Provides null-safe attribute setting with type conversion
   * @param selector - CSS selector or element
   * @param attribute - Attribute name
   * @param value - Attribute value
   */
  protected setElementAttribute(selector: string | HTMLElement, attribute: string, value: string | number | boolean): void {
    let element: HTMLElement | null;
    
    if (typeof selector === 'string') {
      element = this.findElement(selector);
    } else {
      element = selector;
    }

    if (element) {
      element.setAttribute(attribute, value.toString());
    } else if (typeof selector === 'string') {
      console.warn(`Component ${this.componentId}: Cannot set attribute '${attribute}' for element '${selector}' - element not found`);
    }
  }

  /**
   * Safely add CSS class to element
   * @param selector - CSS selector or element
   * @param className - CSS class name to add
   */
  protected addElementClass(selector: string | HTMLElement, className: string): void {
    let element: HTMLElement | null;
    
    if (typeof selector === 'string') {
      element = this.findElement(selector);
    } else {
      element = selector;
    }

    if (element) {
      element.classList.add(className);
    } else if (typeof selector === 'string') {
      console.warn(`Component ${this.componentId}: Cannot add class '${className}' to element '${selector}' - element not found`);
    }
  }

  /**
   * Safely remove CSS class from element
   * @param selector - CSS selector or element
   * @param className - CSS class name to remove
   */
  protected removeElementClass(selector: string | HTMLElement, className: string): void {
    let element: HTMLElement | null;
    
    if (typeof selector === 'string') {
      element = this.findElement(selector);
    } else {
      element = selector;
    }

    if (element) {
      element.classList.remove(className);
    } else if (typeof selector === 'string') {
      console.warn(`Component ${this.componentId}: Cannot remove class '${className}' from element '${selector}' - element not found`);
    }
  }

  /**
   * Safely toggle CSS class on element
   * @param selector - CSS selector or element
   * @param className - CSS class name to toggle
   * @param force - Optional force parameter
   */
  protected toggleElementClass(selector: string | HTMLElement, className: string, force?: boolean): void {
    let element: HTMLElement | null;
    
    if (typeof selector === 'string') {
      element = this.findElement(selector);
    } else {
      element = selector;
    }

    if (element) {
      element.classList.toggle(className, force);
    } else if (typeof selector === 'string') {
      console.warn(`Component ${this.componentId}: Cannot toggle class '${className}' on element '${selector}' - element not found`);
    }
  }

  /**
   * Add event listener to element within component scope
   * @param selector - CSS selector or element
   * @param event - Event type
   * @param handler - Event handler function
   */
  protected addEventListener<K extends keyof HTMLElementEventMap>(
    selector: string | HTMLElement,
    event: K,
    handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void
  ): void {
    let element: HTMLElement | null;
    
    if (typeof selector === 'string') {
      element = this.findElement(selector);
    } else {
      element = selector;
    }

    if (element) {
      element.addEventListener(event, handler);
    } else if (typeof selector === 'string') {
      console.warn(`Component ${this.componentId}: Cannot add event listener to element '${selector}' - element not found`);
    }
  }

  /**
   * Destroy the component and clean up resources
   * This method is idempotent and can be called multiple times safely
   */
  destroy(): void {
    if (this.state.isDestroyed) {
      return;
    }
    
    try {
      // Call component-specific cleanup
      this.cleanup();
      
      // Remove DOM element
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
      
      // Update state
      this.state.isDestroyed = true;
      this.state.isInitialized = false;
      this.state.lastUpdate = new Date();
      
      console.log(`Component ${this.componentId} destroyed successfully`);
      
    } catch (error) {
      console.error(`Error during component ${this.componentId} destruction:`, error);
    }
  }

  /**
   * Component-specific cleanup logic
   * Override in subclasses to implement custom cleanup (event listeners, timers, etc.)
   */
  protected cleanup(): void {
    // Default implementation does nothing
    // Subclasses should override this for custom cleanup
  }

  /**
   * Check if component is ready for operations
   * Throws an error if the component is not initialized or has been destroyed
   */
  protected assertInitialized(): void {
    if (!this.state.isInitialized || this.state.isDestroyed) {
      throw new Error(`Component ${this.componentId} is not initialized or has been destroyed`);
    }
  }

  /**
   * Get current component state
   * @returns Current component state
   */
  public getState(): ComponentState {
    return { ...this.state };
  }

  /**
   * Check if component is initialized
   * @returns True if component is initialized and not destroyed
   */
  public isInitialized(): boolean {
    return this.state.isInitialized && !this.state.isDestroyed;
  }

  /**
   * Check if component is destroyed
   * @returns True if component has been destroyed
   */
  public isDestroyed(): boolean {
    return this.state.isDestroyed;
  }

  /**
   * Update component state tracking
   * Called internally when component is updated
   * @param data - Update data that was processed
   */
  protected updateState(data: ComponentUpdateData): void {
    this.state.lastUpdate = new Date();
    this.state.currentData = data;
  }
}
