/**
 * @fileoverview WebUI theme configuration routes.
 */

import type { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../auth-middleware';
import type { RouteDependencies } from './route-helpers';
import { sanitizeTheme } from '../../../types/config';
import { StandardAPIResponse } from '../../types/web-api.types';
import { toAppError } from '../../../utils/error.utils';

export function registerPublicThemeRoutes(router: Router, deps: RouteDependencies): void {
  router.get('/api/webui/theme', async (_req, res: Response) => {
    try {
      const config = deps.configManager.getConfig();
      return res.json(config.WebUITheme);
    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });
}

export function registerThemeRoutes(router: Router, deps: RouteDependencies): void {
  router.post('/webui/theme', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sanitizedTheme = sanitizeTheme(req.body);
      const currentConfig = deps.configManager.getConfig();
      deps.configManager.updateConfig({
        ...currentConfig,
        WebUITheme: sanitizedTheme
      });

      const response: StandardAPIResponse = {
        success: true,
        message: 'WebUI theme updated successfully'
      };
      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });
}
