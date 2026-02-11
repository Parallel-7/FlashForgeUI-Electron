/**
 * @fileoverview Model representing the 3D printer bed with mesh data management.
 * Provides methods for analyzing bed mesh, calculating corner heights, and
 * simulating adjustments.
 *
 * @module main/services/calibration/engine/Bed
 */

import type { BedConfig, BedCorners, MeshData } from '../../../../shared/types/calibration';
import { BedCorner, DEFAULT_BED_CONFIG } from '../../../../shared/types/calibration';

/**
 * Corner index mapping for mesh data access.
 * Maps corner names to [row, col] indices in the mesh matrix.
 */
interface CornerIndices {
  frontLeft: [number, number];
  frontRight: [number, number];
  rearLeft: [number, number];
  rearRight: [number, number];
}

/**
 * Mesh statistics.
 */
export interface MeshStats {
  mean: number;
  min: number;
  max: number;
  range: number;
  standardDeviation: number;
}

/**
 * Model of the printer bed with mesh data management.
 */
export class Bed {
  /** Bed configuration (dimensions, mesh points) */
  public readonly config: BedConfig;

  /** Current mesh data (2D array of Z heights) */
  private _meshData: number[][] | null = null;

  /** Corner indices for mesh access */
  private readonly cornerIndices: CornerIndices;

  /**
   * Create a new Bed instance.
   *
   * @param config - Bed configuration, defaults to AD5M config
   */
  constructor(config: BedConfig = DEFAULT_BED_CONFIG) {
    this.config = config;

    // Calculate corner indices based on mesh dimensions
    // Note: mesh is stored as [row][col] where row=Y, col=X
    // Front = row 0, Rear = last row
    // Left = col 0, Right = last col
    this.cornerIndices = {
      frontLeft: [0, 0],
      frontRight: [0, config.meshPointsX - 1],
      rearLeft: [config.meshPointsY - 1, 0],
      rearRight: [config.meshPointsY - 1, config.meshPointsX - 1],
    };
  }

  /**
   * Get the current mesh data.
   */
  get meshData(): number[][] | null {
    return this._meshData;
  }

  /**
   * Check if mesh data is loaded.
   */
  get hasMeshData(): boolean {
    return this._meshData !== null;
  }

  /**
   * Set mesh data with dimension validation.
   *
   * @param data - 2D array of Z-height values
   * @throws Error if dimensions don't match config
   */
  setMeshData(data: number[][]): void {
    // Validate row count (Y dimension)
    if (data.length !== this.config.meshPointsY) {
      throw new Error(`Invalid mesh row count: ${data.length}, expected: ${this.config.meshPointsY}`);
    }

    // Validate column count for each row (X dimension)
    for (let row = 0; row < data.length; row++) {
      if (data[row].length !== this.config.meshPointsX) {
        throw new Error(
          `Invalid mesh column count in row ${row}: ${data[row].length}, expected: ${this.config.meshPointsX}`
        );
      }
    }

    // Deep copy to prevent external modification
    this._meshData = data.map((row) => [...row]);
  }

  /**
   * Load mesh data from a parsed MeshData object.
   *
   * @param meshData - Parsed mesh data from config file
   */
  loadFromMeshData(meshData: MeshData): void {
    // Update config from mesh data dimensions
    (this.config as BedConfig).meshPointsX = meshData.pointsX;
    (this.config as BedConfig).meshPointsY = meshData.pointsY;
    (this.config as BedConfig).sizeX = meshData.maxX - meshData.minX;
    (this.config as BedConfig).sizeY = meshData.maxY - meshData.minY;

    // Update corner indices
    this.cornerIndices.frontRight = [0, meshData.pointsX - 1];
    this.cornerIndices.rearLeft = [meshData.pointsY - 1, 0];
    this.cornerIndices.rearRight = [meshData.pointsY - 1, meshData.pointsX - 1];

    this._meshData = meshData.matrix.map((row) => [...row]);
  }

  /**
   * Clear mesh data.
   */
  clearMeshData(): void {
    this._meshData = null;
  }

  /**
   * Get the height value at a specific corner.
   *
   * @param corner - Which corner to get
   * @param averagingSize - Number of points to average around corner (0 = just corner point)
   * @returns Height value at corner
   * @throws Error if no mesh data loaded
   */
  getCornerHeight(corner: BedCorner, averagingSize = 0): number {
    if (!this._meshData) {
      throw new Error('No mesh data loaded');
    }

    const indices = this.cornerIndices[corner];
    const [row, col] = indices;

    if (averagingSize <= 0) {
      return this._meshData[row][col];
    }

    // Calculate averaging bounds
    const rowStart = Math.max(0, row - averagingSize);
    const rowEnd = Math.min(this.config.meshPointsY, row + averagingSize + 1);
    const colStart = Math.max(0, col - averagingSize);
    const colEnd = Math.min(this.config.meshPointsX, col + averagingSize + 1);

    // Calculate average
    let sum = 0;
    let count = 0;

    for (let r = rowStart; r < rowEnd; r++) {
      for (let c = colStart; c < colEnd; c++) {
        sum += this._meshData[r][c];
        count++;
      }
    }

    return sum / count;
  }

  /**
   * Get all corner heights.
   *
   * @param averagingSize - Number of points to average around each corner
   * @returns Object with height values for all corners
   */
  getCornerValues(averagingSize = 0): BedCorners {
    return {
      frontLeft: this.getCornerHeight(BedCorner.FRONT_LEFT, averagingSize),
      frontRight: this.getCornerHeight(BedCorner.FRONT_RIGHT, averagingSize),
      rearLeft: this.getCornerHeight(BedCorner.REAR_LEFT, averagingSize),
      rearRight: this.getCornerHeight(BedCorner.REAR_RIGHT, averagingSize),
    };
  }

  /**
   * Get height at a specific mesh point.
   *
   * @param row - Row index (Y)
   * @param col - Column index (X)
   * @returns Height value at point
   * @throws Error if coordinates out of range or no mesh data
   */
  getPointHeight(row: number, col: number): number {
    if (!this._meshData) {
      throw new Error('No mesh data loaded');
    }

    if (row < 0 || row >= this.config.meshPointsY || col < 0 || col >= this.config.meshPointsX) {
      throw new Error(
        `Coordinates (${row}, ${col}) out of range. Mesh size: ${this.config.meshPointsY}x${this.config.meshPointsX}`
      );
    }

    return this._meshData[row][col];
  }

  /**
   * Get mesh statistics.
   *
   * @returns Statistics about the mesh (mean, min, max, range, std dev)
   * @throws Error if no mesh data loaded
   */
  getMeshStats(): MeshStats {
    if (!this._meshData) {
      throw new Error('No mesh data loaded');
    }

    // Flatten mesh to single array for calculations
    const values: number[] = [];
    for (const row of this._meshData) {
      values.push(...row);
    }

    const n = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    // Calculate standard deviation
    const squaredDiffs = values.map((v) => (v - mean) ** 2);
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
    const standardDeviation = Math.sqrt(variance);

    return { mean, min, max, range, standardDeviation };
  }

  /**
   * Get minimum height value in mesh.
   */
  getMinValue(): number {
    return this.getMeshStats().min;
  }

  /**
   * Get maximum height value in mesh.
   */
  getMaxValue(): number {
    return this.getMeshStats().max;
  }

  /**
   * Get height range (max - min) in mesh.
   */
  getRange(): number {
    return this.getMeshStats().range;
  }

  /**
   * Get mean height value in mesh.
   */
  getMeanValue(): number {
    return this.getMeshStats().mean;
  }

  /**
   * Get physical distance between mesh points.
   *
   * @returns Object with mm per point in X and Y directions
   */
  getMmPerPoint(): { x: number; y: number } {
    return {
      x: this.config.sizeX / (this.config.meshPointsX - 1),
      y: this.config.sizeY / (this.config.meshPointsY - 1),
    };
  }

  /**
   * Generate an ideal (flat) reference plane at mean height.
   *
   * @returns 2D array filled with mean height value
   * @throws Error if no mesh data loaded
   */
  generateIdealPlane(): number[][] {
    if (!this._meshData) {
      throw new Error('No mesh data loaded');
    }

    const meanHeight = this.getMeanValue();
    const plane: number[][] = [];

    for (let row = 0; row < this.config.meshPointsY; row++) {
      plane.push(new Array(this.config.meshPointsX).fill(meanHeight));
    }

    return plane;
  }

  /**
   * Calculate deviation map from ideal (flat) plane.
   *
   * @returns 2D array of deviations (positive = above ideal, negative = below)
   * @throws Error if no mesh data loaded
   */
  calculateDeviationMap(): number[][] {
    if (!this._meshData) {
      throw new Error('No mesh data loaded');
    }

    const idealPlane = this.generateIdealPlane();
    const deviationMap: number[][] = [];

    for (let row = 0; row < this.config.meshPointsY; row++) {
      const deviationRow: number[] = [];
      for (let col = 0; col < this.config.meshPointsX; col++) {
        deviationRow.push(this._meshData[row][col] - idealPlane[row][col]);
      }
      deviationMap.push(deviationRow);
    }

    return deviationMap;
  }

  /**
   * Simulate the result of corner adjustments on the mesh.
   * Adjustments at corners influence nearby points with decreasing effect.
   *
   * @param cornerAdjustments - Partial object with corner adjustments in mm
   * @returns Simulated mesh after adjustments
   * @throws Error if no mesh data loaded
   */
  simulateAdjustment(cornerAdjustments: Partial<Record<BedCorner, number>>): number[][] {
    if (!this._meshData) {
      throw new Error('No mesh data loaded');
    }

    // Deep copy current mesh
    const adjustedMesh = this._meshData.map((row) => [...row]);

    // Maximum diagonal distance for influence calculation
    const maxDistance = Math.sqrt((this.config.meshPointsY - 1) ** 2 + (this.config.meshPointsX - 1) ** 2);

    // Apply each corner adjustment
    for (const [corner, adjustment] of Object.entries(cornerAdjustments)) {
      if (adjustment === undefined || adjustment === 0) {
        continue;
      }

      const indices = this.cornerIndices[corner as BedCorner];
      if (!indices) {
        continue;
      }

      const [cornerRow, cornerCol] = indices;

      // Apply adjustment with distance-based influence
      for (let row = 0; row < this.config.meshPointsY; row++) {
        for (let col = 0; col < this.config.meshPointsX; col++) {
          const distance = Math.sqrt((row - cornerRow) ** 2 + (col - cornerCol) ** 2);
          const influence = Math.max(0, 1 - distance / maxDistance);
          adjustedMesh[row][col] += adjustment * influence;
        }
      }
    }

    return adjustedMesh;
  }

  /**
   * Create a deep copy of this Bed instance.
   *
   * @returns New Bed instance with copied data
   */
  clone(): Bed {
    const cloned = new Bed({ ...this.config });
    if (this._meshData) {
      cloned.setMeshData(this._meshData.map((row) => [...row]));
    }
    return cloned;
  }
}
