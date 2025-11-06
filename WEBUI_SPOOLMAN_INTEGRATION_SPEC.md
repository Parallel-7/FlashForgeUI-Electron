# WebUI Spoolman Integration Specification

**Created:** 2025-11-04  
**Status:** Ready for Implementation  
**Scope Owners:** WebUI team, Backend services team  
**Related Docs:** `ai_specs/SPOOLMAN_INTEGRATION_SPEC.md`, `CLAUDE.md`, `ai_reference/ARCHITECTURE.md`

---

## Executive Summary

Deliver desktop-quality Spoolman filament tracking inside the WebUI while maintaining headless compatibility and context isolation. The integration must respect the current single-spool limitation (one active spool per printer context) and automatically disable itself for AD5X printers to prevent incorrect multi-color usage. The effort spans REST APIs, ConfigManager persistence, WebSocket synchronization, and a dedicated WebUI component with Lucide-based visuals.

---

## Requirements & Constraints

- **Single active spool per context**: One spool selection for each printer context. No per-tool mapping until backend usage data supports it.
- **AD5X protection**: Automatically treat AD5X contexts as unsupported. UI shows the disabled state with explanatory copy; backend rejects mutations to preserve user data.
- **Persistence**: Active spool selections must survive restarts using ConfigManager storage.
- **Parity with desktop**: Selections propagate in both directions. Desktop print-complete flows update remaining filament and the WebUI reflects changes.
- **Headless-ready**: The design cannot rely on BrowserWindow or IPC. REST + WebSocket are the only interfaces.
- **Security**: Leverage existing WebUI auth middleware. No unauthenticated endpoints.
- **UX**: Component is always present in component lists. Use Lucide icons (no emoji) and ensure responsive layout on mobile breakpoints.

---

## Architecture Overview

### State Persistence

- Extend `AppConfig` with `SpoolmanActiveSpools: Record<string, ActiveSpoolData | null>`.
- Implement `SpoolmanIntegrationService` in the main process to encapsulate persistence and Spoolman REST access.
- `PrinterContextManager` no longer stores raw spool fields; it uses the integration service and emits `spoolman-changed` events on state updates.
- ConfigManager handles serialization/deserialization via existing `updateConfig`/`sanitizeConfig` logic.

### Backend Surface

- Introduce `createSpoolmanRoutes()` (mounted by `createAPIRoutes()`) with the following endpoints:
  - `GET /api/spoolman/config` → returns `enabled`, optional `disabledReason`, `serverUrl`, `updateMode`, `activeContextId`.
  - `GET /api/spoolman/spools?search=` → proxies search requests to Spoolman; returns up to 50 results (non-archived by default).
  - `GET /api/spoolman/active/:contextId` → returns the stored active spool or null.
  - `POST /api/spoolman/select` → sets the active spool for the requested or active context.
  - `DELETE /api/spoolman/select` → clears the active spool for the requested or active context.
- Every handler runs under WebUI auth, confirms Spoolman global enablement, verifies context existence, and enforces AD5X disablement (HTTP 409 with message).
- Define request/response interfaces in `src/webui/types/web-api.types.ts` and validation schemas in `src/webui/schemas/web-api.schemas.ts`.

### WebSocket Synchronization

- `SpoolmanIntegrationService` (or `PrinterContextManager`) emits `spoolman-changed` with `{ contextId, spool }`.
- `WebSocketManager` subscribes and broadcasts a `SPOOLMAN_UPDATE` message (new discriminated message type).
- WebUI client listens and triggers `loadActiveSpool()` when the event matches the current context.

### AD5X Detection & Disablement

- Detection heuristics:
  - `backendManager.getFeatures(contextId).materialStation.available === true`, or
  - Printer model string begins with `AD5`.
- If detected:
  - REST config endpoint responds with `enabled: false` and `disabledReason`.
  - Select/clear endpoints reject with HTTP 409.
  - WebSocket updates never broadcast spool changes for that context.
- Persisted data for AD5X contexts remains untouched (no deletion) to avoid accidental data loss if the user switches printer types.

### Frontend Component

- Add `spoolman-selector` to `WebUIComponentRegistry` with:
  - Default layout `(x:0, y:9, w:6, h:3)` and min `(w:4, h:2)`.
  - Template containing three states (disabled, no spool, active spool) with `data-lucide` icons.
  - Color chip representing `ActiveSpoolData.colorHex` and textual metadata (vendor/material/remaining weight).
- Include component in default layout and mobile order (after controls).
- Settings modal gains a “Spoolman Tracker” checkbox (checked by default).
- Modal markup in `index.html` for spool selection: searchable list, single-select, “Clear active spool” action, `aria` attributes for accessibility.
- CSS in `webui.css`: follow panel styling, ensure responsive layout for ≤480px widths.

### Frontend Logic (app.ts)

- Maintain local state: `{ enabled, disabledReason, serverUrl, updateMode, currentSpool }`.
- Extend bootstrap sequence:
  1. After authentication → call `loadSpoolmanConfig()`.
  2. After `switchPrinterContext` → reload config + active spool.
  3. When WebSocket reconnects → refresh active spool.
- Register WebSocket handler for `SPOOLMAN_UPDATE`.
- Implement modal flows:
  - Search field debounced to `/api/spoolman/spools?search=`.
  - Selecting a result sends `POST /api/spoolman/select`.
  - Clearing spool uses DELETE.
  - Toast feedback on success/failure.
- If `disabledReason` present → show in disabled card, disable buttons, and guide user to desktop settings.
- After DOM updates, call `hydrateLucideIcons([...])` to ensure icons render.

### Headless Mode

- `HeadlessManager` initializes the integration service (no renderer dependencies).
- Headless runs rely solely on REST endpoints; log a clear message when AD5X support is disallowed.
- Ensure `SpoolmanService` continues using `fetch`/`node-fetch` (no Electron `net`).

---

## Implementation Plan

1. **Integration Service & Config Schema**
   - Create `src/services/SpoolmanIntegrationService.ts`.
   - Update `AppConfig`, `MutableAppConfig`, `DEFAULT_CONFIG`, and sanitizers with `SpoolmanActiveSpools`.
   - Provide `getActiveSpool`, `setActiveSpool`, `clearActiveSpool`, `isContextSupported`, `fetchSpools`.

2. **PrinterContextManager Refactor**
   - Remove internal `activeSpoolId` fields; delegate to integration service.
   - Emit `spoolman-changed` events on updates.
   - Adjust IPC handlers (`src/ipc/handlers/spoolman-handlers.ts`) to use the new service.

3. **REST Endpoints**
   - Implement `createSpoolmanRoutes()` with robust error handling and logging.
   - Mount under `/api/spoolman` post-auth in `createAPIRoutes()`.
   - Add new types/schemas for requests & responses.

4. **WebSocket Enhancements**
   - Extend message type union to include `SPOOLMAN_UPDATE`.
  - Broadcast updates when integration service reports changes (skipping AD5X contexts).

5. **Frontend Component & Layout**
   - Register component template, default layout, mobile order.
   - Update settings modal to include toggle.
   - Add modal HTML and CSS.

6. **Frontend State & UX**
   - Implement fetch helpers, modal logic, WebSocket handling, AD5X guardrails.
   - Ensure icons are hydrated after dynamic updates.

7. **Headless Validation**
   - Confirm headless startup logs integration status.
   - Manual curl tests against REST endpoints.

8. **Documentation & Cleanup**
   - Ensure `@fileoverview` blocks stay accurate.
   - Update any references in `ai_reference` if necessary.

9. **Verification**
   - `npm run type-check`
   - `npm run lint`
   - Manual smoke test matrix (see below).

---

## REST & WebSocket Contracts

| Route | Method | Request | Response | Notes |
| --- | --- | --- | --- | --- |
| `/api/spoolman/config` | GET | – | `{ success, enabled, disabledReason?, serverUrl, updateMode, contextId }` | `enabled` false with reason for AD5X or globally disabled integration. |
| `/api/spoolman/spools` | GET | `?search` optional | `{ success, spools: SpoolSummary[] }` | Limit 50; filter archived spools by default. |
| `/api/spoolman/active/:contextId` | GET | path param | `{ success, spool: ActiveSpoolData | null }` | Returns 409 if context unsupported (AD5X). |
| `/api/spoolman/select` | POST | `{ contextId?, spoolId }` | `{ success, spool }` | Resolves spool details before persistence. |
| `/api/spoolman/select` | DELETE | `{ contextId? }` | `{ success }` | Clears selection; rejects AD5X contexts. |

WebSocket message:  
`{ type: 'SPOOLMAN_UPDATE', contextId: string, spool: ActiveSpoolData | null }`

`ActiveSpoolData` fields: `id, name, vendor, material, colorHex, remainingWeight, remainingLength, lastUpdated`.

---

## Manual Test Matrix

- Enable Spoolman on desktop, select spool → WebUI shows active state.
- Select spool via WebUI → desktop dialog receives update.
- Print completion updates spool usage (remaining weight decreases).
- Multi-printer switching keeps spool data isolated per context.
- AD5X printer: component stays disabled, REST endpoints reject modifications, existing config unchanged.
- Headless mode: REST calls succeed, WebSocket updates broadcast to WebUI clients.
- Error handling: invalid Spoolman URL surfaces a user-friendly toast and logs server error.
- Mobile viewport (<768px) renders component stacked and accessible.
- Persistence: restart application → spool selection persists for non-AD5X printers.

---

## Open Questions

1. Is 50-result limit sufficient for spool search, or should pagination be introduced?
2. Any localization requirements for new UI copy?
3. Should analytics/telemetry capture spool selection events?

Address before implementation if product owners require changes; otherwise proceed with defaults (50 results, English strings, no telemetry).

---

## Deliverables

- `SpoolmanIntegrationService` with persisted state management.
- Updated ConfigManager schema and migrations.
- `/api/spoolman/*` REST endpoints with validation and logging.
- WebSocket broadcast for spool changes.
- WebUI component, modal, styling, and logic updates.
- Documentation updates and refreshed spec (this document).
- Validation evidence: type-check, lint, and manual test checklist.

---

**Ready for hand-off.** This specification captures the architecture, contracts, UX, and guardrails required for the next implementation phase.*** End Patch
