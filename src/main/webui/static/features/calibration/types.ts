/**
 * @fileoverview Local calibration type definitions for the WebUI static client.
 *
 * JSON-shaped mirrors of the calibration types in
 * src/shared/types/calibration.ts. The static client compiles with its own
 * tsconfig and cannot import @shared modules, so the REST payload shapes are
 * duplicated here. Enums are represented as string-literal unions because the
 * values arrive as plain JSON strings, and WorkflowData omits the `stages`
 * Map (it does not survive JSON serialization; the client only reads the
 * scalar/array fields).
 */

/** Direction of screw rotation for bed leveling adjustments. */
export type RotationDirection = 'CW' | 'CCW';

/** Corner positions on the print bed. */
export type BedCorner = 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight';

/** Stages in the calibration workflow. */
export type WorkflowStage =
  | 'initial'
  | 'belt_sync'
  | 'screw_adjust'
  | 'tape_compensate'
  | 'thermal_predict'
  | 'complete';

/** Height values at the four corners of the bed. */
export interface BedCorners {
  frontLeft: number;
  frontRight: number;
  rearLeft: number;
  rearRight: number;
}

/** Parsed mesh data from printer configuration. */
export interface MeshData {
  matrix: number[][];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  pointsX: number;
  pointsY: number;
  profileName: string;
}

/** Calculated adjustment for a single bed corner screw. */
export interface ScrewAdjustment {
  corner: BedCorner;
  deviation: number;
  direction: RotationDirection;
  minutes: number;
  degrees: number;
  turns: number;
  formattedAmount: string;
  requiresAdjustment: boolean;
}

/** Tape layer recommendation for a single corner. */
export interface TapeRecommendation {
  corner: BedCorner;
  layers: number;
  totalThickness: number;
  deviation: number;
}

/** Results from analyzing mesh deviations. */
export interface AnalysisResult {
  meshRange: number;
  maxDeviation: number;
  minDeviation: number;
  averageDeviation: number;
  standardDeviation: number;
  cornerDeviations: BedCorners;
  referenceCorner: BedCorner;
  recommendations: {
    needsBeltSync: boolean;
    needsScrewAdjust: boolean;
    needsTapeCompensation: boolean;
  };
}

/**
 * Workflow computation data as it arrives over REST (the desktop type's
 * `stages` Map is dropped by JSON serialization and never read here).
 */
export interface WorkflowData {
  currentStage: WorkflowStage;
  startTime: number;
  completedStages: WorkflowStage[];
  screwAdjustments?: ScrewAdjustment[];
  tapeRecommendations?: TapeRecommendation[];
  initialRange: number;
  finalRange: number;
  improvementPercent: number;
}

/** Result of evaluating a single input shaper type. */
export interface ShaperResult {
  type: string;
  frequency: number;
  vibrationReduction: number;
  smoothingTime: number;
  maxAcceleration: number;
  score: number;
}

/** Input shaper calibration results for a single axis. */
export interface AxisCalibration {
  axis: 'x' | 'y';
  frequencyBins: number[];
  powerSpectralDensity: number[];
  peakFrequencies: number[];
  recommendedShaper: ShaperResult;
  allShaperResults: ShaperResult[];
}

/** Calibration history entry. */
export interface CalibrationHistoryEntry {
  timestamp: number;
  type: 'bed_level' | 'input_shaper';
  summary: string;
  data: unknown;
}

/** Active calibration workspace for a printer context (REST shape). */
export interface CalibrationWorkspace {
  contextId: string;
  meshData: MeshData | null;
  analysis: AnalysisResult | null;
  workflow: WorkflowData | null;
}
