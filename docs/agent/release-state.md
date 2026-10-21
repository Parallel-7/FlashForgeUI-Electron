# Release State

Volatile snapshot — update at every release or branch milestone. Last updated:
2026-10-21.

## Current

- **Stable: 1.0.5** (2026-10-17; re-released 2026-10-21 from `main` @ `4dc3a30`
  with ad-hoc-signed macOS builds — the first 1.0.5 artifacts were unsigned and
  Gatekeeper-blocked). Rolls up 1.0.5-alpha.1…13 + pre-release fixes.
- **`alpha`: 1.0.6-alpha.1** (version bumped, unreleased). The signing fix is
  backported (`fb80816`), so 1.0.6-alpha.2+ builds signed.
- **Pending dependency bumps:** `@ghosttypes/ff-api` 2.1.0 and
  `@parallel-7/slicer-meta` 1.5.3 (releases ship 2.0.3 / 1.5.0).

## Planned for the 1.0.6 cycle

**Electron 39 → 44.** Electron 39 is EOL with 4 open advisories (fixed ≥41.10.6).
Known migration work:

- macOS notifications need a code-signed app from 42 (builds carry only ad-hoc
  signatures — verify sufficiency before upgrading).
- Electron stops downloading its binary in `postinstall` from 42 (check CI/e2e).
- Dialogs stop remembering the last folder from 43 (add `defaultPath` tracking in
  `job-handlers.ts`).
- `openAsHidden` removed in 44 (`AutoLaunchService.ts`); macOS 13+ required in 44;
  bundled Node → 24 (bump CI/release from Node 22).
- Sync `safeStorage` APIs used by `SecureStorage.ts` go away in 46.

## Release flow

See `CONTRIBUTING.md` → Releasing. Channel derivation, changelog mechanics, and
draft-body caveat: [lessons.md](lessons.md) §22–24. Release workflow:
`.github/workflows/release.yml` (workflow_dispatch, builds all three OSes, macOS
signature guard included).
