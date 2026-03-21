/**
 * @fileoverview SCP file transfer for printer configuration and calibration files.
 * Provides download and upload functionality using the SCP protocol over SSH exec channels.
 *
 * @module main/services/calibration/ssh/SCPFileTransfer
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { TransferProgress, TransferResult } from '../../../../shared/types/calibration';
import type { SSHConnectionManager } from './SSHConnectionManager';

const SCP_ACK = Buffer.from([0]);
const SCP_CHUNK_SIZE = 16 * 1024;

interface SCPFileHeader {
  mode: string;
  size: number;
  filename: string;
}

interface SCPChannel {
  write(data: string | Buffer): boolean;
  end(): void;
  on(event: 'data', listener: (chunk: Buffer | string) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'close', listener: (code?: number | null) => void): this;
  once(event: 'drain', listener: () => void): this;
  once(event: 'error', listener: (err: Error) => void): this;
  once(event: 'close', listener: (code?: number | null) => void): this;
  off(event: 'drain', listener: () => void): this;
  off(event: 'error', listener: (err: Error) => void): this;
  off(event: 'close', listener: () => void): this;
  stderr?: {
    on(event: 'data', listener: (chunk: Buffer | string) => void): void;
  };
}

interface SCPChannelState {
  buffer: Buffer;
  ended: boolean;
  error: Error | null;
  stderr: string;
  waiters: Array<() => void>;
  closePromise: Promise<void>;
}

/**
 * Default remote paths for FlashForge printers.
 * Based on Stone-Time SSH method and Klipper configuration.
 */
export const DEFAULT_REMOTE_PATHS = {
  /** Primary printer configuration file path used by Flashforge Calibration Assistant v2 */
  printerConfig: '/opt/config/printer.cfg',
  /** Alternative printer config location */
  printerConfigAlt: '/root/printer_data/config/printer.cfg',
  /** Additional known printer config location */
  printerConfigAlt2: '/usr/data/config/printer.cfg',
  /** Legacy Klipper location observed on some setups */
  printerConfigLegacy: '/home/klipper/printer_data/config/printer.cfg',
  /** Input shaper X-axis calibration data */
  shaperX: '/tmp/calibration_data_x_*.csv',
  /** Input shaper Y-axis calibration data */
  shaperY: '/tmp/calibration_data_y_*.csv',
  /** Resonance test results directory */
  resonanceDir: '/tmp/resonances/',
};

/**
 * File transfer service using SCP over SSH.
 */
export class SCPFileTransfer {
  /** SSH connection manager reference */
  private readonly connectionManager: SSHConnectionManager;

  /** Local cache directory for downloaded files */
  private readonly cacheDir: string;

  constructor(connectionManager: SSHConnectionManager) {
    this.connectionManager = connectionManager;
    this.cacheDir = path.join(app.getPath('userData'), 'calibration', 'cache');
  }

  /**
   * Ensure cache directory exists.
   */
  private async ensureCacheDir(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  /**
   * Build ordered candidate paths for printer.cfg.
   * Custom path is always tried first when provided.
   */
  private getPrinterConfigCandidates(preferredPath?: string): string[] {
    const ordered = [
      preferredPath?.trim() || '',
      DEFAULT_REMOTE_PATHS.printerConfig,
      DEFAULT_REMOTE_PATHS.printerConfigAlt,
      DEFAULT_REMOTE_PATHS.printerConfigAlt2,
      DEFAULT_REMOTE_PATHS.printerConfigLegacy,
    ];

    const seen = new Set<string>();
    const result: string[] = [];
    for (const candidate of ordered) {
      if (!candidate || seen.has(candidate)) {
        continue;
      }
      seen.add(candidate);
      result.push(candidate);
    }
    return result;
  }

  /**
   * Shell-quote a string for safe usage in remote commands.
   */
  private shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'"'"'`)}'`;
  }

  /**
   * Open an exec channel and initialize SCP stream state.
   */
  private async openScpChannel(
    contextId: string,
    command: string
  ): Promise<{ stream: SCPChannel; state: SCPChannelState }> {
    const connection = this.connectionManager.getConnection(contextId);

    if (!connection) {
      throw new Error('Not connected');
    }

    if (connection.status !== 'connected') {
      throw new Error(`Connection status: ${connection.status}`);
    }

    this.connectionManager.touch(contextId);

    const stream = await new Promise<SCPChannel>((resolve, reject) => {
      connection.client.exec(command, (err, channel) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(channel as SCPChannel);
      });
    });

    const state: SCPChannelState = {
      buffer: Buffer.alloc(0),
      ended: false,
      error: null,
      stderr: '',
      waiters: [],
      closePromise: Promise.resolve(),
    };

    const notify = (): void => {
      const pending = state.waiters.splice(0, state.waiters.length);
      for (const resolve of pending) {
        resolve();
      }
    };

    state.closePromise = new Promise<void>((resolve, reject) => {
      stream.once('close', (code: number | null | undefined) => {
        state.ended = true;
        notify();

        if (code === 0 || code == null) {
          resolve();
          return;
        }

        const stderrText = state.stderr.trim();
        if (stderrText.length > 0) {
          reject(new Error(`Received exit code ${code} while executing SCP command: ${stderrText}`));
        } else {
          reject(new Error(`Received exit code ${code} while executing SCP command`));
        }
      });

      stream.once('error', (err: Error) => {
        state.error = err;
        notify();
        reject(err);
      });
    });

    stream.on('data', (chunk: Buffer | string) => {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      state.buffer = state.buffer.length === 0 ? data : Buffer.concat([state.buffer, data]);
      notify();
    });

    if (stream.stderr && typeof stream.stderr.on === 'function') {
      stream.stderr.on('data', (chunk: Buffer | string) => {
        state.stderr += Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : chunk;
      });
    }

    stream.on('error', (err: Error) => {
      state.error = err;
      notify();
    });

    stream.on('end', () => {
      state.ended = true;
      notify();
    });

    return { stream, state };
  }

  /**
   * Wait until new channel data or state is available.
   */
  private waitForStateChange(state: SCPChannelState): Promise<void> {
    return new Promise((resolve) => {
      state.waiters.push(resolve);
    });
  }

  /**
   * Build a consistent unexpected EOF error message.
   */
  private unexpectedEOF(state: SCPChannelState, operation: string): Error {
    const stderrText = state.stderr.trim();
    if (stderrText.length > 0) {
      return new Error(`Unexpected end of SCP stream while ${operation}: ${stderrText}`);
    }
    return new Error(`Unexpected end of SCP stream while ${operation}`);
  }

  /**
   * Read a single byte from the SCP channel state buffer.
   */
  private async readByte(state: SCPChannelState): Promise<number> {
    while (state.buffer.length === 0) {
      if (state.error) {
        throw state.error;
      }

      if (state.ended) {
        throw this.unexpectedEOF(state, 'reading control byte');
      }

      await this.waitForStateChange(state);
    }

    const byte = state.buffer[0];
    state.buffer = state.buffer.subarray(1);
    return byte;
  }

  /**
   * Read a newline-terminated control line from the SCP stream.
   */
  private async readLine(state: SCPChannelState): Promise<string> {
    while (true) {
      if (state.error) {
        throw state.error;
      }

      const newlineIndex = state.buffer.indexOf(0x0a);
      if (newlineIndex >= 0) {
        const lineBuffer = state.buffer.subarray(0, newlineIndex);
        state.buffer = state.buffer.subarray(newlineIndex + 1);
        return lineBuffer.toString('utf-8').replace(/\r$/, '');
      }

      if (state.ended) {
        throw this.unexpectedEOF(state, 'reading control line');
      }

      await this.waitForStateChange(state);
    }
  }

  /**
   * Read a fixed number of bytes from the SCP stream.
   */
  private async readExact(state: SCPChannelState, length: number, onChunk?: (chunk: Buffer) => void): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let remaining = length;

    while (remaining > 0) {
      if (state.error) {
        throw state.error;
      }

      if (state.buffer.length === 0) {
        if (state.ended) {
          throw this.unexpectedEOF(state, `reading ${length} bytes of file data`);
        }

        await this.waitForStateChange(state);
        continue;
      }

      const take = Math.min(remaining, state.buffer.length);
      const chunk = Buffer.from(state.buffer.subarray(0, take));
      state.buffer = state.buffer.subarray(take);
      remaining -= take;

      if (onChunk) {
        onChunk(chunk);
      } else {
        chunks.push(chunk);
      }
    }

    if (onChunk) {
      return Buffer.alloc(0);
    }

    return Buffer.concat(chunks, length);
  }

  /**
   * Read and validate an SCP ACK/error response.
   */
  private async readAck(state: SCPChannelState): Promise<void> {
    const response = await this.readByte(state);

    if (response === 0) {
      return;
    }

    if (response === 1 || response === 2) {
      const message = (await this.readLine(state)).trim();
      throw new Error(message || (response === 1 ? 'SCP error' : 'SCP fatal error'));
    }

    throw new Error(`Unexpected SCP response byte: ${response}`);
  }

  /**
   * Parse an SCP file header line (without leading "C").
   */
  private parseFileHeader(line: string): SCPFileHeader {
    const match = line.match(/^([0-7]{4})\s+(\d+)\s+(.+)$/);
    if (!match) {
      throw new Error(`Invalid SCP file header: ${line}`);
    }

    const size = Number.parseInt(match[2], 10);
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(`Invalid SCP file size in header: ${line}`);
    }

    return {
      mode: match[1],
      size,
      filename: match[3],
    };
  }

  /**
   * Read the next file header from an SCP download stream.
   * Handles optional timestamp records and end markers.
   */
  private async readNextFileHeader(state: SCPChannelState, stream: SCPChannel): Promise<SCPFileHeader | null> {
    while (true) {
      const control = await this.readByte(state);

      // Timestamp record (T<mtime> 0 <atime> 0)
      if (control === 0x54) {
        await this.readLine(state);
        stream.write(SCP_ACK);
        continue;
      }

      // File record (C<mode> <size> <name>)
      if (control === 0x43) {
        const headerLine = await this.readLine(state);
        return this.parseFileHeader(headerLine);
      }

      // End-of-directory marker
      if (control === 0x45) {
        await this.readLine(state);
        return null;
      }

      // Remote reported error/fatal
      if (control === 0x01 || control === 0x02) {
        const message = (await this.readLine(state)).trim();
        throw new Error(message || (control === 0x01 ? 'SCP error' : 'SCP fatal error'));
      }

      throw new Error(`Unexpected SCP control byte: ${control}`);
    }
  }

  /**
   * Wait for channel drain, surfacing channel close/error as failures.
   */
  private async waitForDrain(stream: SCPChannel, state: SCPChannelState): Promise<void> {
    if (state.error) {
      throw state.error;
    }

    await new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        stream.off('drain', onDrain);
        stream.off('error', onError);
        stream.off('close', onClose);
      };

      const onDrain = (): void => {
        cleanup();
        resolve();
      };

      const onError = (err: Error): void => {
        cleanup();
        reject(err);
      };

      const onClose = (): void => {
        cleanup();
        reject(this.unexpectedEOF(state, 'writing file data'));
      };

      stream.once('drain', onDrain);
      stream.once('error', onError);
      stream.once('close', onClose);
    });
  }

  /**
   * Download a file from the remote printer.
   *
   * @param contextId - Printer context ID
   * @param remotePath - Path on the remote printer
   * @param localPath - Local destination path (optional, uses cache if not provided)
   * @param onProgress - Progress callback
   * @returns Transfer result
   */
  async downloadFile(
    contextId: string,
    remotePath: string,
    localPath?: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<TransferResult> {
    await this.ensureCacheDir();

    const requestedFilename = path.posix.basename(remotePath) || path.basename(remotePath);
    const destination = localPath || path.join(this.cacheDir, contextId, requestedFilename);

    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destination), { recursive: true });

    let bytesTransferred = 0;
    let stream: SCPChannel | null = null;
    let state: SCPChannelState | null = null;

    try {
      ({ stream, state } = await this.openScpChannel(contextId, `scp -f ${this.shellQuote(remotePath)}`));

      // Start SCP transfer handshake
      stream.write(SCP_ACK);

      const header = await this.readNextFileHeader(state, stream);
      if (!header) {
        throw new Error(`No file returned for remote path: ${remotePath}`);
      }

      // Ack file header before content transfer
      stream.write(SCP_ACK);

      const totalBytes = header.size;
      const filename = header.filename || requestedFilename;
      const chunks: Buffer[] = [];

      await this.readExact(state, totalBytes, (chunk) => {
        chunks.push(chunk);
        bytesTransferred += chunk.length;

        if (onProgress && totalBytes > 0) {
          onProgress({
            filename,
            bytesTransferred,
            totalBytes,
            percentage: Math.round((bytesTransferred / totalBytes) * 100),
          });
        }
      });

      await fs.writeFile(destination, Buffer.concat(chunks, totalBytes));

      // Read sender trailing ACK and finish transfer
      await this.readAck(state);
      stream.write(SCP_ACK);
      stream.end();
      await state.closePromise;

      return {
        success: true,
        localPath: destination,
        remotePath,
        bytesTransferred,
      };
    } catch (err) {
      if (stream) {
        try {
          stream.end();
        } catch {
          // Ignore cleanup errors
        }
      }

      if (state) {
        try {
          await state.closePromise;
        } catch {
          // Ignore close errors in failure path
        }
      }

      return {
        success: false,
        localPath: destination,
        remotePath,
        bytesTransferred,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Upload a file to the remote printer.
   *
   * @param contextId - Printer context ID
   * @param localPath - Local source path
   * @param remotePath - Destination path on printer
   * @param onProgress - Progress callback
   * @returns Transfer result
   */
  async uploadFile(
    contextId: string,
    localPath: string,
    remotePath: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<TransferResult> {
    const normalizedRemotePath = remotePath.replace(/\\/g, '/');
    const remoteIsDirectory = normalizedRemotePath.endsWith('/');
    const targetDirectory = remoteIsDirectory
      ? normalizedRemotePath.replace(/\/+$/, '') || '/'
      : path.posix.dirname(normalizedRemotePath);
    const targetFilename = remoteIsDirectory ? path.basename(localPath) : path.posix.basename(normalizedRemotePath);

    if (!targetFilename || targetFilename === '.' || targetFilename === '..') {
      return {
        success: false,
        localPath,
        remotePath,
        bytesTransferred: 0,
        error: `Invalid remote file path: ${remotePath}`,
      };
    }

    let stream: SCPChannel | null = null;
    let state: SCPChannelState | null = null;

    try {
      const content = await fs.readFile(localPath);
      const totalBytes = content.length;
      let bytesTransferred = 0;
      const progressFilename = path.basename(localPath);

      ({ stream, state } = await this.openScpChannel(contextId, `scp -t ${this.shellQuote(targetDirectory)}`));

      // Wait for receiver ready ACK
      await this.readAck(state);

      // Announce file metadata to receiver
      stream.write(`C0644 ${totalBytes} ${targetFilename}\n`);
      await this.readAck(state);

      // Send file data with progress updates
      let offset = 0;
      while (offset < totalBytes) {
        const end = Math.min(offset + SCP_CHUNK_SIZE, totalBytes);
        const chunk = content.subarray(offset, end);
        const canContinue = stream.write(chunk);

        bytesTransferred = end;
        if (onProgress) {
          onProgress({
            filename: progressFilename,
            bytesTransferred,
            totalBytes,
            percentage: Math.round((bytesTransferred / totalBytes) * 100),
          });
        }

        offset = end;

        if (!canContinue) {
          await this.waitForDrain(stream, state);
        }
      }

      // Signal end-of-file and wait for remote ACK
      stream.write(SCP_ACK);
      await this.readAck(state);
      stream.end();
      await state.closePromise;

      return {
        success: true,
        localPath,
        remotePath,
        bytesTransferred: totalBytes,
      };
    } catch (err) {
      if (stream) {
        try {
          stream.end();
        } catch {
          // Ignore cleanup errors
        }
      }

      if (state) {
        try {
          await state.closePromise;
        } catch {
          // Ignore close errors in failure path
        }
      }

      return {
        success: false,
        localPath,
        remotePath,
        bytesTransferred: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Read a remote file and return its content as a string.
   *
   * @param contextId - Printer context ID
   * @param remotePath - Path on the remote printer
   * @returns File content as string
   */
  async readRemoteFile(contextId: string, remotePath: string): Promise<string> {
    const result = await this.downloadFile(contextId, remotePath);

    if (!result.success) {
      throw new Error(result.error || 'Download failed');
    }

    return fs.readFile(result.localPath, 'utf-8');
  }

  /**
   * Fetch printer.cfg from the remote printer.
   * Tries multiple known locations.
   *
   * @param contextId - Printer context ID
   * @returns Config file content
   */
  async fetchPrinterConfig(contextId: string, preferredPath?: string): Promise<string> {
    const candidates = this.getPrinterConfigCandidates(preferredPath);
    let lastError: Error | null = null;

    for (const remotePath of candidates) {
      try {
        return await this.readRemoteFile(contextId, remotePath);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error');
      }
    }

    throw new Error(
      `Could not find printer.cfg. Tried:\n` +
        candidates.map((candidate) => `  - ${candidate}`).join('\n') +
        `\nError: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Fetch input shaper CSV file for an axis.
   *
   * @param contextId - Printer context ID
   * @param axis - Which axis ('x' or 'y')
   * @returns CSV file content
   */
  async fetchShaperCSV(contextId: string, axis: 'x' | 'y'): Promise<string> {
    const locateResult = await this.connectionManager.executeCommand(
      contextId,
      `ls -1t /tmp/calibration_data_${axis}_*.csv 2>/dev/null | head -n 1`
    );

    if (locateResult.exitCode === -1) {
      throw new Error(locateResult.error || locateResult.stderr.trim() || 'Failed to query calibration CSV files');
    }

    const latestPath = locateResult.stdout.trim().split(/\r?\n/)[0];

    if (!latestPath) {
      throw new Error(`No ${axis}-axis calibration data found in /tmp`);
    }

    return this.readRemoteFile(contextId, latestPath);
  }

  /**
   * List files in a remote directory.
   *
   * @param contextId - Printer context ID
   * @param remotePath - Directory path
   * @returns Array of file names
   */
  async listDirectory(contextId: string, remotePath: string): Promise<string[]> {
    const result = await this.connectionManager.executeCommand(
      contextId,
      `cd ${this.shellQuote(remotePath)} && ls -1A`
    );

    if (!result.success) {
      throw new Error(result.stderr.trim() || result.error || `Could not list directory: ${remotePath}`);
    }

    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.replace(/\r$/, ''))
      .filter((line) => line.length > 0);
  }

  /**
   * Check if a remote file exists.
   *
   * @param contextId - Printer context ID
   * @param remotePath - File path to check
   * @returns True if file exists
   */
  async fileExists(contextId: string, remotePath: string): Promise<boolean> {
    const result = await this.connectionManager.executeCommand(contextId, `test -e ${this.shellQuote(remotePath)}`);

    return result.exitCode === 0;
  }

  /**
   * Upload config content to the printer.
   *
   * @param contextId - Printer context ID
   * @param content - Config file content
   * @param remotePath - Destination path (defaults to printer.cfg location)
   * @returns Transfer result
   */
  async uploadConfig(contextId: string, content: string, remotePath?: string): Promise<TransferResult> {
    await this.ensureCacheDir();

    const configuredPath = remotePath?.trim();
    let targetRemotePath = configuredPath;

    if (targetRemotePath && !(await this.fileExists(contextId, targetRemotePath))) {
      targetRemotePath = undefined;
    }

    if (!targetRemotePath) {
      const candidates = this.getPrinterConfigCandidates();
      for (const candidate of candidates) {
        if (await this.fileExists(contextId, candidate)) {
          targetRemotePath = candidate;
          break;
        }
      }
      if (!targetRemotePath) {
        targetRemotePath = DEFAULT_REMOTE_PATHS.printerConfig;
      }
    }

    // Write content to temp file first
    const tempPath = path.join(this.cacheDir, contextId, 'upload-temp.cfg');
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, content, 'utf-8');

    // Upload the file
    const result = await this.uploadFile(contextId, tempPath, targetRemotePath);

    // Clean up temp file
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }

    return result;
  }

  /**
   * Clear the local cache for a context.
   *
   * @param contextId - Printer context ID
   */
  async clearCache(contextId: string): Promise<void> {
    const contextCacheDir = path.join(this.cacheDir, contextId);
    try {
      await fs.rm(contextCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  }

  /**
   * Clear entire cache.
   */
  async clearAllCache(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      await this.ensureCacheDir();
    } catch {
      // Ignore errors
    }
  }
}
