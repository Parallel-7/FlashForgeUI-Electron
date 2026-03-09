/**
 * @fileoverview Type definitions for go2rtc REST API and service integration.
 * go2rtc is a universal camera streaming gateway that handles RTSP, MJPEG, and other
 * protocols, outputting to WebRTC, MSE, HLS, or MJPEG for browser consumption.
 *
 * @see https://github.com/AlexxIT/go2rtc
 */

/**
 * go2rtc stream producer information (input source)
 */
export interface Go2rtcProducer {
  /** Source URL (rtsp://, http://, etc.) */
  url: string;
  /** Available media tracks */
  medias?: Go2rtcMedia[];
  /** Number of bytes received from source */
  recv?: number;
  /** Connection user agent */
  user_agent?: string;
}

/**
 * go2rtc stream consumer information (output client)
 */
export interface Go2rtcConsumer {
  /** Consumer ID */
  id?: string;
  /** Output format (webrtc, mse, mjpeg, etc.) */
  format?: string;
  /** Number of bytes sent to consumer */
  send?: number;
  /** Remote address */
  remote_addr?: string;
  /** User agent */
  user_agent?: string;
}

/**
 * Media track information
 */
export interface Go2rtcMedia {
  /** Track kind: video or audio */
  kind: 'video' | 'audio';
  /** Codec information */
  codecs: Go2rtcCodec[];
}

/**
 * Codec information
 */
export interface Go2rtcCodec {
  /** Codec name (H264, H265, AAC, OPUS, etc.) */
  name: string;
  /** Codec clock rate */
  clock_rate?: number;
  /** Codec channels (audio) */
  channels?: number;
  /** Format-specific parameters */
  fmtp?: string;
}

/**
 * Stream information returned by GET /api/streams
 */
export interface Go2rtcStreamInfo {
  /** Producers (input sources) */
  producers?: Go2rtcProducer[];
  /** Consumers (output clients) */
  consumers?: Go2rtcConsumer[];
}

/**
 * Response from GET /api/streams (all streams)
 */
export interface Go2rtcStreamsResponse {
  [streamName: string]: Go2rtcStreamInfo;
}

/**
 * go2rtc configuration file structure
 */
export interface Go2rtcConfig {
  /** API server configuration */
  api?: {
    /** Listen address (e.g., ":1984") */
    listen?: string;
    /** Base path for API */
    base_path?: string;
  };
  /** WebRTC configuration */
  webrtc?: {
    /** Listen address (e.g., ":8555/tcp") */
    listen?: string;
    /** ICE servers for NAT traversal */
    ice_servers?: Array<{
      urls: string[];
      username?: string;
      credential?: string;
    }>;
  };
  /** RTSP server configuration */
  rtsp?: {
    /** Listen address (e.g., ":8554") */
    listen?: string;
  };
  /** Stream definitions */
  streams?: {
    [name: string]: string | string[];
  };
  /** Logging configuration */
  log?: {
    /** Log format: "text" or "json" */
    format?: 'text' | 'json';
    /** Log level: "trace", "debug", "info", "warn", "error" */
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  };
}

/**
 * Stream configuration for adding to go2rtc
 */
export interface Go2rtcStreamConfig {
  /** Unique stream name (derived from context ID) */
  name: string;
  /** Source URL(s) - RTSP, HTTP MJPEG, etc. */
  sources: string[];
}

/**
 * Binary information for platform detection
 */
export interface Go2rtcBinaryInfo {
  /** Full path to binary */
  path: string;
  /** Platform identifier */
  platform: NodeJS.Platform;
  /** Architecture identifier */
  arch: string;
  /** Whether binary exists */
  exists: boolean;
}

/**
 * Service status information
 */
export interface Go2rtcServiceStatus {
  /** Whether go2rtc process is running */
  isRunning: boolean;
  /** API server URL */
  apiUrl: string;
  /** WebRTC port */
  webrtcPort: number;
  /** Process ID if running */
  pid?: number;
  /** Number of active streams */
  activeStreams: number;
  /** Last error if any */
  lastError?: string;
}

/**
 * Camera stream configuration returned to UI
 */
export interface CameraStreamConfig {
  /** WebSocket URL for stream negotiation (e.g., ws://localhost:1984/api/ws?src=printer_1) */
  wsUrl: string;
  /** Original source type */
  sourceType: 'oem' | 'custom';
  /** Original stream type (before go2rtc conversion) */
  streamType: 'mjpeg' | 'rtsp';
  /** Preferred playback modes */
  mode: string;
  /** Whether stream is available */
  isAvailable: boolean;
  /** Stream name in go2rtc */
  streamName: string;
  /** API port for additional endpoints */
  apiPort: number;
}

/**
 * Events emitted by Go2rtcService
 */
export interface Go2rtcServiceEvents {
  'service-ready': [];
  'service-stopped': [];
  'service-error': [error: Error];
  'stream-added': [contextId: string, streamName: string];
  'stream-removed': [contextId: string];
  'stream-error': [contextId: string, error: Error];
}
