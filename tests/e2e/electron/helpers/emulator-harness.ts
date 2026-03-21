/**
 * @fileoverview Helper utilities for launching and controlling flashforge-emulator-v2 instances
 * during Electron Playwright runs, including isolated profiles and readiness checks.
 */

import { type ChildProcessByStdio, spawn, spawnSync } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import type { Readable } from 'node:stream';

const EMULATOR_READY_TOKEN = 'EMULATOR_READY';
const DEFAULT_START_TIMEOUT_MS = 30_000;
const DEFAULT_HEALTH_TIMEOUT_MS = 20_000;
const DEFAULT_HTTP_TIMEOUT_MS = 10_000;
const HEALTH_POLL_INTERVAL_MS = 250;
const PROCESS_EXIT_TIMEOUT_MS = 5_000;

export type EmulatorModel = 'adventurer-3' | 'adventurer-4' | 'adventurer-5m' | 'adventurer-5m-pro' | 'adventurer-5x';

type SimulationMode = 'auto' | 'manual';

export interface EmulatorInstanceConfig {
  instanceId: string;
  model: EmulatorModel;
  serial: string;
  checkCode: string;
  machineName: string;
  tcpPort: number;
  httpPort: number;
  discoveryEnabled: boolean;
  simulationMode?: SimulationMode;
  simulationSpeed?: number;
}

export interface EmulatorReadyPayload {
  instanceId: string;
  ip: string;
  tcpPort: number;
  httpPort: number;
  serial: string;
  model: string;
}

export interface EmulatorAuthConfig {
  httpPort: number;
  serial: string;
  checkCode: string;
}

export interface EmulatorMaterialMapping {
  toolId: number;
  slotId: number;
  materialName: string;
  toolMaterialColor: string;
  slotMaterialColor: string;
}

export interface EmulatorDetailPayload {
  status: string;
  lightStatus: 'open' | 'close';
  printFileName: string;
  externalFanStatus: 'open' | 'close';
  internalFanStatus: 'open' | 'close';
}

interface WaitForReadyResult {
  readyPayloads: EmulatorReadyPayload[];
  stdoutLines: string[];
  stderrLines: string[];
}

interface HealthPayload {
  ok: boolean;
}

interface DetailResponsePayload {
  code: number;
  message: string;
  detail?: EmulatorDetailPayload;
}

interface StartHarnessResult {
  readyPayloads: EmulatorReadyPayload[];
  stop: () => Promise<void>;
}

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const formatLogTail = (lines: readonly string[], maxLines = 20): string => {
  if (lines.length === 0) {
    return '(no output)';
  }

  return lines.slice(-maxLines).join('\n');
};

const getNpmCommand = (): string => {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const resolveEmulatorRoot = (): string => {
  const fromEnv = process.env.FF_EMULATOR_ROOT?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return path.resolve(fromEnv);
  }

  return path.resolve(process.cwd(), '..', 'flashforge-emulator-v2');
};

const assertEmulatorRoot = async (emulatorRoot: string): Promise<void> => {
  const packageJsonPath = path.join(emulatorRoot, 'package.json');
  try {
    await access(packageJsonPath);
  } catch {
    throw new Error(
      `Unable to locate flashforge-emulator-v2 package.json at ${packageJsonPath}. Set FF_EMULATOR_ROOT to the emulator repo path.`
    );
  }
};

const buildInstanceArgs = (instance: EmulatorInstanceConfig): string[] => {
  return [
    '--instance-id',
    instance.instanceId,
    '--model',
    instance.model,
    '--serial',
    instance.serial,
    '--check-code',
    instance.checkCode,
    '--machine-name',
    instance.machineName,
    '--tcp-port',
    String(instance.tcpPort),
    '--http-port',
    String(instance.httpPort),
    '--discovery-enabled',
    String(instance.discoveryEnabled),
    '--simulation-mode',
    instance.simulationMode ?? 'auto',
    '--simulation-speed',
    String(instance.simulationSpeed ?? 100),
  ];
};

const spawnEmulatorProcess = (
  emulatorRoot: string,
  args: readonly string[]
): ChildProcessByStdio<null, Readable, Readable> => {
  const child = spawn(getNpmCommand(), args, {
    cwd: emulatorRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    windowsHide: true,
  }) as ChildProcessByStdio<null, Readable, Readable>;

  return child;
};

const waitForReady = async (params: {
  child: ChildProcessByStdio<null, Readable, Readable>;
  expectedReadyCount: number;
  timeoutMs: number;
  label: string;
}): Promise<WaitForReadyResult> => {
  const { child, expectedReadyCount, timeoutMs, label } = params;

  return await new Promise<WaitForReadyResult>((resolve, reject) => {
    const readyPayloads: EmulatorReadyPayload[] = [];
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const stdoutReader = readline.createInterface({ input: child.stdout });
    const stderrReader = readline.createInterface({ input: child.stderr });

    let expectingReadyJson = false;
    let settled = false;

    const cleanup = (): void => {
      clearTimeout(timeoutId);
      stdoutReader.close();
      stderrReader.close();
      child.off('error', handleError);
      child.off('exit', handleExit);
    };

    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    const fail = (message: string): void => {
      finish(() => {
        reject(
          new Error(
            `${label} failed: ${message}\n--- stdout ---\n${formatLogTail(stdoutLines)}\n--- stderr ---\n${formatLogTail(stderrLines)}`
          )
        );
      });
    };

    const handleError = (error: Error): void => {
      fail(`process error: ${error.message}`);
    };

    const handleExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (readyPayloads.length >= expectedReadyCount) {
        finish(() => {
          resolve({ readyPayloads, stdoutLines, stderrLines });
        });
        return;
      }

      fail(`process exited before readiness (code=${String(code)}, signal=${String(signal)})`);
    };

    const timeoutId = setTimeout(() => {
      fail(`timed out waiting for readiness after ${timeoutMs}ms`);
    }, timeoutMs);

    stdoutReader.on('line', (line) => {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        stdoutLines.push(trimmed);
      }

      if (expectingReadyJson) {
        expectingReadyJson = false;
        try {
          const payload = JSON.parse(trimmed) as EmulatorReadyPayload;
          readyPayloads.push(payload);
        } catch {
          fail(`invalid JSON after ${EMULATOR_READY_TOKEN}: ${trimmed}`);
          return;
        }

        if (readyPayloads.length >= expectedReadyCount) {
          finish(() => {
            resolve({ readyPayloads, stdoutLines, stderrLines });
          });
        }
        return;
      }

      if (trimmed === EMULATOR_READY_TOKEN) {
        expectingReadyJson = true;
      }
    });

    stderrReader.on('line', (line) => {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        stderrLines.push(trimmed);
      }
    });

    child.on('error', handleError);
    child.on('exit', handleExit);
  });
};

const waitForHealthReady = async (httpPort: number, timeoutMs: number): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let lastError: string | null = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${httpPort}/__health`);
      if (response.ok) {
        const payload = (await response.json()) as HealthPayload;
        if (payload.ok === true) {
          return;
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(HEALTH_POLL_INTERVAL_MS);
  }

  throw new Error(`Health endpoint did not become ready for httpPort=${httpPort}. Last error: ${lastError ?? 'none'}`);
};

const waitForChildExit = async (
  child: ChildProcessByStdio<null, Readable, Readable>,
  timeoutMs: number
): Promise<void> => {
  if (child.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      child.off('exit', onExit);
      clearTimeout(timeoutId);
      resolve();
    };

    const onExit = (): void => {
      finish();
    };

    const timeoutId = setTimeout(() => {
      finish();
    }, timeoutMs);

    child.on('exit', onExit);
  });
};

const stopProcessTree = async (child: ChildProcessByStdio<null, Readable, Readable>): Promise<void> => {
  if (child.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
    });
    await waitForChildExit(child, PROCESS_EXIT_TIMEOUT_MS);
    return;
  }

  child.kill('SIGTERM');
  await waitForChildExit(child, PROCESS_EXIT_TIMEOUT_MS);

  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await waitForChildExit(child, PROCESS_EXIT_TIMEOUT_MS);
  }
};

const createHarnessResult = (
  child: ChildProcessByStdio<null, Readable, Readable>,
  readyPayloads: EmulatorReadyPayload[],
  cleanup: (() => Promise<void>) | null = null
): StartHarnessResult => {
  return {
    readyPayloads,
    stop: async () => {
      await stopProcessTree(child);
      if (cleanup) {
        await cleanup();
      }
    },
  };
};

export const startEmulatorInstance = async (params: {
  instance: EmulatorInstanceConfig;
  startupTimeoutMs?: number;
  healthTimeoutMs?: number;
}): Promise<StartHarnessResult> => {
  const emulatorRoot = resolveEmulatorRoot();
  await assertEmulatorRoot(emulatorRoot);

  const startupTimeoutMs = params.startupTimeoutMs ?? DEFAULT_START_TIMEOUT_MS;
  const healthTimeoutMs = params.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;

  const args = ['run', 'headless:instance', '--', ...buildInstanceArgs(params.instance)];
  const child = spawnEmulatorProcess(emulatorRoot, args);

  const readiness = await waitForReady({
    child,
    expectedReadyCount: 1,
    timeoutMs: startupTimeoutMs,
    label: 'Single-instance emulator',
  });

  await waitForHealthReady(readiness.readyPayloads[0].httpPort, healthTimeoutMs);

  return createHarnessResult(child, readiness.readyPayloads);
};

export const startEmulatorSupervisor = async (params: {
  instances: readonly EmulatorInstanceConfig[];
  startupTimeoutMs?: number;
  healthTimeoutMs?: number;
}): Promise<StartHarnessResult> => {
  const emulatorRoot = resolveEmulatorRoot();
  await assertEmulatorRoot(emulatorRoot);

  const startupTimeoutMs = params.startupTimeoutMs ?? DEFAULT_START_TIMEOUT_MS;
  const healthTimeoutMs = params.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ffui-emulator-supervisor-'));
  const configPath = path.join(tempDir, 'instances.json');
  await writeFile(configPath, JSON.stringify({ instances: params.instances }, null, 2), 'utf-8');

  const args = ['run', 'headless:supervisor', '--', '--config', configPath];
  const child = spawnEmulatorProcess(emulatorRoot, args);

  const readiness = await waitForReady({
    child,
    expectedReadyCount: params.instances.length,
    timeoutMs: startupTimeoutMs,
    label: 'Multi-instance emulator supervisor',
  });

  await Promise.all(
    readiness.readyPayloads.map(async (readyPayload) => {
      await waitForHealthReady(readyPayload.httpPort, healthTimeoutMs);
    })
  );

  return createHarnessResult(child, readiness.readyPayloads, async () => {
    await rm(tempDir, { recursive: true, force: true });
  });
};

export const fetchEmulatorDetail = async (
  params: EmulatorAuthConfig & { timeoutMs?: number }
): Promise<EmulatorDetailPayload> => {
  const timeoutMs = params.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
  const response = await fetchWithTimeout(
    `http://127.0.0.1:${params.httpPort}/detail`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        serialNumber: params.serial,
        checkCode: params.checkCode,
      }),
    },
    timeoutMs
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch /detail (status=${response.status})`);
  }

  const payload = (await response.json()) as DetailResponsePayload;
  if (payload.code !== 0 || !payload.detail) {
    throw new Error(`Failed to fetch /detail (code=${payload.code}, message=${payload.message})`);
  }

  return payload.detail;
};

export const waitForEmulatorDetail = async (
  params: EmulatorAuthConfig & {
    predicate: (detail: EmulatorDetailPayload) => boolean;
    description: string;
    timeoutMs?: number;
    pollIntervalMs?: number;
  }
): Promise<EmulatorDetailPayload> => {
  const timeoutMs = params.timeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
  const pollIntervalMs = params.pollIntervalMs ?? HEALTH_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;
  let lastDetail: EmulatorDetailPayload | null = null;
  let lastError: string | null = null;

  while (Date.now() < deadline) {
    try {
      const detail = await fetchEmulatorDetail(params);
      lastDetail = detail;
      if (params.predicate(detail)) {
        return detail;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Timed out waiting for emulator detail condition: ${params.description}. Last detail: ${
      lastDetail ? JSON.stringify(lastDetail) : 'none'
    }. Last error: ${lastError ?? 'none'}`
  );
};

export const seedEmulatorRecentFile = async (
  params: EmulatorAuthConfig & {
    fileName: string;
    gcodeContent?: string;
    gcodeToolCnt?: number;
    useMatlStation?: boolean;
    materialMappings?: readonly EmulatorMaterialMapping[];
    timeoutMs?: number;
  }
): Promise<void> => {
  const timeoutMs = params.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
  const materialMappings = params.materialMappings ? [...params.materialMappings] : [];
  const resolvedToolCount = params.gcodeToolCnt ?? (materialMappings.length > 0 ? materialMappings.length : 0);
  const useMatlStation = params.useMatlStation ?? materialMappings.length > 0;
  const materialMappingsBase64 = Buffer.from(JSON.stringify(materialMappings), 'utf-8').toString('base64');
  const gcodeContent =
    params.gcodeContent ??
    [
      ';FLAVOR:Marlin',
      ';TIME:1200',
      ';Layer height:0.2',
      'G90',
      'G28',
      'M104 S210',
      'M140 S60',
      'G1 X10 Y10 Z0.3 F3000',
      'G1 X100 Y100 E5 F1200',
      'M104 S0',
      'M140 S0',
      'M84',
    ].join('\n');

  const formData = new FormData();
  const fileBlob = new Blob([gcodeContent], { type: 'text/plain' });
  formData.set('gcodeFile', fileBlob, params.fileName);

  const response = await fetchWithTimeout(
    `http://127.0.0.1:${params.httpPort}/uploadGcode`,
    {
      method: 'POST',
      headers: {
        serialNumber: params.serial,
        checkCode: params.checkCode,
        printNow: 'false',
        levelingBeforePrint: 'false',
        flowCalibration: 'false',
        useMatlStation: String(useMatlStation),
        gcodeToolCnt: String(resolvedToolCount),
        materialMappings: materialMappingsBase64,
      },
      body: formData,
    },
    timeoutMs
  );

  if (!response.ok) {
    throw new Error(`Failed to seed emulator file (status=${response.status})`);
  }

  const payload = (await response.json()) as { code: number; message: string };
  if (payload.code !== 0) {
    throw new Error(`Failed to seed emulator file (code=${payload.code}, message=${payload.message})`);
  }
};
