/**
 * @fileoverview Type definitions for the WebUI grid layout system.
 *
 * Defines shared interfaces for GridStack-backed layout management in the
 * browser-based WebUI. These types describe component metadata, layout
 * serialization formats, persistence payloads, and callback signatures used
 * by the Grid manager and persistence layer. The definitions are intentionally
 * decoupled from Electron renderer-specific types to keep the WebUI self-
 * contained and browser-friendly.
 */

import type {
  GridStackOptions,
  GridStackWidget as GridStackWidgetConfig,
} from 'gridstack';

export interface WebUIComponentSize {
  w: number;
  h: number;
}

export interface WebUIComponentPosition {
  x: number;
  y: number;
}

export interface WebUIComponentDefinition {
  id: string;
  displayName: string;
  defaultSize: WebUIComponentSize;
  minSize: WebUIComponentSize;
  maxSize?: WebUIComponentSize;
  defaultPosition?: WebUIComponentPosition;
}

export interface WebUIComponentLayout
  extends WebUIComponentSize,
    WebUIComponentPosition {
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  locked?: boolean;
}

export type WebUIComponentLayoutMap = Record<
  string,
  WebUIComponentLayout | undefined
>;

export interface WebUIGridLayout {
  components: WebUIComponentLayoutMap;
  hiddenComponents?: string[];
  version?: number;
}

export type WebUIGridChangeCallback = (layout: WebUIGridLayout) => void;

export type WebUIGridOptions = GridStackOptions;

export type WebUIWidgetConfig = GridStackWidgetConfig;

export interface WebUIComponentTemplate {
  id: string;
  html: string;
}

export interface WebUIStoredLayout {
  updatedAt: number;
  layout: WebUIGridLayout;
}

