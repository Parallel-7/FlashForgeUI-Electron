/**
 * @fileoverview LED control coverage: on -> off -> on.
 *
 * Every assertion reads lightStatus back from the printer's own /detail endpoint
 * rather than inspecting the button's rendered state. A button that toggles its own
 * styling while the command never reaches the printer is precisely the failure this
 * is meant to catch, so trusting the UI here would defeat the purpose.
 *
 * The cycle ends with the LED back on, which is the state a user leaves a printer in.
 */

import { expect, test } from '@playwright/test';
import { MainWindow } from '../pages/main-window';
import { closeFFUI, launchFFUI, type LaunchedApp } from '../support/electron-app';
import type { PrinterTarget } from '../support/printer-target';
import { describeTrackSkipReason, getTrack, listTargetDescriptors } from '../support/track';

const descriptors = listTargetDescriptors();
const skipReason = describeTrackSkipReason(descriptors);

test.describe(`LED control (${getTrack()} track)`, () => {
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

      test('cycles the LED on, off, and back on', async () => {
        app = await launchFFUI({ seededPrinters: [target.toSeededPrinter()] });
        const mainWindow = new MainWindow(app.mainWindow, app.electronApp);

        await mainWindow.waitForConnectedPrinters(1);
        await mainWindow.expectDashboardVisible();
        await mainWindow.waitForControlsReady();

        // Start from a known state so the first assertion cannot pass by accident.
        await target.client.setLight('close');
        expect(await target.client.waitForLightStatus('close')).toBe(true);

        await mainWindow.clickLedOn();
        expect(await target.client.waitForLightStatus('open'), 'LED should report open after clicking on').toBe(true);

        await mainWindow.clickLedOff();
        expect(await target.client.waitForLightStatus('close'), 'LED should report close after clicking off').toBe(
          true
        );

        await mainWindow.clickLedOn();
        expect(await target.client.waitForLightStatus('open'), 'LED should report open again').toBe(true);

        app.assertNoRendererErrors();
      });
    });
  }
});
