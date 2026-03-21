/**
 * @fileoverview Unit tests for the WorkflowEngine class.
 * Tests multi-stage calibration workflow computation.
 *
 * @module main/services/calibration/__tests__/WorkflowEngine.test
 */

import type { BedConfig, CalibrationSettings } from '../../../../shared/types/calibration';
import {
  DEFAULT_CALIBRATION_SETTINGS,
  DEFAULT_SCREW_CONFIG,
  DEFAULT_TAPE_CONFIG,
  WorkflowStage,
} from '../../../../shared/types/calibration';
import { Bed } from '../engine/Bed';
import { ScrewSolver } from '../engine/ScrewSolver';
import { TapeCalculator } from '../engine/TapeCalculator';
import { WorkflowEngine } from '../engine/WorkflowEngine';

describe('WorkflowEngine', () => {
  const config5x5: BedConfig = {
    sizeX: 220,
    sizeY: 220,
    meshPointsX: 5,
    meshPointsY: 5,
  };

  // Tilted mesh requiring calibration
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

  let bed: Bed;
  let screwSolver: ScrewSolver;
  let tapeCalculator: TapeCalculator;
  let settings: CalibrationSettings;
  let engine: WorkflowEngine;

  beforeEach(() => {
    bed = new Bed(config5x5);
    bed.setMeshData(tiltedMesh);

    screwSolver = new ScrewSolver(bed, DEFAULT_SCREW_CONFIG);
    tapeCalculator = new TapeCalculator(bed, DEFAULT_TAPE_CONFIG);
    settings = { ...DEFAULT_CALIBRATION_SETTINGS };

    engine = new WorkflowEngine(bed, screwSolver, tapeCalculator, settings);
  });

  describe('constructor', () => {
    it('should create workflow engine', () => {
      expect(engine).toBeDefined();
    });
  });

  describe('setSettings', () => {
    it('should update settings', () => {
      const newSettings = { ...settings, workflow: { enableBelt: false, enableScrews: true, enableTape: true } };
      engine.setSettings(newSettings);
      // Verify by computing workflow
      const workflow = engine.computeWorkflow();
      expect(workflow).toBeDefined();
    });
  });

  describe('computeWorkflow', () => {
    it('should compute complete workflow', () => {
      const workflow = engine.computeWorkflow();

      expect(workflow.currentStage).toBe(WorkflowStage.COMPLETE);
      expect(workflow.startTime).toBeGreaterThan(0);
      expect(workflow.completedStages.length).toBeGreaterThan(0);
      expect(workflow.initialRange).toBeGreaterThan(0);
    });

    it('should include all stages', () => {
      const workflow = engine.computeWorkflow();

      expect(workflow.stages.has(WorkflowStage.INITIAL)).toBe(true);
      expect(workflow.stages.has(WorkflowStage.BELT_SYNC)).toBe(true);
      expect(workflow.stages.has(WorkflowStage.SCREW_ADJUST)).toBe(true);
      expect(workflow.stages.has(WorkflowStage.TAPE_COMPENSATE)).toBe(true);
      expect(workflow.stages.has(WorkflowStage.THERMAL_PREDICT)).toBe(true);
    });

    it('should calculate improvement percentage', () => {
      const workflow = engine.computeWorkflow();

      expect(workflow.initialRange).toBeGreaterThan(0);
      expect(workflow.improvementPercent).toBeDefined();
    });

    it('should include screw adjustments', () => {
      const workflow = engine.computeWorkflow();

      expect(workflow.screwAdjustments).toBeDefined();
      expect(workflow.screwAdjustments!.length).toBe(4);
    });

    it('should include belt sync result', () => {
      const workflow = engine.computeWorkflow();

      expect(workflow.beltSyncResult).toBeDefined();
      expect(typeof workflow.beltSyncResult!.needsSync).toBe('boolean');
    });

    it('should include tape recommendations', () => {
      const workflow = engine.computeWorkflow();

      expect(workflow.tapeRecommendations).toBeDefined();
    });

    it('should include thermal prediction', () => {
      const workflow = engine.computeWorkflow();

      expect(workflow.thermalPrediction).toBeDefined();
      expect(workflow.thermalPrediction!.predictedMesh).toBeDefined();
    });

    it('should throw when no mesh data loaded', () => {
      const emptyBed = new Bed(config5x5);
      const emptySolver = new ScrewSolver(emptyBed);
      const emptyCalc = new TapeCalculator(emptyBed);
      const emptyEngine = new WorkflowEngine(emptyBed, emptySolver, emptyCalc, settings);

      expect(() => emptyEngine.computeWorkflow()).toThrow('No mesh data loaded');
    });
  });

  describe('stage processing', () => {
    it('should process initial stage correctly', () => {
      const workflow = engine.computeWorkflow();
      const initialStage = workflow.stages.get(WorkflowStage.INITIAL);

      expect(initialStage).toBeDefined();
      expect(initialStage!.success).toBe(true);
      expect(initialStage!.metrics.deviation).toBeGreaterThan(0);
    });

    it('should process belt stage', () => {
      const workflow = engine.computeWorkflow();
      const beltStage = workflow.stages.get(WorkflowStage.BELT_SYNC);

      expect(beltStage).toBeDefined();
      expect(beltStage!.success).toBe(true);
    });

    it('should process screw stage', () => {
      const workflow = engine.computeWorkflow();
      const screwStage = workflow.stages.get(WorkflowStage.SCREW_ADJUST);

      expect(screwStage).toBeDefined();
      expect(screwStage!.success).toBe(true);
    });

    it('should process tape stage', () => {
      const workflow = engine.computeWorkflow();
      const tapeStage = workflow.stages.get(WorkflowStage.TAPE_COMPENSATE);

      expect(tapeStage).toBeDefined();
      expect(tapeStage!.success).toBe(true);
    });

    it('should process thermal stage', () => {
      const workflow = engine.computeWorkflow();
      const thermalStage = workflow.stages.get(WorkflowStage.THERMAL_PREDICT);

      expect(thermalStage).toBeDefined();
      expect(thermalStage!.success).toBe(true);
    });
  });

  describe('stage disabling', () => {
    it('should skip belt stage when disabled', () => {
      const noSyncSettings = {
        ...settings,
        workflow: { enableBelt: false, enableScrews: true, enableTape: true },
      };
      engine.setSettings(noSyncSettings);

      const workflow = engine.computeWorkflow();
      const beltStage = workflow.stages.get(WorkflowStage.BELT_SYNC);

      expect(beltStage!.data).toHaveProperty('enabled', false);
    });

    it('should skip screw stage when disabled', () => {
      const noScrewSettings = {
        ...settings,
        workflow: { enableBelt: true, enableScrews: false, enableTape: true },
      };
      engine.setSettings(noScrewSettings);

      const workflow = engine.computeWorkflow();
      const screwStage = workflow.stages.get(WorkflowStage.SCREW_ADJUST);

      expect(screwStage!.data).toHaveProperty('enabled', false);
    });

    it('should skip tape stage when disabled', () => {
      const noTapeSettings = {
        ...settings,
        workflow: { enableBelt: true, enableScrews: true, enableTape: false },
      };
      engine.setSettings(noTapeSettings);

      const workflow = engine.computeWorkflow();
      const tapeStage = workflow.stages.get(WorkflowStage.TAPE_COMPENSATE);

      expect(tapeStage!.data).toHaveProperty('enabled', false);
    });
  });

  describe('getStageResult', () => {
    it('should return result for specific stage', () => {
      const workflow = engine.computeWorkflow();
      const result = engine.getStageResult(workflow, WorkflowStage.SCREW_ADJUST);

      expect(result).toBeDefined();
      expect(result!.stage).toBe(WorkflowStage.SCREW_ADJUST);
    });

    it('should return undefined for non-existent stage', () => {
      const workflow = engine.computeWorkflow();
      // Remove a stage manually for testing
      workflow.stages.delete(WorkflowStage.BELT_SYNC);

      const result = engine.getStageResult(workflow, WorkflowStage.BELT_SYNC);
      expect(result).toBeUndefined();
    });
  });

  describe('canSkipStage', () => {
    it('should indicate belt stage can be skipped when disabled', () => {
      const noSyncSettings = {
        ...settings,
        workflow: { enableBelt: false, enableScrews: true, enableTape: true },
      };
      engine.setSettings(noSyncSettings);

      expect(engine.canSkipStage(WorkflowStage.BELT_SYNC)).toBe(true);
    });

    it('should indicate screw stage can be skipped when disabled', () => {
      const noScrewSettings = {
        ...settings,
        workflow: { enableBelt: true, enableScrews: false, enableTape: true },
      };
      engine.setSettings(noScrewSettings);

      expect(engine.canSkipStage(WorkflowStage.SCREW_ADJUST)).toBe(true);
    });

    it('should indicate tape stage can be skipped when disabled', () => {
      const noTapeSettings = {
        ...settings,
        workflow: { enableBelt: true, enableScrews: true, enableTape: false },
      };
      engine.setSettings(noTapeSettings);

      expect(engine.canSkipStage(WorkflowStage.TAPE_COMPENSATE)).toBe(true);
    });

    it('should not skip INITIAL or COMPLETE stages', () => {
      expect(engine.canSkipStage(WorkflowStage.INITIAL)).toBe(false);
      expect(engine.canSkipStage(WorkflowStage.COMPLETE)).toBe(false);
    });
  });

  describe('thermal preset handling', () => {
    it('should apply thermal preset when selected', () => {
      const thermalSettings = {
        ...settings,
        activeThermalPreset: 'PEI Spring Steel',
      };
      engine.setSettings(thermalSettings);

      const workflow = engine.computeWorkflow();
      expect(workflow.thermalPrediction).toBeDefined();
    });

    it('should skip thermal when no preset selected', () => {
      const noThermalSettings = {
        ...settings,
        activeThermalPreset: null,
      };
      engine.setSettings(noThermalSettings);

      const workflow = engine.computeWorkflow();
      const thermalStage = workflow.stages.get(WorkflowStage.THERMAL_PREDICT);

      // Should have warning about no preset
      expect(thermalStage!.data).toHaveProperty('warnings');
    });
  });

  describe('level bed handling', () => {
    it('should handle level bed gracefully', () => {
      const levelBed = new Bed(config5x5);
      levelBed.setMeshData(levelMesh);

      const levelSolver = new ScrewSolver(levelBed);
      const levelCalc = new TapeCalculator(levelBed);
      const levelEngine = new WorkflowEngine(levelBed, levelSolver, levelCalc, settings);

      const workflow = levelEngine.computeWorkflow();

      expect(workflow.currentStage).toBe(WorkflowStage.COMPLETE);
      expect(workflow.initialRange).toBeCloseTo(0, 5);

      // Screw stage should indicate no adjustments needed
      const screwStage = workflow.stages.get(WorkflowStage.SCREW_ADJUST);
      expect(screwStage!.data).toHaveProperty('actions');
    });
  });

  describe('stage actions', () => {
    it('should generate belt actions when needed', () => {
      // X-tilt mesh
      const xTiltMesh = [
        [0.15, 0.1, 0.05, 0.0, -0.05],
        [0.15, 0.1, 0.05, 0.0, -0.05],
        [0.15, 0.1, 0.05, 0.0, -0.05],
        [0.15, 0.1, 0.05, 0.0, -0.05],
        [0.15, 0.1, 0.05, 0.0, -0.05],
      ];

      const xTiltBed = new Bed(config5x5);
      xTiltBed.setMeshData(xTiltMesh);

      const xSolver = new ScrewSolver(xTiltBed);
      const xCalc = new TapeCalculator(xTiltBed);
      const xEngine = new WorkflowEngine(xTiltBed, xSolver, xCalc, settings);

      const workflow = xEngine.computeWorkflow();
      const beltStage = workflow.stages.get(WorkflowStage.BELT_SYNC);

      // Should have belt actions due to X-axis tilt
      expect(beltStage!.data).toHaveProperty('actions');
      const actions = (beltStage!.data as { actions: unknown[] }).actions;
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should generate screw actions for tilted bed', () => {
      const workflow = engine.computeWorkflow();
      const screwStage = workflow.stages.get(WorkflowStage.SCREW_ADJUST);

      const actions = (screwStage!.data as { actions: unknown[] }).actions;
      expect(actions.length).toBeGreaterThan(0);
    });
  });

  describe('deviation tracking', () => {
    it('should track deviation through stages', () => {
      const workflow = engine.computeWorkflow();

      const initialStage = workflow.stages.get(WorkflowStage.INITIAL);
      const screwStage = workflow.stages.get(WorkflowStage.SCREW_ADJUST);

      const initialDev = (initialStage!.data as { deviation: number }).deviation;
      const screwDev = (screwStage!.data as { deviation: number }).deviation;

      // Deviation should decrease after screw adjustment
      expect(screwDev).toBeLessThanOrEqual(initialDev);
    });
  });
});
