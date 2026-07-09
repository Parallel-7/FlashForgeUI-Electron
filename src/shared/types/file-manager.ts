/**
 * @fileoverview Shared type definitions for the SFTP-based printer file manager.
 *
 * Describes the IPC payloads exchanged between the file manager dialog renderer,
 * its preload bridge, and the main-process FileManagerService. Covers storage
 * targets (internal flash vs plugged-in USB drives), directory listings, file
 * entries, capability probing, and mutation results for delete/rename flows.
 *
 * Key exports:
 * - FileManagerStorageKind: 'internal' | 'usb' storage discriminator
 * - PrinterFileEntry / FileManagerListing: listing payloads
 * - FileManagerCapabilities: per-printer support + USB presence probe result
 * - FileManagerDeleteResult / FileManagerRenameResult: mutation outcomes
 */

/** Storage target on the printer. */
export type FileManagerStorageKind = 'internal' | 'usb';

/** Printable file extensions surfaced by the file manager. */
export const PRINTABLE_FILE_EXTENSIONS = ['.3mf', '.gcode', '.gx', '.g'] as const;

/** A single file or directory entry in a listing. */
export interface PrinterFileEntry {
  /** Base name including extension (display name). */
  readonly name: string;
  /** Absolute path on the printer filesystem. */
  readonly path: string;
  /** File size in bytes (0 for directories). */
  readonly size: number;
  /** Modification time as unix seconds (0 when unknown). */
  readonly modifiedAt: number;
  /** Whether the entry is a directory (USB navigation only). */
  readonly isDirectory: boolean;
}

/** Result of listing a storage location. */
export interface FileManagerListing {
  readonly success: boolean;
  readonly storage: FileManagerStorageKind;
  /** Absolute directory that was listed. Empty string for the synthetic USB mount root. */
  readonly path: string;
  /** Root directory of the current storage (navigation must stay under this). */
  readonly rootPath: string;
  readonly entries: readonly PrinterFileEntry[];
  readonly error?: string;
}

/** Per-printer file manager capabilities and USB probe result. */
export interface FileManagerCapabilities {
  /** Whether the connected printer model supports SFTP file management. */
  readonly supported: boolean;
  /** Human-readable reason when unsupported. */
  readonly reason?: string;
  /** Printer display name (for the dialog title). */
  readonly printerName?: string;
  /** Whether at least one USB drive is currently mounted. */
  readonly usbPresent: boolean;
  /** Absolute mount points of detected USB drives. */
  readonly usbMounts: readonly string[];
  /** Error message when the SSH/SFTP probe itself failed. */
  readonly error?: string;
}

/** Outcome for a single file within a batch delete. */
export interface FileManagerDeleteOutcome {
  readonly path: string;
  readonly success: boolean;
  readonly error?: string;
}

/** Result of a (batch) delete operation. */
export interface FileManagerDeleteResult {
  readonly success: boolean;
  readonly outcomes: readonly FileManagerDeleteOutcome[];
  readonly error?: string;
}

/** Result of a rename operation. */
export interface FileManagerRenameResult {
  readonly success: boolean;
  /** New absolute path after a successful rename. */
  readonly newPath?: string;
  readonly error?: string;
}

/** Result of a thumbnail fetch. */
export interface FileManagerThumbnailResult {
  readonly success: boolean;
  /** Base64-encoded PNG (no data-URL prefix) when available. */
  readonly thumbnail?: string;
  readonly error?: string;
}
