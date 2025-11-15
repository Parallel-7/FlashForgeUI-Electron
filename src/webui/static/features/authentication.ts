/**
 * @fileoverview Authentication helpers and event wiring for the WebUI client.
 *
 * Manages login/logout flows, token persistence, and authentication status
 * checks. Exposes event handler setup with optional hooks so the orchestrator
 * can trigger additional work (e.g., WebSocket connect, context refresh)
 * without tightly coupling modules.
 */

import type { ApiResponse, AuthResponse, AuthStatusResponse } from '../app.js';
import { apiRequest, apiRequestWithMetadata, disconnectWebSocket } from '../core/Transport.js';
import {
  DEFAULT_SETTINGS,
  contextById,
  gridManager,
  isGridInitialized,
  setCurrentPrinterSerial,
  state,
  updateCurrentSettings,
} from '../core/AppState.js';
import { $, hideElement, setTextContent, showElement } from '../shared/dom.js';
import { closeSettingsModal } from './layout-theme.js';

export interface AuthEventHandlers {
  onLoginSuccess?: () => Promise<void> | void;
  onLogout?: () => Promise<void> | void;
}

let authHandlers: AuthEventHandlers = {};

export function setupAuthEventHandlers(handlers: AuthEventHandlers = {}): void {
  authHandlers = handlers;

  const loginBtn = $('login-button');
  const passwordInput = $('password-input') as HTMLInputElement | null;
  const rememberMe = $('remember-me-checkbox') as HTMLInputElement | null;

  if (loginBtn && passwordInput) {
    loginBtn.addEventListener('click', async () => {
      const password = passwordInput.value;
      const remember = rememberMe?.checked ?? false;

      if (!password) {
        setTextContent('login-error', 'Please enter a password');
        return;
      }

      loginBtn.textContent = 'Logging in...';
      (loginBtn as HTMLButtonElement).disabled = true;

      const success = await login(password, remember);
      if (success) {
        hideElement('login-screen');
        showElement('main-ui');
        if (authHandlers.onLoginSuccess) {
          await authHandlers.onLoginSuccess();
        }
      }

      loginBtn.textContent = 'Login';
      (loginBtn as HTMLButtonElement).disabled = false;
    });

    passwordInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        loginBtn.click();
      }
    });
  }

  const logoutBtn = $('logout-button');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logout();
      if (authHandlers.onLogout) {
        await authHandlers.onLogout();
      }
    });
  }
}

export async function login(password: string, rememberMe: boolean): Promise<boolean> {
  if (!state.authRequired) {
    state.isAuthenticated = true;
    return true;
  }

  try {
    const result = await apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password, rememberMe }),
    });

    if (result.success && result.token) {
      state.authToken = result.token;
      state.isAuthenticated = true;
      if (rememberMe) {
        localStorage.setItem('webui-token', result.token);
      } else {
        sessionStorage.setItem('webui-token', result.token);
      }
      return true;
    }

    setTextContent('login-error', result.message || 'Login failed');
    return false;
  } catch (error) {
    console.error('Login error:', error);
    setTextContent('login-error', 'Network error. Please try again.');
    return false;
  }
}

export async function logout(): Promise<void> {
  if (state.authRequired && state.authToken) {
    try {
      await apiRequest<ApiResponse>('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  state.authToken = null;
  state.isAuthenticated = false;
  localStorage.removeItem('webui-token');
  sessionStorage.removeItem('webui-token');

  disconnectWebSocket();

  setCurrentPrinterSerial(null);
  updateCurrentSettings({ ...DEFAULT_SETTINGS });
  contextById.clear();
  if (isGridInitialized()) {
    gridManager.clear();
    gridManager.disableEdit();
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

export async function loadAuthStatus(): Promise<void> {
  try {
    const status = await apiRequest<AuthStatusResponse>('/api/auth/status');
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

export async function checkAuthStatus(): Promise<boolean> {
  if (!state.authRequired) {
    state.authToken = null;
    state.isAuthenticated = true;
    localStorage.removeItem('webui-token');
    sessionStorage.removeItem('webui-token');
    return true;
  }

  const storedToken = localStorage.getItem('webui-token') || sessionStorage.getItem('webui-token');
  if (!storedToken) {
    return false;
  }

  state.authToken = storedToken;
  state.isAuthenticated = true;

  try {
    const result = await apiRequestWithMetadata<ApiResponse>('/api/printer/status');

    if (result.ok || result.status === 503) {
      return true;
    }

    if (result.status === 401) {
      clearStoredToken();
      return false;
    }

    return true;
  } catch (error) {
    console.error('Auth check failed:', error);
    return true;
  }
}

function clearStoredToken(): void {
  state.authToken = null;
  state.isAuthenticated = false;
  localStorage.removeItem('webui-token');
  sessionStorage.removeItem('webui-token');
}
