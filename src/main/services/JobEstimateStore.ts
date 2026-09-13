/**
 * @fileoverview Persistent store of per-job filament estimates for
 * material-station printers.
 *
 * Captured at upload time when a station-printer upload provides tool→slot
 * material mappings AND the parsed slicer file carries per-filament usage
 * estimates (3mf FilamentInfo usedG/usedM, with the AD5X per-tool
 * filamentWeight as fallback). Records are keyed by PRINTER SERIAL (resolved
 * from the printer context at call time — see station-store-key; falls back
 * to the context id when no serial is known) and by final file name, so
 * mid-print app restarts and printer reconnects keep estimates alive.
 *
 * Also owns the exactly-once deduction ledger: every successful (or
 * deliberately skipped) deduction attempt marks its job key here so no
 * terminal path can deduct the same print twice.
 *
 * Memory is bounded per store key (newest-first job/ledger caps) and across
 * store keys (MAX_CONTEXTS, least-recently-written evicted first).
 *
 * Persistence discipline: small JSON file in the Electron userData
 * directory, atomic write (temp file + rename), tolerant of corrupt content
 * (starts empty and logs a warning rather than crashing).
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { JobEstimateRecord } from '@shared/types/spoolman-tracking';

/** On-disk schema version. */
const STORE_VERSION = 1;

/** Newest-first cap of estimate records kept per store key. */
const MAX_JOBS_PER_CONTEXT = 20;

/** Newest-first cap of deduction-ledger keys kept per store key. */
const MAX_DEDUCTED_KEYS = 50;

/** Cap of tracked printer keys (serials); least-recently-written evicted first. */
export const MAX_CONTEXTS = 32;

/** File name of the store inside the userData directory. */
const STORE_FILENAME = 'spoolman_job_estimates.json';

/** Per-key slice of the store (one printer serial / context id fallback). */
interface ContextEstimates {
  jobs: JobEstimateRecord[];
  deductedKeys: string[];
}

/** On-disk file shape. */
interface JobEstimateStoreFile {
  version: number;
  contexts: Record<string, ContextEstimates>;
}

function emptyStore(): JobEstimateStoreFile {
  return { version: STORE_VERSION, contexts: {} };
}

/**
 * Atomic JSON write: serialize to a temp file next to the target, then rename
 * over the target so a crash mid-write never truncates the previous state.
 */
function atomicWriteJson(filePath: string, data: unknown): void {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Job estimate store. Instantiate directly with a custom path in tests;
 * the app uses the {@link getJobEstimateStore} singleton.
 */
export class JobEstimateStore {
  private readonly storePath: string;
  private readonly data: JobEstimateStoreFile;
  /** Store keys in recency order (most recent last) for cap eviction. */
  private readonly contextOrder: string[];

  constructor(storePath?: string) {
    // Resolved lazily so the singleton can be constructed before app 'ready'
    // in unit tests without touching the real userData directory.
    this.storePath = storePath ?? path.join(app.getPath('userData'), STORE_FILENAME);
    this.data = this.load();
    this.contextOrder = Object.keys(this.data.contexts);
  }

  /** Capture (or replace) the estimate record for a file on a store key. */
  public captureEstimate(storeKey: string, record: JobEstimateRecord): void {
    const context = this.context(storeKey);
    context.jobs = [record, ...context.jobs.filter((job) => job.fileName !== record.fileName)].slice(
      0,
      MAX_JOBS_PER_CONTEXT
    );
    this.persist();
  }

  /** Newest estimate record for a file name, or null when untracked. */
  public findEstimate(storeKey: string, fileName: string): JobEstimateRecord | null {
    const context = this.peek(storeKey);
    const job = context?.jobs.find((entry) => entry.fileName === fileName);
    return job ?? null;
  }

  /** All estimate records for a store key (newest first). */
  public getEstimates(storeKey: string): readonly JobEstimateRecord[] {
    const context = this.peek(storeKey);
    return context ? [...context.jobs] : [];
  }

  /** True when the job key was already deducted (exactly-once ledger). */
  public isDeducted(storeKey: string, jobKey: string): boolean {
    const context = this.peek(storeKey);
    return context ? context.deductedKeys.includes(jobKey) : false;
  }

  /** Mark a job key as deducted and persist the ledger. */
  public markDeducted(storeKey: string, jobKey: string): void {
    const context = this.context(storeKey);
    if (context.deductedKeys.includes(jobKey)) {
      return;
    }
    context.deductedKeys = [jobKey, ...context.deductedKeys].slice(0, MAX_DEDUCTED_KEYS);
    this.persist();
  }

  /** Drop one estimate record (e.g. file deleted from the printer). */
  public removeEstimate(storeKey: string, fileName: string): void {
    const context = this.peek(storeKey);
    if (!context) {
      return;
    }
    context.jobs = context.jobs.filter((job) => job.fileName !== fileName);
    this.persist();
  }

  /**
   * Drop all state for a store key.
   *
   * @returns True when the key held state that was removed
   */
  public clearContext(storeKey: string): boolean {
    const existed = this.data.contexts[storeKey] !== undefined;
    if (!existed) {
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

  /** Read a key's slice without creating it (reads never churn the cap). */
  private peek(storeKey: string): ContextEstimates | null {
    return this.data.contexts[storeKey] ?? null;
  }

  /** Get (or create) a key's slice, then record recency for cap eviction. */
  private context(storeKey: string): ContextEstimates {
    let context = this.data.contexts[storeKey];
    if (!context) {
      context = { jobs: [], deductedKeys: [] };
      this.data.contexts[storeKey] = context;
    }
    this.touchContext(storeKey);
    return context;
  }

  /**
   * Record recency and enforce the store-key cap. Callers persist after
   * their own mutation, which also covers any eviction performed here.
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
          `[JobEstimateStore] Store-key cap (${MAX_CONTEXTS}) reached; evicted oldest key ${oldest}.`
        );
      }
    }
  }

  private load(): JobEstimateStoreFile {
    try {
      if (!fs.existsSync(this.storePath)) {
        return emptyStore();
      }
      const raw = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as JobEstimateStoreFile;
      if (
        typeof raw !== 'object' ||
        raw === null ||
        raw.version !== STORE_VERSION ||
        typeof raw.contexts !== 'object' ||
        raw.contexts === null
      ) {
        console.warn(
          '[JobEstimateStore] Unrecognized store content, starting empty:',
          this.storePath
        );
        return emptyStore();
      }
      return raw;
    } catch (error) {
      console.warn(
        `[JobEstimateStore] Failed to load ${this.storePath}, starting empty:`,
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
        '[JobEstimateStore] Failed to persist estimate store:',
        error instanceof Error ? error.message : error
      );
    }
  }
}

/** Singleton instance (lazy). */
let singletonInstance: JobEstimateStore | null = null;

/** Access the app-wide job estimate store singleton. */
export function getJobEstimateStore(): JobEstimateStore {
  if (!singletonInstance) {
    singletonInstance = new JobEstimateStore();
  }
  return singletonInstance;
}
