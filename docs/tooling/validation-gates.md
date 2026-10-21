# Validation Gates and Agent Constraints

Non-negotiable completion checklist (in order):

1. **Type check** — `pnpm type-check`. Iterate until errors are fixed properly —
   no band-aids, no suppressed rules.
2. **Build** — once type-check passes, `pnpm build` (electron-vite must compile
   main + renderer). Iterate until clean.
3. **Lint** — once build passes, `pnpm lint`. Never ignore or defer errors; they
   pile up until cleanups become archaeology.

Do not claim completion with a gate unrun or failing. For test-relevant changes,
read [../testing/overview.md](../testing/overview.md) first and run the right
surface.

## What agents can run

Static inspection, `type-check`, `lint`, `docs:check`, `audit:dead-code`, all Biome
commands, targeted node scripts (no GUI).

## What agents cannot validate

Launching the Electron UI/WebUI interactively, physical printers/cameras/material
stations, RTSP/LED/Spoolman hardware behavior, visual regression. Call out
unverified runtime assumptions explicitly in deliverables. Live GUI testing with
real printers happens before releases — operator-driven.

## Commit conventions

One-line conventional commits, empty body, no AI trailers. Reference issues without
auto-close verbs (`Fixes`/`Closes`/`Resolves #N` are forbidden — they auto-close).
Stage only the files the change intends.
