/**
 * @fileoverview Unit tests for the DeviationAnalyzer class.
 * Tests mesh deviation analysis and calibration strategy recommendations.
 *
 * @module main/services/calibration/__tests__/DeviationAnalyzer.test
 */

import type { BedConfig } from '../../../../shared/types/calibration';
import { BedCorner } from '../../../../shared/types/calibration';
import { Bed } from '../engine/Bed';
import { DeviationAnalyzer } from '../engine/DeviationAnalyzer';

describe('DeviationAnalyzer', () => {
  const config5x5: BedConfig = {
    sizeX: 220,
    sizeY: 220,
    meshPointsX: 5,
    meshPointsY: 5,
  };

  // Tilted mesh (front-left high, rear-right low)
  const tiltedMesh = [
    [0.2, 0.15, 0.1, 0.05, 0.0],
    [0.15, 0.1, 0.05, 0.0, -0.05],
    [0.1, 0.05, 0.0, -0.05, -0.1],
    [0.05, 0.0, -0.05, -0.1, -0.15],
    [0.0, -0.05, -0.1, -0.15, -0.2],
  ];

  // Level mesh
  const levelMesh = [
    [0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0],
  ];

  // Slight deviation (within tape threshold)
  const slightMesh = [
    [0.015, 0.01, 0.005, 0.0, -0.005],
    [0.01, 0.005, 0.0, -0.005, -0.01],
    [0.005, 0.0, 0.0, 0.0, -0.005],
    [0.0, -0.005, 0.0, 0.005, 0.01],
    [-0.005, -0.01, 0.005, 0.01, 0.015],
  ];

  // X-axis tilt (belt sync needed)
  const xTiltMesh = [
    [0.15, 0.1, 0.05, 0.0, -0.05],
    [0.15, 0.1, 0.05, 0.0, -0.05],
    [0.15, 0.1, 0.05, 0.0, -0.05],
    [0.15, 0.1, 0.05, 0.0, -0.05],
    [0.15, 0.1, 0.05, 0.0, -0.05],
  ];

  let bed: Bed;
  let analyzer: DeviationAnalyzer;

  beforeEach(() => {
    bed = new Bed(config5x5);
    bed.setMeshData(tiltedMesh);
    analyzer = new DeviationAnalyzer(bed);
  });

  describe('constructor', () => {
    it('should create analyzer with default options', () => {
      const analyzer = new DeviationAnalyzer(bed);
      expect(analyzer).toBeDefined();
    });

    it('should create analyzer with custom options', () => {
      const analyzer = new DeviationAnalyzer(bed, {
        cornerAveragingSize: 2,
        screwThreshold: 0.05,
        tapeThreshold: 0.03,
      });
      expect(analyzer).toBeDefined();
    });
  });

  describe('setOptions', () => {
    it('should update analyzer options', () => {
      analyzer.setOptions({ screwThreshold: 0.1 });
      // Verify by analyzing (thresholds affect recommendations)
      const result = analyzer.analyze();
      expect(result).toBeDefined();
    });
  });

  describe('setCornerAveragingSize', () => {
    it('should update corner averaging size', () => {
      analyzer.setCornerAveragingSize(2);
      const stats = analyzer.getStats();
      expect(stats).toBeDefined();
    });

    it('should clamp negative values to 0', () => {
      analyzer.setCornerAveragingSize(-5);
      // Should not throw and stats should still work
      const stats = analyzer.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('setScrewThreshold', () => {
    it('should update screw threshold', () => {
      analyzer.setScrewThreshold(0.1);
      const result = analyzer.analyze();
      // With higher threshold, might not need screw adjustment
      expect(result).toBeDefined();
    });
  });

  describe('setTapeThreshold', () => {
    it('should update tape threshold', () => {
      analyzer.setTapeThreshold(0.05);
      const result = analyzer.analyze();
      expect(result).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should calculate deviation statistics', () => {
      const stats = analyzer.getStats();

      expect(stats.meanHeight).toBeDefined();
      expect(stats.maxDeviation).toBeGreaterThan(0);
      expect(stats.cornerDeviations).toBeDefined();
      expect(stats.hasCriticalDeviation).toBe(true); // Tilted mesh has deviations
    });

    it('should not have critical deviation for level mesh', () => {
      const levelBed = new Bed(config5x5);
      levelBed.setMeshData(levelMesh);
      const levelAnalyzer = new DeviationAnalyzer(levelBed);

      const stats = levelAnalyzer.getStats();
      expect(stats.hasCriticalDeviation).toBe(false);
    });

    it('should calculate corner deviations from mean', () => {
      const stats = analyzer.getStats();

      // All corner deviations should be non-negative (absolute values)
      expect(stats.cornerDeviations.frontLeft).toBeGreaterThanOrEqual(0);
      expect(stats.cornerDeviations.frontRight).toBeGreaterThanOrEqual(0);
      expect(stats.cornerDeviations.rearLeft).toBeGreaterThanOrEqual(0);
      expect(stats.cornerDeviations.rearRight).toBeGreaterThanOrEqual(0);
    });
  });

  describe('analyzeLevelingStage', () => {
    it('should identify need for screw adjustment', () => {
      const stage = analyzer.analyzeLevelingStage();

      expect(stage.needsScrewAdjustment).toBe(true);
      expect(stage.maxCornerDiff).toBeGreaterThan(0);
    });

    it('should identify that screws can fix the problem', () => {
      const stage = analyzer.analyzeLevelingStage();

      // Tilted mesh deviation is within max adjustment range
      expect(stage.canUseScrews).toBe(true);
    });

    it('should identify problematic corners', () => {
      const stage = analyzer.analyzeLevelingStage();

      expect(stage.problematicCorners.length).toBeGreaterThan(0);
    });

    it('should not recommend adjustment for level mesh', () => {
      const levelBed = new Bed(config5x5);
      levelBed.setMeshData(levelMesh);
      const levelAnalyzer = new DeviationAnalyzer(levelBed);

      const stage = levelAnalyzer.analyzeLevelingStage();

      expect(stage.needsScrewAdjustment).toBe(false);
      expect(stage.needsTape).toBe(false);
      expect(stage.problematicCorners.length).toBe(0);
    });
  });

  describe('analyze', () => {
    it('should perform full analysis', () => {
      const result = analyzer.analyze();

      expect(result.meshRange).toBeGreaterThan(0);
      expect(result.maxDeviation).toBeGreaterThan(0);
      expect(result.standardDeviation).toBeGreaterThan(0);
      expect(result.cornerDeviations).toBeDefined();
      expect(result.referenceCorner).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should identify reference corner as lowest', () => {
      const result = analyzer.analyze();

      // Rear-right is lowest in tilted mesh
      expect(result.referenceCorner).toBe(BedCorner.REAR_RIGHT);
    });

    it('should recommend screw adjustment for tilted bed', () => {
      const result = analyzer.analyze();

      expect(result.recommendations.needsScrewAdjust).toBe(true);
    });

    it('should recommend belt sync for X-axis tilt', () => {
      const xTiltBed = new Bed(config5x5);
      xTiltBed.setMeshData(xTiltMesh);
      const xTiltAnalyzer = new DeviationAnalyzer(xTiltBed, {
        cornerAveragingSize: 0,
        screwThreshold: 0.02,
        tapeThreshold: 0.02,
        beltThreshold: 0.1,
        screwConfig: { pitch: 0.5, minAdjust: 0.01, maxAdjust: 2.0 },
      });

      const result = xTiltAnalyzer.analyze();

      // Front-left to front-right difference is 0.2, which exceeds 0.1 threshold
      expect(result.recommendations.needsBeltSync).toBe(true);
    });

    it('should not recommend actions for level bed', () => {
      const levelBed = new Bed(config5x5);
      levelBed.setMeshData(levelMesh);
      const levelAnalyzer = new DeviationAnalyzer(levelBed);

      const result = levelAnalyzer.analyze();

      expect(result.recommendations.needsBeltSync).toBe(false);
      expect(result.recommendations.needsScrewAdjust).toBe(false);
      expect(result.recommendations.needsTapeCompensation).toBe(false);
    });
  });

  describe('getIdealPlane', () => {
    it('should return ideal plane at mean height', () => {
      const idealPlane = analyzer.getIdealPlane();
      const meanHeight = bed.getMeanValue();

      // All values should equal mean
      for (const row of idealPlane) {
        for (const val of row) {
          expect(val).toBeCloseTo(meanHeight, 5);
        }
      }
    });
  });

  describe('estimateBedAfterScrewAdjustment', () => {
    it('should simulate screw adjustment effect', () => {
      const adjusted = analyzer.estimateBedAfterScrewAdjustment();

      expect(adjusted.length).toBe(5);
      expect(adjusted[0].length).toBe(5);

      // Range should be reduced after adjustment
      let minAdj = Infinity;
      let maxAdj = -Infinity;
      for (const row of adjusted) {
        for (const val of row) {
          minAdj = Math.min(minAdj, val);
          maxAdj = Math.max(maxAdj, val);
        }
      }
      const adjustedRange = maxAdj - minAdj;
      const originalRange = bed.getRange();

      // Adjusted range should be less than or equal to original
      expect(adjustedRange).toBeLessThanOrEqual(originalRange + 0.001);
    });
  });

  describe('findOptimalStrategy', () => {
    it('should find optimal calibration strategy', () => {
      const strategy = analyzer.findOptimalStrategy();

      expect(strategy.originalDeviation).toBeGreaterThan(0);
      expect(strategy.deviationAfterScrews).toBeDefined();
      expect(strategy.needsScrews).toBe(true);
      expect(strategy.simulatedBedAfterScrews).toBeDefined();
    });

    it('should show improvement with screws', () => {
      const strategy = analyzer.findOptimalStrategy();

      // Deviation should be reduced after screws
      expect(strategy.deviationAfterScrews).toBeLessThanOrEqual(strategy.originalDeviation);
    });
  });

  describe('getScrewSolver', () => {
    it('should return screw solver instance', () => {
      const solver = analyzer.getScrewSolver();
      expect(solver).toBeDefined();

      // Should be functional
      solver.autoSelectReferenceCorner();
      const adjustments = solver.calculateAdjustments();
      expect(adjustments.length).toBe(4);
    });
  });

  describe('edge cases', () => {
    it('should handle mesh with all same values', () => {
      const sameMesh = [
        [0.1, 0.1, 0.1, 0.1, 0.1],
        [0.1, 0.1, 0.1, 0.1, 0.1],
        [0.1, 0.1, 0.1, 0.1, 0.1],
        [0.1, 0.1, 0.1, 0.1, 0.1],
        [0.1, 0.1, 0.1, 0.1, 0.1],
      ];

      const sameBed = new Bed(config5x5);
      sameBed.setMeshData(sameMesh);
      const sameAnalyzer = new DeviationAnalyzer(sameBed);

      const result = sameAnalyzer.analyze();
      expect(result.meshRange).toBeCloseTo(0, 5);
      expect(result.recommendations.needsScrewAdjust).toBe(false);
    });

    it('should handle mesh with slight variations', () => {
      const slightBed = new Bed(config5x5);
      slightBed.setMeshData(slightMesh);
      const slightAnalyzer = new DeviationAnalyzer(slightBed, {
        cornerAveragingSize: 0,
        screwThreshold: 0.02,
        tapeThreshold: 0.02,
        beltThreshold: 0.1,
        screwConfig: { pitch: 0.5, minAdjust: 0.01, maxAdjust: 2.0 },
      });

      const result = slightAnalyzer.analyze();

      // With 0.02 threshold and max corner deviation ~0.015, should not need major adjustment
      expect(result.meshRange).toBeLessThan(0.05);
    });
  });
});
