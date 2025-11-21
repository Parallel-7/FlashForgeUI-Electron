/**
 * @fileoverview Express router composition for the WebUI HTTP API.
 *
 * Wires together modular route registrations so each domain (status, control, jobs, etc.) can
 * stay focused and reusable. Shared manager dependencies are resolved once and passed into the
 * registration helpers, enabling multi-context REST support and easier future maintenance.
 */

import { Router } from 'express';
import { getPrinterBackendManager } from '../../managers/PrinterBackendManager';
import { getPrinterConnectionManager } from '../../managers/ConnectionFlowManager';
import { getPrinterContextManager } from '../../managers/PrinterContextManager';
import { getConfigManager } from '../../managers/ConfigManager';
import { getSpoolmanIntegrationService } from '../../services/SpoolmanIntegrationService';
import type { RouteDependencies } from './routes/route-helpers';
import { registerPrinterStatusRoutes } from './routes/printer-status-routes';
import { registerPrinterControlRoutes } from './routes/printer-control-routes';
import { registerTemperatureRoutes } from './routes/temperature-routes';
import { registerFiltrationRoutes } from './routes/filtration-routes';
import { registerJobRoutes } from './routes/job-routes';
import { registerCameraRoutes } from './routes/camera-routes';
import { registerContextRoutes } from './routes/context-routes';
import { registerThemeRoutes } from './routes/theme-routes';
import { registerSpoolmanRoutes } from './routes/spoolman-routes';

export function buildRouteDependencies(): RouteDependencies {
  return {
    backendManager: getPrinterBackendManager(),
    connectionManager: getPrinterConnectionManager(),
    contextManager: getPrinterContextManager(),
    configManager: getConfigManager(),
    spoolmanService: getSpoolmanIntegrationService()
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
  registerContextRoutes(router, deps);
  registerThemeRoutes(router, deps);
  registerSpoolmanRoutes(router, deps);

  return router;
}
