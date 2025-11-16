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
 * - getAllComponents(): Get all registered components (9 total)
 * - getComponentsByCategory(): Filter components by category
 * - getRequiredComponents(): Get only required components
 * - getOptionalComponents(): Get only optional components
 * - isValidComponentId(): Check if component ID exists
 * - getComponentDisplayName(): Get display name for component
 * - getComponentIcon(): Get icon string for component
 * - validateComponentSize(): Validate and clamp widget dimensions
 * - getRecommendedComponents(): Get recommended component set
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

import type { ComponentDefinition } from './types';

/**
 * Registry of all available components with their metadata
 * Maps component ID to component definition
 */
const COMPONENT_REGISTRY: ReadonlyMap<string, ComponentDefinition> = new Map([
  // ========================================================================
  // MAIN COMPONENTS
  // ========================================================================

  [
    'camera-preview',
    {
      id: 'camera-preview',
      name: 'Camera Preview',
      icon: 'camera',
      defaultSize: { w: 6, h: 6 },
      minSize: { w: 2, h: 2 },
      category: 'main',
      description: 'Live camera stream from printer',
      required: true,
      singleton: true,
    },
  ],

  [
    'controls-grid',
    {
      id: 'controls-grid',
      name: 'Printer Controls',
      icon: 'gamepad-2',
      defaultSize: { w: 6, h: 3 },
      minSize: { w: 2, h: 2 },
      category: 'main',
      description: 'LED controls, print controls, and quick actions',
      required: true,
      singleton: true,
    },
  ],

  [
    'model-preview',
    {
      id: 'model-preview',
      name: 'Model Preview',
      icon: 'box',
      defaultSize: { w: 6, h: 3 },
      minSize: { w: 2, h: 2 },
      category: 'main',
      description: 'Current job model preview and information',
      required: false,
      singleton: true,
    },
  ],

  [
    'job-stats',
    {
      id: 'job-stats',
      name: 'Job Statistics',
      icon: 'bar-chart-3',
      defaultSize: { w: 6, h: 2 },
      minSize: { w: 2, h: 2 },
      category: 'main',
      description: 'Current job progress, time remaining, and statistics',
      required: false,
      singleton: true,
    },
  ],

  // ========================================================================
  // STATUS BAR COMPONENTS
  // ========================================================================

  [
    'printer-status',
    {
      id: 'printer-status',
      name: 'Printer Status',
      icon: 'printer',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      category: 'status-bar',
      description: 'Current printer state and status indicators',
      required: true,
      singleton: true,
    },
  ],

  [
    'temperature-controls',
    {
      id: 'temperature-controls',
      name: 'Temperature Controls',
      icon: 'thermometer',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      category: 'status-bar',
      description: 'Bed and extruder temperature controls',
      required: true,
      singleton: true,
    },
  ],

  [
    'filtration-controls',
    {
      id: 'filtration-controls',
      name: 'Filtration Controls',
      icon: 'wind',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      category: 'status-bar',
      description: 'Air filtration control buttons',
      required: false,
      singleton: true,
    },
  ],

  [
    'additional-info',
    {
      id: 'additional-info',
      name: 'Additional Info',
      icon: 'info',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      category: 'status-bar',
      description: 'Layer count, machine hours, and other information',
      required: false,
      singleton: true,
    },
  ],

  // ========================================================================
  // UTILITY COMPONENTS
  // ========================================================================

  [
    'log-panel',
    {
      id: 'log-panel',
      name: 'Log Panel',
      icon: 'scroll-text',
      defaultSize: { w: 12, h: 3 },
      minSize: { w: 2, h: 2 },
      category: 'utility',
      description: 'Application logs and messages (accessible via Logs button)',
      required: false,
      singleton: true,
    },
  ],

  [
    'spoolman-tracker',
    {
      id: 'spoolman-tracker',
      name: 'Spoolman Tracker',
      icon: 'package',
      defaultSize: { w: 3, h: 2 },
      minSize: { w: 2, h: 2 },
      category: 'main',
      description: 'Track active filament spool from Spoolman server',
      required: false,
      singleton: true,
    },
  ],
]);

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

/**
 * Get component definitions by category
 * @param category - The category to filter by
 * @returns Array of component definitions in the category
 */
export function getComponentsByCategory(
  category: ComponentDefinition['category']
): ComponentDefinition[] {
  return getAllComponents().filter((comp) => comp.category === category);
}

/**
 * Get all required components
 * @returns Array of required component definitions
 */
export function getRequiredComponents(): ComponentDefinition[] {
  return getAllComponents().filter((comp) => comp.required);
}

/**
 * Get all optional components
 * @returns Array of optional component definitions
 */
export function getOptionalComponents(): ComponentDefinition[] {
  return getAllComponents().filter((comp) => !comp.required);
}

/**
 * Check if a component ID exists in the registry
 * @param componentId - The component ID to check
 * @returns True if component exists in registry
 */
export function isValidComponentId(componentId: string): boolean {
  return COMPONENT_REGISTRY.has(componentId);
}

/**
 * Get component display name
 * @param componentId - The component ID
 * @returns Display name or component ID if not found
 */
export function getComponentDisplayName(componentId: string): string {
  const definition = COMPONENT_REGISTRY.get(componentId);
  return definition ? definition.name : componentId;
}

/**
 * Get component icon
 * @param componentId - The component ID
 * @returns Icon string or empty string if not found
 */
export function getComponentIcon(componentId: string): string {
  const definition = COMPONENT_REGISTRY.get(componentId);
  return definition ? definition.icon : '';
}

/**
 * Validate component size against constraints
 * @param componentId - The component ID
 * @param width - Proposed width in grid units
 * @param height - Proposed height in grid units
 * @returns Validation result with clamped values if needed
 */
export function validateComponentSize(
  componentId: string,
  width: number,
  height: number
): {
  valid: boolean;
  width: number;
  height: number;
  errors?: string[];
} {
  const definition = COMPONENT_REGISTRY.get(componentId);

  if (!definition) {
    return {
      valid: false,
      width,
      height,
      errors: [`Unknown component: ${componentId}`],
    };
  }

  const errors: string[] = [];
  let finalWidth = width;
  let finalHeight = height;

  // Check minimum constraints
  if (width < definition.minSize.w) {
    errors.push(
      `Width ${width} is below minimum ${definition.minSize.w} for ${definition.name}`
    );
    finalWidth = definition.minSize.w;
  }

  if (height < definition.minSize.h) {
    errors.push(
      `Height ${height} is below minimum ${definition.minSize.h} for ${definition.name}`
    );
    finalHeight = definition.minSize.h;
  }

  // Check maximum constraints if defined
  if (definition.maxSize) {
    if (width > definition.maxSize.w) {
      errors.push(
        `Width ${width} exceeds maximum ${definition.maxSize.w} for ${definition.name}`
      );
      finalWidth = definition.maxSize.w;
    }

    if (height > definition.maxSize.h) {
      errors.push(
        `Height ${height} exceeds maximum ${definition.maxSize.h} for ${definition.name}`
      );
      finalHeight = definition.maxSize.h;
    }
  }

  return {
    valid: errors.length === 0,
    width: finalWidth,
    height: finalHeight,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Get recommended components for a layout
 * Returns required components plus commonly used optional components
 */
export function getRecommendedComponents(): ComponentDefinition[] {
  const required = getRequiredComponents();
  const recommended = getAllComponents().filter(
    (comp) =>
      !comp.required &&
      (comp.id === 'model-preview' ||
        comp.id === 'job-stats' ||
        comp.id === 'additional-info')
  );
  return [...required, ...recommended];
}
