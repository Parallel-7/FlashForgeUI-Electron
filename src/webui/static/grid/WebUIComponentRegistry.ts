/**
 * @fileoverview Metadata and template registry for WebUI GridStack components.
 *
 * Exposes component definitions, default layout configuration, and HTML
 * templates for each panel rendered inside the browser WebUI. The registry
 * keeps component information centralized so layout logic and persistence can
 * look up defaults, while the Grid manager can instantiate panel content
 * without duplicating markup definitions throughout the application.
 */

import type {
  WebUIComponentDefinition,
  WebUIComponentLayout,
  WebUIComponentLayoutMap,
  WebUIComponentTemplate,
  WebUIGridLayout,
} from './types.js';

const DEFAULT_LAYOUT_VERSION = 2;

const COMPONENT_DEFINITIONS: Record<string, WebUIComponentDefinition> = {
  camera: {
    id: 'camera',
    displayName: 'Camera View',
    defaultSize: { w: 6, h: 6 },
    minSize: { w: 2, h: 2 },
    defaultPosition: { x: 0, y: 0 },
  },
  controls: {
    id: 'controls',
    displayName: 'Controls',
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 2, h: 2 },
    defaultPosition: { x: 6, y: 0 },
  },
  'model-preview': {
    id: 'model-preview',
    displayName: 'Model Preview',
    defaultSize: { w: 6, h: 2 },
    minSize: { w: 2, h: 2 },
    defaultPosition: { x: 6, y: 4 },
  },
  'printer-state': {
    id: 'printer-state',
    displayName: 'Printer State',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    defaultPosition: { x: 0, y: 6 },
  },
  'temp-control': {
    id: 'temp-control',
    displayName: 'Temperature Control',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    defaultPosition: { x: 3, y: 6 },
  },
  'filtration-tvoc': {
    id: 'filtration-tvoc',
    displayName: 'Filtration & TVOC',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    defaultPosition: { x: 0, y: 8 },
  },
  'job-progress': {
    id: 'job-progress',
    displayName: 'Job Progress',
    defaultSize: { w: 6, h: 2 },
    minSize: { w: 2, h: 2 },
    defaultPosition: { x: 6, y: 6 },
  },
  'job-details': {
    id: 'job-details',
    displayName: 'Job Details',
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 2, h: 2 },
    defaultPosition: { x: 6, y: 8 },
  },
  'spoolman-tracker': {
    id: 'spoolman-tracker',
    displayName: 'Spoolman Tracker',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    defaultPosition: { x: 3, y: 8 },
  },
};

const COMPONENT_TEMPLATES: Record<string, WebUIComponentTemplate> = {
  camera: {
    id: 'camera',
    html: `
      <div class="panel panel-camera" id="camera-panel">
        <div class="panel-header">Camera</div>
        <div class="panel-content camera-panel-content">
          <div id="camera-placeholder" class="no-camera">Camera Unavailable</div>
          <img id="camera-stream" class="camera-stream hidden" alt="Printer camera stream">
          <canvas id="camera-canvas" class="camera-stream hidden"></canvas>
        </div>
      </div>
    `,
  },
  controls: {
    id: 'controls',
    html: `
      <div class="panel" id="control-grid">
        <div class="panel-header">Controls</div>
        <div class="panel-content">
          <div class="btn-row">
            <button id="btn-led-on" class="control-btn">LED On</button>
            <button id="btn-clear-status" class="control-btn">Clear Status</button>
          </div>
          <div class="btn-row">
            <button id="btn-led-off" class="control-btn">LED Off</button>
            <button id="btn-home-axes" class="control-btn">Home Axes</button>
          </div>
          <div class="btn-row">
            <button id="btn-pause" class="control-btn">Pause</button>
            <button id="btn-resume" class="control-btn">Resume</button>
          </div>
          <div class="btn-row">
            <button id="btn-cancel" class="control-btn">Cancel Print</button>
            <button id="btn-start-recent" class="control-btn">Recent Files</button>
          </div>
          <div class="btn-row">
            <button id="btn-start-local" class="control-btn">Local Files</button>
            <button id="btn-refresh" class="control-btn">Refresh Status</button>
          </div>
        </div>
      </div>
    `,
  },
  'model-preview': {
    id: 'model-preview',
    html: `
      <div class="panel" id="model-preview-panel">
        <div class="panel-header">Model Preview</div>
        <div class="panel-content" id="model-preview">
          <div class="no-preview">No preview available</div>
        </div>
      </div>
    `,
  },
  'printer-state': {
    id: 'printer-state',
    html: `
      <div class="panel" id="printer-state-panel">
        <div class="panel-header">Printer State</div>
        <div class="panel-content">
          <div class="state-row">
            <span>Status:</span>
            <span id="printer-status">Unknown</span>
          </div>
          <div class="state-row">
            <span>Lifetime Print Time:</span>
            <span id="lifetime-print-time">--</span>
          </div>
          <div class="state-row">
            <span>Lifetime Filament:</span>
            <span id="lifetime-filament">--</span>
          </div>
        </div>
      </div>
    `,
  },
  'temp-control': {
    id: 'temp-control',
    html: `
      <div class="panel" id="temp-control-panel">
        <div class="panel-header">Temperature Control</div>
        <div class="panel-content">
          <div class="temp-row">
            <span>Bed: <span id="bed-temp">--°C / --°C</span></span>
            <div class="temp-buttons">
              <button id="btn-bed-set" class="temp-btn">Set</button>
              <button id="btn-bed-off" class="temp-btn">Off</button>
            </div>
          </div>
          <div class="temp-row">
            <span>Extruder: <span id="extruder-temp">--°C / --°C</span></span>
            <div class="temp-buttons">
              <button id="btn-extruder-set" class="temp-btn">Set</button>
              <button id="btn-extruder-off" class="temp-btn">Off</button>
            </div>
          </div>
        </div>
      </div>
    `,
  },
  'filtration-tvoc': {
    id: 'filtration-tvoc',
    html: `
      <div class="panel" id="filtration-panel">
        <div class="panel-header">Filtration &amp; TVOC</div>
        <div class="panel-content">
          <div class="filtration-section" id="filtration-section">
            <div class="status-title">Filtration: <span id="filtration-status">Off</span></div>
            <div class="filtration-buttons">
              <button id="btn-external-filtration" class="filtration-btn">External</button>
              <button id="btn-internal-filtration" class="filtration-btn">Internal</button>
              <button id="btn-no-filtration" class="filtration-btn">Off</button>
            </div>
          </div>
          <div class="tvoc-info hidden" id="tvoc-info">
            <div class="status-title">TVOC Level: <span id="tvoc-status">--</span></div>
          </div>
        </div>
      </div>
    `,
  },
  'job-progress': {
    id: 'job-progress',
    html: `
      <div class="panel" id="job-progress-panel">
        <div class="panel-header">Job Progress</div>
        <div class="panel-content">
          <div class="job-row">
            <span>Current Job:</span>
            <span id="current-job">No active job</span>
          </div>
          <div class="progress-row">
            <span>Progress:</span>
            <span id="progress-percentage">0%</span>
          </div>
          <progress id="progress-bar" value="0" max="100"></progress>
        </div>
      </div>
    `,
  },
  'job-details': {
    id: 'job-details',
    html: `
      <div class="panel" id="job-details-panel">
        <div class="panel-header">Job Details</div>
        <div class="panel-content">
          <div class="detail-row">
            <span>Filament Usage:</span>
            <span id="job-filament-usage">--</span>
          </div>
          <div class="detail-row">
            <span>Layer:</span>
            <span id="layer-info">-- / --</span>
          </div>
          <div class="detail-row">
            <span>Time Remaining:</span>
            <span id="time-remaining">--:--</span>
          </div>
          <div class="detail-row">
            <span>Elapsed:</span>
            <span id="elapsed-time">--:--</span>
          </div>
        </div>
      </div>
    `,
  },
  'spoolman-tracker': {
    id: 'spoolman-tracker',
    html: `
      <div class="panel" id="spoolman-panel">
        <div class="panel-header">Spoolman Tracker</div>
        <div class="panel-content">
          <div id="spoolman-disabled" class="spoolman-state hidden">
            <div class="spoolman-message" id="spoolman-disabled-message">Spoolman integration is disabled</div>
          </div>
          <div id="spoolman-no-spool" class="spoolman-state hidden">
            <div class="spoolman-message">No spool selected</div>
            <button id="btn-select-spool" class="control-btn">Select Spool</button>
          </div>
          <div id="spoolman-active" class="spoolman-state hidden">
            <div class="spool-info">
              <div class="spool-color-indicator" id="spool-color"></div>
              <div class="spool-details">
                <div class="spool-name" id="spool-name">--</div>
                <div class="spool-meta" id="spool-meta">--</div>
              </div>
            </div>
            <div class="spool-stats">
              <div class="stat-row">
                <span>Remaining:</span>
                <span id="spool-remaining">--</span>
              </div>
            </div>
            <button id="btn-change-spool" class="temp-btn">Change</button>
          </div>
        </div>
      </div>
    `,
  },
};

const DEFAULT_LAYOUT_COMPONENTS: WebUIComponentLayoutMap = {
  camera: { x: 0, y: 0, w: 6, h: 6 },
  controls: { x: 6, y: 0, w: 6, h: 4 },
  'model-preview': { x: 6, y: 4, w: 6, h: 2 },
  'printer-state': { x: 0, y: 6, w: 3, h: 2 },
  'temp-control': { x: 3, y: 6, w: 3, h: 2 },
  'job-progress': { x: 6, y: 6, w: 6, h: 2 },
  'filtration-tvoc': { x: 0, y: 8, w: 3, h: 2 },
  'spoolman-tracker': { x: 3, y: 8, w: 3, h: 2 },
  'job-details': { x: 6, y: 8, w: 6, h: 3 },
};

const COMPONENT_IDS = Object.keys(COMPONENT_DEFINITIONS);

export const DEFAULT_LAYOUT: WebUIGridLayout = {
  version: DEFAULT_LAYOUT_VERSION,
  components: DEFAULT_LAYOUT_COMPONENTS,
};

function cloneLayout(
  layout: WebUIComponentLayout | undefined,
): WebUIComponentLayout | undefined {
  if (!layout) {
    return undefined;
  }
  return { ...layout };
}

function cloneGridLayout(layout: WebUIGridLayout): WebUIGridLayout {
  const clonedEntries = Object.entries(layout.components ?? {}).reduce<
    WebUIComponentLayoutMap
  >((acc, [componentId, config]) => {
    acc[componentId] = cloneLayout(config);
    return acc;
  }, {});

  return {
    version: layout.version,
    components: clonedEntries,
    hiddenComponents: layout.hiddenComponents
      ? [...layout.hiddenComponents]
      : undefined,
  };
}

export function getComponentDefinition(
  componentId: string,
): WebUIComponentDefinition | undefined {
  return COMPONENT_DEFINITIONS[componentId];
}

export function getDefaultLayoutConfig(
  componentId: string,
): WebUIComponentLayout | undefined {
  return cloneLayout(DEFAULT_LAYOUT_COMPONENTS[componentId]);
}

export function getAllComponentIds(): string[] {
  return [...COMPONENT_IDS];
}

export function getComponentTemplate(
  componentId: string,
): WebUIComponentTemplate | undefined {
  return COMPONENT_TEMPLATES[componentId];
}

const componentInstanceCache = new Map<string, HTMLElement>();

export function createComponentElement(componentId: string): HTMLElement {
  const cached = componentInstanceCache.get(componentId);
  if (cached) {
    return cached;
  }

  const template = COMPONENT_TEMPLATES[componentId];
  if (!template) {
    throw new Error(`Unknown component: ${componentId}`);
  }

  const wrapper = document.createElement('template');
  wrapper.innerHTML = template.html.trim();
  const element = wrapper.content.firstElementChild as HTMLElement | null;
  if (!element) {
    throw new Error(`Template missing root element for ${componentId}`);
  }

  element.dataset.componentId = componentId;
  componentInstanceCache.set(componentId, element);
  return element;
}

export const componentRegistry = {
  getDefinition: getComponentDefinition,
  getDefault: getDefaultLayoutConfig,
  getAllIds: getAllComponentIds,
  getTemplate: getComponentTemplate,
  createElement: createComponentElement,
  getDefaultLayout(): WebUIGridLayout {
    return cloneGridLayout(DEFAULT_LAYOUT);
  },
};
