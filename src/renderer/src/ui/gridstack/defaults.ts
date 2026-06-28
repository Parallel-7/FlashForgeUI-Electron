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

import type { PrinterModelType } from '@shared/types/printer-backend/index.js';
import { getComponentDefinition } from './ComponentRegistry.js';
import type { GridOptions, GridStackWidgetConfig, LayoutConfig } from './types.js';

/**
 * Legacy → current component-id renames, applied when loading a saved layout.
 * Component ids are persisted in stored layouts (and layout history), so renaming
 * a component requires mapping its old id here or saved widgets would orphan.
 * Add one entry per rename; keep old entries indefinitely.
 */
export const LEGACY_COMPONENT_ID_RENAMES: Readonly<Record<string, string>> = {
  // The IFS station component was renamed to "material-station" (it also serves
  // the Creator 5 series now, not just the AD5X IFS).
  'ifs-station': 'material-station',
};

/** Map a possibly-legacy component id to its current id (identity if unchanged). */
export function migrateComponentId(componentId: string): string {
  return LEGACY_COMPONENT_ID_RENAMES[componentId] ?? componentId;
}

/**
 * Current layout schema version. Bumped when a one-time, capability-conditional
 * migration needs to run against a printer's persisted layout (see
 * {@link migrateLayoutForToolChanger}). A layout is migrated at most once: after
 * it runs, the layout is stamped with this version and saved, so it never repeats.
 *
 * v3: the v2 tool-changer migration could be silently dropped when it ran before the
 * layout persistence layer was initialized, leaving early testers stamped at v2 but
 * still showing the generic temperature card. Bumping to v3 forces the (now correctly
 * timed) migration to run once more for those layouts; it is idempotent for layouts
 * that already carry the Creator 5 card.
 */
export const LAYOUT_SCHEMA_VERSION = 3;

/** The unified Creator 5 temperature card. */
const C5_TEMP_CARD_ID = 'creator5-temperature';
/** Generic/legacy temperature cards folded into the Creator 5 card on a tool-changer. */
const C5_TEMP_REPLACED_IDS = new Set(['temperature-controls', 'tool-temps']);

/**
 * Whether a model type identifies a Creator 5 series tool-changer. Reads the
 * authoritative PID-derived {@link PrinterModelType} (`creator-5` / `creator-5-pro`)
 * rather than substring-matching the user-mutable model/name string.
 */
export function isCreator5ModelType(modelType: PrinterModelType | null | undefined): boolean {
  return modelType === 'creator-5' || modelType === 'creator-5-pro';
}

/**
 * One-time, version-gated migration for tool-changer printers (Creator 5 / 5 Pro).
 *
 * Replaces the generic `temperature-controls` and read-only `tool-temps` widgets
 * with the single, settable `creator5-temperature` card (preserving the temp
 * card's grid position; the card is a singleton so duplicates are collapsed).
 * Non-tool-changer layouts and already-migrated layouts are returned unchanged
 * (same reference), so callers can persist only when something actually changed.
 *
 * @param layout The loaded layout for a specific printer.
 * @param isToolChanger Whether the connected printer is a Creator 5 series.
 * @returns The migrated layout (new object) or the original (unchanged) reference.
 */
export function migrateLayoutForToolChanger(
  layout: LayoutConfig,
  isToolChanger: boolean
): LayoutConfig {
  if (!isToolChanger || (layout.version ?? 1) >= LAYOUT_SCHEMA_VERSION) {
    return layout;
  }

  let hasCard = false;
  const widgets: GridStackWidgetConfig[] = [];
  for (const widget of layout.widgets) {
    const id = migrateComponentId(widget.componentId);

    if (id === C5_TEMP_CARD_ID) {
      if (hasCard) continue; // singleton — keep the first
      hasCard = true;
      widgets.push({ ...widget, componentId: id });
      continue;
    }

    if (C5_TEMP_REPLACED_IDS.has(id)) {
      if (hasCard) continue; // a C5 card already took a slot; drop the redundant one
      const def = getComponentDefinition(C5_TEMP_CARD_ID);
      widgets.push({
        ...widget,
        componentId: C5_TEMP_CARD_ID,
        minW: def?.minSize.w ?? widget.minW,
        minH: def?.minSize.h ?? widget.minH,
        id: `widget-${C5_TEMP_CARD_ID}`,
      });
      hasCard = true;
      continue;
    }

    widgets.push(widget);
  }

  return { ...layout, widgets, version: LAYOUT_SCHEMA_VERSION };
}

/**
 * Default grid options matching current layout behavior
 */
export const DEFAULT_GRID_OPTIONS: GridOptions = {
  column: 12, // 12-column grid for flexible layouts
  cellHeight: 80, // 80px per grid unit
  margin: 8, // 8px margin between widgets
  float: false, // Don't float widgets up (maintain explicit positioning)
  animate: true, // Smooth animations for movements
  minRow: 10, // Minimum 10 rows to fit all components (increased for taller status bar)
  staticGrid: true, // Static by default (editable in edit mode)
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
    minW: 2,
    minH: 2,
    id: 'widget-camera-preview',
  },

  // Right side top - Controls Grid
  {
    componentId: 'controls-grid',
    x: 6,
    y: 0,
    w: 6,
    h: 3,
    minW: 2,
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
    minW: 2,
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
    minW: 2,
    minH: 2,
    id: 'widget-job-stats',
  },

  // Status bar - Printer Status (bottom left)
  {
    componentId: 'printer-status',
    x: 0,
    y: 8,
    w: 3,
    h: 2,
    minW: 2,
    minH: 2,
    id: 'widget-printer-status',
  },

  // Status bar - Temperature Controls (bottom center-left)
  {
    componentId: 'temperature-controls',
    x: 3,
    y: 8,
    w: 3,
    h: 2,
    minW: 2,
    minH: 2,
    id: 'widget-temperature-controls',
  },

  // Status bar - Filtration Controls (bottom center-right)
  {
    componentId: 'filtration-controls',
    x: 6,
    y: 8,
    w: 3,
    h: 2,
    minW: 2,
    minH: 2,
    id: 'widget-filtration-controls',
  },

  // Status bar - Additional Info (bottom right)
  {
    componentId: 'additional-info',
    x: 9,
    y: 8,
    w: 3,
    h: 2,
    minW: 2,
    minH: 2,
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
    widgets: DEFAULT_WIDGETS.map((w) => ({ ...w })),
    timestamp: new Date().toISOString(),
  };
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
 * Also applies current ComponentRegistry minSize values to ensure saved layouts
 * pick up the latest minimum size constraints
 */
export function mergeWithDefaults(userLayout: Partial<LayoutConfig>): LayoutConfig {
  const defaultLayout = getDefaultLayout();

  // Get user widgets or default widgets
  const baseWidgets = userLayout.widgets ?? defaultLayout.widgets;

  // Migrate any legacy component ids first (saved layouts may reference old ids),
  // then apply current ComponentRegistry minSize values to each widget.
  const widgetsWithUpdatedMinSize = baseWidgets.map((widget) => {
    const componentId = migrateComponentId(widget.componentId);
    const migrated = componentId === widget.componentId ? widget : { ...widget, componentId };
    const componentDef = getComponentDefinition(componentId);
    if (componentDef) {
      return {
        ...migrated,
        minW: componentDef.minSize.w,
        minH: componentDef.minSize.h,
      };
    }
    return migrated;
  });

  return {
    version: userLayout.version ?? defaultLayout.version,
    contextId: userLayout.contextId,
    gridOptions: {
      ...defaultLayout.gridOptions,
      ...userLayout.gridOptions,
    },
    widgets: widgetsWithUpdatedMinSize,
    timestamp: userLayout.timestamp ?? defaultLayout.timestamp,
    name: userLayout.name ?? defaultLayout.name,
    isDefault: userLayout.isDefault ?? false,
  };
}
