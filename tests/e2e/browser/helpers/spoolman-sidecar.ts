/**
 * @fileoverview Test harness for the flashforge-emulator-v2 Spoolman mock
 * sidecar (`npm run headless:spoolman`).
 *
 * The sidecar exposes the Spoolman HTTP surface the WebUI talks to
 * (GET /api/v1/spool, GET /api/v1/spool/:id, PUT /api/v1/spool/:id/use)
 * plus test-control endpoints:
 *   GET  /__requests  → ledger of accepted usage PUTs
 *                       [{ spoolId, useWeight, useLength, timestamp }, ...]
 *   POST /__reset     → clear the ledger (spool state is untouched)
 *   POST /__shutdown  → stop the sidecar
 *
 * CI clones the emulator at a pinned version that may predate the sidecar;
 * specs must skip cleanly via {@link isSpoolmanSidecarAvailable} when
 * `scripts/headless/run-spoolman.ts` is absent from the checkout.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { spawn, type ChildProcessByStdio } from 'child_process';
import type { Readable } from 'stream';
import { stopProcessTree } from '../../electron/helpers/emulator-harness';

/** stdout token printed immediately before the ready JSON line. */
const SPOOLMAN_READY_TOKEN = 'SPOOLMAN_READY';

/** Payload of the JSON line following the ready token. */
interface SpoolmanReadyPayload {
  port: number;
  spools: number;
}

/** One accepted usage PUT, as recorded by the sidecar's /__requests ledger. */
export interface SpoolmanUsageRequest {
  spoolId: number;
  useWeight: number | null;
  useLength: number | null;
  timestamp: string;
}

export interface SpoolmanSidecar {
  port: number;
  baseUrl: string;
  /** Accepted usage PUTs so far. */
  requests: () => Promise<SpoolmanUsageRequest[]>;
  /** Clear the usage PUT ledger. */
  reset: () => Promise<void>;
  /** Stop the sidecar process tree. */
  stop: () => Promise<void>;
}

const getNpmCommand = (): string => {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
};

const resolveEmulatorRoot = (): string => {
  const fromEnv = process.env.FF_EMULATOR_ROOT?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return path.resolve(fromEnv);
  }
  return path.resolve(process.cwd(), '..', 'flashforge-emulator-v2');
};

/**
 * Whether the emulator checkout ships the Spoolman sidecar script. Specs
 * should `test.skip(!isSpoolmanSidecarAvailable(), ...)` on this.
 */
export const isSpoolmanSidecarAvailable = (): boolean => {
  try {
    return fs.existsSync(path.join(resolveEmulatorRoot(), 'scripts/headless/run-spoolman.ts'));
  } catch {
    return false;
  }
};

/** Message used by specs when they skip for a missing sidecar. */
export const SPOOLMAN_SIDECAR_SKIP_MESSAGE =
  'requires emulator with spoolman sidecar (scripts/headless/run-spoolman.ts not found)';

/** Grab a free TCP port by binding port 0 and releasing it. */
const getFreePort = async (): Promise<number> => {
  const net = await import('net');
  return await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => {
        resolve(port);
      });
    });
  });
};

const postControl = async (port: number, endpoint: string): Promise<void> => {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`sidecar ${endpoint} failed: ${String(response.status)}`);
  }
  await response.body?.cancel();
};

/**
 * Start the Spoolman mock sidecar on a free port and wait for its ready line.
 *
 * @param options.seed - Optional `--seed` payload (inline JSON array of spools)
 */
export const startSpoolmanSidecar = async (options?: {
  seed?: string;
  startupTimeoutMs?: number;
}): Promise<SpoolmanSidecar> => {
  const emulatorRoot = resolveEmulatorRoot();
  const scriptPath = path.join(emulatorRoot, 'scripts/headless/run-spoolman.ts');
  if (!fs.existsSync(scriptPath)) {
    throw new Error(SPOOLMAN_SIDECAR_SKIP_MESSAGE);
  }

  const port = await getFreePort();
  const args = ['run', 'headless:spoolman', '--', '--port', String(port)];
  if (options?.seed) {
    args.push('--seed', options.seed);
  }

  const child = spawn(getNpmCommand(), args, {
    cwd: emulatorRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    windowsHide: true,
    detached: process.platform !== 'win32',
  }) as ChildProcessByStdio<null, Readable, Readable>;

  const ready = await waitForSpoolmanReady(child, options?.startupTimeoutMs ?? 60_000);

  return {
    port: ready.port,
    baseUrl: `http://127.0.0.1:${ready.port}`,
    requests: async () => {
      const response = await fetch(`http://127.0.0.1:${ready.port}/__requests`);
      if (!response.ok) {
        throw new Error(`sidecar /__requests failed: ${String(response.status)}`);
      }
      const body = (await response.json()) as { requests?: SpoolmanUsageRequest[] };
      return body.requests ?? [];
    },
    reset: async () => {
      await postControl(port, '/__reset');
    },
    stop: async () => {
      try {
        await postControl(port, '/__shutdown');
      } catch {
        // Fall through to tree kill; the process may already be gone.
      }
      await stopProcessTree(child);
    },
  };

  async function waitForSpoolmanReady(
    proc: ChildProcessByStdio<null, Readable, Readable>,
    timeoutMs: number
  ): Promise<SpoolmanReadyPayload> {
    return await new Promise<SpoolmanReadyPayload>((resolve, reject) => {
      const stdoutLines: string[] = [];
      const stderrLines: string[] = [];
      const stdoutReader = readline.createInterface({ input: proc.stdout });
      const stderrReader = readline.createInterface({ input: proc.stderr });
      let expectingJson = false;
      let settled = false;

      const cleanup = (): void => {
        clearTimeout(timer);
        stdoutReader.close();
        stderrReader.close();
        proc.off('error', handleError);
        proc.off('exit', handleExit);
      };
      const fail = (message: string): void => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(
          new Error(
            `spoolman sidecar failed: ${message}\n--- stdout ---\n${stdoutLines.slice(-20).join('\n')}\n--- stderr ---\n${stderrLines.slice(-20).join('\n')}`
          )
        );
      };
      const handleError = (error: Error): void => {
        fail(`process error: ${error.message}`);
      };
      const handleExit = (code: number | null, signal: NodeJS.Signals | null): void => {
        fail(`process exited before readiness (code=${String(code)}, signal=${String(signal)})`);
      };
      const timer = setTimeout(() => {
        fail(`timed out waiting for ${SPOOLMAN_READY_TOKEN} after ${String(timeoutMs)}ms`);
      }, timeoutMs);

      stdoutReader.on('line', (line) => {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          stdoutLines.push(trimmed);
        }
        if (expectingJson) {
          expectingJson = false;
          settled = true;
          cleanup();
          try {
            const payload = JSON.parse(trimmed) as SpoolmanReadyPayload;
            resolve(payload);
          } catch {
            reject(new Error(`invalid JSON after ${SPOOLMAN_READY_TOKEN}: ${trimmed}`));
          }
          return;
        }
        if (trimmed === SPOOLMAN_READY_TOKEN) {
          expectingJson = true;
        }
      });
      stderrReader.on('line', (line) => {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          stderrLines.push(trimmed);
        }
      });
      proc.on('error', handleError);
      proc.on('exit', handleExit);
    });
  }
};
