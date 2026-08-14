/**
 * @fileoverview Minimal HTTP client for asserting printer state during E2E runs.
 *
 * Talks the modern FlashForge HTTP API, which the emulator implements faithfully,
 * so the same client backs both the emulator and hardware tracks. This is an
 * out-of-band observer: tests drive the GUI and then verify the printer actually
 * changed through this client, rather than trusting the UI's own rendering.
 *
 * Also implements the print-safety recovery path. Uploads in this suite always run
 * with "Start Now" unchecked, so a print must never begin - but if one ever does,
 * assertNotPrinting() cancels it and clears the platform rather than leaving a real
 * machine heating unattended.
 *
 * Key exports:
 * - PrinterClient: detail/gcodeList/LED/job-control wrapper
 * - assertNotPrinting(): the post-upload safety gate
 */

export interface PrinterDetail {
  status: string;
  lightStatus: 'open' | 'close';
  printFileName: string;
  [key: string]: unknown;
}

export interface GcodeListEntry {
  gcodeFileName: string;
  gcodeToolCnt?: number;
  useMatlStation?: boolean;
}

/** Machine statuses that mean material is actively being laid down or prepared. */
const ACTIVE_PRINT_STATUSES: readonly string[] = ['printing', 'heating', 'calibrating', 'pausing', 'paused'];

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class PrinterClient {
  readonly #baseUrl: string;
  readonly #auth: { serialNumber: string; checkCode: string };

  constructor(params: { ipAddress: string; httpPort: number; serialNumber: string; checkCode: string }) {
    this.#baseUrl = `http://${params.ipAddress}:${params.httpPort}`;
    this.#auth = { serialNumber: params.serialNumber, checkCode: params.checkCode };
  }

  async #post<T>(endpoint: string, body: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(`${this.#baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...this.#auth, ...body }),
    });

    if (!response.ok) {
      throw new Error(`${endpoint} responded ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }

  async getDetail(): Promise<PrinterDetail> {
    const payload = await this.#post<{ detail?: PrinterDetail }>('/detail');
    if (!payload.detail) {
      throw new Error('/detail response contained no detail object');
    }
    return payload.detail;
  }

  async getGcodeList(): Promise<GcodeListEntry[]> {
    const payload = await this.#post<{ gcodeList?: string[]; gcodeListDetail?: GcodeListEntry[] }>('/gcodeList');
    // AD5X (and the emulator for 5M-family models) reports rich per-file detail;
    // the Creator 5 series firmware returns bare file names only. Fall back to the
    // names array so upload verification works against both shapes.
    if (payload.gcodeListDetail && payload.gcodeListDetail.length > 0) {
      return payload.gcodeListDetail;
    }
    return (payload.gcodeList ?? []).map((name) => ({ gcodeFileName: name }));
  }

  async hasFile(fileName: string): Promise<boolean> {
    const files = await this.getGcodeList();
    return files.some((file) => file.gcodeFileName === fileName);
  }

  async #control(cmd: string, args: Record<string, unknown>): Promise<void> {
    await this.#post('/control', { payload: { cmd, args } });
  }

  async setLight(state: 'open' | 'close'): Promise<void> {
    await this.#control('lightControl_cmd', { status: state });
  }

  async cancelPrint(): Promise<void> {
    await this.#control('jobCtl_cmd', { jobID: '', action: 'cancel' });
  }

  async clearPlatform(): Promise<void> {
    await this.#control('stateCtrl_cmd', { action: 'setClearPlatform' });
  }

  /** Polls until lightStatus matches, returning false if it never does. */
  async waitForLightStatus(expected: 'open' | 'close', timeoutMs = 15_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const detail = await this.getDetail().catch(() => null);
      if (detail?.lightStatus === expected) {
        return true;
      }
      await sleep(500);
    }
    return false;
  }

  async waitForFile(fileName: string, timeoutMs = 60_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.hasFile(fileName).catch(() => false)) {
        return true;
      }
      await sleep(1_000);
    }
    return false;
  }
}

export interface SafetyCheckResult {
  wasPrinting: boolean;
  status: string;
  recovered: boolean;
  notes: string[];
}

/**
 * Verifies no print started after an upload, and recovers the machine if one did.
 *
 * Recovery mirrors the documented manual procedure: cancel the job, wait for the
 * firmware to settle, then clear the platform so the printer accepts control again.
 * The caller is expected to fail the test loudly on wasPrinting - recovery makes the
 * hardware safe, it does not make the run a pass.
 */
export const assertNotPrinting = async (
  client: PrinterClient,
  params?: { settleMs?: number; clearPlatformDelayMs?: number }
): Promise<SafetyCheckResult> => {
  const notes: string[] = [];
  const settleMs = params?.settleMs ?? 5_000;
  const clearPlatformDelayMs = params?.clearPlatformDelayMs ?? 15_000;

  // Give the printer a moment to react before judging - an upload that was going
  // to auto-start would have done so by now.
  await sleep(settleMs);

  const detail = await client.getDetail();
  const status = (detail.status ?? '').toLowerCase();
  const wasPrinting = ACTIVE_PRINT_STATUSES.some((active) => status.includes(active));

  if (!wasPrinting) {
    return { wasPrinting: false, status: detail.status, recovered: true, notes };
  }

  notes.push(`SAFETY: printer entered "${detail.status}" after an upload with Start Now unchecked.`);

  try {
    await client.cancelPrint();
    notes.push('SAFETY: sent jobCtl_cmd cancel.');

    await sleep(clearPlatformDelayMs);

    await client.clearPlatform();
    notes.push('SAFETY: sent stateCtrl_cmd setClearPlatform.');

    const after = await client.getDetail();
    notes.push(`SAFETY: status after recovery is "${after.status}".`);

    return { wasPrinting: true, status: detail.status, recovered: true, notes };
  } catch (error) {
    notes.push(`SAFETY: recovery FAILED - ${error instanceof Error ? error.message : String(error)}`);
    notes.push('SAFETY: the printer may still be printing. Check it physically.');
    return { wasPrinting: true, status: detail.status, recovered: false, notes };
  }
};
