/**
 * @fileoverview Unit tests for JobEstimateStore: capture/persist/restart,
 * exactly-once ledger behavior, corrupt-file tolerance, serial-keyed restart
 * survival, and the store-key cap.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { JobEstimateStore, MAX_CONTEXTS } from '../JobEstimateStore';
import type { JobEstimateRecord } from '@shared/types/spoolman-tracking';

function tmpStorePath(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'job-estimate-test-')), 'estimates.json');
}

function makeRecord(fileName: string, tools: { toolId: number; usedG: number | null }[]): JobEstimateRecord {
  return {
    fileName,
    mappings: tools.map((tool) => ({ toolId: tool.toolId, slotId: tool.toolId + 1 })),
    perTool: tools.map((tool) => ({
      toolId: tool.toolId,
      slotId: tool.toolId + 1,
      usedG: tool.usedG,
      usedM: tool.usedG !== null ? tool.usedG / 3 : null,
    })),
    capturedAt: new Date().toISOString(),
  };
}

describe('JobEstimateStore', () => {
  let storePath: string;

  beforeEach(() => {
    storePath = tmpStorePath();
  });

  describe('capture and lookup', () => {
    it('captures a record and finds it by file name', () => {
      const store = new JobEstimateStore(storePath);
      store.captureEstimate('ctx-1', makeRecord('benchy.3mf', [{ toolId: 0, usedG: 11.28 }]));

      const found = store.findEstimate('ctx-1', 'benchy.3mf');
      expect(found).not.toBeNull();
      expect(found?.perTool[0]?.usedG).toBe(11.28);
    });

    it('replaces a record when the same file is re-uploaded', () => {
      const store = new JobEstimateStore(storePath);
      store.captureEstimate('ctx-1', makeRecord('benchy.3mf', [{ toolId: 0, usedG: 11.28 }]));
      store.captureEstimate('ctx-1', makeRecord('benchy.3mf', [{ toolId: 0, usedG: 22.5 }]));

      expect(store.getEstimates('ctx-1')).toHaveLength(1);
      expect(store.findEstimate('ctx-1', 'benchy.3mf')?.perTool[0]?.usedG).toBe(22.5);
    });

    it('isolates records per context', () => {
      const store = new JobEstimateStore(storePath);
      store.captureEstimate('ctx-1', makeRecord('benchy.3mf', [{ toolId: 0, usedG: 11.28 }]));

      expect(store.findEstimate('ctx-2', 'benchy.3mf')).toBeNull();
    });

    it('returns null for unknown file names', () => {
      const store = new JobEstimateStore(storePath);
      expect(store.findEstimate('ctx-1', 'nope.3mf')).toBeNull();
    });

    it('caps the number of retained jobs per context', () => {
      const store = new JobEstimateStore(storePath);
      for (let i = 0; i < 25; i++) {
        store.captureEstimate('ctx-1', makeRecord(`file-${i}.3mf`, [{ toolId: 0, usedG: 1 }]));
      }
      expect(store.getEstimates('ctx-1')).toHaveLength(20);
      expect(store.findEstimate('ctx-1', 'file-0.3mf')).toBeNull();
      expect(store.findEstimate('ctx-1', 'file-24.3mf')).not.toBeNull();
    });
  });

  describe('persistence across restart', () => {
    it('restores records and ledger after re-instantiation', () => {
      const store = new JobEstimateStore(storePath);
      store.captureEstimate('ctx-1', makeRecord('benchy.3mf', [{ toolId: 0, usedG: 11.28 }]));
      store.markDeducted('ctx-1', 'benchy.3mf::t0');

      const reopened = new JobEstimateStore(storePath);
      expect(reopened.findEstimate('ctx-1', 'benchy.3mf')?.perTool[0]?.usedG).toBe(11.28);
      expect(reopened.isDeducted('ctx-1', 'benchy.3mf::t0')).toBe(true);
    });

    it('keeps record and ledger under a printer serial across restart (reconnect key stability)', () => {
      const store = new JobEstimateStore(storePath);
      store.captureEstimate('FFSN-A17', makeRecord('benchy.3mf', [{ toolId: 0, usedG: 11.28 }]));
      store.markDeducted('FFSN-A17', 'benchy.3mf::t0');

      // A restart re-instantiates the store; the serial is unchanged, so the
      // estimate AND the exactly-once ledger entry must both survive.
      const restarted = new JobEstimateStore(storePath);
      expect(restarted.findEstimate('FFSN-A17', 'benchy.3mf')?.perTool[0]?.usedG).toBe(11.28);
      expect(restarted.isDeducted('FFSN-A17', 'benchy.3mf::t0')).toBe(true);
      // Different serials stay isolated.
      expect(restarted.findEstimate('FFSN-B99', 'benchy.3mf')).toBeNull();
      expect(restarted.isDeducted('FFSN-B99', 'benchy.3mf::t0')).toBe(false);
    });

    it('survives a corrupt file by starting empty', () => {
      fs.writeFileSync(storePath, '{ this is not json', 'utf8');
      const store = new JobEstimateStore(storePath);
      expect(store.getEstimates('ctx-1')).toHaveLength(0);
      // And it can still capture + persist a fresh record afterwards.
      store.captureEstimate('ctx-1', makeRecord('benchy.3mf', [{ toolId: 0, usedG: 5 }]));
      expect(new JobEstimateStore(storePath).findEstimate('ctx-1', 'benchy.3mf')).not.toBeNull();
    });

    it('writes atomically (no leftover tmp file)', () => {
      const store = new JobEstimateStore(storePath);
      store.captureEstimate('ctx-1', makeRecord('benchy.3mf', [{ toolId: 0, usedG: 5 }]));
      expect(fs.existsSync(`${storePath}.tmp`)).toBe(false);
      expect(fs.existsSync(storePath)).toBe(true);
    });
  });

  describe('deduction ledger', () => {
    it('marks keys exactly once and keeps them capped', () => {
      const store = new JobEstimateStore(storePath);
      for (let i = 0; i < 55; i++) {
        store.markDeducted('ctx-1', `key-${i}`);
      }
      expect(store.isDeducted('ctx-1', 'key-54')).toBe(true);
      expect(store.isDeducted('ctx-1', 'key-10')).toBe(true);
      // Oldest keys beyond the cap are evicted.
      expect(store.isDeducted('ctx-1', 'key-0')).toBe(false);
    });
  });

  describe('removal', () => {
    it('removes a single estimate', () => {
      const store = new JobEstimateStore(storePath);
      store.captureEstimate('ctx-1', makeRecord('a.3mf', [{ toolId: 0, usedG: 1 }]));
      store.removeEstimate('ctx-1', 'a.3mf');
      expect(store.findEstimate('ctx-1', 'a.3mf')).toBeNull();
    });

    it('clears an entire context', () => {
      const store = new JobEstimateStore(storePath);
      store.captureEstimate('ctx-1', makeRecord('a.3mf', [{ toolId: 0, usedG: 1 }]));
      store.markDeducted('ctx-1', 'k');
      store.clearContext('ctx-1');
      expect(store.getEstimates('ctx-1')).toHaveLength(0);
      expect(store.isDeducted('ctx-1', 'k')).toBe(false);
    });
  });

  describe('store-key cap', () => {
    it('evicts the least-recently-written key beyond MAX_CONTEXTS and persists it', () => {
      const store = new JobEstimateStore(storePath);
      for (let i = 0; i <= MAX_CONTEXTS; i++) {
        store.captureEstimate(`SN-${i}`, makeRecord(`file-${i}.3mf`, [{ toolId: 0, usedG: 1 }]));
      }

      expect(store.findEstimate('SN-0', 'file-0.3mf')).toBeNull(); // oldest evicted
      expect(store.findEstimate(`SN-${MAX_CONTEXTS}`, `file-${MAX_CONTEXTS}.3mf`)).not.toBeNull();

      const reopened = new JobEstimateStore(storePath);
      expect(reopened.findEstimate('SN-0', 'file-0.3mf')).toBeNull();
      expect(reopened.findEstimate('SN-1', 'file-1.3mf')).not.toBeNull();
    });

    it('refreshes recency when an old key is written again', () => {
      const store = new JobEstimateStore(storePath);
      for (let i = 0; i < MAX_CONTEXTS; i++) {
        store.captureEstimate(`SN-${i}`, makeRecord(`file-${i}.3mf`, [{ toolId: 0, usedG: 1 }]));
      }
      store.captureEstimate('SN-0', makeRecord('file-0.3mf', [{ toolId: 0, usedG: 2 }])); // most recent
      store.captureEstimate('SN-32', makeRecord('file-32.3mf', [{ toolId: 0, usedG: 1 }]));

      expect(store.findEstimate('SN-0', 'file-0.3mf')?.perTool[0]?.usedG).toBe(2);
      expect(store.findEstimate('SN-1', 'file-1.3mf')).toBeNull(); // evicted, not SN-0
    });

    it('does not create entries for read-only lookups', () => {
      const store = new JobEstimateStore(storePath);
      store.findEstimate('never-seen', 'benchy.3mf');
      store.isDeducted('never-seen', 'k');
      store.getEstimates('never-seen');

      const reopened = new JobEstimateStore(storePath);
      expect(reopened.getEstimates('never-seen')).toHaveLength(0);
      expect(fs.existsSync(storePath)).toBe(false); // reads never persist
    });
  });
});
