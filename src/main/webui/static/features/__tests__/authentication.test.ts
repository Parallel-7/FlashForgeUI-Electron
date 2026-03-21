/**
 * @jest-environment jsdom
 */

/**
 * @fileoverview Jest coverage for the WebUI authentication feature module.
 *
 * Covers login token persistence, auth-status fallback behavior, login/logout
 * UI transitions, and the post-login callback wiring exposed by
 * `authentication.js`.
 */
/**
 * @fileoverview JSDOM tests for WebUI authentication helpers, including login state,
 * token persistence, and post-login bootstrap behavior.
 */

const mockApiRequest = jest.fn();
const mockApiRequestWithMetadata = jest.fn();
const mockDisconnectWebSocket = jest.fn();
const mockSetCurrentPrinterSerial = jest.fn();
const mockUpdateCurrentSettings = jest.fn();
const mockIsGridInitialized = jest.fn();
const mockGridClear = jest.fn();
const mockGridDisableEdit = jest.fn();
const mockCloseSettingsModal = jest.fn();

const contextById = new Map<string, unknown>();
const defaultSettings = {
  visibleComponents: ['status'],
  editMode: false,
};
const mockState = {
  authRequired: true,
  authToken: null as string | null,
  isAuthenticated: false,
  defaultPassword: false,
  hasPassword: true,
};

jest.mock('../../core/Transport.js', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  apiRequestWithMetadata: (...args: unknown[]) => mockApiRequestWithMetadata(...args),
  disconnectWebSocket: () => mockDisconnectWebSocket(),
}));

jest.mock('../../core/AppState.js', () => ({
  contextById,
  DEFAULT_SETTINGS: defaultSettings,
  gridManager: {
    clear: () => mockGridClear(),
    disableEdit: () => mockGridDisableEdit(),
  },
  isGridInitialized: () => mockIsGridInitialized(),
  setCurrentPrinterSerial: (...args: unknown[]) => mockSetCurrentPrinterSerial(...args),
  state: mockState,
  updateCurrentSettings: (...args: unknown[]) => mockUpdateCurrentSettings(...args),
}));

jest.mock('../layout-theme.js', () => ({
  closeSettingsModal: () => mockCloseSettingsModal(),
}));

import { checkAuthStatus, loadAuthStatus, login, logout, setupAuthEventHandlers } from '../authentication.js';

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('webui authentication feature', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    contextById.clear();
    localStorage.clear();
    sessionStorage.clear();
    mockState.authRequired = true;
    mockState.authToken = null;
    mockState.isAuthenticated = false;
    mockState.defaultPassword = false;
    mockState.hasPassword = true;
    mockIsGridInitialized.mockReturnValue(true);

    document.body.innerHTML = `
      <div id="login-screen"></div>
      <div id="main-ui" class="hidden"></div>
      <button id="login-button">Login</button>
      <input id="password-input" />
      <input id="remember-me-checkbox" type="checkbox" />
      <div id="login-error"></div>
      <button id="logout-button">Logout</button>
    `;
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('stores remembered login tokens in localStorage', async () => {
    mockApiRequest.mockResolvedValue({
      success: true,
      token: 'remembered-token',
    });

    const result = await login('secret', true);

    expect(result).toBe(true);
    expect(mockState.authToken).toBe('remembered-token');
    expect(mockState.isAuthenticated).toBe(true);
    expect(localStorage.getItem('webui-token')).toBe('remembered-token');
    expect(sessionStorage.getItem('webui-token')).toBeNull();
  });

  it('wires login events and runs post-login hooks', async () => {
    mockApiRequest.mockResolvedValue({
      success: true,
      token: 'session-token',
    });

    const onLoginSuccess = jest.fn();
    setupAuthEventHandlers({ onLoginSuccess });

    const passwordInput = document.getElementById('password-input') as HTMLInputElement;
    const rememberCheckbox = document.getElementById('remember-me-checkbox') as HTMLInputElement;
    const loginButton = document.getElementById('login-button') as HTMLButtonElement;

    passwordInput.value = 'secret';
    rememberCheckbox.checked = false;
    loginButton.click();
    await flushAsyncWork();

    expect(onLoginSuccess).toHaveBeenCalled();
    expect(sessionStorage.getItem('webui-token')).toBe('session-token');
    expect(document.getElementById('login-screen')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('main-ui')?.classList.contains('hidden')).toBe(false);
  });

  it('surfaces empty-password validation without calling the API', () => {
    setupAuthEventHandlers();

    const loginButton = document.getElementById('login-button') as HTMLButtonElement;
    loginButton.click();

    expect(document.getElementById('login-error')?.textContent).toBe('Please enter a password');
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('clears stored tokens when auth validation receives a 401', async () => {
    localStorage.setItem('webui-token', 'stale-token');
    mockApiRequestWithMetadata.mockResolvedValue({
      ok: false,
      status: 401,
      data: {
        success: false,
      },
    });

    const result = await checkAuthStatus();

    expect(result).toBe(false);
    expect(mockState.authToken).toBeNull();
    expect(mockState.isAuthenticated).toBe(false);
    expect(localStorage.getItem('webui-token')).toBeNull();
    expect(sessionStorage.getItem('webui-token')).toBeNull();
  });

  it('falls back to secure auth defaults when loading status fails', async () => {
    mockApiRequest.mockRejectedValue(new Error('network down'));

    await loadAuthStatus();

    expect(mockState.authRequired).toBe(true);
    expect(mockState.defaultPassword).toBe(false);
    expect(mockState.hasPassword).toBe(true);
  });

  it('resets client state and UI during logout', async () => {
    mockState.authRequired = true;
    mockState.authToken = 'logout-token';
    mockState.isAuthenticated = true;
    localStorage.setItem('webui-token', 'logout-token');
    contextById.set('context-1', { id: 'context-1' });
    mockApiRequest.mockResolvedValue({
      success: true,
    });

    await logout();

    expect(mockDisconnectWebSocket).toHaveBeenCalled();
    expect(mockSetCurrentPrinterSerial).toHaveBeenCalledWith(null);
    expect(mockUpdateCurrentSettings).toHaveBeenCalledWith({ ...defaultSettings });
    expect(mockGridClear).toHaveBeenCalled();
    expect(mockGridDisableEdit).toHaveBeenCalled();
    expect(mockCloseSettingsModal).toHaveBeenCalled();
    expect(contextById.size).toBe(0);
    expect(document.getElementById('login-screen')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('main-ui')?.classList.contains('hidden')).toBe(true);
  });
});
