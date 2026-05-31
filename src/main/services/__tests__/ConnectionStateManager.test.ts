/**
 * @fileoverview Tests for ConnectionStateManager state transitions, client cleanup,
 * and PrinterContextManager updates during connection changes.
 */

/**
 * @fileoverview Jest coverage for `ConnectionStateManager`.
 *
 * Verifies connection lifecycle transitions, cancellation/reset behavior, and
 * the events exposed to dialog and connection orchestration layers.
 */
import { EventEmitter } from 'events';

const mockContextManager = Object.assign(new EventEmitter(), {
  updateConnectionState: jest.fn(),
});

jest.mock('../../managers/PrinterContextManager.js', () => ({
  getPrinterContextManager: () => mockContextManager,
}));

import { ConnectionStateManager } from '../ConnectionStateManager.js';

describe('ConnectionStateManager', () => {
  const primaryClient = { dispose: jest.fn() } as any;
  const secondaryClient = { dispose: jest.fn() } as any;
  const printerDetails = {
    Name: 'Printer One',
    IPAddress: '192.168.1.25',
    ClientType: '5m',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-04T10:00:00.000Z'));
    (ConnectionStateManager as any).instance = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('tracks connecting and connected state per context and preserves the original connection time', () => {
    const manager = ConnectionStateManager.getInstance();
    const eventSpy = jest.fn();
    manager.on('state-changed', eventSpy);

    manager.setConnecting('context-1', {
      name: 'Printer One',
      ipAddress: '192.168.1.25',
    });

    expect(mockContextManager.updateConnectionState).toHaveBeenCalledWith('context-1', 'connecting');
    expect(eventSpy).toHaveBeenCalledWith({
      contextId: 'context-1',
      state: 'connecting',
      printer: {
        name: 'Printer One',
        ipAddress: '192.168.1.25',
      },
    });

    const connectingState = manager.getState('context-1');
    expect(connectingState.isConnected).toBe(false);
    const initialConnectedAt = connectingState.lastConnected;

    jest.setSystemTime(new Date('2026-03-04T10:00:30.000Z'));
    manager.setConnected('context-1', printerDetails, primaryClient, secondaryClient);

    const connectedState = manager.getState('context-1');
    expect(mockContextManager.updateConnectionState).toHaveBeenLastCalledWith('context-1', 'connected');
    expect(connectedState).toEqual({
      isConnected: true,
      printerName: 'Printer One',
      ipAddress: '192.168.1.25',
      clientType: '5m',
      isPrinting: false,
      lastConnected: initialConnectedAt,
    });
    expect(manager.isConnected('context-1')).toBe(true);
    expect(manager.getPrimaryClient('context-1')).toBe(primaryClient);
    expect(manager.getSecondaryClient('context-1')).toBe(secondaryClient);
    expect(manager.getCurrentDetails('context-1')).toBe(printerDetails);
    expect(manager.isDualAPI('context-1')).toBe(true);
    expect(manager.getConnectionStatus('context-1')).toBe('Connected to Printer One');
  });

  it('reports durations and clears contexts after client disposal', async () => {
    const manager = ConnectionStateManager.getInstance();
    const disposedSpy = jest.fn();
    manager.on('clients-disposed', disposedSpy);

    manager.setConnecting('context-1', {
      name: 'Printer One',
      ipAddress: '192.168.1.25',
    });
    manager.setConnected('context-1', printerDetails, primaryClient, secondaryClient);

    jest.setSystemTime(new Date('2026-03-04T10:01:45.000Z'));
    expect(manager.getConnectionDuration('context-1')).toBe(105);

    await manager.clearContext('context-1');

    expect(primaryClient.dispose).toHaveBeenCalled();
    expect(secondaryClient.dispose).toHaveBeenCalled();
    expect(disposedSpy).toHaveBeenCalledWith({ contextId: 'context-1' });
    expect(mockContextManager.updateConnectionState).toHaveBeenLastCalledWith('context-1', 'disconnected');
    expect(manager.isConnected('context-1')).toBe(false);
    expect(manager.getConnectionStatus('context-1')).toBe('Disconnected');
  });

  it('returns disconnected defaults for unknown contexts and clears all contexts', async () => {
    const manager = ConnectionStateManager.getInstance();

    expect(manager.getState('missing-context').isConnected).toBe(false);
    expect(manager.getConnectionDuration('missing-context')).toBe(0);
    expect(manager.getConnectionStatus('missing-context')).toBe('Disconnected');

    manager.setConnected('context-1', printerDetails, primaryClient);
    manager.setConnected('context-2', { ...printerDetails, Name: 'Printer Two' }, { dispose: jest.fn() } as any);

    await manager.clearAll();

    expect(manager.isConnected('context-1')).toBe(false);
    expect(manager.isConnected('context-2')).toBe(false);
  });
});
