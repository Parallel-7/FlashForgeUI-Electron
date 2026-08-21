/**
 * @fileoverview Screenshot a dialog or WebUI screen headlessly, without running the app.
 *
 * Serves a static root over a throwaway HTTP server, opens one page in headless
 * Chromium, runs a fixture that fills the DOM with representative data, and
 * writes a PNG. No printer, no Electron, no visible window - the point is to see
 * a layout change in seconds instead of building, launching and clicking through
 * the app to reach the screen.
 *
 * Two kinds of target:
 *   - renderer dialogs (src/renderer/src/ui/...), rendered with a stub theme
 *     because the real variables are injected by the app at runtime
 *   - the built-in WebUI (out/webui/static), which needs "npm run build:webui"
 *
 * Usage:
 *   node scripts/ui-shot.mjs dialog-matching
 *   node scripts/ui-shot.mjs webui-upload --width 420 --height 900
 *   node scripts/ui-shot.mjs --all
 *
 * Add a screen by dropping a fixture in scripts/ui-shot-fixtures/ and listing it
 * in TARGETS below.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const rendererRoot = path.join(repoRoot, 'src', 'renderer', 'src', 'ui');
const webuiRoot = path.join(repoRoot, 'out', 'webui', 'static');

/**
 * Stand-in for the theme variables the app injects into dialog windows at
 * runtime. Values only need to be close enough to judge layout and contrast.
 */
const THEME_STUB = `:root {
  --theme-text: #e8e8e8;
  --theme-primary: #4a86e8;
  --theme-primary-hover: #3a76d8;
  --theme-surface: #1a1a1a;
  --surface-muted: #2a2a2a;
  --surface-elevated: #333333;
  --border-color: #3d3d3d;
  --border-color-light: #4a4a4a;
  --border-color-focus: #4a86e8;
  --warning-color: #e8a33d;
  --error-color: #e05252;
  --accent-color: #4a86e8;
  --button-bg: #4a86e8;
  --container-bg-color: #1e1e1e;
}
body { background: #1e1e1e; color: #e8e8e8; margin: 0; }`;

/** Screens this harness knows how to render. */
const TARGETS = {
  'dialog-uploader': {
    root: rendererRoot,
    page: 'job-uploader/job-uploader.html',
    fixture: 'dialog-uploader.mjs',
    theme: THEME_STUB,
    viewport: { width: 950, height: 820 },
  },
  'dialog-matching': {
    root: rendererRoot,
    page: 'material-matching-dialog/material-matching-dialog.html',
    fixture: 'dialog-matching.mjs',
    theme: THEME_STUB,
    viewport: { width: 900, height: 800 },
  },
  'webui-upload': {
    root: webuiRoot,
    page: 'index.html',
    fixture: 'upload.mjs',
    clip: '#job-upload-modal .modal-content',
  },
  'webui-matching': {
    root: webuiRoot,
    page: 'index.html',
    fixture: 'matching.mjs',
    clip: '#material-matching-modal .modal-content',
  },
};

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function parseArgs(argv) {
  const options = { targets: [], out: null, width: null, height: null };

  let index = 0;

  while (index < argv.length) {
    const arg = argv[index];
    index += 1;

    if (arg === '--all') {
      options.targets = Object.keys(TARGETS);
    } else if (arg === '--out') {
      options.out = argv[index];
      index += 1;
    } else if (arg === '--width') {
      options.width = Number(argv[index]);
      index += 1;
    } else if (arg === '--height') {
      options.height = Number(argv[index]);
      index += 1;
    } else if (!arg.startsWith('-')) {
      options.targets.push(arg);
    }
  }

  return options;
}

/** Static file server, scoped to one directory. */
function serve(root) {
  const server = http.createServer((req, res) => {
    const relative = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = path.join(root, relative);

    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function shoot(name, options, browser) {
  const target = TARGETS[name];
  if (!target) {
    throw new Error(`Unknown target "${name}". Known: ${Object.keys(TARGETS).join(', ')}`);
  }
  if (!fs.existsSync(path.join(target.root, target.page))) {
    throw new Error(`${target.page} not found in ${target.root} - run "npm run build:webui" first.`);
  }

  const server = await serve(target.root);
  const { port } = server.address();
  const viewport = {
    width: options.width || target.viewport?.width || 1200,
    height: options.height || target.viewport?.height || 1000,
  };
  const page = await browser.newPage({ viewport });

  // Dialog scripts expect Electron's preload bridge and the WebUI expects a live
  // backend; their failures are irrelevant because the fixture puts the DOM into
  // the state we want to look at.
  page.on('pageerror', () => {});

  try {
    await page.goto(`http://127.0.0.1:${port}/${target.page}`, { waitUntil: 'domcontentloaded' });

    if (target.theme) {
      await page.addStyleTag({ content: target.theme });
    }

    const fixture = await import(
      pathToFileURL(path.join(scriptDir, 'ui-shot-fixtures', target.fixture)).href
    );
    await fixture.default(page);

    const outPath = options.out || path.join(repoRoot, '.ui-shots', `${name}.png`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    const clip = target.clip ? page.locator(target.clip) : page;
    await clip.screenshot({ path: outPath });

    console.log(`${name} -> ${outPath}`);
  } finally {
    await page.close();
    server.close();
  }
}

const options = parseArgs(process.argv.slice(2));
if (options.targets.length === 0) {
  console.log(`Usage: node scripts/ui-shot.mjs <target|--all> [--out file] [--width n] [--height n]
Targets: ${Object.keys(TARGETS).join(', ')}`);
  process.exit(1);
}

const browser = await chromium.launch();
try {
  for (const name of options.targets) {
    await shoot(name, options, browser);
  }
} finally {
  await browser.close();
}
