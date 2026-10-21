# Development Commands

pnpm only (never npm/yarn). Verified against `package.json`.

## Daily

| Command | Purpose |
| --- | --- |
| `pnpm dev` | electron-vite dev mode (builds WebUI first) with hot reload |
| `pnpm dev:clean` | clean output dirs, then dev |
| `pnpm start` | preview the production build |
| `pnpm clean` | remove `out/`, `dist/`, stray NVIDIA dirs |

## Validation

| Command | Purpose |
| --- | --- |
| `pnpm type-check` | `tsc --noEmit` over `src/` + `tsconfig.e2e.json` (e2e suites) |
| `pnpm lint` / `lint:fix` | Biome check (scope per `biome.json`) / with auto-fix |
| `pnpm format` | Biome formatter only |
| `pnpm check` / `pnpm ci` | Biome check --write / strict CI mode |
| `pnpm full-check` | type-check + lint |

## Tests

`test`, `test:watch`, `test:coverage`, `test:all` (Jest + browser, NOT Electron),
`test:e2e` (browser), `test:e2e:electron:emulator` / `:hardware` / `:discord`,
`test:pre-release` (type-check + lint + Jest + hardware track). Details:
[../testing/overview.md](../testing/overview.md).

## Build

`build` (electron-vite all processes), `build:webui` (static client only),
`build:win|linux|mac` (+ `:raw` and `build:ci:*` variants used by the release
workflow). Reserve full builds for user requests or structural changes.

## Docs / inventory / inspection

| Command | Purpose |
| --- | --- |
| `pnpm docs:check` | list source files missing `@fileoverview` (Go) |
| `pnpm docs:combine` | regenerate `fileoverview-report.md` (~230 entries — module map; GENERATED, repo root) |
| `pnpm docs:clean` | delete fileoverview artifacts |
| `pnpm find:console [-- --level=debug]` | console.* usage by severity |
| `pnpm find:lucide` | files touching Lucide icons |
| `pnpm find:window` | window API usage |
| `pnpm audit:dead-code` | ts-morph dead code report |
| `pnpm linecount [-- --min-lines=N]` | TS LOC summary |

## Code search

Prefer indexed search when available (this workspace: zvec-grep via the harness;
other environments may provide `code-search-mcp` or built-in Grep/Glob). Exhaustive
exact-string search is always safe; semantic search needs a fresh index.
