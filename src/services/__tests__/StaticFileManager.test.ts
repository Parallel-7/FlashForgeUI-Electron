/**
 * @fileoverview Unit tests for StaticFileManager service
 *
 * Validates static file path resolution, asset validation, and environment-aware resource
 * management. Tests ensure correct behavior across development and production builds,
 * proper handling of missing or inaccessible assets, and accurate manifest generation.
 *
 * Key Features Tested:
 * - Singleton pattern implementation and instance management
 * - Environment-aware path resolution (main HTML, renderer bundle, preload script)
 * - Asset type-specific path generation (HTML, CSS, JS, icons, images)
 * - File validation including existence, accessibility, and metadata checks
 * - Critical asset validation with comprehensive error reporting
 * - Asset manifest generation for deployment verification
 * - Graceful handling of file system errors and permission issues
 *
 * @module services/__tests__/StaticFileManager.test
 */

import { StaticFileManager, getStaticFileManager } from '../StaticFileManager';
import { getEnvironmentDetectionService } from '../EnvironmentDetectionService';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock the EnvironmentDetectionService
jest.mock('../EnvironmentDetectionService');

// Mock fs/promises
jest.mock('fs/promises');

const mockEnvironmentService = {
  getWebUIPath: jest.fn(),
  getAssetsPath: jest.fn(),
  getStaticPath: jest.fn(),
  getPreloadPath: jest.fn(),
  getDiagnosticInfo: jest.fn()
};

const mockFs = fs as jest.Mocked<typeof fs>;

describe('StaticFileManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (StaticFileManager as any).instance = null;
    
    // Setup default mock returns
    (getEnvironmentDetectionService as jest.Mock).mockReturnValue(mockEnvironmentService);
    
    mockEnvironmentService.getWebUIPath.mockReturnValue('/app/dist/renderer/index.html');
    mockEnvironmentService.getAssetsPath.mockReturnValue('/app/dist/renderer');
    mockEnvironmentService.getStaticPath.mockReturnValue('/app/dist/static');
    mockEnvironmentService.getPreloadPath.mockReturnValue('/app/lib/preload.js');
    mockEnvironmentService.getDiagnosticInfo.mockReturnValue({
      environment: 'development',
      isPackaged: false
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = getStaticFileManager();
      const instance2 = getStaticFileManager();
      const instance3 = StaticFileManager.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
    });
  });

  describe('Path Resolution', () => {
    let manager: StaticFileManager;

    beforeEach(() => {
      manager = getStaticFileManager();
    });

    it('should return correct main HTML path', () => {
      const htmlPath = manager.getMainHTMLPath();
      expect(htmlPath).toBe('/app/dist/renderer/index.html');
      expect(mockEnvironmentService.getWebUIPath).toHaveBeenCalled();
    });

    it('should return correct renderer bundle path', () => {
      const bundlePath = manager.getRendererBundlePath();
      expect(bundlePath).toBe(path.join('/app/dist/renderer', 'renderer.bundle.js'));
    });

    it('should return correct preload script path', () => {
      const preloadPath = manager.getPreloadScriptPath();
      expect(preloadPath).toBe('/app/lib/preload.js');
      expect(mockEnvironmentService.getPreloadPath).toHaveBeenCalled();
    });

    it('should generate asset paths based on type', () => {
      const htmlPath = manager.getAssetPath('test.html', 'html');
      const cssPath = manager.getAssetPath('test.css', 'css');
      const jsPath = manager.getAssetPath('test.js', 'js');
      const iconPath = manager.getAssetPath('test.png', 'icon');
      
      expect(htmlPath).toBe(path.join('/app/dist/renderer', 'test.html'));
      expect(cssPath).toBe(path.join('/app/dist/renderer', 'test.css'));
      expect(jsPath).toBe(path.join('/app/dist/renderer', 'test.js'));
      expect(iconPath).toBe(path.join('/app/dist/static', 'test.png'));
    });

    it('should handle absolute paths correctly', () => {
      const absolutePath = '/absolute/path/to/file.html';
      const result = manager.getAssetPath(absolutePath, 'html');
      
      expect(result).toBe(absolutePath);
    });
  });

  describe('Asset Validation', () => {
    let manager: StaticFileManager;

    beforeEach(() => {
      manager = getStaticFileManager();
    });

    it('should validate existing and accessible asset', async () => {
      const mockStats = {
        size: 1024,
        mtime: new Date('2023-01-01')
      };
      
      mockFs.stat.mockResolvedValue(mockStats as any);
      mockFs.access.mockResolvedValue(undefined);
      
      const result = await manager.validateAsset('/test/path/file.html');
      
      expect(result).toEqual({
        path: '/test/path/file.html',
        exists: true,
        isAccessible: true,
        size: 1024,
        lastModified: mockStats.mtime
      });
    });

    it('should handle missing asset', async () => {
      const error = new Error('ENOENT: no such file or directory');
      mockFs.stat.mockRejectedValue(error);
      
      const result = await manager.validateAsset('/test/path/missing.html');
      
      expect(result).toEqual({
        path: '/test/path/missing.html',
        exists: false,
        isAccessible: false,
        error: 'ENOENT: no such file or directory'
      });
    });

    it('should handle existing but inaccessible asset', async () => {
      const mockStats = {
        size: 1024,
        mtime: new Date('2023-01-01')
      };
      const accessError = new Error('EACCES: permission denied');
      
      mockFs.stat.mockResolvedValue(mockStats as any);
      mockFs.access.mockRejectedValue(accessError);
      
      const result = await manager.validateAsset('/test/path/restricted.html');
      
      expect(result).toEqual({
        path: '/test/path/restricted.html',
        exists: true,
        isAccessible: false,
        size: 1024,
        lastModified: mockStats.mtime,
        error: 'File exists but is not readable: EACCES: permission denied'
      });
    });

    it('should validate multiple assets in parallel', async () => {
      const mockStats = { size: 1024, mtime: new Date('2023-01-01') };
      
      mockFs.stat.mockResolvedValue(mockStats as any);
      mockFs.access.mockResolvedValue(undefined);
      
      const paths = ['/path1/file1.html', '/path2/file2.css', '/path3/file3.js'];
      const results = await manager.validateAssets(paths);
      
      expect(results).toHaveLength(3);
      expect(mockFs.stat).toHaveBeenCalledTimes(3);
      expect(mockFs.access).toHaveBeenCalledTimes(3);
      
      results.forEach((result, index) => {
        expect(result.path).toBe(paths[index]);
        expect(result.exists).toBe(true);
        expect(result.isAccessible).toBe(true);
      });
    });
  });

  describe('Critical Asset Validation', () => {
    let manager: StaticFileManager;

    beforeEach(() => {
      manager = getStaticFileManager();
    });

    it('should validate critical assets successfully', async () => {
      const mockStats = { size: 1024, mtime: new Date('2023-01-01') };
      
      mockFs.stat.mockResolvedValue(mockStats as any);
      mockFs.access.mockResolvedValue(undefined);
      
      const summary = await manager.validateCriticalAssets();
      
      expect(summary.totalAssets).toBe(3); // HTML, bundle, preload
      expect(summary.validAssets).toBe(3);
      expect(summary.missingAssets).toHaveLength(0);
      expect(summary.inaccessibleAssets).toHaveLength(0);
      expect(summary.errors).toHaveLength(0);
      expect(summary.isValid).toBe(true);
    });

    it('should handle missing critical assets', async () => {
      const error = new Error('ENOENT: no such file or directory');
      mockFs.stat.mockRejectedValue(error);
      
      const summary = await manager.validateCriticalAssets();
      
      expect(summary.totalAssets).toBe(3);
      expect(summary.validAssets).toBe(0);
      expect(summary.missingAssets).toHaveLength(3);
      expect(summary.isValid).toBe(false);
      expect(summary.errors).toHaveLength(3);
    });
  });

  describe('Convenience Methods', () => {
    let manager: StaticFileManager;

    beforeEach(() => {
      manager = getStaticFileManager();
    });

    it('should check main HTML availability', async () => {
      const mockStats = { size: 1024, mtime: new Date('2023-01-01') };
      
      mockFs.stat.mockResolvedValue(mockStats as any);
      mockFs.access.mockResolvedValue(undefined);
      
      const isAvailable = await manager.isMainHTMLAvailable();
      
      expect(isAvailable).toBe(true);
      expect(mockFs.stat).toHaveBeenCalledWith('/app/dist/renderer/index.html');
    });

    it('should check renderer bundle availability', async () => {
      const mockStats = { size: 1024, mtime: new Date('2023-01-01') };
      
      mockFs.stat.mockResolvedValue(mockStats as any);
      mockFs.access.mockResolvedValue(undefined);
      
      const isAvailable = await manager.isRendererBundleAvailable();
      
      expect(isAvailable).toBe(true);
      expect(mockFs.stat).toHaveBeenCalledWith(path.join('/app/dist/renderer', 'renderer.bundle.js'));
    });

    it('should check preload script availability', async () => {
      const mockStats = { size: 1024, mtime: new Date('2023-01-01') };
      
      mockFs.stat.mockResolvedValue(mockStats as any);
      mockFs.access.mockResolvedValue(undefined);
      
      const isAvailable = await manager.isPreloadScriptAvailable();
      
      expect(isAvailable).toBe(true);
      expect(mockFs.stat).toHaveBeenCalledWith('/app/lib/preload.js');
    });
  });

  describe('Asset Manifest', () => {
    let manager: StaticFileManager;

    beforeEach(() => {
      manager = getStaticFileManager();
    });

    it('should generate correct asset manifest', () => {
      const manifest = manager.getAssetManifest();
      
      expect(manifest).toEqual({
        html: {
          main: '/app/dist/renderer/index.html'
        },
        css: [
          path.join('/app/dist/renderer', 'styles.css'),
          path.join('/app/dist/renderer', 'main.css')
        ],
        js: [path.join('/app/dist/renderer', 'renderer.bundle.js')],
        icons: [
          path.join('/app/dist/renderer', 'icon.png'),
          path.join('/app/dist/renderer', 'icon.ico'),
          path.join('/app/dist/renderer', 'icon.icns')
        ],
        fonts: [],
        images: []
      });
    });
  });

  describe('Path Resolution with Validation', () => {
    let manager: StaticFileManager;

    beforeEach(() => {
      manager = getStaticFileManager();
    });

    it('should resolve asset path with validation', async () => {
      const mockStats = { size: 1024, mtime: new Date('2023-01-01') };
      
      mockFs.stat.mockResolvedValue(mockStats as any);
      mockFs.access.mockResolvedValue(undefined);
      
      const result = await manager.resolveAssetPath('test.html', 'html');
      
      expect(result.resolvedPath).toBe(path.join('/app/dist/renderer', 'test.html'));
      expect(result.exists).toBe(true);
      expect(result.isAccessible).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Diagnostic Information', () => {
    let manager: StaticFileManager;

    beforeEach(() => {
      manager = getStaticFileManager();
    });

    it('should provide comprehensive diagnostic information', () => {
      const diagnostics = manager.getDiagnosticInfo();
      
      expect(diagnostics).toHaveProperty('environment');
      expect(diagnostics).toHaveProperty('isPackaged');
      expect(diagnostics).toHaveProperty('staticFileConfig');
      expect(diagnostics).toHaveProperty('assetManifest');
      expect(diagnostics).toHaveProperty('environmentPaths');
      
      expect(mockEnvironmentService.getDiagnosticInfo).toHaveBeenCalled();
    });
  });
});