/**
 * @fileoverview Central manager for calibration operations.
 * Coordinates between parsers, analysis engines, and UI components.
 * Provides a unified interface for all calibration functionality.
 *
 * @module main/managers/CalibrationManager
 */

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type {
  AnalysisResult,
  BedConfig,
  BedWorkspace,
  CalibrationHistoryEntry,
  CalibrationSettings,
  MeshData,
  PrinterCalibrationData,
  ShaperResult,
  StageResult,
  WorkflowData,
  WorkflowStage,
} from '../../shared/types/calibration';
import { DEFAULT_BED_CONFIG, DEFAULT_CALIBRATION_SETTINGS } from '../../shared/types/calibration';
import { Bed, DeviationAnalyzer, ScrewSolver, TapeCalculator, WorkflowEngine } from '../services/calibration/engine';
import { KlipperConfigParser } from '../services/calibration/parsers/KlipperConfigParser';
import { renderHeatmapPNG, renderReportPDF } from '../services/calibration/report/ReportRenderer';
import { decryptSecret, encryptSecret } from '../utils/SecureStorage';

type SerializedWorkflowData = Omit<WorkflowData, 'stages'> & {
  stages: Array<[WorkflowStage, StageResult]>;
};

/**
 * Manager for all calibration operations.
 */
export class CalibrationManager {
  /** Singleton instance */
  private static instance: CalibrationManager | null = null;

  /** Parser for Klipper config files */
  private readonly configParser: KlipperConfigParser;

  /** Per-printer workspaces */
  private readonly workspaces: Map<string, BedWorkspace>;

  /** Global calibration settings */
  private settings: CalibrationSettings;

  /** Per-printer calibration data */
  private readonly printerData: Map<string, PrinterCalibrationData>;

  /** Base path for calibration data storage */
  private readonly dataPath: string;

  /** Whether manager has been initialized */
  private initialized = false;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {
    this.configParser = new KlipperConfigParser();
    this.workspaces = new Map();
    this.printerData = new Map();
    this.settings = { ...DEFAULT_CALIBRATION_SETTINGS };
    this.dataPath = path.join(app.getPath('userData'), 'calibration');
  }

  /**
   * Get the singleton instance.
   */
  static getInstance(): CalibrationManager {
    if (!CalibrationManager.instance) {
      CalibrationManager.instance = new CalibrationManager();
    }
    return CalibrationManager.instance;
  }

  /**
   * Initialize the calibration manager.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure data directories exist
    await fs.mkdir(this.dataPath, { recursive: true });
    await fs.mkdir(path.join(this.dataPath, 'printers'), { recursive: true });

    // Load global settings
    await this.loadSettings();

    this.initialized = true;
  }

  /**
   * Load global calibration settings from disk.
   */
  private async loadSettings(): Promise<void> {
    const settingsPath = path.join(this.dataPath, 'settings.json');

    try {
      const data = await fs.readFile(settingsPath, 'utf-8');
      const loaded = JSON.parse(data) as Partial<CalibrationSettings>;
      this.settings = { ...DEFAULT_CALIBRATION_SETTINGS, ...loaded };
    } catch {
      // Use defaults if file doesn't exist or is invalid
      this.settings = { ...DEFAULT_CALIBRATION_SETTINGS };
    }
  }

  /**
   * Save global calibration settings to disk.
   */
  private async saveSettings(): Promise<void> {
    const settingsPath = path.join(this.dataPath, 'settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(this.settings, null, 2));
  }

  /**
   * Get per-printer storage paths.
   */
  private getPrinterPaths(contextId: string): {
    baseDir: string;
    historyPath: string;
    lastMeshPath: string;
    shaperXPath: string;
    shaperYPath: string;
    sshPath: string;
    exportsDir: string;
    legacyPath: string;
  } {
    const baseDir = path.join(this.dataPath, 'printers', contextId);
    return {
      baseDir,
      historyPath: path.join(baseDir, 'history.json'),
      lastMeshPath: path.join(baseDir, 'last-mesh.json'),
      shaperXPath: path.join(baseDir, 'shaper-x.json'),
      shaperYPath: path.join(baseDir, 'shaper-y.json'),
      sshPath: path.join(baseDir, 'ssh.json'),
      exportsDir: path.join(baseDir, 'exports'),
      legacyPath: path.join(baseDir, 'calibration-data.json'),
    };
  }

  /**
   * Ensure printer directories exist.
   */
  private async ensurePrinterDirs(contextId: string): Promise<void> {
    const paths = this.getPrinterPaths(contextId);
    await fs.mkdir(paths.baseDir, { recursive: true });
    await fs.mkdir(paths.exportsDir, { recursive: true });
  }

  private async readJSONFile<T>(filePath: string): Promise<T | null> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  private async writeJSONFile(filePath: string, data: unknown): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  private serializeWorkflowData(data: WorkflowData): SerializedWorkflowData {
    return {
      ...data,
      stages: Array.from(data.stages.entries()),
    };
  }

  private deserializeWorkflowData(data: WorkflowData | SerializedWorkflowData): WorkflowData {
    if (data.stages instanceof Map) {
      return data as WorkflowData;
    }
    const stages = new Map<WorkflowStage, StageResult>(data.stages);
    return {
      ...(data as WorkflowData),
      stages,
    };
  }

  private serializeHistoryEntries(entries: CalibrationHistoryEntry[]): CalibrationHistoryEntry[] {
    return entries.map((entry) => {
      const workflow = entry.data as WorkflowData | undefined;
      if (workflow?.stages instanceof Map) {
        const serialized = this.serializeWorkflowData(workflow);
        return {
          ...entry,
          data: serialized as unknown as WorkflowData,
        };
      }
      return entry;
    });
  }

  private deserializeHistoryEntries(entries: CalibrationHistoryEntry[]): CalibrationHistoryEntry[] {
    return entries.map((entry) => {
      const data = entry.data as WorkflowData | SerializedWorkflowData | undefined;
      if (data && (data as SerializedWorkflowData).stages && Array.isArray((data as SerializedWorkflowData).stages)) {
        return {
          ...entry,
          data: this.deserializeWorkflowData(data) as WorkflowData,
        };
      }
      return entry;
    });
  }

  /**
   * Get current calibration settings.
   */
  getSettings(): CalibrationSettings {
    return { ...this.settings };
  }

  /**
   * Update calibration settings.
   */
  async updateSettings(settings: Partial<CalibrationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await this.saveSettings();
  }

  /**
   * Get or create a workspace for a printer context.
   */
  getWorkspace(contextId: string): BedWorkspace | undefined {
    return this.workspaces.get(contextId);
  }

  /**
   * Create a new workspace for a printer context.
   */
  createWorkspace(contextId: string, meshData?: MeshData): BedWorkspace {
    const bedConfig: BedConfig = meshData
      ? {
          sizeX: meshData.maxX - meshData.minX,
          sizeY: meshData.maxY - meshData.minY,
          meshPointsX: meshData.pointsX,
          meshPointsY: meshData.pointsY,
        }
      : { ...DEFAULT_BED_CONFIG };

    const workspace: BedWorkspace = {
      contextId,
      meshData: meshData || null,
      bedConfig,
      analysis: null,
      workflow: null,
      isDirty: false,
    };

    this.workspaces.set(contextId, workspace);
    return workspace;
  }

  /**
   * Clear a workspace.
   */
  clearWorkspace(contextId: string): void {
    this.workspaces.delete(contextId);
  }

  /**
   * Parse a Klipper config file and extract mesh data.
   */
  parseConfigFile(content: string, profileName = 'default'): MeshData | null {
    const result = this.configParser.parseConfigFile(content, profileName);
    if (!result.success || !result.data) {
      return null;
    }
    return result.data;
  }

  /**
   * Get available mesh profiles from a config file.
   */
  getAvailableProfiles(content: string): string[] {
    return this.configParser.getAvailableProfiles(content);
  }

  /**
   * Load mesh data into a workspace from config content.
   */
  loadMeshFromConfig(contextId: string, configContent: string, profileName = 'default'): BedWorkspace | null {
    const meshData = this.parseConfigFile(configContent, profileName);
    if (!meshData) {
      return null;
    }

    // Validate mesh data
    const validation = this.configParser.validateMeshData(meshData);
    if (!validation.isValid) {
      console.error('Invalid mesh data:', validation.error);
      return null;
    }

    // Create or update workspace
    let workspace = this.workspaces.get(contextId);
    if (!workspace) {
      workspace = this.createWorkspace(contextId, meshData);
    } else {
      workspace.meshData = meshData;
      workspace.bedConfig = this.configParser.createBedConfigFromMesh(meshData);
      workspace.isDirty = true;
    }

    return workspace;
  }

  /**
   * Analyze the current mesh in a workspace.
   */
  analyzeMesh(contextId: string): AnalysisResult | null {
    const workspace = this.workspaces.get(contextId);
    if (!workspace?.meshData) {
      return null;
    }

    const bed = new Bed(workspace.bedConfig);
    bed.setMeshData(workspace.meshData.matrix);

    const analyzer = new DeviationAnalyzer(bed, {
      cornerAveragingSize: this.settings.hardware.cornerAveraging,
      screwThreshold: this.settings.thresholds.screwThreshold,
      tapeThreshold: this.settings.thresholds.tapeThreshold,
      beltThreshold: this.settings.thresholds.beltThreshold,
      screwConfig: {
        pitch: this.settings.hardware.screwPitch,
        minAdjust: this.settings.hardware.minAdjustment,
        maxAdjust: this.settings.hardware.maxAdjustment,
      },
    });

    const analysis = analyzer.analyze();
    workspace.analysis = analysis;

    return analysis;
  }

  /**
   * Compute the full calibration workflow for a workspace.
   */
  computeWorkflow(contextId: string): WorkflowData | null {
    const workspace = this.workspaces.get(contextId);
    if (!workspace?.meshData) {
      return null;
    }

    const bed = new Bed(workspace.bedConfig);
    bed.setMeshData(workspace.meshData.matrix);

    const analyzer = new DeviationAnalyzer(bed, {
      cornerAveragingSize: this.settings.hardware.cornerAveraging,
      screwThreshold: this.settings.thresholds.screwThreshold,
      tapeThreshold: this.settings.thresholds.tapeThreshold,
      beltThreshold: this.settings.thresholds.beltThreshold,
      screwConfig: {
        pitch: this.settings.hardware.screwPitch,
        minAdjust: this.settings.hardware.minAdjustment,
        maxAdjust: this.settings.hardware.maxAdjustment,
      },
    });

    const screwSolver = new ScrewSolver(bed, {
      pitch: this.settings.hardware.screwPitch,
      minAdjust: this.settings.hardware.minAdjustment,
      maxAdjust: this.settings.hardware.maxAdjustment,
    });

    const tapeCalculator = new TapeCalculator(bed, {
      tapeThickness: this.settings.hardware.tapeThickness,
      minHeightDiff: this.settings.thresholds.tapeThreshold,
    });

    const workflowEngine = new WorkflowEngine(bed, screwSolver, tapeCalculator, this.settings);

    const workflow = workflowEngine.computeWorkflow();
    workspace.workflow = workflow;
    workspace.analysis = analyzer.analyze();

    return workflow;
  }

  /**
   * Get printer-specific calibration data.
   */
  async getPrinterData(contextId: string): Promise<PrinterCalibrationData> {
    // Check cache first
    if (this.printerData.has(contextId)) {
      return this.printerData.get(contextId)!;
    }

    await this.ensurePrinterDirs(contextId);
    const paths = this.getPrinterPaths(contextId);

    // Legacy migration
    const legacyData = await this.readJSONFile<PrinterCalibrationData>(paths.legacyPath);
    if (legacyData) {
      await this.savePrinterData(contextId, legacyData);
      try {
        await fs.rename(paths.legacyPath, path.join(paths.baseDir, 'calibration-data.legacy.json'));
      } catch {
        // Ignore migration cleanup errors
      }
      return this.printerData.get(contextId) || {};
    }

    const [sshData, historyData, lastMesh, shaperX, shaperY] = await Promise.all([
      this.readJSONFile<PrinterCalibrationData>(paths.sshPath),
      this.readJSONFile<CalibrationHistoryEntry[]>(paths.historyPath),
      this.readJSONFile<PrinterCalibrationData['lastBedMesh']>(paths.lastMeshPath),
      this.readJSONFile<ShaperResult>(paths.shaperXPath),
      this.readJSONFile<ShaperResult>(paths.shaperYPath),
    ]);

    const data: PrinterCalibrationData = {
      ...(sshData || {}),
      lastBedMesh: lastMesh || undefined,
      inputShaperX: shaperX || undefined,
      inputShaperY: shaperY || undefined,
      calibrationHistory: historyData ? this.deserializeHistoryEntries(historyData) : undefined,
    };

    if (data.sshPassword) {
      data.sshPassword = decryptSecret(data.sshPassword);
    }

    this.printerData.set(contextId, data);
    return data;
  }

  /**
   * Save printer-specific calibration data.
   */
  async savePrinterData(contextId: string, data: PrinterCalibrationData): Promise<void> {
    await this.ensurePrinterDirs(contextId);
    const paths = this.getPrinterPaths(contextId);

    const shouldPersistSSH = data.sshSaveCredentials !== false;
    const sshPayload: PrinterCalibrationData = shouldPersistSSH
      ? {
          sshHost: data.sshHost,
          sshPort: data.sshPort,
          sshUsername: data.sshUsername,
          sshPassword: data.sshPassword ? encryptSecret(data.sshPassword) : undefined,
          sshKeyPath: data.sshKeyPath,
          sshConfigPath: data.sshConfigPath,
          sshSaveCredentials: data.sshSaveCredentials,
        }
      : {};

    const sshHasValues = Object.values(sshPayload).some((value) => value !== undefined && value !== '');
    if (sshHasValues) {
      await this.writeJSONFile(paths.sshPath, sshPayload);
    } else {
      await fs.rm(paths.sshPath, { force: true });
    }

    if (data.calibrationHistory && data.calibrationHistory.length > 0) {
      const serializedHistory = this.serializeHistoryEntries(data.calibrationHistory);
      await this.writeJSONFile(paths.historyPath, serializedHistory);
    } else {
      await fs.rm(paths.historyPath, { force: true });
    }

    if (data.lastBedMesh) {
      await this.writeJSONFile(paths.lastMeshPath, data.lastBedMesh);
    } else {
      await fs.rm(paths.lastMeshPath, { force: true });
    }

    if (data.inputShaperX) {
      await this.writeJSONFile(paths.shaperXPath, data.inputShaperX);
    } else {
      await fs.rm(paths.shaperXPath, { force: true });
    }

    if (data.inputShaperY) {
      await this.writeJSONFile(paths.shaperYPath, data.inputShaperY);
    } else {
      await fs.rm(paths.shaperYPath, { force: true });
    }

    this.printerData.set(contextId, data);
  }

  /**
   * Add a calibration history entry for a printer.
   */
  async addHistoryEntry(
    contextId: string,
    type: 'bed_level' | 'input_shaper',
    summary: string,
    data: WorkflowData | unknown
  ): Promise<void> {
    const printerData = await this.getPrinterData(contextId);

    const entry: CalibrationHistoryEntry = {
      timestamp: Date.now(),
      type,
      summary,
      data: data as WorkflowData,
    };

    if (!printerData.calibrationHistory) {
      printerData.calibrationHistory = [];
    }

    // Add new entry at the beginning
    printerData.calibrationHistory.unshift(entry);

    // Trim to max entries
    const maxEntries = this.settings.history.maxEntries;
    if (printerData.calibrationHistory.length > maxEntries) {
      printerData.calibrationHistory = printerData.calibrationHistory.slice(0, maxEntries);
    }

    await this.savePrinterData(contextId, printerData);
  }

  /**
   * Get calibration history for a printer.
   */
  async getHistory(contextId: string): Promise<CalibrationHistoryEntry[]> {
    const printerData = await this.getPrinterData(contextId);
    return printerData.calibrationHistory || [];
  }

  /**
   * Clear calibration history for a printer.
   */
  async clearHistory(contextId: string): Promise<void> {
    const printerData = await this.getPrinterData(contextId);
    printerData.calibrationHistory = [];
    await this.savePrinterData(contextId, printerData);
  }

  /**
   * Persist the latest bed mesh analysis for a printer.
   */
  async saveLastBedMesh(contextId: string, matrix: number[][], analysis: AnalysisResult): Promise<void> {
    const printerData = await this.getPrinterData(contextId);
    printerData.lastBedMesh = {
      timestamp: Date.now(),
      matrix,
      analysis,
    };
    await this.savePrinterData(contextId, printerData);
  }

  /**
   * Persist a recommended input shaper result for a printer.
   */
  async saveShaperResult(contextId: string, axis: 'x' | 'y', result: ShaperResult): Promise<void> {
    const printerData = await this.getPrinterData(contextId);
    if (axis === 'x') {
      printerData.inputShaperX = result;
    } else {
      printerData.inputShaperY = result;
    }
    await this.savePrinterData(contextId, printerData);
  }

  /**
   * Export calibration report.
   */
  async exportReport(contextId: string, format: 'json' | 'csv' | 'png' | 'pdf'): Promise<string | Buffer> {
    const workspace = this.workspaces.get(contextId);
    if (!workspace || !workspace.meshData) {
      throw new Error('No workspace found for context');
    }

    if (!workspace.analysis) {
      this.analyzeMesh(contextId);
    }

    if (format === 'json') {
      return JSON.stringify(
        {
          contextId,
          timestamp: Date.now(),
          meshData: workspace.meshData,
          analysis: workspace.analysis,
          workflow: workspace.workflow
            ? {
                initialRange: workspace.workflow.initialRange,
                finalRange: workspace.workflow.finalRange,
                improvementPercent: workspace.workflow.improvementPercent,
                screwAdjustments: workspace.workflow.screwAdjustments,
                tapeRecommendations: workspace.workflow.tapeRecommendations,
              }
            : null,
          settings: this.settings,
        },
        null,
        2
      );
    }

    if (format === 'csv') {
      // Export mesh as CSV
      const lines: string[] = [];
      lines.push('# Calibration Report');
      lines.push(`# Context: ${contextId}`);
      lines.push(`# Timestamp: ${new Date().toISOString()}`);
      lines.push('');
      lines.push('# Mesh Data');
      lines.push(`# X: ${workspace.meshData.minX} to ${workspace.meshData.maxX}`);
      lines.push(`# Y: ${workspace.meshData.minY} to ${workspace.meshData.maxY}`);
      lines.push('');

      // Header row
      const cols = workspace.meshData.pointsX;
      const headerRow = Array.from({ length: cols }, (_, i) => `X${i}`).join(',');
      lines.push(`Row,${headerRow}`);

      // Data rows
      for (let row = 0; row < workspace.meshData.matrix.length; row++) {
        const rowData = workspace.meshData.matrix[row].map((v) => v.toFixed(4)).join(',');
        lines.push(`${row},${rowData}`);
      }

      return lines.join('\n');
    }

    if (format === 'png') {
      return renderHeatmapPNG(workspace.meshData, {
        colorScheme: this.settings.visualization.colorScheme,
        cellSize: 24,
        padding: 16,
        showGrid: true,
      });
    }

    if (format === 'pdf') {
      return renderReportPDF({
        contextId,
        meshData: workspace.meshData,
        analysis: workspace.analysis,
        workflow: workspace.workflow,
        settings: this.settings,
      });
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  /**
   * Get default export path for a calibration report.
   */
  async getDefaultExportPath(contextId: string, format: 'json' | 'csv' | 'png' | 'pdf'): Promise<string> {
    await this.ensurePrinterDirs(contextId);
    const paths = this.getPrinterPaths(contextId);
    return path.join(paths.exportsDir, `report-${Date.now()}.${format}`);
  }

  /**
   * Shutdown and cleanup.
   */
  async shutdown(): Promise<void> {
    await this.saveSettings();
    this.workspaces.clear();
    this.printerData.clear();
    this.initialized = false;
  }
}

/**
 * Get the CalibrationManager singleton instance.
 */
export function getCalibrationManager(): CalibrationManager {
  return CalibrationManager.getInstance();
}
