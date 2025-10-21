/**
 * @fileoverview Authentication middleware for filament tracker integration API.
 *
 * Provides optional API key authentication for the filament tracker integration
 * endpoints. When enabled, validates the x-api-key header against the configured
 * API key. Also enforces that the integration is enabled before allowing requests.
 */

import type { Request, Response, NextFunction } from 'express';
import { getConfigManager } from '../../managers/ConfigManager';

/**
 * Creates authentication middleware for filament tracker API endpoints.
 *
 * Validates:
 * 1. That FilamentTrackerIntegrationEnabled is true (returns 503 if disabled)
 * 2. If FilamentTrackerAPIKey is set, validates x-api-key header (returns 401 if invalid)
 *
 * @returns Express middleware function
 */
export function createFilamentTrackerAuth() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const config = getConfigManager();

    // Check if integration is enabled
    if (!config.get('FilamentTrackerIntegrationEnabled')) {
      res.status(503).json({
        success: false,
        error: 'Filament tracker integration disabled'
      });
      return;
    }

    // Check API key if configured
    const apiKey = config.get('FilamentTrackerAPIKey');
    if (apiKey) {
      const providedKey = req.headers['x-api-key'];
      if (providedKey !== apiKey) {
        res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
        return;
      }
    }

    // All checks passed, proceed
    next();
  };
}

