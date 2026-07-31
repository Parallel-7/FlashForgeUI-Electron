/**
 * @fileoverview Full SFTP round-trip: upload a file through the GUI, see it in the
 * file manager, delete it there, and confirm it is gone.
 *
 * Hardware only. The emulator implements the printer HTTP/TCP APIs but runs no SSH
 * server, so there is nothing for the file manager to talk to on that track.
 *
 * This doubles as the cleanup for the upload specs: the test file those leave behind
 * is the file this one deletes. It therefore also proves the SSH/SFTP stack still
 * works end to end - credentials resolved from SSHSettingsService, connection pooled
 * per context, listing and delete both routed over SFTP.
 *
 * Requires FlashForge-EasySSH provisioning on the target printer (root/flashforge).
 */

import { expect, test } from '@playwright/test';
import { FileManagerDialog, JobUploaderDialog, MaterialMatchingDialog, stubFileDialog } from '../pages/job-dialogs';
import { MainWindow } from '../pages/main-window';
import { closeFFUI, launchFFUI, type LaunchedApp } from '../support/electron-app';
import { resolveFixture, simplestFixtureFor } from '../support/fixtures';
import { assertNotPrinting } from '../support/printer-client';
import type { PrinterTarget } from '../support/printer-target';
import { describeTrackSkipReason, getTrack, listTargetDescriptors } from '../support/track';

const descriptors = listTargetDescriptors().filter((descriptor) => descriptor.supportsSftp);
const skipReason = describeTrackSkipReason(listTargetDescriptors());

test.describe(`SFTP round-trip (${getTrack()} track)`, () => {
  test.skip(skipReason !== null, skipReason ?? '');
  test.skip(
    descriptors.length === 0,
    'No SFTP-capable printers on this track (the emulator has no SSH server; real printers need FlashForge-EasySSH).'
  );

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

      test('uploads a file, finds it over SFTP, deletes it, and confirms removal', async () => {
        const fixture = simplestFixtureFor(descriptor.hasMaterialStation);

        app = await launchFFUI({ seededPrinters: [target.toSeededPrinter()] });
        const mainWindow = new MainWindow(app.mainWindow, app.electronApp);

        await mainWindow.waitForConnectedPrinters(1);
        await mainWindow.expectDashboardVisible();
        await mainWindow.waitForControlsReady();

        await stubFileDialog(app.electronApp, resolveFixture(fixture));
        await mainWindow.openJobUploader();

        const uploader = await JobUploaderDialog.waitFor(app.electronApp);
        await uploader.browseForFile();

        // Material-station printers require every 3MF to be mapped to slots before the
        // uploader's OK button enables.
        if (descriptor.hasMaterialStation) {
          const materialDialog = await MaterialMatchingDialog.waitFor(app.electronApp);
          for (let toolId = 0; toolId < fixture.toolCount; toolId += 1) {
            await materialDialog.assignToolToFirstAvailableSlot(toolId);
          }
          await materialDialog.confirm();
        }

        await uploader.ensureStartNowUnchecked();
        await uploader.confirm();
        await uploader.waitForUploadToComplete(app.electronApp);

        expect(
          await target.waitForUploadedFile(fixture.remoteName),
          'file should be on the printer before the SFTP checks begin'
        ).toBe(true);

        const safety = await assertNotPrinting(target.client);
        if (safety.notes.length > 0) {
          console.warn(safety.notes.join('\n'));
        }
        expect(safety.wasPrinting, `a print started despite Start Now being unchecked: ${safety.notes.join(' ')}`).toBe(
          false
        );

        // Now the SFTP half: the file manager reads the printer's filesystem directly.
        // It is shortcut-only, and a fresh profile has no shortcuts pinned.
        await mainWindow.ensureShortcut('file-manager');
        await mainWindow.openShortcut('file-manager');
        const fileManager = await FileManagerDialog.waitFor(app.electronApp);
        await fileManager.waitForListing();

        expect(
          await fileManager.hasFile(fixture.remoteName),
          `${fixture.remoteName} should be listed by the SFTP file manager`
        ).toBe(true);

        await fileManager.deleteFile(fixture.remoteName);
        await fileManager.refresh();

        expect(
          await fileManager.hasFile(fixture.remoteName),
          `${fixture.remoteName} should be gone from the listing after delete`
        ).toBe(false);

        await fileManager.close();

        // Confirm against the printer itself, not just the dialog's own rendering.
        expect(
          await target.waitForUploadedFile(fixture.remoteName, 5_000),
          'the printer should no longer report the deleted file'
        ).toBe(false);

        app.assertNoRendererErrors();
      });
    });
  }
});
