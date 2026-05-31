/**
 * @fileoverview Guarded IPC hooks used exclusively by live hardware E2E coverage.
 *
 * Exposes narrow Discord-notification trigger surfaces so Playwright can exercise the
 * real notification pipeline without waiting on timers or issuing any printer control
 * commands. These handlers are only registered when FFUI_E2E_HARDWARE=1 is set.
 */

import { ipcMain } from 'electron';
import { getPrinterContextManager } from '../../managers/PrinterContextManager.js';
import { getDiscordNotificationService } from '../../services/discord/index.js';

function resolveTargetContextId(contextId?: string): string {
  if (contextId && contextId.trim().length > 0) {
    return contextId.trim();
  }

  const activeContextId = getPrinterContextManager().getActiveContextId();
  if (!activeContextId) {
    throw new Error('No active printer context');
  }

  return activeContextId;
}

export function registerE2EHandlers(): void {
  if (process.env.FFUI_E2E_HARDWARE !== '1') {
    return;
  }

  ipcMain.handle('e2e:discord:send-current-status', async (_event, contextId?: string) => {
    const targetContextId = resolveTargetContextId(contextId);
    await getDiscordNotificationService().sendCurrentStatusNow(targetContextId);
    return {
      success: true,
      contextId: targetContextId,
    };
  });

  ipcMain.handle(
    'e2e:discord:send-print-complete',
    async (_event, payload?: { contextId?: string; fileName?: string; durationSeconds?: number }) => {
      const targetContextId = resolveTargetContextId(payload?.contextId);
      const fileName = payload?.fileName?.trim();
      if (!fileName) {
        throw new Error('fileName is required');
      }

      await getDiscordNotificationService().sendPrintCompleteNow(
        targetContextId,
        fileName,
        payload?.durationSeconds
      );

      return {
        success: true,
        contextId: targetContextId,
      };
    }
  );
}
