/**
 * @fileoverview Terminal-state Spoolman deduction for material-station
 * printers (Creator 5 series, AD5X with station).
 *
 * The firmware exposes no per-tool usage over HTTP, so this tracker works
 * from upload-time estimates (see {@link JobEstimateStore}) and the
 * slot→spool assignments (see {@link SlotSpoolStore}):
 *
 * - Deduction fires ONLY at terminal states:
 *   (a) completion  → deduct the FULL per-tool estimates;
 *   (b) cancel/stop or error → deduct the last-known printer-reported
 *       progress fraction × per-tool estimates. If no (or zero) progress
 *       signal is known, NOTHING is deducted and a warning is logged —
 *       the tracker never guesses.
 *   Pause/resume transitions deduct nothing; the print still ends in (a)
 *   or (b).
 * - Exactly-once per job across all terminal paths, keyed by
 *   fileName + startedAt marker and persisted in the estimate store ledger.
 *   The ledger is keyed by PRINTER SERIAL (context id fallback, see
 *   {@link resolveStationStoreKey}) so the guard survives app restarts
 *   and printer reconnects, and the entry is reserved synchronously BEFORE
 *   any Spoolman I/O — a second distinct terminal transition (Cancelled →
 *   Error etc.) arriving while HTTP is slow can never double-deduct.
 * - Spoolman API failures are logged and surfaced as skipped tools; they
 *   never affect printing.
 */

import type {
  DeductionSummary,
  DeductionTerminal,
  JobEstimateRecord,
  SpoolDeductionMode,
  ToolDeduction,
} from '@shared/types/spoolman-tracking';
import type { PrinterStatus } from '@shared/types/polling';
import type { SpoolmanIntegrationService } from './SpoolmanIntegrationService';
import type { SpoolmanService } from './SpoolmanService';
import type { JobEstimateStore } from './JobEstimateStore';
import type { SlotSpoolStore } from './SlotSpoolStore';
import type { PrintStateMonitor } from './PrintStateMonitor';
import type { PrinterPollingService } from './PrinterPollingService';
import { resolveStationStoreKey } from './station-store-key';

/**
 * Factory for a ready-to-use Spoolman client, or null while the integration
 * is disabled/unconfigured. Resolved lazily at deduction time so runtime
 * config changes are honored.
 */
export type SpoolmanServiceFactory = () => SpoolmanService | null;

/** Rounding for deducted amounts (grams / millimetres). */
const AMOUNT_DECIMALS = 2;

/** Last-known progress snapshot used to source the cancel fraction. */
interface ProgressSnapshot {
  fileName: string;
  /** Printer-reported progress percentage, 0-100. */
  percent: number;
  /** Epoch ms of the poll that produced this snapshot. */
  at: number;
}

/** Payload shape shared by PrintStateMonitor lifecycle events. */
interface PrintLifecycleEvent {
  readonly contextId: string;
  readonly jobName: string | null;
  readonly status: PrinterStatus;
  readonly timestamp?: Date;
  readonly completedAt?: Date;
}

/** Result of evaluating whether and how much to deduct. */
export interface DeductionPlan {
  fraction: number | null;
  reason?: string;
}

/** Dependencies for constructing a per-context station tracker. */
export interface StationUsageTrackerDeps {
  readonly contextId: string;
  readonly estimates: JobEstimateStore;
  readonly slots: SlotSpoolStore;
  readonly createSpoolmanService: SpoolmanServiceFactory;
  readonly integrationService: SpoolmanIntegrationService;
  /** Invoked after every deduction attempt (including all-skipped ones). */
  readonly onSummary?: (summary: DeductionSummary) => void;
}

/**
 * Pure deduction planner: decides the fraction to deduct for a terminal
 * event given the last-known progress signal. Returns a null fraction when
 * no trustworthy progress is known (cancel path only — completion is always
 * fraction 1).
 */
export function planDeductionFraction(
  terminal: DeductionTerminal,
  lastKnown: ProgressSnapshot | null,
  terminalJobName: string | null
): DeductionPlan {
  if (terminal === 'completed') {
    return { fraction: 1 };
  }
  if (!lastKnown) {
    return {
      fraction: null,
      reason: 'no printer-reported progress was observed for this print',
    };
  }
  // A terminal event that still names a file only trusts progress sampled
  // for that same file; anything else is treated as an unknown signal.
  if (terminalJobName && terminalJobName !== lastKnown.fileName) {
    return {
      fraction: null,
      reason: `progress signal was for a different job (${lastKnown.fileName})`,
    };
  }
  const fraction = lastKnown.percent / 100;
  if (!Number.isFinite(fraction) || fraction <= 0) {
    return { fraction: null, reason: 'printer-reported progress was zero or unknown' };
  }
  return { fraction: Math.min(fraction, 1) };
}

/** Round to the tracker's amount precision. */
function roundAmount(value: number): number {
  const factor = 10 ** AMOUNT_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * Per-tool deduction executor for one material-station context.
 *
 * The single-extruder path ({@link SpoolmanUsageTracker}) is untouched; this
 * class is only ever instantiated for contexts whose backend exposes the
 * material-station feature.
 */
export class StationUsageTracker {
  private readonly deps: StationUsageTrackerDeps;
  private stateMonitor: PrintStateMonitor | null = null;
  private pollingService: PrinterPollingService | null = null;
  private activeJobKey: string | null = null;
  private activeFileName: string | null = null;
  private lastKnownProgress: ProgressSnapshot | null = null;
  private lastSummary: DeductionSummary | null = null;
  private disposed = false;

  constructor(deps: StationUsageTrackerDeps) {
    this.deps = deps;
  }

  /** Attach lifecycle + polling listeners for the context. */
  public setMonitors(
    stateMonitor: PrintStateMonitor,
    pollingService: PrinterPollingService | null
  ): void {
    this.detachListeners();
    this.stateMonitor = stateMonitor;
    this.pollingService = pollingService;

    stateMonitor.on('print-started', this.handlePrintStarted);
    stateMonitor.on('print-completed', this.handleTerminal);
    stateMonitor.on('print-cancelled', this.handleTerminal);
    stateMonitor.on('print-error', this.handleTerminal);
    pollingService?.on('status-updated', this.handleStatusUpdated);
    this.disposed = false;
  }

  /** Detach listeners (context teardown / re-attach). */
  public dispose(): void {
    this.detachListeners();
    this.disposed = true;
  }

  private detachListeners(): void {
    if (this.stateMonitor) {
      this.stateMonitor.off('print-started', this.handlePrintStarted);
      this.stateMonitor.off('print-completed', this.handleTerminal);
      this.stateMonitor.off('print-cancelled', this.handleTerminal);
      this.stateMonitor.off('print-error', this.handleTerminal);
      this.stateMonitor = null;
    }
    if (this.pollingService) {
      this.pollingService.off('status-updated', this.handleStatusUpdated);
      this.pollingService = null;
    }
  }

  /** Most recent deduction summary for panel display. */
  public getLastSummary(): DeductionSummary | null {
    return this.lastSummary;
  }

  /** Current slot→spool assignment view (slot id → spool id). */
  public getSlotAssignments(): ReadonlyMap<number, number> {
    return this.deps.slots.getSlotMap(resolveStationStoreKey(this.deps.contextId));
  }

  // --- event handlers -------------------------------------------------------

  private readonly handlePrintStarted = (event: PrintLifecycleEvent): void => {
    if (this.disposed) {
      return;
    }
    // New job: reset progress tracking and arm a fresh exactly-once key.
    this.lastKnownProgress = null;
    this.activeFileName = event.jobName;
    const startedAt = (event.timestamp ?? event.completedAt ?? new Date()).toISOString();
    this.activeJobKey = `${event.jobName}::${startedAt}`;
  };

  private readonly handleStatusUpdated = (status: PrinterStatus): void => {
    if (this.disposed) {
      return;
    }
    const fileName = status.currentJob?.fileName;
    const percent = status.currentJob?.progress?.percentage;
    if (!fileName || typeof percent !== 'number' || !Number.isFinite(percent) || percent <= 0) {
      return;
    }
    this.lastKnownProgress = { fileName, percent, at: Date.now() };
  };

  private readonly handleTerminal = (event: PrintLifecycleEvent): void => {
    if (this.disposed) {
      return;
    }
    const terminal = this.terminalFromStatus(event.status);
    if (!terminal) {
      return;
    }
    // At 'Cancelled'/'Error' the polled job is already stripped, so the
    // event jobName is usually null; fall back to the name captured at
    // print start, then to the last progress snapshot's file.
    const jobName =
      (event.jobName && event.jobName !== 'Unknown' ? event.jobName : null) ??
      this.activeFileName ??
      this.lastKnownProgress?.fileName ??
      null;
    // Fire-and-forget on purpose (poll handlers must never await network
    // I/O), but always observe the promise so a rejection can never become
    // an unhandledRejection; per-tool Spoolman errors are handled inside.
    void this.deductAtTerminal(terminal, jobName).catch((error: unknown) => {
      console.warn(
        `[StationUsageTracker] Terminal deduction failed for ${jobName ?? 'unknown job'} ` +
          `on context ${this.deps.contextId}:`,
        error
      );
    });
  };

  private terminalFromStatus(status: PrinterStatus): DeductionTerminal | null {
    switch (status.state) {
      case 'Completed':
        return 'completed';
      case 'Cancelled':
        return 'cancelled';
      case 'Error':
        return 'error';
      default:
        return null;
    }
  }

  // --- deduction ------------------------------------------------------------

  /** Deduct (or deliberately skip) a job at a terminal state. */
  public async deductAtTerminal(
    terminal: DeductionTerminal,
    jobName: string | null
  ): Promise<DeductionSummary | null> {
    if (!jobName) {
      console.warn(
        `[StationUsageTracker] Terminal state ${terminal} on context ${this.deps.contextId} ` +
          'without a job name; no deduction attempted.'
      );
      return null;
    }

    const jobKey =
      this.activeJobKey ?? `${jobName}::${(this.lastKnownProgress?.at ?? 0).toString()}`;

    // Keyed by printer serial (stable across restarts/reconnects); falls
    // back to the context id with a one-time warning when unavailable.
    const storeKey = resolveStationStoreKey(this.deps.contextId);

    if (this.deps.estimates.isDeducted(storeKey, jobKey)) {
      console.log(
        `[StationUsageTracker] Job ${jobName} on context ${this.deps.contextId} already deducted; skipping.`
      );
      return null;
    }

    const plan = planDeductionFraction(terminal, this.lastKnownProgress, jobName);
    if (plan.fraction === null) {
      // No trustworthy progress signal: never guess. Mark the attempt so the
      // other terminal paths cannot deduct later for the same key either.
      this.deps.estimates.markDeducted(storeKey, jobKey);
      console.warn(
        `[StationUsageTracker] No deduction for cancelled job ${jobName} on context ` +
          `${this.deps.contextId}: ${plan.reason ?? 'unknown progress'}.`
      );
      const skipped: DeductionSummary = {
        fileName: jobName,
        terminal,
        fraction: 0,
        tools: [],
        deductedCount: 0,
        skippedCount: 0,
        at: new Date().toISOString(),
      };
      this.lastSummary = skipped;
      this.deps.onSummary?.(skipped);
      return skipped;
    }
    const fraction = plan.fraction;

    const record = this.deps.estimates.findEstimate(storeKey, jobName);
    if (!record) {
      // Untracked job (not uploaded through this app). Nothing to deduct.
      this.deps.estimates.markDeducted(storeKey, jobKey);
      console.log(
        `[StationUsageTracker] Job ${jobName} on context ${this.deps.contextId} has no upload ` +
          'estimate record (started on the printer?); no deduction.'
      );
      const untracked: DeductionSummary = {
        fileName: jobName,
        terminal,
        fraction,
        tools: [],
        deductedCount: 0,
        skippedCount: 0,
        at: new Date().toISOString(),
      };
      this.lastSummary = untracked;
      this.deps.onSummary?.(untracked);
      return untracked;
    }

    // Reserve the ledger key BEFORE awaiting anything: a second distinct
    // terminal transition (e.g. Cancelled → Error) arriving while the
    // Spoolman HTTP call is in flight must observe the job as already
    // claimed. Per-tool failures in applyDeductions are caught and skipped
    // individually, so reserving first only means a crash mid-apply can
    // under-deduct — the conservative failure mode.
    this.deps.estimates.markDeducted(storeKey, jobKey);

    const summary = await this.applyDeductions(record, terminal, fraction);
    this.lastSummary = summary;
    this.deps.onSummary?.(summary);
    return summary;
  }

  /** Execute per-tool deductions for a tracked job. */
  private async applyDeductions(
    record: JobEstimateRecord,
    terminal: DeductionTerminal,
    fraction: number
  ): Promise<DeductionSummary> {
    const mode = this.resolveMode();
    const service = this.deps.createSpoolmanService();
    const slotMap = this.deps.slots.getSlotMap(resolveStationStoreKey(this.deps.contextId));
    const tools: ToolDeduction[] = [];

    if (!service) {
      // Integration disabled/unconfigured at terminal time: opt-out, not an error.
      console.log(
        `[StationUsageTracker] Spoolman integration not configured; skipping deduction for ` +
          `${record.fileName} on context ${this.deps.contextId}.`
      );
      return {
        fileName: record.fileName,
        terminal,
        fraction,
        tools: [],
        deductedCount: 0,
        skippedCount: 0,
        at: new Date().toISOString(),
      };
    }

    for (const tool of record.perTool) {
      const spoolId = slotMap.get(tool.slotId) ?? null;
      const estimate = mode === 'weight' ? tool.usedG : tool.usedM;
      const unit = mode === 'weight' ? 'grams' : 'metres';

      if (estimate === null || !Number.isFinite(estimate) || estimate <= 0) {
        tools.push(
          this.skipped(tool, spoolId, mode, `no ${unit} estimate captured for tool ${tool.toolId}`)
        );
        continue;
      }
      if (spoolId === null) {
        tools.push(this.skipped(tool, null, mode, `no spool assigned to slot ${tool.slotId}`));
        continue;
      }

      // Length mode consumes millimetres; estimates are stored in metres.
      const amount = roundAmount(
        mode === 'weight' ? estimate * fraction : estimate * 1000 * fraction
      );
      if (amount <= 0) {
        tools.push(this.skipped(tool, spoolId, mode, `computed ${unit} amount rounded to zero`));
        continue;
      }

      try {
        const payload = mode === 'weight' ? { use_weight: amount } : { use_length: amount };
        await service.updateUsage(spoolId, payload);
        tools.push({
          toolId: tool.toolId,
          slotId: tool.slotId,
          spoolId,
          amount,
          mode,
          status: 'deducted',
        });
        console.log(
          `[StationUsageTracker] Deducted ${amount}${mode === 'weight' ? 'g' : 'mm'} from spool ` +
            `${spoolId} (tool ${tool.toolId}, slot ${tool.slotId}, job ${record.fileName}).`
        );
      } catch (error) {
        // Invariant: Spoolman failures never affect printing.
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[StationUsageTracker] Spoolman update failed for spool ${spoolId} ` +
            `(tool ${tool.toolId}, job ${record.fileName}): ${message}`
        );
        tools.push(this.skipped(tool, spoolId, mode, `spoolman update failed: ${message}`));
      }
    }

    const deductedCount = tools.filter((entry) => entry.status === 'deducted').length;
    const skippedCount = tools.length - deductedCount;
    if (skippedCount > 0) {
      console.warn(
        `[StationUsageTracker] Job ${record.fileName} (${terminal}) on context ` +
          `${this.deps.contextId}: ${deductedCount} tool(s) deducted, ${skippedCount} skipped.`
      );
    }
    return {
      fileName: record.fileName,
      terminal,
      fraction,
      tools,
      deductedCount,
      skippedCount,
      at: new Date().toISOString(),
    };
  }

  /** Weight-first per config; falls back to length mode only per config. */
  private resolveMode(): SpoolDeductionMode {
    return this.deps.integrationService.getUpdateMode() === 'length' ? 'length' : 'weight';
  }

  private skipped(
    tool: { toolId: number; slotId: number },
    spoolId: number | null,
    mode: SpoolDeductionMode,
    reason: string
  ): ToolDeduction {
    console.warn(`[StationUsageTracker] Skipping tool ${tool.toolId}: ${reason}.`);
    return {
      toolId: tool.toolId,
      slotId: tool.slotId,
      spoolId,
      amount: null,
      mode,
      status: 'skipped',
      reason,
    };
  }
}
