/**
 * @fileoverview HTTP helpers for browser e2e specs driving the headless
 * WebUI: session-token login, typed JSON/raw POSTs, emulator `/detail` reads,
 * and context-id resolution against the active printer.
 */

import type { HeadlessWebUI } from './headless-webui';

/** Common API error shape surfaced by the WebUI server. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Log in with the harness password and obtain a session token. */
export const fetchApiToken = async (server: HeadlessWebUI): Promise<string> => {
  const response = await fetch(`${server.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: server.password }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `login failed: ${String(response.status)}`);
  }
  const body = (await response.json()) as { token?: string };
  if (!body.token) {
    throw new Error('login response missing token');
  }
  return body.token;
};

/** POST a JSON payload and return the parsed JSON response. */
export const postJson = async <T>(
  server: HeadlessWebUI,
  token: string,
  path: string,
  payload: unknown
): Promise<T> => {
  const response = await fetch(`${server.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `POST ${path} failed: ${String(response.status)} ${body.error ?? ''}`.trim()
    );
  }
  return body;
};

/** POST a raw binary payload (job upload staging) and return the parsed response. */
export const postRaw = async <T>(
  server: HeadlessWebUI,
  token: string,
  path: string,
  data: Buffer,
  fileName: string
): Promise<T> => {
  const response = await fetch(`${server.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(fileName),
      Authorization: `Bearer ${token}`,
    },
    body: new Uint8Array(data),
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `POST ${path} failed: ${String(response.status)} ${body.error ?? ''}`.trim()
    );
  }
  return body;
};

/** Read the emulator's `/detail` payload for status checks. */
export const readEmulatorDetail = async (
  printer: { httpPort: number; serial: string; checkCode: string },
  checkCode?: string
): Promise<{ status?: string; [key: string]: unknown }> => {
  const response = await fetch(`http://127.0.0.1:${String(printer.httpPort)}/detail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serialNumber: printer.serial, checkCode: checkCode ?? printer.checkCode }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `emulator /detail failed: ${String(response.status)}`);
  }
  const body = (await response.json()) as { detail?: { status?: string } };
  return body.detail ?? {};
};

/** Resolve the context id the app currently has active for a printer serial. */
export const resolveContextId = async (
  server: HeadlessWebUI,
  token: string,
  serial: string
): Promise<string> => {
  const response = await fetch(`${server.baseUrl}/api/contexts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `printer-contexts failed: ${String(response.status)}`);
  }
  const body = (await response.json()) as {
    contexts?: Array<{ id: string; serialNumber?: string }>;
  };
  const match = body.contexts?.find((context) => context.serialNumber === serial);
  if (!match) {
    throw new Error(`no context found for serial ${serial}`);
  }
  return match.id;
};
