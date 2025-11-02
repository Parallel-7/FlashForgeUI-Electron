/**
 * @fileoverview Type definitions for shortcut button configuration system
 *
 * This module defines the types used for managing customizable topbar shortcut buttons.
 * Shortcuts allow users to "pin" grid components as quick-access buttons that open
 * in modal dialogs.
 *
 * Key types:
 * - SlotNumber: Type-safe slot identifiers (1, 2, 3)
 * - ShortcutButtonConfig: Storage schema for shortcut configuration
 * - SlotAssignment: Rendering metadata for a shortcut slot
 *
 * @author FlashForgeUI Team
 * @module ui/shortcuts/types
 */

/**
 * Component slot identifier (1-3)
 * Up to 3 shortcut buttons can be configured in the topbar
 */
export type SlotNumber = 1 | 2 | 3;

/**
 * Shortcut button configuration stored in localStorage
 *
 * This configuration is global (applies to all printer contexts) and persists
 * across application restarts.
 *
 * Storage key: 'shortcut-buttons-config'
 *
 * @example
 * ```typescript
 * const config: ShortcutButtonConfig = {
 *   version: 1,
 *   slots: {
 *     slot1: 'temperature-controls',
 *     slot2: 'camera-preview',
 *     slot3: null
 *   },
 *   lastModified: '2025-10-18T14:32:00.000Z'
 * };
 * ```
 */
export interface ShortcutButtonConfig {
  /**
   * Schema version for migration support
   * Current version: 1
   */
  version: number;

  /**
   * Component assignments for each slot
   * - slot1, slot2, slot3: componentId (e.g., 'temperature-controls') or null if unassigned
   * - Each slot can hold at most one component
   * - Same component cannot be assigned to multiple slots
   */
  slots: {
    slot1: string | null;
    slot2: string | null;
    slot3: string | null;
  };

  /**
   * ISO timestamp of last configuration modification
   * Used for tracking and debugging configuration changes
   */
  lastModified: string;
}

/**
 * Slot assignment for UI rendering
 *
 * Combines slot metadata with component information for displaying
 * shortcut buttons in the topbar.
 */
export interface SlotAssignment {
  /** Slot number (1, 2, or 3) */
  slotNumber: SlotNumber;

  /** Component ID assigned to this slot, or null if empty */
  componentId: string | null;

  /** Display name of the component, or null if slot is empty */
  componentName: string | null;

  /** Icon identifier for the component, or null if slot is empty */
  componentIcon: string | null;
}

/**
 * Default configuration for new installations
 */
export const DEFAULT_SHORTCUT_CONFIG: ShortcutButtonConfig = {
  version: 1,
  slots: {
    slot1: null,
    slot2: null,
    slot3: null,
  },
  lastModified: new Date().toISOString(),
};
