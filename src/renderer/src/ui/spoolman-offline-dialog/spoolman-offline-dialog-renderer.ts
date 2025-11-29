/**
 * @fileoverview Renderer logic for Spoolman offline dialog.
 */

export {};

import type { ThemeColors } from '@shared/types/config.js';
import { applyDialogTheme } from '../shared/theme-utils.js';
import { initializeLucideIconsFromGlobal } from '../shared/lucide.js';

interface RetryResult {
  connected: boolean;
  error?: string;
}

interface SpoolmanOfflineAPI {
  retryConnection: () => Promise<RetryResult>;
  onStatusUpdate: (callback: (message: string) => void) => void;
  receive?: (channel: string, func: (...args: unknown[]) => void) => void;
}

const getSpoolmanOfflineAPI = (): SpoolmanOfflineAPI => {
  const api = window.api?.dialog?.spoolmanOffline as SpoolmanOfflineAPI | undefined;
  if (!api) {
    throw new Error('[SpoolmanOfflineDialog] dialog API bridge is not available');
  }
  return api;
};

type StatusTone = 'info' | 'error' | 'success';

interface DialogElements {
  readonly statusMessage: HTMLElement | null;
  readonly retryButton: HTMLButtonElement | null;
  readonly cancelButton: HTMLButtonElement | null;
  readonly closeButton: HTMLButtonElement | null;
}

const ICONS = ['server-off', 'refresh-ccw', 'x'];


function registerThemeListener(): void {
  getSpoolmanOfflineAPI().receive?.('theme-changed', (data: unknown) => {
    applyDialogTheme(data as ThemeColors);
  });
}
document.addEventListener('DOMContentLoaded', () => {
  registerThemeListener();
  initializeLucideIconsFromGlobal(ICONS);
  const elements: DialogElements = {
    statusMessage: document.getElementById('status-message'),
    retryButton: document.getElementById('retry-button') as HTMLButtonElement | null,
    cancelButton: document.getElementById('dialog-cancel') as HTMLButtonElement | null,
    closeButton: document.getElementById('dialog-close') as HTMLButtonElement | null
  };

  setupEventHandlers(elements);
  getSpoolmanOfflineAPI().onStatusUpdate((message: string) => {
    if (message) {
      setStatus(elements, message, 'error');
    }
  });
});

function setupEventHandlers(elements: DialogElements): void {
  elements.retryButton?.addEventListener('click', () => {
    void handleRetry(elements);
  });

  const close = (): void => window.close();
  elements.cancelButton?.addEventListener('click', close);
  elements.closeButton?.addEventListener('click', close);
}

function setStatus(elements: DialogElements, message: string, tone: StatusTone = 'info'): void {
  const target = elements.statusMessage;
  if (!target) return;

  target.textContent = message;
  target.classList.remove('status-error', 'status-success');

  if (tone === 'error') {
    target.classList.add('status-error');
  } else if (tone === 'success') {
    target.classList.add('status-success');
  }
}

async function handleRetry(elements: DialogElements): Promise<void> {
  if (!elements.retryButton) {
    return;
  }

  elements.retryButton.disabled = true;
  setStatus(elements, 'Checking connection...', 'info');

  try {
    const result = await getSpoolmanOfflineAPI().retryConnection();
    if (result.connected) {
      setStatus(elements, 'Connection restored! You can close this window.', 'success');
    } else {
      setStatus(elements, result.error || 'Connection failed. Please try again.', 'error');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    setStatus(elements, message, 'error');
  } finally {
    setTimeout(() => {
      if (elements.retryButton) {
        elements.retryButton.disabled = false;
      }
    }, 600);
  }
}
