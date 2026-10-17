/**
 * @fileoverview Remote "Reboot Printer" feature for the WebUI client.
 *
 * Browser port of the desktop reboot flow: a topbar button (shown only for
 * SSH-capable models: Adventurer 5M / 5M Pro / AD5X) opens a confirmation
 * modal, then POSTs /api/printer/reboot. Reboot lifecycle updates arrive over
 * REBOOT_STATUS WebSocket broadcasts and drive a full-screen overlay through
 * the phases rebooting -> reconnecting -> reconnecting-services -> success
 * (or terminal timeout / failed with a Retry option).
 *
 * Key exports:
 * - setupReboot(): wire the topbar button, modal, overlay, and WS listener
 * - refreshRebootButton(): show/hide the topbar button per model support
 */

import type { RebootStatusPayload } from '../app.js';
import { apiRequest, onRebootStatus } from '../core/Transport.js';
import { showToast } from '../shared/dom.js';
import { hydrateLucideIcons } from '../shared/icons.js';
import { getCurrentContextId } from './context-switching.js';

interface RebootSupportResponse {
  readonly success: boolean;
  readonly supported?: boolean;
  readonly printerName?: string;
  readonly error?: string;
}

interface RebootResponse {
  readonly success: boolean;
  readonly error?: string;
}

/** Context of the reboot this client initiated; null when idle. */
let rebootContextId: string | null = null;

function el(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`[Reboot] Missing element #${id}`);
  }
  return element;
}

function show(element: HTMLElement): void {
  element.classList.remove('hidden');
}

function hide(element: HTMLElement): void {
  element.classList.add('hidden');
}

/**
 * Show or hide the topbar reboot button based on the active printer's model.
 */
export async function refreshRebootButton(): Promise<void> {
  const button = document.getElementById('reboot-button');
  if (!button) {
    return;
  }
  try {
    const result = await apiRequest<RebootSupportResponse>('/api/printer/reboot/support');
    button.classList.toggle('hidden', !(result.success && result.supported));
  } catch {
    button.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// Overlay phases
// ---------------------------------------------------------------------------

function setOverlay(options: {
  title: string;
  message: string;
  spinning: boolean;
  result?: 'success' | 'error';
  showRetry?: boolean;
  showDismiss?: boolean;
}): void {
  el('reboot-overlay-title').textContent = options.title;
  el('reboot-overlay-message').textContent = options.message;

  el('reboot-spinner').classList.toggle('hidden', !options.spinning);
  el('reboot-success-icon').classList.toggle('hidden', options.result !== 'success');
  el('reboot-error-icon').classList.toggle('hidden', options.result !== 'error');
  el('reboot-overlay-retry').classList.toggle('hidden', !options.showRetry);
  el('reboot-overlay-dismiss').classList.toggle('hidden', !options.showDismiss);

  hydrateLucideIcons(['check-circle', 'alert-triangle'], el('reboot-overlay'));
  show(el('reboot-overlay'));
}

function closeOverlay(): void {
  rebootContextId = null;
  hide(el('reboot-overlay'));
}

function handleRebootStatus(contextId: string, payload: RebootStatusPayload): void {
  // Only surface updates for the reboot this client is watching. (A reboot
  // triggered from the desktop is intentionally ignored here to avoid taking
  // over every connected browser; parity with the desktop overlay, which is
  // likewise scoped to its own window.)
  if (!rebootContextId || contextId !== rebootContextId) {
    return;
  }

  const printerName = payload.printerName || 'Printer';

  switch (payload.phase) {
    case 'rebooting':
      setOverlay({
        title: `Rebooting ${printerName}…`,
        message: payload.message || 'Sending reboot command over SSH.',
        spinning: true,
      });
      break;
    case 'reconnecting':
      setOverlay({
        title: 'Waiting for printer…',
        message: payload.message || `Waiting for ${printerName} to come back online.`,
        spinning: true,
      });
      break;
    case 'reconnecting-services':
      setOverlay({
        title: 'Reconnecting services…',
        message: payload.message || 'Printer is back; waiting for services to stabilize.',
        spinning: true,
      });
      break;
    case 'success':
      setOverlay({
        title: 'Reboot complete',
        message: payload.message || `${printerName} is back online.`,
        spinning: false,
        result: 'success',
        showDismiss: true,
      });
      break;
    case 'timeout':
      setOverlay({
        title: 'Reboot timed out',
        message:
          payload.message || `${printerName} didn't come back online. Check that it's powered on and reachable.`,
        spinning: false,
        result: 'error',
        showRetry: true,
        showDismiss: true,
      });
      break;
    case 'failed':
      setOverlay({
        title: 'Reboot failed',
        message: payload.message || 'The printer was disconnected during the reboot.',
        spinning: false,
        result: 'error',
        showDismiss: true,
      });
      break;
  }
}

// ---------------------------------------------------------------------------
// Trigger flow
// ---------------------------------------------------------------------------

async function executeReboot(): Promise<void> {
  const contextId = getCurrentContextId();
  if (!contextId) {
    showToast('No printer is connected', 'error');
    return;
  }

  hide(el('reboot-confirm-modal'));
  rebootContextId = contextId;
  setOverlay({
    title: 'Rebooting printer…',
    message: 'Dispatching reboot command over SSH.',
    spinning: true,
  });

  try {
    const result = await apiRequest<RebootResponse>('/api/printer/reboot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextId }),
    });
    if (!result.success) {
      setOverlay({
        title: 'Reboot failed',
        message: result.error || 'The reboot could not be dispatched.',
        spinning: false,
        result: 'error',
        showRetry: true,
        showDismiss: true,
      });
    }
  } catch (error) {
    setOverlay({
      title: 'Reboot failed',
      message: error instanceof Error ? error.message : 'The reboot could not be dispatched.',
      spinning: false,
      result: 'error',
      showRetry: true,
      showDismiss: true,
    });
  }
}

/** Wire the topbar button, confirmation modal, overlay, and WS listener. */
export function setupReboot(): void {
  document.getElementById('reboot-button')?.addEventListener('click', () => {
    show(el('reboot-confirm-modal'));
  });

  el('reboot-confirm-close').addEventListener('click', () => hide(el('reboot-confirm-modal')));
  el('reboot-cancel').addEventListener('click', () => hide(el('reboot-confirm-modal')));
  el('reboot-confirm').addEventListener('click', () => void executeReboot());

  el('reboot-overlay-dismiss').addEventListener('click', closeOverlay);
  el('reboot-overlay-retry').addEventListener('click', () => void executeReboot());

  onRebootStatus(handleRebootStatus);
}
