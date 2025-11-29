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
}
