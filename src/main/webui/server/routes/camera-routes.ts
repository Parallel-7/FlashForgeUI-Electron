/**
 * @fileoverview Camera status and proxy configuration routes for the WebUI server.
 *
 * Provides endpoints for camera configuration using go2rtc as the streaming gateway.
 * All camera types (MJPEG and RTSP) are handled through go2rtc, which provides
 * unified WebRTC/MSE/MJPEG fallback for browser playback.
 */

import { CameraStatusResponse, StandardAPIResponse } from '@shared/types/web-api.types.js';
import type { Response, Router } from 'express';
import { getGo2rtcService } from '../../../services/Go2rtcService.js';
import { resolveAndEnsureCameraStream } from '../../../services/CameraStreamCoordinator.js';
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
      const backend = deps.backendManager.getBackendForContext(contextResult.contextId);
      const cameraConfig =
        backend &&
        resolveCameraConfig({
          printerIpAddress: contextResult.context.printerDetails.IPAddress,
          printerFeatures: backend.getBackendStatus().features,
          userConfig: getCameraUserConfig(contextResult.contextId),
        });
      const hasStream =
        !!cameraConfig &&
        cameraConfig.isAvailable &&
        !!cameraConfig.streamUrl &&
        !!cameraConfig.streamType &&
        (cameraConfig.sourceType === 'oem' || cameraConfig.sourceType === 'custom') &&
        go2rtcService.hasMatchingStream(
          contextResult.contextId,
          cameraConfig.streamUrl,
          cameraConfig.sourceType,
          cameraConfig.streamType
        );

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

      const ensuredStream = await resolveAndEnsureCameraStream({
        contextId,
        printerIpAddress: context.printerDetails.IPAddress,
        printerFeatures: backend.getBackendStatus().features,
        userConfig: getCameraUserConfig(contextId),
        go2rtcService: getGo2rtcService(),
      });

      if (!ensuredStream) {
        return sendErrorResponse<StandardAPIResponse>(res, 503, 'Camera not available for this printer');
      }

      const { cameraConfig, streamConfig } = ensuredStream;

      // Get FPS overlay setting from printer details
      const showCameraFps = context.printerDetails.showCameraFps ?? false;

      // Build WebSocket URL for WebUI client
      // WebUI needs to connect to go2rtc on the server's hostname, not localhost
      const host = req.hostname || 'localhost';
      const wsUrl = `ws://${host}:${streamConfig.apiPort}/api/ws?src=${encodeURIComponent(streamConfig.streamName)}`;

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
