/**
 * @fileoverview Unit tests for the KlipperConfigParser class.
 * Tests parsing of Klipper printer.cfg files with bed mesh data.
 *
 * @module main/services/calibration/__tests__/KlipperConfigParser.test
 */

import { KlipperConfigParser, klipperConfigParser } from '../parsers/KlipperConfigParser';

describe('KlipperConfigParser', () => {
  // Sample valid printer.cfg content (using spaces after #*#)
  const validConfig = `# Klipper config file
[printer]
kinematics: cartesian

#*# <---------------------- SAVE_CONFIG ---------------------->
#*# DO NOT EDIT THIS BLOCK OR BELOW. The contents are auto-generated.
#*#
#*# [bed_mesh default]
#*# version = 1
#*# points =
#*#  0.025000, 0.012500, -0.003125, 0.009375, 0.015625, 0.018750, 0.031250
#*#  0.018750, 0.005625, -0.010000, 0.000000, 0.009375, 0.012500, 0.025000
#*#  0.012500, -0.001250, -0.016875, -0.006250, 0.003125, 0.006250, 0.018750
#*#  0.006250, -0.007500, -0.023750, -0.012500, -0.003125, 0.000000, 0.012500
#*#  0.000000, -0.013750, -0.030625, -0.018750, -0.009375, -0.006250, 0.006250
#*#  -0.006250, -0.020000, -0.037500, -0.025000, -0.015625, -0.012500, 0.000000
#*#  -0.012500, -0.026250, -0.044375, -0.031250, -0.021875, -0.018750, -0.006250
#*# x_count = 7
#*# y_count = 7
#*# mesh_x_pps = 2
#*# mesh_y_pps = 2
#*# algo = bicubic
#*# tension = 0.2
#*# min_x = 15.0
#*# max_x = 205.0
#*# min_y = 15.0
#*# max_y = 205.0`;

  // Config with multiple profiles
  const multiProfileConfig = `#*# [bed_mesh default]
#*# version = 1
#*# points =
#*#  0.1, 0.0, -0.1
#*#  0.05, 0.0, -0.05
#*#  0.0, -0.05, -0.1
#*# x_count = 3
#*# y_count = 3
#*# min_x = 15.0
#*# max_x = 205.0
#*# min_y = 15.0
#*# max_y = 205.0
#*#
#*# [bed_mesh petg]
#*# version = 1
#*# points =
#*#  0.15, 0.05, -0.05
#*#  0.1, 0.0, -0.1
#*#  0.05, -0.05, -0.15
#*# x_count = 3
#*# y_count = 3
#*# min_x = 15.0
#*# max_x = 205.0
#*# min_y = 15.0
#*# max_y = 205.0`;

  let parser: KlipperConfigParser;

  beforeEach(() => {
    parser = new KlipperConfigParser();
  });

  describe('parseConfigFile', () => {
    it('should parse valid config with default profile', () => {
      const result = parser.parseConfigFile(validConfig);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.profileName).toBe('default');
      expect(result.data!.pointsX).toBe(7);
      expect(result.data!.pointsY).toBe(7);
      expect(result.data!.minX).toBe(15.0);
      expect(result.data!.maxX).toBe(205.0);
      expect(result.data!.minY).toBe(15.0);
      expect(result.data!.maxY).toBe(205.0);
    });

    it('should parse mesh matrix correctly', () => {
      const result = parser.parseConfigFile(validConfig);

      expect(result.success).toBe(true);
      expect(result.data!.matrix.length).toBe(7); // 7 rows
      expect(result.data!.matrix[0].length).toBe(7); // 7 columns

      // Check first row values
      expect(result.data!.matrix[0][0]).toBeCloseTo(0.025, 5);
      expect(result.data!.matrix[0][1]).toBeCloseTo(0.0125, 5);
      expect(result.data!.matrix[0][2]).toBeCloseTo(-0.003125, 5);
    });

    it('should parse specific profile from multi-profile config', () => {
      const result = parser.parseConfigFile(multiProfileConfig, 'petg');

      expect(result.success).toBe(true);
      expect(result.data!.profileName).toBe('petg');
      expect(result.data!.matrix[0][0]).toBeCloseTo(0.15, 5);
    });

    it('should fail for non-existent profile', () => {
      const result = parser.parseConfigFile(multiProfileConfig, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain("No mesh data found for profile 'nonexistent'");
    });

    it('should fail for config without mesh data', () => {
      const noMeshConfig = `
[printer]
kinematics: cartesian
`;
      const result = parser.parseConfigFile(noMeshConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No mesh data found');
    });

    it('should fail for missing required parameters', () => {
      const incompleteConfig = `#*# [bed_mesh default]
#*# version = 1
#*# points =
#*#  0.1, 0.0, -0.1
#*# x_count = 3
#*# y_count = 1
#*# min_x = 15.0
#*# max_x = 205.0`;
      const result = parser.parseConfigFile(incompleteConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });

    it('should fail for dimension mismatch', () => {
      const mismatchConfig = `#*# [bed_mesh default]
#*# points =
#*#  0.1, 0.0, -0.1
#*#  0.05, 0.0, -0.05
#*# x_count = 3
#*# y_count = 3
#*# min_x = 15.0
#*# max_x = 205.0
#*# min_y = 15.0
#*# max_y = 205.0`;
      const result = parser.parseConfigFile(mismatchConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Row count mismatch');
    });
  });

  describe('getAvailableProfiles', () => {
    it('should list all available profiles', () => {
      const profiles = parser.getAvailableProfiles(multiProfileConfig);

      expect(profiles).toContain('default');
      expect(profiles).toContain('petg');
      expect(profiles.length).toBe(2);
    });

    it('should return empty array for no profiles', () => {
      const noProfileConfig = `
[printer]
kinematics: cartesian
`;
      const profiles = parser.getAvailableProfiles(noProfileConfig);

      expect(profiles.length).toBe(0);
    });
  });

  describe('validateMeshData', () => {
    it('should validate correct mesh data', () => {
      const result = parser.parseConfigFile(validConfig);
      expect(result.success).toBe(true);

      const validation = parser.validateMeshData(result.data!);
      expect(validation.isValid).toBe(true);
    });

    it('should reject mesh with dimension mismatch', () => {
      const validation = parser.validateMeshData({
        matrix: [
          [0.1, 0.0],
          [0.05, 0.0, -0.05],
        ], // Inconsistent columns
        minX: 15,
        maxX: 205,
        minY: 15,
        maxY: 205,
        pointsX: 3,
        pointsY: 2,
        profileName: 'test',
      });

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain("doesn't match pointsX");
    });

    it('should reject mesh with unreasonable values', () => {
      const validation = parser.validateMeshData({
        matrix: [[15.0, 0.0, -0.1]], // 15mm is way too high
        minX: 15,
        maxX: 205,
        minY: 15,
        maxY: 205,
        pointsX: 3,
        pointsY: 1,
        profileName: 'test',
      });

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Unreasonable deviation');
    });

    it('should reject mesh with invalid coordinate bounds', () => {
      const validation = parser.validateMeshData({
        matrix: [[0.1, 0.0, -0.1]],
        minX: 205, // minX > maxX
        maxX: 15,
        minY: 15,
        maxY: 205,
        pointsX: 3,
        pointsY: 1,
        profileName: 'test',
      });

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Invalid X bounds');
    });

    it('should reject mesh with NaN values', () => {
      const validation = parser.validateMeshData({
        matrix: [[0.1, NaN, -0.1]],
        minX: 15,
        maxX: 205,
        minY: 15,
        maxY: 205,
        pointsX: 3,
        pointsY: 1,
        profileName: 'test',
      });

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Invalid value');
    });
  });

  describe('createBedConfigFromMesh', () => {
    it('should create bed config from mesh data', () => {
      const result = parser.parseConfigFile(validConfig);
      expect(result.success).toBe(true);

      const bedConfig = parser.createBedConfigFromMesh(result.data!);

      expect(bedConfig.sizeX).toBe(190); // 205 - 15
      expect(bedConfig.sizeY).toBe(190); // 205 - 15
      expect(bedConfig.meshPointsX).toBe(7);
      expect(bedConfig.meshPointsY).toBe(7);
    });
  });

  describe('singleton instance', () => {
    it('should provide a singleton parser instance', () => {
      expect(klipperConfigParser).toBeInstanceOf(KlipperConfigParser);

      const result = klipperConfigParser.parseConfigFile(validConfig);
      expect(result.success).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty lines in config', () => {
      const configWithEmptyLines = `
#*# [bed_mesh default]

#*# points =
#*#  0.1, 0.0, -0.1

#*# x_count = 3
#*# y_count = 1
#*# min_x = 15.0
#*# max_x = 205.0
#*# min_y = 15.0
#*# max_y = 205.0`;
      const result = parser.parseConfigFile(configWithEmptyLines);
      expect(result.success).toBe(true);
    });

    it('should handle tabs vs spaces in point values', () => {
      // Use actual tab characters
      const configWithTabs =
        '#*# [bed_mesh default]\n#*# points =\n#*#\t0.1,\t0.0,\t-0.1\n#*# x_count = 3\n#*# y_count = 1\n#*# min_x = 15.0\n#*# max_x = 205.0\n#*# min_y = 15.0\n#*# max_y = 205.0';
      const result = parser.parseConfigFile(configWithTabs);
      expect(result.success).toBe(true);
      expect(result.data!.matrix[0][0]).toBeCloseTo(0.1, 5);
    });

    it('should handle scientific notation in values', () => {
      const configWithScientific = `#*# [bed_mesh default]
#*# points =
#*#  1e-2, 0.0, -1e-2
#*# x_count = 3
#*# y_count = 1
#*# min_x = 15.0
#*# max_x = 205.0
#*# min_y = 15.0
#*# max_y = 205.0`;
      const result = parser.parseConfigFile(configWithScientific);
      expect(result.success).toBe(true);
      expect(result.data!.matrix[0][0]).toBeCloseTo(0.01, 5);
    });
  });
});
