# E2E: The Two Electron Tracks

One set of specs (`tests/e2e/electron/specs/*.spec.ts`), two tracks chosen by
`FFUI_E2E_TRACK` (`tests/e2e/electron/support/track.ts`): `emulator` (default) or
`hardware`. The runner scripts set it; never export it by hand.

Specs never fork on the track name — they parameterize over **target descriptors**
and branch on *capabilities*: `hasMaterialStation`, `supportsSftp` (real
EasySSH-provisioned printers only), `supportsManualConnect` (emulator multi-printer
instances get shifted ports `8999/8998`, `9099/9098`, … which the port-less manual
form cannot dial; it skips itself with an explanation). A track with nothing to run
reports a skip reason via `describeTrackSkipReason()` instead of silently passing.

## Emulator track

Four models from
[flashforge-emulator-v2](https://github.com/GhostTypes/flashforge-emulator-v2),
one instance per printer describe block; check code `123`; `simulationMode: 'manual'`
(nothing advances on its own):

| Label | Model | Serial | Ports | Material station |
| --- | --- | --- | --- | --- |
| Adventurer 5M Pro (emulated) | `adventurer-5m-pro` | `E2E-SN-5MPRO` | 8899 / 8898 | no |
| AD5X (emulated) | `adventurer-5x` | `E2E-SN-AD5X` | 8899 / 8898 | yes |
| Creator 5 (emulated) | `creator-5` | `E2E-SN-CREATOR5` | 8899 / 8898 | yes |
| Creator 5 Pro (emulated) | `creator-5-pro` | `E2E-SN-CREATOR5PRO` | 8899 / 8898 | yes |

Creator 5 instances are HTTP-only (no TCP server, even shifted ports — matching real
firmware behavior); needs emulator commit `6563d9f`+. Emulator root defaults to
`../flashforge-emulator-v2` (override `FF_EMULATOR_ROOT`; CI checks out to `emulator/`).
~31 tests + 2 conditional skips, ~6 minutes, one worker.

**Process-group teardown — do not "simplify":** `emulator-harness.ts` spawns
`npm run headless:instance`, so the port binder is a **grandchild** (npm → tsx); npm
does not forward SIGTERM. The harness spawns `detached` on POSIX and kills the whole
group (`process.kill(-pid, …)`); Windows uses `taskkill /T` (no process groups).
Signalling only the child leaves 8899/8898 held and the next describe dies with
`EADDRINUSE` — invisible locally, exploded on first CI run.

## Hardware track

Same specs, real printers on the LAN.

- **Credentials resolve outside the working tree** (never committable):
  `$FFUI_E2E_HARDWARE_CONFIG` → `~/.flashforgeui-e2e/hardware-printers.json` → the
  developer's real profile (read-only). IPs are NEVER read from config — they
  resolve live by UDP discovery keyed on **serial** (the only stable identity;
  DHCP moves printers). Powered-off printers yield a discovery diagnostic, not a
  bare timeout.
- **Safety:** uploads run with Start Now unchecked; every upload is followed by
  `assertNotPrinting()` (reads `/detail` back; cancels + Clear Platform if a print
  somehow started). Fixtures removed in `afterEach`.
- **Profile isolation:** fresh temp `userData` via `FFUI_USER_DATA_DIR`;
  `launchFFUI()` asserts the app honored it before any test runs. Do not relax that
  assertion.

## What the specs prove

- `connect.spec.ts` (3/printer): saved-printer auto-connect; discovery matched by
  serial; manual connect (regression net for alpha.9 — named types skip the TCP
  probe, so the form must supply serial + check code without a second prompt).
- `upload.spec.ts` (2/printer): upload **verified out of band** via `/gcodeList`
  (regression net for the alpha.10 `isAD5X is not defined` silent no-op — the
  failure was in the confirm handler, so render-only assertions would miss it);
  material matching dialog rules (every 3MF on material-station printers, single
  filament included; NEVER on 5M-series). Fixtures are real slicer output.
- `led.spec.ts` (1/printer): toggles verified against `/detail`'s `lightStatus`,
  never the button's own styling.
- `creator5-gating.spec.ts` (1/printer + 1 Creator 5-only): pins the Start
  Recent/Start Local/home-axes gating contract (paid for itself on first run —
  caught `buildFeatureSet()` discarding child declarations and `gcodeAvailable`
  dropped by the `backend-initialized` contextId guard).
- `multi-printer.spec.ts`: two contexts, follows the real user flow (auto-connect
  choice dialog → "+" tab with its warning).
- `sftp-roundtrip.spec.ts` (hardware only): upload via GUI → see it in the SFTP
  file manager → delete → confirm gone from the printer itself.
- `discord-hardware.spec.ts` (hardware only, outside `specs/` so the emulator
  runner skips it): real AD5X + webhook relay; needs `FFUI_E2E_AD5X_IP` +
  `FFUI_E2E_AD5X_CHECK_CODE`.
- Cross-cutting: every Electron test ends with `assertNoRendererErrors()` —
  fails on any `pageerror`/`console.error` from any window (Electron Autofill
  noise allowlisted). This turns "the UI looked fine" into an assertion.
