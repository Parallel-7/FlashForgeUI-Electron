/**
 * @fileoverview Shared IPC types for the remote "Reboot Printer" feature.
 *
 * Consumed by the main-process handler (`printer-power-handlers.ts`), the
 * preload bridge, the renderer's reboot overlay controller, and the WebUI
 * (REBOOT_STATUS WebSocket broadcasts + the printer-power route).
 *
 * Key exports:
 * - RebootPhase: lifecycle phase pushed over the 'printer:reboot-status' channel.
 * - RebootStatusPayload: the event payload shape.
 * - RebootResult: the 'printer:reboot' invoke return value.
 */

/**
 * Lifecycle phase of an in-flight reboot, pushed to the renderer.
 *
 * Phases progress: rebooting -> reconnecting -> reconnecting-services ->
 * success (or terminal timeout / failed). The 'reconnecting-services' phase
 * fires once polling resumes and waits for a streak of stable polls so the TCP
 * command socket and camera stream can fully recover before declaring success.
 */
export type RebootPhase =
  | 'rebooting'
  | 'reconnecting'
  | 'reconnecting-services'
  | 'success'
  | 'timeout'
  | 'failed';

/** Payload pushed over the 'printer:reboot-status' channel. */
export interface RebootStatusPayload {
  readonly phase: RebootPhase;
  readonly message?: string;
  readonly printerName?: string;
}

/** Return value of the 'printer:reboot' invoke handler. */
export interface RebootResult {
  readonly success: boolean;
}
