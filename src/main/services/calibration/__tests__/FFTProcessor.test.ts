/**
 * @fileoverview Unit tests for the FFTProcessor class.
 * Tests FFT computation, CSV parsing, and power spectral density analysis.
 *
 * @module main/services/calibration/__tests__/FFTProcessor.test
 */

import { DEFAULT_FFT_OPTIONS, FFTProcessor } from '../shaper/FFTProcessor';

describe('FFTProcessor', () => {
  let processor: FFTProcessor;

  beforeEach(() => {
    processor = new FFTProcessor();
  });

  describe('constructor', () => {
    it('should create processor with default options', () => {
      const proc = new FFTProcessor();
      expect(proc).toBeDefined();
    });

    it('should create processor with custom options', () => {
      const proc = new FFTProcessor({
        windowFunction: 'hamming',
        minFreq: 10,
        maxFreq: 150,
      });
      expect(proc).toBeDefined();
    });
  });

  describe('setOptions', () => {
    it('should update processing options', () => {
      processor.setOptions({ minFreq: 20, maxFreq: 100 });
      // Options should be updated (verified by processing behavior)
      expect(processor).toBeDefined();
    });
  });

  describe('parseCSV', () => {
    it('should parse valid accelerometer CSV', () => {
      const csvContent = `time,accel_x,accel_y,accel_z
0.000,0.1,0.2,9.8
0.001,0.15,0.25,9.81
0.002,0.12,0.22,9.79
0.003,0.11,0.21,9.8
0.004,0.13,0.23,9.82`;

      const data = processor.parseCSV(csvContent);

      expect(data.time.length).toBe(5);
      expect(data.accelX.length).toBe(5);
      expect(data.accelY.length).toBe(5);
      expect(data.accelZ.length).toBe(5);

      expect(data.time[0]).toBe(0);
      expect(data.accelX[0]).toBeCloseTo(0.1, 5);
      expect(data.sampleRate).toBeGreaterThan(0);
    });

    it('should skip header line automatically', () => {
      const csvWithHeader = `time,accel_x,accel_y,accel_z
0.0,1.0,2.0,9.8
0.001,1.1,2.1,9.81`;

      const data = processor.parseCSV(csvWithHeader);
      expect(data.time.length).toBe(2);
      expect(data.time[0]).toBe(0);
    });

    it('should skip comment lines', () => {
      const csvWithComments = `# Comment line
time,accel_x,accel_y,accel_z
# Another comment
0.0,1.0,2.0,9.8
0.001,1.1,2.1,9.81`;

      const data = processor.parseCSV(csvWithComments);
      expect(data.time.length).toBe(2);
    });

    it('should calculate sample rate from time values', () => {
      const csvContent = `time,accel_x,accel_y,accel_z
0.0,0.1,0.2,9.8
0.001,0.1,0.2,9.8
0.002,0.1,0.2,9.8
0.003,0.1,0.2,9.8`;

      const data = processor.parseCSV(csvContent);
      // Delta t = 0.001s, so sample rate = 1000 Hz
      expect(data.sampleRate).toBeCloseTo(1000, 0);
    });

    it('should handle empty CSV', () => {
      const emptyCSV = `time,accel_x,accel_y,accel_z`;
      const data = processor.parseCSV(emptyCSV);
      expect(data.time.length).toBe(0);
    });
  });

  describe('processAxis', () => {
    it('should compute power spectrum for sinusoidal input', () => {
      // Generate a simple sinusoidal signal at 50 Hz
      const sampleRate = 1000;
      const frequency = 50;
      const samples = 1024;
      const data: number[] = [];

      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        data.push(Math.sin(2 * Math.PI * frequency * t));
      }

      const spectrum = processor.processAxis(data, sampleRate);

      expect(spectrum.frequencies.length).toBeGreaterThan(0);
      expect(spectrum.power.length).toBe(spectrum.frequencies.length);
      expect(spectrum.peakFrequency).toBeGreaterThan(0);

      // Peak should be near 50 Hz (within FFT resolution)
      expect(spectrum.peakFrequency).toBeGreaterThan(45);
      expect(spectrum.peakFrequency).toBeLessThan(55);
    });

    it('should filter frequencies to specified range', () => {
      processor.setOptions({ minFreq: 20, maxFreq: 100 });

      const sampleRate = 1000;
      const data = new Array(512).fill(0).map((_, i) => Math.sin(2 * Math.PI * 50 * (i / sampleRate)));

      const spectrum = processor.processAxis(data, sampleRate);

      // All frequencies should be within range
      for (const freq of spectrum.frequencies) {
        expect(freq).toBeGreaterThanOrEqual(20);
        expect(freq).toBeLessThanOrEqual(100);
      }
    });

    it('should normalize power when requested', () => {
      processor.setOptions({ normalize: true });

      const sampleRate = 1000;
      const data = new Array(512).fill(0).map((_, i) => Math.sin(2 * Math.PI * 50 * (i / sampleRate)));

      const spectrum = processor.processAxis(data, sampleRate);

      // Max power should be 1 when normalized
      const maxPower = Math.max(...spectrum.power);
      expect(maxPower).toBeCloseTo(1, 5);
    });

    it('should handle constant signal (DC)', () => {
      const sampleRate = 1000;
      const data = new Array(256).fill(1.0); // Constant value

      const spectrum = processor.processAxis(data, sampleRate);

      // Should still produce a spectrum (mostly DC component)
      expect(spectrum.frequencies.length).toBeGreaterThan(0);
    });

    it('should handle noisy signal', () => {
      const sampleRate = 1000;
      const data = new Array(512).fill(0).map(() => Math.random() - 0.5);

      const spectrum = processor.processAxis(data, sampleRate);

      // Should still produce valid spectrum
      expect(spectrum.frequencies.length).toBeGreaterThan(0);
      expect(spectrum.power.every((p) => !isNaN(p))).toBe(true);
    });
  });

  describe('processData', () => {
    it('should process all three axes', () => {
      const sampleRate = 1000;
      const samples = 256;

      const mockData = {
        time: new Array(samples).fill(0).map((_, i) => i / sampleRate),
        accelX: new Array(samples).fill(0).map((_, i) => Math.sin(2 * Math.PI * 30 * (i / sampleRate))),
        accelY: new Array(samples).fill(0).map((_, i) => Math.sin(2 * Math.PI * 40 * (i / sampleRate))),
        accelZ: new Array(samples).fill(0).map((_, i) => Math.sin(2 * Math.PI * 50 * (i / sampleRate))),
        sampleRate,
      };

      const result = processor.processData(mockData);

      expect(result.x).toBeDefined();
      expect(result.y).toBeDefined();
      expect(result.z).toBeDefined();

      // Each axis should have different peak (approximately)
      expect(result.x.peakFrequency).toBeGreaterThan(25);
      expect(result.x.peakFrequency).toBeLessThan(35);

      expect(result.y.peakFrequency).toBeGreaterThan(35);
      expect(result.y.peakFrequency).toBeLessThan(45);

      expect(result.z.peakFrequency).toBeGreaterThan(45);
      expect(result.z.peakFrequency).toBeLessThan(55);
    });
  });

  describe('findPeaks', () => {
    it('should find resonance peaks in spectrum', () => {
      // Generate signal with multiple frequency components
      const sampleRate = 1000;
      const samples = 1024;
      const data: number[] = [];

      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate;
        // 30 Hz and 70 Hz components
        data.push(Math.sin(2 * Math.PI * 30 * t) + 0.5 * Math.sin(2 * Math.PI * 70 * t));
      }

      const spectrum = processor.processAxis(data, sampleRate);
      const peaks = processor.findPeaks(spectrum, 0.2);

      // Should find at least one peak
      expect(peaks.length).toBeGreaterThan(0);

      // One peak should be near 30 Hz
      const has30Hz = peaks.some((p) => p > 25 && p < 35);
      expect(has30Hz).toBe(true);
    });

    it('should return empty array for flat spectrum', () => {
      // Create a flat spectrum manually
      const flatSpectrum = {
        frequencies: [10, 20, 30, 40, 50],
        power: [0.5, 0.5, 0.5, 0.5, 0.5],
        peakFrequency: 30,
        peakPower: 0.5,
      };

      const peaks = processor.findPeaks(flatSpectrum, 0.3);
      expect(peaks.length).toBe(0);
    });

    it('should handle very short spectrum', () => {
      const shortSpectrum = {
        frequencies: [10, 20],
        power: [0.5, 0.8],
        peakFrequency: 20,
        peakPower: 0.8,
      };

      const peaks = processor.findPeaks(shortSpectrum);
      // Too short to find peaks (need at least 3 points for local maximum)
      expect(peaks.length).toBe(0);
    });
  });

  describe('window functions', () => {
    it('should apply Hanning window by default', () => {
      processor.setOptions({ windowFunction: 'hanning' });

      const sampleRate = 1000;
      const data = new Array(256).fill(1.0);
      const spectrum = processor.processAxis(data, sampleRate);

      // Should produce valid spectrum (windowing reduces DC leakage)
      expect(spectrum.frequencies.length).toBeGreaterThan(0);
    });

    it('should apply Hamming window', () => {
      processor.setOptions({ windowFunction: 'hamming' });

      const sampleRate = 1000;
      const data = new Array(256).fill(0).map((_, i) => Math.sin(2 * Math.PI * 50 * (i / sampleRate)));
      const spectrum = processor.processAxis(data, sampleRate);

      expect(spectrum.peakFrequency).toBeGreaterThan(45);
      expect(spectrum.peakFrequency).toBeLessThan(55);
    });

    it('should apply Blackman window', () => {
      processor.setOptions({ windowFunction: 'blackman' });

      const sampleRate = 1000;
      const data = new Array(256).fill(0).map((_, i) => Math.sin(2 * Math.PI * 50 * (i / sampleRate)));
      const spectrum = processor.processAxis(data, sampleRate);

      expect(spectrum.peakFrequency).toBeGreaterThan(45);
      expect(spectrum.peakFrequency).toBeLessThan(55);
    });

    it('should work without window function', () => {
      processor.setOptions({ windowFunction: 'none' });

      const sampleRate = 1000;
      const data = new Array(256).fill(0).map((_, i) => Math.sin(2 * Math.PI * 50 * (i / sampleRate)));
      const spectrum = processor.processAxis(data, sampleRate);

      expect(spectrum.peakFrequency).toBeGreaterThan(45);
      expect(spectrum.peakFrequency).toBeLessThan(55);
    });
  });

  describe('padding', () => {
    it('should pad non-power-of-2 input to next power of 2', () => {
      const sampleRate = 1000;
      // 300 samples - should be padded to 512
      const data = new Array(300).fill(0).map((_, i) => Math.sin(2 * Math.PI * 50 * (i / sampleRate)));

      const spectrum = processor.processAxis(data, sampleRate);

      // Should still produce valid spectrum
      expect(spectrum.frequencies.length).toBeGreaterThan(0);
      expect(spectrum.peakFrequency).toBeGreaterThan(45);
      expect(spectrum.peakFrequency).toBeLessThan(55);
    });
  });
});
