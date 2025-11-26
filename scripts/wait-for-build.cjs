/**
 * Wait for initial build to complete before starting Electron
 *
 * This script monitors the lib/ and dist/renderer/ directories to ensure
 * both the main and renderer processes have been built before launching
 * Electron in development mode.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const LIB_DIR = path.join(__dirname, '..', 'lib');
const RENDERER_DIR = path.join(__dirname, '..', 'dist', 'renderer');
const MAIN_ENTRY = path.join(LIB_DIR, 'index.js');
const RENDERER_ENTRY = path.join(RENDERER_DIR, 'index.html');

let electronProcess = null;
let isFirstBuild = true;

function checkBuildReady() {
  const mainReady = fs.existsSync(MAIN_ENTRY);
  const rendererReady = fs.existsSync(RENDERER_ENTRY);

  return mainReady && rendererReady;
}

function startElectron() {
  if (electronProcess) {
    console.log('\n[electron:wait] Restarting Electron due to main process changes...');
    electronProcess.removeAllListeners('exit');
    electronProcess.kill();
  }

  console.log('[electron:wait] Starting Electron...\n');

  electronProcess = spawn('electron', ['.'], {
    stdio: 'inherit',
    shell: true
  });

  electronProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.log(`\n[electron:wait] Electron exited with code ${code}`);
    }
    electronProcess = null;
  });
}

function watchForChanges() {
  // Watch main process entry point for changes
  fs.watch(LIB_DIR, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.js') && electronProcess) {
      // Debounce restarts
      clearTimeout(watchForChanges.restartTimer);
      watchForChanges.restartTimer = setTimeout(() => {
        startElectron();
      }, 500);
    }
  });
}

function waitAndStart() {
  if (checkBuildReady()) {
    if (isFirstBuild) {
      console.log('[electron:wait] Initial build complete!\n');
      isFirstBuild = false;
      startElectron();
      watchForChanges();
    }
  } else {
    if (isFirstBuild) {
      process.stdout.write('\r[electron:wait] Waiting for initial build...');
    }
    setTimeout(waitAndStart, 500);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  if (electronProcess) {
    electronProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (electronProcess) {
    electronProcess.kill();
  }
  process.exit(0);
});

console.log('[electron:wait] Monitoring build output...');
waitAndStart();
