/**
 * @fileoverview Live Electron Playwright smoke test for launching FlashForgeUI against
 * the real local environment and verifying connected desktop UI rendering.
 */

import path from 'node:path';
import { type ElectronApplication, _electron as electron, expect, type Page, test } from '@playwright/test';

const LIVE_FLAG = 'FFUI_E2E_LIVE';

async function resolveMainWindow(electronApp: ElectronApplication): Promise<Page> {
  const firstWindow = await electronApp.firstWindow();
  if ((await firstWindow.locator('#btn-main-menu').count()) > 0) {
    return firstWindow;
  }

  for (const page of electronApp.windows()) {
    if ((await page.locator('#btn-main-menu').count()) > 0) {
      return page;
    }
  }

  throw new Error('Unable to find main application window');
}

test.describe('electron desktop smoke', () => {
  test.skip(
    !process.env[LIVE_FLAG],
    `Set ${LIVE_FLAG}=1 to run live Electron desktop smoke tests against your local environment`
  );

  test('launches FFUI, auto-connects, and renders connected UI elements', async () => {
    test.skip(process.platform !== 'win32', 'This live smoke test currently targets Windows environments');

    const electronApp = await electron.launch({
      args: ['.'],
      cwd: process.cwd(),
      timeout: 120_000,
    });

    try {
      const userDataPath = await electronApp.evaluate(async ({ app }) => app.getPath('userData'));
      const expectedUserDataPath = process.env.APPDATA ? path.join(process.env.APPDATA, 'FlashForgeUI') : null;

      if (expectedUserDataPath) {
        expect(userDataPath.toLowerCase()).toBe(expectedUserDataPath.toLowerCase());
      }

      const mainWindow = await resolveMainWindow(electronApp);

      await expect(mainWindow.locator('.title')).toHaveText('FlashForgeUI');
      await expect(mainWindow.locator('#btn-main-menu')).toBeVisible();
      await expect(mainWindow.locator('#printer-tabs-container .printer-tab.status-connected').first()).toBeVisible({
        timeout: 150_000,
      });
      await expect(mainWindow.locator('#printer-tabs-container .printer-tab .tab-name').first()).not.toHaveText('');
      await expect(mainWindow.locator('#grid-placeholder')).toBeHidden();
      await expect(mainWindow.locator('.grid-stack')).toBeVisible();
    } finally {
      await electronApp.close();
    }
  });
});
