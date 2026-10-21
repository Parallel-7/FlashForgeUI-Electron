# Lessons

Hard-won rules. Violating any of these has shipped a bug. Grouped by area.

## Renderer & UI

1. Component dialog preloads must import typings with
   `import type {} from '../../types/global';` — runtime `.d.ts` imports break the
   dialog bootstrap.
2. The component dialog expects untouched `polling-update` payloads; do not
   transform the shape before forwarding to `ComponentManager.updateAll`.
3. GridStack wiring lives in `src/ui/gridstack/`; removing or duplicating that flow
   leaves globals unset. All widget creation routes through
   `createGridWidget()` + `createComponentForGrid()` in `gridController.ts` — a
   divergent factory produced blank tiles and missing edit-mode delete buttons
   (issue #77).
4. NEVER hardcode colors in CSS. Use theme variables
   ([../renderer/theme-system.md](../renderer/theme-system.md)).
5. Component availability is centralized: `ComponentDefinition.availability`
   ('grid' | 'shortcut' | 'both'). Grid surfaces consume
   `getGridComponentDefinitions()`; shortcuts consume
   `getShortcutComponentDefinitions()`. Shortcut-only windows declare
   `shortcutOpenChannel`. Never enumerate `COMPONENT_REGISTRY_DATA` directly.
6. The component-dialog preload must mirror the main preload's `material` IPC
   surface (`material:set-slot`, `material:configure-slot`,
   `spoolman.openSpoolSelection`, `onSpoolPickedForSlot`) — a gap surfaces as
   "Material control is not available".
7. The material-station grid component is `material-station` (renamed from
   `ifs-station`; saved layouts auto-migrate) and serves AD5X and Creator 5.
   Filament palettes are per-printer-family; Spoolman colors snap to the nearest
   swatch via CIEDE2000.
8. Per-printer settings live directly on `PrinterDetails`
   (`context.printerDetails.showCameraFps`, …) — `PrinterDetailsManager` has no
   `getSettings()`. See `src/shared/types/printer.ts`.

## Integration services

9. Spoolman integration deliberately blocks AD5X/material-station contexts.
   Removing the guard regresses filament safety checks.
10. Camera: `Go2rtcService` is the single streaming stack; go2rtc API/RTSP bind
    loopback, WebRTC `:8555` only stays open, browsers always go through the
    authenticated `CameraStreamProxy` on the WebUI port. Never reintroduce a
    `:1984` all-interfaces listen or a `localhost`/LAN-IP go2rtc URL.
    ([../integrations/camera-streaming.md](../integrations/camera-streaming.md))
11. SSH/SFTP features share one credential store (`SSHSettingsService`, keyed by
    serial, EasySSH defaults `root`/`flashforge`); file manager and calibration
    use separate connection keys. ([../integrations/ssh-sftp.md](../integrations/ssh-sftp.md))
12. SSH reboot needs a detached subshell — the printer cannot cleanly terminate its
    own SSH session.
13. The wall-clock ETA gates on `isPrintAdvancing` (Printing only — Paused AND
    Heating both freeze `estimatedTime` and drift). Mirrored in FlashForgeWebUI
    and both ff-5mp-api libs; change everywhere together.
    ([../architecture/managers-services.md](../architecture/managers-services.md))

## Backends & model detection

14. Discovery is PID-first: modern printers are typed from the UDP packet
    (`NEW_API_PRODUCT_IDS`), TCP `M115` probing is the PID-less fallback.
    ([../architecture/printer-backends.md](../architecture/printer-backends.md))
15. Once paired, trust the library: `client.isPro` / `client.isAD5X` / `info.Pid`.
    Never re-derive capabilities from `info.Name` (user-mutable), never mutate
    `client.isAD5X` after the fact.
16. Legacy mode is per-printer; never read a global `ForceLegacyAPI`.
17. If printers connect but tabs/discovery rows look wrong, inspect `src/main/index.ts`,
    `PrinterDiscoveryService.ts`, and renderer tab updates together — one-layer
    patches reintroduce the discovery bug.
18. `@ghosttypes/ff-api` is pinned `^2.0.0` (2.0.0's only break, `CompletionTime:
    Date | null`, is irrelevant here; 2.0.0 brings the C5 Pro `"pause"` mapping).
    Installs from public npm — no `.npmrc`/token needed.

## WebUI

19. Desktop and headless/WebUI share one connection/polling/camera stack; avoid
    `isHeadlessMode()` forks.
20. Built WebUI assets must stay version-stamped + no-cache; the browser Playwright
    suite exists to catch stale asset mixes.
21. Start Recent / Start Local gating is capability-based (Creator 5: both off;
    AD5X: Start Local off). Desktop `controls-grid.ts`, WebUI `panels.ts` +
    `dialogs.ts`, pinned by `creator5-gating.spec.ts` — change together and mirror
    into FlashForgeWebUI.

## Releases

22. Semver: `1.0.3-alpha.1 → … → 1.0.3` then **bump to `1.0.4-alpha.1`** — never
    continue `X.Y.Z-alpha.N` after `X.Y.Z` stable (electron-updater would look for
    `alpha.yml` in the stable release and 404).
23. Release channel derives from `package.json` version (prerelease suffix →
    `alpha`/`alpha.yml`; bare → `latest`/`latest.yml`). Don't hardcode. The release
    workflow (workflow_dispatch) reads notes from the matching
    `## [X.Y.Z] - date` CHANGELOG section; `softprops/action-gh-release` publishes
    an existing draft keeping its body — don't pre-create drafts if you want the
    templated notes.
24. Windows builds are unsigned (SmartScreen "unknown publisher" is expected).
    macOS builds MUST stay ad-hoc signed (`identity: '-'` +
    `hardenedRuntime: false` in `electron-builder-config.cjs`; the release
    workflow's "Verify macOS code signature" step enforces it). A fully unsigned
    mac download makes Gatekeeper show "damaged and can't be opened" — this broke
    the first 1.0.5 stable. Ad-hoc means macOS users approve each download once
    (System Settings → Privacy & Security → Open Anyway).
25. **Live GUI test with real printers before every release.** Skipping live
    testing is the #1 source of shipped bugs in this ecosystem.
