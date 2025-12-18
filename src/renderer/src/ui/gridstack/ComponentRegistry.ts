/**
 * @fileoverview Component registry for GridStack dashboard widgets
 *
 * Central registry of all available dashboard components with their metadata,
 * including display names, icons, size constraints, and categorization. Provides
 * query functions for component lookup, validation, and filtering by category.
 * Used by the component palette and layout editor to present available components.
 *
 * Key exports:
 * - getComponentDefinition(): Lookup component by ID
 * - getAllComponents(): Get all registered components
 *
 * Component categories:
 * - main: Primary content components (camera, controls, model preview, job stats)
 * - status-bar: Bottom status bar components (printer status, temperature, etc.)
 * - utility: Utility components (log panel, accessible via Logs button)
 *
 * Usage:
 * ```typescript
 * import { getComponentDefinition } from './ComponentRegistry';
 *
 * const camera = getComponentDefinition('camera-preview');
 * if (camera) {
 *   console.log(camera.name); // "Camera Preview"
 *   console.log(camera.defaultSize); // { w: 6, h: 6 }
 * }
 * ```
 *
 * @module ui/gridstack/ComponentRegistry
 */

import type { ComponentDefinition } from './types.js';
import { COMPONENT_REGISTRY_DATA } from '@shared/component-definitions.js';

/**
 * Registry of all available components with their metadata
 * Maps component ID to component definition
 */
const COMPONENT_REGISTRY: ReadonlyMap<string, ComponentDefinition> = new Map(
  COMPONENT_REGISTRY_DATA.map(comp => [comp.id, comp])
);

/**
 * Get component definition by ID
 * @param componentId - The component ID to look up
 * @returns Component definition or undefined if not found
 */
export function getComponentDefinition(
  componentId: string
): ComponentDefinition | undefined {
  return COMPONENT_REGISTRY.get(componentId);
}

/**
 * Get all component definitions
 * @returns Array of all component definitions
 */
export function getAllComponents(): ComponentDefinition[] {
  return Array.from(COMPONENT_REGISTRY.values());
}

