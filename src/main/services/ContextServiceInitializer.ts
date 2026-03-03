/**
 * @fileoverview Shared per-context service initialization for polling-driven runtime services.
 *
 * Creates and wires the monitor/coordinator stack that depends on an active polling service:
 * - PrintStateMonitor
 * - TemperatureMonitoringService
 * - SpoolmanUsageTracker
 * - PrinterNotificationCoordinator
 * - DiscordNotificationService context registration and event-driven monitor wiring
 *
 * This helper keeps GUI and headless initialization paths aligned without changing
 * the underlying service responsibilities.
 *
 * @module services/ContextServiceInitializer
 */

import { getPrinterContextManager } from '../managers/PrinterContextManager.js';
import { getDiscordNotificationService } from './discord/index.js';
import { getMultiContextNotificationCoordinator } from './MultiContextNotificationCoordinator.js';
import { getMultiContextPrintStateMonitor } from './MultiContextPrintStateMonitor.js';
import { getMultiContextSpoolmanTracker } from './MultiContextSpoolmanTracker.js';
import { getMultiContextTemperatureMonitor } from './MultiContextTemperatureMonitor.js';

/**
 * Create the runtime services needed for a connected printer context.
 *
 * @param contextId - Context ID with an initialized backend and polling service
 */
export function initializeContextServices(contextId: string): void {
  const contextManager = getPrinterContextManager();
  const context = contextManager.getContext(contextId);
  if (!context) {
    throw new Error(`Context ${contextId} not found`);
  }

  const pollingService = context.pollingService;
  if (!pollingService) {
    throw new Error(`Polling service not available for context ${contextId}`);
  }

  const printStateMonitor = getMultiContextPrintStateMonitor();
  printStateMonitor.createMonitorForContext(contextId, pollingService);
  const stateMonitor = printStateMonitor.getMonitor(contextId);
  if (!stateMonitor) {
    throw new Error(`Failed to create print state monitor for context ${contextId}`);
  }

  const temperatureMonitor = getMultiContextTemperatureMonitor();
  temperatureMonitor.createMonitorForContext(contextId, pollingService, stateMonitor);
  const contextTemperatureMonitor = temperatureMonitor.getMonitor(contextId);
  if (!contextTemperatureMonitor) {
    throw new Error(`Failed to create temperature monitor for context ${contextId}`);
  }

  const spoolmanTracker = getMultiContextSpoolmanTracker();
  spoolmanTracker.createTrackerForContext(contextId, stateMonitor);

  const notificationCoordinator = getMultiContextNotificationCoordinator();
  notificationCoordinator.createCoordinatorForContext(contextId, pollingService, stateMonitor);
  const coordinator = notificationCoordinator.getCoordinator(contextId);
  coordinator?.setTemperatureMonitor(contextTemperatureMonitor);

  const discordService = getDiscordNotificationService();
  discordService.registerContext(contextId);
  discordService.attachContextMonitors(contextId, stateMonitor, contextTemperatureMonitor);
}
