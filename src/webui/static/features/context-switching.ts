/**
 * @fileoverview Multi-printer context management utilities.
 *
 * Handles context discovery, selector population, and switching logic with
 * optional hooks so the orchestrator can run follow-up tasks (feature reloads,
 * camera refreshes, etc.) without embedding those concerns into this module.
 */

import type { ApiResponse, ContextsResponse, PrinterContext } from '../app.js';
import {
  DEMO_SERIAL,
  contextById,
  state,
  getCurrentContextId as getStoredContextId,
  setCurrentContextId,
  setCurrentPrinterSerial,
} from '../core/AppState.js';
import { apiRequest, sendCommand } from '../core/Transport.js';
import { $, hideElement, showElement, showToast } from '../shared/dom.js';
import { loadLayoutForCurrentPrinter, saveCurrentLayoutSnapshot } from './layout-theme.js';

export interface ContextSwitchHandlers {
  onContextSwitched?: (contextId: string) => Promise<void> | void;
}

let contextHandlers: ContextSwitchHandlers = {};

export function initializeContextSwitching(handlers: ContextSwitchHandlers = {}): void {
  contextHandlers = handlers;
}

export function setupContextEventHandlers(handlers?: ContextSwitchHandlers): void {
  if (handlers) {
    contextHandlers = handlers;
  }

  const printerSelect = $('printer-select') as HTMLSelectElement | null;
  printerSelect?.addEventListener('change', (event) => {
    const selectedContextId = (event.target as HTMLSelectElement).value;
    setCurrentContextId(selectedContextId);
    void switchPrinterContext(selectedContextId);
  });
}

export function getCurrentContextId(): string | null {
  const storedContext = getStoredContextId();
  if (storedContext) {
    return storedContext;
  }

  const select = $('printer-select') as HTMLSelectElement | null;
  if (!select || !select.value) {
    return null;
  }

  setCurrentContextId(select.value);
  return select.value;
}

export async function fetchPrinterContexts(): Promise<void> {
  if (state.authRequired && !state.authToken) {
    return;
  }

  try {
    const result = await apiRequest<ContextsResponse>('/api/contexts');

    if (!result.success || !result.contexts) {
      console.error('[Contexts] Failed to fetch contexts:', result.error);
      return;
    }

    contextById.clear();
    result.contexts.forEach((context) => {
      contextById.set(context.id, context);
    });

    const fallbackContext =
      result.contexts.find((context) => context.isActive) ?? result.contexts[0] ?? null;

    const storedContextId = getStoredContextId();
    const selectedContextId =
      storedContextId && contextById.has(storedContextId)
        ? storedContextId
        : result.activeContextId || fallbackContext?.id || '';

    updatePrinterSelector(result.contexts, selectedContextId);

    const activeContext = selectedContextId ? contextById.get(selectedContextId) : fallbackContext;
    setCurrentContextId(activeContext?.id ?? null);
    const serial = resolveSerialForContext(activeContext) ?? DEMO_SERIAL;
    setCurrentPrinterSerial(serial);
    loadLayoutForCurrentPrinter();
  } catch (error) {
    console.error('[Contexts] Error fetching contexts:', error);
  }
}

export function updatePrinterSelector(contexts: PrinterContext[], activeContextId: string): void {
  const selector = $('printer-selector');
  const select = $('printer-select') as HTMLSelectElement | null;

  if (!selector || !select) {
    console.error('[Contexts] Printer selector elements not found');
    return;
  }

  if (contexts.length > 1) {
    showElement('printer-selector');
  } else {
    hideElement('printer-selector');
    return;
  }

  select.innerHTML = '';

  contexts.forEach((context) => {
    const option = document.createElement('option');
    option.value = context.id;
    option.textContent = `${context.name} (${context.ipAddress})`;
    if (context.isActive || context.id === activeContextId) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

export async function switchPrinterContext(contextId: string): Promise<void> {
  if (state.authRequired && !state.authToken) {
    showToast('Not authenticated', 'error');
    return;
  }

  setCurrentContextId(contextId);
  saveCurrentLayoutSnapshot();

  try {
    const result = await apiRequest<ApiResponse>('/api/contexts/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextId }),
    });

    if (result.success) {
      showToast(result.message || 'Switched printer', 'success');
      await fetchPrinterContexts();
      if (contextHandlers.onContextSwitched) {
        await contextHandlers.onContextSwitched(contextId);
      }
      sendCommand({ command: 'REQUEST_STATUS' });
    } else {
      showToast(result.error || 'Failed to switch printer', 'error');
    }
  } catch (error) {
    console.error('[Contexts] Error switching context:', error);
    showToast('Failed to switch printer', 'error');
  }
}

export function resolveSerialForContext(context: PrinterContext | undefined): string | null {
  if (!context) {
    return null;
  }
  if (context.serialNumber && context.serialNumber.trim().length > 0) {
    return context.serialNumber;
  }
  return context.id || null;
}
