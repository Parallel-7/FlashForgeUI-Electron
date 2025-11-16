/**
 * @fileoverview Spoolman API service for filament inventory management
 *
 * Provides a REST API client for communicating with Spoolman servers to search for
 * spools, update filament usage, and test connectivity. Implements timeout handling,
 * error management, and proper request/response validation.
 *
 * Key Features:
 * - Search spools with flexible query parameters
 * - Update filament usage by weight or length (mutually exclusive)
 * - Connection testing with health check endpoint
 * - 10-second request timeout with abort controller
 * - Comprehensive error handling and logging
 *
 * API Documentation: https://github.com/Donkie/Spoolman
 * Base API Path: /api/v1/
 *
 * @module services/SpoolmanService
 */

import type {
  SpoolResponse,
  SpoolSearchQuery,
  SpoolUsageUpdate,
  SpoolmanConnectionTest,
} from '../types/spoolman';

/**
 * Service for interacting with Spoolman REST API
 */
export class SpoolmanService {
  private readonly baseUrl: string;
  private readonly timeout = 10000; // 10 second timeout

  /**
   * Create a new Spoolman service instance
   * @param serverUrl - Base URL of the Spoolman server (e.g., http://192.168.1.10:7912)
   */
  constructor(serverUrl: string) {
    // Ensure URL ends without trailing slash
    this.baseUrl = serverUrl.replace(/\/$/, '') + '/api/v1';
  }

  /**
   * Search for spools matching query parameters
   * @param query - Search parameters (filament name, material, vendor, etc.)
   * @returns Array of matching spools
   * @throws Error if request fails or server returns error
   */
  async searchSpools(query: SpoolSearchQuery): Promise<SpoolResponse[]> {
    const params = new URLSearchParams();

    // Build query params
    if (query['filament.name']) params.set('filament.name', query['filament.name']);
    if (query['filament.material']) params.set('filament.material', query['filament.material']);
    if (query['filament.vendor.name'])
      params.set('filament.vendor.name', query['filament.vendor.name']);
    if (query.location) params.set('location', query.location);
    if (query.limit) params.set('limit', query.limit.toString());
    if (query.offset) params.set('offset', query.offset.toString());
    if (query.sort) params.set('sort', query.sort);

    // Default: exclude archived spools
    params.set('allow_archived', query.allow_archived ? 'true' : 'false');

    const url = `${this.baseUrl}/spool?${params.toString()}`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as SpoolResponse[];
    } catch (error) {
      this.handleError('searchSpools', error);
      throw error;
    }
  }

  /**
   * Get a single spool by ID
   * @param spoolId - ID of the spool to fetch
   * @returns Spool object
   * @throws Error if spool not found or request fails
   */
  async getSpoolById(spoolId: number): Promise<SpoolResponse> {
    const url = `${this.baseUrl}/spool/${spoolId}`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Spool ${spoolId} not found`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as SpoolResponse;
    } catch (error) {
      this.handleError('getSpoolById', error);
      throw error;
    }
  }

  /**
   * Update filament usage for a spool
   * @param spoolId - ID of the spool to update
   * @param usage - Usage update (either use_weight OR use_length, never both)
   * @returns Updated spool object
   * @throws Error if validation fails or request fails
   */
  async updateUsage(spoolId: number, usage: SpoolUsageUpdate): Promise<SpoolResponse> {
    // Validate: cannot specify both weight and length
    if (usage.use_weight !== undefined && usage.use_length !== undefined) {
      throw new Error('Cannot specify both use_weight and use_length');
    }

    if (usage.use_weight === undefined && usage.use_length === undefined) {
      throw new Error('Must specify either use_weight or use_length');
    }

    const url = `${this.baseUrl}/spool/${spoolId}/use`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(usage),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Spool ${spoolId} not found - it may have been deleted`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as SpoolResponse;
    } catch (error) {
      this.handleError('updateUsage', error);
      throw error;
    }
  }

  /**
   * Test connection to Spoolman server
   * @returns Connection test result with success status and optional error message
   */
  async testConnection(): Promise<SpoolmanConnectionTest> {
    try {
      // Try to fetch first spool (limit=1) to test connectivity
      const url = `${this.baseUrl}/spool?limit=1`;
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      return {
        connected: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fetch with timeout using AbortController
   * @param url - URL to fetch
   * @param options - Fetch options
   * @returns Response object
   * @throws Error if timeout occurs or fetch fails
   */
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - check server URL and network');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Error handling and logging
   * @param method - Method name where error occurred
   * @param error - Error object
   */
  private handleError(method: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[SpoolmanService.${method}] Error:`, message);
  }
}
