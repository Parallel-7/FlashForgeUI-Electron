/**
 * @fileoverview Fast Fourier Transform processor for accelerometer data.
 * Provides frequency domain analysis of vibration data for input shaper calibration.
 * Uses a pure TypeScript implementation suitable for Web Worker execution.
 *
 * @module main/services/calibration/shaper/FFTProcessor
 */

import type { AccelerometerData, PowerSpectrum } from '../../../../shared/types/calibration';

/**
 * FFT processing options.
 */
export interface FFTOptions {
  /** Window function to apply ('hanning', 'hamming', 'blackman', 'none') */
  windowFunction: 'hanning' | 'hamming' | 'blackman' | 'none';
  /** Minimum frequency to include in output (Hz) */
  minFreq: number;
  /** Maximum frequency to include in output (Hz) */
  maxFreq: number;
  /** Whether to normalize the power spectrum */
  normalize: boolean;
}

/**
 * Default FFT options.
 */
export const DEFAULT_FFT_OPTIONS: FFTOptions = {
  windowFunction: 'hanning',
  minFreq: 5,
  maxFreq: 200,
  normalize: true,
};

/**
 * Complex number representation.
 */
interface Complex {
  re: number;
  im: number;
}

/**
 * Multiply two complex numbers.
 */
function complexMultiply(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

/**
 * Add two complex numbers.
 */
function complexAdd(a: Complex, b: Complex): Complex {
  return {
    re: a.re + b.re,
    im: a.im + b.im,
  };
}

/**
 * Subtract two complex numbers.
 */
function complexSubtract(a: Complex, b: Complex): Complex {
  return {
    re: a.re - b.re,
    im: a.im - b.im,
  };
}

/**
 * Compute the magnitude of a complex number.
 */
function complexMagnitude(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

/**
 * Generate a Hanning window.
 */
function hanningWindow(n: number): number[] {
  const window: number[] = [];
  for (let i = 0; i < n; i++) {
    window.push(0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1))));
  }
  return window;
}

/**
 * Generate a Hamming window.
 */
function hammingWindow(n: number): number[] {
  const window: number[] = [];
  for (let i = 0; i < n; i++) {
    window.push(0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return window;
}

/**
 * Generate a Blackman window.
 */
function blackmanWindow(n: number): number[] {
  const window: number[] = [];
  const a0 = 0.42;
  const a1 = 0.5;
  const a2 = 0.08;
  for (let i = 0; i < n; i++) {
    window.push(a0 - a1 * Math.cos((2 * Math.PI * i) / (n - 1)) + a2 * Math.cos((4 * Math.PI * i) / (n - 1)));
  }
  return window;
}

/**
 * Apply a window function to data.
 */
function applyWindow(data: number[], windowType: FFTOptions['windowFunction']): number[] {
  const n = data.length;
  let window: number[];

  switch (windowType) {
    case 'hanning':
      window = hanningWindow(n);
      break;
    case 'hamming':
      window = hammingWindow(n);
      break;
    case 'blackman':
      window = blackmanWindow(n);
      break;
    case 'none':
    default:
      return [...data];
  }

  return data.map((v, i) => v * window[i]);
}

/**
 * Pad array to next power of 2.
 */
function padToPowerOf2(data: number[]): number[] {
  const n = data.length;
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
  if (nextPow2 === n) return data;

  const padded = new Array(nextPow2).fill(0);
  for (let i = 0; i < n; i++) {
    padded[i] = data[i];
  }
  return padded;
}

/**
 * Cooley-Tukey FFT implementation.
 * Computes the discrete Fourier transform of the input array.
 */
function fft(input: Complex[]): Complex[] {
  const n = input.length;

  // Base case
  if (n <= 1) return input;

  // Ensure n is power of 2
  if (n & (n - 1)) {
    throw new Error('FFT input length must be a power of 2');
  }

  // Split even and odd
  const even: Complex[] = [];
  const odd: Complex[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      even.push(input[i]);
    } else {
      odd.push(input[i]);
    }
  }

  // Recursive FFT
  const fftEven = fft(even);
  const fftOdd = fft(odd);

  // Combine
  const result: Complex[] = new Array(n);
  for (let k = 0; k < n / 2; k++) {
    const angle = (-2 * Math.PI * k) / n;
    const w: Complex = { re: Math.cos(angle), im: Math.sin(angle) };
    const t = complexMultiply(w, fftOdd[k]);
    result[k] = complexAdd(fftEven[k], t);
    result[k + n / 2] = complexSubtract(fftEven[k], t);
  }

  return result;
}

/**
 * Compute power spectral density from FFT result.
 */
function computePSD(fftResult: Complex[], sampleRate: number): { frequencies: number[]; power: number[] } {
  const n = fftResult.length;
  const halfN = Math.floor(n / 2);

  const frequencies: number[] = [];
  const power: number[] = [];

  for (let i = 0; i < halfN; i++) {
    frequencies.push((i * sampleRate) / n);
    const mag = complexMagnitude(fftResult[i]);
    power.push((mag * mag) / n);
  }

  return { frequencies, power };
}

/**
 * FFT processor for accelerometer data.
 */
export class FFTProcessor {
  private options: FFTOptions;

  constructor(options: Partial<FFTOptions> = {}) {
    this.options = { ...DEFAULT_FFT_OPTIONS, ...options };
  }

  /**
   * Update processing options.
   */
  setOptions(options: Partial<FFTOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Parse accelerometer CSV data.
   * Expected format: time,accel_x,accel_y,accel_z
   */
  parseCSV(csvContent: string): AccelerometerData {
    const lines = csvContent.trim().split('\n');
    const time: number[] = [];
    const accelX: number[] = [];
    const accelY: number[] = [];
    const accelZ: number[] = [];

    // Skip header line if present
    const startLine = lines[0].includes('time') || lines[0].includes('#') ? 1 : 0;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const parts = line.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length >= 4 && !isNaN(parts[0])) {
        time.push(parts[0]);
        accelX.push(parts[1]);
        accelY.push(parts[2]);
        accelZ.push(parts[3]);
      }
    }

    // Calculate sample rate from time values
    let sampleRate = 1000; // Default
    if (time.length >= 2) {
      const avgDelta = (time[time.length - 1] - time[0]) / (time.length - 1);
      sampleRate = 1 / avgDelta;
    }

    return {
      time,
      accelX,
      accelY,
      accelZ,
      sampleRate,
    };
  }

  /**
   * Process accelerometer data for a single axis.
   */
  processAxis(data: number[], sampleRate: number): PowerSpectrum {
    // Apply window function
    const windowed = applyWindow(data, this.options.windowFunction);

    // Pad to power of 2
    const padded = padToPowerOf2(windowed);

    // Convert to complex
    const complex: Complex[] = padded.map((v) => ({ re: v, im: 0 }));

    // Compute FFT
    const fftResult = fft(complex);

    // Compute power spectral density
    const { frequencies, power } = computePSD(fftResult, sampleRate);

    // Filter to desired frequency range
    const filteredFrequencies: number[] = [];
    const filteredPower: number[] = [];

    for (let i = 0; i < frequencies.length; i++) {
      if (frequencies[i] >= this.options.minFreq && frequencies[i] <= this.options.maxFreq) {
        filteredFrequencies.push(frequencies[i]);
        filteredPower.push(power[i]);
      }
    }

    // Normalize if requested
    let normalizedPower = filteredPower;
    if (this.options.normalize && filteredPower.length > 0) {
      const maxPower = Math.max(...filteredPower);
      if (maxPower > 0) {
        normalizedPower = filteredPower.map((p) => p / maxPower);
      }
    }

    // Find peak
    let peakIndex = 0;
    let peakPower = normalizedPower[0] || 0;
    for (let i = 1; i < normalizedPower.length; i++) {
      if (normalizedPower[i] > peakPower) {
        peakPower = normalizedPower[i];
        peakIndex = i;
      }
    }

    return {
      frequencies: filteredFrequencies,
      power: normalizedPower,
      peakFrequency: filteredFrequencies[peakIndex] || 0,
      peakPower,
    };
  }

  /**
   * Process full accelerometer data and return power spectrums for each axis.
   */
  processData(data: AccelerometerData): {
    x: PowerSpectrum;
    y: PowerSpectrum;
    z: PowerSpectrum;
  } {
    return {
      x: this.processAxis(data.accelX, data.sampleRate),
      y: this.processAxis(data.accelY, data.sampleRate),
      z: this.processAxis(data.accelZ, data.sampleRate),
    };
  }

  /**
   * Find resonance peaks in power spectrum.
   * Returns frequencies above the threshold relative to mean power.
   */
  findPeaks(spectrum: PowerSpectrum, threshold = 0.3): number[] {
    const peaks: number[] = [];
    const { frequencies, power } = spectrum;

    if (power.length < 3) return peaks;

    // Calculate mean power
    const meanPower = power.reduce((a, b) => a + b, 0) / power.length;
    const peakThreshold = meanPower + threshold * (Math.max(...power) - meanPower);

    // Find local maxima above threshold
    for (let i = 1; i < power.length - 1; i++) {
      if (power[i] > power[i - 1] && power[i] > power[i + 1] && power[i] > peakThreshold) {
        peaks.push(frequencies[i]);
      }
    }

    return peaks;
  }
}
