/**
 * Camera type definitions for the camera proxy system
 * 
 * Provides comprehensive types for camera configuration, status monitoring,
 * proxy management, and URL resolution logic. Supports both built-in printer
 * cameras and custom camera URLs with proper type safety.
 */

import { PrinterFeatureSet } from '../printer-backend';

/**
 * Camera source types
 */
export type CameraSourceType = 'builtin' | 'custom' | 'none';

/**
 * Camera stream protocol types
 */
export type CameraStreamType = 'mjpeg' | 'rtsp';

/**
 * Camera proxy server configuration
 */
export interface CameraProxyConfig {
  /** Port number for the proxy HTTP server */
  readonly port: number;
  /** Fallback port if primary port is in use */
  readonly fallbackPort: number;
  /** Whether to auto-start the proxy server */
  readonly autoStart: boolean;
  /** Reconnection settings */
  readonly reconnection: {
    /** Enable automatic reconnection */
    readonly enabled: boolean;
    /** Maximum number of reconnection attempts */
    readonly maxRetries: number;
    /** Base delay between retries in milliseconds */
    readonly retryDelay: number;
    /** Use exponential backoff for retries */
    readonly exponentialBackoff: boolean;
  };
}

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
 * Camera proxy client information
 */
export interface CameraProxyClient {
  /** Unique client ID */
  readonly id: string;
  /** Client connection timestamp */
  readonly connectedAt: Date;
  /** Client remote address */
  readonly remoteAddress: string;
  /** Whether client is still connected */
  readonly isConnected: boolean;
}

/**
 * Camera proxy status
 */
export interface CameraProxyStatus {
  /** Whether proxy server is running */
  readonly isRunning: boolean;
  /** Current proxy server port */
  readonly port: number;
  /** Proxy server URL */
  readonly proxyUrl: string;
  /** Whether connected to camera source */
  readonly isStreaming: boolean;
  /** Current camera source URL */
  readonly sourceUrl: string | null;
  /** Number of connected clients */
  readonly clientCount: number;
  /** List of connected clients */
  readonly clients: readonly CameraProxyClient[];
  /** Last error if any */
  readonly lastError: string | null;
  /** Connection statistics */
  readonly stats: {
    /** Total bytes received from source */
    readonly bytesReceived: number;
    /** Total bytes sent to clients */
    readonly bytesSent: number;
    /** Number of successful connections */
    readonly successfulConnections: number;
    /** Number of failed connections */
    readonly failedConnections: number;
    /** Current retry count */
    readonly currentRetryCount: number;
  };
}

/**
 * Camera proxy events
 */
export type CameraProxyEventType = 
  | 'proxy-started'
  | 'proxy-stopped'
  | 'stream-connected'
  | 'stream-disconnected'
  | 'stream-error'
  | 'client-connected'
  | 'client-disconnected'
  | 'retry-attempt'
  | 'port-changed';

/**
 * Camera proxy event data
 */
export interface CameraProxyEvent {
  /** Event type */
  readonly type: CameraProxyEventType;
  /** Event timestamp */
  readonly timestamp: Date;
  /** Event-specific data */
  readonly data?: unknown;
  /** Error message if applicable */
  readonly error?: string;
}

/**
 * Camera service interface for main process
 */
export interface ICameraProxyService {
  /** Initialize the camera proxy service */
  initialize(config: CameraProxyConfig): Promise<void>;
  
  /** Set the camera stream URL */
  setStreamUrl(url: string | null): void;
  
  /** Get current proxy status */
  getStatus(): CameraProxyStatus;
  
  /** Start the proxy server */
  start(): Promise<void>;
  
  /** Stop the proxy server */
  stop(): Promise<void>;
  
  /** Shutdown the service and cleanup */
  shutdown(): Promise<void>;
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
 * Default camera URL patterns for different printer models
 */
export const DEFAULT_CAMERA_PATTERNS = {
  /** Default MJPEG stream pattern for FlashForge printers */
  FLASHFORGE_MJPEG: (ip: string) => `http://${ip}:8080/?action=stream`,
} as const;

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

/**
 * Type guard to check if a camera source is available
 */
export function isCameraAvailable(config: ResolvedCameraConfig): config is ResolvedCameraConfig & { streamUrl: string } {
  return config.isAvailable && config.streamUrl !== null;
}

/**
 * Type guard to check if using custom camera
 */
export function isCustomCamera(config: ResolvedCameraConfig): boolean {
  return config.sourceType === 'custom';
}

/**
 * Type guard to check if using built-in camera
 */
export function isBuiltinCamera(config: ResolvedCameraConfig): boolean {
  return config.sourceType === 'builtin';
}
