/**
 * @fileoverview Boots the real FlashForgeUI headless process so browser tests drive the
 * production WebUI server.
 *
 * There is deliberately no fixture or stub here. This starts emulator printers, seeds an
 * isolated app profile, launches FlashForgeUI with `--headless`, and waits for the WebUI
 * server the app itself starts. Every request a test makes is served by the real Express
 * app: real `createAPIRoutes`, real `AuthManager` and auth middleware, real security and
 * static-asset middleware, real `WebSocketManager` broadcasting real polling data from the
 * emulated printers.
 *
 * The previous version of this suite ran against a hand-written reimplementation of the
 * API. It could not catch a single server-side regression, and it could drift from the
 * real routes without any test noticing. Nothing in this file may reimplement app
 * behaviour - if a test needs a response, the app has to produce it.
 *
 * Key exports:
 * - startHeadlessWebUI(): boot emulators + the headless app, return its base URL
 * - describeHeadlessSkipReason(): why this suite cannot run here (Windows without admin)
 */

import { type ChildProcessByStdio, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import type { Readable } from 'node:stream';
import { type EmulatorModel, startEmulatorInstance, stopProcessTree } from '../../electron/helpers/emulator-harness';

const require_ = createRequire(import.meta.url);

const SERVER_READY_TIMEOUT_MS = 120_000;
const PRINTER_READY_TIMEOUT_MS = 90_000;
const READY_POLL_INTERVAL_MS = 400;
const LOG_TAIL_LINES = 40;

/** Password the harness configures the WebUI with. Tests need it to log in. */
export const WEBUI_TEST_PASSWORD = 'e2e-webui-password';

export interface HeadlessPrinter {
  label: string;
  model: EmulatorModel;
  serial: string;
  checkCode: string;
  /** Must not contain spaces: the emulator CLI parses argv positionally. */
  machineName: string;
  tcpPort: number;
  httpPort: number;
}

/**
 * Two printers by default so context switching has real contexts to switch between.
 *
 * Only one instance per machine can hold the firmware default ports, so the second is
 * shifted. Both are reached through the saved profile, which carries explicit ports.
 */
export const DEFAULT_HEADLESS_PRINTERS: readonly HeadlessPrinter[] = [
  {
    label: 'Adventurer 5M Pro (emulated)',
    model: 'adventurer-5m-pro',
    serial: 'E2E-WEBUI-5MPRO',
    checkCode: '123',
    machineName: 'WebUI-5MPro',
    tcpPort: 8899,
    httpPort: 8898,
  },
  {
    label: 'AD5X (emulated)',
    model: 'adventurer-5x',
    serial: 'E2E-WEBUI-AD5X',
    checkCode: '123',
    machineName: 'WebUI-AD5X',
    tcpPort: 8999,
    httpPort: 8998,
  },
];

export interface HeadlessWebUI {
  /** Base URL of the WebUI server the app started. */
  readonly baseUrl: string;
  readonly password: string;
  /** Printers the app connected, in the order they were seeded. */
  readonly printers: readonly HeadlessPrinter[];
  /** Recent app stdout/stderr, for failure messages. */
  logTail(): string;
  stop(): Promise<void>;
}

export interface StartHeadlessWebUIOptions {
  printers?: readonly HeadlessPrinter[];
  password?: string;
  /** Number of printers the app must have connected before tests start. */
  requireConnectedPrinters?: number;
}

/**
 * Explains why this suite cannot run in the current environment.
 *
 * On Windows the WebUI refuses to start without administrator rights (it binds a network
 * port), and in headless mode it calls process.exit(1) rather than prompting. Detecting
 * that up front turns a confusing crash into an actionable skip. Linux and macOS always
 * pass, so CI is unaffected.
 */
export const describeHeadlessSkipReason = (): string | null => {
  if (process.platform !== 'win32') {
    return null;
  }

  if (isWindowsAdmin()) {
    return null;
  }

  return (
    'The WebUI requires administrator privileges on Windows, and headless mode exits ' +
    'instead of prompting. Run this suite from an elevated terminal, or let CI (Linux) cover it.'
  );
};

/**
 * Mirrors EnvironmentDetectionService.isRunningAsAdmin(): if we can write into the Windows
 * temp directory we are elevated. Kept in sync deliberately - this only decides whether to
 * skip, and the app remains the authority on whether it will actually start.
 */
const isWindowsAdmin = (): boolean => {
  try {
    const fs = require_('node:fs') as typeof import('node:fs');
    const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
    const probe = path.join(systemRoot, 'temp', `ffui-e2e-admin-${Date.now()}.tmp`);
    fs.writeFileSync(probe, 'probe');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
};

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Asks the OS for a free port so parallel runs and stray servers cannot collide. */
const findFreePort = async (): Promise<number> =>
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address === null || typeof address === 'string') {
        probe.close(() => reject(new Error('Could not determine a free port for the WebUI')));
        return;
      }
      const { port } = address;
      probe.close(() => resolve(port));
    });
  });

/**
 * Writes the saved-printer profile the app reads on boot.
 *
 * Shape mirrors the persisted PrinterDetails the app writes itself; `--all-saved-printers`
 * then connects every entry.
 */
const seedProfile = async (userDataPath: string, printers: readonly HeadlessPrinter[], ip: string): Promise<void> => {
  await mkdir(userDataPath, { recursive: true });

  const nowIso = new Date().toISOString();
  const entries: Record<string, Record<string, unknown>> = {};
  for (const printer of printers) {
    entries[printer.serial] = {
      Name: printer.machineName,
      IPAddress: ip,
      SerialNumber: printer.serial,
      CheckCode: printer.checkCode,
      ClientType: 'new',
      printerModel: printer.model === 'adventurer-5x' ? 'AD5X' : 'Adventurer 5M Pro',
      commandPort: printer.tcpPort,
      httpPort: printer.httpPort,
      webUIEnabled: true,
      lastConnected: nowIso,
    };
  }

  await writeFile(
    path.join(userDataPath, 'printer_details.json'),
    `${JSON.stringify({ lastUsedPrinterSerial: printers[0]?.serial ?? null, printers: entries }, null, 2)}\n`,
    'utf-8'
  );
};

interface AppProcess {
  child: ChildProcessByStdio<null, Readable, Readable>;
  logLines: string[];
}

/**
 * Launches the packaged entry point exactly as a headless user would.
 *
 * Detached on POSIX for the same reason the emulator harness is: Electron spawns helper
 * processes, and signalling only the parent leaves them holding the WebUI port.
 */
const spawnHeadlessApp = (params: { userDataPath: string; port: number; password: string }): AppProcess => {
  const electronBinary = require_('electron') as unknown as string;
  const logLines: string[] = [];

  const child = spawn(
    electronBinary,
    ['.', '--headless', '--all-saved-printers', `--webui-port=${params.port}`, `--webui-password=${params.password}`],
    {
      cwd: process.cwd(),
      env: { ...process.env, FFUI_USER_DATA_DIR: params.userDataPath },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: process.platform !== 'win32',
    }
  ) as ChildProcessByStdio<null, Readable, Readable>;

  const record = (line: string): void => {
    logLines.push(line);
    if (logLines.length > 400) {
      logLines.shift();
    }
  };

  readline.createInterface({ input: child.stdout }).on('line', record);
  readline.createInterface({ input: child.stderr }).on('line', (line) => record(`[stderr] ${line}`));

  return { child, logLines };
};

const formatLogTail = (logLines: readonly string[]): string =>
  logLines.slice(-LOG_TAIL_LINES).join('\n') || '(no output captured)';

/** Resolves once the app's own WebUI server answers, or throws with the app's log. */
const waitForServer = async (baseUrl: string, app: AppProcess, timeoutMs: number): Promise<void> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (app.child.exitCode !== null) {
      throw new Error(
        `FlashForgeUI exited with code ${app.child.exitCode} before the WebUI server started.\n` +
          `App output:\n${formatLogTail(app.logLines)}`
      );
    }

    try {
      const response = await fetch(`${baseUrl}/api/auth/status`);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not listening yet.
    }

    await sleep(READY_POLL_INTERVAL_MS);
  }

  throw new Error(
    `WebUI server did not start within ${timeoutMs}ms.\nApp output:\n${formatLogTail(app.logLines)}`
  );
};

/**
 * Waits until the app reports the expected number of connected printers.
 *
 * Uses the real /api/contexts endpoint, which means the wait also proves the printers
 * actually connected rather than merely that the HTTP server bound its port.
 */
const waitForPrinters = async (
  baseUrl: string,
  token: string,
  expected: number,
  app: AppProcess,
  timeoutMs: number
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let lastSeen = 0;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/contexts`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const payload = (await response.json()) as { contexts?: unknown[] };
        lastSeen = payload.contexts?.length ?? 0;
        if (lastSeen >= expected) {
          return;
        }
      }
    } catch {
      // Transient while the app finishes connecting.
    }

    await sleep(READY_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Expected ${expected} connected printer(s) but the app reported ${lastSeen} after ${timeoutMs}ms.\n` +
      `App output:\n${formatLogTail(app.logLines)}`
  );
};

/** Logs in through the real auth route to obtain a token for readiness polling. */
const login = async (baseUrl: string, password: string): Promise<string> => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  const payload = (await response.json()) as { success?: boolean; token?: string; message?: string };
  if (!payload.success || !payload.token) {
    throw new Error(`Harness could not log into the WebUI: ${payload.message ?? response.status}`);
  }

  return payload.token;
};

export const startHeadlessWebUI = async (options: StartHeadlessWebUIOptions = {}): Promise<HeadlessWebUI> => {
  const printers = options.printers ?? DEFAULT_HEADLESS_PRINTERS;
  const password = options.password ?? WEBUI_TEST_PASSWORD;
  const requiredPrinters = options.requireConnectedPrinters ?? printers.length;

  const emulators: Array<{ stop: () => Promise<void> }> = [];
  let appDataRoot: string | null = null;
  let app: AppProcess | null = null;

  const cleanup = async (): Promise<void> => {
    if (app) {
      await stopProcessTree(app.child);
    }
    for (const emulator of emulators.reverse()) {
      await emulator.stop();
    }
    if (appDataRoot) {
      await rm(appDataRoot, { recursive: true, force: true });
    }
  };

  try {
    let printerIp = '127.0.0.1';
    for (const printer of printers) {
      const instance = await startEmulatorInstance({
        instance: {
          instanceId: `webui-${printer.serial.toLowerCase()}`,
          model: printer.model,
          serial: printer.serial,
          checkCode: printer.checkCode,
          machineName: printer.machineName,
          tcpPort: printer.tcpPort,
          httpPort: printer.httpPort,
          discoveryEnabled: true,
          simulationMode: 'manual',
          simulationSpeed: 100,
        },
      });
      emulators.push(instance);

      const ready = instance.readyPayloads[0];
      if (!ready) {
        throw new Error(`Emulator "${printer.label}" never reported ready`);
      }
      printerIp = ready.ip;
    }

    appDataRoot = await mkdtemp(path.join(os.tmpdir(), 'ffui-webui-e2e-'));
    const userDataPath = path.join(appDataRoot, 'FlashForgeUI');
    await seedProfile(userDataPath, printers, printerIp);

    const port = await findFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;

    app = spawnHeadlessApp({ userDataPath, port, password });
    await waitForServer(baseUrl, app, SERVER_READY_TIMEOUT_MS);

    const token = await login(baseUrl, password);
    await waitForPrinters(baseUrl, token, requiredPrinters, app, PRINTER_READY_TIMEOUT_MS);

    const startedApp = app;
    return {
      baseUrl,
      password,
      printers,
      logTail: () => formatLogTail(startedApp.logLines),
      stop: cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
};
