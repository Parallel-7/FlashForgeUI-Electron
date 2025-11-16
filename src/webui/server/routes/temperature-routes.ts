/**
 * @fileoverview Temperature control API routes for the WebUI server.
 */

import type { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../auth-middleware';
import { TemperatureSetRequestSchema } from '../../schemas/web-api.schemas';
import { createValidationError } from '../../schemas/web-api.schemas';
import { toAppError } from '../../../utils/error.utils';
import { StandardAPIResponse } from '../../types/web-api.types';
import { resolveContext, sendErrorResponse, type RouteDependencies } from './route-helpers';

export function registerTemperatureRoutes(router: Router, deps: RouteDependencies): void {
  router.post('/printer/temperature/bed', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          contextResult.statusCode,
          contextResult.error
        );
      }

      const validation = TemperatureSetRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        return sendErrorResponse<StandardAPIResponse>(res, 400, validationError.error);
      }

      const temperature = Math.round(validation.data.temperature);
      const result = await deps.backendManager.executeGCodeCommand(
        contextResult.contextId,
        `~M140 S${temperature}`
      );

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? `Setting bed temperature to ${temperature}°C` : undefined,
        error: result.error
      };
      return res.status(result.success ? 200 : 500).json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });

  router.post('/printer/temperature/bed/off', async (req: AuthenticatedRequest, res: Response) => {
    await handleSimpleTemperatureCommand(req, res, deps, '~M140 S0', 'Bed heating turned off');
  });

  router.post('/printer/temperature/extruder', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          contextResult.statusCode,
          contextResult.error
        );
      }

      const validation = TemperatureSetRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        return sendErrorResponse<StandardAPIResponse>(res, 400, validationError.error);
      }

      const temperature = Math.round(validation.data.temperature);
      const result = await deps.backendManager.executeGCodeCommand(
        contextResult.contextId,
        `~M104 S${temperature}`
      );

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? `Setting extruder temperature to ${temperature}°C` : undefined,
        error: result.error
      };
      return res.status(result.success ? 200 : 500).json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });

  router.post(
    '/printer/temperature/extruder/off',
    async (req: AuthenticatedRequest, res: Response) => {
      await handleSimpleTemperatureCommand(req, res, deps, '~M104 S0', 'Extruder heating turned off');
    }
  );
}

async function handleSimpleTemperatureCommand(
  req: AuthenticatedRequest,
  res: Response,
  deps: RouteDependencies,
  command: string,
  successMessage: string
): Promise<Response | void> {
  try {
    const contextResult = resolveContext(req, deps, { requireBackendReady: true });
    if (!contextResult.success) {
      return sendErrorResponse<StandardAPIResponse>(
        res,
        contextResult.statusCode,
        contextResult.error
      );
    }

    const result = await deps.backendManager.executeGCodeCommand(
      contextResult.contextId,
      command
    );

    const response: StandardAPIResponse = {
      success: result.success,
      message: result.success ? successMessage : undefined,
      error: result.error
    };
    return res.status(result.success ? 200 : 500).json(response);
  } catch (error) {
    const appError = toAppError(error);
    return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
  }
}
