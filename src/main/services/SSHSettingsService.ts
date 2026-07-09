/**
 * @fileoverview Centralized per-printer SSH credential store.
 *
 * Single source of truth for SSH credentials used by every SSH-based feature
 * (file manager, calibration assistant desktop dialog, WebUI calibration
 * routes). Settings are keyed by printer serial number — stable across
 * sessions, unlike runtime context ids — and persisted to ssh-settings.json in
 * the Electron userData directory with passwords encrypted via SecureStorage
 * (Electron safeStorage with base64 fallback).
 *
 * Resolution rules:
 * - Missing/empty fields fall back to the flashforge-easyssh defaults
 *   (root / flashforge, port 22), so provisioned printers work with zero setup.
 * - An optional private key path takes precedence over password auth when set.
 *
 * Key exports:
 * - SSHSettingsService / getSSHSettingsService(): singleton service
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import type { SSHConnectionConfig } from '@shared/types/calibration.js';
import { SSH_DEFAULTS, type SSHSettings, type SSHSettingsUpdate } from '@shared/types/ssh-settings.js';
import { decryptSecret, encryptSecret } from '../utils/SecureStorage.js';

/** On-disk entry (password encrypted; absent fields mean "use default"). */
interface StoredSSHEntry {
  username?: string;
  password?: string;
  port?: number;
  keyPath?: string;
}

interface SSHSettingsFile {
  version: number;
  printers: Record<string, StoredSSHEntry>;
}

const STORE_VERSION = 1;
const STORE_FILENAME = 'ssh-settings.json';

/**
 * Centralized per-printer SSH settings, keyed by printer serial number.
 */
export class SSHSettingsService {
  private static instance: SSHSettingsService | null = null;

  private readonly storePath: string;
  private cache: SSHSettingsFile | null = null;

  private constructor() {
    this.storePath = path.join(app.getPath('userData'), STORE_FILENAME);
  }

  public static getInstance(): SSHSettingsService {
    if (!SSHSettingsService.instance) {
      SSHSettingsService.instance = new SSHSettingsService();
    }
    return SSHSettingsService.instance;
  }

  private async load(): Promise<SSHSettingsFile> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const raw = await fs.readFile(this.storePath, 'utf-8');
      const parsed = JSON.parse(raw) as SSHSettingsFile;
      this.cache = {
        version: parsed.version || STORE_VERSION,
        printers: parsed.printers || {},
      };
    } catch {
      this.cache = { version: STORE_VERSION, printers: {} };
    }

    return this.cache;
  }

  private async persist(store: SSHSettingsFile): Promise<void> {
    this.cache = store;
    await fs.writeFile(this.storePath, JSON.stringify(store, null, 2), 'utf-8');
  }

  /**
   * Get resolved SSH settings for a printer (easy-SSH defaults applied).
   */
  public async getSettings(serialNumber: string): Promise<SSHSettings> {
    const store = await this.load();
    const entry = store.printers[serialNumber] || {};

    const username = entry.username || SSH_DEFAULTS.username;
    const password = (entry.password ? decryptSecret(entry.password) : undefined) || SSH_DEFAULTS.password;
    const port = entry.port || SSH_DEFAULTS.port;
    const keyPath = entry.keyPath || undefined;

    return {
      username,
      password,
      port,
      keyPath,
      isCustom:
        username !== SSH_DEFAULTS.username ||
        password !== SSH_DEFAULTS.password ||
        port !== SSH_DEFAULTS.port ||
        !!keyPath,
    };
  }

  /**
   * Update settings for a printer. Empty strings / default values are stored
   * as "unset" so the printer keeps tracking the easy-SSH defaults.
   */
  public async updateSettings(serialNumber: string, update: SSHSettingsUpdate): Promise<void> {
    const store = await this.load();
    const entry: StoredSSHEntry = { ...(store.printers[serialNumber] || {}) };

    if (update.username !== undefined) {
      const username = update.username.trim();
      entry.username = username && username !== SSH_DEFAULTS.username ? username : undefined;
    }
    if (update.password !== undefined) {
      const password = update.password;
      entry.password = password && password !== SSH_DEFAULTS.password ? encryptSecret(password) : undefined;
    }
    if (update.port !== undefined) {
      entry.port = update.port > 0 && update.port !== SSH_DEFAULTS.port ? update.port : undefined;
    }
    if (update.keyPath !== undefined) {
      const keyPath = update.keyPath.trim();
      entry.keyPath = keyPath || undefined;
    }

    const hasValues = Object.values(entry).some((value) => value !== undefined);
    if (hasValues) {
      store.printers[serialNumber] = entry;
    } else {
      delete store.printers[serialNumber];
    }

    await this.persist(store);
    console.log(`[SSHSettings] Updated SSH settings for ${serialNumber} (custom: ${hasValues})`);
  }

  /**
   * Reset a printer back to the easy-SSH defaults.
   */
  public async resetSettings(serialNumber: string): Promise<void> {
    const store = await this.load();
    delete store.printers[serialNumber];
    await this.persist(store);
    console.log(`[SSHSettings] Reset SSH settings for ${serialNumber} to defaults`);
  }

  /**
   * Build a ready-to-use SSH connection config for a printer.
   * Reads the private key file into memory when a key path is configured.
   */
  public async buildConnectionConfig(serialNumber: string, host: string): Promise<SSHConnectionConfig> {
    const settings = await this.getSettings(serialNumber);

    const config: SSHConnectionConfig = {
      host,
      port: settings.port,
      username: settings.username,
      password: settings.password,
      timeout: 10000,
      keepaliveInterval: 10000,
    };

    if (settings.keyPath) {
      try {
        config.privateKey = await fs.readFile(settings.keyPath, 'utf-8');
      } catch (error) {
        console.warn(`[SSHSettings] Failed to read SSH key at ${settings.keyPath}, falling back to password:`, error);
      }
    }

    return config;
  }
}

/**
 * Get the SSHSettingsService singleton.
 */
export function getSSHSettingsService(): SSHSettingsService {
  return SSHSettingsService.getInstance();
}
