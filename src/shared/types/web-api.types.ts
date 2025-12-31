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
  type: 'AUTH_SUCCESS' | 'STATUS_UPDATE' | 'ERROR' | 'COMMAND_RESULT' | 'PONG' | 'SPOOLMAN_UPDATE';
  timestamp: string;
  status?: PrinterStatusData | null;
  error?: string;
  clientId?: string;
  command?: string;
  success?: boolean;
  contextId?: string;
  spool?: ActiveSpoolData | null;
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
