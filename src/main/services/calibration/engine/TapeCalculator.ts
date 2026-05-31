/**
 * @fileoverview Calculator for tape compensation recommendations.
 * Identifies low spots on the bed that need tape shims and calculates
 * the number of layers needed to compensate for height differences.
 *
 * @module main/services/calibration/engine/TapeCalculator
 */

import type { TapeConfig, TapeRecommendation } from '../../../../shared/types/calibration';
import { BedCorner, DEFAULT_TAPE_CONFIG } from '../../../../shared/types/calibration';
import type { Bed } from './Bed';

/**
 * Detailed tape spot information for mesh-based analysis.
 */
export interface TapeSpot {
  /** X coordinate in mesh grid */
  x: number;
  /** Y coordinate in mesh grid */
  y: number;
  /** Number of tape layers needed */
  layers: number;
  /** Height difference to compensate (mm) */
  heightDiff: number;
  /** Priority (1 = highest) */
  priority: number;
  /** Approximate area size in mm² */
  areaSize: number;
}

/**
 * Calculator for tape compensation on the print bed.
 */
export class TapeCalculator {
  /** Bed model reference */
  private readonly bed: Bed;

  /** Tape configuration */
  private config: TapeConfig;

  /**
   * Create a new TapeCalculator.
   *
   * @param bed - Bed model with mesh data
   * @param config - Tape configuration
   */
  constructor(bed: Bed, config: TapeConfig = DEFAULT_TAPE_CONFIG) {
    this.bed = bed;
    this.config = { ...config };
  }

  /**
   * Update tape configuration.
   *
   * @param config - New configuration (partial)
   */
  setConfig(config: Partial<TapeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Calculate priority based on height difference.
   *
   * @param heightDiff - Height difference in mm
   * @returns Priority level (1 = highest)
   */
  private calculatePriority(heightDiff: number): number {
    if (heightDiff > 0.3) {
      return 1;
    } else if (heightDiff > 0.2) {
      return 2;
    }
    return 3;
  }

  /**
   * Check if a mesh point is at a screw corner position.
   *
   * @param row - Row index
   * @param col - Column index
   * @returns True if position is a screw corner
   */
  private isAtScrewCorner(row: number, col: number): boolean {
    const lastRow = this.bed.config.meshPointsY - 1;
    const lastCol = this.bed.config.meshPointsX - 1;

    // Check all four corners
    return (
      (row === 0 && col === 0) || // Front left
      (row === 0 && col === lastCol) || // Front right
      (row === lastRow && col === 0) || // Rear left
      (row === lastRow && col === lastCol) // Rear right
    );
  }

  /**
   * Calculate approximate area size for a tape spot.
   *
   * @param heightDiff - Height difference at spot
   * @returns Area size in mm²
   */
  private calculateAreaSize(heightDiff: number): number {
    const { x, y } = this.bed.getMmPerPoint();
    const baseArea = x * y;

    // Increase area for larger deviations
    if (heightDiff > 0.3) {
      return baseArea * 1.5;
    }
    return baseArea;
  }

  /**
   * Calculate tape recommendations for bed corners.
   * This is the simple corner-based calculation.
   *
   * @param averagingSize - Size of area to average for corner heights
   * @returns Array of TapeRecommendation for each corner
   */
  calculateLayers(averagingSize = 0): TapeRecommendation[] {
    const corners = this.bed.getCornerValues(averagingSize);
    const heights = [corners.frontLeft, corners.frontRight, corners.rearLeft, corners.rearRight];
    const referenceHeight = Math.min(...heights); // Lowest corner as reference

    const recommendations: TapeRecommendation[] = [];

    for (const [cornerKey, height] of Object.entries(corners)) {
      const deviation = height - referenceHeight;

      if (deviation > this.config.minHeightDiff) {
        const layers = Math.ceil(deviation / this.config.tapeThickness);

        recommendations.push({
          corner: cornerKey as BedCorner,
          layers,
          totalThickness: layers * this.config.tapeThickness,
          deviation,
        });
      }
    }

    return recommendations;
  }

  /**
   * Get total number of tape layers across all corners.
   *
   * @param averagingSize - Size of area to average for corner heights
   * @returns Total number of layers
   */
  getTotalLayers(averagingSize = 0): number {
    const recommendations = this.calculateLayers(averagingSize);
    return recommendations.reduce((sum, r) => sum + r.layers, 0);
  }

  /**
   * Find low spots in a mesh that need tape compensation.
   * This performs mesh-wide analysis, not just corners.
   *
   * @param simulatedMesh - Mesh data (typically after screw adjustments)
   * @returns Array of TapeSpot objects
   */
  findLowSpots(simulatedMesh: number[][]): TapeSpot[] {
    // Calculate mean height
    let sum = 0;
    let count = 0;
    for (const row of simulatedMesh) {
      for (const val of row) {
        sum += val;
        count++;
      }
    }
    const meanHeight = sum / count;

    const spots: TapeSpot[] = [];

    for (let row = 0; row < this.bed.config.meshPointsY; row++) {
      for (let col = 0; col < this.bed.config.meshPointsX; col++) {
        // Skip screw corner positions
        if (this.isAtScrewCorner(row, col)) {
          continue;
        }

        const height = simulatedMesh[row][col];
        const diff = meanHeight - height;

        // If point is lower than mean by more than threshold
        if (diff > this.config.minHeightDiff) {
          const layers = Math.max(1, Math.ceil(diff / this.config.tapeThickness));

          spots.push({
            x: col,
            y: row,
            layers,
            heightDiff: diff,
            priority: this.calculatePriority(diff),
            areaSize: this.calculateAreaSize(diff),
          });
        }
      }
    }

    // Sort by priority (ascending) and height diff (descending)
    return spots.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.heightDiff - a.heightDiff;
    });
  }

  /**
   * Optimize tape layout by merging nearby spots.
   *
   * @param spots - Array of tape spots
   * @returns Optimized array of tape spots
   */
  optimizeTapeLayout(spots: TapeSpot[]): TapeSpot[] {
    const optimized: TapeSpot[] = [];
    const used = new Set<string>();

    for (const spot of spots) {
      const key = `${spot.x},${spot.y}`;
      if (used.has(key)) {
        continue;
      }

      // Find nearby spots
      const nearby = spots.filter(
        (s) => Math.abs(s.x - spot.x) <= 1 && Math.abs(s.y - spot.y) <= 1 && !used.has(`${s.x},${s.y}`)
      );

      if (nearby.length > 0) {
        // Merge nearby spots
        const avgDiff = nearby.reduce((sum, s) => sum + s.heightDiff, 0) / nearby.length;
        const avgLayers = Math.max(1, Math.ceil(avgDiff / this.config.tapeThickness));
        const totalArea = nearby.reduce((sum, s) => sum + s.areaSize, 0);
        const minPriority = Math.min(...nearby.map((s) => s.priority));

        // Find center spot
        const avgX = nearby.reduce((sum, s) => sum + s.x, 0) / nearby.length;
        const avgY = nearby.reduce((sum, s) => sum + s.y, 0) / nearby.length;
        const center = nearby.reduce((best, s) => {
          const bestDist = Math.abs(best.x - avgX) + Math.abs(best.y - avgY);
          const sDist = Math.abs(s.x - avgX) + Math.abs(s.y - avgY);
          return sDist < bestDist ? s : best;
        }, nearby[0]);

        optimized.push({
          x: center.x,
          y: center.y,
          layers: avgLayers,
          heightDiff: avgDiff,
          priority: minPriority,
          areaSize: totalArea,
        });

        // Mark all nearby as used
        for (const s of nearby) {
          used.add(`${s.x},${s.y}`);
        }
      } else {
        optimized.push(spot);
        used.add(key);
      }
    }

    return optimized;
  }

  /**
   * Apply tape spots to a mesh to simulate the result.
   *
   * @param baseMesh - Original mesh data
   * @param spots - Tape spots to apply
   * @returns Simulated mesh after tape application
   */
  applySpots(baseMesh: number[][], spots: TapeSpot[]): number[][] {
    // Deep copy mesh
    const simulated = baseMesh.map((row) => [...row]);

    for (const spot of spots) {
      const heightIncrease = spot.layers * this.config.tapeThickness;

      // Apply to surrounding area
      const rowStart = Math.max(0, spot.y - 1);
      const rowEnd = Math.min(this.bed.config.meshPointsY, spot.y + 2);
      const colStart = Math.max(0, spot.x - 1);
      const colEnd = Math.min(this.bed.config.meshPointsX, spot.x + 2);

      for (let row = rowStart; row < rowEnd; row++) {
        for (let col = colStart; col < colEnd; col++) {
          simulated[row][col] += heightIncrease;
        }
      }
    }

    return simulated;
  }

  /**
   * Estimate improvement after applying tape spots.
   *
   * @param spots - Tape spots to apply
   * @returns Estimated deviation reduction in mm
   */
  estimateImprovement(spots: TapeSpot[]): number {
    if (!this.bed.meshData) {
      return 0;
    }

    const simulatedMesh = this.applySpots(this.bed.meshData, spots);

    // Calculate current deviation
    const currentStats = this.bed.getMeshStats();
    const currentDeviation = currentStats.range / 2;

    // Calculate simulated deviation
    let _sum = 0;
    let _count = 0;
    let min = Infinity;
    let max = -Infinity;

    for (const row of simulatedMesh) {
      for (const val of row) {
        _sum += val;
        _count++;
        min = Math.min(min, val);
        max = Math.max(max, val);
      }
    }

    const simulatedDeviation = (max - min) / 2;

    return currentDeviation - simulatedDeviation;
  }

  /**
   * Generate tape instructions as text.
   *
   * @param spots - Tape spots for instructions
   * @returns Array of instruction strings
   */
  getTapeInstructions(spots: TapeSpot[]): string[] {
    if (spots.length === 0) {
      return ['No tape compensation required'];
    }

    const instructions: string[] = [];
    const totalArea = spots.reduce((sum, s) => sum + s.areaSize, 0);
    const totalLayers = spots.reduce((sum, s) => sum + s.layers, 0);

    instructions.push(
      `Apply tape in ${spots.length} location(s)\n` +
        `Total area: ${totalArea.toFixed(1)}mm²\n` +
        `Total layers: ${totalLayers}`
    );

    for (const spot of spots) {
      // Convert grid coordinates to alphanumeric
      const position = `${spot.y + 1}${String.fromCharCode(65 + spot.x)}`;

      let instruction =
        `Position ${position}:\n` +
        `• Deviation: ${spot.heightDiff.toFixed(3)}mm\n` +
        `• Apply ${spot.layers} layer(s) of tape\n` +
        `• Area: ${spot.areaSize.toFixed(1)}mm²`;

      if (spot.priority === 1) {
        instruction += '\n⚠ High priority';
      }

      instructions.push(instruction);
    }

    return instructions;
  }
}
