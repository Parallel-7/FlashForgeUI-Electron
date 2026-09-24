/**
 * @fileoverview Unit tests for StationUsageTracker: per-job deduction on
 * completion and cancel (with and without a per-tool usage profile), the
 * at-most-once guarantee, pause/resume, jobs that never start, recovery after
 * an app restart, and Spoolman failure handling.
 */

import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { PrinterStatus } from '@shared/types/polling';
import type { DeductionSummary, ToolUsageProfile, TrackedJob } from '@shared/types/spoolman-tracking';
import { EventEmitter } from 'events';
import { PrintStateMonitor } from '../PrintStateMonitor';
import type { SpoolmanIntegrationService } from '../SpoolmanIntegrationService';
import type { SpoolmanService } from '../SpoolmanService';
import { ARM_TIMEOUT_MS, jobNameKey, sameJob, StationUsageTracker } from '../StationUsageTracker';
import { TrackedJobStore } from '../TrackedJobStore';

/** Recorded Spoolman usage update. */
interface UsageCall {
  spoolId: number;
  usage: { use_weight?: number; use_length?: number };
}

class FakePollingService extends EventEmitter {}

const KEY = 'SERIAL-1';
const FILE = 'benchy.3mf';

function makeService(calls: UsageCall[], shouldFail = false): SpoolmanService {
  return {
    async updateUsage(spoolId: number, usage: { use_weight?: number; use_length?: number }) {
      if (shouldFail) {
        throw new Error('spoolman unreachable');
      }
      calls.push({ spoolId, usage });
      return {};
    },
  } as unknown as SpoolmanService;
}

function makeIntegration(mode: 'weight' | 'length' = 'weight'): SpoolmanIntegrationService {
  return { getUpdateMode: () => mode } as unknown as SpoolmanIntegrationService;
}

function status(state: string, currentJob?: { fileName: string; percent: number }): PrinterStatus {
  return {
    state,
    currentJob: currentJob
      ? { fileName: currentJob.fileName, progress: { percentage: currentJob.percent } }
      : null,
  } as unknown as PrinterStatus;
}

/** Tool 0 prints the first half of the file, tool 1 the second half. */
const SPLIT_PROFILE: ToolUsageProfile = {
  sampleCount: 4,
  perTool: {
    '0': [0, 0.5, 1, 1, 1],
    '1': [0, 0, 0, 0.5, 1],
  },
};

function trackedJob(overrides: Partial<TrackedJob> = {}): TrackedJob {
  return {
    fileName: FILE,
    source: 'upload-3mf',
    tools: [
      { toolId: 0, slotId: 1, spoolId: 11, usedG: 10, usedM: 3 },
      { toolId: 1, slotId: 3, spoolId: 22, usedG: 20, usedM: 6 },
    ],
    usageProfile: null,
    armedAt: new Date(1_000_000).toISOString(),
    startedAt: null,
    lastProgress: null,
    lastProgressAt: null,
    ...overrides,
  };
}

interface Harness {
  tracker: StationUsageTracker;
  polling: FakePollingService;
  store: TrackedJobStore;
  calls: UsageCall[];
  summaries: DeductionSummary[];
  clock: { now: number };
}

function makeHarness(options?: {
  job?: TrackedJob;
  mode?: 'weight' | 'length';
  serviceFailure?: boolean;
  store?: TrackedJobStore;
  prime?: boolean;
}): Harness {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'station-tracker-test-'));
  const store = options?.store ?? new TrackedJobStore(path.join(dir, 'jobs.json'));
  if (options?.job) {
    store.setJob(KEY, options.job);
  }
  const calls: UsageCall[] = [];
  const summaries: DeductionSummary[] = [];
  const clock = { now: 1_000_000 };

  const tracker = new StationUsageTracker({
    contextId: 'ctx-1',
    jobs: store,
    createSpoolmanService: () => makeService(calls, options?.serviceFailure ?? false),
    integrationService: makeIntegration(options?.mode ?? 'weight'),
    onSummary: (summary) => summaries.push(summary),
    resolveStoreKey: () => KEY,
    now: () => clock.now,
  });

  const monitor = new PrintStateMonitor('ctx-1');
  const polling = new FakePollingService();
  monitor.setPollingService(polling as never);
  tracker.setMonitors(monitor, polling as never);
  if (options?.prime !== false) {
    // The monitor records its first status without emitting; lifecycle
    // events fire on transitions, exactly like real polling.
    polling.emit('status-updated', status('Ready'));
  }
  return { tracker, polling, store, calls, summaries, clock };
}

/** Let async deduction settle. */
function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function bySpool(calls: UsageCall[]): Map<number, number> {
  return new Map(calls.map((call) => [call.spoolId, call.usage.use_weight ?? call.usage.use_length ?? 0]));
}

describe('job name matching', () => {
  it('ignores directory, extension and case', () => {
    expect(jobNameKey('/usr/data/gcodes/Benchy.3MF')).toBe('benchy');
    expect(sameJob('benchy.3mf', 'Benchy.gcode')).toBe(true);
    expect(sameJob('benchy.3mf', 'other.3mf')).toBe(false);
    expect(sameJob(null, 'benchy.3mf')).toBe(false);
  });
});

describe('StationUsageTracker', () => {
  it('charges each spool its full estimate when the job completes', async () => {
    const h = makeHarness({ job: trackedJob() });
    h.polling.emit('status-updated', status('Printing', { fileName: FILE, percent: 50 }));
    h.polling.emit('status-updated', status('Completed', { fileName: FILE, percent: 100 }));
    await settle();

    expect(bySpool(h.calls)).toEqual(new Map([[11, 10], [22, 20]]));
    expect(h.summaries).toHaveLength(1);
    expect(h.summaries[0]).toMatchObject({ terminal: 'completed', progress: 100, approximate: false });
    expect(h.store.getJob(KEY)).toBeNull();
  });

  it('charges a cancelled job per tool from the usage profile', async () => {
    const h = makeHarness({ job: trackedJob({ usageProfile: SPLIT_PROFILE }) });
    h.polling.emit('status-updated', status('Printing', { fileName: FILE, percent: 40 }));
    h.polling.emit('status-updated', status('Cancelled'));
    await settle();

    // 40% of the bytes: tool 0 is 80% done, tool 1 has not started.
    expect(bySpool(h.calls)).toEqual(new Map([[11, 8]]));
    const summary = h.summaries[0];
    expect(summary.terminal).toBe('cancelled');
    expect(summary.deductedCount).toBe(1);
    expect(summary.tools.find((tool) => tool.toolId === 1)).toMatchObject({
      status: 'skipped',
      fraction: 0,
    });
  });

  it('charges a cancelled job linearly when there is no usage profile', async () => {
    const h = makeHarness({ job: trackedJob() });
    h.polling.emit('status-updated', status('Printing', { fileName: FILE, percent: 40 }));
    h.polling.emit('status-updated', status('Error'));
    await settle();

    expect(bySpool(h.calls)).toEqual(new Map([[11, 4], [22, 8]]));
    expect(h.summaries[0].terminal).toBe('error');
  });

  it('charges nothing for a cancel before any progress was seen', async () => {
    const h = makeHarness({ job: trackedJob() });
    h.polling.emit('status-updated', status('Printing', { fileName: FILE, percent: 0 }));
    h.polling.emit('status-updated', status('Cancelled'));
    await settle();

    expect(h.calls).toHaveLength(0);
    expect(h.summaries[0].skippedCount).toBe(2);
    expect(h.store.getJob(KEY)).toBeNull();
  });

  it('charges nothing on pause and resume, then in full on completion', async () => {
    const h = makeHarness({ job: trackedJob() });
    h.polling.emit('status-updated', status('Printing', { fileName: FILE, percent: 25 }));
    h.polling.emit('status-updated', status('Paused', { fileName: FILE, percent: 25 }));
    h.polling.emit('status-updated', status('Heating', { fileName: '', percent: 25 }));
    h.polling.emit('status-updated', status('Printing', { fileName: FILE, percent: 30 }));
    await settle();
    expect(h.calls).toHaveLength(0);
    expect(h.store.getJob(KEY)?.lastProgress).toBe(30);

    h.polling.emit('status-updated', status('Completed', { fileName: FILE, percent: 100 }));
    await settle();
    expect(bySpool(h.calls)).toEqual(new Map([[11, 10], [22, 20]]));
  });

  it('charges a job at most once when two end events arrive', async () => {
    const h = makeHarness({ job: trackedJob() });
    h.polling.emit('status-updated', status('Printing', { fileName: FILE, percent: 50 }));
    await h.tracker.deductTrackedJob('cancelled', false);
    await h.tracker.deductTrackedJob('error', false);
    h.polling.emit('status-updated', status('Cancelled'));
    await settle();

    expect(h.calls).toHaveLength(2);
    expect(h.summaries).toHaveLength(1);
  });

  it('drops the spool choice when the printer prints a different file', async () => {
    const h = makeHarness({ job: trackedJob() });
    h.polling.emit('status-updated', status('Printing', { fileName: 'other.3mf', percent: 10 }));
    h.polling.emit('status-updated', status('Completed', { fileName: 'other.3mf', percent: 100 }));
    await settle();

    expect(h.store.getJob(KEY)).toBeNull();
    expect(h.calls).toHaveLength(0);
  });

  it('ignores the end of an earlier print while the tracked job waits to start', async () => {
    const h = makeHarness({ job: trackedJob(), prime: false });
    h.polling.emit('status-updated', status('Printing', { fileName: '', percent: 90 }));
    h.polling.emit('status-updated', status('Completed', { fileName: '', percent: 100 }));
    await settle();

    expect(h.calls).toHaveLength(0);
    expect(h.store.getJob(KEY)).not.toBeNull();
  });

  it('drops a job that does not start within the arm timeout', () => {
    const h = makeHarness({ job: trackedJob() });
    h.clock.now += ARM_TIMEOUT_MS + 1;
    h.polling.emit('status-updated', status('Ready'));
    expect(h.store.getJob(KEY)).toBeNull();
  });

  it('keeps a started job through a heating status without a file name', async () => {
    const h = makeHarness({ job: trackedJob() });
    h.polling.emit('status-updated', status('Printing', { fileName: FILE, percent: 60 }));
    h.polling.emit('status-updated', status('Heating'));
    await settle();
    expect(h.store.getJob(KEY)).not.toBeNull();
    expect(h.calls).toHaveLength(0);
  });

  it('charges the last progress when a started job is found idle', async () => {
    const h = makeHarness({ job: trackedJob() });
    h.polling.emit('status-updated', status('Printing', { fileName: FILE, percent: 60 }));
    h.polling.emit('status-updated', status('Ready'));
    await settle();

    expect(bySpool(h.calls)).toEqual(new Map([[11, 6], [22, 12]]));
    expect(h.summaries[0]).toMatchObject({ terminal: 'interrupted', approximate: true, progress: 60 });
  });

  it('matches a job the printer reports by its gcode name', async () => {
    const h = makeHarness({ job: trackedJob() });
    h.polling.emit('status-updated', status('Printing', { fileName: 'benchy.gcode', percent: 50 }));
    h.polling.emit('status-updated', status('Completed', { fileName: 'benchy.gcode', percent: 100 }));
    await settle();
    expect(h.calls).toHaveLength(2);
  });

  it('uses millimetres in length mode', async () => {
    const h = makeHarness({ job: trackedJob(), mode: 'length' });
    h.polling.emit('status-updated', status('Printing', { fileName: FILE, percent: 50 }));
    h.polling.emit('status-updated', status('Cancelled'));
    await settle();
    expect(h.calls.map((call) => call.usage)).toEqual([{ use_length: 1500 }, { use_length: 3000 }]);
  });

  it('reports Spoolman failures as skipped tools and still ends the job', async () => {
    const h = makeHarness({ job: trackedJob(), serviceFailure: true });
    h.polling.emit('status-updated', status('Printing', { fileName: FILE, percent: 50 }));
    h.polling.emit('status-updated', status('Completed', { fileName: FILE, percent: 100 }));
    await settle();

    expect(h.summaries[0].skippedCount).toBe(2);
    expect(h.summaries[0].tools[0].reason).toContain('spoolman update failed');
    expect(h.store.getJob(KEY)).toBeNull();
  });

  it('skips tools without an estimate', async () => {
    const job = trackedJob();
    const h = makeHarness({
      job: { ...job, tools: [{ ...job.tools[0], usedG: null }, job.tools[1]] },
    });
    h.polling.emit('status-updated', status('Printing', { fileName: FILE, percent: 50 }));
    h.polling.emit('status-updated', status('Completed', { fileName: FILE, percent: 100 }));
    await settle();
    expect(bySpool(h.calls)).toEqual(new Map([[22, 20]]));
  });

  describe('after an app restart', () => {
    function restartedStore(lastProgress: number): TrackedJobStore {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'station-restart-test-'));
      const file = path.join(dir, 'jobs.json');
      const before = new TrackedJobStore(file);
      before.setJob(
        KEY,
        trackedJob({
          startedAt: new Date(900_000).toISOString(),
          lastProgress,
          lastProgressAt: new Date(950_000).toISOString(),
        })
      );
      return new TrackedJobStore(file);
    }

    it('charges the saved progress when the printer is idle', async () => {
      const h = makeHarness({ store: restartedStore(55), prime: false });
      h.polling.emit('status-updated', status('Ready'));
      await settle();
      expect(bySpool(h.calls)).toEqual(new Map([[11, 5.5], [22, 11]]));
      expect(h.summaries[0]).toMatchObject({ terminal: 'interrupted', approximate: true });
    });

    it('charges in full when the printer reports the job completed', async () => {
      const h = makeHarness({ store: restartedStore(80), prime: false });
      h.polling.emit('status-updated', status('Completed', { fileName: FILE, percent: 100 }));
      await settle();
      expect(bySpool(h.calls)).toEqual(new Map([[11, 10], [22, 20]]));
      expect(h.summaries[0]).toMatchObject({ terminal: 'completed', approximate: true });
    });

    it('keeps tracking when the printer still prints the job', async () => {
      const h = makeHarness({ store: restartedStore(40), prime: false });
      h.polling.emit('status-updated', status('Printing', { fileName: FILE, percent: 45 }));
      await settle();
      expect(h.calls).toHaveLength(0);
      expect(h.store.getJob(KEY)?.lastProgress).toBe(45);

      h.polling.emit('status-updated', status('Completed', { fileName: FILE, percent: 100 }));
      await settle();
      expect(h.summaries[0]).toMatchObject({ terminal: 'completed', approximate: false });
    });
  });
});
