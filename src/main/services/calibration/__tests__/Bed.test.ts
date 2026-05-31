/**
 * @fileoverview Unit tests for the Bed model class.
 * Tests bed mesh data management, corner calculations, and statistics.
 *
 * @module main/services/calibration/__tests__/Bed.test
 */

import type { BedConfig, MeshData } from '../../../../shared/types/calibration';
import { BedCorner, DEFAULT_BED_CONFIG } from '../../../../shared/types/calibration';
import { Bed } from '../engine/Bed';

describe('Bed', () => {
  // Sample 3x3 mesh for testing
  const sampleMesh3x3 = [
    [0.1, 0.0, -0.1],
    [0.05, 0.0, -0.05],
    [0.0, -0.05, -0.1],
  ];

  // Sample 5x5 mesh with more variation
  const sampleMesh5x5 = [
    [0.2, 0.15, 0.1, 0.05, 0.0],
    [0.15, 0.1, 0.05, 0.0, -0.05],
    [0.1, 0.05, 0.0, -0.05, -0.1],
    [0.05, 0.0, -0.05, -0.1, -0.15],
    [0.0, -0.05, -0.1, -0.15, -0.2],
  ];

  const config3x3: BedConfig = {
    sizeX: 220,
    sizeY: 220,
    meshPointsX: 3,
    meshPointsY: 3,
  };

  const config5x5: BedConfig = {
    sizeX: 220,
    sizeY: 220,
    meshPointsX: 5,
    meshPointsY: 5,
  };

  describe('constructor', () => {
    it('should create a Bed with default config', () => {
      const bed = new Bed();
      expect(bed.config).toEqual(DEFAULT_BED_CONFIG);
      expect(bed.hasMeshData).toBe(false);
    });

    it('should create a Bed with custom config', () => {
      const bed = new Bed(config3x3);
      expect(bed.config.meshPointsX).toBe(3);
      expect(bed.config.meshPointsY).toBe(3);
      expect(bed.config.sizeX).toBe(220);
      expect(bed.config.sizeY).toBe(220);
    });
  });

  describe('setMeshData', () => {
    it('should accept valid mesh data', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);
      expect(bed.hasMeshData).toBe(true);
      expect(bed.meshData).toEqual(sampleMesh3x3);
    });

    it('should deep copy mesh data', () => {
      const bed = new Bed(config3x3);
      const originalMesh = [
        [0.1, 0.0, -0.1],
        [0.05, 0.0, -0.05],
        [0.0, -0.05, -0.1],
      ];
      bed.setMeshData(originalMesh);

      // Modify original
      originalMesh[0][0] = 999;

      // Bed data should be unchanged
      expect(bed.meshData![0][0]).toBe(0.1);
    });

    it('should throw on invalid row count', () => {
      const bed = new Bed(config3x3);
      const invalidMesh = [
        [0.1, 0.0, -0.1],
        [0.05, 0.0, -0.05],
      ]; // Only 2 rows
      expect(() => bed.setMeshData(invalidMesh)).toThrow(/Invalid mesh row count/);
    });

    it('should throw on invalid column count', () => {
      const bed = new Bed(config3x3);
      const invalidMesh = [
        [0.1, 0.0],
        [0.05, 0.0, -0.05],
        [0.0, -0.05, -0.1],
      ]; // First row has only 2 columns
      expect(() => bed.setMeshData(invalidMesh)).toThrow(/Invalid mesh column count/);
    });
  });

  describe('loadFromMeshData', () => {
    it('should load mesh from MeshData object', () => {
      const bed = new Bed();
      const meshData: MeshData = {
        matrix: sampleMesh5x5,
        minX: 15,
        maxX: 205,
        minY: 15,
        maxY: 205,
        pointsX: 5,
        pointsY: 5,
        profileName: 'default',
      };

      bed.loadFromMeshData(meshData);
      expect(bed.hasMeshData).toBe(true);
      expect(bed.config.meshPointsX).toBe(5);
      expect(bed.config.meshPointsY).toBe(5);
    });
  });

  describe('clearMeshData', () => {
    it('should clear mesh data', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);
      expect(bed.hasMeshData).toBe(true);

      bed.clearMeshData();
      expect(bed.hasMeshData).toBe(false);
      expect(bed.meshData).toBeNull();
    });
  });

  describe('getCornerHeight', () => {
    it('should get correct corner heights without averaging', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);

      expect(bed.getCornerHeight(BedCorner.FRONT_LEFT)).toBe(0.1);
      expect(bed.getCornerHeight(BedCorner.FRONT_RIGHT)).toBe(-0.1);
      expect(bed.getCornerHeight(BedCorner.REAR_LEFT)).toBe(0.0);
      expect(bed.getCornerHeight(BedCorner.REAR_RIGHT)).toBe(-0.1);
    });

    it('should throw when no mesh data loaded', () => {
      const bed = new Bed(config3x3);
      expect(() => bed.getCornerHeight(BedCorner.FRONT_LEFT)).toThrow('No mesh data loaded');
    });

    it('should average corner heights when averaging size > 0', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);

      // With averaging size 1, should average a 3x3 area around corner (clamped to mesh bounds)
      const avgFrontLeft = bed.getCornerHeight(BedCorner.FRONT_LEFT, 1);
      // Front-left (0,0) with averaging: (0.1 + 0.0 + 0.05 + 0.0) / 4
      const expected = (0.1 + 0.0 + 0.05 + 0.0) / 4;
      expect(avgFrontLeft).toBeCloseTo(expected, 5);
    });
  });

  describe('getCornerValues', () => {
    it('should return all corner values', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);

      const corners = bed.getCornerValues();
      expect(corners.frontLeft).toBe(0.1);
      expect(corners.frontRight).toBe(-0.1);
      expect(corners.rearLeft).toBe(0.0);
      expect(corners.rearRight).toBe(-0.1);
    });
  });

  describe('getPointHeight', () => {
    it('should return height at specific point', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);

      expect(bed.getPointHeight(0, 0)).toBe(0.1);
      expect(bed.getPointHeight(1, 1)).toBe(0.0);
      expect(bed.getPointHeight(2, 2)).toBe(-0.1);
    });

    it('should throw for out of range coordinates', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);

      expect(() => bed.getPointHeight(-1, 0)).toThrow(/out of range/);
      expect(() => bed.getPointHeight(0, 5)).toThrow(/out of range/);
      expect(() => bed.getPointHeight(10, 0)).toThrow(/out of range/);
    });
  });

  describe('getMeshStats', () => {
    it('should calculate correct mesh statistics', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);

      const stats = bed.getMeshStats();

      // min = -0.1, max = 0.1, range = 0.2
      expect(stats.min).toBeCloseTo(-0.1, 5);
      expect(stats.max).toBeCloseTo(0.1, 5);
      expect(stats.range).toBeCloseTo(0.2, 5);

      // Mean of all values
      const allValues = sampleMesh3x3.flat();
      const expectedMean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
      expect(stats.mean).toBeCloseTo(expectedMean, 5);

      // Standard deviation should be positive
      expect(stats.standardDeviation).toBeGreaterThan(0);
    });

    it('should throw when no mesh data loaded', () => {
      const bed = new Bed(config3x3);
      expect(() => bed.getMeshStats()).toThrow('No mesh data loaded');
    });
  });

  describe('getMinValue/getMaxValue/getRange/getMeanValue', () => {
    it('should return correct values', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);

      expect(bed.getMinValue()).toBeCloseTo(-0.1, 5);
      expect(bed.getMaxValue()).toBeCloseTo(0.1, 5);
      expect(bed.getRange()).toBeCloseTo(0.2, 5);
    });
  });

  describe('getMmPerPoint', () => {
    it('should calculate correct mm per point', () => {
      const bed = new Bed(config3x3);
      const mmPerPoint = bed.getMmPerPoint();

      // 220mm / (3-1) = 110mm per point
      expect(mmPerPoint.x).toBe(110);
      expect(mmPerPoint.y).toBe(110);
    });

    it('should handle different mesh sizes', () => {
      const bed = new Bed(config5x5);
      const mmPerPoint = bed.getMmPerPoint();

      // 220mm / (5-1) = 55mm per point
      expect(mmPerPoint.x).toBe(55);
      expect(mmPerPoint.y).toBe(55);
    });
  });

  describe('generateIdealPlane', () => {
    it('should generate flat plane at mean height', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);

      const idealPlane = bed.generateIdealPlane();
      const meanHeight = bed.getMeanValue();

      // All values should equal the mean
      for (const row of idealPlane) {
        for (const val of row) {
          expect(val).toBeCloseTo(meanHeight, 5);
        }
      }

      // Should have correct dimensions
      expect(idealPlane.length).toBe(3);
      expect(idealPlane[0].length).toBe(3);
    });
  });

  describe('calculateDeviationMap', () => {
    it('should calculate deviations from ideal plane', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);

      const deviationMap = bed.calculateDeviationMap();
      const meanHeight = bed.getMeanValue();

      // Check that deviations are correct
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const expected = sampleMesh3x3[row][col] - meanHeight;
          expect(deviationMap[row][col]).toBeCloseTo(expected, 5);
        }
      }
    });
  });

  describe('simulateAdjustment', () => {
    it('should simulate corner adjustments', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);

      const adjustedMesh = bed.simulateAdjustment({
        [BedCorner.FRONT_LEFT]: -0.1, // Lower front-left by 0.1
      });

      // Front-left corner should be affected most
      expect(adjustedMesh[0][0]).toBeLessThan(sampleMesh3x3[0][0]);

      // Original mesh should be unchanged
      expect(bed.meshData![0][0]).toBe(0.1);
    });

    it('should handle multiple corner adjustments', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);

      const adjustedMesh = bed.simulateAdjustment({
        [BedCorner.FRONT_LEFT]: -0.05,
        [BedCorner.REAR_RIGHT]: 0.05,
      });

      // Both corners should be affected
      expect(adjustedMesh[0][0]).toBeLessThan(sampleMesh3x3[0][0]);
      expect(adjustedMesh[2][2]).toBeGreaterThan(sampleMesh3x3[2][2]);
    });

    it('should skip zero adjustments', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);

      const adjustedMesh = bed.simulateAdjustment({
        [BedCorner.FRONT_LEFT]: 0,
      });

      // Mesh should be unchanged
      expect(adjustedMesh).toEqual(sampleMesh3x3);
    });
  });

  describe('clone', () => {
    it('should create an independent copy', () => {
      const bed = new Bed(config3x3);
      bed.setMeshData(sampleMesh3x3);

      const cloned = bed.clone();

      expect(cloned.config).toEqual(bed.config);
      expect(cloned.meshData).toEqual(bed.meshData);

      // Modify cloned mesh
      cloned.meshData![0][0] = 999;

      // Original should be unchanged
      expect(bed.meshData![0][0]).toBe(0.1);
    });

    it('should clone bed without mesh data', () => {
      const bed = new Bed(config3x3);
      const cloned = bed.clone();

      expect(cloned.hasMeshData).toBe(false);
      expect(cloned.config).toEqual(bed.config);
    });
  });
});
