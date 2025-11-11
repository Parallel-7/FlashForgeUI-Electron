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

import { WebUIGridManager } from './grid/WebUIGridManager.js';
import { WebUILayoutPersistence } from './grid/WebUILayoutPersistence.js';
import { componentRegistry } from './grid/WebUIComponentRegistry.js';
import { WebUIMobileLayoutManager } from './grid/WebUIMobileLayoutManager.js';
import type { WebUIComponentLayout, WebUIGridLayout } from './grid/types.js';

type LucideGlobal = {
  readonly createIcons: (options?: {
    readonly icons?: Record<string, [string, Record<string, string | number>][]>;
    readonly nameAttr?: string;
    readonly attrs?: Record<string, string>;
    readonly root?: Document | Element | DocumentFragment;
  }) => void;
  readonly icons: Record<string, [string, Record<string, string | number>][]>;
};

declare global {
  interface Window {
    lucide?: LucideGlobal;
  }
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

function hydrateLucideIcons(iconNames: string[], root: Document | Element | DocumentFragment = document): void {
  const lucide = window.lucide;
  if (!lucide?.createIcons) {
    return;
  }

  const icons: Record<string, [string, Record<string, string | number>][]> = {};
  iconNames.forEach((name) => {
    const pascal = toPascalCase(name);
    const iconNode =
      lucide.icons?.[pascal] ??
      lucide.icons?.[name] ??
      lucide.icons?.[name.toUpperCase()] ??
      lucide.icons?.[name.toLowerCase()];

    if (iconNode) {
      icons[pascal] = iconNode;
    } else {
      console.warn(`[WebUI] Lucide icon "${name}" not available in global registry.`);
    }
  });

  if (Object.keys(icons).length === 0) {
    return;
  }

  lucide.createIcons({
    icons,
    nameAttr: 'data-lucide',
    attrs: {
      'stroke-width': '2',
      'aria-hidden': 'true',
      focusable: 'false',
      class: 'lucide-icon',
    },
    root,
  });
}

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface AuthResponse {
  success: boolean;
  token?: string;
  message?: string;
}

interface AuthStatusResponse {
  authRequired: boolean;
  hasPassword: boolean;
  defaultPassword: boolean;
}

interface WebSocketMessage {
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

interface AD5XToolData {
  toolId: number;
  materialName: string;
  materialColor: string;
  filamentWeight: number;
  slotId?: number | null;
}

type JobMetadataType = 'basic' | 'ad5x';

interface WebUIJobFile {
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
  files?: WebUIJobFile[];
  totalCount?: number;
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

interface MaterialSlotInfo {
  slotId: number;
  isEmpty: boolean;
  materialType: string | null;
  materialColor: string | null;
}

interface MaterialStationStatus {
  connected: boolean;
  slots: MaterialSlotInfo[];
  activeSlot: number | null;
  overallStatus: 'ready' | 'warming' | 'error' | 'disconnected';
  errorMessage: string | null;
}

interface MaterialStationStatusResponse extends ApiResponse {
  status?: MaterialStationStatus | null;
}

interface MaterialMapping {
  toolId: number;
  slotId: number;
  materialName: string;
  toolMaterialColor: string;
  slotMaterialColor: string;
}

interface PendingJobStart {
  filename: string;
  leveling: boolean;
  startNow: boolean;
  job: WebUIJobFile | undefined;
}

type MaterialMessageType = 'error' | 'warning';

// Spoolman types
interface ActiveSpoolData {
  id: number;
  name: string;
  vendor: string | null;
  material: string | null;
  colorHex: string;
  remainingWeight: number;
  remainingLength: number;
  lastUpdated: string;
}

interface SpoolSummary {
  readonly id: number;
  readonly name: string;
  readonly vendor: string | null;
  readonly material: string | null;
  readonly colorHex: string;
  readonly remainingWeight: number;
  readonly remainingLength: number;
  readonly archived: boolean;
}

interface SpoolmanConfigResponse extends ApiResponse {
  enabled: boolean;
  disabledReason?: string | null;
  serverUrl: string;
  updateMode: 'length' | 'weight';
  contextId: string | null;
}

interface ActiveSpoolResponse extends ApiResponse {
  spool: ActiveSpoolData | null;
}

interface SpoolSearchResponse extends ApiResponse {
  spools: SpoolSummary[];
}

interface SpoolSelectResponse extends ApiResponse {
  spool: ActiveSpoolData;
}

function initializeLucideIcons(): void {
  hydrateLucideIcons(['settings', 'lock', 'package', 'search', 'circle'], document);
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
  public jobMetadata: Map<string, WebUIJobFile> = new Map();
  public pendingJobStart: PendingJobStart | null = null;
  public reconnectAttempts: number = 0;
  public maxReconnectAttempts: number = 5;
  public reconnectDelay: number = 2000;
  public authRequired: boolean = true;
  public defaultPassword: boolean = false;
  public hasPassword: boolean = true;
  // Spoolman state
  public spoolmanConfig: SpoolmanConfigResponse | null = null;
  public activeSpool: ActiveSpoolData | null = null;
  public availableSpools: SpoolSummary[] = [];
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
let currentContextId: string | null = null;
const DEMO_SERIAL = 'demo-layout'; // Fallback when no printer connected
let currentSettings: WebUISettings = { ...DEFAULT_SETTINGS };
let gridInitialized = false;
let gridChangeUnsubscribe: (() => void) | null = null;
const contextById = new Map<string, PrinterContext>();
let isMobileLayout = false;

interface MaterialMatchingState {
  pending: PendingJobStart;
  materialStation: MaterialStationStatus | null;
  selectedToolId: number | null;
  mappings: Map<number, MaterialMapping>;
}

let materialMatchingState: MaterialMatchingState | null = null;

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

function buildAuthHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  if (state.authRequired && state.authToken) {
    return {
      ...extra,
      Authorization: `Bearer ${state.authToken}`,
    };
  }
  return { ...extra };
}

function isAD5XJobFile(job?: WebUIJobFile): job is WebUIJobFile & { metadataType: 'ad5x'; toolDatas: AD5XToolData[] } {
  return !!job && job.metadataType === 'ad5x' && Array.isArray(job.toolDatas);
}

function isMultiColorJobFile(job?: WebUIJobFile): job is WebUIJobFile & { metadataType: 'ad5x'; toolDatas: AD5XToolData[] } {
  return isAD5XJobFile(job) && job.toolDatas.length > 1;
}

function buildMaterialBadgeTooltip(job: WebUIJobFile): string {
  if (!isAD5XJobFile(job)) {
    return 'Multi-color job';
  }

  const materials = job.toolDatas
    .map(tool => `Tool ${tool.toolId + 1}: ${tool.materialName}`)
    .join('\n');
  return `Requires material station\n${materials}`;
}

function formatJobPrintingTime(printingTime?: number): string {
  if (!printingTime || Number.isNaN(printingTime) || printingTime <= 0) {
    return '';
  }

  const totalMinutes = Math.round(printingTime / 60);
  if (totalMinutes <= 0) {
    return `${Math.max(printingTime, 1)}s`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

function hasMaterialStationSupport(): boolean {
  return Boolean(state.printerFeatures?.hasMaterialStation);
}

function normalizeMaterialString(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function colorsDiffer(toolColor: string, slotColor: string | null): boolean {
  if (!toolColor) {
    return false;
  }
  return normalizeMaterialString(toolColor) !== normalizeMaterialString(slotColor);
}

function materialsMatch(toolMaterial: string, slotMaterial: string | null): boolean {
  if (!toolMaterial) {
    return false;
  }
  return normalizeMaterialString(toolMaterial) === normalizeMaterialString(slotMaterial);
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

function teardownDesktopLayout(): void {
  if (!gridInitialized) {
    return;
  }

  if (gridChangeUnsubscribe) {
    gridChangeUnsubscribe();
    gridChangeUnsubscribe = null;
  }

  gridManager.disableEdit();
  gridManager.clear();
}

function teardownMobileLayout(): void {
  mobileLayoutManager.clear();
}

function teardownCameraStreamElements(): void {
  const cameraPlaceholder = $('camera-placeholder');
  if (cameraPlaceholder) {
    cameraPlaceholder.classList.remove('hidden');
    cameraPlaceholder.textContent = 'Camera Unavailable';
  }

  const cameraStream = $('camera-stream') as HTMLImageElement | null;
  if (cameraStream) {
    cameraStream.src = '';
    cameraStream.onload = null;
    cameraStream.onerror = null;
  }

  const cameraCanvas = $('camera-canvas') as HTMLCanvasElement | null;
  if (cameraCanvas) {
    const ctx = cameraCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);
    }
  }
}

function resetLayoutContainers(): void {
  teardownCameraStreamElements();
  teardownDesktopLayout();
  teardownMobileLayout();
}

function rehydrateLayoutState(): void {
  updateConnectionStatus(state.isConnected);

  if (state.printerStatus) {
    updatePrinterStatus(state.printerStatus);
  } else {
    updatePrinterStatus(null);
  }

  updateSpoolmanPanelState();
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

function isSpoolmanAvailableForCurrentContext(): boolean {
  if (!state.spoolmanConfig?.enabled) {
    return false;
  }

  if (!state.spoolmanConfig.contextId) {
    return true;
  }

  const activeContextId = getCurrentContextId();
  return activeContextId === state.spoolmanConfig.contextId;
}

function isComponentSupported(componentId: string, features: PrinterFeatures | null): boolean {
  if (!features) {
    return true;
  }

  if (componentId === 'filtration-tvoc') {
    return Boolean(features.hasFiltration);
  }

  if (componentId === 'spoolman-tracker') {
    return isSpoolmanAvailableForCurrentContext();
  }

  return true;
}

function ensureSpoolmanVisibilityIfEnabled(): void {
  if (!isSpoolmanAvailableForCurrentContext()) return;
  if (!gridInitialized) return;

  // If Spoolman is enabled but not in visible components, add it automatically
  if (!currentSettings.visibleComponents.includes('spoolman-tracker')) {
    console.log('[Spoolman] Auto-enabling Spoolman component (enabled in config)');
    currentSettings.visibleComponents.push('spoolman-tracker');
    persistSettings();
  }

  // Make sure component is visible on grid
  gridManager.showComponent('spoolman-tracker');
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
      const lockIcon = toggleButton.querySelector<HTMLElement>('.lock-icon');
      const text = toggleButton.querySelector('.edit-text');
      if (lockIcon) {
        const iconName = editMode ? 'unlock' : 'lock';
        lockIcon.setAttribute('data-lucide', iconName);
        hydrateLucideIcons([iconName], lockIcon);
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

  resetLayoutContainers();

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
  rehydrateLayoutState();

  if (state.printerFeatures?.hasCamera) {
    void loadCameraStream();
  }
}

function openSettingsModal(): void {
  const modal = $('settings-modal');
  if (!modal) return;
  refreshSettingsUI(currentSettings);
  void loadCurrentThemeIntoSettings();
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

  // Theme controls
  const applyThemeButton = $('apply-webui-theme-btn') as HTMLButtonElement | null;
  const resetThemeButton = $('reset-webui-theme-btn') as HTMLButtonElement | null;

  if (applyThemeButton) {
    applyThemeButton.addEventListener('click', () => {
      void handleApplyWebUITheme();
    });
  }

  if (resetThemeButton) {
    resetThemeButton.addEventListener('click', () => {
      loadDefaultThemeIntoSettings();
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
  if (!state.authRequired) {
    state.isAuthenticated = true;
    return true;
  }

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
  if (state.authRequired && state.authToken) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: buildAuthHeaders()
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
  
  if (state.authRequired) {
    showElement('login-screen');
    hideElement('main-ui');
  } else {
    hideElement('login-screen');
    showElement('main-ui');
  }
}

// ============================================================================
// WEBSOCKET CONNECTION
// ============================================================================

function connectWebSocket(): void {
  if (state.authRequired && !state.authToken) {
    console.error('Cannot connect WebSocket without auth token');
    return;
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const tokenQuery = state.authRequired && state.authToken ? `?token=${state.authToken}` : '';
  const wsUrl = `${protocol}//${window.location.host}/ws${tokenQuery}`;
  
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

    case 'SPOOLMAN_UPDATE':
      if (message.contextId && message.spool !== undefined) {
        // Update UI if the update is for the current context
        const currentContextId = getCurrentContextId();
        if (message.contextId === currentContextId) {
          state.activeSpool = message.spool;
          updateSpoolmanPanelState();
        }
      }
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

function getCurrentContextId(): string | null {
  if (currentContextId) {
    return currentContextId;
  }

  const select = $('printer-select') as HTMLSelectElement | null;
  if (!select || !select.value) {
    return null;
  }

  currentContextId = select.value;
  return currentContextId;
}

async function fetchPrinterContexts(): Promise<void> {
  if (state.authRequired && !state.authToken) {
    console.log('[Contexts] No auth token, skipping context fetch');
    return;
  }

  try {
    const response = await fetch('/api/contexts', {
      headers: buildAuthHeaders()
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

      const selectedContextId =
        currentContextId && contextById.has(currentContextId)
          ? currentContextId
          : result.activeContextId || fallbackContext?.id || '';

      updatePrinterSelector(result.contexts, selectedContextId);

      const activeContext = selectedContextId ? contextById.get(selectedContextId) : fallbackContext;
      currentContextId = activeContext?.id ?? null;
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
  if (state.authRequired && !state.authToken) {
    showToast('Not authenticated', 'error');
    return;
  }

  currentContextId = contextId;

  saveCurrentLayoutSnapshot();

  try {
    const response = await fetch('/api/contexts/switch', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
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

      // Reload Spoolman config and active spool for the new context
      await loadSpoolmanConfig();

      // Auto-show Spoolman component if enabled
      ensureSpoolmanVisibilityIfEnabled();

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
  if (state.authRequired && !state.authToken) {
    showToast('Not authenticated', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/printer/${endpoint}`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
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
  if (state.authRequired && !state.authToken) return;
  
  try {
    const response = await fetch('/api/printer/features', {
      headers: buildAuthHeaders()
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

// ============================================================================
// SPOOLMAN INTEGRATION
// ============================================================================

async function loadSpoolmanConfig(): Promise<void> {
  if (state.authRequired && !state.authToken) return;

  try {
    const response = await fetch('/api/spoolman/config', {
      headers: buildAuthHeaders()
    });

    const result = await response.json() as SpoolmanConfigResponse;

    if (result.success) {
      state.spoolmanConfig = result;
      console.log('[Spoolman] Config loaded:', result);

      // Load active spool using contextId from response
      if (result.enabled && result.contextId) {
        await fetchActiveSpoolForContext(result.contextId);
      }

      // Re-apply component visibility and UI state since availability may have changed
      applySettings(currentSettings);
      refreshSettingsUI(currentSettings);
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
    const response = await fetch(`/api/spoolman/active/${encodeURIComponent(targetContextId)}`, {
      headers: buildAuthHeaders()
    });

    const result = await response.json() as ActiveSpoolResponse;

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
    const response = await fetch(url, {
      headers: buildAuthHeaders()
    });

    const result = await response.json() as SpoolSearchResponse;

    if (result.success && result.spools) {
      let displaySpools = result.spools;

      // Stage 2: If server-side search returned no results and we have a query,
      // fetch all spools and filter client-side for vendor/material matching
      if (displaySpools.length === 0 && searchQuery && searchQuery.trim()) {
        console.log('[Spoolman] Server search returned no results, trying client-side fallback');

        // Fetch all spools without filter
        const allSpoolsResponse = await fetch('/api/spoolman/spools', {
          headers: buildAuthHeaders()
        });

        const allSpoolsResult = await allSpoolsResponse.json() as SpoolSearchResponse;

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
    const response = await fetch('/api/spoolman/select', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ contextId, spoolId })
    });

    const result = await response.json() as SpoolSelectResponse;

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
    const response = await fetch('/api/spoolman/select', {
      method: 'DELETE',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ contextId })
    });

    const result = await response.json() as ApiResponse;

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
    // Get camera proxy configuration from the server
    const response = await fetch('/api/camera/proxy-config', {
      headers: buildAuthHeaders()
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
  if (state.authRequired && !state.authToken) return;
  
  try {
    const response = await fetch(`/api/jobs/${source}`, {
      headers: buildAuthHeaders()
    });
    
    const result = await response.json() as FileListResponse;
    
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

  if (startNow && hasMaterialStationSupport() && isMultiColorJobFile(jobInfo)) {
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
    const response = await fetch('/api/jobs/start', {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        filename: options.filename,
        leveling: options.leveling,
        startNow: options.startNow,
        materialMappings: options.materialMappings
      })
    });

    const result = await response.json() as PrintJobStartResponse;

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

  if (!materialMatchingState) {
    confirmButton.disabled = true;
    return;
  }

  const job = materialMatchingState.pending.job;
  const requiredMappings = isAD5XJobFile(job) ? job.toolDatas.length : 0;
  confirmButton.disabled = materialMatchingState.mappings.size !== requiredMappings;
}

function renderMaterialMappings(): void {
  const container = getMaterialMatchingElement<HTMLDivElement>('material-mappings');
  if (!container) return;

  container.innerHTML = '';

  if (!materialMatchingState || materialMatchingState.mappings.size === 0) {
    const empty = document.createElement('div');
    empty.className = 'material-mapping-empty';
    empty.textContent = 'Select a tool and then choose a matching slot to create mappings.';
    container.appendChild(empty);
    return;
  }

  materialMatchingState.mappings.forEach((mapping) => {
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
  if (!materialMatchingState) {
    return;
  }

  materialMatchingState.mappings.delete(toolId);
  renderMaterialRequirements(materialMatchingState.pending.job);
  renderMaterialSlots(materialMatchingState.materialStation);
  renderMaterialMappings();
  updateMaterialMatchingConfirmState();
  clearMaterialMessages();
}

function renderMaterialRequirements(job: WebUIJobFile | undefined): void {
  const container = getMaterialMatchingElement<HTMLDivElement>('material-job-requirements');
  if (!container) return;

  container.innerHTML = '';

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

    if (materialMatchingState?.selectedToolId === tool.toolId) {
      item.classList.add('selected');
    }

    if (materialMatchingState?.mappings.has(tool.toolId)) {
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

    if (materialMatchingState?.mappings.has(tool.toolId)) {
      const mapping = materialMatchingState.mappings.get(tool.toolId);
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
  if (!materialMatchingState) {
    return;
  }

  if (materialMatchingState.selectedToolId === toolId) {
    materialMatchingState.selectedToolId = null;
  } else {
    materialMatchingState.selectedToolId = toolId;
  }

  clearMaterialMessages();
  renderMaterialRequirements(materialMatchingState.pending.job);
  renderMaterialSlots(materialMatchingState.materialStation);
}

function isSlotAlreadyAssigned(slotDisplayId: number): boolean {
  if (!materialMatchingState) {
    return false;
  }

  for (const mapping of materialMatchingState.mappings.values()) {
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
  if (!materialMatchingState) {
    return;
  }

  const job = materialMatchingState.pending.job;
  if (!job || !isAD5XJobFile(job)) {
    return;
  }

  const selectedToolId = materialMatchingState.selectedToolId;
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

  materialMatchingState.mappings.set(tool.toolId, mapping);
  materialMatchingState.selectedToolId = null;

  if (colorsDiffer(tool.materialColor, slot.materialColor)) {
    showMaterialWarning(`Tool ${tool.toolId + 1} color (${tool.materialColor}) does not match Slot ${displaySlotId} color (${slot.materialColor || 'unknown'}). The print will succeed, but appearance may differ.`);
  } else {
    clearMaterialMessages();
  }

  renderMaterialRequirements(job);
  renderMaterialSlots(materialMatchingState.materialStation);
  renderMaterialMappings();
  updateMaterialMatchingConfirmState();
}

async function fetchMaterialStationStatus(): Promise<MaterialStationStatus | null> {
  if (state.authRequired && !state.authToken) {
    return null;
  }

  try {
    const response = await fetch('/api/printer/material-station', {
      headers: buildAuthHeaders()
    });

    const result = await response.json() as MaterialStationStatusResponse;
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
  materialMatchingState = null;
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

  materialMatchingState = {
    pending: state.pendingJobStart,
    materialStation: null,
    selectedToolId: null,
    mappings: new Map()
  };

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
  if (!materialMatchingState) {
    return;
  }

  materialMatchingState.materialStation = status;
  renderMaterialSlots(status);

  if (!status || !status.connected) {
    showMaterialError(status?.errorMessage || 'Material station not connected.');
  }
}

async function confirmMaterialMatching(): Promise<void> {
  if (!materialMatchingState || !materialMatchingState.pending.job || !isAD5XJobFile(materialMatchingState.pending.job)) {
    return;
  }

  const job = materialMatchingState.pending.job;
  const requiredMappings = job.toolDatas.length;

  if (materialMatchingState.mappings.size !== requiredMappings) {
    showMaterialError('Map every tool to a material slot before starting the job.');
    return;
  }

  const mappings = Array.from(materialMatchingState.mappings.values());
  const confirmButton = getMaterialMatchingElement<HTMLButtonElement>('material-matching-confirm');

  if (confirmButton) {
    confirmButton.disabled = true;
  }

  const success = await sendJobStartRequest({
    filename: materialMatchingState.pending.filename,
    leveling: materialMatchingState.pending.leveling,
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
        // Fetch printer contexts first to populate dropdown
        await fetchPrinterContexts();
        // Load Spoolman config after contexts (loads active spool automatically)
        await loadSpoolmanConfig();
        // Auto-show Spoolman component if enabled
        ensureSpoolmanVisibilityIfEnabled();
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

  // Printer selector dropdown
  const printerSelect = $('printer-select') as HTMLSelectElement;
  if (printerSelect) {
    printerSelect.addEventListener('change', (e) => {
      const selectedContextId = (e.target as HTMLSelectElement).value;
      console.log('[Contexts] Printer selector changed to:', selectedContextId);
      currentContextId = selectedContextId;
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

async function loadAuthStatus(): Promise<void> {
  try {
    const response = await fetch('/api/auth/status');
    if (!response.ok) {
      throw new Error(`Status request failed with ${response.status}`);
    }

    const status = await response.json() as AuthStatusResponse;
    state.authRequired = status.authRequired;
    state.defaultPassword = status.defaultPassword;
    state.hasPassword = status.hasPassword;
  } catch (error) {
    console.error('Failed to load authentication status:', error);
    state.authRequired = true;
    state.defaultPassword = false;
    state.hasPassword = true;
  }
}

async function checkAuthStatus(): Promise<boolean> {
  if (!state.authRequired) {
    state.authToken = null;
    state.isAuthenticated = true;
    localStorage.removeItem('webui-token');
    sessionStorage.removeItem('webui-token');
    return true;
  }

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
      headers: buildAuthHeaders()
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

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
}

async function loadWebUITheme(): Promise<void> {
  try {
    const response = await fetch('/api/webui/theme', {
      headers: buildAuthHeaders()
    });

    if (response.ok) {
      const theme = await response.json() as ThemeColors;
      applyWebUITheme(theme);
    } else {
      console.warn('Failed to load WebUI theme, using defaults');
    }
  } catch (error) {
    console.error('Error loading WebUI theme:', error);
  }
}

function applyWebUITheme(theme: ThemeColors): void {
  const root = document.documentElement;

  root.style.setProperty('--theme-primary', theme.primary);
  root.style.setProperty('--theme-secondary', theme.secondary);
  root.style.setProperty('--theme-background', theme.background);
  root.style.setProperty('--theme-surface', theme.surface);
  root.style.setProperty('--theme-text', theme.text);

  // Compute hover states (slightly lighter for dark theme)
  const primaryHover = lightenColor(theme.primary, 15);
  const secondaryHover = lightenColor(theme.secondary, 15);
  root.style.setProperty('--theme-primary-hover', primaryHover);
  root.style.setProperty('--theme-secondary-hover', secondaryHover);

  console.log('WebUI theme applied:', theme);
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);

  // Guard against invalid hex values
  if (isNaN(num)) {
    console.warn(`Invalid hex color for lightening: ${hex}, returning original`);
    return hex;
  }

  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * (percent / 100)));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * (percent / 100)));
  const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * (percent / 100)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const DEFAULT_THEME_COLORS: ThemeColors = {
  primary: '#4285f4',
  secondary: '#357abd',
  background: '#121212',
  surface: '#1e1e1e',
  text: '#e0e0e0',
};

/**
 * Validates that a value is a valid 6-digit hex color code
 */
function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(value);
}

async function loadCurrentThemeIntoSettings(): Promise<void> {
  try {
    const response = await fetch('/api/webui/theme', {
      headers: buildAuthHeaders()
    });

    if (response.ok) {
      const theme = await response.json() as ThemeColors;
      setThemeInputValues(theme);
    } else {
      setThemeInputValues(DEFAULT_THEME_COLORS);
    }
  } catch (error) {
    console.error('Error loading theme into settings:', error);
    setThemeInputValues(DEFAULT_THEME_COLORS);
  }
}

function loadDefaultThemeIntoSettings(): void {
  setThemeInputValues(DEFAULT_THEME_COLORS);
  showToast('Theme reset to defaults. Click Apply to save.', 'info');
}

function setThemeInputValues(theme: ThemeColors): void {
  const primaryInput = $('webui-theme-primary') as HTMLInputElement | null;
  const secondaryInput = $('webui-theme-secondary') as HTMLInputElement | null;
  const backgroundInput = $('webui-theme-background') as HTMLInputElement | null;
  const surfaceInput = $('webui-theme-surface') as HTMLInputElement | null;
  const textInput = $('webui-theme-text') as HTMLInputElement | null;

  if (primaryInput) primaryInput.value = theme.primary;
  if (secondaryInput) secondaryInput.value = theme.secondary;
  if (backgroundInput) backgroundInput.value = theme.background;
  if (surfaceInput) surfaceInput.value = theme.surface;
  if (textInput) textInput.value = theme.text;
}

function getThemeFromInputs(): ThemeColors {
  const primaryInput = $('webui-theme-primary') as HTMLInputElement | null;
  const secondaryInput = $('webui-theme-secondary') as HTMLInputElement | null;
  const backgroundInput = $('webui-theme-background') as HTMLInputElement | null;
  const surfaceInput = $('webui-theme-surface') as HTMLInputElement | null;
  const textInput = $('webui-theme-text') as HTMLInputElement | null;

  // Get values and validate, falling back to defaults for invalid colors
  const primary = primaryInput?.value ?? DEFAULT_THEME_COLORS.primary;
  const secondary = secondaryInput?.value ?? DEFAULT_THEME_COLORS.secondary;
  const background = backgroundInput?.value ?? DEFAULT_THEME_COLORS.background;
  const surface = surfaceInput?.value ?? DEFAULT_THEME_COLORS.surface;
  const text = textInput?.value ?? DEFAULT_THEME_COLORS.text;

  return {
    primary: isValidHexColor(primary) ? primary : DEFAULT_THEME_COLORS.primary,
    secondary: isValidHexColor(secondary) ? secondary : DEFAULT_THEME_COLORS.secondary,
    background: isValidHexColor(background) ? background : DEFAULT_THEME_COLORS.background,
    surface: isValidHexColor(surface) ? surface : DEFAULT_THEME_COLORS.surface,
    text: isValidHexColor(text) ? text : DEFAULT_THEME_COLORS.text,
  };
}

async function handleApplyWebUITheme(): Promise<void> {
  try {
    const theme = getThemeFromInputs();

    // Save to config.json via API
    const response = await fetch('/api/webui/theme', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders()
      },
      body: JSON.stringify(theme)
    });

    if (!response.ok) {
      showToast('Failed to save theme', 'error');
      return;
    }

    // Apply theme immediately without reload
    applyWebUITheme(theme);
    showToast('Theme applied successfully', 'success');
  } catch (error) {
    console.error('Error applying WebUI theme:', error);
    showToast('Error applying theme', 'error');
  }
}

async function initialize(): Promise<void> {
  console.log('Initializing Web UI...');
  initializeLucideIcons();

  // Setup event handlers
  setupEventHandlers();

  // Load WebUI theme
  await loadWebUITheme();

  // Setup viewport change detection
  setupViewportListener();

  await loadAuthStatus();

  // Check authentication status
  const isAuthenticated = await checkAuthStatus();
  
  if (isAuthenticated) {
    // Authenticated session (or authentication not required)
    hideElement('login-screen');
    showElement('main-ui');
    
    // Try to connect and load features
    connectWebSocket();

    // Load features but handle auth failures gracefully
    try {
      await loadPrinterFeatures();
      // Fetch printer contexts first to populate dropdown
      await fetchPrinterContexts();
      // Load Spoolman config after contexts (loads active spool automatically)
      await loadSpoolmanConfig();
      // Auto-show Spoolman component if enabled
      ensureSpoolmanVisibilityIfEnabled();
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

