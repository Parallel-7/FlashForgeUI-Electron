/**
 * @fileoverview Estimate capture for stored-file prints started through the
 * app's job/file list (no app upload), for material-station printers.
 *
 * The upload flow (station-estimate.ts + its IPC/WebUI callers) captures
 * per-tool estimates from the staged 3mf or the printer's per-tool file data.
 * Files that already live on the printer never pass through that flow, so
 * until now they were untracked.
 *
 * This module adds a second capture source for that gap, narrowly scoped per
 * the approved design:
 * - AD5X station contexts only. Creator 5 is HTTP-list-names-only, so its
 *   stored files stay upload-only. Non-station printers keep the unchanged
 *   single-spool SpoolmanUsageTracker flow.
 * - Single material/tool only. Multi-material stored files are never captured
 *   (per-tool attribution for those still requires an app 3mf upload).
 * - The estimate is the printer-reported total filament weight from the same
 *   gcodeList detail the jobs panel renders (GcodeFileEntry.totalFilamentWeight
 *   with the single tool's filamentWeight as fallback).
 * - Spool resolution NEVER guesses: the single tool is attributed to the one
 *   slot's spool only when exactly one slot has a spool assigned for the
 *   context. Zero or multiple assignments skip the deduction with a warning.
 * - Propagation lag: firmware may not have moved a just-started file into the
 *   recent list when the first lookup runs (the emulator applies that
 *   transition synchronously, so e2e cannot exercise it). One fixed-delay
 *   retry inside the fire-and-forget capture promise covers that race; the
 *   job start response (IPC reply or HTTP response) never waits on it.
 * - Reason fidelity limit: the ff-api gcodeList call resolves to [] both for
 *   "no recent files" and for an HTTP failure, and the backend cannot
 *   distinguish the two without an ff-api change. An entirely empty recent
 *   list right after a start is logged at warn level (more likely a fetch
 *   failure than absence); the reported reason stays 'file-not-in-list'.
 *
 * The written record is a normal JobEstimateRecord (source:
 * 'printer-metadata'), so terminal-only deduction, fraction-on-cancel and
 * exactly-once semantics are all reused unchanged from StationUsageTracker.
 */

import type { AD5XJobInfo, BasicJobInfo, JobListResult } from '@shared/types/printer-backend/backend-operations';
import { getPrinterBackendManager } from '../managers/PrinterBackendManager.js';
import { getPrinterContextManager } from '../managers/PrinterContextManager.js';
import { getJobEstimateStore } from './JobEstimateStore';
import { getSlotSpoolStore } from './SlotSpoolStore';
import { getSpoolmanIntegrationService } from './SpoolmanIntegrationService';
import { captureStationEstimate } from './station-estimate';
import { resolveStationStoreKey } from './station-store-key';

/** Why a stored-file capture did not produce an estimate record. */
export type StoredFileCaptureReason =
  | 'spoolman-disabled'
  | 'not-a-station-context'
  | 'already-tracked'
  | 'file-not-in-list'
  | 'metadata-unavailable'
  | 'multi-material'
  | 'no-filament-weight'
  | 'no-spool-assigned'
  | 'multiple-spools-assigned';

/** Outcome of {@link planStoredFileCapture} for one stored file. */
export type StoredFileCapturePlan =
  | { readonly captured: false; readonly reason: StoredFileCaptureReason }
  | {
      readonly captured: true;
      readonly toolId: number;
      readonly slotId: number;
      readonly usedG: number;
    };

/** Hint surfaced in logs and the UI when the spool rule blocks tracking. */
export const SPOOL_RESOLUTION_HINT =
  'assign exactly one spool to track printer-started jobs, or upload through the app for per-tool attribution';

/**
 * Decide whether a stored file may be tracked from printer metadata alone.
 * Pure so the capture rule is unit-testable and mirrorable browser-side.
 *
 * Multi-material means the metadata declares more than one tool
 * (`toolCount > 1` or more than one `toolDatas` entry). The accepted weight is
 * `totalFilamentWeight`, falling back to the single tool's `filamentWeight`.
 *
 * @param job - File-list entry for the stored file (null when not listed)
 * @param assignedSlotIds - Slots that currently have a spool assigned
 * @returns capture plan; `captured: true` carries tool/slot/weight to record
 */
export function planStoredFileCapture(
  job: AD5XJobInfo | BasicJobInfo | null,
  assignedSlotIds: readonly number[]
): StoredFileCapturePlan {
  if (!job) {
    return { captured: false, reason: 'file-not-in-list' };
  }

  // Creator 5 (and any printer without gcodeList detail) only reports names.
  if (job._type !== 'ad5x') {
    return { captured: false, reason: 'metadata-unavailable' };
  }

  const toolCount = job.toolCount ?? job.toolDatas?.length ?? 0;
  const toolDatas = job.toolDatas ?? [];
  if (toolCount > 1 || toolDatas.length > 1) {
    return { captured: false, reason: 'multi-material' };
  }

  const totalWeight = job.totalFilamentWeight;
  const singleToolWeight = toolDatas[0]?.filamentWeight;
  const usedG =
    totalWeight !== undefined && Number.isFinite(totalWeight) && totalWeight > 0
      ? totalWeight
      : singleToolWeight !== undefined && Number.isFinite(singleToolWeight) && singleToolWeight > 0
        ? singleToolWeight
        : null;
  if (usedG === null) {
    return { captured: false, reason: 'no-filament-weight' };
  }

  if (assignedSlotIds.length === 0) {
    return { captured: false, reason: 'no-spool-assigned' };
  }
  if (assignedSlotIds.length > 1) {
    return { captured: false, reason: 'multiple-spools-assigned' };
  }

  const slotId = assignedSlotIds[0] as number;
  const toolId = toolDatas[0]?.toolId ?? 0;
  return { captured: true, toolId, slotId, usedG };
}

/** Injectable surface so the orchestrator is unit-testable without singletons. */
export interface StoredFileEstimateDeps {
  readonly isSpoolmanEnabled: () => boolean;
  readonly isStationContext: (contextId: string) => boolean;
  readonly getRecentJobs: (contextId: string) => Promise<JobListResult>;
  readonly hasEstimate: (storeKey: string, fileName: string) => boolean;
  readonly assignedSlotIds: (storeKey: string) => readonly number[];
  readonly resolveStoreKey: (contextId: string) => string;
  readonly capture: (
    contextId: string,
    fileName: string,
    plan: {
      readonly toolId: number;
      readonly slotId: number;
      readonly usedG: number;
    }
  ) => void;
}

const defaultDeps: StoredFileEstimateDeps = {
  isSpoolmanEnabled: () => getSpoolmanIntegrationService().isGloballyEnabled(),
  isStationContext: (contextId) => getPrinterBackendManager().isFeatureAvailable(contextId, 'material-station'),
  getRecentJobs: (contextId) => {
    const backend = getPrinterContextManager().getContext(contextId)?.backend;
    if (!backend) {
      return Promise.reject(new Error(`No printer backend for context ${contextId}`));
    }
    return backend.getRecentJobs();
  },
  hasEstimate: (storeKey, fileName) => getJobEstimateStore().findEstimate(storeKey, fileName) !== null,
  assignedSlotIds: (storeKey) => [...getSlotSpoolStore().getSlotMap(storeKey).keys()],
  resolveStoreKey: (contextId) => resolveStationStoreKey(contextId),
  capture: (contextId, fileName, tool) =>
    captureStationEstimate(
      contextId,
      fileName,
      [{ toolId: tool.toolId, slotId: tool.slotId }],
      [{ toolId: tool.toolId, slotId: tool.slotId, usedG: tool.usedG, usedM: null }],
      'printer-metadata'
    ),
};

/**
 * Fixed delay before the single recent-list retry, in milliseconds. Real
 * firmware takes a moment to move a just-started file into the recent list
 * after the start command; the emulator applies that transition
 * synchronously, so e2e cannot exercise the lag. One retry after this
 * constant covers the observed propagation window without config surface.
 */
export const PROPAGATION_RETRY_DELAY_MS = 2_000;

/**
 * Capture a printer-metadata estimate when a stored-file print starts through
 * the app. Never throws: lookup failures are logged and reported as
 * 'metadata-unavailable'. Callers still treat the result as best-effort.
 *
 * When the first lookup does not find the file, exactly one retry runs after
 * {@link PROPAGATION_RETRY_DELAY_MS} to absorb firmware propagation lag. The
 * wait lives inside this promise: callers fire-and-forget, so the job start
 * response never blocks on it.
 *
 * @param contextId - Printer context starting the stored-file print
 * @param fileName - Stored file name exactly as the printer reports it
 * @param deps - Override for tests; defaults wire the real singletons
 * @returns the skip reason, or null when an estimate was captured
 */
export async function captureStoredFileEstimate(
  contextId: string,
  fileName: string,
  deps: StoredFileEstimateDeps = defaultDeps
): Promise<StoredFileCaptureReason | null> {
  if (!deps.isSpoolmanEnabled()) {
    return 'spoolman-disabled';
  }
  if (!deps.isStationContext(contextId)) {
    return 'not-a-station-context';
  }

  const storeKey = deps.resolveStoreKey(contextId);
  if (deps.hasEstimate(storeKey, fileName)) {
    // Never overwrite an upload-sourced record (richer per-tool data).
    return 'already-tracked';
  }

  const attempt = async (): Promise<StoredFileCaptureReason | null> => {
    let jobs: readonly (AD5XJobInfo | BasicJobInfo)[];
    try {
      jobs = (await deps.getRecentJobs(contextId)).jobs;
    } catch (error) {
      console.warn(
        `[stored-file-estimate] File list lookup failed for ${fileName} on context ${contextId}:`,
        error instanceof Error ? error.message : error
      );
      return 'metadata-unavailable';
    }

    const job = jobs.find((candidate) => candidate.fileName === fileName) ?? null;
    const plan = planStoredFileCapture(job, deps.assignedSlotIds(storeKey));
    if (!plan.captured) {
      if (plan.reason === 'file-not-in-list' && jobs.length === 0) {
        logEmptyListDoubt(fileName, contextId);
      } else {
        logSkip(fileName, contextId, plan.reason);
      }
      return plan.reason;
    }

    deps.capture(contextId, fileName, {
      toolId: plan.toolId,
      slotId: plan.slotId,
      usedG: plan.usedG,
    });
    return null;
  };

  const firstResult = await attempt();
  if (firstResult !== 'file-not-in-list') {
    return firstResult;
  }

  // Propagation race: firmware may not have moved the just-started file into
  // the recent list yet. Retry exactly once, inside this already
  // fire-and-forget promise, so the start response never waits.
  await delay(PROPAGATION_RETRY_DELAY_MS);
  return attempt();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * The ff-api gcodeList call resolves to [] both for "no recent files" and for
 * an HTTP failure, so an entirely empty recent list right after a start is
 * more likely a fetch failure than true absence. The reported reason stays
 * 'file-not-in-list' (distinguishing the two requires an ff-api change); this
 * log surfaces the doubt at warn level instead of debug.
 */
function logEmptyListDoubt(fileName: string, contextId: string): void {
  console.warn(
    `[stored-file-estimate] Recent file list is empty for ${fileName} on context ${contextId}: ` +
      "reporting 'file-not-in-list', but an empty list right after a start is more likely a " +
      'gcodeList fetch failure than actual absence (the ff-api lib returns [] for both)'
  );
}

function logSkip(fileName: string, contextId: string, reason: StoredFileCaptureReason): void {
  if (reason === 'no-spool-assigned' || reason === 'multiple-spools-assigned') {
    console.warn(
      `[stored-file-estimate] ${fileName} on context ${contextId} is single-material but will not be ` +
        `tracked (${reason}): ${SPOOL_RESOLUTION_HINT}`
    );
    return;
  }
  console.debug(`[stored-file-estimate] Skipping ${fileName} on context ${contextId}: ${reason}`);
}
