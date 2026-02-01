/**
 * @fileoverview Camera status and proxy configuration routes for the WebUI server.
 *
 * Provides endpoints for camera configuration using go2rtc as the streaming gateway.
 * All camera types (MJPEG and RTSP) are handled through go2rtc, which provides
 * unified WebRTC/MSE/MJPEG fallback for browser playback.
 */

import { CameraStatusResponse, StandardAPIResponse } from '@shared/types/web-api.types.js';
import type { Response, Router } from 'express';
import { getGo2rtcBinaryManager } from '../../../services/Go2rtcBinaryManager.js';
import { getGo2rtcService } from '../../../services/Go2rtcService.js';
import { getCameraUserConfig, resolveCameraConfig } from '../../../utils/camera-utils.js';
import { toAppError } from '../../../utils/error.utils.js';
import type { AuthenticatedRequest } from '../auth-middleware.js';
import { type RouteDependencies, resolveContext, sendErrorResponse } from './route-helpers.js';

export function registerCameraRoutes(router: Router, deps: RouteDependencies): void {
  router.get('/camera/status', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(res, contextResult.statusCode, contextResult.error);
      }

      const isAvailable = deps.backendManager.isFeatureAvailable(contextResult.contextId, 'camera');
      const go2rtcService = getGo2rtcService();
      const hasStream = go2rtcService.hasStream(contextResult.contextId);

      const response: CameraStatusResponse = {
        available: isAvailable,
        streaming: hasStream,
        url: isAvailable ? '/api/camera/proxy-config' : undefined,
        clientCount: 0,
      };

      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });

  router.get('/camera/proxy-config', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, {
        requireBackendReady: true,
        requireBackendInstance: true,
      });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(res, contextResult.statusCode, contextResult.error);
      }

      const { contextId, context, backend } = contextResult;
      if (!backend) {
        return sendErrorResponse<StandardAPIResponse>(res, 503, 'Backend not available');
      }

      const backendStatus = backend.getBackendStatus();
      const cameraConfig = resolveCameraConfig({
        printerIpAddress: context.printerDetails.IPAddress,
        printerFeatures: backendStatus.features,
        userConfig: getCameraUserConfig(contextId),
      });

      if (!cameraConfig.isAvailable || !cameraConfig.streamUrl || !cameraConfig.streamType) {
        return sendErrorResponse<StandardAPIResponse>(res, 503, 'Camera not available for this printer');
      }

      // Get FPS overlay setting from printer details
      const showCameraFps = context.printerDetails.showCameraFps ?? false;

      // Get go2rtc service and ensure stream is set up
      const go2rtcService = getGo2rtcService();

      // Ensure go2rtc is running
      if (!go2rtcService.isRunning()) {
        try {
          await go2rtcService.initialize();
        } catch (initError) {
          console.error('[WebUI] Failed to initialize go2rtc service:', initError);
          return sendErrorResponse<StandardAPIResponse>(res, 503, 'Camera streaming service not available');
        }
      }

      // Add stream if not already added
      if (!go2rtcService.hasStream(contextId)) {
        try {
          await go2rtcService.addStream(
            contextId,
            cameraConfig.streamUrl,
            cameraConfig.sourceType,
            cameraConfig.streamType
          );
        } catch (streamError) {
          console.error(`[WebUI] Failed to setup stream for context ${contextId}:`, streamError);
          return sendErrorResponse<StandardAPIResponse>(res, 503, 'Failed to setup camera stream');
        }
      }

      // Get stream configuration
      const streamConfig = go2rtcService.getStreamConfig(contextId);

      if (!streamConfig) {
        return sendErrorResponse<StandardAPIResponse>(res, 503, 'Camera stream not available');
      }

      // Build WebSocket URL for WebUI client
      // WebUI needs to connect to go2rtc on the server's hostname, not localhost
      const host = req.hostname || 'localhost';
      const { username, password } = getGo2rtcBinaryManager().getCredentials();
      const wsUrl = `ws://${host}:${streamConfig.apiPort}/api/ws?src=${encodeURIComponent(
        streamConfig.streamName
      )}&user=${username}&password=${password}`;

      const response = {
        success: true,
        wsUrl,
        streamType: cameraConfig.streamType,
        sourceType: cameraConfig.sourceType,
        streamName: streamConfig.streamName,
        apiPort: streamConfig.apiPort,
        mode: streamConfig.mode,
        showCameraFps,
      };

      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });
}
