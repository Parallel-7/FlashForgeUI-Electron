/**
 * @fileoverview Tests for BasePrinterBackend feature normalization, status helpers,
 * and default backend behavior shared by concrete printer implementations.
 */

/**
 * @fileoverview Jest coverage for shared `BasePrinterBackend` behavior.
 *
 * Validates the common backend contract around polling, command forwarding,
 * job helpers, and lifecycle/event behavior used by concrete printer backends.
 */
import type {
  CommandResult,
  GCodeCommandResult,
  JobListResult,
  JobOperationParams,
  JobStartResult,
  MaterialStationStatus,
  PrinterFeatureSet,
  StatusResult,
} from '@shared/types/printer-backend/index.js';
import { BasePrinterBackend } from '../BasePrinterBackend.js';

class TestBackend extends BasePrinterBackend {
  protected getBaseFeatures(): PrinterFeatureSet {
    return {
      camera: {
        oemStreamUrl: '',
        customUrl: null,
        customEnabled: false,
      },
      ledControl: {
        builtin: false,
        customControlEnabled: false,
        usesLegacyAPI: true,
      },
      filtration: {
        available: false,
        controllable: false,
      },
      gcodeCommands: {
        available: true,
        usesLegacyAPI: true,
        supportedCommands: [],
      },
      statusMonitoring: {
        available: true,
        usesNewAPI: false,
        usesLegacyAPI: true,
        realTimeUpdates: false,
      },
      jobManagement: {
        localJobs: false,
        recentJobs: false,
        uploadJobs: false,
        startJobs: false,
        pauseResume: true,
        cancelJobs: true,
        usesNewAPI: false,
      },
      materialStation: {
        available: false,
        slotCount: 0,
        perSlotInfo: false,
        materialDetection: false,
      },
    };
  }

  protected async initializeBackend(): Promise<void> {}

  public async executeGCodeCommand(command: string): Promise<GCodeCommandResult> {
    return {
      success: true,
      command,
      executionTime: 0,
      timestamp: new Date(),
    };
  }

  public async getPrinterStatus(): Promise<StatusResult> {
    return {
      success: true,
      timestamp: new Date(),
      status: {
        printerState: 'idle',
        bedTemperature: 0,
        nozzleTemperature: 0,
        progress: 0,
      },
    };
  }

  public async getLocalJobs(): Promise<JobListResult> {
    return {
      success: true,
      jobs: [],
      totalCount: 0,
      source: 'local',
      timestamp: new Date(),
    };
  }

  public async getRecentJobs(): Promise<JobListResult> {
    return {
      success: true,
      jobs: [],
      totalCount: 0,
      source: 'recent',
      timestamp: new Date(),
    };
  }

  public async startJob(params: JobOperationParams): Promise<JobStartResult> {
    return {
      success: true,
      fileName: params.fileName || '',
      started: true,
      timestamp: new Date(),
    };
  }

  public async pauseJob(): Promise<CommandResult> {
    return {
      success: true,
      timestamp: new Date(),
    };
  }

  public async resumeJob(): Promise<CommandResult> {
    return {
      success: true,
      timestamp: new Date(),
    };
  }

  public async cancelJob(): Promise<CommandResult> {
    return {
      success: true,
      timestamp: new Date(),
    };
  }

  public getMaterialStationStatus(): MaterialStationStatus | null {
    return null;
  }

  public async getModelPreview(): Promise<string | null> {
    return null;
  }

  public async getJobThumbnail(_fileName: string): Promise<string | null> {
    return null;
  }

  public async setLedEnabled(_enabled: boolean): Promise<CommandResult> {
    return {
      success: true,
      timestamp: new Date(),
    };
  }

  public setOEMCameraStreamUrlForTest(streamUrl: string): boolean {
    return this.updateOEMCameraStreamUrl(streamUrl);
  }

  protected supportsNewAPI(): boolean {
    return false;
  }

  protected supportsCustomLEDControl(): boolean {
    return true;
  }

  protected supportsMaterialStation(): boolean {
    return false;
  }

  protected supportsLocalJobs(): boolean {
    return false;
  }

  protected supportsRecentJobs(): boolean {
    return false;
  }

  protected supportsUploadJobs(): boolean {
    return false;
  }

  protected supportsStartJobs(): boolean {
    return false;
  }

  protected getSupportedGCodeCommands(): readonly string[] {
    return [];
  }

  protected getMaterialStationSlotCount(): number {
    return 0;
  }
}

describe('BasePrinterBackend', () => {
  function createBackend(): TestBackend {
    return new TestBackend({
      printerModel: 'generic-legacy',
      printerDetails: {
        name: 'Test Printer',
        ipAddress: '192.168.1.10',
        serialNumber: 'SN123',
        typeName: 'Generic',
        customCameraEnabled: false,
        customCameraUrl: '',
        customLedsEnabled: false,
        forceLegacyMode: false,
      },
      primaryClient: {
        dispose: jest.fn(),
      } as any,
    });
  }

  it('refreshes feature availability when per-printer settings change', async () => {
    const backend = createBackend();
    const featureUpdatedListener = jest.fn();
    await backend.initialize();

    backend.on('feature-updated', featureUpdatedListener);

    const changedKeys = backend.refreshPerPrinterSettings({
      customCameraEnabled: true,
      customCameraUrl: 'http://192.168.1.10:8080/?action=stream',
      customLedsEnabled: true,
      forceLegacyMode: false,
    });

    expect(changedKeys).toEqual(['customCameraEnabled', 'customCameraUrl', 'customLedsEnabled']);
    expect(backend.isFeatureAvailable('camera')).toBe(true);
    expect(backend.isFeatureAvailable('led-control')).toBe(true);
    expect(backend.getBackendStatus().features.camera.customUrl).toBe('http://192.168.1.10:8080/?action=stream');
    expect(featureUpdatedListener).toHaveBeenCalledTimes(1);
    expect(featureUpdatedListener.mock.calls[0][0].data).toMatchObject({
      changedKeys: ['customCameraEnabled', 'customCameraUrl', 'customLedsEnabled'],
    });
  });

  it('does not emit feature updates when per-printer settings are unchanged', async () => {
    const backend = createBackend();
    const featureUpdatedListener = jest.fn();
    await backend.initialize();

    backend.on('feature-updated', featureUpdatedListener);

    const changedKeys = backend.refreshPerPrinterSettings({
      customCameraEnabled: false,
      customCameraUrl: '',
      customLedsEnabled: false,
      forceLegacyMode: false,
    });

    expect(changedKeys).toEqual([]);
    expect(featureUpdatedListener).not.toHaveBeenCalled();
  });

  it('treats the runtime OEM camera stream as the camera availability source of truth', async () => {
    const backend = createBackend();
    const featureUpdatedListener = jest.fn();
    await backend.initialize();

    backend.on('feature-updated', featureUpdatedListener);

    expect(backend.isFeatureAvailable('camera')).toBe(false);
    expect(backend.setOEMCameraStreamUrlForTest('http://192.168.1.10:8080/?action=stream')).toBe(true);
    expect(backend.isFeatureAvailable('camera')).toBe(true);
    expect(backend.getBackendStatus().features.camera.oemStreamUrl).toBe(
      'http://192.168.1.10:8080/?action=stream'
    );
    expect(featureUpdatedListener).toHaveBeenCalledTimes(1);
  });

  it('normalizes blank enabled custom camera settings to disabled', async () => {
    const backend = createBackend();
    await backend.initialize();

    const changedKeys = backend.refreshPerPrinterSettings({
      customCameraEnabled: true,
      customCameraUrl: '   ',
      customLedsEnabled: false,
      forceLegacyMode: false,
    });

    expect(changedKeys).toEqual([]);
    expect(backend.isFeatureAvailable('camera')).toBe(false);
  });
});
