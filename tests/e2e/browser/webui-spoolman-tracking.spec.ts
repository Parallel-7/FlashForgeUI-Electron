/**
 * @fileoverview E2E coverage for per-job Spoolman tracking on the headless
 * WebUI (GitHub FlashForgeWebUI#21).
 *
 * The user picks a spool for each tool in the matching dialog; the choice
 * belongs to that one print. Scenarios on material-station printers:
 * - Completion charges each chosen spool its full slicer estimate.
 * - Cancel at 40% charges each tool from the per-tool usage curve of the
 *   fixture's gcode (tool 0 prints the first half of the file, tool 2 the
 *   second half, so tool 2 is charged nothing).
 * - Pause/resume charges nothing; completion afterwards charges in full.
 * - "Do not track", an upload without spool choices, and a reprint started
 *   on the printer itself charge nothing for those tools.
 * - Creator 5 Pro and AD5X parity; AD5X stored files started through the
 *   matching dialog are charged from the printer's per-tool data.
 * - 5M Pro regression: the single-spool flow is unchanged.
 *
 * Runs against real flashforge-emulator-v2 instances plus the Spoolman
 * sidecar from the emulator checkout. Skips when the sidecar script is
 * unavailable. Expected amounts come from two-tool-toolchange.expected.json,
 * which the fixture generator computes independently of the app.
 */

import { readFileSync } from 'fs';
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
const TWO_TOOL_FIXTURE = 'two-tool-toolchange.3mf';
const SINGLE_TOOL_GCODE = 'adventurer5m-single-color.gcode';

interface ExpectedTool {
  usedG: number;
  gramsAt40: number;
}
const EXPECTED = JSON.parse(
  readFileSync(path.join(FIXTURES_DIR, 'two-tool-toolchange.expected.json'), 'utf8')
) as { tools: Record<'0' | '2', ExpectedTool> };
const TOOL_0 = EXPECTED.tools['0'];
const TOOL_2 = EXPECTED.tools['2'];

const SPOOL_A = 1;
const SPOOL_B = 2;
/** Emulator's fixed total filament weight for the single-tool regression. */
const EMULATOR_FULL_WEIGHT_G = 96;
const EMULATOR_HALF_WEIGHT_G = EMULATOR_FULL_WEIGHT_G * 0.5;
const G_TOLERANCE = 0.15;
const POLL_CYCLE_MS = 4500;

/** Tool→slot mapping the matching dialog sends: filaments 1 and 3 print with T0 and T2. */
const MAPPINGS = [
  { toolId: 0, slotId: 1, materialName: 'PLA', toolMaterialColor: '#4DA3FF', slotMaterialColor: '#4DA3FF' },
  { toolId: 2, slotId: 2, materialName: 'PETG', toolMaterialColor: '#FF8A3D', slotMaterialColor: '#FF8A3D' },
];

const BOTH_SPOOLS = [
  { toolId: 0, spoolId: SPOOL_A },
  { toolId: 2, spoolId: SPOOL_B },
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
  // Let one app poll cycle see the job print, as a real print always does.
  await sleep(POLL_CYCLE_MS);
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

const uploadAndStart = async (
  webui: HeadlessWebUI,
  token: string,
  contextId: string,
  options: {
    fileName?: string;
    materialMappings?: unknown;
    spoolAssignments?: ReadonlyArray<{ toolId: number; spoolId: number | null }>;
    startNow?: boolean;
  } = {}
): Promise<string> => {
  const fileName = options.fileName ?? TWO_TOOL_FIXTURE;
  const stage = await postRaw<StagePayload>(
    webui,
    token,
    `/api/jobs/upload/stage?contextId=${contextId}&filename=${encodeURIComponent(fileName)}`,
    await fs.readFile(path.join(FIXTURES_DIR, fileName)),
    fileName
  );
  expect(stage.error).toBeUndefined();
  const start = await postJson<StartPayload>(webui, token, `/api/jobs/upload/start?contextId=${contextId}`, {
    uploadId: stage.uploadId,
    startNow: options.startNow ?? true,
    autoLevel: false,
    ...(options.materialMappings ? { materialMappings: options.materialMappings } : {}),
    ...(options.spoolAssignments ? { spoolAssignments: options.spoolAssignments } : {}),
  });
  expect(start.error).toBeUndefined();
  return start.fileName ?? fileName;
};

/** Start a file already on the printer directly, bypassing the app. */
const startOnPrinter = async (printer: HeadlessPrinter, fileName: string): Promise<void> => {
  const response = await fetch(`http://127.0.0.1:${String(printer.httpPort)}/printGcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serialNumber: printer.serial,
      checkCode: printer.checkCode,
      fileName,
      levelingBeforePrint: false,
    }),
  });
  expect(response.ok).toBe(true);
  expect(((await response.json()) as { code?: number }).code).toBe(0);
};

const expectCharge = (charges: Map<number, number>, spoolId: number, grams: number): void => {
  const charged = charges.get(spoolId) ?? 0;
  expect(Math.abs(charged - grams), `spool ${String(spoolId)}: charged ${String(charged)} g`).toBeLessThanOrEqual(
    G_TOLERANCE
  );
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
// Creator 5 — per-job scenarios
// ============================================================================

const startSuite = async (printers: HeadlessPrinter[]) => {
  const sidecar = await startSpoolmanSidecar();
  const webui = await startHeadlessWebUI({
    printers,
    configOverrides: {
      SpoolmanEnabled: true,
      SpoolmanServerUrl: sidecar.baseUrl,
      SpoolmanUpdateMode: 'weight',
    },
    emulatorSimulationMode: 'auto',
  });
  const token = await fetchApiToken(webui);
  return { sidecar, webui, token };
};

const cancelPrint = async (webui: HeadlessWebUI, token: string, contextId: string): Promise<void> => {
  const cancel = await postJson<{ success?: boolean; error?: string }>(
    webui,
    token,
    `/api/printer/control/cancel?contextId=${contextId}`,
    {}
  );
  expect(cancel.error).toBeUndefined();
};

test.describe('Spoolman per-job tracking (Creator 5)', () => {
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
  let contextId = '';

  test.beforeAll(async () => {
    ({ sidecar, webui, token } = await startSuite([printer]));
    contextId = await resolveContextId(webui, token, printer.serial);
  });

  test.afterAll(async () => {
    await webui?.stop();
    await sidecar?.stop();
  });

  test('completion charges each chosen spool its full estimate', async () => {
    await sidecar.reset();
    await waitForAppReady(webui!, token, contextId);
    await uploadAndStart(webui!, token, contextId, { materialMappings: MAPPINGS, spoolAssignments: BOTH_SPOOLS });
    await driveToPrinting(printer);
    await emulatorSimulate(printer, { action: 'jump', percent: 100 });

    const charges = await waitForSidecarCalls(sidecar, 2, webui);
    expectCharge(charges, SPOOL_A, TOOL_0.usedG);
    expectCharge(charges, SPOOL_B, TOOL_2.usedG);
    await clearPlatform(printer);
  });

  test('cancel at 40% charges each tool from its own usage curve', async () => {
    await sidecar.reset();
    await waitForAppReady(webui!, token, contextId);
    await uploadAndStart(webui!, token, contextId, { materialMappings: MAPPINGS, spoolAssignments: BOTH_SPOOLS });
    await driveToPrinting(printer);
    await emulatorSimulate(printer, { action: 'jump', percent: 40 });
    await sleep(POLL_CYCLE_MS);
    await cancelPrint(webui!, token, contextId);

    // Tool 2 prints only the second half of the file: nothing to charge.
    const charges = await waitForSidecarCalls(sidecar, 1, webui);
    expectCharge(charges, SPOOL_A, TOOL_0.gramsAt40);
    expect(charges.has(SPOOL_B)).toBe(false);
    await clearPlatform(printer);
  });

  test('pause and resume charge nothing; completion afterwards charges in full', async () => {
    await sidecar.reset();
    await waitForAppReady(webui!, token, contextId);
    await uploadAndStart(webui!, token, contextId, { materialMappings: MAPPINGS, spoolAssignments: BOTH_SPOOLS });
    await driveToPrinting(printer);
    await emulatorSimulate(printer, { action: 'jump', percent: 25 });

    const pause = await postJson<{ error?: string }>(webui!, token, `/api/printer/control/pause?contextId=${contextId}`, {});
    expect(pause.error).toBeUndefined();
    await waitForAppState(webui!, token, contextId, 'paused');
    const resume = await postJson<{ error?: string }>(webui!, token, `/api/printer/control/resume?contextId=${contextId}`, {});
    expect(resume.error).toBeUndefined();
    await waitForAppState(webui!, token, contextId, 'printing');
    await sleep(POLL_CYCLE_MS);
    expect(await sidecar.requests()).toHaveLength(0);

    await emulatorSimulate(printer, { action: 'jump', percent: 100 });
    const charges = await waitForSidecarCalls(sidecar, 2, webui);
    expectCharge(charges, SPOOL_A, TOOL_0.usedG);
    expectCharge(charges, SPOOL_B, TOOL_2.usedG);
    await clearPlatform(printer);
  });

  test('"Do not track" leaves that tool uncharged', async () => {
    await sidecar.reset();
    await waitForAppReady(webui!, token, contextId);
    await uploadAndStart(webui!, token, contextId, {
      materialMappings: MAPPINGS,
      spoolAssignments: [
        { toolId: 0, spoolId: SPOOL_A },
        { toolId: 2, spoolId: null },
      ],
    });
    await driveToPrinting(printer);
    await emulatorSimulate(printer, { action: 'jump', percent: 100 });

    const charges = await waitForSidecarCalls(sidecar, 1, webui);
    expectCharge(charges, SPOOL_A, TOOL_0.usedG);
    await clearPlatform(printer);
  });

  test('an upload without spool choices is not tracked', async () => {
    await sidecar.reset();
    await waitForAppReady(webui!, token, contextId);
    await uploadAndStart(webui!, token, contextId, { materialMappings: MAPPINGS });
    await driveToPrinting(printer);
    await emulatorSimulate(printer, { action: 'jump', percent: 100 });
    await sleep(POLL_CYCLE_MS * 2);
    expect(await sidecar.requests()).toHaveLength(0);
    await clearPlatform(printer);
  });

  test('a reprint of a tracked file started on the printer charges nothing', async () => {
    await sidecar.reset();
    await waitForAppReady(webui!, token, contextId);
    const fileName = await uploadAndStart(webui!, token, contextId, {
      materialMappings: MAPPINGS,
      spoolAssignments: BOTH_SPOOLS,
    });
    await driveToPrinting(printer);
    await emulatorSimulate(printer, { action: 'jump', percent: 100 });
    await waitForSidecarCalls(sidecar, 2, webui);
    await clearPlatform(printer);

    await sidecar.reset();
    await waitForAppReady(webui!, token, contextId);
    await startOnPrinter(printer, fileName);
    await driveToPrinting(printer);
    await emulatorSimulate(printer, { action: 'jump', percent: 100 });
    await sleep(POLL_CYCLE_MS * 2);
    expect(await sidecar.requests()).toHaveLength(0);
    await clearPlatform(printer);
  });
});

// ============================================================================
// Other station models
// ============================================================================

test.describe('Spoolman per-job tracking (station model parity)', () => {
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
    ({ sidecar, webui, token } = await startSuite(printers));
  });

  test.afterAll(async () => {
    await webui?.stop();
    await sidecar?.stop();
  });

  for (const printer of printers) {
    test(`two-tool completion charges both spools (${printer.label})`, async () => {
      await sidecar.reset();
      const contextId = await resolveContextId(webui!, token, printer.serial);
      await waitForAppReady(webui!, token, contextId);
      await uploadAndStart(webui!, token, contextId, { materialMappings: MAPPINGS, spoolAssignments: BOTH_SPOOLS });
      await driveToPrinting(printer);
      await emulatorSimulate(printer, { action: 'jump', percent: 100 });

      const charges = await waitForSidecarCalls(sidecar, 2, webui);
      expectCharge(charges, SPOOL_A, TOOL_0.usedG);
      expectCharge(charges, SPOOL_B, TOOL_2.usedG);
      await clearPlatform(printer);
    });
  }
});

// ============================================================================
// AD5X stored files — started through the matching dialog
// ============================================================================

test.describe('Spoolman per-job tracking (AD5X stored files)', () => {
  test.skip(!sidecarAvailable, sidecarSkipReason);
  test.describe.configure({ mode: 'serial' });

  const printer: HeadlessPrinter = {
    label: 'AD5X (emulated)',
    model: 'adventurer-5x',
    serial: 'E2E-SPOOL-AD5X-STORED',
    checkCode: '123',
    machineName: 'E2E-Spool-AD5X-Stored',
    tcpPort: 8899,
    httpPort: 8898,
  };

  let sidecar: SpoolmanSidecar;
  let webui: HeadlessWebUI | null = null;
  let token = '';
  let contextId = '';
  let storedFile = '';

  test.beforeAll(async () => {
    ({ sidecar, webui, token } = await startSuite([printer]));
    contextId = await resolveContextId(webui, token, printer.serial);
    // Put the file on the printer without starting it; the emulator reports
    // the slicer's per-tool weights for it, as AD5X firmware does.
    storedFile = await uploadAndStart(webui, token, contextId, { materialMappings: MAPPINGS, startNow: false });
  });

  test.afterAll(async () => {
    await webui?.stop();
    await sidecar?.stop();
  });

  const startStored = async (
    spoolAssignments?: ReadonlyArray<{ toolId: number; spoolId: number | null }>
  ): Promise<void> => {
    const payload = await postJson<{ success?: boolean; error?: string }>(
      webui!,
      token,
      `/api/jobs/start?contextId=${contextId}`,
      { filename: storedFile, startNow: true, leveling: false, materialMappings: MAPPINGS, spoolAssignments }
    );
    expect(payload.error).toBeUndefined();
    expect(payload.success).toBe(true);
  };

  test('completion charges the printer-reported weight of each tool', async () => {
    await sidecar.reset();
    await waitForAppReady(webui!, token, contextId);
    await startStored(BOTH_SPOOLS);
    await driveToPrinting(printer);
    await emulatorSimulate(printer, { action: 'jump', percent: 100 });

    const charges = await waitForSidecarCalls(sidecar, 2, webui);
    expectCharge(charges, SPOOL_A, TOOL_0.usedG);
    expectCharge(charges, SPOOL_B, TOOL_2.usedG);
    await clearPlatform(printer);
  });

  test('cancel charges linearly by progress (no gcode on hand)', async () => {
    await sidecar.reset();
    await waitForAppReady(webui!, token, contextId);
    await startStored(BOTH_SPOOLS);
    await driveToPrinting(printer);
    await emulatorSimulate(printer, { action: 'jump', percent: 40 });
    await sleep(POLL_CYCLE_MS);
    await cancelPrint(webui!, token, contextId);

    const charges = await waitForSidecarCalls(sidecar, 2, webui);
    expectCharge(charges, SPOOL_A, TOOL_0.usedG * 0.4);
    expectCharge(charges, SPOOL_B, TOOL_2.usedG * 0.4);
    await clearPlatform(printer);
  });

  test('a stored-file start without spool choices is not tracked', async () => {
    await sidecar.reset();
    await waitForAppReady(webui!, token, contextId);
    await startStored(undefined);
    await driveToPrinting(printer);
    await emulatorSimulate(printer, { action: 'jump', percent: 100 });
    await sleep(POLL_CYCLE_MS * 2);
    expect(await sidecar.requests()).toHaveLength(0);
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

    await uploadAndStart(webui!, token, contextId, { fileName: SINGLE_TOOL_GCODE });

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
