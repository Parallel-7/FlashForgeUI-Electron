/**
 * @fileoverview Animated visualization for screw adjustments and tape recommendations.
 *
 * @module renderer/ui/calibration/visualization/AnimatedRecommendationVisualizer
 */

import type { ScrewAdjustment, TapeRecommendation } from '../../../../../shared/types/calibration';

export interface RecommendationVisualizerOptions {
  width: number;
  height: number;
  padding: number;
  backgroundColor: string;
  bedColor: string;
  gridColor: string;
  textColor: string;
  cwColor: string;
  ccwColor: string;
  tapeColor: string;
  fontSize: number;
}

const DEFAULT_OPTIONS: RecommendationVisualizerOptions = {
  width: 620,
  height: 420,
  padding: 40,
  backgroundColor: '#141414',
  bedColor: '#1f1f1f',
  gridColor: 'rgba(255,255,255,0.1)',
  textColor: '#e0e0e0',
  cwColor: '#4caf50',
  ccwColor: '#ff9800',
  tapeColor: '#5cc8ff',
  fontSize: 12,
};

export class AnimatedRecommendationVisualizer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly dpr: number;
  private options: RecommendationVisualizerOptions;
  private screwAdjustments: ScrewAdjustment[] = [];
  private tapeRecommendations: TapeRecommendation[] = [];
  private animationFrame: number | null = null;
  private startTime = 0;

  constructor(canvas: HTMLCanvasElement, options: Partial<RecommendationVisualizerOptions> = {}) {
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

  updateOptions(options: Partial<RecommendationVisualizerOptions>): void {
    this.options = { ...this.options, ...options };
    this.setupCanvas();
    this.render(0);
  }

  setRecommendations(adjustments: ScrewAdjustment[], tape: TapeRecommendation[]): void {
    this.screwAdjustments = adjustments;
    this.tapeRecommendations = tape;
    this.render(0);
  }

  start(): void {
    if (this.animationFrame !== null) return;
    this.startTime = performance.now();
    const loop = (timestamp: number) => {
      this.render(timestamp);
      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private getCornerPositions(): Record<string, { x: number; y: number }> {
    const { width, height, padding } = this.options;
    const bedWidth = width - padding * 2;
    const bedHeight = height - padding * 2;
    const left = padding;
    const right = padding + bedWidth;
    const top = padding;
    const bottom = padding + bedHeight;

    return {
      frontLeft: { x: left, y: bottom },
      frontRight: { x: right, y: bottom },
      rearLeft: { x: left, y: top },
      rearRight: { x: right, y: top },
    };
  }

  private drawBed(): void {
    const { width, height, padding, bedColor, gridColor } = this.options;
    const bedWidth = width - padding * 2;
    const bedHeight = height - padding * 2;

    this.ctx.fillStyle = bedColor;
    this.ctx.fillRect(padding, padding, bedWidth, bedHeight);

    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(padding, padding, bedWidth, bedHeight);

    // Simple grid
    const gridCount = 4;
    for (let i = 1; i < gridCount; i++) {
      const x = padding + (i / gridCount) * bedWidth;
      const y = padding + (i / gridCount) * bedHeight;
      this.ctx.beginPath();
      this.ctx.moveTo(x, padding);
      this.ctx.lineTo(x, padding + bedHeight);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(padding, y);
      this.ctx.lineTo(padding + bedWidth, y);
      this.ctx.stroke();
    }
  }

  private drawScrewAdjustment(corner: { x: number; y: number }, adjustment: ScrewAdjustment, pulse: number): void {
    const { cwColor, ccwColor, textColor, fontSize } = this.options;
    const color = adjustment.direction === 'CW' ? cwColor : ccwColor;
    const radius = 18 + pulse * 4;

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    const startAngle = adjustment.direction === 'CW' ? Math.PI * 1.1 : Math.PI * 0.1;
    const endAngle = adjustment.direction === 'CW' ? Math.PI * 0.1 : Math.PI * 1.1;
    this.ctx.arc(corner.x, corner.y, radius, startAngle, endAngle, adjustment.direction !== 'CW');
    this.ctx.stroke();

    // Arrow head
    const arrowAngle = adjustment.direction === 'CW' ? endAngle : startAngle;
    const arrowX = corner.x + radius * Math.cos(arrowAngle);
    const arrowY = corner.y + radius * Math.sin(arrowAngle);
    const arrowSize = 6;
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(arrowX, arrowY);
    this.ctx.lineTo(
      arrowX - arrowSize * Math.cos(arrowAngle - Math.PI / 6),
      arrowY - arrowSize * Math.sin(arrowAngle - Math.PI / 6)
    );
    this.ctx.lineTo(
      arrowX - arrowSize * Math.cos(arrowAngle + Math.PI / 6),
      arrowY - arrowSize * Math.sin(arrowAngle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = textColor;
    this.ctx.font = `${fontSize}px sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText(adjustment.formattedAmount, corner.x, corner.y - radius - 6);
  }

  private drawTapeRecommendation(corner: { x: number; y: number }, recommendation: TapeRecommendation): void {
    const { tapeColor, textColor, fontSize } = this.options;
    const size = 16;
    const offset = 10;

    this.ctx.fillStyle = tapeColor;
    this.ctx.fillRect(corner.x - size / 2, corner.y - offset - size / 2, size, size);

    this.ctx.fillStyle = textColor;
    this.ctx.font = `${fontSize}px sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(
      `${recommendation.layers} layer${recommendation.layers === 1 ? '' : 's'}`,
      corner.x,
      corner.y + 8
    );
  }

  private render(timestamp: number): void {
    const { width, height, backgroundColor, textColor, fontSize } = this.options;

    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, width, height);

    this.drawBed();

    const cornerPositions = this.getCornerPositions();
    const pulse = 0.5 + 0.5 * Math.sin((timestamp - this.startTime) / 400);

    const activeAdjustments = this.screwAdjustments.filter((adj) => adj.requiresAdjustment);
    activeAdjustments.forEach((adj) => {
      const corner = cornerPositions[adj.corner];
      if (corner) {
        this.drawScrewAdjustment(corner, adj, pulse);
      }
    });

    this.tapeRecommendations.forEach((rec) => {
      const corner = cornerPositions[rec.corner];
      if (corner) {
        this.drawTapeRecommendation(corner, rec);
      }
    });

    if (activeAdjustments.length === 0 && this.tapeRecommendations.length === 0) {
      this.ctx.fillStyle = textColor;
      this.ctx.font = `${fontSize + 2}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('No visual adjustments needed', width / 2, height / 2);
    }
  }
}
