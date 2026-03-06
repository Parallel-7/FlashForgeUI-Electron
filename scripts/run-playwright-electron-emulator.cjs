#!/usr/bin/env node

/**
 * @fileoverview Wrapper script that builds FlashForgeUI and then runs the Electron Playwright
 * suite against the external flashforge-emulator-v2 repository.
 */

const { existsSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const defaultEmulatorRoot = path.resolve(process.cwd(), '..', 'flashforge-emulator-v2');

const env = {
  ...process.env,
  FFUI_E2E_EMULATOR: '1',
  FFUI_E2E_EMULATOR_DISCOVERY: process.env.FFUI_E2E_EMULATOR_DISCOVERY || '1',
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
  ['exec', 'playwright', 'test', '-c', 'playwright.electron.config.ts', ...passthroughArgs],
  {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
  windowsHide: true,
  }
);

process.exit(testResult.status ?? 1);
