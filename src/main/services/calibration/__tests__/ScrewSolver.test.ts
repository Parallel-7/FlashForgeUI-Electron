/**
 * @fileoverview Unit tests for the ScrewSolver class.
 * Tests screw adjustment calculations, rotation conversions, and direction determination.
 *
 * @module main/services/calibration/__tests__/ScrewSolver.test
 */

import type { BedConfig, ScrewConfig } from '../../../../shared/types/calibration';
import { BedCorner, DEFAULT_SCREW_CONFIG, RotationDirection } from '../../../../shared/types/calibration';
import { Bed } from '../engine/Bed';
import { ScrewSolver } from '../engine/ScrewSolver';

describe('ScrewSolver', () => {
  const config3x3: BedConfig = {
    sizeX: 220,
    sizeY: 220,
    meshPointsX: 3,
    meshPointsY: 3,
  };

  // Mesh with front-left high, rear-right low
  const tiltedMesh = [
    [0.2, 0.1, 0.0],
    [0.1, 0.0, -0.1],
    [0.0, -0.1, -0.2],
  ];

  // Level mesh
  const levelMesh = [
    [0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0],
  ];

  let bed: Bed;
  let solver: ScrewSolver;

  beforeEach(() => {
    bed = new Bed(config3x3);
    bed.setMeshData(tiltedMesh);
    solver = new ScrewSolver(bed);
  });

  describe('constructor', () => {
    it('should create solver with default config', () => {
      const solver = new ScrewSolver(bed);
      expect(solver).toBeDefined();
    });

    it('should create solver with custom config', () => {
      const customConfig: ScrewConfig = {
        pitch: 0.8,
        minAdjust: 0.02,
        maxAdjust: 3.0,
      };
      const solver = new ScrewSolver(bed, customConfig);
      expect(solver).toBeDefined();
    });
  });

  describe('setReferenceCorner', () => {
    it('should set reference corner manually', () => {
      solver.setReferenceCorner(BedCorner.REAR_RIGHT);
      const adjustments = solver.calculateAdjustments();

      // Rear-right should have no adjustment (it's the reference)
      const rrAdj = adjustments.find((a) => a.corner === BedCorner.REAR_RIGHT);
      expect(rrAdj?.deviation).toBeCloseTo(0, 5);
    });
  });

  describe('autoSelectReferenceCorner', () => {
    it('should select lowest corner as reference', () => {
      const selected = solver.autoSelectReferenceCorner();
      // Rear-right is lowest at -0.2
      expect(selected).toBe(BedCorner.REAR_RIGHT);
    });

    it('should handle level bed', () => {
      const levelBed = new Bed(config3x3);
      levelBed.setMeshData(levelMesh);
      const levelSolver = new ScrewSolver(levelBed);

      const selected = levelSolver.autoSelectReferenceCorner();
      // When all are equal, front-left is chosen (first checked)
      expect(selected).toBe(BedCorner.FRONT_LEFT);
    });
  });

  describe('deviationToMinutes', () => {
    it('should convert deviation to minutes correctly', () => {
      // With default pitch of 0.5mm:
      // 0.5mm deviation = 1 full turn = 360 * 60 = 21600 minutes
      // 0.1mm deviation = 0.2 turns = 72 * 60 = 4320 minutes
      const minutes = solver.deviationToMinutes(0.1);
      expect(minutes).toBeCloseTo(4320, 0);
    });

    it('should handle negative deviation', () => {
      // Should return absolute value
      const minutes = solver.deviationToMinutes(-0.1);
      expect(minutes).toBeCloseTo(4320, 0);
    });

    it('should return 0 for zero deviation', () => {
      const minutes = solver.deviationToMinutes(0);
      expect(minutes).toBe(0);
    });
  });

  describe('deviationToDegrees', () => {
    it('should convert deviation to degrees correctly', () => {
      // 0.5mm deviation = 360 degrees (1 full turn)
      // 0.1mm deviation = 72 degrees
      const degrees = solver.deviationToDegrees(0.1);
      expect(degrees).toBeCloseTo(72, 0);
    });
  });

  describe('deviationToTurns', () => {
    it('should convert deviation to turns correctly', () => {
      // 0.5mm deviation = 1 turn
      // 0.1mm deviation = 0.2 turns
      const turns = solver.deviationToTurns(0.1);
      expect(turns).toBeCloseTo(0.2, 5);
    });
  });

  describe('getDirection', () => {
    it('should return CCW for positive deviation (bed too low)', () => {
      const direction = solver.getDirection(0.1);
      expect(direction).toBe(RotationDirection.COUNTERCLOCKWISE);
    });

    it('should return CW for negative deviation (bed too high)', () => {
      const direction = solver.getDirection(-0.1);
      expect(direction).toBe(RotationDirection.CLOCKWISE);
    });

    it('should return CW for zero deviation', () => {
      const direction = solver.getDirection(0);
      // Zero is not > 0, so returns CW
      expect(direction).toBe(RotationDirection.CLOCKWISE);
    });
  });

  describe('heightChangeFromMinutes', () => {
    it('should calculate height change for CW rotation', () => {
      // CW should lower the bed (negative change)
      const change = solver.heightChangeFromMinutes(4320, RotationDirection.CLOCKWISE);
      expect(change).toBeLessThan(0);
      expect(change).toBeCloseTo(-0.1, 2);
    });

    it('should calculate height change for CCW rotation', () => {
      // CCW should raise the bed (positive change)
      const change = solver.heightChangeFromMinutes(4320, RotationDirection.COUNTERCLOCKWISE);
      expect(change).toBeGreaterThan(0);
      expect(change).toBeCloseTo(0.1, 2);
    });
  });

  describe('calculateCornerAdjustment', () => {
    it('should calculate adjustment for single corner', () => {
      const adjustment = solver.calculateCornerAdjustment(BedCorner.FRONT_LEFT, 0, 0);

      expect(adjustment.corner).toBe(BedCorner.FRONT_LEFT);
      expect(adjustment.deviation).toBeCloseTo(-0.2, 5);
      expect(adjustment.direction).toBe(RotationDirection.CLOCKWISE);
      expect(adjustment.requiresAdjustment).toBe(true);
    });

    it('should not require adjustment for minimal deviation', () => {
      const levelBed = new Bed(config3x3);
      levelBed.setMeshData(levelMesh);
      const levelSolver = new ScrewSolver(levelBed);

      const adjustment = levelSolver.calculateCornerAdjustment(BedCorner.FRONT_LEFT, 0, 0);
      expect(adjustment.requiresAdjustment).toBe(false);
      expect(adjustment.formattedAmount).toBe('No adjustment needed');
    });

    it('should format large adjustments as turns', () => {
      // Create mesh with large deviation
      const largeMesh = [
        [1.0, 0.5, 0.0],
        [0.5, 0.0, -0.5],
        [0.0, -0.5, -1.0],
      ];
      const largeBed = new Bed(config3x3);
      largeBed.setMeshData(largeMesh);
      const largeSolver = new ScrewSolver(largeBed);

      const adjustment = largeSolver.calculateCornerAdjustment(BedCorner.FRONT_LEFT, 0, 0);
      expect(adjustment.turns).toBeGreaterThanOrEqual(1);
      expect(adjustment.formattedAmount).toContain('turns');
    });

    it('should format medium adjustments as degrees', () => {
      const medMesh = [
        [0.1, 0.05, 0.0],
        [0.05, 0.0, -0.05],
        [0.0, -0.05, -0.1],
      ];
      const medBed = new Bed(config3x3);
      medBed.setMeshData(medMesh);
      const medSolver = new ScrewSolver(medBed);

      const adjustment = medSolver.calculateCornerAdjustment(BedCorner.FRONT_LEFT, 0, 0);
      // 0.1mm = 72 degrees, which is > 30 degrees
      expect(adjustment.formattedAmount).toContain('°');
    });
  });

  describe('calculateAdjustments', () => {
    it('should calculate adjustments for all corners', () => {
      solver.autoSelectReferenceCorner();
      const adjustments = solver.calculateAdjustments();

      expect(adjustments.length).toBe(4);

      // Check that all corners are represented
      const corners = adjustments.map((a) => a.corner);
      expect(corners).toContain(BedCorner.FRONT_LEFT);
      expect(corners).toContain(BedCorner.FRONT_RIGHT);
      expect(corners).toContain(BedCorner.REAR_LEFT);
      expect(corners).toContain(BedCorner.REAR_RIGHT);
    });

    it('should have zero deviation for reference corner', () => {
      solver.autoSelectReferenceCorner(); // Sets rear-right as reference
      const adjustments = solver.calculateAdjustments();

      const rrAdj = adjustments.find((a) => a.corner === BedCorner.REAR_RIGHT);
      expect(rrAdj?.deviation).toBeCloseTo(0, 5);
      expect(rrAdj?.requiresAdjustment).toBe(false);
    });

    it('should calculate correct deviations relative to reference', () => {
      solver.setReferenceCorner(BedCorner.REAR_RIGHT);
      const adjustments = solver.calculateAdjustments();

      // Front-left is 0.2, rear-right is -0.2, target is -0.2, so deviation = -0.4
      const flAdj = adjustments.find((a) => a.corner === BedCorner.FRONT_LEFT);
      expect(flAdj?.deviation).toBeCloseTo(-0.4, 5);
    });
  });

  describe('calculateAdjustmentsToTarget', () => {
    it('should calculate adjustments to reach target height', () => {
      const targetHeight = 0;
      const adjustments = solver.calculateAdjustmentsToTarget(targetHeight);

      // Front-left at 0.2 should need adjustment to reach 0
      const flAdj = adjustments.find((a) => a.corner === BedCorner.FRONT_LEFT);
      expect(flAdj?.deviation).toBeCloseTo(-0.2, 5);
      expect(flAdj?.direction).toBe(RotationDirection.CLOCKWISE); // Lower it

      // Rear-right at -0.2 should need adjustment to reach 0
      const rrAdj = adjustments.find((a) => a.corner === BedCorner.REAR_RIGHT);
      expect(rrAdj?.deviation).toBeCloseTo(0.2, 5);
      expect(rrAdj?.direction).toBe(RotationDirection.COUNTERCLOCKWISE); // Raise it
    });
  });

  describe('getAdjustmentSummary', () => {
    it('should provide adjustment summary', () => {
      solver.autoSelectReferenceCorner();
      const adjustments = solver.calculateAdjustments();
      const summary = solver.getAdjustmentSummary(adjustments);

      expect(summary.totalAdjustmentsNeeded).toBeGreaterThan(0);
      expect(summary.maxMinutes).toBeGreaterThan(0);
      expect(summary.corners.length).toBe(4);
    });

    it('should show no adjustments for level bed', () => {
      const levelBed = new Bed(config3x3);
      levelBed.setMeshData(levelMesh);
      const levelSolver = new ScrewSolver(levelBed);

      levelSolver.autoSelectReferenceCorner();
      const adjustments = levelSolver.calculateAdjustments();
      const summary = levelSolver.getAdjustmentSummary(adjustments);

      expect(summary.totalAdjustmentsNeeded).toBe(0);
    });
  });

  describe('setConfig', () => {
    it('should update screw configuration', () => {
      const newConfig: Partial<ScrewConfig> = { pitch: 0.8 };
      solver.setConfig(newConfig);

      // With larger pitch, same deviation should produce fewer minutes
      const minutesWithNewPitch = solver.deviationToMinutes(0.1);
      const expectedMinutes = (0.1 * 360 * 60) / 0.8;
      expect(minutesWithNewPitch).toBeCloseTo(expectedMinutes, 0);
    });
  });
});
