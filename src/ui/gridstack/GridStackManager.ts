/**
 * @fileoverview GridStack.js wrapper and manager for FlashForgeUI
 *
 * Provides a clean TypeScript API wrapper around GridStack.js for managing
 * the dashboard grid. Handles widget lifecycle, drag-and-drop configuration,
 * layout serialization, and event management. Follows the principle of "don't
 * hack the framework" - all grid logic is delegated to GridStack with minimal
 * abstraction overhead.
 *
 * Key exports:
 * - GridStackManager: Main grid management class
 * - gridStackManager: Singleton instance for application-wide use
 *
 * Features:
 * - Widget add/remove/update operations with validation
 * - Enable/disable editing mode (dragging and resizing)
 * - Layout serialization/deserialization for persistence
 * - External drag-in support (from component palette)
 * - Event system (change, added, removed, dropped)
 * - Batch operations for performance optimization
 * - Grid compaction and layout cleanup
 * - Lifecycle management and cleanup
 *
 * Usage:
 * ```typescript
 * import { gridStackManager } from './GridStackManager';
 *
 * // Initialize grid with options
 * gridStackManager.initialize({ column: 12, cellHeight: 80 });
 *
 * // Add widget
 * const element = createGridWidget('camera-preview');
 * gridStackManager.addWidget(widgetConfig, element);
 *
 * // Enable editing
 * gridStackManager.enable();
 *
 * // Listen for changes
 * gridStackManager.onChange((widgets) => {
 *   console.log('Grid changed:', widgets);
 * });
 *
 * // Serialize current layout
 * const layout = gridStackManager.serialize();
 * ```
 *
 * @module ui/gridstack/GridStackManager
 */

import { GridStack } from 'gridstack';
import type {
  GridStackInstance,
  GridStackWidgetConfig,
  GridStackWidget,
  GridOptions,
} from './types.js';
import { logVerbose } from '../../utils/logging.js';

/**
 * Event callback types
 */
type ChangeCallback = (widgets: readonly GridStackWidget[]) => void;
type AddedCallback = (widget: GridStackWidget) => void;
type RemovedCallback = (widget: GridStackWidget) => void;
const GRIDSTACK_MANAGER_LOG_NAMESPACE = 'GridStackManager';

/**
 * GridStack manager class
 * Provides a clean API for working with GridStack
 */
export class GridStackManager {
  /** GridStack instance */
  private grid: GridStackInstance | null = null;

  /** Container element selector */
  private readonly containerSelector: string;

  /** Whether the grid is initialized */
  private initialized = false;

  /** Whether edit mode is enabled */
  private editMode = false;

  /** Event callbacks */
  private onChangeCallback: ChangeCallback | null = null;
  private onAddedCallback: AddedCallback | null = null;
  private onRemovedCallback: RemovedCallback | null = null;
  private logDebug(message: string, ...args: unknown[]): void {
    logVerbose(GRIDSTACK_MANAGER_LOG_NAMESPACE, message, ...args);
  }

  /**
   * Create a new GridStackManager
   * @param containerSelector - CSS selector for grid container
   */
  constructor(containerSelector: string = '.grid-stack') {
    this.containerSelector = containerSelector;
  }

  /**
   * Initialize GridStack with options
   * @param options - Grid initialization options
   */
  initialize(options?: GridOptions): void {
    if (this.initialized) {
      console.warn('GridStackManager: Already initialized');
      return;
    }

    try {
      // Get container element
      const container = document.querySelector(this.containerSelector);
      if (!container) {
        throw new Error(
          `GridStackManager: Container '${this.containerSelector}' not found`
        );
      }

      // Initialize GridStack
      this.grid = GridStack.init(
        {
          ...options,
          // Force these options for proper initialization
          staticGrid: true,     // Static by default
        },
        container as HTMLElement
      );

      this.initialized = true;
      this.logDebug('GridStackManager: Initialized successfully');

      // Setup default event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error('GridStackManager: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Add a widget to the grid
   * @param config - Widget configuration
   * @param element - Widget HTML element
   * @returns The added widget element or null if failed
   */
  addWidget(
    config: GridStackWidgetConfig,
    element: HTMLElement
  ): HTMLElement | null {
    if (!this.grid) {
      console.error('GridStackManager: Grid not initialized');
      return null;
    }

    try {
      // Ensure element has required classes
      if (!element.classList.contains('grid-stack-item')) {
        element.classList.add('grid-stack-item');
      }

      // Clear any auto-position flag by default
      element.removeAttribute('gs-auto-position');

      // Set widget positioning attributes before adding
      if (typeof config.x === 'number' && !config.autoPosition) {
        element.setAttribute('gs-x', config.x.toString());
      } else {
        element.removeAttribute('gs-x');
      }

      if (typeof config.y === 'number' && !config.autoPosition) {
        element.setAttribute('gs-y', config.y.toString());
      } else {
        element.removeAttribute('gs-y');
      }

      if (config.autoPosition) {
        element.setAttribute('gs-auto-position', 'true');
      }

      element.setAttribute('gs-w', config.w.toString());
      element.setAttribute('gs-h', config.h.toString());
      if (config.minW) element.setAttribute('gs-min-w', config.minW.toString());
      else element.removeAttribute('gs-min-w');
      if (config.minH) element.setAttribute('gs-min-h', config.minH.toString());
      else element.removeAttribute('gs-min-h');
      element.removeAttribute('gs-max-w');
      element.removeAttribute('gs-max-h');
      if (config.id) element.setAttribute('gs-id', config.id);

      // Convert existing element to grid widget (v12 API)
      // Pass config so GridStack can auto-place when requested
      this.grid.makeWidget(element, {
        x: typeof config.x === 'number' ? config.x : undefined,
        y: typeof config.y === 'number' ? config.y : undefined,
        w: config.w,
        h: config.h,
        minW: config.minW,
        minH: config.minH,
        id: config.id,
        autoPosition: config.autoPosition,
        noMove: config.noMove,
        noResize: config.noResize,
        locked: config.locked
      });

      this.logDebug(
        `[GridStackManager] Added widget '${config.componentId}' at (${config.x ?? 'auto'}, ${config.y ?? 'auto'})`
      );

      // makeWidget modifies element in-place and returns it
      return element;
    } catch (error) {
      console.error(
        `GridStackManager: Failed to add widget '${config.componentId}':`,
        error
      );
      return null;
    }
  }

  /**
   * Remove a widget from the grid
   * @param element - Widget element to remove
   * @param _removeDOM - Whether to remove from DOM (default: true)
   */
  removeWidget(element: HTMLElement, _removeDOM = true): void {
    if (!this.grid) {
      console.error('GridStackManager: Grid not initialized');
      return;
    }

    try {
      this.grid.removeWidget(element);
      this.logDebug('GridStackManager: Removed widget');
    } catch (error) {
      console.error('GridStackManager: Failed to remove widget:', error);
    }
  }

  /**
   * Enable edit mode (allow dragging and resizing)
   */
  enable(): void {
    if (!this.grid) {
      console.error('GridStackManager: Grid not initialized');
      return;
    }

    if (this.editMode) {
      console.debug('GridStackManager: Edit mode already enabled');
      return;
    }

    try {
      // IMPORTANT: setStatic MUST be disabled BEFORE enabling resize
      // resizable() is a no-op on static grids!
      this.grid.setStatic(false);

      // Enable dragging and resizing globally (with recurse)
      this.grid.enableMove(true, true);
      this.grid.enableResize(true, true);

      // Force re-enable resize on each widget to fix handle display
      // This ensures .ui-resizable-handle elements are properly re-initialized
      // after toggling edit mode (fixes GitHub issue #2045, #2034)
      const allWidgets = this.grid.getGridItems();
      this.logDebug(`[GridStackManager] Re-enabling resize on ${allWidgets.length} widgets`);
      allWidgets.forEach((el, index) => {
        this.grid!.resizable(el, true);
        this.logDebug(`[GridStackManager] Enabled resize on widget ${index + 1}/${allWidgets.length}`);
      });

      this.editMode = true;
      this.logDebug('[GridStackManager] Edit mode enabled');
    } catch (error) {
      console.error('[GridStackManager] Failed to enable edit mode:', error);
    }
  }

  /**
   * Disable edit mode (prevent dragging and resizing)
   */
  disable(): void {
    if (!this.grid) {
      console.error('GridStackManager: Grid not initialized');
      return;
    }

    if (!this.editMode) {
      console.debug('GridStackManager: Edit mode already disabled');
      return;
    }

    try {
      // Disable dragging and resizing globally (with recurse)
      this.grid.enableMove(false, true);
      this.grid.enableResize(false, true);
      this.grid.setStatic(true);

      // Explicitly disable resize on each widget for clean state
      // Prevents handle accumulation and ensures clean toggle
      const allWidgets = this.grid.getGridItems();
      allWidgets.forEach((el) => {
        this.grid!.resizable(el, false);
      });

      this.editMode = false;
      this.logDebug('[GridStackManager] Edit mode disabled');
    } catch (error) {
      console.error('[GridStackManager] Failed to disable edit mode:', error);
    }
  }

  /**
   * Serialize the current grid layout
   * @returns Array of widget configurations
   */
  serialize(): GridStackWidgetConfig[] {
    if (!this.grid) {
      console.error('GridStackManager: Grid not initialized');
      return [];
    }

    try {
      // Get serialized widgets from GridStack
      const widgets = this.grid.save(false) as GridStackWidget[];

      // Convert to our widget config format
      const configs: GridStackWidgetConfig[] = widgets.map((widget) => {
        // Extract component ID from widget ID
        const componentId = widget.id?.replace('widget-', '') || 'unknown';

        return {
          componentId,
          x: widget.x ?? 0,
          y: widget.y ?? 0,
          w: widget.w ?? 1,
          h: widget.h ?? 1,
          minW: widget.minW,
          minH: widget.minH,
          noMove: widget.noMove,
          noResize: widget.noResize,
          locked: widget.locked,
          id: widget.id,
        };
      });

      this.logDebug('GridStackManager: Serialized widgets', configs.length);
      return configs;
    } catch (error) {
      console.error('GridStackManager: Failed to serialize grid:', error);
      return [];
    }
  }

  /**
   * Load widget configurations into the grid
   * Clears existing widgets and adds new ones
   * @param widgets - Array of widget configurations
   * @returns Array of created widget elements (for component initialization)
   */
  load(widgets: readonly GridStackWidgetConfig[]): HTMLElement[] {
    if (!this.grid) {
      console.error('GridStackManager: Grid not initialized');
      return [];
    }

    try {
      this.logDebug('GridStackManager: Loading widgets into grid', widgets.length);

      // Clear existing widgets (but don't remove from DOM yet - caller handles cleanup)
      this.grid.removeAll(false);

      // Create widget elements and add to grid using GridStack's load method
      const createdElements: HTMLElement[] = [];

      // Use GridStack's native load method to restore layout
      this.grid.load([...widgets] as GridStackWidget[], false);

      // Get all grid items that were just added
      const gridItems = this.grid.getGridItems();
      gridItems.forEach(item => {
        createdElements.push(item as HTMLElement);
      });

      this.logDebug('GridStackManager: Loaded widget elements', createdElements.length);
      return createdElements;
    } catch (error) {
      console.error('GridStackManager: Failed to load widgets:', error);
      return [];
    }
  }

  /**
   * Clear all widgets from the grid
   * @param removeDOM - Whether to remove from DOM (default: true)
   */
  clear(removeDOM = true): void {
    if (!this.grid) {
      console.error('GridStackManager: Grid not initialized');
      return;
    }

    try {
      this.grid.removeAll(removeDOM);
      this.logDebug('GridStackManager: Cleared all widgets');
    } catch (error) {
      console.error('GridStackManager: Failed to clear widgets:', error);
    }
  }

  /**
   * Setup event listeners for grid changes
   */
  private setupEventListeners(): void {
    if (!this.grid) {
      return;
    }

    // Listen for change events
    this.grid.on('change', (event, items) => {
      if (this.onChangeCallback && items) {
        this.onChangeCallback(items as GridStackWidget[]);
      }
    });

    // Listen for added events
    this.grid.on('added', (event, items) => {
      if (this.onAddedCallback && items && items.length > 0) {
        items.forEach((item) => {
          this.onAddedCallback?.(item as GridStackWidget);
        });
      }
    });

    // Listen for removed events
    this.grid.on('removed', (event, items) => {
      if (this.onRemovedCallback && items && items.length > 0) {
        items.forEach((item) => {
          this.onRemovedCallback?.(item as GridStackWidget);
        });
      }
    });

    this.logDebug('GridStackManager: Event listeners setup complete');
  }

  /**
   * Register callback for grid change events
   * @param callback - Function to call when grid changes
   */
  onChange(callback: ChangeCallback): void {
    this.onChangeCallback = callback;
  }

  /**
   * Register callback for widget added events
   * @param callback - Function to call when widget is added
   */
  onAdded(callback: AddedCallback): void {
    this.onAddedCallback = callback;
  }

  /**
   * Register callback for widget removed events
   * @param callback - Function to call when widget is removed
   */
  onRemoved(callback: RemovedCallback): void {
    this.onRemovedCallback = callback;
  }

  /**
   * Check if grid is initialized
   * @returns True if grid is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if edit mode is enabled
   * @returns True if edit mode is enabled
   */
  isEditMode(): boolean {
    return this.editMode;
  }

  /**
   * Get the GridStack instance
   * @returns GridStack instance or null if not initialized
   */
  getGrid(): GridStackInstance | null {
    return this.grid;
  }

  /**
   * Compact the grid (move widgets up to fill empty space)
   */
  compact(): void {
    if (!this.grid) {
      console.error('GridStackManager: Grid not initialized');
      return;
    }

    try {
      this.grid.compact();
      this.logDebug('GridStackManager: Grid compacted');
    } catch (error) {
      console.error('GridStackManager: Failed to compact grid:', error);
    }
  }

  /**
   * Batch update (prevent multiple redraws)
   * @param callback - Function to execute during batch update
   */
  batchUpdate(callback: () => void): void {
    if (!this.grid) {
      console.error('GridStackManager: Grid not initialized');
      return;
    }

    try {
      this.grid.batchUpdate();
      callback();
      this.grid.commit();
      this.logDebug('GridStackManager: Batch update completed');
    } catch (error) {
      console.error('GridStackManager: Batch update failed:', error);
    }
  }

  /**
   * Setup drag-in from external source (component palette)
   * Enables dragging items from outside the grid into the grid
   * @param selector - CSS selector for draggable elements (default: '.palette-item')
   * @param options - Optional drag-in configuration
   */
  setupDragIn(
    selector = '.palette-item',
    options?: {
      appendTo?: string;
      helper?: 'clone' | ((el: HTMLElement) => HTMLElement);
    }
  ): void {
    if (!this.grid) {
      throw new Error('GridStack not initialized - cannot setup drag-in');
    }

    try {
      // Use GridStack's built-in setupDragIn for external sources
      GridStack.setupDragIn(selector, {
        appendTo: options?.appendTo || 'body',
        helper: options?.helper || 'clone',
        ...options
      });

      this.logDebug('[GridStackManager] Drag-in configured for selector', selector);
    } catch (error) {
      console.error('[GridStackManager] Failed to setup drag-in:', error);
      throw error;
    }
  }

  /**
   * Handle drop from external source
   * Registers a callback for when an external element is dropped onto the grid
   * @param callback - Function to call when external element is dropped
   */
  onExternalDrop(callback: (event: Event, ui: { helper: HTMLElement }) => void): void {
    if (!this.grid) {
      console.warn('GridStackManager: Grid not initialized for external drop handler');
      return;
    }

    // Listen for dropped events which indicate external drops
    this.grid.on('dropped', (event, previousWidget, newWidget) => {
      this.logDebug('[GridStackManager] External drop detected', newWidget);
      if (callback && newWidget && newWidget.el) {
        callback(event as Event, { helper: newWidget.el as HTMLElement });
      }
    });

    this.logDebug('[GridStackManager] External drop handler registered');
  }

  /**
   * Destroy the grid and cleanup resources
   */
  destroy(): void {
    if (!this.grid) {
      console.warn('GridStackManager: Grid not initialized');
      return;
    }

    try {
      // Remove event callbacks
      this.onChangeCallback = null;
      this.onAddedCallback = null;
      this.onRemovedCallback = null;

      // Destroy grid
      this.grid.destroy(false); // Don't remove from DOM - let component system handle it

      this.grid = null;
      this.initialized = false;
      this.editMode = false;

      this.logDebug('GridStackManager: Destroyed successfully');
    } catch (error) {
      console.error('GridStackManager: Destruction failed:', error);
    }
  }
}

/**
 * Global singleton instance of GridStackManager
 */
export const gridStackManager = new GridStackManager();
