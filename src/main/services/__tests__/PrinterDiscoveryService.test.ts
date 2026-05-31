/**
 * @fileoverview Tests for PrinterDiscoveryService discovery orchestration,
 * singleton lifecycle, and ff-api adapter behavior.
 */

/**
 * @fileoverview Jest coverage for `PrinterDiscoveryService`.
 *
 * Validates ff-api discovery integration, lifecycle management, and the
 * discovered-printer payloads surfaced to connection and auto-connect flows.
 */
const discoverMock = jest.fn();

jest.mock('@ghosttypes/ff-api', () => ({
  PrinterDiscovery: jest.fn().mockImplementation(() => ({
    discover: discoverMock,
  })),
}));

import { PrinterDiscoveryService } from '../PrinterDiscoveryService.js';

describe('PrinterDiscoveryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (PrinterDiscoveryService as any).instance = null;
  });

  afterEach(() => {
    (PrinterDiscoveryService as any).instance = null;
  });

  it('maps discovered printers including command/event ports', async () => {
    discoverMock.mockResolvedValue([
      {
        name: 'Emulator One',
        ipAddress: '127.0.0.1',
        serialNumber: 'SN-1',
        commandPort: 19099,
        eventPort: 19098,
      },
    ]);

    const service = PrinterDiscoveryService.getInstance();
    const printers = await service.scanNetwork(2000, 500, 1);

    expect(printers).toEqual([
      {
        name: 'Emulator One',
        ipAddress: '127.0.0.1',
        serialNumber: 'SN-1',
        commandPort: 19099,
        eventPort: 19098,
        model: 'Unknown',
        status: 'Discovered',
      },
    ]);
  });

  it('returns a single IP match with command/event ports', async () => {
    discoverMock.mockResolvedValue([
      {
        name: 'Emulator One',
        ipAddress: '127.0.0.1',
        serialNumber: 'SN-1',
        commandPort: 19099,
        eventPort: 19098,
      },
      {
        name: 'Emulator Two',
        ipAddress: '127.0.0.2',
        serialNumber: 'SN-2',
        commandPort: 19199,
        eventPort: 19198,
      },
    ]);

    const service = PrinterDiscoveryService.getInstance();
    const printer = await service.scanSingleIP('127.0.0.2');

    expect(printer).toEqual({
      name: 'Emulator Two',
      ipAddress: '127.0.0.2',
      serialNumber: 'SN-2',
      commandPort: 19199,
      eventPort: 19198,
      model: 'Unknown',
      status: 'Discovered',
    });
  });
});
