/**
 * @fileoverview Canvas-based bed mesh visualization component.
 * Renders 2D heatmap of bed mesh data with color-coded height values.
 * Supports interactive features like hover tooltips and click handlers.
 *
 * @module renderer/ui/calibration/visualization/BedMeshVisualizer
 */

import type { AnalysisResult, BedCorners, MeshData } from '../../../../../shared/types/calibration';
import {
  type ColorScheme,
  createColorMapper,
  createDivergingMapper,
  generateCSSGradient,
  getColor,
  type RGB,
  rgbToCSS,
} from './ColorScales';

/**
 * Configuration options for the visualizer.
 */
export interface VisualizerOptions {
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Padding around the mesh area */
  padding: number;
  /** Color scheme to use */
  colorScheme: ColorScheme;
  /** Whether to show grid lines */
  showGrid: boolean;
  /** Whether to show value labels */
  showLabels: boolean;
  /** Whether to show corner markers */
  showCorners: boolean;
  /** Interpolation factor for smoother display */
  interpolationFactor: number;
  /** Font size for labels */
  fontSize: number;
  /** Grid line color */
  gridColor: string;
  /** Label text color */
  labelColor: string;
  /** Background color */
  backgroundColor: string;
}

/**
 * Default visualizer options.
 */
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

/**
 * Cell information for hover/click events.
 */
export interface CellInfo {
  row: number;
  col: number;
  value: number;
  x: number;
  y: number;
}

/**
 * Event handlers for the visualizer.
 */
export interface VisualizerEventHandlers {
  onCellHover?: (cell: CellInfo | null) => void;
  onCellClick?: (cell: CellInfo) => void;
}

/**
 * Canvas-based bed mesh visualizer.
 */
export class BedMeshVisualizer {
  /** Target canvas element */
  private readonly canvas: HTMLCanvasElement;

  /** Canvas 2D rendering context */
  private readonly ctx: CanvasRenderingContext2D;

  /** Current mesh data */
  private meshData: MeshData | null = null;

  /** Current analysis result */
  private analysisResult: AnalysisResult | null = null;

  /** Visualizer options */
  private options: VisualizerOptions;

  /** Event handlers */
  private handlers: VisualizerEventHandlers = {};

  /** Currently hovered cell */
  private hoveredCell: CellInfo | null = null;

  /** Cached interpolated mesh for rendering */
  private interpolatedMesh: number[][] | null = null;

  /** Device pixel ratio for high-DPI displays */
  private readonly dpr: number;

  /**
   * Create a new bed mesh visualizer.
   *
   * @param canvas - Target canvas element
   * @param options - Visualizer options
   */
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

  /**
   * Set up the canvas size and scaling.
   */
  private setupCanvas(): void {
    const { width, height } = this.options;

    // Set canvas size accounting for DPI
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Scale context for high-DPI
    this.ctx.scale(this.dpr, this.dpr);
  }

  /**
   * Set up mouse event listeners.
   */
  private setupEventListeners(): void {
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.addEventListener('click', this.handleClick.bind(this));
  }

  /**
   * Handle mouse move events.
   */
  private handleMouseMove(event: MouseEvent): void {
    const cell = this.getCellAtPosition(event.offsetX, event.offsetY);

    if (cell !== this.hoveredCell) {
      this.hoveredCell = cell;
      this.handlers.onCellHover?.(cell);
      this.render();
    }
  }

  /**
   * Handle mouse leave events.
   */
  private handleMouseLeave(): void {
    if (this.hoveredCell) {
      this.hoveredCell = null;
      this.handlers.onCellHover?.(null);
      this.render();
    }
  }

  /**
   * Handle click events.
   */
  private handleClick(event: MouseEvent): void {
    const cell = this.getCellAtPosition(event.offsetX, event.offsetY);
    if (cell) {
      this.handlers.onCellClick?.(cell);
    }
  }

  /**
   * Get the cell at a canvas position.
   */
  private getCellAtPosition(x: number, y: number): CellInfo | null {
    if (!this.meshData) return null;

    const { width, height, padding } = this.options;
    const meshWidth = width - padding * 2;
    const meshHeight = height - padding * 2;

    // Check if within mesh area
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

  /**
   * Set event handlers.
   *
   * @param handlers - Event handler functions
   */
  setEventHandlers(handlers: VisualizerEventHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Update visualizer options.
   *
   * @param options - New options to merge
   */
  updateOptions(options: Partial<VisualizerOptions>): void {
    this.options = { ...this.options, ...options };
    this.interpolatedMesh = null; // Invalidate cache
    this.setupCanvas();
    this.render();
  }

  /**
   * Set mesh data to visualize.
   *
   * @param meshData - Mesh data from calibration
   * @param analysisResult - Optional analysis result for annotations
   */
  setMeshData(meshData: MeshData | null, analysisResult?: AnalysisResult | null): void {
    this.meshData = meshData;
    this.analysisResult = analysisResult ?? null;
    this.interpolatedMesh = null; // Invalidate cache
    this.render();
  }

  /**
   * Interpolate mesh data for smoother visualization.
   */
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
        // Bilinear interpolation
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
        const value = v0 * (1 - ty) + v1 * ty;

        row.push(value);
      }
      result.push(row);
    }

    return result;
  }

  /**
   * Get min/max values from mesh.
   */
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

  /**
   * Render the mesh visualization.
   */
  render(): void {
    const { width, height, backgroundColor } = this.options;

    // Clear canvas
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, width, height);

    if (!this.meshData) {
      this.renderEmptyState();
      return;
    }

    // Cache interpolated mesh
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

  /**
   * Render empty state message.
   */
  private renderEmptyState(): void {
    const { width, height, labelColor } = this.options;

    this.ctx.fillStyle = labelColor;
    this.ctx.font = '14px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('No mesh data loaded', width / 2, height / 2);
  }

  /**
   * Render the heatmap cells.
   */
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

  /**
   * Render grid lines.
   */
  private renderGrid(): void {
    if (!this.options.showGrid || !this.meshData) return;

    const { width, height, padding, gridColor } = this.options;
    const meshWidth = width - padding * 2;
    const meshHeight = height - padding * 2;
    const { pointsX, pointsY } = this.meshData;

    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    // Vertical lines
    for (let i = 0; i <= pointsX; i++) {
      const x = padding + (i / pointsX) * meshWidth;
      this.ctx.moveTo(x, padding);
      this.ctx.lineTo(x, height - padding);
    }

    // Horizontal lines
    for (let i = 0; i <= pointsY; i++) {
      const y = padding + (i / pointsY) * meshHeight;
      this.ctx.moveTo(padding, y);
      this.ctx.lineTo(width - padding, y);
    }

    this.ctx.stroke();
  }

  /**
   * Render value labels on cells.
   */
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

        // Add text shadow for readability
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 2;
        this.ctx.fillText(value.toFixed(3), x, y);
        this.ctx.shadowBlur = 0;
      }
    }
  }

  /**
   * Render corner markers and labels.
   */
  private renderCorners(): void {
    if (!this.options.showCorners || !this.meshData) return;

    const { width, height, padding, fontSize, labelColor } = this.options;

    const corners = [
      { label: 'Front Left', x: padding, y: height - padding },
      { label: 'Front Right', x: width - padding, y: height - padding },
      { label: 'Rear Left', x: padding, y: padding },
      { label: 'Rear Right', x: width - padding, y: padding },
    ];

    this.ctx.fillStyle = labelColor;
    this.ctx.font = `${fontSize}px sans-serif`;

    for (const corner of corners) {
      // Draw corner marker
      this.ctx.beginPath();
      this.ctx.arc(corner.x, corner.y, 4, 0, Math.PI * 2);
      this.ctx.fill();

      // Position label based on corner
      let _textX = corner.x;
      let _textY = corner.y;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      if (corner.x < width / 2) {
        _textX -= 5;
        this.ctx.textAlign = 'right';
      } else {
        _textX += 5;
        this.ctx.textAlign = 'left';
      }

      if (corner.y < height / 2) {
        _textY -= 10;
      } else {
        _textY += 10;
      }
    }
  }

  /**
   * Render hover highlight.
   */
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

    // Draw highlight border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, cellWidth, cellHeight);

    // Draw tooltip
    const tooltipText = `[${row}, ${col}]: ${value.toFixed(4)} mm`;
    const tooltipPadding = 5;
    this.ctx.font = '12px monospace';
    const textWidth = this.ctx.measureText(tooltipText).width;

    let tooltipX = x + cellWidth / 2 - textWidth / 2 - tooltipPadding;
    let tooltipY = y - 25;

    // Keep tooltip within canvas bounds
    tooltipX = Math.max(5, Math.min(width - textWidth - tooltipPadding * 2 - 5, tooltipX));
    if (tooltipY < 5) tooltipY = y + cellHeight + 5;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(tooltipX, tooltipY, textWidth + tooltipPadding * 2, 20);

    this.ctx.fillStyle = labelColor;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(tooltipText, tooltipX + tooltipPadding, tooltipY + 10);
  }

  /**
   * Render color bar legend.
   */
  private renderColorBar(): void {
    const { width, height, padding, colorScheme, labelColor, fontSize } = this.options;
    const { min, max } = this.getMeshBounds();

    const barWidth = 15;
    const barHeight = height - padding * 2;
    const barX = width - padding / 2 - barWidth / 2;
    const barY = padding;

    // Draw color gradient
    const gradient = this.ctx.createLinearGradient(barX, barY + barHeight, barX, barY);
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const color = getColor(colorScheme, t);
      gradient.addColorStop(t, rgbToCSS(color));
    }

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    // Draw border
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Draw tick marks and labels
    this.ctx.fillStyle = labelColor;
    this.ctx.font = `${fontSize - 1}px monospace`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';

    const ticks = [0, 0.25, 0.5, 0.75, 1];
    for (const t of ticks) {
      const _value = min + (max - min) * t;
      const y = barY + barHeight * (1 - t);

      // Tick mark
      this.ctx.beginPath();
      this.ctx.moveTo(barX + barWidth, y);
      this.ctx.lineTo(barX + barWidth + 3, y);
      this.ctx.stroke();
    }

    // Just show min/max labels
    this.ctx.textAlign = 'center';
    this.ctx.fillText(max.toFixed(3), barX + barWidth / 2, barY - 8);
    this.ctx.fillText(min.toFixed(3), barX + barWidth / 2, barY + barHeight + 8);
  }

  /**
   * Export canvas as data URL.
   *
   * @param format - Image format
   * @returns Data URL string
   */
  toDataURL(format: 'png' | 'jpeg' = 'png'): string {
    return this.canvas.toDataURL(`image/${format}`);
  }

  /**
   * Export canvas as blob.
   *
   * @param format - Image format
   * @returns Promise resolving to Blob
   */
  toBlob(format: 'png' | 'jpeg' = 'png'): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.canvas.toBlob(resolve, `image/${format}`);
    });
  }

  /**
   * Cleanup resources.
   */
  destroy(): void {
    this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.removeEventListener('click', this.handleClick.bind(this));
  }
}

/**
 * Create a bed mesh visualizer on a canvas element.
 *
 * @param canvasId - ID of the canvas element
 * @param options - Visualizer options
 * @returns BedMeshVisualizer instance
 */
export function createVisualizer(canvasId: string, options: Partial<VisualizerOptions> = {}): BedMeshVisualizer {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) {
    throw new Error(`Canvas element not found: ${canvasId}`);
  }
  return new BedMeshVisualizer(canvas, options);
}
