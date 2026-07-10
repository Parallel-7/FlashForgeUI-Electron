/**
 * @fileoverview IPC handler + shared core for the remote "Reboot Printer" feature.
 *
 * Reboots an Adventurer 5M / 5M Pro / AD5X over the flashforge-easyssh root SSH
 * surface. The renderer hides the menu item for unsupported models; this handler
 * re-validates the model (defense-in-depth) before dispatching the command.
 *
 * Lifecycle (driven over the 'printer:reboot-status' push channel):
 *  1. Confirm               - handled in the renderer dropdown (no IPC).
 *  2. rebooting             - emitted once the SSH reboot command has been accepted.
 *  3. reconnecting          - emitted when polling starts failing (printer going down).
 *  4. reconnecting-services - emitted once polling resumes; waits for
 *                             REBOOT_STABLE_POLLS_REQUIRED consecutive stable polls
 *                             so the TCP command socket and camera stream can catch up.
 *  5. success               - emitted after the consecutive-poll threshold (fully back).
 *  6. timeout               - emitted after REBOOT_RECONNECT_TIMEOUT_MS with no reconnect.
 *  7. failed                - emitted if the context is removed mid-reboot.
 *
 * The reboot command is fire-and-forget: the AD5X BusyBox 'reboot' applet
 * SIGTERMs every process (including our SSH session), so the exec channel is
 * expected to drop. dispatchRebootCommand() races the exec against a short
 * timeout and treats a channel-drop / error as success.
 *
 * Status updates fan out to BOTH the desktop renderer (push channel) and WebUI
 * WebSocket clients (REBOOT_STATUS broadcast), so a reboot triggered from one
 * surface is visible on the other.
 *
 * Key exports:
 * - registerPrinterPowerHandlers(): registers the 'printer:reboot' handler.
 * - startPrinterReboot(): shared validate/dispatch/monitor core (also used by
 *   the WebUI printer-power route).
 * - dispatchRebootCommand(): fire-and-forget reboot exec (testable).
 * - REBOOT_COMMAND: the exact shell string dispatched to the printer.
 * - REBOOT_STABLE_POLLS_REQUIRED: consecutive polls needed to declare success.
 * - createStablePollCounter(): pure streak counter for the recovery window (unit-tested).
 */

import { ipcMain } from 'electron';
import type { ContextRemovedEvent } from '@shared/types/PrinterContext.js';
import type { PrinterModelType } from '@shared/types/printer-backend/index.js';
import type { RebootStatusPayload } from '@shared/types/printer-power.js';
import { getPrinterContextManager } from '../../managers/PrinterContextManager.js';
import { getMultiContextPollingCoordinator } from '../../services/MultiContextPollingCoordinator.js';
import {
  getSSHConnectionManager,
  type SSHConnectionManager,
} from '../../services/calibration/ssh/SSHConnectionManager.js';
import { getSSHSettingsService } from '../../services/SSHSettingsService.js';
import { isRebootSupportedModel } from '../../utils/PrinterUtils.js';
import { getWindowManager } from '../../windows/WindowManager.js';
import { getGo2rtcService } from '../../services/Go2rtcService.js';
import { getWebSocketManager } from '../../webui/server/WebSocketManager.js';

/**
 * Reboot shell command sent to the printer.
 *
 * Backgrounded behind a 2s sleep so the exec channel returns cleanly before
 * the printer dies. Redirecting both streams keeps the channel quiet. The
 * trailing '&' detaches the subshell so the foreground exec exits immediately.
 */
export const REBOOT_COMMAND = '(sleep 2; reboot) >/dev/null 2>&1 &';

/** How long to wait for the reboot exec to return before assuming dispatch. */
export const REBOOT_DISPATCH_TIMEOUT_MS = 3000;

/** Grace window before optimistically transitioning to "reconnecting". */
export const REBOOT_GRACE_PERIOD_MS = 5000;

/** Hard cap on how long we wait for the printer to come back online. */
export const REBOOT_RECONNECT_TIMEOUT_MS = 150_000;

/**
 * Number of consecutive successful polls required before declaring the printer
 * fully recovered. Polling runs at ~3s intervals, so 3 polls ≈ ~6-9s of stable
 * data — enough for the TCP command socket and camera stream to catch up after
 * the HTTP endpoint comes back first.
 */
export const REBOOT_STABLE_POLLS_REQUIRED = 3;

/** Phase pushed to the renderer over the 'printer:reboot-status' channel. */
export type { RebootPhase, RebootStatusPayload } from '@shared/types/printer-power.js';


/** Minimal SSH surface dispatchRebootCommand depends on (keeps it unit-testable). */
export interface RebootSshClient {
  executeCommand: (contextId: string, command: string) => Promise<unknown>;
  disconnect: (contextId: string) => Promise<void>;
}

/**
 * Fire-and-forget the reboot command. NEVER throws: a connection drop / non-zero
 * exit is the expected outcome once the printer dies, so it is treated as
 * success. The dedicated power SSH session is torn down best-effort afterward
 * (the reboot kills the remote side regardless).
 */
export async function dispatchRebootCommand(
  ssh: RebootSshClient,
  powerKey: string
): Promise<void> {
  const execPromise = Promise.resolve(ssh.executeCommand(powerKey, REBOOT_COMMAND)).then(
    () => undefined,
    () => undefined
  );

  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(resolve, REBOOT_DISPATCH_TIMEOUT_MS);
  });

  await Promise.race([execPromise, timeoutPromise]);

  await Promise.resolve(ssh.disconnect(powerKey)).then(
    () => undefined,
    () => undefined
  );
}

/** Records and evaluates a streak of consecutive successful polls. */
export interface StablePollCounter {
  /** Record one successful poll; returns the new streak length. */
  recordPoll: () => number;
  /** Reset the streak to zero (a poll failed during recovery). */
  reset: () => void;
  /** True once `required` consecutive polls have been recorded without a reset. */
  isStable: () => boolean;
}

/**
 * Count consecutive successful polls until a stability threshold is reached.
 *
 * Extracted as a pure helper so the consecutive-poll logic is unit-testable in
 * isolation from the polling-coordinator EventEmitter wiring. The monitor owns
 * a single instance and consults recordPoll()/isStable()/reset() instead of
 * hand-rolling increment/compare logic inline.
 */
export function createStablePollCounter(required: number): StablePollCounter {
  let count = 0;
  return {
    recordPoll: () => {
      count += 1;
      return count;
    },
    reset: () => {
      count = 0;
    },
    isStable: () => count >= required,
  };
}

/** Active reconnect monitor for a context (one at most per context). */
interface RebootMonitor {
  readonly contextId: string;
  readonly printerName: string;
  seenError: boolean;
  /** Counts consecutive successful polls during the reconnecting-services phase. */
  counter: StablePollCounter;
  /** Guards that the proactive camera restart fires at most once per phase. */
  cameraRestarted: boolean;
  graceTimer: NodeJS.Timeout | null;
  reconnectTimer: NodeJS.Timeout | null;
  onData: (contextId: string) => void;
  onError: (contextId: string) => void;
  cleanup: () => void;
}

const activeMonitors = new Map<string, RebootMonitor>();
let contextRemovalListenerRegistered = false;

/**
 * Push a reboot status update to every listening surface: the main renderer
 * window (desktop overlay) and any connected WebUI WebSocket clients. Either
 * sink may be absent (headless has no window; desktop may have no WebUI
 * clients) — both paths are no-ops in that case, so a reboot triggered from
 * one surface is always visible on the other.
 */
function sendRebootStatus(contextId: string, payload: RebootStatusPayload): void {
  const mainWindow = getWindowManager().getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('printer:reboot-status', payload);
  }
  try {
    getWebSocketManager().broadcastRebootStatus(contextId, payload);
  } catch (error) {
    // Broadcasting is best-effort; a WebUI failure must never break the reboot.
    console.warn('[PrinterPower] Failed to broadcast reboot status to WebUI:', describeError(error));
  }
}

/** Coerce an unknown thrown value into a single-line message. */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : 'Unknown error';
}

/**
 * Best-effort: restart the go2rtc camera stream so it reconnects on our schedule
 * rather than waiting for a UI interaction (window-focus). Non-throwing — camera
 * failures must never block the reboot from completing.
 */
async function restartCameraStream(contextId: string): Promise<void> {
  try {
    const go2rtc = getGo2rtcService();
    if (go2rtc.hasStream(contextId)) {
      await go2rtc.restartStream(contextId);
    }
  } catch (error) {
    // Best-effort: if the camera can't be restarted now, it will recover via
    // its normal path or when the user next interacts with the camera widget.
    console.warn(`[PrinterPower] Camera stream restart failed for ${contextId}:`, describeError(error));
  }
}

/**
 * Begin monitoring the polling coordinator for the printer going offline and
 * coming back. Emits reconnecting / reconnecting-services / success / timeout
 * over the push channel. The transition to success requires a streak of
 * REBOOT_STABLE_POLLS_REQUIRED consecutive stable polls, and the go2rtc camera
 * stream is proactively restarted once on entering the reconnecting-services
 * phase.
 */
function startReconnectMonitor(
  contextId: string,
  printerName: string,
  emit: (payload: RebootStatusPayload) => void
): void {
  const coordinator = getMultiContextPollingCoordinator();

  const monitor: RebootMonitor = {
    contextId,
    printerName,
    seenError: false,
    counter: createStablePollCounter(REBOOT_STABLE_POLLS_REQUIRED),
    cameraRestarted: false,
    graceTimer: null,
    reconnectTimer: null,
    onData: () => undefined,
    onError: () => undefined,
    cleanup: () => undefined,
  };

  const onData = (pollingContextId: string): void => {
    if (pollingContextId !== contextId) {
      return;
    }
    // Only count data that resumes AFTER the printer went offline. Ignoring
    // healthy data received before the printer went down prevents a false
    // success if polling was healthy the whole time.
    if (!monitor.seenError) {
      return;
    }

    // The HTTP /detail endpoint is the first service back after boot, but the
    // TCP command socket and go2rtc camera stream take longer to re-establish.
    // On the first resumed poll, transition into the reconnecting-services
    // phase and proactively kick the camera so it recovers on our schedule.
    const newCount = monitor.counter.recordPoll();
    if (newCount === 1) {
      emit({
        phase: 'reconnecting-services',
        message: `Reconnecting services for ${printerName}...`,
        printerName,
      });
      if (!monitor.cameraRestarted) {
        monitor.cameraRestarted = true;
        // Fire-and-forget: a camera failure must never block the reboot.
        void restartCameraStream(contextId);
      }
    }

    // Require N consecutive stable polls before declaring success so the
    // TCP/camera stack has time to fully recover.
    if (monitor.counter.isStable()) {
      emit({
        phase: 'success',
        message: `${printerName} is back online`,
        printerName,
      });
      monitor.cleanup();
    }
  };

  const onError = (pollingContextId: string): void => {
    if (pollingContextId !== contextId) {
      return;
    }
    if (!monitor.seenError) {
      monitor.seenError = true;
      emit({
        phase: 'reconnecting',
        message: `Waiting for ${printerName} to come back online...`,
        printerName,
      });
    } else {
      // A poll failed DURING the reconnecting-services recovery window: the
      // printer briefly responded then dropped again mid-boot. Reset the streak
      // so we require another clean run, and allow the camera to be re-kicked
      // on the next resumed poll.
      monitor.counter.reset();
      monitor.cameraRestarted = false;
    }
  };

  monitor.onData = onData;
  monitor.onError = onError;

  monitor.cleanup = (): void => {
    coordinator.off('polling-data', onData);
    coordinator.off('polling-error', onError);
    if (monitor.graceTimer) {
      clearTimeout(monitor.graceTimer);
      monitor.graceTimer = null;
    }
    if (monitor.reconnectTimer) {
      clearTimeout(monitor.reconnectTimer);
      monitor.reconnectTimer = null;
    }
    activeMonitors.delete(contextId);
  };

  coordinator.on('polling-data', onData);
  coordinator.on('polling-error', onError);

  // Grace period: if no polling-error fires in time, optimistically assume the
  // printer is going down and transition to reconnecting.
  monitor.graceTimer = setTimeout(() => {
    if (!monitor.seenError) {
      monitor.seenError = true;
      emit({
        phase: 'reconnecting',
        message: `Waiting for ${printerName} to come back online...`,
        printerName,
      });
    }
  }, REBOOT_GRACE_PERIOD_MS);

  // Hard timeout: surface an actionable error if the printer never reconnects.
  monitor.reconnectTimer = setTimeout(() => {
    emit({
      phase: 'timeout',
      message: `${printerName} didn't come back online. Check that it's powered on and reachable.`,
      printerName,
    });
    monitor.cleanup();
  }, REBOOT_RECONNECT_TIMEOUT_MS);

  activeMonitors.set(contextId, monitor);
}

/** Register a one-time listener that aborts any in-flight reboot on context removal. */
function ensureContextRemovalCleanup(): void {
  if (contextRemovalListenerRegistered) {
    return;
  }
  contextRemovalListenerRegistered = true;

  const contextManager = getPrinterContextManager();
  contextManager.on('context-removed', (event: ContextRemovedEvent) => {
    const monitor = activeMonitors.get(event.contextId);
    if (!monitor) {
      return;
    }
    sendRebootStatus(event.contextId, {
      phase: 'failed',
      message: `${monitor.printerName} was disconnected during reboot.`,
      printerName: monitor.printerName,
    });
    monitor.cleanup();
  });
}

/**
 * Validate, dispatch, and monitor a printer reboot. Shared entry point for the
 * desktop 'printer:reboot' IPC handler and the WebUI POST /printer/reboot
 * route — both surfaces receive the same lifecycle updates because
 * sendRebootStatus fans out to the desktop window AND WebUI WebSocket clients.
 * Throws with an actionable message on validation or SSH-connect failure.
 */
export async function startPrinterReboot(contextId: unknown): Promise<{ success: true }> {
  if (typeof contextId !== 'string' || contextId.length === 0) {
    throw new Error('Invalid reboot request: missing context id');
  }

  ensureContextRemovalCleanup();

  // STRICT context resolution — no active-context fallback.
  const context = getPrinterContextManager().getContext(contextId);
  if (!context) {
    throw new Error('Printer context not found');
  }

  const details = context.printerDetails;
  const modelType: PrinterModelType | undefined = details.modelType;

  // Defense-in-depth model guard (renderer also hides the item).
  if (!isRebootSupportedModel(modelType)) {
    throw new Error('Reboot is only supported on Adventurer 5M / 5M Pro / AD5X printers');
  }

  const serialNumber = details.SerialNumber;
  const host = details.IPAddress;
  const printerName = details.Name || host || 'Printer';
  const powerKey = `power:${contextId}`;

  if (!serialNumber || !host) {
    throw new Error('Printer is missing the serial number or IP address required for reboot');
  }

  // Abort any prior in-flight monitor for this context (Retry path).
  const existing = activeMonitors.get(contextId);
  if (existing) {
    existing.cleanup();
  }

  // Dedicated SSH namespace — a reboot must not tear down the file-manager
  // or calibration sessions (those use separate connection keys).
  const config = await getSSHSettingsService().buildConnectionConfig(serialNumber, host);
  try {
    await getSSHConnectionManager().connect(powerKey, config);
  } catch (error) {
    // A genuine SSH failure (unreachable / wrong creds) is a real failure.
    throw new Error(`Could not reach ${printerName} over SSH: ${describeError(error)}`);
  }

  // Fire-and-forget the reboot command (channel-drop treated as success).
  await dispatchRebootCommand(getSSHConnectionManager() as SSHConnectionManager, powerKey);

  // Notify all surfaces that the reboot has been dispatched.
  sendRebootStatus(contextId, {
    phase: 'rebooting',
    message: `Rebooting ${printerName}...`,
    printerName,
  });

  // Watch for the printer going offline and coming back.
  startReconnectMonitor(contextId, printerName, (payload) => sendRebootStatus(contextId, payload));

  return { success: true };
}

/**
 * Register the 'printer:reboot' IPC handler. Called once during app init.
 */
export function registerPrinterPowerHandlers(): void {
  console.log('[PrinterPower Handlers] Registering printer power IPC handlers...');

  ensureContextRemovalCleanup();

  ipcMain.handle('printer:reboot', async (_event, contextId: unknown): Promise<{ success: true }> => {
    return startPrinterReboot(contextId);
  });

  console.log('[PrinterPower Handlers] Printer power IPC handlers registered');
}
