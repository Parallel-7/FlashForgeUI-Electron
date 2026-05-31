# Development Tooling Reference

**Last Updated:** 2026-03-11 17:37 ET (America/New_York)

This document covers all development tools, commands, and utilities available in the FlashForgeUI-Electron project.

---

## Code Search MCP Tools

> **Note:** These tools require specific MCP server configuration and may not be available in all environments. If unavailable, use built-in `Grep`/`Glob` tools instead.

**IMPORTANT**: Always prefer `code-search-mcp` tools over built-in search tools for comprehensive codebase exploration. These tools are significantly faster and more powerful than built-in alternatives.

Available MCP search tools:

### File Search
- **`mcp__code-search-mcp__search_files`** - Find files by name, pattern, or extension
  - Supports wildcards: `name: "config.*"`, `pattern: "src/**/*.ts"`
  - Filter by directory: `directory: "src/main/managers"`
  - Filter by extension: `extension: "ts"`
  - Much faster than `Glob` for complex patterns

### Text/Code Search
- **`mcp__code-search-mcp__search_text`** - Search for text patterns using ripgrep
  - Full regex support with literal mode option
  - Language-specific filtering: `language: "typescript"`
  - Path filtering: `paths: ["src/main/**/*.ts"]`
  - Case sensitivity control
  - Faster and more flexible than built-in `Grep`

### Symbol Search
- **`mcp__code-search-mcp__search_symbols`** - Search for code symbols (classes, functions, methods, etc.)
  - Language-aware: `language: "typescript"`, `name: "ConfigManager"`
  - Symbol kind filtering: `kinds: ["class", "method"]`
  - Match modes: `exact`, `prefix`, `substring`, `regex`
  - Scope filtering: `scope: { in_class: "BaseComponent" }`
  - Ideal for finding specific definitions across the codebase

### AST Pattern Matching
- **`mcp__code-search-mcp__search_ast_pattern`** - Advanced structural code search using AST patterns
  - Uses metavariables: `$VAR` (capture), `$$VAR` (single anonymous), `$$$VAR` (multiple)
  - Example: `"function $FUNC($ARG) { $$$ }"` finds all function declarations
  - Language support: TypeScript, JavaScript, Python, Rust, Go, Java, C/C++, etc.
  - More precise than regex for structural queries

### AST Rule Search
- **`mcp__code-search-mcp__search_ast_rule`** - Complex AST queries with relational/composite operators
  - Relational: `inside`, `has`, `precedes`, `follows`
  - Composite: `all`, `any`, `not`, `matches`
  - Debug mode to inspect AST structure
  - Most powerful tool for complex code patterns

### Technology Detection
- **`mcp__code-search-mcp__detect_stacks`** - Auto-detect project tech stacks
  - Scans for frameworks, languages, build tools
  - Confidence scoring for each detected technology
  - Useful for understanding unfamiliar codebases

### Dependency Analysis
- **`mcp__code-search-mcp__analyze_dependencies`** - Analyze project dependencies from manifest files
  - Supports package.json, Cargo.toml, pom.xml, etc.
  - Optional outdated check: `check_outdated: true`
  - Security analysis: `security_analysis: true`
  - Transitive dependencies: `include_transitive: true`

### Index Management
- **`mcp__code-search-mcp__refresh_index`** - Rebuild symbol index
- **`mcp__code-search-mcp__cache_stats`** - Get cache statistics
- **`mcp__code-search-mcp__clear_cache`** - Clear cached indices
- **`mcp__code-search-mcp__check_ast_grep`** - Verify ast-grep availability

### Usage Guidelines
1. **Always use `code-search-mcp` first** for file/text/symbol searches unless you need a trivial single-file lookup
2. **Use AST pattern matching** for structural queries (finding function signatures, class patterns, etc.)
3. **Use symbol search** when looking for specific classes, functions, or methods by name
4. **Use text search** for content-based queries (comments, strings, variable names)
5. **Use file search** for locating files by naming patterns
6. Built-in `Grep`/`Glob` are acceptable for quick one-off searches in known locations

---

## Development Commands

| Command | Purpose | Notes |
| --- | --- | --- |
| `pnpm dev` | Start development server | Builds WebUI + starts electron-vite dev mode with hot reload |
| `pnpm dev:clean` | Clean + dev | Clears output directories before starting dev server |
| `pnpm start` | Preview built application | Runs `electron-vite preview` to test the production build |
| `pnpm clean` | Remove build artifacts | Deletes `out/`, `dist/`, and `NVIDIA Corporation` directories |

---

## Testing Commands

| Command | Purpose | Notes |
| --- | --- | --- |
| `pnpm test` | Run Jest tests | Unit tests across `src/` directory |
| `pnpm test:all` | Run Jest + e2e tests | Combines Jest and Playwright browser tests |
| `pnpm test:watch` | Jest watch mode | Re-runs tests on file changes |
| `pnpm test:coverage` | Jest with coverage | Generates coverage report |
| `pnpm test:e2e` | Playwright browser tests | Builds WebUI first, then runs browser-based tests |
| `pnpm test:e2e:electron` | Electron Playwright tests | Full build required; runs desktop Playwright suite |
| `pnpm test:e2e:electron:emulator` | Emulator-backed Electron tests | Uses emulated printer connections |
| `pnpm test:e2e:electron:emulator:legacy` | Legacy Adventurer tests | Emulator tests for Adventurer-series printers |
| `pnpm test:e2e:electron:emulator:legacy-multi` | Legacy multi-printer tests | Multi-printer emulator tests with legacy printers |
| `pnpm test:e2e:electron:emulator:modern-multi` | Modern multi-printer tests | Multi-printer emulator tests with modern printers |
| `pnpm test:e2e:electron:emulator:smoke` | Smoke test against emulator | Quick emulator validation |
| `pnpm test:e2e:electron:live` | Live desktop smoke test | Tests against live `%APPDATA%` FlashForgeUI profile |

---

## Quality & Tooling Commands

| Command | Purpose | Notes |
| --- | --- | --- |
| `pnpm type-check` | `tsc --noEmit` for main process + shared types | Required before concluding substantial TypeScript changes |
| `pnpm lint` | Biome lint check (scope per biome.json) | Run after code changes to catch issues |
| `pnpm lint:fix` | Biome check with auto-fix (`biome check --write .`) | Fixes formatting + lint issues automatically |
| `pnpm format` | Biome formatter only (`biome format --write .`) | For formatting-only updates |
| `pnpm check` | Biome check with write (`biome check --write .`) | Combined lint + format with auto-fix |
| `pnpm ci` | Biome CI mode (`biome ci .`) | Strict checking for CI/CD pipelines, fails on any issues |
| `pnpm full-check` | Combined type-check + lint | Convenience script for complete static analysis |
| `pnpm docs:check` | Go script scanning for missing `@fileoverview` blocks | Ensures all TypeScript files have documentation headers |
| `pnpm docs:combine` | Generate `fileoverview-report.md` from source files | Extracts and aggregates all `@fileoverview` blocks |
| `pnpm docs:clean` | Remove fileoverview artifacts | Deletes `fileoverview-report.md` and `fileoverview-collection.json` |
| `pnpm specs:list -- --type active\|completed` | Lists AI spec Markdown files (top-level or archive) | Defaults to active specs; `--type completed` requires `ai_specs/archive` directory |
| `pnpm find:console` | Find console API usage patterns | Pass `-- --level=debug` etc. to filter by severity |
| `pnpm find:lucide` | Find Lucide icon usage | Shows every file touching Lucide icons |
| `pnpm find:window` | Find window API usage patterns | Scans for window-related API calls |
| `pnpm audit:dead-code` | Custom dead code analyzer using ts-morph | Discovers entrypoints dynamically and reports unused files/exports |
| `pnpm build` | Build main + renderer + WebUI using electron-vite | Full build of all processes; only when user asks or when structural build impacts occur |
| `pnpm build:webui` | Build WebUI static files only (TypeScript compilation) | Compiles WebUI TypeScript and copies assets to output |
| `pnpm build:win` / `build:linux` / `build:mac` | Platform-specific electron-builder packages | Creates distributable packages for specific platforms |
| `pnpm linecount` / `linecount -- --min-lines=N` | TypeScript LOC summary; optionally filter files with N+ lines | Informational only |

> **Note:** This project uses **pnpm** as the package manager. All commands should use `pnpm` instead of `npm`. Use `pnpm install`, `pnpm add <pkg>`, `pnpm <script>`, or `pnpm run <script>` for all package operations.

---

## Testing & Runtime Constraints

Claude agents can run:
- Static inspection, reasoning about architecture
- `pnpm type-check`, `pnpm lint`, `pnpm docs:check`, `pnpm audit:dead-code`
- All Biome commands: `lint`, `lint:fix`, `format`, `check`, `ci`
- Targeted node scripts (no GUI)

Agents **cannot**:
- Launch the Electron UI or WebUI interactively
- Connect to physical printers, cameras, or material stations
- Validate RTSP/MJPEG streams, LED hardware, or actual Spoolman servers
- Perform visual/UI regression testing or multi-window click-throughs

Call out unverified runtime assumptions explicitly in deliverables.

### Completion Checklist

In order to verify you are complete with a task, you go through this checklist:
1. Run type checking, if there's errors iterate until they are fixed properly (no band-aids, etc)
2. Once type checking passes, run build. This ensures electron-vite compiles both main and renderer processes without errors, and if there are any, iterate until they are fixed properly (no band-aids, etc)
3. Once build passes, the final check is running lint. It's important to never ignore the errors, the more they pile up the harder it becomes to do cleanups/maintain the codebase.

Do not say you are done with something despite not having run one/any of these checks, and the same if one fails. All must be run and pass to ensure codebase quality and production readiness.

---

## Fileoverview Inventory

- `fileoverview-report.md` (repo root) aggregates every `@fileoverview` block across `src/**/*.ts`. **This file is GENERATED** via `pnpm docs:combine` and may not exist until created. Use it to understand module responsibilities quickly before editing; it lists ~230 entries with filenames plus their summaries.
- `pnpm find:console` surfaces `console.<level>` calls (pass `-- --level=debug` etc.) so you can strip leftover logs before packaging or focus on specific severities quickly.
- `pnpm find:lucide` shows every file touching Lucide icons, making it simple to prune unused imports or confirm icon hydration paths.
- Run `pnpm docs:check` to ensure new/updated files keep their `@fileoverview` headers synchronized with this inventory.
