/**
 * @fileoverview Component Manager for UI Component System
 * 
 * The ComponentManager class serves as the central coordinator for all UI components
 * in the FlashForgeUI application. It handles component registration, lifecycle
 * management, and centralized data updates. This manager ensures that all components
 * are properly initialized, updated with fresh data from polling cycles, and cleaned
 * up when necessary.
 * 
 * Key responsibilities:
 * - Component registration and lifecycle management
 * - Centralized data updates to all components
 * - Error handling and graceful degradation
 * - Component lookup and inter-component communication
 * - Proper cleanup and resource management
 * 
 * Usage:
 * ```typescript
 * const manager = new ComponentManager();
 * manager.registerComponent(new JobInfoComponent(container));
 * await manager.initializeAll();
 * manager.updateAll(pollingData);
 * ```
 */

import { BaseComponent } from './base/component';
import type { ComponentUpdateData, IComponentManager, IComponent } from './base/types';

/**
 * Central manager for all UI components
 * Handles component registration, lifecycle, and data updates
 */
export class ComponentManager implements IComponentManager {
  /** Map of component ID to component instance */
  private readonly components = new Map<string, BaseComponent>();
  
  /** Whether all components have been initialized */
  private initialized = false;
  
  /** Last update data sent to components */
  private lastUpdateData: ComponentUpdateData | null = null;

  /**
   * Register a component with the manager
   * @param component - Component instance to register
   * @throws Error if component ID is already registered
   */
  registerComponent(component: BaseComponent): void {
    if (this.components.has(component.componentId)) {
      throw new Error(`Component ${component.componentId} is already registered`);
    }
    
    this.components.set(component.componentId, component);
    console.log(`Registered component: ${component.componentId}`);
  }

  /**
   * Initialize all registered components
   * Components are initialized in parallel for better performance
   * @returns Promise that resolves when all components are initialized
   */
  async initializeAll(): Promise<void> {
    if (this.initialized) {
      console.warn('ComponentManager: Components already initialized');
      return;
    }

    console.log(`Initializing ${this.components.size} components...`);
    
    const initPromises = Array.from(this.components.values()).map(async (component) => {
      try {
        await component.initialize();
        console.log(`Component ${component.componentId} initialized successfully`);
      } catch (error) {
        console.error(`Failed to initialize component ${component.componentId}:`, error);
        // Don't throw here - we want to continue initializing other components
        // The component will be in an uninitialized state and won't receive updates
      }
    });

    await Promise.all(initPromises);
    
    this.initialized = true;
    console.log('All components initialized');
  }

  /**
   * Update all components with new data
   * Only components that are properly initialized will receive updates
   * @param data - Update data containing polling info, state changes, etc.
   */
  updateAll(data: ComponentUpdateData): void {
    if (!this.initialized) {
      console.warn('ComponentManager: Cannot update components - not initialized yet');
      return;
    }

    // Store the last update data for debugging and late-joining components
    this.lastUpdateData = { ...data };

    let updateCount = 0;
    let errorCount = 0;

    this.components.forEach((component) => {
      try {
        // Only update components that are properly initialized
        if (component.isInitialized()) {
          component.update(data);
          updateCount++;
        } else {
          console.warn(`Skipping update for uninitialized component: ${component.componentId}`);
        }
      } catch (error) {
        console.error(`Failed to update component ${component.componentId}:`, error);
        errorCount++;
      }
    });

    if (errorCount > 0) {
      console.warn(`Component updates completed with errors: ${updateCount} successful, ${errorCount} failed`);
    }
  }

  /**
   * Update a specific component by ID
   * @param componentId - ID of the component to update
   * @param data - Update data for the component
   * @returns True if component was found and updated, false otherwise
   */
  updateComponent(componentId: string, data: ComponentUpdateData): boolean {
    const component = this.components.get(componentId);
    
    if (!component) {
      console.warn(`ComponentManager: Component ${componentId} not found for update`);
      return false;
    }

    if (!component.isInitialized()) {
      console.warn(`ComponentManager: Component ${componentId} is not initialized, skipping update`);
      return false;
    }

    try {
      component.update(data);
      console.debug(`Component ${componentId} updated successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to update component ${componentId}:`, error);
      return false;
    }
  }

  /**
   * Get component by ID with type safety
   * @param componentId - ID of the component to retrieve
   * @returns The component instance or undefined if not found
   */
  getComponent<T extends IComponent>(componentId: string): T | undefined {
    const component = this.components.get(componentId);
    return component as T | undefined;
  }

  /**
   * Get all registered component IDs
   * @returns Array of component IDs
   */
  getComponentIds(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Get component count
   * @returns Number of registered components
   */
  getComponentCount(): number {
    return this.components.size;
  }

  /**
   * Get initialization status
   * @returns True if all components have been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the count of initialized components
   * @returns Object with total and initialized component counts
   */
  getInitializationStatus(): { total: number; initialized: number; destroyed: number } {
    const total = this.components.size;
    let initialized = 0;
    let destroyed = 0;

    this.components.forEach((component) => {
      if (component.isDestroyed()) {
        destroyed++;
      } else if (component.isInitialized()) {
        initialized++;
      }
    });

    return { total, initialized, destroyed };
  }

  /**
   * Get the last update data sent to components
   * Useful for debugging or initializing late-joining components
   * @returns Last update data or null if no updates have been sent
   */
  getLastUpdateData(): ComponentUpdateData | null {
    return this.lastUpdateData ? { ...this.lastUpdateData } : null;
  }

  /**
   * Reinitialize a specific component
   * Useful for recovering from component errors
   * @param componentId - ID of the component to reinitialize
   * @returns Promise that resolves when component is reinitialized
   */
  async reinitializeComponent(componentId: string): Promise<boolean> {
    const component = this.components.get(componentId);
    
    if (!component) {
      console.warn(`ComponentManager: Component ${componentId} not found for reinitialization`);
      return false;
    }

    try {
      // Destroy if not already destroyed
      if (!component.isDestroyed()) {
        component.destroy();
      }

      // Reinitialize
      await component.initialize();
      
      // Send last update data if available
      if (this.lastUpdateData && component.isInitialized()) {
        component.update(this.lastUpdateData);
      }

      console.log(`Component ${componentId} reinitialized successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to reinitialize component ${componentId}:`, error);
      return false;
    }
  }

  /**
   * Remove a component from the manager
   * @param componentId - ID of the component to remove
   * @returns True if component was found and removed, false otherwise
   */
  removeComponent(componentId: string): boolean {
    const component = this.components.get(componentId);
    
    if (!component) {
      console.warn(`ComponentManager: Component ${componentId} not found for removal`);
      return false;
    }

    try {
      // Destroy the component if it's not already destroyed
      if (!component.isDestroyed()) {
        component.destroy();
      }

      // Remove from registry
      this.components.delete(componentId);
      console.log(`Component ${componentId} removed from manager`);
      return true;
    } catch (error) {
      console.error(`Error removing component ${componentId}:`, error);
      return false;
    }
  }

  /**
   * Destroy all components and clean up the manager
   * This method is idempotent and can be called multiple times safely
   */
  destroyAll(): void {
    console.log(`Destroying ${this.components.size} components...`);

    let destroyCount = 0;
    let errorCount = 0;

    this.components.forEach((component) => {
      try {
        if (!component.isDestroyed()) {
          component.destroy();
          destroyCount++;
        }
      } catch (error) {
        console.error(`Error destroying component ${component.componentId}:`, error);
        errorCount++;
      }
    });

    // Clear the component registry
    this.components.clear();
    
    // Reset manager state
    this.initialized = false;
    this.lastUpdateData = null;

    if (errorCount > 0) {
      console.warn(`Component destruction completed with errors: ${destroyCount} successful, ${errorCount} failed`);
    } else {
      console.log(`All ${destroyCount} components destroyed successfully`);
    }
  }

  /**
   * Perform health check on all components
   * @returns Health check results
   */
  healthCheck(): {
    totalComponents: number;
    healthyComponents: number;
    uninitializedComponents: string[];
    destroyedComponents: string[];
    lastUpdateTime: Date | null;
  } {
    const totalComponents = this.components.size;
    const uninitializedComponents: string[] = [];
    const destroyedComponents: string[] = [];
    let healthyComponents = 0;

    this.components.forEach((component) => {
      if (component.isDestroyed()) {
        destroyedComponents.push(component.componentId);
      } else if (!component.isInitialized()) {
        uninitializedComponents.push(component.componentId);
      } else {
        healthyComponents++;
      }
    });

    return {
      totalComponents,
      healthyComponents,
      uninitializedComponents,
      destroyedComponents,
      lastUpdateTime: this.lastUpdateData ? new Date() : null
    };
  }
}

/**
 * Global component manager instance
 * This singleton instance is used throughout the application
 */
export const componentManager = new ComponentManager();