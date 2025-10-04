/**
 * @fileoverview UI Components System Exports
 * 
 * This file serves as the main export point for the entire UI component system,
 * providing access to the ComponentManager, base components, and type definitions.
 * This structure will be extended as individual components are extracted in Phase 1.
 */

// Component Manager
export { ComponentManager, componentManager } from './ComponentManager';

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
} from './base';

// Individual components - All 10 Phase 1 components
export { JobStatsComponent } from './job-stats';
export { JobInfoComponent } from './job-info';
export { CameraPreviewComponent } from './camera-preview';
export { ControlsGridComponent } from './controls-grid';
export { ModelPreviewComponent } from './model-preview';
export { LogPanelComponent } from './log-panel';

// Status Bar Components
export { PrinterStatusComponent } from './printer-status';
export { TemperatureControlsComponent } from './temperature-controls';
export { FiltrationControlsComponent } from './filtration-controls';
export { AdditionalInfoComponent } from './additional-info';

// Multi-Printer Support Components
export { PrinterTabsComponent } from './printer-tabs';