/**
 * @fileoverview REST and WebSocket transport utilities for the WebUI client.
 *
 * Provides fetch helpers with automatic auth header injection plus WebSocket
 * connection management with simple callback registration for status and
 * spoolman updates. Keeps transport concerns isolated from UI orchestration.
 */

import type {
  ActiveSpoolData,
  PrinterStatus,
  WebSocketCommand,
  WebSocketMessage,
} from '../app.js';
import { showToast } from '../shared/dom.js';
import { state } from './AppState.js';

export function buildAuthHeaders(
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

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  return { ...headers };
}

type ApiResponseMetadata<T> = {
  data: T;
  status: number;
  ok: boolean;
};

async function performRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponseMetadata<T>> {
  const { headers, ...rest } = options;
  const response = await fetch(endpoint, {
    ...rest,
    headers: buildAuthHeaders(normalizeHeaders(headers)),
  });

  if (response.status === 204) {
    return { data: {} as T, status: response.status, ok: response.ok };
  }

  const text = await response.text();
  if (!text) {
    return { data: {} as T, status: response.status, ok: response.ok };
  }

  try {
    return {
      data: JSON.parse(text) as T,
      status: response.status,
      ok: response.ok,
    };
  } catch {
    throw new Error('Failed to parse server response');
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const result = await performRequest<T>(endpoint, options);
  return result.data;
}

export async function apiRequestWithMetadata<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponseMetadata<T>> {
  return performRequest<T>(endpoint, options);
}

type StatusUpdateCallback = (status: PrinterStatus) => void;
type SpoolmanUpdateCallback = (contextId: string, spool: ActiveSpoolData | null) => void;
type ConnectionChangeCallback = (connected: boolean) => void;

const statusUpdateCallbacks: StatusUpdateCallback[] = [];
const spoolmanUpdateCallbacks: SpoolmanUpdateCallback[] = [];
const connectionCallbacks: ConnectionChangeCallback[] = [];

export function onStatusUpdate(callback: StatusUpdateCallback): void {
  statusUpdateCallbacks.push(callback);
}

export function onSpoolmanUpdate(callback: SpoolmanUpdateCallback): void {
  spoolmanUpdateCallbacks.push(callback);
}

export function onConnectionChange(callback: ConnectionChangeCallback): void {
  connectionCallbacks.push(callback);
}

function notifyConnectionChange(connected: boolean): void {
  connectionCallbacks.forEach((callback) => {
    callback(connected);
  });
}

export function connectWebSocket(): void {
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
      notifyConnectionChange(true);
      sendCommand({ command: 'REQUEST_STATUS' });
    };

    state.websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    state.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    state.websocket.onclose = () => {
      console.log('WebSocket disconnected');
      state.isConnected = false;
      state.websocket = null;
      notifyConnectionChange(false);

      if (state.isAuthenticated && state.reconnectAttempts < state.maxReconnectAttempts) {
        state.reconnectAttempts++;
        setTimeout(
          () => connectWebSocket(),
          state.reconnectDelay * state.reconnectAttempts,
        );
      }
    };
  } catch (error) {
    console.error('Failed to create WebSocket:', error);
  }
}

export function disconnectWebSocket(): void {
  if (state.websocket) {
    state.websocket.close();
    state.websocket = null;
  }
}

export function sendCommand(command: WebSocketCommand): void {
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
        statusUpdateCallbacks.forEach((callback) => callback(message.status!));
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
      break;

    case 'SPOOLMAN_UPDATE':
      if (message.contextId) {
        spoolmanUpdateCallbacks.forEach((callback) =>
          callback(message.contextId!, message.spool ?? null),
        );
      }
      break;
  }
}
