/**
 * @fileoverview Spoolman Dialog Renderer Process
 *
 * Handles the spool selection dialog UI logic including search input, spool grid rendering,
 * state management (loading, error, empty), and user interactions. Communicates with main
 * process via the preload API to search spools and notify selection.
 *
 * Key Features:
 * - Debounced search input (300ms)
 * - Dynamic spool card rendering with color visualization
 * - Multiple view states: loading, error, empty, grid
 * - Click-to-select spool interaction
 * - Keyboard navigation (Escape to close)
 *
 * @module ui/spoolman-dialog/spoolman-dialog-renderer
 */

import type { SpoolResponse, ActiveSpoolData } from '../../types/spoolman';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Ensure hex color has # prefix for CSS compatibility
 * Spoolman API returns colors without # prefix (e.g., "DB2F2B" instead of "#DB2F2B")
 * @param color - Hex color string from Spoolman API
 * @returns Hex color with # prefix, or default gray if invalid
 */
function ensureHashPrefix(color: string | null | undefined): string {
  if (!color) return '#666666'; // Default gray
  return color.startsWith('#') ? color : `#${color}`;
}

// ============================================================================
// STATE
// ============================================================================

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentQuery = '';

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  console.log('[SpoolmanDialog] Renderer loaded');
  setupEventHandlers();
  void loadInitialSpools();
});

/**
 * Setup event handlers
 */
function setupEventHandlers(): void {
  // Close button
  const closeBtn = document.getElementById('btn-close');
  closeBtn?.addEventListener('click', () => {
    window.close();
  });

  // Retry button
  const retryBtn = document.getElementById('btn-retry');
  retryBtn?.addEventListener('click', () => {
    void loadSpools(currentQuery);
  });

  // Search input (debounced)
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  searchInput?.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.trim();
    currentQuery = query;

    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    // Debounce search by 300ms
    searchDebounceTimer = setTimeout(() => {
      void loadSpools(query);
    }, 300);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.close();
    }
  });
}

/**
 * Load initial spools (first 50)
 */
async function loadInitialSpools(): Promise<void> {
  await loadSpools('');
}

/**
 * Load spools with search query
 */
async function loadSpools(query: string): Promise<void> {
  showLoadingState();

  try {
    if (!window.spoolmanDialogAPI) {
      throw new Error('Spoolman dialog API not available');
    }

    // Request spools from main process
    const spools = await window.spoolmanDialogAPI.searchSpools({
      'filament.name': query || undefined,
      limit: 50,
      allow_archived: false,
    });

    if (spools.length === 0) {
      showEmptyState();
    } else {
      renderSpoolCards(spools);
    }
  } catch (error) {
    console.error('[SpoolmanDialog] Failed to load spools:', error);
    showErrorState(error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Render spool cards in grid
 */
function renderSpoolCards(spools: SpoolResponse[]): void {
  const gridContainer = document.getElementById('spool-grid');
  if (!gridContainer) return;

  // Clear existing cards
  gridContainer.innerHTML = '';

  // Create card for each spool
  spools.forEach((spool) => {
    const card = createSpoolCard(spool);
    gridContainer.appendChild(card);
  });

  // Show grid, hide other states
  showSpoolGrid();
}

/**
 * Create a spool card element
 */
function createSpoolCard(spool: SpoolResponse): HTMLElement {
  const card = document.createElement('div');
  card.className = 'spool-card';
  card.dataset.spoolId = spool.id.toString();

  // Get spool color with # prefix for CSS
  const colorHex = ensureHashPrefix(spool.filament.color_hex);

  // Build display text
  const vendor = spool.filament.vendor?.name || '';
  const name = spool.filament.name || 'Unknown';
  const displayName = vendor ? `${vendor} ${name}` : name;
  const material = spool.filament.material || 'Unknown';
  const remaining = spool.remaining_weight
    ? `${Math.round(spool.remaining_weight)}g remaining`
    : 'Unknown weight';

  card.innerHTML = `
    <div class="card-spool-visual" style="background-color: ${colorHex};">
      <div class="card-spool-center"></div>
    </div>
    <div class="card-spool-name">${escapeHtml(displayName)}</div>
    <div class="card-spool-material">${escapeHtml(material)}</div>
    <div class="card-spool-remaining">${escapeHtml(remaining)}</div>
  `;

  // Click handler
  card.addEventListener('click', () => {
    void handleSpoolSelect(spool);
  });

  return card;
}

/**
 * Handle spool selection
 */
async function handleSpoolSelect(spool: SpoolResponse): Promise<void> {
  if (!window.spoolmanDialogAPI) return;

  // Transform to ActiveSpoolData
  const activeSpoolData: ActiveSpoolData = {
    id: spool.id,
    name: spool.filament.name || 'Unknown',
    vendor: spool.filament.vendor?.name || null,
    material: spool.filament.material || null,
    colorHex: ensureHashPrefix(spool.filament.color_hex),
    remainingWeight: spool.remaining_weight || 0,
    remainingLength: spool.remaining_length || 0,
  };

  // Send selection to main process
  await window.spoolmanDialogAPI.selectSpool(activeSpoolData);

  // Close dialog
  window.close();
}

/**
 * Show loading state
 */
function showLoadingState(): void {
  hideAllStates();
  const loadingState = document.getElementById('loading-state');
  if (loadingState) loadingState.style.display = 'flex';
}

/**
 * Show error state
 */
function showErrorState(message: string): void {
  hideAllStates();
  const errorState = document.getElementById('error-state');
  const errorMessage = document.getElementById('error-message');
  if (errorState) errorState.style.display = 'flex';
  if (errorMessage) errorMessage.textContent = message;
}

/**
 * Show empty state
 */
function showEmptyState(): void {
  hideAllStates();
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.style.display = 'flex';
}

/**
 * Show spool grid
 */
function showSpoolGrid(): void {
  hideAllStates();
  const spoolGrid = document.getElementById('spool-grid');
  if (spoolGrid) spoolGrid.style.display = 'grid';
}

/**
 * Hide all state views
 */
function hideAllStates(): void {
  const states = ['loading-state', 'error-state', 'empty-state', 'spool-grid'];
  states.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
