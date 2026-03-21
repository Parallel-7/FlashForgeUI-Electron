/**
 * @fileoverview Tests for the WebUI static asset cache policy helpers and
 * Express static options factory.
 */

/**
 * @fileoverview Jest coverage for WebUI static asset cache policy helpers.
 *
 * Verifies the no-cache headers and Express static options used when serving
 * versioned WebUI bundles from the desktop/headless server.
 */
import {
  applyWebUIStaticAssetHeaders,
  createWebUIStaticAssetOptions,
  getWebUIStaticAssetHeaders,
} from '../static-asset-options.js';

describe('static-asset-options', () => {
  it('creates static asset options that disable browser caching', () => {
    const options = createWebUIStaticAssetOptions();

    expect(options.fallthrough).toBe(true);
    expect(options.etag).toBe(false);
    expect(options.lastModified).toBe(false);
    expect(options.maxAge).toBe(0);
  });

  it('applies no-store headers to static asset responses', () => {
    const response = {
      setHeader: jest.fn(),
    } as any;

    applyWebUIStaticAssetHeaders(response);

    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate');
    expect(response.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(response.setHeader).toHaveBeenCalledWith('Expires', '0');
  });

  it('exposes the expected cache-control header set', () => {
    expect(getWebUIStaticAssetHeaders()).toEqual({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
  });
});
