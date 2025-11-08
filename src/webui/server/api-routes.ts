/**
 * @fileoverview Express API route definitions for WebUI remote printer control and monitoring.
 *
 * Provides comprehensive REST API endpoints for browser-based printer control, wrapping
 * backend manager methods with HTTP interfaces, authentication middleware, and request validation.
 * All routes support multi-printer contexts through optional contextId parameters, defaulting to
 * the active context when not specified. Routes are organized into logical groups: printer status,
 * control operations (home, pause, resume, cancel), temperature management, filtration controls
 * (AD5M Pro), job management, camera access, and multi-printer context switching. Each route
 * returns standardized JSON responses with discriminated union types for type-safe error handling.
 *
 * Key exports:
 * - createAPIRoutes(): Router factory function that returns configured Express router
 * - Route groups: /printer/status, /printer/control/*, /printer/temperature/*, /printer/filtration/*,
 *   /jobs/*, /camera/*, /contexts/*
 * - Multi-printer support: All routes accept active context or explicit contextId parameter
 * - Security: All routes require WebUI authentication via AuthenticatedRequest type
 */

import { Router, Response } from 'express';
import { getPrinterBackendManager } from '../../managers/PrinterBackendManager';
import { getPrinterConnectionManager } from '../../managers/ConnectionFlowManager';
import { getPrinterContextManager } from '../../managers/PrinterContextManager';
import { getSpoolmanIntegrationService } from '../../services/SpoolmanIntegrationService';
import { AuthenticatedRequest } from './auth-middleware';
import {
  TemperatureSetRequestSchema,
  JobStartRequestSchema,
  SpoolSelectRequestSchema,
  SpoolClearRequestSchema,
  createValidationError
} from '../schemas/web-api.schemas';
import {
  StandardAPIResponse,
  PrinterStatusResponse,
  PrinterFeatures,
  CameraStatusResponse,
  MaterialStationStatusResponse,
  SpoolmanConfigResponse,
  SpoolSearchResponse,
  ActiveSpoolResponse,
  SpoolSelectResponse,
  SpoolSummary
} from '../types/web-api.types';
import { toAppError } from '../../utils/error.utils';
import { FiveMClient } from '@ghosttypes/ff-api';
import { isAD5XJobInfo } from '../../printer-backends/ad5x/ad5x-utils';
import { getConfigManager } from '../../managers/ConfigManager';
import { sanitizeTheme } from '../../types/config';

/**
 * Extended printer status interface for accessing additional properties
 * that may be present in the status object beyond the base StatusResult
 */
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
  // Extended properties from backend implementations
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
  readonly currentJobMetadata?: {
    readonly weight?: number;
    readonly length?: number;
  };
  // Lifetime statistics from DualAPIBackend
  readonly cumulativeFilament?: number;
  readonly cumulativePrintTime?: number;
}

/**
 * Type guard to check if status has extended properties
 */
function isExtendedPrinterStatus(status: unknown): status is ExtendedPrinterStatus {
  return typeof status === 'object' && status !== null;
}

/**
 * Create router with all printer control API routes
 */
export function createAPIRoutes(): Router {
  const router = Router();
  const backendManager = getPrinterBackendManager();
  const connectionManager = getPrinterConnectionManager();
  const contextManager = getPrinterContextManager();

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Helper function to handle LED control (on/off)
   * Eliminates duplication between led-on and led-off endpoints
   */
  async function handleLedControl(enabled: boolean, res: Response): Promise<void> {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        res.status(503).json(response);
        return;
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        res.status(503).json(response);
        return;
      }

      if (!backendManager.isFeatureAvailable(contextId, 'led-control')) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'LED control not available on this printer'
        };
        res.status(400).json(response);
        return;
      }

      // Get backend and check if it supports LED control
      const backend = backendManager.getBackendForContext(contextId);

      if (!backend) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Backend not initialized'
        };
        res.status(500).json(response);
        return;
      }

      // Use the backend's LED control method
      const result = await backend.setLedEnabled(enabled);

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? `LED turned ${enabled ? 'on' : 'off'}` : undefined,
        error: result.error
      };

      res.status(result.success ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      res.status(500).json(response);
    }
  }

  // ============================================================================
  // PRINTER STATUS ROUTES
  // ============================================================================

  /**
   * GET /api/printer/status - Get current printer status
   */
  router.get('/printer/status', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: PrinterStatusResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: PrinterStatusResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const statusResult = await backendManager.getPrinterStatus(contextId);

      if (!statusResult.success) {
        const response: PrinterStatusResponse = {
          success: false,
          error: statusResult.error || 'Failed to get printer status'
        };
        return res.status(500).json(response);
      }

      // Safely access extended properties if available
      let bedTargetTemp = 0;
      let nozzleTargetTemp = 0;
      let filtrationMode: 'external' | 'internal' | 'none' = 'none';
      let estimatedWeight: number | undefined;
      let estimatedLength: number | undefined;
      let timeElapsed: number | undefined;
      let cumulativeFilament: number | undefined;
      let cumulativePrintTime: number | undefined;

      if (isExtendedPrinterStatus(statusResult.status)) {
        const extendedStatus = statusResult.status;

        // Extract target temperatures from the extended status or machineInfo
        bedTargetTemp = extendedStatus.bedTargetTemperature ||
          extendedStatus.machineInfo?.PrintBed?.set ||
          0;
        nozzleTargetTemp = extendedStatus.nozzleTargetTemperature ||
          extendedStatus.machineInfo?.Extruder?.set ||
          0;

        // Extract additional data
        filtrationMode = extendedStatus.filtration?.mode || 'none';
        estimatedWeight = extendedStatus.currentJobMetadata?.weight;
        estimatedLength = extendedStatus.currentJobMetadata?.length;
        timeElapsed = extendedStatus.printDuration;

        // Extract lifetime statistics directly from the status object
        // The DualAPIBackend puts these at the top level of the status object
        if ('cumulativeFilament' in extendedStatus) {
          cumulativeFilament = extendedStatus.cumulativeFilament as number;
        }
        if ('cumulativePrintTime' in extendedStatus) {
          cumulativePrintTime = extendedStatus.cumulativePrintTime as number;
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
          timeElapsed: timeElapsed,
          timeRemaining: statusResult.status.remainingTime,
          filtrationMode: filtrationMode,
          estimatedWeight: estimatedWeight,
          estimatedLength: estimatedLength,
          cumulativeFilament: cumulativeFilament,
          cumulativePrintTime: cumulativePrintTime
        }
      };

      return res.json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: PrinterStatusResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  /**
   * GET /api/printer/features - Get available printer features
   */
  router.get('/printer/features', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const features = backendManager.getFeatures(contextId);

      if (!features) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Failed to get printer features'
        };
        return res.status(500).json(response);
      }

      const featureResponse: PrinterFeatures = {
        hasCamera: backendManager.isFeatureAvailable(contextId, 'camera'),
        hasLED: backendManager.isFeatureAvailable(contextId, 'led-control'),
        hasFiltration: backendManager.isFeatureAvailable(contextId, 'filtration'),
        hasMaterialStation: backendManager.isFeatureAvailable(contextId, 'material-station'),
        canPause: features.jobManagement.pauseResume,
        canResume: features.jobManagement.pauseResume,
        canCancel: features.jobManagement.cancelJobs,
        // Include custom settings information
        ledUsesLegacyAPI: features.ledControl.customControlEnabled || features.ledControl.usesLegacyAPI
      };

      return res.json({
        success: true,
        features: featureResponse
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

  // ============================================================================
  // PRINTER CONTROL ROUTES
  // ============================================================================

  /**
   * GET /api/printer/material-station - Get material station status
   */
  router.get('/printer/material-station', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: MaterialStationStatusResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: MaterialStationStatusResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      if (!backendManager.isFeatureAvailable(contextId, 'material-station')) {
        const response: MaterialStationStatusResponse = {
          success: false,
          error: 'Material station not available on this printer'
        };
        return res.status(200).json(response);
      }

      const status = backendManager.getMaterialStationStatus(contextId);
      const response: MaterialStationStatusResponse = {
        success: true,
        status: status ?? null
      };

      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      const response: MaterialStationStatusResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  /**
   * POST /api/printer/control/home - Home printer axes
   */
  router.post('/printer/control/home', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const result = await backendManager.executeGCodeCommand(contextId, '~G28');

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? 'Homing axes...' : undefined,
        error: result.error
      };

      return res.status(result.success ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  /**
   * POST /api/printer/control/pause - Pause print
   */
  router.post('/printer/control/pause', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const result = await backendManager.pauseJob(contextId);

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? 'Print paused' : undefined,
        error: result.error
      };

      return res.status(result.success ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  /**
   * POST /api/printer/control/resume - Resume print
   */
  router.post('/printer/control/resume', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const result = await backendManager.resumeJob(contextId);

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? 'Print resumed' : undefined,
        error: result.error
      };

      return res.status(result.success ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  /**
   * POST /api/printer/control/cancel - Cancel print
   */
  router.post('/printer/control/cancel', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const result = await backendManager.cancelJob(contextId);

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? 'Print cancelled' : undefined,
        error: result.error
      };

      return res.status(result.success ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  /**
   * POST /api/printer/control/led-on - Turn LED on
   */
  router.post('/printer/control/led-on', async (req: AuthenticatedRequest, res: Response) => {
    await handleLedControl(true, res);
  });

  /**
   * POST /api/printer/control/led-off - Turn LED off
   */
  router.post('/printer/control/led-off', async (req: AuthenticatedRequest, res: Response) => {
    await handleLedControl(false, res);
  });

  /**
   * POST /api/printer/control/clear-status - Clear printer status
   */
  router.post('/printer/control/clear-status', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!backendManager.isBackendReady(contextId)) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const backend = backendManager.getBackendForContext(contextId);
      if (!backend) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Backend not available'
        };
        return res.status(503).json(response);
      }

      // Check if this printer supports new API (needed for clearPlatform)
      const features = backend.getBackendStatus().features;
      if (!features?.statusMonitoring.usesNewAPI) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Clear status not supported on legacy printers'
        };
        return res.status(400).json(response);
      }

      // Use primary client (FiveMClient) for clearPlatform
      // this should never happen..
      const primaryClient = backend.getPrimaryClient();
      if (!(primaryClient instanceof FiveMClient)) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Clear status requires new API client'
        };
        return res.status(400).json(response);
      }

      const result = await primaryClient.jobControl.clearPlatform();
      console.log('Cleared platform status', result);

      const response: StandardAPIResponse = {
        success: result,
        message: result ? 'Status cleared' : 'Error clearing status'
      };

      return res.status(result ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  // ============================================================================
  // TEMPERATURE CONTROL ROUTES
  // ============================================================================

  /**
   * POST /api/printer/temperature/bed - Set bed temperature
   */
  router.post('/printer/temperature/bed', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const validation = TemperatureSetRequestSchema.safeParse(req.body);

      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        const response: StandardAPIResponse = {
          success: false,
          error: validationError.error
        };
        return res.status(400).json(response);
      }

      const temperature = Math.round(validation.data.temperature);
      const result = await backendManager.executeGCodeCommand(contextId, `~M140 S${temperature}`);

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? `Setting bed temperature to ${temperature}°C` : undefined,
        error: result.error
      };

      return res.status(result.success ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  /**
   * POST /api/printer/temperature/bed/off - Turn off bed heating
   */
  router.post('/printer/temperature/bed/off', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const result = await backendManager.executeGCodeCommand(contextId, '~M140 S0');

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? 'Bed heating turned off' : undefined,
        error: result.error
      };

      return res.status(result.success ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  /**
   * POST /api/printer/temperature/extruder - Set extruder temperature
   */
  router.post('/printer/temperature/extruder', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const validation = TemperatureSetRequestSchema.safeParse(req.body);

      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        const response: StandardAPIResponse = {
          success: false,
          error: validationError.error
        };
        return res.status(400).json(response);
      }

      const temperature = Math.round(validation.data.temperature);
      const result = await backendManager.executeGCodeCommand(contextId, `~M104 S${temperature}`);

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? `Setting extruder temperature to ${temperature}°C` : undefined,
        error: result.error
      };

      return res.status(result.success ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  /**
   * POST /api/printer/temperature/extruder/off - Turn off extruder heating
   */
  router.post('/printer/temperature/extruder/off', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const result = await backendManager.executeGCodeCommand(contextId, '~M104 S0');

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? 'Extruder heating turned off' : undefined,
        error: result.error
      };

      return res.status(result.success ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  // ============================================================================
  // FILTRATION CONTROL ROUTES (AD5M Pro only)
  // ============================================================================

  /**
   * POST /api/printer/filtration/external - External filtration
   */
  router.post('/printer/filtration/external', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!backendManager.isBackendReady(contextId)) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const backend = backendManager.getBackendForContext(contextId);
      if (!backend) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Backend not available'
        };
        return res.status(500).json(response);
      }

      const features = backend.getBackendStatus().features;
      if (!features?.filtration.available) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Filtration control not available on this printer'
        };
        return res.status(400).json(response);
      }

      // Use primary client for filtration control
      const primaryClient = backend.getPrimaryClient();
      if (!(primaryClient instanceof FiveMClient)) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Filtration control requires new API client'
        };
        return res.status(400).json(response);
      }

      const result = await primaryClient.control.setExternalFiltrationOn();

      const response: StandardAPIResponse = {
        success: result,
        message: result ? 'External filtration enabled' : undefined,
        error: result ? undefined : 'Failed to enable external filtration'
      };

      return res.status(result ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  /**
   * POST /api/printer/filtration/internal - Internal filtration
   */
  router.post('/printer/filtration/internal', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!backendManager.isBackendReady(contextId)) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const backend = backendManager.getBackendForContext(contextId);
      if (!backend) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Backend not available'
        };
        return res.status(500).json(response);
      }

      const features = backend.getBackendStatus().features;
      if (!features?.filtration.available) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Filtration control not available on this printer'
        };
        return res.status(400).json(response);
      }

      // Use primary client for filtration control
      const primaryClient = backend.getPrimaryClient();
      if (!(primaryClient instanceof FiveMClient)) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Filtration control requires new API client'
        };
        return res.status(400).json(response);
      }

      const result = await primaryClient.control.setInternalFiltrationOn();

      const response: StandardAPIResponse = {
        success: result,
        message: result ? 'Internal filtration enabled' : undefined,
        error: result ? undefined : 'Failed to enable internal filtration'
      };

      return res.status(result ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  /**
   * POST /api/printer/filtration/off - Turn off filtration
   */
  router.post('/printer/filtration/off', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!backendManager.isBackendReady(contextId)) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const backend = backendManager.getBackendForContext(contextId);
      if (!backend) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Backend not available'
        };
        return res.status(500).json(response);
      }

      const features = backend.getBackendStatus().features;
      if (!features?.filtration.available) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Filtration control not available on this printer'
        };
        return res.status(400).json(response);
      }

      // Use primary client for filtration control
      const primaryClient = backend.getPrimaryClient();
      if (!(primaryClient instanceof FiveMClient)) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Filtration control requires new API client'
        };
        return res.status(400).json(response);
      }

      const result = await primaryClient.control.setFiltrationOff();

      const response: StandardAPIResponse = {
        success: result,
        message: result ? 'Filtration turned off' : undefined,
        error: result ? undefined : 'Failed to turn off filtration'
      };

      return res.status(result ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  // ============================================================================
  // JOB MANAGEMENT ROUTES
  // ============================================================================

  /**
   * GET /api/jobs/local - Get local files
   */
  router.get('/jobs/local', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const result = await backendManager.getLocalJobs(contextId);

      if (!result.success) {
        const response: StandardAPIResponse = {
          success: false,
          error: result.error || 'Failed to get local jobs'
        };
        return res.status(500).json(response);
      }

      return res.json({
        success: true,
        files: result.jobs.map(job => ({
          fileName: job.fileName,
          displayName: job.fileName, // Basic jobs don't have displayName
          size: 0, // Basic jobs don't have size
          lastModified: undefined, // Basic jobs don't have lastModified
          thumbnail: undefined, // Basic jobs don't have thumbnail
          printingTime: job.printingTime ?? 0,
          ...(isAD5XJobInfo(job)
            ? {
                metadataType: 'ad5x' as const,
                toolCount: job.toolCount ?? job.toolDatas?.length ?? 0,
                toolDatas: job.toolDatas ?? [],
                totalFilamentWeight: job.totalFilamentWeight,
                useMatlStation: job.useMatlStation
              }
            : {
                metadataType: 'basic' as const
              })
        })),
        totalCount: result.totalCount
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

  /**
   * GET /api/jobs/recent - Get recent files
   */
  router.get('/jobs/recent', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const result = await backendManager.getRecentJobs(contextId);

      if (!result.success) {
        const response: StandardAPIResponse = {
          success: false,
          error: result.error || 'Failed to get recent jobs'
        };
        return res.status(500).json(response);
      }

      return res.json({
        success: true,
        files: result.jobs.map(job => ({
          fileName: job.fileName,
          displayName: job.fileName, // Basic jobs don't have displayName
          size: 0, // Basic jobs don't have size
          lastModified: undefined, // Basic jobs don't have lastModified
          thumbnail: undefined, // Basic jobs don't have thumbnail
          printingTime: job.printingTime ?? 0,
          ...(isAD5XJobInfo(job)
            ? {
                metadataType: 'ad5x' as const,
                toolCount: job.toolCount ?? job.toolDatas?.length ?? 0,
                toolDatas: job.toolDatas ?? [],
                totalFilamentWeight: job.totalFilamentWeight,
                useMatlStation: job.useMatlStation
              }
            : {
                metadataType: 'basic' as const
              })
        })),
        totalCount: result.totalCount
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

  /**
   * POST /api/jobs/start - Start print job
   */
  router.post('/jobs/start', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const validation = JobStartRequestSchema.safeParse(req.body);

      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        const response: StandardAPIResponse = {
          success: false,
          error: validationError.error
        };
        return res.status(400).json(response);
      }

      const materialMappings = validation.data.materialMappings;

      if (materialMappings) {
        const toolIdSet = new Set<number>();
        const slotIdSet = new Set<number>();

        for (const mapping of materialMappings) {
          if (toolIdSet.has(mapping.toolId)) {
            const response: StandardAPIResponse = {
              success: false,
              error: `Duplicate toolId in materialMappings: ${mapping.toolId}`
            };
            return res.status(400).json(response);
          }
          if (slotIdSet.has(mapping.slotId)) {
            const response: StandardAPIResponse = {
              success: false,
              error: `Duplicate slotId in materialMappings: ${mapping.slotId}`
            };
            return res.status(400).json(response);
          }

          toolIdSet.add(mapping.toolId);
          slotIdSet.add(mapping.slotId);
        }
      }

      const result = await backendManager.startJob(contextId, {
        operation: 'start',
        fileName: validation.data.filename,
        startNow: validation.data.startNow,
        leveling: validation.data.leveling,
        additionalParams: materialMappings && materialMappings.length > 0
          ? { materialMappings }
          : undefined
      });

      const response: StandardAPIResponse = {
        success: result.success,
        message: result.success ? `Starting print: ${validation.data.filename}` : undefined,
        error: result.error
      };

      return res.status(result.success ? 200 : 500).json(response);

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  /**
   * GET /api/jobs/thumbnail/:filename - Get job thumbnail
   */
  router.get('/jobs/thumbnail/:filename', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();

      if (!contextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      if (!connectionManager.isConnected()) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Printer not connected'
        };
        return res.status(503).json(response);
      }

      const filename = req.params.filename;

      if (!filename) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Filename is required'
        };
        return res.status(400).json(response);
      }

      const thumbnail = await backendManager.getJobThumbnail(contextId, filename);

      if (!thumbnail) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Thumbnail not available'
        };
        return res.status(404).json(response);
      }

      return res.json({
        success: true,
        thumbnail,
        filename
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

  // ============================================================================
  // CAMERA ROUTES
  // ============================================================================

  /**
   * GET /api/camera/status - Get camera status
   */
  router.get('/camera/status', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = contextManager.getActiveContextId();
      const isAvailable = contextId ? backendManager.isFeatureAvailable(contextId, 'camera') : false;

      // TODO: Get actual camera status from camera manager when available
      const response: CameraStatusResponse = {
        available: isAvailable,
        streaming: false,
        url: isAvailable ? '/api/camera/stream' : undefined,
        clientCount: 0
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

  /**
   * GET /api/camera/proxy-config - Get camera proxy configuration for active context
   * Now supports both MJPEG and RTSP streams
   */
  router.get('/camera/proxy-config', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { getPrinterContextManager } = await import('../../managers/PrinterContextManager');
      const { resolveCameraConfig, getCameraUserConfig } = await import('../../utils/camera-utils');
      const { getPrinterBackendManager } = await import('../../managers/PrinterBackendManager');
      const contextManager = getPrinterContextManager();
      const activeContext = contextManager.getActiveContext();

      if (!activeContext) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      // Get camera configuration for this context
      const backendManager = getPrinterBackendManager();
      const backend = backendManager.getBackendForContext(activeContext.id);

      if (!backend) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Backend not found for context'
        };
        return res.status(503).json(response);
      }

      const backendStatus = backend.getBackendStatus();
      const cameraConfig = resolveCameraConfig({
        printerIpAddress: activeContext.printerDetails.IPAddress,
        printerFeatures: backendStatus.features,
        userConfig: getCameraUserConfig(activeContext.id)
      });

      if (!cameraConfig.isAvailable || !cameraConfig.streamUrl) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Camera not available for this printer'
        };
        return res.status(503).json(response);
      }

      // Handle based on stream type
      if (cameraConfig.streamType === 'rtsp') {
        // RTSP: Provide WebSocket port for node-rtsp-stream
        const { getRtspStreamService } = await import('../../services/RtspStreamService');
        const rtspStreamService = getRtspStreamService();
        const ffmpegStatus = rtspStreamService.getFfmpegStatus();

        if (!ffmpegStatus.available) {
          const response = {
            success: false,
            error: 'ffmpeg required to view RTSP cameras in browser',
            streamType: 'rtsp' as const,
            ffmpegAvailable: false
          };
          return res.status(503).json(response);
        }

        let streamStatus = rtspStreamService.getStreamStatus(activeContext.id);

        // Lazily initialize RTSP relay if it has not been started yet for this context
        if (!streamStatus) {
          try {
            const { rtspFrameRate, rtspQuality } = activeContext.printerDetails;
            await rtspStreamService.setupStream(activeContext.id, cameraConfig.streamUrl, {
              frameRate: rtspFrameRate,
              quality: rtspQuality
            });
            streamStatus = rtspStreamService.getStreamStatus(activeContext.id);
          } catch (streamError) {
            console.error(
              `[WebUI] Failed to setup RTSP stream for context ${activeContext.id}:`,
              streamError
            );
            const response: StandardAPIResponse = {
              success: false,
              error: 'RTSP stream not available'
            };
            return res.status(503).json(response);
          }
        }

        if (!streamStatus) {
          const response: StandardAPIResponse = {
            success: false,
            error: 'RTSP stream not available'
          };
          return res.status(503).json(response);
        }

        const response = {
          success: true,
          streamType: 'rtsp' as const,
          wsPort: streamStatus.wsPort,
          ffmpegAvailable: true
        };
        return res.json(response);
      } else {
        // MJPEG: Use camera proxy service
        const { getCameraProxyService } = await import('../../services/CameraProxyService');
        const cameraProxyService = getCameraProxyService();
        let status = cameraProxyService.getStatusForContext(activeContext.id);

        // Lazily start the proxy if no status is registered for this context yet
        if (!status) {
          try {
            await cameraProxyService.setStreamUrl(activeContext.id, cameraConfig.streamUrl);
            status = cameraProxyService.getStatusForContext(activeContext.id);
          } catch (proxyError) {
            console.error(
              `[WebUI] Failed to start camera proxy for context ${activeContext.id}:`,
              proxyError
            );
            const response: StandardAPIResponse = {
              success: false,
              error: 'Camera proxy could not be started'
            };
            return res.status(503).json(response);
          }
        }

        if (!status) {
          const response: StandardAPIResponse = {
            success: false,
            error: 'Camera proxy not available for this printer'
          };
          return res.status(503).json(response);
        }

        const host = req.hostname || 'localhost';
        const response = {
          success: true,
          streamType: 'mjpeg' as const,
          port: status.port,
          url: `http://${host}:${status.port}/stream`
        };
        return res.json(response);
      }

    } catch (error) {
      const appError = toAppError(error);
      const response: StandardAPIResponse = {
        success: false,
        error: appError.message
      };
      return res.status(500).json(response);
    }
  });

  // ============================================================================
  // MULTI-PRINTER CONTEXT MANAGEMENT
  // ============================================================================

  /**
   * GET /api/contexts - Get all connected printer contexts
   */
  router.get('/contexts', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const allContexts = contextManager.getAllContexts();
      const activeContextId = contextManager.getActiveContextId();

      const contexts = allContexts.map(context => ({
        id: context.id,
        name: context.printerDetails.Name,
        model: context.printerDetails.printerModel || 'Unknown',
        ipAddress: context.printerDetails.IPAddress,
        serialNumber: context.printerDetails.SerialNumber,
        isActive: context.id === activeContextId
      }));

      const response = {
        success: true,
        contexts,
        activeContextId
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

  /**
   * POST /api/contexts/switch - Switch active printer context
   */
  router.post('/contexts/switch', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { contextId } = req.body as { contextId?: string };

      if (!contextId || typeof contextId !== 'string') {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Context ID is required'
        };
        return res.status(400).json(response);
      }

      // Verify context exists
      const context = contextManager.getContext(contextId);
      if (!context) {
        const response: StandardAPIResponse = {
          success: false,
          error: `Context ${contextId} not found`
        };
        return res.status(404).json(response);
      }

      // Switch to the context
      contextManager.switchContext(contextId);

      const response: StandardAPIResponse = {
        success: true,
        message: `Switched to printer: ${context.printerDetails.Name}`
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

  // ============================================================================
  // THEME MANAGEMENT ROUTES
  // ============================================================================

  /**
   * GET /api/webui/theme - Get WebUI theme colors
   */
  router.get('/webui/theme', async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const configManager = getConfigManager();
      const config = configManager.getConfig();

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

  /**
   * POST /api/webui/theme - Update WebUI theme colors
   */
  router.post('/webui/theme', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const configManager = getConfigManager();

      // Sanitize the incoming theme data
      const sanitizedTheme = sanitizeTheme(req.body);

      // Update config with new theme
      const currentConfig = configManager.getConfig();
      await configManager.updateConfig({
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

  // ============================================================================
  // SPOOLMAN INTEGRATION
  // ============================================================================

  /**
   * GET /api/spoolman/config - Get Spoolman configuration and support status
   */
  router.get('/spoolman/config', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const service = getSpoolmanIntegrationService();
      const activeContextId = contextManager.getActiveContextId();

      if (!activeContextId) {
        const response: SpoolmanConfigResponse = {
          success: false,
          error: 'No active printer context',
          enabled: false,
          serverUrl: '',
          updateMode: 'weight',
          contextId: null
        };
        return res.status(503).json(response);
      }

      const enabled = service.isGloballyEnabled() && service.isContextSupported(activeContextId);
      const disabledReason = service.getDisabledReason(activeContextId);

      const response: SpoolmanConfigResponse = {
        success: true,
        enabled,
        disabledReason,
        serverUrl: service.getServerUrl(),
        updateMode: service.getUpdateMode(),
        contextId: activeContextId
      };

      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      const response: SpoolmanConfigResponse = {
        success: false,
        error: appError.message,
        enabled: false,
        serverUrl: '',
        updateMode: 'weight',
        contextId: null
      };
      return res.status(500).json(response);
    }
  });

  /**
   * GET /api/spoolman/spools - Search for spools
   */
  router.get('/spoolman/spools', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const service = getSpoolmanIntegrationService();

      if (!service.isGloballyEnabled()) {
        const response: SpoolSearchResponse = {
          success: false,
          error: 'Spoolman integration is not enabled',
          spools: []
        };
        return res.status(400).json(response);
      }

      const search = (req.query.search as string) || '';

      // Build search query with server-side filtering
      const searchQuery: import('../../types/spoolman').SpoolSearchQuery = {
        limit: 50,
        allow_archived: false
      };

      // Add search parameter if query exists (server-side filtering)
      if (search && search.trim()) {
        searchQuery['filament.name'] = search.trim();
      }

      // Fetch spools from Spoolman API with server-side filtering
      const spoolsData = await service.fetchSpools(searchQuery);

      // Convert to simplified format for WebUI
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
        spools: spools
      };

      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      const response: SpoolSearchResponse = {
        success: false,
        error: appError.message,
        spools: []
      };
      return res.status(500).json(response);
    }
  });

  /**
   * GET /api/spoolman/active/:contextId - Get active spool for a context
   */
  router.get('/spoolman/active/:contextId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const service = getSpoolmanIntegrationService();
      const contextId = req.params.contextId;

      // Verify context exists
      const context = contextManager.getContext(contextId);
      if (!context) {
        const response: ActiveSpoolResponse = {
          success: false,
          error: `Context ${contextId} not found`,
          spool: null
        };
        return res.status(404).json(response);
      }

      // Check if context is supported (reject AD5X)
      if (!service.isContextSupported(contextId)) {
        const response: ActiveSpoolResponse = {
          success: false,
          error: 'Spoolman integration is disabled for this printer (AD5X with material station)',
          spool: null
        };
        return res.status(409).json(response);
      }

      const spool = service.getActiveSpool(contextId);

      const response: ActiveSpoolResponse = {
        success: true,
        spool
      };

      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      const response: ActiveSpoolResponse = {
        success: false,
        error: appError.message,
        spool: null
      };
      return res.status(500).json(response);
    }
  });

  /**
   * POST /api/spoolman/select - Select active spool for a context
   */
  router.post('/spoolman/select', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const service = getSpoolmanIntegrationService();

      // Validate request body
      const validation = SpoolSelectRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        const response: StandardAPIResponse = {
          success: false,
          ...validationError
        };
        return res.status(400).json(response);
      }

      const { contextId, spoolId } = validation.data;
      const targetContextId = contextId || contextManager.getActiveContextId();

      if (!targetContextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      // Verify context exists
      const context = contextManager.getContext(targetContextId);
      if (!context) {
        const response: StandardAPIResponse = {
          success: false,
          error: `Context ${targetContextId} not found`
        };
        return res.status(404).json(response);
      }

      // Check if context is supported (reject AD5X)
      if (!service.isContextSupported(targetContextId)) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Spoolman integration is disabled for this printer (AD5X with material station)'
        };
        return res.status(409).json(response);
      }

      // Fetch spool details and set as active
      const spoolData = await service.getSpoolById(spoolId);
      await service.setActiveSpool(targetContextId, spoolData);

      const response: SpoolSelectResponse = {
        success: true,
        spool: spoolData
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

  /**
   * DELETE /api/spoolman/select - Clear active spool for a context
   */
  router.delete('/spoolman/select', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const service = getSpoolmanIntegrationService();

      // Validate request body
      const validation = SpoolClearRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = createValidationError(validation.error);
        const response: StandardAPIResponse = {
          success: false,
          ...validationError
        };
        return res.status(400).json(response);
      }

      const { contextId } = validation.data;
      const targetContextId = contextId || contextManager.getActiveContextId();

      if (!targetContextId) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'No active printer context'
        };
        return res.status(503).json(response);
      }

      // Verify context exists
      const context = contextManager.getContext(targetContextId);
      if (!context) {
        const response: StandardAPIResponse = {
          success: false,
          error: `Context ${targetContextId} not found`
        };
        return res.status(404).json(response);
      }

      // Check if context is supported (reject AD5X)
      if (!service.isContextSupported(targetContextId)) {
        const response: StandardAPIResponse = {
          success: false,
          error: 'Spoolman integration is disabled for this printer (AD5X with material station)'
        };
        return res.status(409).json(response);
      }

      await service.clearActiveSpool(targetContextId);

      const response: StandardAPIResponse = {
        success: true,
        message: 'Active spool cleared'
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

  return router;
}

