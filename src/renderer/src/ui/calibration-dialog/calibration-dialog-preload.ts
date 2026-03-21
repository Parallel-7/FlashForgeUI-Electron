/**
 * @fileoverview Preload script for the Calibration Assistant dialog.
 * Exposes calibration IPC methods to the renderer process via context bridge.
 *
 * @module renderer/ui/calibration-dialog/calibration-dialog-preload
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  AnalysisResult,
  AxisCalibration,
  BedWorkspace,
  CalibrationHistoryEntry,
  CalibrationSettings,
  MeshData,
  ShaperResult,
  SSHConnectionConfig,
  SSHConnectionStatus,
  TransferResult,
  WorkflowData,
} from '../../../../shared/types/calibration';

/**
 * Command result from SSH execution.
 */
interface CommandResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
}

interface StoredSSHConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  keyPath?: string;
  configPath?: string;
  saveCredentials?: boolean;
}

interface ActivePrinterContextInfo {
  id?: string;
  name?: string;
  ip?: string;
}

async function getActivePrinterContext(): Promise<ActivePrinterContextInfo | null> {
  const active = (await ipcRenderer.invoke('printer-contexts:get-active')) as ActivePrinterContextInfo | null;
  return active && typeof active === 'object' ? active : null;
}

/**
 * Calibration API exposed to renderer.
 */
const calibrationAPI = {
  // ============================================================================
  // Settings Operations
  // ============================================================================

  /** Get current calibration settings */
  getSettings: (): Promise<CalibrationSettings> => {
    return ipcRenderer.invoke('calibration:get-settings');
  },

  /** Update calibration settings */
  updateSettings: (settings: Partial<CalibrationSettings>): Promise<void> => {
    return ipcRenderer.invoke('calibration:update-settings', settings);
  },

  // ============================================================================
  // Workspace Operations
  // ============================================================================

  /** Get workspace for a printer context */
  getWorkspace: (contextId: string): Promise<BedWorkspace | null> => {
    return ipcRenderer.invoke('calibration:get-workspace', contextId);
  },

  /** Create a new workspace */
  createWorkspace: (contextId: string): Promise<BedWorkspace> => {
    return ipcRenderer.invoke('calibration:create-workspace', contextId);
  },

  /** Clear workspace for a context */
  clearWorkspace: (contextId: string): Promise<void> => {
    return ipcRenderer.invoke('calibration:clear-workspace', contextId);
  },

  // ============================================================================
  // File Operations
  // ============================================================================

  /** Open file dialog to select config file */
  openConfigFile: (): Promise<{ content: string; filePath: string } | null> => {
    return ipcRenderer.invoke('calibration:open-config-file');
  },

  /** Open file dialog to select shaper CSV */
  openShaperCSVFile: (): Promise<{ content: string; filePath: string } | null> => {
    return ipcRenderer.invoke('calibration:open-shaper-csv-file');
  },

  /** Open file dialog to select SSH private key */
  openSSHKeyFile: (): Promise<{ filePath: string } | null> => {
    return ipcRenderer.invoke('calibration:open-ssh-key-file');
  },

  /** Load mesh data from config content */
  loadConfig: (contextId: string, configContent: string, profileName?: string): Promise<BedWorkspace | null> => {
    return ipcRenderer.invoke('calibration:load-config', contextId, configContent, profileName);
  },

  /** Get available mesh profiles from config content */
  getProfiles: (configContent: string): Promise<string[]> => {
    return ipcRenderer.invoke('calibration:get-profiles', configContent);
  },

  /** Parse config and return mesh data */
  parseMesh: (configContent: string, profileName?: string): Promise<MeshData | null> => {
    return ipcRenderer.invoke('calibration:parse-mesh', configContent, profileName);
  },

  // ============================================================================
  // Analysis Operations
  // ============================================================================

  /** Analyze mesh data in workspace */
  analyzeMesh: (contextId: string): Promise<AnalysisResult | null> => {
    return ipcRenderer.invoke('calibration:analyze-mesh', contextId);
  },

  /** Compute full calibration workflow */
  computeWorkflow: (contextId: string): Promise<WorkflowData | null> => {
    return ipcRenderer.invoke('calibration:compute-workflow', contextId);
  },

  /** Analyze input shaper data */
  analyzeShaper: (csvContent: string, axis: 'x' | 'y'): Promise<AxisCalibration> => {
    return ipcRenderer.invoke('calibration:analyze-shaper', csvContent, axis);
  },

  /** Generate Klipper config lines for shaper */
  generateShaperConfig: (axis: 'x' | 'y', result: ShaperResult): Promise<string[]> => {
    return ipcRenderer.invoke('calibration:generate-shaper-config', axis, result);
  },

  // ============================================================================
  // History Operations
  // ============================================================================

  /** Get calibration history for a printer */
  getHistory: (contextId: string): Promise<CalibrationHistoryEntry[]> => {
    return ipcRenderer.invoke('calibration:get-history', contextId);
  },

  /** Add a calibration history entry */
  addHistory: (
    contextId: string,
    type: 'bed_level' | 'input_shaper',
    summary: string,
    data: unknown
  ): Promise<void> => {
    return ipcRenderer.invoke('calibration:add-history', contextId, type, summary, data);
  },

  /** Clear calibration history */
  clearHistory: (contextId: string): Promise<void> => {
    return ipcRenderer.invoke('calibration:clear-history', contextId);
  },

  /** Save recommended shaper result */
  saveShaperResult: (contextId: string, axis: 'x' | 'y', result: ShaperResult): Promise<void> => {
    return ipcRenderer.invoke('calibration:save-shaper-result', contextId, axis, result);
  },

  // ============================================================================
  // Export Operations
  // ============================================================================

  /** Export calibration report */
  exportReport: (contextId: string, format: 'json' | 'csv' | 'png' | 'pdf'): Promise<string | Uint8Array> => {
    return ipcRenderer.invoke('calibration:export-report', contextId, format);
  },

  /** Save exported report to file */
  saveReport: (contextId: string, format: 'json' | 'csv' | 'png' | 'pdf'): Promise<string | null> => {
    return ipcRenderer.invoke('calibration:save-report', contextId, format);
  },

  /** Save printer configuration content to file */
  saveConfig: (content: string, defaultName?: string): Promise<string | null> => {
    return ipcRenderer.invoke('calibration:save-config', content, defaultName);
  },

  // ============================================================================
  // SSH Operations
  // ============================================================================

  /** Connect to printer via SSH */
  sshConnect: (contextId: string, config: SSHConnectionConfig): Promise<void> => {
    return ipcRenderer.invoke('calibration:ssh-connect', contextId, config);
  },

  /** Disconnect SSH */
  sshDisconnect: (contextId: string): Promise<void> => {
    return ipcRenderer.invoke('calibration:ssh-disconnect', contextId);
  },

  /** Get SSH connection status */
  sshStatus: (contextId: string): Promise<SSHConnectionStatus> => {
    return ipcRenderer.invoke('calibration:ssh-status', contextId);
  },

  /** Check if SSH is connected */
  sshIsConnected: (contextId: string): Promise<boolean> => {
    return ipcRenderer.invoke('calibration:ssh-is-connected', contextId);
  },

  /** Execute command over SSH */
  sshExecute: (contextId: string, command: string): Promise<CommandResult> => {
    return ipcRenderer.invoke('calibration:ssh-execute', contextId, command);
  },

  /** Fetch printer.cfg via SSH */
  sshFetchConfig: (contextId: string, remotePath?: string): Promise<string> => {
    return ipcRenderer.invoke('calibration:ssh-fetch-config', contextId, remotePath);
  },

  /** Fetch input shaper CSV via SSH */
  sshFetchShaper: (contextId: string, axis: 'x' | 'y'): Promise<string> => {
    return ipcRenderer.invoke('calibration:ssh-fetch-shaper', contextId, axis);
  },

  /** Upload config via SSH */
  sshUploadConfig: (contextId: string, content: string, remotePath?: string): Promise<TransferResult> => {
    return ipcRenderer.invoke('calibration:ssh-upload-config', contextId, content, remotePath);
  },

  /** Download file via SSH */
  sshDownloadFile: (contextId: string, remotePath: string, localPath?: string): Promise<TransferResult> => {
    return ipcRenderer.invoke('calibration:ssh-download-file', contextId, remotePath, localPath);
  },

  /** Upload file via SSH */
  sshUploadFile: (contextId: string, localPath: string, remotePath: string): Promise<TransferResult> => {
    return ipcRenderer.invoke('calibration:ssh-upload-file', contextId, localPath, remotePath);
  },

  /** List remote directory */
  sshListDir: (contextId: string, remotePath: string): Promise<string[]> => {
    return ipcRenderer.invoke('calibration:ssh-list-dir', contextId, remotePath);
  },

  /** Check if remote file exists */
  sshFileExists: (contextId: string, remotePath: string): Promise<boolean> => {
    return ipcRenderer.invoke('calibration:ssh-file-exists', contextId, remotePath);
  },

  /** Get stored SSH config for this printer */
  getSSHConfig: (contextId: string): Promise<StoredSSHConfig | null> => {
    return ipcRenderer.invoke('calibration:get-ssh-config', contextId);
  },

  /** Save SSH config for this printer */
  saveSSHConfig: (contextId: string, config: StoredSSHConfig): Promise<void> => {
    return ipcRenderer.invoke('calibration:save-ssh-config', contextId, config);
  },

  /** Clear saved SSH config */
  clearSSHConfig: (contextId: string): Promise<void> => {
    return ipcRenderer.invoke('calibration:clear-ssh-config', contextId);
  },
};

/**
 * Window API for dialog control.
 */
const windowAPI = {
  /** Close the dialog window */
  close: (): void => {
    ipcRenderer.send('close-current-window');
  },

  /** Get current printer context ID */
  getContextId: (): Promise<string | null> => {
    return getActivePrinterContext().then((active) => (typeof active?.id === 'string' ? active.id : null));
  },

  /** Get printer context info */
  getContextInfo: (): Promise<{ name: string; ip: string } | null> => {
    return getActivePrinterContext().then((active) => {
      if (!active) {
        return null;
      }

      const name = typeof active.name === 'string' ? active.name : '';
      const ip = typeof active.ip === 'string' ? active.ip : '';

      if (!name && !ip) {
        return null;
      }

      return { name, ip };
    });
  },
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld('calibration', calibrationAPI);
contextBridge.exposeInMainWorld('windowAPI', windowAPI);

// Type declarations for the exposed APIs
declare global {
  interface Window {
    calibration: typeof calibrationAPI;
    windowAPI: typeof windowAPI;
  }
}
