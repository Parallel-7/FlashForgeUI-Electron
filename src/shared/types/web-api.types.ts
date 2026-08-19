/**
 * @fileoverview Shared WebUI API and WebSocket contract types.
 *
 * Defines authentication payloads, context and printer status responses,
 * camera and Spoolman response shapes, and client/server WebSocket messages
 * shared by the WebUI server routes and static client modules.
 */

import type { RebootStatusPayload } from './printer-power.js';

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

export interface WebUIAuthStatus {
  hasPassword: boolean;
  defaultPassword: boolean;
  authRequired: boolean;
}

export interface WebUILoginRequest {
  password: string;
  rememberMe?: boolean;
}

export interface WebUILoginResponse {
  success: boolean;
  token?: string;
  message?: string;
}

// ============================================================================
// WEBSOCKET TYPES
// ============================================================================

/**
 * Spoolman active spool data for WebSocket updates
 */
export interface ActiveSpoolData {
  id: number;
  name: string;
  vendor: string | null;
  material: string | null;
  colorHex: string;
  remainingWeight: number;
  remainingLength: number;
  lastUpdated: string;
}

/**
 * WebSocket message types for real-time communication
 */
export interface WebSocketMessage {
  type: 'AUTH_SUCCESS' | 'STATUS_UPDATE' | 'ERROR' | 'COMMAND_RESULT' | 'PONG' | 'SPOOLMAN_UPDATE' | 'REBOOT_STATUS';
  timestamp: string;
  status?: PrinterStatusData | null;
  error?: string;
  clientId?: string;
  command?: string;
  success?: boolean;
  contextId?: string;
  spool?: ActiveSpoolData | null;
  reboot?: RebootStatusPayload;
}

/**
 * WebSocket command types for client-to-server communication
 */
export interface WebSocketCommand {
  command: 'REQUEST_STATUS' | 'EXECUTE_GCODE' | 'PING';
  gcode?: string;
  data?: unknown;
}

/**
 * Per-tool temperature reading for multi-tool printers (Creator 5 series).
 * One entry per nozzle; index 0 maps to the printer's T1 in the UI.
 */
export interface ToolTemperatureData {
  current: number;
  target: number;
}

/**
 * Extended printer status data for WebSocket transmission
 * Extends PrinterStatus with additional fields like thumbnails
 */
export interface PrinterStatusData {
  printerState: string;
  bedTemperature: number;
  bedTargetTemperature: number;
  nozzleTemperature: number;
  nozzleTargetTemperature: number;
  progress: number;
  currentLayer?: number;
  totalLayers?: number;
  jobName: string | null;
  timeElapsed?: number;
  timeRemaining?: number;
  filtrationMode: 'external' | 'internal' | 'none';
  estimatedWeight?: number;
  estimatedLength?: number;
  thumbnailData?: string | null;
  cumulativeFilament?: number;
  cumulativePrintTime?: number;
  formattedEta?: string;
  /** Library completion timestamp, serialized to ISO. Null while the print is not advancing. */
  completionTime?: string | null;
  elapsedTimeSeconds?: number;
  // Creator 5 series (multi-tool) fields. Undefined/empty on single-nozzle printers.
  toolTemps?: ToolTemperatureData[];
  chamberTemperature?: number;
  chamberTargetTemperature?: number;
  hasChamberControl?: boolean;
  isCreator5Pro?: boolean;
  tvocLevel?: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface StandardAPIResponse {
  success: boolean;
  error?: string;
  message?: string;
}

export interface CameraStatusResponse {
  available: boolean;
  streaming: boolean;
  url?: string;
  clientCount: number;
}

export interface PrinterFeatures {
  hasCamera: boolean;
  hasLED: boolean;
  hasFiltration: boolean;
  hasMaterialStation: boolean;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  ledUsesLegacyAPI: boolean;
  /** Multi-tool printer (Creator 5 series) — gates the per-tool temperature card. */
  hasMultiTool: boolean;
  /** Creator 5 Pro — gates the read-only TVOC air-quality display. */
  isCreator5Pro: boolean;
}

export interface PrinterStatus {
  printerState: string;
  bedTemperature: number;
  bedTargetTemperature: number;
  nozzleTemperature: number;
  nozzleTargetTemperature: number;
  progress: number;
  currentLayer: number;
  totalLayers: number;
  jobName: string | null;
  timeElapsed?: number;
  timeRemaining?: number;
  filtrationMode: 'external' | 'internal' | 'none';
  estimatedWeight?: number;
  estimatedLength?: number;
  cumulativeFilament?: number;
  cumulativePrintTime?: number;
  formattedEta?: string;
  /** Library completion timestamp, serialized to ISO. Null while the print is not advancing. */
  completionTime?: string | null;
  elapsedTimeSeconds?: number;
  // Creator 5 series (multi-tool) fields. Undefined/empty on single-nozzle printers.
  toolTemps?: ToolTemperatureData[];
  chamberTemperature?: number;
  chamberTargetTemperature?: number;
  hasChamberControl?: boolean;
  isCreator5Pro?: boolean;
  tvocLevel?: number;
}

export interface PrinterStatusResponse extends StandardAPIResponse {
  status?: PrinterStatus;
}

import { MaterialStationStatus } from './printer-backend/index.js';

export interface MaterialStationStatusResponse extends StandardAPIResponse {
  status?: MaterialStationStatus | null;
}

export interface ContextInfo {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  serialNumber: string;
  isActive: boolean;
}

export interface ContextListResponse extends StandardAPIResponse {
  contexts?: ContextInfo[];
  activeContextId?: string;
}

export interface SwitchContextResponse extends StandardAPIResponse {
  message?: string;
}

// ============================================================================
// SPOOLMAN API RESPONSE TYPES
// ============================================================================

export interface SpoolSummary {
  readonly id: number;
  readonly name: string;
  readonly vendor: string | null;
  readonly material: string | null;
  readonly colorHex: string;
  readonly remainingWeight: number;
  readonly remainingLength: number;
  readonly archived: boolean;
}

export interface SpoolmanConfigResponse extends StandardAPIResponse {
  enabled: boolean;
  disabledReason?: string | null;
  serverUrl: string;
  updateMode: 'length' | 'weight';
  contextId: string | null;
}

export interface ActiveSpoolResponse extends StandardAPIResponse {
  spool: ActiveSpoolData | null;
}

export interface SpoolSearchResponse extends StandardAPIResponse {
  spools: SpoolSummary[];
}

export interface SpoolSelectResponse extends StandardAPIResponse {
  spool: ActiveSpoolData;
}

// ============================================================================
// JOB UPLOAD API TYPES
// ============================================================================

/** A single slicer warning extracted from a 3MF, mirroring slicer-meta's SliceWarning. */
export interface UploadSliceWarning {
  readonly level: number;
  readonly message: string;
}

/**
 * Per-tool filament entry parsed out of the staged file. Feeds the material
 * matching modal on material-station printers (AD5X, Creator 5 / 5 Pro).
 */
export interface UploadFilamentInfo {
  readonly type: string | null;
  readonly color: string | null;
  readonly usedM: string | null;
  readonly usedG: string | null;
}

/**
 * Normalized slicer metadata for a staged upload.
 *
 * The desktop job uploader reads the raw `ParseResult` and applies a chain of
 * fallbacks between `file`, `threeMf` and `slicer` while rendering. The WebUI
 * cannot parse locally, so the server applies the exact same fallbacks here and
 * ships the resolved values; the browser only formats them.
 */
export interface UploadJobMetadata {
  readonly printerModel: string | null;
  readonly filamentType: string | null;
  /** Resolved filament length in meters (file.filaments → threeMf.filaments → filamentUsedMM). */
  readonly filamentLengthM: number | null;
  /** Resolved filament weight in grams; only rendered when a length is known. */
  readonly filamentWeightG: number | null;
  /** Null when the file carries no 3MF section (the desktop renders "-"). */
  readonly supportUsed: boolean | null;
  readonly slicerName: string | null;
  readonly slicerVersion: string | null;
  readonly sliceDate: string | null;
  readonly sliceTime: string | null;
  readonly printEta: string | null;
  readonly layerHeight: number | null;
  readonly infillDensity: number | null;
  readonly layerCount: number | null;
  /** First layer time in seconds (3MF only). */
  readonly firstLayerTime: number | null;
  readonly warnings: readonly UploadSliceWarning[];
  /** Base64 PNG (no data URL prefix) from the 3MF plate image or G-code thumbnail. */
  readonly thumbnail: string | null;
  readonly filaments: readonly UploadFilamentInfo[];
}

export interface JobUploadStageResponse extends StandardAPIResponse {
  /** Handle used to reference the staged file on the follow-up start/cancel calls. */
  readonly uploadId?: string;
  readonly fileName?: string;
  readonly metadata?: UploadJobMetadata;
  /** True when the active printer has a material station and the file is a 3MF. */
  readonly requiresMaterialMatching?: boolean;
}

export interface JobUploadStartResponse extends StandardAPIResponse {
  readonly fileName?: string;
  readonly started?: boolean;
}
