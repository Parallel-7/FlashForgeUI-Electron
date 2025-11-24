/**
 * Bridges Electron's CommonJS bootstrap to the ESM main entry inside lib/index.js.
 * Ensures Electron (which still requires() the main field) can load the compiled ESM build.
 */

import('./lib/index.js').catch((error) => {
  console.error('[Electron] Failed to load ESM main entry:', error);
  process.exit(1);
});
