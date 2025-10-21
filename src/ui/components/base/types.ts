/**
 * @fileoverview Component system type definitions
 * 
 * This file defines the core TypeScript interfaces and types for the component
 * system, including configuration, update data structures, and event handling
 * patterns. These types ensure type safety across the entire component architecture
 * and maintain compatibility with existing IPC and polling data patterns.
 */

import type { PollingData } from '../../../types/polling';

/**
 * Configuration interface for component initialization
 */
export interface ComponentConfig {
  /** Unique identifier for the component */
  id: string;
  /** Parent DOM element where the component will be rendered */
  parentElement: HTMLElement;
  /** Optional initial data for component setup */
  initialData?: unknown;
}

/**
 * Data structure passed to components during updates
 * Contains all possible data sources that components might need
 */
export interface ComponentUpdateData {
  /** Real-time polling data from connected printer */
  pollingData?: PollingData;
  /** Current printer state (Ready, Printing, Paused, etc.) */
  printerState?: string;
  /** Connection status to printer */
  connectionState?: boolean;
  /** Backend capabilities and feature flags */
  backendCapabilities?: Record<string, unknown>;
  /** Additional data that components might need */
  [key: string]: unknown;
}

/**
 * Event handler configuration for components
 */
export interface ComponentEventHandler {
  /** Element selector or direct element reference */
  element: string | HTMLElement;
  /** DOM event type (click, change, etc.) */
  event: string;
  /** Handler function for the event */
  handler: (event: Event) => void | Promise<void>;
}

/**
 * Component lifecycle and system events
 */
export enum ComponentEvents {
  /** Component has been initialized successfully */
  INITIALIZED = 'component:initialized',
  /** Component has been updated with new data */
  UPDATED = 'component:updated',
  /** Component has been destroyed and cleaned up */
  DESTROYED = 'component:destroyed',
  /** An error occurred in the component */
  ERROR = 'component:error'
}

/**
 * Component state interface for tracking initialization and lifecycle
 */
export interface ComponentState {
  /** Whether the component has been initialized */
  isInitialized: boolean;
  /** Whether the component has been destroyed */
  isDestroyed: boolean;
  /** Last update timestamp */
  lastUpdate?: Date;
  /** Current component data */
  currentData?: ComponentUpdateData;
}

/**
 * Base component interface that all components must implement
 */
export interface IComponent {
  /** Unique component identifier */
  readonly componentId: string;
  /** HTML template for the component */
  readonly templateHTML: string;
  
  /** Initialize the component */
  initialize(): Promise<void>;
  /** Update component with new data */
  update(data: ComponentUpdateData): void;
  /** Destroy the component and clean up resources */
  destroy(): void;
}

/**
 * Component manager interface for managing multiple components
 */
export interface IComponentManager {
  /** Register a component with the manager */
  registerComponent(component: IComponent): void;
  /** Initialize all registered components */
  initializeAll(): Promise<void>;
  /** Update all components with new data */
  updateAll(data: ComponentUpdateData): void;
  /** Update a specific component */
  updateComponent(componentId: string, data: ComponentUpdateData): void;
  /** Get component by ID */
  getComponent<T extends IComponent>(componentId: string): T | undefined;
  /** Destroy all components */
  destroyAll(): void;
}
