/**
 * @fileoverview Shared component type definitions
 *
 * This file defines TypeScript types and interfaces for component definitions
 * that are shared between the main process (palette IPC) and renderer process (grid UI).
 */

/**
 * Component size definition
 */
export interface ComponentSize {
  /** Width in grid units */
  w: number;

  /** Height in grid units */
  h: number;
}

/**
 * Where a registered component can be surfaced.
 *
 * - 'grid': only available as a dashboard grid widget (palette / saved layouts)
 * - 'shortcut': only available as a topbar shortcut button (never appears in the
 *   grid palette and is never instantiated as a grid widget)
 * - 'both': available in the grid and as a topbar shortcut (default)
 */
export type ComponentAvailability = 'grid' | 'shortcut' | 'both';

/**
 * Component metadata definition for registry
 * Provides information about available components
 */
export interface ComponentDefinition {
  /** Unique component ID */
  readonly id: string;

  /** Display name for UI */
  readonly name: string;

  /** Icon class or emoji */
  readonly icon: string;

  /** Default size when added to grid */
  readonly defaultSize: ComponentSize;

  /** Minimum allowed size */
  readonly minSize: ComponentSize;

  /** Maximum allowed size (optional) */
  readonly maxSize?: ComponentSize;

  /** Component category for organization */
  readonly category: 'main' | 'status-bar' | 'utility';

  /** Optional description */
  readonly description?: string;

  /** Whether component is always visible */
  readonly required?: boolean;

  /** Whether component supports multiple instances */
  readonly singleton?: boolean;

  /**
   * Where this component can be surfaced (grid palette, topbar shortcuts, or both).
   * Defaults to 'both' when omitted.
   */
  readonly availability?: ComponentAvailability;

  /**
   * For shortcut-capable entries that open a dedicated window instead of the
   * generic component dialog, the IPC channel the topbar shortcut button sends
   * when clicked (e.g. 'file-manager:open'). When omitted, shortcut clicks open
   * the component in the shared component dialog.
   */
  readonly shortcutOpenChannel?: string;
}
