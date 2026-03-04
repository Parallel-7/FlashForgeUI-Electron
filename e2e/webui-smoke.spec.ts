import { expect, test } from '@playwright/test';
import { startWebUiFixtureServer, type WebUiFixtureServer } from './helpers/webui-fixture-server';

let server: WebUiFixtureServer;

test.beforeAll(async () => {
  server = await startWebUiFixtureServer();
});

test.afterAll(async () => {
  await server.close();
});

test('loads the built WebUI with versioned assets and without stale camera/icon errors', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      consoleMessages.push(message.text());
    }
  });

  await page.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#main-ui')).toBeVisible();
  await expect(page.locator('#login-screen')).toBeHidden();
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
  expect(server.requests).not.toContain('GET /api/camera/proxy-config');
  expect(consoleMessages).not.toEqual(
    expect.arrayContaining([
      expect.stringContaining('icon name was not found'),
      expect.stringContaining('No camera URL provided by server'),
      expect.stringContaining('No WebSocket URL provided for camera stream'),
    ])
  );
});

test('switches printer contexts through the built WebUI', async ({ page }) => {
  await server.close();
  server = await startWebUiFixtureServer({
    contexts: [
      {
        id: 'context-1',
        name: 'Fixture Printer 1',
        model: 'AD5M',
        ipAddress: '192.168.1.25',
        serialNumber: 'SN-1',
        isActive: true,
      },
      {
        id: 'context-2',
        name: 'Fixture Printer 2',
        model: 'AD5X',
        ipAddress: '192.168.1.26',
        serialNumber: 'SN-2',
        isActive: false,
      },
    ],
  });

  await page.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });

  const selector = page.locator('#printer-select');
  await expect(selector).toBeVisible();
  await selector.selectOption('context-2');

  await expect
    .poll(() => server.requests.filter((request) => request === 'POST /api/contexts/switch').length)
    .toBeGreaterThan(0);
  await expect
    .poll(() => server.requests.filter((request) => request === 'GET /api/contexts').length)
    .toBeGreaterThan(1);
});
