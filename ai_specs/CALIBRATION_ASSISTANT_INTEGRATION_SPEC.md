# Calibration Assistant Integration Specification

**Version:** 1.1.0
**Status:** APPROVED - Ready for Implementation
**Target:** FlashForgeUI-Electron
**Source:** [Flashforge-Calibration-Assistant-v2](https://github.com/lDOCI/Flashforge-Calibration-Assistant-v2)

---

## Approved Decisions Summary

| Decision | Choice |
|----------|--------|
| SSH Library | `ssh2` (native bindings) |
| Visualization | Custom Canvas API |
| 3D Surface | Deferred for later |
| FFT Implementation | TypeScript + Web Worker (WASM ideal for future) |
| Dialog Architecture | Single multi-tab dialog |
| Access Method | Tools menu → "Calibration Assistant" |
| SSH Credentials Storage | Encrypted storage with SSH key option |
| Thermal Features | Full 1:1 port with presets |
| Calibration History | 5 entries default, configurable higher |
| G-Code Export | Export new cfg OR send via SSH if connected |
| WebUI | Same logic, main process does heavy lifting |
| Localization | Skip for now |
| Calibration System | Standalone (not integrated with printer backends) |
| SSH Defaults | Manual entry required |
| File Paths | Trust Python source as authoritative |
| Data Storage | Separate `userData/calibration/` folder with printer subfolders |
| Export Formats | All (PNG, PDF, JSON, CSV) |

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Feature Parity Matrix](#feature-parity-matrix)
3. [Architecture Overview](#architecture-overview)
4. [Module Specifications](#module-specifications)
   - [SSH Connectivity Module](#ssh-connectivity-module)
   - [Calibration Engine](#calibration-engine)
   - [Input Shaper Analysis](#input-shaper-analysis)
   - [Visualization System](#visualization-system)
   - [UI Components](#ui-components)
5. [Data Models](#data-models)
6. [State Management](#state-management)
7. [File Structure](#file-structure)
8. [IPC Handlers](#ipc-handlers)
9. [Implementation Phases](#implementation-phases)
10. [Migration & Compatibility](#migration--compatibility)
11. [Testing Strategy](#testing-strategy)
12. [Risk Assessment](#risk-assessment)

---

## Executive Summary

This specification outlines the integration of the Flashforge Calibration Assistant v2 functionality into FlashForgeUI-Electron. The goal is to provide **1:1 feature parity** while leveraging the existing FlashForgeUI architecture, ensuring no breaking changes or regressions.

### Key Integration Points

| Original (Python/PySide6) | Target (Electron/TypeScript) |
|---------------------------|------------------------------|
| Paramiko SSH | `ssh2` (native bindings) |
| Matplotlib visualizations | Custom Canvas API |
| PySide6 Qt Widgets | Existing FlashForgeUI components |
| NumPy/SciPy calculations | TypeScript + Web Worker |
| JSON settings persistence | Existing SettingsManager pattern |

### Stock Firmware Compatibility

The calibration system works with **stock FlashForge firmware**. Users have two methods to obtain printer data:

1. **Local File Method (No SSH Required)**
   - Access service menu: Hold "Machine Info" for ~10 seconds
   - Navigate to Test tab → Select [get] under "Change printer.base.cfg"
   - Transfer file from USB to computer
   - Load into calibration tool

2. **SSH Method (Stock Firmware + SSH Enabled)**
   - SSH can be enabled on stock firmware via [Stone-Time method](https://github.com/Stone-Time/Flashforge-Adventure-5M-Pro-Klipper-SSH)
   - Uses printer's built-in USB update mechanism - does NOT replace firmware
   - After enablement: Port 22, Username `root`, Password `123456`
   - Allows direct file fetch from printer

**Important**: SSH access does NOT require custom firmware like ZMOD or Forge-X. The printer remains on stock FlashForge firmware with SSH enabled via the USB update mechanism.

### Benefits to FlashForgeUI Users

- **Unified Experience**: Calibration tools integrated directly into the printer management interface
- **Per-Printer Calibration**: Leverage existing multi-context architecture for printer-specific calibration data
- **Persistent History**: Store calibration results alongside other printer data
- **WebUI Access**: Calibration available in headless/WebUI mode

---

## Feature Parity Matrix

### Core Features

| Feature | Python Source | Status | Priority |
|---------|---------------|--------|----------|
| SSH Connection Management | `connectivity/ssh/connection_manager.py` | To Implement | P0 |
| SCP File Transfer | `connectivity/scp/file_transfer.py` | To Implement | P0 |
| Klipper Config Parsing | `data_processing/measurement_parser.py` | To Implement | P0 |
| Bed Mesh Analysis | `calibration/hardware/bed.py` | To Implement | P0 |
| Screw Adjustment Solver | `calibration/algorithms/screw_solver.py` | To Implement | P0 |
| Tape Calculator | `calibration/algorithms/tape_calculator.py` | To Implement | P1 |
| Deviation Analyzer | `calibration/algorithms/deviation_analyzer.py` | To Implement | P0 |
| Multi-Stage Workflow | `calibration/workflow/` | To Implement | P0 |
| Input Shaper Analysis | `input_shaper/analysis/` | To Implement | P1 |
| 2D Heatmap Visualization | `visualization/bed_mesh/heatmap_2d.py` | To Implement | P0 |
| 3D Surface Visualization | `visualization/bed_mesh/surface_3d.py` | To Implement | P1 |
| Animated Screw Recommendations | `visualization/bed_mesh/animated_recommendations.py` | To Implement | P1 |
| Shaper Frequency Plots | `visualization/input_shaper/shaper_plots.py` | To Implement | P1 |
| Thermal Expansion Prediction | Workflow thermal stage | To Implement | P2 |
| Localization (en/ru) | `languages/*.json` | To Implement | P2 |

### UI Views

| View | Python Source | Target Location |
|------|---------------|-----------------|
| Bed Leveling Tab | `flashforge_app/ui/views/leveling.py` | New Calibration Dialog |
| Input Shaper Tab | `flashforge_app/ui/views/input_shaper.py` | New Calibration Dialog |
| SSH Settings Tab | `flashforge_app/ui/views/ssh_tab.py` | Per-Printer Settings |
| Visual Recommendations | `flashforge_app/ui/dialogs/visual_recommendations.py` | New Dialog Window |
| Settings Panel | `flashforge_app/ui/views/settings.py` | Existing Settings Dialog |

---

## Architecture Overview

### High-Level Integration Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FlashForgeUI-Electron                           │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐ │
│  │   Main Process      │  │   Renderer Process  │  │   WebUI Server  │ │
│  ├─────────────────────┤  ├─────────────────────┤  ├─────────────────┤ │
│  │ CalibrationManager  │  │ CalibrationDialog   │  │ /calibration/*  │ │
│  │ SSHConnectionPool   │  │ BedMeshVisualizer   │  │ WebSocket sync  │ │
│  │ ShaperAnalyzer      │  │ ShaperPlotCanvas    │  │                 │ │
│  │ WorkflowEngine      │  │ RecommendationView  │  │                 │ │
│  └──────────┬──────────┘  └──────────┬──────────┘  └────────┬────────┘ │
│             │                        │                       │          │
│             └────────────────────────┼───────────────────────┘          │
│                                      │                                  │
│                        ┌─────────────▼─────────────┐                    │
│                        │     IPC Handlers          │                    │
│                        │  calibration-handlers.ts  │                    │
│                        └───────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
            ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
            │ SSH/SCP Layer │ │ Local Files   │ │ Printer API   │
            │ (paramiko eq) │ │ (printer.cfg) │ │ (existing)    │
            └───────────────┘ └───────────────┘ └───────────────┘
```

### Integration with Existing Architecture

The calibration system will integrate with the existing FlashForgeUI architecture:

1. **PrinterContextManager**: Calibration data stored per-printer context
2. **SettingsManager**: Calibration settings merged into existing settings system
3. **WindowManager**: Calibration dialog as a new dialog type
4. **IPC Layer**: New handler domain `calibration-handlers.ts`
5. **WebUI**: New routes under `/api/calibration/*`

---

## Module Specifications

### SSH Connectivity Module

**Location:** `src/main/services/calibration/ssh/`

#### SSHConnectionManager

```typescript
/**
 * @fileoverview SSH connection management for remote printer access.
 * Provides connection pooling, automatic reconnection, and timeout handling.
 */

interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  timeout: number;
  keepaliveInterval: number;
}

interface SSHConnection {
  id: string;
  config: SSHConnectionConfig;
  client: Client; // from ssh2
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastActivity: number;
}

class SSHConnectionManager {
  // Connection pool keyed by printer context ID
  private connections: Map<string, SSHConnection>;

  // Core methods (matching Python ConnectionManager)
  connect(contextId: string, config: SSHConnectionConfig): Promise<void>;
  disconnect(contextId: string): Promise<void>;
  isConnected(contextId: string): boolean;
  executeCommand(contextId: string, command: string): Promise<CommandResult>;

  // Connection pool management
  getConnection(contextId: string): SSHConnection | undefined;
  refreshConnection(contextId: string): Promise<void>;
  cleanupStaleConnections(): void;
}
```

#### SCPFileTransfer

```typescript
/**
 * @fileoverview SCP file transfer for printer configuration and calibration files.
 */

interface TransferProgress {
  filename: string;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

interface TransferResult {
  success: boolean;
  localPath: string;
  remotePath: string;
  bytesTransferred: number;
  error?: string;
}

class SCPFileTransfer {
  constructor(connectionManager: SSHConnectionManager);

  // File operations (matching Python FileTransfer)
  downloadFile(
    contextId: string,
    remotePath: string,
    localPath: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<TransferResult>;

  uploadFile(
    contextId: string,
    localPath: string,
    remotePath: string,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<TransferResult>;

  // Convenience methods
  fetchPrinterConfig(contextId: string): Promise<string>;
  fetchShaperCSV(contextId: string, axis: 'x' | 'y'): Promise<string>;
}
```

**Default Remote Paths:**
- Printer config: `/home/klipper/printer_data/config/printer.cfg`
- Shaper X CSV: `/tmp/calibration_data_x_*.csv`
- Shaper Y CSV: `/tmp/calibration_data_y_*.csv`

### Calibration Engine

**Location:** `src/main/services/calibration/engine/`

#### BedModel

```typescript
/**
 * @fileoverview Bed hardware model with mesh data management.
 */

interface BedConfig {
  sizeX: number;        // mm
  sizeY: number;        // mm
  meshPointsX: number;  // grid columns
  meshPointsY: number;  // grid rows
}

interface BedCorners {
  frontLeft: number;
  frontRight: number;
  rearLeft: number;
  rearRight: number;
}

class Bed {
  config: BedConfig;
  meshData: number[][] | null;

  constructor(config: BedConfig);

  setMeshData(matrix: number[][]): void;
  getMeshData(): number[][] | null;
  getCornerValues(averagingSize?: number): BedCorners;
  getMeshPoint(x: number, y: number): number;
  getMinValue(): number;
  getMaxValue(): number;
  getRange(): number;
  getMeanValue(): number;
}
```

#### ScrewSolver

```typescript
/**
 * @fileoverview Calculates screw adjustments for bed leveling.
 * Converts height deviations to rotation amounts (minutes/degrees/turns).
 */

interface ScrewConfig {
  pitch: number;      // mm per full rotation (default: 0.5)
  minAdjust: number;  // minimum adjustment threshold (default: 0.01)
  maxAdjust: number;  // maximum adjustment (default: 2.0)
}

enum RotationDirection {
  CLOCKWISE = 'CW',
  COUNTERCLOCKWISE = 'CCW'
}

interface ScrewAdjustment {
  corner: 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight';
  deviation: number;           // mm from reference
  direction: RotationDirection;
  minutes: number;             // rotation in minutes
  degrees: number;             // rotation in degrees
  turns: number;               // full rotations
  formattedAmount: string;     // "15 minutes CW"
  requiresAdjustment: boolean;
}

class ScrewSolver {
  constructor(bed: Bed, config: ScrewConfig);

  setReferenceCorner(corner: string): void;
  calculateAdjustments(): ScrewAdjustment[];

  // Conversion utilities
  deviationToMinutes(deviation: number): number;
  deviationToDegrees(deviation: number): number;
  deviationToTurns(deviation: number): number;
}
```

**Algorithm (from Python source):**
```
minutes = (deviation / pitch) * 360 / 6  // 6 degrees per minute
direction = deviation > 0 ? CCW : CW     // Raise = CCW, Lower = CW
```

#### TapeCalculator

```typescript
/**
 * @fileoverview Calculates tape compensation layers for fine bed adjustment.
 */

interface TapeConfig {
  tapeThickness: number;  // mm (default: 0.05 for Kapton tape)
  minHeightDiff: number;  // threshold for tape recommendation
}

interface TapeRecommendation {
  corner: 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight';
  layers: number;
  totalThickness: number;
  deviation: number;
}

class TapeCalculator {
  constructor(bed: Bed, config: TapeConfig);

  calculateLayers(): TapeRecommendation[];
  getTotalLayers(): number;
}
```

#### DeviationAnalyzer

```typescript
/**
 * @fileoverview Analyzes mesh deviations and determines correction strategy.
 */

interface AnalysisResult {
  meshRange: number;
  maxDeviation: number;
  minDeviation: number;
  averageDeviation: number;
  standardDeviation: number;
  cornerDeviations: BedCorners;
  referenceCorner: string;
  recommendations: {
    needsBeltSync: boolean;
    needsScrewAdjust: boolean;
    needsTapeCompensation: boolean;
  };
}

class DeviationAnalyzer {
  constructor(
    bed: Bed,
    options: {
      cornerAveragingSize: number;  // Grid points to average for corners
      screwThreshold: number;       // mm threshold for screw adjustment
      tapeThreshold: number;        // mm threshold for tape compensation
      screwConfig: ScrewConfig;
    }
  );

  analyze(): AnalysisResult;
  setCornerAveragingSize(size: number): void;
  setScrewThreshold(threshold: number): void;
  setTapeThreshold(threshold: number): void;
}
```

#### WorkflowEngine

```typescript
/**
 * @fileoverview Multi-stage calibration workflow orchestration.
 * Processes calibration in sequential stages with stage-specific logic.
 */

enum WorkflowStage {
  INITIAL = 'initial',
  BELT_SYNC = 'belt_sync',
  SCREW_ADJUST = 'screw_adjust',
  TAPE_COMPENSATE = 'tape_compensate',
  THERMAL_PREDICT = 'thermal_predict',
  COMPLETE = 'complete'
}

interface StageResult {
  stage: WorkflowStage;
  success: boolean;
  data: any;
  metrics: Record<string, number>;
  nextStage: WorkflowStage | null;
}

interface WorkflowData {
  currentStage: WorkflowStage;
  stages: Map<WorkflowStage, StageResult>;
  startTime: number;
  completedStages: WorkflowStage[];

  // Computed results
  beltSyncResult?: BeltSyncResult;
  screwAdjustments?: ScrewAdjustment[];
  tapeRecommendations?: TapeRecommendation[];
  thermalPrediction?: ThermalPrediction;

  // Overall metrics
  initialRange: number;
  finalRange: number;
  improvementPercent: number;
}

class WorkflowEngine {
  constructor(
    bed: Bed,
    analyzer: DeviationAnalyzer,
    screwSolver: ScrewSolver,
    tapeCalculator: TapeCalculator,
    settings: CalibrationSettings
  );

  computeWorkflow(): WorkflowData;
  getStageResult(stage: WorkflowStage): StageResult | undefined;
  canSkipStage(stage: WorkflowStage): boolean;

  // Stage processors
  private processBeltSync(): StageResult;
  private processScrewAdjust(): StageResult;
  private processTapeCompensate(): StageResult;
  private processThermalPredict(): StageResult;
}
```

**Workflow Stage Logic (from Python source):**

1. **Initial Stage**: Load mesh, analyze deviations, determine required stages
2. **Belt Sync Stage**: Check Z-axis lead screw synchronization (X-axis tilt)
3. **Screw Adjust Stage**: Calculate corner screw adjustments
4. **Tape Compensate Stage**: Calculate tape layers for fine adjustment
5. **Thermal Predict Stage**: Apply thermal expansion model for temperature compensation

### Input Shaper Analysis

**Location:** `src/main/services/calibration/shaper/`

#### ShaperAnalyzer

```typescript
/**
 * @fileoverview Input shaper calibration from accelerometer data.
 * Analyzes vibration resonances and recommends optimal shaper configuration.
 */

enum ShaperType {
  ZV = 'zv',
  MZV = 'mzv',
  EI = 'ei',
  TWO_HUMP_EI = '2hump_ei',
  THREE_HUMP_EI = '3hump_ei'
}

interface ShaperDefinition {
  type: ShaperType;
  name: string;
  minFreq: number;
  initFreq: number;
  maxFreq: number;
  aCoeffs: (zeta: number) => number[];
  tCoeffs: (zeta: number) => number[];
}

interface ShaperResult {
  type: ShaperType;
  frequency: number;        // Hz
  vibrationReduction: number;
  smoothingTime: number;    // ms
  maxAcceleration: number;  // mm/s²
  score: number;            // Overall quality score
}

interface AxisCalibration {
  axis: 'x' | 'y';
  frequencyBins: number[];
  powerSpectralDensity: number[];
  peakFrequencies: number[];
  recommendedShaper: ShaperResult;
  allShaperResults: ShaperResult[];
}

class ShaperAnalyzer {
  constructor();

  // Main analysis entry point
  analyzeAxis(csvData: string, axis: 'x' | 'y'): Promise<AxisCalibration>;

  // CSV parsing
  parseAccelerometerCSV(csvData: string): AccelerometerData;

  // FFT analysis
  computePowerSpectralDensity(samples: number[]): PowerSpectrum;
  findResonanceFrequencies(spectrum: PowerSpectrum): number[];

  // Shaper optimization
  evaluateShapers(spectrum: PowerSpectrum): ShaperResult[];
  findOptimalShaper(results: ShaperResult[]): ShaperResult;

  // Shaper math (from shaper_defs.py)
  getShaper(type: ShaperType): ShaperDefinition;
  computeShaperResponse(shaper: ShaperDefinition, freqs: number[]): number[];
}
```

**Shaper Coefficients (from Python shaper_defs.py):**

| Shaper | A Coefficients | T Coefficients |
|--------|----------------|----------------|
| ZV | [1, 1] | [0, 0.5/f] |
| MZV | [1, 2, 1] (normalized) | [0, 0.375/f, 0.75/f] |
| EI | [1, 2, 1] (normalized) | [0, 0.5/f, 1/f] |
| 2HUMP_EI | [1, 4, 6, 4, 1] (norm) | [0, 0.25/f, 0.5/f, 0.75/f, 1/f] |
| 3HUMP_EI | [1, 6, 15, 20, 15, 6, 1] | [0, 1/6f, 2/6f, 3/6f, 4/6f, 5/6f, 1/f] |

### Visualization System

**Location:** `src/renderer/src/ui/calibration/visualization/`

#### BedMeshVisualizer

```typescript
/**
 * @fileoverview 2D and 3D bed mesh visualization using Canvas/WebGL.
 */

interface HeatmapOptions {
  colorScale: 'viridis' | 'plasma' | 'inferno' | 'coolwarm';
  showGrid: boolean;
  showValues: boolean;
  interpolation: number;  // Interpolation factor
  margin: { top: number; right: number; bottom: number; left: number };
}

interface Surface3DOptions extends HeatmapOptions {
  elevation: number;      // View elevation angle
  azimuth: number;        // View azimuth angle
  wireframe: boolean;
  opacity: number;
}

class BedMeshVisualizer {
  constructor(canvas: HTMLCanvasElement);

  // 2D Heatmap (matching heatmap_2d.py)
  renderHeatmap(
    meshData: number[][],
    options: Partial<HeatmapOptions>
  ): void;

  // 3D Surface (matching surface_3d.py)
  renderSurface3D(
    meshData: number[][],
    options: Partial<Surface3DOptions>
  ): void;

  // Utilities
  interpolateMesh(mesh: number[][], factor: number): number[][];
  getColorForValue(value: number, min: number, max: number): string;

  // Export
  exportImage(format: 'png' | 'svg'): string;
}
```

#### AnimatedRecommendationVisualizer

```typescript
/**
 * @fileoverview Animated screw adjustment and tape layout visualizations.
 * Replicates ScrewAdjustmentVisualizer and TapeLayoutVisualizer from Python.
 */

interface ScrewVisualizerOptions {
  bedSize: { width: number; height: number };
  animationDuration: number;  // ms
  showLabels: boolean;
  cornerRadius: number;
}

interface TapeVisualizerOptions {
  gridSize: { rows: number; cols: number };
  tapeColor: string;
  maxLayers: number;
}

class AnimatedRecommendationVisualizer {
  constructor(canvas: HTMLCanvasElement);

  // Screw adjustment animation (matching ScrewAdjustmentVisualizer)
  renderScrewAdjustments(
    adjustments: ScrewAdjustment[],
    options: Partial<ScrewVisualizerOptions>
  ): void;

  startAnimation(): void;
  stopAnimation(): void;

  // Tape layout visualization (matching TapeLayoutVisualizer)
  renderTapeLayout(
    recommendations: TapeRecommendation[],
    options: Partial<TapeVisualizerOptions>
  ): void;
}
```

#### ShaperPlotVisualizer

```typescript
/**
 * @fileoverview Input shaper frequency response plots.
 */

interface ShaperPlotOptions {
  showPeaks: boolean;
  showRecommended: boolean;
  frequencyRange: [number, number];
  theme: 'light' | 'dark';
}

class ShaperPlotVisualizer {
  constructor(canvas: HTMLCanvasElement);

  // Frequency response plot (matching shaper_plots.py)
  renderFrequencyResponse(
    calibration: AxisCalibration,
    options: Partial<ShaperPlotOptions>
  ): void;

  // Shaper comparison plot
  renderShaperComparison(
    results: ShaperResult[],
    options: Partial<ShaperPlotOptions>
  ): void;

  // Combined X/Y plot
  renderDualAxisPlot(
    xCalibration: AxisCalibration,
    yCalibration: AxisCalibration
  ): void;
}
```

### UI Components

**Location:** `src/renderer/src/ui/calibration/`

#### CalibrationDialog

The main calibration interface, implemented as a new dialog window similar to the existing settings dialog pattern.

```typescript
/**
 * @fileoverview Main calibration dialog with tabbed interface.
 */

class CalibrationDialog {
  private contextId: string;
  private tabs: {
    bedLeveling: BedLevelingTab;
    inputShaper: InputShaperTab;
    sshSettings: SSHSettingsTab;
  };

  constructor(contextId: string);

  initialize(): Promise<void>;
  show(): void;
  hide(): void;

  // Tab management
  switchTab(tabName: string): void;
  getCurrentTab(): string;
}
```

#### BedLevelingTab

```typescript
/**
 * @fileoverview Bed leveling analysis and recommendations UI.
 * Replicates leveling.py view functionality.
 */

class BedLevelingTab {
  // UI Sections
  private fileLoadSection: HTMLElement;
  private visualizationSection: HTMLElement;
  private metricsSection: HTMLElement;
  private recommendationsSection: HTMLElement;

  // State
  private workspace: BedWorkspace | null;
  private visualizer: BedMeshVisualizer;

  // Actions (matching Python leveling.py)
  loadFromFile(): Promise<void>;
  loadFromSSH(): Promise<void>;
  analyzeCurrentMesh(): void;
  showVisualRecommendations(): void;
  exportReport(): void;

  // Display methods
  updateHeatmap(): void;
  updateMetrics(analysis: AnalysisResult): void;
  updateRecommendations(workflow: WorkflowData): void;
}
```

#### InputShaperTab

```typescript
/**
 * @fileoverview Input shaper calibration UI.
 * Replicates input_shaper.py view functionality.
 */

class InputShaperTab {
  private fileLoadSection: HTMLElement;
  private plotSection: HTMLElement;
  private resultsSection: HTMLElement;

  private xCalibration: AxisCalibration | null;
  private yCalibration: AxisCalibration | null;
  private plotVisualizer: ShaperPlotVisualizer;

  // Actions (matching Python input_shaper.py)
  loadCSVFromFile(axis: 'x' | 'y'): Promise<void>;
  loadCSVFromSSH(axis: 'x' | 'y'): Promise<void>;
  analyzeAxis(axis: 'x' | 'y'): Promise<void>;

  // Display methods
  updatePlots(): void;
  displayResults(calibration: AxisCalibration): void;
  generateGCodeRecommendation(): string;
}
```

#### VisualRecommendationsDialog

```typescript
/**
 * @fileoverview Visual recommendations popup with animated visualizations.
 * Replicates visual_recommendations.py dialog.
 */

class VisualRecommendationsDialog {
  private stageSelector: HTMLSelectElement;
  private visualizationCanvas: HTMLCanvasElement;
  private metricsPanel: HTMLElement;
  private animator: AnimatedRecommendationVisualizer;

  constructor(workflow: WorkflowData);

  show(): void;
  hide(): void;

  // Stage selection (matching Python dialog)
  selectStage(stage: WorkflowStage): void;

  // Metrics display
  updateMetrics(stageResult: StageResult): void;

  // Animation controls
  playAnimation(): void;
  pauseAnimation(): void;
  resetAnimation(): void;
}
```

---

## Data Models

### CalibrationSettings

Integrates with existing `SettingsManager` pattern.

```typescript
/**
 * @fileoverview Calibration-specific settings model.
 */

interface CalibrationHardwareSettings {
  tapeThickness: number;      // mm (default: 0.05)
  beltToothMm: number;        // mm (default: 2.0)
  screwPitch: number;         // mm (default: 0.5)
  minAdjustment: number;      // mm (default: 0.01)
  maxAdjustment: number;      // mm (default: 2.0)
  cornerAveraging: number;    // grid points (default: 2)
}

interface CalibrationThresholds {
  beltThreshold: number;      // mm (default: 0.1)
  screwThreshold: number;     // mm (default: 0.02)
  tapeThreshold: number;      // mm (default: 0.02)
}

interface CalibrationVisualization {
  interpolationFactor: number;  // default: 3
  colorScheme: string;          // default: 'viridis'
  show3D: boolean;              // default: false
}

interface CalibrationWorkflowSettings {
  enableBelt: boolean;        // default: true
  enableScrews: boolean;      // default: true
  enableTape: boolean;        // default: true
}

interface ThermalPreset {
  name: string;
  measurementTemp: number;
  targetTemp: number;
  chamberFactor: number;
  peiThickness: number;
  steelThickness: number;
  alphaPei: number;
  alphaSteel: number;
  betaUniform: number;
}

interface CalibrationSettings {
  hardware: CalibrationHardwareSettings;
  thresholds: CalibrationThresholds;
  visualization: CalibrationVisualization;
  workflow: CalibrationWorkflowSettings;
  thermalPresets: ThermalPreset[];
  activeThermalPreset: string | null;
  environment: {
    measurementTemp: number;
    targetTemp: number;
    thermalExpansionCoeff: number;
  };
  history: {
    maxEntries: number;  // default: 5, configurable
  };
}
```

### Per-Printer Calibration Data

Stored in `PrinterDetails` alongside existing per-printer settings.

```typescript
/**
 * Extended PrinterDetails for calibration data.
 */
interface PrinterCalibrationData {
  // SSH configuration (per-printer)
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  sshPassword?: string;  // Encrypted
  sshKeyPath?: string;

  // Last calibration results
  lastBedMesh?: {
    timestamp: number;
    matrix: number[][];
    analysis: AnalysisResult;
  };

  // Input shaper configuration
  inputShaperX?: ShaperResult;
  inputShaperY?: ShaperResult;

  // Calibration history
  calibrationHistory?: CalibrationHistoryEntry[];
}

interface CalibrationHistoryEntry {
  timestamp: number;
  type: 'bed_level' | 'input_shaper';
  summary: string;
  data: any;
}
```

---

## State Management

### CalibrationManager

**Location:** `src/main/managers/CalibrationManager.ts`

```typescript
/**
 * @fileoverview Central manager for calibration operations.
 * Coordinates between SSH, analysis engines, and UI.
 */

class CalibrationManager {
  private sshManager: SSHConnectionManager;
  private scpTransfer: SCPFileTransfer;
  private contextWorkspaces: Map<string, BedWorkspace>;

  constructor(
    contextManager: PrinterContextManager,
    settingsManager: SettingsManager
  );

  // Workspace management (matching Python AppState)
  getWorkspace(contextId: string): BedWorkspace | undefined;
  createWorkspace(contextId: string, meshData: MeshData): BedWorkspace;

  // SSH operations
  connectSSH(contextId: string): Promise<void>;
  disconnectSSH(contextId: string): Promise<void>;
  isSSHConnected(contextId: string): boolean;

  // File operations
  fetchPrinterConfig(contextId: string): Promise<string>;
  fetchShaperCSV(contextId: string, axis: 'x' | 'y'): Promise<string>;

  // Analysis
  loadMeshFromConfig(contextId: string, configContent: string): BedWorkspace;
  computeWorkflow(contextId: string): WorkflowData | undefined;
  analyzeShaperData(csvContent: string, axis: 'x' | 'y'): Promise<AxisCalibration>;

  // Settings
  getCalibrationSettings(contextId: string): CalibrationSettings;
  updateCalibrationSettings(contextId: string, settings: Partial<CalibrationSettings>): void;
}
```

---

## File Structure

```
src/
├── main/
│   ├── managers/
│   │   └── CalibrationManager.ts           # Central calibration coordinator
│   │
│   ├── services/
│   │   └── calibration/
│   │       ├── index.ts                    # Module exports
│   │       │
│   │       ├── ssh/
│   │       │   ├── SSHConnectionManager.ts # SSH connection pool
│   │       │   └── SCPFileTransfer.ts      # SCP file operations
│   │       │
│   │       ├── engine/
│   │       │   ├── Bed.ts                  # Bed model
│   │       │   ├── ScrewSolver.ts          # Screw adjustment calculator
│   │       │   ├── TapeCalculator.ts       # Tape layer calculator
│   │       │   ├── DeviationAnalyzer.ts    # Mesh deviation analysis
│   │       │   └── WorkflowEngine.ts       # Multi-stage workflow
│   │       │
│   │       ├── shaper/
│   │       │   ├── ShaperAnalyzer.ts       # Input shaper analysis
│   │       │   ├── ShaperDefinitions.ts    # Shaper type definitions
│   │       │   └── FFTProcessor.ts         # FFT computation
│   │       │
│   │       └── parsers/
│   │           ├── KlipperConfigParser.ts  # printer.cfg parser
│   │           └── AccelerometerCSVParser.ts # Shaper CSV parser
│   │
│   ├── ipc/
│   │   └── handlers/
│   │       └── calibration-handlers.ts     # Calibration IPC handlers
│   │
│   └── webui/
│       └── server/
│           └── routes/
│               └── calibration-routes.ts   # WebUI API routes
│
├── renderer/
│   └── src/
│       └── ui/
│           └── calibration/
│               ├── CalibrationDialog.ts    # Main dialog
│               ├── calibration-preload.ts  # Preload script
│               ├── calibration-renderer.ts # Renderer entry
│               │
│               ├── tabs/
│               │   ├── BedLevelingTab.ts   # Bed leveling UI
│               │   ├── InputShaperTab.ts   # Input shaper UI
│               │   └── SSHSettingsTab.ts   # SSH configuration UI
│               │
│               ├── dialogs/
│               │   └── VisualRecommendationsDialog.ts
│               │
│               ├── visualization/
│               │   ├── BedMeshVisualizer.ts
│               │   ├── AnimatedRecommendationVisualizer.ts
│               │   ├── ShaperPlotVisualizer.ts
│               │   └── ColorScales.ts
│               │
│               └── styles/
│                   └── calibration.css
│
├── shared/
│   └── types/
│       └── calibration.ts                  # Shared type definitions
│
└── preload/
    └── calibration-preload.ts              # Calibration preload bridge

# User Data Storage Structure (userData/calibration/)
userData/
└── calibration/
    ├── settings.json                       # Global calibration settings
    └── printers/
        ├── {printer-id-1}/
        │   ├── history.json                # Calibration history (max 5 default)
        │   ├── last-mesh.json              # Last bed mesh data
        │   ├── shaper-x.json               # X-axis shaper config
        │   ├── shaper-y.json               # Y-axis shaper config
        │   └── exports/                    # Exported reports
        │       ├── report-{timestamp}.pdf
        │       ├── report-{timestamp}.png
        │       └── report-{timestamp}.json
        └── {printer-id-2}/
            └── ...
```

---

## IPC Handlers

**Location:** `src/main/ipc/handlers/calibration-handlers.ts`

```typescript
/**
 * @fileoverview IPC handlers for calibration operations.
 */

// SSH Operations
'calibration:ssh-connect': (contextId: string, config: SSHConnectionConfig) => Promise<void>
'calibration:ssh-disconnect': (contextId: string) => Promise<void>
'calibration:ssh-status': (contextId: string) => boolean

// File Operations
'calibration:fetch-printer-config': (contextId: string) => Promise<string>
'calibration:fetch-shaper-csv': (contextId: string, axis: 'x' | 'y') => Promise<string>
'calibration:load-local-config': (contextId: string, filePath: string) => Promise<string>

// Analysis Operations
'calibration:parse-mesh': (contextId: string, configContent: string) => MeshData
'calibration:compute-workflow': (contextId: string) => WorkflowData
'calibration:analyze-shaper': (csvContent: string, axis: 'x' | 'y') => AxisCalibration

// Settings
'calibration:get-settings': (contextId: string) => CalibrationSettings
'calibration:update-settings': (contextId: string, settings: Partial<CalibrationSettings>) => void

// Workspace
'calibration:get-workspace': (contextId: string) => BedWorkspace | null
'calibration:clear-workspace': (contextId: string) => void

// Export & Upload
'calibration:export-config': (contextId: string, format: 'cfg' | 'json') => string
'calibration:upload-config-ssh': (contextId: string, configContent: string) => Promise<void>
'calibration:export-report': (contextId: string, format: 'png' | 'pdf' | 'json' | 'csv') => Promise<string>

// History
'calibration:get-history': (contextId: string) => CalibrationHistoryEntry[]
'calibration:clear-history': (contextId: string) => void
```

---

## Implementation Phases

### Phase 1: Foundation (P0) - Core Infrastructure

**Estimated Scope:** Core calibration engine and data models

1. Create file structure and module scaffolding
2. Implement shared type definitions (`src/shared/types/calibration.ts`)
3. Implement Klipper config parser (`KlipperConfigParser.ts`)
4. Implement `Bed` model
5. Implement `DeviationAnalyzer`
6. Implement `ScrewSolver`
7. Implement `WorkflowEngine` (basic stages)
8. Create `CalibrationManager`
9. Register IPC handlers (analysis operations)
10. Unit tests for all calculation modules

### Phase 2: SSH Integration (P0)

**Estimated Scope:** Remote printer connectivity

1. Add `ssh2` dependency
2. Implement `SSHConnectionManager`
3. Implement `SCPFileTransfer`
4. Add SSH configuration to per-printer settings
5. Register SSH IPC handlers
6. Connection status UI feedback
7. Integration tests for SSH operations

### Phase 3: Visualization (P1)

**Estimated Scope:** Visual components (2D focus, 3D deferred)

1. Implement `BedMeshVisualizer` (2D heatmap) using Canvas API
2. Implement `AnimatedRecommendationVisualizer`
3. Implement color scale utilities (viridis, plasma, etc.)
4. Canvas rendering optimizations
5. Export functionality (PNG, SVG, PDF, JSON, CSV)

### Phase 4: UI Integration (P1)

**Estimated Scope:** Dialog and tab components

1. Create `CalibrationDialog` window
2. Implement `BedLevelingTab`
3. Implement `SSHSettingsTab`
4. Implement `VisualRecommendationsDialog`
5. Add calibration menu entry to main UI
6. Theme integration (CSS variables)
7. Localization keys

### Phase 5: Input Shaper (P1)

**Estimated Scope:** Shaper analysis and visualization

1. Implement FFT processor with Web Worker (WASM future optimization)
2. Implement shaper definitions and math
3. Implement `ShaperAnalyzer`
4. Implement `ShaperPlotVisualizer` using Canvas API
5. Implement `InputShaperTab`
6. Accelerometer CSV parser
7. G-code/config generation with two options:
   - Export updated printer.cfg for manual transfer
   - Send directly via SSH if connected

### Phase 6: Advanced Features (P2)

**Estimated Scope:** Thermal modeling, WebUI, polish

1. Implement `TapeCalculator`
2. Implement thermal expansion prediction
3. Add thermal presets management (PEI, glass, aluminum, custom)
4. Calibration history tracking (5 default, configurable)
5. WebUI routes (`/api/calibration/*`) with main process doing heavy lifting
6. Headless mode support
7. (Localization deferred)

### Phase 7: Testing & Documentation (P2)

1. End-to-end testing
2. Performance optimization
3. User documentation
4. API documentation
5. Release notes

---

## Migration & Compatibility

### Breaking Changes

**None planned.** The calibration system is entirely additive:

- New menu entry: "Calibration Assistant"
- New dialog window: Calibration Dialog
- New settings section: Calibration settings
- New per-printer data: Calibration data in PrinterDetails

### Backward Compatibility

- Existing printer configurations unaffected
- Settings schema extended, not replaced
- No changes to existing IPC handlers
- WebUI gains new routes without affecting existing endpoints

### Data Migration

For users upgrading from standalone Calibration Assistant:

1. Export settings from standalone app (JSON)
2. Import into FlashForgeUI calibration settings
3. SSH credentials re-entry required (security)

---

## Testing Strategy

### Unit Tests

```
tests/
├── calibration/
│   ├── engine/
│   │   ├── Bed.test.ts
│   │   ├── ScrewSolver.test.ts
│   │   ├── TapeCalculator.test.ts
│   │   ├── DeviationAnalyzer.test.ts
│   │   └── WorkflowEngine.test.ts
│   │
│   ├── shaper/
│   │   ├── ShaperAnalyzer.test.ts
│   │   └── FFTProcessor.test.ts
│   │
│   └── parsers/
│       ├── KlipperConfigParser.test.ts
│       └── AccelerometerCSVParser.test.ts
```

### Integration Tests

- SSH connection to test printer
- Full workflow computation
- IPC handler round-trips
- WebUI API endpoints

### Manual Test Cases

1. Load printer.cfg from local file → verify mesh display
2. Connect SSH → fetch config → analyze → verify recommendations
3. Load shaper CSV → analyze → verify frequency plots
4. Complete workflow → visual recommendations → verify animations
5. Change settings → verify recalculation
6. WebUI access → verify all features work headlessly

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSH library compatibility | Medium | High | Test `ssh2` early; have `node-ssh` fallback |
| FFT performance in JS | Medium | Medium | WASM module for heavy computation |
| Canvas rendering performance | Low | Medium | RequestAnimationFrame, off-screen canvas |
| Memory with large meshes | Low | Medium | Lazy loading, data streaming |

### Integration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| IPC handler conflicts | Low | High | Unique handler namespace `calibration:*` |
| Settings schema conflicts | Low | Medium | Separate calibration settings object |
| Window management issues | Low | Medium | Follow existing dialog patterns |

### Dependency Risks

| Dependency | Purpose | Fallback |
|------------|---------|----------|
| ssh2 | SSH connectivity | node-ssh |
| Custom Canvas API | Visualizations | N/A (chosen approach) |
| TypeScript FFT | FFT computation | WASM optimization later |

---

## Resolved Decisions

All questions have been answered and approved:

1. **SSH Library**: `ssh2` (native bindings for better performance)
2. **Visualization**: Custom Canvas API (matches existing codebase patterns)
3. **3D Visualization**: Deferred for later (focus on 2D heatmap first)
4. **FFT Implementation**: TypeScript + Web Worker (WASM ideal for future optimization)
5. **Dialog Architecture**: Single multi-tab dialog (consistent with Settings pattern)
6. **Thermal Presets**: Yes, include default presets for common bed types (PEI, glass, aluminum)
7. **History Retention**: 5 entries default, configurable to higher limit
8. **WebUI**: Build same logic with main process doing heavy lifting

---

## Appendix A: Algorithm Reference

### Screw Adjustment Calculation

From `screw_solver.py`:

```python
def deviation_to_minutes(self, deviation: float) -> float:
    """Convert height deviation to rotation minutes."""
    # Full rotation = pitch mm
    # 1 rotation = 360 degrees = 21600 minutes
    turns = deviation / self.config.pitch
    minutes = abs(turns * 360 * 60)
    return minutes

def get_direction(self, deviation: float) -> RotationDirection:
    """Determine rotation direction based on deviation."""
    # Positive deviation = bed too high = turn CCW to lower
    # Negative deviation = bed too low = turn CW to raise
    return RotationDirection.COUNTERCLOCKWISE if deviation > 0 else RotationDirection.CLOCKWISE
```

### Tape Layer Calculation

From `tape_calculator.py`:

```python
def calculate_layers(self) -> List[TapeRecommendation]:
    """Calculate tape layers needed for each corner."""
    corners = self.bed.get_corner_values()
    reference = min(corners.values())  # Lowest corner

    recommendations = []
    for corner, value in corners.items():
        deviation = value - reference
        if deviation > self.min_height_diff:
            layers = int(deviation / self.tape_thickness)
            recommendations.append(TapeRecommendation(
                corner=corner,
                layers=layers,
                total_thickness=layers * self.tape_thickness,
                deviation=deviation
            ))
    return recommendations
```

### Input Shaper FFT

From `shaper_calibrate.py`:

```python
def calc_freq_response(self, data):
    """Calculate frequency response from accelerometer data."""
    # Apply Hanning window
    window = np.hanning(len(data))
    windowed = data * window

    # Compute FFT
    fft_vals = np.fft.rfft(windowed)
    freqs = np.fft.rfftfreq(len(data), d=1.0/self.sample_rate)

    # Power spectral density
    psd = np.abs(fft_vals) ** 2

    return freqs, psd
```

---

## Appendix B: Default Thermal Presets

Default presets for common bed types (to be included):

```typescript
const defaultThermalPresets: ThermalPreset[] = [
  {
    name: 'PEI Spring Steel',
    measurementTemp: 25,
    targetTemp: 60,
    chamberFactor: 0.8,
    peiThickness: 0.3,
    steelThickness: 0.5,
    alphaPei: 50e-6,    // PEI thermal expansion coefficient
    alphaSteel: 12e-6,  // Steel thermal expansion coefficient
    betaUniform: 0.7
  },
  {
    name: 'Glass Bed',
    measurementTemp: 25,
    targetTemp: 60,
    chamberFactor: 0.6,
    peiThickness: 0,
    steelThickness: 0,
    alphaPei: 0,
    alphaSteel: 9e-6,   // Glass thermal expansion coefficient
    betaUniform: 0.5
  },
  {
    name: 'Aluminum Bed',
    measurementTemp: 25,
    targetTemp: 60,
    chamberFactor: 0.9,
    peiThickness: 0,
    steelThickness: 0,
    alphaPei: 0,
    alphaSteel: 23e-6,  // Aluminum thermal expansion coefficient
    betaUniform: 0.85
  }
];
```

---

**End of Specification**

**Status: APPROVED** - Ready for implementation.
