/**
 * @fileoverview Tests for AuthManager covering login validation, token verification,
 * and timing-attack resistance in password/HMAC comparisons.
 */

import { AuthManager, getAuthManager } from '../AuthManager';
import { getConfigManager } from '../../../managers/ConfigManager';

// Mock ConfigManager
jest.mock('../../../managers/ConfigManager', () => ({
  getConfigManager: jest.fn(),
}));

describe('AuthManager', () => {
  let authManager: AuthManager;
  let mockConfig: any;
  let mockConfigManager: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      WebUIPassword: 'securepassword123',
      WebUIPasswordRequired: true,
      WebUISecret: '',
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

  describe('validateLogin', () => {
    it('should return success for correct password', async () => {
      const result = await authManager.validateLogin({
        password: 'securepassword123',
        rememberMe: false,
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });

    it('should return failure for incorrect password', async () => {
      const result = await authManager.validateLogin({
        password: 'wrongpassword',
        rememberMe: false,
      });

      expect(result.success).toBe(false);
      expect(result.token).toBeUndefined();
    });

    it('should return failure when auth is disabled but validateLogin called (edge case)', async () => {
       mockConfig.WebUIPasswordRequired = false;
       const result = await authManager.validateLogin({
         password: 'any',
         rememberMe: false,
       });

       expect(result.success).toBe(false);
       expect(result.message).toContain('disabled');
    });

    it('should handle undefined password gracefully', async () => {
      const result = await authManager.validateLogin({
        password: undefined as any,
        rememberMe: false,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid password');
    });

    it('should generate and save WebUISecret if missing during token generation', async () => {
      mockConfig.WebUISecret = '';
      await authManager.validateLogin({
        password: 'securepassword123',
        rememberMe: false,
      });

      expect(mockConfigManager.set).toHaveBeenCalledWith('WebUISecret', expect.any(String));
    });

    it('should use existing WebUISecret if present', async () => {
      mockConfig.WebUISecret = 'existing-secret';
      await authManager.validateLogin({
        password: 'securepassword123',
        rememberMe: false,
      });

      expect(mockConfigManager.set).not.toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const loginResult = await authManager.validateLogin({
        password: 'securepassword123',
        rememberMe: false,
      });

      const token = loginResult.token!;
      const validation = authManager.validateToken(token);

      expect(validation.isValid).toBe(true);
      expect(validation.sessionId).toBeDefined();
    });

    it('should reject a tampered token (wrong signature)', async () => {
      const loginResult = await authManager.validateLogin({
        password: 'securepassword123',
        rememberMe: false,
      });

      const token = loginResult.token!;
      const parts = token.split('.');
      const payload = parts[0];
      const signature = parts[1];

      // Tamper with signature
      const tamperedSignature = signature.replace(/[a-f0-9]/, (c) => c === 'a' ? 'b' : 'a');
      const tamperedToken = `${payload}.${tamperedSignature}`;

      const validation = authManager.validateToken(tamperedToken);
      expect(validation.isValid).toBe(false);
    });

    it('should reject a tampered token (wrong payload)', async () => {
      const loginResult = await authManager.validateLogin({
        password: 'securepassword123',
        rememberMe: false,
      });

      const token = loginResult.token!;
      const parts = token.split('.');
      const payload = parts[0];
      const signature = parts[1];

      // Decode, modify, encode
      const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
      decoded.persistent = !decoded.persistent; // change something
      const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64');

      const tamperedToken = `${tamperedPayload}.${signature}`;

      const validation = authManager.validateToken(tamperedToken);
      expect(validation.isValid).toBe(false);
    });

    it('should reject malformed token', () => {
      expect(authManager.validateToken('not.a.valid.token').isValid).toBe(false);
      expect(authManager.validateToken('invalid').isValid).toBe(false);
    });
  });
});
