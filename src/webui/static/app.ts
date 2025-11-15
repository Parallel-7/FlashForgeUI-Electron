/**
 * @fileoverview Browser-based WebUI client application for remote printer control and monitoring.
 *
 * Provides comprehensive browser interface for remote FlashForge printer control including
 * authentication with token persistence, real-time WebSocket communication for status updates,
 * printer control operations (temperature, job management, LED, filtration), multi-printer
 * context switching, camera stream viewing (MJPEG and RTSP with JSMpeg), file selection dialogs,
 * and responsive UI updates. Implements automatic reconnection logic, keep-alive ping mechanisms,
 * and graceful degradation when features are unavailable. All communication uses type-safe
 * interfaces with proper error handling and user feedback via toast notifications.
 *
 * Key features:
 * - Authentication: Login with remember-me, token persistence in localStorage/sessionStorage
 * - WebSocket: Real-time status updates, command execution, automatic reconnection
 * - Printer control: Temperature set/off, job pause/resume/cancel, home axes, LED control
 * - Multi-printer: Context switching with dynamic UI updates and feature detection
 * - Camera: MJPEG proxy streaming and RTSP streaming via JSMpeg with WebSocket
 * - File management: Recent/local file browsing, file selection dialogs, job start with options
 * - Material matching: AD5X multi-color job mapping to material station slots prior to start
 * - UI updates: Real-time temperature, progress, layer info, ETA, lifetime statistics, thumbnails
 */

import {
  getCurrentSettings,
  getMaterialMatchingState,
  isGridInitialized,
  setMaterialMatchingState,
  state,
} from './core/AppState.js';
import {
  apiRequest,
  apiRequestWithMetadata,
  connectWebSocket,
  disconnectWebSocket,
  onConnectionChange,
  onSpoolmanUpdate,
  onStatusUpdate,
  sendCommand,
} from './core/Transport.js';
import { $, hideElement, setTextContent, showElement, showToast } from './shared/dom.js';
import {
  buildMaterialBadgeTooltip,
  colorsDiffer,
  formatETA,
  formatJobPrintingTime,
  formatLifetimeFilament,
  formatLifetimePrintTime,
  formatTime,
  isAD5XJobFile,
  isMultiColorJobFile,
  materialsMatch,
} from './shared/formatting.js';
import { hydrateLucideIcons, initializeLucideIcons } from './shared/icons.js';
import {
  applySettings,
  ensureSpoolmanVisibilityIfEnabled,
  initializeLayout,
  isSpoolmanAvailableForCurrentContext,
  loadWebUITheme,
  refreshSettingsUI,
  setupLayoutEventHandlers,
  setupViewportListener,
} from './features/layout-theme.js';
import { setupAuthEventHandlers, loadAuthStatus, checkAuthStatus } from './features/authentication.js';
import {
  fetchPrinterContexts,
  getCurrentContextId,
  initializeContextSwitching,
  setupContextEventHandlers,
} from './features/context-switching.js';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface AuthResponse {
  success: boolean;
  token?: string;
  message?: string;
}

export interface AuthStatusResponse {
  authRequired: boolean;
  hasPassword: boolean;
  defaultPassword: boolean;
}

export interface WebSocketMessage {
  type: 'AUTH_SUCCESS' | 'STATUS_UPDATE' | 'ERROR' | 'COMMAND_RESULT' | 'PONG' | 'SPOOLMAN_UPDATE';
  timestamp: string;
  status?: PrinterStatus;
  error?: string;
  clientId?: string;
  command?: string;
  success?: boolean;
  contextId?: string;
  spool?: ActiveSpoolData | null;
}

export interface WebSocketCommand {
  command: 'REQUEST_STATUS' | 'EXECUTE_GCODE' | 'PING';
  gcode?: string;
  data?: unknown;
}

export interface PrinterStatus {
  printerState: string;
  bedTemperature: number;
  bedTargetTemperature: number;
  nozzleTemperature: number;
  nozzleTargetTemperature: number;
  progress: number;
  currentLayer?: number;
  totalLayers?: number;
  jobName?: string;
  timeElapsed?: number;
  timeRemaining?: number;
  filtrationMode?: 'external' | 'internal' | 'none';
  estimatedWeight?: number;
  estimatedLength?: number;
  thumbnailData?: string | null; // Base64 encoded thumbnail
  cumulativeFilament?: number; // Total lifetime filament usage in meters
  cumulativePrintTime?: number; // Total lifetime print time in minutes
}

export interface PrinterFeatures {
  hasCamera: boolean;
  hasLED: boolean;
  hasFiltration: boolean;
  hasMaterialStation: boolean;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  ledUsesLegacyAPI?: boolean; // Whether custom LED control is enabled
}

export interface AD5XToolData {
  toolId: number;
  materialName: string;
  materialColor: string;
  filamentWeight: number;
  slotId?: number | null;
}

export type JobMetadataType = 'basic' | 'ad5x';

export interface WebUIJobFile {
  fileName: string;
  displayName: string;
  printingTime?: number;
  metadataType?: JobMetadataType;
  toolCount?: number;
  toolDatas?: AD5XToolData[];
  totalFilamentWeight?: number;
  useMatlStation?: boolean;
}

// API Response interfaces
export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export type PrinterCommandResponse = ApiResponse;

export interface PrinterFeaturesResponse extends ApiResponse {
  features?: PrinterFeatures;
}

export interface CameraProxyConfigResponse extends ApiResponse {
  streamType?: 'mjpeg' | 'rtsp';
  port?: number;  // For MJPEG camera proxy
  wsPort?: number;  // For RTSP WebSocket port
  url?: string;
  wsPath?: string;
  ffmpegAvailable?: boolean;
}

export interface FileListResponse extends ApiResponse {
  files?: WebUIJobFile[];
  totalCount?: number;
}

export type PrintJobStartResponse = ApiResponse;

export interface PrinterContext {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  serialNumber: string;
  isActive: boolean;
}

export interface ContextsResponse extends ApiResponse {
  contexts?: PrinterContext[];
  activeContextId?: string;
}

export interface WebUISettings {
  visibleComponents: string[];
  editMode: boolean;
}

export interface MaterialSlotInfo {
  slotId: number;
  isEmpty: boolean;
  materialType: string | null;
  materialColor: string | null;
}

export interface MaterialStationStatus {
  connected: boolean;
  slots: MaterialSlotInfo[];
  activeSlot: number | null;
  overallStatus: 'ready' | 'warming' | 'error' | 'disconnected';
  errorMessage: string | null;
}

export interface MaterialStationStatusResponse extends ApiResponse {
  status?: MaterialStationStatus | null;
}

export interface MaterialMapping {
  toolId: number;
  slotId: number;
  materialName: string;
  toolMaterialColor: string;
  slotMaterialColor: string;
}

export interface PendingJobStart {
  filename: string;
  leveling: boolean;
  startNow: boolean;
  job: WebUIJobFile | undefined;
}

export type MaterialMessageType = 'error' | 'warning';

// Spoolman types
export interface ActiveSpoolData {
  id: number;
  name: string;
  vendor: string | null;
  material: string | null;
  colorHex: string;
  remainingWeight: number;
  remainingLength: number;
  lastUpdated: string;
}

export interface SpoolSummary {
  readonly id: number;
  readonly name: string;
  readonly vendor: string | null;
  readonly material: string | null;
  readonly colorHex: string;
  readonly remainingWeight: number;
  readonly remainingLength: number;
  readonly archived: boolean;
}

export interface SpoolmanConfigResponse extends ApiResponse {
  enabled: boolean;
  disabledReason?: string | null;
  serverUrl: string;
  updateMode: 'length' | 'weight';
  contextId: string | null;
}

export interface ActiveSpoolResponse extends ApiResponse {
  spool: ActiveSpoolData | null;
}

export interface SpoolSearchResponse extends ApiResponse {
  spools: SpoolSummary[];
}

export interface SpoolSelectResponse extends ApiResponse {
  spool: ActiveSpoolData;
}

// Extended HTMLElement for temperature dialog
interface TemperatureDialogElement extends HTMLElement {
  temperatureType?: 'bed' | 'extruder';
}

function hasMaterialStationSupport(): boolean {
  return Boolean(state.printerFeatures?.hasMaterialStation);
}

// ============================================================================
// GRID AND SETTINGS MANAGEMENT
// ============================================================================

// ============================================================================
// UI UPDATES
// ============================================================================


function updateConnectionStatus(connected: boolean): void {
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

onConnectionChange((connected) => {
  updateConnectionStatus(connected);
});

onStatusUpdate((status) => {
  updatePrinterStatus(status);
});

onSpoolmanUpdate((contextId, spool) => {
  if (contextId === getCurrentContextId()) {
    state.activeSpool = spool;
    updateSpoolmanPanelState();
  }
});

function updatePrinterStatus(status: PrinterStatus | null): void {
  if (!status) {
    // Handle null status
    updatePrinterStateCard(null);
    setTextContent('bed-temp', '--°C / --°C');
    setTextContent('extruder-temp', '--°C / --°C');
    setTextContent('current-job', 'No data');
    setTextContent('progress-percentage', '0%');
    updateModelPreview(null);
    return;
  }
  
  state.printerStatus = status;
  
  // Update printer state card with lifetime statistics
  updatePrinterStateCard(status);
  
  // Update temperatures with null checks and NaN prevention
  const bedTemp = isNaN(status.bedTemperature) ? 0 : Math.round(status.bedTemperature);
  const bedTarget = isNaN(status.bedTargetTemperature) ? 0 : Math.round(status.bedTargetTemperature);
  const extruderTemp = isNaN(status.nozzleTemperature) ? 0 : Math.round(status.nozzleTemperature);
  const extruderTarget = isNaN(status.nozzleTargetTemperature) ? 0 : Math.round(status.nozzleTargetTemperature);
  
  setTextContent('bed-temp', `${bedTemp}°C / ${bedTarget}°C`);
  setTextContent('extruder-temp', `${extruderTemp}°C / ${extruderTarget}°C`);
  
  // Update job info
  if (status.jobName) {
    setTextContent('current-job', status.jobName);
    
    // Progress with null check and NaN prevention
    const progress = isNaN(status.progress) ? 0 : status.progress;
    const progressPercent = progress <= 1 ? Math.round(progress * 100) : Math.round(progress);
    setTextContent('progress-percentage', `${progressPercent}%`);
    
    const progressBar = $('progress-bar') as HTMLProgressElement;
    if (progressBar) {
      progressBar.value = progressPercent;
    }
    
    // Update layer info with null checks
    if (status.currentLayer !== undefined && status.totalLayers !== undefined && 
        !isNaN(status.currentLayer) && !isNaN(status.totalLayers)) {
      setTextContent('layer-info', `${status.currentLayer} / ${status.totalLayers}`);
    } else {
      setTextContent('layer-info', '-- / --');
    }
    
    // Update times with null checks
    if (status.timeElapsed !== undefined && !isNaN(status.timeElapsed)) {
      setTextContent('elapsed-time', formatTime(status.timeElapsed));
    } else {
      setTextContent('elapsed-time', '--:--');
    }
    
    if (status.timeRemaining !== undefined && !isNaN(status.timeRemaining)) {
      setTextContent('time-remaining', formatETA(status.timeRemaining));
    } else {
      setTextContent('time-remaining', '--:--');
    }
    
    // Update filament usage with combined display (matches main UI format: "17.42 m • 51.95 g")
    let lengthText = '';
    let weightText = '';

    if (status.estimatedLength !== undefined && !isNaN(status.estimatedLength)) {
      lengthText = `${status.estimatedLength.toFixed(2)} m`;
    }

    if (lengthText && status.estimatedWeight !== undefined && !isNaN(status.estimatedWeight)) {
      weightText = ` • ${status.estimatedWeight.toFixed(2)} g`;
    }

    setTextContent('job-filament-usage', lengthText + weightText || '--');
    
    // Update model preview thumbnail
    updateModelPreview(status.thumbnailData);
  } else {
    setTextContent('current-job', 'No active job');
    setTextContent('progress-percentage', '0%');
    const progressBar = $('progress-bar') as HTMLProgressElement;
    if (progressBar) {
      progressBar.value = 0;
    }
    setTextContent('layer-info', '-- / --');
    setTextContent('elapsed-time', '--:--');
    setTextContent('time-remaining', '--:--');
    setTextContent('job-filament-usage', '--');
    
    // Clear model preview when no job
    updateModelPreview(null);
  }
  
  // Update button states based on printer state
  updateButtonStates(status.printerState || 'Unknown');
  
  // Update filtration status if available
  updateFiltrationStatus(status.filtrationMode);
}

function updateButtonStates(printerState: string): void {
  const isPrintingActive = printerState === 'Printing' || 
                          printerState === 'Paused' ||
                          printerState === 'Calibrating' ||
                          printerState === 'Heating' ||
                          printerState === 'Pausing';
                          
  const isReadyForNewJob = printerState === 'Ready' || 
                          printerState === 'Completed' ||
                          printerState === 'Cancelled';
                          
  const canControlJob = printerState === 'Printing' ||
                       printerState === 'Paused' ||
                       printerState === 'Heating' ||
                       printerState === 'Calibrating';
                       
  const isBusy = printerState === 'Busy' || printerState === 'Error';
  
  // Pause/Resume buttons
  const pauseBtn = $('btn-pause') as HTMLButtonElement;
  const resumeBtn = $('btn-resume') as HTMLButtonElement;
  const cancelBtn = $('btn-cancel') as HTMLButtonElement;
  
  if (pauseBtn) pauseBtn.disabled = printerState !== 'Printing';
  if (resumeBtn) resumeBtn.disabled = printerState !== 'Paused';
  if (cancelBtn) cancelBtn.disabled = !canControlJob;
  
  // File selection buttons and Home Axes button
  const recentBtn = $('btn-start-recent') as HTMLButtonElement;
  const localBtn = $('btn-start-local') as HTMLButtonElement;
  const homeAxesBtn = $('btn-home-axes') as HTMLButtonElement;
  
  if (recentBtn) recentBtn.disabled = !isReadyForNewJob;
  if (localBtn) localBtn.disabled = !isReadyForNewJob;
  if (homeAxesBtn) homeAxesBtn.disabled = isPrintingActive;
  
  // Temperature control buttons - disable during active states or when disconnected
  const bedSetBtn = $('btn-bed-set') as HTMLButtonElement;
  const bedOffBtn = $('btn-bed-off') as HTMLButtonElement;
  const extruderSetBtn = $('btn-extruder-set') as HTMLButtonElement;
  const extruderOffBtn = $('btn-extruder-off') as HTMLButtonElement;
  
  const tempButtonsDisabled = isPrintingActive || isBusy;
  if (bedSetBtn) bedSetBtn.disabled = tempButtonsDisabled;
  if (bedOffBtn) bedOffBtn.disabled = tempButtonsDisabled;
  if (extruderSetBtn) extruderSetBtn.disabled = tempButtonsDisabled;
  if (extruderOffBtn) extruderOffBtn.disabled = tempButtonsDisabled;
}

function updatePrinterStateCard(status: PrinterStatus | null): void {
  // Update printer status
  if (status && status.printerState) {
    setTextContent('printer-status', status.printerState);
  } else {
    setTextContent('printer-status', 'Unknown');
  }
  
  // Update lifetime print time
  if (status && status.cumulativePrintTime !== undefined) {
    const formattedTime = formatLifetimePrintTime(status.cumulativePrintTime);
    setTextContent('lifetime-print-time', formattedTime);
  } else {
    setTextContent('lifetime-print-time', '--');
  }
  
  // Update lifetime filament usage
  if (status && status.cumulativeFilament !== undefined) {
    const formattedFilament = formatLifetimeFilament(status.cumulativeFilament);
    setTextContent('lifetime-filament', formattedFilament);
  } else {
    setTextContent('lifetime-filament', '--');
  }
}

// ============================================================================
// PRINTER CONTROLS
// ============================================================================


async function sendPrinterCommand(endpoint: string, data?: unknown): Promise<void> {
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

async function loadPrinterFeatures(): Promise<void> {
  if (state.authRequired && !state.authToken) return;
  
  try {
    const result = await apiRequest<PrinterFeaturesResponse>('/api/printer/features');
    
    if (result.success && result.features) {
      state.printerFeatures = result.features;
      updateFeatureVisibility();
      const settings = getCurrentSettings();
      applySettings(settings);
      refreshSettingsUI(settings);

      if (state.printerFeatures.hasCamera && isGridInitialized()) {
        const cameraPlaceholder = $('camera-placeholder');
        const cameraStream = $('camera-stream');
        if (cameraPlaceholder && cameraStream) {
          void loadCameraStream();
        }
      }
    }
  } catch (error) {
    console.error('Failed to load printer features:', error);
  }
}

function updateFeatureVisibility(): void {
  if (!state.printerFeatures) return;

  // LED controls - enable if printer has built-in LEDs OR custom LED control is enabled
  const ledOn = $('btn-led-on') as HTMLButtonElement;
  const ledOff = $('btn-led-off') as HTMLButtonElement;
  const ledEnabled = state.printerFeatures.hasLED || state.printerFeatures.ledUsesLegacyAPI || false;
  if (ledOn) ledOn.disabled = !ledEnabled;
  if (ledOff) ledOff.disabled = !ledEnabled;
}

// ============================================================================
// SPOOLMAN INTEGRATION
// ============================================================================

async function loadSpoolmanConfig(): Promise<void> {
  if (state.authRequired && !state.authToken) return;

  try {
    const result = await apiRequest<SpoolmanConfigResponse>('/api/spoolman/config');

    if (result.success) {
      state.spoolmanConfig = result;
      console.log('[Spoolman] Config loaded:', result);

      // Load active spool using contextId from response
      if (result.enabled && result.contextId) {
        await fetchActiveSpoolForContext(result.contextId);
      }

      // Re-apply component visibility and UI state since availability may have changed
      const settings = getCurrentSettings();
      applySettings(settings);
      refreshSettingsUI(settings);
      updateSpoolmanPanelState();
    }
  } catch (error) {
    console.error('[Spoolman] Failed to load config:', error);
  }
}

async function fetchActiveSpoolForContext(contextId?: string): Promise<void> {
  if (!state.spoolmanConfig?.enabled) return;

  const targetContextId = contextId ?? getCurrentContextId();
  if (!targetContextId) {
    console.warn('[Spoolman] Cannot fetch active spool: no context ID available');
    return;
  }

  console.log(`[Spoolman] Fetching active spool for context: ${targetContextId}`);

  try {
    const result = await apiRequest<ActiveSpoolResponse>(
      `/api/spoolman/active/${encodeURIComponent(targetContextId)}`,
    );

    if (result.success) {
      state.activeSpool = result.spool;
      console.log('[Spoolman] Active spool loaded:', result.spool ? `${result.spool.name} (ID: ${result.spool.id})` : 'none');
      updateSpoolmanPanelState();
    } else {
      console.warn('[Spoolman] No active spool or error:', result.error);
    }
  } catch (error) {
    console.error('[Spoolman] Failed to fetch active spool:', error);
  }
}

let spoolSearchDebounceTimer: number | null = null;

async function fetchSpools(searchQuery: string = ''): Promise<void> {
  if (!state.spoolmanConfig?.enabled) return;

  try {
    showElement('spoolman-loading');
    hideElement('spoolman-no-results');

    // Stage 1: Try server-side search with filament.name filter
    const url = `/api/spoolman/spools${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`;
    const result = await apiRequest<SpoolSearchResponse>(url);

    if (result.success && result.spools) {
      let displaySpools = result.spools;

      // Stage 2: If server-side search returned no results and we have a query,
      // fetch all spools and filter client-side for vendor/material matching
      if (displaySpools.length === 0 && searchQuery && searchQuery.trim()) {
        console.log('[Spoolman] Server search returned no results, trying client-side fallback');

        // Fetch all spools without filter
        const allSpoolsResult = await apiRequest<SpoolSearchResponse>('/api/spoolman/spools');

        if (allSpoolsResult.success && allSpoolsResult.spools) {
          // Filter client-side across name, vendor, and material
          const query = searchQuery.toLowerCase();
          displaySpools = allSpoolsResult.spools.filter((spool) => {
            const name = spool.name?.toLowerCase() || '';
            const vendor = spool.vendor?.toLowerCase() || '';
            const material = spool.material?.toLowerCase() || '';
            return name.includes(query) || vendor.includes(query) || material.includes(query);
          });

          console.log(`[Spoolman] Client-side filter found ${displaySpools.length} matches`);
        }
      }

      // Update state with final filtered results
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

async function selectSpool(spoolId: number): Promise<void> {
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

async function clearActiveSpool(): Promise<void> {
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

function updateSpoolmanPanelState(): void {
  const disabled = $('spoolman-disabled');
  const noSpool = $('spoolman-no-spool');
  const active = $('spoolman-active');

  if (!disabled || !noSpool || !active) return;

  // State 1: Disabled or unavailable for this context
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

  // State 2: No spool selected
  if (!state.activeSpool) {
    hideElement('spoolman-disabled');
    showElement('spoolman-no-spool');
    hideElement('spoolman-active');
    return;
  }

  // State 3: Active spool
  hideElement('spoolman-disabled');
  hideElement('spoolman-no-spool');
  showElement('spoolman-active');

  // Update spool display
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
    const parts = [];
    if (state.activeSpool.vendor) parts.push(state.activeSpool.vendor);
    if (state.activeSpool.material) parts.push(state.activeSpool.material);
    spoolMeta.textContent = parts.join(' • ') || '--';
  }

  if (spoolRemaining) {
    const remaining = state.spoolmanConfig?.updateMode === 'weight'
      ? `${state.activeSpool.remainingWeight.toFixed(0)}g`
      : `${(state.activeSpool.remainingLength / 1000).toFixed(1)}m`;
    spoolRemaining.textContent = remaining;
  }
}

function openSpoolSelectionModal(): void {
  if (!state.spoolmanConfig?.enabled) {
    showToast('Spoolman integration is disabled', 'error');
    return;
  }

  const modal = $('spoolman-modal');
  if (!modal) return;

  // Clear search input
  const searchInput = $('spoolman-search') as HTMLInputElement;
  if (searchInput) {
    searchInput.value = '';
  }

  // Load all spools
  void fetchSpools('');

  showElement('spoolman-modal');
}

function closeSpoolSelectionModal(): void {
  const modal = $('spoolman-modal');
  if (!modal) return;

  hideElement('spoolman-modal');

  // Clear search and results
  const searchInput = $('spoolman-search') as HTMLInputElement;
  if (searchInput) {
    searchInput.value = '';
  }
  state.availableSpools = [];
  renderSpoolList([]);
}

function renderSpoolList(spools: SpoolSummary[]): void {
  const listContainer = $('spoolman-spool-list');
  const noResults = $('spoolman-no-results');

  if (!listContainer || !noResults) return;

  listContainer.innerHTML = '';

  if (spools.length === 0) {
    showElement('spoolman-no-results');
    return;
  }

  hideElement('spoolman-no-results');

  spools.forEach((spool) => {
    const item = document.createElement('div');
    item.className = 'spoolman-spool-item';
    item.setAttribute('role', 'listitem');

    // Ensure colorHex has # prefix (Spoolman API returns without it)
    const colorHex = spool.colorHex
      ? (spool.colorHex.startsWith('#') ? spool.colorHex : `#${spool.colorHex}`)
      : '#808080';
    const name = spool.name || `Spool #${spool.id}`;
    const vendor = spool.vendor || '';
    const material = spool.material || '';
    const metaParts = [vendor, material].filter(Boolean);
    const meta = metaParts.join(' • ') || 'Unknown';

    const remainingWeight = spool.remainingWeight || 0;
    const remainingLength = spool.remainingLength || 0;
    const remaining = state.spoolmanConfig?.updateMode === 'weight'
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

function handleSpoolSearch(event: Event): void {
  const input = event.target as HTMLInputElement;
  const query = input.value.trim();

  // Debounce search
  if (spoolSearchDebounceTimer !== null) {
    clearTimeout(spoolSearchDebounceTimer);
  }

  spoolSearchDebounceTimer = window.setTimeout(() => {
    void fetchSpools(query);
    spoolSearchDebounceTimer = null;
  }, 300);
}

function updateFiltrationStatus(mode?: 'external' | 'internal' | 'none'): void {
  if (!mode) return;
  
  // Update filtration status display
  const filtrationStatusEl = $('filtration-status');
  if (filtrationStatusEl) {
    const modeLabels = {
      'external': 'External',
      'internal': 'Internal',
      'none': 'Off'
    };
    filtrationStatusEl.textContent = modeLabels[mode] || 'Off';
  }
  
  // Update button states to show which mode is active
  const externalBtn = $('btn-external-filtration') as HTMLButtonElement;
  const internalBtn = $('btn-internal-filtration') as HTMLButtonElement;
  const offBtn = $('btn-no-filtration') as HTMLButtonElement;
  
  // Remove active class from all buttons
  if (externalBtn) externalBtn.classList.remove('active');
  if (internalBtn) internalBtn.classList.remove('active');
  if (offBtn) offBtn.classList.remove('active');
  
  // Add active class to current mode button
  switch (mode) {
    case 'external':
      if (externalBtn) externalBtn.classList.add('active');
      break;
    case 'internal':
      if (internalBtn) internalBtn.classList.add('active');
      break;
    case 'none':
      if (offBtn) offBtn.classList.add('active');
      break;
  }
}

function updateModelPreview(thumbnailData?: string | null): void {
  const previewContainer = document.querySelector<HTMLElement>(
    '[data-component-id="model-preview"] .panel-content',
  );
  if (!previewContainer) return;

  if (thumbnailData) {
    // Clear existing content
    previewContainer.innerHTML = '';
    
    // Create image element
    const img = document.createElement('img');
    
    // Check if thumbnailData already has data URL prefix
    // Backend methods may return data with or without the prefix
    let imageUrl: string;
    if (thumbnailData.startsWith('data:image/')) {
      // Data already has proper data URL prefix
      imageUrl = thumbnailData;
    } else {
      // Raw base64 data, add the prefix
      imageUrl = `data:image/png;base64,${thumbnailData}`;
    }
    
    img.src = imageUrl;
    img.alt = 'Model preview';
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';
    
    // Handle load errors
    img.onerror = () => {
      console.error('Failed to load model preview. Image URL length:', imageUrl.length);
      previewContainer.innerHTML = '<div class="no-preview">Preview load failed</div>';
    };
    
    previewContainer.appendChild(img);
  } else {
    // Show no preview message
    previewContainer.innerHTML = '<div class="no-preview">No preview available</div>';
  }
}

async function loadCameraStream(): Promise<void> {
  const cameraPlaceholder = $('camera-placeholder');
  const cameraStream = $('camera-stream') as HTMLImageElement;
  
  if (!cameraPlaceholder || !cameraStream) {
    console.error('Camera elements not found');
    return;
  }

  if (state.authRequired && !state.authToken) {
    console.warn('Skipping camera stream load due to missing auth token');
    return;
  }
  
  try {
    const config = await apiRequest<CameraProxyConfigResponse>('/api/camera/proxy-config');

    // Handle RTSP cameras with JSMpeg player
    if (config.streamType === 'rtsp') {
      console.log('RTSP camera detected - setting up JSMpeg player');

      if (config.ffmpegAvailable === false) {
        showElement('camera-placeholder');
        hideElement('camera-stream');
        if (cameraPlaceholder) {
          cameraPlaceholder.textContent = 'RTSP Camera: ffmpeg required for browser viewing';
        }
        return;
      }

      if (!config.wsPort) {
        throw new Error('No WebSocket port provided for RTSP stream');
      }

      // Setup JSMpeg player for RTSP stream
      const canvas = document.getElementById('camera-canvas') as HTMLCanvasElement;
      if (!canvas) {
        console.error('Camera canvas element not found');
        return;
      }

      // Construct WebSocket URL for node-rtsp-stream
      const wsUrl = `ws://${window.location.hostname}:${config.wsPort}`;
      console.log('Connecting to RTSP stream at:', wsUrl);

      // Hide img, show canvas
      hideElement('camera-stream');
      showElement('camera-canvas');
      hideElement('camera-placeholder');

      // Initialize JSMpeg player
      new JSMpeg.Player(wsUrl, {
        canvas: canvas,
        autoplay: true,
        audio: false,
        onSourceEstablished: () => {
          console.log('RTSP stream connected');
        },
        onSourceCompleted: () => {
          console.log('RTSP stream ended');
        }
      });

      return;
    }

    if (!config.url) {
      throw new Error('No camera URL provided by server');
    }

    const cameraUrl = config.url; // Use the URL from server response

    console.log('Loading camera stream from:', cameraUrl);

    // Set up the camera stream
    cameraStream.src = cameraUrl;
    
    // Handle successful load
    cameraStream.onload = () => {
      console.log('Camera stream connected');
      hideElement('camera-placeholder');
      showElement('camera-stream');
    };
    
    // Handle errors
    cameraStream.onerror = () => {
      console.error('Failed to load camera stream');
      showElement('camera-placeholder');
      hideElement('camera-stream');
      
      // Update placeholder text
      if (cameraPlaceholder) {
        cameraPlaceholder.textContent = 'Camera Stream Error';
      }
      
      // Retry after a delay
      setTimeout(() => {
        if (state.printerFeatures?.hasCamera) {
          console.log('Retrying camera stream...');
          cameraStream.src = cameraUrl + '?t=' + Date.now(); // Add timestamp to force reload
        }
      }, 5000);
    };
    
  } catch (error) {
    console.error('Failed to load camera proxy configuration:', error);
    showElement('camera-placeholder');
    hideElement('camera-stream');
    if (cameraPlaceholder) {
      cameraPlaceholder.textContent = 'Camera Configuration Error';
    }
  }
}

// ============================================================================
// FILE MANAGEMENT
// ============================================================================

async function loadFileList(source: 'recent' | 'local'): Promise<void> {
  if (state.authRequired && !state.authToken) return;
  
  try {
    const result = await apiRequest<FileListResponse>(`/api/jobs/${source}`);
    
    if (result.success && result.files) {
      state.jobMetadata.clear();
      result.files.forEach((file) => {
        state.jobMetadata.set(file.fileName, file);
      });
      showFileModal(result.files, source);
    } else {
      showToast('Failed to load files', 'error');
    }
  } catch (error) {
    console.error('Failed to load files:', error);
    showToast('Failed to load files', 'error');
  }
}

function showFileModal(files: WebUIJobFile[], source: 'recent' | 'local'): void {
  const modal = $('file-modal');
  const fileList = $('file-list');
  const title = $('modal-title');
  
  if (!modal || !fileList || !title) return;
  
  // Set title
  title.textContent = source === 'recent' ? 'Recent Files' : 'Local Files';
  
  // Clear and populate file list
  fileList.innerHTML = '';
  state.selectedFile = null;

  const printBtn = $('print-file-btn') as HTMLButtonElement | null;
  if (printBtn) {
    printBtn.disabled = true;
  }
  
  files.forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.filename = file.fileName;

    const header = document.createElement('div');
    header.className = 'file-item-header';

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.displayName || file.fileName;
    header.appendChild(name);

    if (isMultiColorJobFile(file)) {
      const badge = document.createElement('span');
      badge.className = 'file-badge multi-color';
      badge.textContent = 'Multi-color';
      badge.title = buildMaterialBadgeTooltip(file);
      header.appendChild(badge);
    }

    item.appendChild(header);

    const meta = document.createElement('div');
    meta.className = 'file-meta';

    const printingTimeLabel = formatJobPrintingTime(file.printingTime);
    if (printingTimeLabel) {
      const timeEl = document.createElement('span');
      timeEl.className = 'file-meta-item';
      timeEl.textContent = printingTimeLabel;
      meta.appendChild(timeEl);
    }

    if (file.metadataType === 'ad5x' && Array.isArray(file.toolDatas) && file.toolDatas.length > 0) {
      const requirementSummary = document.createElement('div');
      requirementSummary.className = 'material-preview';

      file.toolDatas.forEach((tool) => {
        const chip = document.createElement('div');
        chip.className = 'material-chip';

        const swatch = document.createElement('span');
        swatch.className = 'material-chip-swatch';
        if (tool.materialColor) {
          swatch.style.backgroundColor = tool.materialColor;
        }

        const label = document.createElement('span');
        label.className = 'material-chip-label';
        label.textContent = tool.materialName || `Tool ${tool.toolId + 1}`;

        chip.appendChild(swatch);
        chip.appendChild(label);
        requirementSummary.appendChild(chip);
      });

      meta.appendChild(requirementSummary);
    }

    if (meta.childElementCount > 0) {
      item.appendChild(meta);
    }

    item.addEventListener('click', () => {
      fileList.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      state.selectedFile = file.fileName;

      const printBtn = $('print-file-btn') as HTMLButtonElement;
      if (printBtn) printBtn.disabled = false;
    });

    fileList.appendChild(item);
  });
  
  // Show modal
  showElement('file-modal');
}

async function startPrintJob(): Promise<void> {
  if (!state.selectedFile || (state.authRequired && !state.authToken)) return;
  
  const autoLevel = ($('auto-level') as HTMLInputElement)?.checked ?? false;
  const startNow = ($('start-now') as HTMLInputElement)?.checked ?? true;
  const jobInfo = state.jobMetadata.get(state.selectedFile);

  // Show material matching dialog for ALL AD5X jobs (single and multi-color)
  // This ensures proper IFS slot mapping and prevents "materialMappings array cannot be empty" errors
  if (startNow && hasMaterialStationSupport() && isAD5XJobFile(jobInfo)) {
    state.pendingJobStart = {
      filename: state.selectedFile,
      leveling: autoLevel,
      startNow,
      job: jobInfo
    };
    await openMaterialMatchingModal();
    return;
  }

  const success = await sendJobStartRequest({
    filename: state.selectedFile,
    leveling: autoLevel,
    startNow,
    materialMappings: undefined
  });

  if (success) {
    hideElement('file-modal');
  }
}

interface StartJobOptions {
  filename: string;
  leveling: boolean;
  startNow: boolean;
  materialMappings?: MaterialMapping[];
}

async function sendJobStartRequest(options: StartJobOptions): Promise<boolean> {
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

function getMaterialMatchingElement<T extends HTMLElement>(id: string): T | null {
  return $(id) as T | null;
}

function getMaterialMessageElement(type: MaterialMessageType): HTMLDivElement | null {
  const id = type === 'error' ? 'material-matching-error' : 'material-matching-warning';
  return getMaterialMatchingElement<HTMLDivElement>(id);
}

function clearMaterialMessages(): void {
  (['error', 'warning'] as const).forEach((type) => {
    const messageEl = getMaterialMessageElement(type);
    if (messageEl) {
      messageEl.classList.add('hidden');
      messageEl.textContent = '';
    }
  });
}

function showMaterialError(text: string): void {
  const errorEl = getMaterialMessageElement('error');
  const warningEl = getMaterialMessageElement('warning');
  if (warningEl) {
    warningEl.classList.add('hidden');
    warningEl.textContent = '';
  }
  if (errorEl) {
    errorEl.textContent = text;
    errorEl.classList.remove('hidden');
  }
}

function showMaterialWarning(text: string): void {
  const warningEl = getMaterialMessageElement('warning');
  if (warningEl) {
    warningEl.textContent = text;
    warningEl.classList.remove('hidden');
  }
}

function updateMaterialMatchingConfirmState(): void {
  const confirmButton = getMaterialMatchingElement<HTMLButtonElement>('material-matching-confirm');
  if (!confirmButton) return;

  const matchingState = getMaterialMatchingState();
  if (!matchingState) {
    confirmButton.disabled = true;
    return;
  }

  const job = matchingState.pending.job;
  const requiredMappings = isAD5XJobFile(job) ? job.toolDatas.length : 0;
  confirmButton.disabled = matchingState.mappings.size !== requiredMappings;
}

function renderMaterialMappings(): void {
  const container = getMaterialMatchingElement<HTMLDivElement>('material-mappings');
  if (!container) return;

  container.innerHTML = '';

  const matchingState = getMaterialMatchingState();
  if (!matchingState || matchingState.mappings.size === 0) {
    const empty = document.createElement('div');
    empty.className = 'material-mapping-empty';
    empty.textContent = 'Select a tool and then choose a matching slot to create mappings.';
    container.appendChild(empty);
    return;
  }

  matchingState.mappings.forEach((mapping) => {
    const item = document.createElement('div');
    item.className = 'material-mapping-item';

    if (colorsDiffer(mapping.toolMaterialColor, mapping.slotMaterialColor)) {
      item.classList.add('warning');
    }

    const text = document.createElement('span');
    text.className = 'material-mapping-text';
    text.innerHTML = `Tool ${mapping.toolId + 1} <span class="material-mapping-arrow">&rarr;</span> Slot ${mapping.slotId}`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'material-mapping-remove';
    removeBtn.type = 'button';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove mapping';
    removeBtn.addEventListener('click', () => {
      handleRemoveMapping(mapping.toolId);
    });

    item.appendChild(text);
    item.appendChild(removeBtn);
    container.appendChild(item);
  });
}

function handleRemoveMapping(toolId: number): void {
  const matchingState = getMaterialMatchingState();
  if (!matchingState) {
    return;
  }

  matchingState.mappings.delete(toolId);
  renderMaterialRequirements(matchingState.pending.job);
  renderMaterialSlots(matchingState.materialStation);
  renderMaterialMappings();
  updateMaterialMatchingConfirmState();
  clearMaterialMessages();
}

function renderMaterialRequirements(job: WebUIJobFile | undefined): void {
  const container = getMaterialMatchingElement<HTMLDivElement>('material-job-requirements');
  if (!container) return;

  container.innerHTML = '';
  const matchingState = getMaterialMatchingState();

  if (!job || !isAD5XJobFile(job) || job.toolDatas.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'material-placeholder';
    empty.textContent = 'No material requirements available for this job.';
    container.appendChild(empty);
    return;
  }

  job.toolDatas.forEach((tool) => {
    const item = document.createElement('div');
    item.className = 'material-tool-item';
    item.dataset.toolId = `${tool.toolId}`;

    if (matchingState?.selectedToolId === tool.toolId) {
      item.classList.add('selected');
    }

    if (matchingState?.mappings.has(tool.toolId)) {
      item.classList.add('mapped');
    }

    const header = document.createElement('div');
    header.className = 'material-tool-header';

    const label = document.createElement('span');
    label.className = 'material-tool-label';
    label.textContent = `Tool ${tool.toolId + 1}`;

    const swatch = document.createElement('span');
    swatch.className = 'material-tool-swatch';
    if (tool.materialColor) {
      swatch.style.backgroundColor = tool.materialColor;
    }

    header.appendChild(label);
    header.appendChild(swatch);
    item.appendChild(header);

    const details = document.createElement('div');
    details.className = 'material-tool-details';
    const materialName = tool.materialName || 'Unknown Material';
    const weightText = typeof tool.filamentWeight === 'number'
      ? `${tool.filamentWeight.toFixed(1)} g`
      : 'Weight unavailable';

    details.innerHTML = `
      <div class="material-tool-material">${materialName}</div>
      <div class="material-tool-weight">${weightText}</div>
    `;

    if (matchingState?.mappings.has(tool.toolId)) {
      const mapping = matchingState.mappings.get(tool.toolId);
      if (mapping) {
        const mappingInfo = document.createElement('div');
        mappingInfo.className = 'material-tool-mapping';
        mappingInfo.textContent = `Mapped to Slot ${mapping.slotId}`;
        details.appendChild(mappingInfo);
      }
    }

    item.appendChild(details);

    item.addEventListener('click', () => {
      handleToolSelection(tool.toolId);
    });

    container.appendChild(item);
  });
}

function handleToolSelection(toolId: number): void {
  const matchingState = getMaterialMatchingState();
  if (!matchingState) {
    return;
  }

  if (matchingState.selectedToolId === toolId) {
    matchingState.selectedToolId = null;
  } else {
    matchingState.selectedToolId = toolId;
  }

  clearMaterialMessages();
  renderMaterialRequirements(matchingState.pending.job);
  renderMaterialSlots(matchingState.materialStation);
}

function isSlotAlreadyAssigned(slotDisplayId: number): boolean {
  const matchingState = getMaterialMatchingState();
  if (!matchingState) {
    return false;
  }

  for (const mapping of matchingState.mappings.values()) {
    if (mapping.slotId === slotDisplayId) {
      return true;
    }
  }

  return false;
}

function renderMaterialSlots(status: MaterialStationStatus | null): void {
  const container = getMaterialMatchingElement<HTMLDivElement>('material-slot-list');
  if (!container) return;

  container.innerHTML = '';

  if (!status) {
    const empty = document.createElement('div');
    empty.className = 'material-placeholder';
    empty.textContent = 'Material station status unavailable.';
    container.appendChild(empty);
    return;
  }

  if (!status.connected || status.slots.length === 0) {
    const disconnected = document.createElement('div');
    disconnected.className = 'material-placeholder';
    disconnected.textContent = status.errorMessage || 'Material station not connected.';
    container.appendChild(disconnected);
    return;
  }

  status.slots.forEach((slot) => {
    const displaySlotId = slot.slotId + 1;
    const item = document.createElement('div');
    item.className = 'material-slot-item';
    item.dataset.slotId = `${displaySlotId}`;

    if (slot.isEmpty) {
      item.classList.add('empty');
    }

    if (isSlotAlreadyAssigned(displaySlotId)) {
      item.classList.add('assigned');
    }

    const swatch = document.createElement('span');
    swatch.className = 'material-slot-swatch';
    if (slot.materialColor) {
      swatch.style.backgroundColor = slot.materialColor;
    }

    const info = document.createElement('div');
    info.className = 'material-slot-info';

    const label = document.createElement('div');
    label.className = 'material-slot-label';
    label.textContent = `Slot ${displaySlotId}`;

    const material = document.createElement('div');
    material.className = 'material-slot-material';
    material.textContent = slot.isEmpty ? 'Empty' : (slot.materialType || 'Unknown');

    info.appendChild(label);
    info.appendChild(material);

    item.appendChild(swatch);
    item.appendChild(info);

    if (!slot.isEmpty && !isSlotAlreadyAssigned(displaySlotId)) {
      item.addEventListener('click', () => {
        handleSlotSelection(slot);
      });
    } else {
      item.classList.add('disabled');
    }

    container.appendChild(item);
  });
}

function handleSlotSelection(slot: MaterialSlotInfo): void {
  const matchingState = getMaterialMatchingState();
  if (!matchingState) {
    return;
  }

  const job = matchingState.pending.job;
  if (!job || !isAD5XJobFile(job)) {
    return;
  }

  const selectedToolId = matchingState.selectedToolId;
  if (selectedToolId === null) {
    showMaterialError('Select a tool on the left before choosing a slot.');
    return;
  }

  if (slot.isEmpty) {
    showMaterialError('Cannot assign an empty slot. Load filament before starting the print.');
    return;
  }

  const tool = job.toolDatas.find(t => t.toolId === selectedToolId);
  if (!tool) {
    showMaterialError('Selected tool data is unavailable.');
    return;
  }

  if (!materialsMatch(tool.materialName, slot.materialType)) {
    showMaterialError(`Material mismatch: Tool ${tool.toolId + 1} requires ${tool.materialName}, but Slot ${slot.slotId + 1} contains ${slot.materialType || 'no material'}.`);
    return;
  }

  const displaySlotId = slot.slotId + 1;

  if (isSlotAlreadyAssigned(displaySlotId)) {
    showMaterialError(`Slot ${displaySlotId} is already assigned to another tool.`);
    return;
  }

  const mapping: MaterialMapping = {
    toolId: tool.toolId,
    slotId: displaySlotId,
    materialName: tool.materialName,
    toolMaterialColor: tool.materialColor,
    slotMaterialColor: slot.materialColor || '#333333'
  };

  matchingState.mappings.set(tool.toolId, mapping);
  matchingState.selectedToolId = null;

  if (colorsDiffer(tool.materialColor, slot.materialColor)) {
    showMaterialWarning(`Tool ${tool.toolId + 1} color (${tool.materialColor}) does not match Slot ${displaySlotId} color (${slot.materialColor || 'unknown'}). The print will succeed, but appearance may differ.`);
  } else {
    clearMaterialMessages();
  }

  renderMaterialRequirements(job);
  renderMaterialSlots(matchingState.materialStation);
  renderMaterialMappings();
  updateMaterialMatchingConfirmState();
}

async function fetchMaterialStationStatus(): Promise<MaterialStationStatus | null> {
  if (state.authRequired && !state.authToken) {
    return null;
  }

  try {
    const result = await apiRequest<MaterialStationStatusResponse>('/api/printer/material-station');
    if (result.success) {
      return result.status ?? null;
    }

    showMaterialError(result.error || 'Material station not available.');
    return null;
  } catch (error) {
    console.error('Failed to fetch material station status:', error);
    showMaterialError('Failed to load material station status.');
    return null;
  }
}

function resetMaterialMatchingState(): void {
  setMaterialMatchingState(null);
  state.pendingJobStart = null;
  clearMaterialMessages();
  updateMaterialMatchingConfirmState();
}

function closeMaterialMatchingModal(): void {
  const modal = getMaterialMatchingElement<HTMLDivElement>('material-matching-modal');
  if (modal) {
    hideElement('material-matching-modal');
  }
  resetMaterialMatchingState();
}

async function openMaterialMatchingModal(): Promise<void> {
  const modal = getMaterialMatchingElement<HTMLDivElement>('material-matching-modal');
  const title = getMaterialMatchingElement<HTMLHeadingElement>('material-matching-title');

  if (!modal || !state.pendingJobStart || !state.pendingJobStart.job || !isAD5XJobFile(state.pendingJobStart.job)) {
    showToast('Material matching is not available for this job.', 'error');
    resetMaterialMatchingState();
    return;
  }

  setMaterialMatchingState({
    pending: state.pendingJobStart,
    materialStation: null,
    selectedToolId: null,
    mappings: new Map(),
  });

  if (title) {
    title.textContent = `Match Materials – ${state.pendingJobStart.job.displayName || state.pendingJobStart.job.fileName}`;
  }

  renderMaterialRequirements(state.pendingJobStart.job);
  renderMaterialSlots(null);
  renderMaterialMappings();
  updateMaterialMatchingConfirmState();
  clearMaterialMessages();
  showElement('material-matching-modal');

  const status = await fetchMaterialStationStatus();
  const matchingState = getMaterialMatchingState();
  if (!matchingState) {
    return;
  }

  matchingState.materialStation = status;
  renderMaterialSlots(status);

  if (!status || !status.connected) {
    showMaterialError(status?.errorMessage || 'Material station not connected.');
  }
}

async function confirmMaterialMatching(): Promise<void> {
  const matchingState = getMaterialMatchingState();
  if (!matchingState || !matchingState.pending.job || !isAD5XJobFile(matchingState.pending.job)) {
    return;
  }

  const job = matchingState.pending.job;
  const requiredMappings = job.toolDatas.length;

  if (matchingState.mappings.size !== requiredMappings) {
    showMaterialError('Map every tool to a material slot before starting the job.');
    return;
  }

  const mappings = Array.from(matchingState.mappings.values());
  const confirmButton = getMaterialMatchingElement<HTMLButtonElement>('material-matching-confirm');

  if (confirmButton) {
    confirmButton.disabled = true;
  }

  const success = await sendJobStartRequest({
    filename: matchingState.pending.filename,
    leveling: matchingState.pending.leveling,
    startNow: true,
    materialMappings: mappings
  });

  if (confirmButton) {
    confirmButton.disabled = false;
  }

  if (success) {
    hideElement('file-modal');
    closeMaterialMatchingModal();
  }
}

// ============================================================================
// TEMPERATURE CONTROL
// ============================================================================

function showTemperatureDialog(type: 'bed' | 'extruder'): void {
  const dialog = $('temp-dialog');
  const title = $('temp-dialog-title');
  const message = $('temp-dialog-message');
  const input = $('temp-input') as HTMLInputElement;
  
  if (!dialog || !title || !message || !input) return;
  
  // Set dialog content
  title.textContent = type === 'bed' ? 'Set Bed Temperature' : 'Set Extruder Temperature';
  message.textContent = `Enter ${type} temperature (°C):`;
  
  // Set current target temperature as default
  if (state.printerStatus) {
    const currentTarget = type === 'bed' 
      ? state.printerStatus.bedTargetTemperature 
      : state.printerStatus.nozzleTargetTemperature;
    input.value = Math.round(currentTarget).toString();
  } else {
    input.value = '0';
  }
  
  // Store type for confirm handler
  (dialog as TemperatureDialogElement).temperatureType = type;
  
  // Show dialog
  showElement('temp-dialog');
  input.focus();
  input.select();
}

async function setTemperature(): Promise<void> {
  const dialog = $('temp-dialog') as TemperatureDialogElement;
  const input = $('temp-input') as HTMLInputElement;
  
  if (!dialog || !input) return;
  
  const type = dialog.temperatureType;
  const temperature = parseInt(input.value, 10);
  
  if (isNaN(temperature) || temperature < 0 || temperature > 300) {
    showToast('Invalid temperature value', 'error');
    return;
  }
  
  await sendPrinterCommand(`temperature/${type}`, { temperature });
  hideElement('temp-dialog');
}

// ============================================================================
// VIEWPORT AND LAYOUT SWITCHING
// ============================================================================

/**
 * Handle viewport resize across breakpoint
 */
// ============================================================================
// EVENT HANDLERS
// ============================================================================


function setupEventHandlers(): void{
  // GridStack component buttons - attach to both desktop and mobile grids
  const gridContainerDesktop = $('webui-grid-desktop');
  const gridContainerMobile = $('webui-grid-mobile');
  [gridContainerDesktop, gridContainerMobile].forEach(gridContainer => {
    if (gridContainer) {
      gridContainer.addEventListener('click', async (event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button') as HTMLButtonElement | null;
      if (!button || button.disabled) {
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
          showTemperatureDialog('bed');
          break;
        case 'btn-bed-off':
          await sendPrinterCommand('temperature/bed/off');
          break;
        case 'btn-extruder-set':
          showTemperatureDialog('extruder');
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
        case 'btn-select-spool':
        case 'btn-change-spool':
          openSpoolSelectionModal();
          break;
        default:
          handled = false;
          break;
      }

      if (handled) {
        event.preventDefault();
      }
      });
    }
  });

  // File modal handlers
  const closeModalBtn = $('close-modal');
  const printFileBtn = $('print-file-btn');
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      hideElement('file-modal');
      state.selectedFile = null;
      if (!getMaterialMatchingElement<HTMLDivElement>('material-matching-modal')?.classList.contains('hidden')) {
        closeMaterialMatchingModal();
      } else {
        state.pendingJobStart = null;
      }
    });
  }
  
  if (printFileBtn) {
    printFileBtn.addEventListener('click', startPrintJob);
  }

  const materialModalClose = $('material-matching-close');
  if (materialModalClose) {
    materialModalClose.addEventListener('click', () => {
      closeMaterialMatchingModal();
    });
  }

  const materialModalCancel = $('material-matching-cancel');
  if (materialModalCancel) {
    materialModalCancel.addEventListener('click', () => {
      closeMaterialMatchingModal();
    });
  }

  const materialModalConfirm = $('material-matching-confirm');
  if (materialModalConfirm) {
    materialModalConfirm.addEventListener('click', () => {
      void confirmMaterialMatching();
    });
  }
  
  // Temperature dialog handlers
  const closeTempBtn = $('close-temp-dialog');
  const tempCancelBtn = $('temp-cancel');
  const tempConfirmBtn = $('temp-confirm');
  const tempInput = $('temp-input') as HTMLInputElement;
  
  if (closeTempBtn) {
    closeTempBtn.addEventListener('click', () => hideElement('temp-dialog'));
  }
  if (tempCancelBtn) {
    tempCancelBtn.addEventListener('click', () => hideElement('temp-dialog'));
  }
  if (tempConfirmBtn) {
    tempConfirmBtn.addEventListener('click', setTemperature);
  }
  if (tempInput) {
    tempInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        void setTemperature();
      }
    });
  }

  // Spoolman modal handlers
  const spoolmanModalClose = $('spoolman-modal-close');
  const spoolmanModalCancel = $('spoolman-modal-cancel');
  const spoolmanClearSpool = $('spoolman-clear-spool');
  const spoolmanSearchInput = $('spoolman-search') as HTMLInputElement;

  if (spoolmanModalClose) {
    spoolmanModalClose.addEventListener('click', closeSpoolSelectionModal);
  }

  if (spoolmanModalCancel) {
    spoolmanModalCancel.addEventListener('click', closeSpoolSelectionModal);
  }

  if (spoolmanClearSpool) {
    spoolmanClearSpool.addEventListener('click', () => {
      void clearActiveSpool();
    });
  }

  if (spoolmanSearchInput) {
    spoolmanSearchInput.addEventListener('input', handleSpoolSearch);
  }

  // Keep-alive ping
  setInterval(() => {
    if (state.isConnected && state.websocket && state.websocket.readyState === WebSocket.OPEN) {
      sendCommand({ command: 'PING' });
    }
  }, 30000);

  // Note: Status updates now come via WebSocket push, no need to poll
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initialize(): Promise<void> {
  console.log('Initializing Web UI...');
  initializeLucideIcons();

  setupLayoutEventHandlers();
  setupEventHandlers();

  const contextHandlers = {
    onContextSwitched: async () => {
      await loadPrinterFeatures();
      await loadSpoolmanConfig();
      ensureSpoolmanVisibilityIfEnabled();
      if (state.printerFeatures?.hasCamera) {
        void loadCameraStream();
      }
    },
  };

  setupAuthEventHandlers({
    onLoginSuccess: async () => {
      await handlePostLoginTasks();
    },
  });

  initializeContextSwitching(contextHandlers);
  setupContextEventHandlers(contextHandlers);

  initializeLayout({
    onConnectionStatusUpdate: updateConnectionStatus,
    onPrinterStatusUpdate: (status) => updatePrinterStatus(status),
    onSpoolmanPanelUpdate: () => updateSpoolmanPanelState(),
    onAfterLayoutRefresh: () => {
      updateFeatureVisibility();
      if (state.printerFeatures?.hasCamera) {
        void loadCameraStream();
      }
    },
  });

  setupViewportListener();

  await loadWebUITheme();
  await loadAuthStatus();

  const isAuthenticated = await checkAuthStatus();

  if (isAuthenticated) {
    hideElement('login-screen');
    showElement('main-ui');
    await handlePostLoginTasks();
  } else {
    showElement('login-screen');
    hideElement('main-ui');
    const passwordInput = $('password-input') as HTMLInputElement;
    passwordInput?.focus();
  }
}

async function handlePostLoginTasks(): Promise<void> {
  connectWebSocket();

  try {
    await loadPrinterFeatures();
    await fetchPrinterContexts();
    await loadSpoolmanConfig();
    ensureSpoolmanVisibilityIfEnabled();

    if (state.printerFeatures?.hasCamera) {
      void loadCameraStream();
    }
  } catch (error) {
    console.error('Failed to load features:', error);
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  void initialize();
}
