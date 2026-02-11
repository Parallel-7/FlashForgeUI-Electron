/**
 * @fileoverview Calculator for bed leveling screw adjustments.
 * Converts height deviations to rotation amounts (minutes, degrees, turns)
 * and determines rotation direction for each corner screw.
 *
 * @module main/services/calibration/engine/ScrewSolver
 */

import type { ScrewAdjustment, ScrewConfig } from '../../../../shared/types/calibration';
import { BedCorner, DEFAULT_SCREW_CONFIG, RotationDirection } from '../../../../shared/types/calibration';
import type { Bed } from './Bed';

/**
 * Calculator for screw adjustments based on corner height deviations.
 */
export class ScrewSolver {
  /** Screw configuration */
  private config: ScrewConfig;

  /** Reference to the bed model */
  private readonly bed: Bed;

  /** Which corner is used as reference (typically the lowest) */
  private referenceCorner: BedCorner = BedCorner.FRONT_LEFT;

  /** Calculated mm per minute of rotation */
  private readonly mmPerMinute: number;

  /**
   * Create a new ScrewSolver.
   *
   * @param bed - Bed model with mesh data
   * @param config - Screw configuration, defaults to standard config
   */
  constructor(bed: Bed, config: ScrewConfig = DEFAULT_SCREW_CONFIG) {
    this.bed = bed;
    this.config = { ...config };

    // Pre-calculate conversion factors
    // Full rotation (360 degrees) = pitch mm of height change
    // 1 minute = 1/60 of a degree
    this.mmPerMinute = this.config.pitch / (360 * 60); // mm per arc minute
  }

  /**
   * Update the screw configuration.
   *
   * @param config - New screw configuration
   */
  setConfig(config: Partial<ScrewConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set which corner to use as the reference point.
   * The reference corner won't need adjustment.
   *
   * @param corner - Corner to use as reference
   */
  setReferenceCorner(corner: BedCorner): void {
    this.referenceCorner = corner;
  }

  /**
   * Automatically select the lowest corner as reference.
   *
   * @param averagingSize - Size of area to average for corner height
   * @returns The selected reference corner
   */
  autoSelectReferenceCorner(averagingSize = 0): BedCorner {
    const corners = this.bed.getCornerValues(averagingSize);

    let lowestCorner = BedCorner.FRONT_LEFT;
    let lowestValue = corners.frontLeft;

    if (corners.frontRight < lowestValue) {
      lowestCorner = BedCorner.FRONT_RIGHT;
      lowestValue = corners.frontRight;
    }
    if (corners.rearLeft < lowestValue) {
      lowestCorner = BedCorner.REAR_LEFT;
      lowestValue = corners.rearLeft;
    }
    if (corners.rearRight < lowestValue) {
      lowestCorner = BedCorner.REAR_RIGHT;
    }

    this.referenceCorner = lowestCorner;
    return lowestCorner;
  }

  /**
   * Convert height deviation to rotation minutes.
   *
   * @param deviation - Height deviation in mm
   * @returns Rotation in minutes (absolute value)
   */
  deviationToMinutes(deviation: number): number {
    // minutes = deviation / (pitch / (360 * 60))
    // Simplified: minutes = deviation * 360 * 60 / pitch
    return (Math.abs(deviation) * 360 * 60) / this.config.pitch;
  }

  /**
   * Convert height deviation to rotation degrees.
   *
   * @param deviation - Height deviation in mm
   * @returns Rotation in degrees (absolute value)
   */
  deviationToDegrees(deviation: number): number {
    return (Math.abs(deviation) * 360) / this.config.pitch;
  }

  /**
   * Convert height deviation to full turns.
   *
   * @param deviation - Height deviation in mm
   * @returns Number of full rotations (absolute value)
   */
  deviationToTurns(deviation: number): number {
    return Math.abs(deviation) / this.config.pitch;
  }

  /**
   * Determine rotation direction based on deviation.
   *
   * @param deviation - Height deviation in mm (positive = too high, negative = too low)
   * @returns Rotation direction
   */
  getDirection(deviation: number): RotationDirection {
    // Positive deviation = bed too low at this corner = turn CCW to raise it
    // Negative deviation = bed too high at this corner = turn CW to lower it
    return deviation > 0 ? RotationDirection.COUNTERCLOCKWISE : RotationDirection.CLOCKWISE;
  }

  /**
   * Calculate height change from rotation in minutes.
   *
   * @param minutes - Rotation amount in minutes
   * @param direction - Rotation direction
   * @returns Height change in mm
   */
  heightChangeFromMinutes(minutes: number, direction: RotationDirection): number {
    const heightChange = minutes * this.mmPerMinute;
    // CW lowers the bed (negative change), CCW raises it (positive change)
    return direction === RotationDirection.CLOCKWISE ? -heightChange : heightChange;
  }

  /**
   * Calculate adjustment for a single corner.
   *
   * @param corner - Which corner to calculate
   * @param targetHeight - Target height to adjust to
   * @param averagingSize - Size of area to average for corner height
   * @returns ScrewAdjustment object
   */
  calculateCornerAdjustment(corner: BedCorner, targetHeight: number, averagingSize = 0): ScrewAdjustment {
    const currentHeight = this.bed.getCornerHeight(corner, averagingSize);
    const deviation = targetHeight - currentHeight;

    // Check if adjustment is needed
    const requiresAdjustment = Math.abs(deviation) >= this.config.minAdjust;

    // Clamp deviation to max adjustment
    const clampedDeviation = Math.sign(deviation) * Math.min(Math.abs(deviation), this.config.maxAdjust);

    const direction = this.getDirection(clampedDeviation);
    const minutes = this.deviationToMinutes(clampedDeviation);
    const degrees = this.deviationToDegrees(clampedDeviation);
    const turns = this.deviationToTurns(clampedDeviation);

    // Format the adjustment string
    let formattedAmount: string;
    if (!requiresAdjustment) {
      formattedAmount = 'No adjustment needed';
    } else if (turns >= 1) {
      formattedAmount = `${turns.toFixed(1)} turns ${direction}`;
    } else if (degrees >= 30) {
      formattedAmount = `${Math.round(degrees)}° ${direction}`;
    } else {
      formattedAmount = `${Math.round(minutes)} minutes ${direction}`;
    }

    return {
      corner,
      deviation,
      direction,
      minutes,
      degrees,
      turns,
      formattedAmount,
      requiresAdjustment,
    };
  }

  /**
   * Calculate adjustments for all corners relative to reference.
   *
   * @param averagingSize - Size of area to average for corner heights
   * @returns Array of ScrewAdjustment objects for all corners
   */
  calculateAdjustments(averagingSize = 0): ScrewAdjustment[] {
    const corners = this.bed.getCornerValues(averagingSize);

    // Get reference height (the target all other corners should match)
    const referenceHeight = corners[this.referenceCorner];

    const adjustments: ScrewAdjustment[] = [];

    // Calculate adjustment for each corner
    for (const corner of Object.values(BedCorner)) {
      const adjustment = this.calculateCornerAdjustment(corner, referenceHeight, averagingSize);
      adjustments.push(adjustment);
    }

    return adjustments;
  }

  /**
   * Calculate adjustments to reach a target plane (e.g., mean height).
   *
   * @param targetHeight - Target height for all corners
   * @param averagingSize - Size of area to average for corner heights
   * @returns Array of ScrewAdjustment objects
   */
  calculateAdjustmentsToTarget(targetHeight: number, averagingSize = 0): ScrewAdjustment[] {
    const adjustments: ScrewAdjustment[] = [];

    for (const corner of Object.values(BedCorner)) {
      const adjustment = this.calculateCornerAdjustment(corner, targetHeight, averagingSize);
      adjustments.push(adjustment);
    }

    return adjustments;
  }

  /**
   * Get summary of required adjustments.
   *
   * @param adjustments - Array of calculated adjustments
   * @returns Summary object
   */
  getAdjustmentSummary(adjustments: ScrewAdjustment[]): {
    totalAdjustmentsNeeded: number;
    maxMinutes: number;
    corners: { name: string; amount: string }[];
  } {
    const needing = adjustments.filter((a) => a.requiresAdjustment);

    return {
      totalAdjustmentsNeeded: needing.length,
      maxMinutes: Math.max(...adjustments.map((a) => a.minutes), 0),
      corners: adjustments.map((a) => ({
        name: a.corner,
        amount: a.formattedAmount,
      })),
    };
  }
}
