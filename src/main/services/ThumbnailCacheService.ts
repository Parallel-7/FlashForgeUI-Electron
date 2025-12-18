/**
 * @fileoverview Persistent file-based cache service for printer job thumbnails
 *
 * Provides a robust file-based caching system for printer job thumbnails to minimize
 * network requests and improve UI responsiveness. Organizes cache by printer serial
 * number with MD5-hashed filenames for collision avoidance. Includes metadata tracking,
 * validation, and comprehensive cache management operations.
 *
 * Key Features:
 * - File-based persistence in Electron userData directory
 * - Per-printer cache organization with metadata tracking
 * - MD5 hashing of filenames to prevent collisions
 * - Base64 image storage with automatic data URL handling
 * - Cache validation and automatic cleanup of orphaned metadata
 * - Statistics reporting for cache monitoring
 * - Graceful error handling with detailed result types
 *
 * Cache Structure:
 * - Thumbnails/{printerSerial}/{fileNameHash}.png - Thumbnail images
 * - Thumbnails/{printerSerial}/metadata.json - Cache metadata and timestamps
 *
 * Singleton Pattern:
 * Access via getThumbnailCacheService() factory function.
 *
 * @module services/ThumbnailCacheService
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';

/**
 * Metadata for a cached thumbnail
 */
interface ThumbnailMetadata {
  readonly fileName: string;
  readonly hash: string;
  readonly cachedAt: number; // Unix timestamp
  readonly size: number; // File size in bytes
}

/**
 * Cache metadata collection
 */
interface CacheMetadata {
  version: number;
  entries: Record<string, ThumbnailMetadata>;
}

/**
 * Options for cache service
 */
interface CacheOptions {
  readonly basePath?: string;
}

/**
 * Result of cache operations
 */
interface CacheResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

/**
 * Service for managing thumbnail cache with file-based persistence
 */
export class ThumbnailCacheService {
  private static instance: ThumbnailCacheService | null = null;

  private readonly basePath: string;
  private readonly metadataCache = new Map<string, CacheMetadata>();

  private constructor(options: CacheOptions = {}) {
    // Use dedicated Thumbnails directory in userData to avoid cache conflicts
    this.basePath = options.basePath || path.join(app.getPath('userData'), 'Thumbnails');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options?: CacheOptions): ThumbnailCacheService {
    if (!ThumbnailCacheService.instance) {
      ThumbnailCacheService.instance = new ThumbnailCacheService(options);
    }
    return ThumbnailCacheService.instance;
  }

  /**
   * Initialize cache service and ensure directories exist
   */
  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      console.log(`ThumbnailCacheService initialized at: ${this.basePath}`);
    } catch (error) {
      console.error('Failed to initialize thumbnail cache:', error);
      throw error;
    }
  }

  /**
   * Get cached thumbnail if available
   */
  public async get(printerSerial: string, fileName: string): Promise<CacheResult<string>> {
    try {
      const hash = this.hashFileName(fileName);
      const metadata = await this.getMetadata(printerSerial);

      // Check if entry exists in metadata
      const entry = metadata.entries[hash];
      if (!entry) {
        return { success: false, error: 'Not in cache' };
      }

      // Read the cached file
      const filePath = this.getThumbnailPath(printerSerial, hash);
      const data = await fs.readFile(filePath, 'base64');

      console.log(`[ThumbnailCache] Cache hit for ${fileName} (${printerSerial})`);
      return { success: true, data };

    } catch (error) {
      console.error(`Error reading cached thumbnail for ${fileName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Store thumbnail in cache
   */
  public async set(printerSerial: string, fileName: string, base64Data: string): Promise<CacheResult<void>> {
    try {
      const hash = this.hashFileName(fileName);
      const printerDir = path.join(this.basePath, printerSerial);

      // Ensure printer directory exists
      await fs.mkdir(printerDir, { recursive: true });

      // Strip data URL prefix if present
      const imageData = base64Data.replace(/^data:image\/\w+;base64,/, '');

      // Write thumbnail file
      const filePath = this.getThumbnailPath(printerSerial, hash);
      const buffer = Buffer.from(imageData, 'base64');
      await fs.writeFile(filePath, buffer);

      // Update metadata
      const metadata = await this.getMetadata(printerSerial);
      metadata.entries[hash] = {
        fileName,
        hash,
        cachedAt: Date.now(),
        size: buffer.length
      };

      await this.saveMetadata(printerSerial, metadata);

      console.log(`[ThumbnailCache] Cached thumbnail for ${fileName} (${printerSerial})`);
      return { success: true };

    } catch (error) {
      console.error(`Error caching thumbnail for ${fileName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if thumbnail exists in cache (without reading the file)
   */
  public async has(printerSerial: string, fileName: string): Promise<boolean> {
    try {
      const hash = this.hashFileName(fileName);
      const metadata = await this.getMetadata(printerSerial);

      const entry = metadata.entries[hash];
      if (!entry) {
        return false;
      }

      // Verify file actually exists
      const filePath = this.getThumbnailPath(printerSerial, hash);
      try {
        await fs.access(filePath);
        return true;
      } catch {
        // File doesn't exist, clean up metadata
        delete metadata.entries[hash];
        await this.saveMetadata(printerSerial, metadata);
        return false;
      }

    } catch (error) {
      console.error(`Error checking cache for ${fileName}:`, error);
      return false;
    }
  }

  /**
   * Invalidate (remove) a specific thumbnail from cache
   */
  public async invalidate(printerSerial: string, fileName: string): Promise<void> {
    try {
      const hash = this.hashFileName(fileName);
      await this.removeEntry(printerSerial, hash);
      console.log(`[ThumbnailCache] Invalidated cache for ${fileName} (${printerSerial})`);
    } catch (error) {
      console.error(`Error invalidating cache for ${fileName}:`, error);
    }
  }

  /**
   * Clear all thumbnails for a specific printer
   */
  public async clearPrinter(printerSerial: string): Promise<void> {
    try {
      const printerDir = path.join(this.basePath, printerSerial);
      await fs.rm(printerDir, { recursive: true, force: true });
      this.metadataCache.delete(printerSerial);
      console.log(`[ThumbnailCache] Cleared all cache for printer ${printerSerial}`);
    } catch (error) {
      console.error(`Error clearing cache for printer ${printerSerial}:`, error);
    }
  }

  /**
   * Clear entire cache
   */
  public async clearAll(): Promise<void> {
    try {
      await fs.rm(this.basePath, { recursive: true, force: true });
      await fs.mkdir(this.basePath, { recursive: true });
      this.metadataCache.clear();
      console.log('[ThumbnailCache] Cleared entire cache');
    } catch (error) {
      console.error('Error clearing entire cache:', error);
    }
  }



  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    printerCount: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    try {
      let totalFiles = 0;
      let totalSize = 0;
      let oldestEntry: number | null = null;
      let newestEntry: number | null = null;

      const printers = await fs.readdir(this.basePath);
      const printerCount = printers.length;

      for (const printerSerial of printers) {
        const metadata = await this.getMetadata(printerSerial);

        for (const entry of Object.values(metadata.entries)) {
          totalFiles++;
          totalSize += entry.size;

          if (!oldestEntry || entry.cachedAt < oldestEntry) {
            oldestEntry = entry.cachedAt;
          }
          if (!newestEntry || entry.cachedAt > newestEntry) {
            newestEntry = entry.cachedAt;
          }
        }
      }

      return {
        totalFiles,
        totalSize,
        printerCount,
        oldestEntry,
        newestEntry
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        printerCount: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }
  }

  // Private helper methods

  /**
   * Generate hash for file name to use as cache key
   */
  private hashFileName(fileName: string): string {
    return crypto.createHash('md5').update(fileName).digest('hex');
  }

  /**
   * Get path to thumbnail file
   */
  private getThumbnailPath(printerSerial: string, hash: string): string {
    return path.join(this.basePath, printerSerial, `${hash}.png`);
  }

  /**
   * Get path to metadata file
   */
  private getMetadataPath(printerSerial: string): string {
    return path.join(this.basePath, printerSerial, 'metadata.json');
  }

  /**
   * Load metadata for a printer
   */
  private async getMetadata(printerSerial: string): Promise<CacheMetadata> {
    // Check memory cache first
    const cached = this.metadataCache.get(printerSerial);
    if (cached) {
      return cached;
    }

    try {
      const metadataPath = this.getMetadataPath(printerSerial);
      const data = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(data) as CacheMetadata;

      // Validate and migrate if needed
      if (!metadata.version || metadata.version < 1) {
        metadata.version = 1;
      }
      if (!metadata.entries) {
        metadata.entries = {};
      }

      this.metadataCache.set(printerSerial, metadata);
      return metadata;

    } catch {
      // Return empty metadata if file doesn't exist
      const emptyMetadata: CacheMetadata = {
        version: 1,
        entries: {}
      };
      this.metadataCache.set(printerSerial, emptyMetadata);
      return emptyMetadata;
    }
  }

  /**
   * Save metadata for a printer
   */
  private async saveMetadata(printerSerial: string, metadata: CacheMetadata): Promise<void> {
    const metadataPath = this.getMetadataPath(printerSerial);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    this.metadataCache.set(printerSerial, metadata);
  }

  /**
   * Remove a specific entry
   */
  private async removeEntry(printerSerial: string, hash: string): Promise<void> {
    // Remove file
    const filePath = this.getThumbnailPath(printerSerial, hash);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }

    // Update metadata
    const metadata = await this.getMetadata(printerSerial);
    delete metadata.entries[hash];
    await this.saveMetadata(printerSerial, metadata);
  }


}

/**
 * Get singleton instance of ThumbnailCacheService
 */
export function getThumbnailCacheService(): ThumbnailCacheService {
  return ThumbnailCacheService.getInstance();
}

