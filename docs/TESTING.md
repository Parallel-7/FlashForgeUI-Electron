# Testing Guide

**Last Updated:** 2026-08-14

This document describes every automated test surface in FlashForgeUI, what each one
actually proves, and where the gaps are. Read it before adding tests so new coverage
lands on the right surface, and before trusting a green run to mean "this works."

---

## The Four Surfaces

| Surface | Runner | Command | Needs | In CI |
| --- | --- | --- | --- | --- |
| Unit / integration | Jest | `pnpm test` | nothing | yes |
| WebUI browser E2E | Playwright (chromium) | `pnpm test:e2e` | emulator + Electron | yes |
| Electron E2E — **emulator track** | Playwright (`_electron`) | `pnpm test:e2e:electron:emulator` | `flashforge-emulator-v2` checkout | yes |
| Electron E2E — **hardware track** | Playwright (`_electron`) | `pnpm test:e2e:electron:hardware` | real printers on the LAN | no (impossible) |
| Discord webhook (hardware) | Playwright (`_electron`) | `pnpm test:e2e:electron:discord` | real AD5X + webhook relay | no |

`pnpm type-check` covers **both** `tsconfig.json` (`src/`) and `tsconfig.e2e.json`
(`tests/` + both Playwright configs). This matters: before the e2e tsconfig was wired
in, the Electron suite rotted for months without a single type error surfacing.

---

## Track Selection

The Electron suite has one set of spec files serving two tracks. The track is chosen
by a single environment variable read in `tests/e2e/electron/support/track.ts`:

```
FFUI_E2E_TRACK=emulator   # default — boots flashforge-emulator-v2 instances
FFUI_E2E_TRACK=hardware   # drives the real printers on the developer's bench
```

The runner scripts set it for you; you should never need to export it by hand.

Specs never fork on the track name. They parameterize over **target descriptors** and
branch on *capabilities*:

- `hasMaterialStation` — AD5X / Creator 5 raise the material matching dialog
- `supportsSftp` — only real EasySSH-provisioned printers have an SSH server
- `supportsManualConnect` — see the port note below

A track with nothing to run reports a **skip reason** rather than silently passing with
zero tests (`describeTrackSkipReason()`).

### Why `supportsManualConnect` exists

The manual connect form collects IP + type + serial + check code but no ports, so it
always dials the firmware defaults `8899`/`8898`. Real printers always listen there.
The HTTP-only Creator 5 series answers on those same defaults in the single-printer
specs, so manual connect applies to it as well.
Only one emulator instance per machine can, so the multi-printer descriptors shift
every instance after the first by +100 per position (`8999`/`8998`, then
`9099`/`9098`, …). Shifted instances stay
reachable by discovery and by a seeded profile — both carry explicit ports — but not by
the manual form, so that one case skips itself with an explanatory message.

---

## Emulator Track

**Command:** `pnpm test:e2e:electron:emulator` (builds first, then runs
`tests/e2e/electron/specs`)

**Printers:** four models, one instance booted per printer describe block, from
[`flashforge-emulator-v2`](https://github.com/GhostTypes/flashforge-emulator-v2):

| Label | Model | Serial | Ports | Material station |
| --- | --- | --- | --- | --- |
| Adventurer 5M Pro (emulated) | `adventurer-5m-pro` | `E2E-SN-5MPRO` | 8899 / 8898 | no |
| AD5X (emulated) | `adventurer-5x` | `E2E-SN-AD5X` | 8899 / 8898 | yes |
| Creator 5 (emulated) | `creator-5` | `E2E-SN-CREATOR5` | 8899 / 8898 | yes |
| Creator 5 Pro (emulated) | `creator-5-pro` | `E2E-SN-CREATOR5PRO` | 8899 / 8898 | yes |

Check code is `123`. Simulation runs in `manual` mode so nothing advances on its own.

The Creator 5 series instances are **HTTP-only**: the emulator binds no TCP server for
them, neither on the defaults nor on the shifted multi-printer ports. It still
advertises a `tcpPort` in discovery, because real Creator 5 firmware does the same and
the suite must see the real behavior, not a tidied-up one. This needs the emulator
commit that added the models (`6563d9f`); older checkouts reject them.

**Emulator location:** defaults to `../flashforge-emulator-v2` beside this checkout;
override with `FF_EMULATOR_ROOT`. CI checks the public repo out into `emulator/`.

**Current size:** 31 tests run + 2 conditional skips (33 collected), ~6 minutes,
one worker.

### Process-group teardown (do not "simplify" this)

`emulator-harness.ts` spawns `npm run headless:instance`, so the process that actually
binds the printer ports is a **grandchild** (npm → tsx). npm does not forward `SIGTERM`
to it. Signalling the child alone leaves the grandchild alive still holding 8899/8898,
and the next describe dies with `EADDRINUSE`.

The harness therefore spawns `detached` on POSIX and signals the whole process group
via `process.kill(-pid, …)`. Windows has no process groups and uses `taskkill /T`
instead, which is why this bug was invisible locally and only appeared on the first CI
run.

---

## Hardware Track

**Command:** `pnpm test:e2e:electron:hardware`

Same specs, real printers. Cannot run in CI — it needs printers on the LAN.

### Credential resolution

Deliberately **outside** the working tree so they can never be committed even if
`.gitignore` is wrong. In order:

1. `$FFUI_E2E_HARDWARE_CONFIG` — explicit path to a JSON config
2. `~/.flashforgeui-e2e/hardware-printers.json`
3. The developer's real FlashForgeUI profile (**read-only**), which already holds
   serials and check codes

**IP addresses are never read from any of those.** They resolve live by UDP discovery
keyed on serial, because printer IPs move with DHCP — the bench AD5X moved `.132` →
`.133` between two runs. Serial is the only stable identity a printer has. A
powered-off printer produces "did not answer discovery… discovered instead: …" rather
than a bare timeout mid-test.

### Safety protocol

Uploads always run with **Start Now explicitly unchecked**, and every upload is
followed by `assertNotPrinting()`, which reads `/detail` back and — if a print somehow
started — cancels it, waits, and sends Clear Platform to return the printer to a
controllable state. That path should never fire; if it does, the test fails loudly.
Uploaded fixtures are removed in `afterEach` so hardware runs leave no residue.

### Profile isolation

Every launch gets a fresh temp `userData` via `FFUI_USER_DATA_DIR`, and
`launchFFUI()` asserts the app *honored* it before any test touches the UI. If the app
ignored the variable the run would mutate the developer's real `%APPDATA%/FlashForgeUI`
profile, so it refuses to continue. **Do not relax that assertion.**

---

## What The Tracks Test

### `specs/connect.spec.ts` — 3 tests per printer

- **Saved-printer auto-connect** — seeded `printer_details.json`, app connects on boot,
  dashboard renders, tab carries the printer's name
- **Network discovery** — open connect flow → scan → match the row **by serial** (the
  only identity that survives DHCP) → connect
- **Manual connect** — the regression net for 1.0.5-alpha.9. A named printer type skips
  the TCP probe, so the form must supply the serial and check code the discovery
  broadcast would have carried, and must use the check code it collected **without a
  second prompt**. Also asserts modern types require credentials and legacy does not.

### `specs/upload.spec.ts` — 2 tests per printer

- **Upload without starting a print** — the regression net for the 1.0.5-alpha.10
  hotfix, where pressing OK threw `ReferenceError: isAD5X is not defined` and silently
  uploaded nothing. A test that only checked the dialog rendered would have missed it,
  because the failure was in the confirm handler. So the assertion is that the file
  **actually landed on the printer**, verified out of band.
- **Material matching dialog rules** — appears for every 3MF on a material-station
  printer (single filament included, since each tool must still be bound to a slot);
  must **never** appear on 5M-series. Requirement-row count matches the filament count
  the parser reported.

Out-of-band verification reads `/gcodeList` through the test client. The client prefers
`gcodeListDetail` and falls back to bare `gcodeList` names when that field is absent.
Real Creator 5 firmware returns names only, and the emulator matches that shape, so the
same assertion verifies uploads against both response shapes.

Fixtures are real slicer output (`tests/fixtures/print-files/`), not synthetic stubs,
because the upload path parses embedded metadata and per-tool filament data. Their
tool counts were read from the parser, not from upstream file names — those names are
actively misleading.

### `specs/led.spec.ts` — 1 test per printer

On → off → on, with every assertion reading `lightStatus` back from the printer's own
`/detail` endpoint rather than the button's rendered state. A button that toggles its
own styling while the command never reaches the printer is exactly the failure this
catches, so trusting the UI here would defeat the purpose. Ends with the LED back on.

### `specs/creator5-gating.spec.ts` — 1 test per printer, +1 Creator 5-only

Pins the Creator 5 series gating contract from commit `58717fb`. Creator 5 / Creator 5
Pro firmware cannot exchange material mappings over the local API, so starting a local
or recent job dead-ends at material selection. On the series, the renderer disables
`#btn-start-recent` and `#btn-start-local` with the title `Disabled: Local job
management is not available on this printer.` Every other model keeps both enabled.
A Creator 5-only test also pins `#btn-home-axes` as disabled with a title matching
`Disabled: G-code unavailable` — the series is HTTP-only and offers no G-code
passthrough. That second test skips itself on the other two printers, which is exactly
where the run's two conditional skips come from.

The spec paid for itself on its first run by catching two real bugs:

- `BasePrinterBackend.buildFeatureSet()` hardcoded `gcodeCommands` and
  `statusMonitoring` as always available, and silently discarded the child backend's
  own declarations. `Creator5Backend`'s `available: false` never reached the renderer.
- The renderer's `gcodeAvailable` only propagated through `backend-initialized`, whose
  `contextId` guard dropped the boot-time payload — the context event that sets
  `activeContextId` races it. `modelType` traveled via context events and was correct;
  `gcodeAvailable` was not.

### `specs/multi-printer.spec.ts` — 1 test

Two printers connected simultaneously, each in its own context; both tabs report
connected and each carries its own printer's name. This is where cross-talk bugs hide —
one printer's polling updating another's tab, or a context switch leaving stale data.

Follows the real user flow rather than a shortcut: with more than one saved printer the
app raises the auto-connect choice dialog, the user picks one, and the second is added
with the "+" tab button (which itself raises a warning that must be acknowledged).
Seeding two printers and waiting for two tabs would simply hang.

### `specs/sftp-roundtrip.spec.ts` — hardware only

Upload through the GUI → find it in the SFTP file manager → delete it there → confirm
it is gone from the printer itself, not just from the dialog's rendering. Proves the
whole SSH stack: credentials from `SSHSettingsService`, pooled connection per context,
listing and delete both over SFTP. Skipped on the emulator track, which runs no SSH
server.

### `discord-hardware.spec.ts` — hardware only, separate runner

Lives outside `specs/` so the emulator runner never collects it. Drives a real AD5X
with a local webhook relay and asserts the Discord payload — including camera snapshots
— matches what the UI is showing. Needs `FFUI_E2E_AD5X_IP` + `FFUI_E2E_AD5X_CHECK_CODE`.

### Cross-cutting: renderer error guard

Every Electron test ends with `assertNoRendererErrors()`, which fails the test on any
`pageerror` or `console.error` from **any** window (allowlisting only Electron's
built-in Autofill noise). This is what turns "the UI looked fine" into a real
assertion, and it is how a silent `ReferenceError` in a confirm handler gets caught.

---

## Unit / Integration (Jest)

55 suites, ~1,880 tests, `src/**/__tests__/`. Node environment, ts-jest. `electron-log`
is mocked so tests can never write to the real user-profile log.

Heaviest coverage:

- **WebUI server** (14 suites) — AuthManager, WebSocketManager, WebUIManager,
  CameraStreamProxy, security middleware, static asset options, and every route module
- **Calibration** (8 suites) — FFT processing, shaper analysis, bed/screw solving,
  Klipper config parsing, deviation analysis, workflow engine
- **Services** (12 suites) — connection establishment, polling coordination, discovery,
  data transformation, SSH settings, Go2rtc, saved printers
- **WebUI static client** (9 suites) — Transport, authentication, camera,
  context-switching, Spoolman, icons, palette, formatting
- **Shared** — material colour matching (CIEDE2000), palettes, printer settings defaults

---

## WebUI Browser E2E (Playwright)

`tests/e2e/browser/`, 8 tests, ~20 seconds. Runs in the CI `e2e` job.

**There is no fixture server and nothing is stubbed.** `startHeadlessWebUI()` boots
emulator printers, seeds an isolated profile, launches the real app with
`--headless --all-saved-printers`, and waits for the WebUI server *the app itself*
starts. Every response comes from the production stack: real `createAPIRoutes`, real
`AuthManager` and auth middleware, real security and static-asset middleware, real
`WebSocketManager` broadcasting real polling data from the emulated printers.

This also gives headless mode its only end-to-end coverage.

| Test | Proves |
| --- | --- |
| rejects a bad password | the real `AuthManager` refuses it and the UI stays locked with no token stored |
| logs in / remembers token | dashboard appears, `#connection-text` reads `Connected` (so the websocket passed the real auth gate), and the stored token is accepted by the real auth middleware |
| restores the session | a remembered token survives reload with no second prompt |
| refuses API access | anonymous and forged tokens both get a real 401 |
| revokes on logout | a logged-out token stops working — a real security property the fixture never implemented |
| versioned assets | every local `<link>`/`<script>` is `?v=`-stamped, including the inline `video-rtc.js` import; no icon-hydration or camera-bootstrap console errors; no `proxy-config` request when no camera exists |
| serves every asset | no response ≥400 for anything the page requests — the stale-build symptom, now observable against the real static middleware |
| switches contexts | selecting another printer changes the **server's** `activeContextId`, with exactly one active context afterwards |

### Why it was rebuilt

The previous version ran against a hand-written reimplementation of the API. It could
not catch a single server-side regression, and the fake could drift from the real routes
without any test noticing — which defeats the point of an end-to-end suite.

Verified with a mutation test: breaking `switchContext()` in `context-routes.ts` makes
the context test fail. Under the old fixture that same break was invisible.

### Rules for this suite

- **Never reintroduce a stub for app behaviour.** If a test needs a response, the app
  must produce it. Stubbing is what made the old suite worthless.
- The two spec files each boot their own emulators on **fixed ports**, so
  `playwright.config.ts` pins `workers: 1`. Running them in parallel gives `EADDRINUSE`.
- Emulator `machineName` values **must not contain spaces** — the emulator CLI parses
  argv positionally and splits on them.
- Take tokens from `/api/auth/login` for out-of-band assertions rather than reading
  `localStorage`; the client only persists there when "remember me" is checked.
- Don't assume which printer is active. The app activates the **last** one it connected,
  so pick the switch target from live state or the test proves nothing.

### Windows

The WebUI requires administrator privileges on Windows (it binds a network port), and
headless mode calls `process.exit(1)` instead of prompting. `describeHeadlessSkipReason()`
detects this and skips with an explanation. Run from an elevated terminal locally, or let
CI (Linux, where the check always passes) cover it.

---

## CI Pipeline

`.github/workflows/ci.yml`, on push and PR to `main` and `alpha`:

**Job 1 `verify`** — type-check → lint → build → `pnpm test`

**Job 2 `e2e-emulator`** (`needs: verify`) — checks out the emulator repo, installs both
dependency trees, then runs the Electron emulator track **and** the WebUI browser suite
under `xvfb-run`. The browser step uses `if: success() || failure()` so a failing Electron
track does not hide a failing WebUI one. Playwright traces and reports upload as artifacts
on failure.

Two CI-only details:

- **Electron sandbox helper** — pnpm unpacks `chrome-sandbox` without root ownership,
  so Electron aborts on launch. CI does `chown root` + `chmod 4755` rather than passing
  `--no-sandbox`, keeping launch arguments identical to what users get.
- **`xvfb-run`** — the suite drives a real Electron window and needs a virtual display.

> Both jobs currently **report** status but cannot **block** merges until they are
> marked as required status checks in the repository's branch protection settings.

---

## Gaps

Ordered by what would most likely catch a real regression.

### High value

1. **No print lifecycle coverage.** Nothing starts a job, pauses it, resumes it, or
   cancels it. Start/pause/resume/cancel are the most-used controls in the app and are
   entirely untested end to end. The emulator supports auto simulation mode, which the
   suite currently never uses (`simulationMode: 'manual'` everywhere).
2. **No printer *control* coverage from the WebUI.** The browser suite now runs against
   the real server, but only exercises auth, assets, and context switching. LED,
   temperature, and job control all have real routes and real handlers that no browser
   test drives.
3. **Headless coverage is boot-only.** The browser suite proves headless starts, connects
   saved printers, and serves the WebUI — but nothing covers headless CLI modes
   (`--printers=`, `--last-used`), or its shutdown path.
4. **No temperature control coverage.** Setting bed/extruder targets and confirming the
   printer received them is the same shape as the LED test, which already proved that
   pattern works.
5. **No settings persistence coverage.** Nothing opens the settings dialog, changes a
   value, restarts the app, and confirms it stuck — for either global or per-printer
   settings. Per-printer settings live on `PrinterDetails` and are easy to regress.
6. **Material station state is never asserted.** The upload specs exercise the matching
   *dialog*, but nothing reads the four slots back, changes a material type or colour,
   or verifies the `material:set-slot` IPC path — including the component-dialog preload
   mirroring that has already broken once.

### Medium value

7. **Legacy printers are never exercised.** The emulator supports Adventurer 3 and 4,
   and `track.ts` already maps them to the legacy manual-connect type, but no descriptor
   enables them. The legacy backend and the TCP `M115` probe path are untested.
8. **No camera coverage anywhere.** go2rtc lifecycle, the authenticated
   `CameraStreamProxy`, and WebRTC/MSE negotiation are unit-tested in isolation but
   never driven end to end. The proxy is a security boundary (issue #76), and the browser
   suite now has a real server to drive it against — the missing piece is a camera source
   the emulator can offer.
9. **No grid layout coverage.** Adding, removing, and rearranging widgets, plus layout
    persistence across restarts, is untested — and `gridController.ts` has already
    regressed once with blank tiles and missing delete buttons (issue #77).
10. **No update/notification coverage.** Neither the desktop notification path nor
    electron-updater channel selection is tested.
11. **`removeUploadedFile()` is a no-op on the emulator**, so nothing verifies deletion
    on that track. Emulator state is discarded at teardown, which is fine, but it means
    the delete path is hardware-only.

### Low value / cheap wins

12. **The `#` slot-colour regression can't be covered** because the emulator always
    emits a prefixed colour. Teaching it to emit an unprefixed one would let CI pin
    that fix.
13. **No spec asserts the WebUI and desktop show the same data** for the same printer.
14. **Retries are off and workers are pinned to 1** on both Playwright configs. Correct
    for hardware, and correct for the emulator given fixed ports — but it means one
    flaky network hiccup fails the whole run with no retry.
15. **No coverage thresholds** are enforced in `jest.config.cjs`, so unit coverage can
    silently decline.
