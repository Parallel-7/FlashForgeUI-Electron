/**
 * @fileoverview Shared type definitions for the Calibration Assistant module.
 * These types are used across main process, renderer, and WebUI for bed leveling,
 * input shaper analysis, and calibration workflow operations.
 *
 * @module shared/types/calibration
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Direction of screw rotation for bed leveling adjustments.
 */
export enum RotationDirection {
  CLOCKWISE = 'CW',
  COUNTERCLOCKWISE = 'CCW',
}

/**
 * Corner positions on the print bed.
 */
export enum BedCorner {
  FRONT_LEFT = 'frontLeft',
  FRONT_RIGHT = 'frontRight',
  REAR_LEFT = 'rearLeft',
  REAR_RIGHT = 'rearRight',
}

/**
 * Stages in the calibration workflow.
 */
export enum WorkflowStage {
  INITIAL = 'initial',
  BELT_SYNC = 'belt_sync',
  SCREW_ADJUST = 'screw_adjust',
  TAPE_COMPENSATE = 'tape_compensate',
  THERMAL_PREDICT = 'thermal_predict',
  COMPLETE = 'complete',
}

/**
 * Input shaper types supported by Klipper.
 */
export enum ShaperType {
  ZV = 'zv',
  MZV = 'mzv',
  EI = 'ei',
  TWO_HUMP_EI = '2hump_ei',
  THREE_HUMP_EI = '3hump_ei',
}

/**
 * SSH connection status states.
 */
export enum SSHConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

// ============================================================================
// Bed & Mesh Types
// ============================================================================

/**
 * Configuration for the print bed hardware.
 */
export interface BedConfig {
  /** Bed width in mm */
  sizeX: number;
  /** Bed depth in mm */
  sizeY: number;
  /** Number of mesh probe points along X axis */
  meshPointsX: number;
  /** Number of mesh probe points along Y axis */
  meshPointsY: number;
}

/**
 * Height values at the four corners of the bed.
 */
export interface BedCorners {
  frontLeft: number;
  frontRight: number;
  rearLeft: number;
  rearRight: number;
}

/**
 * Parsed mesh data from printer configuration.
 */
export interface MeshData {
  /** 2D array of Z-height values [row][col] */
  matrix: number[][];
  /** Minimum X coordinate of mesh */
  minX: number;
  /** Maximum X coordinate of mesh */
  maxX: number;
  /** Minimum Y coordinate of mesh */
  minY: number;
  /** Maximum Y coordinate of mesh */
  maxY: number;
  /** Number of points along X axis */
  pointsX: number;
  /** Number of points along Y axis */
  pointsY: number;
  /** Name of the mesh profile */
  profileName: string;
}

// ============================================================================
// Screw Adjustment Types
// ============================================================================

/**
 * Configuration for screw adjustment calculations.
 */
export interface ScrewConfig {
  /** Thread pitch in mm per full rotation (default: 0.5) */
  pitch: number;
  /** Minimum deviation threshold for adjustment (default: 0.01) */
  minAdjust: number;
  /** Maximum allowed adjustment in mm (default: 2.0) */
  maxAdjust: number;
}

/**
 * Calculated adjustment for a single bed corner screw.
 */
export interface ScrewAdjustment {
  /** Which corner this adjustment is for */
  corner: BedCorner;
  /** Height deviation from reference in mm */
  deviation: number;
  /** Direction to turn the screw */
  direction: RotationDirection;
  /** Rotation amount in minutes (1/60 degree) */
  minutes: number;
  /** Rotation amount in degrees */
  degrees: number;
  /** Number of full rotations */
  turns: number;
  /** Human-readable adjustment string (e.g., "15 minutes CW") */
  formattedAmount: string;
  /** Whether this corner needs adjustment */
  requiresAdjustment: boolean;
}

// ============================================================================
// Tape Compensation Types
// ============================================================================

/**
 * Configuration for tape compensation calculations.
 */
export interface TapeConfig {
  /** Thickness of a single tape layer in mm (default: 0.05 for Kapton) */
  tapeThickness: number;
  /** Minimum height difference to recommend tape */
  minHeightDiff: number;
}

/**
 * Tape layer recommendation for a single corner.
 */
export interface TapeRecommendation {
  /** Which corner needs tape */
  corner: BedCorner;
  /** Number of tape layers recommended */
  layers: number;
  /** Total thickness of tape in mm */
  totalThickness: number;
  /** Original deviation that this compensates */
  deviation: number;
}

// ============================================================================
// Analysis Types
// ============================================================================

/**
 * Results from analyzing mesh deviations.
 */
export interface AnalysisResult {
  /** Range between highest and lowest points */
  meshRange: number;
  /** Maximum deviation from mean */
  maxDeviation: number;
  /** Minimum deviation from mean */
  minDeviation: number;
  /** Average deviation across mesh */
  averageDeviation: number;
  /** Standard deviation of mesh values */
  standardDeviation: number;
  /** Corner height values */
  cornerDeviations: BedCorners;
  /** Which corner is used as reference (lowest) */
  referenceCorner: BedCorner;
  /** Recommended actions based on analysis */
  recommendations: {
    needsBeltSync: boolean;
    needsScrewAdjust: boolean;
    needsTapeCompensation: boolean;
  };
}

// ============================================================================
// Workflow Types
// ============================================================================

/**
 * Result from processing a single workflow stage.
 */
export interface StageResult {
  /** Which stage this result is for */
  stage: WorkflowStage;
  /** Whether the stage completed successfully */
  success: boolean;
  /** Stage-specific result data */
  data: unknown;
  /** Metrics computed during this stage */
  metrics: Record<string, number>;
  /** Next stage to process, or null if complete */
  nextStage: WorkflowStage | null;
}

/**
 * Belt synchronization analysis result.
 */
export interface BeltSyncResult {
  /** X-axis tilt in mm */
  xAxisTilt: number;
  /** Y-axis tilt in mm */
  yAxisTilt: number;
  /** Whether belt sync is needed */
  needsSync: boolean;
  /** Recommended adjustment */
  recommendation: string;
}

/**
 * Thermal expansion prediction result.
 */
export interface ThermalPrediction {
  /** Predicted mesh at target temperature */
  predictedMesh: number[][];
  /** Expected change in mesh range */
  rangeChange: number;
  /** Temperature delta used */
  tempDelta: number;
  /** Expansion coefficient applied */
  expansionCoeff: number;
}

/**
 * Complete workflow computation data.
 */
export interface WorkflowData {
  /** Current stage being processed */
  currentStage: WorkflowStage;
  /** Results for each completed stage */
  stages: Map<WorkflowStage, StageResult>;
  /** Timestamp when workflow started */
  startTime: number;
  /** List of completed stages */
  completedStages: WorkflowStage[];

  /** Belt sync stage result */
  beltSyncResult?: BeltSyncResult;
  /** Screw adjustment recommendations */
  screwAdjustments?: ScrewAdjustment[];
  /** Tape compensation recommendations */
  tapeRecommendations?: TapeRecommendation[];
  /** Thermal prediction result */
  thermalPrediction?: ThermalPrediction;

  /** Mesh range before calibration */
  initialRange: number;
  /** Predicted mesh range after calibration */
  finalRange: number;
  /** Improvement percentage */
  improvementPercent: number;
}

// ============================================================================
// Input Shaper Types
// ============================================================================

/**
 * Definition of an input shaper algorithm.
 */
export interface ShaperDefinition {
  /** Shaper type identifier */
  type: ShaperType;
  /** Human-readable name */
  name: string;
  /** Minimum supported frequency */
  minFreq: number;
  /** Initial/default frequency */
  initFreq: number;
  /** Maximum supported frequency */
  maxFreq: number;
}

/**
 * Result of evaluating a single shaper type.
 */
export interface ShaperResult {
  /** Shaper type evaluated */
  type: ShaperType;
  /** Optimal frequency in Hz */
  frequency: number;
  /** Vibration reduction factor (0-1) */
  vibrationReduction: number;
  /** Smoothing time in ms */
  smoothingTime: number;
  /** Maximum recommended acceleration in mm/s² */
  maxAcceleration: number;
  /** Overall quality score */
  score: number;
}

/**
 * Calibration results for a single axis.
 */
export interface AxisCalibration {
  /** Which axis was calibrated */
  axis: 'x' | 'y';
  /** Frequency bins from FFT */
  frequencyBins: number[];
  /** Power spectral density values */
  powerSpectralDensity: number[];
  /** Detected resonance frequencies */
  peakFrequencies: number[];
  /** Best shaper recommendation */
  recommendedShaper: ShaperResult;
  /** Results for all evaluated shapers */
  allShaperResults: ShaperResult[];
}

/**
 * Accelerometer data parsed from CSV.
 */
export interface AccelerometerData {
  /** Time values in seconds */
  time: number[];
  /** X-axis acceleration values */
  accelX: number[];
  /** Y-axis acceleration values */
  accelY: number[];
  /** Z-axis acceleration values */
  accelZ: number[];
  /** Sample rate in Hz */
  sampleRate: number;
}

/**
 * Power spectrum from FFT analysis.
 */
export interface PowerSpectrum {
  /** Frequency bins in Hz */
  frequencies: number[];
  /** Power values at each frequency */
  power: number[];
  /** Peak frequency detected */
  peakFrequency: number;
  /** Peak power value */
  peakPower: number;
}

// ============================================================================
// SSH Types
// ============================================================================

/**
 * SSH connection configuration.
 */
export interface SSHConnectionConfig {
  /** Hostname or IP address */
  host: string;
  /** SSH port (default: 22) */
  port: number;
  /** Username for authentication */
  username: string;
  /** Password for authentication (optional if using key) */
  password?: string;
  /** Path to private key file (optional) */
  privateKey?: string;
  /** Connection timeout in ms */
  timeout: number;
  /** Keepalive interval in ms */
  keepaliveInterval: number;
}

/**
 * Result of a file transfer operation.
 */
export interface TransferResult {
  /** Whether transfer succeeded */
  success: boolean;
  /** Local file path */
  localPath: string;
  /** Remote file path */
  remotePath: string;
  /** Number of bytes transferred */
  bytesTransferred: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Progress update during file transfer.
 */
export interface TransferProgress {
  /** Name of file being transferred */
  filename: string;
  /** Bytes transferred so far */
  bytesTransferred: number;
  /** Total file size in bytes */
  totalBytes: number;
  /** Percentage complete (0-100) */
  percentage: number;
}

// ============================================================================
// Settings Types
// ============================================================================

/**
 * Hardware-specific calibration settings.
 */
export interface CalibrationHardwareSettings {
  /** Tape thickness in mm (default: 0.05) */
  tapeThickness: number;
  /** Belt tooth spacing in mm (default: 2.0) */
  beltToothMm: number;
  /** Screw thread pitch in mm (default: 0.5) */
  screwPitch: number;
  /** Minimum adjustment threshold in mm (default: 0.01) */
  minAdjustment: number;
  /** Maximum adjustment limit in mm (default: 2.0) */
  maxAdjustment: number;
  /** Number of grid points to average for corners (default: 2) */
  cornerAveraging: number;
}

/**
 * Threshold settings for calibration decisions.
 */
export interface CalibrationThresholds {
  /** Belt sync threshold in mm (default: 0.1) */
  beltThreshold: number;
  /** Screw adjustment threshold in mm (default: 0.02) */
  screwThreshold: number;
  /** Tape compensation threshold in mm (default: 0.02) */
  tapeThreshold: number;
}

/**
 * Visualization preferences.
 */
export interface CalibrationVisualization {
  /** Mesh interpolation factor (default: 3) */
  interpolationFactor: number;
  /** Color scheme for heatmaps (default: 'viridis') */
  colorScheme: 'viridis' | 'plasma' | 'inferno' | 'coolwarm';
  /** Whether to show 3D surface (default: false, deferred) */
  show3D: boolean;
}

/**
 * Workflow stage enable/disable settings.
 */
export interface CalibrationWorkflowSettings {
  /** Enable belt sync stage (default: true) */
  enableBelt: boolean;
  /** Enable screw adjustment stage (default: true) */
  enableScrews: boolean;
  /** Enable tape compensation stage (default: true) */
  enableTape: boolean;
}

/**
 * Thermal expansion preset for a bed type.
 */
export interface ThermalPreset {
  /** Preset name (e.g., "PEI Spring Steel") */
  name: string;
  /** Temperature at which mesh was measured */
  measurementTemp: number;
  /** Target operating temperature */
  targetTemp: number;
  /** Chamber heating factor (0-1) */
  chamberFactor: number;
  /** PEI layer thickness in mm */
  peiThickness: number;
  /** Steel sheet thickness in mm */
  steelThickness: number;
  /** PEI thermal expansion coefficient */
  alphaPei: number;
  /** Steel thermal expansion coefficient */
  alphaSteel: number;
  /** Uniform expansion factor */
  betaUniform: number;
}

/**
 * Complete calibration settings object.
 */
export interface CalibrationSettings {
  /** Hardware configuration */
  hardware: CalibrationHardwareSettings;
  /** Decision thresholds */
  thresholds: CalibrationThresholds;
  /** Visualization preferences */
  visualization: CalibrationVisualization;
  /** Workflow stage settings */
  workflow: CalibrationWorkflowSettings;
  /** Available thermal presets */
  thermalPresets: ThermalPreset[];
  /** Currently active thermal preset name */
  activeThermalPreset: string | null;
  /** Environment/temperature settings */
  environment: {
    measurementTemp: number;
    targetTemp: number;
    thermalExpansionCoeff: number;
  };
  /** History retention settings */
  history: {
    /** Maximum entries to retain (default: 5) */
    maxEntries: number;
  };
}

// ============================================================================
// Per-Printer Calibration Data
// ============================================================================

/**
 * Calibration history entry.
 */
export interface CalibrationHistoryEntry {
  /** Timestamp of calibration */
  timestamp: number;
  /** Type of calibration performed */
  type: 'bed_level' | 'input_shaper';
  /** Brief summary of results */
  summary: string;
  /** Full calibration data */
  data: WorkflowData | AxisCalibration;
}

/**
 * Per-printer calibration data stored with printer context.
 */
export interface PrinterCalibrationData {
  /** SSH host for this printer */
  sshHost?: string;
  /** SSH port (default: 22) */
  sshPort?: number;
  /** SSH username */
  sshUsername?: string;
  /** SSH password (encrypted) */
  sshPassword?: string;
  /** Path to SSH private key */
  sshKeyPath?: string;
  /** Remote printer.cfg path override */
  sshConfigPath?: string;
  /** Whether credentials should be persisted */
  sshSaveCredentials?: boolean;

  /** Last bed mesh calibration */
  lastBedMesh?: {
    timestamp: number;
    matrix: number[][];
    analysis: AnalysisResult;
  };

  /** X-axis input shaper configuration */
  inputShaperX?: ShaperResult;
  /** Y-axis input shaper configuration */
  inputShaperY?: ShaperResult;

  /** Calibration history */
  calibrationHistory?: CalibrationHistoryEntry[];
}

// ============================================================================
// Workspace Types
// ============================================================================

/**
 * Active calibration workspace for a printer context.
 */
export interface BedWorkspace {
  /** Printer context ID */
  contextId: string;
  /** Current mesh data */
  meshData: MeshData | null;
  /** Bed configuration */
  bedConfig: BedConfig;
  /** Latest analysis result */
  analysis: AnalysisResult | null;
  /** Current workflow data */
  workflow: WorkflowData | null;
  /** Whether workspace has unsaved changes */
  isDirty: boolean;
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default calibration settings.
 */
export const DEFAULT_CALIBRATION_SETTINGS: CalibrationSettings = {
  hardware: {
    tapeThickness: 0.05,
    beltToothMm: 2.0,
    screwPitch: 0.5,
    minAdjustment: 0.01,
    maxAdjustment: 2.0,
    cornerAveraging: 2,
  },
  thresholds: {
    beltThreshold: 0.1,
    screwThreshold: 0.02,
    tapeThreshold: 0.02,
  },
  visualization: {
    interpolationFactor: 3,
    colorScheme: 'viridis',
    show3D: false,
  },
  workflow: {
    enableBelt: true,
    enableScrews: true,
    enableTape: true,
  },
  thermalPresets: [
    {
      name: 'PEI Spring Steel',
      measurementTemp: 25,
      targetTemp: 60,
      chamberFactor: 0.8,
      peiThickness: 0.3,
      steelThickness: 0.5,
      alphaPei: 50e-6,
      alphaSteel: 12e-6,
      betaUniform: 0.7,
    },
    {
      name: 'Glass Bed',
      measurementTemp: 25,
      targetTemp: 60,
      chamberFactor: 0.6,
      peiThickness: 0,
      steelThickness: 0,
      alphaPei: 0,
      alphaSteel: 9e-6,
      betaUniform: 0.5,
    },
    {
      name: 'Aluminum Bed',
      measurementTemp: 25,
      targetTemp: 60,
      chamberFactor: 0.9,
      peiThickness: 0,
      steelThickness: 0,
      alphaPei: 0,
      alphaSteel: 23e-6,
      betaUniform: 0.85,
    },
  ],
  activeThermalPreset: null,
  environment: {
    measurementTemp: 25,
    targetTemp: 60,
    thermalExpansionCoeff: 12e-6,
  },
  history: {
    maxEntries: 5,
  },
};

/**
 * Default screw configuration.
 */
export const DEFAULT_SCREW_CONFIG: ScrewConfig = {
  pitch: 0.5,
  minAdjust: 0.01,
  maxAdjust: 2.0,
};

/**
 * Default tape configuration.
 */
export const DEFAULT_TAPE_CONFIG: TapeConfig = {
  tapeThickness: 0.05,
  minHeightDiff: 0.02,
};

/**
 * Default bed configuration for FlashForge AD5M.
 */
export const DEFAULT_BED_CONFIG: BedConfig = {
  sizeX: 220,
  sizeY: 220,
  meshPointsX: 7,
  meshPointsY: 7,
};
