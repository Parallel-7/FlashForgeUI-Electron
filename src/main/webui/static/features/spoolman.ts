/**
 * @fileoverview Spoolman integration helpers for the WebUI client.
 *
 * Loads Spoolman configuration, manages the active spool per context, and
 * wires up the selection modal (search, select, clear). Keeps API interaction
 * and DOM updates contained so higher-level orchestration simply calls the
 * exported hooks.
 */

import type {
  ActiveSpoolResponse,
  ApiResponse,
  SpoolSearchResponse,
  SpoolSelectResponse,
  SpoolSummary,
  SpoolmanConfigResponse,
} from '../app.js';
import { getCurrentSettings, state } from '../core/AppState.js';
import { apiRequest } from '../core/Transport.js';
import { $, hideElement, showElement, showToast } from '../shared/dom.js';
import { updateSpoolmanPanelState } from '../ui/panels.js';
import { getCurrentContextId } from './context-switching.js';
import { applySettings, refreshSettingsUI } from './layout-theme.js';

let spoolSearchDebounceTimer: number | null = null;
let handlersRegistered = false;

export async function loadSpoolmanConfig(): Promise<void> {
  if (state.authRequired && !state.authToken) {
    return;
  }

  try {
    const result = await apiRequest<SpoolmanConfigResponse>('/api/spoolman/config');

    if (result.success) {
      state.spoolmanConfig = result;

      if (result.enabled && result.contextId) {
        await fetchActiveSpoolForContext(result.contextId);
      }

      const settings = getCurrentSettings();
      applySettings(settings);
      refreshSettingsUI(settings);
      updateSpoolmanPanelState();
    }
  } catch (error) {
    console.error('[Spoolman] Failed to load config:', error);
  }
}

export async function fetchActiveSpoolForContext(contextId?: string): Promise<void> {
  if (!state.spoolmanConfig?.enabled) {
    return;
  }

  const targetContextId = contextId ?? getCurrentContextId();
  if (!targetContextId) {
    console.warn('[Spoolman] Cannot fetch active spool: no context ID available');
    return;
  }

  try {
    const result = await apiRequest<ActiveSpoolResponse>(
      `/api/spoolman/active/${encodeURIComponent(targetContextId)}`,
    );

    if (result.success) {
      state.activeSpool = result.spool;
      updateSpoolmanPanelState();
    } else {
      console.warn('[Spoolman] No active spool or error:', result.error);
    }
  } catch (error) {
    console.error('[Spoolman] Failed to fetch active spool:', error);
  }
}

export async function fetchSpools(searchQuery: string = ''): Promise<void> {
  if (!state.spoolmanConfig?.enabled) {
    return;
  }

  try {
    showElement('spoolman-loading');
    hideElement('spoolman-no-results');

    const url = `/api/spoolman/spools${
      searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''
    }`;
    const result = await apiRequest<SpoolSearchResponse>(url);

    if (result.success && result.spools) {
      let displaySpools = result.spools;

      if (displaySpools.length === 0 && searchQuery.trim()) {
        console.log('[Spoolman] Server search returned no results, trying client-side fallback');

        const allSpoolsResult = await apiRequest<SpoolSearchResponse>('/api/spoolman/spools');
        if (allSpoolsResult.success && allSpoolsResult.spools) {
          const query = searchQuery.toLowerCase();
          displaySpools = allSpoolsResult.spools.filter((spool) => {
            const name = spool.name?.toLowerCase() || '';
            const vendor = spool.vendor?.toLowerCase() || '';
            const material = spool.material?.toLowerCase() || '';
            return name.includes(query) || vendor.includes(query) || material.includes(query);
          });
        }
      }

      state.availableSpools = displaySpools;
      renderSpoolList(displaySpools);
    }
  } catch (error) {
    console.error('[Spoolman] Failed to fetch spools:', error);
    showToast('Failed to load spools', 'error');
  } finally {
    hideElement('spoolman-loading');
  }
}

export async function selectSpool(spoolId: number): Promise<void> {
  const contextId = getCurrentContextId();

  try {
    const result = await apiRequest<SpoolSelectResponse>('/api/spoolman/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextId, spoolId }),
    });

    if (result.success && result.spool) {
      state.activeSpool = result.spool;
      closeSpoolSelectionModal();
      updateSpoolmanPanelState();
      showToast('Spool selected successfully', 'success');
    } else {
      showToast(result.error || 'Failed to select spool', 'error');
    }
  } catch (error) {
    console.error('[Spoolman] Failed to select spool:', error);
    showToast('Failed to select spool', 'error');
  }
}

export async function clearActiveSpool(): Promise<void> {
  const contextId = getCurrentContextId();

  try {
    const result = await apiRequest<ApiResponse>('/api/spoolman/select', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextId }),
    });

    if (result.success) {
      state.activeSpool = null;
      closeSpoolSelectionModal();
      updateSpoolmanPanelState();
      showToast('Active spool cleared', 'success');
    } else {
      showToast(result.error || 'Failed to clear spool', 'error');
    }
  } catch (error) {
    console.error('[Spoolman] Failed to clear spool:', error);
    showToast('Failed to clear spool', 'error');
  }
}

export function openSpoolSelectionModal(): void {
  if (!state.spoolmanConfig?.enabled) {
    showToast('Spoolman integration is disabled', 'error');
    return;
  }

  const modal = $('spoolman-modal');
  if (!modal) {
    return;
  }

  const searchInput = $('spoolman-search') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.value = '';
  }

  void fetchSpools('');
  showElement('spoolman-modal');
}

export function closeSpoolSelectionModal(): void {
  const modal = $('spoolman-modal');
  if (!modal) {
    return;
  }

  hideElement('spoolman-modal');

  const searchInput = $('spoolman-search') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.value = '';
  }

  state.availableSpools = [];
  renderSpoolList([]);
}

export function renderSpoolList(spools: SpoolSummary[]): void {
  const listContainer = $('spoolman-spool-list');
  const noResults = $('spoolman-no-results');

  if (!listContainer || !noResults) {
    return;
  }

  listContainer.innerHTML = '';

  if (spools.length === 0) {
    showElement('spoolman-no-results');
    return;
  }

  hideElement('spoolman-no-results');

  spools.forEach((spool) => {
    const item = document.createElement('div');
    item.className = 'spoolman-spool-item';

    const colorHex = spool.colorHex
      ? spool.colorHex.startsWith('#')
        ? spool.colorHex
        : `#${spool.colorHex}`
      : '#808080';
    const name = spool.name || `Spool #${spool.id}`;
    const vendor = spool.vendor || '';
    const material = spool.material || '';
    const metaParts = [vendor, material].filter(Boolean);
    const meta = metaParts.join(' • ') || 'Unknown';

    const remainingWeight = spool.remainingWeight || 0;
    const remainingLength = spool.remainingLength || 0;
    const remaining =
      state.spoolmanConfig?.updateMode === 'weight'
        ? `${remainingWeight.toFixed(0)}g`
        : `${(remainingLength / 1000).toFixed(1)}m`;

    item.innerHTML = `
      <div class="spool-color-indicator" style="background-color: ${colorHex}"></div>
      <div class="spool-details">
        <div class="spool-name">${name}</div>
        <div class="spool-meta">${meta}</div>
      </div>
      <div class="spool-remaining">${remaining}</div>
    `;

    item.addEventListener('click', () => {
      void selectSpool(spool.id);
    });

    listContainer.appendChild(item);
  });
}

export function handleSpoolSearch(event: Event): void {
  const input = event.target as HTMLInputElement;
  const query = input.value.trim();

  if (spoolSearchDebounceTimer !== null) {
    clearTimeout(spoolSearchDebounceTimer);
  }

  spoolSearchDebounceTimer = window.setTimeout(() => {
    void fetchSpools(query);
    spoolSearchDebounceTimer = null;
  }, 300);
}

export function setupSpoolmanHandlers(): void {
  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  attachPanelButtonHandlers($('webui-grid-desktop'));
  attachPanelButtonHandlers($('webui-grid-mobile'));

  $('spoolman-modal-close')?.addEventListener('click', () => closeSpoolSelectionModal());
  $('spoolman-modal-cancel')?.addEventListener('click', () => closeSpoolSelectionModal());
  $('spoolman-clear-spool')?.addEventListener('click', () => {
    void clearActiveSpool();
  });

  const searchInput = $('spoolman-search') as HTMLInputElement | null;
  searchInput?.addEventListener('input', handleSpoolSearch);
}

function attachPanelButtonHandlers(container: HTMLElement | null): void {
  if (!container) {
    return;
  }

  container.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('button');
    if (!button) {
      return;
    }

    switch (button.id) {
      case 'btn-select-spool':
      case 'btn-change-spool':
        event.preventDefault();
        openSpoolSelectionModal();
        break;
      default:
        break;
    }
  });
}
