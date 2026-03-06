/**
 * @fileoverview Shared no-store cache options for serving built WebUI assets.
 *
 * Exposes the header map, header-applier, and Express static options factory so the
 * desktop-hosted WebUI always serves fresh asset bundles instead of stale cached files.
 */

/**
 * @fileoverview Shared cache-control helpers for serving WebUI static assets.
 *
 * Exposes the header set and Express static options used by `WebUIManager` to
 * prevent stale desktop/headless bundles from being cached by browsers.
 */
import type { Response } from 'express';

export interface WebUIStaticAssetOptions {
  readonly fallthrough: boolean;
  readonly etag: boolean;
  readonly lastModified: boolean;
  readonly maxAge: number;
  readonly setHeaders: (response: Response) => void;
}

export function getWebUIStaticAssetHeaders(): Readonly<Record<string, string>> {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
}

export function applyWebUIStaticAssetHeaders(response: Response): void {
  const headers = getWebUIStaticAssetHeaders();

  for (const [headerName, headerValue] of Object.entries(headers)) {
    response.setHeader(headerName, headerValue);
  }
}

export function createWebUIStaticAssetOptions(): WebUIStaticAssetOptions {
  return {
    fallthrough: true,
    etag: false,
    lastModified: false,
    maxAge: 0,
    setHeaders: applyWebUIStaticAssetHeaders,
  };
}
