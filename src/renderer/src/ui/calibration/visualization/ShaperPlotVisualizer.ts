/**
 * @fileoverview Canvas-based visualization for input shaper frequency analysis.
 * Renders power spectral density plots with peak markers and recommended frequency.
 *
 * @module renderer/ui/calibration/visualization/ShaperPlotVisualizer
 */

import type { AxisCalibration } from '../../../../../shared/types/calibration';

export interface ShaperPlotOptions {
  width: number;
  height: number;
  padding: number;
  backgroundColor: string;
  axisColor: string;
  gridColor: string;
  lineColor: string;
  peakColor: string;
  recommendationColor: string;
  textColor: string;
  fontSize: number;
}

const DEFAULT_OPTIONS: ShaperPlotOptions = {
  width: 600,
  height: 300,
  padding: 40,
  backgroundColor: '#1a1a1a',
  axisColor: 'rgba(255, 255, 255, 0.7)',
  gridColor: 'rgba(255, 255, 255, 0.08)',
  lineColor: '#5cc8ff',
  peakColor: '#ffb74d',
  recommendationColor: '#4caf50',
  textColor: '#e0e0e0',
  fontSize: 11,
};

export class ShaperPlotVisualizer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly dpr: number;
  private options: ShaperPlotOptions;
  private calibration: AxisCalibration | null = null;

  constructor(canvas: HTMLCanvasElement, options: Partial<ShaperPlotOptions> = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D rendering context');
    }
    this.ctx = ctx;
    this.dpr = window.devicePixelRatio || 1;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.setupCanvas();
  }

  private setupCanvas(): void {
    const { width, height } = this.options;
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  updateOptions(options: Partial<ShaperPlotOptions>): void {
    this.options = { ...this.options, ...options };
    this.setupCanvas();
    this.render();
  }

  setCalibration(calibration: AxisCalibration | null): void {
    this.calibration = calibration;
    this.render();
  }

  private renderEmptyState(): void {
    const { width, height, textColor } = this.options;
    this.ctx.fillStyle = textColor;
    this.ctx.font = '14px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('No input shaper data loaded', width / 2, height / 2);
  }

  private getPlotBounds(): { minFreq: number; maxFreq: number; maxPower: number } {
    if (!this.calibration) {
      return { minFreq: 0, maxFreq: 1, maxPower: 1 };
    }
    const freqs = this.calibration.frequencyBins;
    const power = this.calibration.powerSpectralDensity;
    const minFreq = freqs[0] ?? 0;
    const maxFreq = freqs[freqs.length - 1] ?? 1;
    const maxPower = Math.max(1e-6, ...power);
    return { minFreq, maxFreq, maxPower };
  }

  private drawGrid(): void {
    const { width, height, padding, gridColor } = this.options;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;

    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 1;

    const verticalLines = 6;
    for (let i = 0; i <= verticalLines; i++) {
      const x = padding + (i / verticalLines) * plotWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(x, padding);
      this.ctx.lineTo(x, height - padding);
      this.ctx.stroke();
    }

    const horizontalLines = 4;
    for (let i = 0; i <= horizontalLines; i++) {
      const y = padding + (i / horizontalLines) * plotHeight;
      this.ctx.beginPath();
      this.ctx.moveTo(padding, y);
      this.ctx.lineTo(width - padding, y);
      this.ctx.stroke();
    }
  }

  private drawAxes(bounds: { minFreq: number; maxFreq: number; maxPower: number }): void {
    const { width, height, padding, axisColor, textColor, fontSize } = this.options;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;

    this.ctx.strokeStyle = axisColor;
    this.ctx.lineWidth = 1.5;

    // X axis
    this.ctx.beginPath();
    this.ctx.moveTo(padding, height - padding);
    this.ctx.lineTo(width - padding, height - padding);
    this.ctx.stroke();

    // Y axis
    this.ctx.beginPath();
    this.ctx.moveTo(padding, padding);
    this.ctx.lineTo(padding, height - padding);
    this.ctx.stroke();

    // Labels
    this.ctx.fillStyle = textColor;
    this.ctx.font = `${fontSize}px sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Frequency (Hz)', padding + plotWidth / 2, height - padding + 10);

    this.ctx.save();
    this.ctx.translate(padding - 28, padding + plotHeight / 2);
    this.ctx.rotate(-Math.PI / 2);
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Normalized Power', 0, 0);
    this.ctx.restore();

    // Tick labels
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    const freqTicks = 4;
    for (let i = 0; i <= freqTicks; i++) {
      const value = bounds.minFreq + (i / freqTicks) * (bounds.maxFreq - bounds.minFreq);
      const x = padding + (i / freqTicks) * plotWidth;
      this.ctx.fillText(value.toFixed(0), x, height - padding + 2);
    }

    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';
    const powerTicks = 3;
    for (let i = 0; i <= powerTicks; i++) {
      const value = (1 - i / powerTicks) * bounds.maxPower;
      const y = padding + (i / powerTicks) * plotHeight;
      this.ctx.fillText(value.toFixed(2), padding - 6, y);
    }
  }

  private drawSpectrum(bounds: { minFreq: number; maxFreq: number; maxPower: number }): void {
    if (!this.calibration) return;

    const { width, height, padding, lineColor } = this.options;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;

    const freqs = this.calibration.frequencyBins;
    const power = this.calibration.powerSpectralDensity;

    if (freqs.length === 0 || power.length === 0) return;

    const scaleX = plotWidth / (bounds.maxFreq - bounds.minFreq || 1);
    const scaleY = plotHeight / (bounds.maxPower || 1);

    this.ctx.strokeStyle = lineColor;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    freqs.forEach((freq, index) => {
      const x = padding + (freq - bounds.minFreq) * scaleX;
      const y = padding + plotHeight - power[index] * scaleY;
      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });

    this.ctx.stroke();
  }

  private drawMarkers(bounds: { minFreq: number; maxFreq: number; maxPower: number }): void {
    if (!this.calibration) return;

    const { width, height, padding, peakColor, recommendationColor, textColor, fontSize } = this.options;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    const scaleX = plotWidth / (bounds.maxFreq - bounds.minFreq || 1);

    // Peaks
    this.calibration.peakFrequencies.forEach((freq) => {
      const x = padding + (freq - bounds.minFreq) * scaleX;
      this.ctx.strokeStyle = peakColor;
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(x, padding);
      this.ctx.lineTo(x, padding + plotHeight);
      this.ctx.stroke();

      this.ctx.fillStyle = peakColor;
      this.ctx.font = `${fontSize}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'bottom';
      this.ctx.fillText(`${freq.toFixed(1)} Hz`, x, padding - 4);
    });

    // Recommended shaper frequency
    const recommendedFreq = this.calibration.recommendedShaper.frequency;
    if (recommendedFreq > 0) {
      const x = padding + (recommendedFreq - bounds.minFreq) * scaleX;
      this.ctx.strokeStyle = recommendationColor;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      this.ctx.moveTo(x, padding);
      this.ctx.lineTo(x, padding + plotHeight);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      this.ctx.fillStyle = textColor;
      this.ctx.font = `${fontSize}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(`Recommended ${recommendedFreq.toFixed(1)} Hz`, x, padding + plotHeight + 6);
    }
  }

  render(): void {
    const { width, height, backgroundColor } = this.options;

    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, width, height);

    if (!this.calibration) {
      this.renderEmptyState();
      return;
    }

    const bounds = this.getPlotBounds();
    this.drawGrid();
    this.drawAxes(bounds);
    this.drawSpectrum(bounds);
    this.drawMarkers(bounds);
  }

  toDataURL(format: 'png' | 'jpeg' = 'png'): string {
    return this.canvas.toDataURL(`image/${format}`);
  }
}
