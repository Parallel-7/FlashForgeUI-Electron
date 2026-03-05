import { mkdtemp, rm } from 'node:fs/promises';
import * as net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { type ElectronApplication, _electron as electron, expect, type Page, test } from '@playwright/test';
import {
  startEmulatorInstance,
  startEmulatorSupervisor,
  type EmulatorReadyPayload,
} from './helpers/emulator-harness';

const EMULATOR_FLAG = 'FFUI_E2E_EMULATOR';
const DISCOVERY_FLAG = 'FFUI_E2E_EMULATOR_DISCOVERY';
const LOCALHOST_IP = '127.0.0.1';
const DEFAULT_CHECK_CODE = '123';
const CONNECT_TIMEOUT_MS = 90_000;

interface LaunchedElectronApp {
  electronApp: ElectronApplication;
  mainWindow: Page;
  appDataRoot: string;
}

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getFreePort = async (): Promise<number> => {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to acquire a free port')));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve(port);
        }
      });
    });
  });
};

const getDistinctFreePorts = async (count: number): Promise<number[]> => {
  const ports = new Set<number>();
  while (ports.size < count) {
    ports.add(await getFreePort());
  }

  return Array.from(ports.values());
};

const getExpectedUserDataPath = (appDataRoot: string): string => {
  return path.join(appDataRoot, 'FlashForgeUI');
};

const findWindowWithSelector = async (
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
        // Ignore detached/closing windows while polling
      }
    }

    await sleep(100);
  }

  return null;
};

const waitForWindowWithSelector = async (
  electronApp: ElectronApplication,
  selector: string,
  timeoutMs = 10_000
): Promise<Page> => {
  const foundWindow = await findWindowWithSelector(electronApp, selector, timeoutMs);
  if (foundWindow) {
    return foundWindow;
  }

  throw new Error(`Timed out waiting for window with selector "${selector}" after ${timeoutMs}ms`);
};

const hasMainUiMarkers = async (windowPage: Page): Promise<boolean> => {
  try {
    if ((await windowPage.locator('#btn-main-menu').count()) > 0) {
      return true;
    }

    if ((await windowPage.locator('#placeholder-connect-btn').count()) > 0) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
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

    await sleep(100);
  }

  throw new Error(
    `Unable to locate main application window after ${timeoutMs}ms (observed ${lastWindowCount} window(s))`
  );
};

const launchElectronWithIsolatedProfile = async (): Promise<LaunchedElectronApp> => {
  const appDataRoot = await mkdtemp(path.join(os.tmpdir(), 'ffui-e2e-electron-'));
  const userDataPath = getExpectedUserDataPath(appDataRoot);
  const env = {
    ...process.env,
    FFUI_USER_DATA_DIR: userDataPath,
  };

  const electronApp = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    timeout: 120_000,
    env,
  });

  const actualUserDataPath = await electronApp.evaluate(async ({ app }) => app.getPath('userData'));
  expect(actualUserDataPath.toLowerCase()).toBe(userDataPath.toLowerCase());

  const mainWindow = await resolveMainWindow(electronApp);
  await expect(mainWindow.locator('.title')).toHaveText('FlashForgeUI');

  return { electronApp, mainWindow, appDataRoot };
};

const closeLaunchedElectronApp = async (launched: LaunchedElectronApp): Promise<void> => {
  try {
    await launched.electronApp.close();
  } finally {
    await rm(launched.appDataRoot, { recursive: true, force: true });
  }
};

const openConnectFlow = async (mainWindow: Page): Promise<void> => {
  const placeholderConnectButton = mainWindow.locator('#placeholder-connect-btn');
  if (await placeholderConnectButton.isVisible()) {
    await placeholderConnectButton.click();
    return;
  }

  await expect(mainWindow.locator('#btn-main-menu')).toBeVisible();
  await mainWindow.locator('#btn-main-menu').click();
  const connectMenuItem = mainWindow.locator('#main-menu-dropdown .menu-item[data-action="connect"]');
  await expect(connectMenuItem).toBeVisible();
  await connectMenuItem.click();
};

const maybeHandleConnectedWarningDialog = async (electronApp: ElectronApplication): Promise<void> => {
  const warningDialog = await findWindowWithSelector(electronApp, '#dialog-continue', 3_000);
  if (!warningDialog) {
    return;
  }

  await warningDialog.locator('#dialog-continue').click();
};

const maybeSubmitCheckCodeDialog = async (
  electronApp: ElectronApplication,
  checkCode: string,
  timeoutMs = 20_000
): Promise<boolean> => {
  const inputDialog = await findWindowWithSelector(electronApp, '#dialog-input', timeoutMs);
  if (!inputDialog) {
    return false;
  }

  const titleText = (await inputDialog.locator('#dialog-title').textContent())?.toLowerCase() ?? '';
  const messageText = (await inputDialog.locator('#dialog-message').textContent())?.toLowerCase() ?? '';
  const shouldHandleAsCheckCodePrompt =
    titleText.includes('pair') ||
    messageText.includes('pair') ||
    messageText.includes('check code') ||
    messageText.includes('pairing code');

  if (!shouldHandleAsCheckCodePrompt) {
    return false;
  }

  await inputDialog.locator('#dialog-input').fill(checkCode);
  await inputDialog.locator('#dialog-ok').click();
  return true;
};

const waitForConnectedUi = async (mainWindow: Page, expectedConnectedTabs: number): Promise<void> => {
  await expect
    .poll(
      async () => {
        return await mainWindow.locator('#printer-tabs-container .printer-tab.status-connected').count();
      },
      { timeout: CONNECT_TIMEOUT_MS }
    )
    .toBeGreaterThanOrEqual(expectedConnectedTabs);

  await expect(mainWindow.locator('#grid-placeholder')).toBeHidden();
  await expect(mainWindow.locator('.grid-stack')).toBeVisible();
};

const isPageClosedDuringActionError = (error: unknown): boolean => {
  return error instanceof Error && /Target page, context or browser has been closed/i.test(error.message);
};

const selectPrinterFromDiscoveryDialog = async (
  electronApp: ElectronApplication,
  serialNumber: string
): Promise<void> => {
  const selectionDialog = await waitForWindowWithSelector(electronApp, '#printer-table', 35_000);
  const serialRow = selectionDialog.locator('#printer-table tbody tr[data-printer]', { hasText: serialNumber }).first();
  await expect(serialRow).toBeVisible({ timeout: 20_000 });
  try {
    await serialRow.dblclick();
  } catch (error) {
    if (!isPageClosedDuringActionError(error)) {
      throw error;
    }
  }
};

const connectThroughDiscoveryDialog = async (params: {
  electronApp: ElectronApplication;
  mainWindow: Page;
  serialNumber: string;
  checkCode: string;
}): Promise<void> => {
  await openConnectFlow(params.mainWindow);
  await maybeHandleConnectedWarningDialog(params.electronApp);

  const connectChoiceDialog = await waitForWindowWithSelector(params.electronApp, '#btn-scan-network', 15_000);
  await connectChoiceDialog.locator('#btn-scan-network').click();

  await selectPrinterFromDiscoveryDialog(params.electronApp, params.serialNumber);
  await maybeSubmitCheckCodeDialog(params.electronApp, params.checkCode);
};

const connectThroughDirectIpDialog = async (params: {
  electronApp: ElectronApplication;
  mainWindow: Page;
  ipAddress: string;
  checkCode: string;
}): Promise<void> => {
  await openConnectFlow(params.mainWindow);
  await maybeHandleConnectedWarningDialog(params.electronApp);

  const connectChoiceDialog = await waitForWindowWithSelector(params.electronApp, '#btn-enter-ip', 15_000);
  await connectChoiceDialog.locator('#btn-enter-ip').click();

  const inputDialog = await waitForWindowWithSelector(params.electronApp, '#dialog-input', 15_000);
  await inputDialog.locator('#dialog-input').fill(params.ipAddress);
  await inputDialog.locator('#dialog-ok').click();

  await maybeSubmitCheckCodeDialog(params.electronApp, params.checkCode);
};

const firstConnectedTabName = async (mainWindow: Page): Promise<string> => {
  const tabName = await mainWindow.locator('#printer-tabs-container .printer-tab .tab-name').first().textContent();
  return tabName?.trim() ?? '';
};

const requireReadyPayload = (
  payload: EmulatorReadyPayload | null,
  label: string
): EmulatorReadyPayload => {
  if (!payload) {
    throw new Error(`Missing readiness payload for ${label}`);
  }

  return payload;
};

test.describe('electron emulator e2e', () => {
  test.skip(
    !process.env[EMULATOR_FLAG],
    `Set ${EMULATOR_FLAG}=1 to run emulator-backed Electron desktop tests`
  );
  test.skip(process.platform !== 'win32', 'This suite currently targets Windows environments');

  test.describe('single printer flows', () => {
    let singleEmulator: Awaited<ReturnType<typeof startEmulatorInstance>> | null = null;
    let singleReady: EmulatorReadyPayload | null = null;

    test.beforeAll(async () => {
      singleEmulator = await startEmulatorInstance({
        instance: {
          instanceId: 'single',
          model: 'adventurer-5m-pro',
          serial: 'E2E-SN-SINGLE',
          checkCode: DEFAULT_CHECK_CODE,
          machineName: 'E2E-Single',
          tcpPort: 8899,
          httpPort: 8898,
          discoveryEnabled: true,
          simulationMode: 'auto',
          simulationSpeed: 100,
        },
      });

      const readyPayload = singleEmulator.readyPayloads[0];
      if (!readyPayload) {
        throw new Error('Single emulator did not provide a readiness payload');
      }
      singleReady = readyPayload;
    });

    test.afterAll(async () => {
      if (singleEmulator) {
        await singleEmulator.stop();
      }
    });

    test.skip(
      !process.env[DISCOVERY_FLAG],
      `Set ${DISCOVERY_FLAG}=1 to run discovery-based emulator tests`
    );

    test('connects through discovery flow', async () => {
      const launched = await launchElectronWithIsolatedProfile();

      try {
        await connectThroughDiscoveryDialog({
          electronApp: launched.electronApp,
          mainWindow: launched.mainWindow,
          serialNumber: requireReadyPayload(singleReady, 'single').serial,
          checkCode: DEFAULT_CHECK_CODE,
        });

        await waitForConnectedUi(launched.mainWindow, 1);
        await expect(launched.mainWindow.locator('#btn-main-menu')).toBeVisible();
        await expect.poll(() => firstConnectedTabName(launched.mainWindow)).not.toBe('');
      } finally {
        await closeLaunchedElectronApp(launched);
      }
    });

    test('connects through direct IP flow', async () => {
      const launched = await launchElectronWithIsolatedProfile();

      try {
        await connectThroughDirectIpDialog({
          electronApp: launched.electronApp,
          mainWindow: launched.mainWindow,
          ipAddress: LOCALHOST_IP,
          checkCode: DEFAULT_CHECK_CODE,
        });

        await waitForConnectedUi(launched.mainWindow, 1);
        await expect.poll(() => firstConnectedTabName(launched.mainWindow)).not.toBe('');
      } finally {
        await closeLaunchedElectronApp(launched);
      }
    });
  });

  test.describe('multi-printer discovery flow', () => {
    test.skip(
      !process.env[DISCOVERY_FLAG],
      `Set ${DISCOVERY_FLAG}=1 to run discovery-based emulator tests`
    );

    let supervisorEmulator: Awaited<ReturnType<typeof startEmulatorSupervisor>> | null = null;
    let alphaReady: EmulatorReadyPayload | null = null;
    let betaReady: EmulatorReadyPayload | null = null;

    test.beforeAll(async () => {
      const [alphaTcpPort, alphaHttpPort, betaTcpPort, betaHttpPort] = await getDistinctFreePorts(4);

      supervisorEmulator = await startEmulatorSupervisor({
        instances: [
          {
            instanceId: 'alpha',
            model: 'adventurer-5m-pro',
            serial: 'E2E-SN-ALPHA',
            checkCode: DEFAULT_CHECK_CODE,
            machineName: 'E2E-Alpha',
            tcpPort: alphaTcpPort,
            httpPort: alphaHttpPort,
            discoveryEnabled: true,
            simulationMode: 'auto',
            simulationSpeed: 100,
          },
          {
            instanceId: 'beta',
            model: 'adventurer-5m',
            serial: 'E2E-SN-BETA',
            checkCode: DEFAULT_CHECK_CODE,
            machineName: 'E2E-Beta',
            tcpPort: betaTcpPort,
            httpPort: betaHttpPort,
            discoveryEnabled: true,
            simulationMode: 'auto',
            simulationSpeed: 100,
          },
        ],
      });

      const alphaPayload = supervisorEmulator.readyPayloads.find((payload) => payload.instanceId === 'alpha');
      const betaPayload = supervisorEmulator.readyPayloads.find((payload) => payload.instanceId === 'beta');
      if (!alphaPayload || !betaPayload) {
        throw new Error('Supervisor readiness payloads missing alpha and/or beta instance');
      }

      alphaReady = alphaPayload;
      betaReady = betaPayload;
    });

    test.afterAll(async () => {
      if (supervisorEmulator) {
        await supervisorEmulator.stop();
      }
    });

    test('connects two discovered printers as separate contexts', async () => {
      const launched = await launchElectronWithIsolatedProfile();

      try {
        await connectThroughDiscoveryDialog({
          electronApp: launched.electronApp,
          mainWindow: launched.mainWindow,
          serialNumber: requireReadyPayload(alphaReady, 'alpha').serial,
          checkCode: DEFAULT_CHECK_CODE,
        });
        await waitForConnectedUi(launched.mainWindow, 1);

        await connectThroughDiscoveryDialog({
          electronApp: launched.electronApp,
          mainWindow: launched.mainWindow,
          serialNumber: requireReadyPayload(betaReady, 'beta').serial,
          checkCode: DEFAULT_CHECK_CODE,
        });
        await waitForConnectedUi(launched.mainWindow, 2);

        await expect
          .poll(
            async () => {
              return await launched.mainWindow.locator('#printer-tabs-container .printer-tab').count();
            },
            { timeout: CONNECT_TIMEOUT_MS }
          )
          .toBeGreaterThanOrEqual(2);
      } finally {
        await closeLaunchedElectronApp(launched);
      }
    });
  });
});
