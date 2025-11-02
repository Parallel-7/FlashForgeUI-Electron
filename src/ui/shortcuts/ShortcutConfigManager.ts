/**
 * @fileoverview Manager for shortcut button configuration persistence and validation
 *
 * This module provides centralized management of shortcut button configuration,
 * including loading, saving, and validation of component-to-slot assignments.
 *
 * The configuration is stored globally in localStorage and applies to all printer
 * contexts. Components assigned to shortcuts are excluded from the grid layout.
 *
 * Key responsibilities:
 * - Load/save configuration from/to localStorage
 * - Validate configuration schema and component assignments
 * - Provide utility methods for checking pinned status
 * - Ensure mutual exclusivity (component can't be in grid and pinned)
 *
 * @author FlashForgeUI Team
 * @module ui/shortcuts/ShortcutConfigManager
 */

import type {
  ShortcutButtonConfig,
  SlotNumber,
  SlotAssignment,
} from './types';
import { DEFAULT_SHORTCUT_CONFIG } from './types';

/**
 * Storage key for shortcut button configuration in localStorage
 */
const STORAGE_KEY = 'shortcut-buttons-config';

/**
 * Current schema version
 */
const CURRENT_VERSION = 1;

/**
 * Manager for shortcut button configuration
 *
 * Handles loading, saving, and validation of shortcut assignments.
 * Provides singleton pattern via exported instance.
 *
 * @example
 * ```typescript
 * import { shortcutConfigManager } from './ShortcutConfigManager';
 *
 * // Load configuration
 * const config = shortcutConfigManager.load();
 *
 * // Pin a component to slot 1
 * shortcutConfigManager.setSlot(1, 'temperature-controls');
 *
 * // Check if component is pinned
 * if (shortcutConfigManager.isComponentPinned('camera-preview')) {
 *   console.log('Camera preview is pinned to a shortcut');
 * }
 * ```
 */
export class ShortcutConfigManager {
  /**
   * Load shortcut configuration from localStorage
   *
   * If no configuration exists or it's invalid, returns default configuration.
   * Performs validation and migration if needed.
   *
   * @returns Current shortcut configuration
   */
  load(): ShortcutButtonConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        console.log('[ShortcutConfig] No configuration found, using defaults');
        return { ...DEFAULT_SHORTCUT_CONFIG };
      }

      const parsed = JSON.parse(stored) as unknown;

      // Validate structure
      if (!this.isValidConfig(parsed)) {
        console.warn(
          '[ShortcutConfig] Invalid configuration structure, using defaults',
        );
        return { ...DEFAULT_SHORTCUT_CONFIG };
      }

      const config = parsed as ShortcutButtonConfig;

      // Perform migration if needed
      if (config.version < CURRENT_VERSION) {
        console.log(
          `[ShortcutConfig] Migrating from version ${config.version} to ${CURRENT_VERSION}`,
        );
        return this.migrate(config);
      }

      return config;
    } catch (error) {
      console.error('[ShortcutConfig] Error loading configuration:', error);
      return { ...DEFAULT_SHORTCUT_CONFIG };
    }
  }

  /**
   * Save shortcut configuration to localStorage
   *
   * Updates lastModified timestamp before saving.
   *
   * @param config - Configuration to save
   */
  save(config: ShortcutButtonConfig): void {
    try {
      // Update timestamp
      const configToSave: ShortcutButtonConfig = {
        ...config,
        lastModified: new Date().toISOString(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(configToSave));
      console.log('[ShortcutConfig] Configuration saved successfully');
    } catch (error) {
      console.error('[ShortcutConfig] Error saving configuration:', error);
      throw error;
    }
  }

  /**
   * Set component assignment for a specific slot
   *
   * Validates that the component is not already assigned to another slot.
   * Automatically saves the updated configuration.
   *
   * @param slot - Slot number (1, 2, or 3)
   * @param componentId - Component ID to assign, or null to clear slot
   * @throws Error if component is already assigned to a different slot
   */
  setSlot(slot: SlotNumber, componentId: string | null): void {
    const config = this.load();

    // If setting to a component, check it's not already pinned elsewhere
    if (componentId !== null) {
      const existingSlot = this.findSlotForComponent(componentId);
      if (existingSlot !== null && existingSlot !== slot) {
        throw new Error(
          `Component ${componentId} is already assigned to slot ${existingSlot}`,
        );
      }
    }

    const slotKey = `slot${slot}` as keyof typeof config.slots;
    config.slots[slotKey] = componentId;

    this.save(config);
  }

  /**
   * Get component assignment for a specific slot
   *
   * @param slot - Slot number (1, 2, or 3)
   * @returns Component ID assigned to slot, or null if empty
   */
  getSlot(slot: SlotNumber): string | null {
    const config = this.load();
    const slotKey = `slot${slot}` as keyof typeof config.slots;
    return config.slots[slotKey];
  }

  /**
   * Clear a slot assignment
   *
   * @param slot - Slot number to clear
   */
  clearSlot(slot: SlotNumber): void {
    this.setSlot(slot, null);
  }

  /**
   * Get all slot assignments with component metadata
   *
   * Note: This returns slot assignments without component names/icons.
   * For rendering, you'll need to cross-reference with ComponentRegistry.
   *
   * @returns Array of slot assignments
   */
  getAllAssignments(): SlotAssignment[] {
    const config = this.load();
    const assignments: SlotAssignment[] = [];

    for (let i = 1; i <= 3; i++) {
      const slotNumber = i as SlotNumber;
      const slotKey = `slot${slotNumber}` as keyof typeof config.slots;
      const componentId = config.slots[slotKey];

      assignments.push({
        slotNumber,
        componentId,
        componentName: null, // To be populated by caller with ComponentRegistry
        componentIcon: null, // To be populated by caller with ComponentRegistry
      });
    }

    return assignments;
  }

  /**
   * Check if a component is currently pinned to any slot
   *
   * @param componentId - Component ID to check
   * @returns true if component is pinned to a slot
   */
  isComponentPinned(componentId: string): boolean {
    return this.findSlotForComponent(componentId) !== null;
  }

  /**
   * Get all component IDs that are currently pinned
   *
   * @returns Array of pinned component IDs (excludes null/empty slots)
   */
  getPinnedComponentIds(): string[] {
    const config = this.load();
    return Object.values(config.slots).filter(
      (id): id is string => id !== null,
    );
  }

  /**
   * Find which slot a component is assigned to
   *
   * @param componentId - Component ID to search for
   * @returns Slot number if found, null if not pinned
   */
  private findSlotForComponent(componentId: string): SlotNumber | null {
    const config = this.load();

    for (let i = 1; i <= 3; i++) {
      const slotNumber = i as SlotNumber;
      const slotKey = `slot${slotNumber}` as keyof typeof config.slots;
      if (config.slots[slotKey] === componentId) {
        return slotNumber;
      }
    }

    return null;
  }

  /**
   * Validate configuration structure
   *
   * @param data - Data to validate
   * @returns true if valid ShortcutButtonConfig structure
   */
  private isValidConfig(data: unknown): data is ShortcutButtonConfig {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const config = data as Record<string, unknown>;

    return (
      typeof config.version === 'number' &&
      typeof config.slots === 'object' &&
      config.slots !== null &&
      typeof config.lastModified === 'string' &&
      'slot1' in config.slots &&
      'slot2' in config.slots &&
      'slot3' in config.slots &&
      (config.slots.slot1 === null || typeof config.slots.slot1 === 'string') &&
      (config.slots.slot2 === null || typeof config.slots.slot2 === 'string') &&
      (config.slots.slot3 === null || typeof config.slots.slot3 === 'string')
    );
  }

  /**
   * Migrate configuration from older version to current version
   *
   * @param config - Configuration to migrate
   * @returns Migrated configuration
   */
  private migrate(config: ShortcutButtonConfig): ShortcutButtonConfig {
    // Currently only version 1 exists, so just update version number
    // Future migrations would go here
    return {
      ...config,
      version: CURRENT_VERSION,
      lastModified: new Date().toISOString(),
    };
  }
}

/**
 * Singleton instance of ShortcutConfigManager
 *
 * Use this exported instance throughout the application.
 */
export const shortcutConfigManager = new ShortcutConfigManager();
