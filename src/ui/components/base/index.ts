/**
 * @fileoverview Base Component System Exports
 * 
 * This file exports all the core components of the UI component system,
 * providing a clean public API for importing components, types, and managers
 * throughout the application.
 */

// Base component class
export { BaseComponent } from './component';

// Type definitions
export type {
  ComponentConfig,
  ComponentUpdateData,
  ComponentEventHandler,
  ComponentState,
  IComponent,
  IComponentManager
} from './types';

// Enums
export { ComponentEvents } from './types';
