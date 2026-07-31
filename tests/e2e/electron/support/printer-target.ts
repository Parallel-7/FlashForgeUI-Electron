/**
 * @fileoverview The abstraction that lets one spec run against the emulator in CI and
 * against real printers on a developer bench.
 *
 * A PrinterTarget is "a printer this test can drive": an address, credentials, the
 * seed entry needed to pre-populate the app profile, and a PrinterClient for
 * out-of-band assertions. Emulator targets are created on demand; hardware targets
 * are resolved live by serial through UDP discovery.
 *
 * Capability flags (hasMaterialStation, supportsSftp) let a shared spec skip the parts
 * a given target genuinely cannot do, instead of forking whole specs per track.
 *
 * Key exports:
 * - PrinterTarget: the common shape
 * - createEmulatorTarget(): boot an emulator instance as a target
 * - createHardwareTarget(): resolve a configured real printer as a target
 */

import type { SeededPrinter } from './electron-app';
import { type EmulatorModel, startEmulatorInstance } from '../helpers/emulator-harness';
import { type HardwarePrinterConfig, resolveHardwarePrinter } from './hardware-config';
import { PrinterClient } from './printer-client';
import { deleteRemoteFile, remoteGcodeDirFor, waitForRemoteFile } from './sftp';

export interface PrinterTarget {
  /** Label used in test titles and failure messages. */
  label: string;
  ipAddress: string;
  serialNumber: string;
  checkCode: string;
  commandPort: number;
  httpPort: number;
  /** Manual-connect dropdown token for this printer. */
  manualConnectType: 'adventurer-5m' | 'adventurer-5m-pro' | 'ad5x' | 'creator-5' | 'creator-5-pro' | 'legacy';
  /** AD5X and Creator 5 have a 4-slot material station; 5M-series and legacy do not. */
  hasMaterialStation: boolean;
  /** Only real printers provisioned by FlashForge-EasySSH expose SSH/SFTP. */
  supportsSftp: boolean;
  ssh?: { username: string; password: string; port: number };
  /** Out-of-band client for asserting real printer state. */
  client: PrinterClient;
  /**
   * Waits for an uploaded file to be visible on the printer.
   *
   * Hardware checks the filesystem over SFTP; the emulator falls back to /gcodeList.
   * They are not interchangeable: on real firmware /gcodeList only reports *recent*
   * files, so a freshly uploaded file that has never printed is absent from it even
   * though the upload succeeded.
   */
  waitForUploadedFile(fileName: string, timeoutMs?: number): Promise<boolean>;
  /** Removes an uploaded file, so hardware runs leave no residue. */
  removeUploadedFile(fileName: string): Promise<void>;
  /** Profile entry used to pre-seed the app so it can auto-connect. */
  toSeededPrinter(): SeededPrinter;
  /** Releases any resources (stops an emulator instance; no-op for hardware). */
  dispose(): Promise<void>;
}

const MATERIAL_STATION_TYPES = new Set(['ad5x', 'creator-5', 'creator-5-pro']);

interface EmulatorTargetParams {
  label: string;
  model: EmulatorModel;
  serial: string;
  checkCode: string;
  machineName: string;
  tcpPort: number;
  httpPort: number;
  discoveryEnabled?: boolean;
}

/** Maps an emulator model token to the app's manual-connect dropdown token. */
const emulatorModelToManualType = (model: EmulatorModel): PrinterTarget['manualConnectType'] => {
  switch (model) {
    case 'adventurer-5m':
      return 'adventurer-5m';
    case 'adventurer-5m-pro':
      return 'adventurer-5m-pro';
    case 'adventurer-5x':
      return 'ad5x';
    default:
      // adventurer-3 / adventurer-4 are genuine legacy printers with no product ID.
      return 'legacy';
  }
};

const emulatorModelToPrinterModel = (model: EmulatorModel): string => {
  switch (model) {
    case 'adventurer-5m':
      return 'Adventurer 5M';
    case 'adventurer-5m-pro':
      return 'Adventurer 5M Pro';
    case 'adventurer-5x':
      return 'AD5X';
    case 'adventurer-3':
      return 'Adventurer 3';
    case 'adventurer-4':
      return 'Adventurer 4';
    default:
      return model;
  }
};

export const createEmulatorTarget = async (params: EmulatorTargetParams): Promise<PrinterTarget> => {
  const instance = await startEmulatorInstance({
    instance: {
      instanceId: `${params.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${params.tcpPort}`,
      model: params.model,
      serial: params.serial,
      checkCode: params.checkCode,
      machineName: params.machineName,
      tcpPort: params.tcpPort,
      httpPort: params.httpPort,
      discoveryEnabled: params.discoveryEnabled ?? true,
      simulationMode: 'manual',
      simulationSpeed: 100,
    },
  });

  const ready = instance.readyPayloads[0];
  if (!ready) {
    await instance.stop();
    throw new Error(`Emulator instance for "${params.label}" never reported ready`);
  }

  const manualConnectType = emulatorModelToManualType(params.model);
  const isLegacy = manualConnectType === 'legacy';

  return {
    label: params.label,
    ipAddress: ready.ip,
    serialNumber: params.serial,
    checkCode: params.checkCode,
    commandPort: params.tcpPort,
    httpPort: params.httpPort,
    manualConnectType,
    hasMaterialStation: MATERIAL_STATION_TYPES.has(manualConnectType),
    // The emulator implements the printer HTTP/TCP APIs but runs no SSH server.
    supportsSftp: false,
    client: new PrinterClient({
      ipAddress: ready.ip,
      httpPort: params.httpPort,
      serialNumber: params.serial,
      checkCode: params.checkCode,
    }),
    // No SSH on the emulator, so /gcodeList is the only listing available - and it is
    // sufficient there because the emulator does report uploads through it.
    waitForUploadedFile: async (fileName: string, timeoutMs = 60_000) =>
      await new PrinterClient({
        ipAddress: ready.ip,
        httpPort: params.httpPort,
        serialNumber: params.serial,
        checkCode: params.checkCode,
      }).waitForFile(fileName, timeoutMs),
    removeUploadedFile: async () => {
      // Emulator state is discarded when the instance stops.
    },
    toSeededPrinter: () => ({
      Name: params.machineName,
      IPAddress: ready.ip,
      SerialNumber: params.serial,
      CheckCode: params.checkCode,
      ClientType: isLegacy ? 'legacy' : 'new',
      printerModel: emulatorModelToPrinterModel(params.model),
      commandPort: params.tcpPort,
      httpPort: params.httpPort,
      forceLegacyMode: isLegacy,
    }),
    dispose: async () => {
      await instance.stop();
    },
  };
};

const hardwareKindToManualType = (kind: HardwarePrinterConfig['kind']): PrinterTarget['manualConnectType'] => kind;

const hardwareKindToPrinterModel = (kind: HardwarePrinterConfig['kind']): string => {
  switch (kind) {
    case 'ad5x':
      return 'AD5X';
    case 'adventurer-5m':
      return 'Adventurer 5M';
    case 'adventurer-5m-pro':
      return 'Adventurer 5M Pro';
    case 'creator-5':
      return 'Creator 5';
    case 'creator-5-pro':
      return 'Creator 5 Pro';
    default:
      return kind;
  }
};

/**
 * Resolves a real printer to a target.
 *
 * The address always comes from live discovery, never from saved config - printer IPs
 * move with DHCP and a stale address produces a confusing mid-test failure instead of
 * a clear "printer not found" one.
 */
export const createHardwareTarget = async (config: HardwarePrinterConfig): Promise<PrinterTarget> => {
  const resolved = await resolveHardwarePrinter(config);
  const manualConnectType = hardwareKindToManualType(config.kind);

  return {
    label: config.label,
    ipAddress: resolved.ipAddress,
    serialNumber: config.serialNumber,
    checkCode: config.checkCode,
    commandPort: resolved.commandPort,
    httpPort: resolved.httpPort,
    manualConnectType,
    hasMaterialStation: MATERIAL_STATION_TYPES.has(manualConnectType),
    supportsSftp: config.ssh !== undefined,
    ssh: config.ssh,
    client: new PrinterClient({
      ipAddress: resolved.ipAddress,
      httpPort: resolved.httpPort,
      serialNumber: config.serialNumber,
      checkCode: config.checkCode,
    }),
    waitForUploadedFile: async (fileName: string, timeoutMs = 120_000) => {
      if (!config.ssh) {
        // Without SFTP the only option is the recent-files list, which is unreliable
        // for never-printed uploads; say so rather than reporting a false negative.
        throw new Error(
          `Cannot verify uploads on "${config.label}": no SSH credentials configured, and /gcodeList does not list freshly uploaded files on real firmware.`
        );
      }
      return await waitForRemoteFile(
        { host: resolved.ipAddress, port: config.ssh.port, username: config.ssh.username, password: config.ssh.password },
        remoteGcodeDirFor(config.kind),
        fileName,
        timeoutMs
      );
    },
    removeUploadedFile: async (fileName: string) => {
      if (!config.ssh) {
        return;
      }
      await deleteRemoteFile(
        { host: resolved.ipAddress, port: config.ssh.port, username: config.ssh.username, password: config.ssh.password },
        remoteGcodeDirFor(config.kind),
        fileName
      );
    },
    toSeededPrinter: () => ({
      Name: config.label,
      IPAddress: resolved.ipAddress,
      SerialNumber: config.serialNumber,
      CheckCode: config.checkCode,
      ClientType: 'new',
      printerModel: hardwareKindToPrinterModel(config.kind),
      commandPort: resolved.commandPort,
      httpPort: resolved.httpPort,
    }),
    // Hardware isn't ours to shut down.
    dispose: async () => {},
  };
};
