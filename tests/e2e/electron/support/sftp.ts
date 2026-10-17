/**
 * @fileoverview SFTP helpers for verifying files directly on a real printer.
 *
 * Needed because /gcodeList is a *recent files* list, not a directory listing. On real
 * firmware a freshly uploaded file that has never been printed does not appear there,
 * so asserting on it reports a false failure for an upload that genuinely worked. (The
 * emulator's /gcodeList does list uploads, which is why this only bites on hardware.)
 *
 * Reading the filesystem over SFTP is the authoritative check. Requires
 * FlashForge-EasySSH provisioning, so it is hardware-only.
 *
 * Key exports:
 * - remoteGcodeDirFor(): where each printer family stores print files
 * - listRemoteFiles() / hasRemoteFile() / deleteRemoteFile()
 */

import { Client, type SftpClient } from 'ssh2';
import type { HardwarePrinterKind } from './hardware-config';

export interface SftpCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
}

/**
 * Print-file directory per printer family, matching FlashForge-EasySSH's layout.
 * AD5X keeps gcode/3MF in /usr/data/gcodes; the 5M series uses /data.
 */
export const remoteGcodeDirFor = (kind: HardwarePrinterKind): string =>
  kind === 'ad5x' ? '/usr/data/gcodes' : '/data';

const withSftp = async <T>(credentials: SftpCredentials, action: (sftp: SftpClient) => Promise<T>): Promise<T> => {
  const client = new Client();

  const session = await new Promise<SftpClient>((resolve, reject) => {
    client.on('ready', () => {
      client.sftp((error, sftp) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(sftp);
      });
    });
    client.on('error', reject);
    client.connect({ ...credentials, readyTimeout: 20_000 });
  });

  try {
    return await action(session);
  } finally {
    client.end();
  }
};

export const listRemoteFiles = async (credentials: SftpCredentials, directory: string): Promise<string[]> =>
  await withSftp(
    credentials,
    async (sftp) =>
      await new Promise<string[]>((resolve, reject) => {
        sftp.readdir(directory, (error, list) => {
          if (error) {
            reject(new Error(`SFTP readdir ${directory} failed: ${error.message}`));
            return;
          }
          resolve(list.map((entry) => entry.filename));
        });
      })
  );

export const hasRemoteFile = async (
  credentials: SftpCredentials,
  directory: string,
  fileName: string
): Promise<boolean> => (await listRemoteFiles(credentials, directory)).includes(fileName);

/** Polls for a file to appear, since large uploads finish after the dialog closes. */
export const waitForRemoteFile = async (
  credentials: SftpCredentials,
  directory: string,
  fileName: string,
  timeoutMs = 120_000
): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await hasRemoteFile(credentials, directory, fileName).catch(() => false)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return false;
};

/** Removes a file, used to clean up after hardware upload runs. */
export const deleteRemoteFile = async (
  credentials: SftpCredentials,
  directory: string,
  fileName: string
): Promise<void> =>
  await withSftp(
    credentials,
    async (sftp) =>
      await new Promise<void>((resolve, reject) => {
        sftp.unlink(`${directory}/${fileName}`, (error) => {
          if (error) {
            reject(new Error(`SFTP unlink ${directory}/${fileName} failed: ${error.message}`));
            return;
          }
          resolve();
        });
      })
  );
