/**
 * @fileoverview E2E coverage for estimate-based Spoolman tracking on the
 * headless WebUI: per-slot deduction at terminal states on material-station
 * printers (Creator 5), exactly-once across completion/cancel, pause/resume
 * neutrality, untracked jobs, station-model parity, single-material
 * printer-metadata capture for AD5X stored files started through the app
 * (single-material deducts the printer-reported weight; multi-material and
 * ambiguous spool assignments stay untracked), and the single-spool
 * regression for 5M-series printers.
 *
 * Runs against real flashforge-emulator-v2 instances plus the Spoolman
 * sidecar from the emulator checkout. Skips when the sidecar script is
 * unavailable (CI pins an emulator tag without it).
 *
 * Expected amounts are hand-computed from the fixture's slicer metadata
 * (tests/fixtures/print-files/creator5-two-tool.3mf):
 * tool 0 = 11.28 g, tool 1 = 8.64 g — assert both PUTs carry exactly those
 * numbers on completion, 40% of them on a cancel pinned at 40%. Stored-file
 * scenarios assert the literal printer-reported weight (130 g) or zero PUTs.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { expect, test } from '@playwright/test';
import { fetchApiToken, postJson, postRaw, readEmulatorDetail } from './helpers/api';
import {
  DEFAULT_HEADLESS_PRINTERS,
  type HeadlessPrinter,
  type HeadlessWebUI,
  startHeadlessWebUI,
} from './helpers/headless-webui';
import {
  type SpoolmanSidecar,
  isSpoolmanSidecarAvailable,
  SPOOLMAN_SIDECAR_SKIP_MESSAGE,
  startSpoolmanSidecar,
} from './helpers/spoolman-sidecar';

const sidecarAvailable = isSpoolmanSidecarAvailable();
const sidecarSkipReason = SPOOLMAN_SIDECAR_SKIP_MESSAGE;

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests', 'fixtures', 'print-files');
const TWO_TOOL_FIXTURE = 'creator5-two-tool.3mf';
const SINGLE_TOOL_GCODE = 'adventurer5m-single-color.gcode';

/** Hand-computed from the fixture's slicer metadata. */
const TOOL_0_G = 11.28;
const TOOL_1_G = 8.64;
const SLOT_1_SPOOL = 1;
const SLOT_2_SPOOL = 2;
/** Emulator's fixed total filament weight for the single-tool regression. */
const EMULATOR_FULL_WEIGHT_G = 96;
const EMULATOR_HALF_WEIGHT_G = EMULATOR_FULL_WEIGHT_G * 0.5;
const G_TOLERANCE = 0.15;
const POLL_CYCLE_MS = 4500;

/** Two-tool mapping payload the Material Station UI would send. */
const TWO_TOOL_MAPPINGS = [
  {
    toolId: 0,
    slotId: 1,
    materialName: 'PLA',
    toolMaterialColor: '#808000',
    slotMaterialColor: '#808000',
  },
  {
    toolId: 1,
    slotId: 2,
    materialName: 'PLA',
    toolMaterialColor: '#808080',
    slotMaterialColor: '#808080',
  },
];

interface StagePayload {
  uploadId?: string;
  error?: string;
}

interface StartPayload {
  success?: boolean;
  fileName?: string;
  error?: string;
}

const emulatorStatus = async (printer: HeadlessPrinter): Promise<string> => {
  return (await readEmulatorDetail(printer, printer.checkCode)).status?.toLowerCase() ?? '';
};

const emulatorControl = async (
  printer: HeadlessPrinter,
  body: Record<string, unknown>
): Promise<void> => {
  const response = await fetch(`http://127.0.0.1:${String(printer.httpPort)}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  await response.body?.cancel();
};

const emulatorSimulate = async (
  printer: HeadlessPrinter,
  body: Record<string, unknown>
): Promise<void> => {
  const response = await fetch(`http://127.0.0.1:${String(printer.httpPort)}/__simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  await response.body?.cancel();
};

const clearPlatform = async (printer: HeadlessPrinter): Promise<void> => {
  await emulatorControl(printer, {
    serialNumber: printer.serial,
    checkCode: printer.checkCode,
    payload: { cmd: 'stateCtrl_cmd', args: { action: 'setClearPlatform' } },
  });
  await expect.poll(async () => emulatorStatus(printer), { timeout: 20_000 }).toBe('ready');
};

const driveToPrinting = async (printer: HeadlessPrinter): Promise<void> => {
  // The start command resumes the print into its live loop.
  await emulatorSimulate(printer, { action: 'resume' });
  await expect.poll(async () => emulatorStatus(printer), { timeout: 60_000 }).toBe('printing');
  // Freeze progress immediately; each scenario then jumps to the exact
  // percent it wants to pin, and the tracker must use what it observed.
  await emulatorSimulate(printer, { action: 'pause' });
};

const resolveContextId = async (
  webui: HeadlessWebUI,
  token: string,
  serial: string
): Promise<string> => {
  const response = await fetch(`${webui.baseUrl}/api/contexts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok).toBe(true);
  const body = (await response.json()) as {
    contexts?: Array<{ id: string; serialNumber?: string }>;
  };
  const match = body.contexts?.find((context) => context.serialNumber === serial);
  if (!match) {
    throw new Error(`no context found for serial ${serial}`);
  }
  return match.id;
};

const assignSlotSpool = async (
  webui: HeadlessWebUI,
  token: string,
  contextId: string,
  slotId: number,
  spoolId: number | null
): Promise<void> => {
  const payload = await postJson<{ success?: boolean; error?: string }>(
    webui,
    token,
    '/api/spoolman/slot-spool',
    { contextId, slotId, spoolId }
  );
  expect(payload.error).toBeUndefined();
};

const uploadAndStart = async (
  webui: HeadlessWebUI,
  token: string,
  contextId: string,
  fileName: string,
  materialMappings?: unknown
): Promise<void> => {
  const stage = await postRaw<StagePayload>(
    webui,
    token,
    `/api/jobs/upload/stage?contextId=${contextId}&filename=${encodeURIComponent(fileName)}`,
    await fs.readFile(path.join(FIXTURES_DIR, fileName)),
    fileName
  );
  expect(stage.error).toBeUndefined();
  const start = await postJson<StartPayload>(
    webui,
    token,
    `/api/jobs/upload/start?contextId=${contextId}`,
    {
      uploadId: stage.uploadId,
      startNow: true,
      autoLevel: false,
      ...(materialMappings ? { materialMappings } : {}),
    }
  );
  expect(start.error).toBeUndefined();
};

const waitForSidecarCalls = async (
  sidecar: SpoolmanSidecar,
  expected: number,
  webui?: HeadlessWebUI | null
): Promise<Map<number, number>> => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if ((await sidecar.requests()).length === expected) break;
    await sleep(500);
  }
  const actual = (await sidecar.requests()).length;
  if (actual !== expected) {
    throw new Error(
      `expected ${String(expected)} sidecar PUTs, saw ${String(actual)}; server log:
${webui?.logTail() ?? '(no log)'}`
    );
  }
  const bySpool = new Map<number, number>();
  for (const entry of await sidecar.requests()) {
    bySpool.set(entry.spoolId, (bySpool.get(entry.spoolId) ?? 0) + (entry.useWeight ?? 0));
  }
  return bySpool;
};

/**
 * Wait until the APP's status pipeline observes a given state for the
 * context. Emulator-side readiness is not enough: the state monitor keys
 * exactly-once deduction off transitions it actually sees, so scenarios must
 * not race ahead of the app's polling stream.
 */
const waitForAppState = async (
  webui: HeadlessWebUI,
  token: string,
  contextId: string,
  expected: 'printing' | 'paused'
): Promise<void> => {
  await expect
    .poll(
      async () => {
        const response = await fetch(
          `${webui.baseUrl}/api/printer/status?contextId=${contextId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.ok) {
          return '';
        }
        const body = (await response.json()) as { status?: { printerState?: string } };
        return (body.status?.printerState ?? '').toLowerCase();
      },
      { timeout: 60_000 }
    )
    .toBe(expected);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait until the APP (not just the emulator) observes the printer back in
 * Ready. Clearing the platform resets the emulator instantly, but the app's
 * polling stream needs to deliver that status before the next scenario's
 * print starts — otherwise the state monitor can stay lodged in the previous
 * terminal state and miss the new print's transitions entirely.
 */
const waitForAppReady = async (
  webui: HeadlessWebUI,
  token: string,
  contextId: string
): Promise<void> => {
  await expect
    .poll(
      async () => {
        const response = await fetch(
          `${webui.baseUrl}/api/printer/status?contextId=${contextId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.ok) {
          return '';
        }
        const body = (await response.json()) as { status?: { printerState?: string } };
        return (body.status?.printerState ?? '').toLowerCase();
      },
      { timeout: 30_000 }
    )
    .toBe('ready');
  // Let the polling stream deliver one Ready sample to the state monitor
  // before the next scenario starts a new print.
  await sleep(POLL_CYCLE_MS);
};

// ============================================================================
// Creator 5 — the canonical two-tool station scenarios
// ============================================================================

test.describe('Spoolman station tracking (Creator 5)', () => {
  test.skip(!sidecarAvailable, sidecarSkipReason);
  test.describe.configure({ mode: 'serial' });

  const printer: HeadlessPrinter = {
    label: 'Creator 5 (emulated)',
    model: 'creator-5',
    serial: 'E2E-SPOOL-C5',
    checkCode: '123',
    machineName: 'E2E-Spool-C5',
    tcpPort: 8899,
    httpPort: 8898,
  };

  let sidecar: SpoolmanSidecar;
  let webui: HeadlessWebUI | null = null;
  let token = '';

  test.beforeAll(async () => {
    sidecar = await startSpoolmanSidecar();
    webui = await startHeadlessWebUI({
      printers: [printer],
      configOverrides: {
        SpoolmanEnabled: true,
        SpoolmanServerUrl: sidecar.baseUrl,
        SpoolmanUpdateMode: 'weight',
      },
      emulatorSimulationMode: 'auto',
    });
    token = await fetchApiToken(webui);
  });

  test.afterAll(async () => {
    await webui?.stop();
    await sidecar?.stop();
  });

  test('two-tool completion deducts both slot spools at full estimates', async () => {
    await sidecar.reset();
    const contextId = await resolveContextId(webui!, token, printer.serial);
    await waitForAppReady(webui!, token, contextId);

    await assignSlotSpool(webui!, token, contextId, 1, SLOT_1_SPOOL);
    await assignSlotSpool(webui!, token, contextId, 2, SLOT_2_SPOOL);

    await uploadAndStart(webui!, token, contextId, TWO_TOOL_FIXTURE, TWO_TOOL_MAPPINGS);

    await driveToPrinting(printer);
    await emulatorSimulate(printer, { action: 'jump', percent: 100 });

    const bySpool = await waitForSidecarCalls(sidecar, 2, webui);
    expect(Math.abs((bySpool.get(SLOT_1_SPOOL) ?? 0) - TOOL_0_G)).toBeLessThanOrEqual(G_TOLERANCE);
    expect(Math.abs((bySpool.get(SLOT_2_SPOOL) ?? 0) - TOOL_1_G)).toBeLessThanOrEqual(G_TOLERANCE);

    await clearPlatform(printer);
  });

  test('cancel at a pinned fraction deducts that fraction of the estimates', async () => {
    await sidecar.reset();
    const contextId = await resolveContextId(webui!, token, printer.serial);
    await waitForAppReady(webui!, token, contextId);

    await assignSlotSpool(webui!, token, contextId, 1, SLOT_1_SPOOL);
    await assignSlotSpool(webui!, token, contextId, 2, SLOT_2_SPOOL);

    await uploadAndStart(webui!, token, contextId, TWO_TOOL_FIXTURE, TWO_TOOL_MAPPINGS);

    await driveToPrinting(printer);
    await emulatorSimulate(printer, { action: 'jump', percent: 40 });
    // Let one polling cycle observe the pinned 40%.
    await sleep(POLL_CYCLE_MS);

    const cancel = await postJson<{ success?: boolean; error?: string }>(
      webui!,
      token,
      `/api/printer/control/cancel?contextId=${contextId}`,
      {}
    );
    expect(cancel.error).toBeUndefined();

    const bySpool = await waitForSidecarCalls(sidecar, 2, webui);
    expect(Math.abs((bySpool.get(SLOT_1_SPOOL) ?? 0) - TOOL_0_G * 0.4)).toBeLessThanOrEqual(
      G_TOLERANCE
    );
    expect(Math.abs((bySpool.get(SLOT_2_SPOOL) ?? 0) - TOOL_1_G * 0.4)).toBeLessThanOrEqual(
      G_TOLERANCE
    );

    await clearPlatform(printer);
  });

  test('pause and resume deduct nothing; the later completion deducts exactly once', async () => {
    await sidecar.reset();
    const contextId = await resolveContextId(webui!, token, printer.serial);
    await waitForAppReady(webui!, token, contextId);

    await assignSlotSpool(webui!, token, contextId, 1, SLOT_1_SPOOL);
    await assignSlotSpool(webui!, token, contextId, 2, SLOT_2_SPOOL);

    await uploadAndStart(webui!, token, contextId, TWO_TOOL_FIXTURE, TWO_TOOL_MAPPINGS);

    await driveToPrinting(printer);

    // Real pause via the app, wait for the emulator to settle, then resume.
    const pause = await postJson<{ success?: boolean; error?: string }>(
      webui!,
      token,
      `/api/printer/control/pause?contextId=${contextId}`,
      {}
    );
    expect(pause.error).toBeUndefined();
    await waitForAppState(webui!, token, contextId, 'paused');

    const resume = await postJson<{ success?: boolean; error?: string }>(
      webui!,
      token,
      `/api/printer/control/resume?contextId=${contextId}`,
      {}
    );
    expect(resume.error).toBeUndefined();
    await waitForAppState(webui!, token, contextId, 'printing');
    // Give the polling stream one full cycle to deliver the resumed Printing
    // sample to the state monitor (its print-started arms a fresh exactly-once
    // job key for the completion below).
    await sleep(POLL_CYCLE_MS);

    // The ledger must still be empty: pause/resume is not a terminal state.
    expect(await sidecar.requests()).toHaveLength(0);

    await emulatorSimulate(printer, { action: 'pause' });
    await emulatorSimulate(printer, { action: 'jump', percent: 100 });

    const bySpool = await waitForSidecarCalls(sidecar, 2, webui);
    expect(Math.abs((bySpool.get(SLOT_1_SPOOL) ?? 0) - TOOL_0_G)).toBeLessThanOrEqual(G_TOLERANCE);
    expect(Math.abs((bySpool.get(SLOT_2_SPOOL) ?? 0) - TOOL_1_G)).toBeLessThanOrEqual(G_TOLERANCE);

    await clearPlatform(printer);
  });

  test('job started on the printer itself (untracked) deducts nothing', async () => {
    await sidecar.reset();
    expect(await sidecar.requests()).toHaveLength(0);

    // Upload straight to the emulator, bypassing the app entirely — the app
    // never sees tool→slot mappings for this job.
    const bytes = await fs.readFile(path.join(FIXTURES_DIR, TWO_TOOL_FIXTURE));
    const form = new FormData();
    form.append('gcodeFile', new Blob([new Uint8Array(bytes)]), 'untracked-job.3mf');
    const upload = await fetch(`http://127.0.0.1:${String(printer.httpPort)}/uploadGcode`, {
      method: 'POST',
      headers: {
        SerialNumber: printer.serial,
        CheckCode: printer.checkCode,
      },
      body: form,
    });
    expect(upload.ok).toBe(true);
    await upload.body?.cancel();

    const start = await fetch(`http://127.0.0.1:${String(printer.httpPort)}/printGcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serialNumber: printer.serial,
        checkCode: printer.checkCode,
        fileName: 'untracked-job.3mf',
        levelingBeforePrint: false,
      }),
    });
    expect(start.ok).toBe(true);
    const startBody = (await start.json()) as { code?: number; message?: string };
    expect(startBody.code).toBe(0);

    await driveToPrinting(printer);
    await emulatorSimulate(printer, { action: 'jump', percent: 100 });

    // Give the terminal event + a polling cycle time, then assert empty.
    await sleep(POLL_CYCLE_MS * 2);
    expect(await sidecar.requests()).toHaveLength(0);

    await clearPlatform(printer);
  });
});

// ============================================================================
// Other station profiles — gating parity for the estimate-based path
// ============================================================================

test.describe('Spoolman station tracking (station model parity)', () => {
  test.skip(!sidecarAvailable, sidecarSkipReason);
  test.describe.configure({ mode: 'serial' });

  const printers: HeadlessPrinter[] = [
    {
      label: 'Creator 5 Pro (emulated)',
      model: 'creator-5-pro',
      serial: 'E2E-SPOOL-C5PRO',
      checkCode: '123',
      machineName: 'E2E-Spool-C5Pro',
      tcpPort: 8899,
      httpPort: 8898,
    },
    {
      label: 'AD5X (emulated)',
      model: 'adventurer-5x',
      serial: 'E2E-SPOOL-AD5X',
      checkCode: '123',
      machineName: 'E2E-Spool-AD5X',
      tcpPort: 8999,
      httpPort: 8998,
    },
  ];

  let sidecar: SpoolmanSidecar;
  let webui: HeadlessWebUI | null = null;
  let token = '';

  test.beforeAll(async () => {
    sidecar = await startSpoolmanSidecar();
    webui = await startHeadlessWebUI({
      printers,
      configOverrides: {
        SpoolmanEnabled: true,
        SpoolmanServerUrl: sidecar.baseUrl,
        SpoolmanUpdateMode: 'weight',
      },
      emulatorSimulationMode: 'auto',
    });
    token = await fetchApiToken(webui);
  });

  test.afterAll(async () => {
    await webui?.stop();
    await sidecar?.stop();
  });

  for (const printer of printers) {
    test(`two-tool completion deducts both spools (${printer.label})`, async () => {
      await sidecar.reset();
      const contextId = await resolveContextId(webui!, token, printer.serial);

      await assignSlotSpool(webui!, token, contextId, 1, SLOT_1_SPOOL);
      await assignSlotSpool(webui!, token, contextId, 2, SLOT_2_SPOOL);

      await uploadAndStart(webui!, token, contextId, TWO_TOOL_FIXTURE, TWO_TOOL_MAPPINGS);

      await driveToPrinting(printer);
      await emulatorSimulate(printer, { action: 'jump', percent: 100 });

      const bySpool = await waitForSidecarCalls(sidecar, 2, webui);
      expect(Math.abs((bySpool.get(SLOT_1_SPOOL) ?? 0) - TOOL_0_G)).toBeLessThanOrEqual(
        G_TOLERANCE
      );
      expect(Math.abs((bySpool.get(SLOT_2_SPOOL) ?? 0) - TOOL_1_G)).toBeLessThanOrEqual(
        G_TOLERANCE
      );

      await clearPlatform(printer);
    });
  }
});

// ============================================================================
// AD5X — printer-metadata tracking for single-material stored files (#p-3ejfg).
// Files started through the app from the printer's own storage get a
// printer-metadata estimate at start; deduction resolves to the sole assigned
// slot's spool. Ambiguous (multi-material / spool-count) cases stay untracked.
// ============================================================================

test.describe('Spoolman printer-metadata tracking (AD5X stored files)', () => {
  const printer = DEFAULT_HEADLESS_PRINTERS.find(
    (candidate) => candidate.serial === 'E2E-WEBUI-AD5X'
  ) as HeadlessPrinter;

  /**
   * Seed a printer-resident file exactly like the emulator would report it in
   * gcodeListDetail (GcodeFileEntry metadata), without any app upload. The
   * scenario fileName registers the file in the emulator store so the start
   * command can find it.
   */
  const seedStoredFile = async (
    fileName: string,
    metadata: { gcodeToolCnt: number; totalFilamentWeight: number; useMatlStation: boolean }
  ): Promise<void> => {
    const response = await fetch(`http://127.0.0.1:${String(printer.httpPort)}/__scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: {
          machineStatus: 'idle',
          fileName,
          currentFileMetadata: metadata,
        },
      }),
    });
    expect(response.ok).toBe(true);
  };

  /** Drive the running print to completion and wait for the terminal state. */
  const completePrint = async (): Promise<void> => {
    await emulatorSimulate(printer, { action: 'jump', percent: 100 });
    await expect.poll(async () => emulatorStatus(printer), { timeout: 30_000 }).toBe('completed');
    // One polling cycle of headroom so the tracker reacts to the terminal state.
    await sleep(POLL_CYCLE_MS);
  };

  /** Start a stored (printer-resident) file through the app's job-start route. */
  const startStoredJobViaApp = async (contextId: string, fileName: string): Promise<void> => {
    const payload = await postJson<Record<string, unknown>>(
      webui!,
      token,
      `/api/jobs/start?contextId=${contextId}`,
      { filename: fileName, startNow: true, leveling: false }
    );
    expect(payload.error).toBeUndefined();
  };

  test.skip(!sidecarAvailable, sidecarSkipReason);
  test.describe.configure({ mode: 'serial' });

  let sidecar: SpoolmanSidecar;
  let webui: HeadlessWebUI | null = null;
  let token = '';

  test.beforeAll(async () => {
    sidecar = await startSpoolmanSidecar();
    webui = await startHeadlessWebUI({
      printers: [printer],
      configOverrides: {
        SpoolmanEnabled: true,
        SpoolmanServerUrl: sidecar.baseUrl,
        SpoolmanUpdateMode: 'weight',
      },
      emulatorSimulationMode: 'auto',
    });
    token = await fetchApiToken(webui);
  });

  test.afterAll(async () => {
    await webui?.stop();
    await sidecar.stop();
  });

  test('tracks single-material stored prints with one PUT of the printer-reported weight', async () => {
    await sidecar.reset();
    const contextId = await resolveContextId(webui!, token, printer.serial);
    await waitForAppReady(webui!, token, contextId);

    await assignSlotSpool(webui!, token, contextId, 1, SLOT_1_SPOOL);

    await seedStoredFile('stored-single.3mf', {
      gcodeToolCnt: 1,
      totalFilamentWeight: 130,
      useMatlStation: true,
    });
    await startStoredJobViaApp(contextId, 'stored-single.3mf');

    await driveToPrinting(printer);
    await completePrint();

    const bySpool = await waitForSidecarCalls(sidecar, 1, webui);
    expect(Math.abs((bySpool.get(SLOT_1_SPOOL) ?? 0) - 130)).toBeLessThanOrEqual(G_TOLERANCE);

    await clearPlatform(printer);
  });

  test('leaves multi-material stored prints untracked', async () => {
    await sidecar.reset();
    const contextId = await resolveContextId(webui!, token, printer.serial);
    await waitForAppReady(webui!, token, contextId);

    await assignSlotSpool(webui!, token, contextId, 1, SLOT_1_SPOOL);

    await seedStoredFile('stored-multi.3mf', {
      gcodeToolCnt: 2,
      totalFilamentWeight: 190,
      useMatlStation: true,
    });
    await startStoredJobViaApp(contextId, 'stored-multi.3mf');

    await driveToPrinting(printer);
    await completePrint();

    const sidecarRequests = await sidecar.requests();
    expect(sidecarRequests).toHaveLength(0);

    await clearPlatform(printer);
  });

  test('leaves stored prints untracked when no slot has a spool assigned', async () => {
    await sidecar.reset();
    const contextId = await resolveContextId(webui!, token, printer.serial);
    await waitForAppReady(webui!, token, contextId);

    await assignSlotSpool(webui!, token, contextId, 1, null);

    await seedStoredFile('stored-nospool.3mf', {
      gcodeToolCnt: 1,
      totalFilamentWeight: 130,
      useMatlStation: true,
    });
    await startStoredJobViaApp(contextId, 'stored-nospool.3mf');

    await driveToPrinting(printer);
    await completePrint();

    const sidecarRequests = await sidecar.requests();
    expect(sidecarRequests).toHaveLength(0);

    await clearPlatform(printer);
  });

  test('leaves stored prints untracked when two slots have spools assigned', async () => {
    await sidecar.reset();
    const contextId = await resolveContextId(webui!, token, printer.serial);
    await waitForAppReady(webui!, token, contextId);

    await assignSlotSpool(webui!, token, contextId, 1, SLOT_1_SPOOL);
    await assignSlotSpool(webui!, token, contextId, 2, SLOT_2_SPOOL);

    await seedStoredFile('stored-twospools.3mf', {
      gcodeToolCnt: 1,
      totalFilamentWeight: 130,
      useMatlStation: true,
    });
    await startStoredJobViaApp(contextId, 'stored-twospools.3mf');

    await driveToPrinting(printer);
    await completePrint();

    const sidecarRequests = await sidecar.requests();
    expect(sidecarRequests).toHaveLength(0);

    await clearPlatform(printer);
  });
});

// ============================================================================
// 5M regression — single-spool path must stay behaviorally identical
// ============================================================================

test.describe('Spoolman single-tool regression (Adventurer 5M Pro)', () => {
  test.skip(!sidecarAvailable, sidecarSkipReason);
  test.describe.configure({ mode: 'serial' });

  const printer: HeadlessPrinter = {
    label: 'Adventurer 5M Pro (emulated)',
    model: 'adventurer-5m-pro',
    serial: 'E2E-SPOOL-5MPRO',
    checkCode: '123',
    machineName: 'E2E-Spool-5MPro',
    tcpPort: 8899,
    httpPort: 8898,
  };

  let sidecar: SpoolmanSidecar;
  let webui: HeadlessWebUI | null = null;
  let token = '';

  test.beforeAll(async () => {
    sidecar = await startSpoolmanSidecar();
    webui = await startHeadlessWebUI({
      printers: [printer],
      configOverrides: {
        SpoolmanEnabled: true,
        SpoolmanServerUrl: sidecar.baseUrl,
        SpoolmanUpdateMode: 'weight',
      },
      emulatorSimulationMode: 'auto',
    });
    token = await fetchApiToken(webui);
  });

  test.afterAll(async () => {
    await webui?.stop();
    await sidecar?.stop();
  });

  test('single-tool completion deducts exactly once on the active spool', async () => {
    await sidecar.reset();
    const contextId = await resolveContextId(webui!, token, printer.serial);
    await waitForAppReady(webui!, token, contextId);

    // The legacy flow: one active spool for the whole context.
    const select = await postJson<{ success?: boolean; error?: string }>(
      webui!,
      token,
      '/api/spoolman/select',
      { contextId, spoolId: 3 }
    );
    expect(select.error).toBeUndefined();

    await uploadAndStart(webui!, token, contextId, SINGLE_TOOL_GCODE);

    await driveToPrinting(printer);
    // Pin a known progress so the backend's filament-usage cache captures a
    // deterministic value (EstWeight = 96 g × progress while printing; the
    // cached value is reused at completion).
    await emulatorSimulate(printer, { action: 'jump', percent: 50 });
    await sleep(POLL_CYCLE_MS);
    await emulatorSimulate(printer, { action: 'jump', percent: 100 });

    // The single-spool tracker PUTs the printer-reported weight exactly once.
    const bySpool = await waitForSidecarCalls(sidecar, 1, webui);
    expect([...bySpool.keys()]).toEqual([3]);
    expect(Math.abs((bySpool.get(3) ?? 0) - EMULATOR_HALF_WEIGHT_G)).toBeLessThanOrEqual(
      G_TOLERANCE
    );
  });
});
