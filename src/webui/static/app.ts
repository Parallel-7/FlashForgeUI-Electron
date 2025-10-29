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
 * - UI updates: Real-time temperature, progress, layer info, ETA, lifetime statistics, thumbnails
 */

import { WebUIGridManager } from './grid/WebUIGridManager.js';
import { WebUILayoutPersistence } from './grid/WebUILayoutPersistence.js';
import { componentRegistry } from './grid/WebUIComponentRegistry.js';
import { WebUIMobileLayoutManager } from './grid/WebUIMobileLayoutManager.js';
import type { WebUIComponentLayout, WebUIGridLayout } from './grid/types.js';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface AuthResponse {
  success: boolean;
  token?: string;
  message?: string;
}

interface WebSocketMessage {
  type: 'AUTH_SUCCESS' | 'STATUS_UPDATE' | 'ERROR' | 'COMMAND_RESULT' | 'PONG';
  timestamp: string;
  status?: PrinterStatus;
  error?: string;
  clientId?: string;
  command?: string;
  success?: boolean;
}

interface WebSocketCommand {
  command: 'REQUEST_STATUS' | 'EXECUTE_GCODE' | 'PING';
  gcode?: string;
  data?: unknown;
}

interface PrinterStatus {
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

interface PrinterFeatures {
  hasCamera: boolean;
  hasLED: boolean;
  hasFiltration: boolean;
  hasMaterialStation: boolean;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  ledUsesLegacyAPI?: boolean; // Whether custom LED control is enabled
}

interface JobFile {
  fileName: string;
  displayName: string;
  size?: number;
  lastModified?: string;
  thumbnail?: string;
}

// API Response interfaces
interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

type PrinterCommandResponse = ApiResponse;

interface PrinterFeaturesResponse extends ApiResponse {
  features?: PrinterFeatures;
}

interface CameraProxyConfigResponse extends ApiResponse {
  streamType?: 'mjpeg' | 'rtsp';
  port?: number;  // For MJPEG camera proxy
  wsPort?: number;  // For RTSP WebSocket port
  url?: string;
  wsPath?: string;
  ffmpegAvailable?: boolean;
}

interface FileListResponse extends ApiResponse {
  files?: JobFile[];
}

type PrintJobStartResponse = ApiResponse;

interface PrinterContext {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  serialNumber: string;
  isActive: boolean;
}

interface ContextsResponse extends ApiResponse {
  contexts?: PrinterContext[];
  activeContextId?: string;
}

interface WebUISettings {
  visibleComponents: string[];
  editMode: boolean;
}

// Extended HTMLElement for temperature dialog
interface TemperatureDialogElement extends HTMLElement {
  temperatureType?: 'bed' | 'extruder';
}

// ============================================================================
// GLOBAL STATE
// ============================================================================

class AppState {
  public isAuthenticated: boolean = false;
  public authToken: string | null = null;
  public websocket: WebSocket | null = null;
  public isConnected: boolean = false;
  public printerStatus: PrinterStatus | null = null;
  public printerFeatures: PrinterFeatures | null = null;
  public selectedFile: string | null = null;
  public reconnectAttempts: number = 0;
  public maxReconnectAttempts: number = 5;
  public reconnectDelay: number = 2000;
}

const state = new AppState();

const gridManager = new WebUIGridManager('.webui-grid-desktop');
const mobileLayoutManager = new WebUIMobileLayoutManager('.webui-grid-mobile');
const layoutPersistence = new WebUILayoutPersistence();
const ALL_COMPONENT_IDS = componentRegistry.getAllIds();
const DEFAULT_SETTINGS: WebUISettings = {
  visibleComponents: [...ALL_COMPONENT_IDS],
  editMode: false,
};

const MOBILE_BREAKPOINT = 768;
let currentPrinterSerial: string | null = null;
const DEMO_SERIAL = 'demo-layout'; // Fallback when no printer connected
let currentSettings: WebUISettings = { ...DEFAULT_SETTINGS };
let gridInitialized = false;
let gridChangeUnsubscribe: (() => void) | null = null;
const contextById = new Map<string, PrinterContext>();
let isMobileLayout = false;

// ============================================================================
// DOM HELPERS
// ============================================================================

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function showElement(id: string): void {
  const element = $(id);
  if (element) {
    element.classList.remove('hidden');
  }
}

function hideElement(id: string): void {
  const element = $(id);
  if (element) {
    element.classList.add('hidden');
  }
}

function setTextContent(id: string, text: string): void {
  const element = $(id);
  if (element) {
    element.textContent = text;
  }
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const toast = $('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = `toast ${type}`;
  showElement('toast');
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => hideElement('toast'), 300);
  }, 3000);
}

// ============================================================================
// GRID AND SETTINGS MANAGEMENT
// ============================================================================

/**
 * Detects if viewport is mobile size
 */
function isMobileViewport(): boolean {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

function ensureGridInitialized(): void {
  if (gridInitialized) {
    return;
  }

  gridManager.initialize({
    column: 12,
    cellHeight: 80,
    margin: 8,           // Match Electron app
    staticGrid: true,
    float: false,
    animate: true,       // Smooth transitions for resizes
    minRow: 11,          // Ensure enough vertical space for taller panels
  });
  gridManager.disableEdit();
  gridInitialized = true;
}

function ensureCompleteLayout(baseLayout: WebUIGridLayout | null): WebUIGridLayout {
  const defaults = componentRegistry.getDefaultLayout();
  const incoming = baseLayout ?? defaults;
  const normalizedComponents: Record<string, WebUIGridLayout['components'][string]> = {};

  for (const componentId of ALL_COMPONENT_IDS) {
    const defaultConfig = defaults.components?.[componentId];
    const customConfig = incoming.components?.[componentId];
    normalizedComponents[componentId] = sanitizeLayoutConfig(componentId, defaultConfig, customConfig);
  }

  const hidden = (incoming.hiddenComponents ?? []).filter((componentId) =>
    ALL_COMPONENT_IDS.includes(componentId),
  );

  return {
    version: defaults.version,
    components: normalizedComponents,
    hiddenComponents: hidden.length > 0 ? hidden : undefined,
  };
}

function sanitizeLayoutConfig(
  componentId: string,
  defaults: WebUIComponentLayout | undefined,
  custom: WebUIComponentLayout | undefined,
): WebUIComponentLayout {
  const source = custom ?? defaults;
  if (!source) {
    throw new Error(`Missing layout configuration for component ${componentId}`);
  }

  const toInteger = (value: number | undefined): number | undefined => {
    if (value === undefined || Number.isNaN(value)) {
      return undefined;
    }
    return Math.max(0, Math.round(value));
  };

  const minW = toInteger(custom?.minW ?? defaults?.minW);
  const minH = toInteger(custom?.minH ?? defaults?.minH);
  const maxW = toInteger(custom?.maxW ?? defaults?.maxW);
  const maxH = toInteger(custom?.maxH ?? defaults?.maxH);

  let width = Math.max(1, toInteger(source.w) ?? toInteger(defaults?.w) ?? 1);
  if (minW !== undefined) {
    width = Math.max(width, minW);
  }
  if (maxW !== undefined) {
    width = Math.min(width, maxW);
  }

  let height = Math.max(1, toInteger(source.h) ?? toInteger(defaults?.h) ?? 1);
  if (minH !== undefined) {
    height = Math.max(height, minH);
  }
  if (maxH !== undefined) {
    height = Math.min(height, maxH);
  }

  return {
    x: toInteger(source.x) ?? toInteger(defaults?.x) ?? 0,
    y: toInteger(source.y) ?? toInteger(defaults?.y) ?? 0,
    w: width,
    h: height,
    minW,
    minH,
    maxW,
    maxH,
    locked: custom?.locked ?? defaults?.locked ?? false,
  };
}

function resolveSerialForContext(context: PrinterContext | undefined): string | null {
  if (!context) {
    return null;
  }
  if (context.serialNumber && context.serialNumber.trim().length > 0) {
    return context.serialNumber;
  }
  return context.id || null;
}

function loadSettingsForSerial(serialNumber: string | null): WebUISettings {
  const stored = layoutPersistence.loadSettings(serialNumber) as Partial<WebUISettings> | null;
  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }

  const visibleComponents = Array.isArray(stored.visibleComponents)
    ? stored.visibleComponents.filter((componentId): componentId is string =>
        typeof componentId === 'string' && ALL_COMPONENT_IDS.includes(componentId),
      )
    : [...DEFAULT_SETTINGS.visibleComponents];

  if (visibleComponents.length === 0) {
    visibleComponents.push(...DEFAULT_SETTINGS.visibleComponents);
  }

  return {
    visibleComponents,
    editMode: stored.editMode === true,
  };
}

function persistSettings(): void {
  if (!currentPrinterSerial) return;
  layoutPersistence.saveSettings(currentPrinterSerial, currentSettings);
}

function isComponentSupported(componentId: string, features: PrinterFeatures | null): boolean {
  if (!features) {
    return true;
  }

  if (componentId === 'filtration-tvoc') {
    return Boolean(features.hasFiltration);
  }

  return true;
}

function shouldComponentBeVisible(
  componentId: string,
  settings: WebUISettings,
  features: PrinterFeatures | null,
): boolean {
  if (!settings.visibleComponents.includes(componentId)) {
    return false;
  }
  return isComponentSupported(componentId, features);
}

function updateEditModeToggle(editMode: boolean): void {
  const isMobile = isMobileViewport();
  const toggleButton = $('edit-mode-toggle') as HTMLButtonElement | null;

  if (toggleButton) {
    // Hide edit mode toggle on mobile (handled by CSS but reinforce here)
    if (isMobile) {
      toggleButton.style.display = 'none';
    } else {
      toggleButton.style.display = '';
      toggleButton.setAttribute('aria-pressed', editMode ? 'true' : 'false');
      const lockIcon = toggleButton.querySelector('.lock-icon');
      const text = toggleButton.querySelector('.edit-text');
      if (lockIcon) {
        lockIcon.textContent = editMode ? '🔓' : '🔒';
      }
      if (text) {
        text.textContent = editMode ? 'Unlocked' : 'Locked';
      }
    }
  }

  const modalToggle = $('toggle-edit-mode') as HTMLInputElement | null;
  if (modalToggle) {
    modalToggle.checked = editMode;
    // Disable edit mode checkbox in settings on mobile
    modalToggle.disabled = isMobile;
  }
}

function applySettings(settings: WebUISettings): void {
  const isMobile = isMobileViewport();
  const features = state.printerFeatures ?? null;

  for (const componentId of ALL_COMPONENT_IDS) {
    const shouldShow = shouldComponentBeVisible(componentId, settings, features);

    if (isMobile) {
      // Apply to mobile layout
      if (shouldShow) {
        mobileLayoutManager.showComponent(componentId);
      } else {
        mobileLayoutManager.hideComponent(componentId);
      }
    } else {
      // Apply to desktop layout
      if (!gridInitialized) return;
      if (shouldShow) {
        gridManager.showComponent(componentId);
      } else {
        gridManager.hideComponent(componentId);
      }
    }
  }

  // Edit mode only applies to desktop
  if (!isMobile && gridInitialized) {
    if (settings.editMode) {
      gridManager.enableEdit();
    } else {
      gridManager.disableEdit();
    }
  }

  updateEditModeToggle(isMobile ? false : settings.editMode);
}

function refreshSettingsUI(settings: WebUISettings): void {
  const checkboxes = document.querySelectorAll<HTMLInputElement>(
    '#settings-modal input[type="checkbox"][data-component-id]',
  );

  checkboxes.forEach((checkbox) => {
    const componentId = checkbox.dataset.componentId;
    if (!componentId) {
      return;
    }

    const supported = isComponentSupported(componentId, state.printerFeatures ?? null);
    checkbox.checked = settings.visibleComponents.includes(componentId) && supported;
    checkbox.disabled = !supported;
  });

  updateEditModeToggle(settings.editMode);
}

function handleLayoutChange(layout: WebUIGridLayout): void {
  if (!currentPrinterSerial) return;
  layoutPersistence.save(layout, currentPrinterSerial);
}

function saveCurrentLayoutSnapshot(): void {
  if (!gridInitialized || !currentPrinterSerial) {
    return;
  }
  const snapshot = gridManager.serialize();
  layoutPersistence.save(snapshot, currentPrinterSerial);
}

function loadLayoutForCurrentPrinter(): void {
  if (!currentPrinterSerial) {
    // Fallback to demo layout if somehow serial is still null
    currentPrinterSerial = DEMO_SERIAL;
  }

  const isMobile = isMobileViewport();

  if (isMobile) {
    // Mobile: Use static layout
    mobileLayoutManager.initialize();
    currentSettings = loadSettingsForSerial(currentPrinterSerial);
    mobileLayoutManager.load(currentSettings.visibleComponents);
    isMobileLayout = true;
  } else {
    // Desktop: Use GridStack
    ensureGridInitialized();
    const storedLayout = layoutPersistence.load(currentPrinterSerial);
    const layout = ensureCompleteLayout(storedLayout);

    gridManager.load(layout);

    if (gridChangeUnsubscribe) {
      gridChangeUnsubscribe();
    }
    gridChangeUnsubscribe = gridManager.onChange(handleLayoutChange);
    isMobileLayout = false;
  }

  currentSettings = loadSettingsForSerial(currentPrinterSerial);
  applySettings(currentSettings);
  refreshSettingsUI(currentSettings);

  updateFeatureVisibility();

  if (state.printerFeatures?.hasCamera) {
    void loadCameraStream();
  }
}

function openSettingsModal(): void {
  const modal = $('settings-modal');
  if (!modal) return;
  refreshSettingsUI(currentSettings);
  modal.classList.remove('hidden');
}

function closeSettingsModal(): void {
  const modal = $('settings-modal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function resetLayoutForCurrentPrinter(): void {
  if (!currentPrinterSerial) {
    return;
  }

  layoutPersistence.reset(currentPrinterSerial);
  currentSettings = { ...DEFAULT_SETTINGS };
  persistSettings();
  loadLayoutForCurrentPrinter();
  showToast('Layout reset to default', 'info');
}

function setupSettingsUI(): void {
  const settingsButton = $('settings-button') as HTMLButtonElement | null;
  const closeButton = $('close-settings') as HTMLButtonElement | null;
  const saveButton = $('save-settings-btn') as HTMLButtonElement | null;
  const resetButton = $('reset-layout-btn') as HTMLButtonElement | null;
  const modal = $('settings-modal');
  const modalEditToggle = $('toggle-edit-mode') as HTMLInputElement | null;
  const headerEditToggle = $('edit-mode-toggle') as HTMLButtonElement | null;

  if (settingsButton) {
    settingsButton.addEventListener('click', () => openSettingsModal());
  }

  if (closeButton) {
    closeButton.addEventListener('click', () => closeSettingsModal());
  }

  if (saveButton) {
    saveButton.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll<HTMLInputElement>(
        '#settings-modal input[type="checkbox"][data-component-id]',
      );
      const visibleComponents = Array.from(checkboxes)
        .filter((checkbox) => checkbox.checked && !checkbox.disabled)
        .map((checkbox) => checkbox.dataset.componentId ?? '')
        .filter((componentId): componentId is string => componentId.length > 0);

      const editMode = (modalEditToggle?.checked ?? false);

      currentSettings = {
        visibleComponents: visibleComponents.length > 0 ? visibleComponents : [...DEFAULT_SETTINGS.visibleComponents],
        editMode,
      };

      applySettings(currentSettings);
      persistSettings();
      closeSettingsModal();
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      resetLayoutForCurrentPrinter();
      refreshSettingsUI(currentSettings);
    });
  }

  if (modalEditToggle) {
    modalEditToggle.addEventListener('change', (event) => {
      currentSettings.editMode = (event.target as HTMLInputElement).checked;
      applySettings(currentSettings);
      persistSettings();
    });
  }

  if (headerEditToggle) {
    headerEditToggle.addEventListener('click', () => {
      currentSettings.editMode = !currentSettings.editMode;
      applySettings(currentSettings);
      persistSettings();
      refreshSettingsUI(currentSettings);
    });
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeSettingsModal();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSettingsModal();
    }
  });

  updateEditModeToggle(currentSettings.editMode);
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function login(password: string, rememberMe: boolean): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password, rememberMe })
    });
    
    const result: AuthResponse = await response.json() as AuthResponse;
    
    if (result.success && result.token) {
      state.authToken = result.token;
      state.isAuthenticated = true;
      
      // Store token if remember me is checked
      if (rememberMe) {
        localStorage.setItem('webui-token', result.token);
      } else {
        sessionStorage.setItem('webui-token', result.token);
      }
      
      return true;
    } else {
      setTextContent('login-error', result.message || 'Login failed');
      return false;
    }
  } catch (error) {
    console.error('Login error:', error);
    setTextContent('login-error', 'Network error. Please try again.');
    return false;
  }
}

async function logout(): Promise<void> {
  if (state.authToken) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.authToken}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  // Clear state and storage
  state.authToken = null;
  state.isAuthenticated = false;
  localStorage.removeItem('webui-token');
  sessionStorage.removeItem('webui-token');
  
  // Disconnect WebSocket
  if (state.websocket) {
    state.websocket.close();
  }

  currentPrinterSerial = null;
  currentSettings = { ...DEFAULT_SETTINGS };
  contextById.clear();
  if (gridInitialized) {
    gridManager.clear();
    gridManager.disableEdit();
    updateEditModeToggle(false);
  }
  closeSettingsModal();
  
  // Show login screen
  showElement('login-screen');
  hideElement('main-ui');
}

// ============================================================================
// WEBSOCKET CONNECTION
// ============================================================================

function connectWebSocket(): void {
  if (!state.authToken) {
    console.error('Cannot connect WebSocket without auth token');
    return;
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws?token=${state.authToken}`;
  
  try {
    state.websocket = new WebSocket(wsUrl);
    
    state.websocket.onopen = () => {
      console.log('WebSocket connected');
      state.isConnected = true;
      state.reconnectAttempts = 0;
      updateConnectionStatus(true);
      
      // Request initial status
      sendCommand({ command: 'REQUEST_STATUS' });
    };
    
    state.websocket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data) as WebSocketMessage;
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    state.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Don't automatically logout - let the reconnect logic handle it
    };
    
    state.websocket.onclose = () => {
      console.log('WebSocket disconnected');
      state.isConnected = false;
      state.websocket = null;
      updateConnectionStatus(false);
      
      // Attempt to reconnect
      if (state.isAuthenticated && state.reconnectAttempts < state.maxReconnectAttempts) {
        state.reconnectAttempts++;
        setTimeout(() => connectWebSocket(), state.reconnectDelay * state.reconnectAttempts);
      }
    };
  } catch (error) {
    console.error('Failed to create WebSocket:', error);
  }
}

function sendCommand(command: WebSocketCommand): void {
  if (!state.websocket || state.websocket.readyState !== WebSocket.OPEN) {
    console.error('WebSocket not connected');
    showToast('Not connected to server', 'error');
    return;
  }
  
  state.websocket.send(JSON.stringify(command));
}

function handleWebSocketMessage(message: WebSocketMessage): void {
  switch (message.type) {
    case 'AUTH_SUCCESS':
      console.log('WebSocket authenticated:', message.clientId);
      break;
      
    case 'STATUS_UPDATE':
      if (message.status) {
        updatePrinterStatus(message.status);
      }
      break;
      
    case 'ERROR':
      console.error('WebSocket error:', message.error);
      showToast(message.error || 'An error occurred', 'error');
      break;
      
    case 'COMMAND_RESULT':
      if (message.success) {
        showToast('Command executed successfully', 'success');
      } else {
        showToast(message.error || 'Command failed', 'error');
      }
      break;
      
    case 'PONG':
      // Keep-alive response
      break;
  }
}

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
    
    // Update weight and length with null checks
    if (status.estimatedWeight !== undefined && !isNaN(status.estimatedWeight)) {
      setTextContent('job-weight', `${status.estimatedWeight.toFixed(1)}g`);
    } else {
      setTextContent('job-weight', '--');
    }
    
    if (status.estimatedLength !== undefined && !isNaN(status.estimatedLength)) {
      setTextContent('job-length', `${status.estimatedLength.toFixed(2)}m`);
    } else {
      setTextContent('job-length', '--');
    }
    
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
    setTextContent('job-weight', '--');
    setTextContent('job-length', '--');
    
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

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  }
  return `${mins}:00`;
}

function formatETA(remainingMinutes: number): string {
  // Calculate completion time by adding remaining minutes to current time
  const now = new Date();
  const completionTime = new Date(now.getTime() + remainingMinutes * 60 * 1000);
  
  // Format as 12-hour time with AM/PM
  return completionTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatLifetimePrintTime(minutes: number): string {
  if (!minutes || isNaN(minutes) || minutes <= 0) {
    return '--';
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours >= 1000) {
    // Format with comma for thousands (e.g., "1,250h 30m")
    return `${hours.toLocaleString()}h ${remainingMinutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  } else {
    return `${remainingMinutes}m`;
  }
}

function formatLifetimeFilament(meters: number): string {
  if (!meters || isNaN(meters) || meters <= 0) {
    return '--';
  }
  
  // Display in meters with 2 decimal places, matching main UI format
  return `${meters.toFixed(2)}m`;
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
// MULTI-PRINTER CONTEXT MANAGEMENT
// ============================================================================

async function fetchPrinterContexts(): Promise<void> {
  if (!state.authToken) {
    console.log('[Contexts] No auth token, skipping context fetch');
    return;
  }

  try {
    const response = await fetch('/api/contexts', {
      headers: {
        'Authorization': `Bearer ${state.authToken}`
      }
    });

    const result = await response.json() as ContextsResponse;

    if (result.success && result.contexts) {
      console.log('[Contexts] Fetched contexts:', result.contexts);
      contextById.clear();
      result.contexts.forEach((context) => {
        contextById.set(context.id, context);
      });

      const fallbackContext =
        result.contexts.find((context) => context.isActive) ?? result.contexts[0] ?? null;
      const selectedContextId = result.activeContextId || fallbackContext?.id || '';

      updatePrinterSelector(result.contexts, selectedContextId);

      const activeContext = selectedContextId ? contextById.get(selectedContextId) : fallbackContext;
      const resolvedSerial = resolveSerialForContext(activeContext);
      if (resolvedSerial) {
        currentPrinterSerial = resolvedSerial;
        loadLayoutForCurrentPrinter();
      } else {
        // Use demo serial for testing/preview when no printer connected
        currentPrinterSerial = DEMO_SERIAL;
        loadLayoutForCurrentPrinter();
      }
    } else {
      console.error('[Contexts] Failed to fetch contexts:', result.error);
    }
  } catch (error) {
    console.error('[Contexts] Error fetching contexts:', error);
  }
}

function updatePrinterSelector(contexts: PrinterContext[], activeContextId: string): void {
  const selector = $('printer-selector');
  const select = $('printer-select') as HTMLSelectElement;

  if (!selector || !select) {
    console.error('[Contexts] Printer selector elements not found');
    return;
  }

  // Show selector only if there are multiple printers
  if (contexts.length > 1) {
    showElement('printer-selector');
  } else {
    hideElement('printer-selector');
    return;
  }

  // Clear existing options
  select.innerHTML = '';

  // Populate with printer contexts
  contexts.forEach(context => {
    const option = document.createElement('option');
    option.value = context.id;
    option.textContent = `${context.name} (${context.ipAddress})`;

    if (context.isActive || context.id === activeContextId) {
      option.selected = true;
    }

    select.appendChild(option);
  });
}

async function switchPrinterContext(contextId: string): Promise<void> {
  if (!state.authToken) {
    showToast('Not authenticated', 'error');
    return;
  }

  saveCurrentLayoutSnapshot();

  try {
    const response = await fetch('/api/contexts/switch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contextId })
    });

    const result = await response.json() as ApiResponse;

    if (result.success) {
      console.log('[Contexts] Switched to context:', contextId);
      showToast(result.message || 'Switched printer', 'success');
      // Refresh context list to obtain updated serial numbers and load layout
      await fetchPrinterContexts();

      // Reload features for the new context (handles filtration visibility, etc.)
      await loadPrinterFeatures();

      // Request fresh status for the new context
      sendCommand({ command: 'REQUEST_STATUS' });

      // Reload camera stream for the new context (uses updated camera proxy port)
      await loadCameraStream();
    } else {
      showToast(result.error || 'Failed to switch printer', 'error');
    }
  } catch (error) {
    console.error('[Contexts] Error switching context:', error);
    showToast('Failed to switch printer', 'error');
  }
}

// ============================================================================
// PRINTER CONTROLS
// ============================================================================

async function sendPrinterCommand(endpoint: string, data?: unknown): Promise<void> {
  if (!state.authToken) {
    showToast('Not authenticated', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/printer/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.authToken}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    const result = await response.json() as PrinterCommandResponse;
    
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
  if (!state.authToken) return;
  
  try {
    const response = await fetch('/api/printer/features', {
      headers: {
        'Authorization': `Bearer ${state.authToken}`
      }
    });
    
    const result = await response.json() as PrinterFeaturesResponse;
    
    if (result.success && result.features) {
      state.printerFeatures = result.features;
      updateFeatureVisibility();
      applySettings(currentSettings);
      refreshSettingsUI(currentSettings);

      if (state.printerFeatures.hasCamera && gridInitialized) {
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
  
  try {
    // Get camera proxy configuration from the server
    const response = await fetch('/api/camera/proxy-config', {
      headers: {
        'Authorization': `Bearer ${state.authToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get camera proxy configuration');
    }
    
    const config = await response.json() as CameraProxyConfigResponse;

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
  if (!state.authToken) return;
  
  try {
    const response = await fetch(`/api/jobs/${source}`, {
      headers: {
        'Authorization': `Bearer ${state.authToken}`
      }
    });
    
    const result = await response.json() as FileListResponse;
    
    if (result.success && result.files) {
      showFileModal(result.files, source);
    } else {
      showToast('Failed to load files', 'error');
    }
  } catch (error) {
    console.error('Failed to load files:', error);
    showToast('Failed to load files', 'error');
  }
}

function showFileModal(files: JobFile[], source: string): void {
  const modal = $('file-modal');
  const fileList = $('file-list');
  const title = $('modal-title');
  
  if (!modal || !fileList || !title) return;
  
  // Set title
  title.textContent = source === 'recent' ? 'Recent Files' : 'Local Files';
  
  // Clear and populate file list
  fileList.innerHTML = '';
  state.selectedFile = null;
  
  files.forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `<span class="file-name">${file.displayName || file.fileName}</span>`;
    
    item.addEventListener('click', () => {
      // Remove selected class from all items
      fileList.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
      // Add selected class to clicked item
      item.classList.add('selected');
      state.selectedFile = file.fileName;
      
      // Enable print button
      const printBtn = $('print-file-btn') as HTMLButtonElement;
      if (printBtn) printBtn.disabled = false;
    });
    
    fileList.appendChild(item);
  });
  
  // Show modal
  showElement('file-modal');
}

async function startPrintJob(): Promise<void> {
  if (!state.selectedFile || !state.authToken) return;
  
  const autoLevel = ($('auto-level') as HTMLInputElement)?.checked || false;
  const startNow = ($('start-now') as HTMLInputElement)?.checked || true;
  
  try {
    const response = await fetch('/api/jobs/start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: state.selectedFile,
        leveling: autoLevel,
        startNow: startNow
      })
    });
    
    const result = await response.json() as PrintJobStartResponse;
    
    if (result.success) {
      showToast(result.message || 'Print job started', 'success');
      hideElement('file-modal');
    } else {
      showToast(result.error || 'Failed to start print', 'error');
    }
  } catch (error) {
    console.error('Failed to start print:', error);
    showToast('Failed to start print job', 'error');
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
function handleViewportChange(): void {
  const isMobile = isMobileViewport();

  // Only reload if layout mode changed
  if (isMobile !== isMobileLayout) {
    console.log('[Layout] Viewport breakpoint crossed, switching layout mode');

    // Save current desktop layout before switching
    if (!isMobile && gridInitialized) {
      saveCurrentLayoutSnapshot();
    }

    // Reload layout in new mode
    loadLayoutForCurrentPrinter();

    isMobileLayout = isMobile;

    // CRITICAL FIX: Clear old camera stream elements before reloading
    const oldCameraStream = $('camera-stream') as HTMLImageElement | null;
    const oldCameraCanvas = $('camera-canvas') as HTMLCanvasElement | null;
    if (oldCameraStream) {
      oldCameraStream.src = '';
      oldCameraStream.onload = null;
      oldCameraStream.onerror = null;
    }
    if (oldCameraCanvas) {
      const ctx = oldCameraCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, oldCameraCanvas.width, oldCameraCanvas.height);
    }

    // Reload camera stream after layout switch
    if (state.printerFeatures?.hasCamera) {
      console.log('[Layout] Reloading camera stream for new layout elements');
      void loadCameraStream();
    }
  }
}

/**
 * Setup viewport change listener
 */
function setupViewportListener(): void {
  // Use matchMedia for efficient breakpoint detection
  const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  // Modern API
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleViewportChange);
  } else {
    // Fallback for older browsers (addListener is deprecated but needed for compatibility)
    mediaQuery.addListener(handleViewportChange);
  }

  // Also handle window resize (for orientation changes)
  let resizeTimeout: number;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(handleViewportChange, 250);
  });
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function setupEventHandlers(): void{
  setupSettingsUI();

  // Login form
  const loginBtn = $('login-button');
  const passwordInput = $('password-input') as HTMLInputElement;
  
  if (loginBtn && passwordInput) {
    loginBtn.addEventListener('click', async () => {
      const password = passwordInput.value;
      const rememberMe = ($('remember-me-checkbox') as HTMLInputElement)?.checked || false;
      
      if (!password) {
        setTextContent('login-error', 'Please enter a password');
        return;
      }
      
      loginBtn.textContent = 'Logging in...';
      (loginBtn as HTMLButtonElement).disabled = true;
      
      const success = await login(password, rememberMe);
      
      if (success) {
        hideElement('login-screen');
        showElement('main-ui');
        connectWebSocket();
        await loadPrinterFeatures();
        // Fetch printer contexts after successful login
        await fetchPrinterContexts();
      }
      
      loginBtn.textContent = 'Login';
      (loginBtn as HTMLButtonElement).disabled = false;
    });
    
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        loginBtn.click();
      }
    });
  }
  
  // Logout button
  const logoutBtn = $('logout-button');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

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
    });
  }
  
  if (printFileBtn) {
    printFileBtn.addEventListener('click', startPrintJob);
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
  
  // Printer selector dropdown
  const printerSelect = $('printer-select') as HTMLSelectElement;
  if (printerSelect) {
    printerSelect.addEventListener('change', (e) => {
      const selectedContextId = (e.target as HTMLSelectElement).value;
      console.log('[Contexts] Printer selector changed to:', selectedContextId);
      void switchPrinterContext(selectedContextId);
    });
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

async function checkAuthStatus(): Promise<boolean> {
  // Check for stored token
  const storedToken = localStorage.getItem('webui-token') || sessionStorage.getItem('webui-token');
  
  if (!storedToken) {
    return false;
  }
  
  // Set the token in state first
  state.authToken = storedToken;
  state.isAuthenticated = true;
  
  // Verify token is still valid by calling a protected endpoint
  try {
    // Test with printer status endpoint which requires auth
    const response = await fetch('/api/printer/status', {
      headers: {
        'Authorization': `Bearer ${storedToken}`
      }
    });
    
    if (response.ok || response.status === 503) {
      // 503 means printer not connected but auth is valid
      return true;
    } else if (response.status === 401) {
      // Token is invalid or expired
      state.authToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem('webui-token');
      sessionStorage.removeItem('webui-token');
      return false;
    } else {
      // Other error, keep token for now
      return true;
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    // Network error, assume token might be valid
    return true;
  }
}

async function initialize(): Promise<void> {
  console.log('Initializing Web UI...');

  // Setup event handlers
  setupEventHandlers();

  // Setup viewport change detection
  setupViewportListener();

  // Check authentication status
  const isAuthenticated = await checkAuthStatus();
  
  if (isAuthenticated) {
    // Token exists and might be valid
    hideElement('login-screen');
    showElement('main-ui');
    
    // Try to connect and load features
    connectWebSocket();
    
    // Load features but handle auth failures gracefully
    try {
      await loadPrinterFeatures();
      // Fetch printer contexts after features are loaded
      await fetchPrinterContexts();
    } catch (error) {
      console.error('Failed to load features:', error);
      // If we get here, token might be invalid but we'll let WebSocket retry handle it
    }
  } else {
    // Show login screen
    showElement('login-screen');
    hideElement('main-ui');
    
    // Focus password input
    const passwordInput = $('password-input') as HTMLInputElement;
    if (passwordInput) {
      passwordInput.focus();
    }
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  void initialize();
}
