/**
 * @fileoverview Express router composition for the WebUI HTTP API.
 *
 * Wires together modular route registrations so each domain (status, control, jobs, etc.) can
 * stay focused and reusable. Shared manager dependencies are resolved once and passed into the
 * registration helpers, enabling multi-context REST support and easier future maintenance.
 */

import { Router } from 'express';
import { getConfigManager } from '../../managers/ConfigManager.js';
import { getPrinterConnectionManager } from '../../managers/ConnectionFlowManager.js';
import { getPrinterBackendManager } from '../../managers/PrinterBackendManager.js';
import { getPrinterContextManager } from '../../managers/PrinterContextManager.js';
import { getSpoolmanIntegrationService } from '../../services/SpoolmanIntegrationService.js';
import { registerCalibrationRoutes } from './routes/calibration-routes.js';
import { registerCameraRoutes } from './routes/camera-routes.js';
import { registerContextRoutes } from './routes/context-routes.js';
import { registerDebugRoutes } from './routes/debug-routes.js';
import { registerFiltrationRoutes } from './routes/filtration-routes.js';
import { registerJobRoutes } from './routes/job-routes.js';
import { registerPrinterControlRoutes } from './routes/printer-control-routes.js';
import { registerPrinterStatusRoutes } from './routes/printer-status-routes.js';
import type { RouteDependencies } from './routes/route-helpers.js';
import { registerSpoolmanRoutes } from './routes/spoolman-routes.js';
import { registerTemperatureRoutes } from './routes/temperature-routes.js';
import { registerThemeRoutes } from './routes/theme-routes.js';

export function buildRouteDependencies(): RouteDependencies {
  return {
    backendManager: getPrinterBackendManager(),
    connectionManager: getPrinterConnectionManager(),
    contextManager: getPrinterContextManager(),
    configManager: getConfigManager(),
    spoolmanService: getSpoolmanIntegrationService(),
  };
}

export function createAPIRoutes(deps: RouteDependencies = buildRouteDependencies()): Router {
  const router = Router();

  registerPrinterStatusRoutes(router, deps);
  registerPrinterControlRoutes(router, deps);
  registerTemperatureRoutes(router, deps);
  registerFiltrationRoutes(router, deps);
  registerJobRoutes(router, deps);
  registerCameraRoutes(router, deps);
  registerCalibrationRoutes(router, deps);
  registerContextRoutes(router, deps);
  registerThemeRoutes(router, deps);
  registerSpoolmanRoutes(router, deps);
  registerDebugRoutes(router);

  return router;
}
