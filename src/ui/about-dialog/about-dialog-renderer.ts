/**
 * @fileoverview Renderer controller for the About dialog showing app metadata and resource links.
 */

import type { AboutDialogInfo } from './about-dialog-preload.cts';
import type { ThemeColors } from '../../types/config.js';
import { applyDialogTheme } from '../shared/theme-utils.js';
import { initializeLucideIconsFromGlobal } from '../shared/lucide.js';

interface AboutAPI {
  readonly getAppInfo: () => Promise<AboutDialogInfo | null>;
  readonly openExternalLink: (url: string) => Promise<void>;
  readonly closeWindow: () => void;
  receive?: (channel: string, func: (...args: unknown[]) => void) => void;
}

const getAboutAPI = (): AboutAPI => {
  const api = window.api?.dialog?.about as AboutAPI | undefined;
  if (!api) {
    throw new Error('[AboutDialog] API bridge is not available');
  }
  return api;
};

class AboutDialogRenderer {
  private readonly appNameEl = document.getElementById('about-app-name');
  private readonly versionBadgeEl = document.getElementById('version-badge');
  private readonly releaseLabelEl = document.getElementById('release-label');
  private readonly developerCreditEl = document.getElementById('developer-credit');
  private readonly linkGridEl = document.getElementById('about-link-grid');
  private readonly closeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#btn-close, #btn-close-footer'));

  async initialize(): Promise<void> {
    this.registerCloseHandlers();
    await this.populateAppInfo();
    this.registerThemeListener();
  }

  private registerThemeListener(): void {
    getAboutAPI().receive?.('theme-changed', (data: unknown) => {
      applyDialogTheme(data as ThemeColors);
    });
  }

  private async populateAppInfo(): Promise<void> {
    const info = await getAboutAPI().getAppInfo();
    if (!info) {
      return;
    }

    if (this.appNameEl) {
      this.appNameEl.textContent = info.appName;
    }

    if (this.versionBadgeEl) {
      this.versionBadgeEl.textContent = info.version;
      this.versionBadgeEl.classList.toggle('beta', info.releaseTag === 'beta');
    }

    if (this.releaseLabelEl) {
      this.releaseLabelEl.textContent = info.releaseLabel;
    }

    if (this.developerCreditEl) {
      this.developerCreditEl.textContent = `Created by ${info.developerName}`;
    }

    this.renderLinks(info.links);
  }

  private renderLinks(links: AboutDialogInfo['links']): void {
    const grid = this.linkGridEl;
    if (!grid) {
      return;
    }

    grid.innerHTML = '';
    const iconNames: string[] = [];

    links.forEach((link) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'link-card';
      button.setAttribute('role', 'listitem');
      button.dataset.url = link.url;
      button.addEventListener('click', () => {
        void getAboutAPI().openExternalLink(link.url);
      });

      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', link.icon);
      icon.setAttribute('aria-hidden', 'true');

      const copy = document.createElement('div');
      copy.className = 'link-copy';

      const title = document.createElement('span');
      title.className = 'link-title';
      title.textContent = link.label;

      const description = document.createElement('span');
      description.className = 'link-description';
      description.textContent = link.description;

      copy.append(title, description);
      button.append(icon, copy);
      grid.appendChild(button);
      iconNames.push(link.icon);
    });

    if (iconNames.length > 0) {
      initializeLucideIconsFromGlobal(iconNames, grid);
    }
  }

  private registerCloseHandlers(): void {
    this.closeButtons.forEach((button) => {
      button.addEventListener('click', () => getAboutAPI().closeWindow());
    });
  }

}

void document.addEventListener('DOMContentLoaded', () => {
  const renderer = new AboutDialogRenderer();
  void renderer.initialize();
});
