#!/usr/bin/env node

/**
 * @fileoverview Builds FlashForgeUI and runs the browser E2E suite against the real
 * headless WebUI server.
 *
 * The suite no longer uses a fixture server: it launches the actual app with `--headless`
 * against emulator printers, so it needs the full build (not just the WebUI assets) and a
 * flashforge-emulator-v2 checkout. Point FF_EMULATOR_ROOT at it if it does not sit beside
 * this checkout.
 *
 * Extra arguments are forwarded to Playwright, e.g.
 *   pnpm test:e2e webui-auth.spec.ts
 */

const { existsSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const defaultEmulatorRoot = path.resolve(process.cwd(), '..', 'flashforge-emulator-v2');

const env = {
  ...process.env,
  FF_EMULATOR_ROOT: process.env.FF_EMULATOR_ROOT || defaultEmulatorRoot,
};

const emulatorPackageJson = path.join(env.FF_EMULATOR_ROOT, 'package.json');
if (!existsSync(emulatorPackageJson)) {
  console.error(`[e2e:browser] Emulator repo not found at: ${env.FF_EMULATOR_ROOT}`);
  console.error('[e2e:browser] Set FF_EMULATOR_ROOT to the flashforge-emulator-v2 repo path.');
  process.exit(1);
}

const passthroughArgs = process.argv.slice(2);

// The suite launches `electron .`, which runs out/main/index.js, so the main and renderer
// bundles have to exist - building only the WebUI assets is not enough.
const buildResult = spawnSync('pnpm', ['run', 'build'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
  windowsHide: true,
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const testResult = spawnSync('pnpm', ['exec', 'playwright', 'test', ...passthroughArgs], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
  windowsHide: true,
});

process.exit(testResult.status ?? 1);
