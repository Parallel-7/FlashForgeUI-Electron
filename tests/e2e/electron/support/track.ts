/**
 * @fileoverview Selects which track a run exercises and enumerates its printers.
 *
 * One spec file serves both tracks. The track is chosen by FFUI_E2E_TRACK:
 *
 *   emulator (default) - boots flashforge-emulator-v2 instances; safe for CI
 *   hardware           - drives the real printers on the developer's bench
 *
 * Descriptors are enumerated synchronously because Playwright collects
 * test.describe() bodies before any await is possible. The expensive work (booting an
 * emulator, resolving a real printer by discovery) happens inside create().
 *
 * Key exports:
 * - getTrack(): the active track
 * - listTargetDescriptors(): printers to parameterize specs over
 * - describeForTrack(): skips a spec that the active track cannot support
 */

import type { EmulatorModel } from '../helpers/emulator-harness';
import { loadHardwarePrintersSync } from './hardware-config';
import { createEmulatorTarget, createHardwareTarget, type PrinterTarget } from './printer-target';

export type Track = 'emulator' | 'hardware';

export interface TargetDescriptor {
  label: string;
  /** True for AD5X / Creator 5, which show the material matching dialog. */
  hasMaterialStation: boolean;
  /** True only on real EasySSH-provisioned printers. */
  supportsSftp: boolean;
  /**
   * Whether the manual connect form can reach this printer.
   *
   * The form collects IP + type + serial + check code but no ports, so it always
   * dials the firmware defaults (8899/8898). Real printers always listen there, but
   * only one emulator instance per machine can, so additional emulator instances run
   * on alternate ports and are reachable by discovery and saved-profile connect only.
   */
  supportsManualConnect: boolean;
  create: () => Promise<PrinterTarget>;
}

/** Ports real FlashForge firmware always listens on. */
const DEFAULT_COMMAND_PORT = 8899;
const DEFAULT_HTTP_PORT = 8898;

export const getTrack = (): Track => (process.env.FFUI_E2E_TRACK === 'hardware' ? 'hardware' : 'emulator');

/**
 * Emulator port allocation.
 *
 * Fixed, well-spaced ports keep parallel-safe isolation simple and make a stray
 * instance easy to identify by port when something leaks.
 */
const EMULATOR_PRINTERS: ReadonlyArray<{
  label: string;
  model: EmulatorModel;
  serial: string;
  machineName: string;
  tcpPort: number;
  httpPort: number;
  hasMaterialStation: boolean;
}> = [
  {
    label: 'Adventurer 5M Pro (emulated)',
    model: 'adventurer-5m-pro',
    serial: 'E2E-SN-5MPRO',
    machineName: 'E2E-5MPro',
    tcpPort: 8899,
    httpPort: 8898,
    hasMaterialStation: false,
  },
  {
    label: 'AD5X (emulated)',
    model: 'adventurer-5x',
    serial: 'E2E-SN-AD5X',
    machineName: 'E2E-AD5X',
    tcpPort: 8899,
    httpPort: 8898,
    hasMaterialStation: true,
  },
  {
    label: 'Creator 5 (emulated)',
    model: 'creator-5',
    serial: 'E2E-SN-CREATOR5',
    machineName: 'E2E-Creator5',
    tcpPort: 8899,
    httpPort: 8898,
    hasMaterialStation: true,
  },
  {
    label: 'Creator 5 Pro (emulated)',
    model: 'creator-5-pro',
    serial: 'E2E-SN-CREATOR5PRO',
    machineName: 'E2E-Creator5Pro',
    tcpPort: 8899,
    httpPort: 8898,
    hasMaterialStation: true,
  },
];

const EMULATOR_CHECK_CODE = '123';

export const listTargetDescriptors = (): TargetDescriptor[] => {
  if (getTrack() === 'hardware') {
    return loadHardwarePrintersSync().map((config) => ({
      label: config.label,
      hasMaterialStation: config.kind === 'ad5x' || config.kind.startsWith('creator-5'),
      supportsSftp: config.ssh !== undefined,
      // Real printers always listen on the firmware default ports.
      supportsManualConnect: true,
      create: async () => await createHardwareTarget(config),
    }));
  }

  return EMULATOR_PRINTERS.map((printer) => ({
    label: printer.label,
    hasMaterialStation: printer.hasMaterialStation,
    // The emulator runs no SSH server, so SFTP scenarios never apply here.
    supportsSftp: false,
    supportsManualConnect: printer.tcpPort === DEFAULT_COMMAND_PORT && printer.httpPort === DEFAULT_HTTP_PORT,
    create: async () =>
      await createEmulatorTarget({
        label: printer.label,
        model: printer.model,
        serial: printer.serial,
        checkCode: EMULATOR_CHECK_CODE,
        machineName: printer.machineName,
        tcpPort: printer.tcpPort,
        httpPort: printer.httpPort,
      }),
  }));
};

/**
 * Descriptors for running two printers at once.
 *
 * Single-printer specs each get an instance on the firmware default ports, which is
 * fine because their describes run sequentially and tear down before the next starts.
 * Running two at once needs distinct ports, so every instance after the first is
 * shifted. Those shifted instances are still reachable by discovery and by a seeded
 * profile (both carry explicit ports); only the manual connect form, which assumes the
 * defaults, cannot reach them.
 */
export const listMultiPrinterDescriptors = (): TargetDescriptor[] => {
  if (getTrack() === 'hardware') {
    return listTargetDescriptors();
  }

  return EMULATOR_PRINTERS.map((printer, index) => {
    const portOffset = index * 100;
    const tcpPort = printer.tcpPort + portOffset;
    const httpPort = printer.httpPort + portOffset;

    return {
      label: printer.label,
      hasMaterialStation: printer.hasMaterialStation,
      supportsSftp: false,
      supportsManualConnect: tcpPort === DEFAULT_COMMAND_PORT && httpPort === DEFAULT_HTTP_PORT,
      create: async () =>
        await createEmulatorTarget({
          label: printer.label,
          model: printer.model,
          serial: printer.serial,
          checkCode: EMULATOR_CHECK_CODE,
          machineName: printer.machineName,
          tcpPort,
          httpPort,
        }),
    };
  });
};

/**
 * Explains why a track has nothing to run, so a skipped suite reports a reason
 * instead of silently passing with zero tests.
 */
export const describeTrackSkipReason = (descriptors: readonly TargetDescriptor[]): string | null => {
  if (descriptors.length > 0) {
    return null;
  }

  return getTrack() === 'hardware'
    ? 'No hardware printers configured. Set FFUI_E2E_HARDWARE_CONFIG, create ~/.flashforgeui-e2e/hardware-printers.json, or connect a printer in FlashForgeUI first.'
    : 'No emulator printers defined.';
};
