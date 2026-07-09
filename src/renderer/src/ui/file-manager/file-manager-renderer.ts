/**
 * @fileoverview Renderer for the SFTP printer file manager dialog.
 *
 * Presents printer storage as a thumbnail grid with per-tile delete/rename
 * controls, multi-select with batch deletion, and tabbed access to internal
 * storage and plugged-in USB drives (with folder navigation + breadcrumbs on
 * USB). Thumbnails are fetched through the main process with limited
 * concurrency, hitting the shared thumbnail cache first and falling back to
 * live SFTP reads / embedded .3mf extraction for misses.
 *
 * Key behaviors:
 * - Capability probe on open decides tab visibility (USB tab only when a
 *   drive is mounted) and shows a friendly message on unsupported models
 * - Click a tile (or its checkbox) to select; toolbar exposes select-all,
 *   clear, and batch delete; every delete asks for confirmation first
 * - Rename keeps the file extension fixed and validates the new name
 * - Refresh re-probes USB presence so newly plugged drives appear
 */

import { logVerbose } from '@shared/logging.js';
import type { ThemeColors } from '@shared/types/config.js';
import type {
  FileManagerCapabilities,
  FileManagerDeleteResult,
  FileManagerListing,
  FileManagerRenameResult,
  FileManagerStorageKind,
  FileManagerThumbnailResult,
  PrinterFileEntry,
} from '@shared/types/file-manager.js';
import { initializeLucideIconsFromGlobal } from '../shared/lucide.js';
import { applyDialogTheme } from '../shared/theme-utils.js';

export {};

// ---------------------------------------------------------------------------
// Preload bridge
// ---------------------------------------------------------------------------

interface FileManagerAPI {
  readonly getCapabilities: () => Promise<FileManagerCapabilities>;
  readonly listFiles: (storage: FileManagerStorageKind, path: string) => Promise<FileManagerListing>;
  readonly deleteFiles: (
    storage: FileManagerStorageKind,
    paths: string[]
  ) => Promise<FileManagerDeleteResult>;
  readonly renameFile: (
    storage: FileManagerStorageKind,
    path: string,
    newName: string
  ) => Promise<FileManagerRenameResult>;
  readonly getThumbnail: (
    storage: FileManagerStorageKind,
    path: string
  ) => Promise<FileManagerThumbnailResult>;
  readonly closeWindow: () => void;
  readonly receive?: (channel: string, func: (...args: unknown[]) => void) => void;
}

function getFileManagerAPI(): FileManagerAPI {
  const api = window.api?.dialog?.fileManager as FileManagerAPI | undefined;
  if (!api) {
    throw new Error('[FileManager] dialog API bridge is not available');
  }
  return api;
}

const LOG_NAMESPACE = 'FileManagerRenderer';
const logDebug = (message: string, ...args: unknown[]): void => {
  logVerbose(LOG_NAMESPACE, message, ...args);
};

/** Lucide icons used by static markup and dynamically rendered tiles. */
const LUCIDE_ICONS = [
  'x',
  'hard-drive',
  'usb',
  'refresh-cw',
  'check-square',
  'square',
  'trash-2',
  'pencil',
  'alert-triangle',
  'folder',
  'file',
  'check',
  'chevron-right',
];

/** Maximum concurrent thumbnail requests in flight. */
const THUMBNAIL_CONCURRENCY = 4;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface RendererState {
  capabilities: FileManagerCapabilities | null;
  storage: FileManagerStorageKind;
  /** Current listing directory ('' = storage root). */
  path: string;
  /** Root of the current listing as reported by the service. */
  rootPath: string;
  entries: readonly PrinterFileEntry[];
  /** Selected file paths. */
  selection: Set<string>;
  /** Monotonic token: bumps invalidate in-flight listings + thumbnail runs. */
  runId: number;
  busy: boolean;
}

const state: RendererState = {
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

function $(id: string): HTMLElement {
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
  thumbnailQueue.push({ entry, runId: state.runId });
  pumpThumbnailQueue();
}

function pumpThumbnailQueue(): void {
  while (activeThumbnailRequests < THUMBNAIL_CONCURRENCY && thumbnailQueue.length > 0) {
    const job = thumbnailQueue.shift();
    if (!job || job.runId !== state.runId) {
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
    const result = await getFileManagerAPI().getThumbnail(state.storage, job.entry.path);
    if (job.runId !== state.runId) {
      return;
    }
    applyThumbnail(job.entry.path, result.success && result.thumbnail ? result.thumbnail : null);
  } catch (error) {
    logDebug('Thumbnail fetch failed for', job.entry.path, error);
    if (job.runId === state.runId) {
      applyThumbnail(job.entry.path, null);
    }
  }
}

function applyThumbnail(path: string, base64: string | null): void {
  const tile = document.querySelector<HTMLElement>(`.fm-item[data-path="${CSS.escape(path)}"]`);
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
    initializeLucideIconsFromGlobal(['file'], thumbnail);
  }
}

// ---------------------------------------------------------------------------
// Views: loading / message / grid
// ---------------------------------------------------------------------------

function showLoading(text: string): void {
  const loading = $('fm-loading');
  const textElement = loading.querySelector('.fm-state-text');
  if (textElement) {
    textElement.textContent = text;
  }
  show(loading);
  hide($('fm-message'));
  hide($('fm-grid'));
}

function showMessage(text: string, allowRetry: boolean = true): void {
  $('fm-message-text').textContent = text;
  const retry = $('btn-retry');
  retry.classList.toggle('hidden', !allowRetry);
  show($('fm-message'));
  hide($('fm-loading'));
  hide($('fm-grid'));
}

function showGrid(): void {
  show($('fm-grid'));
  hide($('fm-loading'));
  hide($('fm-message'));
}

// ---------------------------------------------------------------------------
// Capabilities + tabs
// ---------------------------------------------------------------------------

async function loadCapabilities(): Promise<void> {
  state.runId++;
  showLoading('Connecting to printer…');
  updateToolbar();

  let capabilities: FileManagerCapabilities;
  try {
    capabilities = await getFileManagerAPI().getCapabilities();
  } catch (error) {
    showMessage(`Failed to reach the printer: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  state.capabilities = capabilities;
  logDebug('Capabilities:', capabilities);

  if (capabilities.printerName) {
    $('dialog-title').textContent = `File Manager — ${capabilities.printerName}`;
  }

  if (!capabilities.supported) {
    hide($('tab-usb'));
    showMessage(capabilities.reason || 'File management is not supported for this printer.', false);
    return;
  }

  if (capabilities.error) {
    showMessage(capabilities.error);
    return;
  }

  $('tab-usb').classList.toggle('hidden', !capabilities.usbPresent);

  // If the current tab is USB but the drive vanished, fall back to internal
  if (state.storage === 'usb' && !capabilities.usbPresent) {
    state.storage = 'internal';
  }

  updateTabSelection();
  await loadListing(state.storage, state.storage === 'usb' ? state.path : '');
}

function updateTabSelection(): void {
  $('tab-internal').classList.toggle('active', state.storage === 'internal');
  $('tab-usb').classList.toggle('active', state.storage === 'usb');
}

async function switchStorage(storage: FileManagerStorageKind): Promise<void> {
  if (state.busy || state.storage === storage) {
    return;
  }
  state.storage = storage;
  state.path = '';
  updateTabSelection();
  await loadListing(storage, '');
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

async function loadListing(storage: FileManagerStorageKind, path: string): Promise<void> {
  const runId = ++state.runId;
  state.selection.clear();
  showLoading('Loading files…');
  updateToolbar();

  let listing: FileManagerListing;
  try {
    listing = await getFileManagerAPI().listFiles(storage, path);
  } catch (error) {
    if (runId === state.runId) {
      showMessage(`Failed to list files: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }

  if (runId !== state.runId) {
    return; // A newer navigation superseded this request
  }

  if (!listing.success) {
    showMessage(listing.error || 'Failed to list files');
    return;
  }

  state.entries = listing.entries;
  state.path = listing.path;
  state.rootPath = listing.rootPath;

  renderBreadcrumb();
  renderGrid();
  updateToolbar();
  updateSummary();
}

function renderGrid(): void {
  const grid = $('fm-grid');
  grid.innerHTML = '';

  if (state.entries.length === 0) {
    showMessage('No files found', true);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const entry of state.entries) {
    fragment.appendChild(entry.isDirectory ? createDirectoryTile(entry) : createFileTile(entry));
  }
  grid.appendChild(fragment);
  initializeLucideIconsFromGlobal(LUCIDE_ICONS, grid);
  showGrid();

  // Queue thumbnails for files after the grid is visible
  for (const entry of state.entries) {
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
    void loadListing(state.storage, entry.path);
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
  if (!state.path) {
    return crumbs;
  }

  const mounts = state.capabilities?.usbMounts ?? [];
  const mount = mounts.find((candidate) => state.path === candidate || state.path.startsWith(`${candidate}/`));
  if (!mount) {
    return crumbs;
  }

  // With multiple drives the mount itself is a navigable crumb; with a single
  // drive the 'USB' crumb already points at the mount root.
  if (mounts.length > 1) {
    crumbs.push({ label: baseName(mount) || mount, path: mount });
  }

  const relative = state.path.slice(mount.length).replace(/^\//, '');
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
  const breadcrumb = $('fm-breadcrumb');

  if (state.storage !== 'usb') {
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

  initializeLucideIconsFromGlobal(['chevron-right'], breadcrumb);
  show(breadcrumb);
}

// ---------------------------------------------------------------------------
// Selection + toolbar
// ---------------------------------------------------------------------------

function toggleSelection(path: string): void {
  if (state.selection.has(path)) {
    state.selection.delete(path);
  } else {
    state.selection.add(path);
  }

  const tile = document.querySelector<HTMLElement>(`.fm-item[data-path="${CSS.escape(path)}"]`);
  tile?.classList.toggle('selected', state.selection.has(path));

  updateToolbar();
  updateSummary();
}

function clearSelection(): void {
  state.selection.clear();
  document.querySelectorAll('.fm-item.selected').forEach((tile) => tile.classList.remove('selected'));
  updateToolbar();
  updateSummary();
}

function selectAllFiles(): void {
  for (const entry of state.entries) {
    if (!entry.isDirectory) {
      state.selection.add(entry.path);
    }
  }
  document.querySelectorAll<HTMLElement>('.fm-item:not(.directory)').forEach((tile) => {
    tile.classList.add('selected');
  });
  updateToolbar();
  updateSummary();
}

function updateToolbar(): void {
  const fileCount = state.entries.filter((entry) => !entry.isDirectory).length;
  const selectedCount = state.selection.size;

  const selectAll = $('btn-select-all');
  const clear = $('btn-clear-selection');
  const deleteSelected = $('btn-delete-selected');

  selectAll.classList.toggle('hidden', fileCount === 0 || selectedCount >= fileCount);
  clear.classList.toggle('hidden', selectedCount === 0);
  deleteSelected.classList.toggle('hidden', selectedCount === 0);
  $('delete-selected-label').textContent = selectedCount > 0 ? `Delete Selected (${selectedCount})` : 'Delete Selected';
}

function updateSummary(extra?: string): void {
  const files = state.entries.filter((entry) => !entry.isDirectory);
  const totalSize = files.reduce((sum, entry) => sum + entry.size, 0);
  const parts: string[] = [];

  if (files.length > 0) {
    parts.push(`${files.length} file${files.length === 1 ? '' : 's'}`);
    parts.push(formatBytes(totalSize));
  }
  if (state.selection.size > 0) {
    parts.push(`${state.selection.size} selected`);
  }
  if (extra) {
    parts.push(extra);
  }

  $('fm-summary').textContent = parts.join(' • ');
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

  $('confirm-title').textContent = paths.length === 1 ? 'Delete file?' : `Delete ${paths.length} files?`;

  const body = $('confirm-body');
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

  show($('confirm-overlay'));
}

function closeDeleteConfirmation(): void {
  pendingDeletePaths = [];
  hide($('confirm-overlay'));
}

async function executeDelete(): Promise<void> {
  const paths = pendingDeletePaths;
  closeDeleteConfirmation();
  if (paths.length === 0 || state.busy) {
    return;
  }

  state.busy = true;
  for (const path of paths) {
    document.querySelector<HTMLElement>(`.fm-item[data-path="${CSS.escape(path)}"]`)?.classList.add('pending');
  }
  updateSummary('Deleting…');

  try {
    const result = await getFileManagerAPI().deleteFiles(state.storage, paths);
    const failures = result.outcomes.filter((outcome) => !outcome.success);
    if (result.error) {
      showMessage(`Delete failed: ${result.error}`);
      return;
    }

    await loadListing(state.storage, state.path);

    if (failures.length > 0) {
      const first = failures[0];
      updateSummary(
        `Failed to delete ${failures.length} file${failures.length === 1 ? '' : 's'} (${first.error || 'unknown error'})`
      );
    }
  } catch (error) {
    showMessage(`Delete failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    state.busy = false;
    // Clear the per-tile "pending" visual state on every exit path. The success
    // path already rebuilds the grid via loadListing, but the total-failure
    // (result.error) and exception paths return early and would otherwise leave
    // tiles greyed until the next listing refresh.
    for (const path of paths) {
      document
        .querySelector<HTMLElement>(`.fm-item[data-path="${CSS.escape(path)}"]`)
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

  const input = $('rename-input') as HTMLInputElement;
  input.value = stem;
  $('rename-ext').textContent = extension;
  hide($('rename-error'));

  show($('rename-overlay'));
  input.focus();
  input.select();
}

function closeRenameOverlay(): void {
  renameTarget = null;
  hide($('rename-overlay'));
}

function showRenameError(message: string): void {
  const errorElement = $('rename-error');
  errorElement.textContent = message;
  show(errorElement);
}

async function executeRename(): Promise<void> {
  const entry = renameTarget;
  if (!entry || state.busy) {
    return;
  }

  const input = $('rename-input') as HTMLInputElement;
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

  state.busy = true;
  try {
    const result = await getFileManagerAPI().renameFile(state.storage, entry.path, newName);
    if (!result.success) {
      showRenameError(result.error || 'Rename failed');
      return;
    }
    closeRenameOverlay();
    await loadListing(state.storage, state.path);
  } catch (error) {
    showRenameError(error instanceof Error ? error.message : String(error));
  } finally {
    state.busy = false;
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function setupEventListeners(): void {
  $('btn-close').addEventListener('click', () => getFileManagerAPI().closeWindow());
  $('btn-close-footer').addEventListener('click', () => getFileManagerAPI().closeWindow());

  $('tab-internal').addEventListener('click', () => void switchStorage('internal'));
  $('tab-usb').addEventListener('click', () => void switchStorage('usb'));

  $('btn-refresh').addEventListener('click', () => void loadCapabilities());
  $('btn-retry').addEventListener('click', () => void loadCapabilities());

  $('btn-select-all').addEventListener('click', selectAllFiles);
  $('btn-clear-selection').addEventListener('click', clearSelection);
  $('btn-delete-selected').addEventListener('click', () => {
    openDeleteConfirmation(Array.from(state.selection));
  });

  $('btn-confirm-cancel').addEventListener('click', closeDeleteConfirmation);
  $('btn-confirm-delete').addEventListener('click', () => void executeDelete());

  $('btn-rename-cancel').addEventListener('click', closeRenameOverlay);
  $('btn-rename-confirm').addEventListener('click', () => void executeRename());
  ($('rename-input') as HTMLInputElement).addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      void executeRename();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!$('rename-overlay').classList.contains('hidden')) {
        closeRenameOverlay();
      } else if (!$('confirm-overlay').classList.contains('hidden')) {
        closeDeleteConfirmation();
      }
    }
  });
}

function registerThemeListener(): void {
  getFileManagerAPI().receive?.('theme-changed', (data: unknown) => {
    applyDialogTheme(data as ThemeColors);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  logDebug('DOM ready, initializing file manager');
  initializeLucideIconsFromGlobal(LUCIDE_ICONS);
  setupEventListeners();
  registerThemeListener();
  void loadCapabilities();
});
