/**
 * @fileoverview Jest coverage for WebUI printer context switching.
 *
 * Tests context list loading, active-context persistence, selector wiring, and
 * the API/status requests triggered by `context-switching.js` when users swap
 * between saved printer contexts.
 */
/**
 * @fileoverview JSDOM tests for WebUI printer context switching, including API calls,
 * layout persistence, and active-context state updates.
 */

/**
 * @jest-environment jsdom
 */

const mockApiRequest = jest.fn();
const mockSendCommand = jest.fn();
const mockShowToast = jest.fn();
const mockLoadLayoutForCurrentPrinter = jest.fn();
const mockSaveCurrentLayoutSnapshot = jest.fn();
const mockSetCurrentPrinterSerial = jest.fn();
const mockSetCurrentContextId = jest.fn();

const contextById = new Map<string, unknown>();
let storedContextId: string | null = null;
const mockState = {
  authRequired: false,
  authToken: null as string | null,
};

jest.mock('../../core/Transport.js', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  sendCommand: (...args: unknown[]) => mockSendCommand(...args),
}));

jest.mock('../../core/AppState.js', () => ({
  contextById,
  DEMO_SERIAL: 'demo-layout',
  getCurrentContextId: () => storedContextId,
  setCurrentContextId: (contextId: string | null) => {
    storedContextId = contextId;
    mockSetCurrentContextId(contextId);
  },
  setCurrentPrinterSerial: (...args: unknown[]) => mockSetCurrentPrinterSerial(...args),
  state: mockState,
}));

jest.mock('../../shared/dom.js', () => {
  const actual = jest.requireActual('../../shared/dom.js');
  return {
    ...actual,
    showToast: (...args: unknown[]) => mockShowToast(...args),
  };
});

jest.mock('../layout-theme.js', () => ({
  loadLayoutForCurrentPrinter: () => mockLoadLayoutForCurrentPrinter(),
  saveCurrentLayoutSnapshot: () => mockSaveCurrentLayoutSnapshot(),
}));

import {
  fetchPrinterContexts,
  getCurrentContextId,
  initializeContextSwitching,
  setupContextEventHandlers,
  switchPrinterContext,
} from '../context-switching.js';

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('webui context switching feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contextById.clear();
    storedContextId = null;
    mockState.authRequired = false;
    mockState.authToken = null;
    document.body.innerHTML = `
      <div id="printer-selector" class="hidden"></div>
      <select id="printer-select"></select>
    `;
    initializeContextSwitching();
  });

  it('loads contexts, prefers the stored selection, and updates the printer serial', async () => {
    storedContextId = 'context-2';
    mockApiRequest.mockResolvedValue({
      success: true,
      contexts: [
        {
          id: 'context-1',
          name: 'Printer One',
          model: 'AD5M',
          ipAddress: '192.168.1.10',
          serialNumber: 'SN-1',
          isActive: true,
        },
        {
          id: 'context-2',
          name: 'Printer Two',
          model: 'AD5X',
          ipAddress: '192.168.1.11',
          serialNumber: 'SN-2',
          isActive: false,
        },
      ],
      activeContextId: 'context-1',
    });

    await fetchPrinterContexts();

    const select = document.getElementById('printer-select') as HTMLSelectElement;
    expect(contextById.size).toBe(2);
    expect(select.options).toHaveLength(2);
    expect(select.value).toBe('context-2');
    expect(getCurrentContextId()).toBe('context-2');
    expect(mockSetCurrentPrinterSerial).toHaveBeenCalledWith('SN-2');
    expect(mockLoadLayoutForCurrentPrinter).toHaveBeenCalled();
    expect(document.getElementById('printer-selector')?.classList.contains('hidden')).toBe(false);
  });

  it('falls back to the demo serial when no contexts are available', async () => {
    mockApiRequest.mockResolvedValue({
      success: true,
      contexts: [],
      activeContextId: '',
    });

    await fetchPrinterContexts();

    expect(mockSetCurrentPrinterSerial).toHaveBeenCalledWith('demo-layout');
  });

  it('posts context switches, refreshes contexts, and requests a status update', async () => {
    const onContextSwitched = jest.fn();
    initializeContextSwitching({ onContextSwitched });
    mockState.authRequired = true;
    mockState.authToken = 'token-123';
    mockApiRequest
      .mockResolvedValueOnce({
        success: true,
        message: 'Switched printer',
      })
      .mockResolvedValueOnce({
        success: true,
        contexts: [
          {
            id: 'context-2',
            name: 'Printer Two',
            model: 'AD5X',
            ipAddress: '192.168.1.11',
            serialNumber: 'SN-2',
            isActive: true,
          },
        ],
        activeContextId: 'context-2',
      });

    await switchPrinterContext('context-2');

    expect(mockSaveCurrentLayoutSnapshot).toHaveBeenCalled();
    expect(mockApiRequest).toHaveBeenNthCalledWith(
      1,
      '/api/contexts/switch',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(mockShowToast).toHaveBeenCalledWith('Switched printer', 'success');
    expect(onContextSwitched).toHaveBeenCalledWith('context-2');
    expect(mockSendCommand).toHaveBeenCalledWith({ command: 'REQUEST_STATUS' });
  });

  it('wires selector change events to context switches', async () => {
    mockApiRequest
      .mockResolvedValueOnce({
        success: true,
        message: 'Switched printer',
      })
      .mockResolvedValueOnce({
        success: true,
        contexts: [
          {
            id: 'context-1',
            name: 'Printer One',
            model: 'AD5M',
            ipAddress: '192.168.1.10',
            serialNumber: 'SN-1',
            isActive: false,
          },
          {
            id: 'context-2',
            name: 'Printer Two',
            model: 'AD5X',
            ipAddress: '192.168.1.11',
            serialNumber: 'SN-2',
            isActive: true,
          },
        ],
        activeContextId: 'context-2',
      });

    setupContextEventHandlers();

    const select = document.getElementById('printer-select') as HTMLSelectElement;
    select.innerHTML = `
      <option value="context-1">Printer One</option>
      <option value="context-2">Printer Two</option>
    `;
    select.value = 'context-2';
    select.dispatchEvent(new Event('change'));
    await flushAsyncWork();

    expect(mockSetCurrentContextId).toHaveBeenCalledWith('context-2');
    expect(mockApiRequest).toHaveBeenCalledWith(
      '/api/contexts/switch',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('refuses to switch contexts when authentication is required but missing', async () => {
    mockState.authRequired = true;
    mockState.authToken = null;

    await switchPrinterContext('context-1');

    expect(mockShowToast).toHaveBeenCalledWith('Not authenticated', 'error');
    expect(mockApiRequest).not.toHaveBeenCalled();
  });
});
