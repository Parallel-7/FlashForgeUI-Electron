/**
 * @fileoverview Unit tests for SlotSpoolStore: CRUD, persistence, corrupt-file
 * tolerance, serial-keyed restart survival, and the store-key cap.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MAX_CONTEXTS, SlotSpoolStore } from '../SlotSpoolStore';

function tmpStorePath(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slot-spool-test-')), 'slots.json');
}

describe('SlotSpoolStore', () => {
  let storePath: string;

  beforeEach(() => {
    storePath = tmpStorePath();
  });

  it('assigns and reads a slot→spool mapping', () => {
    const store = new SlotSpoolStore(storePath);
    store.setSpoolForSlot('ctx-1', 1, 42);
    expect(store.getSpoolForSlot('ctx-1', 1)).toBe(42);
    expect(store.getSpoolForSlot('ctx-1', 2)).toBeNull();
  });

  it('clears a slot with a null assignment', () => {
    const store = new SlotSpoolStore(storePath);
    store.setSpoolForSlot('ctx-1', 1, 42);
    store.setSpoolForSlot('ctx-1', 1, null);
    expect(store.getSpoolForSlot('ctx-1', 1)).toBeNull();
    expect(store.getSlotMap('ctx-1').size).toBe(0);
  });

  it('returns the full map with numeric keys', () => {
    const store = new SlotSpoolStore(storePath);
    store.setSpoolForSlot('ctx-1', 1, 10);
    store.setSpoolForSlot('ctx-1', 3, 30);
    const map = store.getSlotMap('ctx-1');
    expect(map.get(1)).toBe(10);
    expect(map.get(3)).toBe(30);
    expect(map.size).toBe(2);
  });

  it('isolates contexts', () => {
    const store = new SlotSpoolStore(storePath);
    store.setSpoolForSlot('ctx-1', 1, 10);
    expect(store.getSpoolForSlot('ctx-2', 1)).toBeNull();
  });

  it('persists across restart', () => {
    const store = new SlotSpoolStore(storePath);
    store.setSpoolForSlot('ctx-1', 2, 99);
    const reopened = new SlotSpoolStore(storePath);
    expect(reopened.getSpoolForSlot('ctx-1', 2)).toBe(99);
  });

  it('keeps slot assignments under a printer serial across restart (reconnect key stability)', () => {
    const store = new SlotSpoolStore(storePath);
    store.setSpoolForSlot('FFSN-A17', 2, 99);

    const restarted = new SlotSpoolStore(storePath);
    expect(restarted.getSpoolForSlot('FFSN-A17', 2)).toBe(99);
    // Serials are isolated from each other exactly like old context ids were.
    expect(restarted.getSpoolForSlot('FFSN-B99', 2)).toBeNull();
  });

  it('tolerates a corrupt file by starting empty', () => {
    fs.writeFileSync(storePath, 'not json at all', 'utf8');
    const store = new SlotSpoolStore(storePath);
    expect(store.getSlotMap('ctx-1').size).toBe(0);
    store.setSpoolForSlot('ctx-1', 1, 7);
    expect(new SlotSpoolStore(storePath).getSpoolForSlot('ctx-1', 1)).toBe(7);
  });

  it('clears a slot and a whole context', () => {
    const store = new SlotSpoolStore(storePath);
    store.setSpoolForSlot('ctx-1', 1, 10);
    store.setSpoolForSlot('ctx-1', 2, 20);
    store.clearSlot('ctx-1', 1);
    expect(store.getSpoolForSlot('ctx-1', 1)).toBeNull();
    store.clearContext('ctx-1');
    expect(store.getSlotMap('ctx-1').size).toBe(0);
  });

  it('does not leave a temp file behind', () => {
    const store = new SlotSpoolStore(storePath);
    store.setSpoolForSlot('ctx-1', 1, 10);
    expect(fs.existsSync(`${storePath}.tmp`)).toBe(false);
  });

  describe('store-key cap', () => {
    it('evicts the least-recently-written key beyond MAX_CONTEXTS and persists it', () => {
      const store = new SlotSpoolStore(storePath);
      for (let i = 0; i <= MAX_CONTEXTS; i++) {
        store.setSpoolForSlot(`SN-${i}`, 1, i);
      }

      expect(store.getSpoolForSlot('SN-0', 1)).toBeNull(); // oldest evicted
      expect(store.getSpoolForSlot(`SN-${MAX_CONTEXTS}`, 1)).toBe(MAX_CONTEXTS);

      const reopened = new SlotSpoolStore(storePath);
      expect(reopened.getSpoolForSlot('SN-0', 1)).toBeNull();
      expect(reopened.getSpoolForSlot('SN-1', 1)).toBe(1);
    });

    it('refreshes recency when an old key is written again', () => {
      const store = new SlotSpoolStore(storePath);
      for (let i = 0; i < MAX_CONTEXTS; i++) {
        store.setSpoolForSlot(`SN-${i}`, 1, i);
      }
      store.setSpoolForSlot('SN-0', 1, 0); // SN-0 becomes the most recent
      store.setSpoolForSlot('SN-32', 1, 32); // 33rd key evicts SN-1, not SN-0

      expect(store.getSpoolForSlot('SN-0', 1)).toBe(0);
      expect(store.getSpoolForSlot('SN-1', 1)).toBeNull();
    });
  });
});
