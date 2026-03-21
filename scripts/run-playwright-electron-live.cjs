#!/usr/bin/env node

/**
 * @fileoverview Wrapper script that builds FlashForgeUI and runs the live Electron
 * Playwright smoke test against the local desktop environment.
 */

const { spawnSync } = require('node:child_process');

const env = {
  ...process.env,
  FFUI_E2E_LIVE: '1',
};

const buildResult = spawnSync('pnpm', ['run', 'build'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const testResult = spawnSync('pnpm', ['exec', 'playwright', 'test', '-c', 'playwright.electron.config.ts'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

process.exit(testResult.status ?? 1);
