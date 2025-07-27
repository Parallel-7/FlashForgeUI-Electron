/**
 * Shared type definitions for IPC communication between main and renderer processes.
 * These types ensure consistency across different IPC handlers and preload scripts.
 */

import type { AD5XMaterialMapping } from 'ff-api';
import type { ParseResult } from 'slicer-meta';

// Upload job payload for regular printer uploads
export interface UploadJobPayload {
  readonly filePath: string;
  readonly startNow: boolean;
  readonly autoLevel: boolean;
}

// AD5X upload parameters with material mappings
export interface AD5XUploadParams {
  readonly filePath: string;
  readonly startPrint: boolean;
  readonly levelingBeforePrint: boolean;
  readonly materialMappings?: readonly AD5XMaterialMapping[];
}

// Slicer metadata result extending ParseResult with error handling
export type SlicerMetadata = ParseResult & {
  readonly error?: string;
};