/**
 * @fileoverview Type definitions for camera streaming system using go2rtc.
 *
 * Provides type safety for camera configuration, go2rtc streaming gateway,
 * stream URL resolution, and status monitoring. Supports both OEM printer
 * cameras and custom camera URLs.
 *
 * All camera types are handled through go2rtc, which provides unified WebRTC/MSE/MJPEG
 * fallback for browser playback using native <video> element rendering.
 *
 * Key Type Groups:
 * - Configuration: CameraUserConfig, ResolvedCameraConfig, Go2rtcCameraStreamConfig
 * - Status: CameraProxyStatus (simplified for go2rtc)
 * - URL Resolution: CameraUrlResolutionParams, CameraUrlBuilder, validation results
 * - IPC Methods: CameraIPCMethods for main/renderer bridge
 *
 * Camera Source Priority:
 * 1. Custom camera URL (if enabled in user config)
 * 2. OEM printer camera (if reported by the printer)
 * 3. Intelligent fallback (known OEM MJPEG endpoint when firmware omits the URL)
 * 4. None (camera unavailable with reason tracking)
 *
 * @module types/camera/camera.types
 */

import { PrinterFeatureSet } from '../printer-backend/index.js';

/**
 * Camera source types
 */
export type CameraSourceType = 'oem' | 'custom' | 'intelligent-fallback' | 'none';

/**
 * Camera stream protocol types
 */
export type CameraStreamType = 'mjpeg' | 'rtsp';

/**
 * Camera configuration from user settings
 */
export interface CameraUserConfig {
  /** Whether custom camera is enabled */
  readonly customCameraEnabled: boolean;
  /** Custom camera URL if enabled */
  readonly customCameraUrl: string | null;
}

/**
 * Resolved camera configuration after applying priority logic
 */
export interface ResolvedCameraConfig {
  /** Source type of the camera */
  readonly sourceType: CameraSourceType;
  /** Stream protocol type (MJPEG or RTSP) */
  readonly streamType?: CameraStreamType;
  /** Final camera stream URL (null if no camera available) */
  readonly streamUrl: string | null;
  /** Whether camera feature is available */
  readonly isAvailable: boolean;
  /** Reason if camera is not available */
  readonly unavailableReason?: string;
}

/**
 * Camera URL resolution parameters
 */
export interface CameraUrlResolutionParams {
  /** Printer IP address */
  readonly printerIpAddress: string;
  /** Printer feature set from backend */
  readonly printerFeatures: PrinterFeatureSet;
  /** User configuration for camera */
  readonly userConfig: CameraUserConfig;
}

/**
 * Camera status from go2rtc service.
 * Simplified status interface - go2rtc handles most complexity internally.
 */
export interface CameraProxyStatus {
  /** Whether go2rtc service is running */
  readonly isRunning: boolean;
  /** go2rtc API port */
  readonly port: number;
  /** WebSocket URL for stream (empty if no stream) */
  readonly proxyUrl: string;
  /** Whether a stream is configured */
  readonly isStreaming: boolean;
  /** Last error if any */
  readonly lastError: string | null;
}

/**
 * Camera IPC methods exposed to renderer
 */
export interface CameraIPCMethods {
  /** Get the camera proxy port */
  getCameraProxyPort(): Promise<number>;

  /** Get camera proxy status */
  getCameraStatus(): Promise<CameraProxyStatus>;

  /** Enable or disable camera preview */
  setCameraEnabled(enabled: boolean): Promise<void>;

  /** Get resolved camera configuration */
  getCameraConfig(): Promise<ResolvedCameraConfig>;
}

/**
 * Camera URL builder function type
 */
export type CameraUrlBuilder = (ipAddress: string) => string;

/**
 * Default camera URL patterns for FlashForge printers.
 * Retained for reference and compatibility with older tests/utilities.
 */
export const DEFAULT_CAMERA_PATTERNS = {
  /** Default MJPEG stream pattern for FlashForge printers */
  FLASHFORGE_MJPEG: (ip: string) => `http://${ip}:8080/?action=stream`,
} as const;

/**
 * go2rtc stream configuration for UI consumption.
 * This is returned by the camera:get-stream-config IPC handler.
 */
export interface Go2rtcCameraStreamConfig {
  /** WebSocket URL for stream negotiation (e.g., ws://localhost:1984/api/ws?src=printer_1) */
  readonly wsUrl: string;
  /** Original source type */
  readonly sourceType: CameraSourceType;
  /** Original stream type (before go2rtc conversion) */
  readonly streamType: CameraStreamType;
  /** Preferred playback modes (comma-separated: 'webrtc,mse,mjpeg') */
  readonly mode: string;
  /** Whether stream is available */
  readonly isAvailable: boolean;
  /** Stream name in go2rtc */
  readonly streamName: string;
  /** API port for additional endpoints */
  readonly apiPort: number;
}

/**
 * Camera validation result
 */
export interface CameraUrlValidationResult {
  /** Whether the URL is valid */
  readonly isValid: boolean;
  /** Validation error message if invalid */
  readonly error?: string;
  /** Parsed URL object if valid */
  readonly parsedUrl?: URL;
}
