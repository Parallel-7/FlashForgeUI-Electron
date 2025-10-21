/**
 * @fileoverview StaticFileManager provides centralized management of static file path resolution
 * and asset validation for the Electron application.
 *
 * This service builds on the EnvironmentDetectionService to provide environment-aware path generation
 * for HTML, CSS, JavaScript, and other static assets. It ensures reliable asset loading across
 * development and production environments by validating file existence and accessibility before
 * attempting to load them into BrowserWindows. The service maintains a manifest of critical assets
 * and provides comprehensive validation capabilities with detailed error reporting.
 *
 * Key Features:
 * - Environment-aware path resolution leveraging EnvironmentDetectionService
 * - Asset type categorization (html, css, js, icon, image, font, other)
 * - Comprehensive asset validation including existence and accessibility checks
 * - Batch validation with parallel processing for multiple assets
 * - Asset manifest generation for all configured static files
 * - Validation summary with detailed error reporting for missing/inaccessible assets
 * - Critical asset validation for application startup requirements
 * - Diagnostic information export for debugging and troubleshooting
 * - Singleton pattern ensuring consistent configuration across the application
 *
 * Core Responsibilities:
 * - Resolve static file paths based on environment (development vs. production)
 * - Validate asset existence and file system accessibility before loading
 * - Maintain configuration of all static assets including HTML, CSS, JS, icons, and preload scripts
 * - Provide type-safe asset path generation with branded types for security
 * - Generate asset manifests for runtime introspection and validation
 * - Track critical assets required for application startup (main HTML, renderer bundle, preload script)
 * - Provide diagnostic information for debugging asset loading issues
 *
 * Asset Types:
 * - html: HTML template files for windows (main window, dialogs, etc.)
 * - css: Stylesheet files for UI styling
 * - js: JavaScript bundles (renderer bundles, preload scripts)
 * - icon: Application icons for different platforms (.png, .ico, .icns)
 * - image: Image assets used in the UI
 * - font: Font files for text rendering
 * - other: Miscellaneous static assets
 *
 * Validation Results:
 * - exists: Whether the file exists on the file system
 * - isAccessible: Whether the file is readable by the application
 * - size: File size in bytes (if accessible)
 * - lastModified: Last modification timestamp (if accessible)
 * - error: Detailed error message if validation failed
 *
 * @exports StaticFileManager - Main service class for static file management
 * @exports getStaticFileManager - Singleton instance accessor
 * @exports AssetType - Type union for asset categorization
 * @exports AssetValidationResult - Type for asset validation results
 * @exports StaticFileConfig - Type for static file configuration
 * @exports AssetManifest - Type for asset manifest data
 * @exports ValidationSummary - Type for validation summary reports
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { getEnvironmentDetectionService, type PathResolutionResult } from './EnvironmentDetectionService';

/**
 * Types of static assets managed by the service
 */
type AssetType = 'html' | 'css' | 'js' | 'icon' | 'image' | 'font' | 'other';

/**
 * Asset validation result with detailed information
 */
interface AssetValidationResult {
  readonly path: string;
  readonly exists: boolean;
  readonly isAccessible: boolean;
  readonly size?: number;
  readonly lastModified?: Date;
  readonly error?: string;
}

/**
 * Static file configuration for different asset types
 */
interface StaticFileConfig {
  readonly mainHTML: string;
  readonly rendererBundle: string;
  readonly stylesheets: readonly string[];
  readonly icons: readonly string[];
  readonly preloadScript: string;
}

/**
 * Asset manifest containing all required static files
 */
interface AssetManifest {
  readonly html: {
    readonly main: string;
    readonly webui?: string;
  };
  readonly css: readonly string[];
  readonly js: readonly string[];
  readonly icons: readonly string[];
  readonly fonts: readonly string[];
  readonly images: readonly string[];
}

/**
 * Validation summary for a set of assets
 */
interface ValidationSummary {
  readonly totalAssets: number;
  readonly validAssets: number;
  readonly missingAssets: readonly string[];
  readonly inaccessibleAssets: readonly string[];
  readonly errors: readonly string[];
  readonly isValid: boolean;
}

/**
 * Service for managing static file paths and validation
 */
class StaticFileManager {
  private static instance: StaticFileManager | null = null;
  private readonly environmentService = getEnvironmentDetectionService();
  private readonly config: StaticFileConfig;

  private constructor() {
    this.config = this.buildStaticFileConfig();
  }

  /**
   * Get singleton instance of the static file manager
   */
  public static getInstance(): StaticFileManager {
    if (!StaticFileManager.instance) {
      StaticFileManager.instance = new StaticFileManager();
    }
    return StaticFileManager.instance;
  }

  /**
   * Build static file configuration based on environment
   */
  private buildStaticFileConfig(): StaticFileConfig {
    const assetsPath = this.environmentService.getAssetsPath();
    
    return {
      mainHTML: this.environmentService.getWebUIPath(),
      rendererBundle: path.join(assetsPath, 'renderer.bundle.js'),
      stylesheets: [
        path.join(assetsPath, 'styles.css'),
        path.join(assetsPath, 'main.css')
      ],
      icons: [
        path.join(assetsPath, 'icon.png'),
        path.join(assetsPath, 'icon.ico'),
        path.join(assetsPath, 'icon.icns')
      ],
      preloadScript: this.environmentService.getPreloadPath()
    };
  }

  /**
   * Get the path to the main HTML file
   */
  public getMainHTMLPath(): string {
    return this.config.mainHTML;
  }

  /**
   * Get the path to the renderer bundle
   */
  public getRendererBundlePath(): string {
    return this.config.rendererBundle;
  }

  /**
   * Get the path to the preload script
   */
  public getPreloadScriptPath(): string {
    return this.config.preloadScript;
  }

  /**
   * Get paths to all stylesheets
   */
  public getStylesheetPaths(): readonly string[] {
    return this.config.stylesheets;
  }

  /**
   * Get paths to all icons
   */
  public getIconPaths(): readonly string[] {
    return this.config.icons;
  }

  /**
   * Generate environment-aware path for any asset
   */
  public getAssetPath(relativePath: string, assetType: AssetType = 'other'): string {
    // Handle absolute paths
    if (path.isAbsolute(relativePath)) {
      return relativePath;
    }

    // Determine base path based on asset type
    let basePath: string;
    
    switch (assetType) {
      case 'html':
      case 'css':
      case 'js':
        basePath = this.environmentService.getAssetsPath();
        break;
      case 'icon':
      case 'image':
        basePath = this.environmentService.getStaticPath();
        break;
      default:
        basePath = this.environmentService.getAssetsPath();
    }

    return path.join(basePath, relativePath);
  }

  /**
   * Validate that a specific asset exists and is accessible
   */
  public async validateAsset(assetPath: string): Promise<AssetValidationResult> {
    try {
      const stats = await fs.stat(assetPath);
      
      // Check if file is accessible for reading
      try {
        await fs.access(assetPath, fs.constants.R_OK);
        
        return {
          path: assetPath,
          exists: true,
          isAccessible: true,
          size: stats.size,
          lastModified: stats.mtime
        };
      } catch (accessError) {
        return {
          path: assetPath,
          exists: true,
          isAccessible: false,
          size: stats.size,
          lastModified: stats.mtime,
          error: `File exists but is not readable: ${accessError instanceof Error ? accessError.message : 'Permission denied'}`
        };
      }
    } catch (statError) {
      return {
        path: assetPath,
        exists: false,
        isAccessible: false,
        error: statError instanceof Error ? statError.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate multiple assets in parallel
   */
  public async validateAssets(assetPaths: readonly string[]): Promise<readonly AssetValidationResult[]> {
    const validationPromises = assetPaths.map(assetPath => this.validateAsset(assetPath));
    return Promise.all(validationPromises);
  }

  /**
   * Validate all critical assets required for the application
   */
  public async validateCriticalAssets(): Promise<ValidationSummary> {
    const criticalAssets = [
      this.config.mainHTML,
      this.config.rendererBundle,
      this.config.preloadScript
    ];

    const results = await this.validateAssets(criticalAssets);
    
    return this.createValidationSummary(results);
  }

  /**
   * Validate all configured assets
   */
  public async validateAllAssets(): Promise<ValidationSummary> {
    const allAssets = [
      this.config.mainHTML,
      this.config.rendererBundle,
      this.config.preloadScript,
      ...this.config.stylesheets,
      ...this.config.icons
    ];

    const results = await this.validateAssets(allAssets);
    
    return this.createValidationSummary(results);
  }

  /**
   * Create validation summary from individual results
   */
  private createValidationSummary(results: readonly AssetValidationResult[]): ValidationSummary {
    const missingAssets: string[] = [];
    const inaccessibleAssets: string[] = [];
    const errors: string[] = [];
    let validAssets = 0;

    for (const result of results) {
      if (!result.exists) {
        missingAssets.push(result.path);
        if (result.error) {
          errors.push(`Missing: ${result.path} - ${result.error}`);
        }
      } else if (!result.isAccessible) {
        inaccessibleAssets.push(result.path);
        if (result.error) {
          errors.push(`Inaccessible: ${result.path} - ${result.error}`);
        }
      } else {
        validAssets++;
      }
    }

    return {
      totalAssets: results.length,
      validAssets,
      missingAssets,
      inaccessibleAssets,
      errors,
      isValid: missingAssets.length === 0 && inaccessibleAssets.length === 0
    };
  }

  /**
   * Check if the main HTML file is available
   */
  public async isMainHTMLAvailable(): Promise<boolean> {
    const result = await this.validateAsset(this.config.mainHTML);
    return result.exists && result.isAccessible;
  }

  /**
   * Check if the renderer bundle is available
   */
  public async isRendererBundleAvailable(): Promise<boolean> {
    const result = await this.validateAsset(this.config.rendererBundle);
    return result.exists && result.isAccessible;
  }

  /**
   * Check if the preload script is available
   */
  public async isPreloadScriptAvailable(): Promise<boolean> {
    const result = await this.validateAsset(this.config.preloadScript);
    return result.exists && result.isAccessible;
  }

  /**
   * Get asset manifest for the current environment
   */
  public getAssetManifest(): AssetManifest {
    return {
      html: {
        main: this.config.mainHTML
      },
      css: [...this.config.stylesheets],
      js: [this.config.rendererBundle],
      icons: [...this.config.icons],
      fonts: [], // Can be extended as needed
      images: [] // Can be extended as needed
    };
  }

  /**
   * Resolve asset path with validation (similar to EnvironmentDetectionService)
   */
  public async resolveAssetPath(relativePath: string, assetType: AssetType = 'other'): Promise<PathResolutionResult> {
    const resolvedPath = this.getAssetPath(relativePath, assetType);
    const validation = await this.validateAsset(resolvedPath);
    
    return {
      resolvedPath,
      exists: validation.exists,
      isAccessible: validation.isAccessible,
      error: validation.error
    };
  }

  /**
   * Get diagnostic information about static file configuration
   */
  public getDiagnosticInfo(): Record<string, unknown> {
    const envInfo = this.environmentService.getDiagnosticInfo();
    
    return {
      environment: envInfo.environment,
      isPackaged: envInfo.isPackaged,
      staticFileConfig: this.config,
      assetManifest: this.getAssetManifest(),
      environmentPaths: {
        webUI: this.environmentService.getWebUIPath(),
        assets: this.environmentService.getAssetsPath(),
        static: this.environmentService.getStaticPath(),
        preload: this.environmentService.getPreloadPath()
      }
    };
  }

  /**
   * Log static file manager information for debugging
   */
  public async logDiagnosticInfo(): Promise<void> {
    const info = this.getDiagnosticInfo();
    const validation = await this.validateCriticalAssets();
    
    console.log('=== Static File Manager ===');
    console.log(`Environment: ${info.environment}`);
    console.log(`Packaged: ${info.isPackaged}`);
    console.log('Critical Assets Validation:');
    console.log(`  Total: ${validation.totalAssets}`);
    console.log(`  Valid: ${validation.validAssets}`);
    console.log(`  Missing: ${validation.missingAssets.length}`);
    console.log(`  Inaccessible: ${validation.inaccessibleAssets.length}`);
    console.log(`  Overall Valid: ${validation.isValid}`);
    
    if (validation.missingAssets.length > 0) {
      console.log('Missing Assets:');
      validation.missingAssets.forEach(asset => console.log(`  - ${asset}`));
    }
    
    if (validation.errors.length > 0) {
      console.log('Errors:');
      validation.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('Static File Paths:');
    console.log(`  Main HTML: ${this.config.mainHTML}`);
    console.log(`  Renderer Bundle: ${this.config.rendererBundle}`);
    console.log(`  Preload Script: ${this.config.preloadScript}`);
    console.log('===============================');
  }
}

/**
 * Get the singleton instance of the static file manager
 */
export const getStaticFileManager = (): StaticFileManager => {
  return StaticFileManager.getInstance();
};

export {
  StaticFileManager,
  type AssetType,
  type AssetValidationResult,
  type StaticFileConfig,
  type AssetManifest,
  type ValidationSummary
};
