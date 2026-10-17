/**
 * @fileoverview Resolves the real printers the hardware track runs against.
 *
 * Credentials deliberately live OUTSIDE the repository working tree so they can
 * never be committed, even if .gitignore is wrong. Resolution order:
 *
 *   1. $FFUI_E2E_HARDWARE_CONFIG (explicit path to a JSON config)
 *   2. ~/.flashforgeui-e2e/hardware-printers.json
 *   3. The developer's real FlashForgeUI profile (READ ONLY), which already holds
 *      serials and check codes for every printer they use.
 *
 * IP addresses are never taken from any of those sources. They are resolved live
 * by UDP discovery keyed on serial number, because printer IPs move with DHCP -
 * the AD5X on this bench moved .132 -> .133 between two runs. Serial is the only
 * stable identity a printer has.
 *
 * Key exports:
 * - loadHardwarePrinters(): configured printers, without addresses
 * - resolveHardwarePrinter(): one printer with its current IP, via discovery
 */

import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Serial prefixes/names used by emulator instances, never treated as real hardware. */
const EMULATOR_MARKERS: readonly RegExp[] = [/emulator/i, /^E2E-/i];

export type HardwarePrinterKind = 'ad5x' | 'adventurer-5m-pro' | 'adventurer-5m' | 'creator-5' | 'creator-5-pro';

export interface HardwarePrinterConfig {
  /** Human label used in test titles. */
  label: string;
  serialNumber: string;
  checkCode: string;
  kind: HardwarePrinterKind;
  /** Root SSH/SFTP credentials provisioned by FlashForge-EasySSH. */
  ssh?: {
    username: string;
    password: string;
    port: number;
  };
}

export interface ResolvedHardwarePrinter extends HardwarePrinterConfig {
  ipAddress: string;
  commandPort: number;
  httpPort: number;
}

interface RawPrinterDetailsEntry {
  Name?: string;
  SerialNumber?: string;
  CheckCode?: string;
  modelType?: string;
  printerModel?: string;
  commandPort?: number;
  httpPort?: number;
}

const DEFAULT_SSH = { username: 'root', password: 'flashforge', port: 22 } as const;

const isEmulatorEntry = (serial: string, name: string): boolean =>
  EMULATOR_MARKERS.some((pattern) => pattern.test(serial) || pattern.test(name));

const toKind = (entry: RawPrinterDetailsEntry): HardwarePrinterKind | null => {
  const raw = (entry.modelType ?? entry.printerModel ?? '').toLowerCase();
  if (raw.includes('ad5x') || raw.includes('5x')) {
    return 'ad5x';
  }
  if (raw.includes('5m pro') || raw.includes('5m-pro')) {
    return 'adventurer-5m-pro';
  }
  if (raw.includes('5m')) {
    return 'adventurer-5m';
  }
  if (raw.includes('creator-5-pro') || raw.includes('creator 5 pro')) {
    return 'creator-5-pro';
  }
  if (raw.includes('creator')) {
    return 'creator-5';
  }
  return null;
};

const readJsonFile = async <T>(filePath: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
};

const getRealProfilePath = (): string => {
  const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'FlashForgeUI', 'printer_details.json');
};

/**
 * Derives hardware targets from the developer's real FlashForgeUI profile.
 * This only ever READS that file - the app under test always runs against an
 * isolated temp profile (see electron-app.ts).
 */
const loadFromRealProfile = async (): Promise<HardwarePrinterConfig[]> => {
  const parsed = await readJsonFile<{ printers?: Record<string, RawPrinterDetailsEntry> }>(getRealProfilePath());
  if (!parsed?.printers) {
    return [];
  }

  const configs: HardwarePrinterConfig[] = [];
  for (const entry of Object.values(parsed.printers)) {
    const serialNumber = entry.SerialNumber ?? '';
    const checkCode = entry.CheckCode ?? '';
    const label = entry.Name ?? serialNumber;

    if (!serialNumber || !checkCode || isEmulatorEntry(serialNumber, label)) {
      continue;
    }

    const kind = toKind(entry);
    if (!kind) {
      continue;
    }

    configs.push({ label, serialNumber, checkCode, kind, ssh: { ...DEFAULT_SSH } });
  }

  return configs;
};

export const loadHardwarePrinters = async (): Promise<HardwarePrinterConfig[]> => {
  const explicitPath = process.env.FFUI_E2E_HARDWARE_CONFIG?.trim();
  const candidatePaths = [
    explicitPath && explicitPath.length > 0 ? path.resolve(explicitPath) : null,
    path.join(os.homedir(), '.flashforgeui-e2e', 'hardware-printers.json'),
  ].filter((value): value is string => value !== null);

  for (const candidate of candidatePaths) {
    const parsed = await readJsonFile<{ printers?: HardwarePrinterConfig[] }>(candidate);
    if (parsed?.printers && parsed.printers.length > 0) {
      return parsed.printers.map((printer) => ({ ...printer, ssh: printer.ssh ?? { ...DEFAULT_SSH } }));
    }
  }

  return await loadFromRealProfile();
};

/**
 * Synchronous variant of loadHardwarePrinters().
 *
 * Playwright evaluates test.describe() bodies synchronously at collection time, so
 * parameterizing specs over the configured printers cannot await. Reading a small
 * local JSON file synchronously at collection is the pragmatic way to enumerate them.
 */
export const loadHardwarePrintersSync = (): HardwarePrinterConfig[] => {
  const readSync = <T>(filePath: string): T | null => {
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
    } catch {
      return null;
    }
  };

  const explicitPath = process.env.FFUI_E2E_HARDWARE_CONFIG?.trim();
  const candidatePaths = [
    explicitPath && explicitPath.length > 0 ? path.resolve(explicitPath) : null,
    path.join(os.homedir(), '.flashforgeui-e2e', 'hardware-printers.json'),
  ].filter((value): value is string => value !== null);

  for (const candidate of candidatePaths) {
    const parsed = readSync<{ printers?: HardwarePrinterConfig[] }>(candidate);
    if (parsed?.printers && parsed.printers.length > 0) {
      return parsed.printers.map((printer) => ({ ...printer, ssh: printer.ssh ?? { ...DEFAULT_SSH } }));
    }
  }

  const profile = readSync<{ printers?: Record<string, RawPrinterDetailsEntry> }>(getRealProfilePath());
  if (!profile?.printers) {
    return [];
  }

  const configs: HardwarePrinterConfig[] = [];
  for (const entry of Object.values(profile.printers)) {
    const serialNumber = entry.SerialNumber ?? '';
    const checkCode = entry.CheckCode ?? '';
    const label = entry.Name ?? serialNumber;
    const kind = toKind(entry);

    if (!serialNumber || !checkCode || !kind || isEmulatorEntry(serialNumber, label)) {
      continue;
    }
    configs.push({ label, serialNumber, checkCode, kind, ssh: { ...DEFAULT_SSH } });
  }

  return configs;
};

interface DiscoveredPrinter {
  name: string;
  ipAddress: string;
  serialNumber: string;
  commandPort: number;
  eventPort: number;
  productId: number;
}

/**
 * Runs a real UDP discovery sweep and returns every printer that answered.
 * Imported lazily so that emulator-only runs never load the printer library.
 */
export const discoverPrinters = async (timeoutMs = 8_000): Promise<DiscoveredPrinter[]> => {
  const { PrinterDiscovery } = (await import('@ghosttypes/ff-api')) as unknown as {
    PrinterDiscovery: new () => { discover: (timeout: number) => Promise<DiscoveredPrinter[]> };
  };

  const discovery = new PrinterDiscovery();
  return await discovery.discover(timeoutMs);
};

/**
 * Resolves a configured printer to its current address.
 * Throws with the list of what *was* found, so a powered-off printer produces an
 * actionable message rather than a bare timeout later in the test.
 */
export const resolveHardwarePrinter = async (
  config: HardwarePrinterConfig,
  timeoutMs = 8_000
): Promise<ResolvedHardwarePrinter> => {
  const discovered = await discoverPrinters(timeoutMs);
  const match = discovered.find((printer) => printer.serialNumber === config.serialNumber);

  if (!match) {
    const seen = discovered.map((printer) => `${printer.name} (${printer.serialNumber} @ ${printer.ipAddress})`);
    throw new Error(
      `Printer "${config.label}" (${config.serialNumber}) did not answer discovery within ${timeoutMs}ms. ` +
        `Is it powered on and on this network?\nDiscovered instead: ${seen.length > 0 ? seen.join(', ') : 'nothing'}`
    );
  }

  return {
    ...config,
    ipAddress: match.ipAddress,
    commandPort: match.commandPort,
    httpPort: match.eventPort,
  };
};
