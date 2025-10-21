/**
 * @fileoverview Unit tests for EnvironmentDetectionService
 *
 * Comprehensive test suite validating environment detection, path resolution, and asset
 * validation functionality across development and production environments. Tests cover
 * singleton pattern implementation, packaged vs unpackaged detection, environment-aware
 * path generation, file system validation, and diagnostic information reporting.
 *
 * Key Features Tested:
 * - Singleton instance management and consistency
 * - Environment detection (development/production, packaged/unpackaged)
 * - Path resolution for WebUI, assets, static files, and preload scripts
 * - Asset existence and accessibility validation
 * - Critical asset validation with comprehensive error reporting
 * - Platform-specific path handling and diagnostic logging
 *
 * @module services/__tests__/EnvironmentDetectionService.test
 */

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  accessSync: jest.fn(),
  constants: {
    R_OK: 4
  }
}));

// Mock electron app module
const mockApp = {
  isPackaged: false,
  getAppPath: jest.fn(() => '/mock/app/path'),
};

// Mock electron
jest.mock('electron', () => ({
  app: mockApp
}));

import { EnvironmentDetectionService, getEnvironmentDetectionService } from '../EnvironmentDetectionService';

// Mock process properties
const originalProcess = process;

describe('EnvironmentDetectionService', () => {
  let service: EnvironmentDetectionService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset singleton instance
    (EnvironmentDetectionService as any).instance = null;
    
    // Mock process.resourcesPath
    Object.defineProperty(process, 'resourcesPath', {
      value: '/mock/resources/path',
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    // Restore original process
    Object.defineProperty(process, 'resourcesPath', {
      value: originalProcess.resourcesPath,
      writable: true,
      configurable: true
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = getEnvironmentDetectionService();
      const instance2 = getEnvironmentDetectionService();
      
      expect(instance1).toBe(instance2);
    });

    it('should return the same instance from getInstance method', () => {
      const instance1 = EnvironmentDetectionService.getInstance();
      const instance2 = EnvironmentDetectionService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Environment Detection', () => {
    beforeEach(() => {
      service = getEnvironmentDetectionService();
    });

    it('should detect development environment when NODE_ENV is not production', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Create new instance to pick up environment change
      (EnvironmentDetectionService as any).instance = null;
      service = getEnvironmentDetectionService();
      
      expect(service.isDevelopment()).toBe(true);
      expect(service.isProduction()).toBe(false);
      expect(service.getEnvironment()).toBe('development');
      
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should detect production environment when NODE_ENV is production', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      // Create new instance to pick up environment change
      (EnvironmentDetectionService as any).instance = null;
      service = getEnvironmentDetectionService();
      
      expect(service.isDevelopment()).toBe(false);
      expect(service.isProduction()).toBe(true);
      expect(service.getEnvironment()).toBe('production');
      
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should detect unpackaged state when app.isPackaged is false', () => {
      mockApp.isPackaged = false;
      
      // Create new instance to pick up packaging change
      (EnvironmentDetectionService as any).instance = null;
      service = getEnvironmentDetectionService();
      
      expect(service.isPackaged()).toBe(false);
      expect(service.getExecutionContext()).toBe('unpackaged');
    });

    it('should detect packaged state when app.isPackaged is true', () => {
      mockApp.isPackaged = true;
      
      // Create new instance to pick up packaging change
      (EnvironmentDetectionService as any).instance = null;
      service = getEnvironmentDetectionService();
      
      expect(service.isPackaged()).toBe(true);
      expect(service.getExecutionContext()).toBe('packaged');
    });
  });

  describe('Path Resolution', () => {
    beforeEach(() => {
      mockApp.isPackaged = false;
      mockApp.getAppPath.mockReturnValue('/mock/app/path');
      service = getEnvironmentDetectionService();
    });

    it('should provide correct paths for unpackaged environment', () => {
      const config = service.getConfig();
      
      expect(config.resourcePaths.webUI).toMatch(/dist[/\\]renderer[/\\]index\.html/);
      expect(config.resourcePaths.assets).toMatch(/dist[/\\]renderer/);
      expect(config.resourcePaths.preload).toMatch(/lib[/\\]preload\.js/);
    });

    it('should provide correct paths for packaged environment', () => {
      mockApp.isPackaged = true;
      
      // Create new instance to pick up packaging change
      (EnvironmentDetectionService as any).instance = null;
      service = getEnvironmentDetectionService();
      
      const config = service.getConfig();
      
      expect(config.resourcePaths.webUI).toMatch(/app[/\\]dist[/\\]renderer[/\\]index\.html/);
      expect(config.resourcePaths.assets).toMatch(/app[/\\]dist[/\\]renderer/);
      expect(config.resourcePaths.preload).toMatch(/app[/\\]lib[/\\]preload\.js/);
    });

    it('should resolve relative paths correctly', () => {
      const relativePath = 'test/file.js';
      const resolvedPath = service.getResourcePath(relativePath);
      
      expect(resolvedPath).toMatch(/test[/\\]file\.js/);
      expect(resolvedPath).not.toBe(relativePath); // Should be absolute
    });

    it('should return absolute paths unchanged', () => {
      const absolutePath = '/absolute/path/file.js';
      const resolvedPath = service.getResourcePath(absolutePath);
      
      expect(resolvedPath).toBe(absolutePath);
    });
  });

  describe('Asset Validation', () => {
    const fs = require('fs');

    beforeEach(() => {
      service = getEnvironmentDetectionService();
    });

    it('should validate existing and accessible assets', () => {
      fs.existsSync.mockReturnValue(true);
      fs.accessSync.mockImplementation(() => {}); // No error means accessible
      
      const result = service.resolveAssetPath('test-file.js');
      
      expect(result.exists).toBe(true);
      expect(result.isAccessible).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle non-existent assets', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = service.resolveAssetPath('non-existent-file.js');
      
      expect(result.exists).toBe(false);
      expect(result.isAccessible).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should handle inaccessible assets', () => {
      fs.existsSync.mockReturnValue(true);
      fs.accessSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const result = service.resolveAssetPath('inaccessible-file.js');
      
      expect(result.exists).toBe(true);
      expect(result.isAccessible).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should validate required assets', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.accessSync.mockImplementation(() => {}); // All accessible
      
      const validation = await service.validateRequiredAssets();
      
      expect(validation.valid).toBe(true);
      expect(validation.missingAssets).toHaveLength(0);
      expect(validation.errors).toHaveLength(0);
    });

    it('should report missing required assets', async () => {
      fs.existsSync.mockReturnValue(false); // All missing
      
      const validation = await service.validateRequiredAssets();
      
      expect(validation.valid).toBe(false);
      expect(validation.missingAssets.length).toBeGreaterThan(0);
    });
  });

  describe('Diagnostic Information', () => {
    beforeEach(() => {
      service = getEnvironmentDetectionService();
    });

    it('should provide comprehensive diagnostic information', () => {
      const diagnostics = service.getDiagnosticInfo();
      
      expect(diagnostics).toHaveProperty('environment');
      expect(diagnostics).toHaveProperty('isPackaged');
      expect(diagnostics).toHaveProperty('context');
      expect(diagnostics).toHaveProperty('nodeEnv');
      expect(diagnostics).toHaveProperty('platform');
      expect(diagnostics).toHaveProperty('appPath');
      expect(diagnostics).toHaveProperty('resourcesPath');
      expect(diagnostics).toHaveProperty('resourcePaths');
    });

    it('should log environment information without errors', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      service.logEnvironmentInfo();
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Environment Detection Service'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Path Getters', () => {
    beforeEach(() => {
      service = getEnvironmentDetectionService();
    });

    it('should provide web UI path', () => {
      const webUIPath = service.getWebUIPath();
      expect(webUIPath).toBeTruthy();
      expect(webUIPath).toContain('index.html');
    });

    it('should provide assets path', () => {
      const assetsPath = service.getAssetsPath();
      expect(assetsPath).toBeTruthy();
      expect(assetsPath).toContain('renderer');
    });

    it('should provide static path', () => {
      const staticPath = service.getStaticPath();
      expect(staticPath).toBeTruthy();
      expect(staticPath).toContain('static');
    });

    it('should provide preload path', () => {
      const preloadPath = service.getPreloadPath();
      expect(preloadPath).toBeTruthy();
      expect(preloadPath).toContain('preload.js');
    });
  });
});
