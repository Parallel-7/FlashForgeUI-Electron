/**
 * @fileoverview Types for estimate-based Spoolman consumption tracking on
 * material-station printers (Creator 5 series, AD5X with station).
 *
 * The firmware provides no per-tool usage over HTTP, so consumption for
 * station printers is ESTIMATED from per-filament slicer data captured at
 * upload time and deducted against the spool assigned to each slot when the
 * print reaches a terminal state (completed / cancelled / error).
 *
 * Invariants enforced by the consumers of these types:
 * - No estimate => no deduction (never split totals or guess density).
 * - Exactly-once deduction per job across all terminal paths.
 * - Spoolman API failures never affect printing (log + UI hint only).
 *
 * Shared between the main-process tracker stack
 * (src/main/services/StationUsageTracker.ts and friends) and the renderer /
 * embedded WebUI surfaces that display deduction state. Also carries the
 * `spoolman:get-status` IPC payload types shared by both desktop preloads
 * (main renderer + component dialog).
 */

/** Slot binding for a single tool of an uploaded job. */
export interface ToolSlotMapping {
  readonly toolId: number;
  readonly slotId: number;
}

/** Per-tool usage estimate for a station print job. `null` means unknown. */
export interface ToolEstimate {
  readonly toolId: number;
  readonly slotId: number;
  /** Estimated filament consumed by this tool, in grams. Null = unknown. */
  readonly usedG: number | null;
  /** Estimated filament consumed by this tool, in meters. Null = unknown. */
  readonly usedM: number | null;
}

/**
 * Persisted estimate record for one uploaded file on one printer context.
 * Keyed by the final file name as reported by the printer while printing.
 */
export interface JobEstimateRecord {
  readonly fileName: string;
  readonly mappings: readonly ToolSlotMapping[];
  readonly perTool: readonly ToolEstimate[];
  /** ISO 8601 timestamp of when the upload was captured. */
  readonly capturedAt: string;
}

/** Terminal print state that triggers a deduction attempt. */
export type DeductionTerminal = 'completed' | 'cancelled' | 'error';

/** Outcome for a single tool during a deduction attempt. */
export interface ToolDeduction {
  readonly toolId: number;
  readonly slotId: number;
  /** Spool the deduction was applied to; null when unresolved. */
  readonly spoolId: number | null;
  /** Deducted amount (grams in weight mode, mm in length mode); null when skipped. */
  readonly amount: number | null;
  readonly mode: SpoolDeductionMode;
  readonly status: 'deducted' | 'skipped';
  /** Human-readable reason when status is 'skipped'. */
  readonly reason?: string;
}

/** Update mode mirrored from the Spoolman config for deduction payloads. */
export type SpoolDeductionMode = 'weight' | 'length';

/** Summary of one terminal-state deduction attempt (for UI + logs). */
export interface DeductionSummary {
  readonly fileName: string;
  readonly terminal: DeductionTerminal;
  /** Fraction of the estimate deducted (1 for completion, 0-1 on cancel). */
  readonly fraction: number;
  readonly tools: readonly ToolDeduction[];
  readonly deductedCount: number;
  readonly skippedCount: number;
  /** ISO 8601 timestamp of the deduction attempt. */
  readonly at: string;
}

/** One slot→spool assignment row for the station tracking view. */
export interface SlotSpoolAssignment {
  readonly slotId: number;
  readonly spoolId: number | null;
}

/**
 * Station tracking view payload for material-station contexts: per-slot
 * spool assignments plus the most recent terminal-state deduction.
 */
export interface SpoolmanStationStatus {
  readonly supported: boolean;
  /** Copy shown in the UI explaining the estimate-based flow. */
  readonly note: string;
  readonly slotAssignments: readonly SlotSpoolAssignment[];
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
  /** Present on material-station contexts (estimate-based tracking view). */
  readonly station?: SpoolmanStationStatus | null;
}
