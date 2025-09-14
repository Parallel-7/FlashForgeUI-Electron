# FlashForgeUI Phase 1 Implementation Guide: Component Extraction

## Overview

This document provides the complete implementation guide for Phase 1 of the FlashForgeUI main window refactoring. Phase 1 focuses exclusively on extracting the existing monolithic UI into discrete, reusable components **without any functional changes**. This refactoring will establish the foundation for Phase 2's configurable grid layout system.

## Table of Contents

1. [Prerequisites & Setup](#prerequisites--setup)
2. [Component Architecture Design](#component-architecture-design)
3. [Implementation Steps](#implementation-steps)
4. [Component Extraction Details](#component-extraction-details)
5. [Integration & Testing](#integration--testing)
6. [Risk Management](#risk-management)
7. [Validation Checklist](#validation-checklist)

## Prerequisites & Setup

### Development Environment

- Node.js environment with existing FlashForgeUI-Electron project
- TypeScript compiler configured (existing `tsconfig.renderer.json`)
- Webpack bundler configured (existing `webpack.config.js`)
- Understanding of existing IPC patterns and data flow

### Current Architecture Understanding

The existing UI consists of:
- **Monolithic HTML**: `src/index.html` (200 lines)
- **Monolithic CSS**: `src/index.css` (700+ lines)
- **Monolithic TypeScript**: `src/renderer.ts` (1000+ lines)
- **UI Updater Service**: `src/services/ui-updater.ts` (565 lines)

## Component Architecture Design

### Directory Structure

Create the following new directory structure:

```
src/ui/components/
├── camera-preview/
│   ├── camera-preview.html
│   ├── camera-preview.css
│   ├── camera-preview.ts
│   └── index.ts
├── job-info/
│   ├── job-info.html
│   ├── job-info.css
│   ├── job-info.ts
│   └── index.ts
├── controls-grid/
│   ├── controls-grid.html
│   ├── controls-grid.css
│   ├── controls-grid.ts
│   └── index.ts
├── model-preview/
│   ├── model-preview.html
│   ├── model-preview.css
│   ├── model-preview.ts
│   └── index.ts
├── job-stats/
│   ├── job-stats.html
│   ├── job-stats.css
│   ├── job-stats.ts
│   └── index.ts
├── printer-status/
│   ├── printer-status.html
│   ├── printer-status.css
│   ├── printer-status.ts
│   └── index.ts
├── temperature-controls/
│   ├── temperature-controls.html
│   ├── temperature-controls.css
│   ├── temperature-controls.ts
│   └── index.ts
├── filtration-controls/
│   ├── filtration-controls.html
│   ├── filtration-controls.css
│   ├── filtration-controls.ts
│   └── index.ts
├── additional-info/
│   ├── additional-info.html
│   ├── additional-info.css
│   ├── additional-info.ts
│   └── index.ts
├── log-panel/
│   ├── log-panel.html
│   ├── log-panel.css
│   ├── log-panel.ts
│   └── index.ts
└── base/
    ├── component.ts
    └── types.ts
```

### Component Base Class

Create `src/ui/components/base/component.ts`:

```typescript
/**
 * Base class for UI components
 * Provides common functionality for component lifecycle, DOM manipulation, and event handling
 */
export abstract class BaseComponent {
  protected container: HTMLElement | null = null;
  protected isInitialized = false;
  protected isDestroyed = false;

  abstract componentId: string;
  abstract templateHTML: string;
  
  constructor(protected parentElement: HTMLElement) {}

  /**
   * Initialize the component - creates DOM structure and sets up event listeners
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isDestroyed) return;
    
    this.container = this.createContainer();
    this.container.innerHTML = this.templateHTML;
    this.parentElement.appendChild(this.container);
    
    await this.setupEventListeners();
    await this.onInitialized();
    
    this.isInitialized = true;
  }

  /**
   * Update component with new data
   */
  abstract update(data: any): void;

  /**
   * Setup component-specific event listeners
   */
  protected abstract setupEventListeners(): Promise<void>;

  /**
   * Called after component is initialized
   */
  protected async onInitialized(): Promise<void> {}

  /**
   * Create the container element for this component
   */
  protected createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `component-${this.componentId}`;
    container.setAttribute('data-component', this.componentId);
    return container;
  }

  /**
   * Find element within component scope
   */
  protected findElement<T extends HTMLElement>(selector: string): T | null {
    return this.container?.querySelector(selector) || null;
  }

  /**
   * Find element by ID within component scope
   */
  protected findElementById<T extends HTMLElement>(id: string): T | null {
    return this.container?.querySelector(`#${id}`) || null;
  }

  /**
   * Safely set text content of element
   */
  protected setElementText(selector: string, text: string): void {
    const element = this.findElement(selector);
    if (element) {
      element.textContent = text;
    }
  }

  /**
   * Safely set element attribute
   */
  protected setElementAttribute(selector: string, attribute: string, value: string | number): void {
    const element = this.findElement(selector);
    if (element) {
      element.setAttribute(attribute, value.toString());
    }
  }

  /**
   * Destroy the component and clean up resources
   */
  destroy(): void {
    if (this.isDestroyed) return;
    
    this.cleanup();
    
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    
    this.isDestroyed = true;
    this.isInitialized = false;
  }

  /**
   * Component-specific cleanup logic
   */
  protected cleanup(): void {}

  /**
   * Check if component is ready for operations
   */
  protected assertInitialized(): void {
    if (!this.isInitialized || this.isDestroyed) {
      throw new Error(`Component ${this.componentId} is not initialized or has been destroyed`);
    }
  }
}
```

### Component Types

Create `src/ui/components/base/types.ts`:

```typescript
import type { PollingData } from '../../types/polling';

/**
 * Common interfaces for all components
 */
export interface ComponentConfig {
  id: string;
  parentElement: HTMLElement;
  initialData?: any;
}

export interface ComponentUpdateData {
  pollingData?: PollingData;
  printerState?: string;
  connectionState?: boolean;
  [key: string]: any;
}

export interface ComponentEventHandler {
  element: string | HTMLElement;
  event: string;
  handler: (event: Event) => void | Promise<void>;
}

/**
 * Component lifecycle events
 */
export enum ComponentEvents {
  INITIALIZED = 'component:initialized',
  UPDATED = 'component:updated',
  DESTROYED = 'component:destroyed',
  ERROR = 'component:error'
}
```

## Implementation Steps

### Step 1: Create Base Component System

1. **Create base directory structure**:
   ```bash
   mkdir -p src/ui/components/base
   ```

2. **Implement base component class** (as shown above)

3. **Create component manager** - `src/ui/components/ComponentManager.ts`:

```typescript
/**
 * Manages all UI components lifecycle and communication
 */
import { BaseComponent } from './base/component';
import type { ComponentUpdateData } from './base/types';

export class ComponentManager {
  private components = new Map<string, BaseComponent>();
  private initialized = false;

  /**
   * Register a component with the manager
   */
  registerComponent(component: BaseComponent): void {
    if (this.components.has(component.componentId)) {
      throw new Error(`Component ${component.componentId} is already registered`);
    }
    
    this.components.set(component.componentId, component);
  }

  /**
   * Initialize all registered components
   */
  async initializeAll(): Promise<void> {
    if (this.initialized) return;

    const initPromises = Array.from(this.components.values()).map(component => 
      component.initialize().catch(error => {
        console.error(`Failed to initialize component ${component.componentId}:`, error);
      })
    );

    await Promise.all(initPromises);
    this.initialized = true;
  }

  /**
   * Update all components with new data
   */
  updateAll(data: ComponentUpdateData): void {
    this.components.forEach(component => {
      try {
        component.update(data);
      } catch (error) {
        console.error(`Failed to update component ${component.componentId}:`, error);
      }
    });
  }

  /**
   * Update specific component
   */
  updateComponent(componentId: string, data: ComponentUpdateData): void {
    const component = this.components.get(componentId);
    if (component) {
      component.update(data);
    }
  }

  /**
   * Get component by ID
   */
  getComponent<T extends BaseComponent>(componentId: string): T | undefined {
    return this.components.get(componentId) as T;
  }

  /**
   * Destroy all components
   */
  destroyAll(): void {
    this.components.forEach(component => component.destroy());
    this.components.clear();
    this.initialized = false;
  }
}

// Global component manager instance
export const componentManager = new ComponentManager();
```

### Step 2: Extract Components (Priority Order)

#### 2A. Log Panel Component (Simplest First)

**File: `src/ui/components/log-panel/log-panel.html`**:
```html
<div class="log-panel">
  <div id="log-output"></div>
</div>
```

**File: `src/ui/components/log-panel/log-panel.css`**:
```css
.component-log-panel .log-panel {
  height: 150px;
  background-color: var(--darker-bg);
  border-top: 1px solid var(--border-color);
  overflow-y: auto;
  flex-shrink: 0;
}

.component-log-panel #log-output {
  padding: 5px;
  font-family: monospace;
  white-space: pre-wrap;
  font-size: 11px;
  line-height: 1.2;
}
```

**File: `src/ui/components/log-panel/log-panel.ts`**:
```typescript
import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';

export class LogPanelComponent extends BaseComponent {
  componentId = 'log-panel';
  templateHTML = `
    <div class="log-panel">
      <div id="log-output"></div>
    </div>
  `;

  protected async setupEventListeners(): Promise<void> {
    // Log panel doesn't need event listeners - it's output only
  }

  update(data: ComponentUpdateData): void {
    // Log panel updates are handled by the logMessage function
    // No polling data updates needed
  }

  /**
   * Add a log message (called by global logMessage function)
   */
  addLogMessage(message: string): void {
    this.assertInitialized();
    
    const logOutput = this.findElementById('log-output');
    if (logOutput) {
      const timestamp = new Date().toLocaleTimeString();
      logOutput.innerHTML += `<div>[${timestamp}] ${message}</div>`;
      logOutput.scrollTop = logOutput.scrollHeight;
    }
  }

  /**
   * Clear all log messages
   */
  clearLogs(): void {
    this.assertInitialized();
    
    const logOutput = this.findElementById('log-output');
    if (logOutput) {
      logOutput.innerHTML = '';
    }
  }
}
```

**File: `src/ui/components/log-panel/index.ts`**:
```typescript
export { LogPanelComponent } from './log-panel';
import './log-panel.css';
```

#### 2B. Model Preview Component

**File: `src/ui/components/model-preview/model-preview.html`**:
```html
<div class="model-panel" id="model-preview-panel">
  <div class="panel-header">Model Preview</div>
  <div class="panel-content" id="model-preview"></div>
</div>
```

**File: `src/ui/components/model-preview/model-preview.css`**:
```css
.component-model-preview .model-panel {
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 100px;
  overflow: hidden;
}

.component-model-preview .panel-header {
  background-color: var(--header-bg);
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color);
  font-size: 11px;
  font-weight: 600;
}

.component-model-preview .panel-content {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: transparent;
  overflow: hidden;
}

.component-model-preview #model-preview {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.component-model-preview .preview-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  color: #888;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.component-model-preview .preview-placeholder-text p {
  margin: 4px 0;
}

.component-model-preview .preview-placeholder-text strong {
  color: var(--text-color);
}
```

**File: `src/ui/components/model-preview/model-preview.ts`**:
```typescript
import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import type { PollingData } from '../../types/polling';

export class ModelPreviewComponent extends BaseComponent {
  componentId = 'model-preview';
  templateHTML = `
    <div class="model-panel" id="model-preview-panel">
      <div class="panel-header">Model Preview</div>
      <div class="panel-content" id="model-preview"></div>
    </div>
  `;

  protected async setupEventListeners(): Promise<void> {
    // Model preview doesn't need event listeners - it's display only
  }

  update(data: ComponentUpdateData): void {
    this.assertInitialized();
    
    if (data.pollingData) {
      this.updateModelPreview(data.pollingData);
    }
  }

  private updateModelPreview(data: PollingData): void {
    const previewContainer = this.findElementById('model-preview');
    if (!previewContainer) return;

    const job = data.printerStatus?.currentJob;
    const isJobActive = job && job.isActive;

    if (!isJobActive) {
      this.clearModelPreview();
      return;
    }

    if (data.thumbnailData) {
      this.showThumbnail(data.thumbnailData, job?.displayName || 'Model Preview');
    } else {
      this.showJobPlaceholder(job?.displayName || 'Current Job');
    }
  }

  private showThumbnail(thumbnailData: string, altText: string): void {
    const previewContainer = this.findElementById('model-preview');
    if (!previewContainer) return;

    const img = document.createElement('img');
    img.src = thumbnailData;
    img.alt = altText;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    
    img.onerror = () => {
      console.warn('Failed to load model thumbnail');
      this.clearModelPreview();
    };

    previewContainer.innerHTML = '';
    previewContainer.appendChild(img);
  }

  private showJobPlaceholder(jobName: string): void {
    const previewContainer = this.findElementById('model-preview');
    if (!previewContainer) return;

    previewContainer.innerHTML = `
      <div class="preview-placeholder">
        <div class="preview-placeholder-text">
          <p>Preview for:</p>
          <p><strong>${jobName}</strong></p>
          <p>No thumbnail available</p>
        </div>
      </div>
    `;
  }

  private clearModelPreview(): void {
    const previewContainer = this.findElementById('model-preview');
    if (previewContainer) {
      previewContainer.innerHTML = `
        <div class="preview-placeholder">
          <div class="preview-placeholder-text">No active job</div>
        </div>
      `;
    }
  }
}
```

#### 2C. Job Statistics Component

**File: `src/ui/components/job-stats/job-stats.html`**:
```html
<div class="job-stats-panel">
  <div class="panel-header">Job Info</div>
  <div class="panel-content">
    <div class="info-row">
      <span>Layer:</span>
      <span id="layer-info">0 / 0</span>
    </div>
    <div class="info-row">
      <span>ETA:</span>
      <span id="eta">--:--</span>
    </div>
    <div class="info-row">
      <span>Job Time:</span>
      <span id="job-time">00:00</span>
    </div>
    <div class="info-row">
      <span>Weight:</span>
      <span id="weight">0g</span>
    </div>
    <div class="info-row">
      <span>Length:</span>
      <span id="length">0m</span>
    </div>
  </div>
</div>
```

**File: `src/ui/components/job-stats/job-stats.css`**:
```css
.component-job-stats .job-stats-panel {
  height: 180px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-top: 1px solid var(--border-color);
}

.component-job-stats .panel-header {
  background-color: var(--header-bg);
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color);
  font-size: 11px;
  font-weight: 600;
}

.component-job-stats .panel-content {
  padding: 8px;
  flex: 1;
  overflow: hidden;
}

.component-job-stats .info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.component-job-stats .info-row span:first-child {
  color: #aaa;
  font-size: 11px;
}

.component-job-stats .info-row span:last-child {
  color: var(--text-color);
  font-weight: 500;
  font-size: 11px;
}
```

**File: `src/ui/components/job-stats/job-stats.ts`**:
```typescript
import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import type { PollingData } from '../../types/polling';
import { formatTime, formatWeight, formatLength } from '../../types/polling';

export class JobStatsComponent extends BaseComponent {
  componentId = 'job-stats';
  templateHTML = `
    <div class="job-stats-panel">
      <div class="panel-header">Job Info</div>
      <div class="panel-content">
        <div class="info-row">
          <span>Layer:</span>
          <span id="layer-info">0 / 0</span>
        </div>
        <div class="info-row">
          <span>ETA:</span>
          <span id="eta">--:--</span>
        </div>
        <div class="info-row">
          <span>Job Time:</span>
          <span id="job-time">00:00</span>
        </div>
        <div class="info-row">
          <span>Weight:</span>
          <span id="weight">0g</span>
        </div>
        <div class="info-row">
          <span>Length:</span>
          <span id="length">0m</span>
        </div>
      </div>
    </div>
  `;

  protected async setupEventListeners(): Promise<void> {
    // Job stats is display-only, no event listeners needed
  }

  update(data: ComponentUpdateData): void {
    this.assertInitialized();
    
    if (data.pollingData) {
      this.updateJobStats(data.pollingData);
    }
  }

  private updateJobStats(data: PollingData): void {
    const job = data.printerStatus?.currentJob;
    
    if (!job || !job.isActive) {
      this.clearJobStats();
      return;
    }

    // Update layer information
    const currentLayer = job.progress.currentLayer || 0;
    const totalLayers = job.progress.totalLayers || 0;
    this.setElementText('#layer-info', `${currentLayer} / ${totalLayers}`);

    // Update timing
    this.setElementText('#eta', this.formatETA(job.progress.formattedEta, job.progress.timeRemaining));
    this.setElementText('#job-time', formatTime(job.progress.elapsedTime));

    // Update material usage
    this.setElementText('#weight', formatWeight(job.progress.weightUsed));
    this.setElementText('#length', formatLength(job.progress.lengthUsed));
  }

  private clearJobStats(): void {
    this.setElementText('#layer-info', '0 / 0');
    this.setElementText('#eta', '--:--');
    this.setElementText('#job-time', '00:00');
    this.setElementText('#weight', '0g');
    this.setElementText('#length', '0.0m');
  }

  private formatETA(formattedEta?: string, timeRemainingMinutes?: number | null): string {
    if (formattedEta && formattedEta !== '') {
      try {
        const [hours, minutes] = formattedEta.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const now = new Date();
          const completionTime = new Date(now.getTime() + (hours * 60 + minutes) * 60 * 1000);
          
          return completionTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        }
      } catch {
        console.warn('Failed to parse formatted ETA:', formattedEta);
      }
    }
    
    if (timeRemainingMinutes !== null && timeRemainingMinutes !== undefined && timeRemainingMinutes > 0) {
      const now = new Date();
      const completionTime = new Date(now.getTime() + timeRemainingMinutes * 60 * 1000);
      
      return completionTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
    
    return '--:--';
  }
}
```

#### 2D. Camera Preview Component (Complex)

**File: `src/ui/components/camera-preview/camera-preview.html`**:
```html
<div class="camera-view">
  <div class="no-camera">Preview Disabled</div>
</div>
```

**File: `src/ui/components/camera-preview/camera-preview.css`**:
```css
.component-camera-preview .camera-view {
  flex: 1;
  min-height: 200px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  position: relative;
  background-color: var(--darker-bg);
}

.component-camera-preview .camera-view img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.component-camera-preview .no-camera {
  position: absolute;
  color: #aaa;
  font-style: italic;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
}

.component-camera-preview .camera-error {
  position: absolute;
  color: var(--error-color);
  font-style: italic;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
}
```

**File: `src/ui/components/camera-preview/camera-preview.ts`**:
```typescript
import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import type { ResolvedCameraConfig } from '../../types/camera';

export class CameraPreviewComponent extends BaseComponent {
  componentId = 'camera-preview';
  templateHTML = `
    <div class="camera-view">
      <div class="no-camera">Preview Disabled</div>
    </div>
  `;

  private cameraStreamElement: HTMLImageElement | null = null;
  private previewEnabled = false;

  protected async setupEventListeners(): Promise<void> {
    // Camera preview is controlled by external button in job-info component
    // No direct event listeners needed here
  }

  update(data: ComponentUpdateData): void {
    this.assertInitialized();
    
    // Camera preview state is managed by the camera toggle button
    // This component just displays the stream when enabled
  }

  /**
   * Toggle camera preview on/off
   */
  async togglePreview(button: HTMLElement): Promise<void> {
    this.assertInitialized();
    
    const cameraView = this.findElement('.camera-view');
    if (!cameraView || !window.api?.camera) {
      console.error('Camera view or API not available');
      return;
    }

    if (!this.previewEnabled) {
      await this.enablePreview(button, cameraView);
    } else {
      this.disablePreview(button, cameraView);
    }
  }

  private async enablePreview(button: HTMLElement, cameraView: HTMLElement): Promise<void> {
    try {
      button.textContent = 'Loading...';
      button.disabled = true;

      // Get camera configuration
      const cameraConfig: ResolvedCameraConfig = await window.api.camera.getConfig();
      console.log('Camera config:', cameraConfig);

      if (!cameraConfig.enabled) {
        throw new Error('Camera is disabled in settings');
      }

      // Get proxy URL for camera stream
      const proxyUrl = await window.api.camera.getProxyUrl();
      console.log('Camera proxy URL:', proxyUrl);

      // Create and configure image element
      this.cameraStreamElement = document.createElement('img');
      this.cameraStreamElement.style.width = '100%';
      this.cameraStreamElement.style.height = '100%';
      this.cameraStreamElement.style.objectFit = 'cover';
      
      // Handle successful image load
      this.cameraStreamElement.onload = () => {
        console.log('Camera stream loaded successfully');
        button.textContent = 'Preview On';
        button.disabled = false;
        this.previewEnabled = true;
      };

      // Handle image load errors
      this.cameraStreamElement.onerror = (error) => {
        console.error('Camera stream error:', error);
        this.handleCameraError(button, cameraView);
      };

      // Set image source to start loading
      this.cameraStreamElement.src = proxyUrl;
      
      // Clear existing content and add image
      cameraView.innerHTML = '';
      cameraView.appendChild(this.cameraStreamElement);

    } catch (error) {
      console.error('Failed to enable camera preview:', error);
      this.handleCameraError(button, cameraView);
    }
  }

  private disablePreview(button: HTMLElement, cameraView: HTMLElement): void {
    console.log('Disabling camera preview');
    
    // Clean up image element
    if (this.cameraStreamElement) {
      this.cameraStreamElement.onload = null;
      this.cameraStreamElement.onerror = null;
      this.cameraStreamElement = null;
    }

    // Update UI
    this.previewEnabled = false;
    button.textContent = 'Preview Off';
    button.disabled = false;
    cameraView.innerHTML = '<div class="no-camera">Preview Disabled</div>';
  }

  private handleCameraError(button: HTMLElement, cameraView: HTMLElement): void {
    this.previewEnabled = false;
    button.textContent = 'Preview On';
    button.disabled = false;
    cameraView.innerHTML = '<div class="camera-error">Camera error</div>';
  }

  /**
   * Get current preview state
   */
  isPreviewEnabled(): boolean {
    return this.previewEnabled;
  }

  protected cleanup(): void {
    if (this.cameraStreamElement) {
      this.cameraStreamElement.onload = null;
      this.cameraStreamElement.onerror = null;
      this.cameraStreamElement = null;
    }
    this.previewEnabled = false;
  }
}
```

#### 2E. Job Info Component (Includes Camera Controls)

**File: `src/ui/components/job-info/job-info.html`**:
```html
<div class="job-info-panel">
  <div class="job-row">
    <span>Current Job:</span>
    <span id="current-job">No active job</span>
  </div>
  <div class="progress-row">
    <span>Progress:</span>
    <span id="progress-percentage">0%</span>
  </div>
  <progress id="progress-bar" value="0" max="100"></progress>
  <div class="camera-controls">
    <button id="btn-preview">Preview Off</button>
  </div>
</div>
```

**File: `src/ui/components/job-info/job-info.css`**:
```css
.component-job-info .job-info-panel {
  background-color: var(--dark-bg);
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.component-job-info .job-row,
.component-job-info .progress-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.component-job-info .job-row span:first-child,
.component-job-info .progress-row span:first-child {
  color: #aaa;
  font-size: 11px;
}

.component-job-info .job-row span:last-child,
.component-job-info .progress-row span:last-child {
  color: var(--text-color);
  font-weight: 500;
  font-size: 11px;
}

.component-job-info progress {
  width: 100%;
  height: 4px;
  margin-bottom: 8px;
  appearance: none;
  -webkit-appearance: none;
  border: none;
  background-color: var(--darker-bg);
  border-radius: 2px;
}

.component-job-info progress::-webkit-progress-bar {
  background-color: var(--darker-bg);
  border-radius: 2px;
}

.component-job-info progress::-webkit-progress-value {
  background: linear-gradient(90deg, var(--button-bg) 0%, var(--button-hover) 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.component-job-info progress::-moz-progress-bar {
  background: linear-gradient(90deg, var(--button-bg) 0%, var(--button-hover) 100%);
  border-radius: 2px;
}

/* Progress bar state classes */
.component-job-info progress.printing::-webkit-progress-value,
.component-job-info progress.printing::-moz-progress-bar {
  background: linear-gradient(90deg, var(--success-color) 0%, #66bb6a 100%);
}

.component-job-info progress.paused::-webkit-progress-value,
.component-job-info progress.paused::-moz-progress-bar {
  background: linear-gradient(90deg, var(--warning-color) 0%, #ffb74d 100%);
}

.component-job-info progress.completed::-webkit-progress-value,
.component-job-info progress.completed::-moz-progress-bar {
  background: linear-gradient(90deg, var(--success-color) 0%, #66bb6a 100%);
}

.component-job-info progress.error::-webkit-progress-value,
.component-job-info progress.error::-moz-progress-bar {
  background: linear-gradient(90deg, var(--error-color) 0%, #ef5350 100%);
}

.component-job-info .camera-controls {
  display: flex;
  justify-content: flex-end;
}

.component-job-info .camera-controls button {
  padding: 4px 12px;
  border: 1px solid var(--border-color);
  background-color: var(--darker-bg);
  color: var(--text-color);
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.component-job-info .camera-controls button:hover {
  background-color: var(--button-bg);
  border-color: var(--button-hover);
}

.component-job-info .camera-controls button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

**File: `src/ui/components/job-info/job-info.ts`**:
```typescript
import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import type { PollingData, PrinterStatus } from '../../types/polling';
import { componentManager } from '../ComponentManager';
import type { CameraPreviewComponent } from '../camera-preview/camera-preview';

export class JobInfoComponent extends BaseComponent {
  componentId = 'job-info';
  templateHTML = `
    <div class="job-info-panel">
      <div class="job-row">
        <span>Current Job:</span>
        <span id="current-job">No active job</span>
      </div>
      <div class="progress-row">
        <span>Progress:</span>
        <span id="progress-percentage">0%</span>
      </div>
      <progress id="progress-bar" value="0" max="100"></progress>
      <div class="camera-controls">
        <button id="btn-preview">Preview Off</button>
      </div>
    </div>
  `;

  protected async setupEventListeners(): Promise<void> {
    const previewButton = this.findElementById('btn-preview');
    if (previewButton) {
      previewButton.addEventListener('click', () => this.handleCameraToggle());
    }
  }

  update(data: ComponentUpdateData): void {
    this.assertInitialized();
    
    if (data.pollingData) {
      this.updateJobInfo(data.pollingData);
    }
  }

  private updateJobInfo(data: PollingData): void {
    const job = data.printerStatus?.currentJob;
    
    if (!job || !job.isActive) {
      this.clearJobInfo();
      return;
    }

    // Update job identification
    this.setElementText('#current-job', job.displayName || job.fileName);

    // Update progress
    const progressPercent = Math.round(job.progress.percentage);
    this.setElementText('#progress-percentage', `${progressPercent}%`);
    this.setElementAttribute('#progress-bar', 'value', progressPercent);

    // Update progress bar style based on printer state
    this.updateProgressBarStyle(progressPercent, data.printerStatus?.state);
  }

  private clearJobInfo(): void {
    this.setElementText('#current-job', 'No active job');
    this.setElementText('#progress-percentage', '0%');
    this.setElementAttribute('#progress-bar', 'value', 0);
    
    // Clear progress bar state classes
    const progressBar = this.findElementById('progress-bar');
    if (progressBar) {
      progressBar.classList.remove('printing', 'paused', 'completed', 'error');
    }
  }

  private updateProgressBarStyle(percentage: number, state?: PrinterStatus['state']): void {
    const progressBar = this.findElementById('progress-bar') as HTMLProgressElement;
    if (!progressBar) return;

    // Remove existing state classes
    progressBar.classList.remove('printing', 'paused', 'completed', 'error');

    // Add appropriate state class
    if (state) {
      switch (state) {
        case 'Printing':
          progressBar.classList.add('printing');
          break;
        case 'Paused':
          progressBar.classList.add('paused');
          break;
        case 'Completed':
          progressBar.classList.add('completed');
          break;
        case 'Error':
          progressBar.classList.add('error');
          break;
      }
    }
  }

  private async handleCameraToggle(): Promise<void> {
    const button = this.findElementById('btn-preview');
    if (!button) return;

    // Get camera preview component
    const cameraComponent = componentManager.getComponent<CameraPreviewComponent>('camera-preview');
    if (cameraComponent) {
      await cameraComponent.togglePreview(button);
    } else {
      console.error('Camera preview component not found');
    }
  }
}
```

#### 2F. Controls Grid Component (Most Complex)

**File: `src/ui/components/controls-grid/controls-grid.html`**:
```html
<div class="controls-grid">
  <div class="btn-row">
    <button id="btn-led-on">Led On</button>
    <button id="btn-clear-status">Clear Status</button>
  </div>
  <div class="btn-row">
    <button id="btn-led-off">Led Off</button>
    <button id="btn-home-axes">Home Axes</button>
  </div>
  <div class="btn-row">
    <button id="btn-pause">Pause</button>
    <button id="btn-upload-job">Upload Job</button>
  </div>
  <div class="btn-row">
    <button id="btn-resume">Resume</button>
    <button id="btn-start-recent">Start Recent</button>
  </div>
  <div class="btn-row">
    <button id="btn-stop">Stop</button>
    <button id="btn-start-local">Start Local</button>
  </div>
  <div class="btn-row">
    <button id="btn-swap-filament">Swap Filament</button>
    <button id="btn-send-cmds">Send Cmds</button>
  </div>
</div>
```

**File: `src/ui/components/controls-grid/controls-grid.css`**:
```css
.component-controls-grid .controls-grid {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.component-controls-grid .btn-row {
  display: flex;
  gap: 8px;
}

.component-controls-grid .btn-row button {
  flex: 1;
  padding: 6px 8px;
  background-color: var(--button-bg);
  color: white;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
  font-weight: 500;
  transition: all 0.2s ease;
  min-height: 28px;
}

.component-controls-grid .btn-row button:hover:not(:disabled) {
  background-color: var(--button-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.component-controls-grid .btn-row button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.component-controls-grid .btn-row button:disabled {
  background-color: #555;
  color: #888;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Special button styling */
.component-controls-grid #btn-pause,
.component-controls-grid #btn-stop {
  background-color: var(--warning-color);
}

.component-controls-grid #btn-pause:hover:not(:disabled),
.component-controls-grid #btn-stop:hover:not(:disabled) {
  background-color: #ff9800;
}

.component-controls-grid #btn-resume {
  background-color: var(--success-color);
}

.component-controls-grid #btn-resume:hover:not(:disabled) {
  background-color: #4caf50;
}
```

**File: `src/ui/components/controls-grid/controls-grid.ts`**:
```typescript
import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';

interface ButtonMapping {
  [key: string]: {
    action: 'send' | 'invoke';
    command: string;
    requiresConnection?: boolean;
    requiresPrinter?: boolean;
  };
}

export class ControlsGridComponent extends BaseComponent {
  componentId = 'controls-grid';
  templateHTML = `
    <div class="controls-grid">
      <div class="btn-row">
        <button id="btn-led-on">Led On</button>
        <button id="btn-clear-status">Clear Status</button>
      </div>
      <div class="btn-row">
        <button id="btn-led-off">Led Off</button>
        <button id="btn-home-axes">Home Axes</button>
      </div>
      <div class="btn-row">
        <button id="btn-pause">Pause</button>
        <button id="btn-upload-job">Upload Job</button>
      </div>
      <div class="btn-row">
        <button id="btn-resume">Resume</button>
        <button id="btn-start-recent">Start Recent</button>
      </div>
      <div class="btn-row">
        <button id="btn-stop">Stop</button>
        <button id="btn-start-local">Start Local</button>
      </div>
      <div class="btn-row">
        <button id="btn-swap-filament">Swap Filament</button>
        <button id="btn-send-cmds">Send Cmds</button>
      </div>
    </div>
  `;

  private buttonMappings: ButtonMapping = {
    'btn-led-on': { action: 'invoke', command: 'led-on', requiresConnection: true },
    'btn-led-off': { action: 'invoke', command: 'led-off', requiresConnection: true },
    'btn-clear-status': { action: 'invoke', command: 'clear-status', requiresConnection: true },
    'btn-home-axes': { action: 'invoke', command: 'home-axes', requiresConnection: true },
    'btn-pause': { action: 'invoke', command: 'pause-job', requiresConnection: true, requiresPrinter: true },
    'btn-resume': { action: 'invoke', command: 'resume-job', requiresConnection: true, requiresPrinter: true },
    'btn-stop': { action: 'invoke', command: 'stop-job', requiresConnection: true, requiresPrinter: true },
    'btn-upload-job': { action: 'send', command: 'open-file-upload' },
    'btn-start-recent': { action: 'send', command: 'open-recent-jobs' },
    'btn-start-local': { action: 'send', command: 'open-local-jobs' },
    'btn-swap-filament': { action: 'invoke', command: 'swap-filament', requiresConnection: true },
    'btn-send-cmds': { action: 'send', command: 'open-command-input' }
  };

  private currentPrinterState = '';
  private isConnected = false;

  protected async setupEventListeners(): Promise<void> {
    // Set up click listeners for all control buttons
    Object.keys(this.buttonMappings).forEach(buttonId => {
      const button = this.findElementById(buttonId);
      if (button) {
        button.addEventListener('click', () => this.handleButtonClick(buttonId));
      }
    });
  }

  update(data: ComponentUpdateData): void {
    this.assertInitialized();
    
    if (data.printerState !== undefined) {
      this.currentPrinterState = data.printerState;
    }
    
    if (data.connectionState !== undefined) {
      this.isConnected = data.connectionState;
    }
    
    this.updateButtonStates();
  }

  private async handleButtonClick(buttonId: string): Promise<void> {
    const mapping = this.buttonMappings[buttonId];
    if (!mapping || !window.api) {
      console.error(`No mapping found for button ${buttonId} or API not available`);
      return;
    }

    try {
      if (mapping.action === 'send') {
        window.api.send(mapping.command);
        this.logMessage(`Sent command: ${mapping.command}`);
      } else if (mapping.action === 'invoke') {
        const response = await window.api.invoke(mapping.command);
        this.logMessage(`Command ${mapping.command}: ${response ? 'Success' : 'Failed'}`);
      }
    } catch (error) {
      console.error(`Error executing command ${mapping.command}:`, error);
      this.logMessage(`Error: ${mapping.command} failed - ${error}`);
    }
  }

  private updateButtonStates(): void {
    const isActiveState = this.currentPrinterState === 'Printing' || 
                         this.currentPrinterState === 'Paused' ||
                         this.currentPrinterState === 'Calibrating' ||
                         this.currentPrinterState === 'Heating' ||
                         this.currentPrinterState === 'Pausing';

    const isPrintingState = this.currentPrinterState === 'Printing' ||
                           this.currentPrinterState === 'Pausing';

    const isPausedState = this.currentPrinterState === 'Paused';

    Object.keys(this.buttonMappings).forEach(buttonId => {
      const button = this.findElementById(buttonId) as HTMLButtonElement;
      const mapping = this.buttonMappings[buttonId];
      
      if (!button) return;

      let shouldDisable = false;

      // Check connection requirement
      if (mapping.requiresConnection && !this.isConnected) {
        shouldDisable = true;
      }

      // Apply state-specific rules
      switch (buttonId) {
        case 'btn-pause':
          shouldDisable = !isPrintingState || !this.isConnected;
          break;
        case 'btn-resume':
          shouldDisable = !isPausedState || !this.isConnected;
          break;
        case 'btn-stop':
          shouldDisable = !isActiveState || !this.isConnected;
          break;
        case 'btn-upload-job':
        case 'btn-start-recent':
        case 'btn-start-local':
          // These can be used when printer is ready/idle
          shouldDisable = isActiveState;
          break;
        case 'btn-home-axes':
        case 'btn-swap-filament':
          // Potentially dangerous during printing
          shouldDisable = isActiveState || !this.isConnected;
          break;
        case 'btn-led-on':
        case 'btn-led-off':
        case 'btn-clear-status':
          shouldDisable = !this.isConnected;
          break;
        case 'btn-send-cmds':
          // Command input can always be opened
          shouldDisable = false;
          break;
      }

      button.disabled = shouldDisable;
    });
  }

  private logMessage(message: string): void {
    // Find log panel component and log the message
    const logOutput = document.getElementById('log-output');
    if (logOutput) {
      const timestamp = new Date().toLocaleTimeString();
      logOutput.innerHTML += `<div>[${timestamp}] ${message}</div>`;
      logOutput.scrollTop = logOutput.scrollHeight;
    }
  }
}
```

#### 2G. Status Bar Components

Due to length constraints, I'll provide the structure for the remaining components. Each status bar component follows the same pattern:

**Printer Status Component** (`src/ui/components/printer-status/`):
- Displays printer state, runtime, filament usage
- Updates from polling data
- No user interactions

**Temperature Controls Component** (`src/ui/components/temperature-controls/`):
- Displays bed/extruder temperatures
- Set/Off buttons with temperature input dialogs
- Fan status display

**Filtration Controls Component** (`src/ui/components/filtration-controls/`):
- Filtration mode selection buttons
- TVOC level display
- Feature availability checking

**Additional Info Component** (`src/ui/components/additional-info/`):
- Nozzle size, filament type, offsets
- Display-only component

### Step 3: Main Integration

#### 3A. Update Main HTML Template

**File: `src/index.html`** (Simplified):
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>FlashForge UI 1.0</title>
  <!-- CSS is now bundled by webpack -->
</head>
<body>
<div class="app-container">
  <!-- Header Bar (UNCHANGED) -->
  <div class="header">
    <div class="traffic-lights">
      <button class="traffic-light close" id="traffic-close" aria-label="Close"></button>
      <button class="traffic-light minimize" id="traffic-minimize" aria-label="Minimize"></button>
      <button class="traffic-light maximize" id="traffic-maximize" aria-label="Maximize"></button>
    </div>
    
    <div class="left-controls">
      <button id="btn-connect">Connect</button>
      <button id="btn-settings">Settings</button>
      <button id="btn-status">Status</button>
      <button id="btn-ifs" class="hidden">IFS</button>
    </div>
    <div class="title">FlashForge UI 1.0</div>
    <div class="window-controls">
      <button id="btn-minimize">—</button>
      <button id="btn-maximize">□</button>
      <button id="btn-close">×</button>
    </div>
  </div>

  <!-- Main Layout (Component Containers) -->
  <div class="main-layout">
    <!-- Left Side -->
    <div class="left-side">
      <div id="camera-preview-container"></div>
      <div id="job-info-container"></div>
    </div>

    <!-- Right Side -->
    <div class="right-side">
      <div id="controls-grid-container"></div>
      <div id="model-preview-container"></div>
      <div id="job-stats-container"></div>
    </div>
  </div>

  <!-- Status Bar -->
  <div class="status-bar">
    <div id="printer-status-container"></div>
    <div id="temperature-controls-container"></div>
    <div id="filtration-controls-container"></div>
    <div id="additional-info-container"></div>
  </div>

  <!-- Log Panel -->
  <div id="log-panel-container"></div>

  <!-- Loading Overlay (UNCHANGED) -->
  <div id="loading-overlay" class="loading-overlay hidden">
    <!-- ... existing loading overlay content ... -->
  </div>
</div>

<!-- Webpack will inject the bundle script here automatically -->
</body>
</html>
```

#### 3B. Update Main CSS

**File: `src/index.css`** (Remove extracted component styles, keep layout):
```css
/* Keep existing root variables and base styles */
/* Keep header styles (unchanged) */
/* Keep main layout styles */
/* Keep loading overlay styles */
/* Remove all component-specific styles (they're now in component CSS files) */

/* Add container styles for component integration */
#camera-preview-container,
#job-info-container,
#controls-grid-container,
#model-preview-container,
#job-stats-container,
#printer-status-container,
#temperature-controls-container,
#filtration-controls-container,
#additional-info-container,
#log-panel-container {
  /* Containers should not add padding/margin - let components handle their own styling */
}

/* Maintain existing layout structure */
.left-side {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
}

.right-side {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.status-bar {
  height: 140px;
  display: flex;
  background-color: var(--dark-bg);
  border-top: 1px solid var(--border-color);
  overflow: hidden;
  flex-shrink: 0;
}

.status-section {
  flex: 1;
  padding: 8px;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  font-size: 11px;
  min-width: 0;
  overflow: hidden;
}

.status-section:last-child {
  border-right: none;
}
```

#### 3C. Update Main Renderer

**File: `src/renderer.ts`** (Major refactoring):
```typescript
// src/renderer.ts
// Main renderer process with component-based architecture

import './index.css';
import { getGlobalStateTracker, STATE_EVENTS, type StateChangeEvent } from './services/printer-state';
import { updateAllPanels, initializeUIAnimations, resetUI, handleUIError } from './services/ui-updater';
import type { PollingData } from './types/polling';

// Import component system
import { componentManager } from './ui/components/ComponentManager';

// Import all components
import { CameraPreviewComponent } from './ui/components/camera-preview';
import { JobInfoComponent } from './ui/components/job-info';
import { ControlsGridComponent } from './ui/components/controls-grid';
import { ModelPreviewComponent } from './ui/components/model-preview';
import { JobStatsComponent } from './ui/components/job-stats';
import { PrinterStatusComponent } from './ui/components/printer-status';
import { TemperatureControlsComponent } from './ui/components/temperature-controls';
import { FiltrationControlsComponent } from './ui/components/filtration-controls';
import { AdditionalInfoComponent } from './ui/components/additional-info';
import { LogPanelComponent } from './ui/components/log-panel';

// Global state tracking
let currentPrinterState = 'Disconnected';
let isConnected = false;

// Component instances for global access (replaces previous individual functions)
let logPanelComponent: LogPanelComponent | null = null;

// Loading state management (keep existing implementation)
interface LoadingState {
  isVisible: boolean;
  state: 'hidden' | 'loading' | 'success' | 'error';
  message: string;
  progress: number;
  canCancel: boolean;
}

const defaultLoadingState: LoadingState = {
  isVisible: false,
  state: 'hidden',
  message: '',
  progress: 0,
  canCancel: false
};

let currentLoadingState: LoadingState = { ...defaultLoadingState };

// Keep existing loading management functions...
function updateLoadingOverlay(): void {
  // ... existing implementation
}

function setupLoadingEventListeners(): void {
  // ... existing implementation
}

// Updated log message function to work with component
function logMessage(message: string): void {
  if (logPanelComponent) {
    logPanelComponent.addLogMessage(message);
  } else {
    // Fallback for early initialization
    console.log(message);
  }
}

// Keep existing window controls setup...
function setupWindowControls(): void {
  // ... existing implementation
}

// Updated button setup for header buttons only
function setupHeaderButtons(): void {
  const headerButtons = [
    'btn-connect', 'btn-settings', 'btn-status', 'btn-ifs',
    'btn-minimize', 'btn-maximize', 'btn-close'
  ];

  headerButtons.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      button.addEventListener('click', async () => {
        // Handle header button clicks (unchanged from original)
        switch (buttonId) {
          case 'btn-connect':
            window.api?.send('open-printer-selection');
            logMessage('Opening printer selection...');
            break;
          case 'btn-settings':
            window.api?.send('open-settings');
            logMessage('Opening settings...');
            break;
          case 'btn-status':
            window.api?.send('open-status');
            logMessage('Opening status dialog...');
            break;
          case 'btn-ifs':
            window.api?.send('open-ifs');
            logMessage('Opening IFS dialog...');
            break;
          // Window controls handled in setupWindowControls
        }
      });
    }
  });
}

// Initialize all UI components
async function initializeComponents(): Promise<void> {
  try {
    // Create component instances and register them
    const components = [
      new CameraPreviewComponent(document.getElementById('camera-preview-container')!),
      new JobInfoComponent(document.getElementById('job-info-container')!),
      new ControlsGridComponent(document.getElementById('controls-grid-container')!),
      new ModelPreviewComponent(document.getElementById('model-preview-container')!),
      new JobStatsComponent(document.getElementById('job-stats-container')!),
      new PrinterStatusComponent(document.getElementById('printer-status-container')!),
      new TemperatureControlsComponent(document.getElementById('temperature-controls-container')!),
      new FiltrationControlsComponent(document.getElementById('filtration-controls-container')!),
      new AdditionalInfoComponent(document.getElementById('additional-info-container')!),
      new LogPanelComponent(document.getElementById('log-panel-container')!)
    ];

    // Register all components
    components.forEach(component => {
      componentManager.registerComponent(component);
      
      // Store log panel reference for global access
      if (component.componentId === 'log-panel') {
        logPanelComponent = component as LogPanelComponent;
      }
    });

    // Initialize all components
    await componentManager.initializeAll();
    
    console.log('All components initialized successfully');
    logMessage('UI components initialized successfully');

  } catch (error) {
    console.error('Failed to initialize components:', error);
    handleUIError(error, 'component initialization');
  }
}

// Updated state and event listener initialization
function initializeStateAndEventListeners(): void {
  if (!window.api) {
    console.error('API not available for state tracking');
    return;
  }

  const stateTracker = getGlobalStateTracker();
  
  // Set up state change listeners
  stateTracker.on(STATE_EVENTS.CHANGED, (event: StateChangeEvent) => {
    console.log('Printer state changed:', event.previousState, '→', event.currentState);
    
    currentPrinterState = event.currentState;
    
    // Update all components with new state
    componentManager.updateAll({
      printerState: event.currentState,
      connectionState: isConnected
    });
  });
  
  stateTracker.on(STATE_EVENTS.CONNECTED, () => {
    console.log('Printer connected');
    isConnected = true;
    
    componentManager.updateAll({
      connectionState: true
    });
    
    logMessage('Printer connected successfully');
  });

  stateTracker.on(STATE_EVENTS.DISCONNECTED, () => {
    console.log('Printer disconnected');
    isConnected = false;
    
    componentManager.updateAll({
      connectionState: false
    });
    
    logMessage('Printer disconnected');
    
    // Reset UI to default state
    resetUI();
  });

  // Polling data listener
  window.api.receive('polling-update', (data: unknown) => {
    const pollingData = data as PollingData;
    
    // Update components with polling data
    componentManager.updateAll({
      pollingData: pollingData
    });
  });

  // Backend initialization listener
  window.api.receive('backend-initialized', (data: unknown) => {
    const backendData = data as {
      backendType: string;
      capabilities: any;
    };
    
    logMessage(`Backend initialized: ${backendData.backendType}`);
    
    // Handle backend-specific UI updates
    handleBackendInitialization(backendData);
  });
}

function handleBackendInitialization(data: { backendType: string; capabilities: any }): void {
  // Handle IFS button visibility
  const ifsButton = document.getElementById('btn-ifs');
  if (data.capabilities?.hasIFS) {
    ifsButton?.classList.remove('hidden');
    logMessage('IFS feature available');
  } else {
    ifsButton?.classList.add('hidden');
  }

  // Update components with capability information
  componentManager.updateAll({
    backendCapabilities: data.capabilities
  });
}

// Platform detection and CSS injection
function detectPlatformAndInjectCSS(): void {
  // ... existing implementation unchanged
}

// Initialize UI animations
function initializeUI(): void {
  detectPlatformAndInjectCSS();
  initializeUIAnimations();
}

// Main initialization
async function initialize(): Promise<void> {
  console.log('Initializing FlashForge UI Renderer...');

  try {
    // Check API availability
    if (!window.api) {
      console.error('ERROR: window.api not available. Preload script may have failed.');
      logMessage('ERROR: API not available');
      return;
    }
    
    // Setup basic UI components
    setupWindowControls();
    setupHeaderButtons();
    setupLoadingEventListeners();
    initializeUI();
    
    // Initialize component system
    await initializeComponents();
    
    // Initialize state tracking and event listeners
    initializeStateAndEventListeners();
    
    logMessage('FlashForge UI initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize renderer:', error);
    handleUIError(error, 'renderer initialization');
  }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  void initialize();
}
```

## Integration & Testing

### Testing Strategy

#### 1. Component Isolation Testing

Test each component individually:

```typescript
// Example test setup for a component
describe('JobStatsComponent', () => {
  let container: HTMLElement;
  let component: JobStatsComponent;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    component = new JobStatsComponent(container);
  });

  afterEach(() => {
    component.destroy();
    container.remove();
  });

  test('should initialize correctly', async () => {
    await component.initialize();
    expect(component.isInitialized).toBe(true);
  });

  test('should update with job data', async () => {
    await component.initialize();
    
    const mockData = {
      pollingData: {
        printerStatus: {
          currentJob: {
            isActive: true,
            progress: {
              currentLayer: 5,
              totalLayers: 100,
              // ... other progress data
            }
          }
        }
      }
    };
    
    component.update(mockData);
    
    const layerInfo = container.querySelector('#layer-info');
    expect(layerInfo?.textContent).toBe('5 / 100');
  });
});
```

#### 2. Integration Testing Workflow

1. **Visual Verification**:
   - Load the application
   - Verify all components appear in correct positions
   - Check that styling matches the original exactly

2. **Functional Testing**:
   - Test all buttons work identically to original
   - Verify IPC communication is preserved
   - Test data updates flow to all components

3. **State Management Testing**:
   - Test printer state changes affect button states
   - Verify connection/disconnection updates components
   - Test polling data updates all relevant components

#### 3. Performance Testing

- Compare memory usage before/after
- Measure component initialization time
- Verify no performance regressions

### Integration Checklist

#### Pre-Integration Setup

- [ ] Create backup of current working implementation
- [ ] Set up development branch for Phase 1 work
- [ ] Ensure all existing functionality is documented

#### Component Development

- [ ] Create base component system
- [ ] Implement ComponentManager
- [ ] Extract Log Panel component (simplest first)
- [ ] Extract Model Preview component
- [ ] Extract Job Stats component
- [ ] Extract Camera Preview component
- [ ] Extract Job Info component
- [ ] Extract Controls Grid component
- [ ] Extract all Status Bar components

#### Integration Steps

- [ ] Update main HTML template with component containers
- [ ] Update main CSS file (remove component styles, keep layout)
- [ ] Refactor main renderer.ts to use component system
- [ ] Update webpack.config.js if needed for component imports
- [ ] Test component initialization
- [ ] Verify all IPC communication still works
- [ ] Test all button functionality
- [ ] Verify data updates reach all components

#### Validation Testing

- [ ] All UI elements appear correctly positioned
- [ ] All buttons function identically to original
- [ ] IPC communication preserved exactly
- [ ] Data updates work for all components
- [ ] Platform-specific styling still works (macOS traffic lights)
- [ ] Loading overlay functionality preserved
- [ ] Error handling works correctly
- [ ] Memory usage is comparable
- [ ] No console errors or warnings

## Risk Management

### High-Risk Areas & Mitigation

1. **IPC Communication Breakage**
   - **Risk**: Component extraction disrupts existing IPC patterns
   - **Mitigation**: Preserve exact IPC calls; test each component thoroughly
   - **Detection**: Integration tests for all button functions

2. **CSS Specificity Conflicts**
   - **Risk**: Component CSS conflicts with global styles
   - **Mitigation**: Use component-specific selectors; test on all platforms
   - **Detection**: Visual regression testing

3. **Event Handler Loss**
   - **Risk**: Event listeners not properly transferred to components
   - **Mitigation**: Systematic verification of all interactive elements
   - **Detection**: Manual testing of every button and control

4. **State Management Complexity**
   - **Risk**: Component state synchronization issues
   - **Mitigation**: Clear state update patterns; centralized state management
   - **Detection**: State change testing with different printer states

### Rollback Strategy

If critical issues arise:

1. **Immediate Rollback**: Revert to backup implementation
2. **Partial Rollback**: Disable problematic components, revert to monolithic versions
3. **Component-Level Fixes**: Fix individual components without affecting others

### Testing Requirements

- **Manual Testing**: Every button, dialog, and interaction
- **Visual Testing**: Compare screenshots before/after on all platforms
- **Performance Testing**: Memory usage, initialization time
- **Integration Testing**: Full workflow testing with real printer connections

## Validation Checklist

### Functional Validation

#### UI Appearance
- [ ] All components appear in correct positions
- [ ] Styling matches original exactly
- [ ] Platform-specific styling works (macOS traffic lights)
- [ ] Responsive behavior preserved
- [ ] CSS variables still function correctly

#### Button Functionality
- [ ] All header buttons work (Connect, Settings, Status, IFS)
- [ ] All control grid buttons work (LED, Home, Pause, Resume, etc.)
- [ ] Camera preview toggle works
- [ ] Temperature set/off buttons work
- [ ] Filtration control buttons work
- [ ] Window controls work (minimize, maximize, close)

#### Data Display Updates
- [ ] Job information updates correctly
- [ ] Progress bar updates and styling changes with state
- [ ] Model preview shows/hides thumbnails correctly
- [ ] Job statistics update with current job data
- [ ] Temperature displays update with sensor data
- [ ] Printer status updates correctly
- [ ] Log panel receives and displays messages

#### IPC Communication
- [ ] All window.api.send() calls work
- [ ] All window.api.invoke() calls work and return responses
- [ ] All window.api.receive() listeners function
- [ ] Dialog opening works (file dialogs, settings, status)
- [ ] Backend communication preserved

#### State Management
- [ ] Button states update with printer state changes
- [ ] Connection/disconnection updates UI correctly
- [ ] Printer state changes affect correct UI elements
- [ ] Feature availability updates (IFS, filtration) work

### Technical Validation

#### Architecture
- [ ] Component isolation works correctly
- [ ] ComponentManager handles all components
- [ ] Base component class provides expected functionality
- [ ] Component lifecycle (initialize/update/destroy) works

#### Performance
- [ ] Application startup time comparable or better
- [ ] Memory usage comparable or better
- [ ] No performance regressions during normal use
- [ ] Component updates are efficient

#### Code Quality
- [ ] No console errors during normal operation
- [ ] No memory leaks from component cleanup
- [ ] TypeScript compilation succeeds without errors
- [ ] ESLint passes without violations

#### Build System
- [ ] Webpack bundles components correctly
- [ ] CSS imports work from components
- [ ] TypeScript imports resolve correctly
- [ ] Build output size comparable

### Edge Case Testing

#### Error Conditions
- [ ] Component initialization failures handled gracefully
- [ ] Missing DOM elements handled without crashes
- [ ] IPC communication failures don't break UI
- [ ] Invalid polling data doesn't cause errors

#### Platform-Specific
- [ ] macOS traffic lights behavior preserved
- [ ] Windows/Linux window controls work
- [ ] Platform-specific CSS classes applied correctly

#### Connection States
- [ ] UI updates correctly when printer connects/disconnects
- [ ] Offline state displays appropriately
- [ ] Reconnection scenarios work correctly

## Success Criteria

### Phase 1 Complete Success Metrics

1. **Zero Functional Regressions**: All existing functionality works identically
2. **Clean Architecture**: Components are properly isolated and reusable
3. **Maintainable Code**: Clear separation of concerns, readable code structure
4. **Performance Preservation**: No performance degradation
5. **Platform Compatibility**: Works identically on all supported platforms

### Readiness for Phase 2

- Component system is stable and extensible
- All components can be instantiated independently  
- Component communication patterns established
- CSS architecture supports dynamic layout changes
- Documentation is complete and accurate

This completes the Phase 1 implementation guide. The modular component architecture established here provides the foundation for Phase 2's configurable grid layout system while maintaining all existing functionality.