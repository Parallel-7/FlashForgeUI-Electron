/**
 * @fileoverview Minimal ambient types for the `ssh2` package.
 *
 * ssh2 ships no declarations and @types/ssh2 is not installed. Rather than add a
 * dependency for test-only code, this declares just the surface the SFTP helpers use.
 * Scoped to tsconfig.e2e.json, so it cannot affect application type-checking.
 */

declare module 'ssh2' {
  export interface SftpFileEntry {
    filename: string;
    attrs: { size: number; mtime: number };
  }

  export interface SftpClient {
    readdir(path: string, callback: (error: Error | null, list: SftpFileEntry[]) => void): void;
    unlink(path: string, callback: (error: Error | null) => void): void;
  }

  export interface ConnectConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    readyTimeout?: number;
  }

  export class Client {
    on(event: 'ready', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    sftp(callback: (error: Error | null, sftp: SftpClient) => void): void;
    connect(config: ConnectConfig): this;
    end(): this;
  }
}
