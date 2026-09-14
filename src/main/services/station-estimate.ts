/**
 * @fileoverview Stage-1 capture of per-tool filament estimates for
 * material-station uploads (Creator 5 series, AD5X with station).
 *
 * When a station-printer upload provides tool→slot material mappings AND the
 * parsed slicer file carries per-filament estimates, a job estimate record is
 * persisted (keyed by printer serial + final file name) so terminal-state
 * deduction can later charge the spool assigned to each slot.
 *
 * Source precedence per tool:
 * 1. 3mf per-filament FilamentInfo usedG/usedM (index = tool id);
 * 2. AD5X per-tool filamentWeight from the printer's file listing (slicer
 *    weight computed at upload, grams only);
 * 3. anything missing stays null → that tool is skipped at deduction time.
 *
 * Invariants: totals are never split across tools, density is never guessed,
 * and capture failures never fail the upload (log + skip only).
 */

import type { FilamentInfo, ParseResult } from '@parallel-7/slicer-meta';
import type {
  JobEstimateRecord,
  JobEstimateSource,
  ToolEstimate,
  ToolSlotMapping,
} from '@shared/types/spoolman-tracking';
import { getJobEstimateStore } from './JobEstimateStore';
import { resolveStationStoreKey } from './station-store-key';

/** Ad5X-family per-tool file data used as the grams-only fallback. */
export interface Ad5xToolFileData {
  readonly toolId: number;
  readonly filamentWeight: number | null;
}

/** Parse a nullable numeric string ("11.28") into a finite positive number. */
function parsePositiveNumber(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Extract the 3mf per-filament list (index = tool id), if any. */
function filamentsFromParse(parsed: ParseResult): FilamentInfo[] {
  return parsed.threeMf?.filaments ?? parsed.file?.filaments ?? [];
}

/**
 * Build per-tool estimates for a station upload.
 *
 * @param mappings - toolId→slotId mappings chosen in the Material Station UI
 * @param parsed - slicer metadata parsed from the uploaded file
 * @param ad5xToolData - optional per-tool grams reported by the printer file
 *   listing (AD5X fallback when the file lacks per-filament data)
 * @returns per-tool estimates, or null when no mapping provides any usable
 *   estimate (caller skips the capture entirely)
 */
export function buildToolEstimates(
  mappings: readonly ToolSlotMapping[],
  parsed: ParseResult,
  ad5xToolData: readonly Ad5xToolFileData[] = []
): ToolEstimate[] | null {
  const filaments = filamentsFromParse(parsed);
  if (filaments.length === 0 && ad5xToolData.length === 0) {
    return null;
  }

  const estimates: ToolEstimate[] = [];
  let anyKnown = false;
  for (const mapping of mappings) {
    const filament = filaments[mapping.toolId];
    const fallbackTool = ad5xToolData.find((tool) => tool.toolId === mapping.toolId);
    const fallbackWeight = fallbackTool?.filamentWeight;
    const fallbackG =
      fallbackWeight !== null && fallbackWeight !== undefined && fallbackWeight > 0
        ? fallbackWeight
        : null;
    const usedG = parsePositiveNumber(filament?.usedG) ?? fallbackG;
    const usedM = parsePositiveNumber(filament?.usedM);
    if (usedG !== null || usedM !== null) {
      anyKnown = true;
    }
    estimates.push({ toolId: mapping.toolId, slotId: mapping.slotId, usedG, usedM });
  }

  return anyKnown ? estimates : null;
}

/** Convenience wrapper mapping upload-path MaterialMapping objects. */
export function toToolSlotMappings(
  mappings: ReadonlyArray<{ toolId: number; slotId: number }>
): ToolSlotMapping[] {
  return mappings.map((mapping) => ({ toolId: mapping.toolId, slotId: mapping.slotId }));
}

/**
 * Capture (persist) the estimate record for a station print. Failures are
 * logged and swallowed: capture must never break the start/upload flow.
 *
 * @param contextId - Printer context receiving the print
 * @param fileName - Final file name on the printer
 * @param mappings - toolId→slotId mappings from the Material Station UI
 * @param perTool - per-tool estimates from {@link buildToolEstimates}
 * @param source - estimate provenance (defaults to the upload flow)
 */
export function captureStationEstimate(
  contextId: string,
  fileName: string,
  mappings: readonly ToolSlotMapping[],
  perTool: readonly ToolEstimate[],
  source?: JobEstimateSource
): void {
  const record: JobEstimateRecord = {
    fileName,
    mappings,
    perTool,
    source,
    capturedAt: new Date().toISOString(),
  };
  getJobEstimateStore().captureEstimate(resolveStationStoreKey(contextId), record);
  console.log(
    `[StationEstimate] Captured estimate for ${fileName} on context ${contextId}: ` +
      `${perTool.map((tool) => `tool${tool.toolId}→slot${tool.slotId} ${tool.usedG ?? '?'}g`).join(', ')}`
  );
}

/** Upload facts needed to capture a station estimate record. */
export interface StationUploadCapture {
  readonly fileName: string;
  readonly filePath: string;
  readonly mappings: ReadonlyArray<{ toolId: number; slotId: number }>;
}

/** Callers of {@link captureEstimateForStationUpload} supply their parsers. */
export interface StationCaptureDeps {
  /** Slicer metadata parser (desktop IPC + embedded WebUI share slicer-meta). */
  readonly parseSlicerFile: (filePath: string) => Promise<ParseResult>;
  /** Optional AD5X per-tool grams lookup from the printer's file listing. */
  readonly fetchAd5xToolWeights?: (
    contextId: string,
    fileName: string
  ) => Promise<Ad5xToolFileData[]>;
}

/**
 * Stage-1 capture orchestration for a station upload: parse the uploaded file,
 * build per-tool estimates (3mf first, AD5X per-tool grams fallback), and
 * persist the estimate record. Shared by the desktop upload IPC path and the
 * embedded WebUI upload route. Any failure is logged by the caller and never
 * fails the upload.
 *
 * @param contextId - Printer context receiving the upload
 * @param upload - Final file name, local staged file path, and tool→slot mappings
 * @param deps - Parse + AD5X fallback hooks supplied by the calling surface
 */
export async function captureEstimateForStationUpload(
  contextId: string,
  upload: StationUploadCapture,
  deps: StationCaptureDeps
): Promise<void> {
  const parsed = await deps.parseSlicerFile(upload.filePath);
  let perTool = buildToolEstimates(upload.mappings, parsed);

  if (!perTool || perTool.some((tool) => tool.usedG === null)) {
    const ad5xToolData = deps.fetchAd5xToolWeights
      ? await deps.fetchAd5xToolWeights(contextId, upload.fileName)
      : [];
    if (ad5xToolData.length > 0) {
      const withFallback = buildToolEstimates(upload.mappings, parsed, ad5xToolData);
      if (withFallback) {
        perTool = withFallback;
      }
    }
  }

  if (!perTool) {
    console.log(
      `[StationEstimate] No per-filament estimates for ${upload.fileName}; ` +
        'Spoolman deduction will skip this job.'
    );
    return;
  }

  captureStationEstimate(contextId, upload.fileName, toToolSlotMappings(upload.mappings), perTool);
}
