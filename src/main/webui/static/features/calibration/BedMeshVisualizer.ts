/**
 * @fileoverview Canvas-based bed mesh visualization for the WebUI client.
 * Browser-pure port of the desktop BedMeshVisualizer: renders a 2D heatmap of
 * bed mesh data with color-coded height values, hover tooltips, grid lines,
 * value labels, and a color bar legend.
 */

import { type ColorScheme, createColorMapper, getColor, rgbToCSS } from './ColorScales.js';
import type { AnalysisResult, MeshData } from './types.js';

/** Configuration options for the visualizer. */
export interface VisualizerOptions {
  width: number;
  height: number;
  padding: number;
  colorScheme: ColorScheme;
  showGrid: boolean;
  showLabels: boolean;
  showCorners: boolean;
  interpolationFactor: number;
  fontSize: number;
  gridColor: string;
  labelColor: string;
  backgroundColor: string;
}

/** Default visualizer options. */
export const DEFAULT_VISUALIZER_OPTIONS: VisualizerOptions = {
  width: 400,
  height: 400,
  padding: 40,
  colorScheme: 'viridis',
  showGrid: true,
  showLabels: true,
  showCorners: true,
  interpolationFactor: 1,
  fontSize: 10,
  gridColor: 'rgba(255, 255, 255, 0.3)',
  labelColor: '#ffffff',
  backgroundColor: '#1a1a1a',
};

/** Cell information for hover/click events. */
export interface CellInfo {
  row: number;
  col: number;
  value: number;
  x: number;
  y: number;
}

/** Event handlers for the visualizer. */
export interface VisualizerEventHandlers {
  onCellHover?: (cell: CellInfo | null) => void;
  onCellClick?: (cell: CellInfo) => void;
}

/** Canvas-based bed mesh visualizer. */
export class BedMeshVisualizer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private meshData: MeshData | null = null;
  private analysisResult: AnalysisResult | null = null;
  private options: VisualizerOptions;
  private handlers: VisualizerEventHandlers = {};
  private hoveredCell: CellInfo | null = null;
  private interpolatedMesh: number[][] | null = null;
  private readonly dpr: number;

  constructor(canvas: HTMLCanvasElement, options: Partial<VisualizerOptions> = {}) {
    this.canvas = canvas;
    this.options = { ...DEFAULT_VISUALIZER_OPTIONS, ...options };
    this.dpr = window.devicePixelRatio || 1;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D rendering context');
    }
    this.ctx = ctx;

    this.setupCanvas();
    this.setupEventListeners();
  }

  private setupCanvas(): void {
    const { width, height } = this.options;
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.addEventListener('click', this.handleClick.bind(this));
  }

  private handleMouseMove(event: MouseEvent): void {
    const cell = this.getCellAtPosition(event.offsetX, event.offsetY);
    if (cell !== this.hoveredCell) {
      this.hoveredCell = cell;
      this.handlers.onCellHover?.(cell);
      this.render();
    }
  }

  private handleMouseLeave(): void {
    if (this.hoveredCell) {
      this.hoveredCell = null;
      this.handlers.onCellHover?.(null);
      this.render();
    }
  }

  private handleClick(event: MouseEvent): void {
    const cell = this.getCellAtPosition(event.offsetX, event.offsetY);
    if (cell) {
      this.handlers.onCellClick?.(cell);
    }
  }

  private getCellAtPosition(x: number, y: number): CellInfo | null {
    if (!this.meshData) return null;

    const { width, height, padding } = this.options;
    const meshWidth = width - padding * 2;
    const meshHeight = height - padding * 2;

    if (x < padding || x > width - padding || y < padding || y > height - padding) {
      return null;
    }

    const { pointsX, pointsY, matrix } = this.meshData;
    const cellWidth = meshWidth / pointsX;
    const cellHeight = meshHeight / pointsY;

    const col = Math.floor((x - padding) / cellWidth);
    const row = Math.floor((y - padding) / cellHeight);

    if (row >= 0 && row < pointsY && col >= 0 && col < pointsX) {
      return {
        row,
        col,
        value: matrix[row][col],
        x: padding + col * cellWidth + cellWidth / 2,
        y: padding + row * cellHeight + cellHeight / 2,
      };
    }

    return null;
  }

  setEventHandlers(handlers: VisualizerEventHandlers): void {
    this.handlers = handlers;
  }

  updateOptions(options: Partial<VisualizerOptions>): void {
    this.options = { ...this.options, ...options };
    this.interpolatedMesh = null;
    this.setupCanvas();
    this.render();
  }

  setMeshData(meshData: MeshData | null, analysisResult?: AnalysisResult | null): void {
    this.meshData = meshData;
    this.analysisResult = analysisResult ?? null;
    this.interpolatedMesh = null;
    this.render();
  }

  /** Latest analysis result associated with the current mesh (may be null). */
  getAnalysisResult(): AnalysisResult | null {
    return this.analysisResult;
  }

  private interpolateMesh(): number[][] {
    if (!this.meshData) return [];

    const factor = this.options.interpolationFactor;
    if (factor <= 1) return this.meshData.matrix;

    const { matrix, pointsX, pointsY } = this.meshData;
    const newWidth = (pointsX - 1) * factor + 1;
    const newHeight = (pointsY - 1) * factor + 1;
    const result: number[][] = [];

    for (let y = 0; y < newHeight; y++) {
      const row: number[] = [];
      for (let x = 0; x < newWidth; x++) {
        const srcX = x / factor;
        const srcY = y / factor;
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + 1, pointsX - 1);
        const y1 = Math.min(y0 + 1, pointsY - 1);
        const tx = srcX - x0;
        const ty = srcY - y0;

        const v00 = matrix[y0][x0];
        const v01 = matrix[y0][x1];
        const v10 = matrix[y1][x0];
        const v11 = matrix[y1][x1];

        const v0 = v00 * (1 - tx) + v01 * tx;
        const v1 = v10 * (1 - tx) + v11 * tx;
        row.push(v0 * (1 - ty) + v1 * ty);
      }
      result.push(row);
    }

    return result;
  }

  private getMeshBounds(): { min: number; max: number } {
    if (!this.meshData) {
      return { min: 0, max: 1 };
    }

    let min = Infinity;
    let max = -Infinity;
    for (const row of this.meshData.matrix) {
      for (const value of row) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    return { min, max };
  }

  render(): void {
    const { width, height, backgroundColor } = this.options;

    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, width, height);

    if (!this.meshData) {
      this.renderEmptyState();
      return;
    }

    if (!this.interpolatedMesh) {
      this.interpolatedMesh = this.interpolateMesh();
    }

    this.renderHeatmap();
    this.renderGrid();
    this.renderLabels();
    this.renderCorners();
    this.renderHover();
    this.renderColorBar();
  }

  private renderEmptyState(): void {
    const { width, height, labelColor } = this.options;
    this.ctx.fillStyle = labelColor;
    this.ctx.font = '14px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('No mesh data loaded', width / 2, height / 2);
  }

  private renderHeatmap(): void {
    if (!this.interpolatedMesh || this.interpolatedMesh.length === 0) return;

    const { width, height, padding, colorScheme } = this.options;
    const meshWidth = width - padding * 2;
    const meshHeight = height - padding * 2;

    const rows = this.interpolatedMesh.length;
    const cols = this.interpolatedMesh[0].length;
    const cellWidth = meshWidth / cols;
    const cellHeight = meshHeight / rows;

    const { min, max } = this.getMeshBounds();
    const colorMapper = createColorMapper(colorScheme, min, max);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const value = this.interpolatedMesh[row][col];
        const x = padding + col * cellWidth;
        const y = padding + row * cellHeight;

        this.ctx.fillStyle = colorMapper(value);
        this.ctx.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);
      }
    }
  }

  private renderGrid(): void {
    if (!this.options.showGrid || !this.meshData) return;

    const { width, height, padding, gridColor } = this.options;
    const meshWidth = width - padding * 2;
    const meshHeight = height - padding * 2;
    const { pointsX, pointsY } = this.meshData;

    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    for (let i = 0; i <= pointsX; i++) {
      const x = padding + (i / pointsX) * meshWidth;
      this.ctx.moveTo(x, padding);
      this.ctx.lineTo(x, height - padding);
    }

    for (let i = 0; i <= pointsY; i++) {
      const y = padding + (i / pointsY) * meshHeight;
      this.ctx.moveTo(padding, y);
      this.ctx.lineTo(width - padding, y);
    }

    this.ctx.stroke();
  }

  private renderLabels(): void {
    if (!this.options.showLabels || !this.meshData) return;

    const { width, height, padding, fontSize, labelColor } = this.options;
    const meshWidth = width - padding * 2;
    const meshHeight = height - padding * 2;
    const { pointsX, pointsY, matrix } = this.meshData;

    const cellWidth = meshWidth / pointsX;
    const cellHeight = meshHeight / pointsY;

    this.ctx.fillStyle = labelColor;
    this.ctx.font = `${fontSize}px monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    for (let row = 0; row < pointsY; row++) {
      for (let col = 0; col < pointsX; col++) {
        const value = matrix[row][col];
        const x = padding + col * cellWidth + cellWidth / 2;
        const y = padding + row * cellHeight + cellHeight / 2;

        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 2;
        this.ctx.fillText(value.toFixed(3), x, y);
        this.ctx.shadowBlur = 0;
      }
    }
  }

  private renderCorners(): void {
    if (!this.options.showCorners || !this.meshData) return;

    const { width, height, padding, fontSize, labelColor } = this.options;

    const corners = [
      { x: padding, y: height - padding },
      { x: width - padding, y: height - padding },
      { x: padding, y: padding },
      { x: width - padding, y: padding },
    ];

    this.ctx.fillStyle = labelColor;
    this.ctx.font = `${fontSize}px sans-serif`;

    for (const corner of corners) {
      this.ctx.beginPath();
      this.ctx.arc(corner.x, corner.y, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private renderHover(): void {
    if (!this.hoveredCell || !this.meshData) return;

    const { width, height, padding, labelColor } = this.options;
    const meshWidth = width - padding * 2;
    const meshHeight = height - padding * 2;
    const { pointsX, pointsY } = this.meshData;

    const cellWidth = meshWidth / pointsX;
    const cellHeight = meshHeight / pointsY;

    const { row, col, value } = this.hoveredCell;
    const x = padding + col * cellWidth;
    const y = padding + row * cellHeight;

    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, cellWidth, cellHeight);

    const tooltipText = `[${row}, ${col}]: ${value.toFixed(4)} mm`;
    const tooltipPadding = 5;
    this.ctx.font = '12px monospace';
    const textWidth = this.ctx.measureText(tooltipText).width;

    let tooltipX = x + cellWidth / 2 - textWidth / 2 - tooltipPadding;
    let tooltipY = y - 25;

    tooltipX = Math.max(5, Math.min(width - textWidth - tooltipPadding * 2 - 5, tooltipX));
    if (tooltipY < 5) tooltipY = y + cellHeight + 5;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(tooltipX, tooltipY, textWidth + tooltipPadding * 2, 20);

    this.ctx.fillStyle = labelColor;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(tooltipText, tooltipX + tooltipPadding, tooltipY + 10);
  }

  private renderColorBar(): void {
    const { width, height, padding, colorScheme, labelColor, fontSize } = this.options;
    const { min, max } = this.getMeshBounds();

    const barWidth = 15;
    const barHeight = height - padding * 2;
    const barX = width - padding / 2 - barWidth / 2;
    const barY = padding;

    const gradient = this.ctx.createLinearGradient(barX, barY + barHeight, barX, barY);
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      gradient.addColorStop(t, rgbToCSS(getColor(colorScheme, t)));
    }

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);

    this.ctx.fillStyle = labelColor;
    this.ctx.font = `${fontSize - 1}px monospace`;

    const ticks = [0, 0.25, 0.5, 0.75, 1];
    for (const t of ticks) {
      const y = barY + barHeight * (1 - t);
      this.ctx.beginPath();
      this.ctx.moveTo(barX + barWidth, y);
      this.ctx.lineTo(barX + barWidth + 3, y);
      this.ctx.stroke();
    }

    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(max.toFixed(3), barX + barWidth / 2, barY - 8);
    this.ctx.fillText(min.toFixed(3), barX + barWidth / 2, barY + barHeight + 8);
  }

  toDataURL(format: 'png' | 'jpeg' = 'png'): string {
    return this.canvas.toDataURL(`image/${format}`);
  }
}
