/**
 * @fileoverview Printer status and capability API route registrations for the WebUI server.
 *
 * Handles status polling, feature discovery, and material station insight endpoints with
 * shared context resolution so browser clients can query different printers independently.
 */

import type { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../auth-middleware';
import {
  PrinterStatusResponse,
  PrinterFeatures,
  MaterialStationStatusResponse,
  StandardAPIResponse
} from '../../types/web-api.types';
import { toAppError } from '../../../utils/error.utils';
import { resolveContext, sendErrorResponse, type RouteDependencies } from './route-helpers';

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
}

export function registerPrinterStatusRoutes(router: Router, deps: RouteDependencies): void {
  router.get('/printer/status', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<PrinterStatusResponse>(
          res,
          contextResult.statusCode,
          contextResult.error
        );
      }

      const { contextId } = contextResult;
      const statusResult = await deps.backendManager.getPrinterStatus(contextId);

      if (!statusResult.success || !statusResult.status) {
        return sendErrorResponse<PrinterStatusResponse>(
          res,
          500,
          statusResult.error || 'Failed to get printer status'
        );
      }

      let bedTargetTemp = 0;
      let nozzleTargetTemp = 0;
      let filtrationMode: 'external' | 'internal' | 'none' = 'none';
      let estimatedWeight: number | undefined;
      let estimatedLength: number | undefined;
      let timeElapsed: number | undefined;
      let cumulativeFilament: number | undefined;
      let cumulativePrintTime: number | undefined;

      if (isExtendedPrinterStatus(statusResult.status)) {
        bedTargetTemp =
          statusResult.status.bedTargetTemperature ||
          statusResult.status.machineInfo?.PrintBed?.set ||
          0;
        nozzleTargetTemp =
          statusResult.status.nozzleTargetTemperature ||
          statusResult.status.machineInfo?.Extruder?.set ||
          0;

        filtrationMode = statusResult.status.filtration?.mode || 'none';
        estimatedWeight = statusResult.status.estimatedRightWeight;
        estimatedLength = statusResult.status.estimatedRightLen
          ? statusResult.status.estimatedRightLen / 1000
          : undefined;
        timeElapsed = statusResult.status.printDuration;

        if ('cumulativeFilament' in statusResult.status) {
          cumulativeFilament = statusResult.status.cumulativeFilament as number;
        }
        if ('cumulativePrintTime' in statusResult.status) {
          cumulativePrintTime = statusResult.status.cumulativePrintTime as number;
        }
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
          currentLayer: statusResult.status.currentLayer,
          totalLayers: statusResult.status.totalLayers,
          jobName: statusResult.status.currentJob || null,
          timeElapsed,
          timeRemaining: statusResult.status.remainingTime,
          filtrationMode,
          estimatedWeight,
          estimatedLength,
          cumulativeFilament,
          cumulativePrintTime
        }
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
        return sendErrorResponse<StandardAPIResponse>(
          res,
          contextResult.statusCode,
          contextResult.error
        );
      }

      const { contextId } = contextResult;
      const features = deps.backendManager.getFeatures(contextId);

      if (!features) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          500,
          'Failed to get printer features'
        );
      }

      const featureResponse: PrinterFeatures = {
        hasCamera: deps.backendManager.isFeatureAvailable(contextId, 'camera'),
        hasLED: deps.backendManager.isFeatureAvailable(contextId, 'led-control'),
        hasFiltration: deps.backendManager.isFeatureAvailable(contextId, 'filtration'),
        hasMaterialStation: deps.backendManager.isFeatureAvailable(contextId, 'material-station'),
        canPause: features.jobManagement.pauseResume,
        canResume: features.jobManagement.pauseResume,
        canCancel: features.jobManagement.cancelJobs,
        ledUsesLegacyAPI:
          features.ledControl.customControlEnabled || features.ledControl.usesLegacyAPI
      };

      return res.json({
        success: true,
        features: featureResponse
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
        return sendErrorResponse<MaterialStationStatusResponse>(
          res,
          contextResult.statusCode,
          contextResult.error
        );
      }

      const { contextId } = contextResult;
      if (!deps.backendManager.isFeatureAvailable(contextId, 'material-station')) {
        return res.status(200).json({
          success: false,
          error: 'Material station not available on this printer'
        } satisfies MaterialStationStatusResponse);
      }

      const status = deps.backendManager.getMaterialStationStatus(contextId);
      const response: MaterialStationStatusResponse = {
        success: true,
        status: status ?? null
      };
      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<MaterialStationStatusResponse>(res, 500, appError.message);
    }
  });
}

function isExtendedPrinterStatus(status: unknown): status is ExtendedPrinterStatus {
  return typeof status === 'object' && status !== null;
}
