/**
 * @fileoverview Default layout configurations for GridStack dashboard
 *
 * Defines the default grid layout that matches the original fixed layout in FlashForgeUI.
 * Includes grid options, widget positions, and helper functions for layout validation
 * and merging. The default layout uses a 12-column grid system with 80px cell height,
 * replicating the existing UI structure while enabling future customization.
 *
 * Key exports:
 * - DEFAULT_GRID_OPTIONS: 12-column grid with 80px cell height and 8px margins
 * - DEFAULT_WIDGETS: Component positions matching original layout (8 components)
 * - DEFAULT_LAYOUT: Complete default layout configuration with metadata
 * - getDefaultLayout(): Factory function for fresh default layouts
 * - getDefaultGridOptions(): Returns fresh copy of default grid options
 * - getDefaultWidgets(): Returns fresh copy of default widget configurations
 * - isValidLayout(): Validates layout configuration structure
 * - mergeWithDefaults(): Merges user layout with defaults to fill missing properties
 *
 * Layout structure (12-column grid, 80px cell height):
 * - Left: Camera preview (6w×6h, columns 0-5)
 * - Right top: Controls grid (6w×3h, columns 6-11, rows 0-2)
 * - Right middle: Model preview (6w×3h, columns 6-11, rows 3-5)
 * - Right bottom: Job stats (6w×2h, columns 6-11, rows 6-7)
 * - Bottom: Status bar (4 components, 3w×1h each, row 8)
 *
 * @module ui/gridstack/defaults
 */

import type { LayoutConfig, GridStackWidgetConfig, GridOptions } from './types';

/**
 * Default grid options matching current layout behavior
 */
export const DEFAULT_GRID_OPTIONS: GridOptions = {
  column: 12,                    // 12-column grid for flexible layouts
  cellHeight: 80,                // 80px per grid unit
  margin: 8,                     // 8px margin between widgets
  float: false,                  // Don't float widgets up (maintain explicit positioning)
  animate: true,                 // Smooth animations for movements
  minRow: 9,                     // Minimum 9 rows to fit all components
  staticGrid: true,              // Static by default (editable in edit mode)
};

/**
 * Default widget configurations matching current fixed layout
 *
 * Grid layout visualization (12 columns × 9 rows):
 *
 * Row 0-5: [Camera Preview (6w×6h)] [Controls Grid (6w×3h)]
 * Row 3-5:                          [Model Preview (6w×3h)]
 * Row 6-7:                          [Job Stats (6w×2h)]
 * Row 8:   [Printer Status (3w×1h)] [Temperature (3w×1h)] [Filtration (3w×1h)] [Additional Info (3w×1h)]
 */
export const DEFAULT_WIDGETS: readonly GridStackWidgetConfig[] = [
  // Left side - Camera Preview (full left side, 6 rows tall)
  {
    componentId: 'camera-preview',
    x: 0,
    y: 0,
    w: 6,
    h: 6,
    minW: 4,
    minH: 4,
    id: 'widget-camera-preview',
  },

  // Right side top - Controls Grid
  {
    componentId: 'controls-grid',
    x: 6,
    y: 0,
    w: 6,
    h: 3,
    minW: 4,
    minH: 2,
    id: 'widget-controls-grid',
  },

  // Right side middle - Model Preview
  {
    componentId: 'model-preview',
    x: 6,
    y: 3,
    w: 6,
    h: 3,
    minW: 4,
    minH: 2,
    id: 'widget-model-preview',
  },

  // Right side bottom - Job Stats
  {
    componentId: 'job-stats',
    x: 6,
    y: 6,
    w: 6,
    h: 2,
    minW: 4,
    minH: 1,
    id: 'widget-job-stats',
  },

  // Status bar - Printer Status (bottom left)
  {
    componentId: 'printer-status',
    x: 0,
    y: 8,
    w: 3,
    h: 1,
    minW: 2,
    minH: 1,
    id: 'widget-printer-status',
  },

  // Status bar - Temperature Controls (bottom center-left)
  {
    componentId: 'temperature-controls',
    x: 3,
    y: 8,
    w: 3,
    h: 1,
    minW: 2,
    minH: 1,
    id: 'widget-temperature-controls',
  },

  // Status bar - Filtration Controls (bottom center-right)
  {
    componentId: 'filtration-controls',
    x: 6,
    y: 8,
    w: 3,
    h: 1,
    minW: 2,
    minH: 1,
    id: 'widget-filtration-controls',
  },

  // Status bar - Additional Info (bottom right)
  {
    componentId: 'additional-info',
    x: 9,
    y: 8,
    w: 3,
    h: 1,
    minW: 2,
    minH: 1,
    id: 'widget-additional-info',
  },
];

/**
 * Default complete layout configuration
 * This is the base configuration used when no saved layout exists
 */
export const DEFAULT_LAYOUT: LayoutConfig = {
  version: 1,
  gridOptions: DEFAULT_GRID_OPTIONS,
  widgets: DEFAULT_WIDGETS,
  timestamp: new Date().toISOString(),
  name: 'Default Layout',
  isDefault: true,
};

/**
 * Get the default layout configuration
 * Returns a fresh copy to avoid mutations
 */
export function getDefaultLayout(): LayoutConfig {
  return {
    ...DEFAULT_LAYOUT,
    gridOptions: { ...DEFAULT_GRID_OPTIONS },
    widgets: DEFAULT_WIDGETS.map(w => ({ ...w })),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get default grid options
 * Returns a fresh copy to avoid mutations
 */
export function getDefaultGridOptions(): GridOptions {
  return { ...DEFAULT_GRID_OPTIONS };
}

/**
 * Get default widget configurations
 * Returns a fresh copy to avoid mutations
 */
export function getDefaultWidgets(): GridStackWidgetConfig[] {
  return DEFAULT_WIDGETS.map(w => ({ ...w }));
}

/**
 * Validate that a layout config matches the expected structure
 * Useful for migration and error checking
 */
export function isValidLayout(config: unknown): config is LayoutConfig {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  const layout = config as Partial<LayoutConfig>;

  return (
    typeof layout.version === 'number' &&
    typeof layout.gridOptions === 'object' &&
    layout.gridOptions !== null &&
    Array.isArray(layout.widgets) &&
    typeof layout.timestamp === 'string'
  );
}

/**
 * Merge user layout with defaults
 * Fills in missing widgets and options from defaults
 */
export function mergeWithDefaults(userLayout: Partial<LayoutConfig>): LayoutConfig {
  const defaultLayout = getDefaultLayout();

  return {
    version: userLayout.version ?? defaultLayout.version,
    contextId: userLayout.contextId,
    gridOptions: {
      ...defaultLayout.gridOptions,
      ...userLayout.gridOptions,
    },
    widgets: userLayout.widgets ?? defaultLayout.widgets,
    timestamp: userLayout.timestamp ?? defaultLayout.timestamp,
    name: userLayout.name ?? defaultLayout.name,
    isDefault: userLayout.isDefault ?? false,
  };
}
