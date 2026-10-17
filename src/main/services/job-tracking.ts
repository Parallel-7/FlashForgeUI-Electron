/**
 * @fileoverview Creates the per-job Spoolman tracking record when the app
 * starts a job on a material-station printer (Creator 5 series, AD5X with
 * station).
 *
 * The matching dialog sends a spool choice for each tool together with the
 * tool→slot mappings. This module turns those choices into a
 * {@link TrackedJob} and stores it as the printer's only tracked job:
 *
 * - Uploaded 3MF: estimates come from the file's per-filament data, and a
 *   per-tool usage profile is read from the embedded gcode so a cancelled
 *   print is charged per tool.
 * - File already on the printer (AD5X): estimates come from the printer's
 *   per-tool file data; a cancel is charged linearly by progress.
 *
 * Every app-started job on a station printer first removes the earlier
 * record, so a spool choice never carries over to another job. Failures are
 * logged and never block the upload or the job start.
 */

import type { FilamentInfo, ParseResult } from '@parallel-7/slicer-meta';
import { getPrinterBackendManager } from '../managers/PrinterBackendManager.js';
import type { AD5XJobInfo, BasicJobInfo, JobListResult } from '@shared/types/printer-backend/backend-operations';
import type {
  ToolSpoolAssignment,
  ToolUsageProfile,
  TrackedJob,
  TrackedJobSource,
  TrackedTool,
} from '@shared/types/spoolman-tracking';
import { resolveStationStoreKey } from './station-store-key';
import { getSpoolmanIntegrationService } from './SpoolmanIntegrationService';
import { buildToolUsageProfile } from './tool-usage-profile';
import { getTrackedJobStore } from './TrackedJobStore';

/** Tool→slot mapping as sent with a job start. */
export interface ToolSlotMapping {
  readonly toolId: number;
  readonly slotId: number;
}

/** Per-tool estimate before a spool is attached. */
export interface ToolEstimate {
  readonly toolId: number;
  readonly usedG: number | null;
  readonly usedM: number | null;
}

/** Parse a nullable numeric string ("11.28") into a finite positive number. */
function parsePositiveNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Tool index (0-based, the `Tn` number in the gcode) for a 3MF filament entry.
 *
 * A 3MF lists only the filaments a plate uses, each with its 1-based slicer
 * id. A plate that uses filaments 1 and 3 prints with T0 and T2, so the tool
 * index is `id - 1`, not the position in the list. The list position is the
 * fallback when the id is missing or not a number.
 *
 * @param filament - Filament entry from the parsed 3MF
 * @param index - Position of the entry in the filament list
 */
export function toolIdForFilament(filament: Pick<FilamentInfo, 'id'>, index: number): number {
  const id = Number.parseInt(String(filament.id ?? ''), 10);
  return Number.isInteger(id) && id >= 1 ? id - 1 : index;
}

/** Per-filament list of a parse result (3MF first, gcode header second). */
function filamentsFromParse(parsed: ParseResult): FilamentInfo[] {
  return parsed.threeMf?.filaments ?? parsed.file?.filaments ?? [];
}

/**
 * Per-tool estimates from the slicer's per-filament data.
 *
 * @returns One estimate per filament, keyed by tool index
 */
export function estimatesFromParse(parsed: ParseResult): ToolEstimate[] {
  return filamentsFromParse(parsed).map((filament, index) => ({
    toolId: toolIdForFilament(filament, index),
    usedG: parsePositiveNumber(filament.usedG),
    usedM: parsePositiveNumber(filament.usedM),
  }));
}

/** Per-tool estimates from AD5X file-list tool data (grams only). */
export function estimatesFromAd5xJob(job: AD5XJobInfo): ToolEstimate[] {
  return (job.toolDatas ?? []).map((tool) => ({
    toolId: tool.toolId,
    usedG: parsePositiveNumber(tool.filamentWeight),
    usedM: null,
  }));
}

/**
 * Join mappings, spool choices and estimates into tracked tools. Tools
 * without a spool choice are left out; they are not tracked.
 */
export function buildTrackedTools(
  mappings: readonly ToolSlotMapping[],
  spoolAssignments: readonly ToolSpoolAssignment[],
  estimates: readonly ToolEstimate[]
): TrackedTool[] {
  const tools: TrackedTool[] = [];
  for (const mapping of mappings) {
    const spoolId = spoolAssignments.find((entry) => entry.toolId === mapping.toolId)?.spoolId;
    if (typeof spoolId !== 'number' || !Number.isInteger(spoolId) || spoolId <= 0) {
      continue;
    }
    const estimate = estimates.find((entry) => entry.toolId === mapping.toolId);
    tools.push({
      toolId: mapping.toolId,
      slotId: mapping.slotId,
      spoolId,
      usedG: estimate?.usedG ?? null,
      usedM: estimate?.usedM ?? null,
    });
  }
  return tools;
}

/** Injectable surface so the arming logic is unit-testable without singletons. */
export interface JobTrackingDeps {
  readonly isSpoolmanEnabled: () => boolean;
  readonly isStationContext: (contextId: string) => boolean;
  readonly resolveStoreKey: (contextId: string) => string;
  readonly setJob: (storeKey: string, job: TrackedJob) => void;
  readonly takeJob: (storeKey: string) => TrackedJob | null;
  readonly buildProfile: (filePath: string, initialTool: number) => Promise<ToolUsageProfile | null>;
  readonly listJobs: (contextId: string) => Promise<ReadonlyArray<AD5XJobInfo | BasicJobInfo>>;
  readonly now: () => Date;
}

async function listStationJobs(contextId: string): Promise<ReadonlyArray<AD5XJobInfo | BasicJobInfo>> {
  const manager = getPrinterBackendManager();
  const results: JobListResult[] = [];
  for (const load of [() => manager.getRecentJobs(contextId), () => manager.getLocalJobs(contextId)]) {
    try {
      results.push(await load());
    } catch (error) {
      console.warn(
        '[job-tracking] Printer file list lookup failed:',
        error instanceof Error ? error.message : error
      );
    }
  }
  return results.filter((result) => result.success).flatMap((result) => result.jobs);
}

const defaultDeps: JobTrackingDeps = {
  isSpoolmanEnabled: () => getSpoolmanIntegrationService().isGloballyEnabled(),
  isStationContext: (contextId) =>
    getPrinterBackendManager().isFeatureAvailable(contextId, 'material-station'),
  resolveStoreKey: (contextId) => resolveStationStoreKey(contextId),
  setJob: (storeKey, job) => getTrackedJobStore().setJob(storeKey, job),
  takeJob: (storeKey) => getTrackedJobStore().takeJob(storeKey),
  buildProfile: (filePath, initialTool) => buildToolUsageProfile(filePath, initialTool),
  listJobs: listStationJobs,
  now: () => new Date(),
};

/** Result of an arming attempt, for logs and tests. */
export type ArmResult =
  | { readonly armed: true; readonly job: TrackedJob }
  | { readonly armed: false; readonly reason: string };

/**
 * Forget the tracked job of a printer because the app starts another job.
 * Call this for every app-started job on a station printer.
 */
export function clearTrackedJob(contextId: string, deps: JobTrackingDeps = defaultDeps): void {
  if (!deps.isStationContext(contextId)) {
    return;
  }
  const previous = deps.takeJob(deps.resolveStoreKey(contextId));
  if (previous) {
    console.log(
      `[job-tracking] Dropped the tracked job ${previous.fileName}: the app started another job.`
    );
  }
}

function store(
  contextId: string,
  fileName: string,
  source: TrackedJobSource,
  tools: TrackedTool[],
  usageProfile: ToolUsageProfile | null,
  deps: JobTrackingDeps
): ArmResult {
  const job: TrackedJob = {
    fileName,
    source,
    tools,
    usageProfile,
    armedAt: deps.now().toISOString(),
    startedAt: null,
    lastProgress: null,
    lastProgressAt: null,
  };
  deps.setJob(deps.resolveStoreKey(contextId), job);
  console.log(
    `[job-tracking] Tracking ${fileName} on context ${contextId}: ` +
      tools
        .map((tool) => `T${tool.toolId}→slot ${tool.slotId}→spool ${tool.spoolId} (${tool.usedG ?? '?'} g)`)
        .join(', ') +
      (usageProfile ? ' with a per-tool usage profile.' : ' without a usage profile.')
  );
  return { armed: true, job };
}

function precheck(
  contextId: string,
  spoolAssignments: readonly ToolSpoolAssignment[] | undefined,
  deps: JobTrackingDeps
): string | null {
  if (!deps.isSpoolmanEnabled()) {
    return 'spoolman-disabled';
  }
  if (!deps.isStationContext(contextId)) {
    return 'not-a-station-context';
  }
  if (!spoolAssignments?.some((entry) => typeof entry.spoolId === 'number')) {
    return 'no-spools-chosen';
  }
  return null;
}

/**
 * Track a 3MF that the app uploaded and started.
 *
 * @param contextId - Printer context
 * @param upload - File name on the printer, local path of the staged 3MF,
 *   its parse result, and the mappings and spool choices from the dialog
 */
export async function armUploadedJob(
  contextId: string,
  upload: {
    readonly fileName: string;
    readonly filePath: string;
    readonly parsed: ParseResult;
    readonly mappings: readonly ToolSlotMapping[];
    readonly spoolAssignments: readonly ToolSpoolAssignment[] | undefined;
  },
  deps: JobTrackingDeps = defaultDeps
): Promise<ArmResult> {
  const skip = precheck(contextId, upload.spoolAssignments, deps);
  if (skip) {
    return { armed: false, reason: skip };
  }

  let estimates = estimatesFromParse(upload.parsed);
  if (estimates.every((estimate) => estimate.usedG === null && estimate.usedM === null)) {
    // Fallback for files without per-filament data: the AD5X file list has
    // per-tool weights for the file it just received.
    const job = (await deps.listJobs(contextId)).find(
      (candidate): candidate is AD5XJobInfo =>
        candidate._type === 'ad5x' && candidate.fileName === upload.fileName
    );
    if (job) {
      estimates = estimatesFromAd5xJob(job);
    }
  }

  const tools = buildTrackedTools(upload.mappings, upload.spoolAssignments ?? [], estimates);
  if (tools.length === 0) {
    return { armed: false, reason: 'no-spools-chosen' };
  }

  let usageProfile: ToolUsageProfile | null = null;
  try {
    const initialTool = Math.min(...upload.mappings.map((mapping) => mapping.toolId));
    usageProfile = await deps.buildProfile(upload.filePath, initialTool);
  } catch (error) {
    console.warn(
      `[job-tracking] Could not read the gcode of ${upload.fileName}; a cancel is charged by progress only:`,
      error instanceof Error ? error.message : error
    );
  }

  return store(contextId, upload.fileName, 'upload-3mf', tools, usageProfile, deps);
}

/**
 * Track a file already on the printer that the app started (AD5X
 * multi-material start through the matching dialog). Look up the per-tool
 * data before the start command, while the file list is stable.
 *
 * @returns The tools to track, or a skip reason; pass the tools to
 *   {@link commitStoredFileJob} after the printer accepts the start.
 */
export async function prepareStoredFileJob(
  contextId: string,
  fileName: string,
  mappings: readonly ToolSlotMapping[],
  spoolAssignments: readonly ToolSpoolAssignment[] | undefined,
  deps: JobTrackingDeps = defaultDeps
): Promise<{ readonly tools: TrackedTool[] } | { readonly reason: string }> {
  const skip = precheck(contextId, spoolAssignments, deps);
  if (skip) {
    return { reason: skip };
  }
  const job = (await deps.listJobs(contextId)).find(
    (candidate): candidate is AD5XJobInfo =>
      candidate._type === 'ad5x' && candidate.fileName === fileName
  );
  if (!job) {
    return { reason: 'metadata-unavailable' };
  }
  const tools = buildTrackedTools(mappings, spoolAssignments ?? [], estimatesFromAd5xJob(job));
  return tools.length > 0 ? { tools } : { reason: 'no-spools-chosen' };
}

/** Store the tracked job prepared by {@link prepareStoredFileJob}. */
export function commitStoredFileJob(
  contextId: string,
  fileName: string,
  tools: TrackedTool[],
  deps: JobTrackingDeps = defaultDeps
): ArmResult {
  return store(contextId, fileName, 'stored-file', tools, null, deps);
}
