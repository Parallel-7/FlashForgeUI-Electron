/**
 * @fileoverview Persistent slot→spool assignment store for material-station
 * printers, keyed by PRINTER SERIAL.
 *
 * Station printers pull each tool's filament from a physical slot of the
 * material station, so Spoolman deduction must resolve
 * tool → slot (from the job's material mappings) → spool (this store).
 * The Material Station UI populates it when the user snaps a slot to a
 * Spoolman spool; the single active-spool flow used by single-extruder
 * printers is unaffected.
 *
 * Store keys are printer serials (resolved from the printer context at call
 * time — see station-store-key; falls back to the context id when no serial
 * is known), so assignments survive app restarts and printer reconnects
 * instead of being orphaned under regenerated context ids. Memory is bounded
 * by MAX_CONTEXTS (least-recently-written evicted first).
 *
 * Persistence discipline matches {@link JobEstimateStore}: small JSON file in
 * the Electron userData directory, atomic write, tolerant of corrupt content.
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/** On-disk schema version. */
const STORE_VERSION = 1;

/** Cap of tracked printer keys (serials); least-recently-written evicted first. */
export const MAX_CONTEXTS = 32;

/** File name of the store inside the userData directory. */
const STORE_FILENAME = 'spoolman_slot_spools.json';

/** On-disk file shape: store key → (slotId as string key) → spoolId. */
interface SlotSpoolStoreFile {
  version: number;
  contexts: Record<string, Record<string, number>>;
}

function emptyStore(): SlotSpoolStoreFile {
  return { version: STORE_VERSION, contexts: {} };
}

/** Slot→spool assignment store; instantiate with a custom path in tests. */
export class SlotSpoolStore {
  private readonly storePath: string;
  private readonly data: SlotSpoolStoreFile;
  /** Store keys in recency order (most recent last) for cap eviction. */
  private readonly contextOrder: string[];

  constructor(storePath?: string) {
    // Resolved lazily so the singleton can be constructed before app 'ready'
    // in unit tests without touching the real userData directory.
    this.storePath = storePath ?? path.join(app.getPath('userData'), STORE_FILENAME);
    this.data = this.load();
    this.contextOrder = Object.keys(this.data.contexts);
  }

  /** Assign (or, with null, clear) the spool for one slot of a store key. */
  public setSpoolForSlot(storeKey: string, slotId: number, spoolId: number | null): void {
    const slots = this.context(storeKey);
    if (spoolId === null) {
      delete slots[String(slotId)];
    } else {
      slots[String(slotId)] = spoolId;
    }
    this.persist();
  }

  /** Spool assigned to a slot, or null. */
  public getSpoolForSlot(storeKey: string, slotId: number): number | null {
    const slots = this.data.contexts[storeKey];
    const spoolId = slots?.[String(slotId)];
    return typeof spoolId === 'number' ? spoolId : null;
  }

  /** Full slot→spool map for a store key (numeric keys). */
  public getSlotMap(storeKey: string): ReadonlyMap<number, number> {
    const result = new Map<number, number>();
    const slots = this.data.contexts[storeKey];
    if (slots) {
      for (const [key, spoolId] of Object.entries(slots)) {
        const slotId = Number(key);
        if (Number.isInteger(slotId) && typeof spoolId === 'number') {
          result.set(slotId, spoolId);
        }
      }
    }
    return result;
  }

  /** Clear one slot assignment. */
  public clearSlot(storeKey: string, slotId: number): void {
    this.setSpoolForSlot(storeKey, slotId, null);
  }

  /**
   * Drop all assignments for a store key.
   *
   * @returns True when the key held assignments that were removed
   */
  public clearContext(storeKey: string): boolean {
    if (!this.data.contexts[storeKey]) {
      return false;
    }
    delete this.data.contexts[storeKey];
    const index = this.contextOrder.indexOf(storeKey);
    if (index !== -1) {
      this.contextOrder.splice(index, 1);
    }
    this.persist();
    return true;
  }

  /** Test/debug hook: path of the backing file. */
  public get filePath(): string {
    return this.storePath;
  }

  private context(storeKey: string): Record<string, number> {
    let slots = this.data.contexts[storeKey];
    if (!slots) {
      slots = {};
      this.data.contexts[storeKey] = slots;
    }
    this.touchContext(storeKey);
    return slots;
  }

  /**
   * Record recency and enforce the store-key cap. The caller persists after
   * its own mutation, which also covers any eviction performed here.
   */
  private touchContext(storeKey: string): void {
    const index = this.contextOrder.indexOf(storeKey);
    if (index !== -1) {
      this.contextOrder.splice(index, 1);
    }
    this.contextOrder.push(storeKey);

    while (this.contextOrder.length > MAX_CONTEXTS) {
      const oldest = this.contextOrder.shift();
      if (oldest === undefined || oldest === storeKey) {
        break;
      }
      if (this.data.contexts[oldest]) {
        delete this.data.contexts[oldest];
        console.warn(
          `[SlotSpoolStore] Store-key cap (${MAX_CONTEXTS}) reached; evicted oldest key ${oldest}.`
        );
      }
    }
  }

  private load(): SlotSpoolStoreFile {
    try {
      if (!fs.existsSync(this.storePath)) {
        return emptyStore();
      }
      const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as SlotSpoolStoreFile;
      if (
        typeof raw !== 'object' ||
        raw === null ||
        raw.version !== STORE_VERSION ||
        typeof raw.contexts !== 'object' ||
        raw.contexts === null
      ) {
        console.warn(
          '[SlotSpoolStore] Unrecognized store content, starting empty:',
          this.storePath
        );
        return emptyStore();
      }
      return raw;
    } catch (error) {
      console.warn(
        `[SlotSpoolStore] Failed to load ${this.storePath}, starting empty:`,
        error instanceof Error ? error.message : error
      );
      return emptyStore();
    }
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
      const tmpPath = `${this.storePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmpPath, this.storePath);
    } catch (error) {
      // Invariant: persistence failures must never break printing/uploading.
      console.error(
        '[SlotSpoolStore] Failed to persist slot assignments:',
        error instanceof Error ? error.message : error
      );
    }
  }
}

/** Singleton instance (lazy). */
let singletonInstance: SlotSpoolStore | null = null;

/** Access the app-wide slot→spool store singleton. */
export function getSlotSpoolStore(): SlotSpoolStore {
  if (!singletonInstance) {
    singletonInstance = new SlotSpoolStore();
  }
  return singletonInstance;
}
