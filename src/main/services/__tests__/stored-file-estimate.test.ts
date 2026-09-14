/**
 * @fileoverview Unit tests for stored-file estimate capture: the pure
 * single-material plan (weight precedence, either-signal multi skip, finite
 * positive weights only) and the orchestrator contract (already-tracked
 * precedence, exactly-one-spool resolution, one delayed retry for recent-list
 * propagation, capture that never throws to the caller).
 */

import type { AD5XJobInfo, BasicJobInfo, JobListResult } from '@shared/types/printer-backend/backend-operations';
import type { JobEstimateRecord } from '@shared/types/spoolman-tracking';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { JobEstimateStore } from '../JobEstimateStore';
import {
  PROPAGATION_RETRY_DELAY_MS,
  captureStoredFileEstimate,
  planStoredFileCapture,
  type StoredFileEstimateDeps,
} from '../stored-file-estimate';

function tool(
  toolId: number,
  filamentWeight: number
): {
  toolId: number;
  filamentWeight: number;
} {
  return { toolId, filamentWeight };
}

function ad5xJob(overrides: Partial<AD5XJobInfo> = {}): AD5XJobInfo {
  return {
    fileName: 'stored-single.3mf',
    printingTime: 6000,
    toolCount: 1,
    toolDatas: [tool(0, 130)],
    totalFilamentWeight: 130,
    useMatlStation: true,
    _type: 'ad5x',
    ...overrides,
  };
}

function basicJob(): BasicJobInfo {
  return { fileName: 'stored-single.3mf', printingTime: 6000, _type: 'basic' };
}

describe('planStoredFileCapture', () => {
  const slots = [2];

  it('captures a single-tool AD5X job with the total weight', () => {
    expect(planStoredFileCapture(ad5xJob(), slots)).toEqual({
      captured: true,
      toolId: 0,
      slotId: 2,
      usedG: 130,
    });
  });

  it('falls back to the single tool filamentWeight when totalFilamentWeight is missing', () => {
    const job = ad5xJob({ totalFilamentWeight: undefined });
    expect(planStoredFileCapture(job, slots)).toEqual({
      captured: true,
      toolId: 0,
      slotId: 2,
      usedG: 130,
    });
  });

  it('prefers totalFilamentWeight over the single tool filamentWeight', () => {
    const job = ad5xJob({ totalFilamentWeight: 140 });
    const plan = planStoredFileCapture(job, slots);
    expect(plan.captured).toBe(true);
    if (plan.captured) {
      expect(plan.usedG).toBe(140);
    }
  });

  it('skips when the metadata declares multiple tools via toolCount', () => {
    const job = ad5xJob({ toolCount: 2 });
    expect(planStoredFileCapture(job, slots)).toEqual({
      captured: false,
      reason: 'multi-material',
    });
  });

  it('skips when the metadata declares multiple tools via toolDatas', () => {
    const job = ad5xJob({ toolDatas: [tool(0, 60), tool(1, 70)] });
    expect(planStoredFileCapture(job, slots)).toEqual({
      captured: false,
      reason: 'multi-material',
    });
  });

  it('skips non-AD5X metadata (Creator 5 stays names-only)', () => {
    expect(planStoredFileCapture(basicJob(), slots)).toEqual({
      captured: false,
      reason: 'metadata-unavailable',
    });
  });

  it('skips when the file is not in the list at all', () => {
    expect(planStoredFileCapture(null, slots)).toEqual({
      captured: false,
      reason: 'file-not-in-list',
    });
  });

  it('skips when no usable weight is present', () => {
    const job = ad5xJob({ totalFilamentWeight: undefined, toolDatas: [] });
    expect(planStoredFileCapture(job, slots)).toEqual({
      captured: false,
      reason: 'no-filament-weight',
    });
  });

  it.each([0, -5, Number.POSITIVE_INFINITY, Number.NaN])('skips non-finite or non-positive weights (%p)', (bad) => {
    const job = ad5xJob({ totalFilamentWeight: bad, toolDatas: [tool(0, bad)] });
    expect(planStoredFileCapture(job, slots)).toEqual({
      captured: false,
      reason: 'no-filament-weight',
    });
  });

  it('skips when no slot has a spool assigned', () => {
    expect(planStoredFileCapture(ad5xJob(), [])).toEqual({
      captured: false,
      reason: 'no-spool-assigned',
    });
  });

  it('skips when more than one slot has a spool assigned', () => {
    expect(planStoredFileCapture(ad5xJob(), [1, 2])).toEqual({
      captured: false,
      reason: 'multiple-spools-assigned',
    });
  });
});

describe('captureStoredFileEstimate', () => {
  interface Harness {
    readonly deps: StoredFileEstimateDeps;
    readonly state: {
      jobs: (AD5XJobInfo | BasicJobInfo)[];
      listCalls: number;
      assignedSlotIds: number[];
      hasEstimate: boolean;
      enabled: boolean;
      station: boolean;
    };
    readonly captured: { contextId: string; fileName: string; tool: unknown }[];
  }

  function harness(): Harness {
    const state = {
      jobs: [ad5xJob()] as (AD5XJobInfo | BasicJobInfo)[],
      listCalls: 0,
      assignedSlotIds: [2],
      hasEstimate: false,
      enabled: true,
      station: true,
    };
    const captured: { contextId: string; fileName: string; tool: unknown }[] = [];
    const deps: StoredFileEstimateDeps = {
      isSpoolmanEnabled: () => state.enabled,
      isStationContext: () => state.station,
      getRecentJobs: () => {
        state.listCalls += 1;
        return Promise.resolve({
          success: true,
          jobs: state.jobs,
          totalCount: state.jobs.length,
          source: 'recent',
          timestamp: new Date(),
        } satisfies JobListResult);
      },
      hasEstimate: (_storeKey, _fileName) => state.hasEstimate,
      assignedSlotIds: () => state.assignedSlotIds,
      resolveStoreKey: (contextId) => `serial-${contextId}`,
      capture: (contextId, fileName, tool) => {
        captured.push({ contextId, fileName, tool });
      },
    };
    return { deps, state, captured };
  }

  it('captures a single tool entry with the printer-reported weight', async () => {
    const h = harness();
    await expect(captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps)).resolves.toBeNull();
    expect(h.captured).toEqual([
      {
        contextId: 'ctx-1',
        fileName: 'stored-single.3mf',
        tool: { toolId: 0, slotId: 2, usedG: 130 },
      },
    ]);
  });

  it('skips multi-material stored files without capturing', async () => {
    const h = harness();
    h.state.jobs = [
      ad5xJob({
        toolCount: 2,
        toolDatas: [tool(0, 60), tool(1, 70)],
      }),
    ];
    await expect(captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps)).resolves.toBe('multi-material');
    expect(h.captured).toHaveLength(0);
  });

  it('skips the deduction when no slot has a spool assigned', async () => {
    const h = harness();
    h.state.assignedSlotIds = [];
    await expect(captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps)).resolves.toBe('no-spool-assigned');
    expect(h.captured).toHaveLength(0);
  });

  it('skips the deduction when two slots have spools assigned', async () => {
    const h = harness();
    h.state.assignedSlotIds = [1, 2];
    await expect(captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps)).resolves.toBe(
      'multiple-spools-assigned'
    );
    expect(h.captured).toHaveLength(0);
  });

  it('does nothing when Spoolman is disabled', async () => {
    const h = harness();
    h.state.enabled = false;
    await expect(captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps)).resolves.toBe('spoolman-disabled');
    expect(h.state.listCalls).toBe(0);
    expect(h.captured).toHaveLength(0);
  });

  it('does nothing for non-station contexts', async () => {
    const h = harness();
    h.state.station = false;
    await expect(captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps)).resolves.toBe(
      'not-a-station-context'
    );
    expect(h.state.listCalls).toBe(0);
  });

  it('never overwrites an existing estimate record', async () => {
    const h = harness();
    h.state.hasEstimate = true;
    await expect(captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps)).resolves.toBe('already-tracked');
    expect(h.state.listCalls).toBe(0);
    expect(h.captured).toHaveLength(0);
  });

  it('reports metadata-unavailable when the file list lookup fails', async () => {
    const h = harness();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const failing: StoredFileEstimateDeps = {
      ...h.deps,
      getRecentJobs: () => Promise.reject(new Error('HTTP 500')),
    };
    try {
      await expect(captureStoredFileEstimate('ctx-1', 'stored-single.3mf', failing)).resolves.toBe(
        'metadata-unavailable'
      );
      expect(h.captured).toHaveLength(0);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('retries once after the propagation delay when the file is not listed yet, then captures', async () => {
    jest.useFakeTimers();
    try {
      const h = harness();
      h.state.jobs = [];
      const pending = captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps);

      // First lookup runs immediately and misses.
      await jest.advanceTimersByTimeAsync(0);
      expect(h.state.listCalls).toBe(1);

      // Firmware propagates the file into the recent list during the wait.
      h.state.jobs = [ad5xJob()];
      await jest.advanceTimersByTimeAsync(PROPAGATION_RETRY_DELAY_MS - 1);
      expect(h.state.listCalls).toBe(1);

      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toBeNull();
      expect(h.state.listCalls).toBe(2);
      expect(h.captured).toEqual([
        {
          contextId: 'ctx-1',
          fileName: 'stored-single.3mf',
          tool: { toolId: 0, slotId: 2, usedG: 130 },
        },
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports file-not-in-list when the file stays absent through the propagation retry', async () => {
    jest.useFakeTimers();
    try {
      const h = harness();
      h.state.jobs = [];
      const pending = captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps);
      const assertion = expect(pending).resolves.toBe('file-not-in-list');
      await jest.advanceTimersByTimeAsync(PROPAGATION_RETRY_DELAY_MS);
      await assertion;
      expect(h.state.listCalls).toBe(2);
      expect(h.captured).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not retry when the skip reason is anything other than file-not-in-list', async () => {
    jest.useFakeTimers();
    try {
      const h = harness();
      h.state.jobs = [ad5xJob({ toolCount: 2, toolDatas: [tool(0, 60), tool(1, 70)] })];
      const pending = captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps);
      const assertion = expect(pending).resolves.toBe('multi-material');
      await jest.advanceTimersByTimeAsync(PROPAGATION_RETRY_DELAY_MS * 2);
      await assertion;
      expect(h.state.listCalls).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the propagation wait inside the returned promise (start response never waits)', async () => {
    jest.useFakeTimers();
    try {
      const h = harness();
      h.state.jobs = [];
      let settled = false;
      const pending = captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps).then((result) => {
        settled = true;
        return result;
      });

      // Microtasks flushed: the first lookup missed and the retry timer is
      // armed. The caller-visible contract is still just this pending
      // promise; nothing on the start-response path awaits the delay.
      await jest.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);

      await jest.advanceTimersByTimeAsync(PROPAGATION_RETRY_DELAY_MS);
      await expect(pending).resolves.toBe('file-not-in-list');
      expect(settled).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('warns when the whole recent list is empty (fetch failure is indistinguishable)', async () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const h = harness();
      h.state.jobs = [];
      const pending = captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps);
      const assertion = expect(pending).resolves.toBe('file-not-in-list');
      await jest.advanceTimersByTimeAsync(PROPAGATION_RETRY_DELAY_MS);
      await assertion;
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Recent file list is empty'));
    } finally {
      warnSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('logs a plain skip, not the empty-list warn, when the list is non-empty but lacks the file', async () => {
    jest.useFakeTimers();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const h = harness();
      h.state.jobs = [ad5xJob({ fileName: 'other-file.gcode' })];
      const pending = captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps);
      const assertion = expect(pending).resolves.toBe('file-not-in-list');
      await jest.advanceTimersByTimeAsync(PROPAGATION_RETRY_DELAY_MS);
      await assertion;
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('writes records StationUsageTracker can consume (store round-trip)', async () => {
    const h = harness();
    await captureStoredFileEstimate('ctx-1', 'stored-single.3mf', h.deps);
    const call = h.captured[0];
    expect(call).toBeDefined();

    // Same record shape captureStationEstimate persists for this capture.
    const tool = call.tool as { toolId: number; slotId: number; usedG: number };
    const record: JobEstimateRecord = {
      fileName: call.fileName,
      mappings: [{ toolId: tool.toolId, slotId: tool.slotId }],
      perTool: [{ toolId: tool.toolId, slotId: tool.slotId, usedG: tool.usedG, usedM: null }],
      capturedAt: new Date().toISOString(),
      source: 'printer-metadata',
    };

    const storePath = path.join(os.tmpdir(), `stored-file-estimate-test-${process.pid}-${Date.now()}.json`);
    const store = new JobEstimateStore(storePath);
    try {
      store.captureEstimate('serial-ctx-1', record);
      expect(store.findEstimate('serial-ctx-1', 'stored-single.3mf')).toEqual(record);
    } finally {
      fs.rmSync(storePath, { force: true });
    }
  });
});
