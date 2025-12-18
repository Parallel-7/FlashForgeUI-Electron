/**
 * @fileoverview UI Components System Exports
 * 
 * This file serves as the main export point for the entire UI component system,
 * providing access to the ComponentManager, base components, and type definitions.
 * This structure will be extended as individual components are extracted in Phase 1.
 */

// Component Manager
export { ComponentManager, componentManager } from './ComponentManager.js';

// Base component system
export {
  BaseComponent,
  ComponentEvents,
  type ComponentConfig,
  type ComponentUpdateData,
  type ComponentEventHandler,
  type ComponentState,
  type IComponent,
  type IComponentManager
} from './base/index.js';

// Individual components - All 10 Phase 1 components
export { JobStatsComponent } from './job-stats/index.js';
export { JobInfoComponent } from './job-info/index.js';
export { CameraPreviewComponent } from './camera-preview/index.js';
export { ControlsGridComponent } from './controls-grid/index.js';
export { ModelPreviewComponent } from './model-preview/index.js';
export { LogPanelComponent } from './log-panel/index.js';

// Status Bar Components
export { PrinterStatusComponent } from './printer-status/index.js';
export { TemperatureControlsComponent } from './temperature-controls/index.js';
export { FiltrationControlsComponent } from './filtration-controls/index.js';
export { AdditionalInfoComponent } from './additional-info/index.js';

// Multi-Printer Support Components
export { PrinterTabsComponent } from './printer-tabs/index.js';

// Spoolman Integration Component
export { SpoolmanComponent } from './spoolman/index.js';
