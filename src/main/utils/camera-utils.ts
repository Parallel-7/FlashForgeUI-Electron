/**
 * @fileoverview Camera configuration resolution and validation utilities implementing priority-based
 * camera URL selection logic. Supports both OEM printer cameras and custom camera URLs (MJPEG/RTSP),
 * with context-aware settings retrieval for multi-printer environments. Provides stream type detection,
 * URL validation, and human-readable status messaging.
 *
 * Key Features:
 * - Priority-based camera resolution: custom camera > OEM camera > none
 * - MJPEG and RTSP stream type detection and validation
 * - Context-aware camera configuration (per-printer or global settings)
 * - Settings normalization for stale custom-camera configurations
 * - Comprehensive URL validation (protocol, hostname, format)
 * - Camera availability checking with detailed unavailability reasons
 * - Proxy URL formatting for client consumption
 *
 * Resolution Priority:
 * 1. Custom camera (if enabled): Uses explicit user-provided URL only
 * 2. OEM camera: Uses the runtime stream URL reported by the printer
 * 3. No camera: Returns unavailable status with reason
 *
 * Stream Types Supported:
 * - MJPEG (Motion JPEG over HTTP/HTTPS)
 * - RTSP (Real-Time Streaming Protocol)
 *
 * Context Awareness:
 * - Supports per-printer camera settings when contextId is provided
 * - Falls back to global configuration for backward compatibility
 * - Integrates with PrinterContextManager for multi-printer camera configurations
 *
 * Usage:
 * - resolveCameraConfig(): Main resolution function with comprehensive config object
 * - validateCameraUrl(): Standalone URL validation with detailed error messages
 * - getCameraUserConfig(): Context-aware settings retrieval
 * - isCameraFeatureAvailable(): Boolean availability check
 */

import {
  CameraStreamType,
  CameraUrlResolutionParams,
  CameraUrlValidationResult,
  CameraUserConfig,
  ResolvedCameraConfig,
} from '@shared/types/camera/index.js';
import { normalizeCustomCameraSettings } from '@shared/utils/printerSettingsDefaults.js';
import { getConfigManager } from '../managers/ConfigManager.js';
import { getPrinterContextManager } from '../managers/PrinterContextManager.js';

/**
 * Detect stream type from camera URL
 *
 * @param url - Camera URL to analyze
 * @returns Stream type (mjpeg or rtsp)
 */
export function detectStreamType(url: string): CameraStreamType {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'rtsp:' ? 'rtsp' : 'mjpeg';
  } catch {
    // Default to MJPEG for invalid URLs
    return 'mjpeg';
  }
}

/**
 * Validate a camera URL
 */
export function validateCameraUrl(url: string | null | undefined): CameraUrlValidationResult {
  if (!url || url.trim() === '') {
    return {
      isValid: false,
      error: 'URL is empty or not provided',
    };
  }

  try {
    const parsedUrl = new URL(url);

    // Check for supported protocols
    if (!['http:', 'https:', 'rtsp:'].includes(parsedUrl.protocol)) {
      return {
        isValid: false,
        error: `Unsupported protocol: ${parsedUrl.protocol}. Use http://, https://, or rtsp://`,
      };
    }

    // Check for valid hostname
    if (!parsedUrl.hostname || parsedUrl.hostname === '') {
      return {
        isValid: false,
        error: 'Invalid hostname in URL',
      };
    }

    return {
      isValid: true,
      parsedUrl,
    };
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format',
    };
  }
}

/**
 * Resolve camera configuration based on priority rules
 */
export function resolveCameraConfig(params: CameraUrlResolutionParams): ResolvedCameraConfig {
  const { printerFeatures } = params;
  const normalizedUserConfig = normalizeCustomCameraSettings({
    customCameraEnabled: params.userConfig.customCameraEnabled,
    customCameraUrl: params.userConfig.customCameraUrl ?? '',
  });

  // Priority 1: Check custom camera
  if (normalizedUserConfig.customCameraEnabled) {
    // Custom camera enabled with a user-provided URL
    const validation = validateCameraUrl(normalizedUserConfig.customCameraUrl);

    if (validation.isValid) {
      return {
        sourceType: 'custom',
        streamType: detectStreamType(normalizedUserConfig.customCameraUrl),
        streamUrl: normalizedUserConfig.customCameraUrl,
        isAvailable: true,
      };
    } else {
      // Custom camera enabled but URL is invalid
      return {
        sourceType: 'custom',
        streamUrl: null,
        isAvailable: false,
        unavailableReason: `Custom camera URL is invalid: ${validation.error}`,
      };
    }
  }

  // Priority 2: Check OEM camera reported by the printer
  if (printerFeatures.camera.oemStreamUrl.trim() !== '') {
    return {
      sourceType: 'oem',
      streamType: detectStreamType(printerFeatures.camera.oemStreamUrl),
      streamUrl: printerFeatures.camera.oemStreamUrl,
      isAvailable: true,
    };
  }

  // Priority 3: No camera available
  return {
    sourceType: 'none',
    streamUrl: null,
    isAvailable: false,
    unavailableReason: 'Printer is not reporting an OEM camera stream and no custom camera URL is configured',
  };
}

/**
 * Get camera configuration from user settings
 * Now context-aware: reads from per-printer settings if contextId provided,
 * otherwise falls back to global config (for backward compatibility)
 *
 * @param contextId - Optional context ID to get per-printer camera settings
 * @returns Camera user configuration
 */
export function getCameraUserConfig(contextId?: string): CameraUserConfig {
  const configManager = getConfigManager();

  // If contextId provided, try to get per-printer settings first
  if (contextId) {
    const contextManager = getPrinterContextManager();
    const context = contextManager.getContext(contextId);

    if (context?.printerDetails) {
      const { customCameraEnabled, customCameraUrl } = context.printerDetails;

      // Per-printer settings override global config
      if (customCameraEnabled !== undefined) {
        const normalized = normalizeCustomCameraSettings({
          customCameraEnabled,
          customCameraUrl: customCameraUrl || '',
        });
        return {
          customCameraEnabled: normalized.customCameraEnabled ?? false,
          customCameraUrl: normalized.customCameraUrl || null,
        };
      }
    }
  }

  // Fall back to global config
  const normalized = normalizeCustomCameraSettings({
    customCameraEnabled: configManager.get('CustomCamera') || false,
    customCameraUrl: configManager.get('CustomCameraUrl') || '',
  });
  return {
    customCameraEnabled: normalized.customCameraEnabled ?? false,
    customCameraUrl: normalized.customCameraUrl || null,
  };
}

/**
 * Format go2rtc WebSocket URL for stream negotiation
 * @param apiPort - go2rtc API port (default: 1984)
 * @param streamName - Stream name in go2rtc
 * @returns WebSocket URL for video-rtc element
 */
export function formatGo2rtcWsUrl(apiPort: number, streamName: string): string {
  return `ws://localhost:${apiPort}/api/ws?src=${encodeURIComponent(streamName)}`;
}

/**
 * Format go2rtc MJPEG snapshot URL
 * @param apiPort - go2rtc API port (default: 1984)
 * @param streamName - Stream name in go2rtc
 * @returns HTTP URL for MJPEG snapshot
 */
export function formatGo2rtcMjpegUrl(apiPort: number, streamName: string): string {
  return `http://localhost:${apiPort}/api/frame.jpeg?src=${encodeURIComponent(streamName)}`;
}
