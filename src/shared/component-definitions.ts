/**
 * @fileoverview Shared component definitions data
 *
 * Central registry of all available dashboard components with their metadata.
 * Shared between Main process (for Palette window) and Renderer process (for Grid UI).
 */

import type { ComponentDefinition } from './types/components.js';

/**
 * Registry of all available components with their metadata
 * Maps component ID to component definition
 */
export const COMPONENT_REGISTRY_DATA: ReadonlyArray<ComponentDefinition> = [
  // ========================================================================
  // MAIN COMPONENTS
  // ========================================================================

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

  // ========================================================================
  // STATUS BAR COMPONENTS
  // ========================================================================

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

  // ========================================================================
  // UTILITY COMPONENTS
  // ========================================================================

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
];
