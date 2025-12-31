/**
 * @fileoverview Camera status and proxy configuration routes for the WebUI server.
 */

import { CameraStatusResponse, StandardAPIResponse } from '@shared/types/web-api.types.js';
import type { Response, Router } from 'express';
import { getCameraProxyService } from '../../../services/CameraProxyService.js';
import { getRtspStreamService } from '../../../services/RtspStreamService.js';
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

      const response: CameraStatusResponse = {
        available: isAvailable,
        streaming: false,
        url: isAvailable ? '/api/camera/stream' : undefined,
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

      if (!cameraConfig.isAvailable || !cameraConfig.streamUrl) {
        return sendErrorResponse<StandardAPIResponse>(res, 503, 'Camera not available for this printer');
      }

      // Get FPS overlay setting from printer details
      const showCameraFps = context.printerDetails.showCameraFps ?? false;

      if (cameraConfig.streamType === 'rtsp') {
        const rtspStreamService = getRtspStreamService();
        const ffmpegStatus = rtspStreamService.getFfmpegStatus();

        if (!ffmpegStatus.available) {
          return sendErrorResponse<StandardAPIResponse & { streamType: 'rtsp'; ffmpegAvailable: boolean }>(
            res,
            503,
            'ffmpeg required to view RTSP cameras in browser',
            {
              streamType: 'rtsp',
              ffmpegAvailable: false,
            }
          );
        }

        let streamStatus = rtspStreamService.getStreamStatus(contextId);
        if (!streamStatus) {
          try {
            const { rtspFrameRate, rtspQuality } = context.printerDetails;
            await rtspStreamService.setupStream(contextId, cameraConfig.streamUrl, {
              frameRate: rtspFrameRate,
              quality: rtspQuality,
            });
            streamStatus = rtspStreamService.getStreamStatus(contextId);
          } catch (streamError) {
            console.error(`[WebUI] Failed to setup RTSP stream for context ${contextId}:`, streamError);
            return sendErrorResponse<StandardAPIResponse>(res, 503, 'RTSP stream not available');
          }
        }

        if (!streamStatus) {
          return sendErrorResponse<StandardAPIResponse>(res, 503, 'RTSP stream not available');
        }

        const response = {
          success: true,
          streamType: 'rtsp' as const,
          wsPort: streamStatus.wsPort,
          ffmpegAvailable: true,
          showCameraFps,
        };
        return res.json(response);
      } else if (cameraConfig.streamType === 'mjpeg') {
        const cameraProxyService = getCameraProxyService();
        await cameraProxyService.setStreamUrl(contextId, cameraConfig.streamUrl);
        const status = cameraProxyService.getStatusForContext(contextId);

        if (!status) {
          return sendErrorResponse<StandardAPIResponse>(res, 503, 'Camera proxy not available for this printer');
        }

        const host = req.hostname || 'localhost';
        const response = {
          success: true,
          streamType: 'mjpeg' as const,
          port: status.port,
          url: `http://${host}:${status.port}/stream`,
          showCameraFps,
        };
        return res.json(response);
      } else {
        return sendErrorResponse<StandardAPIResponse>(res, 501, 'Unsupported camera stream type');
      }
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });
}
