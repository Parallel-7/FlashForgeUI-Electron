/**
 * @fileoverview Responsive layout controller that normalizes GridStack scaling.
 *
 * Computes viewport-driven scale metrics, updates CSS custom properties,
 * and keeps GridStack's cell height/margins synchronized so the desktop UI
 * looks consistent from minimum window size up to fullscreen.
 *
 * Key responsibilities:
 * - Observe window/tabs size changes and derive layout scale factors
 * - Expose metrics like layout/font/density scale through CSS variables
 * - Update GridStack cell height + margins at runtime without reloading
 * - Provide a singleton controller that renderer.ts initializes once
 */

import type { GridStackManager } from '../gridstack/GridStackManager';

interface ResponsiveScaleMetrics {
  readonly layoutScale: number;
  readonly fontScale: number;
  readonly densityScale: number;
  readonly cellHeight: number;
  readonly margin: number;
  readonly availableHeight: number;
}

const BASE_WIDTH = 1600;
const BASE_HEIGHT = 900;
const MIN_SCALE = 0.65;
const MAX_SCALE = 1.1;
const ESTIMATED_ROWS = 10;
const BASE_CELL_HEIGHT = 80;
const MIN_CELL_HEIGHT = 56;
const MAX_CELL_HEIGHT = 112;
const MIN_MARGIN = 4;
const MAX_MARGIN = 16;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export class ResponsiveLayoutController {
  private gridManager: GridStackManager | null = null;
  private initialized = false;
  private resizeTimeout: number | null = null;
  private currentMetrics: ResponsiveScaleMetrics | null = null;
  private tabsObserver: ResizeObserver | null = null;

  /**
   * Initialize global listeners once per session.
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    window.addEventListener('resize', this.handleResize);

    const runSetup = (): void => {
      this.observeTabsContainer();
      this.recalculateMetrics();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runSetup, { once: true });
    } else {
      runSetup();
    }
  }

  /**
   * Allow renderer.ts to attach the live GridStack manager for metric updates.
   */
  attachGridManager(manager: GridStackManager): void {
    this.gridManager = manager;
    if (this.currentMetrics) {
      this.applyGridMetrics(this.currentMetrics);
    } else {
      this.recalculateMetrics();
    }
  }

  /**
   * Public hook for any code that needs to force a recompute (e.g. after UI storms).
   */
  forceRecalculate(): void {
    this.recalculateMetrics();
  }

  /**
   * Retrieve the last computed metrics (useful for debugging).
   */
  getMetrics(): ResponsiveScaleMetrics | null {
    return this.currentMetrics;
  }

  /**
   * Cleanup listeners – primarily useful for tests.
   */
  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    if (this.tabsObserver) {
      this.tabsObserver.disconnect();
      this.tabsObserver = null;
    }
    this.resizeTimeout = null;
    this.gridManager = null;
    this.initialized = false;
  }

  private readonly handleResize = (): void => {
    if (this.resizeTimeout !== null) {
      window.clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = window.setTimeout(() => {
      this.resizeTimeout = null;
      this.recalculateMetrics();
    }, 120);
  };

  private recalculateMetrics(): void {
    const metrics = this.calculateMetrics();
    this.currentMetrics = metrics;
    this.applyCssVariables(metrics);
    this.applyGridMetrics(metrics);
  }

  private calculateMetrics(): ResponsiveScaleMetrics {
    const headerHeight = document.querySelector('.header')?.getBoundingClientRect().height ?? 0;
    const tabsHeight =
      document.getElementById('printer-tabs-container')?.getBoundingClientRect().height ?? 0;
    const reservedHeight = headerHeight + tabsHeight;
    const availableHeight = Math.max(window.innerHeight - reservedHeight, 480);

    const widthRatio = window.innerWidth / BASE_WIDTH;
    const heightRatio = availableHeight / BASE_HEIGHT;
    const layoutScale = clamp(Math.min(widthRatio, heightRatio), MIN_SCALE, MAX_SCALE);
    const fontScale = clamp(layoutScale + 0.05, 0.9, 1.12);
    const densityScale = clamp(layoutScale, 0.7, 1.05);

    const maxCellFromViewport = Math.floor(
      (availableHeight - MIN_MARGIN * 2) / ESTIMATED_ROWS
    );
    const scaledCell = Math.round(BASE_CELL_HEIGHT * densityScale);
    const cellHeight = clamp(
      Math.min(scaledCell, maxCellFromViewport),
      MIN_CELL_HEIGHT,
      MAX_CELL_HEIGHT
    );

    const scaledMargin = clamp(Math.round(8 * densityScale), MIN_MARGIN, MAX_MARGIN);

    return {
      layoutScale,
      fontScale,
      densityScale,
      cellHeight,
      margin: scaledMargin,
      availableHeight
    };
  }

  private applyCssVariables(metrics: ResponsiveScaleMetrics): void {
    const root = document.documentElement;
    root.style.setProperty('--layout-scale', metrics.layoutScale.toFixed(3));
    root.style.setProperty('--layout-font-scale', metrics.fontScale.toFixed(3));
    root.style.setProperty('--layout-density-scale', metrics.densityScale.toFixed(3));
    root.style.setProperty('--grid-cell-height', `${metrics.cellHeight}px`);
    root.style.setProperty('--layout-available-height', `${metrics.availableHeight}px`);
  }

  private applyGridMetrics(metrics: ResponsiveScaleMetrics): void {
    if (!this.gridManager || !this.gridManager.getGrid()) {
      return;
    }

    try {
      this.gridManager.setCellHeight(`${metrics.cellHeight}px`);
      this.gridManager.setMargin(metrics.margin);
    } catch (error) {
      console.warn('[ResponsiveLayoutController] Failed to apply grid metrics:', error);
    }
  }

  private observeTabsContainer(): void {
    if (!('ResizeObserver' in window)) {
      return;
    }

    const tabsContainer = document.getElementById('printer-tabs-container');
    if (!tabsContainer) {
      return;
    }

    this.tabsObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.tabsObserver.observe(tabsContainer);
  }
}

export const responsiveLayoutController = new ResponsiveLayoutController();
