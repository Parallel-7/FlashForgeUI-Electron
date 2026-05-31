/**
 * @fileoverview Analyzer for bed mesh deviations and calibration strategy determination.
 * Analyzes mesh data to identify problems and recommend calibration approaches.
 *
 * @module main/services/calibration/engine/DeviationAnalyzer
 */

import type { AnalysisResult, BedCorners, ScrewConfig } from '../../../../shared/types/calibration';
import { BedCorner, DEFAULT_SCREW_CONFIG } from '../../../../shared/types/calibration';
import type { Bed } from './Bed';
import { ScrewSolver } from './ScrewSolver';

/**
 * Statistics about bed mesh deviations.
 */
export interface DeviationStats {
  /** Mean height of the mesh */
  meanHeight: number;
  /** Maximum deviation from mean */
  maxDeviation: number;
  /** Corner deviations from mean */
  cornerDeviations: BedCorners;
  /** Whether there are critical deviations */
  hasCriticalDeviation: boolean;
}

/**
 * Leveling stage determination result.
 */
export interface LevelingStage {
  /** Whether screw adjustment is needed */
  needsScrewAdjustment: boolean;
  /** Whether screws can fix the problem (within max adjustment) */
  canUseScrews: boolean;
  /** Whether tape compensation is needed */
  needsTape: boolean;
  /** Maximum height difference between corners */
  maxCornerDiff: number;
  /** List of corners with problems */
  problematicCorners: BedCorner[];
}

/**
 * Options for the deviation analyzer.
 */
export interface DeviationAnalyzerOptions {
  /** Number of grid points to average around corners */
  cornerAveragingSize: number;
  /** Threshold for recommending screw adjustment (mm) */
  screwThreshold: number;
  /** Threshold for recommending tape compensation (mm) */
  tapeThreshold: number;
  /** Threshold for recommending belt sync (mm) */
  beltThreshold: number;
  /** Screw configuration */
  screwConfig: ScrewConfig;
}

/**
 * Default analyzer options.
 */
const DEFAULT_OPTIONS: DeviationAnalyzerOptions = {
  cornerAveragingSize: 1,
  screwThreshold: 0.02,
  tapeThreshold: 0.02,
  beltThreshold: 0.1,
  screwConfig: DEFAULT_SCREW_CONFIG,
};

/**
 * Analyzer for bed mesh deviations and calibration recommendations.
 */
export class DeviationAnalyzer {
  /** Reference to bed model */
  private readonly bed: Bed;

  /** Analyzer options */
  private options: DeviationAnalyzerOptions;

  /** Screw solver for adjustment calculations */
  private readonly screwSolver: ScrewSolver;

  /**
   * Create a new DeviationAnalyzer.
   *
   * @param bed - Bed model with mesh data
   * @param options - Analyzer options
   */
  constructor(bed: Bed, options: Partial<DeviationAnalyzerOptions> = {}) {
    this.bed = bed;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.screwSolver = new ScrewSolver(bed, this.options.screwConfig);
  }

  /**
   * Update analyzer options.
   *
   * @param options - New options (partial)
   */
  setOptions(options: Partial<DeviationAnalyzerOptions>): void {
    this.options = { ...this.options, ...options };
    if (options.screwConfig) {
      this.screwSolver.setConfig(options.screwConfig);
    }
  }

  /**
   * Set corner averaging size.
   *
   * @param size - Number of grid points to average
   */
  setCornerAveragingSize(size: number): void {
    this.options.cornerAveragingSize = Math.max(0, Math.floor(size));
  }

  /**
   * Set screw adjustment threshold.
   *
   * @param threshold - Threshold in mm
   */
  setScrewThreshold(threshold: number): void {
    this.options.screwThreshold = threshold;
  }

  /**
   * Set tape compensation threshold.
   *
   * @param threshold - Threshold in mm
   */
  setTapeThreshold(threshold: number): void {
    this.options.tapeThreshold = threshold;
  }

  /**
   * Get deviation statistics from the mesh.
   *
   * @returns DeviationStats object
   */
  getStats(): DeviationStats {
    const stats = this.bed.getMeshStats();
    const meanHeight = stats.mean;

    // Calculate corner deviations from mean
    const corners = this.bed.getCornerValues(this.options.cornerAveragingSize);
    const cornerDeviations: BedCorners = {
      frontLeft: Math.abs(corners.frontLeft - meanHeight),
      frontRight: Math.abs(corners.frontRight - meanHeight),
      rearLeft: Math.abs(corners.rearLeft - meanHeight),
      rearRight: Math.abs(corners.rearRight - meanHeight),
    };

    const maxDeviation = Math.max(
      cornerDeviations.frontLeft,
      cornerDeviations.frontRight,
      cornerDeviations.rearLeft,
      cornerDeviations.rearRight
    );

    return {
      meanHeight,
      maxDeviation,
      cornerDeviations,
      hasCriticalDeviation: maxDeviation > this.options.screwThreshold,
    };
  }

  /**
   * Analyze and determine the required leveling stages.
   *
   * @returns LevelingStage object
   */
  analyzeLevelingStage(): LevelingStage {
    const stats = this.getStats();
    const corners = this.bed.getCornerValues(this.options.cornerAveragingSize);

    // Find max difference between any corners
    const heights = [corners.frontLeft, corners.frontRight, corners.rearLeft, corners.rearRight];
    const maxCornerDiff = Math.max(...heights) - Math.min(...heights);

    // Identify problematic corners
    const problematicCorners: BedCorner[] = [];
    for (const [corner, deviation] of Object.entries(stats.cornerDeviations)) {
      if (deviation > this.options.tapeThreshold) {
        problematicCorners.push(corner as BedCorner);
      }
    }

    // Determine if screws can fix the problem
    const canUseScrews = maxCornerDiff <= this.options.screwConfig.maxAdjust;

    // Determine required stages
    const needsScrewAdjustment = stats.maxDeviation > this.options.screwThreshold;
    const needsTape = stats.maxDeviation > this.options.tapeThreshold;

    return {
      needsScrewAdjustment,
      canUseScrews,
      needsTape,
      maxCornerDiff,
      problematicCorners,
    };
  }

  /**
   * Perform full analysis and return comprehensive results.
   *
   * @returns AnalysisResult object
   */
  analyze(): AnalysisResult {
    const meshStats = this.bed.getMeshStats();
    const deviationStats = this.getStats();
    const levelingStage = this.analyzeLevelingStage();
    const corners = this.bed.getCornerValues(this.options.cornerAveragingSize);

    // Find the reference corner (lowest)
    let referenceCorner = BedCorner.FRONT_LEFT;
    let lowestValue = corners.frontLeft;

    if (corners.frontRight < lowestValue) {
      referenceCorner = BedCorner.FRONT_RIGHT;
      lowestValue = corners.frontRight;
    }
    if (corners.rearLeft < lowestValue) {
      referenceCorner = BedCorner.REAR_LEFT;
      lowestValue = corners.rearLeft;
    }
    if (corners.rearRight < lowestValue) {
      referenceCorner = BedCorner.REAR_RIGHT;
    }

    // Check if belt sync is needed (significant X-axis tilt)
    // Compare front-left to front-right and rear-left to rear-right
    const frontTilt = Math.abs(corners.frontLeft - corners.frontRight);
    const rearTilt = Math.abs(corners.rearLeft - corners.rearRight);
    const needsBeltSync = frontTilt > this.options.beltThreshold || rearTilt > this.options.beltThreshold;

    return {
      meshRange: meshStats.range,
      maxDeviation: deviationStats.maxDeviation,
      minDeviation: 0, // Min deviation from mean is always 0 at the mean point
      averageDeviation: meshStats.mean,
      standardDeviation: meshStats.standardDeviation,
      cornerDeviations: corners,
      referenceCorner,
      recommendations: {
        needsBeltSync,
        needsScrewAdjust: levelingStage.needsScrewAdjustment,
        needsTapeCompensation: levelingStage.needsTape && !levelingStage.canUseScrews,
      },
    };
  }

  /**
   * Get the ideal (flat) reference plane.
   *
   * @returns 2D array representing the ideal plane at mean height
   */
  getIdealPlane(): number[][] {
    return this.bed.generateIdealPlane();
  }

  /**
   * Estimate bed state after screw adjustments.
   *
   * @returns Simulated mesh after applying screw adjustments
   */
  estimateBedAfterScrewAdjustment(): number[][] {
    const meanHeight = this.bed.getMeanValue();

    // Auto-select reference corner
    this.screwSolver.autoSelectReferenceCorner(this.options.cornerAveragingSize);

    // Calculate adjustments
    const adjustments = this.screwSolver.calculateAdjustmentsToTarget(meanHeight, this.options.cornerAveragingSize);

    // Build adjustment map for simulation
    const cornerAdjustments: Partial<Record<BedCorner, number>> = {};
    for (const adj of adjustments) {
      if (adj.requiresAdjustment) {
        const heightChange = this.screwSolver.heightChangeFromMinutes(adj.minutes, adj.direction);
        cornerAdjustments[adj.corner] = heightChange;
      }
    }

    // Simulate the adjustment
    return this.bed.simulateAdjustment(cornerAdjustments);
  }

  /**
   * Find the optimal calibration strategy.
   *
   * @returns Strategy recommendation object
   */
  findOptimalStrategy(): {
    originalDeviation: number;
    deviationAfterScrews: number;
    needsScrews: boolean;
    needsTape: boolean;
    expectedFinalDeviation: number;
    simulatedBedAfterScrews: number[][];
  } {
    const meshStats = this.bed.getMeshStats();
    const originalDeviation = meshStats.range / 2; // Half of range as "deviation"

    // Simulate screw adjustment
    const bedAfterScrews = this.estimateBedAfterScrewAdjustment();

    // Calculate deviation after screws
    let sum = 0;
    let count = 0;
    for (const row of bedAfterScrews) {
      for (const val of row) {
        sum += val;
        count++;
      }
    }
    const meanAfter = sum / count;

    let maxDeviationAfter = 0;
    for (const row of bedAfterScrews) {
      for (const val of row) {
        maxDeviationAfter = Math.max(maxDeviationAfter, Math.abs(val - meanAfter));
      }
    }

    const needsScrews = originalDeviation > this.options.screwThreshold;
    const needsTape = maxDeviationAfter > this.options.tapeThreshold;

    return {
      originalDeviation,
      deviationAfterScrews: maxDeviationAfter,
      needsScrews,
      needsTape,
      expectedFinalDeviation: needsTape ? this.options.tapeThreshold : maxDeviationAfter,
      simulatedBedAfterScrews: bedAfterScrews,
    };
  }

  /**
   * Get the screw solver instance for direct adjustment calculations.
   *
   * @returns ScrewSolver instance
   */
  getScrewSolver(): ScrewSolver {
    return this.screwSolver;
  }
}
