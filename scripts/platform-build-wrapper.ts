/**
 * @fileoverview Wraps platform-specific npm build scripts to add timing output that mirrors electron-builder logs.
 *
 * Accepts a platform argument (win, linux, mac), proxies the existing npm build script,
 * and reports the total duration using a green bullet log format aligned with electron-builder output.
 */

import { spawn } from 'child_process';

type PlatformKey = 'win' | 'linux' | 'mac';
type BuildMode = 'default' | 'ci';

interface PlatformConfig {
  displayName: string;
  scriptName: string;
  ciScriptName: string;
}

const PLATFORM_CONFIG: Record<PlatformKey, PlatformConfig> = {
  win: {
    displayName: 'Windows',
    scriptName: 'build:win:raw',
    ciScriptName: 'build:ci:win:raw',
  },
  linux: {
    displayName: 'Linux',
    scriptName: 'build:linux:raw',
    ciScriptName: 'build:ci:linux:raw',
  },
  mac: {
    displayName: 'macOS',
    scriptName: 'build:mac:raw',
    ciScriptName: 'build:ci:mac:raw',
  },
};

const GREEN = '\u001B[32m';
const RED = '\u001B[31m';
const RESET = '\u001B[0m';
const GREEN_DOT = `${GREEN}•${RESET}`;
const RED_CROSS = `${RED}✖${RESET}`;

function logBullet(message: string): void {
  process.stdout.write(`  ${GREEN_DOT} ${message}\n`);
}

function logError(message: string): void {
  process.stderr.write(`  ${RED_CROSS} ${message}\n`);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }

  return `${(ms / 1000).toFixed(2)}s`;
}

interface ParsedArgs {
  platform: PlatformKey | null;
  mode: BuildMode;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let platform: string | undefined;
  let mode: BuildMode = 'default';

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--platform' && args[i + 1]) {
      platform = args[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--platform=')) {
      platform = arg.split('=')[1];
      continue;
    }

    if (arg === '--mode' && args[i + 1]) {
      mode = parseMode(args[i + 1]);
      i += 1;
      continue;
    }

    if (arg.startsWith('--mode=')) {
      mode = parseMode(arg.split('=')[1]);
      continue;
    }

    if (arg === '--ci') {
      mode = 'ci';
      continue;
    }

    if (!arg.startsWith('--') && !platform) {
      platform = arg;
      continue;
    }
  }

  if (platform && isPlatformKey(platform)) {
    return { platform, mode };
  }

  return { platform: null, mode };
}

function isPlatformKey(value: string): value is PlatformKey {
  return value === 'win' || value === 'linux' || value === 'mac';
}

function parseMode(value: string): BuildMode {
  return value === 'ci' ? 'ci' : 'default';
}

function runNpmScript(scriptName: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(`npm run ${scriptName}`, {
      shell: true,
      stdio: 'inherit',
    });

    child.on('error', reject);

    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`Build process terminated by signal: ${signal}`));
        return;
      }

      resolve(code);
    });
  });
}

async function runPlatformBuild(platform: PlatformKey, mode: BuildMode): Promise<void> {
  const { displayName, scriptName, ciScriptName } = PLATFORM_CONFIG[platform];
  const selectedScript = mode === 'ci' ? ciScriptName : scriptName;
  const label = mode === 'ci' ? 'CI ' : '';
  logBullet(`starting ${displayName} ${label}build via ${selectedScript}`);

  const start = Date.now();
  const exitCode = await runNpmScript(selectedScript);
  const duration = formatDuration(Date.now() - start);

  if (exitCode && exitCode !== 0) {
    logError(`${displayName} ${label}build failed after ${duration} (exit code ${exitCode})`);
    process.exit(exitCode);
    return;
  }

  logBullet(`${displayName} ${label}build complete in ${duration}`);
}

async function main(): Promise<void> {
  const { platform, mode } = parseArgs();

  if (!platform) {
    const supported = Object.keys(PLATFORM_CONFIG).join('|');
    logError(`Missing or invalid platform argument. Usage: node -r ts-node/register scripts/platform-build-wrapper.ts --platform <${supported}> [--ci]`);
    process.exit(1);
    return;
  }

  try {
    await runPlatformBuild(platform, mode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(message);
    process.exit(1);
  }
}

void main();
