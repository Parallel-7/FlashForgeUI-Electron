/**
 * @jest-environment jsdom
 */

/**
 * @fileoverview Jest coverage for the WebUI Spoolman feature module.
 *
 * Exercises config loading, active spool refresh, search fallback behavior,
 * modal rendering, and spool selection flows coordinated by `spoolman.js`.
 */
/**
 * @fileoverview JSDOM tests for WebUI Spoolman helpers covering config refresh,
 * active-spool updates, and panel state synchronization.
 */

const mockApiRequest = jest.fn();
const mockShowToast = jest.fn();
const mockUpdateSpoolmanPanelState = jest.fn();
const mockApplySettings = jest.fn();
const mockRefreshSettingsUI = jest.fn();
const mockGetCurrentContextId = jest.fn().mockReturnValue('context-1');

const mockState = {
  authRequired: false,
  authToken: null as string | null,
  spoolmanConfig: null as any,
  activeSpool: null as any,
  availableSpools: [] as any[],
};
const mockSettings = {
  visibleComponents: ['spoolman-tracker'],
  editMode: false,
};

jest.mock('../../core/AppState.js', () => ({
  getCurrentSettings: () => mockSettings,
  state: mockState,
}));

jest.mock('../../core/Transport.js', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

jest.mock('../../shared/dom.js', () => {
  const actual = jest.requireActual('../../shared/dom.js');
  return {
    ...actual,
    showToast: (...args: unknown[]) => mockShowToast(...args),
  };
});

jest.mock('../../ui/panels.js', () => ({
  updateSpoolmanPanelState: () => mockUpdateSpoolmanPanelState(),
}));

jest.mock('../context-switching.js', () => ({
  getCurrentContextId: () => mockGetCurrentContextId(),
}));

jest.mock('../layout-theme.js', () => ({
  applySettings: (...args: unknown[]) => mockApplySettings(...args),
  refreshSettingsUI: (...args: unknown[]) => mockRefreshSettingsUI(...args),
}));

import { fetchSpools, loadSpoolmanConfig, openSpoolSelectionModal, renderSpoolList, selectSpool } from '../spoolman.js';

describe('webui spoolman feature', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    mockState.authRequired = false;
    mockState.authToken = null;
    mockState.spoolmanConfig = null;
    mockState.activeSpool = null;
    mockState.availableSpools = [];
    mockGetCurrentContextId.mockReturnValue('context-1');

    document.body.innerHTML = `
      <div id="spoolman-modal" class="hidden"></div>
      <input id="spoolman-search" />
      <div id="spoolman-loading" class="hidden"></div>
      <div id="spoolman-no-results" class="hidden"></div>
      <div id="spoolman-spool-list"></div>
    `;
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  it('loads spoolman config, fetches the active spool, and refreshes the UI state', async () => {
    mockApiRequest
      .mockResolvedValueOnce({
        success: true,
        enabled: true,
        disabledReason: null,
        serverUrl: 'http://spoolman.local',
        updateMode: 'weight',
        contextId: 'context-1',
      })
      .mockResolvedValueOnce({
        success: true,
        spool: {
          id: 101,
          name: 'PLA',
          vendor: 'Polymaker',
          material: 'PLA',
          colorHex: '#ffffff',
          remainingWeight: 500,
          remainingLength: 1200,
          lastUpdated: '2026-03-03T00:00:00Z',
        },
      });

    await loadSpoolmanConfig();

    expect(mockState.spoolmanConfig).toEqual(
      expect.objectContaining({
        enabled: true,
        contextId: 'context-1',
      })
    );
    expect(mockState.activeSpool).toEqual(
      expect.objectContaining({
        id: 101,
        name: 'PLA',
      })
    );
    expect(mockApplySettings).toHaveBeenCalledWith(mockSettings);
    expect(mockRefreshSettingsUI).toHaveBeenCalledWith(mockSettings);
    expect(mockUpdateSpoolmanPanelState).toHaveBeenCalled();
  });

  it('falls back to client-side spool filtering when the server search returns no results', async () => {
    mockState.spoolmanConfig = {
      enabled: true,
      updateMode: 'weight',
    };
    mockApiRequest
      .mockResolvedValueOnce({
        success: true,
        spools: [],
      })
      .mockResolvedValueOnce({
        success: true,
        spools: [
          {
            id: 101,
            name: 'PLA Pro',
            vendor: 'Polymaker',
            material: 'PLA',
            colorHex: '#ff0000',
            remainingWeight: 750,
            remainingLength: 1500,
            archived: false,
          },
          {
            id: 102,
            name: 'ABS',
            vendor: 'Bambu',
            material: 'ABS',
            colorHex: '#0000ff',
            remainingWeight: 800,
            remainingLength: 1800,
            archived: false,
          },
        ],
      });

    await fetchSpools('pla');

    expect(mockState.availableSpools).toHaveLength(1);
    expect(mockState.availableSpools[0]).toEqual(
      expect.objectContaining({
        id: 101,
        name: 'PLA Pro',
      })
    );
    expect(document.querySelectorAll('.spoolman-spool-item')).toHaveLength(1);
    expect(document.getElementById('spoolman-no-results')?.classList.contains('hidden')).toBe(true);
  });

  it('renders a disabled-state toast when the modal is opened without spoolman support', () => {
    mockState.spoolmanConfig = {
      enabled: false,
    };

    openSpoolSelectionModal();

    expect(mockShowToast).toHaveBeenCalledWith('Spoolman integration is disabled', 'error');
  });

  it('selects a spool, closes the modal state, and refreshes the panel', async () => {
    mockState.spoolmanConfig = {
      enabled: true,
      updateMode: 'weight',
    };
    renderSpoolList([
      {
        id: 101,
        name: 'PLA',
        vendor: 'Polymaker',
        material: 'PLA',
        colorHex: '#ff0000',
        remainingWeight: 500,
        remainingLength: 1000,
        archived: false,
      },
    ]);
    mockApiRequest.mockResolvedValue({
      success: true,
      spool: {
        id: 101,
        name: 'PLA',
        vendor: 'Polymaker',
        material: 'PLA',
        colorHex: '#ff0000',
        remainingWeight: 500,
        remainingLength: 1000,
        lastUpdated: '2026-03-03T00:00:00Z',
      },
    });

    await selectSpool(101);

    expect(mockState.activeSpool).toEqual(
      expect.objectContaining({
        id: 101,
        name: 'PLA',
      })
    );
    expect(mockUpdateSpoolmanPanelState).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('Spool selected successfully', 'success');
    expect(document.getElementById('spoolman-spool-list')?.children).toHaveLength(0);
  });
});
