/**
 * @fileoverview Tests for PrinterDataTransformer normalization of backend status,
 * job metadata, and legacy field compatibility.
 */

/**
 * @fileoverview Jest coverage for `PrinterDataTransformer`.
 *
 * Verifies normalization of raw printer status/detail payloads into the shapes
 * consumed by desktop UI, WebUI, and notification-oriented services.
 */
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

import { printerDataTransformer } from '../PrinterDataTransformer.js';

describe('PrinterDataTransformer', () => {
  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('transforms backend printer status into the normalized UI shape', () => {
    const status = printerDataTransformer.transformPrinterStatus({
      printerState: 'printing',
      bedTemperature: 60,
      bedTargetTemperature: 65,
      nozzleTemperature: 220,
      nozzleTargetTemperature: 225,
      currentJob: 'demo.gcode',
      progress: 0.42,
      printDuration: 600,
      remainingTime: 15,
      currentLayer: 12,
      totalLayers: 40,
      nozzleSize: '0.6',
      filamentType: 'PETG',
      printSpeedAdjust: 110,
      zAxisCompensation: 0.15,
      coolingFanSpeed: 80,
      chamberFanSpeed: 55,
      tvoc: 23,
      externalFanOn: true,
      cumulativePrintTime: 1234,
      cumulativeFilament: 5678,
      estimatedRightLen: 2500,
      estimatedRightWeight: 78,
      printEta: '04:48',
    });

    expect(status).toEqual(
      expect.objectContaining({
        state: 'Printing',
        connectionStatus: 'connected',
        fans: {
          coolingFan: 80,
          chamberFan: 55,
        },
        filtration: {
          mode: 'external',
          tvocLevel: 23,
          available: true,
        },
        settings: {
          nozzleSize: 0.6,
          filamentType: 'PETG',
          speedOffset: 110,
          zAxisOffset: 0.15,
        },
        currentJob: expect.objectContaining({
          fileName: 'demo.gcode',
          isActive: true,
          progress: expect.objectContaining({
            percentage: 42,
            currentLayer: 12,
            totalLayers: 40,
            timeRemaining: 15,
            elapsedTime: 10,
            elapsedTimeSeconds: 600,
            weightUsed: 78,
            lengthUsed: 2500,
            formattedEta: '04:48',
          }),
        }),
        cumulativeStats: {
          totalPrintTime: 1234,
          totalFilamentUsed: 5678,
        },
      })
    );
  });

  it('sanitizes invalid progress data and transforms material station payloads', () => {
    const status = printerDataTransformer.transformPrinterStatus({
      printerState: 'printing',
      currentJob: 'broken.gcode',
      progress: 150,
      printDuration: 120,
      currentLayer: 9,
      totalLayers: 4,
    });
    const station = printerDataTransformer.transformMaterialStation({
      connected: true,
      activeSlot: 2,
      errorMessage: '',
      slots: [
        {
          slotId: 1,
          isEmpty: false,
          materialType: 'PLA',
          materialColor: 'Red',
        },
        {
          slotId: 2,
          isEmpty: true,
          materialType: 'PETG',
          materialColor: 'Blue',
        },
      ],
    });

    expect(status?.currentJob).toEqual(
      expect.objectContaining({
        progress: expect.objectContaining({
          percentage: 0,
          currentLayer: null,
          totalLayers: null,
        }),
      })
    );
    expect(station).toEqual({
      connected: true,
      activeSlot: 2,
      errorMessage: null,
      slots: [
        {
          slotId: 1,
          isEmpty: false,
          materialType: 'PLA',
          materialColor: 'Red',
          isActive: false,
        },
        {
          slotId: 2,
          isEmpty: true,
          materialType: null,
          materialColor: null,
          isActive: true,
        },
      ],
      lastUpdate: expect.any(Date),
    });
  });

  it('validates normalized status objects and provides safe defaults', () => {
    const validStatus = printerDataTransformer.createDefaultStatus();
    const invalidStatus = {
      ...validStatus,
      temperatures: {
        ...validStatus.temperatures,
        extruder: {
          ...validStatus.temperatures.extruder,
          current: 400,
        },
      },
    };

    expect(printerDataTransformer.validatePrinterStatus(validStatus)).toBe(true);
    expect(printerDataTransformer.validatePrinterStatus(invalidStatus)).toBe(false);
    expect(printerDataTransformer.createDefaultMaterialStation()).toEqual({
      connected: false,
      slots: [],
      activeSlot: null,
      errorMessage: null,
      lastUpdate: expect.any(Date),
    });
    expect(printerDataTransformer.transformPrinterStatus(null)).toBeNull();
    expect(printerDataTransformer.transformMaterialStation(null)).toBeNull();
  });
});
