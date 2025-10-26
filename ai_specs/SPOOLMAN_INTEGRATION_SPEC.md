# Spoolman Integration - Complete Implementation Specification

**Created:** 2025-10-25
**Status:** Ready for Implementation
**Related Issue:** [#10](https://github.com/Parallel-7/FlashForgeUI-Electron/issues/10)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API Integration Details](#api-integration-details)
4. [Configuration System](#configuration-system)
5. [GridStack Component Implementation](#gridstack-component-implementation)
6. [Spool Selection Dialog Implementation](#spool-selection-dialog-implementation)
7. [Print Completion Integration](#print-completion-integration)
8. [Data Models & Type Definitions](#data-models--type-definitions)
9. [File Structure](#file-structure)
10. [Implementation Checklist](#implementation-checklist)

---

## Overview

### What We're Building

Integration between FlashForgeUI-Electron and [Spoolman](https://github.com/Donkie/Spoolman) (self-hosted filament inventory management system) to:

1. **Search and select active spools** from Spoolman server
2. **Automatically update filament usage** after print completion
3. **Support multi-printer setups** with per-context spool selection
4. **Coexist with existing filament tracker** without conflicts

### User Workflow

```
1. User enables Spoolman in Settings
   ↓
2. User adds Spoolman component to grid (or pins to topbar)
   ↓
3. User clicks "Set Active Spool" button
   ↓
4. Spool selection dialog opens → User searches/selects spool
   ↓
5. Component shows active spool with colored visual
   ↓
6. Print completes → Spoolman automatically updated with filament usage
   ↓
7. Component updates to show new remaining weight
```

---

## Architecture

### Component Diagram

```
┌────────────────────────────────────────────────────────────┐
│ Settings (src/ui/settings/)                                 │
│  • SpoolmanEnabled: boolean                                │
│  • SpoolmanServerUrl: string                               │
│  • SpoolmanUpdateMode: 'length' | 'weight'                 │
└────────────────────┬───────────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────────┐
│ SpoolmanService (src/services/SpoolmanService.ts)          │
│  • searchSpools(query): Promise<SpoolResponse[]>           │
│  • updateUsage(spoolId, usage): Promise<SpoolResponse>     │
│  • testConnection(): Promise<ConnectionTest>               │
└────────────────────┬───────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐     ┌──────────▼────────┐
│ SpoolmanComp   │     │ SpoolSelectionDlg │
│ (GridStack)    │     │ (Modal Dialog)    │
│                │     │                   │
│ • Disabled     │     │ • Search box      │
│ • No Spool     │◄────┤ • Spool cards     │
│ • Active Spool │     │ • Select action   │
└────────────────┘     └───────────────────┘
        │
        │ (per-context localStorage)
        │ Key: spoolman-active-spool-${contextId}
        │
┌───────▼──────────────────────────────────────────────────┐
│ PrinterNotificationCoordinator                            │
│  handlePrintCompleted() {                                 │
│    ... send print complete notification                   │
│    → HOOK: Update Spoolman spool usage                    │
│  }                                                         │
└───────────────────────────────────────────────────────────┘
```

---

## API Integration Details

### Spoolman REST API

**Base URL:** User-configured (e.g., `http://192.168.1.10:7912`)
**API Path:** `/api/v1/`
**Authentication:** None (API spec shows no auth - we'll skip API key for now)

### Endpoint 1: Search Spools

```
GET /api/v1/spool
```

**Query Parameters:**
```typescript
{
  'filament.name'?: string;      // Partial case-insensitive search
  'filament.material'?: string;  // e.g., "PLA", "PETG"
  'filament.vendor.name'?: string;
  location?: string;
  allow_archived?: boolean;      // default: false
  limit?: number;
  offset?: number;
  sort?: string;                 // e.g., "filament.name:asc"
}
```

**Response:**
```typescript
SpoolResponse[] // Array of spool objects
```

**Example Request:**
```typescript
GET /api/v1/spool?filament.name=hatchbox&limit=50
```

### Endpoint 2: Update Filament Usage

```
PUT /api/v1/spool/{spool_id}/use
```

**Request Body:**
```typescript
{
  use_weight?: number;  // grams to deduct (OR)
  use_length?: number;  // mm to deduct
}
```

**CRITICAL CONSTRAINT:** Must specify EITHER `use_weight` OR `use_length`, **never both**.

**Response:** Returns updated `SpoolResponse` object (HTTP 200)

**Error Codes:**
- `400` - Both weight and length specified
- `404` - Spool not found
- `422` - Validation error

**Example Request:**
```typescript
PUT /api/v1/spool/123/use
Content-Type: application/json

{
  "use_weight": 25.5
}
```

### Complete Schema Definitions

#### SpoolResponse

```typescript
interface SpoolResponse {
  // Required fields
  id: number;
  registered: string;              // UTC timestamp
  filament: FilamentObject;
  used_weight: number;             // ≥0 grams
  used_length: number;             // ≥0 mm
  archived: boolean;
  extra: Record<string, string>;   // Custom fields

  // Optional fields
  first_used: string | null;
  last_used: string | null;
  price: number | null;            // ≥0
  remaining_weight: number | null; // ≥0 grams
  initial_weight: number | null;   // ≥0 grams
  spool_weight: number | null;     // ≥0 grams (empty spool weight)
  remaining_length: number | null; // ≥0 mm
  location: string | null;         // max 64 chars
  lot_nr: string | null;           // max 64 chars
  comment: string | null;          // max 1024 chars
}
```

#### FilamentObject

```typescript
interface FilamentObject {
  // Required
  id: number;
  registered: string;
  density: number;                 // g/cm³
  diameter: number;                // mm

  // Optional
  name: string;                    // max 64 chars
  vendor: VendorObject | null;
  material: string | null;         // max 64 chars (e.g., "PLA")
  color_hex: string | null;        // 6-8 chars (e.g., "#FF5733")
  multi_color_hexes: string | null;
  multi_color_direction: 'coaxial' | 'longitudinal' | null;
  weight: number | null;           // grams
  spool_weight: number | null;     // grams
  article_number: string | null;   // max 64 chars
  settings_extruder_temp: number | null; // °C
  settings_bed_temp: number | null;      // °C
  price: number | null;
  comment: string | null;
  external_id: string | null;
  extra: Record<string, string>;
}
```

#### VendorObject

```typescript
interface VendorObject {
  id: number;
  registered: string;
  name: string;                    // max 64 chars
  empty_spool_weight: number | null; // grams
  external_id: string | null;
  extra: Record<string, string>;
}
```

### HTTP Client Implementation

**File:** `src/services/SpoolmanService.ts`

```typescript
import fetch from 'node-fetch'; // or use Electron's net module

export class SpoolmanService {
  private baseUrl: string;
  private readonly timeout = 10000; // 10 second timeout

  constructor(serverUrl: string) {
    // Ensure URL ends without trailing slash
    this.baseUrl = serverUrl.replace(/\/$/, '') + '/api/v1';
  }

  /**
   * Search for spools matching query
   */
  async searchSpools(query: SpoolSearchQuery): Promise<SpoolResponse[]> {
    const params = new URLSearchParams();

    // Build query params
    if (query['filament.name']) params.set('filament.name', query['filament.name']);
    if (query['filament.material']) params.set('filament.material', query['filament.material']);
    if (query.location) params.set('location', query.location);
    if (query.limit) params.set('limit', query.limit.toString());
    if (query.offset) params.set('offset', query.offset.toString());
    if (query.sort) params.set('sort', query.sort);

    // Default: exclude archived spools
    params.set('allow_archived', query.allow_archived ? 'true' : 'false');

    const url = `${this.baseUrl}/spool?${params.toString()}`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as SpoolResponse[];
    } catch (error) {
      this.handleError('searchSpools', error);
      throw error;
    }
  }

  /**
   * Update filament usage for a spool
   */
  async updateUsage(
    spoolId: number,
    usage: SpoolUsageUpdate
  ): Promise<SpoolResponse> {
    // Validate: cannot specify both weight and length
    if (usage.use_weight !== undefined && usage.use_length !== undefined) {
      throw new Error('Cannot specify both use_weight and use_length');
    }

    if (usage.use_weight === undefined && usage.use_length === undefined) {
      throw new Error('Must specify either use_weight or use_length');
    }

    const url = `${this.baseUrl}/spool/${spoolId}/use`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(usage)
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Spool ${spoolId} not found - it may have been deleted`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as SpoolResponse;
    } catch (error) {
      this.handleError('updateUsage', error);
      throw error;
    }
  }

  /**
   * Test connection to Spoolman server
   */
  async testConnection(): Promise<SpoolmanConnectionTest> {
    try {
      // Try to fetch first spool (limit=1)
      const url = `${this.baseUrl}/spool?limit=1`;
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      return {
        connected: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - check server URL and network');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Error handling and logging
   */
  private handleError(method: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[SpoolmanService.${method}] Error:`, message);
  }
}
```

---

## Configuration System

### Type Definitions

**File:** `src/types/config.ts`

Add to `AppConfig` interface:

```typescript
export interface AppConfig {
  // ... existing properties ...

  // Spoolman Integration
  readonly SpoolmanEnabled: boolean;
  readonly SpoolmanServerUrl: string;
  readonly SpoolmanUpdateMode: 'length' | 'weight';
}
```

Add to `DEFAULT_CONFIG`:

```typescript
export const DEFAULT_CONFIG: AppConfig = {
  // ... existing defaults ...

  SpoolmanEnabled: false,
  SpoolmanServerUrl: '',
  SpoolmanUpdateMode: 'weight', // Default to weight-based updates
} as const;
```

### Settings UI

**File:** `src/ui/settings/settings.html`

Insert **after** existing filament tracker section (after line ~51):

```html
<!-- Existing Filament Tracker Section -->
<label class="checkbox-label">
    <input type="checkbox" id="filament-tracker-enabled"> Filament Tracker Integration
</label>
<!-- ... existing filament tracker inputs ... -->

<!-- NEW: Spoolman Integration Section -->
<div class="settings-section" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #444;">
    <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #888;">
        Spoolman Integration
    </h4>
    <div class="settings-info-text" style="margin-bottom: 15px; margin-top: 0;">
        Connect to your Spoolman server to automatically track filament usage across all your printers.
    </div>

    <label class="checkbox-label">
        <input type="checkbox" id="spoolman-enabled"> Enable Spoolman Integration
    </label>

    <div class="input-group">
        <label for="spoolman-server-url">Spoolman Server URL:</label>
        <input type="text"
               id="spoolman-server-url"
               class="settings-input"
               placeholder="http://192.168.1.10:7912"
               pattern="https?://.+"
               title="Must start with http:// or https://">
    </div>
    <div class="settings-info-text" style="margin-top: 8px; margin-bottom: 18px;">
        Full URL including http:// and port (e.g., http://192.168.1.10:7912)
    </div>

    <div class="input-group">
        <label for="spoolman-update-mode">Filament Update Mode:</label>
        <select id="spoolman-update-mode" class="settings-input">
            <option value="weight">Weight (grams)</option>
            <option value="length">Length (millimeters)</option>
        </select>
    </div>
    <div class="settings-info-text" style="margin-top: 8px; margin-bottom: 10px;">
        Choose whether to update Spoolman using filament weight or length after prints complete
    </div>
</div>
```

### Settings Renderer Updates

**File:** `src/ui/settings/settings-renderer.ts`

Add to field mapping:

```typescript
// Add to loadSettings()
const spoolmanEnabled = document.getElementById('spoolman-enabled') as HTMLInputElement;
const spoolmanServerUrl = document.getElementById('spoolman-server-url') as HTMLInputElement;
const spoolmanUpdateMode = document.getElementById('spoolman-update-mode') as HTMLSelectElement;

if (spoolmanEnabled) spoolmanEnabled.checked = config.SpoolmanEnabled;
if (spoolmanServerUrl) spoolmanServerUrl.value = config.SpoolmanServerUrl;
if (spoolmanUpdateMode) spoolmanUpdateMode.value = config.SpoolmanUpdateMode;

// Add to saveSettings()
const newConfig: Partial<AppConfig> = {
  // ... existing fields ...
  SpoolmanEnabled: spoolmanEnabled?.checked ?? false,
  SpoolmanServerUrl: spoolmanServerUrl?.value.trim() ?? '',
  SpoolmanUpdateMode: (spoolmanUpdateMode?.value as 'length' | 'weight') ?? 'weight',
};

// Add URL validation
if (newConfig.SpoolmanEnabled && newConfig.SpoolmanServerUrl) {
  try {
    new URL(newConfig.SpoolmanServerUrl);
  } catch {
    showError('Invalid Spoolman server URL');
    return;
  }
}
```

---

## GridStack Component Implementation

### Component Registration

**File:** `src/ui/gridstack/ComponentRegistry.ts`

Add to registry (after line ~192):

```typescript
[
  'spoolman-tracker',
  {
    id: 'spoolman-tracker',
    name: 'Spoolman Tracker',
    icon: '🧵',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    category: 'main',
    description: 'Track active filament spool from Spoolman server',
    required: false,
    singleton: true,
  },
],
```

### Component Files

```
src/ui/components/spoolman/
├── index.ts
├── spoolman.ts
├── spoolman.css
└── types.ts
```

### Component Implementation

**File:** `src/ui/components/spoolman/spoolman.ts`

```typescript
import { BaseComponent } from '../base/component';
import type { ComponentUpdateData } from '../base/types';
import type { ActiveSpoolData } from './types';
import type { AppConfig } from '../../../types/config';

/**
 * Spoolman filament tracker component
 * Displays active spool selection and integrates with Spoolman server
 */
export class SpoolmanComponent extends BaseComponent {
  private activeSpool: ActiveSpoolData | null = null;
  private isEnabled = false;
  private contextId: string | null = null;

  // DOM references
  private disabledView!: HTMLElement;
  private noSpoolView!: HTMLElement;
  private activeSpoolView!: HTMLElement;
  private spoolVisual!: HTMLElement;
  private spoolNameText!: HTMLElement;
  private spoolInfoText!: HTMLElement;
  private setSpoolButton!: HTMLElement;
  private settingsButton!: HTMLElement;

  constructor(container: HTMLElement) {
    super('spoolman-tracker', container);
  }

  async initialize(): Promise<void> {
    this.render();
    this.attachEventHandlers();
    await this.loadState();
    this.updateView();
    this.markInitialized();
  }

  update(data: ComponentUpdateData): void {
    // Update config state
    if (data.config) {
      const config = data.config as AppConfig;
      const wasEnabled = this.isEnabled;
      this.isEnabled = config.SpoolmanEnabled;

      if (wasEnabled !== this.isEnabled) {
        this.updateView();
      }
    }

    // Store context ID for multi-printer support
    if (data.contextId && data.contextId !== this.contextId) {
      this.contextId = data.contextId;
      void this.loadState(); // Reload spool for new context
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="spoolman-component">
        <!-- Disabled state -->
        <div class="spoolman-state spoolman-disabled">
          <div class="spoolman-icon">🧵</div>
          <p class="spoolman-message">
            Spoolman integration is disabled.<br>
            Enable in Settings to track filament usage.
          </p>
        </div>

        <!-- No spool selected state -->
        <div class="spoolman-state spoolman-no-spool">
          <button class="btn-set-spool">Set Active Spool</button>
          <p class="spoolman-hint">No active spool selected</p>
        </div>

        <!-- Active spool state -->
        <div class="spoolman-state spoolman-active">
          <button class="btn-settings" title="Change Spool">⚙️</button>
          <div class="spool-visual">
            <div class="spool-center"></div>
          </div>
          <div class="spool-name"></div>
          <div class="spool-info"></div>
        </div>
      </div>
    `;

    // Cache DOM references
    this.disabledView = this.container.querySelector('.spoolman-disabled')!;
    this.noSpoolView = this.container.querySelector('.spoolman-no-spool')!;
    this.activeSpoolView = this.container.querySelector('.spoolman-active')!;
    this.spoolVisual = this.container.querySelector('.spool-visual')!;
    this.spoolNameText = this.container.querySelector('.spool-name')!;
    this.spoolInfoText = this.container.querySelector('.spool-info')!;
    this.setSpoolButton = this.container.querySelector('.btn-set-spool')!;
    this.settingsButton = this.container.querySelector('.btn-settings')!;
  }

  private attachEventHandlers(): void {
    // "Set Active Spool" button
    this.setSpoolButton.addEventListener('click', () => {
      void this.openSpoolSelection();
    });

    // Settings cog button
    this.settingsButton.addEventListener('click', () => {
      void this.openSpoolSelection();
    });

    // Listen for spool selection from dialog
    if (window.api?.spoolman) {
      window.api.spoolman.onSpoolSelected((spool: ActiveSpoolData) => {
        this.setActiveSpool(spool);
      });
    }
  }

  private updateView(): void {
    // Hide all states
    this.disabledView.style.display = 'none';
    this.noSpoolView.style.display = 'none';
    this.activeSpoolView.style.display = 'none';

    // Show appropriate state
    if (!this.isEnabled) {
      this.disabledView.style.display = 'flex';
    } else if (!this.activeSpool) {
      this.noSpoolView.style.display = 'flex';
    } else {
      this.activeSpoolView.style.display = 'flex';
      this.renderActiveSpool();
    }
  }

  private renderActiveSpool(): void {
    if (!this.activeSpool) return;

    // Set spool color
    const colorHex = this.activeSpool.colorHex || '#666666';
    this.spoolVisual.style.backgroundColor = colorHex;

    // Set text content
    const vendorPrefix = this.activeSpool.vendor ? `${this.activeSpool.vendor} ` : '';
    this.spoolNameText.textContent = `${vendorPrefix}${this.activeSpool.name}`;

    const material = this.activeSpool.material || 'Unknown';
    const remaining = Math.round(this.activeSpool.remainingWeight);
    this.spoolInfoText.textContent = `${material} - ${remaining}g remaining`;
  }

  private async openSpoolSelection(): Promise<void> {
    // Send IPC to open spool selection dialog
    if (window.api?.spoolman) {
      await window.api.spoolman.openSpoolSelection();
    }
  }

  private async loadState(): Promise<void> {
    // Load per-context spool selection
    const storageKey = this.getStorageKey();
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        this.activeSpool = JSON.parse(stored);
        this.updateView();
      } catch (error) {
        console.error('[SpoolmanComponent] Failed to parse stored spool data:', error);
        localStorage.removeItem(storageKey);
      }
    }
  }

  public setActiveSpool(spool: ActiveSpoolData): void {
    this.activeSpool = spool;
    const storageKey = this.getStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(spool));
    this.updateView();
    console.log(`[SpoolmanComponent] Active spool set: ${spool.name} (ID: ${spool.id})`);
  }

  public clearActiveSpool(): void {
    this.activeSpool = null;
    const storageKey = this.getStorageKey();
    localStorage.removeItem(storageKey);
    this.updateView();
    console.log('[SpoolmanComponent] Active spool cleared');
  }

  public getActiveSpool(): ActiveSpoolData | null {
    return this.activeSpool;
  }

  private getStorageKey(): string {
    // Per-context storage key for multi-printer support
    const contextSuffix = this.contextId ? `-${this.contextId}` : '';
    return `spoolman-active-spool${contextSuffix}`;
  }

  destroy(): void {
    this.markDestroyed();
  }
}
```

### Component Styling

**File:** `src/ui/components/spoolman/spoolman.css`

```css
.spoolman-component {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: #2a2a2a;
  border-radius: 8px;
  position: relative;
}

.spoolman-state {
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* ============================================================================
   DISABLED STATE
   ============================================================================ */

.spoolman-disabled {
  text-align: center;
}

.spoolman-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.spoolman-message {
  color: #888;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}

/* ============================================================================
   NO SPOOL STATE
   ============================================================================ */

.btn-set-spool {
  padding: 12px 24px;
  background: #5c6bc0;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.btn-set-spool:hover {
  background: #7986cb;
}

.btn-set-spool:active {
  transform: translateY(1px);
}

.spoolman-hint {
  color: #888;
  font-size: 12px;
  margin-top: 12px;
}

/* ============================================================================
   ACTIVE SPOOL STATE
   ============================================================================ */

.spoolman-active {
  position: relative;
  gap: 8px;
}

.btn-settings {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s ease;
  opacity: 0.7;
}

.btn-settings:hover {
  background: rgba(255, 255, 255, 0.2);
  opacity: 1;
}

/* Spool visual (circular, matching IFS dialog) */
.spool-visual {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: #666;
  border: 4px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  box-shadow:
    inset 0 4px 8px rgba(0, 0, 0, 0.4),
    0 4px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease;
}

.spool-visual:hover {
  transform: scale(1.05);
}

.spool-center {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.2);
}

/* Spool text */
.spool-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  text-align: center;
  margin-bottom: 4px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spool-info {
  font-size: 12px;
  color: #aaa;
  text-align: center;
}
```

### Component Types

**File:** `src/ui/components/spoolman/types.ts`

```typescript
/**
 * Simplified active spool data for UI display
 */
export interface ActiveSpoolData {
  id: number;
  name: string;
  vendor: string | null;
  material: string | null;
  colorHex: string;
  remainingWeight: number;   // grams
  remainingLength: number;   // mm
}
```

### Component Export

**File:** `src/ui/components/spoolman/index.ts`

```typescript
export { SpoolmanComponent } from './spoolman';
export type { ActiveSpoolData } from './types';
```

**File:** `src/ui/components/index.ts`

Add export:

```typescript
export { SpoolmanComponent } from './spoolman';
```

---

## Spool Selection Dialog Implementation

### Dialog Window Factory

**File:** `src/windows/factories/SpoolmanDialogWindowFactory.ts`

```typescript
import { BrowserWindow } from 'electron';
import path from 'path';
import { BaseWindowFactory } from './BaseWindowFactory';
import type { CreateWindowOptions } from '../shared/WindowTypes';

export class SpoolmanDialogWindowFactory extends BaseWindowFactory {
  protected getDefaultOptions(): CreateWindowOptions {
    return {
      width: 700,
      height: 800,
      resizable: false,
      alwaysOnTop: true,
      modal: true,
      frame: false,
      transparent: false,
      backgroundColor: '#2a2a2a',
      webPreferences: {
        preload: path.join(__dirname, '../ui/spoolman-dialog/spoolman-dialog-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    };
  }

  public createWindow(parent?: BrowserWindow): BrowserWindow {
    const options = this.getDefaultOptions();

    if (parent) {
      options.parent = parent;
    }

    const window = new BrowserWindow(options);

    // Load dialog HTML
    const htmlPath = path.join(__dirname, '../ui/spoolman-dialog/spoolman-dialog.html');
    void window.loadFile(htmlPath);

    return window;
  }
}
```

### Dialog HTML

**File:** `src/ui/spoolman-dialog/spoolman-dialog.html`

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>Select Active Spool - Spoolman</title>
    <link rel="stylesheet" href="spoolman-dialog.css">
</head>
<body>
    <div class="dialog-container">
        <!-- Dialog Header -->
        <div class="dialog-header">
            <div class="dialog-title">Select Active Spool</div>
            <button id="btn-close" class="dialog-close">×</button>
        </div>

        <!-- Search Bar -->
        <div class="search-container">
            <input type="text"
                   id="search-input"
                   class="search-input"
                   placeholder="Search spools by name, material, or vendor...">
            <span class="search-icon">🔍</span>
        </div>

        <!-- Spool Grid -->
        <div class="dialog-content">
            <!-- Loading state -->
            <div id="loading-state" class="state-view">
                <div class="loading-spinner"></div>
                <p>Loading spools...</p>
            </div>

            <!-- Error state -->
            <div id="error-state" class="state-view" style="display: none;">
                <div class="error-icon">⚠️</div>
                <p class="error-message" id="error-message">Failed to load spools</p>
                <button id="btn-retry" class="btn-retry">Retry</button>
            </div>

            <!-- Empty state -->
            <div id="empty-state" class="state-view" style="display: none;">
                <div class="empty-icon">🔍</div>
                <p>No spools found matching your search.</p>
                <p class="empty-hint">Try a different search term or add spools in Spoolman.</p>
            </div>

            <!-- Spool cards grid -->
            <div id="spool-grid" class="spool-grid" style="display: none;">
                <!-- Spool cards will be dynamically inserted here -->
            </div>
        </div>
    </div>

    <!-- CommonJS shim -->
    <script>
        if (typeof exports === 'undefined') {
            var exports = {};
        }
    </script>
    <script src="../../../lib/ui/spoolman-dialog/spoolman-dialog-renderer.js"></script>
</body>
</html>
```

### Dialog CSS

**File:** `src/ui/spoolman-dialog/spoolman-dialog.css`

```css
/* Import shared dialog template */
@import url('../shared/rounded-dialog-template.css');

body {
  background: transparent !important;
  overflow: hidden;
}

.dialog-container {
  background: #3a3a3a;
  border: 1px solid #555;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* ============================================================================
   SEARCH BAR
   ============================================================================ */

.search-container {
  position: relative;
  padding: 16px 20px;
  background: #353535;
  border-bottom: 1px solid #555;
}

.search-input {
  width: 100%;
  padding: 12px 40px 12px 16px;
  background: #2a2a2a;
  border: 1px solid #555;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  border-color: #5c6bc0;
}

.search-input::placeholder {
  color: #888;
}

.search-icon {
  position: absolute;
  right: 32px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  opacity: 0.5;
  pointer-events: none;
}

/* ============================================================================
   STATE VIEWS
   ============================================================================ */

.state-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  color: #aaa;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #555;
  border-top-color: #5c6bc0;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon,
.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.error-message {
  color: #f44336;
  font-size: 14px;
  margin-bottom: 16px;
}

.empty-hint {
  font-size: 13px;
  color: #777;
  margin-top: 8px;
}

.btn-retry {
  padding: 10px 20px;
  background: #5c6bc0;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
  margin-top: 12px;
}

.btn-retry:hover {
  background: #7986cb;
}

/* ============================================================================
   SPOOL GRID
   ============================================================================ */

.spool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  padding: 4px;
}

.spool-card {
  background: #353535;
  border: 2px solid #555;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.spool-card:hover {
  border-color: #5c6bc0;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(92, 107, 192, 0.3);
}

.spool-card:active {
  transform: translateY(0);
}

/* Spool visual (circular) */
.card-spool-visual {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background-color: #666;
  border: 3px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 3px 6px rgba(0, 0, 0, 0.4),
    0 3px 6px rgba(0, 0, 0, 0.3);
}

.card-spool-center {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.2);
}

/* Card text */
.card-spool-name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-spool-material {
  font-size: 11px;
  color: #aaa;
  text-align: center;
}

.card-spool-remaining {
  font-size: 11px;
  color: #888;
  text-align: center;
  font-style: italic;
}
```

### Dialog Renderer

**File:** `src/ui/spoolman-dialog/spoolman-dialog-renderer.ts`

```typescript
import type { SpoolResponse, ActiveSpoolData } from '../../types/spoolman';

// State
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentQuery = '';

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  console.log('[SpoolmanDialog] Renderer loaded');
  setupEventHandlers();
  void loadInitialSpools();
});

/**
 * Setup event handlers
 */
function setupEventHandlers(): void {
  // Close button
  const closeBtn = document.getElementById('btn-close');
  closeBtn?.addEventListener('click', () => {
    window.close();
  });

  // Retry button
  const retryBtn = document.getElementById('btn-retry');
  retryBtn?.addEventListener('click', () => {
    void loadSpools(currentQuery);
  });

  // Search input (debounced)
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  searchInput?.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.trim();
    currentQuery = query;

    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    // Debounce search by 300ms
    searchDebounceTimer = setTimeout(() => {
      void loadSpools(query);
    }, 300);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.close();
    }
  });
}

/**
 * Load initial spools (first 50)
 */
async function loadInitialSpools(): Promise<void> {
  await loadSpools('');
}

/**
 * Load spools with search query
 */
async function loadSpools(query: string): Promise<void> {
  showLoadingState();

  try {
    if (!window.spoolmanDialogAPI) {
      throw new Error('Spoolman dialog API not available');
    }

    // Request spools from main process
    const spools = await window.spoolmanDialogAPI.searchSpools({
      'filament.name': query || undefined,
      limit: 50,
      allow_archived: false,
    });

    if (spools.length === 0) {
      showEmptyState();
    } else {
      renderSpoolCards(spools);
    }
  } catch (error) {
    console.error('[SpoolmanDialog] Failed to load spools:', error);
    showErrorState(error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Render spool cards in grid
 */
function renderSpoolCards(spools: SpoolResponse[]): void {
  const gridContainer = document.getElementById('spool-grid');
  if (!gridContainer) return;

  // Clear existing cards
  gridContainer.innerHTML = '';

  // Create card for each spool
  spools.forEach((spool) => {
    const card = createSpoolCard(spool);
    gridContainer.appendChild(card);
  });

  // Show grid, hide other states
  showSpoolGrid();
}

/**
 * Create a spool card element
 */
function createSpoolCard(spool: SpoolResponse): HTMLElement {
  const card = document.createElement('div');
  card.className = 'spool-card';
  card.dataset.spoolId = spool.id.toString();

  // Get spool color (default to gray if not set)
  const colorHex = spool.filament.color_hex || '#666666';

  // Build display text
  const vendor = spool.filament.vendor?.name || '';
  const name = spool.filament.name || 'Unknown';
  const displayName = vendor ? `${vendor} ${name}` : name;
  const material = spool.filament.material || 'Unknown';
  const remaining = spool.remaining_weight
    ? `${Math.round(spool.remaining_weight)}g remaining`
    : 'Unknown weight';

  card.innerHTML = `
    <div class="card-spool-visual" style="background-color: ${colorHex};">
      <div class="card-spool-center"></div>
    </div>
    <div class="card-spool-name">${escapeHtml(displayName)}</div>
    <div class="card-spool-material">${escapeHtml(material)}</div>
    <div class="card-spool-remaining">${escapeHtml(remaining)}</div>
  `;

  // Click handler
  card.addEventListener('click', () => {
    void handleSpoolSelect(spool);
  });

  return card;
}

/**
 * Handle spool selection
 */
async function handleSpoolSelect(spool: SpoolResponse): Promise<void> {
  if (!window.spoolmanDialogAPI) return;

  // Transform to ActiveSpoolData
  const activeSpoolData: ActiveSpoolData = {
    id: spool.id,
    name: spool.filament.name || 'Unknown',
    vendor: spool.filament.vendor?.name || null,
    material: spool.filament.material || null,
    colorHex: spool.filament.color_hex || '#666666',
    remainingWeight: spool.remaining_weight || 0,
    remainingLength: spool.remaining_length || 0,
  };

  // Send selection to main process
  await window.spoolmanDialogAPI.selectSpool(activeSpoolData);

  // Close dialog
  window.close();
}

/**
 * Show loading state
 */
function showLoadingState(): void {
  hideAllStates();
  const loadingState = document.getElementById('loading-state');
  if (loadingState) loadingState.style.display = 'flex';
}

/**
 * Show error state
 */
function showErrorState(message: string): void {
  hideAllStates();
  const errorState = document.getElementById('error-state');
  const errorMessage = document.getElementById('error-message');
  if (errorState) errorState.style.display = 'flex';
  if (errorMessage) errorMessage.textContent = message;
}

/**
 * Show empty state
 */
function showEmptyState(): void {
  hideAllStates();
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.style.display = 'flex';
}

/**
 * Show spool grid
 */
function showSpoolGrid(): void {
  hideAllStates();
  const spoolGrid = document.getElementById('spool-grid');
  if (spoolGrid) spoolGrid.style.display = 'grid';
}

/**
 * Hide all state views
 */
function hideAllStates(): void {
  const states = ['loading-state', 'error-state', 'empty-state', 'spool-grid'];
  states.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

### Dialog Preload

**File:** `src/ui/spoolman-dialog/spoolman-dialog-preload.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import type { SpoolSearchQuery, SpoolResponse, ActiveSpoolData } from '../../types/spoolman';

// Expose safe API to renderer
contextBridge.exposeInMainWorld('spoolmanDialogAPI', {
  searchSpools: (query: SpoolSearchQuery): Promise<SpoolResponse[]> => {
    return ipcRenderer.invoke('spoolman:search-spools', query);
  },

  selectSpool: (spool: ActiveSpoolData): Promise<void> => {
    return ipcRenderer.invoke('spoolman:select-spool', spool);
  },
});

// Type augmentation for window
declare global {
  interface Window {
    spoolmanDialogAPI: {
      searchSpools: (query: SpoolSearchQuery) => Promise<SpoolResponse[]>;
      selectSpool: (spool: ActiveSpoolData) => Promise<void>;
    };
  }
}
```

### IPC Handlers

**File:** `src/ipc/handlers/spoolman-handlers.ts`

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { getConfigManager } from '../../managers/ConfigManager';
import { SpoolmanService } from '../../services/SpoolmanService';
import { SpoolmanDialogWindowFactory } from '../../windows/factories/SpoolmanDialogWindowFactory';
import type { SpoolSearchQuery, ActiveSpoolData } from '../../types/spoolman';

let spoolmanDialogWindow: BrowserWindow | null = null;

/**
 * Register Spoolman IPC handlers
 */
export function registerSpoolmanHandlers(): void {
  // Open spool selection dialog
  ipcMain.handle('spoolman:open-dialog', async (event) => {
    if (spoolmanDialogWindow && !spoolmanDialogWindow.isDestroyed()) {
      spoolmanDialogWindow.focus();
      return;
    }

    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const factory = new SpoolmanDialogWindowFactory();
    spoolmanDialogWindow = factory.createWindow(parentWindow || undefined);

    spoolmanDialogWindow.on('closed', () => {
      spoolmanDialogWindow = null;
    });
  });

  // Search spools
  ipcMain.handle('spoolman:search-spools', async (_event, query: SpoolSearchQuery) => {
    const config = getConfigManager().getConfig();

    if (!config.SpoolmanEnabled) {
      throw new Error('Spoolman integration is disabled');
    }

    if (!config.SpoolmanServerUrl) {
      throw new Error('Spoolman server URL not configured');
    }

    const service = new SpoolmanService(config.SpoolmanServerUrl);
    return await service.searchSpools(query);
  });

  // Select spool
  ipcMain.handle('spoolman:select-spool', async (event, spool: ActiveSpoolData) => {
    // Broadcast selection to all renderer windows
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('spoolman:spool-selected', spool);
    });
  });
}
```

### Preload API Extension

**File:** `src/preload.ts`

Add to main window preload:

```typescript
spoolman: {
  openSpoolSelection: () => ipcRenderer.invoke('spoolman:open-dialog'),
  onSpoolSelected: (callback: (spool: ActiveSpoolData) => void) => {
    ipcRenderer.on('spoolman:spool-selected', (_event, spool) => callback(spool));
  },
},
```

---

## Print Completion Integration

### Integration Point

**File:** `src/services/notifications/PrinterNotificationCoordinator.ts`

Modify `handlePrintCompleted()` method (line ~334):

```typescript
/**
 * Handle print completion
 */
private async handlePrintCompleted(status: PrinterStatus): Promise<void> {
  // Only send notification if not already sent and setting is enabled
  if (!this.notificationState.hasSentPrintCompleteNotification &&
      shouldSendNotification(NotificationType.PrintComplete, this.currentSettings)) {

    await this.sendPrintCompleteNotification(status);
    this.updateNotificationState({
      hasSentPrintCompleteNotification: true,
      lastPrintCompleteTime: new Date()
    }, NotificationStateTransition.PrintCompleted);
  }

  // NEW: Update Spoolman with filament usage
  await this.updateSpoolmanUsage(status);

  // Start temperature monitoring for cooled notification
  this.startTemperatureMonitoring();
}

/**
 * Update Spoolman with filament usage after print completion
 */
private async updateSpoolmanUsage(status: PrinterStatus): Promise<void> {
  try {
    // Get config
    const config = this.configManager.getConfig();

    // Check if Spoolman integration is enabled
    if (!config.SpoolmanEnabled) {
      return;
    }

    // Get active spool from component (via broadcast request)
    const activeSpool = await this.getActiveSpoolFromComponent();
    if (!activeSpool) {
      console.warn('[Spoolman] Print completed but no active spool selected');
      return;
    }

    // Get filament usage from current job
    const job = status.currentJob;
    if (!job) {
      console.warn('[Spoolman] Print completed but no job data available');
      return;
    }

    const weightUsed = job.progress.weightUsed; // grams
    const lengthUsed = job.progress.lengthUsed * 1000; // convert meters to mm

    // Validate we have usage data
    if (weightUsed <= 0 && lengthUsed <= 0) {
      console.warn('[Spoolman] No filament usage recorded for this print');
      return;
    }

    // Create service instance
    const service = new SpoolmanService(config.SpoolmanServerUrl);

    // Build update payload based on mode
    const updatePayload = config.SpoolmanUpdateMode === 'weight'
      ? { use_weight: weightUsed }
      : { use_length: lengthUsed };

    // Send update to Spoolman
    console.log(`[Spoolman] Updating spool ${activeSpool.id} with ${JSON.stringify(updatePayload)}`);
    const updatedSpool = await service.updateUsage(activeSpool.id, updatePayload);

    // Broadcast updated spool data to components
    this.broadcastSpoolUpdate(updatedSpool);

    // Success notification
    await this.notificationService.sendNotification({
      type: NotificationType.UploadComplete, // Reuse notification type
      title: 'Spoolman Updated',
      message: `${Math.round(weightUsed)}g used from ${activeSpool.name}`,
      options: {
        silent: true, // Don't play sound
      },
    });

    console.log(`[Spoolman] Successfully updated spool ${activeSpool.id}`);

  } catch (error) {
    console.error('[Spoolman] Failed to update filament usage:', error);

    // Error notification
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await this.notificationService.sendNotification({
      type: NotificationType.UploadFailed, // Reuse notification type
      title: 'Spoolman Update Failed',
      message: `Could not update filament usage: ${errorMessage}`,
      options: {
        silent: false, // Play error sound
      },
    });

    // Special handling for spool not found
    if (errorMessage.includes('not found')) {
      // Clear active spool from component
      this.broadcastClearActiveSpool();
    }
  }
}

/**
 * Get active spool from Spoolman component
 */
private async getActiveSpoolFromComponent(): Promise<ActiveSpoolData | null> {
  // Request active spool data via IPC
  // This will be implemented via a new IPC handler that queries the component
  const { ipcMain } = await import('electron');
  return new Promise((resolve) => {
    ipcMain.once('spoolman:active-spool-response', (_event, spool) => {
      resolve(spool);
    });

    // Broadcast request to renderer
    BrowserWindow.getAllWindows()[0]?.webContents.send('spoolman:get-active-spool');
  });
}

/**
 * Broadcast spool update to components
 */
private broadcastSpoolUpdate(updatedSpool: SpoolResponse): void {
  const { BrowserWindow } = require('electron');
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('spoolman:spool-updated', updatedSpool);
  });
}

/**
 * Broadcast clear active spool command
 */
private broadcastClearActiveSpool(): void {
  const { BrowserWindow } = require('electron');
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('spoolman:clear-active-spool');
  });
}
```

### Component Update Listener

Add to `SpoolmanComponent` class:

```typescript
// In attachEventHandlers()
if (window.api?.spoolman) {
  // Listen for spool updates from main process
  window.api.spoolman.onSpoolUpdated((updatedSpool: SpoolResponse) => {
    if (this.activeSpool && this.activeSpool.id === updatedSpool.id) {
      // Update local data
      this.activeSpool.remainingWeight = updatedSpool.remaining_weight || 0;
      this.activeSpool.remainingLength = updatedSpool.remaining_length || 0;
      this.updateView();
    }
  });

  // Listen for clear command
  window.api.spoolman.onClearActiveSpool(() => {
    this.clearActiveSpool();
  });

  // Listen for active spool request
  window.api.spoolman.onGetActiveSpool(() => {
    window.api.spoolman.sendActiveSpool(this.activeSpool);
  });
}
```

### Preload Extensions

Add to `src/preload.ts`:

```typescript
spoolman: {
  // ... existing methods ...

  onSpoolUpdated: (callback: (spool: SpoolResponse) => void) => {
    ipcRenderer.on('spoolman:spool-updated', (_event, spool) => callback(spool));
  },

  onClearActiveSpool: (callback: () => void) => {
    ipcRenderer.on('spoolman:clear-active-spool', callback);
  },

  onGetActiveSpool: (callback: () => void) => {
    ipcRenderer.on('spoolman:get-active-spool', callback);
  },

  sendActiveSpool: (spool: ActiveSpoolData | null) => {
    ipcRenderer.send('spoolman:active-spool-response', spool);
  },
},
```

---

## Data Models & Type Definitions

**File:** `src/types/spoolman.ts` (new file)

```typescript
/**
 * Spoolman API response for a single spool
 */
export interface SpoolResponse {
  // Required
  id: number;
  registered: string;
  filament: FilamentObject;
  used_weight: number;
  used_length: number;
  archived: boolean;
  extra: Record<string, string>;

  // Optional
  first_used: string | null;
  last_used: string | null;
  price: number | null;
  remaining_weight: number | null;
  initial_weight: number | null;
  spool_weight: number | null;
  remaining_length: number | null;
  location: string | null;
  lot_nr: string | null;
  comment: string | null;
}

/**
 * Filament object from Spoolman
 */
export interface FilamentObject {
  id: number;
  registered: string;
  density: number;
  diameter: number;
  name: string;
  vendor: VendorObject | null;
  material: string | null;
  color_hex: string | null;
  multi_color_hexes: string | null;
  multi_color_direction: 'coaxial' | 'longitudinal' | null;
  weight: number | null;
  spool_weight: number | null;
  article_number: string | null;
  settings_extruder_temp: number | null;
  settings_bed_temp: number | null;
  price: number | null;
  comment: string | null;
  external_id: string | null;
  extra: Record<string, string>;
}

/**
 * Vendor object from Spoolman
 */
export interface VendorObject {
  id: number;
  registered: string;
  name: string;
  empty_spool_weight: number | null;
  external_id: string | null;
  extra: Record<string, string>;
}

/**
 * Search query parameters for spool API
 */
export interface SpoolSearchQuery {
  'filament.name'?: string;
  'filament.material'?: string;
  'filament.vendor.name'?: string;
  location?: string;
  allow_archived?: boolean;
  limit?: number;
  offset?: number;
  sort?: string;
}

/**
 * Filament usage update parameters
 */
export interface SpoolUsageUpdate {
  use_length?: number;  // mm
  use_weight?: number;  // grams
}

/**
 * Simplified active spool data for UI display
 */
export interface ActiveSpoolData {
  id: number;
  name: string;
  vendor: string | null;
  material: string | null;
  colorHex: string;
  remainingWeight: number;   // grams
  remainingLength: number;   // mm
}

/**
 * Connection test result
 */
export interface SpoolmanConnectionTest {
  connected: boolean;
  error?: string;
}
```

---

## File Structure

### New Files to Create

```
src/
├── services/
│   └── SpoolmanService.ts                          # API service
├── types/
│   └── spoolman.ts                                 # Type definitions
├── ui/
│   ├── components/
│   │   └── spoolman/
│   │       ├── index.ts
│   │       ├── spoolman.ts                         # Component class
│   │       ├── spoolman.css                        # Component styles
│   │       └── types.ts                            # Component types
│   └── spoolman-dialog/
│       ├── spoolman-dialog.html
│       ├── spoolman-dialog.css
│       ├── spoolman-dialog-renderer.ts
│       └── spoolman-dialog-preload.ts
├── windows/
│   └── factories/
│       └── SpoolmanDialogWindowFactory.ts
└── ipc/
    └── handlers/
        └── spoolman-handlers.ts
```

### Files to Modify

```
src/
├── types/
│   └── config.ts                                   # Add Spoolman config
├── ui/
│   ├── settings/
│   │   ├── settings.html                           # Add Spoolman settings section
│   │   └── settings-renderer.ts                    # Handle Spoolman settings
│   ├── components/
│   │   └── index.ts                                # Export SpoolmanComponent
│   └── gridstack/
│       └── ComponentRegistry.ts                    # Register spoolman-tracker
├── services/
│   └── notifications/
│       └── PrinterNotificationCoordinator.ts       # Add Spoolman update hook
├── preload.ts                                       # Expose Spoolman API
└── ipc/
    └── handlers/
        └── index.ts                                 # Register Spoolman handlers
```

---

## Implementation Checklist

### Phase 1: Configuration & API Service
- [ ] Add Spoolman config properties to `src/types/config.ts`
- [ ] Create type definitions in `src/types/spoolman.ts`
- [ ] Create `SpoolmanService` class in `src/services/SpoolmanService.ts`
- [ ] Implement `searchSpools()` method with HTTP client
- [ ] Implement `updateUsage()` method with validation
- [ ] Implement `testConnection()` method
- [ ] Add error handling and timeout logic
- [ ] Test API methods with mock responses

### Phase 2: Settings UI
- [ ] Add Spoolman section to `src/ui/settings/settings.html`
- [ ] Add field handlers to `src/ui/settings/settings-renderer.ts`
- [ ] Add URL validation for server URL
- [ ] Test settings save/load cycle
- [ ] Verify config persistence across restarts

### Phase 3: GridStack Component
- [ ] Create component directory structure
- [ ] Implement `SpoolmanComponent` class in `src/ui/components/spoolman/spoolman.ts`
- [ ] Create component CSS matching IFS spool design
- [ ] Implement three states (disabled, no spool, active)
- [ ] Add per-context localStorage persistence
- [ ] Register component in `ComponentRegistry.ts`
- [ ] Export component in `src/ui/components/index.ts`
- [ ] Add component to factory switch in `component-dialog.ts` (if needed)
- [ ] Test component rendering in grid
- [ ] Test component as pinned shortcut button

### Phase 4: Spool Selection Dialog
- [ ] Create dialog directory structure
- [ ] Create `SpoolmanDialogWindowFactory.ts`
- [ ] Create dialog HTML with search bar and grid
- [ ] Create dialog CSS matching app theme
- [ ] Implement dialog renderer with search logic
- [ ] Implement debounced search (300ms)
- [ ] Implement spool card rendering
- [ ] Implement spool selection handler
- [ ] Create dialog preload with secure API
- [ ] Create IPC handlers for dialog operations
- [ ] Test dialog open/close
- [ ] Test search functionality
- [ ] Test spool selection flow

### Phase 5: Print Completion Integration
- [ ] Add Spoolman imports to `PrinterNotificationCoordinator.ts`
- [ ] Implement `updateSpoolmanUsage()` method
- [ ] Hook into `handlePrintCompleted()` method
- [ ] Implement active spool query via IPC
- [ ] Implement spool update broadcast
- [ ] Add success/error notifications
- [ ] Add spool update listener to component
- [ ] Add clear spool listener to component
- [ ] Test full print completion flow
- [ ] Test error scenarios (spool not found, network error)

### Phase 6: Testing & Polish
- [ ] Test with real Spoolman server
- [ ] Test multi-printer context switching
- [ ] Test per-context spool persistence
- [ ] Test network error handling
- [ ] Test spool deletion handling
- [ ] Verify no conflicts with existing filament tracker
- [ ] Run type checking (`npm run type-check`)
- [ ] Run linting (`npm run lint`)
- [ ] Add file documentation headers
- [ ] Update CLAUDE.md if needed

### Phase 7: Documentation & Release
- [ ] Add user guide section for Spoolman integration
- [ ] Document settings configuration
- [ ] Document component usage
- [ ] Create GitHub PR referencing issue #10
- [ ] Test installation instructions
- [ ] Create release notes

---

## Success Criteria

**Functionality:**
- ✅ User can enable Spoolman integration via settings
- ✅ User can configure server URL and update mode
- ✅ User can add Spoolman component to grid or pin to topbar
- ✅ User can search and select active spool
- ✅ Selected spool persists per printer context
- ✅ Print completion automatically updates Spoolman
- ✅ Component shows updated remaining weight after print
- ✅ Error notifications appear on Spoolman failures
- ✅ Integration coexists with existing filament tracker

**Code Quality:**
- ✅ All files have `@fileoverview` documentation headers
- ✅ No TypeScript compilation errors
- ✅ Lint passes with acceptable warnings
- ✅ Proper error handling throughout
- ✅ Resource cleanup (timers, event listeners)
- ✅ Follows existing codebase patterns
- ✅ Consistent logging format

**User Experience:**
- ✅ Clear visual states (disabled, no spool, active)
- ✅ Intuitive spool selection process
- ✅ Visual feedback for all actions
- ✅ Helpful error messages
- ✅ No disruption to existing features

---

**End of Specification**

*This specification is ready for implementation. All technical details, file structures, code examples, and integration points are fully defined.*
