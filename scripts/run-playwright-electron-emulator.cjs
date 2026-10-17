#!/usr/bin/env node

/**
 * @fileoverview Builds FlashForgeUI and runs the Electron E2E suite against the
 * emulator track.
 *
 * The emulator track boots flashforge-emulator-v2 instances, so it needs no printers on
 * the network and is the track CI runs. The emulator repo is external; point
 * FF_EMULATOR_ROOT at it if it does not sit beside this checkout.
 *
 * Extra arguments are forwarded to Playwright, e.g.
 *   pnpm test:e2e:electron:emulator specs/led.spec.ts
 */

const { existsSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const defaultEmulatorRoot = path.resolve(process.cwd(), '..', 'flashforge-emulator-v2');

const env = {
  ...process.env,
  FFUI_E2E_TRACK: 'emulator',
  FF_EMULATOR_ROOT: process.env.FF_EMULATOR_ROOT || defaultEmulatorRoot,
};

const emulatorPackageJson = path.join(env.FF_EMULATOR_ROOT, 'package.json');
if (!existsSync(emulatorPackageJson)) {
  console.error(`[e2e:electron:emulator] Emulator repo not found at: ${env.FF_EMULATOR_ROOT}`);
  console.error('[e2e:electron:emulator] Set FF_EMULATOR_ROOT to the flashforge-emulator-v2 repo path.');
  process.exit(1);
}

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
