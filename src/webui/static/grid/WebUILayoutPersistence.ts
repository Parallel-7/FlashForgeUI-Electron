/**
 * @fileoverview localStorage persistence manager for WebUI Grid layouts.
 *
 * Handles saving, loading, and resetting per-printer layouts using browser
 * localStorage. Implements debounced writes to avoid excessive synchronous
 * storage operations while ensuring each printer serial number maintains an
 * independent layout record. The persistence layer also validates stored
 * payloads to guard against corrupted data and falls back to default layouts
 * when necessary.
 */

import { DEFAULT_LAYOUT } from './WebUIComponentRegistry.js';
import type { WebUIGridLayout, WebUIStoredLayout } from './types.js';

const STORAGE_KEY_PREFIX = 'flashforge-webui-layout-';
const SETTINGS_KEY_PREFIX = 'flashforge-webui-settings-';
const SAVE_DEBOUNCE_MS = 1000;

function buildLayoutKey(serialNumber: string): string {
  return `${STORAGE_KEY_PREFIX}${serialNumber}`;
}

export class WebUILayoutPersistence {
  private readonly pendingSaveTimers = new Map<string, number>();

  public save(layout: WebUIGridLayout, serialNumber: string): void {
    if (!serialNumber) return;
    const key = buildLayoutKey(serialNumber);

    const existingTimer = this.pendingSaveTimers.get(key);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    const timer = window.setTimeout(() => {
      this.performSave(key, layout);
      this.pendingSaveTimers.delete(key);
    }, SAVE_DEBOUNCE_MS);

    this.pendingSaveTimers.set(key, timer);
  }

  public load(serialNumber: string | null | undefined): WebUIGridLayout | null {
    if (!serialNumber) {
      return this.cloneLayout(DEFAULT_LAYOUT);
    }

    const key = buildLayoutKey(serialNumber);
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return this.cloneLayout(DEFAULT_LAYOUT);
    }

    try {
      const parsed = JSON.parse(raw) as WebUIStoredLayout;
      if (!parsed || typeof parsed !== 'object' || !parsed.layout) {
        window.localStorage.removeItem(key);
        return this.cloneLayout(DEFAULT_LAYOUT);
      }

      if (!this.isValidLayout(parsed.layout)) {
        window.localStorage.removeItem(key);
        return this.cloneLayout(DEFAULT_LAYOUT);
      }

      return this.cloneLayout(parsed.layout);
    } catch (error) {
      console.warn('[WebUILayoutPersistence] Failed to parse layout:', error);
      window.localStorage.removeItem(key);
      return this.cloneLayout(DEFAULT_LAYOUT);
    }
  }

  public reset(serialNumber: string): WebUIGridLayout {
    if (!serialNumber) {
      return this.cloneLayout(DEFAULT_LAYOUT);
    }

    window.localStorage.removeItem(buildLayoutKey(serialNumber));
    return this.cloneLayout(DEFAULT_LAYOUT);
  }

  public exists(serialNumber: string): boolean {
    if (!serialNumber) return false;
    return window.localStorage.getItem(buildLayoutKey(serialNumber)) !== null;
  }

  public delete(serialNumber: string): void {
    if (!serialNumber) return;
    window.localStorage.removeItem(buildLayoutKey(serialNumber));
  }

  public getAllSerialNumbers(): string[] {
    const serials: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        serials.push(key.replace(STORAGE_KEY_PREFIX, ''));
      }
    }
    return serials;
  }

  public loadSettings(serialNumber: string | null | undefined): unknown {
    if (!serialNumber) return null;
    const raw = window.localStorage.getItem(
      `${SETTINGS_KEY_PREFIX}${serialNumber}`,
    );
    if (!raw) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      window.localStorage.removeItem(`${SETTINGS_KEY_PREFIX}${serialNumber}`);
      return null;
    }
  }

  public saveSettings(serialNumber: string, settings: unknown): void {
    if (!serialNumber) return;
    window.localStorage.setItem(
      `${SETTINGS_KEY_PREFIX}${serialNumber}`,
      JSON.stringify(settings),
    );
  }

  private performSave(key: string, layout: WebUIGridLayout): void {
    const payload: WebUIStoredLayout = {
      updatedAt: Date.now(),
      layout,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  }

  private isValidLayout(layout: WebUIGridLayout): boolean {
    if (!layout || typeof layout !== 'object') {
      return false;
    }
    if (!layout.components || typeof layout.components !== 'object') {
      return false;
    }

    return Object.entries(layout.components).every(([componentId, config]) => {
      if (!componentId || !config) {
        return false;
      }
      const { x, y, w, h } = config;
      return (
        typeof x === 'number' &&
        typeof y === 'number' &&
        typeof w === 'number' &&
        typeof h === 'number'
      );
    });
  }

  private cloneLayout(layout: WebUIGridLayout): WebUIGridLayout {
    return JSON.parse(JSON.stringify(layout)) as WebUIGridLayout;
  }
}

