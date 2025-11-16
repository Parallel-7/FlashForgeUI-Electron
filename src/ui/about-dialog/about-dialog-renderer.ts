/**
 * @fileoverview Renderer controller for the About dialog showing app metadata and resource links.
 */

import type { AboutDialogInfo } from './about-dialog-preload';

declare global {
  interface Window {
    aboutAPI?: AboutAPI;
    lucide?: { createIcons: () => void };
  }
}

export {};

interface AboutAPI {
  readonly getAppInfo: () => Promise<AboutDialogInfo | null>;
  readonly openExternalLink: (url: string) => Promise<void>;
  readonly closeWindow: () => void;
}

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
  }

  private get api(): AboutAPI | undefined {
    return window.aboutAPI;
  }

  private async populateAppInfo(): Promise<void> {
    const info = await this.api?.getAppInfo();
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
    this.refreshIcons();
  }

  private renderLinks(links: AboutDialogInfo['links']): void {
    const grid = this.linkGridEl;
    if (!grid) {
      return;
    }

    grid.innerHTML = '';

    links.forEach((link) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'link-card';
      button.setAttribute('role', 'listitem');
      button.dataset.url = link.url;
      button.addEventListener('click', () => {
        void this.api?.openExternalLink(link.url);
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
    });
  }

  private registerCloseHandlers(): void {
    this.closeButtons.forEach((button) => {
      button.addEventListener('click', () => this.api?.closeWindow());
    });
  }

  private refreshIcons(): void {
    try {
      window.lucide?.createIcons();
    } catch (error) {
      console.warn('[AboutDialog] Failed to refresh Lucide icons', error);
    }
  }
}

void document.addEventListener('DOMContentLoaded', () => {
  const renderer = new AboutDialogRenderer();
  void renderer.initialize();
});
