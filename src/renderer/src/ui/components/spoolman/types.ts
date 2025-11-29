/**
 * @fileoverview Type definitions for Spoolman component
 *
 * Defines UI-specific types for the Spoolman filament tracker component,
 * including simplified spool data structures optimized for display.
 *
 * @module ui/components/spoolman/types
 */

/**
 * Simplified active spool data for UI display
 * This is a subset of the full SpoolResponse optimized for component rendering
 */
export interface ActiveSpoolData {
  id: number;
  name: string;
  vendor: string | null;
  material: string | null;
  colorHex: string;
  remainingWeight: number; // grams
  remainingLength: number; // mm
}
