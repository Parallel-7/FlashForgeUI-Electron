/**
 * @fileoverview Types for per-job Spoolman consumption tracking on
 * material-station printers (Creator 5 series, AD5X with station).
 *
 * The firmware reports no per-tool usage, so consumption is estimated from the
 * slicer's per-filament data. The user picks a Spoolman spool for each tool
 * when they match materials for a job the app starts. That choice belongs to
 * that one job only: it is deleted when the job ends, so a later print never
 * uses stale spool choices. Nothing is remembered per slot or per printer,
 * because the loaded spools can change on the printer at any time.
 *
 * Invariants enforced by the consumers of these types:
 * - Only jobs the app started are tracked. No record means no deduction.
 * - Each job is deducted at most once: the record is removed before any
 *   Spoolman request is sent.
 * - Spoolman API failures never affect printing (log + UI hint only).
 */

/** Spool choice for one tool, as sent by the matching dialog. */
export interface ToolSpoolAssignment {
  readonly toolId: number;
  /** Spoolman spool id, or null when the user chose not to track the tool. */
  readonly spoolId: number | null;
}

/**
 * Per-tool usage curve against gcode byte position.
 *
 * `perTool[toolId][i]` is the fraction (0-1) of that tool's total extrusion
 * done after the first `i / sampleCount` of the gcode bytes. Each array has
 * `sampleCount + 1` values. Tools without extrusion have no entry.
 */
export interface ToolUsageProfile {
  readonly sampleCount: number;
  readonly perTool: Readonly<Record<string, readonly number[]>>;
}

/** One tracked tool of a job. */
export interface TrackedTool {
  readonly toolId: number;
  /** Material station slot (1-based) the tool prints from. */
  readonly slotId: number;
  readonly spoolId: number;
  /** Estimated filament for the full print, in grams. Null = unknown. */
  readonly usedG: number | null;
  /** Estimated filament for the full print, in meters. Null = unknown. */
  readonly usedM: number | null;
}

/**
 * Where a {@link TrackedJob} came from.
 *
 * - `upload-3mf`: a 3MF uploaded and started by the app; estimates and the
 *   usage profile come from the file itself
 * - `stored-file`: a file already on the printer (AD5X), started by the app;
 *   estimates come from the printer's file list and there is no usage profile
 */
export type TrackedJobSource = 'upload-3mf' | 'stored-file';

/** The one job being tracked on a printer. */
export interface TrackedJob {
  /** File name as the app sent it to the printer. */
  readonly fileName: string;
  readonly source: TrackedJobSource;
  readonly tools: readonly TrackedTool[];
  /** Per-tool usage curve; null means a cancel is charged linearly. */
  readonly usageProfile: ToolUsageProfile | null;
  /** ISO 8601 time when the app started the job. */
  readonly armedAt: string;
  /** ISO 8601 time when the printer was first seen printing the job. */
  startedAt: string | null;
  /** Last printer-reported progress for the job, 0-100. */
  lastProgress: number | null;
  /** ISO 8601 time of {@link lastProgress}. */
  lastProgressAt: string | null;
}

/** How a tracked job ended. */
export type DeductionTerminal = 'completed' | 'cancelled' | 'error' | 'interrupted';

/** Outcome for a single tool during a deduction attempt. */
export interface ToolDeduction {
  readonly toolId: number;
  readonly slotId: number;
  readonly spoolId: number | null;
  /** Deducted amount (grams in weight mode, mm in length mode); null when skipped. */
  readonly amount: number | null;
  readonly mode: SpoolDeductionMode;
  /** Fraction of the tool's estimate that was charged (0-1). */
  readonly fraction: number;
  readonly status: 'deducted' | 'skipped';
  /** Human-readable reason when status is 'skipped'. */
  readonly reason?: string;
}

/** Update mode mirrored from the Spoolman config for deduction payloads. */
export type SpoolDeductionMode = 'weight' | 'length';

/** Summary of one deduction attempt (for UI + logs). */
export interface DeductionSummary {
  readonly fileName: string;
  readonly terminal: DeductionTerminal;
  /** Printer progress used for the charge (100 for a completed job). */
  readonly progress: number;
  /** True when the end state was not seen and the last progress was used. */
  readonly approximate: boolean;
  readonly tools: readonly ToolDeduction[];
  readonly deductedCount: number;
  readonly skippedCount: number;
  /** ISO 8601 timestamp of the deduction attempt. */
  readonly at: string;
}

/** Panel view of the job tracked now. */
export interface SpoolmanTrackedJobView {
  readonly fileName: string;
  readonly started: boolean;
  readonly lastProgress: number | null;
  readonly hasUsageProfile: boolean;
  readonly tools: ReadonlyArray<{
    readonly toolId: number;
    readonly slotId: number;
    readonly spoolId: number;
    readonly usedG: number | null;
    readonly usedM: number | null;
  }>;
}

/**
 * Station tracking view payload for material-station contexts: the job
 * tracked now plus the most recent deduction.
 */
export interface SpoolmanStationStatus {
  readonly supported: boolean;
  /** Plain explanation shown in the UI. */
  readonly note: string;
  readonly activeJob: SpoolmanTrackedJobView | null;
  readonly lastDeduction: DeductionSummary | null;
}

/**
 * Payload returned by the `spoolman:get-status` IPC channel (main → renderer).
 * `station` is present (non-null) on material-station contexts.
 */
export interface SpoolmanStatusPayload {
  readonly enabled: boolean;
  readonly disabledReason?: string | null;
  readonly contextId?: string | null;
  /** Present on material-station contexts (per-job tracking view). */
  readonly station?: SpoolmanStationStatus | null;
}
