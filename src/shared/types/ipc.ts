/**
 * @fileoverview Shared IPC type definitions for main/renderer process communication
 *
 * Provides type-safe interfaces for IPC communication payloads ensuring consistency
 * between IPC handlers in the main process and preload script type definitions. Covers
 * job upload parameters, material mappings, and slicer metadata parsing.
 *
 * Key Types:
 * - UploadJobPayload: Standard printer job upload with leveling and auto-start options
 * - AD5XUploadParams: Enhanced upload for AD5X printers with material station mappings
 * - SlicerMetadata: Parsed gcode/x3g metadata with error handling via slicer-meta library
 *
 * Integration Points:
 * - job-handlers.ts: Upload IPC handler implementation
 * - material-handlers.ts: Material mapping validation
 * - BasePrinterBackend: Upload method parameter validation
 * - Preload script: Type-safe API method signatures
 *
 * @module types/ipc
 */

import type { AD5XMaterialMapping } from '@ghosttypes/ff-api';
import type { ParseResult } from '@parallel-7/slicer-meta';

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
