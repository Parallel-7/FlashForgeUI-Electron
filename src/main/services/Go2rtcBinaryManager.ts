/**
 * @fileoverview Manages the go2rtc binary lifecycle including platform detection,
 * path resolution, config file generation, and process spawning/termination.
 *
 * go2rtc is bundled as a platform-specific binary in resources/bin/{platform}-{arch}/
 * and is extracted to a temp directory for execution. The manager ensures only one
 * instance runs at a time and handles graceful shutdown.
 *
 * @see src/main/types/go2rtc.types.ts for type definitions
 */

import { app } from 'electron';
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import * as crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Go2rtcBinaryInfo, Go2rtcConfig } from '../types/go2rtc.types.js';

/**
 * Singleton manager for go2rtc binary lifecycle.
 *
 * Responsibilities:
 * - Locate the correct binary for the current platform
 * - Generate runtime configuration file
 * - Spawn and monitor the go2rtc process
 * - Handle graceful shutdown on app exit
 */
export class Go2rtcBinaryManager {
  private static instance: Go2rtcBinaryManager | null = null;

  /** go2rtc child process */
  private process: ChildProcess | null = null;

  /** Whether process is currently starting */
  private isStarting = false;

  /** Process exit promise for graceful shutdown */
  private exitPromise: Promise<void> | null = null;

  /** Path to runtime config file */
  private configPath: string | null = null;

  /** API port - hardcoded as per user preference */
  private readonly apiPort = 1984;

  /** WebRTC port - hardcoded as per user preference */
  private readonly webrtcPort = 8555;

  /** Timeout for graceful shutdown (ms) */
  private readonly shutdownTimeoutMs = 5000;

  /** Credentials for API access */
  private credentials: { username: string; password: string } | null = null;

  private constructor() {
    // Register cleanup on app quit
    app.on('will-quit', () => {
      void this.stop();
    });
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): Go2rtcBinaryManager {
    if (!Go2rtcBinaryManager.instance) {
      Go2rtcBinaryManager.instance = new Go2rtcBinaryManager();
    }
    return Go2rtcBinaryManager.instance;
  }

  /**
   * Get binary information for the current platform
   */
  public getBinaryInfo(): Go2rtcBinaryInfo {
    const platform = process.platform;
    const arch = process.arch;
    const binaryPath = this.getBinaryPath();

    return {
      path: binaryPath,
      platform,
      arch,
      exists: fs.existsSync(binaryPath),
    };
  }

  /**
   * Get the path to the go2rtc binary for the current platform
   *
   * Uses platform-arch directory structure for both dev and production.
   * This allows macOS universal builds to include both arm64 and x64 binaries,
   * selecting the correct one at runtime based on the actual architecture.
   */
  private getBinaryPath(): string {
    const platform = process.platform;
    const arch = process.arch;
    const binaryName = platform === 'win32' ? 'go2rtc.exe' : 'go2rtc';
    const platformArch = `${platform}-${arch}`;

    if (app.isPackaged) {
      // Production: binary is in resources/bin/{platform}-{arch}/go2rtc
      // This structure supports macOS universal builds with both arm64 and x64
      return path.join(process.resourcesPath, 'bin', platformArch, binaryName);
    }

    // Development: binary is in resources/bin/{platform}-{arch}/go2rtc
    return path.join(app.getAppPath(), 'resources', 'bin', platformArch, binaryName);
  }

  /**
   * Get the API URL for go2rtc
   */
  public getApiUrl(): string {
    return `http://127.0.0.1:${this.apiPort}`;
  }

  /**
   * Get the API port
   */
  public getApiPort(): number {
    return this.apiPort;
  }

  /**
   * Get the WebRTC port
   */
  public getWebRtcPort(): number {
    return this.webrtcPort;
  }

  /**
   * Check if go2rtc process is running
   */
  public isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  /**
   * Get the process ID if running
   */
  public getPid(): number | undefined {
    return this.process?.pid;
  }

  /**
   * Get credentials for API access
   */
  public getCredentials(): { username: string; password: string } | null {
    return this.credentials;
  }

  /**
   * Generate and write the go2rtc configuration file
   */
  private async generateConfig(): Promise<string> {
    // Generate secure password
    const password = crypto.randomBytes(16).toString('hex');
    this.credentials = { username: 'flashforge', password };

    const config: Go2rtcConfig = {
      api: {
        listen: `:${this.apiPort}`,
        username: this.credentials.username,
        password: this.credentials.password,
      },
      webrtc: {
        listen: `:${this.webrtcPort}/tcp`,
        ice_servers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      },
      streams: {},
      log: {
        format: 'text',
        level: 'info',
      },
    };

    // Write config to app's userData directory
    const configDir = path.join(app.getPath('userData'), 'go2rtc');
    fs.mkdirSync(configDir, { recursive: true });

    const configPath = path.join(configDir, 'go2rtc.yaml');
    const configContent = this.serializeConfig(config);

    fs.writeFileSync(configPath, configContent, 'utf8');
    console.log(`[Go2rtcBinaryManager] Generated config: ${configPath}`);

    return configPath;
  }

  /**
   * Serialize config object to YAML format
   * (Simple implementation - go2rtc's config is straightforward)
   */
  private serializeConfig(config: Go2rtcConfig): string {
    const lines: string[] = [];

    if (config.api) {
      lines.push('api:');
      if (config.api.listen) lines.push(`  listen: "${config.api.listen}"`);
      if (config.api.username) lines.push(`  username: "${config.api.username}"`);
      if (config.api.password) lines.push(`  password: "${config.api.password}"`);
      // Allow CORS for WebSocket connections from Electron renderer/dev server
      lines.push('  origin: "*"');
    }

    if (config.webrtc) {
      lines.push('');
      lines.push('webrtc:');
      if (config.webrtc.listen) lines.push(`  listen: "${config.webrtc.listen}"`);
      if (config.webrtc.ice_servers && config.webrtc.ice_servers.length > 0) {
        lines.push('  ice_servers:');
        for (const server of config.webrtc.ice_servers) {
          lines.push(`    - urls: [${server.urls.map((u) => `"${u}"`).join(', ')}]`);
        }
      }
    }

    // Empty streams section - go2rtc will add streams dynamically via API
    lines.push('');
    lines.push('streams:');

    if (config.log) {
      lines.push('');
      lines.push('log:');
      if (config.log.format) lines.push(`  format: "${config.log.format}"`);
      if (config.log.level) lines.push(`  level: "${config.log.level}"`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Start the go2rtc process
   */
  public async start(): Promise<void> {
    if (this.isRunning()) {
      console.log('[Go2rtcBinaryManager] Already running');
      return;
    }

    if (this.isStarting) {
      console.log('[Go2rtcBinaryManager] Already starting, waiting...');
      // Wait for current start attempt to complete
      while (this.isStarting) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }

    this.isStarting = true;

    try {
      const binaryInfo = this.getBinaryInfo();

      if (!binaryInfo.exists) {
        throw new Error(
          `go2rtc binary not found at ${binaryInfo.path}. ` +
            `Run "node scripts/download-go2rtc.cjs" to download binaries.`
        );
      }

      // Generate config file (required for API to add streams dynamically)
      this.configPath = await this.generateConfig();

      console.log(`[Go2rtcBinaryManager] Starting: ${binaryInfo.path}`);
      console.log(`[Go2rtcBinaryManager] Config: ${this.configPath}`);

      // Spawn process with config file
      this.process = spawn(binaryInfo.path, ['-config', this.configPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      // Setup exit promise
      this.exitPromise = new Promise<void>((resolve) => {
        this.process?.on('exit', (code, signal) => {
          console.log(`[Go2rtcBinaryManager] Process exited: code=${code}, signal=${signal}`);
          this.process = null;
          resolve();
        });
      });

      // Log stdout/stderr
      this.process.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().trim().split('\n');
        for (const line of lines) {
          if (line) console.log(`[go2rtc] ${line}`);
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().trim().split('\n');
        for (const line of lines) {
          if (line) console.error(`[go2rtc] ${line}`);
        }
      });

      this.process.on('error', (error) => {
        console.error(`[Go2rtcBinaryManager] Process error:`, error);
        this.process = null;
      });

      // Wait for API to be ready (poll health endpoint)
      await this.waitForReady();

      console.log(`[Go2rtcBinaryManager] Started successfully on port ${this.apiPort}`);
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Wait for go2rtc API to be ready
   */
  private async waitForReady(timeoutMs = 10000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 100;

    while (Date.now() - startTime < timeoutMs) {
      if (!this.isRunning()) {
        throw new Error('go2rtc process exited during startup');
      }

      try {
        const headers: HeadersInit = {};
        if (this.credentials) {
          const auth = Buffer.from(`${this.credentials.username}:${this.credentials.password}`).toString('base64');
          headers['Authorization'] = `Basic ${auth}`;
        }
        const response = await fetch(`${this.getApiUrl()}/api`, { headers });
        if (response.ok) {
          return; // Ready!
        }
      } catch {
        // Not ready yet, continue waiting
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    throw new Error(`go2rtc failed to start within ${timeoutMs}ms`);
  }

  /**
   * Stop the go2rtc process gracefully
   */
  public async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    console.log('[Go2rtcBinaryManager] Stopping...');

    const pid = this.process.pid;

    // Try graceful termination
    if (process.platform === 'win32') {
      this.process.kill();
    } else {
      this.process.kill('SIGTERM');
    }

    // Wait for exit with timeout
    if (this.exitPromise) {
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          if (this.process) {
            console.log('[Go2rtcBinaryManager] Force killing...');
            this.process.kill('SIGKILL');
          }
          resolve();
        }, this.shutdownTimeoutMs);
      });

      await Promise.race([this.exitPromise, timeoutPromise]);
    }

    this.process = null;
    this.exitPromise = null;

    console.log(`[Go2rtcBinaryManager] Stopped (was pid=${pid})`);
  }

  /**
   * Restart the go2rtc process
   */
  public async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }
}

/**
 * Get the singleton Go2rtcBinaryManager instance
 */
export function getGo2rtcBinaryManager(): Go2rtcBinaryManager {
  return Go2rtcBinaryManager.getInstance();
}
