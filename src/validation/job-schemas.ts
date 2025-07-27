/**
 * Zod validation schemas for job and file-related data.
 * Validates job information, file uploads, and slicer metadata.
 */

import { z } from 'zod';

// ============================================================================
// JOB OPERATION SCHEMAS
// ============================================================================

/**
 * Job operation types
 */
export const JobOperationSchema = z.enum([
  'start',
  'pause',
  'resume',
  'cancel',
  'list-local',
  'list-recent'
]);

/**
 * Job start parameters
 */
export const JobStartParamsSchema = z.object({
  fileName: z.string().min(1),
  leveling: z.boolean(),
  startNow: z.boolean(),
  filePath: z.string().optional(),
  additionalParams: z.record(z.string(), z.unknown()).optional()
});

/**
 * Job operation parameters
 */
export const JobOperationParamsSchema = z.object({
  operation: JobOperationSchema,
  fileName: z.string().optional(),
  leveling: z.boolean(),
  startNow: z.boolean(),
  filePath: z.string().optional(),
  additionalParams: z.record(z.string(), z.unknown()).optional()
});

// ============================================================================
// FILE INFORMATION SCHEMAS
// ============================================================================

/**
 * Supported file types
 */
export const SupportedFileTypeSchema = z.enum(['gcode', 'g', 'gx', '3mf']);

/**
 * File metadata from job picker
 */
export const FileMetadataSchema = z.object({
  name: z.string(),
  path: z.string(),
  size: z.number().min(0),
  lastModified: z.coerce.date(),
  type: SupportedFileTypeSchema
});

/**
 * Thumbnail data for preview
 */
export const ThumbnailDataSchema = z.object({
  format: z.enum(['png', 'jpeg', 'base64']),
  data: z.string(),
  width: z.number().optional(),
  height: z.number().optional()
});

// ============================================================================
// SLICER METADATA SCHEMAS
// ============================================================================

/**
 * Slicer software information
 */
export const SlicerInfoSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  profile: z.string().optional()
});

/**
 * Print settings from slicer
 */
export const SlicerPrintSettingsSchema = z.object({
  layerHeight: z.number().optional(),
  initialLayerHeight: z.number().optional(),
  nozzleTemp: z.number().optional(),
  bedTemp: z.number().optional(),
  printSpeed: z.number().optional(),
  infillPercentage: z.number().min(0).max(100).optional(),
  supportEnabled: z.boolean().optional()
});

/**
 * Filament information from slicer
 */
export const SlicerFilamentInfoSchema = z.object({
  type: z.string().optional(),
  weight: z.number().min(0).optional(),
  length: z.number().min(0).optional(),
  cost: z.number().min(0).optional()
});

/**
 * Complete slicer metadata
 */
export const SlicerMetadataSchema = z.object({
  slicer: SlicerInfoSchema.optional(),
  settings: SlicerPrintSettingsSchema.optional(),
  filament: SlicerFilamentInfoSchema.optional(),
  estimatedTime: z.number().min(0).optional(), // minutes
  thumbnail: ThumbnailDataSchema.optional()
});

// ============================================================================
// JOB FILE VALIDATION
// ============================================================================

/**
 * Job file upload request
 */
export const JobUploadRequestSchema = z.object({
  filePath: z.string(),
  fileName: z.string(),
  fileSize: z.number().min(0),
  startImmediately: z.boolean(),
  performLeveling: z.boolean(),
  materialSlot: z.number().min(1).max(4).optional()
});

/**
 * Job file list entry
 */
export const JobFileEntrySchema = z.object({
  fileName: z.string(),
  displayName: z.string(),
  fileSize: z.number().min(0).optional(),
  uploadDate: z.coerce.date().optional(),
  printTime: z.number().min(0).optional(), // minutes
  hasThumbnail: z.boolean(),
  source: z.enum(['local', 'recent', 'usb'])
});

/**
 * Job file list response
 */
export const JobFileListSchema = z.object({
  files: z.array(JobFileEntrySchema),
  totalCount: z.number(),
  source: z.enum(['local', 'recent']),
  hasMore: z.boolean()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ValidatedJobStartParams = z.infer<typeof JobStartParamsSchema>;
export type ValidatedJobOperationParams = z.infer<typeof JobOperationParamsSchema>;
export type ValidatedFileMetadata = z.infer<typeof FileMetadataSchema>;
export type ValidatedSlicerMetadata = z.infer<typeof SlicerMetadataSchema>;
export type ValidatedJobUploadRequest = z.infer<typeof JobUploadRequestSchema>;
export type ValidatedJobFileList = z.infer<typeof JobFileListSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate job start parameters
 */
export function validateJobStartParams(data: unknown): ValidatedJobStartParams | null {
  const result = JobStartParamsSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate job operation parameters
 */
export function validateJobOperationParams(data: unknown): ValidatedJobOperationParams | null {
  const result = JobOperationParamsSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate file metadata
 */
export function validateFileMetadata(data: unknown): ValidatedFileMetadata | null {
  const result = FileMetadataSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate slicer metadata
 */
export function validateSlicerMetadata(data: unknown): ValidatedSlicerMetadata | null {
  const result = SlicerMetadataSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate job upload request
 */
export function validateJobUploadRequest(data: unknown): ValidatedJobUploadRequest | null {
  const result = JobUploadRequestSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate job file list
 */
export function validateJobFileList(data: unknown): ValidatedJobFileList | null {
  const result = JobFileListSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Check if file extension is supported
 */
export function isSupportedFileType(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return false;
  
  const result = SupportedFileTypeSchema.safeParse(ext);
  return result.success;
}

/**
 * Extract file type from filename
 */
export function getFileType(filename: string): z.infer<typeof SupportedFileTypeSchema> | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  
  const result = SupportedFileTypeSchema.safeParse(ext);
  return result.success ? result.data : null;
}
