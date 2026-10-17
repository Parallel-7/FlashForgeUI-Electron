/**
 * @fileoverview Launches and tears down FlashForgeUI under Playwright with a fully
 * isolated userData profile.
 *
 * Every run gets a fresh temp directory handed to the app through FFUI_USER_DATA_DIR,
 * and the launch asserts the app actually honored it before any test touches the UI.
 * That assertion is the guard that keeps a run from ever reading or mutating the
 * developer's real %APPDATA%/FlashForgeUI profile.
 *
 * Key exports:
 * - launchFFUI(): start the app with an optional seeded printer list
 * - closeFFUI(): close the app and remove its temp profile
 * - waitForWindowWithSelector() / findWindowWithSelector(): resolve dialog windows
 * - expectWindowWithSelectorToClose(): assert a dialog window went away
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type ElectronApplication, _electron as electron, expect, type Page } from '@playwright/test';

const WINDOW_POLL_INTERVAL_MS = 25;

/** Renderer console noise that Electron emits on every launch and never indicates a fault. */
const CONSOLE_ERROR_ALLOWLIST: readonly RegExp[] = [/Autofill\.enable/i, /Autofill\.setAddresses/i];

/**
 * A printer entry written into the seeded profile's printer_details.json.
 * Mirrors the persisted PrinterDetails shape the app reads on boot.
 */
export interface SeededPrinter {
  Name: string;
  IPAddress: string;
  SerialNumber: string;
  CheckCode: string;
  ClientType: 'legacy' | 'new';
  printerModel: string;
  modelType?: string;
  commandPort?: number;
  httpPort?: number;
  forceLegacyMode?: boolean;
  webUIEnabled?: boolean;
  customCameraEnabled?: boolean;
  customLedsEnabled?: boolean;
}

export interface LaunchedApp {
  electronApp: ElectronApplication;
  mainWindow: Page;
  /** Temp directory containing the isolated profile; removed on close. */
  appDataRoot: string;
  /** Throws if the renderer logged an unexpected error during the test. */
  assertNoRendererErrors: () => void;
  disposeErrorGuard: () => void;
}

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getUserDataPath = (appDataRoot: string): string => path.join(appDataRoot, 'FlashForgeUI');

const seedPrinterDetails = async (userDataPath: string, printers: readonly SeededPrinter[]): Promise<void> => {
  if (printers.length === 0) {
    return;
  }

  await mkdir(userDataPath, { recursive: true });

  const nowIso = new Date().toISOString();
  const entries: Record<string, Record<string, unknown>> = {};
  for (const printer of printers) {
    entries[printer.SerialNumber] = { ...printer, lastConnected: nowIso };
  }

  const payload = {
    lastUsedPrinterSerial: printers[0]?.SerialNumber ?? null,
    printers: entries,
  };

  await writeFile(path.join(userDataPath, 'printer_details.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
};

interface RendererErrorGuard {
  assertNoRendererErrors: () => void;
  dispose: () => void;
}

const createRendererErrorGuard = (electronApp: ElectronApplication): RendererErrorGuard => {
  const unexpectedErrors: string[] = [];
  const disposers: Array<() => void> = [];

  const record = (message: string): void => {
    if (CONSOLE_ERROR_ALLOWLIST.some((pattern) => pattern.test(message))) {
      return;
    }
    unexpectedErrors.push(message);
  };

  const attachWindow = (windowPage: Page): void => {
    const onPageError = (error: Error): void => {
      record(`[pageerror] ${error.message}`);
    };

    const onConsole = (message: { type: () => string; text: () => string; location: () => { url?: string } }): void => {
      if (message.type() !== 'error') {
        return;
      }
      record(`[console.error] ${message.location().url ?? 'unknown'}: ${message.text()}`);
    };

    windowPage.on('pageerror', onPageError);
    windowPage.on('console', onConsole);
    disposers.push(() => {
      windowPage.off('pageerror', onPageError);
      windowPage.off('console', onConsole);
    });
  };

  for (const windowPage of electronApp.windows()) {
    attachWindow(windowPage);
  }

  const onWindowOpened = (windowPage: Page): void => attachWindow(windowPage);
  electronApp.on('window', onWindowOpened);
  disposers.push(() => electronApp.off('window', onWindowOpened));

  return {
    assertNoRendererErrors: () => {
      if (unexpectedErrors.length > 0) {
        throw new Error(`Unexpected renderer errors detected:\n${unexpectedErrors.join('\n')}`);
      }
    },
    dispose: () => {
      for (const disposer of disposers) {
        disposer();
      }
    },
  };
};

/** Polls every open window for one containing `selector`, or null on timeout. */
export const findWindowWithSelector = async (
  electronApp: ElectronApplication,
  selector: string,
  timeoutMs = 10_000
): Promise<Page | null> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const windowPage of electronApp.windows()) {
      try {
        if ((await windowPage.locator(selector).count()) > 0) {
          return windowPage;
        }
      } catch {
        // Window was closing mid-poll; ignore and keep looking.
      }
    }
    await sleep(WINDOW_POLL_INTERVAL_MS);
  }

  return null;
};

/** Like findWindowWithSelector but throws a descriptive error instead of returning null. */
export const waitForWindowWithSelector = async (
  electronApp: ElectronApplication,
  selector: string,
  timeoutMs = 10_000
): Promise<Page> => {
  const found = await findWindowWithSelector(electronApp, selector, timeoutMs);
  if (found) {
    return found;
  }
  throw new Error(`Timed out waiting for window with selector "${selector}" after ${timeoutMs}ms`);
};

export const expectWindowWithSelectorToClose = async (
  electronApp: ElectronApplication,
  selector: string,
  timeoutMs = 10_000
): Promise<void> => {
  await expect
    .poll(async () => ((await findWindowWithSelector(electronApp, selector, 250)) ? 1 : 0), { timeout: timeoutMs })
    .toBe(0);
};

const hasMainUiMarkers = async (windowPage: Page): Promise<boolean> => {
  try {
    if ((await windowPage.locator('#btn-main-menu').count()) > 0) {
      return true;
    }
    return (await windowPage.locator('#placeholder-connect-btn').count()) > 0;
  } catch {
    return false;
  }
};

const resolveMainWindow = async (electronApp: ElectronApplication, timeoutMs = 20_000): Promise<Page> => {
  const deadline = Date.now() + timeoutMs;
  let lastWindowCount = 0;

  while (Date.now() < deadline) {
    const windows = electronApp.windows();
    lastWindowCount = windows.length;

    for (const windowPage of windows) {
      if (await hasMainUiMarkers(windowPage)) {
        return windowPage;
      }
    }
    await sleep(WINDOW_POLL_INTERVAL_MS);
  }

  throw new Error(`Unable to locate main window after ${timeoutMs}ms (observed ${lastWindowCount} window(s))`);
};

/**
 * Launches FlashForgeUI against a throwaway profile.
 *
 * The userData assertion below is deliberate and must not be relaxed: if the app
 * ignored FFUI_USER_DATA_DIR the run would operate on the developer's real profile,
 * so failing loudly here is far better than a test quietly rewriting saved printers.
 */
export const launchFFUI = async (params?: { seededPrinters?: readonly SeededPrinter[] }): Promise<LaunchedApp> => {
  const appDataRoot = await mkdtemp(path.join(os.tmpdir(), 'ffui-e2e-'));
  const userDataPath = getUserDataPath(appDataRoot);

  if (params?.seededPrinters && params.seededPrinters.length > 0) {
    await seedPrinterDetails(userDataPath, params.seededPrinters);
  }

  const electronApp = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    timeout: 120_000,
    env: { ...process.env, FFUI_USER_DATA_DIR: userDataPath },
  });

  const errorGuard = createRendererErrorGuard(electronApp);

  const actualUserDataPath = await electronApp.evaluate(async ({ app }) => app.getPath('userData'));
  if (actualUserDataPath.toLowerCase() !== userDataPath.toLowerCase()) {
    await electronApp.close();
    throw new Error(
      `Profile isolation failed: app is using "${actualUserDataPath}" instead of "${userDataPath}". ` +
        'Refusing to run against a non-isolated profile.'
    );
  }

  const mainWindow = await resolveMainWindow(electronApp);
  await expect(mainWindow.locator('.title')).toHaveText('FlashForgeUI');

  return {
    electronApp,
    mainWindow,
    appDataRoot,
    assertNoRendererErrors: errorGuard.assertNoRendererErrors,
    disposeErrorGuard: errorGuard.dispose,
  };
};

export const closeFFUI = async (launched: LaunchedApp): Promise<void> => {
  try {
    await launched.electronApp.close();
  } finally {
    launched.disposeErrorGuard();
    await rm(launched.appDataRoot, { recursive: true, force: true });
  }
};
