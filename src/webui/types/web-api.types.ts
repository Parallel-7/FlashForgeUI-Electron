/**
 * @fileoverview TypeScript type definitions for WebUI API communication and message protocols.
 *
 * Provides comprehensive type definitions for all communication between WebUI browser clients
 * and the WebUI server including authentication payloads, WebSocket message protocols, API
 * request/response structures, and printer command types. Uses discriminated union types for
 * type-safe message handling and readonly properties to prevent accidental mutation. The unified
 * PrinterStatusData interface ensures consistency across WebSocket messages, API responses, and
 * frontend state management. All types follow strict TypeScript patterns with readonly modifiers,
 * literal types for enums, and branded types where appropriate for compile-time safety.
 *
 * Key exports:
 * - Authentication: WebUILoginRequest, WebUILoginResponse, WebUIAuthStatus
 * - WebSocket: WebSocketMessage, WebSocketCommand, WebSocketMessageType, WebSocketCommandType
 * - Printer data: PrinterStatusData (unified status interface), PrinterFeatures
 * - API responses: PrinterStatusResponse, StandardAPIResponse, CameraStatusResponse
 * - Commands: PRINTER_COMMANDS constant object, PrinterCommand type
 * - Errors: WebUIError, WEB_UI_ERROR_CODES constant object, WebUIErrorCode type
 */

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

/**
 * Login request payload
 */
export interface WebUILoginRequest {
  readonly password: string;
  readonly rememberMe?: boolean;
}

/**
 * Login response
 */
export interface WebUILoginResponse {
  readonly success: boolean;
  readonly token?: string;
  readonly message?: string;
}

/**
 * Auth status response
 */
export interface WebUIAuthStatus {
  readonly hasPassword: boolean;
  readonly defaultPassword: boolean;
  readonly authRequired: boolean;
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES
// ============================================================================

/**
 * WebSocket command types
 */
export type WebSocketCommandType = 'REQUEST_STATUS' | 'EXECUTE_GCODE' | 'PING';

/**
 * WebSocket message types
 */
export type WebSocketMessageType = 'AUTH_SUCCESS' | 'STATUS_UPDATE' | 'ERROR' | 'COMMAND_RESULT' | 'PONG' | 'SPOOLMAN_UPDATE';

/**
 * Represents the detailed status data of a printer.
 * This unified interface is used across WebSocket messages, API responses,
 * and frontend state to ensure consistency.
 */
export interface PrinterStatusData {
  readonly printerState: string;
  readonly bedTemperature: number;
  readonly bedTargetTemperature: number;
  readonly nozzleTemperature: number;
  readonly nozzleTargetTemperature: number;
  readonly progress: number;
  readonly currentLayer?: number;
  readonly totalLayers?: number;
  readonly jobName: string | null; // Allows null for no active job
  readonly timeElapsed?: number;
  readonly timeRemaining?: number;
  readonly filtrationMode: 'external' | 'internal' | 'none';
  readonly estimatedWeight?: number;
  readonly estimatedLength?: number;
  readonly thumbnailData: string | null; // Base64 encoded thumbnail, null if not available
  readonly cumulativeFilament?: number; // Total lifetime filament usage in meters
  readonly cumulativePrintTime?: number; // Total lifetime print time in minutes
}

/**
 * Tool metadata for AD5X multi-color jobs
 */
export interface AD5XToolData {
  readonly toolId: number;
  readonly materialName: string;
  readonly materialColor: string;
  readonly filamentWeight: number;
  readonly slotId?: number | null;
}

/**
 * Material mapping payload for multi-color job start
 */
export interface MaterialMapping {
  readonly toolId: number;
  readonly slotId: number;
  readonly materialName: string;
  readonly toolMaterialColor: string;
  readonly slotMaterialColor: string;
}

/**
 * Client to server command
 */
export interface WebSocketCommand {
  readonly command: WebSocketCommandType;
  readonly gcode?: string;
  readonly data?: unknown;
}

/**
 * Server to client message
 */
export interface WebSocketMessage {
  readonly type: WebSocketMessageType;
  readonly timestamp: string;
  readonly status?: PrinterStatusData | null; // Use unified PrinterStatusData instead of any
  readonly error?: string;
  readonly clientId?: string;
  readonly command?: string;
  readonly success?: boolean;
  // Spoolman update fields (when type === 'SPOOLMAN_UPDATE')
  readonly contextId?: string;
  readonly spool?: {
    readonly id: number;
    readonly name: string;
    readonly vendor: string | null;
    readonly material: string | null;
    readonly colorHex: string;
    readonly remainingWeight: number;
    readonly remainingLength: number;
    readonly lastUpdated: string;
  } | null;
}

// ============================================================================
// API ENDPOINT TYPES
// ============================================================================

/**
 * Printer status API response
 */
export interface PrinterStatusResponse {
  readonly success: boolean;
  readonly status?: Omit<PrinterStatusData, 'thumbnailData'>; // Use unified type, excluding thumbnailData for HTTP API
  readonly error?: string;
}

/**
 * Temperature set request
 */
export interface TemperatureSetRequest {
  readonly temperature: number;
}

/**
 * Job start request
 */
export interface JobStartRequest {
  readonly filename: string;
  readonly leveling?: boolean;
  readonly startNow?: boolean;
  readonly materialMappings?: readonly MaterialMapping[];
}

/**
 * Camera status response
 */
export interface CameraStatusResponse {
  readonly available: boolean;
  readonly streaming: boolean;
  readonly url?: string;
  readonly clientCount?: number;
}

/**
 * Standard API response
 */
export interface StandardAPIResponse {
  readonly success: boolean;
  readonly message?: string;
  readonly error?: string;
}

// ============================================================================
// PRINTER COMMANDS
// ============================================================================

/**
 * Available printer control commands
 */
export const PRINTER_COMMANDS = {
  // Basic controls
  HOME_AXES: 'home-axes',
  CLEAR_STATUS: 'clear-status',
  LED_ON: 'led-on',
  LED_OFF: 'led-off',
  
  // Temperature controls
  SET_BED_TEMP: 'set-bed-temp',
  BED_TEMP_OFF: 'bed-temp-off',
  SET_EXTRUDER_TEMP: 'set-extruder-temp',
  EXTRUDER_TEMP_OFF: 'extruder-temp-off',
  
  // Job controls
  PAUSE_PRINT: 'pause-print',
  RESUME_PRINT: 'resume-print',
  CANCEL_PRINT: 'cancel-print',
  
  // Filtration controls
  EXTERNAL_FILTRATION: 'external-filtration',
  INTERNAL_FILTRATION: 'internal-filtration',
  NO_FILTRATION: 'no-filtration',
  
  // Data requests
  REQUEST_PRINTER_DATA: 'request-printer-data',
  GET_RECENT_FILES: 'get-recent-files',
  GET_LOCAL_FILES: 'get-local-files',
  
  // Job operations
  PRINT_FILE: 'print-file',
  REQUEST_MODEL_PREVIEW: 'request-model-preview'
} as const;

export type PrinterCommand = typeof PRINTER_COMMANDS[keyof typeof PRINTER_COMMANDS];

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Printer feature availability
 */
export interface PrinterFeatures {
  readonly hasCamera: boolean;
  readonly hasLED: boolean;
  readonly hasFiltration: boolean;
  readonly hasMaterialStation: boolean;
  readonly canPause: boolean;
  readonly canResume: boolean;
  readonly canCancel: boolean;
  readonly ledUsesLegacyAPI?: boolean; // Whether LED control should use legacy G-code commands
}

/**
 * Material station slot information returned to WebUI
 */
export interface MaterialSlotInfo {
  readonly slotId: number;
  readonly isEmpty: boolean;
  readonly materialType: string | null;
  readonly materialColor: string | null;
}

/**
 * Material station status returned to WebUI
 */
export interface MaterialStationStatus {
  readonly connected: boolean;
  readonly slots: readonly MaterialSlotInfo[];
  readonly activeSlot: number | null;
  readonly overallStatus: 'ready' | 'warming' | 'error' | 'disconnected';
  readonly errorMessage: string | null;
}

/**
 * AD5X job information for WebUI job lists
 */
export interface AD5XJobInfo {
  readonly fileName: string;
  readonly printingTime?: number;
  readonly toolCount?: number;
  readonly toolDatas?: readonly AD5XToolData[];
  readonly totalFilamentWeight?: number;
  readonly useMatlStation?: boolean;
}

/**
 * Unified WebUI job file metadata
 */
export interface WebUIJobFile {
  readonly fileName: string;
  readonly displayName: string;
  readonly printingTime?: number;
  readonly metadataType?: 'basic' | 'ad5x';
  readonly toolCount?: number;
  readonly toolDatas?: readonly AD5XToolData[];
  readonly totalFilamentWeight?: number;
  readonly useMatlStation?: boolean;
}

/**
 * Response for material station endpoint
 */
export interface MaterialStationStatusResponse extends StandardAPIResponse {
  readonly status?: MaterialStationStatus | null;
}

// ============================================================================
// SPOOLMAN INTEGRATION TYPES
// ============================================================================

/**
 * Spoolman configuration response
 */
export interface SpoolmanConfigResponse extends StandardAPIResponse {
  readonly enabled: boolean;
  readonly disabledReason?: string | null;
  readonly serverUrl: string;
  readonly updateMode: 'length' | 'weight';
  readonly contextId: string | null;
}

/**
 * Simplified spool summary for search results
 */
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

/**
 * Spoolman spool search response
 */
export interface SpoolSearchResponse extends StandardAPIResponse {
  readonly spools: readonly SpoolSummary[];
}

/**
 * Active spool data response
 */
export interface ActiveSpoolResponse extends StandardAPIResponse {
  readonly spool: {
    readonly id: number;
    readonly name: string;
    readonly vendor: string | null;
    readonly material: string | null;
    readonly colorHex: string;
    readonly remainingWeight: number;
    readonly remainingLength: number;
    readonly lastUpdated: string;
  } | null;
}

/**
 * Spool selection request
 */
export interface SpoolSelectRequest {
  readonly contextId?: string;
  readonly spoolId: number;
}

/**
 * Spool selection response
 */
export interface SpoolSelectResponse extends StandardAPIResponse {
  readonly spool: {
    readonly id: number;
    readonly name: string;
    readonly vendor: string | null;
    readonly material: string | null;
    readonly colorHex: string;
    readonly remainingWeight: number;
    readonly remainingLength: number;
    readonly lastUpdated: string;
  };
}

/**
 * Spool clear request
 */
export interface SpoolClearRequest {
  readonly contextId?: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * WebUI specific error codes
 */
export const WEB_UI_ERROR_CODES = {
  AUTH_FAILED: 'WEB_AUTH_FAILED',
  INVALID_TOKEN: 'WEB_INVALID_TOKEN',
  SERVER_ERROR: 'WEB_SERVER_ERROR',
  PRINTER_NOT_CONNECTED: 'WEB_PRINTER_NOT_CONNECTED',
  COMMAND_FAILED: 'WEB_COMMAND_FAILED',
  INVALID_REQUEST: 'WEB_INVALID_REQUEST'
} as const;

export type WebUIErrorCode = typeof WEB_UI_ERROR_CODES[keyof typeof WEB_UI_ERROR_CODES];

/**
 * WebUI error response
 */
export interface WebUIError {
  readonly code: WebUIErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

