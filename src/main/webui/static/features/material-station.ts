/**
 * @fileoverview Material Station dashboard card + slot editor for the WebUI client.
 *
 * One general card for every material-station printer — the AD5X (which calls it
 * "IFS") and the Creator 5 / 5 Pro (which call it "Material Station"). Renders the
 * four slots (swatch + material) from the printer's cached material-station status,
 * refreshed on each status tick. Clicking a slot opens a manual editor: a material
 * dropdown and a grid of the model's recognized color swatches, pre-seeded from the
 * slot's current state. The palette is chosen per model (AD5X vs Creator 5) via
 * {@link getPaletteForModel}. When Spoolman is configured, the editor also offers a
 * "Set from Spoolman" shortcut that pre-fills the selections (snapped to the fixed
 * palette) for review before applying. Mirrors the desktop FlashForgeUI card.
 *
 * @module webui/static/features/material-station
 */

import type {
  ApiResponse,
  MaterialSlotInfo,
  MaterialStationStatus,
  MaterialStationStatusResponse,
  SpoolSummary,
} from '../app.js';
import { state } from '../core/AppState.js';
import { apiRequest } from '../core/Transport.js';
import { getPaletteForModel, type Palette } from '../shared/palette.js';
import { $, showToast } from '../shared/dom.js';
import { getCurrentContextId } from './context-switching.js';
import { openSpoolPicker } from './spoolman.js';

let cardHandlersRegistered = false;
/** Latest material-station status, used to seed the editor when a slot is clicked. */
let latestStation: MaterialStationStatus | null = null;

/** The card root element (created by the grid; may be hidden if removed from the layout). */
function getCardPanel(): HTMLElement | null {
  return $('ms-station-panel');
}

/** Resolve the fixed palette for the connected model (AD5X vs Creator 5). */
function currentPalette(): Palette {
  return getPaletteForModel(latestStation?.printerModelType);
}

function setCardState(panel: HTMLElement, which: 'unavailable' | 'disconnected' | 'active'): void {
  panel.querySelectorAll('.ms-card-state').forEach((el) => el.classList.add('hidden'));
  panel.querySelector(`.ms-card-${which}`)?.classList.remove('hidden');
}

/** Render the four slots (swatch + material) from the material-station status. */
function renderMaterialStationCard(status: MaterialStationStatus | null): void {
  const panel = getCardPanel();
  if (!panel) {
    return;
  }

  const indicator = $('ms-card-active-indicator');

  if (!status) {
    setCardState(panel, 'unavailable');
    if (indicator) indicator.textContent = '';
    return;
  }
  if (!status.connected) {
    setCardState(panel, 'disconnected');
    if (indicator) indicator.textContent = '';
    return;
  }

  setCardState(panel, 'active');

  // AD5X and Creator 5 both expose 4 slots with 1-based slot IDs.
  for (let n = 1; n <= 4; n++) {
    const slotEl = panel.querySelector(`.ms-card-slot[data-slot="${n}"]`);
    if (!slotEl) {
      continue;
    }
    const data = status.slots.find((s) => s.slotId === n);
    const swatch = slotEl.querySelector('.ms-card-swatch') as HTMLElement | null;
    const material = slotEl.querySelector('.ms-card-slot-material') as HTMLElement | null;
    const empty = !data || data.isEmpty;

    slotEl.classList.toggle('empty', empty);
    slotEl.classList.toggle('active', !empty && status.activeSlot === n);

    if (swatch) {
      if (!empty && data?.materialColor) {
        swatch.style.backgroundColor = data.materialColor.startsWith('#')
          ? data.materialColor
          : `#${data.materialColor}`;
      } else {
        swatch.style.backgroundColor = '';
      }
    }
    if (material) {
      material.textContent = empty ? 'Empty' : data?.materialType || 'Unknown';
    }
  }

  if (indicator) {
    indicator.textContent =
      status.activeSlot !== null && status.activeSlot > 0 ? `Active: Slot ${status.activeSlot}` : '';
  }
}

async function fetchMaterialStationStatus(): Promise<MaterialStationStatus | null> {
  if (state.authRequired && !state.authToken) {
    return null;
  }

  try {
    const result = await apiRequest<MaterialStationStatusResponse>('/api/printer/material-station');
    return result.success ? (result.status ?? null) : null;
  } catch (error) {
    console.error('[MaterialStation] Failed to fetch status:', error);
    return null;
  }
}

/**
 * Refresh the material-station card from the printer's cached status. Called on
 * each status tick. No-ops when the card is absent or hidden; shows the
 * disconnected/unavailable states appropriately.
 */
export async function refreshMaterialStationCard(): Promise<void> {
  const panel = getCardPanel();
  if (!panel || panel.offsetParent === null) {
    return; // not in the layout / hidden — nothing to do
  }

  if (!state.isConnected) {
    latestStation = null;
    renderMaterialStationCard(null);
    return;
  }

  const status = await fetchMaterialStationStatus();
  latestStation = status;
  renderMaterialStationCard(status);
}

function handleSlotClick(slotNumber: number): void {
  const existing = latestStation?.slots.find((s) => s.slotId === slotNumber);
  const slot: MaterialSlotInfo = existing ?? {
    slotId: slotNumber,
    isEmpty: true,
    materialType: null,
    materialColor: null,
  };
  openSlotEditor(slot);
}

/**
 * Wire the material-station card once at startup. Uses delegated click handling so
 * it keeps working as the grid shows/hides the card, and does an initial render.
 */
export function setupMaterialStationCard(): void {
  if (cardHandlersRegistered) {
    return;
  }
  cardHandlersRegistered = true;

  document.addEventListener('click', (event) => {
    const slotEl = (event.target as HTMLElement | null)?.closest('.ms-card-slot');
    if (!slotEl) {
      return;
    }
    const attr = slotEl.getAttribute('data-slot');
    const slotNumber = attr ? Number.parseInt(attr, 10) : Number.NaN;
    if (Number.isInteger(slotNumber) && slotNumber >= 1 && slotNumber <= 4) {
      handleSlotClick(slotNumber);
    }
  });

  void refreshMaterialStationCard();
}

/**
 * Open the per-slot manual editor: a modal with a material dropdown and a grid of
 * the model's recognized color swatches, pre-seeded from the slot's current
 * material/color. When Spoolman is configured it also offers a "Set from Spoolman"
 * shortcut that pre-fills the selections (snapped to the fixed palette).
 */
function openSlotEditor(slot: MaterialSlotInfo): void {
  const palette = currentPalette();
  const displaySlotId = slot.slotId;

  // Seed from the slot's current material/color, snapped to the fixed palette.
  let selectedMaterial =
    (slot.materialType ? palette.nearestMaterial(slot.materialType) : null) ?? palette.materials[0] ?? 'PLA';
  let selectedHex: string | null = slot.materialColor ? (palette.nearestColor(slot.materialColor)?.hex ?? null) : null;

  const materialOptions = palette.materials
    .map((m) => `<option value="${m}"${m === selectedMaterial ? ' selected' : ''}>${m}</option>`)
    .join('');
  const swatches = palette.colors
    .map(
      (c) =>
        `<button type="button" class="ms-swatch${c.hex === selectedHex ? ' selected' : ''}" data-hex="${c.hex}" title="${c.name}" aria-label="${c.name}" style="--swatch:${c.hex}"><span class="ms-swatch-check">✓</span></button>`
    )
    .join('');
  const spoolmanConfigured = Boolean(state.spoolmanConfig?.serverUrl);
  const spoolmanBtn = spoolmanConfigured
    ? '<button type="button" class="ms-editor-btn ms-editor-spoolman">Set from Spoolman</button>'
    : '';

  const overlay = document.createElement('div');
  overlay.className = 'ms-editor-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="ms-editor-content">
      <div class="ms-editor-header">
        <span class="ms-editor-title">Configure Slot ${displaySlotId}</span>
        <button type="button" class="ms-editor-close" aria-label="Close">&times;</button>
      </div>
      <div class="ms-editor-body">
        <label class="ms-editor-field">
          <span class="ms-editor-label">Material</span>
          <select class="ms-editor-material">${materialOptions}</select>
        </label>
        <div class="ms-editor-field">
          <span class="ms-editor-label">Color</span>
          <div class="ms-swatch-grid">${swatches}</div>
        </div>
        <div class="ms-editor-preview"></div>
      </div>
      <div class="ms-editor-footer">
        ${spoolmanBtn}
        <button type="button" class="ms-editor-btn ms-editor-cancel">Cancel</button>
        <button type="button" class="ms-editor-btn ms-editor-apply">Apply</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const select = overlay.querySelector('.ms-editor-material') as HTMLSelectElement;
  const previewEl = overlay.querySelector('.ms-editor-preview') as HTMLElement;
  const applyBtn = overlay.querySelector('.ms-editor-apply') as HTMLButtonElement;

  const updatePreview = (): void => {
    const colorName = selectedHex
      ? (palette.colors.find((c) => c.hex === selectedHex)?.name ?? selectedHex)
      : null;
    previewEl.textContent = colorName
      ? `Slot ${displaySlotId} → ${selectedMaterial} · ${colorName}`
      : 'Pick a color to continue';
    applyBtn.disabled = !selectedHex;
  };

  const selectSwatch = (hex: string): void => {
    selectedHex = hex;
    overlay.querySelectorAll('.ms-swatch').forEach((el) => {
      el.classList.toggle('selected', (el as HTMLElement).getAttribute('data-hex') === hex);
    });
    updatePreview();
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
  };

  select.addEventListener('change', () => {
    selectedMaterial = select.value;
    updatePreview();
  });
  overlay.querySelectorAll('.ms-swatch').forEach((el) => {
    el.addEventListener('click', () => {
      const hex = (el as HTMLElement).getAttribute('data-hex');
      if (hex) selectSwatch(hex);
    });
  });
  overlay.querySelector('.ms-editor-close')?.addEventListener('click', close);
  overlay.querySelector('.ms-editor-cancel')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKey, true);

  overlay.querySelector('.ms-editor-spoolman')?.addEventListener('click', () => {
    openSpoolPicker((spool: SpoolSummary) => {
      if (spool.material) {
        const matched = palette.nearestMaterial(spool.material);
        if (matched) {
          selectedMaterial = matched;
          select.value = matched;
        }
      }
      if (spool.colorHex) {
        const snapped = palette.nearestColor(spool.colorHex);
        if (snapped) selectSwatch(snapped.hex);
      }
      updatePreview();
    });
  });

  applyBtn.addEventListener('click', () => {
    if (selectedHex) {
      void applyManualSlot(displaySlotId, selectedMaterial, selectedHex, close);
    }
  });

  updatePreview();
}

/**
 * Apply an explicit material + color (chosen in the editor) to a slot via the
 * slot-config route, then refresh the card.
 */
async function applyManualSlot(
  displaySlotId: number,
  material: string,
  colorHex: string,
  onApplied: () => void
): Promise<void> {
  const palette = currentPalette();
  try {
    const result = await apiRequest<ApiResponse>('/api/printer/material-station/slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contextId: getCurrentContextId(),
        slot: displaySlotId,
        materialName: material,
        colorHex,
      }),
    });

    if (result.success) {
      const colorName = palette.colors.find((c) => c.hex === colorHex)?.name ?? colorHex;
      showToast(`Slot ${displaySlotId} → ${material} · ${colorName}`, 'success');
      onApplied();
      await refreshMaterialStationCard();
    } else {
      showToast(result.error || 'Failed to configure slot', 'error');
    }
  } catch (error) {
    console.error('[MaterialStation] Failed to configure slot:', error);
    showToast('Failed to configure slot', 'error');
  }
}
