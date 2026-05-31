/**
 * @fileoverview Utilities for rendering calibration reports to binary formats.
 * Generates heatmap PNGs and PDF summaries from mesh data and analysis.
 *
 * @module main/services/calibration/report/ReportRenderer
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PNG } from 'pngjs';
import type { AnalysisResult, CalibrationSettings, MeshData, WorkflowData } from '../../../../shared/types/calibration';

type ColorStop = { position: number; color: [number, number, number] };

const VIRIDIS_STOPS: ColorStop[] = [
  { position: 0.0, color: [68, 1, 84] },
  { position: 0.1, color: [72, 40, 120] },
  { position: 0.2, color: [62, 74, 137] },
  { position: 0.3, color: [49, 104, 142] },
  { position: 0.4, color: [38, 130, 142] },
  { position: 0.5, color: [31, 158, 137] },
  { position: 0.6, color: [53, 183, 121] },
  { position: 0.7, color: [109, 205, 89] },
  { position: 0.8, color: [180, 222, 44] },
  { position: 0.9, color: [223, 227, 24] },
  { position: 1.0, color: [253, 231, 37] },
];

const PLASMA_STOPS: ColorStop[] = [
  { position: 0.0, color: [13, 8, 135] },
  { position: 0.1, color: [75, 3, 161] },
  { position: 0.2, color: [125, 3, 168] },
  { position: 0.3, color: [168, 34, 150] },
  { position: 0.4, color: [203, 70, 121] },
  { position: 0.5, color: [229, 107, 93] },
  { position: 0.6, color: [248, 148, 65] },
  { position: 0.7, color: [253, 195, 40] },
  { position: 0.8, color: [240, 249, 33] },
  { position: 1.0, color: [240, 249, 33] },
];

const INFERNO_STOPS: ColorStop[] = [
  { position: 0.0, color: [0, 0, 4] },
  { position: 0.1, color: [40, 11, 84] },
  { position: 0.2, color: [89, 13, 115] },
  { position: 0.3, color: [137, 27, 100] },
  { position: 0.4, color: [181, 50, 64] },
  { position: 0.5, color: [219, 87, 26] },
  { position: 0.6, color: [244, 130, 7] },
  { position: 0.7, color: [252, 180, 31] },
  { position: 0.8, color: [250, 230, 102] },
  { position: 1.0, color: [252, 255, 164] },
];

const COOLWARM_STOPS: ColorStop[] = [
  { position: 0.0, color: [59, 76, 192] },
  { position: 0.1, color: [98, 130, 234] },
  { position: 0.2, color: [141, 176, 254] },
  { position: 0.3, color: [184, 208, 249] },
  { position: 0.4, color: [221, 221, 221] },
  { position: 0.5, color: [245, 245, 245] },
  { position: 0.6, color: [249, 196, 178] },
  { position: 0.7, color: [244, 154, 123] },
  { position: 0.8, color: [221, 96, 73] },
  { position: 0.9, color: [192, 40, 40] },
  { position: 1.0, color: [180, 4, 38] },
];

const COLOR_SCALES: Record<string, ColorStop[]> = {
  viridis: VIRIDIS_STOPS,
  plasma: PLASMA_STOPS,
  inferno: INFERNO_STOPS,
  coolwarm: COOLWARM_STOPS,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getColor(scheme: string, t: number): [number, number, number] {
  const stops = COLOR_SCALES[scheme] || COLOR_SCALES.viridis;
  const normalized = clamp01(t);
  let lower = stops[0];
  let upper = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (normalized >= stops[i].position && normalized <= stops[i + 1].position) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  const range = upper.position - lower.position;
  const localT = range > 0 ? (normalized - lower.position) / range : 0;

  return [
    Math.round(lerp(lower.color[0], upper.color[0], localT)),
    Math.round(lerp(lower.color[1], upper.color[1], localT)),
    Math.round(lerp(lower.color[2], upper.color[2], localT)),
  ];
}

function setPixel(data: Buffer, width: number, x: number, y: number, r: number, g: number, b: number, a = 255) {
  const idx = (width * y + x) * 4;
  data[idx] = r;
  data[idx + 1] = g;
  data[idx + 2] = b;
  data[idx + 3] = a;
}

export interface HeatmapRenderOptions {
  cellSize?: number;
  padding?: number;
  colorScheme?: CalibrationSettings['visualization']['colorScheme'];
  showGrid?: boolean;
}

export function renderHeatmapPNG(meshData: MeshData, options: HeatmapRenderOptions = {}): Buffer {
  const matrix = meshData.matrix;
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  if (rows === 0 || cols === 0) {
    throw new Error('Mesh data is empty');
  }

  const cellSize = options.cellSize ?? 24;
  const padding = options.padding ?? 20;
  const showGrid = options.showGrid ?? true;
  const scheme = options.colorScheme ?? 'viridis';

  const width = cols * cellSize + padding * 2;
  const height = rows * cellSize + padding * 2;

  const png = new PNG({ width, height });
  png.data.fill(255);

  const values = matrix.flat();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const value = matrix[row][col];
      const t = range > 0 ? (value - min) / range : 0.5;
      const [r, g, b] = getColor(scheme, t);

      const startX = padding + col * cellSize;
      const startY = padding + row * cellSize;

      for (let y = startY; y < startY + cellSize; y++) {
        for (let x = startX; x < startX + cellSize; x++) {
          setPixel(png.data, width, x, y, r, g, b, 255);
        }
      }
    }
  }

  if (showGrid && cellSize >= 6) {
    const gridColor = [32, 32, 32];
    for (let row = 0; row <= rows; row++) {
      const y = padding + row * cellSize;
      if (y >= 0 && y < height) {
        for (let x = padding; x < padding + cols * cellSize; x++) {
          setPixel(png.data, width, x, y, gridColor[0], gridColor[1], gridColor[2], 255);
        }
      }
    }
    for (let col = 0; col <= cols; col++) {
      const x = padding + col * cellSize;
      if (x >= 0 && x < width) {
        for (let y = padding; y < padding + rows * cellSize; y++) {
          setPixel(png.data, width, x, y, gridColor[0], gridColor[1], gridColor[2], 255);
        }
      }
    }
  }

  return PNG.sync.write(png);
}

export interface ReportPDFOptions {
  contextId: string;
  meshData: MeshData;
  analysis: AnalysisResult | null;
  workflow: WorkflowData | null;
  settings: CalibrationSettings;
}

export async function renderReportPDF(options: ReportPDFOptions): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 40;
  let cursorY = page.getHeight() - margin;

  page.drawText('Calibration Report', {
    x: margin,
    y: cursorY,
    size: 20,
    font: fontBold,
    color: rgb(0.12, 0.12, 0.12),
  });
  cursorY -= 26;

  const timestamp = new Date().toISOString();
  page.drawText(`Context: ${options.contextId}`, { x: margin, y: cursorY, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
  cursorY -= 16;
  page.drawText(`Generated: ${timestamp}`, { x: margin, y: cursorY, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
  cursorY -= 22;

  const summaryLines: string[] = [];
  if (options.analysis) {
    summaryLines.push(`Mesh range: ${options.analysis.meshRange.toFixed(4)} mm`);
    summaryLines.push(`Max deviation: ${options.analysis.maxDeviation.toFixed(4)} mm`);
    summaryLines.push(`Std dev: ${options.analysis.standardDeviation.toFixed(4)} mm`);
  }
  if (options.workflow) {
    summaryLines.push(`Improvement: ${options.workflow.improvementPercent.toFixed(1)}%`);
  }

  if (summaryLines.length > 0) {
    page.drawText('Summary', { x: margin, y: cursorY, size: 13, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
    cursorY -= 18;
    for (const line of summaryLines) {
      page.drawText(`• ${line}`, { x: margin + 4, y: cursorY, size: 11, font, color: rgb(0.25, 0.25, 0.25) });
      cursorY -= 14;
    }
    cursorY -= 6;
  }

  const heatmapPng = renderHeatmapPNG(options.meshData, {
    colorScheme: options.settings.visualization.colorScheme,
    cellSize: 24,
    padding: 16,
  });
  const image = await pdfDoc.embedPng(heatmapPng);
  const maxWidth = page.getWidth() - margin * 2;
  const maxHeight = cursorY - margin;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  const imageX = margin;
  const imageY = Math.max(margin, cursorY - imageHeight);

  page.drawImage(image, {
    x: imageX,
    y: imageY,
    width: imageWidth,
    height: imageHeight,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
