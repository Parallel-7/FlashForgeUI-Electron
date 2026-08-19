/**
 * @fileoverview Browser job uploader - the WebUI port of the desktop Upload Job dialog.
 *
 * Reproduces the desktop flow (`src/renderer/src/ui/job-uploader/`) end to end:
 * pick a file, show its slicer metadata, route material-station printers
 * (AD5X, Creator 5 / 5 Pro) through material matching for 3MF files, then
 * upload with a progress overlay and auto-close on success.
 *
 * The one unavoidable difference is where the file lives. The desktop hands the
 * backend a path from a native dialog; the browser has to ship the bytes to the
 * WebUI server first (POST /api/jobs/upload/stage), which stages them and parses
 * the metadata. Everything after that mirrors the desktop step for step,
 * including the simulated upload progress the desktop's main process emits.
 *
 * Key exports:
 * - setupJobUpload(): wire the dialog's controls (called once at startup)
 * - openJobUploadModal(): open a freshly reset dialog
 */

import type {
  AD5XToolData,
  JobUploadStageResponse,
  JobUploadStartResponse,
  MaterialMapping,
  PendingJobStart,
  UploadFilamentInfo,
  UploadJobMetadata,
  UploadSliceWarning,
  WebUIJobFile,
} from '../app.js';
import { state } from '../core/AppState.js';
import { apiRequest, buildAuthHeaders } from '../core/Transport.js';
import { $, hideElement, showElement, showToast } from '../shared/dom.js';
import { openMaterialMatchingModal } from './material-matching.js';

/** Extensions the desktop file dialog offers, and all the staging route accepts. */
const ALLOWED_EXTENSIONS = ['.gcode', '.gx', '.3mf'];

interface UploadProgressStep {
  readonly percentage: number;
  readonly status: string;
}

/**
 * Progress steps emitted by the desktop main process during a material-station
 * upload (`upload-file-ad5x` in job-handlers.ts). Replayed here so both surfaces
 * show the same sequence; neither is real progress - ff-api reports none.
 */
const MATERIAL_STATION_PROGRESS_STEPS: readonly UploadProgressStep[] = [
  { percentage: 15, status: 'Validating material mappings...' },
  { percentage: 30, status: 'Connecting to material station...' },
  { percentage: 50, status: 'Uploading file to printer...' },
  { percentage: 70, status: 'Processing 3MF data...' },
  { percentage: 90, status: 'Finalizing upload...' },
];
const MATERIAL_STATION_STEP_DELAY_MS = 300;

/** Progress steps emitted by the desktop `uploader:upload-job` handler. */
const STANDARD_PROGRESS_STEPS: readonly UploadProgressStep[] = [10, 30, 50, 70, 90].map((percentage) => ({
  percentage,
  status: 'Uploading file...',
}));
const STANDARD_STEP_DELAY_MS = 200;

/** Delay before the dialog closes itself after a successful upload. */
const AUTO_CLOSE_DELAY_MS = 2000;

/** How long a failure stays on the progress overlay before the alert. */
const ERROR_DISPLAY_DELAY_MS = 5000;

let handlersRegistered = false;

/** Handle for the file currently staged on the server, if any. */
let stagedUploadId: string | null = null;
let stagedFileName: string | null = null;

/** Mappings confirmed in the material matching modal, applied on upload. */
let savedMaterialMappings: MaterialMapping[] | null = null;

/** Guards against a second upload while one is in flight. */
let uploadInFlight = false;

/** Cancels the auto-close/error timers when the dialog is reopened. */
let pendingTimer: number | null = null;

function hasMaterialStationSupport(): boolean {
  return Boolean(state.printerFeatures?.hasMaterialStation);
}

function is3MF(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.3mf');
}

function clearPendingTimer(): void {
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

// ============================================================================
// DIALOG LIFECYCLE
// ============================================================================

export function openJobUploadModal(): void {
  if (state.authRequired && !state.authToken) {
    showToast('Not authenticated', 'error');
    return;
  }

  clearPendingTimer();
  void discardStagedFile();
  savedMaterialMappings = null;
  uploadInFlight = false;

  const input = $('job-upload-file-input') as HTMLInputElement | null;
  if (input) {
    input.value = '';
  }

  setFilePathDisplay('No file selected...', '');
  resetMetadata();
  setOkButtonState(false);
  showLoading(false);
  showUploadProgress(false);
  showElement('job-upload-modal');
}

function closeJobUploadModal(): void {
  clearPendingTimer();
  void discardStagedFile();
  savedMaterialMappings = null;
  uploadInFlight = false;
  showLoading(false);
  showUploadProgress(false);
  hideElement('job-upload-modal');
}

/** Tell the server to drop the scratch file backing the current selection. */
async function discardStagedFile(): Promise<void> {
  const uploadId = stagedUploadId;
  stagedUploadId = null;
  stagedFileName = null;

  if (!uploadId) {
    return;
  }

  try {
    await apiRequest('/api/jobs/upload/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId }),
    });
  } catch (error) {
    console.error('Failed to discard staged upload:', error);
  }
}

// ============================================================================
// FILE SELECTION
// ============================================================================

async function handleFileSelected(file: File | null): Promise<void> {
  // A new selection invalidates whatever the previous one produced.
  savedMaterialMappings = null;
  await discardStagedFile();

  if (!file) {
    setFilePathDisplay('No file selected...', '');
    resetMetadata();
    setOkButtonState(false);
    showLoading(false);
    return;
  }

  setFilePathDisplay(file.name, file.name);
  resetMetadata();
  setOkButtonState(false);

  if (!ALLOWED_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension))) {
    setFilePathDisplay('Unsupported file type', '');
    alert('Select a .gcode, .gx or .3mf job file.');
    return;
  }

  // Material-station printers (AD5X, Creator 5 / 5 Pro) only accept 3MF files,
  // which carry the per-tool material data the firmware needs for matching. The
  // desktop reports this after parsing; the browser checks first so a rejected
  // file is never transferred to the server.
  if (hasMaterialStationSupport() && !is3MF(file.name)) {
    const fileExtension = file.name.split('.').pop()?.toUpperCase() || 'unknown';
    setFilePathDisplay('Unsupported file type for this printer', '');
    alert(
      `This printer only supports 3MF files.\n\nThe selected ${fileExtension} file cannot be uploaded to this printer.\n\nPlease select a 3MF file sliced for this printer.`
    );
    return;
  }

  showLoading(true, 'Uploading file... 0%');

  let staged: JobUploadStageResponse;
  try {
    staged = await stageFile(file);
  } catch (error) {
    showLoading(false);
    const message = error instanceof Error ? error.message : 'Unknown error';
    setFilePathDisplay(`Error parsing file: ${message}`, '');
    resetMetadata();
    setOkButtonState(false);
    alert(`Could not parse file metadata:\n${message}`);
    return;
  }

  showLoading(false);

  if (!staged.success || !staged.uploadId || !staged.metadata) {
    const message = staged.error || 'Unknown error';
    setFilePathDisplay(`Error parsing file: ${message}`, '');
    resetMetadata();
    setOkButtonState(false);
    alert(`Could not parse file metadata:\n${message}`);
    return;
  }

  stagedUploadId = staged.uploadId;
  stagedFileName = staged.fileName ?? file.name;

  populateMetadata(staged.metadata);

  if (!staged.requiresMaterialMatching) {
    setOkButtonState(true);
    return;
  }

  const filaments = staged.metadata.filaments;
  if (filaments.length === 0) {
    // No filament data - warn and fall back to the plain upload, exactly as the
    // desktop does. The OK button is enabled so the user can still proceed.
    showNoFilamentDataWarning(stagedFileName);
    setOkButtonState(true);
    return;
  }

  // The desktop always shows material matching for a material-station 3MF,
  // single-colour files included.
  const mappings = await requestMaterialMappings(stagedFileName, filaments);
  if (mappings) {
    savedMaterialMappings = mappings;
    setOkButtonState(true);
  } else {
    setOkButtonState(false);
  }
}

/**
 * Ship the file to the WebUI server and get back a staging handle plus metadata.
 *
 * Uses XHR rather than fetch so the transfer can drive the loading overlay - on
 * a phone over Wi-Fi a large 3MF is the slowest part of the whole flow, and the
 * desktop equivalent (a local disk read) is instant.
 */
function stageFile(file: File): Promise<JobUploadStageResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `/api/jobs/upload/stage?filename=${encodeURIComponent(file.name)}`);

    const headers = buildAuthHeaders({ 'Content-Type': 'application/octet-stream' });
    Object.entries(headers).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) {
        return;
      }
      const percentage = Math.round((event.loaded / event.total) * 100);
      showLoading(true, percentage >= 100 ? 'Parsing file...' : `Uploading file... ${percentage}%`);
    });

    request.upload.addEventListener('load', () => {
      showLoading(true, 'Parsing file...');
    });

    request.addEventListener('load', () => {
      if (!request.responseText) {
        reject(new Error(`Server returned ${request.status}`));
        return;
      }
      try {
        resolve(JSON.parse(request.responseText) as JobUploadStageResponse);
      } catch {
        reject(new Error('Failed to parse server response'));
      }
    });

    request.addEventListener('error', () => reject(new Error('Network error while uploading the file')));
    request.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    request.send(file);
  });
}

/** Show the desktop's "no filament data" warning for a 3MF that carries none. */
function showNoFilamentDataWarning(fileName: string): void {
  alert(
    `The 3MF file "${fileName}" does not contain filament data.\n\nThis may happen with:` +
      '\n• Files not sliced for multi-color printing' +
      '\n• Older slicer versions' +
      '\n• Corrupted or incomplete files' +
      '\n\nThe file will be uploaded using the standard upload process.'
  );
}

// ============================================================================
// MATERIAL MATCHING
// ============================================================================

/**
 * Convert parsed filament entries into the tool data the material matching
 * modal expects, mirroring `convertFilamentsToToolData` in the desktop renderer.
 */
function convertFilamentsToToolData(filaments: readonly UploadFilamentInfo[]): AD5XToolData[] {
  return filaments.map((filament, index) => ({
    toolId: index,
    materialName: filament.type || 'Unknown',
    materialColor: filament.color || '#FFFFFF',
    filamentWeight: Number.parseFloat(filament.usedG || '0') || 0,
    slotId: 0,
  }));
}

/**
 * Open the shared material matching modal for a file that is only staged, and
 * resolve with the confirmed mappings (or null if the user backed out).
 */
function requestMaterialMappings(
  fileName: string,
  filaments: readonly UploadFilamentInfo[]
): Promise<MaterialMapping[] | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (mappings: MaterialMapping[] | null): void => {
      if (!settled) {
        settled = true;
        resolve(mappings);
      }
    };

    const job: WebUIJobFile = {
      fileName,
      displayName: fileName,
      metadataType: 'ad5x',
      toolCount: filaments.length,
      toolDatas: convertFilamentsToToolData(filaments),
    };

    const pending: PendingJobStart = {
      filename: fileName,
      leveling: getAutoLevel(),
      startNow: getStartNow(),
      job,
    };

    void openMaterialMatchingModal(pending, {
      onConfirm: async (mappings) => {
        settle(mappings);
        return true;
      },
      onCancel: () => settle(null),
    });
  });
}

// ============================================================================
// UPLOAD
// ============================================================================

async function handleUpload(): Promise<void> {
  if (!stagedUploadId || !stagedFileName || uploadInFlight) {
    return;
  }

  const fileName = stagedFileName;
  const useMaterialStationUpload = hasMaterialStationSupport() && is3MF(fileName);

  if (hasMaterialStationSupport() && !is3MF(fileName)) {
    // Unreachable via the UI (selection is blocked earlier); kept as the desktop
    // renderer keeps its equivalent safety check.
    alert('This printer only supports 3MF files. Please select a valid 3MF file.');
    return;
  }

  uploadInFlight = true;
  setOkButtonState(false);

  const steps = useMaterialStationUpload ? MATERIAL_STATION_PROGRESS_STEPS : STANDARD_PROGRESS_STEPS;
  const delay = useMaterialStationUpload ? MATERIAL_STATION_STEP_DELAY_MS : STANDARD_STEP_DELAY_MS;

  updateUploadProgress(0, useMaterialStationUpload ? 'Preparing AD5X upload...' : 'Preparing upload...');
  const stopSimulation = simulateProgress(steps, delay);

  let result: JobUploadStartResponse;
  try {
    result = await apiRequest<JobUploadStartResponse>('/api/jobs/upload/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId: stagedUploadId,
        startNow: getStartNow(),
        autoLevel: getAutoLevel(),
        materialMappings: savedMaterialMappings ?? undefined,
      }),
    });
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  } finally {
    stopSimulation();
  }

  // The server discards the staged file once it has handed it to the printer,
  // whether or not the printer accepted it.
  stagedUploadId = null;
  savedMaterialMappings = null;
  uploadInFlight = false;

  handleUploadComplete(result, fileName);
}

/**
 * Replay a fixed progress sequence while the request is in flight. Returns a
 * function that stops the replay.
 */
function simulateProgress(steps: readonly UploadProgressStep[], delayMs: number): () => void {
  let index = 0;
  const timer = window.setInterval(() => {
    const step = steps[index];
    if (!step) {
      window.clearInterval(timer);
      return;
    }
    index += 1;
    updateUploadProgress(step.percentage, step.status);
  }, delayMs);

  return () => window.clearInterval(timer);
}

function handleUploadComplete(result: JobUploadStartResponse, fileName: string): void {
  clearPendingTimer();

  if (result.success) {
    updateUploadProgress(100, `Successfully uploaded ${result.fileName || fileName}`);
    pendingTimer = window.setTimeout(() => {
      pendingTimer = null;
      closeJobUploadModal();
    }, AUTO_CLOSE_DELAY_MS);
    return;
  }

  const message = result.error || 'Unknown error';
  updateUploadProgress(0, `Upload failed: ${message}`);
  setOkButtonState(false);
  setFilePathDisplay('No file selected...', '');
  resetMetadata();

  const input = $('job-upload-file-input') as HTMLInputElement | null;
  if (input) {
    input.value = '';
  }

  pendingTimer = window.setTimeout(() => {
    pendingTimer = null;
    showUploadProgress(false);
    alert(`Upload failed: ${message}`);
  }, ERROR_DISPLAY_DELAY_MS);
}

// ============================================================================
// METADATA RENDERING
// ============================================================================

/** Format seconds into a human-readable duration, matching the desktop dialog. */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}

function setMetaText(id: string, value: string): void {
  const element = $(id);
  if (element) {
    element.textContent = value;
  }
}

function populateMetadata(metadata: UploadJobMetadata): void {
  setMetaText('job-upload-meta-printer', metadata.printerModel || '-');
  setMetaText('job-upload-meta-filament-type', metadata.filamentType || '-');

  // Length carries the row; weight is appended only when a length is known, so
  // the dialog never shows a weight with no context (as on desktop).
  let filamentText = '-';
  if (metadata.filamentLengthM !== null) {
    filamentText = `${metadata.filamentLengthM.toFixed(2)} m`;
    if (metadata.filamentWeightG !== null) {
      filamentText += ` • ${metadata.filamentWeightG.toFixed(2)} g`;
    }
  }
  setMetaText('job-upload-meta-filament-len', filamentText);

  setMetaText('job-upload-meta-slicer-name', metadata.slicerName || '-');
  setMetaText('job-upload-meta-slicer-ver', metadata.slicerVersion || '-');
  setMetaText('job-upload-meta-slice-date', metadata.sliceDate || '-');
  setMetaText('job-upload-meta-slice-time', metadata.sliceTime || '-');
  setMetaText('job-upload-meta-eta', metadata.printEta || '-');
  setMetaText(
    'job-upload-meta-first-layer-time',
    metadata.firstLayerTime !== null ? formatDuration(metadata.firstLayerTime) : '-'
  );
  setMetaText('job-upload-meta-layer-height', metadata.layerHeight !== null ? `${metadata.layerHeight} mm` : '-');
  setMetaText('job-upload-meta-infill', metadata.infillDensity !== null ? `${metadata.infillDensity}%` : '-');
  setMetaText('job-upload-meta-layers', metadata.layerCount !== null ? metadata.layerCount.toString() : '-');
  setMetaText('job-upload-meta-support', metadata.supportUsed === null ? '-' : metadata.supportUsed ? 'Yes' : 'No');

  renderWarnings(metadata.warnings);
  renderThumbnail(metadata.thumbnail);
}

function renderWarnings(warnings: readonly UploadSliceWarning[]): void {
  const container = $('job-upload-warnings-container');
  const list = $('job-upload-meta-warnings');
  if (!container || !list) {
    return;
  }

  list.innerHTML = '';

  if (warnings.length === 0) {
    container.classList.add('hidden');
    list.textContent = '-';
    return;
  }

  container.classList.remove('hidden');
  warnings.forEach((warning) => {
    const item = document.createElement('div');
    item.className = 'job-upload-warning-item';

    const icon = document.createElement('span');
    const levelClass = warning.level >= 2 ? 'level-error' : warning.level >= 1 ? 'level-warning' : 'level-info';
    icon.className = `job-upload-warning-icon ${levelClass}`;
    icon.textContent = warning.level >= 2 ? '⚠' : 'ℹ';

    const message = document.createElement('span');
    message.className = 'job-upload-warning-msg';
    message.textContent = warning.message;

    item.appendChild(icon);
    item.appendChild(message);
    list.appendChild(item);
  });
}

function renderThumbnail(thumbnail: string | null): void {
  const box = $('job-upload-thumbnail');
  if (!box) {
    return;
  }

  box.innerHTML = '';

  if (!thumbnail) {
    const placeholder = document.createElement('span');
    placeholder.className = 'job-upload-no-preview';
    placeholder.textContent = 'No Preview';
    box.appendChild(placeholder);
    return;
  }

  const image = document.createElement('img');
  image.src = thumbnail.startsWith('data:image') ? thumbnail : `data:image/png;base64,${thumbnail}`;
  image.alt = 'Preview';
  box.appendChild(image);
}

function resetMetadata(): void {
  [
    'job-upload-meta-printer',
    'job-upload-meta-filament-type',
    'job-upload-meta-filament-len',
    'job-upload-meta-slicer-name',
    'job-upload-meta-slicer-ver',
    'job-upload-meta-slice-date',
    'job-upload-meta-slice-time',
    'job-upload-meta-eta',
    'job-upload-meta-first-layer-time',
    'job-upload-meta-layer-height',
    'job-upload-meta-infill',
    'job-upload-meta-layers',
    'job-upload-meta-support',
  ].forEach((id) => {
    setMetaText(id, '-');
  });

  renderWarnings([]);
  renderThumbnail(null);
}

// ============================================================================
// DIALOG STATE HELPERS
// ============================================================================

function setFilePathDisplay(text: string, title: string): void {
  const element = $('job-upload-file-path');
  if (element) {
    element.textContent = text;
    element.title = title;
  }
}

function setOkButtonState(enabled: boolean): void {
  const button = $('job-upload-ok') as HTMLButtonElement | null;
  if (button) {
    button.disabled = !enabled;
  }
}

function showLoading(show: boolean, text = 'Parsing file...'): void {
  const label = $('job-upload-loading-text');
  if (label) {
    label.textContent = text;
  }
  if (show) {
    showElement('job-upload-loading');
  } else {
    hideElement('job-upload-loading');
  }
}

function showUploadProgress(show: boolean): void {
  if (show) {
    showElement('job-upload-progress-overlay');
  } else {
    hideElement('job-upload-progress-overlay');
  }
}

function updateUploadProgress(percentage: number, status: string): void {
  showUploadProgress(true);

  const bar = $('job-upload-progress-bar');
  if (bar) {
    bar.style.width = `${percentage}%`;
  }

  setMetaText('job-upload-progress-percentage', `${Math.round(percentage)}%`);
  setMetaText('job-upload-progress-status', status);
}

function getStartNow(): boolean {
  return ($('job-upload-start-now') as HTMLInputElement | null)?.checked ?? true;
}

function getAutoLevel(): boolean {
  return ($('job-upload-auto-level') as HTMLInputElement | null)?.checked ?? false;
}

// ============================================================================
// WIRING
// ============================================================================

export function setupJobUpload(): void {
  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  const input = $('job-upload-file-input') as HTMLInputElement | null;

  $('job-upload-browse')?.addEventListener('click', () => {
    input?.click();
  });

  input?.addEventListener('change', () => {
    void handleFileSelected(input.files?.[0] ?? null);
  });

  $('job-upload-ok')?.addEventListener('click', () => {
    void handleUpload();
  });

  $('job-upload-cancel')?.addEventListener('click', () => {
    closeJobUploadModal();
  });

  $('job-upload-close')?.addEventListener('click', () => {
    closeJobUploadModal();
  });
}
