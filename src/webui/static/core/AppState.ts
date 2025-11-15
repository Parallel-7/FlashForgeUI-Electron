/**
 * @fileoverview Centralized WebUI application state and shared singletons.
 *
 * Hosts the mutable AppState container along with layout managers, context
 * tracking helpers, and layout configuration constants. Provides accessor
 * utilities so other modules can read and mutate shared state without reaching
 * into module-level variables directly.
 */

import { WebUIGridManager } from '../grid/WebUIGridManager.js';
import { WebUIMobileLayoutManager } from '../grid/WebUIMobileLayoutManager.js';
import { WebUILayoutPersistence } from '../grid/WebUILayoutPersistence.js';
import { componentRegistry } from '../grid/WebUIComponentRegistry.js';
import type {
  ActiveSpoolData,
  MaterialMapping,
  MaterialStationStatus,
  PendingJobStart,
  PrinterContext,
  PrinterFeatures,
  PrinterStatus,
  SpoolSummary,
  SpoolmanConfigResponse,
  WebUIJobFile,
  WebUISettings,
} from '../app.js';

export class AppState {
  public isAuthenticated: boolean = false;
  public authToken: string | null = null;
  public websocket: WebSocket | null = null;
  public isConnected: boolean = false;
  public printerStatus: PrinterStatus | null = null;
  public printerFeatures: PrinterFeatures | null = null;
  public selectedFile: string | null = null;
  public jobMetadata: Map<string, WebUIJobFile> = new Map();
  public pendingJobStart: PendingJobStart | null = null;
  public reconnectAttempts: number = 0;
  public maxReconnectAttempts: number = 5;
  public reconnectDelay: number = 2000;
  public authRequired: boolean = true;
  public defaultPassword: boolean = false;
  public hasPassword: boolean = true;
  public spoolmanConfig: SpoolmanConfigResponse | null = null;
  public activeSpool: ActiveSpoolData | null = null;
  public availableSpools: SpoolSummary[] = [];
}

export const state = new AppState();

export const gridManager = new WebUIGridManager('.webui-grid-desktop');
export const mobileLayoutManager = new WebUIMobileLayoutManager('.webui-grid-mobile');
export const layoutPersistence = new WebUILayoutPersistence();
export const ALL_COMPONENT_IDS = componentRegistry.getAllIds();

export const DEFAULT_SETTINGS: WebUISettings = {
  visibleComponents: [...ALL_COMPONENT_IDS],
  editMode: false,
};

export const MOBILE_BREAKPOINT = 768;
export const DEMO_SERIAL = 'demo-layout';

let currentPrinterSerial: string | null = null;
let currentContextId: string | null = null;
let currentSettings: WebUISettings = { ...DEFAULT_SETTINGS };
let gridInitialized = false;
let gridChangeUnsubscribe: (() => void) | null = null;
export const contextById = new Map<string, PrinterContext>();
let isMobileLayout = false;

export interface MaterialMatchingState {
  pending: PendingJobStart;
  materialStation: MaterialStationStatus | null;
  selectedToolId: number | null;
  mappings: Map<number, MaterialMapping>;
}

let materialMatchingState: MaterialMatchingState | null = null;

export function getCurrentPrinterSerial(): string | null {
  return currentPrinterSerial;
}

export function setCurrentPrinterSerial(serial: string | null): void {
  currentPrinterSerial = serial;
}

export function getCurrentContextId(): string | null {
  return currentContextId;
}

export function setCurrentContextId(contextId: string | null): void {
  currentContextId = contextId;
}

export function getCurrentSettings(): WebUISettings {
  return currentSettings;
}

export function updateCurrentSettings(settings: WebUISettings): void {
  currentSettings = settings;
}

export function isGridInitialized(): boolean {
  return gridInitialized;
}

export function setGridInitialized(initialized: boolean): void {
  gridInitialized = initialized;
}

export function getGridChangeUnsubscribe(): (() => void) | null {
  return gridChangeUnsubscribe;
}

export function setGridChangeUnsubscribe(callback: (() => void) | null): void {
  gridChangeUnsubscribe = callback;
}

export function isMobile(): boolean {
  return isMobileLayout;
}

export function setMobileLayout(mobile: boolean): void {
  isMobileLayout = mobile;
}

export function getMaterialMatchingState(): MaterialMatchingState | null {
  return materialMatchingState;
}

export function setMaterialMatchingState(
  matchingState: MaterialMatchingState | null,
): void {
  materialMatchingState = matchingState;
}
