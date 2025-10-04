/**
 * API route handlers for WebUI printer control endpoints.
 * Wraps backend manager methods with HTTP/REST interface, authentication, and validation.
 * All routes return discriminated union results for type-safe error handling.
 */

import { Router, Response } from 'express';
import { getPrinterBackendManager } from '../../managers/PrinterBackendManager';
import { getPrinterConnectionManager } from '../../managers/ConnectionFlowManager';
import { getPrinterContextManager } from '../../managers/PrinterContextManager';
import { AuthenticatedRequest } from './auth-middleware';
import {
  TemperatureSetRequestSchema,
  JobStartRequestSchema,
  createValidationError
} from '../schemas/web-api.schemas';
import {
  StandardAPIResponse,
  PrinterStatusResponse,
  PrinterFeatures,
  CameraStatusResponse
} from '../types/web-api.types';
import { toAppError } from '../../utils/error.utils';
import { FiveMClient } from 'ff-api';

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
          thumbnail: undefined // Basic jobs don't have thumbnail
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
          thumbnail: undefined // Basic jobs don't have thumbnail
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

      const result = await backendManager.startJob(contextId, {
        operation: 'start',
        fileName: validation.data.filename,
        startNow: validation.data.startNow,
        leveling: validation.data.leveling
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
   * GET /api/camera/proxy-config - Get camera proxy configuration
   */
  router.get('/camera/proxy-config', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const configManager = (await import('../../managers/ConfigManager')).getConfigManager();
      const cameraProxyPort = configManager.get('CameraProxyPort') || 8181;

      const response = {
        success: true,
        port: cameraProxyPort,
        url: `http://${req.hostname}:${cameraProxyPort}/camera`
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
