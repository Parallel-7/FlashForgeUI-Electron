# Camera Auto-Detection Blueprint

**Version:** 1.0.0  
**Status:** APPROVED - Ready for Implementation  
**Primary Target:** FlashForgeUI-Electron  
**Related Targets:** FlashForgeWebUI, `@ghosttypes/ff-api` (`ff-5mp-api-ts`)  
**Issue Reference:** GitHub issue #48, `AD5X Camera Support`  
**Updated:** 2026-03-08

---

## Executive Summary

This blueprint replaces the current model-based OEM camera behavior with runtime camera auto-detection based on printer-reported `cameraStreamUrl`.

The current support burden exists because the app only auto-enables the official camera for the 5M Pro, while users with an official OEM camera installed on a 5M or AD5X still have to use the misleading `Custom Camera` setting as a workaround. That behavior is incorrect, confusing, and directly responsible for recurring issues such as #48.

The approved end state is:

1. Official FlashForge camera detection is fully automatic on all 5M-series printers.
2. `Custom Camera` becomes strictly for user-supplied custom RTSP/HTTP camera URLs.
3. Legacy `customCameraEnabled: true` with a blank URL is silently normalized to disabled.
4. No one-off migration job, compatibility shim, or model-specific exception logic is added.
5. Electron desktop, Electron built-in WebUI, and standalone FlashForgeWebUI all use the same semantics.

---

## Why This Exists

The current behavior creates unnecessary support churn:

- 5M Pro users expect the official camera to work automatically because it ships from the factory with one installed.
- AD5X and 5M users who install the same official camera accessory still have working firmware support, but the app does not automatically recognize it.
- Users then discover or are told to enable `Custom Camera`, even though they are not using a custom camera at all.
- The documentation and wiki currently reinforce that workaround, which keeps the bad behavior alive.

The user goal for this refactor is explicit:

- Make official OEM camera detection fully automatic based on firmware behavior.
- Keep the custom camera checkbox and URL only for true third-party / custom camera setups.
- Do not add sloppy backward-compatibility or migration code.
- Keep the whole ecosystem in sync across Electron and the standalone WebUI.

The user also explicitly approved one important product decision:

- If a user disables the OEM camera in the printer firmware and `cameraStreamUrl` becomes empty, the apps should simply show no camera. There is no requirement to detect "installed but disabled" or to auto-recover that state.

---

## Scope

### In Scope

- `ff-5mp-api-ts`
- `FlashForgeUI-Electron`
- Electron built-in WebUI
- `FlashForgeWebUI`
- Documentation and wiki cleanup related to the old workaround

### Out of Scope

- Automatically enabling the OEM camera from the app
- Distinguishing "camera installed but disabled" from "camera not installed"
- Supporting old blank-URL custom-camera semantics indefinitely
- One-time storage migration scripts
- New camera control UI

---

## Approved Decisions Summary

| Decision | Approved Choice | Reason |
|----------|-----------------|--------|
| OEM camera source of truth | Runtime `cameraStreamUrl` from printer | Matches firmware and reverse-engineered behavior |
| OEM detection strategy | Data-driven, not model-driven | Official camera can be added to non-Pro 5M-series printers |
| Custom camera meaning | Only explicit user-supplied custom URL | Stops conflating OEM and custom paths |
| Blank custom config handling | `enabled + blank URL` becomes disabled | Removes old workaround without a migration job |
| OEM stream URL source | Use printer-reported `cameraStreamUrl` | Avoids hardcoded URL synthesis as behavior source |
| App behavior if OEM camera disabled in firmware | Show unavailable | Accepted limitation; users can re-enable on printer |
| Backward compatibility strategy | None beyond blank-URL normalization | Keeps implementation clean |
| Cross-repo parity | Required | Electron and standalone must stay in sync |
| Desktop/WebUI parity | Required | Built-in WebUI and desktop must resolve camera availability the same way |

---

## Investigation Summary

### GitHub Issue #48

Issue #48 (`AD5X Camera Support`) describes the exact bug that prompted this work:

- An AD5X with the official camera installed still shows camera unavailable.
- The current workaround is to enable `Custom Camera`.
- The issue reporter correctly suspected that `printerFeatures.camera.builtin` was false.

Maintainer discussion on the issue already points toward the right fix:

- The current app only auto-enables the official camera for models where it is factory-installed.
- `cameraStreamUrl` appears to be populated only when the official camera is actually available and enabled.

This blueprint formalizes that fix and extends it across the full ecosystem.

### Reverse-Engineered Firmware Findings

The firmware reverse-engineering material confirms that `cameraStreamUrl` is the correct source of truth.

Relevant files:

- `C:\Users\coper\Documents\AI-Workspace\flashforge-firmware-stuff\endpoints_3.2.7.yaml`
- `C:\Users\coper\Documents\AI-Workspace\flashforge-firmware-stuff\endpoints_ad5x_1.2.1.yaml`
- `C:\Users\coper\Documents\AI-Workspace\flashforge-firmware-stuff\docs\ad5x\software\3.2.7\camera-subsystem.md`

Verified behavior:

1. `/detail.cameraStreamUrl` is empty when the camera is disabled.
2. `/detail.cameraStreamUrl` is populated with the MJPEG stream URL when the official camera is active.
3. The stream URL format is the familiar `http://<printer-ip>:8080/?action=stream`.
4. `StreamCtrlCmd` exists in the firmware docs and can control the camera state.
5. AD5X also exposes an additional `camera` integer field, but it is AD5X-only and is not the clean cross-model signal.

Important conclusion:

- `cameraStreamUrl` is the only clean cross-model runtime signal needed for this refactor.

Accepted limitation:

- `cameraStreamUrl` does not distinguish "camera not installed" from "camera installed but disabled". That is acceptable for this feature.

### Official Built-In Firmware WebUI Behavior

The printer's own shipped WebUI is value-driven, not model-driven.

Relevant firmware assets:

- `C:\Users\coper\Documents\AI-Workspace\flashforge-firmware-stuff\oem_firmware_raw\5m-5m-pro\software-3.2.7\client\js\home.js`
- `C:\Users\coper\Documents\AI-Workspace\flashforge-firmware-stuff\oem_firmware_raw\ad5x\AD5X-3.2.7-2.3.3\software-3.2.7\client\js\home.js`

The vendor UI pulls `PrinterCamera` from `/getHomeMessage` and directly assigns it to the camera image source. It does not appear to gate camera visibility on a hardcoded model capability flag.

Important conclusion:

- FlashForge's own UI behavior aligns with the runtime-data approach, not the current app's model-flag approach.

### API Library Findings (`ff-5mp-api-ts`)

Relevant files:

- `C:\Users\coper\Documents\GitHub\ff-5mp-api-ts\src\FiveMClient.ts`
- `C:\Users\coper\Documents\GitHub\ff-5mp-api-ts\src\models\MachineInfo.ts`
- `C:\Users\coper\Documents\GitHub\ff-5mp-api-ts\src\models\ff-models.ts`

Verified current state:

1. `FFPrinterDetail.cameraStreamUrl` already exists in the model layer.
2. `MachineInfo.fromDetail()` already maps `detail.cameraStreamUrl` into `FFMachineInfo.CameraStreamUrl`.
3. `FiveMClient.verifyConnection()` already fetches `/detail` and calls `cacheDetails(machineInfo)`.
4. `FiveMClient.cacheDetails()` does not currently cache `CameraStreamUrl`, so app backends do not have an easy runtime field to consume.

Important conclusion:

- The API library already parses the required data. It only needs to retain it on the client instance.

Important follow-up note:

- `src\api\controls\Control.ts` still gates camera on/off helpers on `this.client.isPro`, even though the firmware docs show broader support. That is not required for this refactor, but it should be corrected later if app-side camera enable/disable is ever added.

### FlashForgeUI-Electron Current Behavior

Core problem files:

- `src/main/utils/camera-utils.ts`
- `src/main/printer-backends/BasePrinterBackend.ts`

Current `camera-utils` behavior:

1. If `customCameraEnabled` is true and the URL is blank, it synthesizes `http://<printer-ip>:8080/?action=stream` and treats that as a camera source.
2. If `customCameraEnabled` is true and the URL is present, it uses that custom URL.
3. Otherwise, if `printerFeatures.camera.builtin` is true, it synthesizes the same OEM stream URL.
4. Otherwise, camera is unavailable.

Current backend behavior:

1. `BasePrinterBackend.isFeatureAvailable('camera')` returns true when either `camera.builtin` or `camera.customEnabled` is true.
2. Runtime `cameraStreamUrl` from `/detail` is not used.
3. `DualAPIBackend` already fetches fresh `machineInfo` during polling, but camera data is ignored.

Current hardcoded model flags:

- `src/main/printer-backends/Adventurer5MBackend.ts`: `camera.builtin = false`
- `src/main/printer-backends/AD5XBackend.ts`: `camera.builtin = false`
- `src/main/printer-backends/Adventurer5MProBackend.ts`: `camera.builtin = true`

That means:

- AD5X and 5M users with an official camera accessory are blocked by app logic even when firmware already exposes a working camera stream.

### Electron Desktop vs Built-In WebUI

Desktop preview:

- `src/renderer/src/ui/components/camera-preview/camera-preview.ts`
- `src/main/ipc/camera-ipc-handler.ts`

Current desktop weakness:

- `camera:get-stream-config` only returns an existing stream mapping.
- The stream is normally created on connect or on settings changes.
- If camera availability changes later, or if the initial creation path was missed, desktop preview can fail even though a valid camera config exists.

Built-in WebUI:

- `src/main/webui/server/routes/camera-routes.ts`
- `src/main/webui/static/features/camera.ts`
- `src/main/webui/server/routes/printer-status-routes.ts`

Current built-in WebUI behavior is slightly better than desktop because it can create the go2rtc stream on demand, but Electron's route only checks `hasStream(contextId)` rather than `hasMatchingStream(...)`.

Important conclusion:

- The built-in WebUI and desktop path are not fully aligned today.

### FlashForgeWebUI Current Behavior

Relevant files:

- `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\utils\camera-utils.ts`
- `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\printer-backends\BasePrinterBackend.ts`
- `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\webui\server\routes\camera-routes.ts`
- `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\index.ts`
- `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\data\printer_details.json`

Verified current state:

1. Standalone currently mirrors the same incorrect empty-URL custom-camera semantics.
2. Standalone also uses model-based `camera.builtin` behavior.
3. Standalone's stream routing is slightly cleaner because it already uses `hasMatchingStream(...)`.
4. Standalone already contains a stale saved example state with `customCameraEnabled: true` and a blank URL.
5. `PrinterDetailsManager` in standalone already has sanitization hooks, making blank-URL normalization easier there than in Electron.

Important conclusion:

- The same semantic change must be applied in standalone at the same time or the ecosystem remains inconsistent.

### Dependency Version Mismatch

Current package versions differ:

- Electron currently uses `@ghosttypes/ff-api: ^1.1.0`
- FlashForgeWebUI currently uses `@ghosttypes/ff-api: 1.0.0-20251122000715`

Important conclusion:

- Both consuming apps must be aligned on an updated API package version before or during implementation.

---

## Root Cause Analysis

The bug is not a firmware limitation. It is an application architecture problem.

The current app incorrectly assumes:

1. Official camera support can be expressed as a static per-model boolean.
2. A blank custom-camera URL is a valid signal to synthesize the OEM stream URL.
3. `Custom Camera` can serve as both a user override and an OEM camera workaround.

All three assumptions are wrong for the 5M-series ecosystem.

The actual system behaves like this:

1. Firmware decides whether an OEM camera stream exists.
2. That decision is exposed at runtime via `cameraStreamUrl`.
3. The app should consume that runtime value directly.
4. Custom camera configuration should be independent from OEM camera detection.

---

## Desired End State

### User-Facing Behavior

1. 5M Pro with official camera enabled: camera is available automatically.
2. 5M with official camera installed and enabled: camera is available automatically.
3. AD5X with official camera installed and enabled: camera is available automatically.
4. Any supported printer without an official camera stream and without a custom URL: camera is unavailable.
5. Users with a true custom RTSP/HTTP camera can enable `Custom Camera` and supply a URL manually.
6. Users with stale `enabled + blank URL` settings silently fall back to normal behavior because custom mode is normalized off.

### Technical Behavior

1. Camera availability is computed from runtime data and explicit custom config.
2. No model-specific exception for 5M Pro is required.
3. OEM stream URL comes from firmware, not URL synthesis as the source of truth.
4. All three surfaces use the same camera resolution logic:
   - Electron desktop
   - Electron built-in WebUI
   - Standalone WebUI

---

## Non-Goals and Accepted Limitations

1. The app will not attempt to detect "camera installed but disabled" as a separate state.
2. The app will not automatically enable the camera on the printer.
3. The app will not retain blank-URL custom-camera semantics.
4. The app will not add migration code beyond cheap normalization of stale config.
5. The app does not need to preserve old docs that instruct users to enable `Custom Camera` for official FlashForge cameras.

---

## Proposed Architecture

### Camera Feature Model

Replace the current model-centric camera feature structure with a runtime-centric one.

#### Current Problematic Shape

```ts
interface CameraFeature {
  builtin: boolean;
  customEnabled: boolean;
  customUrl: string;
}
```

#### Proposed Shape

```ts
interface CameraFeature {
  oemStreamUrl: string;
  customEnabled: boolean;
  customUrl: string;
}
```

Notes:

- `oemStreamUrl` is a runtime field populated from printer state.
- `builtin` should be removed, not repurposed.
- Empty string means "no OEM camera stream currently available".

If camera config source labels are updated as part of this refactor, prefer:

```ts
type CameraSourceType = 'oem' | 'custom' | 'none';
```

That is cleaner than keeping the misleading `'builtin'` label for an official accessory camera.

### Settings Normalization Contract

Normalize stale custom camera settings anywhere settings are loaded, updated, or resolved:

```ts
function normalizeCustomCameraSettings(settings: PrinterSettings): PrinterSettings {
  const url = settings.customCameraUrl.trim();

  if (settings.customCameraEnabled && url === '') {
    return {
      ...settings,
      customCameraEnabled: false,
      customCameraUrl: ''
    };
  }

  return {
    ...settings,
    customCameraUrl: url
  };
}
```

Important rules:

1. Only blank enabled custom-camera state is normalized away.
2. Existing non-empty custom camera URLs are left alone.
3. No data migration pass is required.

### Camera Resolution Contract

Camera resolution order must be identical in both apps:

1. Normalize settings.
2. If custom camera is enabled:
   - If URL is valid and non-empty, use it.
   - If URL is non-empty but invalid, camera is unavailable.
   - Do not silently fall back to OEM in that invalid explicit-custom state.
3. If custom camera is not enabled and `oemStreamUrl` is non-empty, use the OEM stream.
4. Otherwise camera is unavailable.

Pseudocode:

```ts
const normalized = normalizeCustomCameraSettings(settings);

if (normalized.customCameraEnabled) {
  if (isValidCameraUrl(normalized.customCameraUrl)) {
    return { available: true, sourceType: 'custom', streamUrl: normalized.customCameraUrl };
  }

  return unavailableConfig;
}

if (features.camera.oemStreamUrl.trim() !== '') {
  return { available: true, sourceType: 'oem', streamUrl: features.camera.oemStreamUrl };
}

return unavailableConfig;
```

### Camera Availability Contract

`isFeatureAvailable('camera')` should return true when:

- `features.camera.oemStreamUrl` is non-empty, or
- normalized custom camera mode is enabled with a non-empty URL

It should not depend on a hardcoded model capability flag.

### Stream Coordination Contract

All camera-serving surfaces should reconcile against the same resolved camera config:

1. Resolve camera config from normalized settings plus runtime camera features.
2. Ensure the matching go2rtc stream exists for that config.
3. Reuse the stream if the existing mapping already matches.
4. Replace the stream if the resolved URL changed.
5. Remove the stream when the camera becomes unavailable.

This is the baseline behavior already closest to what standalone does today with `hasMatchingStream(...)`.

---

## Implementation Sequence

Implementation order matters because the apps need a real runtime field to consume.

### Phase 1: `ff-5mp-api-ts`

Implement this first.

#### Files to Change First

1. `C:\Users\coper\Documents\GitHub\ff-5mp-api-ts\src\FiveMClient.ts`
2. `C:\Users\coper\Documents\GitHub\ff-5mp-api-ts\src\FiveMClient.test.ts`
3. `C:\Users\coper\Documents\GitHub\ff-5mp-api-ts\src\models\MachineInfo.test.ts`
4. `C:\Users\coper\Documents\GitHub\ff-5mp-api-ts\package.json` if publishing a new version

#### Required Changes

##### `src/FiveMClient.ts`

- Add a cached `cameraStreamUrl` field on `FiveMClient`.
- Populate it inside `cacheDetails(machineInfo)`.
- Reset it when the client is torn down if that pattern exists elsewhere in the class.

Suggested expectation:

```ts
public cameraStreamUrl = '';
```

##### Tests

- Add coverage proving that `CameraStreamUrl` from `MachineInfo` is retained on the client after `verifyConnection()`.
- Keep the existing model parsing tests, but add assertions around the cached field.

#### Result of Phase 1

After this phase, both app repos can consume `fiveMClient.cameraStreamUrl` without re-parsing the raw detail payload.

---

### Phase 2: FlashForgeUI-Electron

Use Electron as the reference implementation for the new semantics.

#### Files to Change First

1. `package.json`
2. `src/shared/types/printer-backend/printer-features.ts`
3. `src/main/printer-backends/BasePrinterBackend.ts`
4. `src/main/printer-backends/DualAPIBackend.ts`
5. `src/main/printer-backends/Adventurer5MBackend.ts`
6. `src/main/printer-backends/AD5XBackend.ts`
7. `src/main/printer-backends/Adventurer5MProBackend.ts`
8. `src/main/printer-backends/GenericLegacyBackend.ts`
9. `src/main/utils/camera-utils.ts`
10. `src/main/services/CameraStreamCoordinator.ts` or equivalent new shared helper
11. `src/main/ipc/camera-ipc-handler.ts`
12. `src/main/webui/server/routes/camera-routes.ts`
13. `src/main/managers/PrinterDetailsManager.ts`
14. `src/main/managers/ConnectionFlowManager.ts`
15. `src/main/ipc/handlers/printer-settings-handlers.ts`
16. `src/shared/utils/printerSettingsDefaults.ts`
17. `src/renderer/src/ui/settings/settings.html`
18. `src/renderer/src/ui/settings/settings-renderer.ts`
19. Camera-related tests
20. Docs

#### Detailed Change Plan

##### 1. `package.json`

- Align Electron to the updated `@ghosttypes/ff-api` version that exposes cached `cameraStreamUrl`.

##### 2. `src/shared/types/printer-backend/printer-features.ts`

- Replace `camera.builtin` with `camera.oemStreamUrl`.
- Keep the type minimal and runtime-oriented.
- If the camera config type has a `sourceType` union, rename `'builtin'` to `'oem'`.

##### 3. `src/main/printer-backends/BasePrinterBackend.ts`

- Update default feature construction to use `oemStreamUrl`.
- Add a small runtime update path for camera feature changes.
- Update `isFeatureAvailable('camera')` to use:
  - normalized explicit custom camera state, or
  - runtime `oemStreamUrl`
- Ensure stale `enabled + blank URL` custom settings are normalized off before availability checks.

This is the main semantic hub for the refactor.

##### 4. `src/main/printer-backends/DualAPIBackend.ts`

- Ingest `machineInfo.CameraStreamUrl` on every poll.
- Push that value into the runtime camera feature state.
- If the backend already supports emitting feature changes, use that path so downstream camera routes and UI can react consistently.

This is what turns `/detail` into the live source of truth.

##### 5. Model backends

Files:

- `src/main/printer-backends/Adventurer5MBackend.ts`
- `src/main/printer-backends/AD5XBackend.ts`
- `src/main/printer-backends/Adventurer5MProBackend.ts`
- `src/main/printer-backends/GenericLegacyBackend.ts`

Required changes:

- Stop hardcoding `camera.builtin` as the real capability signal.
- Initialize `oemStreamUrl` to empty string in camera features.
- Leave camera availability to runtime updates from `DualAPIBackend`.

The point is to eliminate the current 5M Pro special-case architecture.

##### 6. `src/main/utils/camera-utils.ts`

- Remove the branch where `customCameraEnabled + blank URL` synthesizes the OEM stream.
- Make resolution order:
  1. normalized valid custom URL
  2. runtime `oemStreamUrl`
  3. unavailable
- Use the printer-reported OEM stream URL rather than building one from the printer IP as the behavior source.

##### 7. Shared stream reconciliation helper

Recommended new file:

- `src/main/services/CameraStreamCoordinator.ts`

Purpose:

- Centralize "resolve config -> ensure matching stream -> remove stale stream" behavior.
- Avoid the current split where desktop and built-in WebUI do related but not identical work.

Expected consumers:

- `src/main/ipc/camera-ipc-handler.ts`
- `src/main/webui/server/routes/camera-routes.ts`

##### 8. `src/main/ipc/camera-ipc-handler.ts`

- Stop assuming the camera stream only needs to be created on connect or settings change.
- Make `camera:get-stream-config` able to reconcile and ensure the correct stream exists for the current resolved camera config.
- Use matching-stream logic, not only "stream exists".

This removes the current desktop-specific fragility.

##### 9. `src/main/webui/server/routes/camera-routes.ts`

- Switch to the same coordinator logic used by desktop IPC.
- Replace the weaker `hasStream(contextId)` check with `hasMatchingStream(...)` behavior.
- Keep built-in WebUI aligned with desktop semantics.

##### 10. Settings normalization

Files:

- `src/main/managers/PrinterDetailsManager.ts`
- `src/main/managers/ConnectionFlowManager.ts`
- `src/main/ipc/handlers/printer-settings-handlers.ts`
- `src/shared/utils/printerSettingsDefaults.ts`

Required behavior:

- Normalize blank enabled custom-camera state on load.
- Normalize it on update.
- Normalize it before resolution if needed as a final safety net.

No separate migration step should be added.

##### 11. Renderer settings UI

Files:

- `src/renderer/src/ui/settings/settings.html`
- `src/renderer/src/ui/settings/settings-renderer.ts`

Required changes:

- Rename `Custom Camera` to something explicit, such as `Custom Camera URL` or `Custom RTSP/HTTP Camera`.
- Make it clear the setting is only for non-OEM cameras.
- Remove wording that implies official FlashForge camera users should enable it.

##### 12. Test updates

Primary test files to rewrite:

- `src/main/utils/__tests__/camera-utils.test.ts`
- `src/main/webui/server/routes/__tests__/camera-routes.test.ts`
- `src/main/printer-backends/__tests__/BasePrinterBackend.test.ts`
- `src/main/webui/server/routes/__tests__/printer-status-routes.test.ts`

Potentially impacted depending on the final type and route surface:

- `src/renderer/src/ui/components/camera-preview/camera-preview.ts`
- `src/main/webui/static/features/camera.ts`
- `src/main/webui/static/features/__tests__/camera.test.ts`

The old tests that assert "enabled + blank URL means OEM camera" must be deleted or rewritten.

##### 13. Documentation

Files:

- `docs/README.md`
- `README.md`

External docs to update after code lands:

- GitHub wiki page `Custom-Camera-Setup.md`

Required doc change:

- Stop instructing official camera users on 5M/AD5X to enable `Custom Camera`.

---

### Phase 3: FlashForgeWebUI

Once Electron is settled, port the exact same semantics into standalone.

#### Files to Change First

1. `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\package.json`
2. `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\types\printer-backend\printer-features.ts`
3. `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\printer-backends\BasePrinterBackend.ts`
4. `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\printer-backends\DualAPIBackend.ts`
5. `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\printer-backends\Adventurer5MBackend.ts`
6. `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\printer-backends\AD5XBackend.ts`
7. `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\printer-backends\Adventurer5MProBackend.ts`
8. `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\printer-backends\GenericLegacyBackend.ts`
9. `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\utils\camera-utils.ts`
10. `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\index.ts`
11. `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\webui\server\routes\camera-routes.ts`
12. `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\managers\PrinterDetailsManager.ts`
13. `C:\Users\coper\Documents\GitHub\FlashForgeWebUI\src\managers\ConnectionFlowManager.ts`
14. Optional local fixture cleanup in `data\printer_details.json`

#### Detailed Change Plan

##### 1. `package.json`

- Update standalone to the same `@ghosttypes/ff-api` version used by Electron after Phase 1.

##### 2. `src/types/printer-backend/printer-features.ts`

- Mirror the Electron camera feature shape exactly.

##### 3. `src/printer-backends/BasePrinterBackend.ts`

- Mirror Electron's `isFeatureAvailable('camera')` semantics.
- Normalize blank custom-camera state before using it.
- Treat runtime `oemStreamUrl` as the OEM truth source.

##### 4. `src/printer-backends/DualAPIBackend.ts`

- Mirror Electron's runtime ingestion of `machineInfo.CameraStreamUrl`.

##### 5. Model backends

Files:

- `src/printer-backends/Adventurer5MBackend.ts`
- `src/printer-backends/AD5XBackend.ts`
- `src/printer-backends/Adventurer5MProBackend.ts`
- `src/printer-backends/GenericLegacyBackend.ts`

Required changes:

- Remove model-based camera gating from the backend feature literals.
- Initialize `oemStreamUrl` to empty and let runtime updates drive the state.

##### 6. `src/utils/camera-utils.ts`

- Mirror the Electron resolution order exactly.
- Delete the legacy empty-URL custom-camera OEM branch.

##### 7. Stream reconciliation

Files:

- `src/index.ts`
- `src/webui/server/routes/camera-routes.ts`

Standalone already has the cleaner baseline because it uses `hasMatchingStream(...)`. Keep that behavior and align the resolution logic to the new OEM/custom contract.

##### 8. Settings normalization

Files:

- `src/managers/PrinterDetailsManager.ts`
- `src/managers/ConnectionFlowManager.ts`

Standalone already has sanitization hooks. This is the best place to normalize stale blank enabled custom-camera state without adding a migration job.

##### 9. Optional fixture cleanup

File:

- `data/printer_details.json`

This file currently demonstrates the stale `enabled + blank URL` state. Update it if desired so the repo data stops advertising the deprecated behavior, but this file is not the runtime migration mechanism.

##### 10. Tests

Standalone appears to have little existing camera-specific test coverage. Add new tests only where useful after the port is stable.

---

## File-by-File Change Summary

This section is the condensed implementation checklist.

### `ff-5mp-api-ts`

| File | Change |
|------|--------|
| `src/FiveMClient.ts` | Cache `cameraStreamUrl` from `MachineInfo` |
| `src/FiveMClient.test.ts` | Add cached camera URL coverage |
| `src/models/MachineInfo.test.ts` | Keep camera field mapping covered |
| `package.json` | Publish/version update if needed |

### FlashForgeUI-Electron

| File | Change |
|------|--------|
| `package.json` | Consume updated ff-api |
| `src/shared/types/printer-backend/printer-features.ts` | Replace `builtin` with `oemStreamUrl` |
| `src/main/printer-backends/BasePrinterBackend.ts` | New availability semantics, normalization, runtime camera updates |
| `src/main/printer-backends/DualAPIBackend.ts` | Feed runtime `CameraStreamUrl` into backend features |
| `src/main/printer-backends/Adventurer5MBackend.ts` | Remove model-based camera gating |
| `src/main/printer-backends/AD5XBackend.ts` | Remove model-based camera gating |
| `src/main/printer-backends/Adventurer5MProBackend.ts` | Remove 5M Pro special-case gating |
| `src/main/printer-backends/GenericLegacyBackend.ts` | Adapt camera feature shape |
| `src/main/utils/camera-utils.ts` | Resolve custom URL first, OEM URL second, no blank-URL OEM hack |
| `src/main/services/CameraStreamCoordinator.ts` | Centralized stream reconciliation helper |
| `src/main/ipc/camera-ipc-handler.ts` | Ensure matching stream on demand |
| `src/main/webui/server/routes/camera-routes.ts` | Use shared coordinator and matching-stream checks |
| `src/main/managers/PrinterDetailsManager.ts` | Normalize stale blank custom camera state on load/save |
| `src/main/managers/ConnectionFlowManager.ts` | Normalize stale state when reconnecting/updating printer details |
| `src/main/ipc/handlers/printer-settings-handlers.ts` | Normalize on settings update/get flows |
| `src/shared/utils/printerSettingsDefaults.ts` | Shared normalization helper |
| `src/renderer/src/ui/settings/settings.html` | Rename and clarify custom camera setting |
| `src/renderer/src/ui/settings/settings-renderer.ts` | Match the updated copy and behavior |
| Camera tests | Rewrite old behavior assertions |
| `docs/README.md` | Remove OEM-camera workaround docs |
| `README.md` | Remove OEM-camera workaround docs if present |

### FlashForgeWebUI

| File | Change |
|------|--------|
| `package.json` | Consume updated ff-api |
| `src/types/printer-backend/printer-features.ts` | Mirror Electron feature shape |
| `src/printer-backends/BasePrinterBackend.ts` | Mirror Electron availability semantics |
| `src/printer-backends/DualAPIBackend.ts` | Mirror runtime `CameraStreamUrl` ingestion |
| `src/printer-backends/Adventurer5MBackend.ts` | Remove model-based camera gating |
| `src/printer-backends/AD5XBackend.ts` | Remove model-based camera gating |
| `src/printer-backends/Adventurer5MProBackend.ts` | Remove 5M Pro special-case gating |
| `src/printer-backends/GenericLegacyBackend.ts` | Adapt feature shape |
| `src/utils/camera-utils.ts` | Mirror new resolution order |
| `src/index.ts` | Keep stream reconciliation aligned with new semantics |
| `src/webui/server/routes/camera-routes.ts` | Match Electron's final route semantics |
| `src/managers/PrinterDetailsManager.ts` | Normalize stale blank custom camera state |
| `src/managers/ConnectionFlowManager.ts` | Preserve explicit custom URLs, drop blank enabled state |
| `data/printer_details.json` | Optional fixture cleanup |

---

## Testing Strategy

### Core Behavior Matrix

The following cases must pass in both Electron and standalone:

| Scenario | Expected Result |
|----------|-----------------|
| 5M Pro with OEM camera enabled, no custom settings | Camera auto-detected |
| 5M with OEM camera installed and enabled, no custom settings | Camera auto-detected |
| AD5X with OEM camera installed and enabled, no custom settings | Camera auto-detected |
| Any supported printer with no OEM camera stream and no custom URL | Camera unavailable |
| Custom RTSP/HTTP camera enabled with valid URL | Custom camera used |
| Custom camera enabled with blank URL from old config | Normalized off; OEM detection used if present |
| Custom camera enabled with invalid non-empty URL | Camera unavailable; no silent OEM fallback |
| OEM camera disabled in printer firmware | Camera unavailable |

### Surface Parity Checks

Each scenario above must be validated across:

1. Electron desktop preview
2. Electron built-in WebUI
3. Standalone FlashForgeWebUI

### Test Focus Areas

#### Unit Tests

- Camera settings normalization
- Camera resolution order
- Feature availability logic
- Stream reconciliation when the resolved URL changes

#### Integration Tests

- Runtime camera state updates from `/detail`
- Desktop stream creation on demand
- Built-in WebUI route behavior using matching-stream logic
- Standalone parity with Electron

#### Manual Tests

1. Connect a 5M Pro with OEM camera enabled and confirm zero user settings required.
2. Connect an AD5X with official camera installed and confirm it behaves the same way.
3. Start from a stale saved config containing `customCameraEnabled: true` and `customCameraUrl: ""`.
4. Confirm the UI no longer presents the official camera as a `Custom Camera` use case.
5. Disable the camera on the printer and confirm the app simply shows unavailable.

---

## Documentation Changes

Required doc cleanup is part of the implementation, not a later optional task.

### In-Repo

- Update `docs/README.md`
- Update `README.md` if it mentions the workaround
- Update renderer settings copy

### External

- Update the GitHub wiki page `Custom-Camera-Setup.md`

New doc message:

- Official FlashForge camera on 5M Pro / 5M / AD5X should be detected automatically when enabled on the printer.
- `Custom Camera` is only for third-party or otherwise manual camera URLs.

---

## Rollout Notes

1. Update `ff-5mp-api-ts` first.
2. Consume that update in Electron and finish the full refactor there.
3. Port the same semantics into standalone with as little divergence as possible.
4. Update docs only after behavior is implemented.

Implementation should bias toward keeping Electron and standalone code nearly text-identical for camera resolution, normalization, and stream coordination.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Type ripple from removing `camera.builtin` | Medium | Update all camera feature consumers in one pass |
| Desktop path still relying on connect-time stream creation | High | Introduce shared coordinator and ensure-on-demand logic |
| Electron and standalone drifting again | High | Port identical semantics and helper structure |
| ff-api version skew between repos | Medium | Align dependency before app-level refactor |
| Old docs continuing to recommend workaround | Medium | Update docs and wiki as part of rollout |

---

## Optional Follow-Up Work

These are not required for the main refactor:

1. Correct `ff-5mp-api-ts` camera on/off helper gating so it is not artificially restricted to Pro models.
2. Add more explicit UI messaging when a custom URL is invalid.
3. If desired later, add richer live-refresh behavior for hot-plug or camera enable/disable changes while the app is already connected.

---

## Final Implementation Principle

The important architectural rule is simple:

- Official FlashForge camera support must be inferred from what the printer is reporting right now, not from what the app believes that printer model usually ships with.

That single change removes the current support issue, eliminates the misleading `Custom Camera` workaround, and keeps the entire FlashForgeUI ecosystem aligned with real firmware behavior.

---

**Status: APPROVED** - Ready for implementation.
