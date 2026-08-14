/**
 * @fileoverview Creator 5 series capability-gating coverage.
 *
 * Creator 5 / Creator 5 Pro firmware neither sends nor accepts material
 * mappings over the local API, so starting a previously-uploaded local or
 * recent job dead-ends at material selection. The renderer disables those
 * entry points for the series (commit 58717fb) while every other model keeps
 * them. This spec pins that contract down per target so a regression fails
 * loudly instead of shipping a dead-end button.
 *
 * It also pins the HTTP-only side effect: raw G-code entry points (Home Axes)
 * stay disabled for the series because the printers expose no TCP/G-code
 * passthrough.
 */

import { expect, test } from '@playwright/test';
import { MainWindow } from '../pages/main-window';
import { closeFFUI, type LaunchedApp, launchFFUI } from '../support/electron-app';
import type { PrinterTarget } from '../support/printer-target';
import { describeTrackSkipReason, getTrack, listTargetDescriptors } from '../support/track';

const descriptors = listTargetDescriptors();
const skipReason = describeTrackSkipReason(descriptors);

const LOCAL_JOB_UNAVAILABLE_MESSAGE = 'Local job management is not available on this printer.';

const isCreator5Series = (target: PrinterTarget): boolean =>
  target.manualConnectType === 'creator-5' || target.manualConnectType === 'creator-5-pro';

test.describe(`creator 5 capability gating (${getTrack()} track)`, () => {
  test.skip(skipReason !== null, skipReason ?? '');

  for (const descriptor of descriptors) {
    test.describe(descriptor.label, () => {
      let target: PrinterTarget;
      let app: LaunchedApp;

      test.beforeAll(async () => {
        target = await descriptor.create();
      });

      test.afterAll(async () => {
        await target?.dispose();
      });

      test.afterEach(async () => {
        if (app) {
          await closeFFUI(app);
        }
      });

      test('gates local and recent job start for the Creator 5 series only', async () => {
        app = await launchFFUI({ seededPrinters: [target.toSeededPrinter()] });
        const mainWindow = new MainWindow(app.mainWindow, app.electronApp);

        await mainWindow.waitForConnectedPrinters(1);
        await mainWindow.expectDashboardVisible();
        await mainWindow.waitForControlsReady();

        const recentButton = app.mainWindow.locator('#btn-start-recent');
        const localButton = app.mainWindow.locator('#btn-start-local');

        if (isCreator5Series(target)) {
          await expect(recentButton, 'recent job start must be disabled on the Creator 5 series').toBeDisabled();
          await expect(localButton, 'local job start must be disabled on the Creator 5 series').toBeDisabled();
          await expect(recentButton).toHaveAttribute('title', `Disabled: ${LOCAL_JOB_UNAVAILABLE_MESSAGE}`);
          await expect(localButton).toHaveAttribute('title', `Disabled: ${LOCAL_JOB_UNAVAILABLE_MESSAGE}`);
        } else {
          await expect(recentButton, 'recent job start must stay available on other models').toBeEnabled();
          await expect(localButton, 'local job start must stay available on other models').toBeEnabled();
        }

        app.assertNoRendererErrors();
      });

      test('keeps raw G-code entry points disabled on HTTP-only models', { tag: '@creator5' }, async () => {
        test.skip(!isCreator5Series(target), 'Home Axes gating only applies to HTTP-only Creator 5 models.');

        app = await launchFFUI({ seededPrinters: [target.toSeededPrinter()] });
        const mainWindow = new MainWindow(app.mainWindow, app.electronApp);

        await mainWindow.waitForConnectedPrinters(1);
        await mainWindow.expectDashboardVisible();
        await mainWindow.waitForControlsReady();

        const homeAxesButton = app.mainWindow.locator('#btn-home-axes');
        await expect(
          homeAxesButton,
          'Home Axes is raw G-code and must stay disabled without a TCP channel'
        ).toBeDisabled();
        await expect(homeAxesButton).toHaveAttribute('title', /Disabled: G-code unavailable/);

        app.assertNoRendererErrors();
      });
    });
  }
});
