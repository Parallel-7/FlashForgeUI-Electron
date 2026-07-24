/**
 * @fileoverview Printer status and capability API route registrations for the WebUI server.
 *
 * Handles status polling, feature discovery, and material station insight endpoints with
 * shared context resolution so browser clients can query different printers independently.
 */

import {
  MaterialStationStatusResponse,
  PrinterFeatures,
  PrinterStatusResponse,
  StandardAPIResponse,
} from '@shared/types/web-api.types.js';
import type { Response, Router } from 'express';
import { createValidationError, SlotConfigRequestSchema } from '../../schemas/web-api.schemas.js';
import { toAppError } from '../../../utils/error.utils.js';
import type { AuthenticatedRequest } from '../auth-middleware.js';
import { type RouteDependencies, resolveContext, sendErrorResponse } from './route-helpers.js';

interface ExtendedPrinterStatus {
  readonly printerState: string;
  readonly bedTemperature: number;
  readonly nozzleTemperature: number;
  readonly progress: number;
  readonly currentJob?: string;
  readonly estimatedTime?: number;
  readonly remainingTime?: number;
  readonly currentLayer?: number;
  readonly totalLayers?: number;
  readonly bedTargetTemperature?: number;
  readonly nozzleTargetTemperature?: number;
  readonly printDuration?: number;
  readonly machineInfo?: {
    readonly PrintBed?: {
      readonly set?: number;
    };
    readonly Extruder?: {
      readonly set?: number;
    };
  };
  readonly filtration?: {
    readonly mode?: 'external' | 'internal' | 'none';
  };
  readonly estimatedRightLen?: number;
  readonly estimatedRightWeight?: number;
  readonly cumulativeFilament?: number;
  readonly cumulativePrintTime?: number;
  readonly printEta?: string;
  // Creator 5 series (multi-tool) fields surfaced by Creator5Backend.getAdditionalStatusFields.
  // Raw ff-api Temperature entries use `set` (not `target`) for the target reading.
  readonly toolTemps?: ReadonlyArray<{ readonly current: number; readonly set: number }>;
  readonly chamberTemp?: number;
  readonly chamberTargetTemp?: number;
  readonly hasChamberControl?: boolean;
  readonly isCreator5Pro?: boolean;
  readonly tvoc?: number;
}

export function registerPrinterStatusRoutes(router: Router, deps: RouteDependencies): void {
  router.get('/printer/status', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<PrinterStatusResponse>(res, contextResult.statusCode, contextResult.error);
      }

      const { contextId } = contextResult;
      const statusResult = await deps.backendManager.getPrinterStatus(contextId);

      if (!statusResult.success || !statusResult.status) {
        return sendErrorResponse<PrinterStatusResponse>(res, 500, statusResult.error || 'Failed to get printer status');
      }

      let bedTargetTemp = 0;
      let nozzleTargetTemp = 0;
      let filtrationMode: 'external' | 'internal' | 'none' = 'none';
      let estimatedWeight: number | undefined;
      let estimatedLength: number | undefined;
      let timeElapsed: number | undefined;
      let elapsedTimeSeconds: number | undefined;
      let formattedEta: string | undefined;
      let cumulativeFilament: number | undefined;
      let cumulativePrintTime: number | undefined;
      let toolTemps: Array<{ current: number; target: number }> | undefined;
      let chamberTemperature: number | undefined;
      let chamberTargetTemperature: number | undefined;
      let hasChamberControl: boolean | undefined;
      let isCreator5Pro: boolean | undefined;
      let tvocLevel: number | undefined;

      if (isExtendedPrinterStatus(statusResult.status)) {
        bedTargetTemp = statusResult.status.bedTargetTemperature || statusResult.status.machineInfo?.PrintBed?.set || 0;
        nozzleTargetTemp =
          statusResult.status.nozzleTargetTemperature || statusResult.status.machineInfo?.Extruder?.set || 0;

        filtrationMode = statusResult.status.filtration?.mode || 'none';
        estimatedWeight = statusResult.status.estimatedRightWeight;
        estimatedLength = statusResult.status.estimatedRightLen
          ? statusResult.status.estimatedRightLen / 1000
          : undefined;
        // printDuration is raw seconds — convert to minutes for consistency with WebSocket path
        timeElapsed =
          statusResult.status.printDuration !== undefined
            ? Math.round(statusResult.status.printDuration / 60)
            : undefined;
        elapsedTimeSeconds = statusResult.status.printDuration;
        formattedEta = statusResult.status.printEta;

        if ('cumulativeFilament' in statusResult.status) {
          cumulativeFilament = statusResult.status.cumulativeFilament as number;
        }
        if ('cumulativePrintTime' in statusResult.status) {
          cumulativePrintTime = statusResult.status.cumulativePrintTime as number;
        }

        // Creator 5 series (multi-tool) fields — present only on Creator5Backend.
        if (statusResult.status.toolTemps && statusResult.status.toolTemps.length > 0) {
          toolTemps = statusResult.status.toolTemps.map((tool) => ({
            current: Math.round(tool.current),
            target: Math.round(tool.set),
          }));
        }
        if (statusResult.status.hasChamberControl) {
          hasChamberControl = true;
          chamberTemperature = Math.round(statusResult.status.chamberTemp ?? 0);
          chamberTargetTemperature = Math.round(statusResult.status.chamberTargetTemp ?? 0);
        }
        isCreator5Pro = statusResult.status.isCreator5Pro;
        tvocLevel = statusResult.status.tvoc;
      }

      const response: PrinterStatusResponse = {
        success: true,
        status: {
          printerState: statusResult.status.printerState,
          bedTemperature: statusResult.status.bedTemperature,
          bedTargetTemperature: bedTargetTemp,
          nozzleTemperature: statusResult.status.nozzleTemperature,
          nozzleTargetTemperature: nozzleTargetTemp,
          progress: statusResult.status.progress,
          currentLayer: statusResult.status.currentLayer ?? 0,
          totalLayers: statusResult.status.totalLayers ?? 0,
          jobName: statusResult.status.currentJob || null,
          timeElapsed,
          timeRemaining: statusResult.status.remainingTime,
          filtrationMode,
          estimatedWeight,
          estimatedLength,
          cumulativeFilament,
          cumulativePrintTime,
          formattedEta,
          elapsedTimeSeconds,
          toolTemps,
          chamberTemperature,
          chamberTargetTemperature,
          hasChamberControl,
          isCreator5Pro,
          tvocLevel,
        },
      };

      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<PrinterStatusResponse>(res, 500, appError.message);
    }
  });

  router.get('/printer/features', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(res, contextResult.statusCode, contextResult.error);
      }

      const { contextId } = contextResult;
      const features = deps.backendManager.getFeatures(contextId);

      if (!features) {
        return sendErrorResponse<StandardAPIResponse>(res, 500, 'Failed to get printer features');
      }

      // Creator 5 series capability flags derive from the backend model type.
      const modelType = deps.backendManager.getBackendStatus(contextId)?.capabilities.modelType;
      const isCreator5Pro = modelType === 'creator-5-pro';
      const hasMultiTool = modelType === 'creator-5' || modelType === 'creator-5-pro';

      const featureResponse: PrinterFeatures = {
        hasCamera: deps.backendManager.isFeatureAvailable(contextId, 'camera'),
        hasLED: deps.backendManager.isFeatureAvailable(contextId, 'led-control'),
        hasFiltration: deps.backendManager.isFeatureAvailable(contextId, 'filtration'),
        hasMaterialStation: deps.backendManager.isFeatureAvailable(contextId, 'material-station'),
        canPause: features.jobManagement.pauseResume,
        canResume: features.jobManagement.pauseResume,
        canCancel: features.jobManagement.cancelJobs,
        ledUsesLegacyAPI: features.ledControl.customControlEnabled || features.ledControl.usesLegacyAPI,
        hasMultiTool,
        isCreator5Pro,
        gcodeCommands: features.gcodeCommands,
      };

      return res.json({
        success: true,
        features: featureResponse,
      });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });

  router.get('/printer/material-station', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<MaterialStationStatusResponse>(res, contextResult.statusCode, contextResult.error);
      }

      const { contextId } = contextResult;
      if (!deps.backendManager.isFeatureAvailable(contextId, 'material-station')) {
        return res.status(200).json({
          success: false,
          error: 'Material station not available on this printer',
        } satisfies MaterialStationStatusResponse);
      }

      const status = deps.backendManager.getMaterialStationStatus(contextId);
      const response: MaterialStationStatusResponse = {
        success: true,
        status: status ?? null,
      };
      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<MaterialStationStatusResponse>(res, 500, appError.message);
    }
  });

  // Configure a material-station slot's material + color. The client's slot editor
  // has already snapped the material/color onto the printer's fixed palette (AD5X or
  // Creator 5), so this writes explicit values; ff-api normalizes the color `#` on
  // the wire per model. Applies to AD5X and Creator 5 / 5 Pro.
  router.post('/printer/material-station/slot', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(res, contextResult.statusCode, contextResult.error);
      }

      const validation = SlotConfigRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        return sendErrorResponse<StandardAPIResponse>(res, 400, validationError.error);
      }
      const { slot, materialName, colorHex } = validation.data;

      if (!deps.backendManager.isFeatureAvailable(contextResult.contextId, 'material-station')) {
        return sendErrorResponse<StandardAPIResponse>(res, 400, 'Material station not available on this printer');
      }

      const result = await deps.backendManager.configureMaterialSlot(
        contextResult.contextId,
        slot,
        materialName,
        colorHex
      );

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? `Slot ${slot} configured` : undefined,
        error: result.error,
      };
      return res.status(result.success ? 200 : 500).json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });
}

function isExtendedPrinterStatus(status: unknown): status is ExtendedPrinterStatus {
  return typeof status === 'object' && status !== null;
}
