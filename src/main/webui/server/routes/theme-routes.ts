/**
 * @fileoverview WebUI theme configuration routes.
 */

import { sanitizeTheme } from '@shared/types/config.js';
import { StandardAPIResponse } from '@shared/types/web-api.types.js';
import type { Response, Router } from 'express';
import { toAppError } from '../../../utils/error.utils.js';
import {
  createValidationError,
  ThemeProfileOperationSchema,
} from '../../schemas/web-api.schemas.js';
import type { AuthenticatedRequest } from '../auth-middleware.js';
import type { RouteDependencies } from './route-helpers.js';

export function registerPublicThemeRoutes(router: Router, deps: RouteDependencies): void {
  router.get('/api/webui/theme', async (_req, res: Response) => {
    try {
      const config = deps.configManager.getConfig();
      return res.json(config.WebUITheme);
    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message,
      };
      return res.status(500).json(response);
    }
  });

  router.get('/api/webui/theme/profiles', async (_req, res: Response) => {
    try {
      const config = deps.configManager.getConfig();
      return res.json(config.webUIThemeProfiles);
    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message,
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
        WebUITheme: sanitizedTheme,
      });

      const response: StandardAPIResponse = {
        success: true,
        message: 'WebUI theme updated successfully',
      };
      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message,
      };
      return res.status(500).json(response);
    }
  });

  router.post('/webui/theme/profiles', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = ThemeProfileOperationSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        return res.status(400).json({
          success: false,
          error: validationError.error,
          details: validationError.details,
        });
      }

      const { operation, data } = validation.data;
      const configManager = deps.configManager;

      switch (operation) {
        case 'add': {
          configManager.addThemeProfile('web', data.name, data.colors);
          break;
        }
        case 'update': {
          configManager.updateThemeProfile('web', data.originalName, data.updatedProfile);
          break;
        }
        case 'delete': {
          configManager.deleteThemeProfile('web', data.name);
          break;
        }
      }

      return res.json({ success: true, message: `Profile ${operation}ed successfully` });
    } catch (error) {
      const appError = toAppError(error);
      return res.status(500).json({ success: false, error: appError.message });
    }
  });
}
