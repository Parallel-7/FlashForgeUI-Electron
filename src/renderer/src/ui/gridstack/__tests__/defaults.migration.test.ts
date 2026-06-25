/**
 * @fileoverview Tests for legacy component-id migration in saved layouts.
 *
 * Component ids are persisted into stored grid layouts, so renaming a component
 * requires mapping its old id on load (see `LEGACY_COMPONENT_ID_RENAMES`). These
 * tests lock in the `ifs-station` -> `material-station` rename so an existing
 * user's saved layout keeps its material-station widget instead of orphaning it.
 *
 * @module ui/gridstack/__tests__/defaults.migration
 */

import {
  LEGACY_COMPONENT_ID_RENAMES,
  mergeWithDefaults,
  migrateComponentId,
} from '../defaults.js';
import type { GridStackWidgetConfig, LayoutConfig } from '../types.js';

describe('migrateComponentId', () => {
  it('maps the legacy ifs-station id to material-station', () => {
    expect(migrateComponentId('ifs-station')).toBe('material-station');
  });

  it('is the identity for the current id and unrelated ids', () => {
    expect(migrateComponentId('material-station')).toBe('material-station');
    expect(migrateComponentId('camera-preview')).toBe('camera-preview');
    expect(migrateComponentId('temperature-controls')).toBe('temperature-controls');
  });

  it('exposes the rename in LEGACY_COMPONENT_ID_RENAMES', () => {
    expect(LEGACY_COMPONENT_ID_RENAMES['ifs-station']).toBe('material-station');
  });
});

describe('mergeWithDefaults migration', () => {
  const widget = (componentId: string): GridStackWidgetConfig => ({
    componentId,
    x: 0,
    y: 0,
    w: 6,
    h: 3,
  });

  it('rewrites a saved widget with the legacy ifs-station id', () => {
    const saved: Partial<LayoutConfig> = {
      version: 1,
      gridOptions: {},
      widgets: [widget('ifs-station'), widget('camera-preview')],
      timestamp: new Date().toISOString(),
    };

    const merged = mergeWithDefaults(saved);
    const ids = merged.widgets.map((w) => w.componentId);

    expect(ids).toContain('material-station');
    expect(ids).not.toContain('ifs-station');
    expect(ids).toContain('camera-preview'); // unrelated widget untouched
  });
});
