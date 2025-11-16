/**
 * @fileoverview Filtration (AD5M Pro) control routes for the WebUI server.
 */

import type { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../auth-middleware';
import { FiveMClient } from '@ghosttypes/ff-api';
import { toAppError } from '../../../utils/error.utils';
import { StandardAPIResponse } from '../../types/web-api.types';
import { resolveContext, sendErrorResponse, type RouteDependencies } from './route-helpers';

type FiltrationAction = 'setExternalFiltrationOn' | 'setInternalFiltrationOn' | 'setFiltrationOff';

interface FiltrationRouteConfig {
  readonly path: string;
  readonly action: FiltrationAction;
  readonly successMessage: string;
}

export function registerFiltrationRoutes(router: Router, deps: RouteDependencies): void {
  const routes: readonly FiltrationRouteConfig[] = [
    {
      path: '/printer/filtration/external',
      action: 'setExternalFiltrationOn',
      successMessage: 'External filtration enabled'
    },
    {
      path: '/printer/filtration/internal',
      action: 'setInternalFiltrationOn',
      successMessage: 'Internal filtration enabled'
    },
    {
      path: '/printer/filtration/off',
      action: 'setFiltrationOff',
      successMessage: 'Filtration turned off'
    }
  ];

  routes.forEach(route => {
    router.post(route.path, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const contextResult = resolveContext(req, deps, {
          requireBackendReady: true,
          requireBackendInstance: true
        });
        if (!contextResult.success) {
          return sendErrorResponse<StandardAPIResponse>(
            res,
            contextResult.statusCode,
            contextResult.error
          );
        }

        const { contextId, backend } = contextResult;
        if (!backend) {
          return sendErrorResponse<StandardAPIResponse>(res, 503, 'Backend not available');
        }

        if (!deps.backendManager.isFeatureAvailable(contextId, 'filtration')) {
          return sendErrorResponse<StandardAPIResponse>(
            res,
            400,
            'Filtration control not available on this printer'
          );
        }

        const primaryClient = backend.getPrimaryClient();
        if (!(primaryClient instanceof FiveMClient)) {
          return sendErrorResponse<StandardAPIResponse>(
            res,
            400,
            'Filtration control requires new API client'
          );
        }

        const result = await primaryClient.control[route.action]();
        const response: StandardAPIResponse = {
          success: result,
          message: result ? route.successMessage : undefined,
          error: result ? undefined : 'Failed to update filtration state'
        };
        return res.status(result ? 200 : 500).json(response);
      } catch (error) {
        const appError = toAppError(error);
        return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
      }
    });
  });
}
