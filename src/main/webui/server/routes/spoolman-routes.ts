/**
 * @fileoverview Spoolman integration routes (config, search, active spool management).
 */

import type { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../auth-middleware.js';
import {
  SpoolmanConfigResponse,
  SpoolSearchResponse,
  ActiveSpoolResponse,
  SpoolSelectResponse,
  StandardAPIResponse,
  SpoolSummary
} from '@shared/types/web-api.types.js';
import {
  SpoolSelectRequestSchema,
  SpoolClearRequestSchema,
  createValidationError
} from '../../schemas/web-api.schemas.js';
import { toAppError } from '../../../utils/error.utils.js';
import { resolveContext, sendErrorResponse, type RouteDependencies } from './route-helpers.js';

export function registerSpoolmanRoutes(router: Router, deps: RouteDependencies): void {
  router.get('/spoolman/config', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const activeContextId = deps.contextManager.getActiveContextId();
      if (!activeContextId) {
        return sendErrorResponse<SpoolmanConfigResponse>(res, 503, 'No active printer context', {
          enabled: false,
          serverUrl: '',
          updateMode: 'weight',
          contextId: null
        });
      }

      const enabled =
        deps.spoolmanService.isGloballyEnabled() &&
        deps.spoolmanService.isContextSupported(activeContextId);
      const disabledReason = deps.spoolmanService.getDisabledReason(activeContextId);

      const response: SpoolmanConfigResponse = {
        success: true,
        enabled,
        disabledReason,
        serverUrl: deps.spoolmanService.getServerUrl(),
        updateMode: deps.spoolmanService.getUpdateMode(),
        contextId: activeContextId
      };
      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<SpoolmanConfigResponse>(res, 500, appError.message, {
        enabled: false,
        serverUrl: '',
        updateMode: 'weight',
        contextId: null
      });
    }
  });

  router.get('/spoolman/spools', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!deps.spoolmanService.isGloballyEnabled()) {
        return sendErrorResponse<SpoolSearchResponse>(
          res,
          400,
          'Spoolman integration is not enabled',
          { spools: [] }
        );
      }

      const searchParam =
        typeof req.query?.search === 'string' ? req.query.search.trim() : undefined;

      const searchQuery: import('../../../types/spoolman.js').SpoolSearchQuery = {
        limit: 50,
        allow_archived: false
      };

      if (searchParam) {
        searchQuery['filament.name'] = searchParam;
      }

      const spoolsData = await deps.spoolmanService.fetchSpools(searchQuery);
      const spools: SpoolSummary[] = spoolsData.map(spool => ({
        id: spool.id,
        name: spool.filament.name || `Spool #${spool.id}`,
        vendor: spool.filament.vendor?.name || null,
        material: spool.filament.material || null,
        colorHex: spool.filament.color_hex || '#808080',
        remainingWeight: spool.remaining_weight || 0,
        remainingLength: spool.remaining_length || 0,
        archived: spool.archived
      }));

      const response: SpoolSearchResponse = {
        success: true,
        spools
      };
      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<SpoolSearchResponse>(res, 500, appError.message, { spools: [] });
    }
  });

  router.get('/spoolman/active/:contextId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { paramName: 'contextId' });
      if (!contextResult.success) {
        return sendErrorResponse<ActiveSpoolResponse>(
          res,
          contextResult.statusCode,
          contextResult.error,
          { spool: null }
        );
      }

      if (!deps.spoolmanService.isContextSupported(contextResult.contextId)) {
        return sendErrorResponse<ActiveSpoolResponse>(
          res,
          409,
          'Spoolman integration is disabled for this printer (AD5X with material station)',
          { spool: null }
        );
      }

      const spool = deps.spoolmanService.getActiveSpool(contextResult.contextId);
      const response: ActiveSpoolResponse = {
        success: true,
        spool
      };
      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<ActiveSpoolResponse>(res, 500, appError.message, { spool: null });
    }
  });

  router.post('/spoolman/select', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = SpoolSelectRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        return sendErrorResponse<StandardAPIResponse>(
          res,
          400,
          validationError.error
        );
      }

      const { contextId, spoolId } = validation.data;
      const overrideContextId = contextId || null;
      const contextResult = resolveContext(req, deps, { overrideContextId });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          contextResult.statusCode,
          contextResult.error
        );
      }

      if (!deps.spoolmanService.isContextSupported(contextResult.contextId)) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          409,
          'Spoolman integration is disabled for this printer (AD5X with material station)'
        );
      }

      const spoolData = await deps.spoolmanService.getSpoolById(spoolId);
      await deps.spoolmanService.setActiveSpool(contextResult.contextId, spoolData);

      const response: SpoolSelectResponse = {
        success: true,
        spool: spoolData
      };
      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });

  router.delete('/spoolman/select', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = SpoolClearRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        return sendErrorResponse<StandardAPIResponse>(
          res,
          400,
          validationError.error
        );
      }

      const { contextId } = validation.data;
      const overrideContextId = contextId || null;
      const contextResult = resolveContext(req, deps, { overrideContextId });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          contextResult.statusCode,
          contextResult.error
        );
      }

      if (!deps.spoolmanService.isContextSupported(contextResult.contextId)) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          409,
          'Spoolman integration is disabled for this printer (AD5X with material station)'
        );
      }

      await deps.spoolmanService.clearActiveSpool(contextResult.contextId);
      return res.json({
        success: true,
        message: 'Active spool cleared'
      });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });
}
