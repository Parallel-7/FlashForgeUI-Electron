/**
 * @fileoverview Main renderer script for the Calibration Assistant dialog.
 * Handles UI interactions, tab navigation, and calibration workflow.
 *
 * @module renderer/ui/calibration-dialog/calibration-dialog-renderer
 */

import { createIcons, icons } from 'lucide';
import type {
  AnalysisResult,
  AxisCalibration,
  CalibrationHistoryEntry,
  MeshData,
  ScrewAdjustment,
  ShaperResult,
  SSHConnectionConfig,
  TapeRecommendation,
  WorkflowData,
} from '../../../../shared/types/calibration';
import {
  AnimatedRecommendationVisualizer,
  BedMeshVisualizer,
  ShaperPlotVisualizer,
  type VisualizerOptions,
} from '../calibration/visualization';

// ============================================================================
// State
// ============================================================================

interface DialogState {
  contextId: string | null;
  contextName: string | null;
  contextIp: string | null;
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

const state: DialogState = {
  contextId: null,
  contextName: null,
  contextIp: null,
  meshData: null,
  analysisResult: null,
  workflowData: null,
  configContent: null,
  sshConnected: false,
  activeTab: 'bed',
  shaperResults: {
    x: null,
    y: null,
    activeAxis: 'x',
  },
};

let meshVisualizer: BedMeshVisualizer | null = null;
let shaperVisualizer: ShaperPlotVisualizer | null = null;
let recommendationVisualizer: AnimatedRecommendationVisualizer | null = null;

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  // Close buttons
  btnClose: document.getElementById('btn-close') as HTMLButtonElement,
  btnCloseFooter: document.getElementById('btn-close-footer') as HTMLButtonElement,

  // Context indicator
  printerContextIndicator: document.getElementById('printer-context-indicator') as HTMLDivElement,
  sshStatusIndicator: document.getElementById('ssh-status-indicator') as HTMLDivElement,

  // Tab buttons
  tabButtons: document.querySelectorAll('.calibration-tab-button') as NodeListOf<HTMLButtonElement>,
  tabPanels: document.querySelectorAll('.tab-panel') as NodeListOf<HTMLElement>,

  // Bed leveling tab
  meshCanvas: document.getElementById('mesh-canvas') as HTMLCanvasElement,
  statRange: document.getElementById('stat-range') as HTMLSpanElement,
  statMaxDev: document.getElementById('stat-max-dev') as HTMLSpanElement,
  statStdDev: document.getElementById('stat-std-dev') as HTMLSpanElement,
  btnLoadFile: document.getElementById('btn-load-file') as HTMLButtonElement,
  btnFetchSSH: document.getElementById('btn-fetch-ssh') as HTMLButtonElement,
  meshProfileSelect: document.getElementById('mesh-profile-select') as HTMLSelectElement,
  workflowStages: document.getElementById('workflow-stages') as HTMLDivElement,
  btnRunWorkflow: document.getElementById('btn-run-workflow') as HTMLButtonElement,
  resultsSection: document.getElementById('results-section') as HTMLDivElement,
  screwAdjustmentsList: document.getElementById('screw-adjustments-list') as HTMLDivElement,
  tapeRecommendationsList: document.getElementById('tape-recommendations-list') as HTMLDivElement,
  improvementValue: document.getElementById('improvement-value') as HTMLSpanElement,
  btnVisualRecommendations: document.getElementById('btn-visual-recommendations') as HTMLButtonElement,

  // Input shaper tab
  shaperCanvas: document.getElementById('shaper-canvas') as HTMLCanvasElement,
  btnAxisX: document.getElementById('btn-axis-x') as HTMLButtonElement,
  btnAxisY: document.getElementById('btn-axis-y') as HTMLButtonElement,
  btnLoadShaperCSV: document.getElementById('btn-load-shaper-csv') as HTMLButtonElement,
  btnFetchShaperSSH: document.getElementById('btn-fetch-shaper-ssh') as HTMLButtonElement,
  shaperRecommendation: document.getElementById('shaper-recommendation') as HTMLDivElement,
  shaperComparisonList: document.getElementById('shaper-comparison-list') as HTMLDivElement,
  shaperConfigOutput: document.getElementById('shaper-config-output') as HTMLPreElement,
  btnCopyShaperConfig: document.getElementById('btn-copy-shaper-config') as HTMLButtonElement,
  btnSaveShaperConfig: document.getElementById('btn-save-shaper-config') as HTMLButtonElement,
  btnUploadShaperConfig: document.getElementById('btn-upload-shaper-config') as HTMLButtonElement,

  // SSH tab
  sshHost: document.getElementById('ssh-host') as HTMLInputElement,
  sshPort: document.getElementById('ssh-port') as HTMLInputElement,
  sshUsername: document.getElementById('ssh-username') as HTMLInputElement,
  sshPassword: document.getElementById('ssh-password') as HTMLInputElement,
  sshKeyPath: document.getElementById('ssh-key-path') as HTMLInputElement,
  btnSSHKeyBrowse: document.getElementById('btn-ssh-key-browse') as HTMLButtonElement,
  sshSaveCredentials: document.getElementById('ssh-save-credentials') as HTMLInputElement,
  btnSSHConnect: document.getElementById('btn-ssh-connect') as HTMLButtonElement,
  btnSSHDisconnect: document.getElementById('btn-ssh-disconnect') as HTMLButtonElement,
  btnSSHTest: document.getElementById('btn-ssh-test') as HTMLButtonElement,
  sshTestResult: document.getElementById('ssh-test-result') as HTMLDivElement,
  sshConfigPath: document.getElementById('ssh-config-path') as HTMLInputElement,

  // History tab
  btnClearHistory: document.getElementById('btn-clear-history') as HTMLButtonElement,
  historyList: document.getElementById('history-list') as HTMLDivElement,

  // Footer
  statusMessage: document.getElementById('status-message') as HTMLSpanElement,
  btnExport: document.getElementById('btn-export') as HTMLButtonElement,
  exportFormat: document.getElementById('export-format') as HTMLSelectElement,

  // Visual recommendations overlay
  visualRecOverlay: document.getElementById('visual-rec-overlay') as HTMLDivElement,
  visualRecClose: document.getElementById('btn-visual-rec-close') as HTMLButtonElement,
  recommendationCanvas: document.getElementById('recommendation-canvas') as HTMLCanvasElement,
};

// ============================================================================
// Initialization
// ============================================================================

async function initialize(): Promise<void> {
  // Initialize Lucide icons
  createIcons({ icons });

  // Get printer context (non-fatal; dialog should still be usable if this fails)
  let contextId: string | null = null;
  let contextInfo: { name: string; ip: string } | null = null;

  try {
    [contextId, contextInfo] = await Promise.all([window.windowAPI.getContextId(), window.windowAPI.getContextInfo()]);
  } catch (error) {
    console.error('Failed to get active printer context:', error);
  }

  if (contextId) {
    state.contextId = contextId;
    state.contextName = contextInfo?.name || contextId;
    state.contextIp = contextInfo?.ip?.trim() || null;
    elements.printerContextIndicator.textContent = `Printer: ${state.contextName}`;
  } else {
    elements.printerContextIndicator.textContent = 'No printer connected';
  }

  // Initialize mesh visualizer
  initMeshVisualizer();
  initShaperVisualizer();
  initRecommendationVisualizer();

  // Setup event listeners
  setupEventListeners();

  // Load existing workspace if available
  await loadWorkspace();
  await loadSSHSettings();

  // Check SSH status
  await updateSSHStatus();
}

function initMeshVisualizer(): void {
  const options: Partial<VisualizerOptions> = {
    width: 400,
    height: 400,
    colorScheme: 'viridis',
    showGrid: true,
    showLabels: true,
    showCorners: true,
    interpolationFactor: 1,
  };

  meshVisualizer = new BedMeshVisualizer(elements.meshCanvas, options);
  meshVisualizer.setEventHandlers({
    onCellHover: (cell) => {
      if (cell) {
        setStatus(`Cell [${cell.row}, ${cell.col}]: ${cell.value.toFixed(4)} mm`);
      } else {
        setStatus('');
      }
    },
  });
}

function initShaperVisualizer(): void {
  shaperVisualizer = new ShaperPlotVisualizer(elements.shaperCanvas, {
    width: 600,
    height: 300,
    backgroundColor: '#141414',
  });
}

function initRecommendationVisualizer(): void {
  recommendationVisualizer = new AnimatedRecommendationVisualizer(elements.recommendationCanvas, {
    width: 620,
    height: 420,
  });
}

function setupEventListeners(): void {
  // Close buttons
  elements.btnClose.addEventListener('click', () => window.windowAPI.close());
  elements.btnCloseFooter.addEventListener('click', () => window.windowAPI.close());

  // Tab navigation
  elements.tabButtons.forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab || 'bed'));
  });

  // Bed leveling controls
  elements.btnLoadFile.addEventListener('click', handleLoadConfigFile);
  elements.btnFetchSSH.addEventListener('click', handleFetchConfigSSH);
  elements.meshProfileSelect.addEventListener('change', handleProfileChange);
  elements.btnRunWorkflow.addEventListener('click', handleRunWorkflow);

  // Input shaper controls
  elements.btnAxisX.addEventListener('click', () => switchAxis('x'));
  elements.btnAxisY.addEventListener('click', () => switchAxis('y'));
  elements.btnLoadShaperCSV.addEventListener('click', handleLoadShaperCSV);
  elements.btnFetchShaperSSH.addEventListener('click', handleFetchShaperSSH);
  elements.btnCopyShaperConfig.addEventListener('click', handleCopyShaperConfig);
  elements.btnSaveShaperConfig.addEventListener('click', handleSaveShaperConfig);
  elements.btnUploadShaperConfig.addEventListener('click', handleUploadShaperConfig);

  // SSH controls
  elements.btnSSHConnect.addEventListener('click', handleSSHConnect);
  elements.btnSSHDisconnect.addEventListener('click', handleSSHDisconnect);
  elements.btnSSHTest.addEventListener('click', handleSSHTest);
  elements.btnSSHKeyBrowse.addEventListener('click', handleBrowseSSHKey);
  elements.sshSaveCredentials.addEventListener('change', handleSSHSaveToggle);

  // History controls
  elements.btnClearHistory.addEventListener('click', handleClearHistory);

  // Footer controls
  elements.btnExport.addEventListener('click', handleExport);

  // Visual recommendations
  elements.btnVisualRecommendations.addEventListener('click', handleShowVisualRecommendations);
  elements.visualRecClose.addEventListener('click', hideVisualRecommendations);
  elements.visualRecOverlay.addEventListener('click', (event) => {
    if (event.target === elements.visualRecOverlay) {
      hideVisualRecommendations();
    }
  });
}

// ============================================================================
// Tab Navigation
// ============================================================================

function switchTab(tabId: string): void {
  state.activeTab = tabId;

  elements.tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  elements.tabPanels.forEach((panel) => {
    panel.hidden = !panel.id.endsWith(tabId);
  });

  // Load tab-specific data
  if (tabId === 'history' && state.contextId) {
    loadHistory();
  }
}

// ============================================================================
// Workspace Management
// ============================================================================

async function loadWorkspace(): Promise<void> {
  if (!state.contextId) return;

  try {
    const workspace = await window.calibration.getWorkspace(state.contextId);
    if (workspace?.meshData) {
      state.meshData = workspace.meshData;
      state.analysisResult = workspace.analysis;
      state.workflowData = workspace.workflow;
      updateMeshDisplay();
      updateAnalysisDisplay();
    }
  } catch (error) {
    console.error('Failed to load workspace:', error);
  }
}

async function loadSSHSettings(): Promise<void> {
  if (!state.contextId) return;

  try {
    // Host is sourced from the active printer context; port is fixed for FlashForge SSH.
    const detectedHost = state.contextIp?.trim() || '';
    elements.sshHost.readOnly = true;
    elements.sshPort.readOnly = true;
    elements.sshPort.value = '22';

    const saved = await window.calibration.getSSHConfig(state.contextId);
    const savedHost = saved?.host?.trim() || '';
    elements.sshHost.value = detectedHost || savedHost;

    if (!elements.sshHost.value) {
      elements.sshHost.placeholder = 'Printer IP unavailable (connect printer first)';
    }

    if (saved) {
      if (saved.username) elements.sshUsername.value = saved.username;
      if (saved.password) elements.sshPassword.value = saved.password;
      if (saved.keyPath) elements.sshKeyPath.value = saved.keyPath;
      if (saved.configPath) elements.sshConfigPath.value = saved.configPath;
      if (typeof saved.saveCredentials === 'boolean') {
        elements.sshSaveCredentials.checked = saved.saveCredentials;
      }
    }
  } catch (error) {
    console.error('Failed to load SSH settings:', error);
  }
}

function updateMeshDisplay(): void {
  if (!meshVisualizer) return;

  meshVisualizer.setMeshData(state.meshData, state.analysisResult);

  if (state.meshData) {
    const matrix = state.meshData.matrix;
    const values = matrix.flat();
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);

    elements.statRange.textContent = `${range.toFixed(4)} mm`;
    elements.statMaxDev.textContent = `${Math.max(Math.abs(min), Math.abs(max)).toFixed(4)} mm`;
    elements.statStdDev.textContent = `${stdDev.toFixed(4)} mm`;

    elements.btnRunWorkflow.disabled = false;
  } else {
    elements.statRange.textContent = '--';
    elements.statMaxDev.textContent = '--';
    elements.statStdDev.textContent = '--';
    elements.btnRunWorkflow.disabled = true;
  }
}

function updateAnalysisDisplay(): void {
  if (!state.workflowData) {
    elements.resultsSection.hidden = true;
    elements.btnVisualRecommendations.disabled = true;
    return;
  }

  elements.resultsSection.hidden = false;
  elements.btnVisualRecommendations.disabled = false;

  // Update screw adjustments
  const screwAdjustments = state.workflowData.screwAdjustments || [];
  if (screwAdjustments.length > 0) {
    elements.screwAdjustmentsList.innerHTML = screwAdjustments
      .filter((adj: ScrewAdjustment) => adj.requiresAdjustment)
      .map(
        (adj: ScrewAdjustment) => `
        <div class="adjustment-item">
          <span class="adjustment-corner">${formatCornerName(adj.corner)}</span>
          <span class="adjustment-value ${adj.direction === 'CW' ? 'cw' : 'ccw'}">
            ${adj.formattedAmount}
          </span>
        </div>
      `
      )
      .join('');
  } else {
    elements.screwAdjustmentsList.innerHTML = '<div class="adjustment-item">No adjustments needed</div>';
  }

  // Update tape recommendations
  const tapeRecs = state.workflowData.tapeRecommendations || [];
  if (tapeRecs.length > 0) {
    elements.tapeRecommendationsList.innerHTML = tapeRecs
      .map(
        (rec: TapeRecommendation) => `
        <div class="adjustment-item">
          <span class="adjustment-corner">${formatCornerName(rec.corner)}</span>
          <span class="adjustment-value">${rec.layers} layer${rec.layers !== 1 ? 's' : ''}</span>
        </div>
      `
      )
      .join('');
  } else {
    elements.tapeRecommendationsList.innerHTML = '<div class="adjustment-item">No tape needed</div>';
  }

  // Update improvement
  elements.improvementValue.textContent = `${state.workflowData.improvementPercent.toFixed(1)}%`;

  // Update workflow stages
  updateWorkflowStages();
}

function updateWorkflowStages(): void {
  const stages = elements.workflowStages.querySelectorAll('.workflow-stage');

  stages.forEach((stageEl) => {
    const stage = (stageEl as HTMLElement).dataset.stage;
    stageEl.classList.remove('active', 'completed');

    if (state.workflowData?.completedStages?.includes(stage as never)) {
      stageEl.classList.add('completed');
    }
    if (state.workflowData?.currentStage === stage) {
      stageEl.classList.add('active');
    }
  });
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

// ============================================================================
// Config File Handling
// ============================================================================

async function handleLoadConfigFile(): Promise<void> {
  try {
    setStatus('Opening file dialog...');
    const result = await window.calibration.openConfigFile();

    if (!result) {
      setStatus('File selection cancelled');
      return;
    }

    state.configContent = result.content;
    setStatus(`Loaded: ${result.filePath.split('/').pop()}`);

    // Get available profiles
    const profiles = await window.calibration.getProfiles(result.content);
    populateProfileSelect(profiles);

    // Load first profile
    if (profiles.length > 0) {
      await loadMeshProfile(profiles[0]);
    }
  } catch (error) {
    setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function handleFetchConfigSSH(): Promise<void> {
  if (!state.contextId) return;

  try {
    setStatus('Fetching config via SSH...');
    const overridePath = elements.sshConfigPath.value || undefined;
    const content = await window.calibration.sshFetchConfig(state.contextId, overridePath);
    state.configContent = content;

    const profiles = await window.calibration.getProfiles(content);
    populateProfileSelect(profiles);

    if (profiles.length > 0) {
      await loadMeshProfile(profiles[0]);
    }

    setStatus('Config fetched successfully');
  } catch (error) {
    setStatus(`SSH Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function populateProfileSelect(profiles: string[]): void {
  elements.meshProfileSelect.innerHTML = profiles.map((p) => `<option value="${p}">${p}</option>`).join('');
  elements.meshProfileSelect.disabled = profiles.length === 0;
}

async function handleProfileChange(): Promise<void> {
  const profile = elements.meshProfileSelect.value;
  if (profile) {
    await loadMeshProfile(profile);
  }
}

async function loadMeshProfile(profileName: string): Promise<void> {
  if (!state.contextId || !state.configContent) return;

  try {
    const workspace = await window.calibration.loadConfig(state.contextId, state.configContent, profileName);

    if (workspace?.meshData) {
      state.meshData = workspace.meshData;
      state.analysisResult = workspace.analysis;
      updateMeshDisplay();
      setStatus(`Loaded profile: ${profileName}`);
    }
  } catch (error) {
    setStatus(`Error loading profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Workflow
// ============================================================================

async function handleRunWorkflow(): Promise<void> {
  if (!state.contextId) return;

  try {
    setStatus('Running calibration workflow...');
    elements.btnRunWorkflow.disabled = true;

    const workflow = await window.calibration.computeWorkflow(state.contextId);

    if (workflow) {
      state.workflowData = workflow;
      updateAnalysisDisplay();
      setStatus('Workflow complete');

      // Save to history
      await window.calibration.addHistory(
        state.contextId,
        'bed_level',
        `Range: ${workflow.initialRange.toFixed(3)}mm → ${workflow.finalRange.toFixed(3)}mm`,
        workflow
      );
    }
  } catch (error) {
    setStatus(`Workflow error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    elements.btnRunWorkflow.disabled = false;
  }
}

function handleShowVisualRecommendations(): void {
  if (!state.workflowData) {
    setStatus('Run analysis to generate recommendations');
    return;
  }

  elements.visualRecOverlay.classList.remove('hidden');
  recommendationVisualizer?.setRecommendations(
    state.workflowData.screwAdjustments || [],
    state.workflowData.tapeRecommendations || []
  );
  recommendationVisualizer?.start();
}

function hideVisualRecommendations(): void {
  elements.visualRecOverlay.classList.add('hidden');
  recommendationVisualizer?.stop();
}

// ============================================================================
// Input Shaper
// ============================================================================

function switchAxis(axis: 'x' | 'y'): void {
  elements.btnAxisX.classList.toggle('active', axis === 'x');
  elements.btnAxisY.classList.toggle('active', axis === 'y');
  state.shaperResults.activeAxis = axis;
  updateShaperDisplay(state.shaperResults[axis]);
}

async function handleLoadShaperCSV(): Promise<void> {
  try {
    const result = await window.calibration.openShaperCSVFile();
    if (!result) {
      setStatus('File selection cancelled');
      return;
    }

    const axis = state.shaperResults.activeAxis;
    await analyzeShaperContent(result.content, axis);
    setStatus(`Loaded shaper CSV (${axis.toUpperCase()} axis)`);
  } catch (error) {
    setStatus(`Error loading CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function handleFetchShaperSSH(): Promise<void> {
  if (!state.contextId) return;

  try {
    const axis = state.shaperResults.activeAxis;
    setStatus(`Fetching ${axis.toUpperCase()} shaper data via SSH...`);
    const content = await window.calibration.sshFetchShaper(state.contextId, axis);
    await analyzeShaperContent(content, axis);
    setStatus(`Fetched shaper data (${axis.toUpperCase()} axis)`);
  } catch (error) {
    setStatus(`SSH Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function analyzeShaperContent(csvContent: string, axis: 'x' | 'y'): Promise<void> {
  try {
    setStatus('Analyzing input shaper data...');
    const calibration = await window.calibration.analyzeShaper(csvContent, axis);
    await setShaperCalibration(axis, calibration);
  } catch (error) {
    setStatus(`Shaper analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function setShaperCalibration(axis: 'x' | 'y', calibration: AxisCalibration): Promise<void> {
  state.shaperResults[axis] = calibration;
  if (axis === state.shaperResults.activeAxis) {
    updateShaperDisplay(calibration);
  }

  if (state.contextId) {
    const summary = `${axis.toUpperCase()}: ${calibration.recommendedShaper.type.toUpperCase()} @ ${calibration.recommendedShaper.frequency.toFixed(1)} Hz`;
    await window.calibration.addHistory(state.contextId, 'input_shaper', summary, calibration);
    await window.calibration.saveShaperResult(state.contextId, axis, calibration.recommendedShaper);
  }
}

function updateShaperDisplay(calibration: AxisCalibration | null): void {
  shaperVisualizer?.setCalibration(calibration);

  if (!calibration) {
    elements.shaperRecommendation.innerHTML = `
      <div class="shaper-empty-state">
        Load accelerometer data to see recommendations
      </div>
    `;
    elements.shaperComparisonList.innerHTML = `
      <div class="shaper-empty-state">
        No data loaded
      </div>
    `;
    void updateShaperConfigOutput(null);
    return;
  }

  const rec = calibration.recommendedShaper;
  elements.shaperRecommendation.innerHTML = `
    <div class="shaper-item recommended">
      <div class="shaper-name">${rec.type.toUpperCase()}</div>
      <div class="shaper-freq">${rec.frequency.toFixed(1)} Hz</div>
    </div>
    <div class="shaper-details">
      <div>Vibration reduction: ${(rec.vibrationReduction * 100).toFixed(1)}%</div>
      <div>Smoothing: ${rec.smoothingTime.toFixed(2)} ms</div>
      <div>Max accel: ${rec.maxAcceleration} mm/s²</div>
    </div>
  `;

  elements.shaperComparisonList.innerHTML = calibration.allShaperResults
    .map(
      (result) => `
        <div class="shaper-item ${result.type === rec.type ? 'recommended' : ''}">
          <div class="shaper-name">${result.type.toUpperCase()}</div>
          <div class="shaper-freq">${result.frequency.toFixed(1)} Hz</div>
        </div>
      `
    )
    .join('');

  void updateShaperConfigOutput(calibration);
}

async function updateShaperConfigOutput(calibration: AxisCalibration | null): Promise<void> {
  if (!calibration) {
    elements.shaperConfigOutput.textContent = 'Load data to generate config';
    elements.btnCopyShaperConfig.disabled = true;
    elements.btnSaveShaperConfig.disabled = true;
    elements.btnUploadShaperConfig.disabled = true;
    return;
  }

  const lines = await window.calibration.generateShaperConfig(calibration.axis, calibration.recommendedShaper);
  elements.shaperConfigOutput.textContent = lines.join('\n');
  elements.btnCopyShaperConfig.disabled = false;
  elements.btnSaveShaperConfig.disabled = false;
  elements.btnUploadShaperConfig.disabled = !state.sshConnected;
}

async function handleCopyShaperConfig(): Promise<void> {
  const text = elements.shaperConfigOutput.textContent || '';
  if (!text || text.includes('Load data')) {
    setStatus('No shaper config available');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus('Shaper config copied to clipboard');
  } catch (error) {
    setStatus(`Copy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function handleSaveShaperConfig(): Promise<void> {
  const calibration = state.shaperResults[state.shaperResults.activeAxis];
  if (!calibration) {
    setStatus('No shaper data to export');
    return;
  }

  try {
    const content = await buildShaperConfigContent(calibration.axis, calibration);
    const filePath = await window.calibration.saveConfig(content, `input_shaper_${calibration.axis}.cfg`);
    if (filePath) {
      setStatus(`Config saved to: ${filePath.split('/').pop()}`);
    }
  } catch (error) {
    setStatus(`Export error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function handleUploadShaperConfig(): Promise<void> {
  if (!state.contextId) return;

  const calibration = state.shaperResults[state.shaperResults.activeAxis];
  if (!calibration) {
    setStatus('No shaper data to upload');
    return;
  }

  if (!state.configContent) {
    setStatus('Load or fetch printer.cfg before uploading');
    return;
  }

  try {
    const content = await buildShaperConfigContent(calibration.axis, calibration);
    const remotePath = elements.sshConfigPath.value || undefined;
    const result = await window.calibration.sshUploadConfig(state.contextId, content, remotePath);
    if (result.success) {
      state.configContent = content;
      setStatus('Config uploaded via SSH');
    } else {
      setStatus(`Upload failed: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    setStatus(`Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function buildShaperConfigContent(axis: 'x' | 'y', calibration: AxisCalibration): Promise<string> {
  const lines = await window.calibration.generateShaperConfig(axis, calibration.recommendedShaper);
  if (!state.configContent) {
    return lines.join('\n');
  }

  return applyShaperConfigToPrinterConfig(state.configContent, axis, lines);
}

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

// ============================================================================
// SSH
// ============================================================================

async function updateSSHStatus(): Promise<void> {
  if (!state.contextId) return;

  try {
    const connected = await window.calibration.sshIsConnected(state.contextId);
    state.sshConnected = connected;

    const statusDot = elements.sshStatusIndicator.querySelector('.ssh-status-dot');
    const statusText = elements.sshStatusIndicator.querySelector('.ssh-status-text');

    if (statusDot && statusText) {
      statusDot.classList.toggle('connected', connected);
      statusText.textContent = connected ? 'SSH: Connected' : 'SSH: Disconnected';
    }

    elements.btnSSHConnect.disabled = connected;
    elements.btnSSHDisconnect.disabled = !connected;
    elements.btnFetchSSH.disabled = !connected;
    elements.btnFetchShaperSSH.disabled = !connected;
    elements.btnUploadShaperConfig.disabled = !connected || !state.shaperResults[state.shaperResults.activeAxis];
  } catch (error) {
    console.error('Failed to get SSH status:', error);
  }
}

async function handleSSHConnect(): Promise<void> {
  if (!state.contextId) return;

  const config = buildSSHConfig();
  if (!config.host) {
    setSSHResult('Printer IP unavailable. Connect a printer first.', 'error');
    return;
  }

  try {
    elements.btnSSHConnect.disabled = true;
    setSSHResult('Connecting...', 'info');

    await window.calibration.sshConnect(state.contextId, config);

    setSSHResult('Connected successfully!', 'success');
    await persistSSHSettings();
    await updateSSHStatus();
  } catch (error) {
    setSSHResult(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    elements.btnSSHConnect.disabled = false;
  }
}

async function handleSSHDisconnect(): Promise<void> {
  if (!state.contextId) return;

  try {
    await window.calibration.sshDisconnect(state.contextId);
    setSSHResult('Disconnected', 'info');
    await updateSSHStatus();
  } catch (error) {
    setSSHResult(`Disconnect error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
  }
}

async function handleSSHTest(): Promise<void> {
  if (!state.contextId) return;

  const config = buildSSHConfig();
  if (!config.host) {
    setSSHResult('Printer IP unavailable. Connect a printer first.', 'error');
    return;
  }

  try {
    elements.btnSSHTest.disabled = true;
    setSSHResult('Testing connection...', 'info');

    await window.calibration.sshConnect(state.contextId, config);
    const result = await window.calibration.sshExecute(state.contextId, 'echo "Connection test"');

    if (result.success) {
      setSSHResult('Connection test successful!', 'success');
    } else {
      setSSHResult(`Command failed: ${result.error || result.stderr}`, 'error');
    }

    await updateSSHStatus();
    await persistSSHSettings();
  } catch (error) {
    setSSHResult(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
  } finally {
    elements.btnSSHTest.disabled = false;
  }
}

function setSSHResult(message: string, type: 'success' | 'error' | 'info'): void {
  elements.sshTestResult.textContent = message;
  elements.sshTestResult.className = 'ssh-test-result';
  if (type !== 'info') {
    elements.sshTestResult.classList.add(type);
  }
}

function resolveSSHHost(): string {
  return state.contextIp?.trim() || elements.sshHost.value.trim();
}

function buildSSHConfig(): SSHConnectionConfig {
  const password = elements.sshPassword.value.trim();
  const keyPath = elements.sshKeyPath.value.trim();

  return {
    host: resolveSSHHost(),
    port: 22,
    username: elements.sshUsername.value.trim() || 'root',
    password: password.length > 0 ? password : undefined,
    privateKey: keyPath.length > 0 ? keyPath : undefined,
    timeout: 10000,
    keepaliveInterval: 10000,
  };
}

async function persistSSHSettings(): Promise<void> {
  if (!state.contextId) return;

  if (!elements.sshSaveCredentials.checked) {
    await window.calibration.clearSSHConfig(state.contextId);
    return;
  }

  await window.calibration.saveSSHConfig(state.contextId, {
    host: resolveSSHHost(),
    port: 22,
    username: elements.sshUsername.value.trim() || 'root',
    password: elements.sshPassword.value,
    keyPath: elements.sshKeyPath.value.trim(),
    configPath: elements.sshConfigPath.value.trim(),
    saveCredentials: true,
  });
}

async function handleBrowseSSHKey(): Promise<void> {
  try {
    const result = await window.calibration.openSSHKeyFile();
    if (result?.filePath) {
      elements.sshKeyPath.value = result.filePath;
    }
  } catch (error) {
    setStatus(`Failed to select key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function handleSSHSaveToggle(): Promise<void> {
  if (!state.contextId) return;
  await persistSSHSettings();
}

// ============================================================================
// History
// ============================================================================

async function loadHistory(): Promise<void> {
  if (!state.contextId) return;

  try {
    const history = await window.calibration.getHistory(state.contextId);

    if (history.length === 0) {
      elements.historyList.innerHTML = `
        <div class="history-empty-state">
          No calibration history for this printer
        </div>
      `;
      return;
    }

    elements.historyList.innerHTML = history
      .map(
        (entry: CalibrationHistoryEntry) => `
        <div class="history-item">
          <div class="history-item-main">
            <span class="history-item-type">${entry.type === 'bed_level' ? 'Bed Leveling' : 'Input Shaper'}</span>
            <span class="history-item-summary">${entry.summary}</span>
            <span class="history-item-date">${new Date(entry.timestamp).toLocaleString()}</span>
          </div>
        </div>
      `
      )
      .join('');
  } catch (error) {
    console.error('Failed to load history:', error);
  }
}

async function handleClearHistory(): Promise<void> {
  if (!state.contextId) return;

  if (!confirm('Are you sure you want to clear calibration history?')) {
    return;
  }

  try {
    await window.calibration.clearHistory(state.contextId);
    await loadHistory();
    setStatus('History cleared');
  } catch (error) {
    setStatus(`Error clearing history: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Export
// ============================================================================

async function handleExport(): Promise<void> {
  if (!state.contextId) return;
  if (!state.meshData) {
    setStatus('Load mesh data before exporting a report');
    return;
  }

  try {
    const format = (elements.exportFormat?.value || 'json') as 'json' | 'csv' | 'png' | 'pdf';
    const filePath = await window.calibration.saveReport(state.contextId, format);
    if (filePath) {
      setStatus(`Report saved to: ${filePath.split('/').pop()}`);
    }
  } catch (error) {
    setStatus(`Export error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Status
// ============================================================================

function setStatus(message: string): void {
  elements.statusMessage.textContent = message;
}

// ============================================================================
// Start
// ============================================================================

initialize().catch(console.error);
