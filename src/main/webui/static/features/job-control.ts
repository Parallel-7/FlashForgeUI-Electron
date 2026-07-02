/**
 * @fileoverview Printer job control helpers and event wiring for the WebUI client.
 *
 * Handles printer command dispatch, feature loading, and job start workflow
 * orchestration (including AD5X material matching hand-off). Also wires up the
 * core control panel buttons plus the WebSocket keep-alive ping so `app.ts`
 * can focus purely on high-level initialization.
 */

import type {
  MaterialMapping,
  PendingJobStart,
  PrinterCommandResponse,
  PrinterFeaturesResponse,
  PrintJobStartResponse,
} from '../app.js';
import { getCurrentSettings, state } from '../core/AppState.js';
import { apiRequest, sendCommand } from '../core/Transport.js';
import { $, hideElement, showToast } from '../shared/dom.js';
import { isAD5XJobFile } from '../shared/formatting.js';
import { loadFileList, showTemperatureDialog, type TemperatureTarget } from '../ui/dialogs.js';
import { applySettings, refreshSettingsUI } from './layout-theme.js';
import { openMaterialMatchingModal } from './material-matching.js';

const KEEP_ALIVE_INTERVAL_MS = 30000;
let keepAliveTimer: number | null = null;

function hasMaterialStationSupport(): boolean {
  return Boolean(state.printerFeatures?.hasMaterialStation);
}

export async function sendPrinterCommand(endpoint: string, data?: unknown): Promise<void> {
  if (state.authRequired && !state.authToken) {
    showToast('Not authenticated', 'error');
    return;
  }

  try {
    const result = await apiRequest<PrinterCommandResponse>(`/api/printer/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (result.success) {
      showToast(result.message || 'Command sent', 'success');
    } else {
      showToast(result.error || 'Command failed', 'error');
    }
  } catch (error) {
    console.error('Command error:', error);
    showToast('Failed to send command', 'error');
  }
}

export async function loadPrinterFeatures(): Promise<void> {
  if (state.authRequired && !state.authToken) {
    return;
  }

  try {
    const result = await apiRequest<PrinterFeaturesResponse>('/api/printer/features');

    if (result.success && result.features) {
      state.printerFeatures = result.features;
      updateFeatureVisibility();

      const settings = getCurrentSettings();
      applySettings(settings);
      refreshSettingsUI(settings);
    }
  } catch (error) {
    console.error('Failed to load printer features:', error);
  }
}

export function updateFeatureVisibility(): void {
  if (!state.printerFeatures) {
    return;
  }

  const ledOn = $('btn-led-on') as HTMLButtonElement | null;
  const ledOff = $('btn-led-off') as HTMLButtonElement | null;
  const ledEnabled = state.printerFeatures.hasLED || state.printerFeatures.ledUsesLegacyAPI || false;

  if (ledOn) {
    ledOn.disabled = !ledEnabled;
  }
  if (ledOff) {
    ledOff.disabled = !ledEnabled;
  }
}

interface JobStartOptions {
  filename: string;
  leveling: boolean;
  startNow: boolean;
  materialMappings?: MaterialMapping[];
}

export async function startPrintJob(): Promise<void> {
  if (!state.selectedFile) {
    showToast('Select a file before starting a job', 'error');
    return;
  }

  if (state.authRequired && !state.authToken) {
    showToast('Not authenticated', 'error');
    return;
  }

  const autoLevel = ($('auto-level') as HTMLInputElement | null)?.checked ?? false;
  const startNow = ($('start-now') as HTMLInputElement | null)?.checked ?? true;
  const jobInfo = state.jobMetadata.get(state.selectedFile);

  if (startNow && hasMaterialStationSupport() && isAD5XJobFile(jobInfo)) {
    const pendingJob: PendingJobStart = {
      filename: state.selectedFile,
      leveling: autoLevel,
      startNow,
      job: jobInfo,
    };

    state.pendingJobStart = pendingJob;
    await openMaterialMatchingModal(pendingJob);
    return;
  }

  const success = await sendJobStartRequest({
    filename: state.selectedFile,
    leveling: autoLevel,
    startNow,
  });

  if (success) {
    hideElement('file-modal');
    state.pendingJobStart = null;
  }
}

export async function sendJobStartRequest(options: JobStartOptions): Promise<boolean> {
  if (state.authRequired && !state.authToken) {
    showToast('Not authenticated', 'error');
    return false;
  }

  try {
    const result = await apiRequest<PrintJobStartResponse>('/api/jobs/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: options.filename,
        leveling: options.leveling,
        startNow: options.startNow,
        materialMappings: options.materialMappings,
      }),
    });

    if (result.success) {
      showToast(result.message || 'Print job started', 'success');
      return true;
    }

    showToast(result.error || 'Failed to start print', 'error');
    return false;
  } catch (error) {
    console.error('Failed to start print:', error);
    showToast('Failed to start print job', 'error');
    return false;
  }
}

/** Resolve a Creator 5 temperature-card button to its heater target. */
function resolveHeaterTarget(button: HTMLButtonElement): TemperatureTarget | null {
  const heater = button.dataset.heater;
  if (heater === 'bed') {
    return { kind: 'bed' };
  }
  if (heater === 'chamber') {
    return { kind: 'chamber' };
  }
  if (heater === 'tool') {
    const index = Number.parseInt(button.dataset.tool ?? '', 10);
    if (Number.isInteger(index) && index >= 0) {
      return { kind: 'tool', index };
    }
  }
  return null;
}

/** Handle a Set/Off click on the Creator 5 multi-tool temperature card. */
async function handleCreator5TempButton(action: 'set' | 'off', button: HTMLButtonElement): Promise<void> {
  const target = resolveHeaterTarget(button);
  if (!target) {
    return;
  }

  if (action === 'set') {
    showTemperatureDialog(target);
    return;
  }

  const endpoint =
    target.kind === 'tool' ? `temperature/tool/${target.index}/off` : `temperature/${target.kind}/off`;
  await sendPrinterCommand(endpoint);
}

export function setupJobControlEventHandlers(): void {
  const containers = [$('webui-grid-desktop'), $('webui-grid-mobile')];

  containers.forEach((container) => {
    if (!container) {
      return;
    }

    container.addEventListener('click', async (event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button') as HTMLButtonElement | null;
      if (!button || button.disabled) {
        return;
      }

      // Creator 5 multi-tool card buttons are dynamic (per-tool), so they are keyed
      // by data attributes rather than fixed ids.
      const c5Action = button.dataset.c5Action;
      if (c5Action === 'set' || c5Action === 'off') {
        await handleCreator5TempButton(c5Action, button);
        event.preventDefault();
        return;
      }

      let handled = true;
      switch (button.id) {
        case 'btn-led-on':
          await sendPrinterCommand('control/led-on');
          break;
        case 'btn-led-off':
          await sendPrinterCommand('control/led-off');
          break;
        case 'btn-clear-status':
          await sendPrinterCommand('control/clear-status');
          break;
        case 'btn-home-axes':
          await sendPrinterCommand('control/home');
          break;
        case 'btn-pause':
          await sendPrinterCommand('control/pause');
          break;
        case 'btn-resume':
          await sendPrinterCommand('control/resume');
          break;
        case 'btn-cancel':
          await sendPrinterCommand('control/cancel');
          break;
        case 'btn-bed-set':
          showTemperatureDialog({ kind: 'bed' });
          break;
        case 'btn-bed-off':
          await sendPrinterCommand('temperature/bed/off');
          break;
        case 'btn-extruder-set':
          showTemperatureDialog({ kind: 'extruder' });
          break;
        case 'btn-extruder-off':
          await sendPrinterCommand('temperature/extruder/off');
          break;
        case 'btn-start-recent':
          await loadFileList('recent');
          break;
        case 'btn-start-local':
          await loadFileList('local');
          break;
        case 'btn-refresh':
          sendCommand({ command: 'REQUEST_STATUS' });
          break;
        case 'btn-external-filtration':
          await sendPrinterCommand('filtration/external');
          break;
        case 'btn-internal-filtration':
          await sendPrinterCommand('filtration/internal');
          break;
        case 'btn-no-filtration':
          await sendPrinterCommand('filtration/off');
          break;
        default:
          handled = false;
          break;
      }

      if (handled) {
        event.preventDefault();
      }
    });
  });

  if (keepAliveTimer === null) {
    keepAliveTimer = window.setInterval(() => {
      if (state.isConnected && state.websocket && state.websocket.readyState === WebSocket.OPEN) {
        sendCommand({ command: 'PING' });
      }
    }, KEEP_ALIVE_INTERVAL_MS);
  }
}
