/**
 * @fileoverview UI panel rendering helpers for the WebUI client.
 *
 * Contains pure rendering logic for the header connection indicator, printer
 * status cards, statistics panels, and Spoolman tracker. These functions are
 * stateless aside from reading from the shared AppState container and can be
 * safely reused by WebSocket handlers, layout refresh hooks, or manual refresh
 * actions.
 */

import type { PrinterStatus } from '../app.js';
import { state } from '../core/AppState.js';
import { isSpoolmanAvailableForCurrentContext } from '../features/layout-theme.js';
import { $, hideElement, setTextContent, showElement } from '../shared/dom.js';
import {
  formatElapsedSeconds,
  formatETA,
  formatETAFromString,
  formatLifetimeFilament,
  formatLifetimePrintTime,
  formatTime,
} from '../shared/formatting.js';

export function updateConnectionStatus(connected: boolean): void {
  const indicator = $('connection-indicator');
  const text = $('connection-text');

  if (indicator) {
    if (connected) {
      indicator.classList.add('connected');
    } else {
      indicator.classList.remove('connected');
    }
  }

  if (text) {
    text.textContent = connected ? 'Connected' : 'Disconnected';
  }
}

export function updatePrinterStatus(status: PrinterStatus | null): void {
  if (!status) {
    updatePrinterStateCard(null);
    setTextContent('bed-temp', '--°C / --°C');
    setTextContent('extruder-temp', '--°C / --°C');
    setTextContent('current-job', 'No data');
    setTextContent('progress-percentage', '0%');
    updateModelPreview(null);
    updateCreator5TemperatureCard(null);
    return;
  }

  state.printerStatus = status;
  updatePrinterStateCard(status);

  const bedTemp = isNaN(status.bedTemperature) ? 0 : Math.round(status.bedTemperature);
  const bedTarget = isNaN(status.bedTargetTemperature) ? 0 : Math.round(status.bedTargetTemperature);
  const extruderTemp = isNaN(status.nozzleTemperature) ? 0 : Math.round(status.nozzleTemperature);
  const extruderTarget = isNaN(status.nozzleTargetTemperature) ? 0 : Math.round(status.nozzleTargetTemperature);

  setTextContent('bed-temp', `${bedTemp}°C / ${bedTarget}°C`);
  setTextContent('extruder-temp', `${extruderTemp}°C / ${extruderTarget}°C`);

  if (status.jobName) {
    setTextContent('current-job', status.jobName);

    const progress = isNaN(status.progress) ? 0 : status.progress;
    const progressPercent = progress <= 1 ? Math.round(progress * 100) : Math.round(progress);
    setTextContent('progress-percentage', `${progressPercent}%`);

    const progressBar = $('progress-bar') as HTMLProgressElement | null;
    if (progressBar) {
      progressBar.value = progressPercent;
    }

    if (
      status.currentLayer !== undefined &&
      status.totalLayers !== undefined &&
      !isNaN(status.currentLayer) &&
      !isNaN(status.totalLayers)
    ) {
      setTextContent('layer-info', `${status.currentLayer} / ${status.totalLayers}`);
    } else {
      setTextContent('layer-info', '-- / --');
    }

    // Elapsed — prefer seconds precision
    if (status.elapsedTimeSeconds !== undefined && !isNaN(status.elapsedTimeSeconds)) {
      setTextContent('elapsed-time', formatElapsedSeconds(status.elapsedTimeSeconds));
    } else if (status.timeElapsed !== undefined && !isNaN(status.timeElapsed)) {
      setTextContent('elapsed-time', formatTime(status.timeElapsed));
    } else {
      setTextContent('elapsed-time', '--:--');
    }

    // ETA — prefer firmware string
    if (status.formattedEta && status.formattedEta !== '--:--') {
      setTextContent('time-remaining', formatETAFromString(status.formattedEta));
    } else if (status.timeRemaining !== undefined && !isNaN(status.timeRemaining)) {
      setTextContent('time-remaining', formatETA(status.timeRemaining));
    } else {
      setTextContent('time-remaining', '--:--');
    }

    // Weight and length as separate fields
    if (status.estimatedWeight !== undefined && !isNaN(status.estimatedWeight)) {
      setTextContent('job-weight', `${Math.round(status.estimatedWeight)}g`);
    } else {
      setTextContent('job-weight', '--');
    }
    if (status.estimatedLength !== undefined && !isNaN(status.estimatedLength)) {
      setTextContent('job-length', `${status.estimatedLength.toFixed(1)}m`);
    } else {
      setTextContent('job-length', '--');
    }
    updateModelPreview(status.thumbnailData);
  } else {
    setTextContent('current-job', 'No active job');
    setTextContent('progress-percentage', '0%');
    const progressBar = $('progress-bar') as HTMLProgressElement | null;
    if (progressBar) {
      progressBar.value = 0;
    }
    setTextContent('layer-info', '-- / --');
    setTextContent('elapsed-time', '--:--');
    setTextContent('time-remaining', '--:--');
    setTextContent('job-weight', '--');
    setTextContent('job-length', '--');
    updateModelPreview(null);
  }

  updateButtonStates(status.printerState || 'Unknown');
  updateFiltrationStatus(status.filtrationMode);
  updateCreator5TemperatureCard(status);
  updateTvocDisplay(status);
}

/** `<current>°C / <target>°C`, guarding against NaN readings. */
function formatTempPair(current: number, target: number): string {
  const c = isNaN(current) ? 0 : Math.round(current);
  const t = isNaN(target) ? 0 : Math.round(target);
  return `${c}°C / ${t}°C`;
}

/** Whether heater Set/Off controls should be disabled for the given printer state. */
function isHeaterControlDisabled(printerState: string): boolean {
  const isPrintingActive =
    printerState === 'Printing' ||
    printerState === 'Paused' ||
    printerState === 'Calibrating' ||
    printerState === 'Heating' ||
    printerState === 'Pausing';
  const isBusy = printerState === 'Busy' || printerState === 'Error';
  return isPrintingActive || isBusy;
}

/**
 * Render the Creator 5 multi-tool temperature card (per-tool heaters + bed +
 * chamber). Self-gates: shows an "unavailable" message when the printer does not
 * report per-tool temperatures. No-ops when the card is not mounted (non-C5).
 */
export function updateCreator5TemperatureCard(status: PrinterStatus | null): void {
  const panel = document.querySelector<HTMLElement>('[data-component-id="creator5-temperature"]');
  if (!panel) {
    return;
  }

  const unavailable = $('c5-temps-unavailable');
  const body = $('c5-temps-body');
  const toolGrid = $('c5-tool-grid');
  const chamberRow = $('c5-chamber-row');

  const toolTemps = status?.toolTemps ?? [];
  const available = Boolean(status) && toolTemps.length > 0;

  unavailable?.classList.toggle('hidden', available);
  body?.classList.toggle('hidden', !available);

  if (!available || !status) {
    return;
  }

  // Rebuild the per-tool rows only when the tool count changes.
  if (toolGrid) {
    const existingRows = toolGrid.querySelectorAll('.temp-row').length;
    if (existingRows !== toolTemps.length) {
      toolGrid.innerHTML = toolTemps
        .map(
          (_, i) => `
        <div class="temp-row">
          <span>T${i + 1}: <span class="c5-tool-reading" data-tool-reading="${i}">--°C / --°C</span></span>
          <div class="temp-buttons">
            <button class="temp-btn" data-c5-action="set" data-heater="tool" data-tool="${i}">Set</button>
            <button class="temp-btn" data-c5-action="off" data-heater="tool" data-tool="${i}">Off</button>
          </div>
        </div>`
        )
        .join('');
    }
    toolTemps.forEach((tool, i) => {
      const reading = toolGrid.querySelector(`[data-tool-reading="${i}"]`);
      if (reading) {
        reading.textContent = formatTempPair(tool.current, tool.target);
      }
    });
  }

  setTextContent('c5-bed-temp', formatTempPair(status.bedTemperature, status.bedTargetTemperature));

  const hasChamber = Boolean(status.hasChamberControl) && status.chamberTemperature !== undefined;
  chamberRow?.classList.toggle('hidden', !hasChamber);
  if (hasChamber) {
    setTextContent(
      'c5-chamber-temp',
      formatTempPair(status.chamberTemperature ?? 0, status.chamberTargetTemperature ?? 0)
    );
  }

  const disabled = isHeaterControlDisabled(status.printerState || 'Unknown');
  panel.querySelectorAll<HTMLButtonElement>('button[data-c5-action]').forEach((btn) => {
    btn.disabled = disabled;
  });
}

/**
 * Populate the read-only TVOC air-quality reading and gate the filtration
 * controls. Every printer that mounts this card (filtration-capable printers and
 * the Creator 5 Pro) shows both its filtration mode/controls and its TVOC level.
 * The Creator 5 Pro reports TVOC but cannot switch filtration modes, so its
 * control buttons are shown but disabled.
 */
export function updateTvocDisplay(status: PrinterStatus | null): void {
  const tvocInfo = $('tvoc-info');
  const filtrationSection = $('filtration-section');
  if (!tvocInfo && !filtrationSection) {
    return;
  }

  // The card itself is only mounted for filtration-capable printers or the
  // Creator 5 Pro (see layout-theme component gating), so whenever it exists we
  // show both the filtration controls and the TVOC readout together.
  filtrationSection?.classList.remove('hidden');
  tvocInfo?.classList.remove('hidden');

  const tvoc = status?.tvocLevel;
  setTextContent('tvoc-status', tvoc !== undefined && !isNaN(tvoc) ? `${Math.round(tvoc)}` : '--');

  // The Creator 5 Pro exposes a TVOC sensor but no filtration-mode control.
  const isCreator5Pro = Boolean(state.printerFeatures?.isCreator5Pro);
  for (const id of ['btn-external-filtration', 'btn-internal-filtration', 'btn-no-filtration']) {
    const btn = $(id) as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = isCreator5Pro;
    }
  }
}

export function updateFiltrationStatus(mode?: 'external' | 'internal' | 'none'): void {
  if (!mode) {
    return;
  }

  const filtrationStatusEl = $('filtration-status');
  if (filtrationStatusEl) {
    const modeLabels: Record<typeof mode, string> = {
      external: 'External',
      internal: 'Internal',
      none: 'Off',
    };
    filtrationStatusEl.textContent = modeLabels[mode] || 'Off';
  }

  const externalBtn = $('btn-external-filtration') as HTMLButtonElement | null;
  const internalBtn = $('btn-internal-filtration') as HTMLButtonElement | null;
  const offBtn = $('btn-no-filtration') as HTMLButtonElement | null;

  externalBtn?.classList.remove('active');
  internalBtn?.classList.remove('active');
  offBtn?.classList.remove('active');

  switch (mode) {
    case 'external':
      externalBtn?.classList.add('active');
      break;
    case 'internal':
      internalBtn?.classList.add('active');
      break;
    case 'none':
      offBtn?.classList.add('active');
      break;
  }
}

export function updateModelPreview(thumbnailData?: string | null): void {
  const previewContainer = document.querySelector<HTMLElement>('[data-component-id="model-preview"] .panel-content');
  if (!previewContainer) {
    return;
  }

  if (thumbnailData) {
    previewContainer.innerHTML = '';

    const img = document.createElement('img');
    const imageUrl = thumbnailData.startsWith('data:image/') ? thumbnailData : `data:image/png;base64,${thumbnailData}`;

    img.src = imageUrl;
    img.alt = 'Model preview';
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';

    img.onerror = () => {
      console.error('Failed to load model preview. Image URL length:', imageUrl.length);
      previewContainer.innerHTML = '<div class="no-preview">Preview load failed</div>';
    };

    previewContainer.appendChild(img);
    return;
  }

  previewContainer.innerHTML = '<div class="no-preview">No preview available</div>';
}

export function updateSpoolmanPanelState(): void {
  const disabled = $('spoolman-disabled');
  const noSpool = $('spoolman-no-spool');
  const active = $('spoolman-active');

  if (!disabled || !noSpool || !active) {
    return;
  }

  if (!isSpoolmanAvailableForCurrentContext()) {
    showElement('spoolman-disabled');
    hideElement('spoolman-no-spool');
    hideElement('spoolman-active');

    const disabledMessage = $('spoolman-disabled-message');
    if (disabledMessage) {
      const reason =
        state.spoolmanConfig?.disabledReason ||
        (state.spoolmanConfig?.enabled
          ? 'Spoolman is not available for this printer'
          : 'Spoolman integration is disabled');
      disabledMessage.textContent = reason;
    }
    return;
  }

  if (!state.activeSpool) {
    hideElement('spoolman-disabled');
    showElement('spoolman-no-spool');
    hideElement('spoolman-active');
    return;
  }

  hideElement('spoolman-disabled');
  hideElement('spoolman-no-spool');
  showElement('spoolman-active');

  const colorIndicator = $('spool-color');
  const spoolName = $('spool-name');
  const spoolMeta = $('spool-meta');
  const spoolRemaining = $('spool-remaining');

  if (colorIndicator) {
    colorIndicator.style.backgroundColor = state.activeSpool.colorHex;
  }

  if (spoolName) {
    spoolName.textContent = state.activeSpool.name;
  }

  if (spoolMeta) {
    const parts: string[] = [];
    if (state.activeSpool.vendor) {
      parts.push(state.activeSpool.vendor);
    }
    if (state.activeSpool.material) {
      parts.push(state.activeSpool.material);
    }
    spoolMeta.textContent = parts.join(' • ') || '--';
  }

  if (spoolRemaining) {
    const remaining =
      state.spoolmanConfig?.updateMode === 'weight'
        ? `${state.activeSpool.remainingWeight.toFixed(0)}g`
        : `${(state.activeSpool.remainingLength / 1000).toFixed(1)}m`;
    spoolRemaining.textContent = remaining;
  }
}

function updateButtonStates(printerState: string): void {
  const isPrintingActive =
    printerState === 'Printing' ||
    printerState === 'Paused' ||
    printerState === 'Calibrating' ||
    printerState === 'Heating' ||
    printerState === 'Pausing';

  const isReadyForNewJob = printerState === 'Ready' || printerState === 'Completed' || printerState === 'Cancelled';

  const canControlJob =
    printerState === 'Printing' ||
    printerState === 'Paused' ||
    printerState === 'Heating' ||
    printerState === 'Calibrating';

  const isBusy = printerState === 'Busy' || printerState === 'Error';

  const pauseBtn = $('btn-pause') as HTMLButtonElement | null;
  const resumeBtn = $('btn-resume') as HTMLButtonElement | null;
  const cancelBtn = $('btn-cancel') as HTMLButtonElement | null;

  if (pauseBtn) pauseBtn.disabled = printerState !== 'Printing';
  if (resumeBtn) resumeBtn.disabled = printerState !== 'Paused';
  if (cancelBtn) cancelBtn.disabled = !canControlJob;

  const recentBtn = $('btn-start-recent') as HTMLButtonElement | null;
  const localBtn = $('btn-start-local') as HTMLButtonElement | null;
  const homeAxesBtn = $('btn-home-axes') as HTMLButtonElement | null;

  if (recentBtn) recentBtn.disabled = !isReadyForNewJob;
  if (localBtn) localBtn.disabled = !isReadyForNewJob;
  if (homeAxesBtn) homeAxesBtn.disabled = isPrintingActive;
  const clearStatusBtn = $('btn-clear-status') as HTMLButtonElement | null;
  if (clearStatusBtn) clearStatusBtn.disabled = isPrintingActive;

  const bedSetBtn = $('btn-bed-set') as HTMLButtonElement | null;
  const bedOffBtn = $('btn-bed-off') as HTMLButtonElement | null;
  const extruderSetBtn = $('btn-extruder-set') as HTMLButtonElement | null;
  const extruderOffBtn = $('btn-extruder-off') as HTMLButtonElement | null;

  const tempButtonsDisabled = isPrintingActive || isBusy;
  if (bedSetBtn) bedSetBtn.disabled = tempButtonsDisabled;
  if (bedOffBtn) bedOffBtn.disabled = tempButtonsDisabled;
  if (extruderSetBtn) extruderSetBtn.disabled = tempButtonsDisabled;
  if (extruderOffBtn) extruderOffBtn.disabled = tempButtonsDisabled;
}

function updatePrinterStateCard(status: PrinterStatus | null): void {
  if (status?.printerState) {
    setTextContent('printer-status', status.printerState);
  } else {
    setTextContent('printer-status', 'Unknown');
  }

  if (status?.cumulativePrintTime !== undefined) {
    const formattedTime = formatLifetimePrintTime(status.cumulativePrintTime);
    setTextContent('lifetime-print-time', formattedTime);
  } else {
    setTextContent('lifetime-print-time', '--');
  }

  if (status?.cumulativeFilament !== undefined) {
    const formattedFilament = formatLifetimeFilament(status.cumulativeFilament);
    setTextContent('lifetime-filament', formattedFilament);
  } else {
    setTextContent('lifetime-filament', '--');
  }
}
