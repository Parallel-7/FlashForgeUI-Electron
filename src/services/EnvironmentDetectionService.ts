/**
 * @fileoverview Environment detection service for reliable Electron app environment and path resolution.
 *
 * Provides comprehensive environment detection and resource path management:
 * - Development vs production mode detection
 * - Packaged vs unpackaged execution context
 * - Appropriate resource path resolution for each environment
 * - WebUI static file path configuration
 * - Asset and preload script path management
 * - Environment-specific configuration
 *
 * Key exports:
 * - EnvironmentDetectionService class: Environment detection and path resolver
 * - getEnvironmentDetectionService(): Singleton accessor
 * - Environment/ExecutionContext types
 *
 * Essential for proper static file serving and asset loading across different deployment
 * scenarios. Handles the complexity of Electron's packaged vs development paths, ensuring
 * correct resource loading regardless of how the application is executed.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Environment types supported by the application
 */
type Environment = 'development' | 'production';

/**
 * Execution context information
 */
type ExecutionContext = 'packaged' | 'unpackaged';

/**
 * Resource path configuration for different environments
 */
interface ResourcePaths {
  readonly webUI: string;
  readonly assets: string;
  readonly static: string;
  readonly preload: string;
  readonly webUIStatic: string;
}

/**
 * Environment configuration containing all context information
 */
interface EnvironmentConfig {
  readonly mode: Environment;
  readonly isPackaged: boolean;
  readonly context: ExecutionContext;
  readonly resourcePaths: ResourcePaths;
  readonly appPath: string;
  readonly resourcesPath: string;
}

/**
 * Path resolution result with validation information
 */
interface PathResolutionResult {
  readonly resolvedPath: string;
  readonly exists: boolean;
  readonly isAccessible: boolean;
  readonly error?: string;
}

/**
 * Service for detecting environment and resolving resource paths
 */
class EnvironmentDetectionService {
  private static instance: EnvironmentDetectionService | null = null;
  private readonly config: EnvironmentConfig;

  private constructor() {
    this.config = this.detectEnvironment();
  }

  /**
   * Get singleton instance of the environment detection service
   */
  public static getInstance(): EnvironmentDetectionService {
    if (!EnvironmentDetectionService.instance) {
      EnvironmentDetectionService.instance = new EnvironmentDetectionService();
    }
    return EnvironmentDetectionService.instance;
  }

  /**
   * Detect the current environment and create configuration
   */
  private detectEnvironment(): EnvironmentConfig {
    const isPackaged = app.isPackaged;
    // Use packaging state as primary indicator - packaged apps are production
    const mode: Environment = isPackaged ? 'production' : 'development';
    const context: ExecutionContext = isPackaged ? 'packaged' : 'unpackaged';
    
    const appPath = app.getAppPath();
    const resourcesPath = process.resourcesPath || appPath;
    
    const resourcePaths = this.buildResourcePaths(isPackaged, appPath, resourcesPath);

    return {
      mode,
      isPackaged,
      context,
      resourcePaths,
      appPath,
      resourcesPath
    };
  }

  /**
   * Build resource paths based on packaging state
   */
  private buildResourcePaths(isPackaged: boolean, appPath: string, resourcesPath: string): ResourcePaths {
    if (isPackaged) {
      // In packaged mode, renderer files are in extraResources/renderer (not app.asar)
      // Main process files including preload are in app.asar (appPath)
      return {
        webUI: path.join(resourcesPath, 'renderer', 'index.html'),
        assets: path.join(resourcesPath, 'renderer'),
        static: path.join(resourcesPath, 'renderer'),
        preload: path.join(appPath, 'lib', 'preload.cjs'),
        webUIStatic: path.join(resourcesPath, 'webui', 'static')
      };
    } else {
      // In development mode, appPath is the project root, so use it directly
      return {
        webUI: path.join(appPath, 'dist', 'renderer', 'index.html'),
        assets: path.join(appPath, 'dist', 'renderer'),
        static: path.join(appPath, 'dist', 'static'),
        preload: path.join(appPath, 'lib', 'preload.cjs'),
        webUIStatic: path.join(appPath, 'dist', 'webui', 'static')
      };
    }
  }

  /**
   * Check if running in development mode
   */
  public isDevelopment(): boolean {
    return this.config.mode === 'development';
  }

  /**
   * Check if running in production mode
   */
  public isProduction(): boolean {
    return this.config.mode === 'production';
  }

  /**
   * Check if the application is packaged
   */
  public isPackaged(): boolean {
    return this.config.isPackaged;
  }

  /**
   * Get the current environment mode
   */
  public getEnvironment(): Environment {
    return this.config.mode;
  }

  /**
   * Get the execution context
   */
  public getExecutionContext(): ExecutionContext {
    return this.config.context;
  }

  /**
   * Get the complete environment configuration
   */
  public getConfig(): EnvironmentConfig {
    return { ...this.config };
  }

  /**
   * Get the path to the main web UI HTML file
   */
  public getWebUIPath(): string {
    return this.config.resourcePaths.webUI;
  }

  /**
   * Get the path to static assets directory
   */
  public getAssetsPath(): string {
    return this.config.resourcePaths.assets;
  }

  /**
   * Get the path to static files directory
   */
  public getStaticPath(): string {
    return this.config.resourcePaths.static;
  }

  /**
   * Get the path to the preload script
   */
  public getPreloadPath(): string {
    return this.config.resourcePaths.preload;
  }

  /**
   * Get the path to the webui static files directory
   */
  public getWebUIStaticPath(): string {
    return this.config.resourcePaths.webUIStatic;
  }

  /**
   * Resolve a relative path to an absolute resource path
   */
  public getResourcePath(relativePath: string): string {
    if (path.isAbsolute(relativePath)) {
      return relativePath;
    }

    if (this.config.isPackaged) {
      return path.join(this.config.resourcesPath, 'app', relativePath);
    } else {
      return path.join(this.config.appPath, relativePath);
    }
  }

  /**
   * Resolve an asset path with validation
   */
  public resolveAssetPath(relativePath: string): PathResolutionResult {
    const resolvedPath = path.join(this.config.resourcePaths.assets, relativePath);
    
    try {
      const exists = fs.existsSync(resolvedPath);
      let isAccessible = false;
      
      if (exists) {
        try {
          fs.accessSync(resolvedPath, fs.constants.R_OK);
          isAccessible = true;
        } catch {
          isAccessible = false;
        }
      }

      return {
        resolvedPath,
        exists,
        isAccessible
      };
    } catch (error) {
      return {
        resolvedPath,
        exists: false,
        isAccessible: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate that required assets exist and are accessible
   */
  public async validateRequiredAssets(): Promise<{ valid: boolean; missingAssets: string[]; errors: string[] }> {
    const requiredAssets = [
      'index.html',
      'renderer.bundle.js'
    ];

    const missingAssets: string[] = [];
    const errors: string[] = [];

    for (const asset of requiredAssets) {
      const result = this.resolveAssetPath(asset);
      
      if (!result.exists) {
        missingAssets.push(asset);
      } else if (!result.isAccessible) {
        errors.push(`Asset ${asset} exists but is not accessible: ${result.error || 'Permission denied'}`);
      }
    }

    // Also validate the main web UI path
    if (!fs.existsSync(this.getWebUIPath())) {
      missingAssets.push('Main web UI HTML file');
      errors.push(`Web UI path does not exist: ${this.getWebUIPath()}`);
    }

    return {
      valid: missingAssets.length === 0 && errors.length === 0,
      missingAssets,
      errors
    };
  }

  /**
   * Get diagnostic information about the current environment
   */
  public getDiagnosticInfo(): Record<string, unknown> {
    return {
      environment: this.config.mode,
      isPackaged: this.config.isPackaged,
      context: this.config.context,
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
      appPath: this.config.appPath,
      resourcesPath: this.config.resourcesPath,
      resourcePaths: this.config.resourcePaths,
      processArgv: process.argv,
      cwd: process.cwd(),
      execPath: process.execPath
    };
  }

  /**
   * Check if the application is running with administrator privileges on Windows
   */
  public isRunningAsAdmin(): boolean {
    if (process.platform !== 'win32') {
      // Non-Windows platforms don't need admin for web server
      return true;
    }

    try {
      // On Windows, try to write to the Windows directory
      // This is a reliable way to detect admin privileges
      const systemRoot = process.env.SystemRoot || 'C:\\Windows';
      const testFile = path.join(systemRoot, 'temp', `admin-test-${Date.now()}.tmp`);
      
      // Try to create a file in Windows\temp directory
      fs.writeFileSync(testFile, 'admin test');
      fs.unlinkSync(testFile);
      
      return true;
    } catch {
      // If we can't write to Windows\temp, we don't have admin privileges
      return false;
    }
  }

  /**
   * Log environment information for debugging
   */
  public logEnvironmentInfo(): void {
    const info = this.getDiagnosticInfo();
    console.log('=== Environment Detection Service ===');
    console.log(`Environment: ${info.environment}`);
    console.log(`Packaged: ${info.isPackaged}`);
    console.log(`Context: ${info.context}`);
    console.log(`Platform: ${process.platform}`);
    console.log(`Running as Admin: ${this.isRunningAsAdmin()}`);
    console.log(`App Path: ${info.appPath}`);
    console.log(`Resources Path: ${info.resourcesPath}`);
    console.log('Resource Paths:');
    console.log(`  Web UI: ${this.config.resourcePaths.webUI}`);
    console.log(`  Assets: ${this.config.resourcePaths.assets}`);
    console.log(`  Static: ${this.config.resourcePaths.static}`);
    console.log(`  Preload: ${this.config.resourcePaths.preload}`);
    console.log(`  WebUI Static: ${this.config.resourcePaths.webUIStatic}`);
    console.log('=====================================');
  }
}

/**
 * Get the singleton instance of the environment detection service
 */
export const getEnvironmentDetectionService = (): EnvironmentDetectionService => {
  return EnvironmentDetectionService.getInstance();
};

export {
  EnvironmentDetectionService,
  type Environment,
  type ExecutionContext,
  type ResourcePaths,
  type EnvironmentConfig,
  type PathResolutionResult
};
