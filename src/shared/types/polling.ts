/**
 * @fileoverview Type definitions for real-time printer data polling system
 *
 * Provides simple, direct-to-UI type definitions for printer status polling data.
 * Designed for clarity and ease of maintenance with straightforward interfaces that
 * map directly to backend API responses and UI display requirements.
 *
 * Key Type Groups:
 * - Printer State: PrinterState enum for operating status (Ready, Printing, Paused, etc.)
 * - Temperature Data: TemperatureData, PrinterTemperatures for thermal monitoring
 * - Job Progress: JobProgress, CurrentJobInfo for print job tracking
 * - Printer Status: PrinterStatus master interface combining all status data
 * - Material Station: MaterialSlot, MaterialStationStatus for AD5X multi-material
 * - Polling Container: PollingData aggregates all polling information for UI updates
 *
* Utility Functions:
* - State Checking: isActiveState, isReadyForJob
* - Formatting: formatTemperature, formatWeight, formatLength
* - Factory: createEmptyPollingData for initialization
 *
 * Configuration:
 * - DEFAULT_POLLING_CONFIG: 2.5s interval, 3 retries, 1s retry delay
 *
 * Integration Points:
 * - PrinterPollingService: Data collection and transformation
 * - BasePrinterBackend: Raw status data source
 * - ui-updater.ts: Direct UI element updates
 * - PrinterNotificationCoordinator: State change monitoring
 *
 * @module types/polling
 */

// ============================================================================
// PRINTER STATE (SIMPLE)
// ============================================================================

/**
 * Simple printer state enum - tracks current operating status
 */
export type PrinterState = 
  | 'Ready'
  | 'Printing' 
  | 'Paused'
  | 'Completed'
  | 'Error'
  | 'Busy'
  | 'Calibrating'
  | 'Heating'
  | 'Pausing'
  | 'Cancelled';

// ============================================================================
// TEMPERATURE DATA
// ============================================================================

/**
 * Temperature information for bed and extruder
 */
export interface TemperatureData {
  current: number;
  target: number;
  isHeating: boolean;
}

/**
 * Complete temperature status
 */
export interface PrinterTemperatures {
  bed: TemperatureData;
  extruder: TemperatureData;
  chamber?: TemperatureData; // Optional for printers with chamber
}

// ============================================================================
// JOB PROGRESS DATA
// ============================================================================

/**
 * Job progress information
 */
export interface JobProgress {
  percentage: number; // 0-100
  currentLayer: number | null;
  totalLayers: number | null;
  timeRemaining: number | null; // minutes
  elapsedTime: number; // minutes (kept for backward compatibility)
  elapsedTimeSeconds: number; // seconds (for precise time display)
  weightUsed: number; // grams
  lengthUsed: number; // meters
  formattedEta?: string; // formatted ETA from ff-api (e.g. "14:30")
}

/**
 * Current job information
 */
export interface CurrentJobInfo {
  fileName: string;
  displayName: string;
  startTime: Date;
  progress: JobProgress;
  isActive: boolean; // true when printing/paused
}

// ============================================================================
// PRINTER STATUS DATA
// ============================================================================

/**
 * Fan speeds and cooling information
 */
export interface FanStatus {
  coolingFan: number; // 0-100 percentage
  chamberFan: number; // 0-100 percentage
}

/**
 * Filtration system status
 */
export interface FiltrationStatus {
  mode: 'external' | 'internal' | 'none';
  tvocLevel: number;
  available: boolean;
}

/**
 * Printer settings and offsets
 */
export interface PrinterSettings {
  nozzleSize?: number; // mm (e.g. 0.4, 0.6) - undefined for legacy printers
  filamentType?: string; // PLA, ABS, etc - undefined for legacy printers
  speedOffset?: number; // percentage 50-200 - undefined for legacy printers
  zAxisOffset?: number; // mm offset value - undefined for legacy printers
}

/**
 * Cumulative statistics for printer lifetime
 */
export interface CumulativeStats {
  totalPrintTime: number; // minutes
  totalFilamentUsed: number; // meters
}

/**
 * Complete printer status - main data structure
 */
export interface PrinterStatus {
  state: PrinterState;
  temperatures: PrinterTemperatures;
  fans: FanStatus;
  filtration: FiltrationStatus;
  settings: PrinterSettings;
  currentJob: CurrentJobInfo | null;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  lastUpdate: Date;
  cumulativeStats?: CumulativeStats; // Optional for backwards compatibility
}

// ============================================================================
// MATERIAL STATION (AD5X)
// ============================================================================

/**
 * Single material slot for AD5X
 */
export interface MaterialSlot {
  slotId: number; // 1-4
  isEmpty: boolean;
  materialType: string | null; // PLA, ABS, etc
  materialColor: string | null;
  isActive: boolean; // currently selected slot
}

/**
 * AD5X material station status
 */
export interface MaterialStationStatus {
  connected: boolean;
  slots: MaterialSlot[];
  activeSlot: number | null; // 1-4 or null
  errorMessage: string | null;
  lastUpdate: Date;
}

// ============================================================================
// POLLING DATA CONTAINER
// ============================================================================

/**
 * Complete polling data structure - everything the UI needs
 */
export interface PollingData {
  printerStatus: PrinterStatus | null;
  materialStation: MaterialStationStatus | null;
  thumbnailData: string | null; // base64 image data
  isConnected: boolean;
  isInitializing: boolean; // true until first poll completes
  lastPolled: Date;
  logMessages?: unknown[];
}

// ============================================================================
// POLLING CONFIGURATION
// ============================================================================

/**
 * Simple polling configuration
 */
export interface PollingConfig {
  intervalMs: number; // milliseconds between polls
  maxRetries: number; // max retry attempts
  retryDelayMs: number; // delay between retries
}

/**
 * Default polling configuration
 */
export const DEFAULT_POLLING_CONFIG: PollingConfig = {
  intervalMs: 2500, // 2.5 seconds
  maxRetries: 3,
  retryDelayMs: 1000 // 1 second
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if printer is in an active state (disables most buttons for safety)
 */
export function isActiveState(state: PrinterState): boolean {
  return state === 'Printing' || 
         state === 'Paused' ||
         state === 'Calibrating' ||
         state === 'Heating' ||
         state === 'Pausing';
}

/**
 * Check if printer is available for new jobs (enables file selection)
 */

/**
 * Format temperature for display
 */
export function formatTemperature(temp: TemperatureData): string {
  return `${Math.round(temp.current)}°C/${Math.round(temp.target)}°C`;
}

/**
 * Format weight for display
 */
export function formatWeight(grams: number): string {
  return `${Math.round(grams)}g`;
}

/**
 * Format length for display
 */
export function formatLength(meters: number): string {
  return `${meters.toFixed(1)}m`;
}

/**
 * Create empty polling data
 */
export function createEmptyPollingData(): PollingData {
  return {
    printerStatus: null,
    materialStation: null,
    thumbnailData: null,
    isConnected: false,
    isInitializing: true,
    lastPolled: new Date()
  };
}

