/**
 * @fileoverview Calibration API route registrations for the WebUI server.
 *
 * Provides headless access to calibration workflows, analysis, history, reports,
 * and SSH helpers so the WebUI can mirror the desktop dialog functionality.
 */

import type { CalibrationSettings, ShaperResult } from '@shared/types/calibration.js';
import type { Response, Router } from 'express';
import { getCalibrationManager } from '../../../managers/CalibrationManager.js';
import { getPrinterContextManager } from '../../../managers/PrinterContextManager.js';
import { getSSHConnectionManager, SCPFileTransfer } from '../../../services/calibration/ssh/index.js';
import { getSSHSettingsService } from '../../../services/SSHSettingsService.js';
import { toAppError } from '../../../utils/error.utils.js';
import type { AuthenticatedRequest } from '../auth-middleware.js';
import { type RouteDependencies, resolveContext, sendErrorResponse } from './route-helpers.js';

/**
 * Resolve a context id to the printer's serial number and IP for SSH purposes.
 */
function resolveSshTarget(contextId: string): { serialNumber: string; host: string } | null {
  const contextManager = getPrinterContextManager();
  const context = contextManager.getContext(contextId);
  if (!context) {
    return null;
  }
  return {
    serialNumber: context.printerDetails.SerialNumber,
    host: context.printerDetails.IPAddress,
  };
}

const REPORT_FORMATS = new Set(['json', 'csv', 'png', 'pdf'] as const);
type ReportFormat = 'json' | 'csv' | 'png' | 'pdf';

export function registerCalibrationRoutes(router: Router, deps: RouteDependencies): void {
  const manager = getCalibrationManager();
  void manager.initialize();

  const sshManager = getSSHConnectionManager();
  const scpTransfer = new SCPFileTransfer(sshManager);

  router.get('/calibration/settings', async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const settings = manager.getSettings();
      return res.json({ success: true, settings });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.patch('/calibration/settings', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const payload = (req.body ?? {}) as Partial<CalibrationSettings>;
      await manager.updateSettings(payload);
      return res.json({ success: true });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.get('/calibration/workspace', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const workspace = manager.getWorkspace(contextResult.contextId) ?? null;
      return res.json({ success: true, workspace });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/workspace/load', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const { configContent, profileName } = req.body as { configContent?: string; profileName?: string };
      if (!configContent) {
        return sendErrorResponse(res, 400, 'configContent is required');
      }

      const workspace = manager.loadMeshFromConfig(contextResult.contextId, configContent, profileName);
      if (!workspace) {
        return sendErrorResponse(res, 422, 'Unable to parse mesh data from config');
      }

      return res.json({ success: true, workspace });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/profiles', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { configContent } = req.body as { configContent?: string };
      if (!configContent) {
        return sendErrorResponse(res, 400, 'configContent is required');
      }

      const profiles = manager.getAvailableProfiles(configContent);
      return res.json({ success: true, profiles });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/workspace/clear', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      manager.clearWorkspace(contextResult.contextId);
      return res.json({ success: true });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/analysis', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const analysis = manager.analyzeMesh(contextResult.contextId);
      if (!analysis) {
        return sendErrorResponse(res, 404, 'No mesh data loaded');
      }

      return res.json({ success: true, analysis });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/workflow', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const workflow = manager.computeWorkflow(contextResult.contextId);
      if (!workflow) {
        return sendErrorResponse(res, 404, 'No mesh data loaded');
      }

      const workspace = manager.getWorkspace(contextResult.contextId);
      if (workspace?.meshData && workspace.analysis) {
        await manager.saveLastBedMesh(contextResult.contextId, workspace.meshData.matrix, workspace.analysis);
      }

      return res.json({ success: true, workflow });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.get('/calibration/history', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const history = await manager.getHistory(contextResult.contextId);
      return res.json({ success: true, history });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/history', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const { type, summary, data } = req.body as {
        type?: 'bed_level' | 'input_shaper';
        summary?: string;
        data?: unknown;
      };
      if (!type || !summary) {
        return sendErrorResponse(res, 400, 'type and summary are required');
      }

      await manager.addHistoryEntry(contextResult.contextId, type, summary, data);
      return res.json({ success: true });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.delete('/calibration/history', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      await manager.clearHistory(contextResult.contextId);
      return res.json({ success: true });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.get('/calibration/report', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const formatRaw = typeof req.query?.format === 'string' ? req.query.format : 'json';
      const format = REPORT_FORMATS.has(formatRaw as ReportFormat) ? (formatRaw as ReportFormat) : 'json';

      const report = await manager.exportReport(contextResult.contextId, format);
      return sendReportPayload(res, report, format);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/report', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const formatRaw = (req.body as { format?: string }).format ?? 'json';
      const format = REPORT_FORMATS.has(formatRaw as ReportFormat) ? (formatRaw as ReportFormat) : 'json';

      const report = await manager.exportReport(contextResult.contextId, format);
      return sendReportPayload(res, report, format);
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/shaper/analyze', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { csvContent, axis } = req.body as { csvContent?: string; axis?: 'x' | 'y' };
      if (!csvContent || (axis !== 'x' && axis !== 'y')) {
        return sendErrorResponse(res, 400, 'csvContent and axis are required');
      }

      const { ShaperAnalyzer } = await import('../../../services/calibration/shaper/index.js');
      const analyzer = new ShaperAnalyzer();
      const calibration = analyzer.analyzeAxis(csvContent, axis);

      return res.json({ success: true, calibration });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.get('/calibration/shaper/definitions', async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { getAllShaperDefinitions } = await import('../../../services/calibration/shaper/index.js');
      const definitions = getAllShaperDefinitions();
      return res.json({ success: true, definitions });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/shaper/config', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { axis, result } = req.body as { axis?: 'x' | 'y'; result?: ShaperResult };
      if (!axis || !result) {
        return sendErrorResponse(res, 400, 'axis and result are required');
      }

      const { ShaperAnalyzer } = await import('../../../services/calibration/shaper/index.js');
      const analyzer = new ShaperAnalyzer();
      const lines = analyzer.generateKlipperConfig(axis, result);
      return res.json({ success: true, lines });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/shaper/save', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const { axis, result } = req.body as { axis?: 'x' | 'y'; result?: ShaperResult };
      if (!axis || !result) {
        return sendErrorResponse(res, 400, 'axis and result are required');
      }

      await manager.saveShaperResult(contextResult.contextId, axis, result);
      return res.json({ success: true });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.get('/calibration/ssh/config', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const data = await manager.getPrinterData(contextResult.contextId);
      const target = resolveSshTarget(contextResult.contextId);
      if (!target) {
        return res.json({ success: true, config: { configPath: data.sshConfigPath } });
      }

      const ssh = await getSSHSettingsService().getSettings(target.serialNumber);
      return res.json({
        success: true,
        config: {
          host: target.host,
          port: ssh.port,
          username: ssh.username,
          keyPath: ssh.keyPath,
          isCustom: ssh.isCustom,
          configPath: data.sshConfigPath,
        },
      });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/ssh/config', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const config = (req.body ?? {}) as {
        port?: number;
        username?: string;
        password?: string;
        keyPath?: string;
        configPath?: string;
      };

      const target = resolveSshTarget(contextResult.contextId);
      if (
        target &&
        (config.username !== undefined ||
          config.password !== undefined ||
          config.port !== undefined ||
          config.keyPath !== undefined)
      ) {
        await getSSHSettingsService().updateSettings(target.serialNumber, {
          username: config.username,
          password: config.password,
          port: config.port,
          keyPath: config.keyPath,
        });
      }

      if (config.configPath !== undefined) {
        const data = await manager.getPrinterData(contextResult.contextId);
        await manager.savePrinterData(contextResult.contextId, {
          ...data,
          sshConfigPath: config.configPath || undefined,
        });
      }
      return res.json({ success: true });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.delete('/calibration/ssh/config', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const target = resolveSshTarget(contextResult.contextId);
      if (target) {
        await getSSHSettingsService().resetSettings(target.serialNumber);
      }

      const data = await manager.getPrinterData(contextResult.contextId);
      const updated = {
        ...data,
        sshConfigPath: undefined,
      };
      await manager.savePrinterData(contextResult.contextId, updated);
      return res.json({ success: true });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/ssh/connect', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const target = resolveSshTarget(contextResult.contextId);
      if (!target || !target.host) {
        return sendErrorResponse(res, 409, 'No connected printer to resolve SSH settings for');
      }

      const config = await getSSHSettingsService().buildConnectionConfig(target.serialNumber, target.host);
      await sshManager.connect(contextResult.contextId, config);
      return res.json({ success: true });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/ssh/disconnect', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      await sshManager.disconnect(contextResult.contextId);
      return res.json({ success: true });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.get('/calibration/ssh/status', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const status = sshManager.getStatus(contextResult.contextId);
      return res.json({ success: true, status });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/ssh/execute', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const { command } = req.body as { command?: string };
      if (!command) {
        return sendErrorResponse(res, 400, 'command is required');
      }

      const result = await sshManager.executeCommand(contextResult.contextId, command);
      return res.json({ success: true, result });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/ssh/fetch-config', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const { remotePath } = req.body as { remotePath?: string };
      const content = await scpTransfer.fetchPrinterConfig(contextResult.contextId, remotePath);
      return res.json({ success: true, content });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/ssh/fetch-shaper', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const { axis } = req.body as { axis?: 'x' | 'y' };
      if (!axis) {
        return sendErrorResponse(res, 400, 'axis is required');
      }

      const content = await scpTransfer.fetchShaperCSV(contextResult.contextId, axis);
      return res.json({ success: true, content });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });

  router.post('/calibration/ssh/upload-config', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextResult = resolveContext(req, deps);
      if (!contextResult.success) {
        return sendErrorResponse(res, contextResult.statusCode, contextResult.error);
      }

      const { content, remotePath } = req.body as { content?: string; remotePath?: string };
      if (!content) {
        return sendErrorResponse(res, 400, 'content is required');
      }

      const result = await scpTransfer.uploadConfig(contextResult.contextId, content, remotePath);
      return res.json({ success: result.success, result });
    } catch (error) {
      const appError = toAppError(error);
      return sendErrorResponse(res, 500, appError.message);
    }
  });
}

function sendReportPayload(res: Response, payload: string | Buffer, format: ReportFormat): Response {
  if (format === 'png') {
    res.type('image/png');
    return res.send(payload);
  }
  if (format === 'pdf') {
    res.type('application/pdf');
    return res.send(payload);
  }

  if (typeof payload === 'string') {
    res.type(format === 'csv' ? 'text/csv' : 'application/json');
    return res.send(payload);
  }

  return res.send(payload);
}
