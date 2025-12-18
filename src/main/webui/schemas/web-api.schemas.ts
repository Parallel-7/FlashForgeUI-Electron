/**
 * @fileoverview Zod validation schemas for WebUI API requests and WebSocket communication.
 *
 * Provides comprehensive runtime validation for all data received from web clients including
 * authentication requests, WebSocket commands, printer control operations, and API endpoint
 * payloads. These schemas ensure type safety and security by validating all incoming data
 * before processing, protecting against malformed requests, injection attacks, and type-related
 * runtime errors. Includes specialized validators for temperature controls, job operations,
 * and command-specific data with helpful error messages for client-side feedback.
 *
 * Key exports:
 * - Authentication schemas: WebUILoginRequestSchema, AuthTokenSchema
 * - WebSocket schemas: WebSocketCommandSchema, WebSocketCommandTypeSchema
 * - Command validation: PrinterCommandSchema, CommandDataValidators
 * - Temperature/Job schemas: TemperatureSetRequestSchema, JobStartRequestSchema, GCodeCommandRequestSchema
 * - Helper functions: validateWebSocketCommand, extractBearerToken, createValidationError
 * - Type exports: ValidatedLoginRequest, ValidatedWebSocketCommand, ValidatedPrinterCommand
 */

import { z } from 'zod';

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

/**
 * Login request validation
 */
export const WebUILoginRequestSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false)
});

/**
 * Auth token validation (JWT-like format with base64 data and hex signature)
 */
export const AuthTokenSchema = z.string().regex(
  /^[A-Za-z0-9\-_=+/]+\.[A-Fa-f0-9]+$/,
  'Invalid token format'
);

// ============================================================================
// WEBSOCKET MESSAGE SCHEMAS
// ============================================================================

/**
 * WebSocket command types
 */
export const WebSocketCommandTypeSchema = z.enum(['REQUEST_STATUS', 'EXECUTE_GCODE', 'PING']);

/**
 * WebSocket command from client
 */
export const WebSocketCommandSchema = z.object({
  command: WebSocketCommandTypeSchema,
  gcode: z.string().optional(),
  data: z.unknown().optional()
});

/**
 * Temperature set data validation
 */
export const TemperatureDataSchema = z.object({
  temperature: z.number().min(0).max(300)
});

/**
 * Job start data validation
 */
export const JobStartDataSchema = z.object({
  filename: z.string().min(1),
  leveling: z.boolean().optional().default(false),
  startNow: z.boolean().optional().default(true)
});

// ============================================================================
// API REQUEST SCHEMAS
// ============================================================================

/**
 * Temperature set request validation
 */
export const TemperatureSetRequestSchema = z.object({
  temperature: z.number()
    .min(0, 'Temperature must be at least 0°C')
    .max(300, 'Temperature must not exceed 300°C')
});

/**
 * Job start request validation
 */
const MaterialMappingSchema = z.object({
  toolId: z.number()
    .int('toolId must be an integer')
    .min(0, 'toolId must be non-negative'),
  slotId: z.number()
    .int('slotId must be an integer')
    .min(1, 'slotId must be at least 1'),
  materialName: z.string()
    .min(1, 'materialName is required'),
  toolMaterialColor: z.string()
    .min(1, 'toolMaterialColor is required'),
  slotMaterialColor: z.string()
    .min(1, 'slotMaterialColor is required')
});

export const JobStartRequestSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  leveling: z.boolean().optional().default(false),
  startNow: z.boolean().optional().default(true),
  materialMappings: z.array(MaterialMappingSchema)
    .min(1, 'materialMappings must contain at least one mapping')
    .optional()
});


// ============================================================================
// COMMAND VALIDATION
// ============================================================================

/**
 * Valid printer commands enum
 */
export const PrinterCommandSchema = z.enum([
  // Basic controls
  'home-axes',
  'clear-status',
  'led-on',
  'led-off',
  
  // Temperature controls
  'set-bed-temp',
  'bed-temp-off',
  'set-extruder-temp',
  'extruder-temp-off',
  
  // Job controls
  'pause-print',
  'resume-print',
  'cancel-print',
  
  // Filtration controls
  'external-filtration',
  'internal-filtration',
  'no-filtration',
  
  // Data requests
  'request-printer-data',
  'get-recent-files',
  'get-local-files',
  
  // Job operations
  'print-file',
  'request-model-preview'
]);

// ============================================================================
// RESPONSE VALIDATION
// ============================================================================


/**
 * Printer features validation
 */
export const PrinterFeaturesSchema = z.object({
  hasCamera: z.boolean(),
  hasLED: z.boolean(),
  hasFiltration: z.boolean(),
  hasMaterialStation: z.boolean(),
  canPause: z.boolean(),
  canResume: z.boolean(),
  canCancel: z.boolean()
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================


/**
 * Validate authentication token
 */
export function validateAuthToken(token: unknown): string | null {
  const result = AuthTokenSchema.safeParse(token);
  return result.success ? result.data : null;
}

/**
 * Create a validation error response
 */
export function createValidationError(zodError: z.ZodError): { error: string; details: unknown } {
  const issues = zodError.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message
  }));
  
  return {
    error: 'Validation failed',
    details: issues
  };
}

// ============================================================================
// SPOOLMAN SCHEMAS
// ============================================================================

/**
 * Spool selection request validation
 */
export const SpoolSelectRequestSchema = z.object({
  contextId: z.string().optional(),
  spoolId: z.number().int().positive('Spool ID must be a positive integer')
});

/**
 * Spool clear request validation
 */
export const SpoolClearRequestSchema = z.object({
  contextId: z.string().optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ValidatedLoginRequest = z.infer<typeof WebUILoginRequestSchema>;
export type ValidatedWebSocketCommand = z.infer<typeof WebSocketCommandSchema>;
export type ValidatedTemperatureData = z.infer<typeof TemperatureDataSchema>;
export type ValidatedJobStartData = z.infer<typeof JobStartDataSchema>;
export type ValidatedPrinterCommand = z.infer<typeof PrinterCommandSchema>;
export type ValidatedPrinterFeatures = z.infer<typeof PrinterFeaturesSchema>;
export type ValidatedSpoolSelectRequest = z.infer<typeof SpoolSelectRequestSchema>;
export type ValidatedSpoolClearRequest = z.infer<typeof SpoolClearRequestSchema>;

