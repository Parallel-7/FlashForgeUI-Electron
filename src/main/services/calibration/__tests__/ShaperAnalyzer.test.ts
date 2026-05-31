/**
 * @fileoverview Unit tests for the ShaperAnalyzer class.
 * Tests input shaper analysis, shaper evaluation, and Klipper config generation.
 *
 * @module main/services/calibration/__tests__/ShaperAnalyzer.test
 */

import { ShaperType } from '../../../../shared/types/calibration';
import {
  getAllShaperDefinitions,
  getShaperDefinition,
  SHAPER_DEFINITIONS,
  ShaperAnalyzer,
} from '../shaper/ShaperAnalyzer';

describe('ShaperAnalyzer', () => {
  let analyzer: ShaperAnalyzer;

  beforeEach(() => {
    analyzer = new ShaperAnalyzer();
  });

  // Generate test CSV data simulating accelerometer output with a resonance at a specific frequency
  function generateTestCSV(resonanceFreq: number, sampleRate = 1000, duration = 1.0): string {
    const lines = ['time,accel_x,accel_y,accel_z'];
    const samples = Math.floor(sampleRate * duration);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      // Primary resonance + noise
      const accelX = Math.sin(2 * Math.PI * resonanceFreq * t) + 0.1 * Math.sin(2 * Math.PI * 15 * t);
      const accelY = Math.sin(2 * Math.PI * resonanceFreq * t) + 0.1 * Math.sin(2 * Math.PI * 20 * t);
      const accelZ = 9.8 + 0.01 * Math.random();

      lines.push(`${t.toFixed(4)},${accelX.toFixed(4)},${accelY.toFixed(4)},${accelZ.toFixed(4)}`);
    }

    return lines.join('\n');
  }

  describe('constructor', () => {
    it('should create analyzer with default options', () => {
      const analyzer = new ShaperAnalyzer();
      expect(analyzer).toBeDefined();
    });

    it('should create analyzer with custom FFT options', () => {
      const analyzer = new ShaperAnalyzer({ minFreq: 10, maxFreq: 150 });
      expect(analyzer).toBeDefined();
    });
  });

  describe('analyzeAxis', () => {
    it('should analyze X axis data and return calibration', () => {
      const csvData = generateTestCSV(45, 1000, 2.0);
      const calibration = analyzer.analyzeAxis(csvData, 'x');

      expect(calibration.axis).toBe('x');
      expect(calibration.frequencyBins.length).toBeGreaterThan(0);
      expect(calibration.powerSpectralDensity.length).toBe(calibration.frequencyBins.length);
      expect(calibration.peakFrequencies.length).toBeGreaterThan(0);
      expect(calibration.recommendedShaper).toBeDefined();
      expect(calibration.allShaperResults.length).toBe(5); // All 5 shaper types
    });

    it('should analyze Y axis data', () => {
      const csvData = generateTestCSV(50, 1000, 2.0);
      const calibration = analyzer.analyzeAxis(csvData, 'y');

      expect(calibration.axis).toBe('y');
      expect(calibration.recommendedShaper).toBeDefined();
    });

    it('should detect resonance frequency near input', () => {
      const resonanceFreq = 45;
      const csvData = generateTestCSV(resonanceFreq, 1000, 2.0);
      const calibration = analyzer.analyzeAxis(csvData, 'x');

      // Peak frequency should be detected near the input resonance
      expect(calibration.peakFrequencies.length).toBeGreaterThan(0);

      // At least one peak should be near our input frequency
      const nearbyPeak = calibration.peakFrequencies.some(
        (f) => Math.abs(f - resonanceFreq) < 10 // Within 10 Hz
      );
      expect(nearbyPeak).toBe(true);
    });
  });

  describe('evaluateShapers', () => {
    it('should evaluate all shaper types', () => {
      const mockSpectrum = {
        frequencies: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        power: [0.1, 0.2, 0.3, 0.8, 1.0, 0.7, 0.3, 0.2, 0.1, 0.05],
        peakFrequency: 50,
        peakPower: 1.0,
      };

      const results = analyzer.evaluateShapers(50, mockSpectrum);

      expect(results.length).toBe(5);

      // Should include all shaper types
      const types = results.map((r) => r.type);
      expect(types).toContain('zv' as ShaperType);
      expect(types).toContain('mzv' as ShaperType);
      expect(types).toContain('ei' as ShaperType);
      expect(types).toContain('2hump_ei' as ShaperType);
      expect(types).toContain('3hump_ei' as ShaperType);
    });

    it('should sort results by score (best first)', () => {
      const mockSpectrum = {
        frequencies: [30, 40, 50, 60, 70],
        power: [0.3, 0.7, 1.0, 0.6, 0.2],
        peakFrequency: 50,
        peakPower: 1.0,
      };

      const results = analyzer.evaluateShapers(50, mockSpectrum);

      // Results should be sorted by score descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should calculate valid shaper parameters', () => {
      const mockSpectrum = {
        frequencies: [40, 45, 50, 55, 60],
        power: [0.5, 0.8, 1.0, 0.7, 0.4],
        peakFrequency: 50,
        peakPower: 1.0,
      };

      const results = analyzer.evaluateShapers(50, mockSpectrum);

      for (const result of results) {
        expect(result.frequency).toBeGreaterThan(0);
        expect(result.vibrationReduction).toBeGreaterThanOrEqual(0);
        expect(result.vibrationReduction).toBeLessThanOrEqual(1);
        expect(result.smoothingTime).toBeGreaterThan(0);
        expect(result.maxAcceleration).toBeGreaterThan(0);
        expect(result.score).toBeGreaterThan(0);
      }
    });
  });

  describe('findOptimalFrequency', () => {
    it('should find optimal frequency for ZV shaper', () => {
      const mockSpectrum = {
        frequencies: [40, 45, 50, 55, 60],
        power: [0.3, 0.6, 1.0, 0.5, 0.2],
        peakFrequency: 50,
        peakPower: 1.0,
      };

      const optimal = analyzer.findOptimalFrequency('zv' as ShaperType, 50, mockSpectrum, 10, 100);

      // Should find a frequency that provides good vibration reduction
      expect(optimal).toBeGreaterThan(10);
      expect(optimal).toBeLessThan(100);
    });

    it('should respect min/max frequency bounds', () => {
      const mockSpectrum = {
        frequencies: [20, 30, 40, 50, 60],
        power: [0.3, 0.6, 1.0, 0.5, 0.2],
        peakFrequency: 40,
        peakPower: 1.0,
      };

      const optimal = analyzer.findOptimalFrequency('mzv' as ShaperType, 40, mockSpectrum, 30, 60);

      expect(optimal).toBeGreaterThanOrEqual(30);
      expect(optimal).toBeLessThanOrEqual(60);
    });
  });

  describe('findBestShaper', () => {
    it('should return the highest scoring shaper', () => {
      const mockSpectrum = {
        frequencies: [40, 50, 60, 70, 80],
        power: [0.5, 1.0, 0.6, 0.3, 0.1],
        peakFrequency: 50,
        peakPower: 1.0,
      };

      const results = analyzer.evaluateShapers(50, mockSpectrum);
      const best = analyzer.findBestShaper(results);

      // Best should have the highest score
      expect(best.score).toBe(Math.max(...results.map((r) => r.score)));
    });
  });

  describe('generateKlipperConfig', () => {
    it('should generate valid Klipper config for X axis', () => {
      const result = {
        type: 'mzv' as ShaperType,
        frequency: 48.5,
        vibrationReduction: 0.85,
        smoothingTime: 12.3,
        maxAcceleration: 8000,
        score: 75.2,
      };

      const config = analyzer.generateKlipperConfig('x', result);

      expect(config).toContain('[input_shaper]');
      expect(config).toContain('shaper_freq_x: 48.5');
      expect(config).toContain('shaper_type_x: mzv');
    });

    it('should generate valid Klipper config for Y axis', () => {
      const result = {
        type: 'ei' as ShaperType,
        frequency: 52.3,
        vibrationReduction: 0.78,
        smoothingTime: 15.6,
        maxAcceleration: 6500,
        score: 68.4,
      };

      const config = analyzer.generateKlipperConfig('y', result);

      expect(config).toContain('shaper_freq_y: 52.3');
      expect(config).toContain('shaper_type_y: ei');
    });
  });

  describe('generateReport', () => {
    it('should generate human-readable calibration report', () => {
      const csvData = generateTestCSV(45, 1000, 2.0);
      const calibration = analyzer.analyzeAxis(csvData, 'x');

      const report = analyzer.generateReport(calibration);

      expect(report).toContain('X Axis');
      expect(report).toContain('Recommended Shaper');
      expect(report).toContain('Frequency');
      expect(report).toContain('Vibration Reduction');
      expect(report).toContain('Klipper Configuration');
    });

    it('should include all shaper results in report', () => {
      const csvData = generateTestCSV(50, 1000, 2.0);
      const calibration = analyzer.analyzeAxis(csvData, 'y');

      const report = analyzer.generateReport(calibration);

      // Should mention all shaper types
      expect(report).toContain('zv');
      expect(report).toContain('mzv');
      expect(report).toContain('ei');
    });
  });
});

describe('SHAPER_DEFINITIONS', () => {
  it('should define all 5 shaper types', () => {
    expect(SHAPER_DEFINITIONS.length).toBe(5);
  });

  it('should have valid frequency ranges', () => {
    for (const def of SHAPER_DEFINITIONS) {
      expect(def.minFreq).toBeGreaterThan(0);
      expect(def.maxFreq).toBeGreaterThan(def.minFreq);
      expect(def.initFreq).toBeGreaterThanOrEqual(def.minFreq);
      expect(def.initFreq).toBeLessThanOrEqual(def.maxFreq);
    }
  });

  it('should have proper type identifiers', () => {
    const types = SHAPER_DEFINITIONS.map((d) => d.type);
    expect(types).toContain('zv');
    expect(types).toContain('mzv');
    expect(types).toContain('ei');
    expect(types).toContain('2hump_ei');
    expect(types).toContain('3hump_ei');
  });
});

describe('getShaperDefinition', () => {
  it('should return definition for valid type', () => {
    const def = getShaperDefinition('mzv' as ShaperType);
    expect(def).toBeDefined();
    expect(def!.type).toBe('mzv');
    expect(def!.name).toContain('MZV');
  });

  it('should return undefined for invalid type', () => {
    const def = getShaperDefinition('invalid' as ShaperType);
    expect(def).toBeUndefined();
  });
});

describe('getAllShaperDefinitions', () => {
  it('should return copy of all definitions', () => {
    const defs = getAllShaperDefinitions();
    expect(defs.length).toBe(5);
    expect(defs).not.toBe(SHAPER_DEFINITIONS); // Should be a copy
  });
});
