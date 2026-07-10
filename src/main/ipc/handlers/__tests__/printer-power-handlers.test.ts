/**
 * @fileoverview Unit tests for the remote reboot handler's pure logic.
 *
 * Covers the two trickiest, highest-risk pieces of the feature:
 *  1. Model gating — only 5M / 5M Pro / AD5X may reboot (Creator 5 / legacy
 *     rejected). Mirrored in the renderer; the main guard is defense-in-depth.
 *  2. The exact reboot command string that gets exec'd over SSH.
 *  3. dispatchRebootCommand's fire-and-forget contract: a channel drop or a
 *     hanging exec must NEVER surface as a failure (the command was accepted),
 *     and the dedicated power SSH session is always torn down afterward.
 *
 * Heavy main-process deps (SSH/connection/window singletons, electron) are
 * mocked so importing the handler module is lightweight.
 *
 * @module ipc/handlers/__tests__/printer-power-handlers.test
 */

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }));

jest.mock('../../../managers/PrinterContextManager.js', () => ({
  getPrinterContextManager: jest.fn(),
}));
jest.mock('../../../services/MultiContextPollingCoordinator.js', () => ({
  getMultiContextPollingCoordinator: jest.fn(),
}));
jest.mock('../../../services/calibration/ssh/SSHConnectionManager.js', () => ({
  getSSHConnectionManager: jest.fn(),
  SSHConnectionManager: class {},
}));
jest.mock('../../../services/SSHSettingsService.js', () => ({
  getSSHSettingsService: jest.fn(),
}));
jest.mock('../../../windows/WindowManager.js', () => ({ getWindowManager: jest.fn() }));

jest.mock('../../../services/Go2rtcService.js', () => ({
  getGo2rtcService: jest.fn(),
}));

// The WebSocketManager import chain pulls in WebUIManager -> ConnectionFlow ->
// window factories -> electron at module load, so it must be mocked out.
jest.mock('../../../webui/server/WebSocketManager.js', () => ({
  getWebSocketManager: jest.fn(() => ({ broadcastRebootStatus: jest.fn() })),
}));

import type { RebootSshClient } from '../printer-power-handlers.js';
import {
  REBOOT_COMMAND,
  REBOOT_DISPATCH_TIMEOUT_MS,
  dispatchRebootCommand,
  createStablePollCounter,
  REBOOT_STABLE_POLLS_REQUIRED,
} from '../printer-power-handlers.js';
import { isRebootSupportedModel } from '../../../utils/PrinterUtils.js';
import type { PrinterModelType } from '@shared/types/printer-backend/index.js';

describe('printer-power-handlers (reboot)', () => {
  describe('isRebootSupportedModel', () => {
    it.each<[string, PrinterModelType, boolean]>([
      ['Adventurer 5M', 'adventurer-5m', true],
      ['Adventurer 5M Pro', 'adventurer-5m-pro', true],
      ['AD5X', 'ad5x', true],
      ['Creator 5', 'creator-5', false],
      ['Creator 5 Pro', 'creator-5-pro', false],
      ['Legacy', 'generic-legacy', false],
    ])('returns %j for %s', (_label, modelType, expected) => {
      expect(isRebootSupportedModel(modelType)).toBe(expected);
    });

    it('rejects undefined model types', () => {
      expect(isRebootSupportedModel(undefined)).toBe(false);
    });
  });

  describe('REBOOT_COMMAND', () => {
    it('is a backgrounded, quiet, sleep-guarded reboot subshell', () => {
      // Backgrounded (&) so the exec channel returns instantly; 2s sleep so the
      // channel closes before the printer dies; streams redirected so the
      // channel stays quiet. Changing this string breaks the fire-and-forget
      // contract, so pin it exactly.
      expect(REBOOT_COMMAND).toBe('(sleep 2; reboot) >/dev/null 2>&1 &');
    });
  });

  describe('dispatchRebootCommand', () => {
    const powerKey = 'power:ctx-1';

    function makeClient(overrides: Partial<RebootSshClient> = {}): RebootSshClient {
      return {
        executeCommand: jest.fn().mockResolvedValue({ success: true }),
        disconnect: jest.fn().mockResolvedValue(undefined),
        ...overrides,
      };
    }

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('treats a clean exec as success and tears down the session', async () => {
      const client = makeClient();
      await dispatchRebootCommand(client, powerKey);

      expect(client.executeCommand).toHaveBeenCalledWith(powerKey, REBOOT_COMMAND);
      expect(client.disconnect).toHaveBeenCalledWith(powerKey);
    });

    it('treats a connection-drop (rejection) as success', async () => {
      // The AD5X reboot SIGTERMs the SSH session, so a channel error is EXPECTED.
      const client = makeClient({
        executeCommand: jest.fn().mockRejectedValue(new Error('Channel closed')),
      });

      await expect(dispatchRebootCommand(client, powerKey)).resolves.toBeUndefined();
      expect(client.disconnect).toHaveBeenCalledWith(powerKey);
    });

    it('does not hang when the exec channel never returns', async () => {
      // A hanging exec (printer died before stream close) must time out and
      // still tear down — never surface as a failure or a stuck UI.
      const client = makeClient({
        executeCommand: jest.fn().mockReturnValue(new Promise(() => {})),
      });

      const pending = dispatchRebootCommand(client, powerKey);
      jest.advanceTimersByTime(REBOOT_DISPATCH_TIMEOUT_MS);
      await pending;

      expect(client.disconnect).toHaveBeenCalledWith(powerKey);
    });

    it('swallows disconnect errors after dispatch', async () => {
      const client = makeClient({
        disconnect: jest.fn().mockRejectedValue(new Error('already gone')),
      });

      await expect(dispatchRebootCommand(client, powerKey)).resolves.toBeUndefined();
    });
  });

  describe('createStablePollCounter', () => {
    it('requires N consecutive polls before becoming stable', () => {
      const counter = createStablePollCounter(3);

      expect(counter.isStable()).toBe(false);
      counter.recordPoll();
      expect(counter.isStable()).toBe(false);
      counter.recordPoll();
      expect(counter.isStable()).toBe(false);
      counter.recordPoll();
      expect(counter.isStable()).toBe(true);
    });

    it('recordPoll() returns the new streak length', () => {
      const counter = createStablePollCounter(3);

      expect(counter.recordPoll()).toBe(1);
      expect(counter.recordPoll()).toBe(2);
      expect(counter.recordPoll()).toBe(3);
    });

    it('reset() restarts the streak from zero (mid-recovery failure)', () => {
      const counter = createStablePollCounter(3);

      counter.recordPoll();
      counter.recordPoll();
      // Two clean polls, then the printer blips again mid-boot.
      counter.reset();

      counter.recordPoll();
      expect(counter.isStable()).toBe(false);
      counter.recordPoll();
      expect(counter.isStable()).toBe(false);
      counter.recordPoll();
      expect(counter.isStable()).toBe(true);
    });

    it('is stable on the first poll when required=1', () => {
      const counter = createStablePollCounter(1);

      expect(counter.isStable()).toBe(false);
      expect(counter.recordPoll()).toBe(1);
      expect(counter.isStable()).toBe(true);
    });

    it('stays stable past the threshold (>=, not exact equality)', () => {
      const counter = createStablePollCounter(2);

      counter.recordPoll();
      counter.recordPoll();
      counter.recordPoll();
      expect(counter.isStable()).toBe(true);
    });

    it('REBOOT_STABLE_POLLS_REQUIRED is the documented threshold (3)', () => {
      expect(REBOOT_STABLE_POLLS_REQUIRED).toBe(3);
    });
  });
});
