/**
 * @fileoverview SFTP printer file manager feature for the WebUI client.
 *
 * Browser port of the desktop file manager dialog: a thumbnail grid over the
 * printer's internal storage and plugged-in USB drives with multi-select
 * batch delete, rename, and USB folder navigation with breadcrumbs. Talks to
 * the authenticated /api/file-manager/* REST surface (backed by the
 * main-process FileManagerService over SSH/SFTP).
 *
 * Context pinning: the desktop dialog pins its printer context in the main
 * process at window-open time; the WebUI equivalent captures the current
 * context id when the modal opens and sends it explicitly with every request,
 * so switching the printer selector while the modal is open never retargets
 * operations onto a different printer.
 *
 * Key exports:
 * - setupFileManager(): wire the topbar button + modal event handlers
 * - refreshFileManagerButton(): show/hide the topbar button per model support
 */

import { showToast } from '../shared/dom.js';
import { hydrateLucideIcons } from '../shared/icons.js';
import { apiRequest } from '../core/Transport.js';
import { getCurrentContextId } from './context-switching.js';

// ---------------------------------------------------------------------------
// API payload types (REST mirror of @shared/types/file-manager.ts)
// ---------------------------------------------------------------------------

type FileManagerStorageKind = 'internal' | 'usb';

interface PrinterFileEntry {
  readonly name: string;
  readonly path: string;
  readonly size: number;
  readonly modifiedAt: number;
  readonly isDirectory: boolean;
}

interface FileManagerListing {
  readonly success: boolean;
  readonly storage: FileManagerStorageKind;
  readonly path: string;
  readonly rootPath: string;
  readonly entries: readonly PrinterFileEntry[];
  readonly error?: string;
}

interface FileManagerCapabilities {
  readonly success?: boolean;
  readonly supported: boolean;
  readonly reason?: string;
  readonly printerName?: string;
  readonly usbPresent: boolean;
  readonly usbMounts: readonly string[];
  readonly error?: string;
}

interface FileManagerDeleteResult {
  readonly success: boolean;
  readonly outcomes: readonly { readonly path: string; readonly success: boolean; readonly error?: string }[];
  readonly error?: string;
}

interface FileManagerRenameResult {
  readonly success: boolean;
  readonly newPath?: string;
  readonly error?: string;
}

interface FileManagerThumbnailResult {
  readonly success: boolean;
  readonly thumbnail?: string;
  readonly error?: string;
}

interface FileManagerSupportResponse {
  readonly success: boolean;
  readonly supported?: boolean;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Constants + state
// ---------------------------------------------------------------------------

/** Lucide icons used by the static markup and dynamically rendered tiles. */
const FM_ICONS = [
  'folder',
  'hard-drive',
  'usb',
  'refresh-cw',
  'check-square',
  'square',
  'trash-2',
  'pencil',
  'alert-triangle',
  'file',
  'check',
  'chevron-right',
];

/** Maximum concurrent thumbnail requests in flight. */
const THUMBNAIL_CONCURRENCY = 4;

interface FileManagerState {
  /** Context pinned when the modal opened; null when the modal is closed. */
  pinnedContextId: string | null;
  capabilities: FileManagerCapabilities | null;
  storage: FileManagerStorageKind;
  path: string;
  rootPath: string;
  entries: readonly PrinterFileEntry[];
  selection: Set<string>;
  /** Monotonic token: bumps invalidate in-flight listings + thumbnail runs. */
  runId: number;
  busy: boolean;
}

const fmState: FileManagerState = {
  pinnedContextId: null,
  capabilities: null,
  storage: 'internal',
  path: '',
  rootPath: '',
  entries: [],
  selection: new Set(),
  runId: 0,
  busy: false,
};

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function el(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`[FileManager] Missing element #${id}`);
  }
  return element;
}

function show(element: HTMLElement): void {
  element.classList.remove('hidden');
}

function hide(element: HTMLElement): void {
  element.classList.add('hidden');
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = '';
  for (const candidate of units) {
    value /= 1024;
    unit = candidate;
    if (value < 1024) break;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${unit}`;
}

function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(idx) : '';
}

function baseName(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(idx + 1) : path;
}

/** Build a query string carrying the pinned context id. */
function fmQuery(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  if (fmState.pinnedContextId) {
    search.set('contextId', fmState.pinnedContextId);
  }
  return search.toString();
}

/** JSON body carrying the pinned context id. */
function fmBody(payload: Record<string, unknown>): string {
  return JSON.stringify(
    fmState.pinnedContextId ? { ...payload, contextId: fmState.pinnedContextId } : payload
  );
}

// ---------------------------------------------------------------------------
// Topbar button gating
// ---------------------------------------------------------------------------

/**
 * Show or hide the topbar file manager button based on the active printer's
 * model (cheap model-only probe; no SSH session is opened).
 */
export async function refreshFileManagerButton(): Promise<void> {
  const button = document.getElementById('file-manager-button');
  if (!button) {
    return;
  }
  try {
    const result = await apiRequest<FileManagerSupportResponse>('/api/file-manager/support');
    button.classList.toggle('hidden', !(result.success && result.supported));
  } catch {
    button.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// Thumbnail queue (limited concurrency, cancellable via runId)
// ---------------------------------------------------------------------------

interface ThumbnailJob {
  readonly entry: PrinterFileEntry;
  readonly runId: number;
}

const thumbnailQueue: ThumbnailJob[] = [];
let activeThumbnailRequests = 0;

function enqueueThumbnail(entry: PrinterFileEntry): void {
  thumbnailQueue.push({ entry, runId: fmState.runId });
  pumpThumbnailQueue();
}

function pumpThumbnailQueue(): void {
  while (activeThumbnailRequests < THUMBNAIL_CONCURRENCY && thumbnailQueue.length > 0) {
    const job = thumbnailQueue.shift();
    if (!job || job.runId !== fmState.runId) {
      continue;
    }
    activeThumbnailRequests++;
    void fetchThumbnail(job).finally(() => {
      activeThumbnailRequests--;
      pumpThumbnailQueue();
    });
  }
}

async function fetchThumbnail(job: ThumbnailJob): Promise<void> {
  try {
    const query = fmQuery({ storage: fmState.storage, path: job.entry.path });
    const result = await apiRequest<FileManagerThumbnailResult>(`/api/file-manager/thumbnail?${query}`);
    if (job.runId !== fmState.runId) {
      return;
    }
    applyThumbnail(job.entry.path, result.success && result.thumbnail ? result.thumbnail : null);
  } catch {
    if (job.runId === fmState.runId) {
      applyThumbnail(job.entry.path, null);
    }
  }
}

function applyThumbnail(path: string, base64: string | null): void {
  const tile = document.querySelector<HTMLElement>(`#fm-grid .fm-item[data-path="${CSS.escape(path)}"]`);
  const thumbnail = tile?.querySelector('.fm-thumbnail');
  if (!thumbnail) {
    return;
  }

  if (base64) {
    thumbnail.innerHTML = '';
    const img = document.createElement('img');
    img.src = `data:image/png;base64,${base64}`;
    img.alt = baseName(path);
    thumbnail.appendChild(img);
  } else {
    thumbnail.innerHTML = '<i data-lucide="file" aria-hidden="true"></i>';
    hydrateLucideIcons(['file'], thumbnail as Element);
  }
}

// ---------------------------------------------------------------------------
// Views: loading / message / grid
// ---------------------------------------------------------------------------

function showLoading(text: string): void {
  const loading = el('fm-loading');
  const textElement = loading.querySelector('.fm-state-text');
  if (textElement) {
    textElement.textContent = text;
  }
  show(loading);
  hide(el('fm-message'));
  hide(el('fm-grid'));
}

function showMessage(text: string, allowRetry: boolean = true): void {
  el('fm-message-text').textContent = text;
  el('fm-retry').classList.toggle('hidden', !allowRetry);
  show(el('fm-message'));
  hide(el('fm-loading'));
  hide(el('fm-grid'));
}

function showGrid(): void {
  show(el('fm-grid'));
  hide(el('fm-loading'));
  hide(el('fm-message'));
}

// ---------------------------------------------------------------------------
// Capabilities + tabs
// ---------------------------------------------------------------------------

async function loadCapabilities(): Promise<void> {
  fmState.runId++;
  showLoading('Connecting to printer…');
  updateToolbar();

  let capabilities: FileManagerCapabilities;
  try {
    capabilities = await apiRequest<FileManagerCapabilities>(`/api/file-manager/capabilities?${fmQuery({})}`);
  } catch (error) {
    showMessage(`Failed to reach the printer: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  fmState.capabilities = capabilities;

  const title = el('file-manager-title');
  title.textContent = capabilities.printerName ? `File Manager — ${capabilities.printerName}` : 'File Manager';

  if (!capabilities.supported) {
    hide(el('fm-tab-usb'));
    showMessage(capabilities.reason || capabilities.error || 'File management is not supported for this printer.', false);
    return;
  }

  if (capabilities.error) {
    showMessage(capabilities.error);
    return;
  }

  el('fm-tab-usb').classList.toggle('hidden', !capabilities.usbPresent);

  // If the current tab is USB but the drive vanished, fall back to internal
  if (fmState.storage === 'usb' && !capabilities.usbPresent) {
    fmState.storage = 'internal';
  }

  updateTabSelection();
  await loadListing(fmState.storage, fmState.storage === 'usb' ? fmState.path : '');
}

function updateTabSelection(): void {
  el('fm-tab-internal').classList.toggle('active', fmState.storage === 'internal');
  el('fm-tab-usb').classList.toggle('active', fmState.storage === 'usb');
}

async function switchStorage(storage: FileManagerStorageKind): Promise<void> {
  if (fmState.busy || fmState.storage === storage) {
    return;
  }
  fmState.storage = storage;
  fmState.path = '';
  updateTabSelection();
  await loadListing(storage, '');
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

async function loadListing(storage: FileManagerStorageKind, path: string): Promise<void> {
  const runId = ++fmState.runId;
  fmState.selection.clear();
  showLoading('Loading files…');
  updateToolbar();

  let listing: FileManagerListing;
  try {
    listing = await apiRequest<FileManagerListing>(`/api/file-manager/files?${fmQuery({ storage, path })}`);
  } catch (error) {
    if (runId === fmState.runId) {
      showMessage(`Failed to list files: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }

  if (runId !== fmState.runId) {
    return; // A newer navigation superseded this request
  }

  if (!listing.success) {
    showMessage(listing.error || 'Failed to list files');
    return;
  }

  fmState.entries = listing.entries;
  fmState.path = listing.path;
  fmState.rootPath = listing.rootPath;

  renderBreadcrumb();
  renderGrid();
  updateToolbar();
  updateSummary();
}

function renderGrid(): void {
  const grid = el('fm-grid');
  grid.innerHTML = '';

  if (fmState.entries.length === 0) {
    showMessage('No files found', true);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const entry of fmState.entries) {
    fragment.appendChild(entry.isDirectory ? createDirectoryTile(entry) : createFileTile(entry));
  }
  grid.appendChild(fragment);
  hydrateLucideIcons(FM_ICONS, grid);
  showGrid();

  // Queue thumbnails for files after the grid is visible
  for (const entry of fmState.entries) {
    if (!entry.isDirectory) {
      enqueueThumbnail(entry);
    }
  }
}

function createFileTile(entry: PrinterFileEntry): HTMLElement {
  const tile = document.createElement('div');
  tile.className = 'fm-item';
  tile.dataset.path = entry.path;

  const check = document.createElement('button');
  check.className = 'fm-item-check';
  check.title = 'Select file';
  check.innerHTML = '<i data-lucide="check" aria-hidden="true"></i>';
  check.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSelection(entry.path);
  });

  const controls = document.createElement('div');
  controls.className = 'fm-item-controls';

  const renameBtn = document.createElement('button');
  renameBtn.className = 'fm-item-btn';
  renameBtn.title = 'Rename';
  renameBtn.innerHTML = '<i data-lucide="pencil" aria-hidden="true"></i>';
  renameBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    openRenameOverlay(entry);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'fm-item-btn delete';
  deleteBtn.title = 'Delete';
  deleteBtn.innerHTML = '<i data-lucide="trash-2" aria-hidden="true"></i>';
  deleteBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    openDeleteConfirmation([entry.path]);
  });

  controls.appendChild(renameBtn);
  controls.appendChild(deleteBtn);

  const thumbnail = document.createElement('div');
  thumbnail.className = 'fm-thumbnail';
  thumbnail.innerHTML = '<div class="thumb-spinner"></div>';

  const name = document.createElement('div');
  name.className = 'fm-name';
  name.textContent = entry.name;
  name.title = entry.name;

  const size = document.createElement('div');
  size.className = 'fm-size';
  size.textContent = formatBytes(entry.size);
  if (entry.modifiedAt > 1_000_000_000) {
    size.title = new Date(entry.modifiedAt * 1000).toLocaleString();
  }

  tile.appendChild(check);
  tile.appendChild(controls);
  tile.appendChild(thumbnail);
  tile.appendChild(name);
  tile.appendChild(size);

  tile.addEventListener('click', () => toggleSelection(entry.path));

  return tile;
}

function createDirectoryTile(entry: PrinterFileEntry): HTMLElement {
  const tile = document.createElement('div');
  tile.className = 'fm-item directory';
  tile.dataset.path = entry.path;

  const thumbnail = document.createElement('div');
  thumbnail.className = 'fm-thumbnail';
  thumbnail.innerHTML = '<i data-lucide="folder" aria-hidden="true"></i>';

  const name = document.createElement('div');
  name.className = 'fm-name';
  name.textContent = entry.name;
  name.title = entry.name;

  const size = document.createElement('div');
  size.className = 'fm-size';
  size.textContent = 'Folder';

  tile.appendChild(thumbnail);
  tile.appendChild(name);
  tile.appendChild(size);

  tile.addEventListener('click', () => {
    void loadListing(fmState.storage, entry.path);
  });

  return tile;
}

// ---------------------------------------------------------------------------
// Breadcrumb (USB navigation)
// ---------------------------------------------------------------------------

interface Crumb {
  readonly label: string;
  readonly path: string;
}

function buildCrumbs(): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'USB', path: '' }];
  if (!fmState.path) {
    return crumbs;
  }

  const mounts = fmState.capabilities?.usbMounts ?? [];
  const mount = mounts.find(
    (candidate) => fmState.path === candidate || fmState.path.startsWith(`${candidate}/`)
  );
  if (!mount) {
    return crumbs;
  }

  // With multiple drives the mount itself is a navigable crumb; with a single
  // drive the 'USB' crumb already points at the mount root.
  if (mounts.length > 1) {
    crumbs.push({ label: baseName(mount) || mount, path: mount });
  }

  const relative = fmState.path.slice(mount.length).replace(/^\//, '');
  if (relative) {
    let accumulated = mount;
    for (const segment of relative.split('/')) {
      accumulated = `${accumulated}/${segment}`;
      crumbs.push({ label: segment, path: accumulated });
    }
  }

  return crumbs;
}

function renderBreadcrumb(): void {
  const breadcrumb = el('fm-breadcrumb');

  if (fmState.storage !== 'usb') {
    hide(breadcrumb);
    breadcrumb.innerHTML = '';
    return;
  }

  const crumbs = buildCrumbs();
  breadcrumb.innerHTML = '';

  crumbs.forEach((crumb, index) => {
    const isLast = index === crumbs.length - 1;
    if (index > 0) {
      const separator = document.createElement('i');
      separator.setAttribute('data-lucide', 'chevron-right');
      separator.setAttribute('aria-hidden', 'true');
      breadcrumb.appendChild(separator);
    }

    if (isLast) {
      const current = document.createElement('span');
      current.className = 'crumb-current';
      current.textContent = crumb.label;
      breadcrumb.appendChild(current);
    } else {
      const link = document.createElement('button');
      link.textContent = crumb.label;
      link.addEventListener('click', () => {
        void loadListing('usb', crumb.path);
      });
      breadcrumb.appendChild(link);
    }
  });

  hydrateLucideIcons(['chevron-right'], breadcrumb);
  show(breadcrumb);
}

// ---------------------------------------------------------------------------
// Selection + toolbar
// ---------------------------------------------------------------------------

function toggleSelection(path: string): void {
  if (fmState.selection.has(path)) {
    fmState.selection.delete(path);
  } else {
    fmState.selection.add(path);
  }

  const tile = document.querySelector<HTMLElement>(`#fm-grid .fm-item[data-path="${CSS.escape(path)}"]`);
  tile?.classList.toggle('selected', fmState.selection.has(path));

  updateToolbar();
  updateSummary();
}

function clearSelection(): void {
  fmState.selection.clear();
  document.querySelectorAll('#fm-grid .fm-item.selected').forEach((tile) => tile.classList.remove('selected'));
  updateToolbar();
  updateSummary();
}

function selectAllFiles(): void {
  for (const entry of fmState.entries) {
    if (!entry.isDirectory) {
      fmState.selection.add(entry.path);
    }
  }
  document.querySelectorAll<HTMLElement>('#fm-grid .fm-item:not(.directory)').forEach((tile) => {
    tile.classList.add('selected');
  });
  updateToolbar();
  updateSummary();
}

function updateToolbar(): void {
  const fileCount = fmState.entries.filter((entry) => !entry.isDirectory).length;
  const selectedCount = fmState.selection.size;

  el('fm-select-all').classList.toggle('hidden', fileCount === 0 || selectedCount >= fileCount);
  el('fm-clear-selection').classList.toggle('hidden', selectedCount === 0);
  el('fm-delete-selected').classList.toggle('hidden', selectedCount === 0);
  el('fm-delete-selected-label').textContent =
    selectedCount > 0 ? `Delete Selected (${selectedCount})` : 'Delete Selected';
}

function updateSummary(extra?: string): void {
  const files = fmState.entries.filter((entry) => !entry.isDirectory);
  const totalSize = files.reduce((sum, entry) => sum + entry.size, 0);
  const parts: string[] = [];

  if (files.length > 0) {
    parts.push(`${files.length} file${files.length === 1 ? '' : 's'}`);
    parts.push(formatBytes(totalSize));
  }
  if (fmState.selection.size > 0) {
    parts.push(`${fmState.selection.size} selected`);
  }
  if (extra) {
    parts.push(extra);
  }

  el('fm-summary').textContent = parts.join(' • ');
}

// ---------------------------------------------------------------------------
// Delete flow
// ---------------------------------------------------------------------------

let pendingDeletePaths: string[] = [];

function openDeleteConfirmation(paths: string[]): void {
  if (paths.length === 0) {
    return;
  }
  pendingDeletePaths = paths;

  el('fm-confirm-title').textContent = paths.length === 1 ? 'Delete file?' : `Delete ${paths.length} files?`;

  const body = el('fm-confirm-body');
  body.innerHTML = '';
  const intro = document.createElement('div');
  intro.textContent =
    paths.length === 1
      ? 'This will permanently delete the file from the printer:'
      : 'This will permanently delete these files from the printer:';
  body.appendChild(intro);

  const list = document.createElement('ul');
  const shown = paths.slice(0, 8);
  for (const path of shown) {
    const item = document.createElement('li');
    item.textContent = baseName(path);
    list.appendChild(item);
  }
  if (paths.length > shown.length) {
    const item = document.createElement('li');
    item.textContent = `…and ${paths.length - shown.length} more`;
    list.appendChild(item);
  }
  body.appendChild(list);

  show(el('fm-confirm-overlay'));
}

function closeDeleteConfirmation(): void {
  pendingDeletePaths = [];
  hide(el('fm-confirm-overlay'));
}

async function executeDelete(): Promise<void> {
  const paths = pendingDeletePaths;
  closeDeleteConfirmation();
  if (paths.length === 0 || fmState.busy) {
    return;
  }

  fmState.busy = true;
  for (const path of paths) {
    document
      .querySelector<HTMLElement>(`#fm-grid .fm-item[data-path="${CSS.escape(path)}"]`)
      ?.classList.add('pending');
  }
  updateSummary('Deleting…');

  try {
    const result = await apiRequest<FileManagerDeleteResult>('/api/file-manager/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: fmBody({ storage: fmState.storage, paths }),
    });
    const failures = (result.outcomes ?? []).filter((outcome) => !outcome.success);
    if (result.error) {
      showMessage(`Delete failed: ${result.error}`);
      return;
    }

    await loadListing(fmState.storage, fmState.path);

    if (failures.length > 0) {
      const first = failures[0];
      updateSummary(
        `Failed to delete ${failures.length} file${failures.length === 1 ? '' : 's'} (${first.error || 'unknown error'})`
      );
    }
  } catch (error) {
    showMessage(`Delete failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    fmState.busy = false;
    // Clear the per-tile "pending" visual state on every exit path (the
    // success path rebuilds the grid, but error paths return early).
    for (const path of paths) {
      document
        .querySelector<HTMLElement>(`#fm-grid .fm-item[data-path="${CSS.escape(path)}"]`)
        ?.classList.remove('pending');
    }
  }
}

// ---------------------------------------------------------------------------
// Rename flow
// ---------------------------------------------------------------------------

let renameTarget: PrinterFileEntry | null = null;

function openRenameOverlay(entry: PrinterFileEntry): void {
  renameTarget = entry;

  const extension = fileExtension(entry.name);
  const stem = extension ? entry.name.slice(0, -extension.length) : entry.name;

  const input = el('fm-rename-input') as HTMLInputElement;
  input.value = stem;
  el('fm-rename-ext').textContent = extension;
  hide(el('fm-rename-error'));

  show(el('fm-rename-overlay'));
  input.focus();
  input.select();
}

function closeRenameOverlay(): void {
  renameTarget = null;
  hide(el('fm-rename-overlay'));
}

function showRenameError(message: string): void {
  const errorElement = el('fm-rename-error');
  errorElement.textContent = message;
  show(errorElement);
}

async function executeRename(): Promise<void> {
  const entry = renameTarget;
  if (!entry || fmState.busy) {
    return;
  }

  const input = el('fm-rename-input') as HTMLInputElement;
  const extension = fileExtension(entry.name);
  const stem = input.value.trim();

  if (!stem) {
    showRenameError('Enter a file name');
    return;
  }
  if (stem.includes('/') || stem.includes('\\')) {
    showRenameError('File names cannot contain slashes');
    return;
  }

  const newName = `${stem}${extension}`;
  if (newName === entry.name) {
    closeRenameOverlay();
    return;
  }

  fmState.busy = true;
  try {
    const result = await apiRequest<FileManagerRenameResult>('/api/file-manager/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: fmBody({ storage: fmState.storage, path: entry.path, newName }),
    });
    if (!result.success) {
      showRenameError(result.error || 'Rename failed');
      return;
    }
    closeRenameOverlay();
    await loadListing(fmState.storage, fmState.path);
  } catch (error) {
    showRenameError(error instanceof Error ? error.message : String(error));
  } finally {
    fmState.busy = false;
  }
}

// ---------------------------------------------------------------------------
// Modal open/close + wiring
// ---------------------------------------------------------------------------

function openFileManager(): void {
  const contextId = getCurrentContextId();
  if (!contextId) {
    showToast('No printer is connected', 'error');
    return;
  }

  // Pin the context for the modal's lifetime (survives printer-selector
  // switches while open; released on close).
  fmState.pinnedContextId = contextId;
  fmState.storage = 'internal';
  fmState.path = '';
  fmState.selection.clear();

  show(el('file-manager-modal'));
  hydrateLucideIcons(FM_ICONS, el('file-manager-modal'));
  void loadCapabilities();
}

function closeFileManager(): void {
  fmState.pinnedContextId = null;
  fmState.runId++; // Cancel in-flight listings/thumbnails
  hide(el('file-manager-modal'));
}

/** Wire the topbar button and every modal control. Call once at startup. */
export function setupFileManager(): void {
  document.getElementById('file-manager-button')?.addEventListener('click', openFileManager);

  el('fm-close').addEventListener('click', closeFileManager);
  el('fm-close-footer').addEventListener('click', closeFileManager);

  el('fm-tab-internal').addEventListener('click', () => void switchStorage('internal'));
  el('fm-tab-usb').addEventListener('click', () => void switchStorage('usb'));

  el('fm-refresh').addEventListener('click', () => void loadCapabilities());
  el('fm-retry').addEventListener('click', () => void loadCapabilities());

  el('fm-select-all').addEventListener('click', selectAllFiles);
  el('fm-clear-selection').addEventListener('click', clearSelection);
  el('fm-delete-selected').addEventListener('click', () => {
    openDeleteConfirmation(Array.from(fmState.selection));
  });

  el('fm-confirm-cancel').addEventListener('click', closeDeleteConfirmation);
  el('fm-confirm-delete').addEventListener('click', () => void executeDelete());

  el('fm-rename-cancel').addEventListener('click', closeRenameOverlay);
  el('fm-rename-confirm').addEventListener('click', () => void executeRename());
  (el('fm-rename-input') as HTMLInputElement).addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      void executeRename();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || el('file-manager-modal').classList.contains('hidden')) {
      return;
    }
    if (!el('fm-rename-overlay').classList.contains('hidden')) {
      closeRenameOverlay();
    } else if (!el('fm-confirm-overlay').classList.contains('hidden')) {
      closeDeleteConfirmation();
    } else {
      closeFileManager();
    }
  });
}
