#!/usr/bin/env node

/**
 * @fileoverview Builds FlashForgeUI and runs the Electron E2E suite against the
 * hardware track: the real printers on the developer's bench.
 *
 * This is the pre-release gate. It drives the actual GUI against actual firmware, so it
 * covers what the emulator cannot - real discovery timing, real material-station slot
 * contents, and the SFTP file manager (which needs FlashForge-EasySSH provisioning).
 *
 * Printers are resolved by serial through UDP discovery, so DHCP moving a printer does
 * not break the run. Credentials live outside the repo; see support/hardware-config.ts
 * for the lookup order. Uploads always run with Start Now unchecked and are followed by
 * a safety check that cancels and clears the platform if a print ever starts.
 *
 * Extra arguments are forwarded to Playwright, e.g.
 *   pnpm test:e2e:electron:hardware specs/upload.spec.ts
 */

const { spawnSync } = require('node:child_process');

const env = {
  ...process.env,
  FFUI_E2E_TRACK: 'hardware',
};

const passthroughArgs = process.argv.slice(2);

const buildResult = spawnSync('pnpm', ['run', 'build'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
  windowsHide: true,
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const testResult = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', '-c', 'playwright.electron.config.ts', 'tests/e2e/electron/specs', ...passthroughArgs],
  {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
    windowsHide: true,
  }
);

process.exit(testResult.status ?? 1);
