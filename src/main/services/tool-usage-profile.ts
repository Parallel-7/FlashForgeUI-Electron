/**
 * @fileoverview Per-tool filament usage profile for a sliced 3MF.
 *
 * The printer reports print progress as the byte position of its gcode reader
 * divided by the gcode file size (Klipper `virtual_sdcard.progress`). The 3MF
 * carries that same gcode as `Metadata/plate_N.gcode`, so the gcode can be read
 * once at upload time to find how much of each tool's filament has been used at
 * any byte position. A cancelled print can then be charged per tool from the
 * last progress value: a tool that only prints the top half of the model is
 * charged nothing if the print stops at 40%.
 *
 * The profile stores, for each tool, the fraction of that tool's total
 * extrusion completed at evenly spaced byte positions. Absolute amounts come
 * from the slicer's per-filament estimates, so no filament density is needed.
 *
 * The 3MF is read with a small ZIP reader on top of `zlib`, and the gcode is
 * streamed, so a large file never needs to fit in memory at once.
 */

import * as fs from 'node:fs';
import * as zlib from 'node:zlib';
import type { ToolUsageProfile } from '@shared/types/spoolman-tracking';

/** Number of byte intervals in a profile. Each sample covers 0.5% of the gcode. */
export const PROFILE_SAMPLE_COUNT = 200;

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const ZIP64_EXTRA_ID = 0x0001;
const UINT32_MAX = 0xffffffff;
const UINT16_MAX = 0xffff;

/** A file entry found in the ZIP central directory. */
interface ZipEntry {
  readonly name: string;
  readonly method: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localHeaderOffset: number;
}

function readAt(fd: number, position: number, length: number): Buffer {
  const buffer = Buffer.alloc(length);
  const read = fs.readSync(fd, buffer, 0, length, position);
  return read === length ? buffer : buffer.subarray(0, read);
}

/** Find the end-of-central-directory record in the last 64 KiB of the file. */
function findEndOfCentralDirectory(fd: number, fileSize: number): { offset: number; record: Buffer } {
  const tailLength = Math.min(fileSize, 22 + UINT16_MAX);
  const tailStart = fileSize - tailLength;
  const tail = readAt(fd, tailStart, tailLength);
  for (let index = tail.length - 22; index >= 0; index--) {
    if (tail.readUInt32LE(index) === EOCD_SIGNATURE) {
      return { offset: tailStart + index, record: tail.subarray(index) };
    }
  }
  throw new Error('Not a ZIP file (no end of central directory record)');
}

/** Read the central directory and return every entry. */
function readZipEntries(fd: number, fileSize: number): ZipEntry[] {
  const { offset: eocdOffset, record } = findEndOfCentralDirectory(fd, fileSize);
  let entryCount = record.readUInt16LE(10);
  let directorySize = record.readUInt32LE(12);
  let directoryOffset = record.readUInt32LE(16);

  if (entryCount === UINT16_MAX || directorySize === UINT32_MAX || directoryOffset === UINT32_MAX) {
    const locator = readAt(fd, eocdOffset - 20, 20);
    if (locator.length === 20 && locator.readUInt32LE(0) === ZIP64_EOCD_LOCATOR_SIGNATURE) {
      const zip64Offset = Number(locator.readBigUInt64LE(8));
      const zip64 = readAt(fd, zip64Offset, 56);
      if (zip64.readUInt32LE(0) !== ZIP64_EOCD_SIGNATURE) {
        throw new Error('Corrupt ZIP64 end of central directory record');
      }
      entryCount = Number(zip64.readBigUInt64LE(32));
      directorySize = Number(zip64.readBigUInt64LE(40));
      directoryOffset = Number(zip64.readBigUInt64LE(48));
    }
  }

  const directory = readAt(fd, directoryOffset, directorySize);
  const entries: ZipEntry[] = [];
  let position = 0;
  for (let index = 0; index < entryCount && position + 46 <= directory.length; index++) {
    if (directory.readUInt32LE(position) !== CENTRAL_HEADER_SIGNATURE) {
      throw new Error('Corrupt ZIP central directory');
    }
    const method = directory.readUInt16LE(position + 10);
    let compressedSize = directory.readUInt32LE(position + 20);
    let uncompressedSize = directory.readUInt32LE(position + 24);
    const nameLength = directory.readUInt16LE(position + 28);
    const extraLength = directory.readUInt16LE(position + 30);
    const commentLength = directory.readUInt16LE(position + 32);
    let localHeaderOffset = directory.readUInt32LE(position + 42);
    const name = directory.toString('utf8', position + 46, position + 46 + nameLength);

    // ZIP64 extra field: the 64-bit values appear only for fields set to 0xFFFFFFFF.
    let extraPosition = position + 46 + nameLength;
    const extraEnd = extraPosition + extraLength;
    while (extraPosition + 4 <= extraEnd) {
      const headerId = directory.readUInt16LE(extraPosition);
      const dataSize = directory.readUInt16LE(extraPosition + 2);
      if (headerId === ZIP64_EXTRA_ID) {
        let field = extraPosition + 4;
        if (uncompressedSize === UINT32_MAX) {
          uncompressedSize = Number(directory.readBigUInt64LE(field));
          field += 8;
        }
        if (compressedSize === UINT32_MAX) {
          compressedSize = Number(directory.readBigUInt64LE(field));
          field += 8;
        }
        if (localHeaderOffset === UINT32_MAX) {
          localHeaderOffset = Number(directory.readBigUInt64LE(field));
        }
      }
      extraPosition += 4 + dataSize;
    }

    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    position += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Open a readable stream of one entry's uncompressed data. */
function openEntryStream(filePath: string, fd: number, entry: ZipEntry): NodeJS.ReadableStream {
  const header = readAt(fd, entry.localHeaderOffset, 30);
  if (header.length < 30 || header.readUInt32LE(0) !== LOCAL_HEADER_SIGNATURE) {
    throw new Error(`Corrupt ZIP local header for ${entry.name}`);
  }
  const dataStart = entry.localHeaderOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  const raw = fs.createReadStream(filePath, {
    start: dataStart,
    end: Math.max(dataStart, dataStart + entry.compressedSize - 1),
  });
  if (entry.method === 0) {
    return raw;
  }
  if (entry.method === 8) {
    return raw.pipe(zlib.createInflateRaw());
  }
  throw new Error(`Unsupported ZIP compression method ${entry.method} for ${entry.name}`);
}

/**
 * Stateful gcode reader that sums net extrusion per tool and records the
 * running totals at evenly spaced byte positions.
 */
export class ToolExtrusionAccumulator {
  private readonly totalBytes: number;
  private readonly sampleCount: number;
  private readonly totals = new Map<number, number>();
  private readonly samples: Array<Map<number, number>> = [];
  private currentTool: number;
  private absoluteExtrusion = false;
  private lastAbsoluteE = 0;
  private bytesSeen = 0;
  private nextSample = 1;
  private pendingLine = '';

  /**
   * @param totalBytes - Size of the gcode in bytes
   * @param initialTool - Tool that extrudes before the first tool change
   * @param sampleCount - Number of byte intervals in the profile
   */
  constructor(totalBytes: number, initialTool: number, sampleCount: number = PROFILE_SAMPLE_COUNT) {
    this.totalBytes = Math.max(1, totalBytes);
    this.currentTool = initialTool;
    this.sampleCount = sampleCount;
    this.samples.push(new Map());
  }

  /** Feed the next chunk of gcode bytes. */
  public push(chunk: Buffer): void {
    let start = 0;
    for (let index = 0; index < chunk.length; index++) {
      if (chunk[index] !== 0x0a) {
        continue;
      }
      const piece = chunk.toString('latin1', start, index);
      this.bytesSeen += index + 1 - start;
      start = index + 1;
      this.processLine(this.pendingLine + piece);
      this.pendingLine = '';
      this.recordSamples();
    }
    if (start < chunk.length) {
      this.pendingLine += chunk.toString('latin1', start);
      this.bytesSeen += chunk.length - start;
    }
  }

  /** Finish the stream and return the profile. */
  public finish(): ToolUsageProfile {
    if (this.pendingLine.length > 0) {
      this.processLine(this.pendingLine);
      this.pendingLine = '';
    }
    this.bytesSeen = this.totalBytes;
    this.recordSamples();

    const perTool: Record<string, number[]> = {};
    for (const [toolId, total] of this.totals) {
      if (!(total > 0)) {
        continue;
      }
      perTool[String(toolId)] = this.samples.map((sample) => {
        const value = (sample.get(toolId) ?? 0) / total;
        return Math.round(Math.min(1, Math.max(0, value)) * 1e6) / 1e6;
      });
    }
    return { sampleCount: this.sampleCount, perTool };
  }

  private recordSamples(): void {
    while (
      this.nextSample <= this.sampleCount &&
      this.bytesSeen >= (this.totalBytes * this.nextSample) / this.sampleCount
    ) {
      this.samples.push(new Map(this.totals));
      this.nextSample++;
    }
  }

  private processLine(rawLine: string): void {
    const commentIndex = rawLine.indexOf(';');
    const line = (commentIndex >= 0 ? rawLine.slice(0, commentIndex) : rawLine).trim();
    if (line.length === 0) {
      return;
    }

    const first = line.charCodeAt(0) | 0x20;
    if (first === 0x74 /* t */) {
      const match = /^[Tt](\d+)\s*$/.exec(line);
      if (match) {
        this.currentTool = Number.parseInt(match[1], 10);
      }
      return;
    }
    if (first !== 0x67 /* g */ && first !== 0x6d /* m */) {
      return;
    }

    const command = line.split(/\s+/, 1)[0].toUpperCase();
    switch (command) {
      case 'M82':
        this.absoluteExtrusion = true;
        return;
      case 'M83':
        this.absoluteExtrusion = false;
        return;
      case 'G92': {
        const e = readParameter(line, 'E');
        if (e !== null) {
          this.lastAbsoluteE = e;
        }
        return;
      }
      case 'G0':
      case 'G1':
      case 'G2':
      case 'G3': {
        const e = readParameter(line, 'E');
        if (e === null) {
          return;
        }
        const delta = this.absoluteExtrusion ? e - this.lastAbsoluteE : e;
        if (this.absoluteExtrusion) {
          this.lastAbsoluteE = e;
        }
        if (delta !== 0 && Number.isFinite(delta)) {
          const next = (this.totals.get(this.currentTool) ?? 0) + delta;
          this.totals.set(this.currentTool, Math.max(0, next));
        }
        return;
      }
      default:
        return;
    }
  }
}

const PARAMETER_PATTERNS: Record<string, RegExp> = {
  E: /(?:^|\s)E(-?\d*\.?\d+)/i,
};

function readParameter(line: string, letter: 'E'): number | null {
  const match = PARAMETER_PATTERNS[letter].exec(line);
  if (!match) {
    return null;
  }
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

/**
 * Build the per-tool usage profile for a sliced 3MF.
 *
 * @param filePath - Path to the 3MF file
 * @param initialTool - Tool that extrudes before the first tool change
 *   (normally the lowest tool the plate uses)
 * @returns The profile, or null when the file has no embedded gcode or no
 *   extrusion could be attributed to any tool
 */
export async function buildToolUsageProfile(
  filePath: string,
  initialTool: number
): Promise<ToolUsageProfile | null> {
  const fd = fs.openSync(filePath, 'r');
  let stream: NodeJS.ReadableStream;
  let entry: ZipEntry | undefined;
  try {
    const { size } = fs.fstatSync(fd);
    entry = readZipEntries(fd, size)
      .filter((candidate) => /^Metadata\/plate_\d+\.gcode$/.test(candidate.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))[0];
    if (!entry) {
      return null;
    }
    stream = openEntryStream(filePath, fd, entry);
  } finally {
    fs.closeSync(fd);
  }

  const accumulator = new ToolExtrusionAccumulator(entry.uncompressedSize, initialTool);
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => accumulator.push(chunk));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });

  const profile = accumulator.finish();
  return Object.keys(profile.perTool).length > 0 ? profile : null;
}

/**
 * Fraction (0-1) of a tool's filament used at a given print progress.
 *
 * @param profile - Usage profile, or null when none was built
 * @param toolId - Tool to look up
 * @param progressPercent - Printer-reported progress, 0-100
 * @returns The interpolated fraction; the plain progress fraction when the
 *   profile has no curve for the tool
 */
export function usedFractionAt(
  profile: ToolUsageProfile | null | undefined,
  toolId: number,
  progressPercent: number
): number {
  const progress = Math.min(1, Math.max(0, progressPercent / 100));
  const curve = profile?.perTool[String(toolId)];
  if (!profile || !curve || curve.length !== profile.sampleCount + 1) {
    return progress;
  }
  const position = progress * profile.sampleCount;
  const lower = Math.floor(position);
  if (lower >= profile.sampleCount) {
    return curve[profile.sampleCount];
  }
  const weight = position - lower;
  return curve[lower] + (curve[lower + 1] - curve[lower]) * weight;
}
