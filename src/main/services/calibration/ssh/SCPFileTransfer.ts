/**
 * @fileoverview SCP file transfer for printer configuration and calibration files.
 * Provides download and upload functionality using SFTP over SSH.
 *
 * @module main/services/calibration/ssh/SCPFileTransfer
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { SFTPWrapper } from 'ssh2';
import type { TransferProgress, TransferResult } from '../../../../shared/types/calibration';
import type { SSHConnectionManager } from './SSHConnectionManager';

/**
 * Default remote paths for FlashForge printers.
 * Based on Stone-Time SSH method and Klipper configuration.
 */
export const DEFAULT_REMOTE_PATHS = {
  /** Klipper printer configuration file */
  printerConfig: '/home/klipper/printer_data/config/printer.cfg',
  /** Alternative printer config location */
  printerConfigAlt: '/root/printer_data/config/printer.cfg',
  /** Input shaper X-axis calibration data */
  shaperX: '/tmp/calibration_data_x_*.csv',
  /** Input shaper Y-axis calibration data */
  shaperY: '/tmp/calibration_data_y_*.csv',
  /** Resonance test results directory */
  resonanceDir: '/tmp/resonances/',
};

/**
 * File transfer service using SFTP over SSH.
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
   * Get SFTP session from connection.
   */
  private getSFTP(contextId: string): Promise<SFTPWrapper> {
    const connection = this.connectionManager.getConnection(contextId);

    if (!connection) {
      return Promise.reject(new Error('Not connected'));
    }

    if (connection.status !== 'connected') {
      return Promise.reject(new Error(`Connection status: ${connection.status}`));
    }

    return new Promise((resolve, reject) => {
      connection.client.sftp((err, sftp) => {
        if (err) {
          reject(err);
        } else {
          resolve(sftp);
        }
      });
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

    const filename = path.basename(remotePath);
    const destination = localPath || path.join(this.cacheDir, contextId, filename);

    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destination), { recursive: true });

    try {
      const sftp = await this.getSFTP(contextId);

      return new Promise((resolve) => {
        // Get file stats first for progress reporting
        sftp.stat(remotePath, (statErr, stats) => {
          const totalBytes = statErr ? 0 : stats?.size || 0;

          const readStream = sftp.createReadStream(remotePath);
          const chunks: Buffer[] = [];
          let bytesTransferred = 0;

          readStream.on('data', (chunk: Buffer) => {
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

          readStream.on('end', async () => {
            try {
              const content = Buffer.concat(chunks);
              await fs.writeFile(destination, content);

              resolve({
                success: true,
                localPath: destination,
                remotePath,
                bytesTransferred,
              });
            } catch (writeErr) {
              resolve({
                success: false,
                localPath: destination,
                remotePath,
                bytesTransferred,
                error: writeErr instanceof Error ? writeErr.message : 'Write failed',
              });
            }
          });

          readStream.on('error', (err: Error) => {
            resolve({
              success: false,
              localPath: destination,
              remotePath,
              bytesTransferred,
              error: err.message,
            });
          });
        });
      });
    } catch (err) {
      return {
        success: false,
        localPath: localPath || '',
        remotePath,
        bytesTransferred: 0,
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
    try {
      const sftp = await this.getSFTP(contextId);
      const content = await fs.readFile(localPath);
      const filename = path.basename(localPath);
      const totalBytes = content.length;

      return new Promise((resolve) => {
        const writeStream = sftp.createWriteStream(remotePath);
        let bytesTransferred = 0;

        writeStream.on('close', () => {
          resolve({
            success: true,
            localPath,
            remotePath,
            bytesTransferred: totalBytes,
          });
        });

        writeStream.on('error', (err: Error) => {
          resolve({
            success: false,
            localPath,
            remotePath,
            bytesTransferred,
            error: err.message,
          });
        });

        // Write in chunks for progress reporting
        const chunkSize = 16384;
        let offset = 0;

        const writeChunk = (): void => {
          while (offset < totalBytes) {
            const end = Math.min(offset + chunkSize, totalBytes);
            const chunk = content.slice(offset, end);

            const canContinue = writeStream.write(chunk);
            bytesTransferred = end;

            if (onProgress) {
              onProgress({
                filename,
                bytesTransferred,
                totalBytes,
                percentage: Math.round((bytesTransferred / totalBytes) * 100),
              });
            }

            offset = end;

            if (!canContinue) {
              writeStream.once('drain', writeChunk);
              return;
            }
          }

          writeStream.end();
        };

        writeChunk();
      });
    } catch (err) {
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

    const content = await fs.readFile(result.localPath, 'utf-8');
    return content;
  }

  /**
   * Fetch printer.cfg from the remote printer.
   * Tries multiple known locations.
   *
   * @param contextId - Printer context ID
   * @returns Config file content
   */
  async fetchPrinterConfig(contextId: string): Promise<string> {
    // Try primary location first
    try {
      return await this.readRemoteFile(contextId, DEFAULT_REMOTE_PATHS.printerConfig);
    } catch {
      // Try alternative location
      try {
        return await this.readRemoteFile(contextId, DEFAULT_REMOTE_PATHS.printerConfigAlt);
      } catch (err) {
        throw new Error(
          `Could not find printer.cfg. Tried:\n` +
            `  - ${DEFAULT_REMOTE_PATHS.printerConfig}\n` +
            `  - ${DEFAULT_REMOTE_PATHS.printerConfigAlt}\n` +
            `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Fetch input shaper CSV file for an axis.
   *
   * @param contextId - Printer context ID
   * @param axis - Which axis ('x' or 'y')
   * @returns CSV file content
   */
  async fetchShaperCSV(contextId: string, axis: 'x' | 'y'): Promise<string> {
    // List files in /tmp to find the calibration data
    const sftp = await this.getSFTP(contextId);

    return new Promise((resolve, reject) => {
      sftp.readdir('/tmp', async (err, list) => {
        if (err) {
          reject(new Error(`Could not read /tmp: ${err.message}`));
          return;
        }

        // Find calibration data file for the axis
        const pattern = `calibration_data_${axis}_`;
        const files = list
          .filter((f) => f.filename.startsWith(pattern) && f.filename.endsWith('.csv'))
          .sort((a, b) => (b.attrs.mtime || 0) - (a.attrs.mtime || 0)); // Most recent first

        if (files.length === 0) {
          reject(new Error(`No ${axis}-axis calibration data found in /tmp`));
          return;
        }

        const remotePath = `/tmp/${files[0].filename}`;

        try {
          const content = await this.readRemoteFile(contextId, remotePath);
          resolve(content);
        } catch (readErr) {
          reject(readErr);
        }
      });
    });
  }

  /**
   * List files in a remote directory.
   *
   * @param contextId - Printer context ID
   * @param remotePath - Directory path
   * @returns Array of file names
   */
  async listDirectory(contextId: string, remotePath: string): Promise<string[]> {
    const sftp = await this.getSFTP(contextId);

    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          reject(err);
        } else {
          resolve(list.map((f) => f.filename));
        }
      });
    });
  }

  /**
   * Check if a remote file exists.
   *
   * @param contextId - Printer context ID
   * @param remotePath - File path to check
   * @returns True if file exists
   */
  async fileExists(contextId: string, remotePath: string): Promise<boolean> {
    const sftp = await this.getSFTP(contextId);

    return new Promise((resolve) => {
      sftp.stat(remotePath, (err) => {
        resolve(!err);
      });
    });
  }

  /**
   * Upload config content to the printer.
   *
   * @param contextId - Printer context ID
   * @param content - Config file content
   * @param remotePath - Destination path (defaults to printer.cfg location)
   * @returns Transfer result
   */
  async uploadConfig(
    contextId: string,
    content: string,
    remotePath: string = DEFAULT_REMOTE_PATHS.printerConfig
  ): Promise<TransferResult> {
    await this.ensureCacheDir();

    // Write content to temp file first
    const tempPath = path.join(this.cacheDir, contextId, 'upload-temp.cfg');
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, content, 'utf-8');

    // Upload the file
    const result = await this.uploadFile(contextId, tempPath, remotePath);

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
