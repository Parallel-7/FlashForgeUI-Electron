/**
 * @fileoverview Page object for the FlashForgeUI main window.
 *
 * Wraps the shell chrome that every scenario touches: opening the connect flow,
 * waiting for a printer context to come up, reading printer tabs, driving the LED
 * controls, and opening shortcut-only dialogs such as the file manager.
 *
 * Selectors live here and nowhere else. When a flow changes (as the connect flow did
 * in 1.0.5-alpha.9), this is the single file that needs updating instead of every spec.
 */

import { type ElectronApplication, expect, type Page } from '@playwright/test';

const CONNECT_TIMEOUT_MS = 60_000;

export class MainWindow {
  constructor(
    readonly page: Page,
    readonly electronApp: ElectronApplication
  ) {}

  /**
   * Opens the connect flow from whichever entry point is currently showing.
   * Before any printer is connected the app shows a placeholder button; afterwards
   * the same flow is only reachable through the hamburger menu.
   */
  async openConnectFlow(): Promise<void> {
    const placeholderButton = this.page.locator('#placeholder-connect-btn');
    if (await placeholderButton.isVisible().catch(() => false)) {
      await placeholderButton.click();
      return;
    }

    await expect(this.page.locator('#btn-main-menu')).toBeVisible();
    await this.page.locator('#btn-main-menu').click();

    const connectMenuItem = this.page.locator('#main-menu-dropdown .menu-item[data-action="connect"]');
    await expect(connectMenuItem).toBeVisible();
    await connectMenuItem.click();
  }

  /** Clicks the "+" tab button to connect an additional printer. */
  async addPrinterTab(): Promise<void> {
    const button = this.page.locator('#add-printer-tab');
    await expect(button).toBeVisible();
    await button.click();
  }

  /** Number of printer tabs currently in the connected state. */
  async getConnectedTabCount(): Promise<number> {
    return await this.page.locator('#printer-tabs-container .printer-tab.status-connected').count();
  }

  async getTabNames(): Promise<string[]> {
    return await this.page.locator('#printer-tabs-container .printer-tab .tab-name').allTextContents();
  }

  /** Waits until at least `expected` printer tabs report connected. */
  async waitForConnectedPrinters(expected = 1, timeoutMs = CONNECT_TIMEOUT_MS): Promise<void> {
    await expect
      .poll(async () => await this.getConnectedTabCount(), {
        timeout: timeoutMs,
        message: `Expected at least ${expected} connected printer tab(s)`,
      })
      .toBeGreaterThanOrEqual(expected);
  }

  /** Asserts the dashboard replaced the empty-state placeholder. */
  async expectDashboardVisible(): Promise<void> {
    await expect(this.page.locator('#grid-placeholder')).toBeHidden();
    await expect(this.page.locator('.grid-stack')).toBeVisible();
  }

  async getStatusText(): Promise<string> {
    const text = await this.page.locator('#printer-status-text').first().textContent();
    return (text ?? '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Waits until the controls grid reports a live connection.
   *
   * A printer tab flips to "connected" as soon as the connection is established, but
   * the control buttons stay disabled until the first polling update delivers
   * connectionState. Those are seconds apart, so specs must wait for this rather than
   * for the tab, or they race the poll and see "Disabled: No connection".
   */
  async waitForControlsReady(timeoutMs = 60_000): Promise<void> {
    await expect(this.page.locator('#btn-led-on')).toBeEnabled({ timeout: timeoutMs });
  }

  async clickLedOn(): Promise<void> {
    const button = this.page.locator('#btn-led-on');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await button.click();
  }

  async clickLedOff(): Promise<void> {
    const button = this.page.locator('#btn-led-off');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await button.click();
  }

  /**
   * Pins a shortcut-only component to a topbar slot if it is not already there.
   *
   * Shortcut assignments default to empty and live in renderer localStorage
   * ('shortcut-buttons-config'), not in the userData files the profile seeder writes,
   * so a fresh isolated profile shows no shortcut buttons at all. Components that are
   * only reachable this way - the file manager has no menu entry - therefore have to be
   * pinned before a test can open them. The renderer reads the config once at startup,
   * hence the reload.
   */
  async ensureShortcut(componentId: string, slot: 1 | 2 | 3 = 1): Promise<void> {
    const visible = await this.page.locator(`[data-component-id="${componentId}"]:not(.hidden)`).count();
    if (visible > 0) {
      return;
    }

    await this.page.evaluate(
      ({ id, slotNumber }) => {
        const config = {
          version: 1,
          slots: { slot1: null as string | null, slot2: null as string | null, slot3: null as string | null },
          lastModified: new Date().toISOString(),
        };
        config.slots[`slot${slotNumber}` as 'slot1' | 'slot2' | 'slot3'] = id;
        localStorage.setItem('shortcut-buttons-config', JSON.stringify(config));
      },
      { id: componentId, slotNumber: slot }
    );

    await this.page.reload();
    await expect(this.page.locator('.title')).toHaveText('FlashForgeUI');
    await expect(this.page.locator(`[data-component-id="${componentId}"]:not(.hidden)`).first()).toBeVisible({
      timeout: 30_000,
    });
  }

  /** Opens a shortcut-only dialog (file manager, etc.) from the topbar. */
  async openShortcut(componentId: string): Promise<void> {
    const button = this.page.locator(`[data-component-id="${componentId}"]:not(.hidden)`).first();
    await expect(button).toBeVisible();
    await button.click();
  }

  /**
   * Opens the job uploader from the controls grid.
   *
   * The button is intentionally not gated on an active connection (you can stage an
   * upload before connecting) but IS disabled during an active job, so specs must
   * ensure the printer is idle first.
   */
  async openJobUploader(): Promise<void> {
    const button = this.page.locator('#btn-upload-job');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await button.click();
  }
}
