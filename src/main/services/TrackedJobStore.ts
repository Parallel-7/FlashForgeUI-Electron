/**
 * @fileoverview Persistent store of the one Spoolman-tracked job per printer.
 *
 * A material-station printer runs one job at a time, so the store keeps at
 * most one {@link TrackedJob} per printer. The app writes it when it starts a
 * job with spool choices from the matching dialog, and deletes it when the job
 * ends. The file on disk exists only so a job that is printing survives an app
 * restart or a printer reconnect; no spool choice outlives its job.
 *
 * Records are keyed by printer serial (see station-store-key; the context id
 * is the fallback when no serial is known).
 *
 * Persistence discipline: small JSON file in the Electron userData directory, atomic
 * write (temp file + rename), tolerant of corrupt content (starts empty and
 * logs a warning rather than crashing).
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { TrackedJob } from '@shared/types/spoolman-tracking';

/** On-disk schema version. */
const STORE_VERSION = 1;

/** Cap of printer keys kept; least-recently-written evicted first. */
export const MAX_TRACKED_PRINTERS = 32;

/** On-disk file shape. */
interface TrackedJobStoreFile {
  version: number;
  jobs: Record<string, TrackedJob>;
}

function emptyStore(): TrackedJobStoreFile {
  return { version: STORE_VERSION, jobs: {} };
}

/**
 * Atomic JSON write: serialize to a temp file next to the target, then rename
 * over the target so a crash mid-write never truncates the previous state.
 */
function atomicWriteJson(filePath: string, data: unknown): void {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Tracked job store. Instantiate directly with a custom path in tests; the
 * app uses the {@link getTrackedJobStore} singleton.
 */
export class TrackedJobStore {
  private readonly storePath: string;
  private readonly data: TrackedJobStoreFile;

  constructor(storePath?: string) {
    // Resolved lazily so the singleton can be constructed before app 'ready'
    // in unit tests without touching the real userData directory.
    this.storePath = storePath ?? path.join(app.getPath('userData'), 'spoolman_tracked_jobs.json');
    this.data = this.load();
  }

  /** Set the tracked job for a printer, replacing any earlier one. */
  public setJob(storeKey: string, job: TrackedJob): void {
    delete this.data.jobs[storeKey];
    this.data.jobs[storeKey] = job;
    const keys = Object.keys(this.data.jobs);
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_TRACKED_PRINTERS))) {
      delete this.data.jobs[key];
      console.warn(`[TrackedJobStore] Printer cap reached; dropped tracked job for ${key}.`);
    }
    this.persist();
  }

  /** The tracked job for a printer, or null. */
  public getJob(storeKey: string): TrackedJob | null {
    return this.data.jobs[storeKey] ?? null;
  }

  /**
   * Update progress fields of the tracked job in place.
   *
   * @param persist - Write the change to disk now (callers throttle this)
   */
  public updateJob(
    storeKey: string,
    changes: Partial<Pick<TrackedJob, 'startedAt' | 'lastProgress' | 'lastProgressAt'>>,
    persist: boolean
  ): void {
    const job = this.data.jobs[storeKey];
    if (!job) {
      return;
    }
    Object.assign(job, changes);
    if (persist) {
      this.persist();
    }
  }

  /**
   * Remove and return the tracked job for a printer.
   *
   * @returns The removed job, or null when there was none
   */
  public takeJob(storeKey: string): TrackedJob | null {
    const job = this.data.jobs[storeKey];
    if (!job) {
      return null;
    }
    delete this.data.jobs[storeKey];
    this.persist();
    return job;
  }

  /**
   * Drop all state for a printer key.
   *
   * @returns True when the key held a job that was removed
   */
  public clearContext(storeKey: string): boolean {
    return this.takeJob(storeKey) !== null;
  }

  /** Test/debug hook: path of the backing file. */
  public get filePath(): string {
    return this.storePath;
  }

  private load(): TrackedJobStoreFile {
    try {
      if (!fs.existsSync(this.storePath)) {
        return emptyStore();
      }
      const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as TrackedJobStoreFile;
      if (
        typeof raw !== 'object' ||
        raw === null ||
        raw.version !== STORE_VERSION ||
        typeof raw.jobs !== 'object' ||
        raw.jobs === null
      ) {
        console.warn('[TrackedJobStore] Unrecognized store content, starting empty:', this.storePath);
        return emptyStore();
      }
      return raw;
    } catch (error) {
      console.warn(
        `[TrackedJobStore] Failed to load ${this.storePath}, starting empty:`,
        error instanceof Error ? error.message : error
      );
      return emptyStore();
    }
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
      atomicWriteJson(this.storePath, this.data);
    } catch (error) {
      // Invariant: persistence failures must never break printing/uploading.
      console.error(
        '[TrackedJobStore] Failed to persist tracked job store:',
        error instanceof Error ? error.message : error
      );
    }
  }
}

/** Singleton instance (lazy). */
let singletonInstance: TrackedJobStore | null = null;

/** Access the app-wide tracked job store singleton. */
export function getTrackedJobStore(): TrackedJobStore {
  if (!singletonInstance) {
    singletonInstance = new TrackedJobStore();
  }
  return singletonInstance;
}
