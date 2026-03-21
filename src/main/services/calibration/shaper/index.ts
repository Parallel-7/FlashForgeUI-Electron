/**
 * @fileoverview Exports for the input shaper calibration module.
 * Provides FFT processing and shaper analysis for resonance compensation.
 *
 * @module main/services/calibration/shaper
 */

export type { FFTOptions } from './FFTProcessor';
export { DEFAULT_FFT_OPTIONS, FFTProcessor } from './FFTProcessor';

export {
  getAllShaperDefinitions,
  getShaperDefinition,
  SHAPER_DEFINITIONS,
  ShaperAnalyzer,
} from './ShaperAnalyzer';
