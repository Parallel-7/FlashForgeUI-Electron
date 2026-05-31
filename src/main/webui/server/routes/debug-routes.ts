/**
 * @fileoverview Debug log routes for WebUI - provides endpoints for downloading debug and network logs.
 *
 * Endpoints:
 * - GET /api/debug/logs - List available debug log files
 * - GET /api/debug/logs/:filename - Download a specific debug log file
 * - GET /api/debug/network-logs - List available network debug log files
 * - GET /api/debug/network-logs/:filename - Download a specific network log file
 * - GET /api/debug/status - Get current debug mode status
 */

import type { Response, Router } from 'express';
import * as path from 'path';

import { getConfigManager } from '../../../managers/ConfigManager.js';
import { getDebugLogService } from '../../../services/DebugLogService.js';
import type { AuthenticatedRequest } from '../auth-middleware.js';

interface DebugLogInfo {
  filename: string;
  isCurrent: boolean;
}

interface DebugStatusResponse {
  success: true;
  // Effective state (config OR CLI override)
  debugEnabled: boolean;
  networkEnabled: boolean;
  // Config values (for transparency)
  configDebugMode: boolean;
  configNetworkLogging: boolean;
  // Log file info
  logsDirectory: string;
  currentDebugLog: string | null;
  currentNetworkLog: string | null;
}

export function registerDebugRoutes(router: Router): void {
  const debugLogService = getDebugLogService();
  const configManager = getConfigManager();

  /**
   * GET /api/debug/status
   * Returns current debug mode status and active log paths
   * Reports effective state (config OR CLI override) and config values for transparency
   */
  router.get('/debug/status', (_req: AuthenticatedRequest, res: Response) => {
    const config = configManager.getConfig();

    const response: DebugStatusResponse = {
      success: true,
      // Effective state from DebugLogService (accounts for CLI flags)
      debugEnabled: debugLogService.isDebugEnabled(),
      networkEnabled: debugLogService.isNetworkEnabled(),
      // Config values for transparency
      configDebugMode: config.DebugMode,
      configNetworkLogging: config.DebugNetworkLogging,
      // Log file info
      logsDirectory: debugLogService.getLogsDirectory(),
      currentDebugLog: debugLogService.getDebugLogPath(),
      currentNetworkLog: debugLogService.getNetworkLogPath(),
    };

    return res.json(response);
  });

  /**
   * GET /api/debug/logs
   * Lists all available debug log files
   */
  router.get('/debug/logs', (_req: AuthenticatedRequest, res: Response) => {
    const logFiles = debugLogService.listDebugLogs();
    const currentLogPath = debugLogService.getDebugLogPath();
    const currentLogFilename = currentLogPath ? path.basename(currentLogPath) : null;

    const logs: DebugLogInfo[] = logFiles.map((filename) => ({
      filename,
      isCurrent: filename === currentLogFilename,
    }));

    return res.json({
      success: true,
      logs,
      count: logs.length,
    });
  });

  /**
   * GET /api/debug/logs/:filename
   * Downloads a specific debug log file
   */
  router.get('/debug/logs/:filename', (req: AuthenticatedRequest, res: Response) => {
    const { filename } = req.params;

    // Security: validate filename format
    if (!filename || !/^debug-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/.test(filename)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename format',
      });
    }

    const content = debugLogService.readLogFile(filename);

    if (content === null) {
      return res.status(404).json({
        success: false,
        error: 'Log file not found',
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(content);
  });

  /**
   * GET /api/debug/network-logs
   * Lists all available network debug log files
   */
  router.get('/debug/network-logs', (_req: AuthenticatedRequest, res: Response) => {
    const logFiles = debugLogService.listNetworkLogs();
    const currentLogPath = debugLogService.getNetworkLogPath();
    const currentLogFilename = currentLogPath ? path.basename(currentLogPath) : null;

    const logs: DebugLogInfo[] = logFiles.map((filename) => ({
      filename,
      isCurrent: filename === currentLogFilename,
    }));

    return res.json({
      success: true,
      logs,
      count: logs.length,
    });
  });

  /**
   * GET /api/debug/network-logs/:filename
   * Downloads a specific network debug log file
   */
  router.get('/debug/network-logs/:filename', (req: AuthenticatedRequest, res: Response) => {
    const { filename } = req.params;

    // Security: validate filename format
    if (!filename || !/^network-debug-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/.test(filename)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename format',
      });
    }

    const content = debugLogService.readLogFile(filename);

    if (content === null) {
      return res.status(404).json({
        success: false,
        error: 'Log file not found',
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(content);
  });

  /**
   * GET /api/debug/latest
   * Downloads the most recent debug log file (convenience endpoint)
   */
  router.get('/debug/latest', (_req: AuthenticatedRequest, res: Response) => {
    const latestLog = debugLogService.getMostRecentDebugLog();

    if (!latestLog) {
      return res.status(404).json({
        success: false,
        error: 'No debug logs available',
      });
    }

    const filename = path.basename(latestLog);
    const content = debugLogService.readLogFile(filename);

    if (content === null) {
      return res.status(404).json({
        success: false,
        error: 'Failed to read log file',
      });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(content);
  });

  /**
   * GET /api/debug/network-latest
   * Downloads the most recent network debug log file (convenience endpoint)
   */
  router.get('/debug/network-latest', (_req: AuthenticatedRequest, res: Response) => {
    const latestLog = debugLogService.getMostRecentNetworkLog();

    if (!latestLog) {
      return res.status(404).json({
        success: false,
        error: 'No network debug logs available',
      });
    }

    const filename = path.basename(latestLog);
    const content = debugLogService.readLogFile(filename);

    if (content === null) {
      return res.status(404).json({
        success: false,
        error: 'Failed to read log file',
      });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(content);
  });
}
