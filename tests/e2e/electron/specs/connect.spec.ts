/**
 * @fileoverview Connection coverage: saved-printer auto-connect, network discovery,
 * and the manual connect form.
 *
 * Runs against whichever track FFUI_E2E_TRACK selects, so the same assertions cover
 * emulated printers in CI and real printers on a bench.
 *
 * The manual connect case is the one that matters most here. Since 1.0.5-alpha.9 a
 * named printer type skips the TCP probe, which means the form has to supply the
 * serial and check code the discovery broadcast would have carried - and the check
 * code it collects must be used directly, with no second prompt. That regression is
 * exactly what this spec pins down.
 */

import { expect, test } from '@playwright/test';
import {
  CheckCodePrompt,
  ConnectChoiceDialog,
  DiscoveryTable,
  dismissConnectedWarningIfPresent,
  ManualConnectDialog,
} from '../pages/connect-dialogs';
import { MainWindow } from '../pages/main-window';
import { closeFFUI, launchFFUI, type LaunchedApp } from '../support/electron-app';
import type { PrinterTarget } from '../support/printer-target';
import { describeTrackSkipReason, getTrack, listTargetDescriptors } from '../support/track';

const descriptors = listTargetDescriptors();
const skipReason = describeTrackSkipReason(descriptors);

test.describe(`connect (${getTrack()} track)`, () => {
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

      test('connects automatically to a saved printer', async () => {
        app = await launchFFUI({ seededPrinters: [target.toSeededPrinter()] });
        const mainWindow = new MainWindow(app.mainWindow, app.electronApp);

        await mainWindow.waitForConnectedPrinters(1);
        await mainWindow.expectDashboardVisible();

        const tabNames = await mainWindow.getTabNames();
        expect(tabNames.join(' ')).toContain(target.toSeededPrinter().Name);

        app.assertNoRendererErrors();
      });

      test('finds the printer through network discovery and connects', async () => {
        app = await launchFFUI();
        const mainWindow = new MainWindow(app.mainWindow, app.electronApp);

        await mainWindow.openConnectFlow();
        const connectChoice = await ConnectChoiceDialog.waitFor(app.electronApp);
        await connectChoice.chooseScanNetwork();

        const discoveryTable = await DiscoveryTable.waitFor(app.electronApp);
        // Match on serial: it is the only identity that survives a DHCP lease change,
        // and other printers may legitimately be on the same network.
        await discoveryTable.connectTo(target.serialNumber);

        const prompt = await CheckCodePrompt.findOptional(app.electronApp, 5_000);
        if (prompt) {
          await prompt.submit(target.checkCode);
        }

        await mainWindow.waitForConnectedPrinters(1);
        await mainWindow.expectDashboardVisible();

        app.assertNoRendererErrors();
      });

      test('connects through the manual connect form without prompting twice for the check code', async () => {
        test.skip(
          !descriptor.supportsManualConnect,
          'Manual connect always dials the firmware default ports (8899/8898); this emulator instance runs on alternate ports so only one instance per machine can be reached this way.'
        );

        app = await launchFFUI();
        const mainWindow = new MainWindow(app.mainWindow, app.electronApp);

        await mainWindow.openConnectFlow();
        const connectChoice = await ConnectChoiceDialog.waitFor(app.electronApp);
        await connectChoice.chooseEnterIp();

        const manualConnect = await ManualConnectDialog.waitFor(app.electronApp);

        // Modern types must ask for credentials; legacy must not.
        expect(await manualConnect.requiresCredentials()).toBe(target.manualConnectType !== 'legacy');

        await manualConnect.fill({
          ipAddress: target.ipAddress,
          type: target.manualConnectType,
          serialNumber: target.serialNumber,
          checkCode: target.checkCode,
        });
        await manualConnect.submit();

        await dismissConnectedWarningIfPresent(app.electronApp);

        // The form already collected the check code, so a second prompt is a regression.
        const duplicatePrompt = await CheckCodePrompt.findOptional(app.electronApp, 4_000);
        expect(duplicatePrompt, 'manual connect should not prompt for the check code twice').toBeNull();

        await mainWindow.waitForConnectedPrinters(1);
        await mainWindow.expectDashboardVisible();

        app.assertNoRendererErrors();
      });
    });
  }
});
