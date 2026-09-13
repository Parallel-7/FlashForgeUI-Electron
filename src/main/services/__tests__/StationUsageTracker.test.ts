/**
 * @fileoverview Unit tests for StationUsageTracker: terminal-state deduction
 * math (full, fraction, exactly-once across paths, skip paths), the
 * slow-Spoolman exactly-once race (rapid distinct terminals), restart
 * persistence, and progress-fraction edge cases (0%, unknown, stale).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EventEmitter } from 'events';
import type { PrinterStatus } from '@shared/types/polling';
import type { DeductionSummary } from '@shared/types/spoolman-tracking';
import type { SpoolmanService } from '../SpoolmanService';
import type { SpoolmanIntegrationService } from '../SpoolmanIntegrationService';
import type { PrinterPollingService } from '../PrinterPollingService';
import { JobEstimateStore } from '../JobEstimateStore';
import { SlotSpoolStore } from '../SlotSpoolStore';
import { PrintStateMonitor } from '../PrintStateMonitor';
import { planDeductionFraction, StationUsageTracker } from '../StationUsageTracker';

/** Recorded Spoolman usage update. */
interface UsageCall {
  spoolId: number;
  usage: { use_weight?: number; use_length?: number };
}

function makeService(calls: UsageCall[], shouldFail = false): SpoolmanService {
  return {
    async updateUsage(spoolId: number, usage: { use_weight?: number; use_length?: number }) {
      if (shouldFail) {
        throw new Error('spoolman unreachable');
      }
      calls.push({ spoolId, usage });
      return {} as Awaited<ReturnType<SpoolmanService['updateUsage']>>;
    },
  } as unknown as SpoolmanService;
}

function makeIntegration(mode: 'weight' | 'length' = 'weight'): SpoolmanIntegrationService {
  return {
    getUpdateMode: () => mode,
  } as unknown as SpoolmanIntegrationService;
}

function status(state: string, currentJob?: { fileName: string; percent: number }): PrinterStatus {
  return {
    state,
    currentJob: currentJob
      ? {
          fileName: currentJob.fileName,
          progress: { percentage: currentJob.percent },
        }
      : undefined,
  } as unknown as PrinterStatus;
}

interface Harness {
  tracker: StationUsageTracker;
  monitor: PrintStateMonitor;
  polling: EventEmitter;
  estimates: JobEstimateStore;
  slots: SlotSpoolStore;
  calls: UsageCall[];
  summaries: DeductionSummary[];
}

function makeHarness(options?: {
  mode?: 'weight' | 'length';
  serviceFailure?: boolean;
  estimates?: Array<{ toolId: number; usedG: number | null; usedM?: number | null }>;
}): Harness {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'station-tracker-test-'));
  const estimates = new JobEstimateStore(path.join(dir, 'estimates.json'));
  const slots = new SlotSpoolStore(path.join(dir, 'slots.json'));
  const calls: UsageCall[] = [];
  const summaries: DeductionSummary[] = [];

  if (options?.estimates) {
    estimates.captureEstimate('ctx-1', {
      fileName: 'benchy.3mf',
      mappings: options.estimates.map((tool) => ({ toolId: tool.toolId, slotId: tool.toolId + 1 })),
      perTool: options.estimates.map((tool) => ({
        toolId: tool.toolId,
        slotId: tool.toolId + 1,
        usedG: tool.usedG,
        usedM: tool.usedM !== undefined ? tool.usedM : tool.usedG !== null ? tool.usedG / 4 : null,
      })),
      capturedAt: new Date().toISOString(),
    });
  }

  const tracker = new StationUsageTracker({
    contextId: 'ctx-1',
    estimates,
    slots,
    createSpoolmanService: () => makeService(calls, options?.serviceFailure ?? false),
    integrationService: makeIntegration(options?.mode ?? 'weight'),
    onSummary: (summary) => summaries.push(summary),
  });

  const monitor = new PrintStateMonitor('ctx-1');
  const polling = new EventEmitter();
  monitor.setPollingService(polling as unknown as PrinterPollingService);
  tracker.setMonitors(monitor, polling as unknown as PrinterPollingService);
  // Prime the monitor's initial state (its first status only records state;
  // lifecycle events fire on transitions, exactly like real polling).
  polling.emit('status-updated', status('Ready'));

  return { tracker, monitor, polling, estimates, slots, calls, summaries };
}

/** Let async terminal handlers settle. */
function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('planDeductionFraction', () => {
  it('always plans a full deduction on completion', () => {
    expect(planDeductionFraction('completed', null, null)).toEqual({ fraction: 1 });
    expect(planDeductionFraction('completed', { fileName: 'x', percent: 3, at: 0 }, 'x')).toEqual({
      fraction: 1,
    });
  });

  it('refuses to guess when no progress was observed', () => {
    const plan = planDeductionFraction('cancelled', null, null);
    expect(plan.fraction).toBeNull();
    expect(plan.reason).toMatch(/no printer-reported progress/i);
  });

  it('refuses to guess when progress was zero', () => {
    const plan = planDeductionFraction('cancelled', { fileName: 'x', percent: 0, at: 1 }, 'x');
    expect(plan.fraction).toBeNull();
  });

  it('treats a progress signal for a different file as stale', () => {
    const plan = planDeductionFraction('cancelled', { fileName: 'a', percent: 40, at: 1 }, 'b');
    expect(plan.fraction).toBeNull();
    expect(plan.reason).toMatch(/different job/);
  });

  it('uses the observed percentage as the fraction', () => {
    expect(planDeductionFraction('cancelled', { fileName: 'x', percent: 40, at: 1 }, 'x').fraction).toBe(0.4);
    expect(planDeductionFraction('error', { fileName: 'x', percent: 12.5, at: 1 }, 'x').fraction).toBe(0.125);
  });

  it('clamps fractions above 100%', () => {
    expect(planDeductionFraction('cancelled', { fileName: 'x', percent: 250, at: 1 }, 'x').fraction).toBe(1);
  });
});

describe('StationUsageTracker', () => {
  describe('completion path', () => {
    it('deducts the full per-tool estimates on completion (weight mode)', async () => {
      const harness = makeHarness({
        estimates: [
          { toolId: 0, usedG: 11.28 },
          { toolId: 1, usedG: 8.64 },
        ],
      });
      harness.slots.setSpoolForSlot('ctx-1', 1, 101);
      harness.slots.setSpoolForSlot('ctx-1', 2, 102);

      harness.polling.emit('status-updated', status('Printing', { fileName: 'benchy.3mf', percent: 10 }));
      harness.polling.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
      await settle();

      expect(harness.calls).toHaveLength(2);
      expect(harness.calls[0]).toEqual({ spoolId: 101, usage: { use_weight: 11.28 } });
      expect(harness.calls[1]).toEqual({ spoolId: 102, usage: { use_weight: 8.64 } });
      expect(harness.summaries[0]?.deductedCount).toBe(2);
      expect(harness.summaries[0]?.skippedCount).toBe(0);
    });

    it('deducts millimetres in length mode', async () => {
      const harness = makeHarness({
        mode: 'length',
        estimates: [{ toolId: 0, usedG: 4, usedM: 3 }],
      });
      harness.slots.setSpoolForSlot('ctx-1', 1, 7);

      harness.polling.emit('status-updated', status('Printing', { fileName: 'benchy.3mf', percent: 50 }));
      harness.polling.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
      await settle();

      expect(harness.calls).toEqual([{ spoolId: 7, usage: { use_length: 3000 } }]);
    });
  });

  describe('cancel path', () => {
    it('deducts the observed fraction of the estimates', async () => {
      const harness = makeHarness({
        estimates: [
          { toolId: 0, usedG: 11.28 },
          { toolId: 1, usedG: 8.64 },
        ],
      });
      harness.slots.setSpoolForSlot('ctx-1', 1, 101);
      harness.slots.setSpoolForSlot('ctx-1', 2, 102);

      harness.polling.emit('status-updated', status('Printing', { fileName: 'benchy.3mf', percent: 40 }));
      // Cancel strips the job the same way the transformer does for real printers.
      harness.polling.emit('status-updated', status('Cancelled'));
      await settle();

      expect(harness.calls).toHaveLength(2);
      expect(harness.calls[0]?.usage.use_weight).toBeCloseTo(4.51, 2); // 11.28 × 0.4
      expect(harness.calls[1]?.usage.use_weight).toBeCloseTo(3.46, 2); // 8.64 × 0.4
    });

    it('deducts nothing without a progress signal', async () => {
      const harness = makeHarness({ estimates: [{ toolId: 0, usedG: 11.28 }] });
      harness.slots.setSpoolForSlot('ctx-1', 1, 101);

      harness.polling.emit('status-updated', status('Cancelled'));
      await settle();

      expect(harness.calls).toHaveLength(0);
      // No job name and no progress were ever observed, so there is nothing
      // trustworthy to deduct from.
      expect(harness.summaries.every((summary) => summary.deductedCount === 0)).toBe(true);
    });

    it('deducts nothing when the observed progress was 0%', async () => {
      const harness = makeHarness({ estimates: [{ toolId: 0, usedG: 11.28 }] });
      harness.slots.setSpoolForSlot('ctx-1', 1, 101);

      harness.polling.emit('status-updated', status('Printing', { fileName: 'benchy.3mf', percent: 0 }));
      harness.polling.emit('status-updated', status('Cancelled'));
      await settle();

      expect(harness.calls).toHaveLength(0);
    });

    it('ignores a stale progress snapshot from a different job', async () => {
      const harness = makeHarness({ estimates: [{ toolId: 0, usedG: 11.28 }] });
      harness.slots.setSpoolForSlot('ctx-1', 1, 101);

      // Progress seen for an older file, then a terminal event that names a
      // different job: no trustworthy signal → no deduction.
      harness.polling.emit('status-updated', status('Printing', { fileName: 'old.3mf', percent: 40 }));
      harness.polling.emit('status-updated', status('Cancelled'));
      await settle();

      expect(harness.calls).toHaveLength(0);
    });
  });

  describe('pause/resume path', () => {
    it('deducts nothing for pause and resume transitions', async () => {
      const harness = makeHarness({ estimates: [{ toolId: 0, usedG: 11.28 }] });
      harness.slots.setSpoolForSlot('ctx-1', 1, 101);

      harness.polling.emit('status-updated', status('Printing', { fileName: 'benchy.3mf', percent: 20 }));
      harness.polling.emit('status-updated', status('Paused', { fileName: 'benchy.3mf', percent: 20 }));
      harness.polling.emit('status-updated', status('Printing', { fileName: 'benchy.3mf', percent: 30 }));
      await settle();

      expect(harness.calls).toHaveLength(0);
      expect(harness.summaries).toHaveLength(0);
    });
  });

  describe('exactly-once across terminal paths', () => {
    it('does not deduct again when completion follows a cancel attempt', async () => {
      const harness = makeHarness({ estimates: [{ toolId: 0, usedG: 10 }] });
      harness.slots.setSpoolForSlot('ctx-1', 1, 5);

      harness.polling.emit('status-updated', status('Printing', { fileName: 'benchy.3mf', percent: 30 }));
      harness.polling.emit('status-updated', status('Cancelled'));
      await settle();
      // A late Completed poll for the same job must not re-deduct.
      harness.polling.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
      await settle();

      expect(harness.calls).toHaveLength(1);
    });

    it('keeps exactly-once across repeated identical terminal polls', async () => {
      const harness = makeHarness({ estimates: [{ toolId: 0, usedG: 10 }] });
      harness.slots.setSpoolForSlot('ctx-1', 1, 5);

      harness.polling.emit('status-updated', status('Printing', { fileName: 'benchy.3mf', percent: 5 }));
      harness.polling.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
      await settle();
      // The printer keeps reporting Completed on subsequent polls; only the
      // transition fires, and the ledger guards even that.
      harness.polling.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
      await settle();

      expect(harness.calls).toHaveLength(1);
    });

    it('re-deductions a re-printed file as a new job key', async () => {
      const harness = makeHarness({ estimates: [{ toolId: 0, usedG: 10 }] });
      harness.slots.setSpoolForSlot('ctx-1', 1, 5);

      harness.polling.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
      await settle();
      // New print of the same file: new startedAt marker → deductible again.
      harness.polling.emit('status-updated', status('Ready'));
      harness.polling.emit('status-updated', status('Printing', { fileName: 'benchy.3mf', percent: 1 }));
      harness.polling.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
      await settle();

      expect(harness.calls).toHaveLength(2);
    });

    it('survives a tracker restart mid-print and deducts exactly once at completion', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'station-restart-test-'));
      const estimates = new JobEstimateStore(path.join(dir, 'estimates.json'));
      const slots = new SlotSpoolStore(path.join(dir, 'slots.json'));
      estimates.captureEstimate('ctx-1', {
        fileName: 'benchy.3mf',
        mappings: [{ toolId: 0, slotId: 1 }],
        perTool: [{ toolId: 0, slotId: 1, usedG: 10, usedM: 2.5 }],
        capturedAt: new Date().toISOString(),
      });
      slots.setSpoolForSlot('ctx-1', 1, 5);

      const calls: UsageCall[] = [];
      const buildTracker = (): StationUsageTracker =>
        new StationUsageTracker({
          contextId: 'ctx-1',
          estimates,
          slots,
          createSpoolmanService: () => makeService(calls),
          integrationService: makeIntegration('weight'),
        });

      // Phase 1: print observed at 25%, no terminal event yet.
      const first = buildTracker();
      const monitor = new PrintStateMonitor('ctx-1');
      const polling = new EventEmitter();
      monitor.setPollingService(polling as unknown as PrinterPollingService);
      first.setMonitors(monitor, polling as unknown as PrinterPollingService);
      polling.emit('status-updated', status('Ready'));
      polling.emit('status-updated', status('Printing', { fileName: 'benchy.3mf', percent: 25 }));
      await settle();
      expect(calls).toHaveLength(0);

      // Phase 2 ("restart"): fresh tracker + monitor over the same persisted
      // stores; the still-running print completes.
      const second = buildTracker();
      const monitor2 = new PrintStateMonitor('ctx-1');
      const polling2 = new EventEmitter();
      monitor2.setPollingService(polling2 as unknown as PrinterPollingService);
      second.setMonitors(monitor2, polling2 as unknown as PrinterPollingService);
      polling2.emit('status-updated', status('Printing', { fileName: 'benchy.3mf', percent: 90 }));
      polling2.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
      await settle();

      expect(calls).toHaveLength(1);
      expect(calls[0]?.usage.use_weight).toBe(10);
    });

    it('holds exactly-once while a slow Spoolman call is in flight (rapid distinct terminals)', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'station-tracker-race-'));
      const estimates = new JobEstimateStore(path.join(dir, 'estimates.json'));
      const slots = new SlotSpoolStore(path.join(dir, 'slots.json'));
      estimates.captureEstimate('ctx-1', {
        fileName: 'benchy.3mf',
        mappings: [
          { toolId: 0, slotId: 1 },
          { toolId: 1, slotId: 2 },
        ],
        perTool: [
          { toolId: 0, slotId: 1, usedG: 11.28, usedM: 2.8 },
          { toolId: 1, slotId: 2, usedG: 8.64, usedM: 2.2 },
        ],
        capturedAt: new Date().toISOString(),
      });
      slots.setSpoolForSlot('ctx-1', 1, 101);
      slots.setSpoolForSlot('ctx-1', 2, 102);

      const calls: UsageCall[] = [];
      // Spoolman is SLOW: every updateUsage parks on a deferred we control,
      // so the deduction stays in-flight across the two terminal emits.
      const parked: Array<() => void> = [];
      const slowService: SpoolmanService = {
        async updateUsage(
          spoolId: number,
          usage: { use_weight?: number; use_length?: number }
        ) {
          calls.push({ spoolId, usage });
          await new Promise<void>((resolve) => {
            parked.push(resolve);
          });
          return {};
        },
      } as unknown as SpoolmanService;

      const summaries: DeductionSummary[] = [];
      const tracker = new StationUsageTracker({
        contextId: 'ctx-1',
        estimates,
        slots,
        createSpoolmanService: () => slowService,
        integrationService: makeIntegration('weight'),
        onSummary: (summary) => summaries.push(summary),
      });
      const monitor = new PrintStateMonitor('ctx-1');
      const polling = new EventEmitter();
      monitor.setPollingService(polling as unknown as PrinterPollingService);
      tracker.setMonitors(monitor, polling as unknown as PrinterPollingService);
      polling.emit('status-updated', status('Ready'));

      polling.emit('status-updated', status('Printing', { fileName: 'benchy.3mf', percent: 40 }));
      // Two RAPID distinct terminal transitions (Cancelled → Error) while the
      // Cancelled-path Spoolman call is still parked in flight.
      polling.emit('status-updated', status('Cancelled'));
      polling.emit('status-updated', status('Error'));

      // The Cancelled deduction is in flight; the Error path must already
      // have been rejected by the synchronously reserved ledger entry.
      expect(calls).toHaveLength(1);
      expect(parked).toHaveLength(1);

      // Release parked calls; sequential per-tool calls park again, so loop
      // until the whole deduction has drained.
      for (let round = 0; round < 6 && parked.length > 0; round++) {
          for (const resolve of parked.splice(0)) {
            resolve();
          }
          await settle();
      }

      // Exactly one deduction set lands: each tool once, never duplicated.
      expect(calls).toHaveLength(2);
      expect(calls[0]?.spoolId).toBe(101);
      expect(calls[1]?.spoolId).toBe(102);
      expect(calls[0]?.usage.use_weight).toBe(4.51); // 11.28 × 0.4, rounded
      expect(calls[1]?.usage.use_weight).toBe(3.46); // 8.64 × 0.4, rounded
      expect(summaries).toHaveLength(1);
      expect(summaries[0]?.terminal).toBe('cancelled');
      expect(summaries[0]?.deductedCount).toBe(2);
    });
  });

  describe('skip paths', () => {
    it('skips tools with no spool assigned to their slot', async () => {
      const harness = makeHarness({
        estimates: [
          { toolId: 0, usedG: 11.28 },
          { toolId: 1, usedG: 8.64 },
        ],
      });
      harness.slots.setSpoolForSlot('ctx-1', 1, 101);
      // Slot 2 unassigned.

      harness.polling.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
      await settle();

      expect(harness.calls).toHaveLength(1);
      const summary = harness.summaries[0];
      expect(summary?.deductedCount).toBe(1);
      expect(summary?.skippedCount).toBe(1);
      expect(summary?.tools[1]?.reason).toMatch(/no spool assigned to slot 2/i);
    });

    it('skips tools with unknown estimates', async () => {
      const harness = makeHarness({
        estimates: [
          { toolId: 0, usedG: null },
          { toolId: 1, usedG: 8.64 },
        ],
      });
      harness.slots.setSpoolForSlot('ctx-1', 1, 101);
      harness.slots.setSpoolForSlot('ctx-1', 2, 102);

      harness.polling.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
      await settle();

      expect(harness.calls).toHaveLength(1);
      expect(harness.summaries[0]?.tools[0]?.reason).toMatch(/no grams estimate/i);
    });

    it('skips grams-only tools in length mode instead of guessing density', async () => {
      const harness = makeHarness({
        mode: 'length',
        estimates: [{ toolId: 0, usedG: 11.28, usedM: null }],
      });
      harness.slots.setSpoolForSlot('ctx-1', 1, 101);

      harness.polling.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
      await settle();

      expect(harness.calls).toHaveLength(0);
      expect(harness.summaries[0]?.skippedCount).toBe(1);
    });

    it('records a spoolman API failure as a skipped tool without throwing', async () => {
      const harness = makeHarness({ estimates: [{ toolId: 0, usedG: 10 }], serviceFailure: true });
      harness.slots.setSpoolForSlot('ctx-1', 1, 5);

      harness.polling.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
      await settle();

      expect(harness.calls).toHaveLength(0);
      expect(harness.summaries[0]?.tools[0]?.reason).toMatch(/spoolman update failed/i);
    });

    it('makes no deduction for untracked jobs (no estimate record)', async () => {
      const harness = makeHarness();
      harness.slots.setSpoolForSlot('ctx-1', 1, 5);

      harness.polling.emit('status-updated', status('Printing', { fileName: 'mystery.gcode', percent: 50 }));
      harness.polling.emit('status-updated', status('Completed', { fileName: 'mystery.gcode', percent: 100 }));
      await settle();

      expect(harness.calls).toHaveLength(0);
      // The untracked job is still surfaced (empty summary) for the panel.
      expect(harness.summaries).toHaveLength(1);
      expect(harness.summaries[0]?.fileName).toBe('mystery.gcode');
      expect(harness.summaries[0]?.deductedCount).toBe(0);
    });

    it('makes no deduction when spoolman is not configured', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'station-unconfigured-'));
      const estimates = new JobEstimateStore(path.join(dir, 'e.json'));
      const slots = new SlotSpoolStore(path.join(dir, 's.json'));
      estimates.captureEstimate('ctx-1', {
        fileName: 'benchy.3mf',
        mappings: [{ toolId: 0, slotId: 1 }],
        perTool: [{ toolId: 0, slotId: 1, usedG: 10, usedM: 2 }],
        capturedAt: new Date().toISOString(),
      });
      slots.setSpoolForSlot('ctx-1', 1, 5);

      const calls: UsageCall[] = [];
      const tracker = new StationUsageTracker({
        contextId: 'ctx-1',
        estimates,
        slots,
        createSpoolmanService: () => null,
        integrationService: makeIntegration('weight'),
      });
      const monitor = new PrintStateMonitor('ctx-1');
      const polling = new EventEmitter();
      monitor.setPollingService(polling as unknown as PrinterPollingService);
      tracker.setMonitors(monitor, polling as unknown as PrinterPollingService);

      polling.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
      await settle();

      expect(calls).toHaveLength(0);
    });
  });

  it('exposes the last summary and slot assignments for the panel', async () => {
    const harness = makeHarness({ estimates: [{ toolId: 0, usedG: 10 }] });
    harness.slots.setSpoolForSlot('ctx-1', 1, 33);

    expect(harness.tracker.getSlotAssignments().get(1)).toBe(33);
    expect(harness.tracker.getLastSummary()).toBeNull();

    harness.polling.emit('status-updated', status('Completed', { fileName: 'benchy.3mf', percent: 100 }));
    await settle();

    expect(harness.tracker.getLastSummary()?.fileName).toBe('benchy.3mf');
  });
});
