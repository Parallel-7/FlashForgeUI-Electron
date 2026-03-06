/**
 * @fileoverview Tests for SavedPrinterService persistence helpers delegated to
 * PrinterDetailsManager for saved-printer CRUD and last-used selection.
 */

/**
 * @fileoverview Jest coverage for `SavedPrinterService`.
 *
 * Exercises saved-printer persistence, lookup/update/remove behavior, and the
 * normalization used by connection and auto-connect features.
 */
const mockPrinterDetailsManager = {
  clearAllPrinters: jest.fn(),
  getAllSavedPrinters: jest.fn(),
  getLastUsedPrinter: jest.fn(),
  getPrinterCount: jest.fn(),
  getSavedPrinter: jest.fn(),
  savePrinter: jest.fn(),
  setLastUsedPrinter: jest.fn(),
};

jest.mock('../../managers/PrinterDetailsManager.js', () => ({
  getPrinterDetailsManager: () => mockPrinterDetailsManager,
}));

import { SavedPrinterService } from '../SavedPrinterService.js';

describe('SavedPrinterService', () => {
  const savedPrinters = [
    {
      Name: 'Printer One',
      IPAddress: '192.168.1.10',
      SerialNumber: 'SN-1',
      CheckCode: 'CHK-1',
      lastConnected: '2026-03-01T10:00:00Z',
    },
    {
      Name: 'Printer Two',
      IPAddress: '192.168.1.20',
      SerialNumber: 'SN-2',
      CheckCode: 'CHK-2',
      lastConnected: '2026-03-02T11:00:00Z',
    },
  ] as any[];

  beforeEach(() => {
    jest.clearAllMocks();
    (SavedPrinterService as any).instance = null;
    mockPrinterDetailsManager.getAllSavedPrinters.mockReturnValue(savedPrinters);
    mockPrinterDetailsManager.getSavedPrinter.mockImplementation((serialNumber: string) => {
      return savedPrinters.find((printer) => printer.SerialNumber === serialNumber) ?? null;
    });
    mockPrinterDetailsManager.getPrinterCount.mockReturnValue(savedPrinters.length);
    mockPrinterDetailsManager.getLastUsedPrinter.mockReturnValue(savedPrinters[1]);
    mockPrinterDetailsManager.savePrinter.mockResolvedValue(undefined);
    mockPrinterDetailsManager.setLastUsedPrinter.mockResolvedValue(undefined);
  });

  it('matches discovered printers by serial number and prepares UI-ready saved printer data', () => {
    const service = SavedPrinterService.getInstance();
    const matches = service.findMatchingPrinters([
      {
        name: 'Printer One Live',
        ipAddress: '192.168.1.50',
        serialNumber: 'SN-1',
      },
      {
        name: 'Unknown',
        ipAddress: '192.168.1.99',
        serialNumber: 'SN-9',
      },
    ] as any);

    expect(matches).toEqual([
      {
        savedDetails: savedPrinters[0],
        discoveredPrinter: {
          name: 'Printer One Live',
          ipAddress: '192.168.1.50',
          serialNumber: 'SN-1',
        },
        ipAddressChanged: true,
      },
    ]);

    expect(service.prepareSavedPrinterData(matches)).toEqual([
      {
        name: 'Printer One',
        ipAddress: '192.168.1.10',
        serialNumber: 'SN-1',
        lastConnected: '2026-03-01T10:00:00Z',
        isOnline: true,
        ipAddressChanged: true,
        currentIpAddress: '192.168.1.50',
      },
      {
        name: 'Printer Two',
        ipAddress: '192.168.1.20',
        serialNumber: 'SN-2',
        lastConnected: '2026-03-02T11:00:00Z',
        isOnline: false,
        ipAddressChanged: false,
        currentIpAddress: undefined,
      },
    ]);
  });

  it('delegates persistence helpers and emits update events', async () => {
    const service = SavedPrinterService.getInstance();
    const savedSpy = jest.fn();
    const updatedSpy = jest.fn();
    const lastConnectedSpy = jest.fn();
    const clearedSpy = jest.fn();

    service.on('printer-saved', savedSpy);
    service.on('printer-ip-updated', updatedSpy);
    service.on('last-connected-updated', lastConnectedSpy);
    service.on('all-printers-cleared', clearedSpy);

    await service.savePrinter(savedPrinters[0]);
    await service.updatePrinterIP('SN-1', '192.168.1.55');
    await service.updateLastConnected('SN-2');
    service.clearAllPrinters();

    expect(mockPrinterDetailsManager.savePrinter).toHaveBeenNthCalledWith(1, savedPrinters[0]);
    expect(mockPrinterDetailsManager.savePrinter).toHaveBeenNthCalledWith(2, {
      ...savedPrinters[0],
      IPAddress: '192.168.1.55',
    });
    expect(mockPrinterDetailsManager.setLastUsedPrinter).toHaveBeenCalledWith('SN-2');
    expect(mockPrinterDetailsManager.clearAllPrinters).toHaveBeenCalled();
    expect(savedSpy).toHaveBeenCalledWith(savedPrinters[0]);
    expect(updatedSpy).toHaveBeenCalledWith({
      serialNumber: 'SN-1',
      oldIP: '192.168.1.10',
      newIP: '192.168.1.55',
    });
    expect(lastConnectedSpy).toHaveBeenCalledWith('SN-2');
    expect(clearedSpy).toHaveBeenCalled();
  });

  it('exposes saved-printer lookup helpers', () => {
    const service = SavedPrinterService.getInstance();

    expect(service.getSavedPrinters()).toBe(savedPrinters);
    expect(service.getSavedPrinter('SN-1')).toBe(savedPrinters[0]);
    expect(service.getSavedPrinterCount()).toBe(2);
    expect(service.getLastUsedPrinter()).toBe(savedPrinters[1]);
    expect(service.isPrinterSaved('SN-1')).toBe(true);
    expect(service.isPrinterSaved('missing')).toBe(false);
    expect(service.getSavedCheckCode('SN-1')).toBe('CHK-1');
    expect(service.getSavedCheckCode('missing')).toBeNull();
  });
});
