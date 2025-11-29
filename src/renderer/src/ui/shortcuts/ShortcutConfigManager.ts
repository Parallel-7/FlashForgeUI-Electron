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
} from './types.js';
import { DEFAULT_SHORTCUT_CONFIG } from './types.js';

/**
 * Base storage key for shortcut button configuration in localStorage
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
   * @param serialNumber - Optional printer serial number for per-printer config
   * @returns Current shortcut configuration
   */
  load(serialNumber?: string | null): ShortcutButtonConfig {
    try {
      const storageKey = this.getStorageKey(serialNumber);
      const stored = localStorage.getItem(storageKey);

      if (!stored) {
        // If no per-printer config and a serial was provided, try fallback to global
        if (serialNumber) {
          console.log(`[ShortcutConfig] No config for serial ${serialNumber}, trying global fallback`);
          const globalStored = localStorage.getItem(STORAGE_KEY);
          if (globalStored) {
            const parsed = JSON.parse(globalStored) as unknown;
            if (this.isValidConfig(parsed)) {
              return parsed as ShortcutButtonConfig;
            }
          }
        }

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
   * @param serialNumber - Optional printer serial number for per-printer config
   */
  save(config: ShortcutButtonConfig, serialNumber?: string | null): void {
    try {
      // Update timestamp
      const configToSave: ShortcutButtonConfig = {
        ...config,
        lastModified: new Date().toISOString(),
      };

      const storageKey = this.getStorageKey(serialNumber);
      localStorage.setItem(storageKey, JSON.stringify(configToSave));
      console.log(`[ShortcutConfig] Configuration saved successfully to ${storageKey}`);
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
  setSlot(slot: SlotNumber, componentId: string | null, serialNumber?: string | null): void {
    const config = this.load(serialNumber);

    // If setting to a component, check it's not already pinned elsewhere
    if (componentId !== null) {
      const existingSlot = this.findSlotForComponent(componentId, serialNumber);
      if (existingSlot !== null && existingSlot !== slot) {
        throw new Error(
          `Component ${componentId} is already assigned to slot ${existingSlot}`,
        );
      }
    }

    const slotKey = `slot${slot}` as keyof typeof config.slots;
    config.slots[slotKey] = componentId;

    this.save(config, serialNumber);
  }

  /**
   * Get component assignment for a specific slot
   *
   * @param slot - Slot number (1, 2, or 3)
   * @returns Component ID assigned to slot, or null if empty
   */
  getSlot(slot: SlotNumber, serialNumber?: string | null): string | null {
    const config = this.load(serialNumber);
    const slotKey = `slot${slot}` as keyof typeof config.slots;
    return config.slots[slotKey];
  }

  /**
   * Clear a slot assignment
   *
   * @param slot - Slot number to clear
   */
  clearSlot(slot: SlotNumber, serialNumber?: string | null): void {
    this.setSlot(slot, null, serialNumber);
  }

  /**
   * Get all slot assignments with component metadata
   *
   * Note: This returns slot assignments without component names/icons.
   * For rendering, you'll need to cross-reference with ComponentRegistry.
   *
   * @returns Array of slot assignments
   */
  getAllAssignments(serialNumber?: string | null): SlotAssignment[] {
    const config = this.load(serialNumber);
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
  isComponentPinned(componentId: string, serialNumber?: string | null): boolean {
    return this.findSlotForComponent(componentId, serialNumber) !== null;
  }

  /**
   * Get all component IDs that are currently pinned
   *
   * @returns Array of pinned component IDs (excludes null/empty slots)
   */
  getPinnedComponentIds(serialNumber?: string | null): string[] {
    const config = this.load(serialNumber);
    return Object.values(config.slots).filter(
      (id): id is string => id !== null,
    );
  }

  /**
   * Get storage key for configuration
   * Uses per-printer key if serial provided, otherwise global key
   *
   * @param serialNumber - Optional printer serial number
   * @returns Storage key for localStorage
   */
  private getStorageKey(serialNumber?: string | null): string {
    return serialNumber ? `${STORAGE_KEY}-${serialNumber}` : STORAGE_KEY;
  }

  /**
   * Find which slot a component is assigned to
   *
   * @param componentId - Component ID to search for
   * @returns Slot number if found, null if not pinned
   */
  private findSlotForComponent(componentId: string, serialNumber?: string | null): SlotNumber | null {
    const config = this.load(serialNumber);

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
