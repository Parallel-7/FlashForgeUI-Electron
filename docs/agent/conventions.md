# Agent Working Conventions

How AI agents are expected to work in this repo.

## Workflow

- Invoke the `best-practices` skill for universal engineering principles and the
  `electron` skill for Electron-specific guidance when relevant.
- Gather context with indexed search tools before grep-ing around blindly.
- Plan before coding: create a multi-step plan (skip only for trivial edits) and
  keep it updated.
- Validation gates: [../tooling/validation-gates.md](../tooling/validation-gates.md).
- Testing: read [../testing/overview.md](../testing/overview.md) before touching
  any test.

## Environment specifics

- **pnpm** for all package operations.
- Windows dev machines: use `python`, not `python3`.
- Built artifacts are large; reserve `pnpm build*` for requests or structural
  changes.

## Editing rules

- Targeted edits, minimal diffs; never revert user-owned changes.
- ASCII unless the file already uses Unicode.
- Every repo-maintained `.ts/.tsx/.js/.jsx/.cjs` file starts with an
  `@fileoverview` block (purpose, key exports, relationships) — `pnpm docs:check`
  catches gaps, `pnpm docs:combine` refreshes the inventory.
- Commit style: one-line conventional commits, empty body, no AI trailers, no
  auto-close verbs on issue refs.

## Branches & releases

- `alpha` is the working branch; stable releases flow `alpha` → `main` via PR.
  Tiny urgent fixes may land directly on `main` and get backported to `alpha`.
- Pre-releases are GitHub Releases on `alpha`; stable notes come from the
  CHANGELOG section in ASD-STE100 style.
- Current release state: [release-state.md](release-state.md).

## User-facing docs to keep updated with feature changes

Wiki (Headless Mode, Auto Start pages), README badges/links on `main`,
flashforge-api-docs for API behavior changes (use the workspace `docs` agent), and
flashforge-emulator-v2 parity for reverse-engineering findings.
