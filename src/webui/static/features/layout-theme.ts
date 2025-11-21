/**
 * @fileoverview Layout and theme management utilities for the WebUI client.
 *
 * Provides GridStack initialization, per-printer layout persistence, settings
 * dialog management, responsive handling, and WebUI theme customization.
 * Exposes hooks that let the orchestrator react to layout rehydration without
 * introducing direct coupling to UI rendering functions.
 */

import { componentRegistry } from '../grid/WebUIComponentRegistry.js';
import type { WebUIComponentLayout, WebUIGridLayout } from '../grid/types.js';
import {
  ALL_COMPONENT_IDS,
  DEFAULT_SETTINGS,
  DEMO_SERIAL,
  gridManager,
  layoutPersistence,
  mobileLayoutManager,
  state,
  getCurrentPrinterSerial,
  setCurrentPrinterSerial,
  getCurrentSettings,
  updateCurrentSettings,
  getGridChangeUnsubscribe,
  setGridChangeUnsubscribe,
  isGridInitialized,
  setGridInitialized,
  isMobile as isMobileLayoutEnabled,
  setMobileLayout,
  getCurrentContextId as getStoredContextId,
} from '../core/AppState.js';
import type { ApiResponse, PrinterFeatures, PrinterStatus, WebUISettings } from '../app.js';
import { apiRequest, apiRequestWithMetadata } from '../core/Transport.js';
import { $, showToast } from '../shared/dom.js';
import { updateEditModeToggle } from '../ui/header.js';

export interface LayoutUiHooks {
  onConnectionStatusUpdate?: (connected: boolean) => void;
  onPrinterStatusUpdate?: (status: PrinterStatus | null) => void;
  onSpoolmanPanelUpdate?: () => void;
  onAfterLayoutRefresh?: () => void;
}

let layoutUiHooks: LayoutUiHooks = {};

export function initializeLayout(hooks: LayoutUiHooks = {}): void {
  layoutUiHooks = { ...hooks };
  updateEditModeToggle(getCurrentSettings().editMode);
}

export function setupLayoutEventHandlers(): void {
  const settingsButton = $('settings-button') as HTMLButtonElement | null;
  const closeButton = $('close-settings') as HTMLButtonElement | null;
  const saveButton = $('save-settings-btn') as HTMLButtonElement | null;
  const resetButton = $('reset-layout-btn') as HTMLButtonElement | null;
  const modal = $('settings-modal');
  const modalEditToggle = $('toggle-edit-mode') as HTMLInputElement | null;
  const applyThemeButton = $('apply-webui-theme-btn') as HTMLButtonElement | null;
  const resetThemeButton = $('reset-webui-theme-btn') as HTMLButtonElement | null;

  settingsButton?.addEventListener('click', () => openSettingsModal());
  closeButton?.addEventListener('click', () => closeSettingsModal());

  saveButton?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      '#settings-modal input[type="checkbox"][data-component-id]',
    );
    const visibleComponents = Array.from(checkboxes)
      .filter((checkbox) => checkbox.checked && !checkbox.disabled)
      .map((checkbox) => checkbox.dataset.componentId ?? '')
      .filter((componentId): componentId is string => componentId.length > 0);

    const editMode = (modalEditToggle?.checked ?? false);

    const updatedSettings: WebUISettings = {
      visibleComponents:
        visibleComponents.length > 0 ? visibleComponents : [...DEFAULT_SETTINGS.visibleComponents],
      editMode,
    };

    updateCurrentSettings(updatedSettings);
    applySettings(updatedSettings);
    persistSettings();
    closeSettingsModal();
  });

  resetButton?.addEventListener('click', () => {
    resetLayoutForCurrentPrinter();
    refreshSettingsUI(getCurrentSettings());
  });

  applyThemeButton?.addEventListener('click', () => {
    void handleApplyWebUITheme();
  });

  resetThemeButton?.addEventListener('click', () => {
    loadDefaultThemeIntoSettings();
  });

  modalEditToggle?.addEventListener('change', (event) => {
    const settings = getCurrentSettings();
    const updatedSettings: WebUISettings = {
      ...settings,
      editMode: (event.target as HTMLInputElement).checked,
    };
    updateCurrentSettings(updatedSettings);
    applySettings(updatedSettings);
    persistSettings();
  });

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeSettingsModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSettingsModal();
    }
  });
}

export function setupViewportListener(): void {
  const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleViewportChange);
  } else {
    mediaQuery.addListener(handleViewportChange);
  }

  let resizeTimeout: number;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = window.setTimeout(handleViewportChange, 250);
  });
}

export const MOBILE_BREAKPOINT = 768;

export function handleViewportChange(): void {
  const mobile = isMobileViewport();

  if (mobile === isMobileLayoutEnabled()) {
    return;
  }

  if (!mobile && isGridInitialized()) {
    saveCurrentLayoutSnapshot();
  }

  loadLayoutForCurrentPrinter();
  setMobileLayout(mobile);
}

export function isMobileViewport(): boolean {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

export function ensureGridInitialized(): void {
  if (isGridInitialized()) {
    return;
  }

  gridManager.initialize({
    column: 12,
    cellHeight: 80,
    margin: 8,
    staticGrid: true,
    float: false,
    animate: true,
    minRow: 11,
  });
  gridManager.disableEdit();
  setGridInitialized(true);
}

export function teardownDesktopLayout(): void {
  if (!isGridInitialized()) {
    return;
  }

  const unsubscribe = getGridChangeUnsubscribe();
  if (unsubscribe) {
    unsubscribe();
    setGridChangeUnsubscribe(null);
  }

  gridManager.disableEdit();
  gridManager.clear();
}

export function teardownMobileLayout(): void {
  mobileLayoutManager.clear();
}

export function resetLayoutContainers(): void {
  teardownCameraStreamElements();
  teardownDesktopLayout();
  teardownMobileLayout();
}

export function rehydrateLayoutState(): void {
  layoutUiHooks.onConnectionStatusUpdate?.(state.isConnected);

  if (layoutUiHooks.onPrinterStatusUpdate) {
    layoutUiHooks.onPrinterStatusUpdate(state.printerStatus ?? null);
  }

  layoutUiHooks.onSpoolmanPanelUpdate?.();
}

export function ensureCompleteLayout(baseLayout: WebUIGridLayout | null): WebUIGridLayout {
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

export function sanitizeLayoutConfig(
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

export function loadSettingsForSerial(serialNumber: string | null): WebUISettings {
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

export function persistSettings(): void {
  const serial = getCurrentPrinterSerial();
  if (!serial) {
    return;
  }
  layoutPersistence.saveSettings(serial, getCurrentSettings());
}

export function applySettings(settings: WebUISettings): void {
  const mobile = isMobileViewport();

  for (const componentId of ALL_COMPONENT_IDS) {
    const shouldShow = shouldComponentBeVisible(
      componentId,
      settings,
      state.printerFeatures ?? null,
    );

    if (mobile) {
      if (shouldShow) {
        mobileLayoutManager.showComponent(componentId);
      } else {
        mobileLayoutManager.hideComponent(componentId);
      }
    } else {
      if (!isGridInitialized()) {
        return;
      }
      if (shouldShow) {
        gridManager.showComponent(componentId);
      } else {
        gridManager.hideComponent(componentId);
      }
    }
  }

  if (!mobile && isGridInitialized()) {
    if (settings.editMode) {
      gridManager.enableEdit();
    } else {
      gridManager.disableEdit();
    }
  }

  updateEditModeToggle(mobile ? false : settings.editMode);
}

export function refreshSettingsUI(settings: WebUISettings): void {
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

export function handleLayoutChange(layout: WebUIGridLayout): void {
  const serial = getCurrentPrinterSerial();
  if (!serial) {
    return;
  }
  layoutPersistence.save(layout, serial);
}

export function saveCurrentLayoutSnapshot(): void {
  if (!isGridInitialized()) {
    return;
  }
  const serial = getCurrentPrinterSerial();
  if (!serial) {
    return;
  }
  const snapshot = gridManager.serialize();
  layoutPersistence.save(snapshot, serial);
}

export function loadLayoutForCurrentPrinter(): void {
  let serial = getCurrentPrinterSerial();
  if (!serial) {
    serial = DEMO_SERIAL;
    setCurrentPrinterSerial(serial);
  }

  const mobile = isMobileViewport();

  resetLayoutContainers();

  if (mobile) {
    mobileLayoutManager.initialize();
    const settings = loadSettingsForSerial(serial);
    updateCurrentSettings(settings);
    mobileLayoutManager.load(settings.visibleComponents);
    setMobileLayout(true);
  } else {
    ensureGridInitialized();
    const storedLayout = layoutPersistence.load(serial);
    const layout = ensureCompleteLayout(storedLayout);

    gridManager.load(layout);

    const unsubscribe = getGridChangeUnsubscribe();
    if (unsubscribe) {
      unsubscribe();
    }
    setGridChangeUnsubscribe(gridManager.onChange(handleLayoutChange));
    setMobileLayout(false);
  }

  const updatedSettings = loadSettingsForSerial(serial);
  updateCurrentSettings(updatedSettings);
  applySettings(updatedSettings);
  refreshSettingsUI(updatedSettings);
  rehydrateLayoutState();
  layoutUiHooks.onAfterLayoutRefresh?.();
}

export function openSettingsModal(): void {
  const modal = $('settings-modal');
  if (!modal) return;
  refreshSettingsUI(getCurrentSettings());
  void loadCurrentThemeIntoSettings();
  modal.classList.remove('hidden');
}

export function closeSettingsModal(): void {
  const modal = $('settings-modal');
  if (!modal) return;
  modal.classList.add('hidden');
}

export function resetLayoutForCurrentPrinter(): void {
  const serial = getCurrentPrinterSerial();
  if (!serial) {
    return;
  }

  layoutPersistence.reset(serial);
  updateCurrentSettings({ ...DEFAULT_SETTINGS });
  persistSettings();
  loadLayoutForCurrentPrinter();
  showToast('Layout reset to default', 'info');
}

export function isSpoolmanAvailableForCurrentContext(): boolean {
  if (!state.spoolmanConfig?.enabled) {
    return false;
  }

  if (!state.spoolmanConfig.contextId) {
    return true;
  }

  return state.spoolmanConfig.contextId === getStoredContextId();
}

export function isComponentSupported(componentId: string, features: PrinterFeatures | null): boolean {
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

export function shouldComponentBeVisible(
  componentId: string,
  settings: WebUISettings,
  features: PrinterFeatures | null,
): boolean {
  if (!settings.visibleComponents.includes(componentId)) {
    return false;
  }
  return isComponentSupported(componentId, features);
}

export function ensureSpoolmanVisibilityIfEnabled(): void {
  if (!isSpoolmanAvailableForCurrentContext()) {
    return;
  }
  if (!isGridInitialized()) {
    return;
  }

  const settings = getCurrentSettings();
  if (!settings.visibleComponents.includes('spoolman-tracker')) {
    const updatedSettings: WebUISettings = {
      ...settings,
      visibleComponents: [...settings.visibleComponents, 'spoolman-tracker'],
    };
    updateCurrentSettings(updatedSettings);
    gridManager.showComponent('spoolman-tracker');
    persistSettings();
  }
}

export async function loadWebUITheme(): Promise<void> {
  try {
    const response = await apiRequestWithMetadata<unknown>('/api/webui/theme');

    if (response.ok && isThemeColors(response.data)) {
      applyWebUITheme(response.data);
      return;
    }

    console.warn('WebUI theme endpoint returned unexpected payload. Falling back to default.', response.status);
  } catch (error) {
    console.error('Error loading WebUI theme:', error);
  }

  applyDefaultTheme();
}

interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
}

export function applyWebUITheme(theme: ThemeColors): void {
  const root = document.documentElement;

  root.style.setProperty('--theme-primary', theme.primary);
  root.style.setProperty('--theme-secondary', theme.secondary);
  root.style.setProperty('--theme-background', theme.background);
  root.style.setProperty('--theme-surface', theme.surface);
  root.style.setProperty('--theme-text', theme.text);

  const primaryHover = lightenColor(theme.primary, 15);
  const secondaryHover = lightenColor(theme.secondary, 15);
  root.style.setProperty('--theme-primary-hover', primaryHover);
  root.style.setProperty('--theme-secondary-hover', secondaryHover);
}

export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);

  if (Number.isNaN(num)) {
    return hex;
  }

  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * (percent / 100)));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * (percent / 100)));
  const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * (percent / 100)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export async function loadCurrentThemeIntoSettings(): Promise<void> {
  try {
    const theme = await apiRequest<ThemeColors>('/api/webui/theme');
    setThemeInputValues(theme);
  } catch (error) {
    console.error('Error loading theme into settings:', error);
    setThemeInputValues(DEFAULT_THEME_COLORS);
  }
}

export function loadDefaultThemeIntoSettings(): void {
  setThemeInputValues(DEFAULT_THEME_COLORS);
  showToast('Theme reset to defaults. Click Apply to save.', 'info');
}

export async function handleApplyWebUITheme(): Promise<void> {
  try {
    const theme = getThemeFromInputs();

    await apiRequest<ApiResponse>('/api/webui/theme', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(theme),
    });

    applyWebUITheme(theme);
    showToast('Theme applied successfully', 'success');
  } catch (error) {
    console.error('Error applying theme:', error);
    showToast('Error applying theme', 'error');
  }
}

const DEFAULT_THEME_COLORS: ThemeColors = {
  primary: '#4285f4',
  secondary: '#357abd',
  background: '#121212',
  surface: '#1e1e1e',
  text: '#e0e0e0',
};

export function applyDefaultTheme(): void {
  applyWebUITheme(DEFAULT_THEME_COLORS);
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

function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(value);
}

function isThemeColors(value: unknown): value is ThemeColors {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.primary === 'string' &&
    typeof candidate.secondary === 'string' &&
    typeof candidate.background === 'string' &&
    typeof candidate.surface === 'string' &&
    typeof candidate.text === 'string'
  );
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
