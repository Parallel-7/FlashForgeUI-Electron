
import { AuthManager } from '../AuthManager';
import { getConfigManager } from '../../../managers/ConfigManager';
import * as crypto from 'crypto';

// Mock ConfigManager
jest.mock('../../../managers/ConfigManager', () => ({
  getConfigManager: jest.fn(),
}));

describe('AuthManager PBKDF2 Migration', () => {
  let authManager: AuthManager;
  let mockConfig: any;
  let mockConfigManager: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      WebUIPassword: '',
      WebUIPasswordRequired: true,
      WebUISecret: 'secret',
    };

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue(mockConfig),
      set: jest.fn((key, value) => {
        mockConfig[key] = value;
      }),
    };

    (getConfigManager as jest.Mock).mockReturnValue(mockConfigManager);

    authManager = new AuthManager();
  });

  afterEach(() => {
    authManager.dispose();
  });

  it('should upgrade 10,000 iteration hash to 210,000 iterations on login', async () => {
    const password = 'mysecretpassword';
    const salt = crypto.randomBytes(16).toString('hex');
    const legacyIterations = 10000;
    const keylen = 64;
    const digest = 'sha512';
    const hash = crypto.pbkdf2Sync(password, salt, legacyIterations, keylen, digest).toString('hex');

    // Set legacy password in config
    mockConfig.WebUIPassword = `pbkdf2:${digest}:${legacyIterations}:${salt}:${hash}`;

    // Login
    const result = await authManager.validateLogin({
      password: password,
      rememberMe: false,
    });

    expect(result.success).toBe(true);

    // Verify upgrade happened
    expect(mockConfigManager.set).toHaveBeenCalledTimes(1);
    const setCall = mockConfigManager.set.mock.calls[0];
    expect(setCall[0]).toBe('WebUIPassword');

    const newHash = setCall[1];
    // Expected to fail initially until we implement the fix
    expect(newHash).toMatch(/^pbkdf2:sha512:210000:/);

    // Verify the new hash is actually valid for the password
    const parts = newHash.split(':');
    const newIterations = parseInt(parts[2], 10);
    const newSalt = parts[3];
    const newDigestHash = parts[4];

    expect(newIterations).toBe(210000);

    const verifyHash = crypto.pbkdf2Sync(password, newSalt, newIterations, keylen, digest).toString('hex');
    expect(newDigestHash).toBe(verifyHash);
  });
});
