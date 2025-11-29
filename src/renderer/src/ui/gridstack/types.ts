/**
 * @fileoverview GridStack Type Definitions
 *
 * This file defines TypeScript types and interfaces for the GridStack.js integration.
 * It provides type safety for grid layouts, widget configurations, and component metadata.
 *
 * Key types:
 * - GridStackWidgetConfig: Individual widget position and size configuration
 * - LayoutConfig: Complete layout configuration with metadata
 * - GridOptions: GridStack initialization options
 * - ComponentDefinition: Component metadata for registry
 */

import type { GridStack, GridStackWidget as GSWidget } from 'gridstack';
import type { ComponentSize, ComponentDefinition } from '@shared/types/components.js';

export type { ComponentSize, ComponentDefinition };

/**
 * Defines position, size, and constraints for a single component in the grid
 */
export interface GridStackWidgetConfig {
  /** Unique component ID */
  readonly componentId: string;

  /** X position in grid units (0-11 in 12-column grid) */
  x?: number;

  /** Y position in grid units */
  y?: number;

  /** Width in grid units (1-12) */
  w: number;

  /** Height in grid units */
  h: number;

  /** Minimum width in grid units */
  minW?: number;

  /** Minimum height in grid units */
  minH?: number;

  /** Maximum width in grid units */
  maxW?: number;

  /** Maximum height in grid units */
  maxH?: number;

  /** Whether widget can be moved */
  noMove?: boolean;

  /** Whether widget can be resized */
  noResize?: boolean;

  /** Whether widget is locked in place */
  locked?: boolean;

  /** Unique widget ID for GridStack (auto-generated if not provided) */
  id?: string;

  /** Whether GridStack should auto-place the widget */
  autoPosition?: boolean;
}

/**
 * Complete layout configuration
 * Includes grid options, widget configs, and metadata
 */
export interface LayoutConfig {
  /** Layout configuration version for migration support */
  readonly version: number;

  /** Optional context ID for multi-printer layouts */
  readonly contextId?: string;

  /** Grid initialization options */
  readonly gridOptions: GridOptions;

  /** Array of widget configurations */
  readonly widgets: readonly GridStackWidgetConfig[];

  /** Timestamp when layout was saved */
  readonly timestamp: string;

  /** Optional user-defined layout name */
  readonly name?: string;

  /** Whether this is the default layout */
  readonly isDefault?: boolean;
}

/**
 * GridStack initialization options
 * Controls grid behavior and appearance
 * Note: Uses partial GridStack.GridStackOptions for compatibility
 */
export interface GridOptions {
  /** Number of columns in grid (default: 12) */
  column?: number;

  /** Cell height in pixels or 'auto' (default: 80) */
  cellHeight?: number | string;

  /** Margin between widgets in pixels (default: 8) */
  margin?: number;

  /** Whether widgets should float up to fill empty space (default: false) */
  float?: boolean;

  /** Enable animation for widget movements (default: true) */
  animate?: boolean;

  /** Minimum number of rows */
  minRow?: number;

  /** Maximum number of rows */
  maxRow?: number;

  /** Static grid - no moving or resizing */
  staticGrid?: boolean;
}

/**
 * GridStack instance type re-export
 */
export type GridStackInstance = GridStack;

/**
 * GridStack widget type re-export
 */
export type GridStackWidget = GSWidget;

/**
 * Layout validation result
 */
export interface LayoutValidationResult {
  /** Whether layout is valid */
  readonly valid: boolean;

  /** Validation errors if any */
  readonly errors?: readonly string[];

  /** Validation warnings if any */
  readonly warnings?: readonly string[];
}

/**
 * Layout persistence options
 */
export interface LayoutPersistenceOptions {
  /** Whether to save automatically on changes */
  readonly autoSave?: boolean;

  /** Debounce delay for auto-save in milliseconds */
  readonly debounceMs?: number;

  /** Maximum number of layout history entries */
  readonly maxHistory?: number;

  /** Whether to compress saved layouts */
  readonly compress?: boolean;
}

/**
 * Edit mode state
 */
export interface EditModeState {
  /** Whether edit mode is active */
  readonly enabled: boolean;

  /** Timestamp when edit mode was enabled */
  readonly enabledAt?: Date;

  /** Whether there are unsaved changes */
  readonly hasChanges: boolean;

  /** Number of changes since last save */
  readonly changeCount: number;
}

/**
 * Grid event data types
 */
export interface GridEventData {
  /** Added widget event */
  added?: {
    widget: GridStackWidget;
  };

  /** Removed widget event */
  removed?: {
    widget: GridStackWidget;
  };

  /** Changed widget event */
  change?: {
    widgets: readonly GridStackWidget[];
  };

  /** Dropped widget event */
  dropped?: {
    widget: GridStackWidget;
    previousWidget?: GridStackWidget;
  };
}
