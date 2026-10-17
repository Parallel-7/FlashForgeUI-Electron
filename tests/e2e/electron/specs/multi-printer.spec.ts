/**
 * @fileoverview Multi-printer coverage: two printers connected at once, each in its
 * own context.
 *
 * Multi-context is where cross-talk bugs hide - one printer's polling updating another
 * printer's tab, or a context switch leaving the dashboard showing stale data. The
 * check that matters is that both tabs report connected simultaneously and that each
 * tab carries its own printer's name.
 *
 * This follows the real user flow rather than a shortcut. With more than one saved
 * printer the app does not silently connect them all: it raises the auto-connect
 * choice dialog, the user picks one, and the second is added afterwards with the "+"
 * tab button. Seeding two printers and waiting for two tabs would simply hang.
 */

import { expect, test } from '@playwright/test';
import {
  AutoConnectChoiceDialog,
  CheckCodePrompt,
  ConnectChoiceDialog,
  DiscoveryTable,
  dismissConnectedWarningIfPresent,
} from '../pages/connect-dialogs';
import { MainWindow } from '../pages/main-window';
import { closeFFUI, launchFFUI, type LaunchedApp } from '../support/electron-app';
import type { PrinterTarget } from '../support/printer-target';
import { describeTrackSkipReason, getTrack, listMultiPrinterDescriptors } from '../support/track';

const descriptors = listMultiPrinterDescriptors();
const skipReason = describeTrackSkipReason(descriptors);
const hasTwoPrinters = descriptors.length >= 2;

test.describe(`multi-printer contexts (${getTrack()} track)`, () => {
  test.skip(skipReason !== null, skipReason ?? '');
  test.skip(!hasTwoPrinters, 'Multi-printer coverage needs at least two printers on this track.');

  const targets: PrinterTarget[] = [];
  let app: LaunchedApp;

  test.beforeAll(async () => {
    for (const descriptor of descriptors.slice(0, 2)) {
      targets.push(await descriptor.create());
    }
  });

  test.afterAll(async () => {
    for (const target of targets) {
      await target.dispose();
    }
  });

  test.afterEach(async () => {
    if (app) {
      await closeFFUI(app);
    }
  });

  test('connects two printers into separate contexts', async () => {
    const [first, second] = targets;

    app = await launchFFUI({ seededPrinters: targets.map((target) => target.toSeededPrinter()) });
    const mainWindow = new MainWindow(app.mainWindow, app.electronApp);

    // Two saved printers means the app asks which one to start with. Depending on what
    // discovery turns up that is either the auto-connect choice dialog or the saved
    // printer table, so handle whichever appears rather than assuming one.
    const autoConnectChoice = await AutoConnectChoiceDialog.findOptional(app.electronApp, 10_000);
    if (autoConnectChoice) {
      await autoConnectChoice.connectToLastUsed();
    } else {
      const savedTable = await DiscoveryTable.waitFor(app.electronApp, 20_000);
      await savedTable.connectTo(first.serialNumber);
    }

    const firstPrompt = await CheckCodePrompt.findOptional(app.electronApp, 5_000);
    if (firstPrompt) {
      await firstPrompt.submit(first.checkCode);
    }

    await mainWindow.waitForConnectedPrinters(1);
    await mainWindow.expectDashboardVisible();

    // Add the second printer the way a user would.
    const alreadyConnected = await mainWindow.getTabNames();
    const pending = alreadyConnected.some((name) => name.includes(first.toSeededPrinter().Name)) ? second : first;

    await mainWindow.addPrinterTab();

    // With a printer already connected, "+" first raises a warning explaining that a
    // second connection is about to be opened. It must be acknowledged before any
    // connect UI appears.
    await dismissConnectedWarningIfPresent(app.electronApp, 10_000);

    // "+" then lands on whichever entry point the app considers most useful given what
    // is saved and discoverable, so accept any of them and steer to the printer table.
    const savedTable = await DiscoveryTable.findOptional(app.electronApp, 8_000);
    if (!savedTable) {
      const connectChoice = await ConnectChoiceDialog.waitFor(app.electronApp);
      await connectChoice.chooseScanNetwork();
    }

    const discoveryTable = savedTable ?? (await DiscoveryTable.waitFor(app.electronApp));
    await discoveryTable.connectTo(pending.serialNumber);
    await dismissConnectedWarningIfPresent(app.electronApp);

    const prompt = await CheckCodePrompt.findOptional(app.electronApp, 5_000);
    if (prompt) {
      await prompt.submit(pending.checkCode);
    }

    await mainWindow.waitForConnectedPrinters(2);

    const tabNames = (await mainWindow.getTabNames()).join(' ');
    for (const target of targets) {
      expect(tabNames, `expected a tab for ${target.label}`).toContain(target.toSeededPrinter().Name);
    }

    app.assertNoRendererErrors();
  });
});
