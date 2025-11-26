/**
 * @fileoverview WebUI theme configuration routes.
 */

import type { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../auth-middleware.js';
import type { RouteDependencies } from './route-helpers.js';
import {
  sanitizeTheme,
  ThemeProfileAddData,
  ThemeProfileUpdateData,
  ThemeProfileDeleteData,
} from '../../../types/config.js';
import { StandardAPIResponse } from '../../types/web-api.types.js';
import { toAppError } from '../../../utils/error.utils.js';

interface ThemeProfileOperationRequestBody {
  operation: 'add' | 'update' | 'delete';
  data: ThemeProfileAddData | ThemeProfileUpdateData | ThemeProfileDeleteData;
}

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

  router.get('/api/webui/theme/profiles', async (_req, res: Response) => {
    try {
      const config = deps.configManager.getConfig();
      return res.json(config.webUIThemeProfiles);
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

  router.post('/webui/theme/profiles', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { operation, data } = req.body as ThemeProfileOperationRequestBody;
      const configManager = deps.configManager;

      switch (operation) {
        case 'add': {
          const addData = data as ThemeProfileAddData;
          configManager.addThemeProfile('web', addData.name, addData.colors);
          break;
        }
        case 'update': {
          const updateData = data as ThemeProfileUpdateData;
          configManager.updateThemeProfile('web', updateData.originalName, updateData.updatedProfile);
          break;
        }
        case 'delete': {
          const deleteData = data as ThemeProfileDeleteData;
          configManager.deleteThemeProfile('web', deleteData.name);
          break;
        }
        default:
          return res.status(400).json({ success: false, error: 'Invalid operation' });
      }

      return res.json({ success: true, message: `Profile ${operation}ed successfully` });
    } catch (error) {
      const appError = toAppError(error);
      return res.status(500).json({ success: false, error: appError.message });
    }
  });
}
