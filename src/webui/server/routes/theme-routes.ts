/**
 * @fileoverview WebUI theme configuration routes with profile management support.
 */

import type { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../auth-middleware';
import type { RouteDependencies } from './route-helpers';
import {
  sanitizeTheme,
  createCustomProfile,
  deleteCustomProfile,
  addCustomProfile,
  findProfileById,
} from '../../../types/config';
import { StandardAPIResponse } from '../../types/web-api.types';
import { toAppError } from '../../../utils/error.utils';

export function registerThemeRoutes(router: Router, deps: RouteDependencies): void {
  router.get('/webui/theme', async (_req: AuthenticatedRequest, res: Response) => {
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

  // Get all theme profiles and selected profile ID
  router.get('/webui/theme/profiles', async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const config = deps.configManager.getConfig();
      return res.json({
        profiles: config.ThemeProfiles || [],
        selectedProfileId: config.SelectedWebUIProfileId || 'default'
      });
    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  // Select a theme profile
  router.post('/webui/theme/profiles/select', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { profileId } = req.body;

      if (!profileId || typeof profileId !== 'string') {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Profile ID is required'
        };
        return res.status(400).json(response);
      }

      const currentConfig = deps.configManager.getConfig();
      const profiles = currentConfig.ThemeProfiles || [];
      const profile = findProfileById(profiles, profileId);

      if (!profile) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Profile not found'
        };
        return res.status(404).json(response);
      }

      // Update selected profile and theme
      deps.configManager.updateConfig({
        ...currentConfig,
        SelectedWebUIProfileId: profileId,
        WebUITheme: profile.colors
      });

      const response: StandardAPIResponse = {
        success: true,
        message: 'Profile selected successfully'
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

  // Create a new custom profile
  router.post('/webui/theme/profiles', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, colors } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Profile name is required'
        };
        return res.status(400).json(response);
      }

      if (!colors || typeof colors !== 'object') {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Profile colors are required'
        };
        return res.status(400).json(response);
      }

      const currentConfig = deps.configManager.getConfig();
      const currentProfiles = currentConfig.ThemeProfiles || [];

      const newProfile = createCustomProfile(name.trim(), colors);
      const updatedProfiles = addCustomProfile(currentProfiles, newProfile);

      // Update config with new profile and select it
      deps.configManager.updateConfig({
        ...currentConfig,
        ThemeProfiles: updatedProfiles,
        SelectedWebUIProfileId: newProfile.id,
        WebUITheme: newProfile.colors
      });

      const response: StandardAPIResponse = {
        success: true,
        message: 'Custom profile created successfully'
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

  // Delete a custom profile
  router.delete('/webui/theme/profiles/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Profile ID is required'
        };
        return res.status(400).json(response);
      }

      const currentConfig = deps.configManager.getConfig();
      const currentProfiles = currentConfig.ThemeProfiles || [];

      const updatedProfiles = deleteCustomProfile(currentProfiles, id);

      if (!updatedProfiles) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Cannot delete built-in profile or profile not found'
        };
        return res.status(400).json(response);
      }

      // If the deleted profile was selected, switch to default
      let newSelectedId = currentConfig.SelectedWebUIProfileId;
      let newTheme = currentConfig.WebUITheme;

      if (currentConfig.SelectedWebUIProfileId === id) {
        newSelectedId = 'default';
        const defaultProfile = findProfileById(updatedProfiles, 'default');
        if (defaultProfile) {
          newTheme = defaultProfile.colors;
        }
      }

      deps.configManager.updateConfig({
        ...currentConfig,
        ThemeProfiles: updatedProfiles,
        SelectedWebUIProfileId: newSelectedId,
        WebUITheme: newTheme
      });

      const response: StandardAPIResponse = {
        success: true,
        message: 'Profile deleted successfully'
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
