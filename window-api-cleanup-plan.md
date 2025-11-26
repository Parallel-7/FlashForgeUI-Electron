# Window API Cleanup Plan

This document captures the current status of the `window.api.dialog.*` migration work and the remaining tasks needed to remove **all** legacy dialog globals (e.g., `window.xyzAPI`). It is intended as a hand-off spec for the next session so we can finish the cleanup in one focused effort.

---

## Overall Goals

1. Every dialog preload must expose its API via `window.api.dialog.<namespace>` only.
2. Every dialog renderer must consume the new namespace via helper accessors (no direct `window.fooAPI` lookups).
3. Delete all legacy globals (`window.settingsAPI`, `window.jobPickerAPI`, etc.) and any shims that pointed to the new APIs.
4. Update `src/types/global.d.ts`, `window-api-audit-report.md`, and related docs to reflect the final structure.
5. Confirm via the `npm run find:window` script that only the intended namespaces remain.

---

## Completed Work (in this session)

- **Shared dialog bridge:**
  - Added `window.api.dialog` namespace in `src/preload.cts` for settings/printer-settings/auto-update, plus helper registration functions.
  - Updated settings renderer and sections to resolve the new APIs; legacy globals exist only in the preload to keep old renders working.
- **Dialogs migrated to `window.api.dialog`:**
  - `update-available` (renderer & preload now use `window.api.dialog.update`)
  - `job-picker` (preload registers under `window.api.dialog.jobPicker`; renderer uses helper)
  - `log-dialog`
  - `spoolman-dialog`
  - `spoolman-offline-dialog`
  - `about-dialog`
  - `auto-connect-choice` / `connect-choice`
  - `component-dialog` (polling/init/theme listeners now use helper; legacy `window.componentDialogAPI` removed)
- **Utilities updated:**
  - `window-api-audit-report.md` now documents the dialog namespace.
  - `scripts/find-window-usage.ts` already exists and should be used after finishing.
  - Lint/type-check run clean after each migration batch.

---

## Remaining Dialogs to Migrate

The following dialogs still expose or consume bespoke globals. Each needs a preload update (register API under `window.api.dialog.<name>`) and renderer updates (resolve helper, remove direct `window.fooAPI` references, handle theme listeners, event cleanup, etc.).

### High Priority (core functionality)
1. **Shortcut Config Dialog**
   - Files: `src/ui/shortcut-config-dialog/shortcut-config-dialog-preload.cts`, `src/ui/shortcut-config-dialog/shortcut-config-dialog.ts`
   - Actions: expose under `window.api.dialog.shortcutConfig`; renderer should use helper (type guard) and dispose listeners on unload.

2. **Printer Selection Dialog**
   - Files: `src/ui/printer-selection/printer-selection-preload.cts`, `src/ui/printer-selection/printer-selection-renderer.ts`
   - API currently `window.printerSelectionAPI` (listen for discovery, saved printer events, theme, etc.).

3. **Printer Connected Warning Dialog**
   - Files: `src/ui/printer-connected-warning/printer-connected-warning-preload.cts`, renderer.

4. **Send Commands Dialog**
   - Files: `src/ui/send-cmds/send-cmds-preload.cts`, renderer uses `window.sendCmdsApi`.

5. **Status Dialog**
   - Files: `src/ui/status-dialog/status-dialog-preload.cts`, renderer uses `window.statusAPI`.

6. **Component Dialog-derived flows:**
   - Already migrated core, but verify no leftover `window.componentDialogAPI` references remain.

### Medium Priority
7. **Material Info Dialog (`window.materialInfoDialogAPI`)**
8. **Material Matching Dialog (`window.materialMatchingAPI`)**
9. **Single-Color Confirmation Dialog (`window.singleColorConfirmAPI`)**
10. **Job Uploader (`window.uploaderAPI`)**
11. **Input Dialog (`window.dialogAPI`)**
12. **IFS Dialog (`window.ifsDialogAPI`)**
13. **Auto Connect / Connect Choice** (auto-connect done; confirm connect choice done).
14. **Palette window / other utility dialogs**: `src/ui/palette/palette-preload.cts` exposes `window.paletteAPI` (verify usage).
15. **Any other specialized dialogs**: e.g., `material-matching`, `material-info`, `send-cmds`, `printer-connected`, `about`, `status`, `job-uploader`, `job-picker`, etc. Re-run `rg "window\.[A-Za-z0-9_]+API"` to confirm no new stragglers.

### Low Priority / TBD
- Some dialogs (e.g., `about-dialog`, `log-dialog`) already migrated; ensure they’re removed from any manual `declare global` definitions.
- Check for non-dialog legacy namespaces (e.g., `window.settingsAPI` is still defined for backward compatibility; once all references are removed we can drop the shim entirely).

---

## Cleanup Tasks After Migration

1. **Remove Legacy Globals from Preloads:**
   - In each dialog preload, delete the legacy `contextBridge.exposeInMainWorld('<foo>API', ...)` call once the renderer no longer references it.
   - For `settings-preload`, remove the `contextBridge.exposeInMainWorld('settingsAPI', ...)` etc. after all sections/sections consume `window.api.dialog.*`.

2. **Update Type Declarations:**
   - Remove `window.<foo>API` fields from `src/types/global.d.ts`.
   - Optionally define explicit types for `window.api.dialog.<name>` to improve auto-complete (e.g., add interfaces for `DialogNamespace` entries).

3. **Remove Helper Shims in Renderers:**
   - If any renderers still fallback to `window.fooAPI`, delete those guard branches once the new helpers are confirmed.

4. **Audit Theme Listeners and Cleanup Hooks:**
   - Ensure each dialog registers/unregisters `theme-changed` via the new helper and removes listeners on unload (push disposers to a cleanup array if needed).

5. **Run Tooling:**
   - `npm run lint`
   - `npm run type-check`
   - `npm run find:window -- --pattern='window\\.[A-Za-z0-9_]+API'` (should return zero results when finished).
   - `npm run find:window -- --pattern='window\\.(settingsAPI|printerSettingsAPI|autoUpdateAPI)'` (should be zero before we remove shims).

6. **Documentation:**
   - Update `window-api-audit-report.md` to remove references to legacy globals once they’re gone.
   - Consider adding a short section in the audit report describing the standard dialog namespace pattern for future contributors.

---

## Suggested Execution Order for Next Session

1. Migrate the **shortcut config dialog**, since it’s heavily used in the renderer and references multiple methods.
2. Handle **printer selection** + **printer warning** + **connect choice** (these share response-channel patterns).
3. Convert **send commands**, **input dialog**, and **job uploader/material dialogs** (they reuse similar patterns).
4. Finish with **status/about/palette** and any remaining specialized dialogs.
5. Remove the shims from `settings-preload`, `preload.cts`, and `global.d.ts`.
6. Run the scripts/lint/type-check and update docs.

This sequencing keeps us from breaking key UX flows mid-migration, and lets us remove the legacy exposes in a single sweep.

---

## Notes & Risks

- Some dialogs rely on unique response channels (e.g., connect-choice, auto-connect choice, input dialog). The new helper must replicate that behavior (often by invoking `ipcRenderer.invoke('...:get-response-channel')`). Ensure the helper returns promise-based results to avoid regressions.
- Double-check theme listeners: some dialogs previously used `window.dialogAPI.receive`. After migration, we should rely exclusively on `window.api.dialog.<name>.receive`.
- Remember to handle cleanup: push disposers returned from `api.receive()` into `cleanupCallbacks` arrays where applicable.
- After deleting shims, run `npm run find:window` to catch any straggling `window.fooAPI` usages. The script now supports `--pattern` filters (e.g., `--pattern='window\\.[A-Za-z0-9_]+API'`).

---

## Quick Checklist

- [ ] Shortcut config dialog migrated and shim removed
- [ ] Printer selection/connected warning/connect-choice dialogs migrated
- [ ] Send commands, input dialog, job uploader/material dialogs migrated
- [ ] Status/about/palette/IFS dialogs migrated
- [ ] `src/types/global.d.ts` cleansed of `window.*API` references
- [ ] `settings-preload` shims removed
- [ ] Lint, type-check, and `find:window` run clean
- [ ] `window-api-audit-report.md` updated with final counts/namespaces

Once these boxes are checked, the project will have a single, consistent dialog API surface with no legacy globals to confuse future AI agents or maintainers. Let’s finish the migration in the next session.
