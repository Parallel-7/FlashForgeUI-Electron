/**
 * @fileoverview Layout Persistence Manager
 *
 * This class handles saving and loading GridStack layouts to/from localStorage.
 * It provides automatic debouncing for frequent saves, multi-context support
 * for multiple printer layouts, and fallback to default layout when needed.
 *
 * Key features:
 * - Save layouts to localStorage with debouncing
 * - Load layouts with validation and migration support
 * - Multi-context support for different printer layouts
 * - Graceful fallback to defaults on errors
 * - Layout history and versioning support
 */

import type { LayoutConfig, LayoutPersistenceOptions } from './types';
import { getDefaultLayout, isValidLayout, mergeWithDefaults } from './defaults';

/**
 * Default persistence options
 */
const DEFAULT_PERSISTENCE_OPTIONS: Required<LayoutPersistenceOptions> = {
  autoSave: true,
  debounceMs: 1000,
  maxHistory: 5,
  compress: false,
};

/**
 * Layout persistence manager
 * Handles saving and loading layouts to/from localStorage
 */
export class LayoutPersistence {
  /** Base storage key for layouts */
  private readonly baseKey = 'gridstack-layout';

  /** Persistence options */
  private readonly options: Required<LayoutPersistenceOptions>;

  /** Debounce timer for auto-save */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Whether persistence is initialized */
  private initialized = false;

  /**
   * Create a new layout persistence manager
   * @param options - Persistence configuration options
   */
  constructor(options?: Partial<LayoutPersistenceOptions>) {
    this.options = {
      ...DEFAULT_PERSISTENCE_OPTIONS,
      ...options,
    };
  }

  /**
   * Initialize the persistence manager
   */
  initialize(): void {
    if (this.initialized) {
      console.warn('[LayoutPersistence] Already initialized');
      return;
    }

    console.log('[LayoutPersistence] Initialized with options:', this.options);
    this.initialized = true;
  }

  /**
   * Get storage key for a context
   * @param contextId - Optional context ID for multi-printer support
   * @returns Storage key string
   */
  private getStorageKey(contextId?: string): string {
    return contextId ? `${this.baseKey}-${contextId}` : this.baseKey;
  }

  /**
   * Clear the debounce timer if active
   */
  private clearDebounceTimer(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Save layout to localStorage
   * @param layout - Layout configuration to save
   * @param contextId - Optional context ID for multi-printer layouts
   * @param immediate - Whether to save immediately (skip debouncing)
   */
  save(
    layout: LayoutConfig,
    contextId?: string,
    immediate = false
  ): void {
    if (!this.initialized) {
      console.warn('[LayoutPersistence] Not initialized, skipping save');
      return;
    }

    const doSave = (): void => {
      this.debounceTimer = null;
      try {
        this.saveImmediate(layout, contextId);
      } catch (error) {
        console.error('[LayoutPersistence] Debounced save failed:', error);
      }
    };

    // Save immediately or debounce
    if (immediate || !this.options.autoSave) {
      this.clearDebounceTimer();
      doSave();
    } else {
      this.clearDebounceTimer();
      this.debounceTimer = setTimeout(doSave, this.options.debounceMs);
    }
  }

  /**
   * Immediately save layout to localStorage (internal method with quota handling)
   * @param layout - Layout configuration to save
   * @param contextId - Optional context ID for multi-printer layouts
   */
  private saveImmediate(layout: LayoutConfig, contextId?: string): void {
    try {
      const storageKey = this.getStorageKey(contextId);
      const layoutToSave: LayoutConfig = {
        ...layout,
        timestamp: new Date().toISOString(),
        contextId,
      };

      const serialized = JSON.stringify(layoutToSave);

      // Try to save to localStorage with quota error handling
      try {
        localStorage.setItem(storageKey, serialized);
      } catch (storageError) {
        // Handle quota exceeded error
        if (
          storageError instanceof DOMException &&
          (storageError.name === 'QuotaExceededError' ||
            storageError.name === 'NS_ERROR_DOM_QUOTA_REACHED')
        ) {
          console.error('[LayoutPersistence] localStorage quota exceeded, clearing history...');

          // Clear history to free space
          this.clearHistory(contextId);

          // Retry save
          try {
            localStorage.setItem(storageKey, serialized);
            console.log('[LayoutPersistence] Saved after clearing history');
          } catch (retryError) {
            const errorMsg = 'Failed to save layout: localStorage quota exceeded even after clearing history';
            console.error('[LayoutPersistence]', errorMsg, retryError);
            throw new Error(errorMsg);
          }
        } else {
          throw storageError;
        }
      }

      // Save to history after successful save (don't fail if history save fails)
      if (this.options.maxHistory > 0) {
        try {
          this.saveToHistory(layoutToSave, contextId);
        } catch (historyError) {
          console.warn('[LayoutPersistence] Failed to save layout history (non-critical):', historyError);
        }
      }

      console.log(`[LayoutPersistence] Saved layout for context ${contextId || 'default'}`);
    } catch (error) {
      console.error('[LayoutPersistence] Failed to save layout:', error);
      throw error;
    }
  }

  /**
   * Load layout from localStorage
   * @param contextId - Optional context ID for multi-printer layouts
   * @returns Loaded layout or default layout if not found/invalid
   */
  load(contextId?: string): LayoutConfig {
    if (!this.initialized) {
      console.warn(
        '[LayoutPersistence] Not initialized, returning default layout'
      );
      return getDefaultLayout();
    }

    try {
      const storageKey = this.getStorageKey(contextId);
      const stored = localStorage.getItem(storageKey);

      if (!stored) {
        console.log(
          `[LayoutPersistence] No saved layout for context ${contextId || 'default'}, using default`
        );
        return getDefaultLayout();
      }

      // Parse stored layout
      const parsed: unknown = JSON.parse(stored);

      // Validate layout structure
      if (!isValidLayout(parsed)) {
        console.warn(
          '[LayoutPersistence] Stored layout is invalid, using default'
        );
        return getDefaultLayout();
      }

      // Merge with defaults to fill any missing properties
      const layout = mergeWithDefaults(parsed);

      console.log(
        `[LayoutPersistence] Loaded layout for context ${contextId || 'default'}`
      );
      return layout;
    } catch (error) {
      console.error('[LayoutPersistence] Failed to load layout:', error);
      return getDefaultLayout();
    }
  }

  /**
   * Get the default layout configuration
   * @returns Default layout
   */
  getDefaultLayout(): LayoutConfig {
    return getDefaultLayout();
  }

  /**
   * Reset layout to default
   * @param contextId - Optional context ID for multi-printer layouts
   * @returns Default layout that was saved
   */
  reset(contextId?: string): LayoutConfig {
    console.log(
      `[LayoutPersistence] Resetting layout for context ${contextId || 'default'}`
    );

    const defaultLayout = getDefaultLayout();

    // Save default layout immediately
    this.save(defaultLayout, contextId, true);

    // Clear history
    this.clearHistory(contextId);

    return defaultLayout;
  }

  /**
   * Check if a saved layout exists for a context
   * @param contextId - Optional context ID
   * @returns True if saved layout exists
   */
  exists(contextId?: string): boolean {
    const storageKey = this.getStorageKey(contextId);
    return localStorage.getItem(storageKey) !== null;
  }

  /**
   * Delete saved layout for a context
   * @param contextId - Optional context ID
   */
  delete(contextId?: string): void {
    const storageKey = this.getStorageKey(contextId);
    localStorage.removeItem(storageKey);
    this.clearHistory(contextId);
    console.log(
      `[LayoutPersistence] Deleted layout for context ${contextId || 'default'}`
    );
  }

  /**
   * Save layout to history
   * @param layout - Layout to save
   * @param contextId - Optional context ID
   */
  private saveToHistory(layout: LayoutConfig, contextId?: string): void {
    try {
      const historyKey = `${this.getStorageKey(contextId)}-history`;
      const storedHistory = localStorage.getItem(historyKey);

      let history: LayoutConfig[] = storedHistory
        ? this.parseHistory(storedHistory)
        : [];

      // Add new layout to history
      history.unshift(layout);

      // Limit history size
      if (history.length > this.options.maxHistory) {
        history = history.slice(0, this.options.maxHistory);
      }

      // Save history
      localStorage.setItem(historyKey, JSON.stringify(history));
    } catch (error) {
      console.error('[LayoutPersistence] Failed to save layout history:', error);
    }
  }

  /**
   * Get layout history
   * @param contextId - Optional context ID
   * @returns Array of historical layouts
   */
  getHistory(contextId?: string): LayoutConfig[] {
    try {
      const historyKey = `${this.getStorageKey(contextId)}-history`;
      const storedHistory = localStorage.getItem(historyKey);

      if (!storedHistory) {
        return [];
      }

      return this.parseHistory(storedHistory);
    } catch (error) {
      console.error('[LayoutPersistence] Failed to load layout history:', error);
      return [];
    }
  }

  /**
   * Clear layout history
   * @param contextId - Optional context ID
   */
  clearHistory(contextId?: string): void {
    const historyKey = `${this.getStorageKey(contextId)}-history`;
    localStorage.removeItem(historyKey);
  }

  /**
   * Parse and validate layout history payloads stored in localStorage
   * @param serialized - Raw JSON string from storage
   * @returns Array of valid, normalized layout configurations
   */
  private parseHistory(serialized: string): LayoutConfig[] {
    try {
      const parsed = JSON.parse(serialized) as unknown;

      if (!Array.isArray(parsed)) {
        console.warn('[LayoutPersistence] Ignoring malformed layout history payload');
        return [];
      }

      const validLayouts: LayoutConfig[] = [];
      let invalidCount = 0;

      for (const entry of parsed) {
        if (isValidLayout(entry)) {
          validLayouts.push(mergeWithDefaults(entry));
        } else {
          invalidCount++;
        }
      }

      if (invalidCount > 0) {
        console.warn(
          `[LayoutPersistence] Skipped ${invalidCount} invalid layout history entr${invalidCount === 1 ? 'y' : 'ies'}`
        );
      }

      return validLayouts;
    } catch (error) {
      console.error('[LayoutPersistence] Failed to parse layout history:', error);
      return [];
    }
  }

  /**
   * Export layout as JSON string
   * @param contextId - Optional context ID
   * @returns JSON string or null if no layout exists
   */
  export(contextId?: string): string | null {
    const layout = this.load(contextId);
    if (!layout) {
      return null;
    }

    try {
      return JSON.stringify(layout, null, 2);
    } catch (error) {
      console.error('[LayoutPersistence] Failed to export layout:', error);
      return null;
    }
  }

  /**
   * Import layout from JSON string
   * @param json - JSON string to import
   * @param contextId - Optional context ID
   * @returns True if import was successful
   */
  import(json: string, contextId?: string): boolean {
    try {
      const parsed: unknown = JSON.parse(json);

      if (!isValidLayout(parsed)) {
        console.error('LayoutPersistence: Invalid layout JSON');
        return false;
      }

      // Merge with defaults and save
      const layout = mergeWithDefaults(parsed);
      this.save(layout, contextId, true);

      console.log('LayoutPersistence: Layout imported successfully');
      return true;
    } catch (error) {
      console.error('LayoutPersistence: Failed to import layout:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.clearDebounceTimer();
    this.initialized = false;
    console.log('[LayoutPersistence] Disposed');
  }
}

/**
 * Global singleton instance of LayoutPersistence
 */
export const layoutPersistence = new LayoutPersistence();
