/**
 * @fileoverview Printer control route registrations (movement, job control, LEDs, status operations).
 */

import type { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../auth-middleware';
import { FiveMClient } from '@ghosttypes/ff-api';
import { toAppError } from '../../../utils/error.utils';
import { StandardAPIResponse } from '../../types/web-api.types';
import { resolveContext, sendErrorResponse, type RouteDependencies } from './route-helpers';

type JobControlExecutor = (contextId: string) => Promise<{ success: boolean; error?: string }>;

interface JobControlRoute {
  readonly path: string;
  readonly executor: JobControlExecutor;
  readonly successMessage: string;
}

export function registerPrinterControlRoutes(router: Router, deps: RouteDependencies): void {
  const controlRoutes: readonly JobControlRoute[] = [
    {
      path: '/printer/control/home',
      executor: async contextId =>
        deps.backendManager.executeGCodeCommand(contextId, '~G28'),
      successMessage: 'Homing axes...'
    },
    {
      path: '/printer/control/pause',
      executor: async contextId => deps.backendManager.pauseJob(contextId),
      successMessage: 'Print paused'
    },
    {
      path: '/printer/control/resume',
      executor: async contextId => deps.backendManager.resumeJob(contextId),
      successMessage: 'Print resumed'
    },
    {
      path: '/printer/control/cancel',
      executor: async contextId => deps.backendManager.cancelJob(contextId),
      successMessage: 'Print cancelled'
    }
  ];

  controlRoutes.forEach(route => {
    router.post(route.path, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const contextResult = resolveContext(req, deps, { requireBackendReady: true });
        if (!contextResult.success) {
          return sendErrorResponse<StandardAPIResponse>(
            res,
            contextResult.statusCode,
            contextResult.error
          );
        }

        const result = await route.executor(contextResult.contextId);
        const response: StandardAPIResponse = {
          success: result.success,
          message: result.success ? route.successMessage : undefined,
          error: result.error
        };
        return res.status(result.success ? 200 : 500).json(response);
      } catch (error) {
        const appError = toAppError(error);
        return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
      }
    });
  });

  router.post('/printer/control/led-on', async (req: AuthenticatedRequest, res: Response) => {
    await handleLedControl(req, res, deps, true);
  });

  router.post('/printer/control/led-off', async (req: AuthenticatedRequest, res: Response) => {
    await handleLedControl(req, res, deps, false);
  });

  router.post('/printer/control/clear-status', async (req: AuthenticatedRequest, res: Response) => {
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

      const backend = contextResult.backend;
      if (!backend) {
        return sendErrorResponse<StandardAPIResponse>(res, 503, 'Backend not available');
      }

      const features = contextResult.backend.getBackendStatus().features;
      if (!features?.statusMonitoring.usesNewAPI) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          400,
          'Clear status not supported on legacy printers'
        );
      }

      const primaryClient = contextResult.backend.getPrimaryClient();
      if (!(primaryClient instanceof FiveMClient)) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          400,
          'Clear status requires new API client'
        );
      }

      const result = await primaryClient.jobControl.clearPlatform();
      const response: StandardAPIResponse = {
        success: result,
        message: result ? 'Status cleared' : 'Error clearing status'
      };
      return res.status(result ? 200 : 500).json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });
}

async function handleLedControl(
  req: AuthenticatedRequest,
  res: Response,
  deps: RouteDependencies,
  enabled: boolean
): Promise<Response | void> {
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
    if (!deps.backendManager.isFeatureAvailable(contextId, 'led-control')) {
      return sendErrorResponse<StandardAPIResponse>(
        res,
        400,
        'LED control not available on this printer'
      );
    }

    const result = await backend.setLedEnabled(enabled);
    const response: StandardAPIResponse = {
      success: result.success,
      message: result.success ? `LED turned ${enabled ? 'on' : 'off'}` : undefined,
      error: result.error
    };
    return res.status(result.success ? 200 : 500).json(response);
  } catch (error) {
    const appError = toAppError(error);
    return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
  }
}
