/**
 * @fileoverview Page objects for the printer connection flow dialogs.
 *
 * Covers the connect-choice dialog, the network scan/discovery table, the
 * manual connect form introduced in 1.0.5-alpha.9, and the generic check-code
 * input prompt.
 *
 * The manual connect form is what broke the previous suite: "Enter IP" used to open
 * a single-field prompt (#dialog-input / #dialog-ok), and now opens a full form
 * (#input-ip / #input-type / #input-serial / #input-check-code / #dialog-connect).
 * Because a named printer type skips the TCP probe, the form must supply the serial
 * and check code that a discovery broadcast would otherwise have provided.
 *
 * Key exports:
 * - ConnectChoiceDialog: scan-network vs enter-IP branch
 * - ManualConnectDialog: the alpha.9 form
 * - DiscoveryTable: the scan results list
 * - CheckCodePrompt: the generic input dialog
 */

import { type ElectronApplication, expect, type Page } from '@playwright/test';
import { findWindowWithSelector, waitForWindowWithSelector } from '../support/electron-app';

/** Values accepted by the manual connect type dropdown (see shared/types/manual-connect.ts). */
export type ManualConnectType =
  | 'adventurer-5m'
  | 'adventurer-5m-pro'
  | 'ad5x'
  | 'creator-5'
  | 'creator-5-pro'
  | 'legacy';

export class ConnectChoiceDialog {
  constructor(readonly page: Page) {}

  static async waitFor(electronApp: ElectronApplication, timeoutMs = 20_000): Promise<ConnectChoiceDialog> {
    const page = await waitForWindowWithSelector(electronApp, '#btn-scan-network', timeoutMs);
    return new ConnectChoiceDialog(page);
  }

  async chooseScanNetwork(): Promise<void> {
    await this.page.locator('#btn-scan-network').click();
  }

  async chooseEnterIp(): Promise<void> {
    await this.page.locator('#btn-enter-ip').click();
  }
}

/**
 * Shown at startup when the saved profile holds more than one printer.
 *
 * A single saved printer auto-connects silently; two or more make the app ask which
 * one to use, which is why multi-printer runs have to drive this and single-printer
 * ones never see it.
 */
export class AutoConnectChoiceDialog {
  constructor(readonly page: Page) {}

  static async findOptional(
    electronApp: ElectronApplication,
    timeoutMs = 10_000
  ): Promise<AutoConnectChoiceDialog | null> {
    const page = await findWindowWithSelector(electronApp, '#btn-connect-last-used', timeoutMs);
    return page ? new AutoConnectChoiceDialog(page) : null;
  }

  async connectToLastUsed(): Promise<void> {
    await this.page.locator('#btn-connect-last-used').click();
  }

  async showAllSavedPrinters(): Promise<void> {
    await this.page.locator('#btn-show-saved-printers').click();
  }

  async cancel(): Promise<void> {
    await this.page.locator('#btn-cancel').click();
  }
}

export class ManualConnectDialog {
  constructor(readonly page: Page) {}

  static async waitFor(electronApp: ElectronApplication, timeoutMs = 20_000): Promise<ManualConnectDialog> {
    const page = await waitForWindowWithSelector(electronApp, '#input-ip', timeoutMs);
    return new ManualConnectDialog(page);
  }

  /**
   * Fills the form. Serial and check code are only present for modern types -
   * selecting "legacy" hides them, since a legacy printer is still TCP-probed.
   */
  async fill(params: {
    ipAddress: string;
    type: ManualConnectType;
    serialNumber?: string;
    checkCode?: string;
  }): Promise<void> {
    await this.page.locator('#input-ip').fill(params.ipAddress);
    await this.page.locator('#input-type').selectOption(params.type);

    if (params.type !== 'legacy') {
      if (!params.serialNumber || !params.checkCode) {
        throw new Error(`Manual connect type "${params.type}" requires both a serial number and a check code`);
      }
      await this.page.locator('#input-serial').fill(params.serialNumber);
      await this.page.locator('#input-check-code').fill(params.checkCode);
    }
  }

  async submit(): Promise<void> {
    const connectButton = this.page.locator('#dialog-connect');
    await expect(connectButton).toBeEnabled();
    await connectButton.click();
  }

  async cancel(): Promise<void> {
    await this.page.locator('#dialog-cancel').click();
  }

  async getErrorText(): Promise<string> {
    return ((await this.page.locator('#dialog-error').textContent()) ?? '').trim();
  }

  /** True when the serial/check-code fields are showing (i.e. a modern type is selected). */
  async requiresCredentials(): Promise<boolean> {
    return await this.page.locator('#field-serial').isVisible();
  }
}

export class DiscoveryTable {
  constructor(readonly page: Page) {}

  static async waitFor(electronApp: ElectronApplication, timeoutMs = 60_000): Promise<DiscoveryTable> {
    const page = await waitForWindowWithSelector(electronApp, '#printer-table', timeoutMs);
    return new DiscoveryTable(page);
  }

  /**
   * The same #printer-table markup backs both the discovery results and the
   * "Select a Saved Printer" dialog, so this resolves either without caring which.
   */
  static async findOptional(electronApp: ElectronApplication, timeoutMs = 5_000): Promise<DiscoveryTable | null> {
    const page = await findWindowWithSelector(electronApp, '#printer-table', timeoutMs);
    return page ? new DiscoveryTable(page) : null;
  }

  /**
   * Matches on the row's data-printer payload rather than its rendered text.
   *
   * The serial column is visually truncated ("E2E-SN-5M..."), so text matching is
   * fragile the moment a column narrows; the attribute always carries the full value.
   */
  row(serialNumber: string) {
    return this.page.locator(`#printer-table tbody tr[data-printer*="${serialNumber}"]`).first();
  }

  /**
   * Waits for a printer matching `matchText` to appear, then connects to it.
   *
   * Rows carry their full payload in data-printer, so matching on a serial number
   * works and is stable across DHCP changes.
   *
   * The dblclick closes this window on success, which races the action and surfaces as
   * "Target page... has been closed". That specific error means the click landed, so it
   * is swallowed here; genuine failures still surface when the caller asserts that a
   * printer actually connected.
   */
  async connectTo(matchText: string, timeoutMs = 60_000): Promise<void> {
    const row = this.row(matchText);
    await expect(row).toBeVisible({ timeout: timeoutMs });

    await row.dblclick().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!/has been closed/i.test(message)) {
        throw error;
      }
    });
  }

  async getRowCount(): Promise<number> {
    return await this.page.locator('#printer-table tbody tr[data-printer]').count();
  }
}

export class CheckCodePrompt {
  constructor(readonly page: Page) {}

  /**
   * Returns the prompt only if it appears. A manual connect that already supplied a
   * check code should NOT produce a second prompt, so specs use this to assert absence.
   */
  static async findOptional(electronApp: ElectronApplication, timeoutMs = 3_000): Promise<CheckCodePrompt | null> {
    const page = await findWindowWithSelector(electronApp, '#dialog-input', timeoutMs);
    return page ? new CheckCodePrompt(page) : null;
  }

  async submit(checkCode: string): Promise<void> {
    await this.page.locator('#dialog-input').fill(checkCode);
    await this.page.locator('#dialog-ok').click();
  }
}

/** Dismisses the "already connected" warning if the app raises it. */
export const dismissConnectedWarningIfPresent = async (
  electronApp: ElectronApplication,
  timeoutMs = 1_000
): Promise<void> => {
  const warning = await findWindowWithSelector(electronApp, '#dialog-continue', timeoutMs);
  if (warning) {
    await warning.locator('#dialog-continue').click();
  }
};
