/**
 * Camera URL resolution utilities
 * 
 * Implements the priority-based camera URL resolution logic:
 * 1. Custom camera URL (if enabled and provided)
 * 2. Built-in camera URL (if printer has camera capability)
 * 3. No camera available
 */

import { 
  CameraUrlResolutionParams, 
  ResolvedCameraConfig,
  CameraUrlValidationResult,
  CameraUserConfig,
  DEFAULT_CAMERA_PATTERNS
} from '../types/camera';
import { getConfigManager } from '../managers/ConfigManager';

/**
 * Validate a camera URL
 */
export function validateCameraUrl(url: string | null | undefined): CameraUrlValidationResult {
  if (!url || url.trim() === '') {
    return {
      isValid: false,
      error: 'URL is empty or not provided'
    };
  }
  
  try {
    const parsedUrl = new URL(url);
    
    // Check for supported protocols
    if (!['http:', 'https:', 'rtsp:'].includes(parsedUrl.protocol)) {
      return {
        isValid: false,
        error: `Unsupported protocol: ${parsedUrl.protocol}. Use http://, https://, or rtsp://`
      };
    }
    
    // Check for valid hostname
    if (!parsedUrl.hostname || parsedUrl.hostname === '') {
      return {
        isValid: false,
        error: 'Invalid hostname in URL'
      };
    }
    
    return {
      isValid: true,
      parsedUrl
    };
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format'
    };
  }
}

/**
 * Resolve camera configuration based on priority rules
 */
export function resolveCameraConfig(params: CameraUrlResolutionParams): ResolvedCameraConfig {
  const { printerIpAddress, printerFeatures, userConfig } = params;
  
  // Priority 1: Check custom camera
  if (userConfig.customCameraEnabled) {
    // If custom camera is enabled but no URL provided, use automatic URL
    if (!userConfig.customCameraUrl || userConfig.customCameraUrl.trim() === '') {
      // Use the default FlashForge camera URL pattern when custom camera is enabled
      // but no URL is specified. This supports cameras installed on printers that
      // don't have them by default.
      const autoUrl = `http://${printerIpAddress}:8080/?action=stream`;
      
      return {
        sourceType: 'custom',
        streamUrl: autoUrl,
        isAvailable: true
      };
    }
    
    // Custom camera enabled with a user-provided URL
    const validation = validateCameraUrl(userConfig.customCameraUrl);
    
    if (validation.isValid) {
      return {
        sourceType: 'custom',
        streamUrl: userConfig.customCameraUrl,
        isAvailable: true
      };
    } else {
      // Custom camera enabled but URL is invalid
      return {
        sourceType: 'custom',
        streamUrl: null,
        isAvailable: false,
        unavailableReason: `Custom camera URL is invalid: ${validation.error}`
      };
    }
  }
  
  // Priority 2: Check built-in camera
  if (printerFeatures.camera.builtin) {
    // Use default FlashForge MJPEG pattern
    const streamUrl = DEFAULT_CAMERA_PATTERNS.FLASHFORGE_MJPEG(printerIpAddress);
    
    return {
      sourceType: 'builtin',
      streamUrl,
      isAvailable: true
    };
  }
  
  // Priority 3: No camera available
  return {
    sourceType: 'none',
    streamUrl: null,
    isAvailable: false,
    unavailableReason: 'Printer does not have built-in camera and custom camera is not configured'
  };
}

/**
 * Get camera configuration from user settings
 */
export function getCameraUserConfig(): CameraUserConfig {
  const configManager = getConfigManager();
  
  return {
    customCameraEnabled: configManager.get('CustomCamera') || false,
    customCameraUrl: configManager.get('CustomCameraUrl') || null
  };
}

/**
 * Format camera proxy URL for client consumption
 */
export function formatCameraProxyUrl(port: number): string {
  return `http://localhost:${port}/camera`;
}

/**
 * Check if camera feature is available for a printer
 */
export function isCameraFeatureAvailable(params: CameraUrlResolutionParams): boolean {
  const config = resolveCameraConfig(params);
  return config.isAvailable;
}

/**
 * Get human-readable camera status message
 */
export function getCameraStatusMessage(config: ResolvedCameraConfig): string {
  if (config.isAvailable) {
    switch (config.sourceType) {
      case 'builtin':
        return 'Using printer built-in camera';
      case 'custom':
        return 'Using custom camera URL';
      default:
        return 'Camera available';
    }
  } else {
    return config.unavailableReason || 'Camera not available';
  }
}
