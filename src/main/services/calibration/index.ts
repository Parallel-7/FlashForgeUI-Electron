/**
 * @fileoverview Main exports for the calibration module.
 * Provides access to all calibration services including engine components,
 * parsers, SSH connectivity, and input shaper analysis.
 *
 * @module main/services/calibration
 */

// Engine exports
export * from './engine';
export type { ParseResult } from './parsers/KlipperConfigParser';
// Parser exports
export { KlipperConfigParser, klipperConfigParser } from './parsers/KlipperConfigParser';
export type { FFTOptions } from './shaper';
// Shaper exports
export {
  DEFAULT_FFT_OPTIONS,
  FFTProcessor,
  getAllShaperDefinitions,
  getShaperDefinition,
  SHAPER_DEFINITIONS,
  ShaperAnalyzer,
} from './shaper';
export type {
  CommandResult,
  SSHConnection,
  SSHConnectionManagerEvents,
} from './ssh';
// SSH exports
export {
  DEFAULT_REMOTE_PATHS,
  getSSHConnectionManager,
  SCPFileTransfer,
  SSHConnectionManager,
} from './ssh';
