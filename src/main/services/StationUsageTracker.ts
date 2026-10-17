/**
 * @fileoverview Per-job Spoolman deduction for material-station printers
 * (Creator 5 series, AD5X with station).
 *
 * The firmware reports no per-tool usage, so this tracker works from the one
 * {@link TrackedJob} the app stored when it started the job (see
 * job-tracking). The job carries the spool the user chose for each tool.
 *
 * - While the printer prints the job, the tracker records the last progress
 *   value. Progress is the gcode byte position divided by the file size.
 * - When the job completes, each tool is charged its full estimate.
 * - When the job is cancelled or fails, each tool is charged the part of its
 *   estimate used at the last progress value. With a usage profile the part
 *   comes from the tool's own curve; without one it is the plain progress
 *   fraction. With no progress value, nothing is charged.
 * - Pause and resume charge nothing.
 * - If the app was not running when the job ended (restart or reconnect), the
 *   tracker charges the last recorded progress on the first status update and
 *   marks the result as approximate. A completed job is charged in full.
 * - The record is removed before any Spoolman request, so a job is charged at
 *   most once. Removing it also ends the spool choice: the next job asks again.
 * - Spoolman API failures are logged and reported as skipped tools; they
 *   never affect printing.
 */

import type {
  DeductionSummary,
  DeductionTerminal,
  SpoolDeductionMode,
  ToolDeduction,
  TrackedJob,
} from '@shared/types/spoolman-tracking';
import type { PrinterStatus } from '@shared/types/polling';
import type { PrinterState } from '@shared/types/polling';
import type { SpoolmanIntegrationService } from './SpoolmanIntegrationService';
import type { SpoolmanService } from './SpoolmanService';
import type { TrackedJobStore } from './TrackedJobStore';
import type { PrintStateMonitor } from './PrintStateMonitor';
import type { PrinterPollingService } from './PrinterPollingService';
import { resolveStationStoreKey } from './station-store-key';
import { usedFractionAt } from './tool-usage-profile';

/**
 * Factory for a ready-to-use Spoolman client, or null while the integration
 * is disabled/unconfigured. Resolved lazily at deduction time so runtime
 * config changes are honored.
 */
export type SpoolmanServiceFactory = () => SpoolmanService | null;

/** Rounding for deducted amounts (grams / millimetres). */
const AMOUNT_DECIMALS = 2;

/**
 * A job the app started but the printer never began is dropped after this
 * time, so a failed start cannot bind the spool choice to a later print.
 */
export const ARM_TIMEOUT_MS = 15 * 60 * 1000;

/** States in which the printer is working on a job. */
const ACTIVE_STATES: ReadonlySet<PrinterState> = new Set<PrinterState>([
  'Printing',
  'Paused',
  'Pausing',
  'Heating',
  'Calibrating',
  'Busy',
]);

/** Payload shape shared by PrintStateMonitor lifecycle events. */
interface PrintLifecycleEvent {
  readonly contextId: string;
  readonly jobName: string | null;
  readonly status: PrinterStatus;
}

/** Dependencies for constructing a per-context station tracker. */
export interface StationUsageTrackerDeps {
  readonly contextId: string;
  readonly jobs: Pick<TrackedJobStore, 'getJob' | 'updateJob' | 'takeJob'>;
  readonly createSpoolmanService: SpoolmanServiceFactory;
  readonly integrationService: Pick<SpoolmanIntegrationService, 'getUpdateMode'>;
  /** Invoked after every deduction attempt (including all-skipped ones). */
  readonly onSummary?: (summary: DeductionSummary) => void;
  /** Store key override for tests (defaults to the printer serial). */
  readonly resolveStoreKey?: (contextId: string) => string;
  /** Clock override for tests. */
  readonly now?: () => number;
}

/**
 * Normalize a file name for comparison: no directory, no extension, lower
 * case. The printer may report a 3MF job by its 3MF name or by the name of
 * the gcode inside it.
 */
export function jobNameKey(name: string | null | undefined): string {
  if (!name) {
    return '';
  }
  const base = name.replace(/\\/g, '/').split('/').pop() ?? '';
  return base.replace(/\.(3mf|gcode|gx|g)$/i, '').trim().toLowerCase();
}

/** True when two job names refer to the same file. */
export function sameJob(a: string | null | undefined, b: string | null | undefined): boolean {
  const keyA = jobNameKey(a);
  return keyA !== '' && keyA === jobNameKey(b);
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
  private lastSummary: DeductionSummary | null = null;
  private firstStatusHandled = false;
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

  /** The job this printer tracks now, or null. */
  public getTrackedJob(): TrackedJob | null {
    return this.deps.jobs.getJob(this.storeKey());
  }

  private storeKey(): string {
    return (this.deps.resolveStoreKey ?? resolveStationStoreKey)(this.deps.contextId);
  }

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  // --- event handlers -------------------------------------------------------

  /** Handle one polled status. Public for tests. */
  public readonly handleStatusUpdated = (status: PrinterStatus): void => {
    if (this.disposed) {
      return;
    }
    const key = this.storeKey();
    const job = this.deps.jobs.getJob(key);
    const firstStatus = !this.firstStatusHandled;
    this.firstStatusHandled = true;
    if (!job) {
      return;
    }

    const reportedName = status.currentJob?.fileName ?? null;
    const printingThisJob = ACTIVE_STATES.has(status.state) && sameJob(reportedName, job.fileName);

    if (printingThisJob) {
      this.recordProgress(key, job, status);
      return;
    }

    if (job.startedAt !== null) {
      // The job was printing, but the printer no longer works on it and no
      // end event reached this tracker (app restart, reconnect, or a missed
      // transition). Charge it now from what is known.
      // A status without a file name while the printer is active (heating
      // for a resume, for example) says nothing, so it never ends the job.
      const printingOtherJob =
        ACTIVE_STATES.has(status.state) && reportedName !== null && reportedName !== '';
      const idle = status.state === 'Ready';
      const endStateAfterRestart =
        firstStatus && !ACTIVE_STATES.has(status.state);
      if (printingOtherJob || idle || endStateAfterRestart) {
        const completed =
          status.state === 'Completed' && (reportedName === null || sameJob(reportedName, job.fileName));
        this.runDeduction(completed ? 'completed' : 'interrupted', true);
      }
      return;
    }

    // Not started yet.
    if (ACTIVE_STATES.has(status.state) && reportedName && !sameJob(reportedName, job.fileName)) {
      console.warn(
        `[StationUsageTracker] Printer on context ${this.deps.contextId} prints ${reportedName}, ` +
          `not the tracked ${job.fileName}; the spool choice is dropped.`
      );
      this.deps.jobs.takeJob(key);
      return;
    }
    if (this.now() - Date.parse(job.armedAt) > ARM_TIMEOUT_MS) {
      console.warn(
        `[StationUsageTracker] ${job.fileName} did not start within ` +
          `${ARM_TIMEOUT_MS / 60000} minutes; the spool choice is dropped.`
      );
      this.deps.jobs.takeJob(key);
    }
  };

  private recordProgress(key: string, job: TrackedJob, status: PrinterStatus): void {
    const changes: { startedAt?: string; lastProgress?: number; lastProgressAt?: string } = {};
    let persist = false;
    if (job.startedAt === null) {
      changes.startedAt = new Date(this.now()).toISOString();
      persist = true;
    }
    const percent = status.currentJob?.progress?.percentage;
    if (typeof percent === 'number' && Number.isFinite(percent) && percent > 0) {
      const clamped = Math.min(100, percent);
      if (clamped !== job.lastProgress) {
        changes.lastProgress = clamped;
        changes.lastProgressAt = new Date(this.now()).toISOString();
        // Write to disk once per whole percent to keep the file quiet.
        persist = persist || Math.floor(clamped) !== Math.floor(job.lastProgress ?? -1);
      }
    }
    if (Object.keys(changes).length > 0) {
      this.deps.jobs.updateJob(key, changes, persist);
    }
  }

  private readonly handleTerminal = (event: PrintLifecycleEvent): void => {
    if (this.disposed) {
      return;
    }
    const terminal = this.terminalFromStatus(event.status);
    if (!terminal) {
      return;
    }
    const job = this.deps.jobs.getJob(this.storeKey());
    if (!job) {
      return;
    }
    const eventName =
      (event.jobName && event.jobName !== 'Unknown' ? event.jobName : null) ??
      event.status.currentJob?.fileName ??
      null;
    // An end event for a job the tracker never saw start belongs to an
    // earlier print, unless it names this job.
    if (job.startedAt === null && !sameJob(eventName, job.fileName)) {
      return;
    }
    if (eventName !== null && !sameJob(eventName, job.fileName)) {
      return;
    }
    this.runDeduction(terminal, false);
  };

  private runDeduction(terminal: DeductionTerminal, approximate: boolean): void {
    // Fire-and-forget on purpose (poll handlers must never await network
    // I/O), but always observe the promise so a rejection can never become
    // an unhandledRejection; per-tool Spoolman errors are handled inside.
    void this.deductTrackedJob(terminal, approximate).catch((error: unknown) => {
      console.warn(
        `[StationUsageTracker] Deduction failed on context ${this.deps.contextId}:`,
        error
      );
    });
  }

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

  /**
   * Charge the tracked job and remove it. Public for tests.
   *
   * @param terminal - How the job ended
   * @param approximate - True when the end state was not observed
   */
  public async deductTrackedJob(
    terminal: DeductionTerminal,
    approximate: boolean
  ): Promise<DeductionSummary | null> {
    // Remove the record BEFORE any await: a second end event that arrives
    // while Spoolman is slow finds nothing to charge.
    const job = this.deps.jobs.takeJob(this.storeKey());
    if (!job) {
      return null;
    }

    const progress = terminal === 'completed' ? 100 : job.lastProgress ?? 0;
    const mode = this.resolveMode();
    const service = this.deps.createSpoolmanService();
    const tools: ToolDeduction[] = [];

    if (!service) {
      console.log(
        `[StationUsageTracker] Spoolman integration not configured; ${job.fileName} is not charged.`
      );
    } else {
      for (const tool of job.tools) {
        const fraction =
          terminal === 'completed' ? 1 : usedFractionAt(job.usageProfile, tool.toolId, progress);
        tools.push(await this.chargeTool(service, job, tool, mode, fraction, progress));
      }
    }

    const deductedCount = tools.filter((entry) => entry.status === 'deducted').length;
    const summary: DeductionSummary = {
      fileName: job.fileName,
      terminal,
      progress,
      approximate,
      tools,
      deductedCount,
      skippedCount: tools.length - deductedCount,
      at: new Date(this.now()).toISOString(),
    };
    console.log(
      `[StationUsageTracker] ${job.fileName} ended (${terminal}${approximate ? ', approximate' : ''}) ` +
        `at ${progress}%: ${deductedCount} spool(s) charged, ${summary.skippedCount} skipped.`
    );
    this.lastSummary = summary;
    this.deps.onSummary?.(summary);
    return summary;
  }

  private async chargeTool(
    service: SpoolmanService,
    job: TrackedJob,
    tool: TrackedJob['tools'][number],
    mode: SpoolDeductionMode,
    fraction: number,
    progress: number
  ): Promise<ToolDeduction> {
    const base = { toolId: tool.toolId, slotId: tool.slotId, spoolId: tool.spoolId, mode, fraction };
    const estimate = mode === 'weight' ? tool.usedG : tool.usedM;
    const unit = mode === 'weight' ? 'grams' : 'metres';

    if (estimate === null || !Number.isFinite(estimate) || estimate <= 0) {
      return this.skipped(base, `no ${unit} estimate for tool ${tool.toolId + 1}`);
    }
    if (!(progress > 0)) {
      return this.skipped(base, 'no printer progress was seen for this job');
    }

    // Length mode consumes millimetres; estimates are stored in metres.
    const amount = roundAmount(mode === 'weight' ? estimate * fraction : estimate * 1000 * fraction);
    if (amount <= 0) {
      return this.skipped(base, `tool ${tool.toolId + 1} had not printed yet`);
    }

    try {
      const payload = mode === 'weight' ? { use_weight: amount } : { use_length: amount };
      await service.updateUsage(tool.spoolId, payload);
      console.log(
        `[StationUsageTracker] Charged ${amount}${mode === 'weight' ? 'g' : 'mm'} to spool ` +
          `${tool.spoolId} (tool ${tool.toolId + 1}, slot ${tool.slotId}, job ${job.fileName}).`
      );
      return { ...base, amount, status: 'deducted' };
    } catch (error) {
      // Invariant: Spoolman failures never affect printing.
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[StationUsageTracker] Spoolman update failed for spool ${tool.spoolId} ` +
          `(tool ${tool.toolId + 1}, job ${job.fileName}): ${message}`
      );
      return this.skipped(base, `spoolman update failed: ${message}`);
    }
  }

  /** Weight-first per config; falls back to length mode only per config. */
  private resolveMode(): SpoolDeductionMode {
    return this.deps.integrationService.getUpdateMode() === 'length' ? 'length' : 'weight';
  }

  private skipped(
    base: Omit<ToolDeduction, 'amount' | 'status' | 'reason'>,
    reason: string
  ): ToolDeduction {
    console.warn(`[StationUsageTracker] Skipping tool ${base.toolId + 1}: ${reason}.`);
    return { ...base, amount: null, status: 'skipped', reason };
  }
}
