/**
 * @jest-environment jsdom
 */

/**
 * @fileoverview Jest coverage for the WebUI app bootstrap module.
 *
 * Verifies the startup sequence in `app.js`, including authenticated and
 * unauthenticated flows, post-login loading work, and the context/layout hooks
 * that trigger downstream camera, feature, and Spoolman refreshes.
 */
/**
 * @fileoverview JSDOM tests for the built WebUI app bootstrap flow, including
 * auth gating, initial data fetches, and context-switch side effects.
 */

const mockGetCurrentSettings = jest.fn().mockReturnValue({
  visibleComponents: ['status'],
  editMode: false,
});
const mockUpdateCurrentSettings = jest.fn();
const mockState = {
  activeSpool: null as unknown,
  authRequired: true,
  authToken: null as string | null,
  printerFeatures: null as unknown,
};

const mockConnectWebSocket = jest.fn();
const mockLoadAuthStatus = jest.fn();
const mockCheckAuthStatus = jest.fn();
const mockSetupAuthEventHandlers = jest.fn();
const mockInitializeCamera = jest.fn();
const mockFetchPrinterContexts = jest.fn();
const mockInitializeContextSwitching = jest.fn();
const mockSetupContextEventHandlers = jest.fn();
const mockGetCurrentContextId = jest.fn().mockReturnValue('context-1');
const mockLoadPrinterFeatures = jest.fn();
const mockSendPrinterCommand = jest.fn();
const mockSetupJobControlEventHandlers = jest.fn();
const mockStartPrintJob = jest.fn();
const mockUpdateFeatureVisibility = jest.fn();
const mockApplyDefaultTheme = jest.fn();
const mockApplySettings = jest.fn();
const mockEnsureSpoolmanVisibilityIfEnabled = jest.fn();
const mockInitializeLayout = jest.fn();
const mockLoadWebUITheme = jest.fn();
const mockPersistSettings = jest.fn();
const mockRefreshSettingsUI = jest.fn();
const mockSetupLayoutEventHandlers = jest.fn();
const mockSetupViewportListener = jest.fn();
const mockCloseMaterialMatchingModal = jest.fn();
const mockConfirmMaterialMatching = jest.fn();
const mockSetupMaterialMatchingHandlers = jest.fn();
const mockLoadSpoolmanConfig = jest.fn();
const mockSetupSpoolmanHandlers = jest.fn();
const mockInitializeLucideIcons = jest.fn();
const mockSetupDialogEventHandlers = jest.fn();
const mockSetupHeaderEventHandlers = jest.fn();
const mockUpdateConnectionStatus = jest.fn();
const mockUpdatePrinterStatus = jest.fn();
const mockUpdateSpoolmanPanelState = jest.fn();

let authHandlers: { onLoginSuccess?: () => Promise<void> | void } = {};
let contextHandlers: { onContextSwitched?: () => Promise<void> | void } = {};
let layoutHooks: { onAfterLayoutRefresh?: () => void } = {};

jest.mock('../core/AppState.js', () => ({
  getCurrentSettings: () => mockGetCurrentSettings(),
  state: mockState,
  updateCurrentSettings: (...args: unknown[]) => mockUpdateCurrentSettings(...args),
}));

jest.mock('../core/Transport.js', () => ({
  connectWebSocket: () => mockConnectWebSocket(),
  onConnectionChange: jest.fn(),
  onSpoolmanUpdate: jest.fn(),
  onStatusUpdate: jest.fn(),
}));

jest.mock('../features/authentication.js', () => ({
  checkAuthStatus: () => mockCheckAuthStatus(),
  loadAuthStatus: () => mockLoadAuthStatus(),
  setupAuthEventHandlers: (handlers: unknown) => {
    authHandlers = handlers as typeof authHandlers;
    mockSetupAuthEventHandlers(handlers);
  },
}));

jest.mock('../features/camera.js', () => ({
  initializeCamera: () => mockInitializeCamera(),
}));

jest.mock('../features/context-switching.js', () => ({
  fetchPrinterContexts: () => mockFetchPrinterContexts(),
  getCurrentContextId: () => mockGetCurrentContextId(),
  initializeContextSwitching: (handlers: unknown) => {
    contextHandlers = handlers as typeof contextHandlers;
    mockInitializeContextSwitching(handlers);
  },
  setupContextEventHandlers: (handlers: unknown) => {
    contextHandlers = handlers as typeof contextHandlers;
    mockSetupContextEventHandlers(handlers);
  },
}));

jest.mock('../features/job-control.js', () => ({
  loadPrinterFeatures: () => mockLoadPrinterFeatures(),
  sendPrinterCommand: (...args: unknown[]) => mockSendPrinterCommand(...args),
  setupJobControlEventHandlers: () => mockSetupJobControlEventHandlers(),
  startPrintJob: () => mockStartPrintJob(),
  updateFeatureVisibility: () => mockUpdateFeatureVisibility(),
}));

jest.mock('../features/layout-theme.js', () => ({
  applyDefaultTheme: () => mockApplyDefaultTheme(),
  applySettings: (...args: unknown[]) => mockApplySettings(...args),
  ensureSpoolmanVisibilityIfEnabled: () => mockEnsureSpoolmanVisibilityIfEnabled(),
  initializeLayout: (hooks: unknown) => {
    layoutHooks = hooks as typeof layoutHooks;
    mockInitializeLayout(hooks);
  },
  loadWebUITheme: () => mockLoadWebUITheme(),
  persistSettings: () => mockPersistSettings(),
  refreshSettingsUI: (...args: unknown[]) => mockRefreshSettingsUI(...args),
  setupLayoutEventHandlers: () => mockSetupLayoutEventHandlers(),
  setupViewportListener: () => mockSetupViewportListener(),
}));

jest.mock('../features/material-matching.js', () => ({
  closeMaterialMatchingModal: () => mockCloseMaterialMatchingModal(),
  confirmMaterialMatching: () => mockConfirmMaterialMatching(),
  setupMaterialMatchingHandlers: () => mockSetupMaterialMatchingHandlers(),
}));

jest.mock('../features/spoolman.js', () => ({
  loadSpoolmanConfig: () => mockLoadSpoolmanConfig(),
  setupSpoolmanHandlers: () => mockSetupSpoolmanHandlers(),
}));

jest.mock('../shared/icons.js', () => ({
  initializeLucideIcons: () => mockInitializeLucideIcons(),
}));

jest.mock('../ui/dialogs.js', () => ({
  setupDialogEventHandlers: (...args: unknown[]) => mockSetupDialogEventHandlers(...args),
}));

jest.mock('../ui/header.js', () => ({
  setupHeaderEventHandlers: (...args: unknown[]) => mockSetupHeaderEventHandlers(...args),
}));

jest.mock('../ui/panels.js', () => ({
  updateConnectionStatus: (...args: unknown[]) => mockUpdateConnectionStatus(...args),
  updatePrinterStatus: (...args: unknown[]) => mockUpdatePrinterStatus(...args),
  updateSpoolmanPanelState: () => mockUpdateSpoolmanPanelState(),
}));

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function importAppModule(): Promise<void> {
  jest.resetModules();
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    value: 'complete',
  });

  await import('../app.js');
  await flushAsyncWork();
}

describe('webui app bootstrap', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    authHandlers = {};
    contextHandlers = {};
    layoutHooks = {};
    mockState.activeSpool = null;
    mockState.authRequired = true;
    mockState.authToken = null;
    mockState.printerFeatures = null;
    mockLoadAuthStatus.mockResolvedValue(undefined);
    mockCheckAuthStatus.mockResolvedValue(true);
    mockLoadWebUITheme.mockResolvedValue(undefined);
    mockLoadPrinterFeatures.mockResolvedValue(undefined);
    mockFetchPrinterContexts.mockResolvedValue(undefined);
    mockLoadSpoolmanConfig.mockResolvedValue(undefined);

    document.body.innerHTML = `
      <div id="login-screen"></div>
      <div id="main-ui" class="hidden"></div>
      <input id="password-input" />
    `;
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  it('initializes the authenticated WebUI and runs post-login loading tasks', async () => {
    await importAppModule();

    expect(mockInitializeLucideIcons).toHaveBeenCalled();
    expect(mockSetupLayoutEventHandlers).toHaveBeenCalled();
    expect(mockSetupHeaderEventHandlers).toHaveBeenCalled();
    expect(mockSetupDialogEventHandlers).toHaveBeenCalled();
    expect(mockSetupJobControlEventHandlers).toHaveBeenCalled();
    expect(mockSetupMaterialMatchingHandlers).toHaveBeenCalled();
    expect(mockSetupSpoolmanHandlers).toHaveBeenCalled();
    expect(mockInitializeLayout).toHaveBeenCalled();
    expect(mockSetupViewportListener).toHaveBeenCalled();
    expect(mockApplyDefaultTheme).toHaveBeenCalled();
    expect(mockLoadAuthStatus).toHaveBeenCalled();
    expect(mockLoadWebUITheme).toHaveBeenCalled();
    expect(mockCheckAuthStatus).toHaveBeenCalled();
    expect(mockConnectWebSocket).toHaveBeenCalled();
    expect(mockLoadPrinterFeatures).toHaveBeenCalled();
    expect(mockFetchPrinterContexts).toHaveBeenCalled();
    expect(mockLoadSpoolmanConfig).toHaveBeenCalled();
    expect(mockEnsureSpoolmanVisibilityIfEnabled).toHaveBeenCalled();
    expect(mockInitializeCamera).toHaveBeenCalled();
    expect(document.getElementById('login-screen')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('main-ui')?.classList.contains('hidden')).toBe(false);
  });

  it('shows the login screen and focuses the password field when not authenticated', async () => {
    mockCheckAuthStatus.mockResolvedValue(false);

    await importAppModule();

    expect(document.getElementById('login-screen')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('main-ui')?.classList.contains('hidden')).toBe(true);
    expect(document.activeElement).toBe(document.getElementById('password-input'));
    expect(mockConnectWebSocket).not.toHaveBeenCalled();
  });

  it('routes context-switch and layout-refresh hooks through the expected reload paths', async () => {
    await importAppModule();

    mockLoadPrinterFeatures.mockClear();
    mockLoadSpoolmanConfig.mockClear();
    mockEnsureSpoolmanVisibilityIfEnabled.mockClear();
    mockInitializeCamera.mockClear();
    mockUpdateFeatureVisibility.mockClear();

    await contextHandlers.onContextSwitched?.();
    layoutHooks.onAfterLayoutRefresh?.();

    expect(mockLoadPrinterFeatures).toHaveBeenCalledTimes(1);
    expect(mockLoadSpoolmanConfig).toHaveBeenCalledTimes(1);
    expect(mockEnsureSpoolmanVisibilityIfEnabled).toHaveBeenCalledTimes(1);
    expect(mockInitializeCamera).toHaveBeenCalledTimes(2);
    expect(mockUpdateFeatureVisibility).toHaveBeenCalledTimes(1);
  });
});
