/**
 * @fileoverview Parser for Klipper printer.cfg files to extract bed mesh data.
 * Handles the #*# format used by Klipper to store bed mesh calibration data.
 *
 * The bed mesh section in printer.cfg looks like:
 * ```
 * #*# [bed_mesh default]
 * #*# version = 1
 * #*# points =
 * #*#   0.025, 0.012, -0.003, ...
 * #*#   0.018, 0.005, -0.010, ...
 * #*# x_count = 7
 * #*# y_count = 7
 * #*# min_x = 15.0
 * #*# max_x = 205.0
 * #*# min_y = 15.0
 * #*# max_y = 205.0
 * ```
 *
 * @module main/services/calibration/parsers/KlipperConfigParser
 */

import type { BedConfig, MeshData } from '../../../../shared/types/calibration';

/**
 * Result of a parse operation.
 */
export interface ParseResult {
  success: boolean;
  data?: MeshData;
  error?: string;
}

/**
 * Parser for Klipper printer configuration files.
 * Extracts bed mesh data from the #*# formatted sections.
 */
export class KlipperConfigParser {
  /**
   * Regex pattern to match mesh point lines.
   * Matches lines like: #*#   0.025, 0.012, -0.003
   * Also supports scientific notation: #*#   1e-2, 0.0, -1e-2
   */
  private readonly pointPattern = /^#\*#\s+(-?\d+\.?\d*(?:[eE][+-]?\d+)?,\s*)*-?\d+\.?\d*(?:[eE][+-]?\d+)?\s*$/;

  /**
   * Regex pattern to match parameter lines.
   * Matches lines like: #*# x_count = 7 or #*# points =
   */
  private readonly paramPattern = /^#\*#\s+(\w+)\s*=\s*(.*)$/;

  /**
   * Regex pattern to match bed mesh section header.
   * Matches lines like: #*# [bed_mesh default]
   */
  private readonly sectionPattern = /^#\*#\s+\[bed_mesh\s+(\w+)\]$/;

  /**
   * Required parameters for a valid mesh.
   */
  private readonly requiredParams = ['x_count', 'y_count', 'min_x', 'max_x', 'min_y', 'max_y'];

  /**
   * Parse a Klipper config file to extract bed mesh data.
   *
   * @param content - The full content of the printer.cfg file
   * @param profileName - Optional specific profile name to extract (default: 'default')
   * @returns ParseResult with mesh data or error
   */
  parseConfigFile(content: string, profileName = 'default'): ParseResult {
    try {
      const lines = content.split('\n');
      const pointsData: number[][] = [];
      const params: Record<string, string> = {};
      let foundProfile = '';
      let inMeshSection = false;
      let inPointsSection = false;

      for (const line of lines) {
        // Check for mesh section header
        const sectionMatch = this.sectionPattern.exec(line);
        if (sectionMatch) {
          foundProfile = sectionMatch[1];
          inMeshSection = foundProfile === profileName;
          inPointsSection = false;
          continue;
        }

        // Skip if not in the target mesh section
        if (!inMeshSection) {
          continue;
        }

        // Check for parameter lines
        const paramMatch = this.paramPattern.exec(line);
        if (paramMatch) {
          const [, key, value] = paramMatch;
          if (key === 'points') {
            inPointsSection = true;
          } else {
            params[key] = value.trim();
            inPointsSection = false;
          }
          continue;
        }

        // Check for point data lines (only when in points section)
        if (inPointsSection && this.pointPattern.test(line)) {
          const cleanLine = line.replace(/^#\*#\s*/, '').trim();
          if (cleanLine) {
            const points = cleanLine.split(',').map((p) => {
              const parsed = parseFloat(p.trim());
              if (isNaN(parsed)) {
                throw new Error(`Invalid point value: ${p}`);
              }
              return parsed;
            });
            pointsData.push(points);
          }
          continue;
        }

        // If we hit a non-mesh line while in mesh section, we're done
        if (line.startsWith('#*#')) {
          // Still in #*# block, could be another section
          if (line.match(/^#\*#\s+\[/)) {
            inMeshSection = false;
            inPointsSection = false;
          }
        }
      }

      // Validate we found data
      if (pointsData.length === 0) {
        return {
          success: false,
          error: `No mesh data found for profile '${profileName}'`,
        };
      }

      // Validate required parameters
      for (const param of this.requiredParams) {
        if (!(param in params)) {
          return {
            success: false,
            error: `Missing required parameter: ${param}`,
          };
        }
      }

      // Parse parameters
      const xCount = parseInt(params['x_count'], 10);
      const yCount = parseInt(params['y_count'], 10);
      const minX = parseFloat(params['min_x']);
      const maxX = parseFloat(params['max_x']);
      const minY = parseFloat(params['min_y']);
      const maxY = parseFloat(params['max_y']);

      // Validate matrix dimensions
      if (pointsData.length !== yCount) {
        return {
          success: false,
          error: `Row count mismatch: expected ${yCount}, got ${pointsData.length}`,
        };
      }

      for (let i = 0; i < pointsData.length; i++) {
        if (pointsData[i].length !== xCount) {
          return {
            success: false,
            error: `Column count mismatch in row ${i}: expected ${xCount}, got ${pointsData[i].length}`,
          };
        }
      }

      const meshData: MeshData = {
        matrix: pointsData,
        minX,
        maxX,
        minY,
        maxY,
        pointsX: xCount,
        pointsY: yCount,
        profileName: foundProfile || profileName,
      };

      return {
        success: true,
        data: meshData,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
    }
  }

  /**
   * Extract all available mesh profile names from a config file.
   *
   * @param content - The full content of the printer.cfg file
   * @returns Array of profile names found
   */
  getAvailableProfiles(content: string): string[] {
    const profiles: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = this.sectionPattern.exec(line);
      if (match) {
        profiles.push(match[1]);
      }
    }

    return profiles;
  }

  /**
   * Validate mesh data for reasonable values.
   *
   * @param meshData - The mesh data to validate
   * @returns Object with isValid flag and optional error message
   */
  validateMeshData(meshData: MeshData): { isValid: boolean; error?: string } {
    // Check matrix dimensions match declared size
    if (meshData.matrix.length !== meshData.pointsY) {
      return {
        isValid: false,
        error: `Matrix row count (${meshData.matrix.length}) doesn't match pointsY (${meshData.pointsY})`,
      };
    }

    for (let i = 0; i < meshData.matrix.length; i++) {
      if (meshData.matrix[i].length !== meshData.pointsX) {
        return {
          isValid: false,
          error: `Row ${i} column count (${meshData.matrix[i].length}) doesn't match pointsX (${meshData.pointsX})`,
        };
      }
    }

    // Check for reasonable Z values (typical bed deviation range)
    const maxReasonableDeviation = 10; // mm
    for (let y = 0; y < meshData.matrix.length; y++) {
      for (let x = 0; x < meshData.matrix[y].length; x++) {
        const value = meshData.matrix[y][x];

        if (isNaN(value) || !isFinite(value)) {
          return {
            isValid: false,
            error: `Invalid value at position [${y}][${x}]: ${value}`,
          };
        }

        if (Math.abs(value) > maxReasonableDeviation) {
          return {
            isValid: false,
            error: `Unreasonable deviation at [${y}][${x}]: ${value}mm (max: ±${maxReasonableDeviation}mm)`,
          };
        }
      }
    }

    // Check coordinate bounds make sense
    if (meshData.minX >= meshData.maxX) {
      return {
        isValid: false,
        error: `Invalid X bounds: minX (${meshData.minX}) >= maxX (${meshData.maxX})`,
      };
    }

    if (meshData.minY >= meshData.maxY) {
      return {
        isValid: false,
        error: `Invalid Y bounds: minY (${meshData.minY}) >= maxY (${meshData.maxY})`,
      };
    }

    return { isValid: true };
  }

  /**
   * Create a BedConfig from parsed mesh data.
   *
   * @param meshData - The parsed mesh data
   * @returns BedConfig derived from mesh dimensions
   */
  createBedConfigFromMesh(meshData: MeshData): BedConfig {
    return {
      sizeX: meshData.maxX - meshData.minX,
      sizeY: meshData.maxY - meshData.minY,
      meshPointsX: meshData.pointsX,
      meshPointsY: meshData.pointsY,
    };
  }
}

/**
 * Singleton instance for convenience.
 */
export const klipperConfigParser = new KlipperConfigParser();
