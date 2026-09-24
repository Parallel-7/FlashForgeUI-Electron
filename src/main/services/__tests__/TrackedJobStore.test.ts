/**
 * @fileoverview Unit tests for TrackedJobStore: one job per printer, progress
 * updates, removal, persistence across instances, and corrupt-file recovery.
 */

import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { TrackedJob } from '@shared/types/spoolman-tracking';
import { MAX_TRACKED_PRINTERS, TrackedJobStore } from '../TrackedJobStore';

function tmpFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tracked-job-store-')), 'jobs.json');
}

function job(fileName: string): TrackedJob {
  return {
    fileName,
    source: 'upload-3mf',
    tools: [{ toolId: 0, slotId: 1, spoolId: 3, usedG: 4, usedM: 1 }],
    usageProfile: null,
    armedAt: '2026-09-23T00:00:00.000Z',
    startedAt: null,
    lastProgress: null,
    lastProgressAt: null,
  };
}

describe('TrackedJobStore', () => {
  it('keeps one job per printer and replaces it on the next job', () => {
    const store = new TrackedJobStore(tmpFile());
    store.setJob('A', job('one.3mf'));
    store.setJob('A', job('two.3mf'));
    store.setJob('B', job('three.3mf'));
    expect(store.getJob('A')?.fileName).toBe('two.3mf');
    expect(store.getJob('B')?.fileName).toBe('three.3mf');
  });

  it('removes a job once and reports nothing the second time', () => {
    const store = new TrackedJobStore(tmpFile());
    store.setJob('A', job('one.3mf'));
    expect(store.takeJob('A')?.fileName).toBe('one.3mf');
    expect(store.takeJob('A')).toBeNull();
    expect(store.clearContext('A')).toBe(false);
  });

  it('persists the job and its progress across instances', () => {
    const file = tmpFile();
    const store = new TrackedJobStore(file);
    store.setJob('A', job('one.3mf'));
    store.updateJob('A', { startedAt: '2026-09-23T01:00:00.000Z', lastProgress: 42 }, true);

    const reloaded = new TrackedJobStore(file);
    expect(reloaded.getJob('A')).toMatchObject({ startedAt: '2026-09-23T01:00:00.000Z', lastProgress: 42 });
  });

  it('keeps unpersisted progress in memory only', () => {
    const file = tmpFile();
    const store = new TrackedJobStore(file);
    store.setJob('A', job('one.3mf'));
    store.updateJob('A', { lastProgress: 7 }, false);
    expect(store.getJob('A')?.lastProgress).toBe(7);
    expect(new TrackedJobStore(file).getJob('A')?.lastProgress).toBeNull();
  });

  it('starts empty from a corrupt file', () => {
    const file = tmpFile();
    fs.writeFileSync(file, '{not json');
    expect(new TrackedJobStore(file).getJob('A')).toBeNull();
    fs.writeFileSync(file, JSON.stringify({ version: 99, jobs: {} }));
    expect(new TrackedJobStore(file).getJob('A')).toBeNull();
  });

  it('drops the oldest printer beyond the cap', () => {
    const store = new TrackedJobStore(tmpFile());
    for (let index = 0; index <= MAX_TRACKED_PRINTERS; index++) {
      store.setJob(`P${index}`, job(`${index}.3mf`));
    }
    expect(store.getJob('P0')).toBeNull();
    expect(store.getJob(`P${MAX_TRACKED_PRINTERS}`)).not.toBeNull();
  });
});
