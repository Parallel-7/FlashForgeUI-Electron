# Blueprint: Set an AD5X IFS slot's material/color from a Spoolman spool

**Status:** not implemented here yet — this is a porting guide.
**Origin:** pioneered in the Android app (`flashforgeui-app`); this is the backport.
**Difference from Android:** Android scans an NFC-tagged spool. Here there's no NFC, so the user
**picks a spool from a list** (the existing Spoolman spool selector) instead.

---

## 1. What we're building

On the AD5X IFS slot editor, add a **"Set from Spoolman"** affordance. The flow:

1. User opens a slot's editor and taps **Set from Spoolman**.
2. A **spool picker** opens — a searchable list of the user's Spoolman spools (reuse the existing
   spool-selection UI; see §4).
3. User picks a spool. We read its `material` + `color_hex` from Spoolman.
4. We **snap** those to the printer's fixed lists (see §3) — the AD5X only renders 14 known
   materials and 24 known colors; arbitrary values won't draw an icon on the printer screen.
5. We **apply** them to the slot via the slot-config command (`msConfig_cmd`; see §5 — this command
   is a prerequisite that must be backported first).
6. Show what matched ("Slot 2 → PLA · Red, from <spool name>"), then refresh the station.

Gate the whole affordance on **Spoolman being enabled/configured**. AD5X-only (IFS).

---

## 2. Reference implementation (Android)

Port the logic from these files in `flashforgeui-app`:

- `app/src/main/java/me/ghost/ffui/ui/components/IfsPalette.kt` — the palette + `nearestColor`
  (CIEDE2000) + `nearestMaterial`. **This is the core reusable piece.**
- `app/src/test/java/me/ghost/ffui/ui/components/IfsPaletteMatchingTest.kt` — the test cases to
  re-port (all 24 swatches + live-Spoolman fixtures + material mappings).
- `app/src/main/java/me/ghost/ffui/ui/dashboard/SlotEditorSheet.kt` — the scan→resolve→match→apply
  state machine (swap the NFC trigger for the spool picker).

Authoritative wire/data reference: `flashforge-api-docs/docs-wiki/AD5X-IFS-Material-Station.md`
(the 24 colors, 14 materials, and the `msConfig_cmd` payload all come from here).

---

## 3. Core logic to port: the palette + nearest-match

Create one small, framework-agnostic module (pure TS, no DOM/Electron deps) — e.g.
`ifs-palette.ts`. It holds the fixed lists and two pure functions.

### 3a. The fixed lists (exact — do not edit; from the API docs)

**Materials (14):**
```
PLA, PLA-CF, PETG, PETG-CF, ABS, TPU, SILK, PA, PA-CF, PAHT-CF, PC, PC-ABS, PET-CF, PPS-CF
```

**Colors (24) — name → hex:**
```
White #FFFFFF       Yellow #FEF043      Light Green #DCF478  Green #0ACC38
Dark Green #067749  Teal #0C6283        Cyan #0DE2A0         Light Blue #75D9F3
Blue #45A8F9        Dark Blue #2750E0   Purple #46328E       Violet #A03CF7
Magenta #F330F9     Pink #D4B0DC        Coral #F95D73        Red #F72224
Brown #7C4B00       Orange #F98D33      Cream #FDEBD5        Tan #D3C4A3
Dark Brown #AF7836  Gray #898989        Light Gray #BCBCBC   Black #161616
```

### 3b. `nearestColor(hex) → PaletteColor | null`

Snap an arbitrary `#RRGGBB` (also accept `RRGGBB` and `RRGGBBAA` — drop alpha) to the nearest of
the 24 swatches using **CIEDE2000** distance (not plain Euclidean Lab / ΔE76).

> **Why CIEDE2000, not ΔE76:** ΔE76 mismatches the saturated blue/red regions. On the live Spoolman
> library it mapped pure blue `#0000FF` → **Violet** and burgundy `#951e23` → **Coral**. CIEDE2000
> fixes both (`#0000FF` → **Dark Blue**, `#951e23` → **Red**). Verified against real data; the math
> is ~microseconds so there's no perf reason to cut the corner.

Pipeline: parse hex → linearize sRGB → XYZ (D65) → CIELAB → CIEDE2000 vs each precomputed palette
Lab → argmin. Precompute the 24 palette Lab values once. Return `null` if the hex can't be parsed.
(Port the exact `hexToLab` + `ciede2000` from `IfsPalette.kt`; the Kotlin is plain `Math.*` and
translates 1:1 to TS `Math.*`.)

### 3c. `nearestMaterial(raw) → string | null`

1. **Exact** match on the whole normalized string (uppercase, strip non-alphanumerics) — so
   `"PLA-CF"`, `"petg-cf"`, `"PLA+"` resolve to `PLA-CF` / `PETG-CF` / `PLA`.
2. Else match the **leading token** (before the first space): `"PLA Matte"` → `PLA`,
   `"PETG-CF Pro"` → `PETG-CF`.
3. Else `null` → the caller **keeps the slot's current material**.

> **Why leading-token, not longest-prefix:** a prefix rule wrongly snaps `"PCTG"` → `PC` and
> `"PA6"` → `PA` (chemically unrelated). Leading-token lets those fall through to `null` instead.

---

## 4. Data plumbing (already present in this repo)

- **Fetch one spool:** `SpoolmanService.getSpoolById(spoolId)` already exists. Use it (or the
  already-loaded list item) to get `{ filament: { material, color_hex, multi_color_hexes, name } }`.
  Prefer `color_hex`; fall back to the first of `multi_color_hexes`. If neither, surface an error
  ("spool has no color in Spoolman").
- **Spool list / picker UI:** the Spoolman feature already renders/selects spools (Electron:
  `window.api.spoolman.openSpoolSelection()` in `ifs-station.ts`/`spoolman.ts`; WebUI: the
  `spoolman` static feature + `spoolman-routes`). Reuse that selector as the picker rather than
  building a new one.

---

## 5. PREREQUISITE — the slot-config command must be backported first

The apply step needs `msConfig_cmd` (set a slot's material + color). **It does not exist in
`ff-5mp-api-ts` yet** (verified: no `msConfig_cmd`/`ms_cmd` anywhere in this repo or the library).
It currently lives only in `ff-5mp-api-kt` (`FlashForgeHttpApi.configureSlot` /
`AD5XBackend.setSlotMaterial`).

See **`ff-5mp-api-ts/docs/BACKPORT-FROM-KT.md`** — port `configureSlot` (msConfig_cmd) + `slotAction`
(ms_cmd) there first, then this feature can call it. Wire payload is in
`AD5X-IFS-Material-Station.md` (`POST /control`, `cmd: "msConfig_cmd"`, `args: { slot, mt, rgb }`
where `rgb` is hex **without** `#`). As a stopgap you could POST that `/control` body directly from
the app backend, but adding it to the library is the right home.

---

## 6. Per-project placement

**FlashForgeUI-Electron:**
- Palette/match util: `src/shared/` (pure, importable by main + renderer).
- Apply path: an IPC handler near `src/main/ipc/handlers/material-handlers.ts` calling the
  (backported) slot-config command.
- UI: the "Set from Spoolman" button + picker wiring in
  `src/renderer/src/ui/components/ifs-station/ifs-station.ts`.

**FlashForgeWebUI:**
- Palette/match util: a static module under `src/webui/static/` (browser) — or `src/shared` if one
  exists — imported by the IFS feature.
- Apply path: a server route near `src/webui/server/routes/spoolman-routes.ts` (or the material
  route) calling the slot-config command.
- UI: extend the IFS rendering in `src/webui/static/features/` with the button + picker modal.

---

## 7. Tests

Port `IfsPaletteMatchingTest` to Jest:
- Each of the 24 swatches resolves to itself; a small (±6) neighborhood snaps back to it.
- Synthetic primaries (`#FF0000`→Red, `#0000FF`→**Dark Blue**, `#00FFFF`→Light Blue, …).
- Live-Spoolman fixtures (e.g. `#0000FF`→Dark Blue, `#951e23`→Red, `#6c4f4c`→Brown).
- `nearestMaterial`: `"PLA Matte"`→PLA, `"PETG-CF Pro"`→PETG-CF, `"PCTG"`/`"PA6"`/`"Nylon"`→null.

---

## 8. Notes

- Matching is **microseconds** — never the bottleneck. Any post-apply lag is network (Spoolman
  fetch + printer write), so there's nothing to optimize in the math.
- Auto-apply vs. confirm-first is a UX call; Android auto-applies after the pick. A confirm step
  (showing the snapped swatch before writing) is reasonable for a desktop/web picker.
