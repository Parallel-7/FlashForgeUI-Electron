/**
 * @fileoverview Upload coverage, including the material matching dialog rules.
 *
 * This is the regression net for the 1.0.5-alpha.10 hotfix: pressing OK in the job
 * uploader threw ReferenceError: isAD5X is not defined and silently uploaded nothing.
 * A test that only checked the dialog rendered would have missed it - the failure was
 * in the confirm handler - so every case here confirms the file actually landed on
 * the printer via /gcodeList.
 *
 * Safety: uploads always run with Start Now explicitly unchecked, and every upload is
 * followed by assertNotPrinting(), which cancels and clears the platform if a print
 * ever started. That path should never fire; if it does the test fails loudly.
 *
 * Material matching rules under test:
 * - any 3MF + material-station printer (AD5X) -> dialog appears, mapping required
 * - multi-filament file + 5M-series printer   -> dialog must NOT appear
 *
 * Note that on a material-station printer the dialog is not reserved for multi-colour
 * files: the uploader raises it for every 3MF, single filament included, because each
 * tool still has to be bound to a physical slot before the firmware can print.
 */

import { expect, test } from '@playwright/test';
import { JobUploaderDialog, MaterialMatchingDialog, stubFileDialog } from '../pages/job-dialogs';
import { MainWindow } from '../pages/main-window';
import { closeFFUI, launchFFUI, type LaunchedApp } from '../support/electron-app';
import { PRINT_FIXTURES, resolveFixture, simplestFixtureFor } from '../support/fixtures';
import { assertNotPrinting } from '../support/printer-client';
import type { PrinterTarget } from '../support/printer-target';
import { describeTrackSkipReason, getTrack, listTargetDescriptors } from '../support/track';

const descriptors = listTargetDescriptors();
const skipReason = describeTrackSkipReason(descriptors);

test.describe(`job upload (${getTrack()} track)`, () => {
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

        // Uploads land on a real printer's filesystem and would otherwise accumulate
        // with every run. Best-effort: a cleanup failure must not mask a test result.
        for (const fixture of [PRINT_FIXTURES.ad5xSingleTool, PRINT_FIXTURES.adventurer5mSingleColor]) {
          await target?.removeUploadedFile(fixture.remoteName).catch(() => {
            // File was never uploaded, or the printer has no SFTP - nothing to clean.
          });
        }
      });

      test('uploads a file without starting a print', async () => {
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

        expect(await uploader.getSelectedFileName()).toContain(fixture.fileName);

        // On a material-station printer every 3MF must be mapped to slots first, and
        // the OK button stays disabled until that mapping is confirmed.
        if (descriptor.hasMaterialStation) {
          const materialDialog = await MaterialMatchingDialog.waitFor(app.electronApp);
          for (let toolId = 0; toolId < fixture.toolCount; toolId += 1) {
            await materialDialog.assignToolToFirstAvailableSlot(toolId);
          }
          await materialDialog.confirm();
        }

        await uploader.ensureStartNowUnchecked();
        expect(await uploader.isConfirmEnabled(), 'OK should be enabled once the job is ready').toBe(true);

        await uploader.confirm();
        await uploader.waitForUploadToComplete(app.electronApp);

        // The real assertion: the printer has the file. This is what the alpha.9
        // ReferenceError broke while the UI still looked like it had worked.
        expect(
          await target.waitForUploadedFile(fixture.remoteName),
          `${fixture.remoteName} should be present on the printer after upload`
        ).toBe(true);

        const safety = await assertNotPrinting(target.client);
        if (safety.notes.length > 0) {
          console.warn(safety.notes.join('\n'));
        }
        expect(safety.wasPrinting, `a print started despite Start Now being unchecked: ${safety.notes.join(' ')}`).toBe(
          false
        );

        app.assertNoRendererErrors();
      });

      test('shows the material matching dialog only on material-station printers', async () => {
        const fixture = PRINT_FIXTURES.ad5xMultiTool;

        app = await launchFFUI({ seededPrinters: [target.toSeededPrinter()] });
        const mainWindow = new MainWindow(app.mainWindow, app.electronApp);

        await mainWindow.waitForConnectedPrinters(1);
        await mainWindow.expectDashboardVisible();
        await mainWindow.waitForControlsReady();

        await stubFileDialog(app.electronApp, resolveFixture(fixture));
        await mainWindow.openJobUploader();

        const uploader = await JobUploaderDialog.waitFor(app.electronApp);
        await uploader.browseForFile();

        const materialDialog = await MaterialMatchingDialog.findOptional(app.electronApp, 10_000);

        if (descriptor.hasMaterialStation) {
          expect(materialDialog, 'AD5X / Creator 5 should raise the material matching dialog').not.toBeNull();

          // One requirement row per filament the slicer recorded.
          await expect
            .poll(async () => await materialDialog?.getRequirementCount(), { timeout: 10_000 })
            .toBe(fixture.toolCount);

          await materialDialog?.cancel();
        } else {
          // 5M-series and legacy printers have no material station, so mapping tools to
          // slots is meaningless and the dialog must never appear.
          expect(materialDialog, '5M-series printers should not raise the material matching dialog').toBeNull();
          await uploader.cancel();
        }

        app.assertNoRendererErrors();
      });
    });
  }
});
