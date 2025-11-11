/**
 * @fileoverview Browser-focused GridStack manager for the WebUI layout system.
 *
 * Wraps the GridStack library with WebUI-specific helpers for initializing the
 * dashboard grid, managing component widgets, toggling edit mode, and emitting
 * serialized layout updates for persistence. The manager operates exclusively
 * in the browser environment and assumes GridStack's UMD bundle is available
 * globally via gridstack-all.js.
 */

import type { GridItemHTMLElement, GridStack, GridStackNode } from 'gridstack';
import {
  createComponentElement,
  getComponentDefinition,
} from './WebUIComponentRegistry.js';
import type {
  WebUIComponentLayout,
  WebUIGridChangeCallback,
  WebUIGridLayout,
  WebUIGridOptions,
} from './types.js';

type GridStackCtor = typeof import('gridstack').GridStack;

const HIDDEN_CLASS = 'grid-item-hidden';

function getGridStackCtor(): GridStackCtor {
  const ctor = (window as typeof window & {
    GridStack?: GridStackCtor;
  }).GridStack;
  if (!ctor) {
    throw new Error('GridStack library not loaded. Ensure gridstack-all.js is included.');
  }
  return ctor;
}

export class WebUIGridManager {
  private grid: GridStack | null = null;
  private container: HTMLElement | null = null;
  private readonly changeHandlers = new Set<WebUIGridChangeCallback>();
  private readonly hiddenComponents = new Set<string>();
  private isInitialized = false;

  constructor(private readonly containerSelector: string) {}

  public initialize(options: WebUIGridOptions): void {
    if (this.isInitialized) {
      return;
    }

    const element = document.querySelector<HTMLElement>(
      this.containerSelector,
    );
    if (!element) {
      throw new Error(
        `Unable to find grid container with selector ${this.containerSelector}`,
      );
    }

    this.container = element;
    const GridStackClass = getGridStackCtor();
    this.grid = GridStackClass.init(options, element);

    if (!this.grid) {
      throw new Error('Failed to initialize GridStack for WebUI layout.');
    }

    this.grid.on('change', () => this.emitChange());
    this.grid.on('added', () => this.emitChange());
    this.grid.on('removed', () => this.emitChange());

    this.isInitialized = true;
  }

  public clear(): void {
    const grid = this.grid;
    const container = this.container;
    if (!grid || !container) {
      this.hiddenComponents.clear();
      return;
    }

    grid.removeAll(true);
    this.hiddenComponents.clear();

    // Ensure no orphaned nodes remain in the DOM after GridStack cleanup
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  public addComponent(
    componentId: string,
    layout: WebUIComponentLayout,
  ): HTMLElement {
    const grid = this.requireGrid();
    const root = this.requireContainer();

    const existing = root.querySelector<HTMLElement>(
      `[data-component-id="${componentId}"]`,
    );
    if (existing) {
      grid.removeWidget(existing);
    }

    const widget = document.createElement('div');
    widget.classList.add('grid-stack-item');
    widget.id = componentId;
    widget.dataset.componentId = componentId;

    const content = document.createElement('div');
    content.classList.add('grid-stack-item-content');
    content.appendChild(createComponentElement(componentId));
    widget.appendChild(content);

    const definition = getComponentDefinition(componentId);

    const appliedLayout: GridStackNode = {
      x: layout.x ?? definition?.defaultPosition?.x ?? 0,
      y: layout.y ?? definition?.defaultPosition?.y ?? 0,
      w: layout.w ?? definition?.defaultSize.w ?? 3,
      h: layout.h ?? definition?.defaultSize.h ?? 2,
      minW: layout.minW ?? definition?.minSize.w,
      minH: layout.minH ?? definition?.minSize.h,
      maxW: layout.maxW ?? definition?.maxSize?.w,
      maxH: layout.maxH ?? definition?.maxSize?.h,
      locked: layout.locked ?? false,
      id: componentId,
      el: widget as GridItemHTMLElement,
    };

    grid.addWidget(appliedLayout);

    if (this.hiddenComponents.has(componentId)) {
      this.hideComponent(componentId);
    } else {
      this.showComponent(componentId);
    }

    return widget;
  }

  public removeComponent(componentId: string): void {
    const grid = this.grid;
    const root = this.container;
    if (!grid || !root) return;

    const target = root.querySelector<HTMLElement>(
      `[data-component-id="${componentId}"]`,
    );
    if (target) {
      grid.removeWidget(target);
    }
    this.hiddenComponents.delete(componentId);
  }

  public hideComponent(componentId: string): void {
    const element = this.getWidgetElement(componentId);
    if (!element) {
      this.hiddenComponents.add(componentId);
      return;
    }
    element.classList.add(HIDDEN_CLASS);
    this.hiddenComponents.add(componentId);
  }

  public showComponent(componentId: string): void {
    const element = this.getWidgetElement(componentId);
    if (element) {
      element.classList.remove(HIDDEN_CLASS);
    }
    this.hiddenComponents.delete(componentId);
  }

  public enableEdit(): void {
    const grid = this.requireGrid();
    grid.setStatic(false);
    grid.enableMove(true);
    grid.enableResize(true);
    this.requireContainer().classList.add('edit-mode');
  }

  public disableEdit(): void {
    if (!this.grid) return;
    this.grid.enableMove(false);
    this.grid.enableResize(false);
    this.grid.setStatic(true);
    this.requireContainer().classList.remove('edit-mode');
  }

  public serialize(): WebUIGridLayout {
    const grid = this.grid;
    const root = this.container;
    if (!grid || !root) {
      return { components: {}, hiddenComponents: [] };
    }

    const nodesRaw = grid.save(false);
    const nodes = Array.isArray(nodesRaw) ? (nodesRaw as GridStackNode[]) : [];
    const components: Record<string, WebUIComponentLayout> = {};

    nodes.forEach((node: GridStackNode) => {
      if (!node.id) {
        // GridStack saves element id as node.id when using DOM element ID.
        // Fallback to DOM dataset when id is missing.
        const element = node.el as GridItemHTMLElement | undefined;
        const componentId =
          element?.dataset.componentId ?? element?.id ?? node.id;
        if (componentId) {
          components[componentId] = {
            x: node.x ?? 0,
            y: node.y ?? 0,
            w: node.w ?? 1,
            h: node.h ?? 1,
            minW: node.minW,
            minH: node.minH,
            maxW: node.maxW,
            maxH: node.maxH,
            locked: node.locked,
          };
        }
        return;
      }

      components[node.id] = {
        x: node.x ?? 0,
        y: node.y ?? 0,
        w: node.w ?? 1,
        h: node.h ?? 1,
        minW: node.minW,
        minH: node.minH,
        maxW: node.maxW,
        maxH: node.maxH,
        locked: node.locked,
      };
    });

    // Ensure components missing from save() are still accounted for by scanning DOM.
    root.querySelectorAll<HTMLElement>('[data-component-id]').forEach((el) => {
        const componentId = el.dataset.componentId;
        if (!componentId) return;
        if (!components[componentId]) {
          const rect = (el as GridItemHTMLElement).gridstackNode;
          if (rect) {
            components[componentId] = {
              x: rect.x ?? 0,
              y: rect.y ?? 0,
              w: rect.w ?? 1,
              h: rect.h ?? 1,
              minW: rect.minW,
              minH: rect.minH,
              maxW: rect.maxW,
              maxH: rect.maxH,
              locked: rect.locked,
            };
          }
        }
      });

    return {
      components,
      hiddenComponents: Array.from(this.hiddenComponents),
    };
  }

  public load(layout: WebUIGridLayout): void {
    const components = layout.components ?? {};
    this.clear();

    Object.entries(components).forEach(([componentId, config]) => {
      if (!config) {
        return;
      }
      this.addComponent(componentId, config);
    });

    const hidden = layout.hiddenComponents ?? [];
    hidden.forEach((componentId) => this.hideComponent(componentId));
  }

  public onChange(callback: WebUIGridChangeCallback): () => void {
    this.changeHandlers.add(callback);
    return () => this.changeHandlers.delete(callback);
  }

  private emitChange(): void {
    if (this.changeHandlers.size === 0) {
      return;
    }
    const snapshot = this.serialize();
    this.changeHandlers.forEach((handler) => {
      try {
        handler(snapshot);
      } catch (error) {
        console.error('[WebUIGridManager] Change handler threw an error:', error);
      }
    });
  }

  private getWidgetElement(componentId: string): HTMLElement | null {
    if (!this.container) return null;
    return this.container.querySelector<HTMLElement>(
      `[data-component-id="${componentId}"]`,
    );
  }

  private requireGrid(): GridStack {
    if (!this.grid) {
      throw new Error('GridStack not initialized. Call initialize() first.');
    }
    return this.grid;
  }

  private requireContainer(): HTMLElement {
    if (!this.container) {
      throw new Error('Grid container not available. Did initialize() succeed?');
    }
    return this.container;
  }
}
