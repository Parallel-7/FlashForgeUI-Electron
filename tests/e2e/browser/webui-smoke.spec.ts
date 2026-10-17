/**
 * @fileoverview Browser coverage for WebUI boot, cache-busted assets, and printer context
 * switching against the real headless server.
 *
 * The asset checks are the reason this suite exists: a stale mix of cached and rebuilt
 * WebUI files produces icon and camera failures that no other surface sees. They now run
 * against the app's real static middleware and its real build stamp, so a regression in
 * `createWebUIStaticAssetOptions()` or in the asset copy script fails here.
 *
 * Context switching drives two genuinely connected emulator printers, so switching is
 * verified against the server's own reported active context rather than a canned reply.
 */

import { expect, test, type Page } from '@playwright/test';
import { describeHeadlessSkipReason, type HeadlessWebUI, startHeadlessWebUI, WEBUI_TEST_PASSWORD } from './helpers/headless-webui';

const skipReason = describeHeadlessSkipReason();

/** Logs in through the UI and waits for the dashboard to come up. */
const signIn = async (page: Page, webui: HeadlessWebUI): Promise<void> => {
  await page.goto(webui.baseUrl, { waitUntil: 'domcontentloaded' });
  await page.fill('#password-input', WEBUI_TEST_PASSWORD);
  await page.click('#login-button');
  await expect(page.locator('#main-ui')).toBeVisible();
};

interface ContextsPayload {
  contexts: Array<{ id: string; name: string; isActive: boolean }>;
  activeContextId: string | null;
}

/**
 * Gets a token straight from the auth API.
 *
 * Deliberately independent of whatever the browser stored: these assertions exist to check
 * the server's view of the world, so they must not fail merely because the client keeps its
 * token somewhere other than localStorage.
 */
const apiToken = async (webui: HeadlessWebUI): Promise<string> => {
  const response = await fetch(`${webui.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: WEBUI_TEST_PASSWORD }),
  });
  const payload = (await response.json()) as { token?: string };
  if (!payload.token) {
    throw new Error('Could not obtain an API token for out-of-band assertions');
  }
  return payload.token;
};

const fetchContexts = async (webui: HeadlessWebUI, token: string): Promise<ContextsPayload> => {
  const response = await fetch(`${webui.baseUrl}/api/contexts`, { headers: { Authorization: `Bearer ${token}` } });
  expect(response.status, 'the contexts endpoint should accept a freshly issued token').toBe(200);
  return (await response.json()) as ContextsPayload;
};

test.describe('WebUI smoke', () => {
  test.skip(skipReason !== null, skipReason ?? '');

  let webui: HeadlessWebUI;

  test.beforeAll(async () => {
    webui = await startHeadlessWebUI();
  });

  test.afterAll(async () => {
    await webui?.stop();
  });

  test('loads the built WebUI with versioned assets and without stale camera/icon errors', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning' || message.type() === 'error') {
        consoleMessages.push(message.text());
      }
    });

    // Observed from the client, which is the side that decides what to request.
    const requestedPaths: string[] = [];
    page.on('request', (request) => {
      requestedPaths.push(new URL(request.url()).pathname);
    });

    await signIn(page, webui);
    await expect(page.locator('#connection-text')).toHaveText('Connected');

    const assetInfo = await page.evaluate(() => {
      const localAssetUrls = [
        ...Array.from(document.querySelectorAll('link[href]')).map((element) => element.getAttribute('href') || ''),
        ...Array.from(document.querySelectorAll('script[src]')).map((element) => element.getAttribute('src') || ''),
      ].filter((url) => url.length > 0 && !url.startsWith('http'));
      const inlineVideoImport = Array.from(document.querySelectorAll('script[type="module"]'))
        .map((element) => element.textContent || '')
        .find((content) => content.includes('video-rtc.js'));

      return {
        localAssetUrls,
        allVersioned: localAssetUrls.every((url) => url.includes('?v=')),
        inlineVideoImportVersioned: inlineVideoImport?.includes('video-rtc.js?v=') ?? false,
      };
    });

    expect(assetInfo.localAssetUrls.length).toBeGreaterThan(0);
    expect(assetInfo.allVersioned).toBe(true);
    expect(assetInfo.inlineVideoImportVersioned).toBe(true);

    // No camera is configured on an emulated printer, so the client must not try to
    // bootstrap a stream.
    expect(requestedPaths).not.toContain('/api/camera/proxy-config');

    expect(consoleMessages).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('icon name was not found'),
        expect.stringContaining('No camera URL provided by server'),
        expect.stringContaining('No WebSocket URL provided for camera stream'),
      ])
    );
  });

  test('serves every referenced asset without a stale or missing file', async ({ page }) => {
    const failures: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
      }
    });

    await signIn(page, webui);
    await expect(page.locator('#connection-text')).toHaveText('Connected');

    // A 404 on a versioned asset is exactly the stale-build symptom this suite guards,
    // and against the real static middleware it is now observable.
    expect(failures, `the WebUI requested resources the server could not serve:\n${failures.join('\n')}`).toEqual([]);
  });

  test('switches printer contexts through the built WebUI', async ({ page }) => {
    const token = await apiToken(webui);

    // The app makes the last printer it connected active, so the target has to be chosen
    // from the live state. Switching to whichever one is already active would pass without
    // proving anything.
    const before = await fetchContexts(webui, token);
    expect(before.contexts.length, 'this test needs two connected printers').toBeGreaterThanOrEqual(2);

    const target = before.contexts.find((context) => !context.isActive);
    expect(target, 'expected an inactive context to switch to').toBeTruthy();

    await signIn(page, webui);

    const selector = page.locator('#printer-select');
    await expect(selector).toBeVisible();

    // Every real context must be offered.
    const optionLabels = (await selector.locator('option').allTextContents()).join(' ');
    for (const printer of webui.printers) {
      expect(optionLabels, `the selector should list ${printer.machineName}`).toContain(printer.machineName);
    }

    await selector.selectOption(target!.id);

    // Assert against the server's own view of the active context, not the dropdown's
    // rendering: a selector that updates locally while the switch never reaches the app is
    // exactly the regression worth catching.
    await expect
      .poll(async () => (await fetchContexts(webui, token)).activeContextId, { timeout: 15_000 })
      .toBe(target!.id);

    const after = await fetchContexts(webui, token);
    expect(after.contexts.filter((context) => context.isActive)).toHaveLength(1);
  });
});
