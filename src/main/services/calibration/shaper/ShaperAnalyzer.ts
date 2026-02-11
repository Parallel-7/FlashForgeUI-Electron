/**
 * @fileoverview Input shaper analyzer for Klipper resonance compensation.
 * Evaluates different shaper types and recommends optimal configurations.
 * Based on Klipper's input shaping algorithms.
 *
 * @module main/services/calibration/shaper/ShaperAnalyzer
 */

import type {
  AxisCalibration,
  PowerSpectrum,
  ShaperDefinition,
  ShaperResult,
  ShaperType,
} from '../../../../shared/types/calibration';
import { type FFTOptions, FFTProcessor } from './FFTProcessor';

/**
 * Shaper definitions with their mathematical properties.
 * Based on Klipper's input_shaper.py
 */
export const SHAPER_DEFINITIONS: ShaperDefinition[] = [
  {
    type: 'zv' as ShaperType,
    name: 'ZV (Zero Vibration)',
    minFreq: 10,
    initFreq: 35,
    maxFreq: 100,
  },
  {
    type: 'mzv' as ShaperType,
    name: 'MZV (Modified ZV)',
    minFreq: 15,
    initFreq: 45,
    maxFreq: 100,
  },
  {
    type: 'ei' as ShaperType,
    name: 'EI (Extra Insensitive)',
    minFreq: 10,
    initFreq: 40,
    maxFreq: 100,
  },
  {
    type: '2hump_ei' as ShaperType,
    name: '2-Hump EI',
    minFreq: 15,
    initFreq: 50,
    maxFreq: 100,
  },
  {
    type: '3hump_ei' as ShaperType,
    name: '3-Hump EI',
    minFreq: 20,
    initFreq: 55,
    maxFreq: 100,
  },
];

/**
 * Shaper pulse coefficients.
 * These define the impulse response for each shaper type.
 */
const SHAPER_PULSES: Record<ShaperType, (freq: number) => { a: number[]; t: number[] }> = {
  zv: (freq: number) => {
    const df = 1 / (2 * freq);
    const K = Math.exp(-0.05 / (1 - 0.05 * 0.05));
    const a1 = 1 / (1 + K);
    const a2 = K / (1 + K);
    return { a: [a1, a2], t: [0, df] };
  },
  mzv: (freq: number) => {
    const df = 1 / (2 * freq);
    const K = Math.exp(-0.045 / Math.sqrt(1 - 0.045 * 0.045));
    const K2 = K * K;
    const a1 = 1 / (1 + K + K2);
    const a2 = K / (1 + K + K2);
    const a3 = K2 / (1 + K + K2);
    return { a: [a1, a2, a3], t: [0, df * 0.5, df] };
  },
  ei: (freq: number) => {
    const df = 1 / (2 * freq);
    const a1 = 0.25 * (1 + 1 / Math.E);
    const a2 = 0.5 * (1 - 1 / Math.E);
    const a3 = a1;
    return { a: [a1, a2, a3], t: [0, df, 2 * df] };
  },
  '2hump_ei': (freq: number) => {
    const df = 1 / (2 * freq);
    const e = 1 / Math.E;
    const e2 = e * e;
    const denom = 1 + 3 * e + e2;
    return {
      a: [(1 + e) / denom, (2 * e) / denom, e2 / denom + e / denom, e2 / denom],
      t: [0, df, 2 * df, 3 * df],
    };
  },
  '3hump_ei': (freq: number) => {
    const df = 1 / (2 * freq);
    const e = 1 / Math.E;
    const e2 = e * e;
    const e3 = e2 * e;
    const denom = 1 + 4 * e + 4 * e2 + e3;
    return {
      a: [
        (1 + 2 * e + e2) / denom,
        (2 * (e + e2)) / denom,
        (e2 + 2 * e + 1) / denom,
        (e2 + 2 * e3) / denom,
        e3 / denom,
      ],
      t: [0, df, 2 * df, 3 * df, 4 * df],
    };
  },
};

/**
 * Get smoothing time for a shaper at a given frequency.
 */
function getSmoothingTime(shaperType: ShaperType, frequency: number): number {
  const pulses = SHAPER_PULSES[shaperType](frequency);
  if (!pulses || pulses.t.length === 0) return 0;
  return pulses.t[pulses.t.length - 1] * 1000; // Convert to ms
}

/**
 * Estimate maximum recommended acceleration for a shaper.
 * Based on Klipper's formula: max_accel = shaper_freq^2 * max_tolerable_vibration_ratio / smoothing
 */
function estimateMaxAcceleration(shaperType: ShaperType, frequency: number, vibrationReduction: number): number {
  const smoothingMs = getSmoothingTime(shaperType, frequency);
  if (smoothingMs <= 0) return 10000;

  // Base formula adjusted for typical use
  const smoothingSeconds = smoothingMs / 1000;
  const maxAccel = (frequency * frequency * vibrationReduction) / (100 * smoothingSeconds);

  // Clamp to reasonable range
  return Math.min(20000, Math.max(500, Math.round(maxAccel / 100) * 100));
}

/**
 * Calculate vibration reduction for a shaper at a given frequency.
 * Estimates how well the shaper suppresses vibrations at the resonance frequency.
 */
function calculateVibrationReduction(shaperType: ShaperType, shaperFreq: number, resonanceFreq: number): number {
  const pulses = SHAPER_PULSES[shaperType](shaperFreq);
  if (!pulses) return 0;

  const { a, t } = pulses;
  const omega = 2 * Math.PI * resonanceFreq;

  // Calculate transfer function magnitude at resonance frequency
  let realSum = 0;
  let imagSum = 0;

  for (let i = 0; i < a.length; i++) {
    realSum += a[i] * Math.cos(omega * t[i]);
    imagSum += a[i] * Math.sin(omega * t[i]);
  }

  const magnitude = Math.sqrt(realSum * realSum + imagSum * imagSum);

  // Vibration reduction is 1 - magnitude (clamped to [0, 1])
  return Math.max(0, Math.min(1, 1 - magnitude));
}

/**
 * Score a shaper configuration.
 * Higher score is better.
 */
function scoreShaperConfig(vibrationReduction: number, smoothingTime: number, maxAccel: number): number {
  // Prioritize vibration reduction, penalize excessive smoothing
  const reductionScore = vibrationReduction * 100;
  const smoothingPenalty = Math.min(smoothingTime / 100, 0.5); // Penalize high smoothing
  const accelBonus = Math.min(maxAccel / 10000, 0.3); // Bonus for high max accel

  return reductionScore * (1 - smoothingPenalty) + accelBonus * 10;
}

/**
 * Input shaper analyzer.
 */
export class ShaperAnalyzer {
  private readonly fftProcessor: FFTProcessor;

  constructor(fftOptions: Partial<FFTOptions> = {}) {
    this.fftProcessor = new FFTProcessor(fftOptions);
  }

  /**
   * Analyze accelerometer data for a single axis.
   */
  analyzeAxis(csvContent: string, axis: 'x' | 'y'): AxisCalibration {
    // Parse CSV
    const data = this.fftProcessor.parseCSV(csvContent);

    // Get appropriate acceleration data
    const accelData = axis === 'x' ? data.accelX : data.accelY;

    // Process FFT
    const spectrum = this.fftProcessor.processAxis(accelData, data.sampleRate);

    // Find resonance peaks
    const peakFrequencies = this.fftProcessor.findPeaks(spectrum);

    // Use primary peak as resonance frequency
    const primaryResonance = spectrum.peakFrequency;

    // Evaluate all shapers
    const allResults = this.evaluateShapers(primaryResonance, spectrum);

    // Find best shaper
    const recommendedShaper = this.findBestShaper(allResults);

    return {
      axis,
      frequencyBins: spectrum.frequencies,
      powerSpectralDensity: spectrum.power,
      peakFrequencies,
      recommendedShaper,
      allShaperResults: allResults,
    };
  }

  /**
   * Evaluate all shaper types for a given resonance frequency.
   */
  evaluateShapers(resonanceFreq: number, spectrum: PowerSpectrum): ShaperResult[] {
    const results: ShaperResult[] = [];

    for (const definition of SHAPER_DEFINITIONS) {
      // Find optimal frequency for this shaper
      const optimalFreq = this.findOptimalFrequency(
        definition.type,
        resonanceFreq,
        spectrum,
        definition.minFreq,
        definition.maxFreq
      );

      const vibrationReduction = calculateVibrationReduction(definition.type, optimalFreq, resonanceFreq);

      const smoothingTime = getSmoothingTime(definition.type, optimalFreq);
      const maxAcceleration = estimateMaxAcceleration(definition.type, optimalFreq, vibrationReduction);

      const score = scoreShaperConfig(vibrationReduction, smoothingTime, maxAcceleration);

      results.push({
        type: definition.type,
        frequency: optimalFreq,
        vibrationReduction,
        smoothingTime,
        maxAcceleration,
        score,
      });
    }

    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Find the optimal shaper frequency for a given shaper type.
   */
  findOptimalFrequency(
    shaperType: ShaperType,
    resonanceFreq: number,
    spectrum: PowerSpectrum,
    minFreq: number,
    maxFreq: number
  ): number {
    // Search for frequency that gives best vibration reduction
    let bestFreq = resonanceFreq;
    let bestReduction = 0;

    // Search in steps around the resonance frequency
    const step = 0.5;
    const searchMin = Math.max(minFreq, resonanceFreq * 0.5);
    const searchMax = Math.min(maxFreq, resonanceFreq * 2);

    for (let freq = searchMin; freq <= searchMax; freq += step) {
      // Calculate total vibration reduction across spectrum
      let totalReduction = 0;
      let totalWeight = 0;

      for (let i = 0; i < spectrum.frequencies.length; i++) {
        const power = spectrum.power[i];
        const reduction = calculateVibrationReduction(shaperType, freq, spectrum.frequencies[i]);
        totalReduction += reduction * power;
        totalWeight += power;
      }

      const avgReduction = totalWeight > 0 ? totalReduction / totalWeight : 0;

      if (avgReduction > bestReduction) {
        bestReduction = avgReduction;
        bestFreq = freq;
      }
    }

    return Math.round(bestFreq * 10) / 10; // Round to 0.1 Hz
  }

  /**
   * Find the best shaper from evaluation results.
   */
  findBestShaper(results: ShaperResult[]): ShaperResult {
    // Results are already sorted by score
    return results[0];
  }

  /**
   * Generate Klipper configuration lines for a shaper result.
   */
  generateKlipperConfig(axis: 'x' | 'y', result: ShaperResult): string[] {
    const lines: string[] = [];
    lines.push(`[input_shaper]`);
    lines.push(`shaper_freq_${axis}: ${result.frequency.toFixed(1)}`);
    lines.push(`shaper_type_${axis}: ${result.type}`);
    return lines;
  }

  /**
   * Generate a full report for axis calibration.
   */
  generateReport(calibration: AxisCalibration): string {
    const lines: string[] = [];

    lines.push(`Input Shaper Calibration Report - ${calibration.axis.toUpperCase()} Axis`);
    lines.push('='.repeat(50));
    lines.push('');

    lines.push(`Peak Resonance Frequency: ${calibration.peakFrequencies[0]?.toFixed(1) || 'N/A'} Hz`);
    lines.push('');

    lines.push('Recommended Shaper:');
    lines.push(`  Type: ${calibration.recommendedShaper.type.toUpperCase()}`);
    lines.push(`  Frequency: ${calibration.recommendedShaper.frequency.toFixed(1)} Hz`);
    lines.push(`  Vibration Reduction: ${(calibration.recommendedShaper.vibrationReduction * 100).toFixed(1)}%`);
    lines.push(`  Smoothing: ${calibration.recommendedShaper.smoothingTime.toFixed(2)} ms`);
    lines.push(`  Max Accel: ${calibration.recommendedShaper.maxAcceleration} mm/s²`);
    lines.push('');

    lines.push('All Shapers (sorted by score):');
    for (const result of calibration.allShaperResults) {
      lines.push(`  ${result.type.padEnd(10)} @ ${result.frequency.toFixed(1).padStart(5)} Hz`);
      lines.push(
        `    - Vibration: ${(result.vibrationReduction * 100).toFixed(1)}%, ` +
          `Smooth: ${result.smoothingTime.toFixed(2)}ms, ` +
          `Score: ${result.score.toFixed(1)}`
      );
    }
    lines.push('');

    lines.push('Klipper Configuration:');
    const config = this.generateKlipperConfig(calibration.axis, calibration.recommendedShaper);
    for (const line of config) {
      lines.push(`  ${line}`);
    }

    return lines.join('\n');
  }
}

/**
 * Get shaper definition by type.
 */
export function getShaperDefinition(type: ShaperType): ShaperDefinition | undefined {
  return SHAPER_DEFINITIONS.find((d) => d.type === type);
}

/**
 * Get all shaper definitions.
 */
export function getAllShaperDefinitions(): ShaperDefinition[] {
  return [...SHAPER_DEFINITIONS];
}
