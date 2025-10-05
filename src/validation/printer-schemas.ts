/**
 * @fileoverview Zod validation schemas for printer status, material station data, and backend responses.
 *
 * Provides comprehensive runtime type validation for all printer-related data structures received
 * from backend APIs and hardware interfaces. Schemas cover printer state monitoring, temperature
 * data, job progress tracking, material station status, and command execution results. These
 * validators ensure type safety when processing data from external printer APIs (both legacy and
 * new API formats), preventing runtime errors from malformed or unexpected data structures.
 *
 * Key exports:
 * - Printer state schemas: PrinterStateSchema, PrinterStatusSchema, ConnectionStatusSchema
 * - Temperature schemas: TemperatureDataSchema, PrinterTemperaturesSchema
 * - Job tracking schemas: JobProgressSchema, CurrentJobInfoSchema, JobListResultSchema
 * - Material station schemas: MaterialStationStatusSchema, MaterialSlotSchema
 * - Validation helpers: parsePrinterStatus, parseMaterialStationStatus, validateCommandResult
 * - Type exports: ValidatedPrinterStatus, ValidatedMaterialStationStatus, ValidatedPollingData
 */

import { z } from 'zod';

// ============================================================================
// PRINTER STATE & BASIC TYPES
// ============================================================================

export const PrinterStateSchema = z.enum([
  'Ready',
  'Printing',
  'Paused',
  'Completed',
  'Error',
  'Disconnected'
]);

export const ConnectionStatusSchema = z.enum(['connected', 'connecting', 'disconnected']);

// ============================================================================
// TEMPERATURE DATA
// ============================================================================

export const TemperatureDataSchema = z.object({
  current: z.number().finite(),
  target: z.number().finite(),
  isHeating: z.boolean()
});

export const PrinterTemperaturesSchema = z.object({
  bed: TemperatureDataSchema,
  extruder: TemperatureDataSchema,
  chamber: TemperatureDataSchema.optional()
});

// ============================================================================
// JOB PROGRESS & INFO
// ============================================================================

export const JobProgressSchema = z.object({
  percentage: z.number().min(0).max(100),
  currentLayer: z.number().nullable(),
  totalLayers: z.number().nullable(),
  timeRemaining: z.number().nullable(), // minutes
  elapsedTime: z.number().min(0), // minutes
  weightUsed: z.number().min(0), // grams
  lengthUsed: z.number().min(0), // meters
  formattedEta: z.string().optional()
});

export const CurrentJobInfoSchema = z.object({
  fileName: z.string(),
  displayName: z.string(),
  startTime: z.date(),
  progress: JobProgressSchema,
  isActive: z.boolean()
});

// ============================================================================
// PRINTER COMPONENTS STATUS
// ============================================================================

export const FanStatusSchema = z.object({
  coolingFan: z.number().min(0).max(100),
  chamberFan: z.number().min(0).max(100)
});

export const FiltrationStatusSchema = z.object({
  mode: z.enum(['external', 'internal', 'none']),
  tvocLevel: z.number().min(0),
  available: z.boolean()
});

export const PrinterSettingsSchema = z.object({
  nozzleSize: z.number().optional(), // mm
  filamentType: z.string().optional(),
  speedOffset: z.number().min(50).max(200).optional(), // percentage
  zAxisOffset: z.number().optional() // mm
});

export const CumulativeStatsSchema = z.object({
  totalPrintTime: z.number().min(0), // minutes
  totalFilamentUsed: z.number().min(0) // meters
});

// ============================================================================
// COMPLETE PRINTER STATUS
// ============================================================================

export const PrinterStatusSchema = z.object({
  state: PrinterStateSchema,
  temperatures: PrinterTemperaturesSchema,
  fans: FanStatusSchema,
  filtration: FiltrationStatusSchema,
  settings: PrinterSettingsSchema,
  currentJob: CurrentJobInfoSchema.nullable(),
  connectionStatus: ConnectionStatusSchema,
  lastUpdate: z.date(),
  cumulativeStats: CumulativeStatsSchema.optional()
});

// ============================================================================
// MATERIAL STATION (AD5X)
// ============================================================================

export const MaterialSlotSchema = z.object({
  slotId: z.number().min(1).max(4),
  isEmpty: z.boolean(),
  materialType: z.string().nullable(),
  materialColor: z.string().nullable(),
  isActive: z.boolean()
});

export const MaterialStationStatusSchema = z.object({
  connected: z.boolean(),
  slots: z.array(MaterialSlotSchema),
  activeSlot: z.number().min(1).max(4).nullable(),
  errorMessage: z.string().nullable(),
  lastUpdate: z.date()
});

// ============================================================================
// BACKEND OPERATION RESULTS
// ============================================================================

export const CommandResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  timestamp: z.date()
});

export const GCodeCommandResultSchema = CommandResultSchema.extend({
  command: z.string(),
  response: z.string().optional(),
  executionTime: z.number()
});

export const StatusResultSchema = CommandResultSchema.extend({
  status: z.object({
    printerState: z.string(),
    bedTemperature: z.number(),
    nozzleTemperature: z.number(),
    progress: z.number(),
    currentJob: z.string().optional(),
    estimatedTime: z.number().optional(),
    remainingTime: z.number().optional(),
    currentLayer: z.number().optional(),
    totalLayers: z.number().optional()
  })
});

// ============================================================================
// JOB INFORMATION
// ============================================================================

export const BaseJobInfoSchema = z.object({
  fileName: z.string(),
  printingTime: z.number()
});

export const AD5XJobInfoSchema = BaseJobInfoSchema.extend({
  toolCount: z.number().optional(),
  toolDatas: z.array(z.any()).optional(), // Would need FFGcodeToolData schema
  totalFilamentWeight: z.number().optional(),
  useMatlStation: z.boolean().optional(),
  _type: z.literal('ad5x').optional()
});

export const BasicJobInfoSchema = BaseJobInfoSchema.extend({
  _type: z.literal('basic').optional()
});

export const JobInfoSchema = z.union([AD5XJobInfoSchema, BasicJobInfoSchema]);

export const JobListResultSchema = CommandResultSchema.extend({
  jobs: z.array(JobInfoSchema).readonly(),
  totalCount: z.number(),
  source: z.enum(['local', 'recent'])
});

// ============================================================================
// POLLING DATA
// ============================================================================

export const PollingDataSchema = z.object({
  printerStatus: PrinterStatusSchema.nullable(),
  materialStation: MaterialStationStatusSchema.nullable(),
  thumbnailData: z.string().nullable(),
  isConnected: z.boolean(),
  lastPolled: z.date()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ValidatedPrinterStatus = z.infer<typeof PrinterStatusSchema>;
export type ValidatedMaterialStationStatus = z.infer<typeof MaterialStationStatusSchema>;
export type ValidatedPollingData = z.infer<typeof PollingDataSchema>;
export type ValidatedCommandResult = z.infer<typeof CommandResultSchema>;
export type ValidatedJobListResult = z.infer<typeof JobListResultSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Safely parse printer status data from external source
 */
export function parsePrinterStatus(data: unknown): ValidatedPrinterStatus | null {
  const result = PrinterStatusSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Safely parse material station status from external source
 */
export function parseMaterialStationStatus(data: unknown): ValidatedMaterialStationStatus | null {
  const result = MaterialStationStatusSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Safely parse polling data from external source
 */
export function parsePollingData(data: unknown): ValidatedPollingData | null {
  const result = PollingDataSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate command result from backend
 */
export function validateCommandResult(data: unknown): ValidatedCommandResult {
  const result = CommandResultSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: 'Invalid command result format',
      timestamp: new Date()
    };
  }
  return result.data;
}

/**
 * Validate job list result from backend
 */
export function validateJobListResult(data: unknown): ValidatedJobListResult | null {
  const result = JobListResultSchema.safeParse(data);
  return result.success ? result.data : null;
}
