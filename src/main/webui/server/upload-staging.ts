/**
 * @fileoverview Temporary staging store for browser-supplied job files.
 *
 * The desktop job uploader hands the printer backend a path on the local disk,
 * picked through a native file dialog. A browser cannot do that, so the WebUI
 * receives the bytes over HTTP, writes them to a scratch file, and hands that
 * path to the same backend calls. This module owns the scratch files: creation,
 * lookup by opaque id, explicit disposal, and a TTL sweep so an abandoned
 * dialog never leaks a multi-hundred-megabyte 3MF onto disk.
 *
 * Key exports:
 * - stageUpload(): persist an uploaded buffer and return its handle
 * - getStagedUpload(): resolve a handle back to a path
 * - discardStagedUpload(): delete one staged file
 * - disposeUploadStaging(): delete everything and stop the sweep (shutdown)
 * - isAllowedJobFileName(): extension allow-list shared with the routes
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

/** Extensions the desktop file dialog offers for job files. */
const ALLOWED_EXTENSIONS = ['.gcode', '.gx', '.3mf'] as const;

/** Staged files are dropped this long after creation if never used. */
const STAGE_TTL_MS = 30 * 60 * 1000;

/** How often the TTL sweep runs. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/** Upper bound on concurrently staged files, guarding against disk exhaustion. */
const MAX_STAGED_FILES = 8;

const STAGE_DIR = join(tmpdir(), 'flashforge-webui-uploads');

export interface StagedUpload {
  readonly id: string;
  readonly filePath: string;
  readonly fileName: string;
  readonly size: number;
  readonly createdAt: number;
}

const staged = new Map<string, StagedUpload>();
let sweepTimer: NodeJS.Timeout | null = null;

/**
 * Reduce a client-supplied name to a bare filename and confirm it is a job file.
 * Rejects path separators outright rather than stripping them, so a traversal
 * attempt surfaces as an error instead of silently succeeding under a new name.
 */
export function isAllowedJobFileName(fileName: string): boolean {
  if (!fileName || fileName !== basename(fileName)) {
    return false;
  }
  if (fileName.includes('\0') || fileName.startsWith('.')) {
    return false;
  }
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function ensureSweepTimer(): void {
  if (sweepTimer) {
    return;
  }
  sweepTimer = setInterval(() => {
    void sweepExpired();
  }, SWEEP_INTERVAL_MS);
  // Never hold the process open just to expire scratch files.
  sweepTimer.unref?.();
}

async function sweepExpired(): Promise<void> {
  const cutoff = Date.now() - STAGE_TTL_MS;
  for (const entry of Array.from(staged.values())) {
    if (entry.createdAt <= cutoff) {
      await discardStagedUpload(entry.id);
    }
  }
}

/**
 * Remove orphaned scratch files from a previous run. Called once on first stage
 * so a crash mid-upload does not leave the temp directory growing forever.
 */
let cleanedOrphans = false;
async function cleanOrphansOnce(): Promise<void> {
  if (cleanedOrphans) {
    return;
  }
  cleanedOrphans = true;
  try {
    const entries = await readdir(STAGE_DIR);
    await Promise.all(
      entries
        .filter((entry) => !staged.has(entry))
        .map((entry) => rm(join(STAGE_DIR, entry), { recursive: true, force: true }))
    );
  } catch {
    // Directory may not exist yet; nothing to clean.
  }
}

/**
 * Write an uploaded job file to scratch storage and return its handle.
 *
 * Each upload gets its own subdirectory so the original filename can be kept
 * verbatim — the printer stores the file under the name we send it, and the
 * desktop path preserves the user's filename exactly.
 */
export async function stageUpload(fileName: string, data: Buffer): Promise<StagedUpload> {
  if (!isAllowedJobFileName(fileName)) {
    throw new Error('Unsupported job file name');
  }

  await mkdir(STAGE_DIR, { recursive: true });
  await cleanOrphansOnce();

  if (staged.size >= MAX_STAGED_FILES) {
    // Evict the oldest rather than rejecting: a stale handle is always less
    // valuable than the upload the user is actively performing.
    const oldest = Array.from(staged.values()).sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest) {
      await discardStagedUpload(oldest.id);
    }
  }

  const id = randomUUID();
  const directory = join(STAGE_DIR, id);
  await mkdir(directory, { recursive: true });

  const filePath = join(directory, fileName);
  await writeFile(filePath, data);

  const entry: StagedUpload = {
    id,
    filePath,
    fileName,
    size: data.byteLength,
    createdAt: Date.now(),
  };
  staged.set(id, entry);
  ensureSweepTimer();

  return entry;
}

export function getStagedUpload(id: string): StagedUpload | undefined {
  return staged.get(id);
}

export async function discardStagedUpload(id: string): Promise<void> {
  const entry = staged.get(id);
  if (!entry) {
    return;
  }
  staged.delete(id);
  await rm(join(STAGE_DIR, id), { recursive: true, force: true });
}

/** Drop every staged file and stop the sweep. Intended for server shutdown. */
export async function disposeUploadStaging(): Promise<void> {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
  const ids = Array.from(staged.keys());
  staged.clear();
  await Promise.all(ids.map((id) => rm(join(STAGE_DIR, id), { recursive: true, force: true })));
}
