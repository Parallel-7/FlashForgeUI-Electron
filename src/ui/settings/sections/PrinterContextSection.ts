/**
 * @fileoverview Handles UI updates tied to per-printer context availability.
 */

// src/ui/settings/sections/PrinterContextSection.ts

import type { SettingsSection } from './SettingsSection.js';

interface PrinterContextSectionOptions {
  readonly document: Document;
  readonly onPerPrinterToggle: (enabled: boolean) => void;
}

export class PrinterContextSection implements SettingsSection {
  private readonly doc: Document;
  private readonly onPerPrinterToggle: (enabled: boolean) => void;
  private indicator: HTMLElement | null = null;
  private printerContent: HTMLElement | null = null;
  private printerEmptyState: HTMLElement | null = null;
  private cameraContent: HTMLElement | null = null;
  private cameraEmptyState: HTMLElement | null = null;

  constructor(options: PrinterContextSectionOptions) {
    this.doc = options.document;
    this.onPerPrinterToggle = options.onPerPrinterToggle;
  }

  initialize(): void {
    this.indicator = this.doc.getElementById('printer-context-indicator');
    this.printerContent = this.doc.getElementById('printer-settings-content');
    this.printerEmptyState = this.doc.getElementById('printer-settings-empty-state');
    this.cameraContent = this.doc.getElementById('camera-printer-settings');
    this.cameraEmptyState = this.doc.getElementById('camera-printer-empty-state');
  }

  dispose(): void {
    // Nothing to clean up; DOM lookups only.
  }

  update(printerName: string | null): void {
    const hasPrinter = Boolean(printerName);

    this.updateIndicator(printerName);
    if (this.printerContent) {
      this.printerContent.style.display = hasPrinter ? 'flex' : 'none';
    }
    if (this.printerEmptyState) {
      this.printerEmptyState.hidden = hasPrinter;
    }
    if (this.cameraContent) {
      this.cameraContent.style.display = hasPrinter ? 'flex' : 'none';
    }
    if (this.cameraEmptyState) {
      this.cameraEmptyState.hidden = hasPrinter;
    }

    this.onPerPrinterToggle(hasPrinter);
  }

  private updateIndicator(printerName: string | null): void {
    if (!this.indicator) {
      const settingsHeader = this.doc.querySelector('.settings-header');
      if (settingsHeader) {
        this.indicator = this.doc.createElement('div');
        this.indicator.id = 'printer-context-indicator';
        this.indicator.className = 'printer-context-indicator';
        settingsHeader.appendChild(this.indicator);
      }
    }

    if (!this.indicator) {
      return;
    }

    if (printerName) {
      this.indicator.textContent = `Per-printer settings for: ${printerName}`;
      this.indicator.style.display = 'block';
    } else {
      this.indicator.textContent = 'Global settings (no printer connected)';
      this.indicator.style.display = 'block';
    }
  }
}
