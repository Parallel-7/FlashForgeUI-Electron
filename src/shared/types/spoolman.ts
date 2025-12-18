/**
 * @fileoverview Type definitions for Spoolman integration
 *
 * Defines TypeScript interfaces for the Spoolman REST API responses and request payloads.
 * Spoolman is a self-hosted filament inventory management system that tracks spool usage,
 * material properties, and vendor information.
 *
 * API Documentation: https://github.com/Donkie/Spoolman
 *
 * Key Types:
 * - SpoolResponse: Complete spool object with filament and usage data
 * - FilamentObject: Filament properties including material, color, and vendor
 * - VendorObject: Filament vendor information
 * - SpoolSearchQuery: Query parameters for searching spools
 * - SpoolUsageUpdate: Payload for updating filament usage
 * - ActiveSpoolData: Simplified spool data for UI components
 *
 * @module types/spoolman
 */

/**
 * Spoolman API response for a single spool
 */
export interface SpoolResponse {
  // Required fields
  id: number;
  registered: string; // UTC timestamp
  filament: FilamentObject;
  used_weight: number; // ≥0 grams
  used_length: number; // ≥0 mm
  archived: boolean;
  extra: Record<string, string>; // Custom fields

  // Optional fields
  first_used: string | null;
  last_used: string | null;
  price: number | null; // ≥0
  remaining_weight: number | null; // ≥0 grams
  initial_weight: number | null; // ≥0 grams
  spool_weight: number | null; // ≥0 grams (empty spool weight)
  remaining_length: number | null; // ≥0 mm
  location: string | null; // max 64 chars
  lot_nr: string | null; // max 64 chars
  comment: string | null; // max 1024 chars
}

/**
 * Filament object from Spoolman
 */
export interface FilamentObject {
  // Required
  id: number;
  registered: string;
  density: number; // g/cm³
  diameter: number; // mm

  // Optional
  name: string; // max 64 chars
  vendor: VendorObject | null;
  material: string | null; // max 64 chars (e.g., "PLA")
  color_hex: string | null; // 6-8 chars (e.g., "#FF5733")
  multi_color_hexes: string | null;
  multi_color_direction: 'coaxial' | 'longitudinal' | null;
  weight: number | null; // grams
  spool_weight: number | null; // grams
  article_number: string | null; // max 64 chars
  settings_extruder_temp: number | null; // °C
  settings_bed_temp: number | null; // °C
  price: number | null;
  comment: string | null;
  external_id: string | null;
  extra: Record<string, string>;
}

/**
 * Vendor object from Spoolman
 */
export interface VendorObject {
  id: number;
  registered: string;
  name: string; // max 64 chars
  empty_spool_weight: number | null; // grams
  external_id: string | null;
  extra: Record<string, string>;
}

/**
 * Search query parameters for spool API
 */
export interface SpoolSearchQuery {
  'filament.name'?: string;
  'filament.material'?: string;
  'filament.vendor.name'?: string;
  location?: string;
  allow_archived?: boolean;
  limit?: number;
  offset?: number;
  sort?: string;
}

/**
 * Filament usage update parameters
 * CRITICAL: Must specify EITHER use_weight OR use_length, never both
 */
export interface SpoolUsageUpdate {
  use_length?: number; // mm
  use_weight?: number; // grams
}

/**
 * Simplified active spool data for UI display
 */
export interface ActiveSpoolData {
  id: number;
  name: string;
  vendor: string | null;
  material: string | null;
  colorHex: string;
  remainingWeight: number; // grams
  remainingLength: number; // mm
  lastUpdated: string; // ISO 8601 timestamp
}

/**
 * Connection test result
 */
export interface SpoolmanConnectionTest {
  connected: boolean;
  error?: string;
}
