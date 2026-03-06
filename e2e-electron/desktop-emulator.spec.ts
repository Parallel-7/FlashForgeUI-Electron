import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { type ElectronApplication, _electron as electron, expect, type Page, test } from '@playwright/test';
import {
  type EmulatorAuthConfig,
  type EmulatorMaterialMapping,
  type EmulatorModel,
  type EmulatorReadyPayload,
  fetchEmulatorDetail,
  seedEmulatorRecentFile,
  startEmulatorInstance,
  startEmulatorSupervisor,
  waitForEmulatorDetail,
} from './helpers/emulator-harness';

const EMULATOR_FLAG = 'FFUI_E2E_EMULATOR';
const DISCOVERY_FLAG = 'FFUI_E2E_EMULATOR_DISCOVERY';
const LOCALHOST_IP = '127.0.0.1';
const DEFAULT_CHECK_CODE = '123';
const CONNECT_TIMEOUT_MS = 60_000;
const JOB_ACTION_TIMEOUT_MS = 30_000;
const CONSOLE_ERROR_ALLOWLIST: readonly RegExp[] = [/Autofill\.enable/i, /Autofill\.setAddresses/i];

interface LaunchedElectronApp {
  electronApp: ElectronApplication;
  mainWindow: Page;
  appDataRoot: string;
  assertNoUnexpectedRendererErrors: () => void;
  disposeRendererErrorGuard: () => void;
}

interface MaterialSlotAssignment {
  toolId: number;
  slotId: number;
}

interface SeedRecentFileOptions {
  gcodeContent?: string;
  gcodeToolCnt?: number;
  useMatlStation?: boolean;
  materialMappings?: readonly EmulatorMaterialMapping[];
}

interface SeededPrinterDetailsEntry {
  Name: string;
  IPAddress: string;
  SerialNumber: string;
  CheckCode: string;
  ClientType: 'legacy' | 'new';
  printerModel: string;
  customCameraEnabled?: boolean;
  customCameraUrl?: string;
  customLedsEnabled?: boolean;
  forceLegacyMode?: boolean;
  webUIEnabled?: boolean;
  showCameraFps?: boolean;
  commandPort?: number;
  httpPort?: number;
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

const seedPrinterDetails = async (
  userDataPath: string,
  seededPrinters: readonly SeededPrinterDetailsEntry[]
): Promise<void> => {
  if (seededPrinters.length === 0) {
    return;
  }

  await mkdir(userDataPath, { recursive: true });

  const printers: Record<string, Record<string, unknown>> = {};
  const nowIso = new Date().toISOString();
  for (const printer of seededPrinters) {
    printers[printer.SerialNumber] = {
      ...printer,
      lastConnected: nowIso,
    };
  }

  const payload = {
    lastUsedPrinterSerial: seededPrinters[0]?.SerialNumber ?? null,
    printers,
  };

  await writeFile(path.join(userDataPath, 'printer_details.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
};

const normalizeWhitespace = (value: string | null | undefined): string => {
  return (value ?? '').replace(/\s+/g, ' ').trim();
};

const shouldIgnoreConsoleError = (message: string): boolean => {
  return CONSOLE_ERROR_ALLOWLIST.some((pattern) => pattern.test(message));
};

const createRendererErrorGuard = (
  electronApp: ElectronApplication
): {
  assertNoUnexpectedRendererErrors: () => void;
  dispose: () => void;
} => {
  const unexpectedErrors: string[] = [];
  const seenErrors = new Set<string>();
  const disposers: Array<() => void> = [];

  const pushUnexpectedError = (message: string): void => {
    if (seenErrors.has(message)) {
      return;
    }
    seenErrors.add(message);
    unexpectedErrors.push(message);
  };

  const pageLabel = (windowPage: Page): string => {
    try {
      const url = windowPage.url();
      return url && url.length > 0 ? url : 'about:blank';
    } catch {
      return 'unknown';
    }
  };

  const attachWindow = (windowPage: Page): void => {
    const onPageError = (error: Error): void => {
      pushUnexpectedError(`[pageerror] ${pageLabel(windowPage)}: ${error.message}`);
    };

    const onConsole = (message: { type(): string; text(): string }): void => {
      if (message.type() !== 'error') {
        return;
      }

      const url = pageLabel(windowPage);
      if (url.startsWith('devtools://')) {
        return;
      }

      const text = normalizeWhitespace(message.text());
      if (shouldIgnoreConsoleError(text)) {
        return;
      }

      pushUnexpectedError(`[console.error] ${url}: ${text}`);
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

  const onWindowOpened = (windowPage: Page): void => {
    attachWindow(windowPage);
  };
  electronApp.on('window', onWindowOpened);
  disposers.push(() => {
    electronApp.off('window', onWindowOpened);
  });

  return {
    assertNoUnexpectedRendererErrors: () => {
      if (unexpectedErrors.length === 0) {
        return;
      }

      throw new Error(`Unexpected renderer errors detected:\n${unexpectedErrors.join('\n')}`);
    },
    dispose: () => {
      for (const disposer of disposers) {
        disposer();
      }
    },
  };
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

const expectWindowWithSelectorToClose = async (
  electronApp: ElectronApplication,
  selector: string,
  timeoutMs = 10_000
): Promise<void> => {
  await expect
    .poll(
      async () => {
        const found = await findWindowWithSelector(electronApp, selector, 250);
        return found ? 1 : 0;
      },
      { timeout: timeoutMs }
    )
    .toBe(0);
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

const launchElectronWithIsolatedProfile = async (params?: {
  seededPrinters?: readonly SeededPrinterDetailsEntry[];
}): Promise<LaunchedElectronApp> => {
  const appDataRoot = await mkdtemp(path.join(os.tmpdir(), 'ffui-e2e-electron-'));
  const userDataPath = getExpectedUserDataPath(appDataRoot);

  if (params?.seededPrinters && params.seededPrinters.length > 0) {
    await seedPrinterDetails(userDataPath, params.seededPrinters);
  }

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

  const rendererErrorGuard = createRendererErrorGuard(electronApp);
  const actualUserDataPath = await electronApp.evaluate(async ({ app }) => app.getPath('userData'));
  expect(actualUserDataPath.toLowerCase()).toBe(userDataPath.toLowerCase());

  const mainWindow = await resolveMainWindow(electronApp);
  await expect(mainWindow.locator('.title')).toHaveText('FlashForgeUI');

  return {
    electronApp,
    mainWindow,
    appDataRoot,
    assertNoUnexpectedRendererErrors: rendererErrorGuard.assertNoUnexpectedRendererErrors,
    disposeRendererErrorGuard: rendererErrorGuard.dispose,
  };
};

const closeLaunchedElectronApp = async (launched: LaunchedElectronApp): Promise<void> => {
  try {
    await launched.electronApp.close();
  } finally {
    launched.disposeRendererErrorGuard();
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

const maybeDismissAutoConnectChoiceDialog = async (params: {
  electronApp: ElectronApplication;
  timeoutMs?: number;
}): Promise<boolean> => {
  const timeoutMs = params.timeoutMs ?? 3_000;
  const autoConnectDialog = await findWindowWithSelector(params.electronApp, '#btn-manual-ip', timeoutMs);
  if (!autoConnectDialog) {
    return false;
  }

  const cancelButton = autoConnectDialog.locator('#btn-cancel').first();
  await expect(cancelButton).toBeVisible({ timeout: 5_000 });
  await cancelButton.click();
  return true;
};

const maybeSubmitCheckCodeDialog = async (params: {
  electronApp: ElectronApplication;
  checkCode: string;
  timeoutMs?: number;
  required?: boolean;
}): Promise<boolean> => {
  const timeoutMs = params.timeoutMs ?? 20_000;
  const inputDialog = await findWindowWithSelector(params.electronApp, '#dialog-input', timeoutMs);
  if (!inputDialog) {
    if (params.required) {
      throw new Error(`Expected check code dialog within ${timeoutMs}ms, but it did not appear`);
    }

    return false;
  }

  await inputDialog.locator('#dialog-input').fill(params.checkCode);
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

const waitForPrinterState = async (mainWindow: Page, expectedState: string): Promise<void> => {
  await expect
    .poll(
      async () => {
        const text = await mainWindow.locator('#printer-status-text').first().textContent();
        return normalizeWhitespace(text);
      },
      { timeout: JOB_ACTION_TIMEOUT_MS }
    )
    .toBe(expectedState);
};

const isPageClosedDuringActionError = (error: unknown): boolean => {
  return error instanceof Error && /Target page, context or browser has been closed/i.test(error.message);
};

const selectPrinterFromDiscoveryDialog = async (params: {
  electronApp: ElectronApplication;
  rowText: string;
}): Promise<void> => {
  const selectionDialog = await waitForWindowWithSelector(params.electronApp, '#printer-table', 35_000);
  const matchedRow = selectionDialog
    .locator('#printer-table tbody tr[data-printer]', { hasText: params.rowText })
    .first();
  await expect(matchedRow).toBeVisible({ timeout: 20_000 });
  try {
    await matchedRow.dblclick();
  } catch (error) {
    if (!isPageClosedDuringActionError(error)) {
      throw error;
    }
  }
};

const connectThroughDiscoveryDialog = async (params: {
  electronApp: ElectronApplication;
  mainWindow: Page;
  selectionText: string;
  checkCode: string;
  expectCheckCodePrompt: boolean;
}): Promise<void> => {
  await maybeDismissAutoConnectChoiceDialog({
    electronApp: params.electronApp,
    timeoutMs: 5_000,
  });
  await openConnectFlow(params.mainWindow);
  await maybeHandleConnectedWarningDialog(params.electronApp);

  const connectChoiceDialog = await waitForWindowWithSelector(params.electronApp, '#btn-scan-network', 15_000);
  await connectChoiceDialog.locator('#btn-scan-network').click();

  await selectPrinterFromDiscoveryDialog({
    electronApp: params.electronApp,
    rowText: params.selectionText,
  });
  await maybeSubmitCheckCodeDialog({
    electronApp: params.electronApp,
    checkCode: params.checkCode,
    timeoutMs: params.expectCheckCodePrompt ? 20_000 : 2_000,
    required: params.expectCheckCodePrompt,
  });

  await expectWindowWithSelectorToClose(params.electronApp, '#btn-scan-network');
};

const connectThroughDirectIpDialog = async (params: {
  electronApp: ElectronApplication;
  mainWindow: Page;
  ipAddress: string;
  checkCode: string;
  expectCheckCodePrompt: boolean;
}): Promise<void> => {
  await maybeDismissAutoConnectChoiceDialog({
    electronApp: params.electronApp,
    timeoutMs: 5_000,
  });
  await openConnectFlow(params.mainWindow);
  await maybeHandleConnectedWarningDialog(params.electronApp);

  const connectChoiceDialog = await waitForWindowWithSelector(params.electronApp, '#btn-enter-ip', 15_000);
  await connectChoiceDialog.locator('#btn-enter-ip').click();

  const inputDialog = await waitForWindowWithSelector(params.electronApp, '#dialog-input', 15_000);
  await inputDialog.locator('#dialog-input').fill(params.ipAddress);
  await inputDialog.locator('#dialog-ok').click();

  await maybeSubmitCheckCodeDialog({
    electronApp: params.electronApp,
    checkCode: params.checkCode,
    timeoutMs: params.expectCheckCodePrompt ? 20_000 : 2_000,
    required: params.expectCheckCodePrompt,
  });

  await expectWindowWithSelectorToClose(params.electronApp, '#btn-enter-ip');
};

const firstConnectedTabName = async (mainWindow: Page): Promise<string> => {
  const tabName = await mainWindow.locator('#printer-tabs-container .printer-tab .tab-name').first().textContent();
  return tabName?.trim() ?? '';
};

const setCustomLedsEnabled = async (mainWindow: Page): Promise<void> => {
  const updated = await mainWindow.evaluate(async () => {
    const bridgedApi = (
      window as unknown as {
        api?: {
          printerSettings?: {
            update: (settings: unknown) => Promise<boolean>;
            get: () => Promise<unknown>;
          };
        };
      }
    ).api;

    if (!bridgedApi?.printerSettings) {
      return false;
    }

    const updateResult = await bridgedApi.printerSettings.update({ customLedsEnabled: true });
    if (!updateResult) {
      return false;
    }

    const settings = (await bridgedApi.printerSettings.get()) as { customLedsEnabled?: boolean } | null;
    return settings?.customLedsEnabled === true;
  });

  expect(updated).toBe(true);
};

const completeMaterialMatchingDialog = async (params: {
  materialDialog: Page;
  assignments?: readonly MaterialSlotAssignment[];
}): Promise<void> => {
  const requirementItems = params.materialDialog.locator('.requirement-item');
  const requirementCount = await requirementItems.count();
  expect(requirementCount).toBeGreaterThan(0);

  const assignments =
    params.assignments ??
    Array.from({ length: requirementCount }, (_, index) => ({
      toolId: index,
      slotId: index + 1,
    }));

  for (const assignment of assignments) {
    const requirement = params.materialDialog.locator(`.requirement-item[data-tool-id="${assignment.toolId}"]`).first();
    await expect(requirement).toBeVisible({ timeout: 10_000 });
    await requirement.click();

    const slot = params.materialDialog
      .locator(`.slot-item[data-slot-id="${assignment.slotId}"]:not(.disabled):not(.assigned)`)
      .first();
    await expect(slot).toBeVisible({ timeout: 10_000 });
    await slot.click();
  }

  const confirmButton = params.materialDialog.locator('#btn-confirm');
  await expect(confirmButton).toBeEnabled({ timeout: 10_000 });
  await confirmButton.click();
};

const trySelectFileFromPickerWindow = async (params: {
  pickerWindow: Page;
  preferredFileName: string;
  timeoutMs: number;
}): Promise<string | null> => {
  const allFileItems = params.pickerWindow.locator('.file-item[data-filename]');

  try {
    await expect(allFileItems.first()).toBeVisible({ timeout: params.timeoutMs });
  } catch {
    return null;
  }

  let fileItem = params.pickerWindow.locator(`.file-item[data-filename="${params.preferredFileName}"]`).first();
  if ((await fileItem.count()) === 0) {
    fileItem = allFileItems.first();
  }

  await expect(fileItem).toBeVisible({ timeout: 5_000 });
  const selectedFileName = (await fileItem.getAttribute('data-filename')) ?? params.preferredFileName;
  await fileItem.click();
  await expect(params.pickerWindow.locator('#btn-select')).toBeEnabled();
  await params.pickerWindow.locator('#btn-select').click();
  return selectedFileName;
};

const startRecentJobFromUi = async (params: {
  electronApp: ElectronApplication;
  mainWindow: Page;
  fileName: string;
  expectMaterialMatching?: boolean;
  materialSlotAssignments?: readonly MaterialSlotAssignment[];
}): Promise<string> => {
  await expect(params.mainWindow.locator('#btn-start-recent')).toBeVisible();
  await expect(params.mainWindow.locator('#btn-start-recent')).toBeEnabled();
  await params.mainWindow.locator('#btn-start-recent').click();

  let jobPickerWindow = await waitForWindowWithSelector(params.electronApp, '#file-list', 20_000);
  let selectedFileName = await trySelectFileFromPickerWindow({
    pickerWindow: jobPickerWindow,
    preferredFileName: params.fileName,
    timeoutMs: 20_000,
  });

  if (!selectedFileName) {
    const cancelButton = jobPickerWindow.locator('#btn-cancel').first();
    if ((await cancelButton.count()) > 0) {
      await cancelButton.click().catch(() => {
        // Ignore if dialog closes while clicking
      });
    }

    await expect(params.mainWindow.locator('#btn-start-local')).toBeVisible();
    await expect(params.mainWindow.locator('#btn-start-local')).toBeEnabled();
    await params.mainWindow.locator('#btn-start-local').click();

    jobPickerWindow = await waitForWindowWithSelector(params.electronApp, '#file-list', 20_000);
    selectedFileName = await trySelectFileFromPickerWindow({
      pickerWindow: jobPickerWindow,
      preferredFileName: params.fileName,
      timeoutMs: 30_000,
    });
  }

  if (!selectedFileName) {
    throw new Error('No files available in recent or local picker');
  }

  const materialMatchingDialog = await findWindowWithSelector(params.electronApp, '#print-requirements', 5_000);
  if (materialMatchingDialog) {
    await completeMaterialMatchingDialog({
      materialDialog: materialMatchingDialog,
      assignments: params.materialSlotAssignments,
    });
    return selectedFileName;
  }

  if (params.expectMaterialMatching) {
    throw new Error('Expected material matching dialog, but it did not appear');
  }

  const singleColorDialog = await findWindowWithSelector(params.electronApp, '#btn-start', 5_000);
  if (!singleColorDialog) {
    return selectedFileName;
  }

  await singleColorDialog.locator('#btn-start').click();
  return selectedFileName;
};

const verifyLedControls = async (params: { mainWindow: Page; emulatorAuth: EmulatorAuthConfig }): Promise<void> => {
  await expect(params.mainWindow.locator('#btn-led-on')).toBeVisible();
  await expect(params.mainWindow.locator('#btn-led-on')).toBeEnabled();
  await params.mainWindow.locator('#btn-led-on').click();
  await waitForEmulatorDetail({
    ...params.emulatorAuth,
    description: 'LED toggled on',
    predicate: (detail) => detail.lightStatus === 'open',
    timeoutMs: JOB_ACTION_TIMEOUT_MS,
  });

  await expect(params.mainWindow.locator('#btn-led-off')).toBeVisible();
  await expect(params.mainWindow.locator('#btn-led-off')).toBeEnabled();
  await params.mainWindow.locator('#btn-led-off').click();
  await waitForEmulatorDetail({
    ...params.emulatorAuth,
    description: 'LED toggled off',
    predicate: (detail) => detail.lightStatus === 'close',
    timeoutMs: JOB_ACTION_TIMEOUT_MS,
  });
};

const verifyFiltrationControls = async (params: {
  mainWindow: Page;
  emulatorAuth: EmulatorAuthConfig;
}): Promise<void> => {
  await expect(params.mainWindow.locator('#btn-external-filtration')).toBeVisible();
  await expect(params.mainWindow.locator('#btn-external-filtration')).toBeEnabled();
  await params.mainWindow.locator('#btn-external-filtration').click();
  await expect
    .poll(
      async () => normalizeWhitespace(await params.mainWindow.locator('#filtration-status-display').textContent()),
      {
        timeout: JOB_ACTION_TIMEOUT_MS,
      }
    )
    .toBe('External');
  await waitForEmulatorDetail({
    ...params.emulatorAuth,
    description: 'External filtration enabled',
    predicate: (detail) => detail.externalFanStatus === 'open' && detail.internalFanStatus === 'close',
    timeoutMs: JOB_ACTION_TIMEOUT_MS,
  });

  await expect(params.mainWindow.locator('#btn-internal-filtration')).toBeVisible();
  await expect(params.mainWindow.locator('#btn-internal-filtration')).toBeEnabled();
  await params.mainWindow.locator('#btn-internal-filtration').click();
  await expect
    .poll(
      async () => normalizeWhitespace(await params.mainWindow.locator('#filtration-status-display').textContent()),
      {
        timeout: JOB_ACTION_TIMEOUT_MS,
      }
    )
    .toBe('Internal');
  await waitForEmulatorDetail({
    ...params.emulatorAuth,
    description: 'Internal filtration enabled',
    predicate: (detail) => detail.externalFanStatus === 'close' && detail.internalFanStatus === 'open',
    timeoutMs: JOB_ACTION_TIMEOUT_MS,
  });

  await expect(params.mainWindow.locator('#btn-no-filtration')).toBeVisible();
  await expect(params.mainWindow.locator('#btn-no-filtration')).toBeEnabled();
  await params.mainWindow.locator('#btn-no-filtration').click();
  await expect
    .poll(
      async () => normalizeWhitespace(await params.mainWindow.locator('#filtration-status-display').textContent()),
      {
        timeout: JOB_ACTION_TIMEOUT_MS,
      }
    )
    .toBe('None');
  await waitForEmulatorDetail({
    ...params.emulatorAuth,
    description: 'Filtration disabled',
    predicate: (detail) => detail.externalFanStatus === 'close' && detail.internalFanStatus === 'close',
    timeoutMs: JOB_ACTION_TIMEOUT_MS,
  });
};

const runLifecycleControls = async (params: {
  electronApp: ElectronApplication;
  mainWindow: Page;
  fileName: string;
  emulatorAuth: EmulatorAuthConfig;
  requiresCustomLedSetting: boolean;
  supportsLedControls: boolean;
  supportsFiltration: boolean;
  expectedUiStateAfterCancel: string;
  expectedDetailStatusAfterCancel: string;
  expectMaterialMatching?: boolean;
  materialSlotAssignments?: readonly MaterialSlotAssignment[];
  skipJobLifecycle?: boolean;
}): Promise<void> => {
  if (params.requiresCustomLedSetting && params.supportsLedControls) {
    await setCustomLedsEnabled(params.mainWindow);
  }

  if (params.supportsLedControls) {
    await verifyLedControls({
      mainWindow: params.mainWindow,
      emulatorAuth: params.emulatorAuth,
    });
  }

  if (params.skipJobLifecycle) {
    return;
  }

  const selectedFileName = await startRecentJobFromUi({
    electronApp: params.electronApp,
    mainWindow: params.mainWindow,
    fileName: params.fileName,
    expectMaterialMatching: params.expectMaterialMatching,
    materialSlotAssignments: params.materialSlotAssignments,
  });

  await waitForPrinterState(params.mainWindow, 'Printing');
  await waitForEmulatorDetail({
    ...params.emulatorAuth,
    description: 'Print started',
    predicate: (detail) =>
      detail.status === 'printing' && (selectedFileName.length === 0 || detail.printFileName === selectedFileName),
    timeoutMs: JOB_ACTION_TIMEOUT_MS,
  });

  await expect(params.mainWindow.locator('#btn-pause')).toBeEnabled({ timeout: JOB_ACTION_TIMEOUT_MS });
  await params.mainWindow.locator('#btn-pause').click();
  await waitForPrinterState(params.mainWindow, 'Paused');
  await waitForEmulatorDetail({
    ...params.emulatorAuth,
    description: 'Print paused',
    predicate: (detail) => detail.status === 'paused',
    timeoutMs: JOB_ACTION_TIMEOUT_MS,
  });

  await expect(params.mainWindow.locator('#btn-resume')).toBeEnabled({ timeout: JOB_ACTION_TIMEOUT_MS });
  await params.mainWindow.locator('#btn-resume').click();
  await waitForPrinterState(params.mainWindow, 'Printing');
  await waitForEmulatorDetail({
    ...params.emulatorAuth,
    description: 'Print resumed',
    predicate: (detail) => detail.status === 'printing',
    timeoutMs: JOB_ACTION_TIMEOUT_MS,
  });

  await expect(params.mainWindow.locator('#btn-stop')).toBeEnabled({ timeout: JOB_ACTION_TIMEOUT_MS });
  await params.mainWindow.locator('#btn-stop').click();
  await waitForPrinterState(params.mainWindow, params.expectedUiStateAfterCancel);
  await waitForEmulatorDetail({
    ...params.emulatorAuth,
    description: 'Print cancelled',
    predicate: (detail) => detail.status === params.expectedDetailStatusAfterCancel,
    timeoutMs: JOB_ACTION_TIMEOUT_MS,
  });

  if (params.supportsFiltration) {
    await verifyFiltrationControls({
      mainWindow: params.mainWindow,
      emulatorAuth: params.emulatorAuth,
    });
  }
};

const verifyLegacyUnsupportedControls = async (mainWindow: Page): Promise<void> => {
  await expect(mainWindow.locator('#btn-upload-job')).toBeVisible();
  await expect(mainWindow.locator('#btn-clear-status')).toBeVisible();
  await expect(mainWindow.locator('#btn-led-on')).toBeVisible();
  await expect(mainWindow.locator('#btn-led-off')).toBeVisible();
  await expect(mainWindow.locator('#btn-start-recent')).toBeEnabled();
  await expect(mainWindow.locator('#btn-start-local')).toBeEnabled();
};

const verifyFiltrationControlsDisabled = async (mainWindow: Page): Promise<void> => {
  await expect(mainWindow.locator('#btn-external-filtration')).toBeVisible();
  await expect(mainWindow.locator('#btn-external-filtration')).toBeDisabled();
  await expect(mainWindow.locator('#btn-internal-filtration')).toBeVisible();
  await expect(mainWindow.locator('#btn-internal-filtration')).toBeDisabled();
  await expect(mainWindow.locator('#btn-no-filtration')).toBeVisible();
  await expect(mainWindow.locator('#btn-no-filtration')).toBeDisabled();
};

const verifyForceLegacyModeSetting = async (mainWindow: Page): Promise<void> => {
  const forceLegacyMode = await mainWindow.evaluate(async () => {
    const bridgedApi = (
      window as unknown as {
        api?: {
          printerSettings?: {
            get: () => Promise<unknown>;
          };
        };
      }
    ).api;

    if (!bridgedApi?.printerSettings?.get) {
      return null;
    }

    const settings = (await bridgedApi.printerSettings.get()) as { forceLegacyMode?: boolean } | null;
    return settings?.forceLegacyMode ?? null;
  });

  expect(forceLegacyMode).toBe(true);
};

const requireReadyPayload = (payload: EmulatorReadyPayload | null, label: string): EmulatorReadyPayload => {
  if (!payload) {
    throw new Error(`Missing readiness payload for ${label}`);
  }

  return payload;
};

type ConnectionMode = 'direct' | 'discovery';
type DiscoverySelectionStrategy = 'serial' | 'name';

interface LifecycleScenario {
  label: string;
  model: EmulatorModel;
  serial: string;
  machineName: string;
  checkCode: string;
  expectsCheckCodePrompt: boolean;
  requiresCustomLedSetting: boolean;
  supportsLedControls: boolean;
  supportsFiltration: boolean;
  discoverySelection: DiscoverySelectionStrategy;
  verifyLegacyUnsupportedControls: boolean;
  expectedUiStateAfterCancel: string;
  expectedDetailStatusAfterCancel: string;
}

const buildTypeNameForScenarioModel = (model: EmulatorModel): string => {
  switch (model) {
    case 'adventurer-5m':
      return 'Adventurer 5M';
    case 'adventurer-5m-pro':
      return 'Adventurer 5M Pro';
    case 'adventurer-5x':
      return 'AD5X';
    case 'adventurer-3':
      return 'Adventurer 3';
    case 'adventurer-4':
      return 'Adventurer 4';
  }
};

const createForceLegacySeededPrinter = (scenario: LifecycleScenario): SeededPrinterDetailsEntry => {
  return {
    Name: `${scenario.machineName} Saved`,
    IPAddress: LOCALHOST_IP,
    SerialNumber: scenario.serial,
    CheckCode: scenario.checkCode,
    ClientType: 'legacy',
    printerModel: buildTypeNameForScenarioModel(scenario.model),
    customCameraEnabled: false,
    customCameraUrl: '',
    customLedsEnabled: false,
    forceLegacyMode: true,
    webUIEnabled: true,
    showCameraFps: false,
  };
};

const MODERN_LIFECYCLE_SCENARIOS: readonly LifecycleScenario[] = [
  {
    label: '5M Pro',
    model: 'adventurer-5m-pro',
    serial: 'E2E-SN-5MPRO',
    machineName: 'E2E-5MPro',
    checkCode: DEFAULT_CHECK_CODE,
    expectsCheckCodePrompt: true,
    requiresCustomLedSetting: false,
    supportsLedControls: true,
    supportsFiltration: true,
    discoverySelection: 'serial',
    verifyLegacyUnsupportedControls: false,
    expectedUiStateAfterCancel: 'Cancelled',
    expectedDetailStatusAfterCancel: 'cancelled',
  },
  {
    label: '5M',
    model: 'adventurer-5m',
    serial: 'E2E-SN-5M',
    machineName: 'E2E-5M',
    checkCode: DEFAULT_CHECK_CODE,
    expectsCheckCodePrompt: true,
    requiresCustomLedSetting: true,
    supportsLedControls: true,
    supportsFiltration: false,
    discoverySelection: 'serial',
    verifyLegacyUnsupportedControls: false,
    expectedUiStateAfterCancel: 'Cancelled',
    expectedDetailStatusAfterCancel: 'cancelled',
  },
  {
    label: 'AD5X',
    model: 'adventurer-5x',
    serial: 'E2E-SN-AD5X',
    machineName: 'E2E-AD5X',
    checkCode: DEFAULT_CHECK_CODE,
    expectsCheckCodePrompt: true,
    requiresCustomLedSetting: true,
    supportsLedControls: true,
    supportsFiltration: false,
    discoverySelection: 'serial',
    verifyLegacyUnsupportedControls: false,
    expectedUiStateAfterCancel: 'Cancelled',
    expectedDetailStatusAfterCancel: 'cancelled',
  },
];

const LEGACY_LIFECYCLE_SCENARIOS: readonly LifecycleScenario[] = [
  {
    label: 'Adventurer 3',
    model: 'adventurer-3',
    serial: 'E2E-SN-A3',
    machineName: 'E2E-A3',
    checkCode: DEFAULT_CHECK_CODE,
    expectsCheckCodePrompt: false,
    requiresCustomLedSetting: false,
    supportsLedControls: false,
    supportsFiltration: false,
    discoverySelection: 'name',
    verifyLegacyUnsupportedControls: true,
    expectedUiStateAfterCancel: 'Ready',
    expectedDetailStatusAfterCancel: 'cancelled',
  },
  {
    label: 'Adventurer 4',
    model: 'adventurer-4',
    serial: 'E2E-SN-A4',
    machineName: 'E2E-A4',
    checkCode: DEFAULT_CHECK_CODE,
    expectsCheckCodePrompt: false,
    requiresCustomLedSetting: false,
    supportsLedControls: false,
    supportsFiltration: false,
    discoverySelection: 'name',
    verifyLegacyUnsupportedControls: true,
    expectedUiStateAfterCancel: 'Ready',
    expectedDetailStatusAfterCancel: 'cancelled',
  },
];

const ALL_LIFECYCLE_SCENARIOS: readonly LifecycleScenario[] = [
  ...MODERN_LIFECYCLE_SCENARIOS,
  ...LEGACY_LIFECYCLE_SCENARIOS,
];

const AD5X_SCENARIO = MODERN_LIFECYCLE_SCENARIOS.find((scenario) => scenario.model === 'adventurer-5x');

if (!AD5X_SCENARIO) {
  throw new Error('Missing AD5X lifecycle scenario');
}

const AD5X_MULTI_COLOR_MAPPINGS: readonly EmulatorMaterialMapping[] = [
  {
    toolId: 0,
    slotId: 1,
    materialName: 'PLA',
    toolMaterialColor: '#4DA3FF',
    slotMaterialColor: '#4DA3FF',
  },
  {
    toolId: 1,
    slotId: 2,
    materialName: 'PETG',
    toolMaterialColor: '#FF8A3D',
    slotMaterialColor: '#FF8A3D',
  },
];

const FIVE_M_SCENARIO = MODERN_LIFECYCLE_SCENARIOS.find((scenario) => scenario.model === 'adventurer-5m');
const FIVE_M_PRO_SCENARIO = MODERN_LIFECYCLE_SCENARIOS.find((scenario) => scenario.model === 'adventurer-5m-pro');

if (!FIVE_M_SCENARIO || !FIVE_M_PRO_SCENARIO) {
  throw new Error('Missing 5M and/or 5M Pro lifecycle scenario');
}

const FORCE_LEGACY_DIRECT_SCENARIOS: readonly LifecycleScenario[] = [
  {
    ...FIVE_M_SCENARIO,
    label: '5M (forced legacy)',
    expectsCheckCodePrompt: false,
    requiresCustomLedSetting: true,
    supportsLedControls: true,
    supportsFiltration: false,
    verifyLegacyUnsupportedControls: true,
    expectedUiStateAfterCancel: 'Ready',
    expectedDetailStatusAfterCancel: 'cancelled',
  },
  {
    ...FIVE_M_PRO_SCENARIO,
    label: '5M Pro (forced legacy)',
    expectsCheckCodePrompt: false,
    requiresCustomLedSetting: true,
    supportsLedControls: true,
    supportsFiltration: false,
    verifyLegacyUnsupportedControls: true,
    expectedUiStateAfterCancel: 'Ready',
    expectedDetailStatusAfterCancel: 'cancelled',
  },
];

const runSingleModelFlow = async (params: {
  scenario: LifecycleScenario;
  mode: ConnectionMode;
  fileName?: string;
  seedFile?: SeedRecentFileOptions;
  expectMaterialMatching?: boolean;
  materialSlotAssignments?: readonly MaterialSlotAssignment[];
  seededPrinters?: readonly SeededPrinterDetailsEntry[];
  expectForceLegacyModeSetting?: boolean;
  expectFiltrationControlsDisabled?: boolean;
  skipJobLifecycle?: boolean;
}): Promise<void> => {
  const discoveryEnabled = params.mode === 'discovery';
  const tcpPort = params.mode === 'direct' ? 8899 : await getFreePort();
  const httpPort = params.mode === 'direct' ? 8898 : await getFreePort();

  const emulator = await startEmulatorInstance({
    instance: {
      instanceId: `single-${params.scenario.model}-${params.mode}`,
      model: params.scenario.model,
      serial: params.scenario.serial,
      checkCode: params.scenario.checkCode,
      machineName: params.scenario.machineName,
      tcpPort,
      httpPort,
      discoveryEnabled,
      simulationMode: 'auto',
      simulationSpeed: 1,
    },
  });

  const readyPayload = emulator.readyPayloads[0];
  if (!readyPayload) {
    await emulator.stop();
    throw new Error(`Missing readiness payload for ${params.scenario.label} (${params.mode})`);
  }

  const emulatorAuth: EmulatorAuthConfig = {
    httpPort: readyPayload.httpPort,
    serial: readyPayload.serial,
    checkCode: params.scenario.checkCode,
  };
  const fileName = params.fileName ?? `e2e-${params.scenario.machineName.toLowerCase()}-${params.mode}.gcode`;

  await seedEmulatorRecentFile({
    ...emulatorAuth,
    fileName,
    ...(params.seedFile ?? {}),
  });

  const launched = await launchElectronWithIsolatedProfile({
    seededPrinters: params.seededPrinters,
  });

  try {
    await maybeDismissAutoConnectChoiceDialog({
      electronApp: launched.electronApp,
      timeoutMs: 10_000,
    });

    if (params.mode === 'direct') {
      await connectThroughDirectIpDialog({
        electronApp: launched.electronApp,
        mainWindow: launched.mainWindow,
        ipAddress: LOCALHOST_IP,
        checkCode: params.scenario.checkCode,
        expectCheckCodePrompt: params.scenario.expectsCheckCodePrompt,
      });
    } else {
      const selectionText =
        params.scenario.discoverySelection === 'serial' ? readyPayload.serial : params.scenario.machineName;
      await connectThroughDiscoveryDialog({
        electronApp: launched.electronApp,
        mainWindow: launched.mainWindow,
        selectionText,
        checkCode: params.scenario.checkCode,
        expectCheckCodePrompt: params.scenario.expectsCheckCodePrompt,
      });
    }

    await waitForConnectedUi(launched.mainWindow, 1);
    await expect.poll(() => firstConnectedTabName(launched.mainWindow)).not.toBe('');
    await maybeDismissAutoConnectChoiceDialog({
      electronApp: launched.electronApp,
      timeoutMs: 2_000,
    });

    if (params.expectForceLegacyModeSetting) {
      await verifyForceLegacyModeSetting(launched.mainWindow);
    }

    if (params.scenario.verifyLegacyUnsupportedControls) {
      await verifyLegacyUnsupportedControls(launched.mainWindow);
    }

    if (params.expectFiltrationControlsDisabled) {
      await verifyFiltrationControlsDisabled(launched.mainWindow);
    }

    await runLifecycleControls({
      electronApp: launched.electronApp,
      mainWindow: launched.mainWindow,
      fileName,
      emulatorAuth,
      requiresCustomLedSetting: params.scenario.requiresCustomLedSetting,
      supportsLedControls: params.scenario.supportsLedControls,
      supportsFiltration: params.scenario.supportsFiltration,
      expectedUiStateAfterCancel: params.scenario.expectedUiStateAfterCancel,
      expectedDetailStatusAfterCancel: params.scenario.expectedDetailStatusAfterCancel,
      expectMaterialMatching: params.expectMaterialMatching,
      materialSlotAssignments: params.materialSlotAssignments,
      skipJobLifecycle: params.skipJobLifecycle,
    });

    if (!params.skipJobLifecycle) {
      const finalDetail = await fetchEmulatorDetail(emulatorAuth);
      expect(finalDetail.status).toBe('cancelled');
    }
    launched.assertNoUnexpectedRendererErrors();
  } finally {
    await closeLaunchedElectronApp(launched);
    await emulator.stop();
  }
};

test.describe('electron emulator e2e', () => {
  test.skip(!process.env[EMULATOR_FLAG], `Set ${EMULATOR_FLAG}=1 to run emulator-backed Electron desktop tests`);
  test.skip(process.platform !== 'win32', 'This suite currently targets Windows environments');

  test.describe('direct lifecycle flows', () => {
    for (const scenario of ALL_LIFECYCLE_SCENARIOS) {
      test(`direct ${scenario.label}: connect + lifecycle + controls`, async () => {
        await runSingleModelFlow({
          scenario,
          mode: 'direct',
        });
      });
    }

    test('direct AD5X: multi-color start + lifecycle + controls', async () => {
      await runSingleModelFlow({
        scenario: AD5X_SCENARIO,
        mode: 'direct',
        fileName: 'e2e-ad5x-direct-multicolor.3mf',
        seedFile: {
          gcodeToolCnt: AD5X_MULTI_COLOR_MAPPINGS.length,
          useMatlStation: true,
          materialMappings: AD5X_MULTI_COLOR_MAPPINGS,
        },
        expectMaterialMatching: true,
        materialSlotAssignments: AD5X_MULTI_COLOR_MAPPINGS.map((mapping) => ({
          toolId: mapping.toolId,
          slotId: mapping.slotId,
        })),
      });
    });

    for (const scenario of FORCE_LEGACY_DIRECT_SCENARIOS) {
      test(`direct ${scenario.label}: connect + lifecycle + controls`, async () => {
        await runSingleModelFlow({
          scenario,
          mode: 'direct',
          seededPrinters: [createForceLegacySeededPrinter(scenario)],
          expectForceLegacyModeSetting: true,
          expectFiltrationControlsDisabled: scenario.model === 'adventurer-5m-pro',
          skipJobLifecycle: scenario.model === 'adventurer-5m-pro',
        });
      });
    }
  });

  test.describe('discovery lifecycle flows', () => {
    test.skip(!process.env[DISCOVERY_FLAG], `Set ${DISCOVERY_FLAG}=1 to run discovery-based emulator tests`);

    for (const scenario of ALL_LIFECYCLE_SCENARIOS) {
      test(`discovery ${scenario.label}: connect + lifecycle + controls`, async () => {
        await runSingleModelFlow({
          scenario,
          mode: 'discovery',
        });
      });
    }

    test('discovery AD5X: multi-color start + lifecycle + controls', async () => {
      await runSingleModelFlow({
        scenario: AD5X_SCENARIO,
        mode: 'discovery',
        fileName: 'e2e-ad5x-discovery-multicolor.3mf',
        seedFile: {
          gcodeToolCnt: AD5X_MULTI_COLOR_MAPPINGS.length,
          useMatlStation: true,
          materialMappings: AD5X_MULTI_COLOR_MAPPINGS,
        },
        expectMaterialMatching: true,
        materialSlotAssignments: AD5X_MULTI_COLOR_MAPPINGS.map((mapping) => ({
          toolId: mapping.toolId,
          slotId: mapping.slotId,
        })),
      });
    });
  });

  test.describe('multi-printer discovery flow', () => {
    test.skip(!process.env[DISCOVERY_FLAG], `Set ${DISCOVERY_FLAG}=1 to run discovery-based emulator tests`);

    let supervisorEmulator: Awaited<ReturnType<typeof startEmulatorSupervisor>> | null = null;
    let alphaReady: EmulatorReadyPayload | null = null;
    let betaReady: EmulatorReadyPayload | null = null;
    let gammaReady: EmulatorReadyPayload | null = null;

    test.beforeAll(async () => {
      const [alphaTcpPort, alphaHttpPort, betaTcpPort, betaHttpPort, gammaTcpPort, gammaHttpPort] =
        await getDistinctFreePorts(6);

      supervisorEmulator = await startEmulatorSupervisor({
        instances: [
          {
            instanceId: 'alpha',
            model: 'adventurer-5x',
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
          {
            instanceId: 'gamma',
            model: 'adventurer-5m-pro',
            serial: 'E2E-SN-GAMMA',
            checkCode: DEFAULT_CHECK_CODE,
            machineName: 'E2E-Gamma',
            tcpPort: gammaTcpPort,
            httpPort: gammaHttpPort,
            discoveryEnabled: true,
            simulationMode: 'auto',
            simulationSpeed: 100,
          },
        ],
      });

      const alphaPayload = supervisorEmulator.readyPayloads.find((payload) => payload.instanceId === 'alpha');
      const betaPayload = supervisorEmulator.readyPayloads.find((payload) => payload.instanceId === 'beta');
      const gammaPayload = supervisorEmulator.readyPayloads.find((payload) => payload.instanceId === 'gamma');
      if (!alphaPayload || !betaPayload || !gammaPayload) {
        throw new Error('Supervisor readiness payloads missing alpha, beta, and/or gamma instance');
      }

      alphaReady = alphaPayload;
      betaReady = betaPayload;
      gammaReady = gammaPayload;

      for (const ready of [alphaPayload, betaPayload, gammaPayload]) {
        await seedEmulatorRecentFile({
          httpPort: ready.httpPort,
          serial: ready.serial,
          checkCode: DEFAULT_CHECK_CODE,
          fileName: `e2e-multi-${ready.instanceId}.gcode`,
        });
      }
    });

    test.afterAll(async () => {
      if (supervisorEmulator) {
        await supervisorEmulator.stop();
      }
    });

    test('shows all discovered printers and connects each as separate contexts', async () => {
      const launched = await launchElectronWithIsolatedProfile();

      try {
        await openConnectFlow(launched.mainWindow);
        await maybeHandleConnectedWarningDialog(launched.electronApp);

        const connectChoiceDialog = await waitForWindowWithSelector(launched.electronApp, '#btn-scan-network', 15_000);
        await connectChoiceDialog.locator('#btn-scan-network').click();

        const selectionDialog = await waitForWindowWithSelector(launched.electronApp, '#printer-table', 35_000);
        await expect(
          selectionDialog.locator('#printer-table tbody tr[data-printer]', {
            hasText: requireReadyPayload(alphaReady, 'alpha').serial,
          })
        ).toBeVisible();
        await expect(
          selectionDialog.locator('#printer-table tbody tr[data-printer]', {
            hasText: requireReadyPayload(betaReady, 'beta').serial,
          })
        ).toBeVisible();
        await expect(
          selectionDialog.locator('#printer-table tbody tr[data-printer]', {
            hasText: requireReadyPayload(gammaReady, 'gamma').serial,
          })
        ).toBeVisible();

        await selectPrinterFromDiscoveryDialog({
          electronApp: launched.electronApp,
          rowText: requireReadyPayload(alphaReady, 'alpha').serial,
        });
        await maybeSubmitCheckCodeDialog({
          electronApp: launched.electronApp,
          checkCode: DEFAULT_CHECK_CODE,
          required: true,
        });
        await waitForConnectedUi(launched.mainWindow, 1);

        await connectThroughDiscoveryDialog({
          electronApp: launched.electronApp,
          mainWindow: launched.mainWindow,
          selectionText: requireReadyPayload(betaReady, 'beta').serial,
          checkCode: DEFAULT_CHECK_CODE,
          expectCheckCodePrompt: true,
        });
        await waitForConnectedUi(launched.mainWindow, 2);

        await connectThroughDiscoveryDialog({
          electronApp: launched.electronApp,
          mainWindow: launched.mainWindow,
          selectionText: requireReadyPayload(gammaReady, 'gamma').serial,
          checkCode: DEFAULT_CHECK_CODE,
          expectCheckCodePrompt: true,
        });
        await waitForConnectedUi(launched.mainWindow, 3);

        await expect
          .poll(
            async () => {
              return await launched.mainWindow.locator('#printer-tabs-container .printer-tab').count();
            },
            { timeout: CONNECT_TIMEOUT_MS }
          )
          .toBeGreaterThanOrEqual(3);

        launched.assertNoUnexpectedRendererErrors();
      } finally {
        await closeLaunchedElectronApp(launched);
      }
    });
  });

  test.describe('legacy multi-printer discovery flow', () => {
    test.skip(!process.env[DISCOVERY_FLAG], `Set ${DISCOVERY_FLAG}=1 to run discovery-based emulator tests`);

    let supervisorEmulator: Awaited<ReturnType<typeof startEmulatorSupervisor>> | null = null;
    test.beforeAll(async () => {
      const [a3TcpPort, a3HttpPort, a4TcpPort, a4HttpPort] = await getDistinctFreePorts(4);

      supervisorEmulator = await startEmulatorSupervisor({
        instances: [
          {
            instanceId: 'legacy-a3',
            model: 'adventurer-3',
            serial: 'E2E-SN-LEGACY-A3',
            checkCode: DEFAULT_CHECK_CODE,
            machineName: 'E2E Legacy A3',
            tcpPort: a3TcpPort,
            httpPort: a3HttpPort,
            discoveryEnabled: true,
            simulationMode: 'auto',
            simulationSpeed: 100,
          },
          {
            instanceId: 'legacy-a4',
            model: 'adventurer-4',
            serial: 'E2E-SN-LEGACY-A4',
            checkCode: DEFAULT_CHECK_CODE,
            machineName: 'E2E Legacy A4',
            tcpPort: a4TcpPort,
            httpPort: a4HttpPort,
            discoveryEnabled: true,
            simulationMode: 'auto',
            simulationSpeed: 100,
          },
        ],
      });

      const a3Payload = supervisorEmulator.readyPayloads.find((payload) => payload.instanceId === 'legacy-a3');
      const a4Payload = supervisorEmulator.readyPayloads.find((payload) => payload.instanceId === 'legacy-a4');
      if (!a3Payload || !a4Payload) {
        throw new Error('Supervisor readiness payloads missing legacy-a3 and/or legacy-a4 instance');
      }

      for (const ready of [a3Payload, a4Payload]) {
        await seedEmulatorRecentFile({
          httpPort: ready.httpPort,
          serial: ready.serial,
          checkCode: DEFAULT_CHECK_CODE,
          fileName: `e2e-legacy-multi-${ready.instanceId}.gcode`,
        });
      }
    });

    test.afterAll(async () => {
      if (supervisorEmulator) {
        await supervisorEmulator.stop();
      }
    });

    test('shows A3 and A4 in discovery and connects both contexts', async () => {
      const launched = await launchElectronWithIsolatedProfile();

      try {
        await openConnectFlow(launched.mainWindow);
        await maybeHandleConnectedWarningDialog(launched.electronApp);

        const connectChoiceDialog = await waitForWindowWithSelector(launched.electronApp, '#btn-scan-network', 15_000);
        await connectChoiceDialog.locator('#btn-scan-network').click();

        const selectionDialog = await waitForWindowWithSelector(launched.electronApp, '#printer-table', 35_000);
        await expect(
          selectionDialog.locator('#printer-table tbody tr[data-printer]', {
            hasText: 'E2E Legacy A3',
          })
        ).toBeVisible();
        await expect(
          selectionDialog.locator('#printer-table tbody tr[data-printer]', {
            hasText: 'E2E Legacy A4',
          })
        ).toBeVisible();

        await selectPrinterFromDiscoveryDialog({
          electronApp: launched.electronApp,
          rowText: 'E2E Legacy A3',
        });
        await maybeSubmitCheckCodeDialog({
          electronApp: launched.electronApp,
          checkCode: DEFAULT_CHECK_CODE,
          timeoutMs: 2_000,
          required: false,
        });
        await waitForConnectedUi(launched.mainWindow, 1);
        await verifyLegacyUnsupportedControls(launched.mainWindow);

        await connectThroughDiscoveryDialog({
          electronApp: launched.electronApp,
          mainWindow: launched.mainWindow,
          selectionText: 'E2E Legacy A4',
          checkCode: DEFAULT_CHECK_CODE,
          expectCheckCodePrompt: false,
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

        await expect.poll(() => firstConnectedTabName(launched.mainWindow)).not.toBe('');
        launched.assertNoUnexpectedRendererErrors();
      } finally {
        await closeLaunchedElectronApp(launched);
      }
    });
  });
});
