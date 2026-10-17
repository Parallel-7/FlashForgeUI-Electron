/**
 * @fileoverview Unit tests for job-tracking: tool ids from 3MF filament ids,
 * joining mappings with spool choices and estimates, and arming uploaded and
 * stored-file jobs (skip reasons, estimate fallbacks, profile failures).
 */

import { describe, expect, it } from '@jest/globals';
import type { ParseResult } from '@parallel-7/slicer-meta';
import type { AD5XJobInfo } from '@shared/types/printer-backend/backend-operations';
import type { TrackedJob } from '@shared/types/spoolman-tracking';
import {
  armUploadedJob,
  buildTrackedTools,
  clearTrackedJob,
  commitStoredFileJob,
  estimatesFromParse,
  type JobTrackingDeps,
  prepareStoredFileJob,
  toolIdForFilament,
} from '../job-tracking';

function makeDeps(overrides: Partial<JobTrackingDeps> = {}) {
  const jobs = new Map<string, TrackedJob>();
  const deps: JobTrackingDeps = {
    isSpoolmanEnabled: () => true,
    isStationContext: () => true,
    resolveStoreKey: () => 'SERIAL',
    setJob: (key, job) => jobs.set(key, job),
    takeJob: (key) => {
      const job = jobs.get(key) ?? null;
      jobs.delete(key);
      return job;
    },
    buildProfile: async () => ({ sampleCount: 1, perTool: { '0': [0, 1] } }),
    listJobs: async () => [],
    now: () => new Date('2026-09-23T00:00:00Z'),
    ...overrides,
  };
  return { deps, jobs };
}

function parsed(filaments: Array<{ id?: string; usedG?: string; usedM?: string }>): ParseResult {
  return { threeMf: { filaments } } as unknown as ParseResult;
}

const MAPPINGS = [
  { toolId: 0, slotId: 1 },
  { toolId: 2, slotId: 4 },
];

describe('toolIdForFilament', () => {
  it('uses the 1-based filament id, not the list position', () => {
    expect(toolIdForFilament({ id: '1' }, 0)).toBe(0);
    expect(toolIdForFilament({ id: '3' }, 1)).toBe(2);
  });

  it('falls back to the list position without a usable id', () => {
    expect(toolIdForFilament({ id: null }, 1)).toBe(1);
    expect(toolIdForFilament({ id: 'x' }, 2)).toBe(2);
    expect(toolIdForFilament({ id: '0' }, 3)).toBe(3);
  });
});

describe('estimatesFromParse', () => {
  it('keys estimates by tool id', () => {
    expect(estimatesFromParse(parsed([{ id: '1', usedG: '6.9' }, { id: '3', usedG: '4.4', usedM: '1.5' }]))).toEqual([
      { toolId: 0, usedG: 6.9, usedM: null },
      { toolId: 2, usedG: 4.4, usedM: 1.5 },
    ]);
  });
});

describe('buildTrackedTools', () => {
  it('keeps only tools with a spool choice', () => {
    const tools = buildTrackedTools(
      MAPPINGS,
      [
        { toolId: 0, spoolId: 7 },
        { toolId: 2, spoolId: null },
      ],
      [{ toolId: 0, usedG: 5, usedM: 2 }]
    );
    expect(tools).toEqual([{ toolId: 0, slotId: 1, spoolId: 7, usedG: 5, usedM: 2 }]);
  });
});

describe('armUploadedJob', () => {
  const upload = {
    fileName: 'part.3mf',
    filePath: '/tmp/part.3mf',
    parsed: parsed([{ id: '1', usedG: '6.94' }, { id: '3', usedG: '4.38' }]),
    mappings: MAPPINGS,
    spoolAssignments: [
      { toolId: 0, spoolId: 11 },
      { toolId: 2, spoolId: 22 },
    ],
  };

  it('stores a tracked job with estimates and a usage profile', async () => {
    const { deps, jobs } = makeDeps();
    const result = await armUploadedJob('ctx', upload, deps);
    expect(result.armed).toBe(true);
    const job = jobs.get('SERIAL');
    expect(job?.tools.map((tool) => [tool.toolId, tool.spoolId, tool.usedG])).toEqual([
      [0, 11, 6.94],
      [2, 22, 4.38],
    ]);
    expect(job?.usageProfile).not.toBeNull();
    expect(job?.source).toBe('upload-3mf');
    expect(job?.startedAt).toBeNull();
  });

  it('builds the profile with the lowest mapped tool as the first tool', async () => {
    let initialTool = -1;
    const { deps } = makeDeps({
      buildProfile: async (_path, tool) => {
        initialTool = tool;
        return null;
      },
    });
    await armUploadedJob('ctx', { ...upload, mappings: [{ toolId: 2, slotId: 1 }, { toolId: 1, slotId: 2 }] }, deps);
    expect(initialTool).toBe(1);
  });

  it('still tracks the job when the gcode cannot be read', async () => {
    const { deps, jobs } = makeDeps({
      buildProfile: async () => {
        throw new Error('corrupt');
      },
    });
    const result = await armUploadedJob('ctx', upload, deps);
    expect(result.armed).toBe(true);
    expect(jobs.get('SERIAL')?.usageProfile).toBeNull();
  });

  it('falls back to AD5X per-tool weights when the file has no estimates', async () => {
    const listed: AD5XJobInfo = {
      _type: 'ad5x',
      fileName: 'part.3mf',
      toolDatas: [
        { toolId: 0, filamentWeight: 3, materialName: 'PLA', materialColor: '#fff', slotId: 0 },
        { toolId: 2, filamentWeight: 4, materialName: 'PLA', materialColor: '#fff', slotId: 0 },
      ],
    } as unknown as AD5XJobInfo;
    const { deps, jobs } = makeDeps({ listJobs: async () => [listed] });
    await armUploadedJob('ctx', { ...upload, parsed: parsed([{ id: '1' }, { id: '3' }]) }, deps);
    expect(jobs.get('SERIAL')?.tools.map((tool) => tool.usedG)).toEqual([3, 4]);
  });

  it('skips when Spoolman is off, the printer has no station, or no spool was chosen', async () => {
    expect(await armUploadedJob('ctx', upload, makeDeps({ isSpoolmanEnabled: () => false }).deps)).toEqual({
      armed: false,
      reason: 'spoolman-disabled',
    });
    expect(await armUploadedJob('ctx', upload, makeDeps({ isStationContext: () => false }).deps)).toEqual({
      armed: false,
      reason: 'not-a-station-context',
    });
    expect(
      await armUploadedJob(
        'ctx',
        { ...upload, spoolAssignments: [{ toolId: 0, spoolId: null }] },
        makeDeps().deps
      )
    ).toEqual({ armed: false, reason: 'no-spools-chosen' });
  });
});

describe('stored-file jobs', () => {
  const listed = {
    _type: 'ad5x',
    fileName: 'stored.3mf',
    toolDatas: [
      { toolId: 0, filamentWeight: 12, materialName: 'PLA', materialColor: '#fff', slotId: 0 },
      { toolId: 1, filamentWeight: 8, materialName: 'PETG', materialColor: '#000', slotId: 0 },
    ],
  } as unknown as AD5XJobInfo;

  it('prepares tools from the printer file list and commits them without a profile', async () => {
    const { deps, jobs } = makeDeps({ listJobs: async () => [listed] });
    const prepared = await prepareStoredFileJob(
      'ctx',
      'stored.3mf',
      [
        { toolId: 0, slotId: 2 },
        { toolId: 1, slotId: 1 },
      ],
      [
        { toolId: 0, spoolId: 5 },
        { toolId: 1, spoolId: 6 },
      ],
      deps
    );
    expect('tools' in prepared).toBe(true);
    if ('tools' in prepared) {
      commitStoredFileJob('ctx', 'stored.3mf', prepared.tools, deps);
    }
    const job = jobs.get('SERIAL');
    expect(job?.source).toBe('stored-file');
    expect(job?.usageProfile).toBeNull();
    expect(job?.tools.map((tool) => [tool.slotId, tool.spoolId, tool.usedG])).toEqual([
      [2, 5, 12],
      [1, 6, 8],
    ]);
  });

  it('reports a missing file', async () => {
    const { deps } = makeDeps();
    expect(await prepareStoredFileJob('ctx', 'gone.3mf', [{ toolId: 0, slotId: 1 }], [{ toolId: 0, spoolId: 5 }], deps)).toEqual({
      reason: 'metadata-unavailable',
    });
  });
});

describe('clearTrackedJob', () => {
  it('removes the earlier tracked job of a station printer', async () => {
    const { deps, jobs } = makeDeps();
    commitStoredFileJob('ctx', 'old.3mf', [{ toolId: 0, slotId: 1, spoolId: 1, usedG: 1, usedM: null }], deps);
    clearTrackedJob('ctx', deps);
    expect(jobs.size).toBe(0);
  });
});
