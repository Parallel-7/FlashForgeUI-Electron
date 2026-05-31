/**
 * @fileoverview IPC handlers for calibration operations.
 * Exposes calibration functionality to renderer processes through IPC.
 *
 * @module main/ipc/handlers/calibration-handlers
 */

import { dialog, ipcMain } from 'electron';
import fs from 'fs/promises';
import type {
  AnalysisResult,
  BedWorkspace,
  CalibrationHistoryEntry,
  CalibrationSettings,
  MeshData,
  SSHConnectionConfig,
  SSHConnectionStatus,
  TransferResult,
  WorkflowData,
} from '../../../shared/types/calibration';
import { getCalibrationManager } from '../../managers/CalibrationManager';
import type { CommandResult } from '../../services/calibration/ssh';
import { getSSHConnectionManager, SCPFileTransfer } from '../../services/calibration/ssh';

/**
 * Register all calibration IPC handlers.
 */
export function registerCalibrationHandlers(): void {
  const manager = getCalibrationManager();
  void manager.initialize();

  // ============================================================================
  // Settings Operations
  // ============================================================================

  /**
   * Get current calibration settings.
   */
  ipcMain.handle('calibration:get-settings', async (): Promise<CalibrationSettings> => {
    return manager.getSettings();
  });

  /**
   * Update calibration settings.
   */
  ipcMain.handle(
    'calibration:update-settings',
    async (_event, settings: Partial<CalibrationSettings>): Promise<void> => {
      await manager.updateSettings(settings);
    }
  );

  // ============================================================================
  // Workspace Operations
  // ============================================================================

  /**
   * Get workspace for a printer context.
   */
  ipcMain.handle('calibration:get-workspace', async (_event, contextId: string): Promise<BedWorkspace | null> => {
    return manager.getWorkspace(contextId) || null;
  });

  /**
   * Create a new workspace for a printer context.
   */
  ipcMain.handle('calibration:create-workspace', async (_event, contextId: string): Promise<BedWorkspace> => {
    return manager.createWorkspace(contextId);
  });

  /**
   * Clear workspace for a printer context.
   */
  ipcMain.handle('calibration:clear-workspace', async (_event, contextId: string): Promise<void> => {
    manager.clearWorkspace(contextId);
  });

  // ============================================================================
  // File Operations
  // ============================================================================

  /**
   * Open file dialog to select a printer.cfg file.
   */
  ipcMain.handle('calibration:open-config-file', async (): Promise<{ content: string; filePath: string } | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Open Printer Configuration',
      filters: [
        { name: 'Config Files', extensions: ['cfg', 'conf'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');

    return { content, filePath };
  });

  /**
   * Open file dialog to select input shaper CSV file.
   */
  ipcMain.handle(
    'calibration:open-shaper-csv-file',
    async (): Promise<{ content: string; filePath: string } | null> => {
      const result = await dialog.showOpenDialog({
        title: 'Open Input Shaper CSV',
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const filePath = result.filePaths[0];
      const content = await fs.readFile(filePath, 'utf-8');
      return { content, filePath };
    }
  );

  /**
   * Open file dialog to select SSH private key file.
   */
  ipcMain.handle('calibration:open-ssh-key-file', async (): Promise<{ filePath: string } | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select SSH Private Key',
      filters: [
        { name: 'Key Files', extensions: ['pem', 'key', 'ppk'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return { filePath: result.filePaths[0] };
  });

  /**
   * Load mesh data from config file content.
   */
  ipcMain.handle(
    'calibration:load-config',
    async (_event, contextId: string, configContent: string, profileName?: string): Promise<BedWorkspace | null> => {
      return manager.loadMeshFromConfig(contextId, configContent, profileName);
    }
  );

  /**
   * Get available mesh profiles from config content.
   */
  ipcMain.handle('calibration:get-profiles', async (_event, configContent: string): Promise<string[]> => {
    return manager.getAvailableProfiles(configContent);
  });

  /**
   * Parse config file and return mesh data.
   */
  ipcMain.handle(
    'calibration:parse-mesh',
    async (_event, configContent: string, profileName?: string): Promise<MeshData | null> => {
      return manager.parseConfigFile(configContent, profileName);
    }
  );

  // ============================================================================
  // Analysis Operations
  // ============================================================================

  /**
   * Analyze mesh data in a workspace.
   */
  ipcMain.handle('calibration:analyze-mesh', async (_event, contextId: string): Promise<AnalysisResult | null> => {
    return manager.analyzeMesh(contextId);
  });

  /**
   * Compute full calibration workflow.
   */
  ipcMain.handle('calibration:compute-workflow', async (_event, contextId: string): Promise<WorkflowData | null> => {
    const workflow = manager.computeWorkflow(contextId);
    const workspace = manager.getWorkspace(contextId);
    if (workflow && workspace?.meshData && workspace.analysis) {
      await manager.saveLastBedMesh(contextId, workspace.meshData.matrix, workspace.analysis);
    }
    return workflow;
  });

  // ============================================================================
  // History Operations
  // ============================================================================

  /**
   * Get calibration history for a printer.
   */
  ipcMain.handle('calibration:get-history', async (_event, contextId: string): Promise<CalibrationHistoryEntry[]> => {
    return manager.getHistory(contextId);
  });

  /**
   * Add a calibration history entry.
   */
  ipcMain.handle(
    'calibration:add-history',
    async (
      _event,
      contextId: string,
      type: 'bed_level' | 'input_shaper',
      summary: string,
      data: unknown
    ): Promise<void> => {
      await manager.addHistoryEntry(contextId, type, summary, data as WorkflowData);
    }
  );

  /**
   * Clear calibration history for a printer.
   */
  ipcMain.handle('calibration:clear-history', async (_event, contextId: string): Promise<void> => {
    await manager.clearHistory(contextId);
  });

  // ============================================================================
  // Export Operations
  // ============================================================================

  /**
   * Export calibration report.
   */
  ipcMain.handle(
    'calibration:export-report',
    async (_event, contextId: string, format: 'json' | 'csv' | 'png' | 'pdf'): Promise<string | Buffer> => {
      return manager.exportReport(contextId, format);
    }
  );

  /**
   * Save exported report to file.
   */
  ipcMain.handle(
    'calibration:save-report',
    async (_event, contextId: string, format: 'json' | 'csv' | 'png' | 'pdf'): Promise<string | null> => {
      const report = await manager.exportReport(contextId, format);

      const filterName = format === 'png' ? 'PNG Image' : format === 'pdf' ? 'PDF Document' : format.toUpperCase();

      const defaultPath = await manager.getDefaultExportPath(contextId, format);
      const result = await dialog.showSaveDialog({
        title: 'Save Calibration Report',
        defaultPath,
        filters: [{ name: filterName, extensions: [format] }],
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      if (typeof report === 'string') {
        await fs.writeFile(result.filePath, report, 'utf-8');
      } else {
        await fs.writeFile(result.filePath, report);
      }
      return result.filePath;
    }
  );

  /**
   * Save printer configuration content to file.
   */
  ipcMain.handle(
    'calibration:save-config',
    async (_event, content: string, defaultName?: string): Promise<string | null> => {
      const result = await dialog.showSaveDialog({
        title: 'Save Printer Configuration',
        defaultPath: defaultName || `printer-config-${Date.now()}.cfg`,
        filters: [
          { name: 'Config Files', extensions: ['cfg'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      await fs.writeFile(result.filePath, content, 'utf-8');
      return result.filePath;
    }
  );

  // ============================================================================
  // SSH Operations
  // ============================================================================

  const sshManager = getSSHConnectionManager();
  const scpTransfer = new SCPFileTransfer(sshManager);

  /**
   * Connect to a printer via SSH.
   */
  ipcMain.handle(
    'calibration:ssh-connect',
    async (_event, contextId: string, config: SSHConnectionConfig): Promise<void> => {
      const resolvedConfig: SSHConnectionConfig = { ...config };
      if (resolvedConfig.privateKey && !resolvedConfig.privateKey.includes('BEGIN')) {
        try {
          const keyContent = await fs.readFile(resolvedConfig.privateKey, 'utf-8');
          resolvedConfig.privateKey = keyContent;
        } catch {
          // Leave as-is if file read fails (could already be key content)
        }
      }
      await sshManager.connect(contextId, resolvedConfig);
    }
  );

  /**
   * Disconnect SSH connection.
   */
  ipcMain.handle('calibration:ssh-disconnect', async (_event, contextId: string): Promise<void> => {
    await sshManager.disconnect(contextId);
  });

  /**
   * Get SSH connection status.
   */
  ipcMain.handle('calibration:ssh-status', async (_event, contextId: string): Promise<SSHConnectionStatus> => {
    return sshManager.getStatus(contextId);
  });

  /**
   * Check if SSH is connected.
   */
  ipcMain.handle('calibration:ssh-is-connected', async (_event, contextId: string): Promise<boolean> => {
    return sshManager.isConnected(contextId);
  });

  /**
   * Execute a command over SSH.
   */
  ipcMain.handle(
    'calibration:ssh-execute',
    async (_event, contextId: string, command: string): Promise<CommandResult> => {
      return sshManager.executeCommand(contextId, command);
    }
  );

  /**
   * Fetch printer.cfg from printer over SSH.
   */
  ipcMain.handle(
    'calibration:ssh-fetch-config',
    async (_event, contextId: string, remotePath?: string): Promise<string> => {
      return scpTransfer.fetchPrinterConfig(contextId, remotePath);
    }
  );

  /**
   * Fetch input shaper CSV data from printer.
   */
  ipcMain.handle(
    'calibration:ssh-fetch-shaper',
    async (_event, contextId: string, axis: 'x' | 'y'): Promise<string> => {
      return scpTransfer.fetchShaperCSV(contextId, axis);
    }
  );

  /**
   * Upload config to printer over SSH.
   */
  ipcMain.handle(
    'calibration:ssh-upload-config',
    async (_event, contextId: string, content: string, remotePath?: string): Promise<TransferResult> => {
      return scpTransfer.uploadConfig(contextId, content, remotePath);
    }
  );

  /**
   * Download a file from printer over SSH.
   */
  ipcMain.handle(
    'calibration:ssh-download-file',
    async (_event, contextId: string, remotePath: string, localPath?: string): Promise<TransferResult> => {
      return scpTransfer.downloadFile(contextId, remotePath, localPath);
    }
  );

  /**
   * Upload a file to printer over SSH.
   */
  ipcMain.handle(
    'calibration:ssh-upload-file',
    async (_event, contextId: string, localPath: string, remotePath: string): Promise<TransferResult> => {
      return scpTransfer.uploadFile(contextId, localPath, remotePath);
    }
  );

  /**
   * List files in a remote directory.
   */
  ipcMain.handle(
    'calibration:ssh-list-dir',
    async (_event, contextId: string, remotePath: string): Promise<string[]> => {
      return scpTransfer.listDirectory(contextId, remotePath);
    }
  );

  /**
   * Check if a remote file exists.
   */
  ipcMain.handle(
    'calibration:ssh-file-exists',
    async (_event, contextId: string, remotePath: string): Promise<boolean> => {
      return scpTransfer.fileExists(contextId, remotePath);
    }
  );

  // ============================================================================
  // Input Shaper Operations
  // ============================================================================

  /**
   * Analyze input shaper data for an axis.
   */
  ipcMain.handle(
    'calibration:analyze-shaper',
    async (
      _event,
      csvContent: string,
      axis: 'x' | 'y'
    ): Promise<import('../../../shared/types/calibration').AxisCalibration> => {
      const { ShaperAnalyzer } = await import('../../services/calibration/shaper');
      const analyzer = new ShaperAnalyzer();
      return analyzer.analyzeAxis(csvContent, axis);
    }
  );

  /**
   * Generate Klipper config for shaper result.
   */
  ipcMain.handle(
    'calibration:generate-shaper-config',
    async (
      _event,
      axis: 'x' | 'y',
      result: import('../../../shared/types/calibration').ShaperResult
    ): Promise<string[]> => {
      const { ShaperAnalyzer } = await import('../../services/calibration/shaper');
      const analyzer = new ShaperAnalyzer();
      return analyzer.generateKlipperConfig(axis, result);
    }
  );

  /**
   * Save shaper recommendation for a printer.
   */
  ipcMain.handle(
    'calibration:save-shaper-result',
    async (
      _event,
      contextId: string,
      axis: 'x' | 'y',
      result: import('../../../shared/types/calibration').ShaperResult
    ): Promise<void> => {
      await manager.saveShaperResult(contextId, axis, result);
    }
  );

  // ============================================================================
  // SSH Settings Persistence
  // ============================================================================

  ipcMain.handle('calibration:get-ssh-config', async (_event, contextId: string) => {
    const data = await manager.getPrinterData(contextId);
    if (!data) {
      return null;
    }
    return {
      host: data.sshHost,
      port: data.sshPort,
      username: data.sshUsername,
      password: data.sshPassword,
      keyPath: data.sshKeyPath,
      configPath: data.sshConfigPath,
      saveCredentials: data.sshSaveCredentials,
    };
  });

  ipcMain.handle(
    'calibration:save-ssh-config',
    async (
      _event,
      contextId: string,
      config: {
        host?: string;
        port?: number;
        username?: string;
        password?: string;
        keyPath?: string;
        configPath?: string;
        saveCredentials?: boolean;
      }
    ) => {
      const data = await manager.getPrinterData(contextId);
      const updated = {
        ...data,
        sshHost: config.host,
        sshPort: config.port,
        sshUsername: config.username,
        sshPassword: config.password,
        sshKeyPath: config.keyPath,
        sshConfigPath: config.configPath,
        sshSaveCredentials: config.saveCredentials ?? true,
      };
      await manager.savePrinterData(contextId, updated);
    }
  );

  ipcMain.handle('calibration:clear-ssh-config', async (_event, contextId: string) => {
    const data = await manager.getPrinterData(contextId);
    const updated = {
      ...data,
      sshHost: undefined,
      sshPort: undefined,
      sshUsername: undefined,
      sshPassword: undefined,
      sshKeyPath: undefined,
      sshConfigPath: undefined,
      sshSaveCredentials: false,
    };
    await manager.savePrinterData(contextId, updated);
  });

  /**
   * Get all shaper definitions.
   */
  ipcMain.handle(
    'calibration:get-shaper-definitions',
    async (): Promise<import('../../../shared/types/calibration').ShaperDefinition[]> => {
      const { getAllShaperDefinitions } = await import('../../services/calibration/shaper');
      return getAllShaperDefinitions();
    }
  );
}

/**
 * Unregister all calibration IPC handlers.
 */
export function unregisterCalibrationHandlers(): void {
  const handlers = [
    'calibration:get-settings',
    'calibration:update-settings',
    'calibration:get-workspace',
    'calibration:create-workspace',
    'calibration:clear-workspace',
    'calibration:open-config-file',
    'calibration:open-shaper-csv-file',
    'calibration:open-ssh-key-file',
    'calibration:load-config',
    'calibration:get-profiles',
    'calibration:parse-mesh',
    'calibration:analyze-mesh',
    'calibration:compute-workflow',
    'calibration:get-history',
    'calibration:add-history',
    'calibration:clear-history',
    'calibration:export-report',
    'calibration:save-report',
    'calibration:save-config',
    // SSH handlers
    'calibration:ssh-connect',
    'calibration:ssh-disconnect',
    'calibration:ssh-status',
    'calibration:ssh-is-connected',
    'calibration:ssh-execute',
    'calibration:ssh-fetch-config',
    'calibration:ssh-fetch-shaper',
    'calibration:ssh-upload-config',
    'calibration:ssh-download-file',
    'calibration:ssh-upload-file',
    'calibration:ssh-list-dir',
    'calibration:ssh-file-exists',
    // Shaper handlers
    'calibration:analyze-shaper',
    'calibration:generate-shaper-config',
    'calibration:get-shaper-definitions',
    'calibration:save-shaper-result',
    'calibration:get-ssh-config',
    'calibration:save-ssh-config',
    'calibration:clear-ssh-config',
  ];

  for (const handler of handlers) {
    ipcMain.removeHandler(handler);
  }
}
