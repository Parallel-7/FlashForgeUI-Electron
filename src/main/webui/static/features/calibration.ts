/**
 * @fileoverview Calibration Assistant feature for the WebUI client.
 *
 * Browser port of the desktop calibration dialog: a topbar button (shown only
 * for SSH-capable models: Adventurer 5M / 5M Pro / AD5X) opens a full overlay
 * with the same four tabs — Bed Leveling (mesh heatmap + workflow analysis +
 * animated screw/tape recommendations), Input Shaper (PSD plot + shaper
 * comparison + Klipper config output), SSH connection controls, and History.
 * Talks to the authenticated /api/calibration/* REST surface.
 *
 * Desktop-only affordances are replaced with browser equivalents: native file
 * dialogs become <input type="file"> pickers, save dialogs become Blob
 * downloads, and report export streams the raw payload from
 * GET /api/calibration/report with auth headers.
 *
 * Context pinning: the active context id is captured when the modal opens and
 * sent with every request, so switching the printer selector mid-session never
 * retargets calibration operations.
 *
 * Key exports:
 * - setupCalibration(): wire the topbar button + modal event handlers
 * - refreshCalibrationButton(): show/hide the topbar button per model support
 */

import { contextById } from '../core/AppState.js';
import { apiRequest, buildAuthHeaders } from '../core/Transport.js';
import { showToast } from '../shared/dom.js';
import { hydrateLucideIcons } from '../shared/icons.js';
import { AnimatedRecommendationVisualizer } from './calibration/AnimatedRecommendationVisualizer.js';
import { BedMeshVisualizer } from './calibration/BedMeshVisualizer.js';
import { ShaperPlotVisualizer } from './calibration/ShaperPlotVisualizer.js';
import type {
  AnalysisResult,
  AxisCalibration,
  CalibrationHistoryEntry,
  CalibrationWorkspace,
  MeshData,
  ScrewAdjustment,
  ShaperResult,
  TapeRecommendation,
  WorkflowData,
} from './calibration/types.js';
import { getCurrentContextId } from './context-switching.js';

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

interface SupportResponse {
  readonly success: boolean;
  readonly supported?: boolean;
  readonly error?: string;
}

interface WorkspaceResponse {
  readonly success: boolean;
  readonly workspace?: CalibrationWorkspace | null;
  readonly error?: string;
}

interface ProfilesResponse {
  readonly success: boolean;
  readonly profiles?: string[];
  readonly error?: string;
}

interface WorkflowResponse {
  readonly success: boolean;
  readonly workflow?: WorkflowData;
  readonly error?: string;
}

interface HistoryResponse {
  readonly success: boolean;
  readonly history?: CalibrationHistoryEntry[];
  readonly error?: string;
}

interface ShaperAnalyzeResponse {
  readonly success: boolean;
  readonly calibration?: AxisCalibration;
  readonly error?: string;
}

interface ShaperConfigResponse {
  readonly success: boolean;
  readonly lines?: string[];
  readonly error?: string;
}

interface SSHConfigResponse {
  readonly success: boolean;
  readonly config?: {
    readonly host?: string;
    readonly port?: number;
    readonly username?: string;
    readonly keyPath?: string;
    readonly isCustom?: boolean;
    readonly configPath?: string;
  };
  readonly error?: string;
}

interface SSHStatusResponse {
  readonly success: boolean;
  readonly status?: unknown;
  readonly error?: string;
}

interface SSHExecuteResponse {
  readonly success: boolean;
  readonly result?: {
    readonly success?: boolean;
    readonly stdout?: string;
    readonly stderr?: string;
    readonly error?: string;
  };
  readonly error?: string;
}

interface SSHContentResponse {
  readonly success: boolean;
  readonly content?: string;
  readonly error?: string;
}

interface UploadConfigResponse {
  readonly success: boolean;
  readonly result?: { readonly success?: boolean; readonly error?: string };
  readonly error?: string;
}

interface BasicResponse {
  readonly success: boolean;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Constants + state
// ---------------------------------------------------------------------------

/** Lucide icons used inside the calibration modal markup. */
const CAL_ICONS = [
  'grid-3x3',
  'activity',
  'terminal',
  'history',
  'file-up',
  'download',
  'circle',
  'play',
  'sparkles',
  'copy',
  'upload',
  'plug',
  'unplug',
  'check-circle',
  'trash-2',
  'x',
];

interface CalibrationState {
  /** Context pinned when the modal opened; null when the modal is closed. */
  pinnedContextId: string | null;
  meshData: MeshData | null;
  analysisResult: AnalysisResult | null;
  workflowData: WorkflowData | null;
  configContent: string | null;
  sshConnected: boolean;
  activeTab: string;
  shaperResults: {
    x: AxisCalibration | null;
    y: AxisCalibration | null;
    activeAxis: 'x' | 'y';
  };
}

const calState: CalibrationState = {
  pinnedContextId: null,
  meshData: null,
  analysisResult: null,
  workflowData: null,
  configContent: null,
  sshConnected: false,
  activeTab: 'bed',
  shaperResults: { x: null, y: null, activeAxis: 'x' },
};

let meshVisualizer: BedMeshVisualizer | null = null;
let shaperVisualizer: ShaperPlotVisualizer | null = null;
let recommendationVisualizer: AnimatedRecommendationVisualizer | null = null;
let iconsHydrated = false;

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function el(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`[Calibration] Missing element #${id}`);
  }
  return element;
}

function inputEl(id: string): HTMLInputElement {
  return el(id) as HTMLInputElement;
}

function buttonEl(id: string): HTMLButtonElement {
  return el(id) as HTMLButtonElement;
}

function selectEl(id: string): HTMLSelectElement {
  return el(id) as HTMLSelectElement;
}

function setStatus(message: string): void {
  el('cal-status-message').textContent = message;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/** Append the pinned context id to a query-string API path. */
function calQuery(path: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params);
  if (calState.pinnedContextId) {
    query.set('contextId', calState.pinnedContextId);
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

/** Build a JSON body payload that carries the pinned context id. */
function calBody(payload: Record<string, unknown> = {}): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      calState.pinnedContextId ? { ...payload, contextId: calState.pinnedContextId } : payload
    ),
  };
}

/** Open a browser file picker and read the chosen file as text. */
function pickTextFile(accept: string): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      file
        .text()
        .then((content) => resolve({ name: file.name, content }))
        .catch(() => resolve(null));
    });
    input.click();
  });
}

/** Trigger a browser download for the given content. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---------------------------------------------------------------------------
// Topbar button gating
// ---------------------------------------------------------------------------

/**
 * Show or hide the topbar calibration button. Calibration shares the SSH model
 * set with the file manager (5M / 5M Pro / AD5X), so it reuses the cheap
 * model-only support endpoint.
 */
export async function refreshCalibrationButton(): Promise<void> {
  const button = document.getElementById('calibration-button');
  if (!button) {
    return;
  }
  try {
    const result = await apiRequest<SupportResponse>('/api/file-manager/support');
    button.classList.toggle('hidden', !(result.success && result.supported));
  } catch {
    button.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// Modal lifecycle
// ---------------------------------------------------------------------------

async function openCalibration(): Promise<void> {
  const contextId = getCurrentContextId();
  if (!contextId) {
    showToast('No printer is connected', 'error');
    return;
  }

  calState.pinnedContextId = contextId;
  calState.meshData = null;
  calState.analysisResult = null;
  calState.workflowData = null;
  calState.configContent = null;
  calState.sshConnected = false;
  calState.shaperResults.x = null;
  calState.shaperResults.y = null;

  const context = contextById.get(contextId);
  el('cal-context-indicator').textContent = context ? `Printer: ${context.name}` : 'Printer: (active context)';

  el('calibration-modal').classList.remove('hidden');
  if (!iconsHydrated) {
    hydrateLucideIcons(CAL_ICONS, el('calibration-modal'));
    iconsHydrated = true;
  }

  if (!meshVisualizer) {
    meshVisualizer = new BedMeshVisualizer(el('cal-mesh-canvas') as HTMLCanvasElement, {
      width: 400,
      height: 400,
      colorScheme: 'viridis',
      showGrid: true,
      showLabels: true,
      showCorners: true,
      interpolationFactor: 1,
    });
    meshVisualizer.setEventHandlers({
      onCellHover: (cell) => {
        setStatus(cell ? `Cell [${cell.row}, ${cell.col}]: ${cell.value.toFixed(4)} mm` : '');
      },
    });
  }
  if (!shaperVisualizer) {
    shaperVisualizer = new ShaperPlotVisualizer(el('cal-shaper-canvas') as HTMLCanvasElement, {
      width: 600,
      height: 300,
      backgroundColor: '#141414',
    });
  }
  if (!recommendationVisualizer) {
    recommendationVisualizer = new AnimatedRecommendationVisualizer(el('cal-rec-canvas') as HTMLCanvasElement, {
      width: 620,
      height: 420,
    });
  }

  switchTab('bed');
  setStatus('');
  updateMeshDisplay();
  updateAnalysisDisplay();
  updateShaperDisplay(null);

  await loadWorkspace();
  await loadSSHInfo();
  await updateSSHStatus();

  // Auto-connect SSH so the Fetch-via-SSH workflows are immediately usable
  // (mirrors the desktop dialog and file manager).
  if (!calState.sshConnected) {
    void handleSSHConnect(true);
  }
}

function closeCalibration(): void {
  hideVisualRecommendations();
  el('calibration-modal').classList.add('hidden');
  calState.pinnedContextId = null;
}

// ---------------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------------

function switchTab(tabId: string): void {
  calState.activeTab = tabId;

  document.querySelectorAll<HTMLButtonElement>('.cal-tab-button').forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  document.querySelectorAll<HTMLElement>('.cal-tab-panel').forEach((panel) => {
    panel.hidden = panel.id !== `cal-panel-${tabId}`;
  });

  if (tabId === 'history' && calState.pinnedContextId) {
    void loadHistory();
  }
}

// ---------------------------------------------------------------------------
// Workspace + mesh display
// ---------------------------------------------------------------------------

async function loadWorkspace(): Promise<void> {
  try {
    const result = await apiRequest<WorkspaceResponse>(calQuery('/api/calibration/workspace'));
    if (result.success && result.workspace?.meshData) {
      calState.meshData = result.workspace.meshData;
      calState.analysisResult = result.workspace.analysis;
      calState.workflowData = result.workspace.workflow;
      updateMeshDisplay();
      updateAnalysisDisplay();
    }
  } catch (error) {
    console.error('[Calibration] Failed to load workspace:', error);
  }
}

function updateMeshDisplay(): void {
  meshVisualizer?.setMeshData(calState.meshData, calState.analysisResult);

  if (calState.meshData) {
    const values = calState.meshData.matrix.flat();
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);

    el('cal-stat-range').textContent = `${(max - min).toFixed(4)} mm`;
    el('cal-stat-max-dev').textContent = `${Math.max(Math.abs(min), Math.abs(max)).toFixed(4)} mm`;
    el('cal-stat-std-dev').textContent = `${stdDev.toFixed(4)} mm`;
    buttonEl('cal-btn-run-workflow').disabled = false;
  } else {
    el('cal-stat-range').textContent = '--';
    el('cal-stat-max-dev').textContent = '--';
    el('cal-stat-std-dev').textContent = '--';
    buttonEl('cal-btn-run-workflow').disabled = true;
  }
}

function formatCornerName(corner: string): string {
  const names: Record<string, string> = {
    frontLeft: 'Front Left',
    frontRight: 'Front Right',
    rearLeft: 'Rear Left',
    rearRight: 'Rear Right',
  };
  return names[corner] || corner;
}

function updateAnalysisDisplay(): void {
  const resultsSection = el('cal-results-section');
  const visualButton = buttonEl('cal-btn-visual-rec');

  if (!calState.workflowData) {
    resultsSection.hidden = true;
    visualButton.disabled = true;
    updateWorkflowStages();
    return;
  }

  resultsSection.hidden = false;
  visualButton.disabled = false;

  const screwAdjustments = (calState.workflowData.screwAdjustments || []).filter(
    (adj: ScrewAdjustment) => adj.requiresAdjustment
  );
  el('cal-screw-list').innerHTML =
    screwAdjustments.length > 0
      ? screwAdjustments
          .map(
            (adj: ScrewAdjustment) => `
        <div class="cal-adjustment-item">
          <span class="cal-adjustment-corner">${formatCornerName(adj.corner)}</span>
          <span class="cal-adjustment-value ${adj.direction === 'CW' ? 'cw' : 'ccw'}">${adj.formattedAmount}</span>
        </div>`
          )
          .join('')
      : '<div class="cal-adjustment-item">No adjustments needed</div>';

  const tapeRecs = calState.workflowData.tapeRecommendations || [];
  el('cal-tape-list').innerHTML =
    tapeRecs.length > 0
      ? tapeRecs
          .map(
            (rec: TapeRecommendation) => `
        <div class="cal-adjustment-item">
          <span class="cal-adjustment-corner">${formatCornerName(rec.corner)}</span>
          <span class="cal-adjustment-value">${rec.layers} layer${rec.layers !== 1 ? 's' : ''}</span>
        </div>`
          )
          .join('')
      : '<div class="cal-adjustment-item">No tape needed</div>';

  el('cal-improvement-value').textContent = `${calState.workflowData.improvementPercent.toFixed(1)}%`;
  updateWorkflowStages();
}

function updateWorkflowStages(): void {
  el('cal-workflow-stages')
    .querySelectorAll<HTMLElement>('.cal-workflow-stage')
    .forEach((stageEl) => {
      const stage = stageEl.dataset.stage;
      stageEl.classList.remove('active', 'completed');
      if (stage && calState.workflowData?.completedStages?.includes(stage as never)) {
        stageEl.classList.add('completed');
      }
      if (stage && calState.workflowData?.currentStage === stage) {
        stageEl.classList.add('active');
      }
    });
}

// ---------------------------------------------------------------------------
// Config file handling (bed leveling)
// ---------------------------------------------------------------------------

async function handleLoadConfigFile(): Promise<void> {
  const picked = await pickTextFile('.cfg,.conf,.txt,text/plain');
  if (!picked) {
    setStatus('File selection cancelled');
    return;
  }

  calState.configContent = picked.content;
  setStatus(`Loaded: ${picked.name}`);
  await loadProfilesAndFirstMesh(picked.content);
}

async function handleFetchConfigSSH(): Promise<void> {
  try {
    setStatus('Fetching config via SSH...');
    const overridePath = inputEl('cal-ssh-config-path').value.trim() || undefined;
    const result = await apiRequest<SSHContentResponse>(
      '/api/calibration/ssh/fetch-config',
      calBody(overridePath ? { remotePath: overridePath } : {})
    );
    if (!result.success || typeof result.content !== 'string') {
      setStatus(`SSH Error: ${result.error || 'Failed to fetch config'}`);
      return;
    }
    calState.configContent = result.content;
    await loadProfilesAndFirstMesh(result.content);
    setStatus('Config fetched successfully');
  } catch (error) {
    setStatus(`SSH Error: ${errorText(error)}`);
  }
}

async function loadProfilesAndFirstMesh(configContent: string): Promise<void> {
  try {
    const result = await apiRequest<ProfilesResponse>('/api/calibration/profiles', calBody({ configContent }));
    const profiles = result.success && result.profiles ? result.profiles : [];
    populateProfileSelect(profiles);
    if (profiles.length > 0) {
      await loadMeshProfile(profiles[0]);
    } else {
      setStatus('No mesh profiles found in config');
    }
  } catch (error) {
    setStatus(`Error: ${errorText(error)}`);
  }
}

function populateProfileSelect(profiles: string[]): void {
  const select = selectEl('cal-profile-select');
  select.innerHTML = '';
  profiles.forEach((profile) => {
    const option = document.createElement('option');
    option.value = profile;
    option.textContent = profile;
    select.appendChild(option);
  });
  select.disabled = profiles.length === 0;
}

async function loadMeshProfile(profileName: string): Promise<void> {
  if (!calState.configContent) return;

  try {
    const result = await apiRequest<WorkspaceResponse>(
      '/api/calibration/workspace/load',
      calBody({ configContent: calState.configContent, profileName })
    );
    if (result.success && result.workspace?.meshData) {
      calState.meshData = result.workspace.meshData;
      calState.analysisResult = result.workspace.analysis;
      updateMeshDisplay();
      setStatus(`Loaded profile: ${profileName}`);
    } else {
      setStatus(`Error loading profile: ${result.error || 'Unable to parse mesh data'}`);
    }
  } catch (error) {
    setStatus(`Error loading profile: ${errorText(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

async function handleRunWorkflow(): Promise<void> {
  const runButton = buttonEl('cal-btn-run-workflow');
  try {
    setStatus('Running calibration workflow...');
    runButton.disabled = true;

    const result = await apiRequest<WorkflowResponse>('/api/calibration/workflow', calBody());
    if (result.success && result.workflow) {
      calState.workflowData = result.workflow;
      updateAnalysisDisplay();
      setStatus('Workflow complete');

      await apiRequest<BasicResponse>(
        '/api/calibration/history',
        calBody({
          type: 'bed_level',
          summary: `Range: ${result.workflow.initialRange.toFixed(3)}mm -> ${result.workflow.finalRange.toFixed(3)}mm`,
          data: result.workflow,
        })
      );
    } else {
      setStatus(`Workflow error: ${result.error || 'No mesh data loaded'}`);
    }
  } catch (error) {
    setStatus(`Workflow error: ${errorText(error)}`);
  } finally {
    runButton.disabled = false;
  }
}

function handleShowVisualRecommendations(): void {
  if (!calState.workflowData) {
    setStatus('Run analysis to generate recommendations');
    return;
  }

  el('cal-visual-rec-overlay').classList.remove('hidden');
  recommendationVisualizer?.setRecommendations(
    calState.workflowData.screwAdjustments || [],
    calState.workflowData.tapeRecommendations || []
  );
  recommendationVisualizer?.start();
}

function hideVisualRecommendations(): void {
  el('cal-visual-rec-overlay').classList.add('hidden');
  recommendationVisualizer?.stop();
}

// ---------------------------------------------------------------------------
// Input shaper
// ---------------------------------------------------------------------------

function switchAxis(axis: 'x' | 'y'): void {
  buttonEl('cal-btn-axis-x').classList.toggle('active', axis === 'x');
  buttonEl('cal-btn-axis-y').classList.toggle('active', axis === 'y');
  calState.shaperResults.activeAxis = axis;
  updateShaperDisplay(calState.shaperResults[axis]);
}

async function handleLoadShaperCSV(): Promise<void> {
  const picked = await pickTextFile('.csv,text/csv');
  if (!picked) {
    setStatus('File selection cancelled');
    return;
  }

  const axis = calState.shaperResults.activeAxis;
  await analyzeShaperContent(picked.content, axis);
  setStatus(`Loaded shaper CSV (${axis.toUpperCase()} axis)`);
}

async function handleFetchShaperSSH(): Promise<void> {
  const axis = calState.shaperResults.activeAxis;
  try {
    setStatus(`Fetching ${axis.toUpperCase()} shaper data via SSH...`);
    const result = await apiRequest<SSHContentResponse>('/api/calibration/ssh/fetch-shaper', calBody({ axis }));
    if (!result.success || typeof result.content !== 'string') {
      setStatus(`SSH Error: ${result.error || 'Failed to fetch shaper data'}`);
      return;
    }
    await analyzeShaperContent(result.content, axis);
    setStatus(`Fetched shaper data (${axis.toUpperCase()} axis)`);
  } catch (error) {
    setStatus(`SSH Error: ${errorText(error)}`);
  }
}

async function analyzeShaperContent(csvContent: string, axis: 'x' | 'y'): Promise<void> {
  try {
    setStatus('Analyzing input shaper data...');
    const result = await apiRequest<ShaperAnalyzeResponse>(
      '/api/calibration/shaper/analyze',
      calBody({ csvContent, axis })
    );
    if (!result.success || !result.calibration) {
      setStatus(`Shaper analysis error: ${result.error || 'Analysis failed'}`);
      return;
    }
    await setShaperCalibration(axis, result.calibration);
  } catch (error) {
    setStatus(`Shaper analysis error: ${errorText(error)}`);
  }
}

async function setShaperCalibration(axis: 'x' | 'y', calibration: AxisCalibration): Promise<void> {
  calState.shaperResults[axis] = calibration;
  if (axis === calState.shaperResults.activeAxis) {
    updateShaperDisplay(calibration);
  }

  const summary = `${axis.toUpperCase()}: ${calibration.recommendedShaper.type.toUpperCase()} @ ${calibration.recommendedShaper.frequency.toFixed(1)} Hz`;
  try {
    await apiRequest<BasicResponse>(
      '/api/calibration/history',
      calBody({ type: 'input_shaper', summary, data: calibration })
    );
    await apiRequest<BasicResponse>(
      '/api/calibration/shaper/save',
      calBody({ axis, result: calibration.recommendedShaper })
    );
  } catch (error) {
    console.error('[Calibration] Failed to persist shaper result:', error);
  }
}

function updateShaperDisplay(calibration: AxisCalibration | null): void {
  shaperVisualizer?.setCalibration(calibration);

  if (!calibration) {
    el('cal-shaper-recommendation').innerHTML =
      '<div class="cal-empty-state">Load accelerometer data to see recommendations</div>';
    el('cal-shaper-comparison').innerHTML = '<div class="cal-empty-state">No data loaded</div>';
    void updateShaperConfigOutput(null);
    return;
  }

  const rec = calibration.recommendedShaper;
  el('cal-shaper-recommendation').innerHTML = `
    <div class="cal-shaper-item recommended">
      <div class="cal-shaper-name">${rec.type.toUpperCase()}</div>
      <div class="cal-shaper-freq">${rec.frequency.toFixed(1)} Hz</div>
    </div>
    <div class="cal-shaper-details">
      <div>Vibration reduction: ${(rec.vibrationReduction * 100).toFixed(1)}%</div>
      <div>Smoothing: ${rec.smoothingTime.toFixed(2)} ms</div>
      <div>Max accel: ${rec.maxAcceleration} mm/s&sup2;</div>
    </div>
  `;

  el('cal-shaper-comparison').innerHTML = calibration.allShaperResults
    .map(
      (result: ShaperResult) => `
      <div class="cal-shaper-item ${result.type === rec.type ? 'recommended' : ''}">
        <div class="cal-shaper-name">${result.type.toUpperCase()}</div>
        <div class="cal-shaper-freq">${result.frequency.toFixed(1)} Hz</div>
      </div>`
    )
    .join('');

  void updateShaperConfigOutput(calibration);
}

async function updateShaperConfigOutput(calibration: AxisCalibration | null): Promise<void> {
  const output = el('cal-shaper-config-output');
  const copyButton = buttonEl('cal-btn-copy-config');
  const saveButton = buttonEl('cal-btn-save-config');
  const uploadButton = buttonEl('cal-btn-upload-config');

  if (!calibration) {
    output.textContent = 'Load data to generate config';
    copyButton.disabled = true;
    saveButton.disabled = true;
    uploadButton.disabled = true;
    return;
  }

  const lines = await generateShaperConfigLines(calibration.axis, calibration.recommendedShaper);
  output.textContent = lines.join('\n');
  copyButton.disabled = false;
  saveButton.disabled = false;
  uploadButton.disabled = !calState.sshConnected;
}

async function generateShaperConfigLines(axis: 'x' | 'y', result: ShaperResult): Promise<string[]> {
  const response = await apiRequest<ShaperConfigResponse>(
    '/api/calibration/shaper/config',
    calBody({ axis, result })
  );
  return response.success && response.lines ? response.lines : [];
}

async function handleCopyShaperConfig(): Promise<void> {
  const text = el('cal-shaper-config-output').textContent || '';
  if (!text || text.includes('Load data')) {
    setStatus('No shaper config available');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus('Shaper config copied to clipboard');
  } catch (error) {
    setStatus(`Copy failed: ${errorText(error)}`);
  }
}

async function handleSaveShaperConfig(): Promise<void> {
  const calibration = calState.shaperResults[calState.shaperResults.activeAxis];
  if (!calibration) {
    setStatus('No shaper data to export');
    return;
  }

  try {
    const content = await buildShaperConfigContent(calibration.axis, calibration);
    downloadBlob(new Blob([content], { type: 'text/plain' }), `input_shaper_${calibration.axis}.cfg`);
    setStatus(`Config downloaded: input_shaper_${calibration.axis}.cfg`);
  } catch (error) {
    setStatus(`Export error: ${errorText(error)}`);
  }
}

async function handleUploadShaperConfig(): Promise<void> {
  const calibration = calState.shaperResults[calState.shaperResults.activeAxis];
  if (!calibration) {
    setStatus('No shaper data to upload');
    return;
  }

  if (!calState.configContent) {
    setStatus('Load or fetch printer.cfg before uploading');
    return;
  }

  try {
    const content = await buildShaperConfigContent(calibration.axis, calibration);
    const remotePath = inputEl('cal-ssh-config-path').value.trim() || undefined;
    const result = await apiRequest<UploadConfigResponse>(
      '/api/calibration/ssh/upload-config',
      calBody(remotePath ? { content, remotePath } : { content })
    );
    if (result.success) {
      calState.configContent = content;
      setStatus('Config uploaded via SSH');
    } else {
      setStatus(`Upload failed: ${result.error || result.result?.error || 'Unknown error'}`);
    }
  } catch (error) {
    setStatus(`Upload error: ${errorText(error)}`);
  }
}

async function buildShaperConfigContent(axis: 'x' | 'y', calibration: AxisCalibration): Promise<string> {
  const lines = await generateShaperConfigLines(axis, calibration.recommendedShaper);
  if (!calState.configContent) {
    return lines.join('\n');
  }
  return applyShaperConfigToPrinterConfig(calState.configContent, axis, lines);
}

/**
 * Merge generated [input_shaper] lines into an existing printer.cfg, replacing
 * only the target axis keys. Mirrors the desktop implementation verbatim.
 */
function applyShaperConfigToPrinterConfig(configContent: string, axis: 'x' | 'y', configLines: string[]): string {
  const lines = configContent.split(/\r?\n/);
  const axisKeys = [`shaper_freq_${axis}`, `shaper_type_${axis}`];

  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim().toLowerCase();
    if (trimmed.startsWith('[')) {
      if (sectionStart !== -1) {
        sectionEnd = i;
        break;
      }
      if (trimmed === '[input_shaper]') {
        sectionStart = i;
      }
    }
  }

  const axisLines = configLines.filter((line) => line.trim().startsWith('shaper_'));

  if (sectionStart === -1) {
    const suffix = configContent.trim().length > 0 ? '\n\n' : '';
    return `${configContent.trimEnd()}${suffix}${configLines.join('\n')}\n`;
  }

  const bodyLines = lines.slice(sectionStart + 1, sectionEnd);
  const filtered = bodyLines.filter((line) => {
    const trimmed = line.trim().toLowerCase();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      return true;
    }
    return !axisKeys.some((key) => trimmed.startsWith(`${key}:`) || trimmed.startsWith(`${key} `));
  });

  const newSection = [lines[sectionStart], ...filtered, ...axisLines];
  return [...lines.slice(0, sectionStart), ...newSection, ...lines.slice(sectionEnd)].join('\n');
}

// ---------------------------------------------------------------------------
// SSH
// ---------------------------------------------------------------------------

async function loadSSHInfo(): Promise<void> {
  try {
    const result = await apiRequest<SSHConfigResponse>(calQuery('/api/calibration/ssh/config'));
    if (!result.success || !result.config) {
      return;
    }

    const config = result.config;
    const context = calState.pinnedContextId ? contextById.get(calState.pinnedContextId) : undefined;
    const host = context?.ipAddress?.trim() || config.host?.trim() || '';
    const hostInput = inputEl('cal-ssh-host');
    hostInput.value = host;
    if (!host) {
      hostInput.placeholder = 'Printer IP unavailable (connect printer first)';
    }

    const username = config.username || 'root';
    const port = config.port || 22;
    const auth = config.keyPath ? 'private key' : 'password';
    const source = config.isCustom ? 'custom' : 'easy-SSH defaults';
    inputEl('cal-ssh-summary').value = `${username} (port ${port}, ${auth} auth, ${source})`;

    if (config.configPath) {
      inputEl('cal-ssh-config-path').value = config.configPath;
    }
  } catch (error) {
    console.error('[Calibration] Failed to load SSH settings:', error);
  }
}

/** Defensively derive "connected" from the SSH status payload. */
function isConnectedStatus(status: unknown): boolean {
  if (typeof status === 'string') {
    return status === 'connected';
  }
  if (status && typeof status === 'object') {
    const record = status as Record<string, unknown>;
    return record.connected === true || record.status === 'connected' || record.state === 'connected';
  }
  return false;
}

async function updateSSHStatus(): Promise<void> {
  try {
    const result = await apiRequest<SSHStatusResponse>(calQuery('/api/calibration/ssh/status'));
    calState.sshConnected = result.success && isConnectedStatus(result.status);
  } catch {
    calState.sshConnected = false;
  }

  const connected = calState.sshConnected;
  const indicator = el('cal-ssh-indicator');
  indicator.querySelector('.cal-ssh-dot')?.classList.toggle('connected', connected);
  const statusText = indicator.querySelector('.cal-ssh-text');
  if (statusText) {
    statusText.textContent = connected ? 'SSH: Connected' : 'SSH: Disconnected';
  }

  buttonEl('cal-btn-ssh-connect').disabled = connected;
  buttonEl('cal-btn-ssh-disconnect').disabled = !connected;
  buttonEl('cal-btn-fetch-ssh').disabled = !connected;
  buttonEl('cal-btn-fetch-shaper').disabled = !connected;
  buttonEl('cal-btn-upload-config').disabled =
    !connected || !calState.shaperResults[calState.shaperResults.activeAxis];
}

async function handleSSHConnect(silent = false): Promise<void> {
  try {
    buttonEl('cal-btn-ssh-connect').disabled = true;
    if (!silent) {
      setSSHResult('Connecting...', 'info');
    }

    const result = await apiRequest<BasicResponse>('/api/calibration/ssh/connect', calBody());
    if (!result.success) {
      throw new Error(result.error || 'Connection failed');
    }

    if (!silent) {
      setSSHResult('Connected successfully!', 'success');
    }
    await updateSSHStatus();
  } catch (error) {
    if (!silent) {
      setSSHResult(`Connection failed: ${errorText(error)}`, 'error');
    }
    buttonEl('cal-btn-ssh-connect').disabled = false;
  }
}

async function handleSSHDisconnect(): Promise<void> {
  try {
    await apiRequest<BasicResponse>('/api/calibration/ssh/disconnect', calBody());
    setSSHResult('Disconnected', 'info');
    await updateSSHStatus();
  } catch (error) {
    setSSHResult(`Disconnect error: ${errorText(error)}`, 'error');
  }
}

async function handleSSHTest(): Promise<void> {
  const testButton = buttonEl('cal-btn-ssh-test');
  try {
    testButton.disabled = true;
    setSSHResult('Testing connection...', 'info');

    const connect = await apiRequest<BasicResponse>('/api/calibration/ssh/connect', calBody());
    if (!connect.success) {
      throw new Error(connect.error || 'Connection failed');
    }

    const result = await apiRequest<SSHExecuteResponse>(
      '/api/calibration/ssh/execute',
      calBody({ command: 'echo "Connection test"' })
    );
    if (result.success && result.result?.success !== false) {
      setSSHResult('Connection test successful!', 'success');
    } else {
      setSSHResult(`Command failed: ${result.error || result.result?.error || result.result?.stderr || 'Unknown error'}`, 'error');
    }

    await updateSSHStatus();
  } catch (error) {
    setSSHResult(`Test failed: ${errorText(error)}`, 'error');
  } finally {
    testButton.disabled = false;
  }
}

function setSSHResult(message: string, type: 'success' | 'error' | 'info'): void {
  const resultEl = el('cal-ssh-test-result');
  resultEl.textContent = message;
  resultEl.className = 'cal-ssh-test-result';
  if (type !== 'info') {
    resultEl.classList.add(type);
  }
}

/** Persist the calibration-specific remote config path override. */
async function persistConfigPath(): Promise<void> {
  try {
    await apiRequest<BasicResponse>(
      '/api/calibration/ssh/config',
      calBody({ configPath: inputEl('cal-ssh-config-path').value.trim() })
    );
  } catch (error) {
    console.error('[Calibration] Failed to save config path:', error);
  }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

async function loadHistory(): Promise<void> {
  try {
    const result = await apiRequest<HistoryResponse>(calQuery('/api/calibration/history'));
    const history = result.success && result.history ? result.history : [];

    if (history.length === 0) {
      el('cal-history-list').innerHTML =
        '<div class="cal-empty-state">No calibration history for this printer</div>';
      return;
    }

    el('cal-history-list').innerHTML = history
      .map(
        (entry: CalibrationHistoryEntry) => `
      <div class="cal-history-item">
        <div class="cal-history-item-main">
          <span class="cal-history-item-type">${entry.type === 'bed_level' ? 'Bed Leveling' : 'Input Shaper'}</span>
          <span class="cal-history-item-summary">${entry.summary}</span>
          <span class="cal-history-item-date">${new Date(entry.timestamp).toLocaleString()}</span>
        </div>
      </div>`
      )
      .join('');
  } catch (error) {
    console.error('[Calibration] Failed to load history:', error);
  }
}

async function handleClearHistory(): Promise<void> {
  if (!window.confirm('Are you sure you want to clear calibration history?')) {
    return;
  }

  try {
    await apiRequest<BasicResponse>(calQuery('/api/calibration/history'), { method: 'DELETE' });
    await loadHistory();
    setStatus('History cleared');
  } catch (error) {
    setStatus(`Error clearing history: ${errorText(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Report export
// ---------------------------------------------------------------------------

async function handleExport(): Promise<void> {
  if (!calState.meshData) {
    setStatus('Load mesh data before exporting a report');
    return;
  }

  const format = selectEl('cal-export-format').value || 'json';
  try {
    setStatus(`Exporting ${format.toUpperCase()} report...`);
    // The report endpoint streams the raw payload (JSON/CSV text or PNG/PDF
    // binary) rather than a JSON envelope, so it needs a direct fetch.
    const response = await fetch(calQuery('/api/calibration/report', { format }), {
      headers: buildAuthHeaders(),
    });
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // Non-JSON error body; keep the HTTP status message.
      }
      setStatus(`Export error: ${message}`);
      return;
    }

    const blob = await response.blob();
    downloadBlob(blob, `calibration-report.${format}`);
    setStatus(`Report downloaded (calibration-report.${format})`);
  } catch (error) {
    setStatus(`Export error: ${errorText(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/** Wire the topbar button and all modal event handlers. Call once at startup. */
export function setupCalibration(): void {
  document.getElementById('calibration-button')?.addEventListener('click', () => void openCalibration());

  el('cal-close').addEventListener('click', closeCalibration);
  el('cal-close-footer').addEventListener('click', closeCalibration);

  document.querySelectorAll<HTMLButtonElement>('.cal-tab-button').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab || 'bed'));
  });

  el('cal-btn-load-file').addEventListener('click', () => void handleLoadConfigFile());
  el('cal-btn-fetch-ssh').addEventListener('click', () => void handleFetchConfigSSH());
  selectEl('cal-profile-select').addEventListener('change', () => {
    const profile = selectEl('cal-profile-select').value;
    if (profile) {
      void loadMeshProfile(profile);
    }
  });
  el('cal-btn-run-workflow').addEventListener('click', () => void handleRunWorkflow());

  el('cal-btn-axis-x').addEventListener('click', () => switchAxis('x'));
  el('cal-btn-axis-y').addEventListener('click', () => switchAxis('y'));
  el('cal-btn-load-csv').addEventListener('click', () => void handleLoadShaperCSV());
  el('cal-btn-fetch-shaper').addEventListener('click', () => void handleFetchShaperSSH());
  el('cal-btn-copy-config').addEventListener('click', () => void handleCopyShaperConfig());
  el('cal-btn-save-config').addEventListener('click', () => void handleSaveShaperConfig());
  el('cal-btn-upload-config').addEventListener('click', () => void handleUploadShaperConfig());

  el('cal-btn-ssh-connect').addEventListener('click', () => void handleSSHConnect());
  el('cal-btn-ssh-disconnect').addEventListener('click', () => void handleSSHDisconnect());
  el('cal-btn-ssh-test').addEventListener('click', () => void handleSSHTest());
  inputEl('cal-ssh-config-path').addEventListener('change', () => void persistConfigPath());

  el('cal-btn-clear-history').addEventListener('click', () => void handleClearHistory());

  el('cal-btn-export').addEventListener('click', () => void handleExport());

  el('cal-btn-visual-rec').addEventListener('click', handleShowVisualRecommendations);
  el('cal-visual-rec-close').addEventListener('click', hideVisualRecommendations);
  el('cal-visual-rec-overlay').addEventListener('click', (event) => {
    if (event.target === el('cal-visual-rec-overlay')) {
      hideVisualRecommendations();
    }
  });
}
