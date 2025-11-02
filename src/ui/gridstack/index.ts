/**
 * @fileoverview GridStack module exports
 *
 * Central export point for all GridStack-related modules, types, and utilities.
 * Import from this file to access GridStack functionality throughout the application.
 * Provides managers, controllers, type definitions, defaults, and component registry.
 *
 * Exported modules:
 * - GridStackManager: Core grid management and widget operations
 * - LayoutPersistence: Layout saving/loading to localStorage
 * - EditModeController: Edit mode state and keyboard shortcuts
 * - ComponentRegistry: Component definitions and metadata
 * - Types: All TypeScript type definitions
 * - Defaults: Default layout configurations and helpers
 *
 * Usage:
 * ```typescript
 * // Import managers
 * import {
 *   gridStackManager,
 *   layoutPersistence,
 *   editModeController
 * } from './ui/gridstack';
 *
 * // Import types
 * import type {
 *   LayoutConfig,
 *   GridStackWidgetConfig
 * } from './ui/gridstack';
 *
 * // Import component registry
 * import {
 *   getComponentDefinition,
 *   getAllComponents
 * } from './ui/gridstack';
 * ```
 *
 * @module ui/gridstack
 */

// Managers and Controllers
export { GridStackManager, gridStackManager } from './GridStackManager';
export { LayoutPersistence, layoutPersistence } from './LayoutPersistence';
export { EditModeController, editModeController } from './EditModeController';

// Types
export type {
  GridStackWidgetConfig,
  LayoutConfig,
  GridOptions,
  ComponentDefinition,
  ComponentSize,
  GridStackInstance,
  GridStackWidget,
  LayoutValidationResult,
  LayoutPersistenceOptions,
  EditModeState,
  GridEventData,
} from './types';

// Defaults and Configuration
export {
  DEFAULT_GRID_OPTIONS,
  DEFAULT_WIDGETS,
  DEFAULT_LAYOUT,
  getDefaultLayout,
  getDefaultGridOptions,
  getDefaultWidgets,
  isValidLayout,
  mergeWithDefaults,
} from './defaults';

// Component Registry
export {
  getComponentDefinition,
  getAllComponents,
  getComponentsByCategory,
  getRequiredComponents,
  getOptionalComponents,
  isValidComponentId,
  getComponentDisplayName,
  getComponentIcon,
  validateComponentSize,
  getRecommendedComponents,
} from './ComponentRegistry';
