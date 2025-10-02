/**
 * @fileoverview HTTP API routes for filament tracker integration.
 *
 * Exposes real-time filament usage data, printer connection status, and printer state
 * information via HTTP endpoints for consumption by external applications like
 * filament-tracker-electron. Routes are protected by optional API key authentication
 * and can be enabled/disabled via application settings.
 *
 * Endpoints:
 * - GET /api/filament-tracker/status - Comprehensive status and current job info
 * - GET /api/filament-tracker/current - Current job filament usage only
 * - GET /api/filament-tracker/lifetime - Lifetime filament statistics
 */

import { Router, Request, Response } from 'express';
import { createFilamentTrackerAuth } from './filament-tracker-auth';
import { getWebSocketManager } from './WebSocketManager';
import { getPrinterConnectionManager } from '../../managers/ConnectionFlowManager';
import type { PollingData } from '../../types/polling';

/**
 * Standard API response for successful requests
 */
interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * Standard API response for failed requests
 */
interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * Combined response type
 */
type APIResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * Status endpoint response data
 */
interface StatusData {
  isConnected: boolean;
  printerName?: string;
  printerState: string | null;
  isPrinting: boolean;
  currentJob: {
    fileName: string;
    displayName: string;
    startTime: string;
    progress: {
      percentage: number;
      currentLayer: number | null;
      totalLayers: number | null;
      timeRemaining: number | null;
      elapsedTime: number;
      weightUsed: number;
      lengthUsed: number;
    };
  } | null;
}

/**
 * Current job endpoint response data
 */
interface CurrentJobData {
  grams: number;
  meters: number;
  jobName: string;
  elapsedMinutes: number;
}

/**
 * Lifetime statistics endpoint response data
 */
interface LifetimeData {
  totalMeters: number;
  totalMinutes: number;
}

/**
 * Create router with filament tracker API routes
 */
export function createFilamentTrackerRoutes(): Router {
  const router = Router();
  const auth = createFilamentTrackerAuth();
  const wsManager = getWebSocketManager();
  const connectionManager = getPrinterConnectionManager();

  // Apply authentication middleware to all routes
  router.use(auth);

  /**
   * GET /api/filament-tracker/status
   * Returns comprehensive status including connection, printer state, and current job info
   */
  router.get('/filament-tracker/status', (req: Request, res: Response) => {
    try {
      const isConnected = connectionManager.isConnected();
      const pollingData = wsManager.getLatestPollingData();
      const printerDetails = connectionManager.getCurrentDetails();

      const statusData: StatusData = {
        isConnected,
        printerName: printerDetails?.Name,
        printerState: isConnected && pollingData?.printerStatus ? pollingData.printerStatus.state : null,
        isPrinting: isConnected && pollingData?.printerStatus?.state === 'Printing',
        currentJob: null
      };

      // Include current job if printing or paused
      if (isConnected && pollingData?.printerStatus?.currentJob?.isActive) {
        const job = pollingData.printerStatus.currentJob;
        statusData.currentJob = {
          fileName: job.fileName,
          displayName: job.displayName,
          startTime: job.startTime.toISOString(),
          progress: {
            percentage: job.progress.percentage,
            currentLayer: job.progress.currentLayer,
            totalLayers: job.progress.totalLayers,
            timeRemaining: job.progress.timeRemaining,
            elapsedTime: job.progress.elapsedTime,
            weightUsed: job.progress.weightUsed,
            lengthUsed: job.progress.lengthUsed
          }
        };
      }

      const response: APIResponse<StatusData> = {
        success: true,
        data: statusData
      };

      res.json(response);
    } catch (error) {
      const response: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  });

  /**
   * GET /api/filament-tracker/current
   * Returns current job filament usage only
   */
  router.get('/filament-tracker/current', (req: Request, res: Response) => {
    try {
      const isConnected = connectionManager.isConnected();
      const pollingData = wsManager.getLatestPollingData();

      // Check if there's an active job
      if (!isConnected || !pollingData?.printerStatus?.currentJob?.isActive) {
        const response: ErrorResponse = {
          success: false,
          error: 'No active print job'
        };
        res.status(404).json(response);
        return;
      }

      const job = pollingData.printerStatus.currentJob;
      const currentData: CurrentJobData = {
        grams: job.progress.weightUsed,
        meters: job.progress.lengthUsed,
        jobName: job.fileName,
        elapsedMinutes: job.progress.elapsedTime
      };

      const response: APIResponse<CurrentJobData> = {
        success: true,
        data: currentData
      };

      res.json(response);
    } catch (error) {
      const response: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  });

  /**
   * GET /api/filament-tracker/lifetime
   * Returns lifetime statistics
   */
  router.get('/filament-tracker/lifetime', (req: Request, res: Response) => {
    try {
      const isConnected = connectionManager.isConnected();
      const pollingData = wsManager.getLatestPollingData();

      // Check if printer is connected and has cumulative stats
      if (!isConnected || !pollingData?.printerStatus?.cumulativeStats) {
        const response: ErrorResponse = {
          success: false,
          error: 'Printer not connected or cumulative statistics not available'
        };
        res.status(404).json(response);
        return;
      }

      const lifetimeData: LifetimeData = {
        totalMeters: pollingData.printerStatus.cumulativeStats.totalFilamentUsed,
        totalMinutes: pollingData.printerStatus.cumulativeStats.totalPrintTime
      };

      const response: APIResponse<LifetimeData> = {
        success: true,
        data: lifetimeData
      };

      res.json(response);
    } catch (error) {
      const response: ErrorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      res.status(500).json(response);
    }
  });

  return router;
}
