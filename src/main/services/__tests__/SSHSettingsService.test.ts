/**
 * @fileoverview Unit tests for SSHSettingsService.
 *
 * Validates the centralized per-printer SSH credential store: default
 * resolution (flashforge-easyssh root/flashforge/22), persistence of custom
 * overrides, encrypted-at-rest password handling through SecureStorage
 * (Electron safeStorage mock with a real enc:/decrypt round-trip), per-serial
 * isolation, private-key precedence in buildConnectionConfig, and the
 * "default values are stored as unset" rule.
 *
 * @module services/__tests__/SSHSettingsService.test
 */

// Mutable Electron app mock: getPath('userData') is re-pointed at a fresh tmp
// directory per test so each test starts with no persisted ssh-settings.json.
const mockApp = {
  getPath: jest.fn(),
};

// safeStorage mock that exercises the REAL enc:/decrypt path through
// SecureStorage: encrypt wraps the value with an "enc:" marker and decrypt
// strips it, so the round-trip is faithful to the production code path.
const mockSafeStorage = {
  isEncryptionAvailable: jest.fn(() => true),
  encryptString: jest.fn((value: string) => Buffer.from(`enc:${value}`)),
  decryptString: jest.fn((buffer: Buffer) => buffer.toString().replace('enc:', '')),
};

jest.mock('electron', () => ({
  app: mockApp,
  safeStorage: mockSafeStorage,
}));

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { SSH_DEFAULTS } from '@shared/types/ssh-settings.js';
import { getSSHSettingsService, SSHSettingsService } from '../SSHSettingsService.js';

const STORE_FILENAME = 'ssh-settings.json';

describe('SSHSettingsService', () => {
  let tmpDir: string;
  let service: SSHSettingsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    tmpDir = path.join(
      os.tmpdir(),
      `ssh-settings-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(tmpDir, { recursive: true });
    mockApp.getPath.mockReturnValue(tmpDir);

    // Reset the singleton so the constructor re-reads app.getPath('userData')
    // and points storePath at this test's isolated tmp directory.
    (SSHSettingsService as unknown as { instance: SSHSettingsService | null }).instance = null;
    service = getSSHSettingsService();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const readStore = async (): Promise<{ version: number; printers: Record<string, unknown> }> => {
    const raw = await fs.readFile(path.join(tmpDir, STORE_FILENAME), 'utf-8');
    return JSON.parse(raw) as { version: number; printers: Record<string, unknown> };
  };

  it('resolves easy-SSH defaults for an unknown serial with no stored entry', async () => {
    const settings = await service.getSettings('SN_UNKNOWN_DEFAULT');

    expect(settings.username).toBe(SSH_DEFAULTS.username);
    expect(settings.password).toBe(SSH_DEFAULTS.password);
    expect(settings.port).toBe(SSH_DEFAULTS.port);
    expect(settings.keyPath).toBeUndefined();
    expect(settings.isCustom).toBe(false);
  });

  it('buildConnectionConfig returns the defaults for an unknown printer', async () => {
    const config = await service.buildConnectionConfig('SN_UNKNOWN_CONFIG', '192.168.1.42');

    expect(config.host).toBe('192.168.1.42');
    expect(config.username).toBe(SSH_DEFAULTS.username);
    expect(config.password).toBe(SSH_DEFAULTS.password);
    expect(config.port).toBe(SSH_DEFAULTS.port);
    expect(config.privateKey).toBeUndefined();
  });

  it('persists custom username/password/port and reflects them in buildConnectionConfig', async () => {
    await service.updateSettings('SN_CUSTOM', {
      username: 'admin',
      password: 'hunter2',
      port: 2222,
    });

    const settings = await service.getSettings('SN_CUSTOM');
    expect(settings.username).toBe('admin');
    expect(settings.password).toBe('hunter2');
    expect(settings.port).toBe(2222);
    expect(settings.isCustom).toBe(true);

    const config = await service.buildConnectionConfig('SN_CUSTOM', '10.0.0.5');
    expect(config.username).toBe('admin');
    expect(config.password).toBe('hunter2');
    expect(config.port).toBe(2222);
  });

  it('encrypts the password at rest and decrypts it faithfully on read', async () => {
    const secret = 'super-secret-pw';
    await service.updateSettings('SN_ENCRYPT', { password: secret });

    // Round-trip: reading the setting back yields the original plaintext.
    const settings = await service.getSettings('SN_ENCRYPT');
    expect(settings.password).toBe(secret);

    // The persisted file must NOT contain the plaintext password.
    const raw = await fs.readFile(path.join(tmpDir, STORE_FILENAME), 'utf-8');
    expect(raw).not.toContain(secret);
    // It must store the SecureStorage "enc:" prefixed (base64) form.
    expect(raw).toContain('enc:');

    // safeStorage round-trip was actually exercised (not the base64 fallback).
    expect(mockSafeStorage.encryptString).toHaveBeenCalledWith(secret);
    expect(mockSafeStorage.decryptString).toHaveBeenCalled();
  });

  it('resetSettings restores the easy-SSH defaults', async () => {
    await service.updateSettings('SN_RESET', {
      username: 'admin',
      password: 'pw',
      port: 2200,
    });
    expect((await service.getSettings('SN_RESET')).isCustom).toBe(true);

    await service.resetSettings('SN_RESET');

    const settings = await service.getSettings('SN_RESET');
    expect(settings.username).toBe(SSH_DEFAULTS.username);
    expect(settings.password).toBe(SSH_DEFAULTS.password);
    expect(settings.port).toBe(SSH_DEFAULTS.port);
    expect(settings.isCustom).toBe(false);
  });

  it('isolates settings per serial number', async () => {
    await service.updateSettings('SN_A', { username: 'userA', password: 'pwA', port: 2201 });
    await service.updateSettings('SN_B', { username: 'userB', password: 'pwB', port: 2202 });

    const a = await service.getSettings('SN_A');
    const b = await service.getSettings('SN_B');

    expect(a.username).toBe('userA');
    expect(a.port).toBe(2201);
    expect(a.password).toBe('pwA');

    expect(b.username).toBe('userB');
    expect(b.port).toBe(2202);
    expect(b.password).toBe('pwB');
  });

  it('loads a configured private key and prefers it over password in buildConnectionConfig', async () => {
    const keyPath = path.join(tmpDir, 'test_key');
    const keyContents =
      '-----BEGIN OPENSSH PRIVATE KEY-----\nfake-key-material\n-----END OPENSSH PRIVATE KEY-----\n';
    await fs.writeFile(keyPath, keyContents, 'utf-8');

    await service.updateSettings('SN_KEY', { password: 'should-not-be-used', keyPath });

    const settings = await service.getSettings('SN_KEY');
    expect(settings.keyPath).toBe(keyPath);
    expect(settings.isCustom).toBe(true);

    const config = await service.buildConnectionConfig('SN_KEY', '10.0.0.9');
    // When a key path is configured, buildConnectionConfig reads it into
    // privateKey; the SSH client (ssh2) prefers the key over password at
    // connect time, so privateKey being populated is the precedence signal.
    expect(config.privateKey).toBe(keyContents);
    expect(config.username).toBe(SSH_DEFAULTS.username);
  });

  it('does not persist an entry when the update only contains default values', async () => {
    await service.updateSettings('SN_DEFAULT_ONLY', {
      username: SSH_DEFAULTS.username,
      password: SSH_DEFAULTS.password,
      port: SSH_DEFAULTS.port,
    });

    // No custom values -> the printer must not be recorded in the store.
    const store = await readStore();
    expect(store.printers['SN_DEFAULT_ONLY']).toBeUndefined();

    // And getSettings still resolves cleanly to the defaults.
    const settings = await service.getSettings('SN_DEFAULT_ONLY');
    expect(settings.isCustom).toBe(false);
  });
});
