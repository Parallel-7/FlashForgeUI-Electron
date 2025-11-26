/**
 * @fileoverview Handles tab navigation and persistence for the settings dialog.
 *
 * Manages active tab state, keyboard navigation, and localStorage persistence so
 * SettingsRenderer no longer needs to track DOM state for the tab strip.
 */

// src/ui/settings/sections/TabSection.ts

import type { SettingsSection } from './SettingsSection.js';

interface TabSectionOptions {
  readonly document: Document;
  readonly storageKey: string;
}

export class TabSection implements SettingsSection {
  private readonly doc: Document;
  private readonly storageKey: string;
  private tabButtons: HTMLButtonElement[] = [];
  private readonly tabPanels: Map<string, HTMLElement> = new Map();
  private activeTabId: string | null = null;
  private readonly buttonClickHandlers: Map<HTMLButtonElement, EventListener> = new Map();
  private readonly buttonKeyHandlers: Map<HTMLButtonElement, EventListener> = new Map();

  constructor(options: TabSectionOptions) {
    this.doc = options.document;
    this.storageKey = options.storageKey;
  }

  initialize(): void {
    this.tabButtons = Array.from(this.doc.querySelectorAll<HTMLButtonElement>('.settings-tab-button'));
    const panelElements = this.doc.querySelectorAll<HTMLElement>('.tab-panel');

    panelElements.forEach((panel) => {
      const dataTab = panel.id.replace('tab-panel-', '');
      this.tabPanels.set(dataTab, panel);
    });

    this.tabButtons.forEach((button, index) => {
      const clickHandler = () => {
        const tabId = button.dataset.tab;
        if (tabId) {
          this.setActiveTab(tabId, true, true);
        }
      };
      const keyHandler: EventListener = (event) => {
        if (event instanceof KeyboardEvent) {
          this.handleTabKeydown(event, index);
        }
      };
      button.addEventListener('click', clickHandler);
      button.addEventListener('keydown', keyHandler);
      this.buttonClickHandlers.set(button, clickHandler);
      this.buttonKeyHandlers.set(button, keyHandler);
    });

    const persistedTab = this.loadPersistedTabId();
    if (persistedTab && this.tabPanels.has(persistedTab)) {
      this.setActiveTab(persistedTab, false, false);
    } else if (this.tabButtons.length > 0) {
      const fallbackTab = this.tabButtons[0].dataset.tab ?? 'camera';
      this.setActiveTab(fallbackTab, true, false);
    }
  }

  dispose(): void {
    this.buttonClickHandlers.forEach((handler, button) => button.removeEventListener('click', handler));
    this.buttonKeyHandlers.forEach((handler, button) => button.removeEventListener('keydown', handler));
    this.buttonClickHandlers.clear();
    this.buttonKeyHandlers.clear();
    this.tabPanels.clear();
  }

  private setActiveTab(tabId: string, persist: boolean, focusTab: boolean): void {
    if (!this.tabPanels.has(tabId)) {
      return;
    }

    this.activeTabId = tabId;
    this.tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tabId;
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
      if (isActive && focusTab) {
        button.focus();
      }
    });

    this.tabPanels.forEach((panel, id) => {
      const isActive = id === tabId;
      panel.hidden = !isActive;
    });

    if (persist) {
      this.persistTabId(tabId);
    }
  }

  private handleTabKeydown(event: KeyboardEvent, currentIndex: number): void {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();

    if (event.key === 'Home') {
      const firstTab = this.tabButtons[0];
      if (firstTab?.dataset.tab) {
        this.setActiveTab(firstTab.dataset.tab, true, true);
      }
      return;
    }

    if (event.key === 'End') {
      const lastTab = this.tabButtons[this.tabButtons.length - 1];
      if (lastTab?.dataset.tab) {
        this.setActiveTab(lastTab.dataset.tab, true, true);
      }
      return;
    }

    const increment = event.key === 'ArrowRight' ? 1 : -1;
    const newIndex = (currentIndex + increment + this.tabButtons.length) % this.tabButtons.length;
    const nextTab = this.tabButtons[newIndex];
    if (nextTab?.dataset.tab) {
      this.setActiveTab(nextTab.dataset.tab, true, true);
    }
  }

  private persistTabId(tabId: string): void {
    try {
      window.localStorage.setItem(this.storageKey, tabId);
    } catch (error) {
      console.warn('[Settings][TabSection] Unable to persist tab selection:', error);
    }
  }

  private loadPersistedTabId(): string | null {
    try {
      return window.localStorage.getItem(this.storageKey);
    } catch {
      return null;
    }
  }
}
