/**
 * @fileoverview Type definitions for @cycjimmy/jsmpeg-player
 *
 * Since the @cycjimmy/jsmpeg-player library doesn't provide official TypeScript
 * type definitions, this file provides type safety for the JSMpeg player used
 * for RTSP stream rendering via WebSocket.
 *
 * Based on JSMpeg.js library documentation and actual usage in the application.
 *
 * Also provides global type declarations for JSMpeg vendored locally in WebUI.
 */

/**
 * Options for configuring the JSMpeg player
 */
export interface JSMpegPlayerOptions {
    /** Canvas element to render video to */
    canvas?: HTMLCanvasElement;
    /** Whether to start playing automatically */
    autoplay?: boolean;
    /** Whether to enable audio playback */
    audio?: boolean;
    /** Whether to loop playback */
    loop?: boolean;
    /** Whether to show controls */
    controls?: boolean;
    /** Callback when stream is established */
    onSourceEstablished?: () => void;
    /** Callback when stream completes */
    onSourceCompleted?: () => void;
    /** Callback on play event */
    onPlay?: () => void;
    /** Callback on pause event */
    onPause?: () => void;
    /** Callback on stalled event */
    onStalled?: () => void;
    /** Callback on video decode */
    onVideoDecode?: (decoder: unknown, time: number) => void;
    /** Callback on audio decode */
    onAudioDecode?: (decoder: unknown, time: number) => void;
  }

/**
 * JSMpeg Player instance for MPEG1 video playback
 */
export interface JSMpegPlayerInstance {
    /** Play the video stream */
    play(): void;
    /** Pause the video stream */
    pause(): void;
    /** Stop the video stream */
    stop(): void;
    /** Destroy the player and clean up resources */
    destroy(): void;
    /** Get the canvas element being used for rendering */
    readonly canvas: HTMLCanvasElement | null;
    /** Whether the player is currently playing */
    readonly isPlaying: boolean;
  }

/**
 * JSMpeg namespace containing Player constructor
 */
export interface JSMpegStatic {
    /**
     * Create a new JSMpeg player instance
     * @param url - WebSocket URL for MPEG1 stream
     * @param options - Player configuration options
     */
    Player: new (url: string, options?: JSMpegPlayerOptions) => JSMpegPlayerInstance;
  }

declare module '@cycjimmy/jsmpeg-player' {
  /**
   * Default export is the JSMpeg static object
   */
  const JSMpeg: JSMpegStatic;
  export default JSMpeg;
}

/**
 * Global declaration for JSMpeg when vendored locally (e.g., in WebUI)
 */
declare global {
  const JSMpeg: {
    Player: new (url: string, options?: {
      canvas?: HTMLCanvasElement;
      autoplay?: boolean;
      audio?: boolean;
      loop?: boolean;
      controls?: boolean;
      onSourceEstablished?: () => void;
      onSourceCompleted?: () => void;
      onPlay?: () => void;
      onPause?: () => void;
      onStalled?: () => void;
    }) => {
      play(): void;
      pause(): void;
      stop(): void;
      destroy(): void;
    };
  };
}

export {};

