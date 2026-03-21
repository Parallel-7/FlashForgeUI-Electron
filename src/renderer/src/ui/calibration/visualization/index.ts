/**
 * @fileoverview Exports for the calibration visualization module.
 * Provides canvas-based visualization components for bed mesh heatmaps.
 *
 * @module renderer/ui/calibration/visualization
 */

export type { RecommendationVisualizerOptions } from './AnimatedRecommendationVisualizer';
export { AnimatedRecommendationVisualizer } from './AnimatedRecommendationVisualizer';
export type {
  CellInfo,
  VisualizerEventHandlers,
  VisualizerOptions,
} from './BedMeshVisualizer';
export {
  BedMeshVisualizer,
  createVisualizer,
  DEFAULT_VISUALIZER_OPTIONS,
} from './BedMeshVisualizer';
export type { ColorScheme, ColorStop, RGB } from './ColorScales';
export {
  createColorMapper,
  createDivergingMapper,
  generateCSSGradient,
  generateGradient,
  getAvailableSchemes,
  getColor,
  getCSSColor,
  rgbToCSS,
  rgbToHex,
} from './ColorScales';
export type { ShaperPlotOptions } from './ShaperPlotVisualizer';
export { ShaperPlotVisualizer } from './ShaperPlotVisualizer';
