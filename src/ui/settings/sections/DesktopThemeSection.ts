/**
 * @fileoverview Desktop theme section controller for the settings dialog renderer.
 *
 * Encapsulates all DOM bindings, color picker behavior, and theme value propagation for
 * the desktop theme customization area. Exposes a simple API for loading an initial theme,
 * reacting to user edits, and notifying the parent settings renderer whenever the theme
 * changes so global configuration state can stay in sync.
 *
 * Responsibilities:
 * - Map DOM inputs (native color pickers, hex fields, swatches) to ThemeColors keys
 * - Drive the custom color picker modal with hue/SV field interactions
 * - Normalize and validate color input before emitting theme changes
 * - Provide lifecycle hooks for initialization, updates, and cleanup
 */

// src/ui/settings/sections/DesktopThemeSection.ts

import type { ThemeColors } from '../../../types/config.js';

interface DesktopThemeSectionOptions {
  readonly document: Document;
  readonly defaultTheme: ThemeColors;
  readonly onThemeChange: (theme: ThemeColors) => void;
}

type ThemeColorKey = keyof ThemeColors;

const THEME_INPUT_CONFIG: Array<[ThemeColorKey, string]> = [
  ['primary', 'desktop-theme-primary'],
  ['secondary', 'desktop-theme-secondary'],
  ['background', 'desktop-theme-background'],
  ['surface', 'desktop-theme-surface'],
  ['text', 'desktop-theme-text']
];

/**
 * Dedicated controller for the Desktop Theme section. Keeps the massive settings renderer
 * leaner by encapsulating color picker state, DOM lookups, and change handling.
 */
export class DesktopThemeSection {
  private readonly doc: Document;
  private readonly defaultTheme: ThemeColors;
  private readonly notifyThemeChange: (theme: ThemeColors) => void;

  private readonly nativeColorInputs: Map<ThemeColorKey, HTMLInputElement> = new Map();
  private readonly hexInputs: Map<ThemeColorKey, HTMLInputElement> = new Map();
  private readonly colorSwatches: Map<ThemeColorKey, HTMLButtonElement> = new Map();

  private resetButton: HTMLButtonElement | null = null;
  private colorPickerModal: HTMLElement | null = null;
  private colorFieldCanvas: HTMLCanvasElement | null = null;
  private colorFieldCtx: CanvasRenderingContext2D | null = null;
  private colorFieldThumb: HTMLElement | null = null;
  private hueSlider: HTMLInputElement | null = null;
  private pickerHexInput: HTMLInputElement | null = null;
  private pickerPreviewSwatch: HTMLElement | null = null;
  private pickerPreviewLabel: HTMLElement | null = null;
  private colorPickerClose: HTMLButtonElement | null = null;
  private currentPickerColorKey: ThemeColorKey | null = null;

  private colorFieldPointerMoveHandler: ((event: PointerEvent) => void) | null = null;
  private colorFieldPointerUpHandler: ((event: PointerEvent) => void) | null = null;

  private pendingPickerFrame: number | null = null;
  private updatingPickerInputs = false;

  // Picker state
  private currentHue = 0;
  private currentSaturation = 100;
  private currentBrightness = 100;

  private currentTheme: ThemeColors;

  private readonly handleWindowResize = (): void => {
    this.drawColorField();
    this.positionColorFieldThumb();
  };

  private readonly handleEscapeKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.colorPickerModal && !this.colorPickerModal.hidden) {
      this.closeColorPicker();
    }
  };

  constructor(options: DesktopThemeSectionOptions) {
    this.doc = options.document;
    this.defaultTheme = options.defaultTheme;
    this.notifyThemeChange = options.onThemeChange;
    this.currentTheme = { ...options.defaultTheme };
  }

  initialize(): void {
    this.cacheElements();
    this.initializeColorPickerCanvas();
    this.registerEventListeners();
    this.applyTheme(this.currentTheme);
  }

  /**
   * Apply a theme from persisted config without emitting change events.
   */
  applyTheme(theme?: ThemeColors): void {
    const nextTheme = theme ? { ...theme } : { ...this.defaultTheme };
    this.currentTheme = nextTheme;

    THEME_INPUT_CONFIG.forEach(([key]) => {
      const value = nextTheme[key];
      this.updateNativeInputValue(key, value);
      this.updateHexInputValue(key, value);
      this.updateColorSwatch(key, value);
    });
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleWindowResize);
    this.doc.removeEventListener('keydown', this.handleEscapeKey);
    this.removeColorFieldPointerListeners();

    if (this.pendingPickerFrame !== null) {
      cancelAnimationFrame(this.pendingPickerFrame);
      this.pendingPickerFrame = null;
    }
  }

  private cacheElements(): void {
    THEME_INPUT_CONFIG.forEach(([key, id]) => {
      const colorInput = this.doc.getElementById(id) as HTMLInputElement | null;
      if (colorInput) {
        this.nativeColorInputs.set(key, colorInput);
      } else {
        console.warn(`[DesktopThemeSection] Native color input not found: ${id}`);
      }

      const hexInput = this.doc.getElementById(`hex-${key}`) as HTMLInputElement | null;
      if (hexInput) {
        this.hexInputs.set(key, hexInput);
      } else {
        console.warn(`[DesktopThemeSection] Hex input not found for ${key}`);
      }

      const swatch = this.doc.getElementById(`swatch-${key}`) as HTMLButtonElement | null;
      if (swatch) {
        this.colorSwatches.set(key, swatch);
      }
    });

    this.resetButton = this.doc.getElementById('reset-desktop-theme') as HTMLButtonElement | null;
    this.colorPickerModal = this.doc.getElementById('custom-color-picker');
    this.colorFieldCanvas = this.doc.getElementById('color-picker-field') as HTMLCanvasElement | null;
    this.colorFieldThumb = this.doc.getElementById('color-picker-thumb');
    this.hueSlider = this.doc.getElementById('color-picker-hue') as HTMLInputElement | null;
    this.pickerHexInput = this.doc.getElementById('picker-hex-input') as HTMLInputElement | null;
    this.pickerPreviewSwatch = this.doc.getElementById('picker-preview-swatch');
    this.pickerPreviewLabel = this.doc.getElementById('picker-preview-label');
    this.colorPickerClose = this.doc.querySelector('.color-picker-close') as HTMLButtonElement | null;
  }

  private initializeColorPickerCanvas(): void {
    if (this.colorFieldCanvas) {
      this.colorFieldCtx = this.colorFieldCanvas.getContext('2d');
      this.drawColorField();
      this.positionColorFieldThumb();
    }

    window.addEventListener('resize', this.handleWindowResize);
  }

  private registerEventListeners(): void {
    this.nativeColorInputs.forEach((input, key) => {
      input.addEventListener('input', () => this.updateColorFromNativePicker(key));
    });

    this.hexInputs.forEach((input, key) => {
      input.addEventListener('input', () => this.handleHexInput(key));
    });

    this.colorSwatches.forEach((swatch, key) => {
      swatch.addEventListener('click', () => this.openColorPicker(key));
    });

    if (this.resetButton) {
      this.resetButton.addEventListener('click', () => this.handleResetDesktopTheme());
    }

    if (this.colorPickerClose) {
      this.colorPickerClose.addEventListener('click', () => this.closeColorPicker());
    }

    if (this.colorPickerModal) {
      this.colorPickerModal.addEventListener('mousedown', (event) => {
        if (event.target === this.colorPickerModal) {
          this.closeColorPicker();
        }
      });
    }

    this.doc.addEventListener('keydown', this.handleEscapeKey);

    if (this.colorFieldCanvas) {
      this.colorFieldCanvas.addEventListener('pointerdown', (event) => this.handleColorFieldPointerDown(event));
    }

    if (this.hueSlider) {
      this.hueSlider.addEventListener('input', () => this.handleHueChange());
    }

    if (this.pickerHexInput) {
      this.pickerHexInput.addEventListener('input', () => this.handlePickerHexInput());
    }
  }

  private handleResetDesktopTheme(): void {
    this.applyTheme(this.defaultTheme);
    // Remove invalid states
    this.hexInputs.forEach((input) => input.classList.remove('invalid'));
    this.emitThemeChange();
  }

  private updateColorFromNativePicker(key: ThemeColorKey): void {
    const input = this.nativeColorInputs.get(key);
    if (!input) {
      return;
    }

    this.setThemeColor(key, input.value.toUpperCase());
  }

  private handleHexInput(key: ThemeColorKey): void {
    const hexInput = this.hexInputs.get(key);
    if (!hexInput) {
      return;
    }

    const validation = this.validateHexColor(hexInput.value);
    if (validation.valid) {
      hexInput.classList.remove('invalid');
      this.setThemeColor(key, validation.normalized);
    } else {
      hexInput.classList.add('invalid');
    }
  }

  private openColorPicker(key: ThemeColorKey): void {
    if (!this.colorPickerModal) {
      return;
    }

    this.currentPickerColorKey = key;
    const currentColor = this.currentTheme[key] ?? this.defaultTheme[key];
    this.applyHexToPicker(currentColor, false);
    this.colorPickerModal.hidden = false;
  }

  private closeColorPicker(): void {
    if (this.colorPickerModal) {
      this.colorPickerModal.hidden = true;
    }
    this.currentPickerColorKey = null;
  }

  private setThemeColor(key: ThemeColorKey, hexColor: string): void {
    if (this.currentTheme[key] === hexColor) {
      return;
    }

    this.currentTheme[key] = hexColor;
    this.updateNativeInputValue(key, hexColor);
    this.updateHexInputValue(key, hexColor);
    this.updateColorSwatch(key, hexColor);
    this.emitThemeChange();
  }

  private emitThemeChange(): void {
    this.notifyThemeChange({ ...this.currentTheme });
  }

  private updateNativeInputValue(key: ThemeColorKey, value: string): void {
    const input = this.nativeColorInputs.get(key);
    if (input && input.value !== value) {
      input.value = value;
    }
  }

  private updateHexInputValue(key: ThemeColorKey, value: string): void {
    const input = this.hexInputs.get(key);
    if (input && input.value !== value) {
      input.value = value;
      input.classList.remove('invalid');
    }
  }

  private updateColorSwatch(key: ThemeColorKey, value: string): void {
    const swatch = this.colorSwatches.get(key);
    if (swatch) {
      swatch.style.backgroundColor = value;
    }
  }

  private validateHexColor(hex: string): { valid: boolean; normalized: string } {
    let normalized = hex.trim();
    if (!normalized.startsWith('#')) {
      normalized = `#${normalized}`;
    }

    const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    if (!hexRegex.test(normalized)) {
      return { valid: false, normalized };
    }

    if (normalized.length === 4) {
      normalized = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
    }

    return { valid: true, normalized: normalized.toUpperCase() };
  }

  private parseColorInput(input: string): string | null {
    const value = input.trim();
    if (!value) {
      return null;
    }

    if (value.toLowerCase().startsWith('rgb')) {
      const match = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i);
      if (!match) {
        return null;
      }

      const r = this.clamp(parseInt(match[1], 10), 0, 255);
      const g = this.clamp(parseInt(match[2], 10), 0, 255);
      const b = this.clamp(parseInt(match[3], 10), 0, 255);
      return this.rgbToHex(r, g, b);
    }

    const validation = this.validateHexColor(value);
    return validation.valid ? validation.normalized : null;
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (component: number) => {
      const clamped = this.clamp(component, 0, 255);
      return clamped.toString(16).padStart(2, '0');
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private handleColorFieldPointerDown(event: PointerEvent): void {
    if (!this.colorFieldCanvas) {
      return;
    }

    event.preventDefault();
    this.colorFieldCanvas.setPointerCapture(event.pointerId);
    this.updateColorFieldFromEvent(event);

    this.colorFieldPointerMoveHandler = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId === event.pointerId) {
        this.updateColorFieldFromEvent(moveEvent);
      }
    };

    this.colorFieldPointerUpHandler = (upEvent: PointerEvent) => {
      if (upEvent.pointerId === event.pointerId) {
        this.colorFieldCanvas?.releasePointerCapture(event.pointerId);
        this.removeColorFieldPointerListeners();
      }
    };

    this.doc.addEventListener('pointermove', this.colorFieldPointerMoveHandler);
    this.doc.addEventListener('pointerup', this.colorFieldPointerUpHandler);
  }

  private updateColorFieldFromEvent(event: PointerEvent): void {
    if (!this.colorFieldCanvas) {
      return;
    }

    const rect = this.colorFieldCanvas.getBoundingClientRect();
    const x = this.clamp(event.clientX - rect.left, 0, rect.width);
    const y = this.clamp(event.clientY - rect.top, 0, rect.height);

    this.currentSaturation = (x / rect.width) * 100;
    this.currentBrightness = 100 - (y / rect.height) * 100;

    this.positionColorFieldThumb(rect, x, y);
    this.requestPickerRender();
  }

  private removeColorFieldPointerListeners(): void {
    if (this.colorFieldPointerMoveHandler) {
      this.doc.removeEventListener('pointermove', this.colorFieldPointerMoveHandler);
      this.colorFieldPointerMoveHandler = null;
    }
    if (this.colorFieldPointerUpHandler) {
      this.doc.removeEventListener('pointerup', this.colorFieldPointerUpHandler);
      this.colorFieldPointerUpHandler = null;
    }
  }

  private drawColorField(): void {
    if (!this.colorFieldCanvas || !this.colorFieldCtx) {
      return;
    }

    const rect = this.colorFieldCanvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    if (this.colorFieldCanvas.width !== width || this.colorFieldCanvas.height !== height) {
      this.colorFieldCanvas.width = width;
      this.colorFieldCanvas.height = height;
    }

    const ctx = this.colorFieldCtx;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = `hsl(${this.currentHue}, 100%, 50%)`;
    ctx.fillRect(0, 0, width, height);

    const whiteGradient = ctx.createLinearGradient(0, 0, width, 0);
    whiteGradient.addColorStop(0, '#ffffff');
    whiteGradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGradient;
    ctx.fillRect(0, 0, width, height);

    const blackGradient = ctx.createLinearGradient(0, 0, 0, height);
    blackGradient.addColorStop(0, 'rgba(0,0,0,0)');
    blackGradient.addColorStop(1, '#000000');
    ctx.fillStyle = blackGradient;
    ctx.fillRect(0, 0, width, height);
  }

  private positionColorFieldThumb(rect?: DOMRect, x?: number, y?: number): void {
    if (!this.colorFieldThumb || !this.colorFieldCanvas) {
      return;
    }

    const bounds = rect ?? this.colorFieldCanvas.getBoundingClientRect();
    const left = typeof x === 'number' ? x : (this.currentSaturation / 100) * bounds.width;
    const top = typeof y === 'number' ? y : ((100 - this.currentBrightness) / 100) * bounds.height;

    this.colorFieldThumb.style.left = `${left}px`;
    this.colorFieldThumb.style.top = `${top}px`;
  }

  private handleHueChange(): void {
    if (!this.hueSlider) {
      return;
    }

    this.currentHue = parseFloat(this.hueSlider.value);
    this.drawColorField();
    this.requestPickerRender();
  }

  private handlePickerHexInput(): void {
    if (!this.pickerHexInput || this.updatingPickerInputs) {
      return;
    }

    const parsedHex = this.parseColorInput(this.pickerHexInput.value);
    if (parsedHex) {
      this.pickerHexInput.classList.remove('invalid');
      this.applyHexToPicker(parsedHex);
    } else {
      this.pickerHexInput.classList.add('invalid');
    }
  }

  private applyHexToPicker(hexColor: string, applyToTheme: boolean = true): void {
    const validation = this.validateHexColor(hexColor);
    if (!validation.valid) {
      return;
    }

    const hsb = this.hexToHSB(validation.normalized);
    this.currentHue = hsb.h;
    this.currentSaturation = hsb.s;
    this.currentBrightness = hsb.b;

    if (this.hueSlider) {
      this.hueSlider.value = Math.round(this.currentHue).toString();
    }

    this.drawColorField();
    this.positionColorFieldThumb();
    this.updatePickerFromHSB(applyToTheme);
  }

  private requestPickerRender(): void {
    if (this.pendingPickerFrame !== null) {
      cancelAnimationFrame(this.pendingPickerFrame);
    }

    this.pendingPickerFrame = window.requestAnimationFrame(() => {
      this.pendingPickerFrame = null;
      this.updatePickerFromHSB();
    });
  }

  private updatePickerFromHSB(applyToTheme: boolean = true): void {
    const hexColor = this.hsbToHex(this.currentHue, this.currentSaturation, this.currentBrightness);

    this.updatingPickerInputs = true;
    if (this.pickerHexInput) {
      this.pickerHexInput.value = hexColor;
      this.pickerHexInput.classList.remove('invalid');
    }
    this.updatingPickerInputs = false;

    this.updatePickerPreview(hexColor);

    if (applyToTheme && this.currentPickerColorKey) {
      this.setThemeColor(this.currentPickerColorKey, hexColor);
    }
  }

  private updatePickerPreview(hexColor: string): void {
    if (this.pickerPreviewSwatch) {
      this.pickerPreviewSwatch.style.backgroundColor = hexColor;
    }
    if (this.pickerPreviewLabel) {
      this.pickerPreviewLabel.textContent = hexColor;
    }
  }

  private hexToHSB(hex: string): { h: number; s: number; b: number } {
    const r = parseInt(hex.substr(1, 2), 16) / 255;
    const g = parseInt(hex.substr(3, 2), 16) / 255;
    const b = parseInt(hex.substr(5, 2), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
      } else if (max === g) {
        h = ((b - r) / delta + 2) / 6;
      } else {
        h = ((r - g) / delta + 4) / 6;
      }
    }

    const s = max === 0 ? 0 : delta / max;
    return { h: h * 360, s: s * 100, b: max * 100 };
  }

  private hsbToHex(h: number, s: number, b: number): string {
    const hue = h / 360;
    const saturation = s / 100;
    const brightness = b / 100;

    const i = Math.floor(hue * 6);
    const f = hue * 6 - i;
    const p = brightness * (1 - saturation);
    const q = brightness * (1 - f * saturation);
    const t = brightness * (1 - (1 - f) * saturation);

    let r: number;
    let g: number;
    let bl: number;

    switch (i % 6) {
      case 0:
        r = brightness; g = t; bl = p;
        break;
      case 1:
        r = q; g = brightness; bl = p;
        break;
      case 2:
        r = p; g = brightness; bl = t;
        break;
      case 3:
        r = p; g = q; bl = brightness;
        break;
      case 4:
        r = t; g = p; bl = brightness;
        break;
      case 5:
      default:
        r = brightness; g = p; bl = q;
        break;
    }

    const toHex = (value: number) => {
      const hex = Math.round(value * 255).toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(bl)}`.toUpperCase();
  }
}
