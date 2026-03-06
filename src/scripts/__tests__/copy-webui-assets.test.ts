/**
 * @fileoverview Jest coverage for the WebUI asset copy/build-stamp script.
 *
 * Verifies `copy-webui-assets.cjs` rewrites local asset URLs and module
 * imports with a shared build stamp while leaving external URLs untouched.
 */
/**
 * @fileoverview Tests for the build-time WebUI asset copier, including version stamping
 * and module import rewriting for cache-busted static output.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  applyBuildStamp,
  rewriteHtmlAssetUrls,
  rewriteModuleImports,
} = require('../../../scripts/copy-webui-assets.cjs');

describe('copy-webui-assets', () => {
  const tempDirectories: string[] = [];

  afterEach(() => {
    while (tempDirectories.length > 0) {
      const directory = tempDirectories.pop();
      if (directory) {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  it('versions local HTML asset URLs without touching external URLs', () => {
    const buildId = 'test-build';
    const source = `
      <link rel="stylesheet" href="webui.css">
      <link rel="icon" href="/flashforge_ui.ico#icon">
      <script type="module">
        import { VideoRTC } from './lib/video-rtc.js';
      </script>
      <script src="https://example.com/app.js"></script>
    `;

    const rewritten = rewriteHtmlAssetUrls(source, buildId);

    expect(rewritten).toContain('href="webui.css?v=test-build"');
    expect(rewritten).toContain('href="/flashforge_ui.ico?v=test-build#icon"');
    expect(rewritten).toContain("from './lib/video-rtc.js?v=test-build'");
    expect(rewritten).toContain('src="https://example.com/app.js"');
  });

  it('versions static and dynamic module imports', () => {
    const buildId = 'test-build';
    const source = `
      import './shared/helpers.js';
      export { camera } from '../features/camera.js';
      const lazyModule = import('./shared/lazy.js');
    `;

    const rewritten = rewriteModuleImports(source, buildId);

    expect(rewritten).toContain('./shared/helpers.js?v=test-build');
    expect(rewritten).toContain('../features/camera.js?v=test-build');
    expect(rewritten).toContain('./shared/lazy.js?v=test-build');
  });

  it('applies the same build stamp across index and module files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffui-webui-'));
    tempDirectories.push(tempDir);

    fs.mkdirSync(path.join(tempDir, 'features'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'shared'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'lib'), { recursive: true });

    fs.writeFileSync(
      path.join(tempDir, 'index.html'),
      `
        <link rel="stylesheet" href="webui.css">
        <script type="module">
          import { VideoRTC } from './lib/video-rtc.js';
        </script>
        <script type="module" src="app.js"></script>
      `,
      'utf8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'app.js'),
      `
        import './features/camera.js';
        const lazyModule = import('./shared/lazy.js');
      `,
      'utf8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'features', 'camera.js'),
      `
        export { helper } from '../shared/helper.js';
      `,
      'utf8'
    );
    fs.writeFileSync(path.join(tempDir, 'shared', 'helper.js'), 'export const helper = true;\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'shared', 'lazy.js'), 'export const lazy = true;\n', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'lib', 'video-rtc.js'), 'export class VideoRTC {}\n', 'utf8');

    const buildId = applyBuildStamp(tempDir);

    expect(fs.readFileSync(path.join(tempDir, 'index.html'), 'utf8')).toContain(`app.js?v=${buildId}`);
    expect(fs.readFileSync(path.join(tempDir, 'index.html'), 'utf8')).toContain(`./lib/video-rtc.js?v=${buildId}`);
    expect(fs.readFileSync(path.join(tempDir, 'app.js'), 'utf8')).toContain(`./features/camera.js?v=${buildId}`);
    expect(fs.readFileSync(path.join(tempDir, 'app.js'), 'utf8')).toContain(`./shared/lazy.js?v=${buildId}`);
    expect(fs.readFileSync(path.join(tempDir, 'features', 'camera.js'), 'utf8')).toContain(
      `../shared/helper.js?v=${buildId}`
    );
  });
});
