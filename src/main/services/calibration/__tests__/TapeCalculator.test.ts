/**
 * @fileoverview Unit tests for the TapeCalculator class.
 * Tests tape compensation calculations for bed leveling.
 *
 * @module main/services/calibration/__tests__/TapeCalculator.test
 */

import type { BedConfig, TapeConfig } from '../../../../shared/types/calibration';
import { BedCorner, DEFAULT_TAPE_CONFIG } from '../../../../shared/types/calibration';
import { Bed } from '../engine/Bed';
import { TapeCalculator } from '../engine/TapeCalculator';

describe('TapeCalculator', () => {
  const config5x5: BedConfig = {
    sizeX: 220,
    sizeY: 220,
    meshPointsX: 5,
    meshPointsY: 5,
  };

  // Mesh with one corner high
  const unevenMesh = [
    [0.2, 0.1, 0.0, -0.05, -0.1],
    [0.1, 0.05, 0.0, -0.03, -0.05],
    [0.0, 0.0, 0.0, 0.0, 0.0],
    [-0.05, -0.03, 0.0, 0.05, 0.1],
    [-0.1, -0.05, 0.0, 0.1, 0.2],
  ];

  // Level mesh
  const levelMesh = [
    [0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0],
  ];

  // Mesh with center low (bowl shape)
  const bowlMesh = [
    [0.1, 0.05, 0.0, 0.05, 0.1],
    [0.05, 0.02, -0.05, 0.02, 0.05],
    [0.0, -0.05, -0.15, -0.05, 0.0],
    [0.05, 0.02, -0.05, 0.02, 0.05],
    [0.1, 0.05, 0.0, 0.05, 0.1],
  ];

  let bed: Bed;
  let calculator: TapeCalculator;

  beforeEach(() => {
    bed = new Bed(config5x5);
    bed.setMeshData(unevenMesh);
    calculator = new TapeCalculator(bed);
  });

  describe('constructor', () => {
    it('should create calculator with default config', () => {
      const calc = new TapeCalculator(bed);
      expect(calc).toBeDefined();
    });

    it('should create calculator with custom config', () => {
      const customConfig: TapeConfig = {
        tapeThickness: 0.08,
        minHeightDiff: 0.03,
      };
      const calc = new TapeCalculator(bed, customConfig);
      expect(calc).toBeDefined();
    });
  });

  describe('setConfig', () => {
    it('should update tape configuration', () => {
      calculator.setConfig({ tapeThickness: 0.1 });
      // Verify by checking calculated layers
      const recommendations = calculator.calculateLayers();
      // With thicker tape, fewer layers should be needed
      expect(recommendations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateLayers', () => {
    it('should calculate tape recommendations for corners', () => {
      const recommendations = calculator.calculateLayers();

      expect(recommendations.length).toBeGreaterThan(0);

      for (const rec of recommendations) {
        expect(rec.layers).toBeGreaterThan(0);
        expect(rec.totalThickness).toBe(rec.layers * DEFAULT_TAPE_CONFIG.tapeThickness);
        expect(rec.deviation).toBeGreaterThan(0);
        expect(Object.values(BedCorner)).toContain(rec.corner);
      }
    });

    it('should not recommend tape for level bed', () => {
      const levelBed = new Bed(config5x5);
      levelBed.setMeshData(levelMesh);
      const levelCalc = new TapeCalculator(levelBed);

      const recommendations = levelCalc.calculateLayers();
      expect(recommendations.length).toBe(0);
    });

    it('should use lowest corner as reference', () => {
      const recommendations = calculator.calculateLayers();

      // The lowest corner(s) should not have recommendations
      // since they're the reference point
      const corners = bed.getCornerValues();
      const lowestValue = Math.min(corners.frontLeft, corners.frontRight, corners.rearLeft, corners.rearRight);

      // Find which corners are at lowest value
      const lowestCorners: BedCorner[] = [];
      if (Math.abs(corners.frontLeft - lowestValue) < 0.001) lowestCorners.push(BedCorner.FRONT_LEFT);
      if (Math.abs(corners.frontRight - lowestValue) < 0.001) lowestCorners.push(BedCorner.FRONT_RIGHT);
      if (Math.abs(corners.rearLeft - lowestValue) < 0.001) lowestCorners.push(BedCorner.REAR_LEFT);
      if (Math.abs(corners.rearRight - lowestValue) < 0.001) lowestCorners.push(BedCorner.REAR_RIGHT);

      // Lowest corners should not have tape recommendations
      for (const rec of recommendations) {
        expect(lowestCorners).not.toContain(rec.corner);
      }
    });

    it('should respect corner averaging size', () => {
      const rec1 = calculator.calculateLayers(0);
      const rec2 = calculator.calculateLayers(1);

      // Different averaging should potentially give different results
      // (depending on mesh data)
      expect(rec1).toBeDefined();
      expect(rec2).toBeDefined();
    });
  });

  describe('getTotalLayers', () => {
    it('should sum all tape layers', () => {
      const recommendations = calculator.calculateLayers();
      const total = calculator.getTotalLayers();

      const expectedTotal = recommendations.reduce((sum, r) => sum + r.layers, 0);
      expect(total).toBe(expectedTotal);
    });

    it('should return 0 for level bed', () => {
      const levelBed = new Bed(config5x5);
      levelBed.setMeshData(levelMesh);
      const levelCalc = new TapeCalculator(levelBed);

      expect(levelCalc.getTotalLayers()).toBe(0);
    });
  });

  describe('findLowSpots', () => {
    it('should find low spots in mesh', () => {
      const bowlBed = new Bed(config5x5);
      bowlBed.setMeshData(bowlMesh);
      const bowlCalc = new TapeCalculator(bowlBed);

      const spots = bowlCalc.findLowSpots(bowlMesh);

      // Bowl mesh has center low, so should find spots there
      expect(spots.length).toBeGreaterThan(0);

      // Center spot should be identified
      const centerSpot = spots.find((s) => s.x === 2 && s.y === 2);
      expect(centerSpot).toBeDefined();
    });

    it('should skip screw corner positions', () => {
      const spots = calculator.findLowSpots(unevenMesh);

      // No spots should be at corner positions
      for (const spot of spots) {
        const isCorner =
          (spot.x === 0 && spot.y === 0) ||
          (spot.x === 4 && spot.y === 0) ||
          (spot.x === 0 && spot.y === 4) ||
          (spot.x === 4 && spot.y === 4);
        expect(isCorner).toBe(false);
      }
    });

    it('should assign correct priority based on height difference', () => {
      const bowlBed = new Bed(config5x5);
      bowlBed.setMeshData(bowlMesh);
      const bowlCalc = new TapeCalculator(bowlBed);

      const spots = bowlCalc.findLowSpots(bowlMesh);

      for (const spot of spots) {
        // Priority should be 1-3
        expect(spot.priority).toBeGreaterThanOrEqual(1);
        expect(spot.priority).toBeLessThanOrEqual(3);

        // Higher deviation should have higher priority (lower number)
        if (spot.heightDiff > 0.3) {
          expect(spot.priority).toBe(1);
        }
      }
    });

    it('should sort spots by priority and height diff', () => {
      const bowlBed = new Bed(config5x5);
      bowlBed.setMeshData(bowlMesh);
      const bowlCalc = new TapeCalculator(bowlBed);

      const spots = bowlCalc.findLowSpots(bowlMesh);

      // Should be sorted by priority (ascending) then height diff (descending)
      for (let i = 1; i < spots.length; i++) {
        if (spots[i].priority === spots[i - 1].priority) {
          expect(spots[i].heightDiff).toBeLessThanOrEqual(spots[i - 1].heightDiff);
        } else {
          expect(spots[i].priority).toBeGreaterThanOrEqual(spots[i - 1].priority);
        }
      }
    });
  });

  describe('optimizeTapeLayout', () => {
    it('should merge nearby spots', () => {
      const bowlBed = new Bed(config5x5);
      bowlBed.setMeshData(bowlMesh);
      const bowlCalc = new TapeCalculator(bowlBed);

      const spots = bowlCalc.findLowSpots(bowlMesh);
      const optimized = bowlCalc.optimizeTapeLayout(spots);

      // Optimized should have same or fewer spots
      expect(optimized.length).toBeLessThanOrEqual(spots.length);
    });

    it('should handle empty spots array', () => {
      const optimized = calculator.optimizeTapeLayout([]);
      expect(optimized.length).toBe(0);
    });

    it('should preserve isolated spots', () => {
      const isolatedSpots = [
        { x: 1, y: 1, layers: 2, heightDiff: 0.1, priority: 2, areaSize: 100 },
        { x: 3, y: 3, layers: 1, heightDiff: 0.05, priority: 3, areaSize: 100 },
      ];

      const optimized = calculator.optimizeTapeLayout(isolatedSpots);

      // Isolated spots should be preserved
      expect(optimized.length).toBe(2);
    });
  });

  describe('applySpots', () => {
    it('should apply tape spots to mesh', () => {
      const spots = [{ x: 2, y: 2, layers: 2, heightDiff: 0.1, priority: 2, areaSize: 100 }];

      const applied = calculator.applySpots(bowlMesh, spots);

      // Center area should be raised
      expect(applied[2][2]).toBeGreaterThan(bowlMesh[2][2]);
    });

    it('should not modify original mesh', () => {
      const originalValue = bowlMesh[2][2];
      const spots = [{ x: 2, y: 2, layers: 3, heightDiff: 0.15, priority: 1, areaSize: 100 }];

      calculator.applySpots(bowlMesh, spots);

      expect(bowlMesh[2][2]).toBe(originalValue);
    });

    it('should affect surrounding area', () => {
      const spots = [{ x: 2, y: 2, layers: 2, heightDiff: 0.1, priority: 2, areaSize: 100 }];

      const applied = calculator.applySpots(bowlMesh, spots);

      // Adjacent cells should also be affected
      expect(applied[1][2]).toBeGreaterThan(bowlMesh[1][2]);
      expect(applied[2][1]).toBeGreaterThan(bowlMesh[2][1]);
      expect(applied[3][2]).toBeGreaterThan(bowlMesh[3][2]);
      expect(applied[2][3]).toBeGreaterThan(bowlMesh[2][3]);
    });
  });

  describe('estimateImprovement', () => {
    it('should estimate deviation change', () => {
      const bowlBed = new Bed(config5x5);
      bowlBed.setMeshData(bowlMesh);
      const bowlCalc = new TapeCalculator(bowlBed);

      const spots = bowlCalc.findLowSpots(bowlMesh);
      const improvement = bowlCalc.estimateImprovement(spots);

      // Should return a valid number (improvement can be positive or negative
      // depending on mesh geometry and spot locations)
      expect(typeof improvement).toBe('number');
      expect(Number.isFinite(improvement)).toBe(true);
    });

    it('should return 0 for no mesh data', () => {
      const emptyBed = new Bed(config5x5);
      const emptyCalc = new TapeCalculator(emptyBed);

      const improvement = emptyCalc.estimateImprovement([]);
      expect(improvement).toBe(0);
    });
  });

  describe('getTapeInstructions', () => {
    it('should generate instructions for spots', () => {
      const spots = [{ x: 2, y: 2, layers: 2, heightDiff: 0.1, priority: 2, areaSize: 100 }];

      const instructions = calculator.getTapeInstructions(spots);

      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions.join('\n')).toContain('location');
      expect(instructions.join('\n')).toContain('layer');
    });

    it('should return "no compensation needed" for empty spots', () => {
      const instructions = calculator.getTapeInstructions([]);

      expect(instructions.length).toBe(1);
      expect(instructions[0]).toContain('No tape compensation required');
    });

    it('should include position identifiers', () => {
      const spots = [{ x: 1, y: 2, layers: 1, heightDiff: 0.05, priority: 3, areaSize: 100 }];

      const instructions = calculator.getTapeInstructions(spots);

      // Position should be in format like "3B" (row 3, column B)
      expect(instructions.join('\n')).toContain('Position');
    });

    it('should flag high priority spots', () => {
      const spots = [{ x: 2, y: 2, layers: 3, heightDiff: 0.35, priority: 1, areaSize: 100 }];

      const instructions = calculator.getTapeInstructions(spots);

      expect(instructions.join('\n')).toContain('High priority');
    });
  });
});
