/**
 * @fileoverview Multi-stage calibration workflow orchestration engine.
 * Computes sequential calibration stages (belt sync, screw adjust, tape, thermal)
 * and aggregates results for UI consumption.
 *
 * @module main/services/calibration/engine/WorkflowEngine
 */

import type {
  BeltSyncResult,
  CalibrationSettings,
  StageResult,
  ThermalPrediction,
  ThermalPreset,
  WorkflowData,
} from '../../../../shared/types/calibration';
import { BedCorner, WorkflowStage } from '../../../../shared/types/calibration';
import type { Bed } from './Bed';
import type { ScrewSolver } from './ScrewSolver';
import type { TapeCalculator } from './TapeCalculator';

/**
 * Action step within a calibration stage.
 */
export interface StageAction {
  /** Type of action (belt, screw, tape, info) */
  kind: 'belt' | 'screw' | 'tape' | 'info';
  /** Unique identifier */
  identifier: string;
  /** Display label */
  label: string;
  /** Rotation/adjustment direction */
  direction?: 'clockwise' | 'counterclockwise' | 'up' | 'down';
  /** Magnitude in mm */
  magnitudeMm?: number;
  /** Belt teeth count */
  teeth?: number;
  /** Rotation in minutes */
  minutes?: number;
  /** Rotation in degrees */
  degrees?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result from a single workflow stage.
 */
export interface WorkflowStageResult {
  /** Stage key identifier */
  key: string;
  /** Display label */
  label: string;
  /** Stage description */
  description: string;
  /** Whether stage is enabled */
  enabled: boolean;
  /** Deviation after this stage */
  deviation: number;
  /** Baseline deviation before stage */
  baseline: number | null;
  /** Mesh state after this stage */
  mesh: number[][];
  /** Actions to take in this stage */
  actions: StageAction[];
  /** Warning messages */
  warnings: string[];
}

/**
 * Workflow flags for enabling/disabling stages.
 */
interface WorkflowFlags {
  enableBelt: boolean;
  enableScrews: boolean;
  enableTape: boolean;
}

/**
 * Multi-stage calibration workflow engine.
 */
export class WorkflowEngine {
  private readonly bed: Bed;
  private readonly screwSolver: ScrewSolver;
  private readonly tapeCalculator: TapeCalculator;
  private settings: CalibrationSettings;

  /**
   * Create a new WorkflowEngine.
   */
  constructor(bed: Bed, screwSolver: ScrewSolver, tapeCalculator: TapeCalculator, settings: CalibrationSettings) {
    this.bed = bed;
    this.screwSolver = screwSolver;
    this.tapeCalculator = tapeCalculator;
    this.settings = settings;
  }

  /**
   * Update settings.
   */
  setSettings(settings: CalibrationSettings): void {
    this.settings = settings;
  }

  /**
   * Compute stage deviation (max - min).
   */
  private computeStageDeviation(mesh: number[][]): number {
    let min = Infinity;
    let max = -Infinity;

    for (const row of mesh) {
      for (const val of row) {
        min = Math.min(min, val);
        max = Math.max(max, val);
      }
    }

    return max - min;
  }

  /**
   * Deep copy a mesh.
   */
  private copyMesh(mesh: number[][]): number[][] {
    return mesh.map((row) => [...row]);
  }

  /**
   * Compute the initial stage (before any corrections).
   */
  private computeInitialStage(mesh: number[][]): WorkflowStageResult {
    const deviation = this.computeStageDeviation(mesh);

    return {
      key: 'initial',
      label: 'Initial State',
      description: 'Current bed mesh before any adjustments',
      enabled: true,
      deviation,
      baseline: null,
      mesh: this.copyMesh(mesh),
      actions: [],
      warnings: [],
    };
  }

  /**
   * Build the belt sync stage.
   */
  private buildBeltStage(
    meshBefore: number[][],
    enabled: boolean
  ): { stage: WorkflowStageResult; meshAfter: number[][] } {
    const baseline = this.computeStageDeviation(meshBefore);

    if (!enabled) {
      return {
        stage: {
          key: 'after_belts',
          label: 'Belt Synchronization',
          description: 'Z-axis belt/lead screw synchronization',
          enabled: false,
          deviation: baseline,
          baseline,
          mesh: this.copyMesh(meshBefore),
          actions: [],
          warnings: ['Stage disabled'],
        },
        meshAfter: meshBefore,
      };
    }

    const rows = meshBefore.length;
    const cols = meshBefore[0]?.length || 0;

    if (rows === 0 || cols === 0) {
      return {
        stage: {
          key: 'after_belts',
          label: 'Belt Synchronization',
          description: 'Z-axis belt/lead screw synchronization',
          enabled: true,
          deviation: baseline,
          baseline,
          mesh: this.copyMesh(meshBefore),
          actions: [],
          warnings: ['No mesh data'],
        },
        meshAfter: meshBefore,
      };
    }

    // Calculate belt adjustments
    const beltThreshold = this.settings.thresholds.beltThreshold;
    const toothMm = this.settings.hardware.beltToothMm;

    const leftFront = meshBefore[0][0];
    const rightFront = meshBefore[0][cols - 1];
    const backCenter = meshBefore[rows - 1][Math.floor(cols / 2)];
    const frontAvg = (leftFront + rightFront) / 2;

    const actions: StageAction[] = [];

    // Left-right tilt
    const lrDiff = rightFront - leftFront;
    if (Math.abs(lrDiff) > beltThreshold) {
      const teeth = Math.max(1, Math.ceil(Math.abs(lrDiff) / toothMm));
      const targetCorner = lrDiff > 0 ? 'front_left' : 'front_right';

      actions.push({
        kind: 'belt',
        identifier: targetCorner,
        label: targetCorner === 'front_left' ? 'Front Left' : 'Front Right',
        direction: 'up',
        magnitudeMm: teeth * toothMm,
        teeth,
        metadata: { rawDifference: lrDiff },
      });
    }

    // Front-back tilt
    const fbDiff = backCenter - frontAvg;
    if (Math.abs(fbDiff) > beltThreshold) {
      const teeth = Math.max(1, Math.ceil(Math.abs(fbDiff) / toothMm));

      actions.push({
        kind: 'belt',
        identifier: 'back',
        label: 'Back Center',
        direction: fbDiff < 0 ? 'up' : 'down',
        magnitudeMm: teeth * toothMm,
        teeth,
        metadata: { rawDifference: fbDiff },
      });
    }

    // Simulate belt adjustment effect (simplified)
    const meshAfter = this.copyMesh(meshBefore);
    // In a full implementation, we'd apply weighted adjustments
    // For now, we assume belt adjustments reduce tilt proportionally

    const deviation = this.computeStageDeviation(meshAfter);

    return {
      stage: {
        key: 'after_belts',
        label: 'Belt Synchronization',
        description: 'Z-axis belt/lead screw synchronization',
        enabled: true,
        deviation,
        baseline,
        mesh: meshAfter,
        actions,
        warnings: actions.length === 0 ? ['No belt adjustments needed'] : [],
      },
      meshAfter,
    };
  }

  /**
   * Build the screw adjustment stage.
   */
  private buildScrewStage(
    meshBefore: number[][],
    enabled: boolean
  ): { stage: WorkflowStageResult; meshAfter: number[][] } {
    const baseline = this.computeStageDeviation(meshBefore);

    if (!enabled) {
      return {
        stage: {
          key: 'after_screws',
          label: 'Screw Adjustments',
          description: 'Corner screw leveling adjustments',
          enabled: false,
          deviation: baseline,
          baseline,
          mesh: this.copyMesh(meshBefore),
          actions: [],
          warnings: ['Stage disabled'],
        },
        meshAfter: meshBefore,
      };
    }

    // Auto-select reference corner and calculate adjustments
    this.screwSolver.autoSelectReferenceCorner(this.settings.hardware.cornerAveraging);
    const adjustments = this.screwSolver.calculateAdjustments(this.settings.hardware.cornerAveraging);

    // Build actions from adjustments
    const actions: StageAction[] = adjustments
      .filter((adj) => adj.requiresAdjustment)
      .map((adj) => ({
        kind: 'screw' as const,
        identifier: adj.corner,
        label: this.formatCornerName(adj.corner),
        direction: adj.direction === 'CW' ? ('clockwise' as const) : ('counterclockwise' as const),
        minutes: adj.minutes,
        degrees: adj.degrees,
        magnitudeMm: Math.abs(adj.deviation),
        metadata: { turns: adj.turns },
      }));

    // Simulate screw adjustments
    const cornerAdjustments: Partial<Record<BedCorner, number>> = {};
    for (const adj of adjustments) {
      if (adj.requiresAdjustment) {
        const change = this.screwSolver.heightChangeFromMinutes(adj.minutes, adj.direction);
        cornerAdjustments[adj.corner] = change;
      }
    }

    const meshAfter = this.bed.simulateAdjustment(cornerAdjustments);
    const deviation = this.computeStageDeviation(meshAfter);

    return {
      stage: {
        key: 'after_screws',
        label: 'Screw Adjustments',
        description: 'Corner screw leveling adjustments',
        enabled: true,
        deviation,
        baseline,
        mesh: meshAfter,
        actions,
        warnings: actions.length === 0 ? ['No screw adjustments needed'] : [],
      },
      meshAfter,
    };
  }

  /**
   * Build the tape compensation stage.
   */
  private buildTapeStage(
    meshBefore: number[][],
    enabled: boolean
  ): { stage: WorkflowStageResult; meshAfter: number[][] } {
    const baseline = this.computeStageDeviation(meshBefore);

    if (!enabled) {
      return {
        stage: {
          key: 'after_tape',
          label: 'Tape Compensation',
          description: 'Fine adjustment using tape shims',
          enabled: false,
          deviation: baseline,
          baseline,
          mesh: this.copyMesh(meshBefore),
          actions: [],
          warnings: ['Stage disabled'],
        },
        meshAfter: meshBefore,
      };
    }

    // Find and optimize tape spots
    const spots = this.tapeCalculator.findLowSpots(meshBefore);
    const optimizedSpots = this.tapeCalculator.optimizeTapeLayout(spots);

    // Build actions from spots
    const actions: StageAction[] = optimizedSpots.map((spot) => ({
      kind: 'tape' as const,
      identifier: `${spot.y + 1}${String.fromCharCode(65 + spot.x)}`,
      label: `Position ${spot.y + 1}${String.fromCharCode(65 + spot.x)}`,
      magnitudeMm: spot.heightDiff,
      metadata: {
        layers: spot.layers,
        thickness: spot.layers * this.settings.hardware.tapeThickness,
      },
    }));

    // Apply tape spots
    const meshAfter =
      optimizedSpots.length > 0
        ? this.tapeCalculator.applySpots(meshBefore, optimizedSpots)
        : this.copyMesh(meshBefore);

    const deviation = this.computeStageDeviation(meshAfter);

    return {
      stage: {
        key: 'after_tape',
        label: 'Tape Compensation',
        description: 'Fine adjustment using tape shims',
        enabled: true,
        deviation,
        baseline,
        mesh: meshAfter,
        actions,
        warnings: actions.length === 0 ? ['No tape compensation needed'] : [],
      },
      meshAfter,
    };
  }

  /**
   * Build the thermal prediction stage.
   */
  private buildTemperatureStage(meshBefore: number[][]): { stage: WorkflowStageResult; meshAfter: number[][] } {
    const baseline = this.computeStageDeviation(meshBefore);

    // Get active thermal preset
    const activePreset = this.settings.thermalPresets.find((p) => p.name === this.settings.activeThermalPreset);

    if (!activePreset) {
      return {
        stage: {
          key: 'after_temperature',
          label: 'Temperature Prediction',
          description: 'Thermal expansion effects at operating temperature',
          enabled: false,
          deviation: baseline,
          baseline,
          mesh: this.copyMesh(meshBefore),
          actions: [],
          warnings: ['No thermal preset selected'],
        },
        meshAfter: meshBefore,
      };
    }

    // Apply thermal model
    const meshAfter = this.applyThermalEffect(meshBefore, activePreset);
    const deviation = this.computeStageDeviation(meshAfter);

    const hasEffect = Math.abs(deviation - baseline) > 0.001;

    return {
      stage: {
        key: 'after_temperature',
        label: 'Temperature Prediction',
        description: `Thermal expansion at ${activePreset.targetTemp}°C`,
        enabled: hasEffect,
        deviation,
        baseline,
        mesh: meshAfter,
        actions: [],
        warnings: hasEffect ? [] : ['Minimal thermal effect'],
      },
      meshAfter,
    };
  }

  /**
   * Apply thermal expansion effect to mesh.
   */
  private applyThermalEffect(mesh: number[][], preset: ThermalPreset): number[][] {
    const rows = mesh.length;
    const cols = mesh[0]?.length || 0;

    if (rows === 0 || cols === 0) {
      return this.copyMesh(mesh);
    }

    const deltaTemp = preset.targetTemp - preset.measurementTemp;
    if (Math.abs(deltaTemp) < 0.1) {
      return this.copyMesh(mesh);
    }

    const { x: xStep, y: yStep } = this.bed.getMmPerPoint();
    const centerX = this.bed.config.sizeX / 2;
    const centerY = this.bed.config.sizeY / 2;

    const result = this.copyMesh(mesh);

    // Simple radial thermal expansion model
    const expansionCoeff = preset.alphaSteel || this.settings.environment.thermalExpansionCoeff;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * xStep - centerX;
        const y = row * yStep - centerY;
        const radiusSq = x * x + y * y;
        const maxRadiusSq = centerX * centerX + centerY * centerY;

        // Warp increases with distance from center
        const warp = expansionCoeff * deltaTemp * (radiusSq / maxRadiusSq);
        result[row][col] += warp;
      }
    }

    // Normalize to zero mean offset
    let sum = 0;
    for (const row of result) {
      for (const val of row) {
        sum += val;
      }
    }
    const mean = sum / (rows * cols);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        result[row][col] -= mean;
      }
    }

    return result;
  }

  /**
   * Format corner name for display.
   */
  private formatCornerName(corner: BedCorner | string): string {
    const mapping: Record<string, string> = {
      [BedCorner.FRONT_LEFT]: 'Front Left',
      [BedCorner.FRONT_RIGHT]: 'Front Right',
      [BedCorner.REAR_LEFT]: 'Rear Left',
      [BedCorner.REAR_RIGHT]: 'Rear Right',
    };
    return mapping[corner] || corner;
  }

  /**
   * Compute the complete calibration workflow.
   */
  computeWorkflow(): WorkflowData {
    if (!this.bed.meshData) {
      throw new Error('No mesh data loaded');
    }

    const startTime = Date.now();
    const meshState = this.copyMesh(this.bed.meshData);
    const stages = new Map<WorkflowStage, StageResult>();
    const completedStages: WorkflowStage[] = [];

    const flags: WorkflowFlags = {
      enableBelt: this.settings.workflow.enableBelt,
      enableScrews: this.settings.workflow.enableScrews,
      enableTape: this.settings.workflow.enableTape,
    };

    // Initial stage
    const initialResult = this.computeInitialStage(meshState);
    const initialRange = initialResult.deviation;

    // Belt stage
    const { stage: beltStage, meshAfter: meshAfterBelt } = this.buildBeltStage(meshState, flags.enableBelt);

    // Screw stage
    const { stage: screwStage, meshAfter: meshAfterScrew } = this.buildScrewStage(meshAfterBelt, flags.enableScrews);

    // Tape stage
    const { stage: tapeStage, meshAfter: meshAfterTape } = this.buildTapeStage(meshAfterScrew, flags.enableTape);

    // Temperature stage
    const { stage: tempStage, meshAfter: meshAfterTemp } = this.buildTemperatureStage(meshAfterTape);

    // Build stage results
    const beltSyncResult: BeltSyncResult = {
      xAxisTilt: 0, // Calculated from belt stage
      yAxisTilt: 0,
      needsSync: beltStage.actions.length > 0,
      recommendation:
        beltStage.actions.length > 0 ? `Adjust ${beltStage.actions.length} belt position(s)` : 'Belts are synchronized',
    };

    const screwAdjustments = this.screwSolver.calculateAdjustments(this.settings.hardware.cornerAveraging);

    const tapeRecommendations = this.tapeCalculator.calculateLayers(this.settings.hardware.cornerAveraging);

    const thermalPrediction: ThermalPrediction = {
      predictedMesh: meshAfterTemp,
      rangeChange: tempStage.deviation - tapeStage.deviation,
      tempDelta: this.settings.activeThermalPreset
        ? (this.settings.thermalPresets.find((p) => p.name === this.settings.activeThermalPreset)?.targetTemp || 60) -
          (this.settings.thermalPresets.find((p) => p.name === this.settings.activeThermalPreset)?.measurementTemp ||
            25)
        : 0,
      expansionCoeff: this.settings.environment.thermalExpansionCoeff,
    };

    // Store stage results
    stages.set(WorkflowStage.INITIAL, {
      stage: WorkflowStage.INITIAL,
      success: true,
      data: initialResult,
      metrics: { deviation: initialResult.deviation },
      nextStage: WorkflowStage.BELT_SYNC,
    });
    completedStages.push(WorkflowStage.INITIAL);

    stages.set(WorkflowStage.BELT_SYNC, {
      stage: WorkflowStage.BELT_SYNC,
      success: true,
      data: beltStage,
      metrics: { deviation: beltStage.deviation },
      nextStage: WorkflowStage.SCREW_ADJUST,
    });
    completedStages.push(WorkflowStage.BELT_SYNC);

    stages.set(WorkflowStage.SCREW_ADJUST, {
      stage: WorkflowStage.SCREW_ADJUST,
      success: true,
      data: screwStage,
      metrics: { deviation: screwStage.deviation },
      nextStage: WorkflowStage.TAPE_COMPENSATE,
    });
    completedStages.push(WorkflowStage.SCREW_ADJUST);

    stages.set(WorkflowStage.TAPE_COMPENSATE, {
      stage: WorkflowStage.TAPE_COMPENSATE,
      success: true,
      data: tapeStage,
      metrics: { deviation: tapeStage.deviation },
      nextStage: WorkflowStage.THERMAL_PREDICT,
    });
    completedStages.push(WorkflowStage.TAPE_COMPENSATE);

    stages.set(WorkflowStage.THERMAL_PREDICT, {
      stage: WorkflowStage.THERMAL_PREDICT,
      success: true,
      data: tempStage,
      metrics: { deviation: tempStage.deviation },
      nextStage: WorkflowStage.COMPLETE,
    });
    completedStages.push(WorkflowStage.THERMAL_PREDICT);

    // Calculate final metrics
    const finalRange = tempStage.deviation;
    const improvementPercent = initialRange > 0 ? ((initialRange - finalRange) / initialRange) * 100 : 0;

    return {
      currentStage: WorkflowStage.COMPLETE,
      stages,
      startTime,
      completedStages,
      beltSyncResult,
      screwAdjustments,
      tapeRecommendations,
      thermalPrediction,
      initialRange,
      finalRange,
      improvementPercent,
    };
  }

  /**
   * Get result for a specific stage.
   */
  getStageResult(workflow: WorkflowData, stage: WorkflowStage): StageResult | undefined {
    return workflow.stages.get(stage);
  }

  /**
   * Check if a stage can be skipped.
   */
  canSkipStage(stage: WorkflowStage): boolean {
    switch (stage) {
      case WorkflowStage.BELT_SYNC:
        return !this.settings.workflow.enableBelt;
      case WorkflowStage.SCREW_ADJUST:
        return !this.settings.workflow.enableScrews;
      case WorkflowStage.TAPE_COMPENSATE:
        return !this.settings.workflow.enableTape;
      default:
        return false;
    }
  }
}
