/**
 * @fileoverview Type definitions for Spoolman component
 *
 * Defines UI-specific types for the Spoolman filament tracker component,
 * including simplified spool data structures optimized for display.
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

/**
 * Estimate-based tracking view payload for material-station contexts
 * (mirrors spoolman:get-status's `station` field).
 */
export interface SpoolmanStationStatus {
  supported: boolean;
  note: string;
  slotAssignments: Array<{ slotId: number; spoolId: number | null }>;
  lastDeduction: {
    fileName: string;
    terminal: 'completed' | 'cancelled' | 'error';
    fraction: number;
    deductedCount: number;
    skippedCount: number;
    at: string;
  } | null;
}
