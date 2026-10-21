# GridStack Layout System

`src/renderer/src/ui/gridstack/*` + `src/renderer/src/gridController.ts`.

## Modules

| File | Role |
| --- | --- |
| `GridStackManager.ts` | Grid init (12 columns, 80px cell height), `addWidget`/`removeWidget`, `serialize()`, `enable()/disable()`, `onChange` |
| `LayoutPersistence.ts` | localStorage per-printer layout storage. Keys `gridstack-layout-<serial>` (+ global fallback). `saveLayout` / `loadLayout` with defaults |
| `EditModeController.ts` | CTRL+E toggle; drag/resize handles, remove buttons, palette. Disabled with no printer connected |
| `ComponentRegistry.ts` | Metadata lookup over `src/shared/component-definitions.ts` |
| `defaults.ts` | `DEFAULT_GRID_OPTIONS`, `DEFAULT_WIDGETS`, `DEFAULT_LAYOUT`, `getDefaultLayout()`, `isValidLayout()`, `mergeWithDefaults()` |
| `types.ts` | `GridStackWidgetConfig`, `LayoutConfig`, `GridOptions` |

## Single widget-creation path (critical)

All widget creation — initial load, reload/context-switch, palette add — must route
through `createGridWidget()` + `createComponentForGrid()` in
`src/renderer/src/gridController.ts`. A divergent factory omits component cases
(material-station, tool-temps, creator5-temperature) and produces blank tiles and
missing edit-mode delete buttons (issue #77).

## Context switching flow

```
tab-clicked → save layout (localStorage) → switch context (IPC)
    → load layout for new serial → reload grid
    → ComponentManager.updateAll(cached data) → update tabs
```

Per-printer persistence helpers: `src/renderer/src/perPrinterStorage.ts`
(`loadLayoutForSerial` / `saveLayoutForSerial`); top-bar shortcuts:
`src/renderer/src/shortcutButtons.ts`.

## Renderer bootstrap order (`src/renderer/src/renderer.ts`)

CSS/icons → debug state → platform detection + theme → ShellController → shortcut
system → placeholder UI → polling listeners → printer tabs → state tracking →
ready signal. `ShellController` (`ui/shell/ShellController.ts`) owns window chrome
(controls, hamburger menu incl. Edit Layout, loading overlay).
