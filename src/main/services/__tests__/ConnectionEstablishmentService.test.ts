/**
 * @fileoverview Tests for ConnectionEstablishmentService client selection,
 * initialization flow, and printer-info handshake handling.
 */

/**
 * @fileoverview Jest coverage for `ConnectionEstablishmentService`.
 *
 * Exercises direct and discovery connection flows, ff-api client selection,
 * pairing-code handling, and the printer detail normalization returned to the
 * rest of the connection pipeline.
 */
const flashForgeClientConfigs: any[] = [];
const flashForgeClientInstances: any[] = [];
const fiveMClientConfigs: any[] = [];
const fiveMClientInstances: any[] = [];

function dequeueConfig(queue: any[]) {
  return queue.shift() ?? {};
}

jest.mock('@ghosttypes/ff-api', () => ({
  FlashForgeClient: jest.fn().mockImplementation((...args: unknown[]) => {
    const config = dequeueConfig(flashForgeClientConfigs);
    const instance = {
      args,
      initControl: config.initControl ?? jest.fn().mockResolvedValue(true),
      getPrinterInfo:
        config.getPrinterInfo ??
        jest.fn().mockResolvedValue({
          TypeName: 'Creator Pro',
          Name: 'Legacy Printer',
          SerialNumber: 'SN-LEGACY',
        }),
      dispose: config.dispose ?? jest.fn().mockResolvedValue(undefined),
      sendRawCmd: config.sendRawCmd ?? jest.fn().mockResolvedValue(undefined),
    };
    flashForgeClientInstances.push(instance);
    return instance;
  }),
  FiveMClient: jest.fn().mockImplementation((...args: unknown[]) => {
    const config = dequeueConfig(fiveMClientConfigs);
    const instance = {
      args,
      initialize: config.initialize ?? jest.fn().mockResolvedValue(true),
      initControl: config.initControl ?? jest.fn().mockResolvedValue(true),
      dispose: config.dispose ?? jest.fn().mockResolvedValue(undefined),
    };
    fiveMClientInstances.push(instance);
    return instance;
  }),
}));

import { ConnectionEstablishmentService } from '../ConnectionEstablishmentService.js';

describe('ConnectionEstablishmentService', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    flashForgeClientConfigs.length = 0;
    flashForgeClientInstances.length = 0;
    fiveMClientConfigs.length = 0;
    fiveMClientInstances.length = 0;
    (ConnectionEstablishmentService as any).instance = null;
  });

  afterEach(() => {
    jest.useRealTimers();
    (ConnectionEstablishmentService as any).instance = null;
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('creates a reusable temporary connection for legacy printers', async () => {
    const service = ConnectionEstablishmentService.getInstance();
    const typeDetectedSpy = jest.fn();
    service.on('printer-type-detected', typeDetectedSpy);

    flashForgeClientConfigs.push({
      initControl: jest.fn().mockResolvedValue(true),
      getPrinterInfo: jest.fn().mockResolvedValue({
        TypeName: 'Creator Pro',
        Name: 'Legacy Printer',
        SerialNumber: 'SN-LEGACY',
      }),
    });

    const result = await service.createTemporaryConnection({
      name: 'Legacy Printer',
      ipAddress: '192.168.1.10',
      serialNumber: 'SN-LEGACY',
    });

    expect(result.success).toBe(true);
    expect(result.typeName).toBe('Creator Pro');
    expect(result.printerInfo?._reuseableClient).toBe(flashForgeClientInstances[0]);
    expect(flashForgeClientInstances[0].dispose).not.toHaveBeenCalled();
    expect(typeDetectedSpy).toHaveBeenCalledWith({
      typeName: 'Creator Pro',
      familyInfo: {
        is5MFamily: false,
        requiresCheckCode: false,
        familyName: 'Creator Pro',
      },
    });
  });

  it('passes discovered command port to temporary legacy connection', async () => {
    const service = ConnectionEstablishmentService.getInstance();

    flashForgeClientConfigs.push({
      initControl: jest.fn().mockResolvedValue(true),
      getPrinterInfo: jest.fn().mockResolvedValue({
        TypeName: 'Creator Pro',
        Name: 'Legacy Printer',
        SerialNumber: 'SN-LEGACY',
      }),
    });

    const result = await service.createTemporaryConnection({
      name: 'Legacy Printer',
      ipAddress: '192.168.1.10',
      serialNumber: 'SN-LEGACY',
      commandPort: 19099,
    });

    expect(result.success).toBe(true);
    expect(flashForgeClientInstances[0].args).toEqual(['192.168.1.10', { port: 19099 }]);
  });

  it('disposes the temporary client after detecting a 5M-family printer', async () => {
    const service = ConnectionEstablishmentService.getInstance();
    jest.useFakeTimers();

    flashForgeClientConfigs.push({
      initControl: jest.fn().mockResolvedValue(true),
      getPrinterInfo: jest.fn().mockResolvedValue({
        TypeName: 'AD5X',
        Name: 'AD5X',
        SerialNumber: 'SN-AD5X',
      }),
    });

    const promise = service.createTemporaryConnection({
      name: 'AD5X',
      ipAddress: '192.168.1.11',
      serialNumber: 'SN-AD5X',
    });

    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.typeName).toBe('AD5X');
    expect(result.printerInfo?.SerialNumber).toBe('SN-AD5X');
    expect(flashForgeClientInstances[0].dispose).toHaveBeenCalled();
  });

  it('reports an error when printer type information cannot be retrieved', async () => {
    const service = ConnectionEstablishmentService.getInstance();
    const failureSpy = jest.fn();
    service.on('temporary-connection-failed', failureSpy);

    flashForgeClientConfigs.push({
      initControl: jest.fn().mockResolvedValue(true),
      getPrinterInfo: jest.fn().mockResolvedValue({}),
    });

    const result = await service.createTemporaryConnection({
      name: 'Unknown',
      ipAddress: '192.168.1.12',
      serialNumber: '',
    });

    expect(result).toEqual({
      success: false,
      error: 'Failed to get printer type information',
    });
    expect(flashForgeClientInstances[0].dispose).toHaveBeenCalled();
    expect(failureSpy).toHaveBeenCalledWith('Failed to get printer type information');
  });

  it('establishes a dual-api connection for 5M-family printers', async () => {
    const service = ConnectionEstablishmentService.getInstance();
    const dualApiSpy = jest.fn();
    service.on('dual-api-connection-established', dualApiSpy);

    fiveMClientConfigs.push({
      initialize: jest.fn().mockResolvedValue(true),
      initControl: jest.fn().mockResolvedValue(true),
    });
    flashForgeClientConfigs.push({
      initControl: jest.fn().mockResolvedValue(true),
    });

    const result = await service.establishFinalConnection(
      {
        name: 'AD5X',
        ipAddress: '192.168.1.13',
        serialNumber: 'SN-5M',
      },
      'AD5X',
      true,
      '4321',
      false
    );

    expect(result).toEqual({
      primaryClient: fiveMClientInstances[0],
      secondaryClient: flashForgeClientInstances[0],
    });
    expect(fiveMClientInstances[0].args).toEqual(['192.168.1.13', 'SN-5M', '4321']);
    expect(flashForgeClientInstances[0].args).toEqual(['192.168.1.13']);
    expect(dualApiSpy).toHaveBeenCalledWith({
      ipAddress: '192.168.1.13',
      serialNumber: 'SN-5M',
    });
  });

  it('passes discovered command/http ports to dual-api clients when provided', async () => {
    const service = ConnectionEstablishmentService.getInstance();

    fiveMClientConfigs.push({
      initialize: jest.fn().mockResolvedValue(true),
      initControl: jest.fn().mockResolvedValue(true),
    });
    flashForgeClientConfigs.push({
      initControl: jest.fn().mockResolvedValue(true),
    });

    const result = await service.establishFinalConnection(
      {
        name: 'AD5X',
        ipAddress: '192.168.1.130',
        serialNumber: 'SN-PORTS',
        commandPort: 19099,
        eventPort: 19098,
      },
      'AD5X',
      true,
      '7777',
      false
    );

    expect(result).toEqual({
      primaryClient: fiveMClientInstances[0],
      secondaryClient: flashForgeClientInstances[0],
    });
    expect(fiveMClientInstances[0].args).toEqual([
      '192.168.1.130',
      'SN-PORTS',
      '7777',
      { httpPort: 19098, tcpPort: 19099 },
    ]);
    expect(flashForgeClientInstances[0].args).toEqual(['192.168.1.130', { port: 19099 }]);
  });

  it('reuses the legacy temporary client when the final connection does not need dual-api mode', async () => {
    const service = ConnectionEstablishmentService.getInstance();

    flashForgeClientConfigs.push({
      initControl: jest.fn().mockResolvedValue(true),
      getPrinterInfo: jest.fn().mockResolvedValue({
        TypeName: 'Creator Pro',
        Name: 'Legacy Printer',
        SerialNumber: 'SN-LEGACY',
      }),
    });

    const result = await service.establishFinalConnection(
      {
        name: 'Legacy Printer',
        ipAddress: '192.168.1.14',
        serialNumber: 'SN-LEGACY',
      },
      'Creator Pro',
      false,
      '123',
      false
    );

    expect(result).toEqual({
      primaryClient: flashForgeClientInstances[0],
    });
  });

  it('returns null and disposes the primary client when dual-api setup fails', async () => {
    const service = ConnectionEstablishmentService.getInstance();

    fiveMClientConfigs.push({
      initialize: jest.fn().mockResolvedValue(false),
      initControl: jest.fn().mockResolvedValue(true),
    });

    const result = await service.establishFinalConnection(
      {
        name: 'AD5X',
        ipAddress: '192.168.1.15',
        serialNumber: 'SN-FAIL',
      },
      'AD5X',
      true,
      '9999',
      false
    );

    expect(result).toBeNull();
    expect(fiveMClientInstances[0].dispose).toHaveBeenCalled();
  });

  it('uses legacy-only connection path for Adventurer 5M when force legacy mode is enabled', async () => {
    const service = ConnectionEstablishmentService.getInstance();

    flashForgeClientConfigs.push({
      initControl: jest.fn().mockResolvedValue(true),
      getPrinterInfo: jest.fn().mockResolvedValue({
        TypeName: 'Adventurer 5M',
        Name: 'A5M',
        SerialNumber: 'SN-5M-LEGACY',
      }),
      dispose: jest.fn().mockResolvedValue(undefined),
    });
    flashForgeClientConfigs.push({
      initControl: jest.fn().mockResolvedValue(true),
    });

    const result = await service.establishFinalConnection(
      {
        name: 'A5M',
        ipAddress: '192.168.1.51',
        serialNumber: 'SN-5M-LEGACY',
      },
      'Adventurer 5M',
      true,
      '5555',
      true
    );

    expect(result).toEqual({
      primaryClient: flashForgeClientInstances[1],
    });
    expect(fiveMClientInstances).toHaveLength(0);
    expect(flashForgeClientInstances[0].dispose).toHaveBeenCalled();
  });

  it('uses dual-api connection path for Adventurer 5M when force legacy mode is disabled', async () => {
    const service = ConnectionEstablishmentService.getInstance();

    fiveMClientConfigs.push({
      initialize: jest.fn().mockResolvedValue(true),
      initControl: jest.fn().mockResolvedValue(true),
    });
    flashForgeClientConfigs.push({
      initControl: jest.fn().mockResolvedValue(true),
    });

    const result = await service.establishFinalConnection(
      {
        name: 'A5M',
        ipAddress: '192.168.1.52',
        serialNumber: 'SN-5M-NEW',
      },
      'Adventurer 5M',
      true,
      '5555',
      false
    );

    expect(result).toEqual({
      primaryClient: fiveMClientInstances[0],
      secondaryClient: flashForgeClientInstances[0],
    });
  });

  it('uses legacy-only connection path for Adventurer 5M Pro when force legacy mode is enabled', async () => {
    const service = ConnectionEstablishmentService.getInstance();

    flashForgeClientConfigs.push({
      initControl: jest.fn().mockResolvedValue(true),
      getPrinterInfo: jest.fn().mockResolvedValue({
        TypeName: 'Adventurer 5M Pro',
        Name: 'A5M Pro',
        SerialNumber: 'SN-5MP-LEGACY',
      }),
      dispose: jest.fn().mockResolvedValue(undefined),
    });
    flashForgeClientConfigs.push({
      initControl: jest.fn().mockResolvedValue(true),
    });

    const result = await service.establishFinalConnection(
      {
        name: 'A5M Pro',
        ipAddress: '192.168.1.53',
        serialNumber: 'SN-5MP-LEGACY',
      },
      'Adventurer 5M Pro',
      true,
      '6666',
      true
    );

    expect(result).toEqual({
      primaryClient: flashForgeClientInstances[1],
    });
    expect(fiveMClientInstances).toHaveLength(0);
    expect(flashForgeClientInstances[0].dispose).toHaveBeenCalled();
  });

  it('uses dual-api connection path for Adventurer 5M Pro when force legacy mode is disabled', async () => {
    const service = ConnectionEstablishmentService.getInstance();

    fiveMClientConfigs.push({
      initialize: jest.fn().mockResolvedValue(true),
      initControl: jest.fn().mockResolvedValue(true),
    });
    flashForgeClientConfigs.push({
      initControl: jest.fn().mockResolvedValue(true),
    });

    const result = await service.establishFinalConnection(
      {
        name: 'A5M Pro',
        ipAddress: '192.168.1.54',
        serialNumber: 'SN-5MP-NEW',
      },
      'Adventurer 5M Pro',
      true,
      '6666',
      false
    );

    expect(result).toEqual({
      primaryClient: fiveMClientInstances[0],
      secondaryClient: flashForgeClientInstances[0],
    });
  });

  it('logs out legacy clients before disposing them', async () => {
    const service = ConnectionEstablishmentService.getInstance();
    const disposedSpy = jest.fn();
    service.on('clients-disposed', disposedSpy);
    jest.useFakeTimers();

    const primaryClient = {
      sendRawCmd: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn(),
    };
    const secondaryClient = {
      sendRawCmd: jest.fn().mockRejectedValue(new Error('already closed')),
      dispose: jest.fn(),
    };

    const promise = service.disposeClients(primaryClient as any, secondaryClient as any, 'legacy');
    await jest.runAllTimersAsync();
    await promise;

    expect(primaryClient.sendRawCmd).toHaveBeenCalledWith('~M602');
    expect(secondaryClient.sendRawCmd).toHaveBeenCalledWith('~M602');
    expect(primaryClient.dispose).toHaveBeenCalled();
    expect(secondaryClient.dispose).toHaveBeenCalled();
    expect(disposedSpy).toHaveBeenCalled();
  });
});
