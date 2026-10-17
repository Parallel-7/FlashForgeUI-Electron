/**
 * @fileoverview Overlay controller for the remote "Reboot Printer" lifecycle.
 *
 * Claims the shared #loading-overlay exclusively for a reboot and drives it
 * through its phases: rebooting -> reconnecting -> reconnecting-services ->
 * success (auto-dismiss) or timeout / failed (Retry / Close). Transitions come
 * from main-process 'printer:reboot-status' events; a renderer-side 150s safety
 * timer covers the case where those events never arrive.
 *
 * Contention: while a reboot owns the overlay, ShellController ignores the
 * regular 'loading-state-changed' IPC (claimed via the host callbacks), so the
 * connection-flow / file-operation loading states cannot clobber the reboot UI.
 * The reboot menu item is also disabled whenever the overlay is already busy
 * with a non-reboot operation (see ShellController.setRebootAvailable).
 *
 * Desktop only; WebUI parity is deferred.
 *
 * Key exports:
 * - RebootController: overlay state machine for a single reboot lifecycle.
 */

import type { RebootStatusPayload } from '@shared/types/printer-power.js';

/** Callbacks into ShellController to claim/release the shared overlay. */
export interface RebootOverlayHost {
  /** Block the regular loading IPC from touching the overlay (reboot owns it). */
  claimOverlay: () => void;
  /** Release the overlay back to the regular loading-state-changed flow. */
  releaseOverlay: () => void;
}

/** Renderer-side fallback cap matching the main-process reconnect timeout. */
const REBOOT_SAFETY_TIMEOUT_MS = 150_000;

/** Auto-dismiss delay after a successful reconnect. */
const REBOOT_SUCCESS_AUTOHIDE_MS = 1500;

type OverlayState = 'loading' | 'success' | 'error';
type ButtonSet = 'none' | 'retryClose' | 'close';

/**
 * Drives the loading overlay through a reboot lifecycle. One active reboot at a
 * time; re-invoking start() (Retry) tears down the previous attempt first.
 */
export class RebootController {
  private overlay: HTMLElement | null = null;
  private messageEl: HTMLElement | null = null;
  private progressContainer: HTMLElement | null = null;
  private cancelBtn: HTMLElement | null = null;
  private rebootActions: HTMLElement | null = null;
  private retryBtn: HTMLElement | null = null;
  private closeBtn: HTMLElement | null = null;

  private active = false;
  private contextId = '';
  private printerName = '';
  private safetyTimer: number | null = null;
  private autoHideTimer: number | null = null;
  private unsubscribe?: () => void;

  constructor(
    private readonly host: RebootOverlayHost,
    private readonly log: (message: string) => void
  ) {}

  /** Cache DOM refs, subscribe to status events, wire Retry/Close buttons. */
  init(): void {
    this.overlay = document.getElementById('loading-overlay');
    this.messageEl = document.getElementById('loading-message');
    this.progressContainer = document.getElementById('loading-progress-container');
    this.cancelBtn = document.getElementById('loading-cancel-btn');
    this.rebootActions = document.getElementById('loading-reboot-actions');
    this.retryBtn = document.getElementById('loading-retry-btn');
    this.closeBtn = document.getElementById('loading-close-btn');

    if (window.api?.onRebootStatus) {
      this.unsubscribe = window.api.onRebootStatus((payload) => this.onStatus(payload));
    }

    this.retryBtn?.addEventListener('click', () => this.handleRetry());
    this.closeBtn?.addEventListener('click', () => this.handleClose());
  }

  dispose(): void {
    this.clearTimers();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  /** Begin a reboot lifecycle for the given context. Safe to re-invoke (Retry). */
  start(contextId: string, printerName: string): void {
    this.teardown(false);
    this.contextId = contextId;
    this.printerName = printerName;
    this.active = true;

    // Claim the overlay so regular loading events cannot clobber the reboot UI.
    this.host.claimOverlay();
    this.render('loading', `Rebooting ${printerName}...`, 'none');

    // Fallback in case main never pushes any status event.
    this.safetyTimer = window.setTimeout(() => {
      if (this.active) {
        this.render(
          'error',
          `${printerName} didn't come back online. Check that it's powered on and reachable.`,
          'retryClose'
        );
      }
    }, REBOOT_SAFETY_TIMEOUT_MS);

    // Dispatch the reboot. A rejection (SSH / validation failure) is terminal.
    window.api
      ?.rebootPrinter(contextId)
      .then((result) => {
        if (!result.success) {
          this.fail(`Couldn't start the reboot for ${printerName}.`);
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.fail(message || `Couldn't start the reboot for ${printerName}.`);
      });

    this.log(`Reboot initiated for ${printerName} (${contextId})`);
  }

  /** Transition the overlay based on a main-process status event. */
  private onStatus(payload: RebootStatusPayload): void {
    if (!this.active) {
      return;
    }
    const message = payload.message ?? '';
    switch (payload.phase) {
      case 'rebooting':
        this.render('loading', message || `Rebooting ${this.printerName}...`, 'none');
        break;
      case 'reconnecting':
        this.render(
          'loading',
          message || `Waiting for ${this.printerName} to come back online...`,
          'none'
        );
        break;
      case 'reconnecting-services':
        this.render(
          'loading',
          message || `Reconnecting services for ${this.printerName}...`,
          'none'
        );
        break;
      case 'success':
        this.render('success', message || `${this.printerName} is back online`, 'none');
        // Stop the safety timer now so a late tick can't clobber the success state.
        if (this.safetyTimer !== null) {
          window.clearTimeout(this.safetyTimer);
          this.safetyTimer = null;
        }
        this.autoHideTimer = window.setTimeout(() => this.teardown(true), REBOOT_SUCCESS_AUTOHIDE_MS);
        break;
      case 'timeout':
        this.render('error', message, 'retryClose');
        break;
      case 'failed':
        this.render('error', message, 'close');
        break;
    }
  }

  private fail(message: string): void {
    if (!this.active) {
      return;
    }
    this.render('error', message, 'close');
  }

  private handleRetry(): void {
    if (this.contextId) {
      this.start(this.contextId, this.printerName);
    }
  }

  private handleClose(): void {
    this.teardown(true);
  }

  /** Reset overlay state and (optionally) release it back to regular loading. */
  private teardown(releaseOverlay: boolean): void {
    this.clearTimers();
    this.active = false;
    this.hideRebootActions();

    if (releaseOverlay) {
      this.overlay?.classList.add('hidden');
      this.overlay?.classList.remove('state-loading', 'state-success', 'state-error');
      this.host.releaseOverlay();
    }
  }

  private clearTimers(): void {
    if (this.safetyTimer !== null) {
      window.clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
    if (this.autoHideTimer !== null) {
      window.clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }

  private hideRebootActions(): void {
    this.rebootActions?.classList.add('hidden');
  }

  /** Apply a reboot phase to the shared overlay elements. */
  private render(state: OverlayState, message: string, buttons: ButtonSet): void {
    if (!this.overlay || !this.messageEl) {
      console.error('[RebootController] Overlay elements not found');
      return;
    }

    this.overlay.classList.remove('hidden', 'state-loading', 'state-success', 'state-error');
    this.overlay.classList.add(`state-${state}`);

    this.messageEl.textContent = message;

    // Reboot never shows progress or the regular cancel button.
    this.progressContainer?.classList.remove('visible');
    this.cancelBtn?.classList.remove('visible');

    if (buttons === 'none') {
      this.hideRebootActions();
    } else {
      this.rebootActions?.classList.remove('hidden');
      this.retryBtn?.classList.toggle('hidden', buttons === 'close');
    }
  }
}
