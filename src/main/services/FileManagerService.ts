/**
 * @fileoverview SFTP-backed file management service for FlashForge printers.
 *
 * Provides listing, deletion, renaming, and thumbnail retrieval for print files
 * stored on the printer's internal flash and on plugged-in USB drives. Works over
 * the SSH/SFTP access provisioned by the flashforge-easyssh USB script:
 * - AD5X: files in /usr/data/gcodes, thumbnail caches in /usr/data/gcodes/thum
 *   and /usr/data/gcodes/3mf/thum, USB drives mounted under /mnt.
 * - Adventurer 5M / 5M Pro: files in /data (flat), thumbnails in
 *   /data/uploadThumbnail, USB drives mounted under /mnt/usb.
 *
 * Thumbnail resolution order: local ThumbnailCacheService -> printer-side
 * thumbnail cache PNGs -> ranged-read extraction of Metadata/plate_1(_small).png
 * from .3mf archives (OrcaSlicer zips) without downloading the whole file.
 * Fetched thumbnails are persisted into the shared ThumbnailCacheService so the
 * job picker and WebUI benefit from the same cache.
 *
 * Connections are pooled through the shared SSHConnectionManager under
 * 'file-manager:<contextId>' keys, using the centralized per-printer SSH
 * settings store (SSHSettingsService; easyssh defaults root / flashforge).
 *
 * Key exports:
 * - FileManagerService / getFileManagerService(): singleton service
 * - FileManagerTarget: printer identity required for operations
 */

import * as zlib from 'zlib';
import type { SFTPWrapper } from 'ssh2';
import type {
  FileManagerCapabilities,
  FileManagerDeleteOutcome,
  FileManagerDeleteResult,
  FileManagerListing,
  FileManagerRenameResult,
  FileManagerStorageKind,
  FileManagerThumbnailResult,
  PrinterFileEntry,
} from '@shared/types/file-manager.js';
import { PRINTABLE_FILE_EXTENSIONS } from '@shared/types/file-manager.js';
import type { PrinterModelType } from '@shared/types/printer-backend/index.js';
import { getSSHConnectionManager } from './calibration/ssh/index.js';
import { getSSHSettingsService } from './SSHSettingsService.js';
import { getThumbnailCacheService } from './ThumbnailCacheService.js';

/** Printer identity needed to perform file manager operations. */
export interface FileManagerTarget {
  readonly contextId: string;
  readonly ipAddress: string;
  readonly serialNumber: string;
  readonly printerName: string;
  readonly modelType?: PrinterModelType;
}

/** Per-family filesystem layout on the printer. */
interface FamilyProfile {
  /** Directory holding printable files on internal storage. */
  readonly internalRoot: string;
  /** Printer-side thumbnail cache directories (checked in order). */
  readonly thumbnailDirs: readonly string[];
  /** Base directory USB drives are mounted under. */
  readonly usbBase: string;
}

const FIVE_M_PROFILE: FamilyProfile = {
  internalRoot: '/data',
  thumbnailDirs: ['/data/uploadThumbnail'],
  usbBase: '/mnt/usb',
};

const FAMILY_PROFILES: Partial<Record<PrinterModelType, FamilyProfile>> = {
  ad5x: {
    internalRoot: '/usr/data/gcodes',
    thumbnailDirs: ['/usr/data/gcodes/thum', '/usr/data/gcodes/3mf/thum'],
    usbBase: '/mnt',
  },
  'adventurer-5m': FIVE_M_PROFILE,
  'adventurer-5m-pro': FIVE_M_PROFILE,
};

/** Extensions surfaced in listings (lowercase, with dot). */
const PRINTABLE_EXTENSIONS = new Set(PRINTABLE_FILE_EXTENSIONS);

/** Filesystem types that are never USB drives. */
const NON_USB_FS_TYPES = new Set([
  'proc',
  'sysfs',
  'devtmpfs',
  'devpts',
  'tmpfs',
  'functionfs',
  'cgroup',
  'cgroup2',
  'debugfs',
  'configfs',
  'overlay',
  'squashfs',
  'ramfs',
]);

/** Skip .3mf thumbnail extraction when the embedded PNG is unreasonably large. */
const MAX_EMBEDDED_THUMBNAIL_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Promisified SFTP helpers
// ---------------------------------------------------------------------------

interface SftpDirEntry {
  readonly filename: string;
  readonly longname: string;
  readonly attrs: { readonly size: number; readonly mtime: number };
}

function sftpReaddir(sftp: SFTPWrapper, dir: string): Promise<SftpDirEntry[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(dir, (err, list) => (err ? reject(err) : resolve(list as unknown as SftpDirEntry[])));
  });
}

function sftpReadFile(sftp: SFTPWrapper, path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    sftp.readFile(path, (err: Error | undefined, data: Buffer) => (err ? reject(err) : resolve(data)));
  });
}

function sftpUnlink(sftp: SFTPWrapper, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.unlink(path, (err) => (err ? reject(err) : resolve()));
  });
}

function sftpRename(sftp: SFTPWrapper, oldPath: string, newPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err) => (err ? reject(err) : resolve()));
  });
}

function sftpStatSize(sftp: SFTPWrapper, path: string): Promise<number | null> {
  return new Promise((resolve) => {
    sftp.stat(path, (err, stats) => resolve(err ? null : stats.size));
  });
}

function sftpExists(sftp: SFTPWrapper, path: string): Promise<boolean> {
  return new Promise((resolve) => {
    sftp.stat(path, (err) => resolve(!err));
  });
}

/** Read an exact byte range from a remote file. */
function sftpReadRange(sftp: SFTPWrapper, path: string, start: number, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    sftp.open(path, 'r', (openErr, handle) => {
      if (openErr) {
        reject(openErr);
        return;
      }

      const buffer = Buffer.alloc(length);
      let filled = 0;

      const finish = (error: Error | null): void => {
        sftp.close(handle, () => {
          if (error) {
            reject(error);
          } else {
            resolve(buffer.subarray(0, filled));
          }
        });
      };

      const readChunk = (): void => {
        if (filled >= length) {
          finish(null);
          return;
        }
        sftp.read(handle, buffer, filled, length - filled, start + filled, (readErr, bytesRead) => {
          if (readErr) {
            finish(readErr);
            return;
          }
          if (bytesRead <= 0) {
            finish(null); // EOF
            return;
          }
          filled += bytesRead;
          readChunk();
        });
      };

      readChunk();
    });
  });
}

// ---------------------------------------------------------------------------
// Minimal remote-zip reader (for extracting thumbnails from .3mf archives)
// ---------------------------------------------------------------------------

interface ZipEntry {
  readonly name: string;
  readonly compressionMethod: number;
  readonly compressedSize: number;
  readonly localHeaderOffset: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
/** EOCD record is 22 bytes plus up to 65535 bytes of zip comment. */
const EOCD_SEARCH_SPAN = 22 + 65535;

/** Parse the central directory of a remote zip using ranged reads. */
async function readRemoteZipEntries(sftp: SFTPWrapper, path: string, fileSize: number): Promise<ZipEntry[]> {
  const tailLength = Math.min(fileSize, EOCD_SEARCH_SPAN);
  const tail = await sftpReadRange(sftp, path, fileSize - tailLength, tailLength);

  let eocdOffset = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error('Not a zip archive (no end-of-central-directory record)');
  }

  const centralDirSize = tail.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = tail.readUInt32LE(eocdOffset + 16);
  if (centralDirOffset === 0xffffffff || centralDirSize === 0xffffffff) {
    throw new Error('Zip64 archives are not supported for thumbnail extraction');
  }

  const centralDir = await sftpReadRange(sftp, path, centralDirOffset, centralDirSize);
  const entries: ZipEntry[] = [];
  let cursor = 0;

  while (cursor + 46 <= centralDir.length) {
    if (centralDir.readUInt32LE(cursor) !== CENTRAL_DIR_SIGNATURE) {
      break;
    }
    const compressionMethod = centralDir.readUInt16LE(cursor + 10);
    const compressedSize = centralDir.readUInt32LE(cursor + 20);
    const nameLength = centralDir.readUInt16LE(cursor + 28);
    const extraLength = centralDir.readUInt16LE(cursor + 30);
    const commentLength = centralDir.readUInt16LE(cursor + 32);
    const localHeaderOffset = centralDir.readUInt32LE(cursor + 42);
    const name = centralDir.toString('utf8', cursor + 46, cursor + 46 + nameLength);

    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

/** Promise wrapper around zlib.inflateRaw for non-blocking decompression. */
function inflateRawAsync(buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.inflateRaw(buffer, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

/** Extract and decompress a single entry from a remote zip. */
async function extractRemoteZipEntry(sftp: SFTPWrapper, path: string, entry: ZipEntry): Promise<Buffer> {
  const localHeader = await sftpReadRange(sftp, path, entry.localHeaderOffset, 30);
  if (localHeader.readUInt32LE(0) !== LOCAL_HEADER_SIGNATURE) {
    throw new Error('Corrupt zip local header');
  }
  const nameLength = localHeader.readUInt16LE(26);
  const extraLength = localHeader.readUInt16LE(28);
  const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength;

  const compressed = await sftpReadRange(sftp, path, dataStart, entry.compressedSize);
  if (entry.compressionMethod === 0) {
    return compressed; // stored
  }
  if (entry.compressionMethod === 8) {
    return inflateRawAsync(compressed); // deflate
  }
  throw new Error(`Unsupported zip compression method: ${entry.compressionMethod}`);
}

/** Pick the best thumbnail entry from a .3mf archive (OrcaSlicer layout). */
function pickThumbnailEntry(entries: readonly ZipEntry[]): ZipEntry | null {
  const patterns = [
    /^Metadata\/plate_1_small\.png$/i,
    /^Metadata\/plate_\d+_small\.png$/i,
    /^Metadata\/plate_1\.png$/i,
    /^Metadata\/plate_\d+\.png$/i,
    /^Metadata\/thumbnail\.png$/i,
  ];
  for (const pattern of patterns) {
    const match = entries.find((entry) => pattern.test(entry.name));
    if (match && match.compressedSize <= MAX_EMBEDDED_THUMBNAIL_BYTES) {
      return match;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Path / name helpers
// ---------------------------------------------------------------------------

function baseName(remotePath: string): string {
  const idx = remotePath.lastIndexOf('/');
  return idx >= 0 ? remotePath.slice(idx + 1) : remotePath;
}

function dirName(remotePath: string): string {
  const idx = remotePath.lastIndexOf('/');
  return idx > 0 ? remotePath.slice(0, idx) : '/';
}

function joinRemote(dir: string, name: string): string {
  return dir.endsWith('/') ? `${dir}${name}` : `${dir}/${name}`;
}

function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(idx).toLowerCase() : '';
}

function isPrintableFile(name: string): boolean {
  return PRINTABLE_EXTENSIONS.has(fileExtension(name));
}

/** Strip the final printable extension for thumbnail stem candidates. */
function thumbnailStem(name: string): string {
  return name.replace(/\.(3mf|gcode|gx|g)$/i, '');
}

/** Validate a user-supplied file name (single path segment, no traversal). */
function isSafeFileName(name: string): boolean {
  if (!name || name === '.' || name === '..') return false;
  if (name.length > 200) return false;
  if (name.includes('/') || name.includes('\\')) return false;
  // Disallow control characters
  for (let i = 0; i < name.length; i++) {
    if (name.charCodeAt(i) < 0x20) return false;
  }
  return true;
}

/** Ensure a path is the given root or nested under it. */
function isUnderRoot(path: string, root: string): boolean {
  if (!path.startsWith('/') || path.includes('..')) return false;
  const normalizedRoot = root.endsWith('/') ? root.slice(0, -1) : root;
  return path === normalizedRoot || path.startsWith(`${normalizedRoot}/`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * SFTP-based file management for printers provisioned with flashforge-easyssh.
 */
export class FileManagerService {
  private static instance: FileManagerService | null = null;

  /** Cached SFTP sessions keyed by SSH connection key. */
  private readonly sftpSessions = new Map<string, SFTPWrapper>();

  private constructor() {
    const sshManager = getSSHConnectionManager();
    sshManager.on('connection-closed', (id: string) => {
      if (id.startsWith('file-manager:')) {
        this.sftpSessions.delete(id);
      }
    });
  }

  public static getInstance(): FileManagerService {
    if (!FileManagerService.instance) {
      FileManagerService.instance = new FileManagerService();
    }
    return FileManagerService.instance;
  }

  /** Whether the model family supports SFTP file management. */
  public static isModelSupported(modelType?: PrinterModelType): boolean {
    return !!modelType && !!FAMILY_PROFILES[modelType];
  }

  private getProfile(target: FileManagerTarget): FamilyProfile {
    const profile = target.modelType ? FAMILY_PROFILES[target.modelType] : undefined;
    if (!profile) {
      throw new Error(`File management is not supported for this printer model (${target.modelType ?? 'unknown'})`);
    }
    return profile;
  }

  private connectionKey(target: FileManagerTarget): string {
    return `file-manager:${target.contextId}`;
  }

  /** Ensure an SSH connection exists for the target and return its key. */
  private async ensureConnection(target: FileManagerTarget): Promise<string> {
    const sshManager = getSSHConnectionManager();
    const key = this.connectionKey(target);

    if (sshManager.isConnected(key)) {
      sshManager.touch(key);
      return key;
    }

    this.sftpSessions.delete(key);
    // Credentials come from the centralized per-printer SSH settings store
    const config = await getSSHSettingsService().buildConnectionConfig(target.serialNumber, target.ipAddress);
    await sshManager.connect(key, config);
    return key;
  }

  /** Get (or open) an SFTP session on the pooled SSH connection. */
  private async getSftp(target: FileManagerTarget): Promise<SFTPWrapper> {
    const key = await this.ensureConnection(target);
    const cached = this.sftpSessions.get(key);
    if (cached) {
      return cached;
    }

    const connection = getSSHConnectionManager().getConnection(key);
    if (!connection) {
      throw new Error('SSH connection unavailable');
    }

    const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      connection.client.sftp((err, session) => (err ? reject(err) : resolve(session)));
    });

    sftp.on('close', () => {
      if (this.sftpSessions.get(key) === sftp) {
        this.sftpSessions.delete(key);
      }
    });

    this.sftpSessions.set(key, sftp);
    return sftp;
  }

  /** Run an SFTP operation, retrying once with a fresh connection on failure. */
  private async withSftp<T>(target: FileManagerTarget, operation: (sftp: SFTPWrapper) => Promise<T>): Promise<T> {
    try {
      const sftp = await this.getSftp(target);
      return await operation(sftp);
    } catch (error) {
      // Session may be stale (printer rebooted, connection dropped) - reconnect once
      const key = this.connectionKey(target);
      this.sftpSessions.delete(key);
      await getSSHConnectionManager().disconnect(key);
      const sftp = await this.getSftp(target);
      console.warn(`[FileManager] Retried SFTP operation after error: ${errorMessage(error)}`);
      return await operation(sftp);
    }
  }

  /** Detect USB drive mount points by parsing /proc/mounts. */
  private async detectUsbMounts(target: FileManagerTarget, profile: FamilyProfile): Promise<string[]> {
    const key = await this.ensureConnection(target);
    const result = await getSSHConnectionManager().executeCommand(key, 'cat /proc/mounts');
    if (!result.success) {
      throw new Error(result.error || result.stderr || 'Failed to read /proc/mounts');
    }

    const usbBase = profile.usbBase.endsWith('/') ? profile.usbBase.slice(0, -1) : profile.usbBase;
    const mounts: string[] = [];

    for (const line of result.stdout.split('\n')) {
      const fields = line.trim().split(/\s+/);
      if (fields.length < 3) continue;
      // /proc/mounts escapes spaces in mount points as \040
      const mountPoint = fields[1].replace(/\\040/g, ' ').replace(/\\011/g, '\t');
      const fsType = fields[2];
      if (NON_USB_FS_TYPES.has(fsType)) continue;
      if (mountPoint === usbBase || mountPoint.startsWith(`${usbBase}/`)) {
        mounts.push(mountPoint);
      }
    }

    // De-duplicate while preserving order (bind mounts can repeat)
    return Array.from(new Set(mounts));
  }

  /**
   * Probe printer support and USB presence.
   */
  public async getCapabilities(target: FileManagerTarget): Promise<FileManagerCapabilities> {
    if (!FileManagerService.isModelSupported(target.modelType)) {
      return {
        supported: false,
        reason:
          'File management requires SSH/SFTP access, which is available on AD5X and Adventurer 5M series printers provisioned with the FlashForge easy-SSH setup.',
        printerName: target.printerName,
        usbPresent: false,
        usbMounts: [],
      };
    }

    const profile = this.getProfile(target);
    try {
      const usbMounts = await this.detectUsbMounts(target, profile);
      return {
        supported: true,
        printerName: target.printerName,
        usbPresent: usbMounts.length > 0,
        usbMounts,
      };
    } catch (error) {
      return {
        supported: true,
        printerName: target.printerName,
        usbPresent: false,
        usbMounts: [],
        error: `Could not reach the printer over SSH: ${errorMessage(error)}`,
      };
    }
  }

  /**
   * List printable files (and, on USB, directories) at a storage location.
   *
   * @param path - Absolute directory to list. Empty string means the storage
   *               root (internal root, the sole USB mount, or a synthetic
   *               listing of mounts when several USB drives are present).
   */
  public async listFiles(
    target: FileManagerTarget,
    storage: FileManagerStorageKind,
    path: string
  ): Promise<FileManagerListing> {
    try {
      const profile = this.getProfile(target);

      if (storage === 'internal') {
        const root = profile.internalRoot;
        const entries = await this.withSftp(target, async (sftp) => {
          const list = await sftpReaddir(sftp, root);
          return list
            .filter((entry) => !entry.longname.startsWith('d') && isPrintableFile(entry.filename))
            .map(
              (entry): PrinterFileEntry => ({
                name: entry.filename,
                path: joinRemote(root, entry.filename),
                size: entry.attrs.size,
                modifiedAt: entry.attrs.mtime,
                isDirectory: false,
              })
            );
        });
        return { success: true, storage, path: root, rootPath: root, entries: sortEntries(entries) };
      }

      // USB storage
      const usbMounts = await this.detectUsbMounts(target, profile);
      if (usbMounts.length === 0) {
        return { success: false, storage, path: '', rootPath: '', entries: [], error: 'No USB drive detected' };
      }

      // Multiple drives with no explicit path: synthesize a root listing of mounts
      if (!path && usbMounts.length > 1) {
        const entries = usbMounts.map(
          (mount): PrinterFileEntry => ({
            name: baseName(mount) || mount,
            path: mount,
            size: 0,
            modifiedAt: 0,
            isDirectory: true,
          })
        );
        return { success: true, storage, path: '', rootPath: '', entries };
      }

      const listDir = path || usbMounts[0];
      const withinMount = usbMounts.some((mount) => isUnderRoot(listDir, mount));
      if (!withinMount) {
        return { success: false, storage, path: listDir, rootPath: '', entries: [], error: 'Invalid USB path' };
      }
      const rootPath = usbMounts.length > 1 ? '' : usbMounts[0];

      const entries = await this.withSftp(target, async (sftp) => {
        const list = await sftpReaddir(sftp, listDir);
        return list
          .filter((entry) => {
            if (entry.filename.startsWith('.')) return false;
            const isDir = entry.longname.startsWith('d');
            return isDir || isPrintableFile(entry.filename);
          })
          .map(
            (entry): PrinterFileEntry => ({
              name: entry.filename,
              path: joinRemote(listDir, entry.filename),
              size: entry.attrs.size,
              modifiedAt: entry.attrs.mtime,
              isDirectory: entry.longname.startsWith('d'),
            })
          );
      });

      return { success: true, storage, path: listDir, rootPath, entries: sortEntries(entries) };
    } catch (error) {
      return { success: false, storage, path, rootPath: '', entries: [], error: errorMessage(error) };
    }
  }

  /**
   * Delete one or more files. For internal storage the printer-side sidecar
   * thumbnails are removed too, and the local thumbnail cache is invalidated.
   */
  public async deleteFiles(
    target: FileManagerTarget,
    storage: FileManagerStorageKind,
    paths: readonly string[]
  ): Promise<FileManagerDeleteResult> {
    try {
      const profile = this.getProfile(target);
      const outcomes: FileManagerDeleteOutcome[] = [];

      await this.withSftp(target, async (sftp) => {
        for (const path of paths) {
          const validationError = await this.validateMutationPath(target, profile, storage, path);
          if (validationError) {
            outcomes.push({ path, success: false, error: validationError });
            continue;
          }

          try {
            await sftpUnlink(sftp, path);
            if (storage === 'internal') {
              await this.deleteSidecarThumbnails(sftp, profile, baseName(path));
            }
            await getThumbnailCacheService().invalidate(target.serialNumber, baseName(path));
            outcomes.push({ path, success: true });
          } catch (error) {
            outcomes.push({ path, success: false, error: errorMessage(error) });
          }
        }
      });

      return { success: outcomes.every((outcome) => outcome.success), outcomes };
    } catch (error) {
      return { success: false, outcomes: [], error: errorMessage(error) };
    }
  }

  /**
   * Rename a file in place (same directory, same extension). Printer-side
   * sidecar thumbnails follow the rename and the local cache entry is migrated.
   */
  public async renameFile(
    target: FileManagerTarget,
    storage: FileManagerStorageKind,
    path: string,
    newName: string
  ): Promise<FileManagerRenameResult> {
    try {
      const profile = this.getProfile(target);

      const validationError = await this.validateMutationPath(target, profile, storage, path);
      if (validationError) {
        return { success: false, error: validationError };
      }
      if (!isSafeFileName(newName)) {
        return { success: false, error: 'Invalid file name' };
      }

      const oldName = baseName(path);
      if (fileExtension(newName) !== fileExtension(oldName)) {
        return { success: false, error: `File extension must remain ${fileExtension(oldName)}` };
      }
      if (newName === oldName) {
        return { success: true, newPath: path };
      }

      const newPath = joinRemote(dirName(path), newName);

      return await this.withSftp(target, async (sftp) => {
        if (await sftpExists(sftp, newPath)) {
          return { success: false, error: 'A file with that name already exists' };
        }

        await sftpRename(sftp, path, newPath);

        if (storage === 'internal') {
          await this.renameSidecarThumbnails(sftp, profile, oldName, newName);
        }

        // Migrate the local thumbnail cache entry to the new name
        const cache = getThumbnailCacheService();
        const cached = await cache.get(target.serialNumber, oldName);
        if (cached.success && cached.data) {
          await cache.set(target.serialNumber, newName, cached.data);
        }
        await cache.invalidate(target.serialNumber, oldName);

        return { success: true, newPath };
      });
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  }

  /**
   * Fetch a thumbnail for a file: local cache -> printer thumbnail cache dirs
   * -> embedded .3mf archive extraction. Successful fetches are cached locally.
   */
  public async getThumbnail(
    target: FileManagerTarget,
    storage: FileManagerStorageKind,
    path: string
  ): Promise<FileManagerThumbnailResult> {
    const name = baseName(path);

    try {
      const cache = getThumbnailCacheService();
      const cached = await cache.get(target.serialNumber, name);
      if (cached.success && cached.data) {
        return { success: true, thumbnail: cached.data };
      }

      const profile = this.getProfile(target);

      const thumbnail = await this.withSftp(target, async (sftp) => {
        // 1) Printer-side thumbnail cache (internal storage files only)
        if (storage === 'internal') {
          const stems = [thumbnailStem(name), name];
          for (const dir of profile.thumbnailDirs) {
            for (const stem of stems) {
              try {
                const data = await sftpReadFile(sftp, joinRemote(dir, `${stem}.png`));
                if (data.length > 0) {
                  return data;
                }
              } catch {
                // Candidate missing - try the next one
              }
            }
          }
        }

        // 2) Embedded thumbnail inside the .3mf archive (ranged reads)
        if (fileExtension(name) === '.3mf') {
          const size = await sftpStatSize(sftp, path);
          if (size && size > 0) {
            const entries = await readRemoteZipEntries(sftp, path, size);
            const entry = pickThumbnailEntry(entries);
            if (entry) {
              return await extractRemoteZipEntry(sftp, path, entry);
            }
          }
        }

        return null;
      });

      if (!thumbnail) {
        return { success: false, error: 'No thumbnail available' };
      }

      const base64 = thumbnail.toString('base64');
      await cache.set(target.serialNumber, name, base64);
      return { success: true, thumbnail: base64 };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  }

  /** Close the pooled connection for a context (called on context removal). */
  public async disconnect(contextId: string): Promise<void> {
    const key = `file-manager:${contextId}`;
    this.sftpSessions.delete(key);
    await getSSHConnectionManager().disconnect(key);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /** Validate that a mutation path is a safe file path inside the storage root. */
  private async validateMutationPath(
    target: FileManagerTarget,
    profile: FamilyProfile,
    storage: FileManagerStorageKind,
    path: string
  ): Promise<string | null> {
    if (!isSafeFileName(baseName(path))) {
      return 'Invalid file path';
    }

    if (storage === 'internal') {
      if (!isUnderRoot(path, profile.internalRoot) || dirName(path) !== profile.internalRoot) {
        return 'Path is outside the printer file directory';
      }
      return null;
    }

    const usbMounts = await this.detectUsbMounts(target, profile);
    if (!usbMounts.some((mount) => isUnderRoot(path, mount))) {
      return 'Path is outside the USB drive';
    }
    return null;
  }

  /** Remove printer-side sidecar thumbnail PNGs for a deleted file. */
  private async deleteSidecarThumbnails(sftp: SFTPWrapper, profile: FamilyProfile, name: string): Promise<void> {
    const stems = new Set([thumbnailStem(name), name]);
    for (const dir of profile.thumbnailDirs) {
      for (const stem of stems) {
        try {
          await sftpUnlink(sftp, joinRemote(dir, `${stem}.png`));
        } catch {
          // Sidecar not present - fine
        }
      }
    }
  }

  /** Rename printer-side sidecar thumbnail PNGs to follow a file rename. */
  private async renameSidecarThumbnails(
    sftp: SFTPWrapper,
    profile: FamilyProfile,
    oldName: string,
    newName: string
  ): Promise<void> {
    const oldStems = [thumbnailStem(oldName), oldName];
    const newStems = [thumbnailStem(newName), newName];

    for (const dir of profile.thumbnailDirs) {
      for (let i = 0; i < oldStems.length; i++) {
        const oldPng = joinRemote(dir, `${oldStems[i]}.png`);
        const newPng = joinRemote(dir, `${newStems[i]}.png`);
        try {
          if ((await sftpExists(sftp, oldPng)) && !(await sftpExists(sftp, newPng))) {
            await sftpRename(sftp, oldPng, newPng);
          }
        } catch {
          // Best effort - the printer regenerates thumbnails on rescan
        }
      }
    }
  }
}

/** Sort listings: directories first, then case-insensitive by name. */
function sortEntries(entries: PrinterFileEntry[]): PrinterFileEntry[] {
  return entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/**
 * Get the FileManagerService singleton.
 */
export function getFileManagerService(): FileManagerService {
  return FileManagerService.getInstance();
}
