# Contributing to FlashForgeUI

Thanks for your interest in improving FlashForgeUI! This guide covers how the project is
organized, how to set up a development environment, the standards we hold code to, and
how changes travel from a pull request to a stable release.

If you are reporting a bug or requesting a feature rather than writing code, please
[open an issue](https://github.com/Parallel-7/FlashForgeUI-Electron/issues). Include your
printer model, firmware version, operating system, and FlashForgeUI version.

---

## TL;DR

1. **Work from `alpha`, never from `main`.** Branch from `alpha` and open your pull
   request against `alpha`.
2. Run `pnpm type-check`, `pnpm lint`, `pnpm build`, and `pnpm test` before opening the PR.
   CI runs the same checks.
3. Add a line under `## [Unreleased]` in `CHANGELOG.md` for anything a user would notice.

---

## Branches and the Release Cycle

| Branch | Purpose |
| --- | --- |
| `alpha` | **Active development.** All work lands here first, and alpha pre-releases are cut from here. |
| `main` | **Stable releases only.** It only changes when a finished alpha cycle is promoted. The README on `main` is what users see. |
| `feature/*`, `fix/*`, … | Your working branches. Create them from `alpha` and merge them back into `alpha`. |

Pull requests that target `main` will be asked to retarget `alpha`. The only PRs
that go into `main` are the maintainers' release PRs.

### How a change becomes a release

```
 your branch ──PR──▶ alpha ──▶ 1.0.6-alpha.1 ──▶ 1.0.6-alpha.2 ──▶ …   (pre-releases)
                       │
                       └──PR (alpha → main)──▶ main ──▶ 1.0.6        (stable release)
                                                           │
                       alpha ◀── sync main back ───────────┘
                         └──▶ 1.0.7-alpha.1 ──▶ …                    (next cycle starts)
```

1. **Development.** Contributions are merged into `alpha`.
2. **Alpha releases.** When enough has landed, a maintainer cuts an alpha pre-release
   (`X.Y.Z-alpha.N`) from `alpha`. Alpha users get it through the in-app updater.
3. **Stable release.** When an alpha cycle is ready, `alpha` is PR'd into `main` and
   merged, and the stable `X.Y.Z` release is cut from `main`.
4. **Next cycle.** `main` is synced back into `alpha`, and the next alpha **bumps the
   patch number**: `X.Y.(Z+1)-alpha.1`.

> **Why the bump matters:** semver ranks `1.0.5` above every `1.0.5-alpha.N`. Publishing
> `1.0.5-alpha.14` after the `1.0.5` stable would look *older* to the updater and break
> alpha updates. After a stable release, the next alpha is always `1.0.6-alpha.1`.

---

## Development Setup

### Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | 22.x | Matches the Node runtime bundled with Electron 39 and the version CI uses |
| [pnpm](https://pnpm.io/) | 10.x | Run `corepack enable` to use the exact version pinned in `package.json`. Don't use npm or yarn: the lockfile is `pnpm-lock.yaml` |
| Git | any recent | |
| [Go](https://go.dev/) | optional | Only needed for the documentation helper scripts (`pnpm docs:check`, `pnpm docs:combine`) |

Every dependency, including the `@ghosttypes/ff-api` and `@parallel-7/slicer-meta`
printer libraries, installs from the public npm registry. You don't need a token or an
`.npmrc`.

### Getting the code

```bash
git clone https://github.com/Parallel-7/FlashForgeUI-Electron.git
cd FlashForgeUI-Electron
git checkout alpha
git checkout -b feature/my-change

pnpm install   # also downloads the bundled go2rtc camera binary
pnpm dev       # launches the app with hot reload
```

If you fork the repository, keep your fork's `alpha` up to date with
`Parallel-7/FlashForgeUI-Electron:alpha` and branch from it.

### Useful commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Builds the WebUI and starts the app with hot reload |
| `pnpm build` | Builds the main process, renderer, and WebUI |
| `pnpm type-check` | Type-checks the app (`src/`) and the test tree (`tests/`) |
| `pnpm lint` / `pnpm lint:fix` | Biome lint, or lint plus format with fixes applied |
| `pnpm test` | Jest unit and integration tests |
| `pnpm test:e2e` | Browser Playwright tests for the WebUI |
| `pnpm test:e2e:electron:emulator` | Desktop end-to-end tests against the printer emulator |
| `pnpm build:win` / `build:mac` / `build:linux` | Package installers for a platform |
| `pnpm docs:check` | Lists source files missing an `@fileoverview` header (needs Go) |

To run the app without its desktop window (the WebUI server only), see the
[Headless Mode](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/Headless-Mode)
wiki page.

---

## Project Layout

| Path | Contents |
| --- | --- |
| `src/main/` | Electron main process: printer backends, connection and polling managers, services (camera, Spoolman, notifications, SSH), IPC handlers, windows |
| `src/main/webui/` | WebUI: the Express/WebSocket server (`server/`) and the browser client (`static/`) |
| `src/preload/` | Context bridges between the main process and renderer windows |
| `src/renderer/` | Desktop UI: the GridStack dashboard, components, and dialogs |
| `src/shared/` | Types and helpers shared across processes |
| `tests/e2e/` | Playwright suites (browser WebUI + Electron) |
| `docs/testing/` | The authoritative guide to every test surface (start at `overview.md`) |

`docs/` has the full architecture notes. Start at `docs/README.md` (routing index)
and `docs/architecture/overview.md`.

---

## Code Standards

- **TypeScript everywhere**, strict types, no `any` without a good reason.
- **Biome** handles linting and formatting. `pnpm lint` must pass with no errors. Fix
  the code rather than suppressing a rule.
- **File headers:** every source file under `src/` starts with an `@fileoverview` block.
  It should say what the file is for, its key exports, and how it relates to nearby
  modules. `pnpm docs:check` finds files that are missing one.
- **Never hardcode colors in CSS.** Use the theme variables (`--theme-primary`,
  `--surface-elevated`, …) so light, dark, and custom themes keep working. See
  `docs/renderer/theme-system.md`.
- **One code path for desktop and headless.** Both modes share the same connection,
  polling, and camera stack. Avoid branching on headless mode unless there is no other way.
- **WebUI parity.** User-facing features should work in the WebUI as well as the desktop
  app where that makes sense. The WebUI code is shared with the standalone
  [FlashForgeWebUI](https://github.com/Parallel-7/FlashForgeWebUI) project, so mention in
  your PR if a change should be ported there too.
- **Gate features on printer capabilities, not on printer names.** The printer name is
  user-editable. Use the backend's feature flags and the model detected at connect time.
- **Keep both preloads in sync.** If you add IPC channels that pop-out component dialogs
  need, add them to the component-dialog preload as well as the main preload.
- **Printer protocol bugs belong upstream.** If the bug is in how the printer API is
  spoken, fix it in [`ff-5mp-api-ts`](https://github.com/GhostTypes/ff-5mp-api-ts)
  (`@ghosttypes/ff-api`), then bump the dependency here. Don't patch around the library.

---

## Testing

**Read [`docs/testing/overview.md`](docs/testing/overview.md) before you write or change a test.** It
explains what each suite actually proves and where the known gaps are.

- **Unit / integration (`pnpm test`):** Jest tests live next to the code in `__tests__/`
  folders. New logic should come with tests.
- **Desktop E2E, emulator track (`pnpm test:e2e:electron:emulator`):** drives the real
  app against emulated printers (Adventurer 5M Pro, AD5X, Creator 5, Creator 5 Pro) with
  no hardware needed. It expects a checkout of
  [`flashforge-emulator-v2`](https://github.com/GhostTypes/flashforge-emulator-v2) next to
  this repository. If yours is elsewhere, set `FF_EMULATOR_ROOT` to its path. CI runs
  this track on every push and PR.
- **Desktop E2E, hardware track (`pnpm test:e2e:electron:hardware`):** the same specs
  run against real printers on your network. Specs branch on printer *capabilities*,
  never on which track is running. Don't fork a spec per track.
- **Real printers:** if your change touches printer communication, please test it on a
  real printer if you have one, and say which model and firmware you used in the PR.

---

## Commits and Pull Requests

**Commit messages** follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(webui): add job upload to the browser UI
fix(creator5): show paused state instead of Unknown
chore(deps): bump @ghosttypes/ff-api to 2.0.3
docs: clarify headless setup
```

Common types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `ci`, `build`, `chore`.
The scope is optional but helpful (`webui`, `spoolman`, `camera`, `creator5`, …).

**Referencing issues:** mention the issue number (`#123`) in the title or body, but
**don't** use auto-closing keywords like `Fixes #123` or `Closes #123`. Issues
are closed by hand once the fix has been confirmed in a release.

**Before opening a PR:**

- [ ] Branched from, and targeting, **`alpha`**
- [ ] `pnpm type-check`, `pnpm lint`, `pnpm build`, and `pnpm test` all pass
- [ ] Tests added or updated for the change
- [ ] `CHANGELOG.md` updated under `## [Unreleased]` for user-visible changes
- [ ] `@fileoverview` headers present on new files
- [ ] Printer model and firmware listed if tested on hardware
- [ ] The wiki needs an update for user-facing changes (say so in the PR)

Keep PRs focused: one feature or fix per PR is much easier to review than a bundle.

---

## Releasing (maintainers)

Releases are built by the **Build and Release Electron App** workflow
(`.github/workflows/release.yml`). It runs on `workflow_dispatch`, builds Windows,
macOS, and Linux, tags `v<version>`, and publishes a GitHub Release with the updater
manifests. The update channel is derived from the version: `X.Y.Z-alpha.N` publishes to
the `alpha` channel, and a bare `X.Y.Z` publishes to `latest`.

The release notes are taken from the `CHANGELOG.md` section whose heading matches the
version exactly: `## [<version>] - <YYYY-MM-DD>`. Without that section, the release gets
only a bare link.

### Alpha release

1. On `alpha`, bump `version` in `package.json` (e.g. `1.0.6-alpha.1` → `1.0.6-alpha.2`).
2. Move the `## [Unreleased]` notes into a new `## [1.0.6-alpha.2] - <date>` section,
   and leave an empty `## [Unreleased]` above it.
3. Commit and push to `alpha`.
4. Dispatch the workflow on `alpha` with `prerelease: true`:
   `gh workflow run release.yml --ref alpha -f version=1.0.6-alpha.2 -f prerelease=true`

### Stable release

1. On `alpha`, set `version` to the stable number (`1.0.6-alpha.N` → `1.0.6`). Add a
   `## [1.0.6] - <date>` section that sums up the whole alpha cycle, and make sure the
   README is current.
2. Make sure `alpha` contains everything on `main` (merge `main` into `alpha` if needed),
   so the release PR has no conflicts.
3. Open a PR from `alpha` into `main`, let CI pass, and merge it.
4. Live-test the build on real printers.
5. Dispatch the workflow on `main` with `prerelease: false`:
   `gh workflow run release.yml --ref main -f version=1.0.6 -f prerelease=false`
6. Sync `main` back into `alpha`. Then bump `alpha` to the next patch alpha
   (`1.0.7-alpha.1`) with a fresh `## [Unreleased]` section.

Don't pre-create a draft GitHub Release for the tag. The workflow publishes an existing
draft and keeps the draft's body instead of the generated notes.

---

## License

By contributing, you agree that your contributions will be licensed under the project's
MIT License.
