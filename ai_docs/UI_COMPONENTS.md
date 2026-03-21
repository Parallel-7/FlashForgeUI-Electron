# UI Components and Renderer Architecture

**Last Updated:** 2026-03-11

This document covers the renderer process, component system, settings dialog, and UI patterns.

---

## Renderer Component System

- `ComponentManager` (`src/renderer/src/ui/components/ComponentManager.ts`) registers every component from `src/renderer/src/ui/components/**`, initializes them in DOM order, and fans out `polling-update` payloads. Keep component constructors idempotent—GridStack recreates DOM nodes frequently.

- Grid/backplane orchestration lives in `src/renderer/src/gridController.ts` + `src/renderer/src/ui/gridstack/*`. These modules handle component registration, palette toggles, edit mode, layout serialization, and widget hydration (log panel, job info, etc.).

- Printer tabs (`src/renderer/src/ui/components/printer-tabs/*`) provide the multi-context UX. IPC events from tabs feed directly into `PrinterContextManager`; avoid bypassing these events when adding context-sensitive UI.

- Renderer helpers: `src/renderer/src/perPrinterStorage.ts` (layout + shortcut persistence per context), `src/renderer/src/shortcutButtons.ts` (top-bar shortcuts + dialog wiring), `src/renderer/src/logging.ts` (shared log forwarding). Touch these only when changing renderer-wide behaviors.

- Component dialogs reuse the same component stack via `src/main/windows/factories/ComponentDialogWindowFactory.ts`, `src/renderer/src/ui/component-dialog/*`, and the mirrored preload (`component-dialog-preload.ts`). Import typings with `import type` only—runtime `.d.ts` imports break the preload bootstrap.

---

## Settings Dialog Architecture

The settings dialog uses a modular, section-based architecture for improved maintainability and testability:

- **Base Contract**: `src/renderer/src/ui/settings/sections/SettingsSection.ts` defines the `SettingsSection` interface with `initialize()` and `dispose()` lifecycle hooks. All sections implement this contract.

- **Section Implementations** (`src/renderer/src/ui/settings/sections/*.ts`):
  - `AutoUpdateSection`: Auto-update configuration and version checking
  - `DesktopThemeSection`: Theme selection with live CSS variable updates
  - `DiscordWebhookSection`: Discord webhook configuration and testing
  - `InputDependencySection`: Manages dependent input states (e.g., port fields enabled only when feature is enabled)
  - `PrinterContextSection`: Per-printer context indicator and settings toggle
  - `RoundedUISection`: Rounded UI toggle with platform compatibility checks and CSS injection
  - `SpoolmanTestSection`: Spoolman server connection testing
  - `TabSection`: Tab navigation state management

- **Orchestrator**: `src/renderer/src/ui/settings/settings-renderer.ts` instantiates all sections, coordinates lifecycle, manages dual settings routing (global config.json vs. per-printer printer_details.json), and handles save/validation logic.

- **Type Definitions**: `src/renderer/src/ui/settings/types.ts` and `src/renderer/src/ui/settings/types/external.ts` provide shared interfaces for settings APIs and mutable state.

### When adding new settings sections:

1. Create a new class in `src/renderer/src/ui/settings/sections/` implementing the `SettingsSection` interface
2. Instantiate and wire it in `settings-renderer.ts`'s `initializeElements()` method
3. Call `initialize()` during setup and `dispose()` during cleanup
4. Keep section logic isolated—sections should not directly manipulate other sections' state

---

## Renderer Bootstrap (`src/renderer.ts`)

**Initialization Order**:
```
1. CSS & Icon Loading (Lucide icons)
2. Debug State Initialization (initializeDebugState)
3. Platform Detection & Theme Application
4. Legacy UI Controller Setup (LegacyUiController)
5. Shortcut System Initialization
6. Placeholder UI Setup
7. Polling Listeners (polling-update IPC)
8. Printer Tabs Initialization
9. State Tracking (printer state, backend events)
10. Renderer Ready Signal
```

**Key Controllers**:
- `RendererGridController`: Manages GridStack integration and component lifecycle
- `LegacyUiController`: Handles legacy UI updates and compatibility
- `ShortcutButtonController`: Manages top-bar shortcuts and dialog wiring

**Per-Printer State Tracking**:
- `printerSerialMap`: Maps context IDs to printer serial numbers
- `activeContextId` / `activeContextSerial`: Track current active context
- Layout and shortcut persistence via `loadLayoutForSerial` / `saveLayoutForSerial`

---

## Component System

### ComponentManager (`src/ui/components/ComponentManager.ts`)

- Singleton: `export const componentManager = new ComponentManager()`
- **Registration**: `registerComponent(component)`
- **Initialization**: `initializeAll()` - calls `initialize()` on all
- **Update Distribution**: `updateAll(data)` - fans out polling data
- **Lifecycle**: `destroyAll()`, `removeComponent(id)`, `reinitializeComponent(id)`

### BaseComponent (`src/ui/components/base/component.ts`)

```typescript
abstract class BaseComponent {
  abstract readonly componentId: string;
  abstract readonly templateHTML: string;
  abstract update(data: ComponentUpdateData): void;
  protected abstract setupEventListeners(): Promise<void>;
}
```

### Component Registry

Component definitions are centrally defined in `src/shared/component-definitions.ts` and shared between Main process (Palette window) and Renderer process (Grid UI).

### 11 Registered Components (GridStack Dashboard)

These components are registered in `COMPONENT_REGISTRY_DATA` for use in the GridStack dashboard:

- camera-preview (main)
- controls-grid (main)
- model-preview (main)
- job-stats (main)
- printer-status (status-bar)
- temperature-controls (status-bar)
- filtration-controls (status-bar)
- additional-info (status-bar)
- spoolman-tracker (main) - directory: `spoolman/`
- ifs-station (main) - IFS Material Station for AD5X printers
- log-panel (utility)

### Additional Exported Components (Non-Grid)

These components are exported from the component system but are not in the GridStack registry:

- job-info (main) - Job information display component
- printer-tabs (multi-printer) - Tab system for printer context switching

**Total: 13 Exported Components**

---

## GridStack Layout System

### GridStackManager (`src/ui/gridstack/GridStackManager.ts`)

```typescript
export const gridStackManager = new GridStackManager('.grid-stack');
```

**Operations**:
- `initialize(options)`: 12 columns, 80px cell height
- `addWidget(config, element)`: Add with position/size
- `removeWidget(element)`: Remove and cleanup
- `serialize()`: Export layout
- `enable()/disable()`: Toggle editing
- `onChange(callback)`: Layout change listener

### LayoutPersistence (`src/ui/gridstack/LayoutPersistence.ts`)

- **Storage**: localStorage with per-printer keys
- `saveLayout(serial, layout)`: Persist
- `loadLayout(serial)`: Restore with defaults
- **Keys**: `gridstack-layout-<serial>`, `gridstack-layout`

### EditModeController (`src/ui/gridstack/EditModeController.ts`)

- **Toggle**: CTRL+E
- **Features**: Drag/resize handles, remove buttons, palette integration
- **State**: Edit mode disabled when no printer connected

### ComponentRegistry (`src/ui/gridstack/ComponentRegistry.ts`)

- **Purpose**: Central component metadata lookup for GridStack widgets
- **Functions**: `getComponentDefinition(id)`, `getAllComponents()`
- **Source**: Imports definitions from `src/shared/component-definitions.ts`

### Defaults (`src/ui/gridstack/defaults.ts`)

- **Purpose**: Default layout configurations for GridStack dashboard
- **Exports**: `DEFAULT_GRID_OPTIONS`, `DEFAULT_WIDGETS`, `DEFAULT_LAYOUT`
- **Helpers**: `getDefaultLayout()`, `isValidLayout()`, `mergeWithDefaults()`
- **Grid**: 12-column grid, 80px cell height, 8px margins

### Types (`src/ui/gridstack/types.ts`)

- **Purpose**: TypeScript type definitions for GridStack integration
- **Key Types**: `GridStackWidgetConfig`, `LayoutConfig`, `GridOptions`, `ComponentDefinition`

---

## Multi-Printer Support

### PrinterTabsComponent (`src/ui/components/printer-tabs/`)

- `addTab(context)`: Create tab with status indicator
- `removeTab(contextId)`: Remove from UI
- `setActiveTab(contextId)`: Highlight active
- `updateTab(contextId, updates)`: Update label/status

### Context Switching Flow

```
tab-clicked event
    ↓
Save current layout → localStorage
    ↓
Switch context (IPC)
    ↓
Load new layout ← localStorage
    ↓
Reload grid → ComponentManager.updateAll(cached data)
    ↓
Update tabs
```

---

## Component Dialog System

### Purpose

Display grid components in modal windows

### Features

- Modal blocking
- Frameless with custom title bar
- Per-component sizes
- Own ComponentManager instance
- Same polling updates as main window

### Communication

```
Main → createComponentDialog(componentId)
    ↓
Load component-dialog.html
    ↓
Send componentId via IPC
    ↓
Dialog creates component
    ↓
Polling updates forwarded
```

---

## Key File Locations

**Renderer & Components**
- `src/renderer/src/renderer.ts`, `src/renderer/src/gridController.ts`, `src/renderer/src/shortcutButtons.ts`, `src/renderer/src/perPrinterStorage.ts`, `src/renderer/src/logging.ts`
- `src/renderer/src/ui/components/**` (ComponentManager, printer tabs, job info, etc.) + `src/renderer/src/ui/gridstack/**` for layout/palette logic
- `src/renderer/src/ui/component-dialog/**` – component dialog renderer + preload mirrors
- `src/renderer/src/ui/legacy/LegacyUiController.ts` – legacy UI compatibility layer

**GridStack System**
- `src/renderer/src/ui/gridstack/GridStackManager.ts` – grid initialization and widget management
- `src/renderer/src/ui/gridstack/LayoutPersistence.ts` – layout save/load with localStorage
- `src/renderer/src/ui/gridstack/EditModeController.ts` – edit mode toggle and UI
- `src/renderer/src/ui/gridstack/ComponentRegistry.ts` – component metadata lookup
- `src/renderer/src/ui/gridstack/defaults.ts` – default layout configurations
- `src/renderer/src/ui/gridstack/types.ts` – TypeScript type definitions

**Shared Definitions**
- `src/shared/component-definitions.ts` – central component registry shared between Main and Renderer

**Settings Dialog**
- `src/renderer/src/ui/settings/settings-renderer.ts` – main orchestrator for dual settings management (global + per-printer)
- `src/renderer/src/ui/settings/sections/SettingsSection.ts` – base interface for modular sections
- `src/renderer/src/ui/settings/sections/*.ts` – individual setting sections (AutoUpdate, DesktopTheme, Discord, InputDependency, PrinterContext, RoundedUI, SpoolmanTest, Tab)
- `src/renderer/src/ui/settings/types.ts`, `src/renderer/src/ui/settings/types/external.ts` – shared type definitions
