/**
 * @fileoverview Page objects for the job uploader, material matching, and file manager dialogs.
 *
 * File selection needs special handling: the uploader's Browse button calls
 * dialog.showOpenDialog() in the main process, which opens a native OS window that
 * Playwright cannot drive. stubFileDialog() replaces that method for the lifetime of
 * the app so Browse resolves straight to a fixture path.
 *
 * Key exports:
 * - stubFileDialog(): make native Browse return a chosen path
 * - JobUploaderDialog: file selection, Start Now / auto-level checkboxes, confirm
 * - MaterialMatchingDialog: the multi-tool mapping dialog (AD5X / Creator 5 only)
 * - FileManagerDialog: SFTP browse + delete
 */

import { type ElectronApplication, expect, type Page } from '@playwright/test';
import { findWindowWithSelector, waitForWindowWithSelector } from '../support/electron-app';

/**
 * Forces the main process's native open-file dialog to return `filePath`.
 *
 * Playwright drives renderer DOM only; a native dialog would block the run forever.
 * Patching in the main process is the supported way around that.
 */
export const stubFileDialog = async (electronApp: ElectronApplication, filePath: string): Promise<void> => {
  await electronApp.evaluate(async ({ dialog }, chosenPath) => {
    // Deliberately overriding the Electron API for the test run.
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosenPath] });
  }, filePath);
};

/** Makes the native open-file dialog behave as if the user cancelled. */
export const stubFileDialogCancelled = async (electronApp: ElectronApplication): Promise<void> => {
  await electronApp.evaluate(async ({ dialog }) => {
    // Deliberately overriding the Electron API for the test run.
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  });
};

export class JobUploaderDialog {
  constructor(readonly page: Page) {}

  static async waitFor(electronApp: ElectronApplication, timeoutMs = 20_000): Promise<JobUploaderDialog> {
    const page = await waitForWindowWithSelector(electronApp, '#btn-browse', timeoutMs);
    return new JobUploaderDialog(page);
  }

  /** Clicks Browse (resolved by the stub) and waits for metadata parsing to finish. */
  async browseForFile(timeoutMs = 60_000): Promise<void> {
    await this.page.locator('#btn-browse').click();
    await expect(this.page.locator('#loading-overlay')).toBeHidden({ timeout: timeoutMs });
  }

  async getSelectedFileName(): Promise<string> {
    return ((await this.page.locator('#file-path-display').textContent()) ?? '').trim();
  }

  /**
   * Guarantees Start Now is unchecked.
   *
   * This is the safety gate for every upload in the suite: with it unchecked the app
   * only transfers the file. Asserting rather than assuming means a changed default
   * fails the test instead of quietly heating a real printer.
   */
  async ensureStartNowUnchecked(): Promise<void> {
    const checkbox = this.page.locator('#cb-start-now');
    if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
    await expect(checkbox).not.toBeChecked();
  }

  async setAutoLevel(enabled: boolean): Promise<void> {
    const checkbox = this.page.locator('#cb-auto-level');
    if ((await checkbox.isChecked()) !== enabled) {
      await checkbox.setChecked(enabled);
    }
  }

  async isConfirmEnabled(): Promise<boolean> {
    return await this.page.locator('#btn-ok').isEnabled();
  }

  async confirm(): Promise<void> {
    const okButton = this.page.locator('#btn-ok');
    await expect(okButton).toBeEnabled();
    await okButton.click();
  }

  async cancel(): Promise<void> {
    await this.page.locator('#btn-cancel').click();
  }

  async getPrinterModelMeta(): Promise<string> {
    return ((await this.page.locator('#meta-printer').textContent()) ?? '').trim();
  }

  /**
   * Waits for the upload to finish.
   *
   * Success is signalled by the dialog window closing: the renderer shows
   * "Successfully uploaded <file>" in the progress overlay and then self-closes after
   * ~2s. The overlay is therefore still visible at the moment of success, so waiting
   * for it to hide would hang until the timeout.
   *
   * Failure keeps the window open and writes the reason into #progress-status, which
   * is surfaced here so a failed upload reports why instead of just timing out.
   */
  async waitForUploadToComplete(electronApp: ElectronApplication, timeoutMs = 180_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (this.page.isClosed()) {
        return;
      }

      const status = await this.page
        .locator('#progress-status')
        .textContent()
        .catch(() => null);

      if (status && /upload failed/i.test(status)) {
        throw new Error(`Upload reported failure: ${status.trim()}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const lastStatus = await this.page
      .locator('#progress-status')
      .textContent()
      .catch(() => null);
    throw new Error(
      `Upload did not complete within ${timeoutMs}ms (last status: ${lastStatus?.trim() ?? 'unknown'})`
    );
  }
}

export class MaterialMatchingDialog {
  constructor(readonly page: Page) {}

  /** Waits for the dialog, which only ever appears for material-station printers. */
  static async waitFor(electronApp: ElectronApplication, timeoutMs = 30_000): Promise<MaterialMatchingDialog> {
    const page = await waitForWindowWithSelector(electronApp, '#material-mappings', timeoutMs);
    return new MaterialMatchingDialog(page);
  }

  /**
   * Returns the dialog if it appears within the (short) timeout, else null.
   * Used for the negative assertion on 5M-series and legacy printers.
   */
  static async findOptional(
    electronApp: ElectronApplication,
    timeoutMs = 5_000
  ): Promise<MaterialMatchingDialog | null> {
    const page = await findWindowWithSelector(electronApp, '#material-mappings', timeoutMs);
    return page ? new MaterialMatchingDialog(page) : null;
  }

  async getRequirementCount(): Promise<number> {
    return await this.page.locator('.requirement-item').count();
  }

  /** Assigns a tool requirement to a specific material station slot. */
  async assignToolToSlot(toolId: number, slotId: number): Promise<void> {
    await this.#selectRequirement(toolId);

    const slot = this.page.locator(`.slot-item[data-slot-id="${slotId}"]:not(.disabled):not(.assigned)`).first();
    await expect(slot, `slot ${slotId} should be selectable for tool ${toolId}`).toBeVisible();
    await slot.click();
  }

  /**
   * Assigns a tool to whichever slot is currently selectable.
   *
   * Slot numbers are not interchangeable on real hardware: the dialog disables empty
   * slots and slots whose material does not match the tool, so which slot is usable
   * depends on what filament is physically loaded. On this bench's AD5X only slot 4
   * holds filament, so assuming slot 1 fails. Picking the first available slot is both
   * what a user does and portable across machines.
   */
  async assignToolToFirstAvailableSlot(toolId: number): Promise<number> {
    await this.#selectRequirement(toolId);

    const slot = this.page.locator('.slot-item:not(.disabled):not(.assigned)').first();
    await expect(slot, `no selectable material station slot for tool ${toolId}`).toBeVisible();

    const slotId = await slot.getAttribute('data-slot-id');
    await slot.click();

    return Number(slotId ?? 0);
  }

  async #selectRequirement(toolId: number): Promise<void> {
    const requirement = this.page.locator(`.requirement-item[data-tool-id="${toolId}"]`).first();
    await expect(requirement).toBeVisible();
    await requirement.click();
  }

  async confirm(): Promise<void> {
    const confirmButton = this.page.locator('#btn-confirm');
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();
  }

  async cancel(): Promise<void> {
    await this.page.locator('#btn-cancel').click();
  }
}

export class FileManagerDialog {
  constructor(readonly page: Page) {}

  static async waitFor(electronApp: ElectronApplication, timeoutMs = 60_000): Promise<FileManagerDialog> {
    const page = await waitForWindowWithSelector(electronApp, '#fm-grid', timeoutMs);
    return new FileManagerDialog(page);
  }

  /** Waits for the SFTP listing to finish loading. */
  async waitForListing(timeoutMs = 60_000): Promise<void> {
    await expect(this.page.locator('#fm-loading')).toBeHidden({ timeout: timeoutMs });
  }

  /**
   * Tiles are keyed by full remote path (e.g. /usr/data/gcodes/foo.3mf), so match on
   * the trailing path segment rather than requiring the spec to know the directory.
   */
  fileEntry(fileName: string) {
    return this.page.locator(`#fm-grid .fm-item[data-path$="/${fileName}"]`).first();
  }

  async hasFile(fileName: string): Promise<boolean> {
    return (await this.fileEntry(fileName).count()) > 0;
  }

  async refresh(): Promise<void> {
    await this.page.locator('#btn-refresh').click();
    await this.waitForListing();
  }

  /** Selects a file and deletes it, confirming the overlay prompt. */
  async deleteFile(fileName: string): Promise<void> {
    const entry = this.fileEntry(fileName);
    await expect(entry).toBeVisible();
    await entry.click();

    const deleteButton = this.page.locator('#btn-delete-selected');
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();

    const confirmOverlay = this.page.locator('#confirm-overlay');
    await expect(confirmOverlay).toBeVisible();
    await this.page.locator('#btn-confirm-delete').click();
    await expect(confirmOverlay).toBeHidden({ timeout: 30_000 });
  }

  async close(): Promise<void> {
    await this.page.locator('#btn-close-footer').click();
  }
}
