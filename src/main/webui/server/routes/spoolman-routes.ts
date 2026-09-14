/**
 * @fileoverview Spoolman integration routes (config, search, active spool
 * management, material-station slot→spool assignments).
 *
 * Material-station contexts (Creator 5 series, AD5X with station) use the
 * estimate-based tracking flow: the config response carries a `station`
 * object (slot assignments + last deduction) that the WebUI panel renders
 * instead of the single active-spool view, and slot assignments are managed
 * through POST /spoolman/slot-spool.
 */

import type { SpoolSearchQuery } from '@shared/types/spoolman.js';
import {
  ActiveSpoolResponse,
  SlotSpoolResponse,
  SpoolmanConfigResponse,
  SpoolmanStationTracking,
  SpoolSearchResponse,
  SpoolSelectResponse,
  SpoolSummary,
  StandardAPIResponse,
} from '@shared/types/web-api.types.js';
import type { Response, Router } from 'express';
import { toAppError } from '../../../utils/error.utils.js';
import { getMultiContextSpoolmanTracker } from '../../../services/MultiContextSpoolmanTracker.js';
import {
  createValidationError,
  SlotSpoolSetRequestSchema,
  SpoolClearRequestSchema,
  SpoolSelectRequestSchema,
} from '../../schemas/web-api.schemas.js';
import type { AuthenticatedRequest } from '../auth-middleware.js';
import { type RouteDependencies, resolveContext, sendErrorResponse } from './route-helpers.js';

export function registerSpoolmanRoutes(router: Router, deps: RouteDependencies): void {
  router.get('/spoolman/config', async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const activeContextId = deps.contextManager.getActiveContextId();
      if (!activeContextId) {
        return sendErrorResponse<SpoolmanConfigResponse>(res, 503, 'No active printer context', {
          enabled: false,
          serverUrl: '',
          updateMode: 'weight',
          contextId: null,
        });
      }

      const enabled =
        deps.spoolmanService.isGloballyEnabled() && deps.spoolmanService.isContextSupported(activeContextId);
      const disabledReason = deps.spoolmanService.getDisabledReason(activeContextId);

      const response: SpoolmanConfigResponse = {
        success: true,
        enabled,
        disabledReason,
        serverUrl: deps.spoolmanService.getServerUrl(),
        updateMode: deps.spoolmanService.getUpdateMode(),
        contextId: activeContextId,
        station: buildStationTracking(deps, activeContextId),
      };
      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<SpoolmanConfigResponse>(res, 500, appError.message, {
        enabled: false,
        serverUrl: '',
        updateMode: 'weight',
        contextId: null,
      });
    }
  });

  router.get('/spoolman/spools', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!deps.spoolmanService.isGloballyEnabled()) {
        return sendErrorResponse<SpoolSearchResponse>(res, 400, 'Spoolman integration is not enabled', { spools: [] });
      }

      const searchParam = typeof req.query?.search === 'string' ? req.query.search.trim() : undefined;

      const searchQuery: SpoolSearchQuery = {
        limit: 50,
        allow_archived: false,
      };

      if (searchParam) {
        searchQuery['filament.name'] = searchParam;
      }

      const spoolsData = await deps.spoolmanService.fetchSpools(searchQuery);
      const spools: SpoolSummary[] = spoolsData.map((spool) => ({
        id: spool.id,
        name: spool.filament.name || `Spool #${spool.id}`,
        vendor: spool.filament.vendor?.name || null,
        material: spool.filament.material || null,
        colorHex: spool.filament.color_hex || '#808080',
        remainingWeight: spool.remaining_weight || 0,
        remainingLength: spool.remaining_length || 0,
        archived: spool.archived,
      }));

      const response: SpoolSearchResponse = {
        success: true,
        spools,
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
        return sendErrorResponse<ActiveSpoolResponse>(res, contextResult.statusCode, contextResult.error, {
          spool: null,
        });
      }

      if (!deps.spoolmanService.isContextSupported(contextResult.contextId)) {
        return sendErrorResponse<ActiveSpoolResponse>(
          res,
          409,
          'Spoolman integration is not available for this printer',
          { spool: null }
        );
      }

      const spool = deps.spoolmanService.getActiveSpool(contextResult.contextId);
      const response: ActiveSpoolResponse = {
        success: true,
        spool,
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
        return sendErrorResponse<StandardAPIResponse>(res, 400, validationError.error);
      }

      const { contextId, spoolId } = validation.data;
      const overrideContextId = contextId || null;
      const contextResult = resolveContext(req, deps, { overrideContextId });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(res, contextResult.statusCode, contextResult.error);
      }

      if (!deps.spoolmanService.isContextSupported(contextResult.contextId)) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          409,
          'Spoolman integration is not available for this printer'
        );
      }

      const spoolData = await deps.spoolmanService.getSpoolById(spoolId);
      await deps.spoolmanService.setActiveSpool(contextResult.contextId, spoolData);

      const response: SpoolSelectResponse = {
        success: true,
        spool: spoolData,
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
        return sendErrorResponse<StandardAPIResponse>(res, 400, validationError.error);
      }

      const { contextId } = validation.data;
      const overrideContextId = contextId || null;
      const contextResult = resolveContext(req, deps, { overrideContextId });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(res, contextResult.statusCode, contextResult.error);
      }

      if (!deps.spoolmanService.isContextSupported(contextResult.contextId)) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          409,
          'Spoolman integration is not available for this printer'
        );
      }

      await deps.spoolmanService.clearActiveSpool(contextResult.contextId);
      return res.json({
        success: true,
        message: 'Active spool cleared',
      });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });

  // Stage 2 (Spoolman estimate tracking): slot→spool assignment CRUD for
  // material-station contexts. Deduction resolves
  // tool → slot (job mappings) → spool (this assignment).
  router.post('/spoolman/slot-spool', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = SlotSpoolSetRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        return sendErrorResponse<SlotSpoolResponse>(res, 400, validationError.error, {
          contextId: '',
          slotId: 0,
          spoolId: null,
        });
      }

      const { contextId, slotId, spoolId } = validation.data;
      const overrideContextId = contextId || null;
      const contextResult = resolveContext(req, deps, { overrideContextId });
      if (!contextResult.success) {
        return sendErrorResponse<SlotSpoolResponse>(
          res,
          contextResult.statusCode,
          contextResult.error,
          { contextId: '', slotId: 0, spoolId: null }
        );
      }

      if (!deps.spoolmanService.isContextSupported(contextResult.contextId)) {
        return sendErrorResponse<SlotSpoolResponse>(
          res,
          409,
          'Spoolman integration is not available for this printer',
          { contextId: contextResult.contextId, slotId, spoolId: null }
        );
      }
      if (!deps.spoolmanService.isStationContext(contextResult.contextId)) {
        return sendErrorResponse<SlotSpoolResponse>(
          res,
          409,
          'Slot→spool assignments require a printer with a material station',
          { contextId: contextResult.contextId, slotId, spoolId: null }
        );
      }

      if (spoolId !== null) {
        // Validate the spool exists before persisting the assignment.
        await deps.spoolmanService.getSpoolById(spoolId);
      }
      deps.spoolmanService.setSpoolForSlot(contextResult.contextId, slotId, spoolId);

      const response: SlotSpoolResponse = {
        success: true,
        contextId: contextResult.contextId,
        slotId,
        spoolId,
      };
      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<SlotSpoolResponse>(res, 500, appError.message, {
        contextId: '',
        slotId: 0,
        spoolId: null,
      });
    }
  });
}

/** Copy shown in the Spoolman panel for station contexts. */
const STATION_TRACKING_NOTE =
  'Consumption is estimated from files uploaded through this app, and from ' +
  'single-material files started through this app when exactly one slot has a ' +
  'spool assigned. Prints started on the printer itself are not tracked.';

/**
 * Assemble estimate-based tracking info for a context, or null when the
 * context has no material station.
 */
function buildStationTracking(
  deps: RouteDependencies,
  contextId: string
): SpoolmanStationTracking | null {
  if (!deps.spoolmanService.isStationContext(contextId)) {
    return null;
  }
  const slotAssignments = [...deps.spoolmanService.getSlotSpoolMap(contextId).entries()]
    .map(([slotId, spoolId]) => ({ slotId, spoolId }))
    .sort((a, b) => a.slotId - b.slotId);
  return {
    supported: true,
    note: STATION_TRACKING_NOTE,
    slotAssignments,
    lastDeduction: getMultiContextSpoolmanTracker().getLastDeduction(contextId),
  };
}
