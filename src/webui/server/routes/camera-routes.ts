/**
 * @fileoverview Camera status and proxy configuration routes for the WebUI server.
 */

import type { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../auth-middleware';
import { CameraStatusResponse, StandardAPIResponse } from '../../types/web-api.types';
import { toAppError } from '../../../utils/error.utils';
import { resolveContext, sendErrorResponse, type RouteDependencies } from './route-helpers';

export function registerCameraRoutes(router: Router, deps: RouteDependencies): void {
  router.get('/camera/status', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps, { requireBackendReady: true });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          contextResult.statusCode,
          contextResult.error
        );
      }

      const isAvailable = deps.backendManager.isFeatureAvailable(
        contextResult.contextId,
        'camera'
      );

      const response: CameraStatusResponse = {
        available: isAvailable,
        streaming: false,
        url: isAvailable ? '/api/camera/stream' : undefined,
        clientCount: 0
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
        requireBackendInstance: true
      });
      if (!contextResult.success) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          contextResult.statusCode,
          contextResult.error
        );
      }

      const { contextId, context, backend } = contextResult;
      if (!backend) {
        return sendErrorResponse<StandardAPIResponse>(res, 503, 'Backend not available');
      }

      const { resolveCameraConfig, getCameraUserConfig } = await import(
        '../../../utils/camera-utils'
      );
      const backendStatus = backend.getBackendStatus();
      const cameraConfig = resolveCameraConfig({
        printerIpAddress: context.printerDetails.IPAddress,
        printerFeatures: backendStatus.features,
        userConfig: getCameraUserConfig(contextId)
      });

      if (!cameraConfig.isAvailable || !cameraConfig.streamUrl) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          503,
          'Camera not available for this printer'
        );
      }

      if (cameraConfig.streamType === 'rtsp') {
        const { getRtspStreamService } = await import('../../../services/RtspStreamService');
        const rtspStreamService = getRtspStreamService();
        const ffmpegStatus = rtspStreamService.getFfmpegStatus();

        if (!ffmpegStatus.available) {
          return sendErrorResponse<
            StandardAPIResponse & { streamType: 'rtsp'; ffmpegAvailable: boolean }
          >(res, 503, 'ffmpeg required to view RTSP cameras in browser', {
            streamType: 'rtsp',
            ffmpegAvailable: false
          });
        }

        let streamStatus = rtspStreamService.getStreamStatus(contextId);
        if (!streamStatus) {
          try {
            const { rtspFrameRate, rtspQuality } = context.printerDetails;
            await rtspStreamService.setupStream(contextId, cameraConfig.streamUrl, {
              frameRate: rtspFrameRate,
              quality: rtspQuality
            });
            streamStatus = rtspStreamService.getStreamStatus(contextId);
          } catch (streamError) {
            console.error(
              `[WebUI] Failed to setup RTSP stream for context ${contextId}:`,
              streamError
            );
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
          ffmpegAvailable: true
        };
        return res.json(response);
      }

      const { getCameraProxyService } = await import('../../../services/CameraProxyService');
      const cameraProxyService = getCameraProxyService();
      let status = cameraProxyService.getStatusForContext(contextId);

      if (!status) {
        try {
          await cameraProxyService.setStreamUrl(contextId, cameraConfig.streamUrl);
          status = cameraProxyService.getStatusForContext(contextId);
        } catch (proxyError) {
          console.error(
            `[WebUI] Failed to start camera proxy for context ${contextId}:`,
            proxyError
          );
          return sendErrorResponse<StandardAPIResponse>(
            res,
            503,
            'Camera proxy could not be started'
          );
        }
      }

      if (!status) {
        return sendErrorResponse<StandardAPIResponse>(
          res,
          503,
          'Camera proxy not available for this printer'
        );
      }

      const host = req.hostname || 'localhost';
      const response = {
        success: true,
        streamType: 'mjpeg' as const,
        port: status.port,
        url: `http://${host}:${status.port}/stream`
      };
      return res.json(response);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse<StandardAPIResponse>(res, 500, appError.message);
    }
  });
}
