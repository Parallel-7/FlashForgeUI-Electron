import { expect, test } from '@playwright/test';
import { startWebUiFixtureServer, type WebUiFixtureServer } from './helpers/webui-fixture-server';

let server: WebUiFixtureServer;

test.beforeAll(async () => {
  server = await startWebUiFixtureServer({
    authRequired: true,
  });
});

test.afterAll(async () => {
  await server.close();
});

test('requires login, persists the remembered token, and authenticates the websocket', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      consoleMessages.push(message.text());
    }
  });

  await page.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#login-screen')).toBeVisible();
  await expect(page.locator('#main-ui')).toBeHidden();

  await page.fill('#password-input', 'secret');
  await page.check('#remember-me-checkbox');
  await page.click('#login-button');

  await expect(page.locator('#main-ui')).toBeVisible();
  await expect(page.locator('#login-screen')).toBeHidden();
  await expect(page.locator('#connection-text')).toHaveText('Connected');

  const storedToken = await page.evaluate(() => localStorage.getItem('webui-token'));

  expect(storedToken).toBe('fixture-token');
  expect(server.requests).toEqual(
    expect.arrayContaining([
      'GET /api/auth/status',
      'POST /api/auth/login',
      'GET /api/printer/features',
      'GET /api/contexts',
      'GET /api/spoolman/config',
      'UPGRADE /ws',
    ])
  );
  expect(consoleMessages).not.toEqual(
    expect.arrayContaining([
      expect.stringContaining('icon name was not found'),
      expect.stringContaining('No camera URL provided by server'),
      expect.stringContaining('No WebSocket URL provided for camera stream'),
    ])
  );
});
