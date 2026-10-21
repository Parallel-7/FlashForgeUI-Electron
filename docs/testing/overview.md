# Testing Overview

Read this before writing, changing, or reasoning about any test. Full detail:
[e2e-tracks.md](e2e-tracks.md) (Electron tracks), [coverage-gaps.md](coverage-gaps.md).

## The four surfaces

| Surface | Runner | Command | Needs | In CI |
| --- | --- | --- | --- | --- |
| Unit / integration | Jest | `pnpm test` | nothing | yes |
| WebUI browser E2E | Playwright (chromium) | `pnpm test:e2e` | emulator + Electron | yes |
| Electron E2E — emulator track | Playwright (`_electron`) | `pnpm test:e2e:electron:emulator` | `flashforge-emulator-v2` checkout | yes |
| Electron E2E — hardware track | Playwright (`_electron`) | `pnpm test:e2e:electron:hardware` | real printers on the LAN | no (impossible) |
| Discord webhook (hardware) | Playwright (`_electron`) | `pnpm test:e2e:electron:discord` | real AD5X + webhook relay | no |

`pnpm test:all` runs Jest + browser E2E only — **not** the Electron suites. Run the
Electron slice explicitly when desktop behavior changes. `pnpm test:pre-release` =
type-check + lint + Jest + hardware track.

`pnpm type-check` covers both `tsconfig.json` (`src/`) and `tsconfig.e2e.json`
(`tests/` + both Playwright configs). Before the e2e tsconfig was wired in, the
Electron suite rotted for months with no type error surfacing.

## Unit / integration (Jest)

55 suites, ~1,880 tests, `src/**/__tests__/`. Node environment, ts-jest;
`electron-log` mocked so tests never write the real profile log. Heaviest: WebUI
server (14 suites), calibration (8), services (12), WebUI static client (9), shared
material color math.

## WebUI browser E2E

`tests/e2e/browser/`, 8 tests, ~20s. **No fixture server, nothing stubbed** —
`startHeadlessWebUI()` boots emulator printers, seeds an isolated profile, launches
the real app `--headless --all-saved-printers`, and talks to the WebUI server the
app itself starts (real routes, real AuthManager/security middleware, real
WebSocketManager). Also the only end-to-end coverage of headless mode. This is
what catches stale asset mixes, icon hydration mismatches, and camera bootstrap
regressions (version-stamped `?v=` assets asserted).

Rules: never reintroduce a stub for app behavior; `workers: 1` (fixed emulator
ports); emulator `machineName` must not contain spaces; take tokens from
`/api/auth/login` not `localStorage`; don't assume the active printer (the app
activates the last one it connected). On Windows the WebUI needs an elevated
terminal; `describeHeadlessSkipReason()` skips with an explanation.

## CI pipeline

`.github/workflows/ci.yml`, on push/PR to `main` + `alpha`:

1. **`verify`** — type-check → lint → build → `pnpm test`
2. **`e2e-emulator`** (needs verify) — Electron emulator track + browser suite under
   `xvfb-run`; browser step `if: success() || failure()` so one failure doesn't hide
   the other; traces upload on failure.

CI-only details: pnpm-unpacked `chrome-sandbox` needs `chown root` + `chmod 4755`
(never `--no-sandbox` — launch args must match users'); xvfb for the real window.
Both jobs report but cannot block merges until marked as required status checks.
