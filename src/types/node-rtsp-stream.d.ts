/**
 * @fileoverview Type definitions for node-rtsp-stream-es6
 *
 * Provides TypeScript type definitions for the node-rtsp-stream-es6 library,
 * which converts RTSP streams to MPEG1 via ffmpeg and streams via WebSocket.
 */

import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

declare module 'node-rtsp-stream' {
  /**
   * Configuration options for RTSP stream
   */
  export interface StreamOptions {
    /** Unique name identifier for the stream */
    name: string;
    /** RTSP stream URL */
    streamUrl: string;
    /** WebSocket port for streaming */
    wsPort: number;
    /** ffmpeg command line options */
    ffmpegOptions?: Record<string, string | number>;
  }

  /**
   * Internal MPEG1 muxer that wraps the ffmpeg process
   */
  export interface Mpeg1Muxer {
    /** The underlying ffmpeg child process */
    stream?: ChildProcess;
    /** Stop the muxer */
    stop?: () => void;
  }

  /**
   * RTSP Stream class that extends EventEmitter
   */
  export default class Stream extends EventEmitter {
    /** Internal MPEG1 muxer instance */
    mpeg1Muxer?: Mpeg1Muxer;

    constructor(options: StreamOptions);

    /**
     * Stop the stream and cleanup resources
     */
    stop(): void;

    /**
     * Event emitted when ffmpeg outputs to stderr
     * @param event - Event name
     * @param listener - Event handler
     */
    on(event: 'ffmpegStderr', listener: (data: Buffer | string) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;

    /**
     * Emit events
     */
    emit(event: 'ffmpegStderr', data: Buffer | string): boolean;
    emit(event: string, ...args: unknown[]): boolean;
  }
}

