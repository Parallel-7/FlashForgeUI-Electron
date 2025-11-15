/**
 * @fileoverview Renderer logging helpers.
 *
 * Provides shared log message handling and log panel hydration so modules can
 * log events without duplicating DOM fallbacks or preload IPC wiring.
 */

import { LogPanelComponent } from '../ui/components';

let logPanelComponent: LogPanelComponent | null = null;

export const setLogPanelComponent = (panel: LogPanelComponent | null): void => {
  logPanelComponent = panel;
};

export const getLogPanelComponent = (): LogPanelComponent | null => logPanelComponent;

export function logMessage(message: string): void {
  if (window.api) {
    window.api.send('add-log-message', message);
  }

  if (logPanelComponent && logPanelComponent.isInitialized()) {
    try {
      logPanelComponent.addLogMessage(message);
      return;
    } catch (error) {
      console.error('LogPanelComponent failed, falling back to DOM:', error);
    }
  }

  const logOutput = document.getElementById('log-output');
  if (logOutput) {
    const timestamp = new Date().toLocaleTimeString();
    logOutput.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    logOutput.scrollTop = logOutput.scrollHeight;
  } else {
    console.log(`[FALLBACK] ${message}`);
  }
}

export async function hydrateLogPanelWithHistory(logPanel: LogPanelComponent): Promise<void> {
  if (!window.api?.invoke) {
    return;
  }

  try {
    const result = await window.api.invoke('log-dialog-request-logs');
    if (!Array.isArray(result)) {
      return;
    }

    const entries = result.filter(
      (entry): entry is { timestamp: string; message: string } =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { timestamp?: unknown }).timestamp === 'string' &&
        typeof (entry as { message?: unknown }).message === 'string'
    );

    if (entries.length === 0 || logPanel.isDestroyed()) {
      return;
    }

    logPanel.loadInitialEntries(
      entries.map((entry) => ({
        timestamp: entry.timestamp,
        message: entry.message,
      }))
    );
  } catch (error) {
    console.error('Failed to hydrate log panel with history:', error);
  }
}

