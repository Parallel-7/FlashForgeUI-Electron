/**
 * @fileoverview Temperature control API routes for the WebUI server.
 */

import { StandardAPIResponse } from '@shared/types/web-api.types.js';
import type { Response, Router } from 'express';
import { toAppError } from '../../../utils/error.utils.js';
import { createValidationError, TemperatureSetRequestSchema } from '../../schemas/web-api.schemas.js';
import type { AuthenticatedRequest } from '../auth-middleware.js';
import { type RouteDependencies, resolveContext, sendErrorResponse } from './route-helpers.js';

export function registerTemperatureRoutes(router: Router, deps: RouteDependencies): void {
  router.post('/printer/temperature/bed', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(res, contextResult.statusCode, contextResult.error);
      }

      const validation = TemperatureSetRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        return sendErrorResponse<StandardAPIResponse>(res, 400, validationError.error);
      }

      const temperature = Math.round(validation.data.temperature);
      const result = await deps.backendManager.executeGCodeCommand(contextResult.contextId, `~M140 S${temperature}`);

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? `Setting bed temperature to ${temperature}°C` : undefined,
        error: result.error,
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
        return sendErrorResponse<StandardAPIResponse>(res, contextResult.statusCode, contextResult.error);
      }

      const validation = TemperatureSetRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        return sendErrorResponse<StandardAPIResponse>(res, 400, validationError.error);
      }

      const temperature = Math.round(validation.data.temperature);
      const result = await deps.backendManager.executeGCodeCommand(contextResult.contextId, `~M104 S${temperature}`);

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? `Setting extruder temperature to ${temperature}°C` : undefined,
        error: result.error,
      };
      return res.status(result.success ? 200 : 500).json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });

  router.post('/printer/temperature/extruder/off', async (req: AuthenticatedRequest, res: Response) => {
    await handleSimpleTemperatureCommand(req, res, deps, '~M104 S0', 'Extruder heating turned off');
  });

  // ----- Creator 5 series (multi-tool) heaters -------------------------------
  // These route through the FiveMClient temperature control API rather than raw
  // G-code, since the Creator 5 series is HTTP-only with no G-code passthrough.

  router.post('/printer/temperature/tool/:index', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(res, contextResult.statusCode, contextResult.error);
      }

      const toolIndex = Number.parseInt(req.params.index, 10);
      if (!Number.isInteger(toolIndex) || toolIndex < 0 || toolIndex >= MAX_TOOL_COUNT) {
        return sendErrorResponse<StandardAPIResponse>(res, 400, 'Invalid tool index');
      }

      const validation = TemperatureSetRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        return sendErrorResponse<StandardAPIResponse>(res, 400, validationError.error);
      }

      const temperature = Math.round(validation.data.temperature);
      const result = await deps.backendManager.setToolTemperature(contextResult.contextId, toolIndex, temperature);

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? `Setting tool T${toolIndex + 1} temperature to ${temperature}°C` : undefined,
        error: result.error,
      };
      return res.status(result.success ? 200 : 500).json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });

  router.post('/printer/temperature/tool/:index/off', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(res, contextResult.statusCode, contextResult.error);
      }

      const toolIndex = Number.parseInt(req.params.index, 10);
      if (!Number.isInteger(toolIndex) || toolIndex < 0 || toolIndex >= MAX_TOOL_COUNT) {
        return sendErrorResponse<StandardAPIResponse>(res, 400, 'Invalid tool index');
      }

      const result = await deps.backendManager.cancelToolTemperature(contextResult.contextId, toolIndex);
      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? `Tool T${toolIndex + 1} heating turned off` : undefined,
        error: result.error,
      };
      return res.status(result.success ? 200 : 500).json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });

  router.post('/printer/temperature/chamber', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(res, contextResult.statusCode, contextResult.error);
      }

      const validation = TemperatureSetRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        return sendErrorResponse<StandardAPIResponse>(res, 400, validationError.error);
      }

      // Clamp to the firmware chamber ceiling.
      const temperature = Math.min(Math.round(validation.data.temperature), CHAMBER_MAX_TEMP);
      const result = await deps.backendManager.setChamberTemperature(contextResult.contextId, temperature);

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? `Setting chamber temperature to ${temperature}°C` : undefined,
        error: result.error,
      };
      return res.status(result.success ? 200 : 500).json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });

  router.post('/printer/temperature/chamber/off', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(res, contextResult.statusCode, contextResult.error);
      }

      const result = await deps.backendManager.cancelChamberTemperature(contextResult.contextId);
      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? 'Chamber heating turned off' : undefined,
        error: result.error,
      };
      return res.status(result.success ? 200 : 500).json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });
}

/** Firmware chamber temperature ceiling (matches the desktop Creator 5 card). */
const CHAMBER_MAX_TEMP = 80;

/** Creator 5 series wire format is a fixed 4-nozzle array; valid tool indices are 0-3. */
const MAX_TOOL_COUNT = 4;

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
      return sendErrorResponse<StandardAPIResponse>(res, contextResult.statusCode, contextResult.error);
    }

    const result = await deps.backendManager.executeGCodeCommand(contextResult.contextId, command);

    const response: StandardAPIResponse = {
      success: result.success,
      message: result.success ? successMessage : undefined,
      error: result.error,
    };
    return res.status(result.success ? 200 : 500).json(response);
  } catch (error) {
    const appError = toAppError(error);
    return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
  }
}
