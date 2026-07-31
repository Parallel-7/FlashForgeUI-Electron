/**
 * @fileoverview Browser coverage for the WebUI authentication flow against the real server.
 *
 * Every assertion here runs against the app's own AuthManager and auth middleware, so a
 * rejected password, an issued token, and a revoked one are all real. The previous fixture
 * handed out a hard-coded token string and the test asserted that exact string, which
 * proved only that the fixture agreed with itself.
 */

import { expect, test } from '@playwright/test';
import {
  describeHeadlessSkipReason,
  type HeadlessWebUI,
  startHeadlessWebUI,
  WEBUI_TEST_PASSWORD,
} from './helpers/headless-webui';

const skipReason = describeHeadlessSkipReason();

test.describe('WebUI authentication', () => {
  test.skip(skipReason !== null, skipReason ?? '');

  let webui: HeadlessWebUI;

  test.beforeAll(async () => {
    webui = await startHeadlessWebUI();
  });

  test.afterAll(async () => {
    await webui?.stop();
  });

  test('rejects a bad password and keeps the UI locked', async ({ page }) => {
    await page.goto(webui.baseUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#login-screen')).toBeVisible();
    await expect(page.locator('#main-ui')).toBeHidden();

    await page.fill('#password-input', 'definitely-not-the-password');
    await page.click('#login-button');

    // The real AuthManager rejects this, so the app must stay on the login screen.
    await expect(page.locator('#main-ui')).toBeHidden();
    await expect(page.locator('#login-screen')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('webui-token'))).toBeNull();
  });

  test('logs in, persists the remembered token, and authenticates the websocket', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning' || message.type() === 'error') {
        consoleMessages.push(message.text());
      }
    });

    await page.goto(webui.baseUrl, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#login-screen')).toBeVisible();

    await page.fill('#password-input', WEBUI_TEST_PASSWORD);
    await page.check('#remember-me-checkbox');
    await page.click('#login-button');

    await expect(page.locator('#main-ui')).toBeVisible();
    await expect(page.locator('#login-screen')).toBeHidden();

    // "Connected" only appears once the websocket handshake passed the real auth gate,
    // so this doubles as the assertion that the token authenticated the socket.
    await expect(page.locator('#connection-text')).toHaveText('Connected');

    const storedToken = await page.evaluate(() => localStorage.getItem('webui-token'));
    expect(storedToken, 'a real token should be persisted for "remember me"').toBeTruthy();

    // The token has to be accepted by the real auth middleware, not just stored.
    const authorized = await fetch(`${webui.baseUrl}/api/contexts`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    });
    expect(authorized.status).toBe(200);

    expect(consoleMessages).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('icon name was not found'),
        expect.stringContaining('No camera URL provided by server'),
        expect.stringContaining('No WebSocket URL provided for camera stream'),
      ])
    );
  });

  test('restores the session from the remembered token without asking again', async ({ page }) => {
    await page.goto(webui.baseUrl, { waitUntil: 'domcontentloaded' });
    await page.fill('#password-input', WEBUI_TEST_PASSWORD);
    await page.check('#remember-me-checkbox');
    await page.click('#login-button');
    await expect(page.locator('#main-ui')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });

    // A remembered token must carry the reload with no second login prompt.
    await expect(page.locator('#main-ui')).toBeVisible();
    await expect(page.locator('#login-screen')).toBeHidden();
    await expect(page.locator('#connection-text')).toHaveText('Connected');
  });

  test('refuses API access without a valid token', async () => {
    const anonymous = await fetch(`${webui.baseUrl}/api/contexts`);
    expect(anonymous.status, 'protected routes must reject anonymous callers').toBe(401);

    const bogus = await fetch(`${webui.baseUrl}/api/contexts`, {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(bogus.status, 'protected routes must reject a forged token').toBe(401);
  });

  test('revokes the token on logout', async () => {
    const loginResponse = await fetch(`${webui.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: WEBUI_TEST_PASSWORD }),
    });
    const { token } = (await loginResponse.json()) as { token: string };

    expect((await fetch(`${webui.baseUrl}/api/contexts`, { headers: { Authorization: `Bearer ${token}` } })).status)
      .toBe(200);

    await fetch(`${webui.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    // A token that survives logout is a real security bug; the fixture could never
    // have caught it because it never implemented revocation.
    expect(
      (await fetch(`${webui.baseUrl}/api/contexts`, { headers: { Authorization: `Bearer ${token}` } })).status,
      'a logged-out token must stop working'
    ).toBe(401);
  });
});
