// src/types/printer-backend/printer-features.ts
// Type definitions for printer feature management and capabilities

/**
 * Printer feature types that can be available on different printer models
 */
export type PrinterFeatureType = 
  | 'camera'
  | 'led-control'
  | 'filtration'
  | 'gcode-commands'
  | 'status-monitoring'
  | 'job-management'
  | 'material-station';

/**
 * Camera feature configuration
 */
export interface CameraFeature {
  readonly builtin: boolean;
  readonly customUrl: string | null;
  readonly customEnabled: boolean;
}

/**
 * LED control feature configuration
 */
export interface LEDControlFeature {
  readonly builtin: boolean;
  readonly customControlEnabled: boolean;
  readonly usesLegacyAPI: boolean;
}

/**
 * Filtration control feature configuration
 */
export interface FiltrationFeature {
  readonly available: boolean;
  readonly controllable: boolean;
  readonly reason?: string; // Why not available/controllable
}

/**
 * G-code command feature configuration
 */
export interface GCodeCommandFeature {
  readonly available: boolean;
  readonly usesLegacyAPI: boolean;
  readonly supportedCommands: readonly string[]; // G1, M104, etc.
}

/**
 * Status monitoring feature configuration
 */
export interface StatusMonitoringFeature {
  readonly available: boolean;
  readonly usesNewAPI: boolean;
  readonly usesLegacyAPI: boolean;
  readonly realTimeUpdates: boolean;
}

/**
 * Job management feature configuration
 */
export interface JobManagementFeature {
  readonly localJobs: boolean;
  readonly recentJobs: boolean;
  readonly uploadJobs: boolean;
  readonly startJobs: boolean;
  readonly pauseResume: boolean;
  readonly cancelJobs: boolean;
  readonly usesNewAPI: boolean;
}

/**
 * Material station feature configuration (AD5X specific)
 */
export interface MaterialStationFeature {
  readonly available: boolean;
  readonly slotCount: number;
  readonly perSlotInfo: boolean;
  readonly materialDetection: boolean;
}

/**
 * Complete feature set for a printer
 */
export interface PrinterFeatureSet {
  readonly camera: CameraFeature;
  readonly ledControl: LEDControlFeature;
  readonly filtration: FiltrationFeature;
  readonly gcodeCommands: GCodeCommandFeature;
  readonly statusMonitoring: StatusMonitoringFeature;
  readonly jobManagement: JobManagementFeature;
  readonly materialStation: MaterialStationFeature;
}

/**
 * Feature availability result for UI queries
 */
export interface FeatureAvailabilityResult {
  readonly available: boolean;
  readonly reason?: string;
  readonly requiresSettings?: boolean;
  readonly settingsKey?: string;
}

/**
 * Feature override settings from user configuration
 */
export interface FeatureOverrideSettings {
  readonly customCameraEnabled: boolean;
  readonly customCameraUrl: string;
  readonly customLEDControlEnabled: boolean;
  readonly ForceLegacyAPI: boolean;
}

/**
 * Material station slot information (AD5X)
 */
export interface MaterialSlotInfo {
  readonly slotId: number; // 0-based index from API
  readonly materialType: string | null; // Material name from API (PLA, ABS, etc)
  readonly materialColor: string | null; // Hex color string from API
  readonly isEmpty: boolean; // Inverted from API's hasFilament
}

/**
 * Complete material station status (AD5X)
 */
export interface MaterialStationStatus {
  readonly connected: boolean;
  readonly slots: readonly MaterialSlotInfo[];
  readonly activeSlot: number | null;
  readonly overallStatus: 'ready' | 'warming' | 'error' | 'disconnected';
  readonly errorMessage: string | null;
}

/**
 * Feature disable reason for UI feedback
 */
export interface FeatureDisableReason {
  readonly feature: PrinterFeatureType;
  readonly printerModel: string;
  readonly reason: string;
  readonly canBeOverridden: boolean;
  readonly settingsKey?: string;
}
