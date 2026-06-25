/**
 * @fileoverview Material Station Component Type Definitions
 *
 * Type definitions for the material-station component (AD5X IFS + Creator 5 / 5
 * Pro). Defines layout modes for responsive display and re-exports material
 * station types from the shared polling module.
 *
 * @module ui/components/material-station/types
 */

import type { MaterialSlot, MaterialStationStatus } from '@shared/types/polling.js';

/**
 * Layout mode for the material-station component based on container dimensions
 * - horizontal: Wide container, slots displayed in a row
 * - vertical: Tall container, slots stacked vertically
 * - square: Equal dimensions, 2x2 grid layout
 * - compact: Small container, minimal slot display
 */
export type MaterialStationLayoutMode = 'horizontal' | 'vertical' | 'square' | 'compact';

/**
 * Material-station component state
 */
export interface MaterialStationComponentState {
  /** Whether the material station feature is available for this printer */
  isAvailable: boolean;
  /** Whether the material station is currently connected */
  isConnected: boolean;
  /** Current material slots data */
  slots: MaterialSlot[];
  /** Currently active slot number (1-4) or null */
  activeSlot: number | null;
  /** Error message if any */
  errorMessage: string | null;
  /** Current layout mode */
  layoutMode: MaterialStationLayoutMode;
}

// Re-export for convenience
export type { MaterialSlot, MaterialStationStatus };
