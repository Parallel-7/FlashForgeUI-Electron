/**
 * @fileoverview Live Electron hardware coverage for Discord webhook payloads with camera snapshots.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { type ElectronApplication, _electron as electron, expect, type Page, test } from '@playwright/test';
import {
  type CapturedDiscordWebhookRequest,
  startDiscordWebhookRelay,
} from './helpers/discord-webhook-relay';

const HARDWARE_FLAG = 'FFUI_E2E_HARDWARE';
const DEFAULT_TIMEOUT_MS = 180_000;
const CONNECT_TIMEOUT_MS = 90_000;
const OPTIONAL_DIALOG_TIMEOUT_MS = 500;
const WINDOW_POLL_INTERVAL_MS = 50;
const PRINTER_NAME = process.env.FFUI_E2E_AD5X_NAME?.trim() || 'AD5X';
const FORWARD_URL = process.env.FFUI_E2E_DISCORD_FORWARD_URL?.trim();

type UiSnapshot = {
  printerName: string;
  printerState: string;
  bedCurrent: number;
  bedTarget: number;
  extruderCurrent: number;
  extruderTarget: number;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function writeSeededConfig(userDataPath: string, webhookUrl: string): Promise<void> {
  await mkdir(userDataPath, { recursive: true });
  const configPath = path.join(userDataPath, 'config.json');
  const payload = {
    DiscordSync: true,
    DiscordIncludeCameraSnapshots: true,
    DiscordUpdateIntervalMinutes: 60,
    WebhookUrl: webhookUrl,
  };
  await writeFile(configPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

async function findWindowWithSelector(
  electronApp: ElectronApplication,
  selector: string,
  timeoutMs = 10_000
): Promise<Page | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const windowPage of electronApp.windows()) {
      try {
        if ((await windowPage.locator(selector).count()) > 0) {
          return windowPage;
        }
      } catch {
        // Ignore detached windows while polling.
      }
    }

    await sleep(WINDOW_POLL_INTERVAL_MS);
  }

  return null;
}

async function waitForWindowWithSelector(
  electronApp: ElectronApplication,
  selector: string,
  timeoutMs = 10_000
): Promise<Page> {
  const page = await findWindowWithSelector(electronApp, selector, timeoutMs);
  if (!page) {
    throw new Error(`Timed out waiting for window with selector "${selector}" after ${timeoutMs}ms`);
  }

  return page;
}

async function hasMainUiMarkers(windowPage: Page): Promise<boolean> {
  try {
    return (
      (await windowPage.locator('#btn-main-menu').count()) > 0 ||
      (await windowPage.locator('#placeholder-connect-btn').count()) > 0
    );
  } catch {
    return false;
  }
}

async function resolveMainWindow(
  electronApp: ElectronApplication,
  timeoutMs = 20_000
): Promise<Page> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const windowPage of electronApp.windows()) {
      if (await hasMainUiMarkers(windowPage)) {
        return windowPage;
      }
    }

    await sleep(WINDOW_POLL_INTERVAL_MS);
  }

  throw new Error(`Unable to locate main application window after ${timeoutMs}ms`);
}

async function maybeDismissAutoConnectChoiceDialog(electronApp: ElectronApplication): Promise<void> {
  const dialog = await findWindowWithSelector(electronApp, '#btn-manual-ip', OPTIONAL_DIALOG_TIMEOUT_MS);
  if (!dialog) {
    return;
  }

  const cancelButton = dialog.locator('#btn-cancel').first();
  await expect(cancelButton).toBeVisible({ timeout: 5_000 });
  await cancelButton.click();
}

async function maybeHandleConnectedWarningDialog(electronApp: ElectronApplication): Promise<void> {
  const dialog = await findWindowWithSelector(electronApp, '#dialog-continue', OPTIONAL_DIALOG_TIMEOUT_MS);
  if (!dialog) {
    return;
  }

  await dialog.locator('#dialog-continue').click();
}

async function maybeSubmitCheckCodeDialog(
  electronApp: ElectronApplication,
  checkCode: string
): Promise<void> {
  const dialog = await waitForWindowWithSelector(electronApp, '#dialog-input', 20_000);
  await dialog.locator('#dialog-input').fill(checkCode);
  await dialog.locator('#dialog-ok').click();
}

async function openConnectFlow(mainWindow: Page): Promise<void> {
  const placeholderButton = mainWindow.locator('#placeholder-connect-btn');
  if (await placeholderButton.isVisible().catch(() => false)) {
    await placeholderButton.click();
    return;
  }

  await expect(mainWindow.locator('#btn-main-menu')).toBeVisible();
  await mainWindow.locator('#btn-main-menu').click();
  const connectMenuItem = mainWindow.locator('#main-menu-dropdown .menu-item[data-action="connect"]');
  await expect(connectMenuItem).toBeVisible();
  await connectMenuItem.click();
}

async function connectThroughDirectIpDialog(
  electronApp: ElectronApplication,
  mainWindow: Page,
  printerIp: string,
  printerCheckCode: string
): Promise<void> {
  await maybeDismissAutoConnectChoiceDialog(electronApp);
  await openConnectFlow(mainWindow);
  await maybeHandleConnectedWarningDialog(electronApp);

  const choiceDialog = await waitForWindowWithSelector(electronApp, '#btn-enter-ip', 20_000);
  await choiceDialog.locator('#btn-enter-ip').click();

  const ipDialog = await waitForWindowWithSelector(electronApp, '#dialog-input', 15_000);
  await ipDialog.locator('#dialog-input').fill(printerIp);
  await ipDialog.locator('#dialog-ok').click();

  await maybeSubmitCheckCodeDialog(electronApp, printerCheckCode);
}

async function waitForConnectedUi(mainWindow: Page): Promise<void> {
  await expect(
    mainWindow.locator('#printer-tabs-container .printer-tab.status-connected').first()
  ).toBeVisible({
    timeout: CONNECT_TIMEOUT_MS,
  });
  await expect(mainWindow.locator('.grid-stack')).toBeVisible({ timeout: CONNECT_TIMEOUT_MS });
  await expect
    .poll(
      async () => {
        const [bedDisplay, extruderDisplay] = await Promise.all([
          mainWindow.locator('#bed-temp-display').textContent(),
          mainWindow.locator('#extruder-temp-display').textContent(),
        ]);

        const bed = parseUiTemperaturePair(bedDisplay?.trim() || '0C/0C');
        const extruder = parseUiTemperaturePair(extruderDisplay?.trim() || '0C/0C');

        return {
          bedHasLiveReading: bed.current > 0 || bed.target > 0,
          extruderHasLiveReading: extruder.current > 0 || extruder.target > 0,
        };
      },
      {
        timeout: CONNECT_TIMEOUT_MS,
      }
    )
    .toEqual({
      bedHasLiveReading: true,
      extruderHasLiveReading: true,
    });
}

async function waitForCameraReady(mainWindow: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        await mainWindow.evaluate(async () => {
          const bridgedApi = (
            window as unknown as {
              api?: {
                camera?: {
                  getStreamConfig: () => Promise<unknown>;
                };
              };
            }
          ).api;

          if (!bridgedApi?.camera) {
            return false;
          }

          const config = await bridgedApi.camera.getStreamConfig();
          return Boolean(config && typeof config === 'object');
        }),
      {
        timeout: 45_000,
      }
    )
    .toBe(true);

  await sleep(1_000);
}

function parseUiTemperaturePair(value: string): { current: number; target: number } {
  const parts = value
    .replace(/\s+/g, '')
    .split('/')
    .map((part) => parseInt(part.replace(/[^\d-]/g, ''), 10));

  if (parts.length !== 2 || parts.some((part) => Number.isNaN(part))) {
    throw new Error(`Unable to parse UI temperature pair: ${value}`);
  }

  return {
    current: parts[0] ?? 0,
    target: parts[1] ?? 0,
  };
}

async function readUiSnapshot(mainWindow: Page): Promise<UiSnapshot> {
  const printerName =
    (await mainWindow
      .locator('#printer-tabs-container .printer-tab.status-connected .tab-name')
      .first()
      .textContent())?.trim() || 'Unknown';
  const printerState = (await mainWindow.locator('#printer-status-text').first().textContent())?.trim() || 'Unknown';
  const bedDisplay = (await mainWindow.locator('#bed-temp-display').textContent())?.trim() || '0C/0C';
  const extruderDisplay =
    (await mainWindow.locator('#extruder-temp-display').textContent())?.trim() || '0C/0C';

  const bed = parseUiTemperaturePair(bedDisplay);
  const extruder = parseUiTemperaturePair(extruderDisplay);

  return {
    printerName,
    printerState,
    bedCurrent: bed.current,
    bedTarget: bed.target,
    extruderCurrent: extruder.current,
    extruderTarget: extruder.target,
  };
}

function getFirstEmbed(request: CapturedDiscordWebhookRequest): Record<string, unknown> {
  const embeds = request.payload['embeds'];
  if (!Array.isArray(embeds) || embeds.length === 0) {
    throw new Error('Webhook payload does not include embeds');
  }

  const embed = embeds[0];
  if (!embed || typeof embed !== 'object') {
    throw new Error('First embed is not an object');
  }

  return embed as Record<string, unknown>;
}

function getEmbedFieldMap(embed: Record<string, unknown>): Map<string, string> {
  const fields = embed['fields'];
  if (!Array.isArray(fields)) {
    throw new Error('Embed fields are missing');
  }

  const map = new Map<string, string>();
  for (const field of fields) {
    if (!field || typeof field !== 'object') {
      continue;
    }

    const name = typeof field['name'] === 'string' ? field['name'] : null;
    const value = typeof field['value'] === 'string' ? field['value'] : null;
    if (name && value) {
      map.set(name, value);
    }
  }

  return map;
}

function parseEmbedTemperaturePair(value: string): { current: number; target: number } {
  const segments = value.split('/').map((segment) => parseFloat(segment.replace(/[^\d.-]/g, '')));
  if (segments.length !== 2 || segments.some((segment) => Number.isNaN(segment))) {
    throw new Error(`Unable to parse embed temperature pair: ${value}`);
  }

  return {
    current: Math.round(segments[0] ?? 0),
    target: Math.round(segments[1] ?? 0),
  };
}

function assertMultipartSnapshotRequest(request: CapturedDiscordWebhookRequest): void {
  expect(request.contentType.toLowerCase()).toContain('multipart/form-data');
  expect(request.attachment).not.toBeNull();
  expect(request.attachment?.contentType.toLowerCase()).toContain('image/');
  expect(request.attachment?.bytes.byteLength ?? 0).toBeGreaterThan(0);

  const embed = getFirstEmbed(request);
  const image = embed['image'];
  expect(image).toEqual(
    expect.objectContaining({
      url: `attachment://${request.attachment?.filename}`,
    })
  );
}

test.describe('electron hardware discord relay', () => {
  test.skip(
    !process.env[HARDWARE_FLAG],
    `Set ${HARDWARE_FLAG}=1 to run live Electron hardware Discord tests`
  );

  test('connects to the real AD5X and sends Discord status + print-complete payloads with snapshots', async () => {
    test.setTimeout(DEFAULT_TIMEOUT_MS);
    const printerIp = requireEnv('FFUI_E2E_AD5X_IP');
    const printerCheckCode = requireEnv('FFUI_E2E_AD5X_CHECK_CODE');

    const relay = await startDiscordWebhookRelay({
      forwardUrl: FORWARD_URL,
    });

    const appDataRoot = await mkdtemp(path.join(os.tmpdir(), 'ffui-e2e-hardware-'));
    const userDataPath = path.join(appDataRoot, 'FlashForgeUI');
    await writeSeededConfig(userDataPath, relay.webhookUrl);

    const electronApp = await electron.launch({
      args: ['.'],
      cwd: process.cwd(),
      timeout: 120_000,
      env: {
        ...process.env,
        FFUI_USER_DATA_DIR: userDataPath,
        FFUI_E2E_HARDWARE: '1',
      },
    });

    try {
      const mainWindow = await resolveMainWindow(electronApp);
      await expect(mainWindow.locator('.title')).toHaveText('FlashForgeUI');

      await connectThroughDirectIpDialog(electronApp, mainWindow, printerIp, printerCheckCode);
      await waitForConnectedUi(mainWindow);
      await waitForCameraReady(mainWindow);

      const uiSnapshot = await readUiSnapshot(mainWindow);

      relay.reset();
      await mainWindow.evaluate(async () => {
        const bridgedApi = (
          window as unknown as {
            api?: {
              invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
            };
          }
        ).api;

        if (!bridgedApi) {
          throw new Error('Renderer API bridge is unavailable');
        }

        await bridgedApi.invoke('e2e:discord:send-current-status');
      });

      const statusRequest = await relay.waitForRequest({
        timeoutMs: 30_000,
        predicate: (request) => {
          const embed = getFirstEmbed(request);
          return typeof embed['title'] === 'string' && String(embed['title']).includes(uiSnapshot.printerName);
        },
      });

      assertMultipartSnapshotRequest(statusRequest);
      const statusEmbed = getFirstEmbed(statusRequest);
      const statusFields = getEmbedFieldMap(statusEmbed);
      expect(String(statusEmbed['title'] ?? '')).toContain(PRINTER_NAME);
      expect(String(statusEmbed['title'] ?? '')).toContain(uiSnapshot.printerName);
      expect(statusFields.get('Status')).toContain(uiSnapshot.printerState);

      const bedField = statusFields.get('Bed Temp');
      const extruderField = statusFields.get('Extruder Temp');
      expect(bedField).toBeTruthy();
      expect(extruderField).toBeTruthy();

      const parsedBed = parseEmbedTemperaturePair(bedField ?? '');
      const parsedExtruder = parseEmbedTemperaturePair(extruderField ?? '');
      expect(parsedBed).toEqual({
        current: uiSnapshot.bedCurrent,
        target: uiSnapshot.bedTarget,
      });
      expect(parsedExtruder).toEqual({
        current: uiSnapshot.extruderCurrent,
        target: uiSnapshot.extruderTarget,
      });

      relay.reset();
      await mainWindow.evaluate(async () => {
        const bridgedApi = (
          window as unknown as {
            api?: {
              invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
            };
          }
        ).api;

        if (!bridgedApi) {
          throw new Error('Renderer API bridge is unavailable');
        }

        await bridgedApi.invoke('e2e:discord:send-print-complete', {
          fileName: 'e2e-ad5x-validation.3mf',
          durationSeconds: 3661,
        });
      });

      const printCompleteRequest = await relay.waitForRequest({
        timeoutMs: 30_000,
      });

      assertMultipartSnapshotRequest(printCompleteRequest);
      const printCompleteFields = getEmbedFieldMap(getFirstEmbed(printCompleteRequest));
      expect(printCompleteFields.get('File')).toBe('e2e-ad5x-validation.3mf');
      expect(printCompleteFields.get('Total Time')).toBe('1h 1m');
    } finally {
      await electronApp.close().catch(() => undefined);
      await relay.close().catch(() => undefined);
      await rm(appDataRoot, { recursive: true, force: true });
    }
  });
});
