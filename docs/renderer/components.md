# Renderer Components

`src/renderer/src/ui/components/**` — one folder per component, registered centrally.

## ComponentManager (`src/renderer/src/ui/components/ComponentManager.ts`)

Singleton (`export const componentManager`). Registers every component, initializes
in DOM order, fans `polling-update` payloads via `updateAll(data)`. Lifecycle:
`destroyAll()`, `removeComponent(id)`, `reinitializeComponent(id)`.
**Constructors must be idempotent** — GridStack recreates DOM nodes frequently.

`BaseComponent` (`components/base/component.ts`): subclasses implement
`componentId`, `templateHTML`, `update(data)`, `setupEventListeners()`.

## Registry (`src/shared/component-definitions.ts`)

`COMPONENT_REGISTRY_DATA` is the single source of truth, shared by the Main process
(palette) and the Renderer (grid). Each `ComponentDefinition` may declare
`availability`: `'grid' | 'shortcut' | 'both'` (default `'both'`), and
shortcut-only entries that open a dedicated window declare `shortcutOpenChannel`
(e.g. `file-manager:open`).

Registered definitions (verified): `camera-preview`, `controls-grid`,
`model-preview`, `job-stats`, `printer-status`, `temperature-controls`,
`filtration-controls`, `additional-info`, `log-panel`, `spoolman-tracker`,
`material-station` (serves AD5X AND Creator 5; renamed from `ifs-station` — saved
layouts auto-migrate), `tool-temps`, `creator5-temperature` (unified
tool/bed/chamber card), and `file-manager` (`availability: 'shortcut'`).

Consumers must use `getGridComponentDefinitions()` / `isGridComponent()` and
`getShortcutComponentDefinitions()` / `isShortcutComponent()` — never enumerate
`COMPONENT_REGISTRY_DATA` directly from a surface-specific consumer.

Non-grid exported components: `job-info`, `printer-tabs` (context switching tabs).

## Filament palettes

Per-printer-family (AD5X vs Creator 5); Spoolman colors snap to the nearest swatch
via CIEDE2000 color distance.

## Printer tabs (`components/printer-tabs/`)

`addTab` / `removeTab` / `setActiveTab` / `updateTab`. Tab events feed
`PrinterContextManager` via IPC — context-sensitive UI goes through these events,
never around them.

## Component dialog system

Pop-out windows reuse the component stack:
`src/main/windows/factories/ComponentDialogWindowFactory.ts` +
`src/renderer/src/ui/component-dialog/*` + the mirrored
`component-dialog-preload.ts`. The dialog has its own ComponentManager instance and
receives the same (untransformed) polling updates. Communication:
main → `createComponentDialog(componentId)` → dialog HTML → componentId via IPC →
component created → polling forwarded.
