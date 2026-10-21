# FlashForgeUI-Electron Documentation Index

Routing index for all project documentation. Pointers and one-line summaries only;
facts live in the files listed below. Add a row whenever a file is added.

## Architecture

| Topic | File | Keywords |
| --- | --- | --- |
| System overview | [architecture/overview.md](architecture/overview.md) | processes, bootstrap, principles, layer map |
| Managers & services | [architecture/managers-services.md](architecture/managers-services.md) | managers, coordinators, polling flow, eta gate |
| Printer backends & model detection | [architecture/printer-backends.md](architecture/printer-backends.md) | backends, hierarchy, pid, discovery, tcp fallback, gating |

## Multi-context

| Topic | File | Keywords |
| --- | --- | --- |
| Coordinators & lifecycle | [multi-context/coordinators.md](multi-context/coordinators.md) | context lifecycle, coordinator pattern, events |
| Polling | [multi-context/polling.md](multi-context/polling.md) | polling cadence, event chain, status mapping |

## IPC

| Topic | File | Keywords |
| --- | --- | --- |
| Handlers & channels | [ipc/handlers.md](ipc/handlers.md) | handler registry, channel catalog, preloads |
| Security model | [ipc/security-model.md](ipc/security-model.md) | allowlists, contextbridge, sandbox |

## Renderer (desktop UI)

| Topic | File | Keywords |
| --- | --- | --- |
| Components | [renderer/components.md](renderer/components.md) | componentmanager, registry, availability, dialogs, tabs |
| GridStack layout | [renderer/gridstack.md](renderer/gridstack.md) | gridstack, layout persistence, edit mode, bootstrap |
| Settings dialog | [renderer/settings-dialog.md](renderer/settings-dialog.md) | sections, orchestrator, dual settings |
| Theme system | [renderer/theme-system.md](renderer/theme-system.md) | css variables, palette, roundedui, scanner |

## WebUI & headless

| Topic | File | Keywords |
| --- | --- | --- |
| Headless mode | [webui/headless.md](webui/headless.md) | cli flags, init, shutdown, port 3000 |
| Server & routes | [webui/server-routes.md](webui/server-routes.md) | webuimanager, authmanager, websocket, camera proxy, routes |
| Static client | [webui/static-client.md](webui/static-client.md) | appstate, transport, features, grid, flashforgewebui |

## Integrations

| Topic | File | Keywords |
| --- | --- | --- |
| Camera streaming | [integrations/camera-streaming.md](integrations/camera-streaming.md) | go2rtc, webrtc, mse, loopback, auth proxy |
| Spoolman | [integrations/spoolman.md](integrations/spoolman.md) | spoolman, tracking, ad5x block, slots |
| Spoolman slot blueprint | [integrations/spoolman-slot-blueprint.md](integrations/spoolman-slot-blueprint.md) | slot mapping, tools, material station |
| Notifications & Discord | [integrations/notifications.md](integrations/notifications.md) | notifications, discord, webhooks, embeds |
| SSH / SFTP | [integrations/ssh-sftp.md](integrations/ssh-sftp.md) | file manager, calibration, easyssh, paths, credentials |

## Testing

| Topic | File | Keywords |
| --- | --- | --- |
| Overview | [testing/overview.md](testing/overview.md) | four surfaces, jest, browser e2e, ci |
| Electron E2E tracks | [testing/e2e-tracks.md](testing/e2e-tracks.md) | emulator, hardware, tracks, specs, teardown |
| Coverage gaps | [testing/coverage-gaps.md](testing/coverage-gaps.md) | gaps, untested paths |

## Tooling

| Topic | File | Keywords |
| --- | --- | --- |
| Commands | [tooling/commands.md](tooling/commands.md) | pnpm scripts, docs tools, inspection |
| Validation gates | [tooling/validation-gates.md](tooling/validation-gates.md) | typecheck, build, lint, commit conventions |

## Agent-facing

| Topic | File | Keywords |
| --- | --- | --- |
| Lessons (read before touching anything) | [agent/lessons.md](agent/lessons.md) | 25 hard-won rules by area |
| Conventions | [agent/conventions.md](agent/conventions.md) | workflow, editing, branches, skills |
| Release state | [agent/release-state.md](agent/release-state.md) | versions, pending bumps, electron 44 plan |

## Outside this folder

- `CLAUDE.md` — thin entry point for AI agents; points here.
- `CONTRIBUTING.md` — human contributor guide (setup, standards, releasing).
- `docs` changes that affect users: repo wiki + README on `main`.
- `fileoverview-report.md` (root) — GENERATED module inventory (`pnpm docs:combine`).

*Content verified against the codebase 2026-10-21. Re-verify before relying on file
paths or channel lists if the tree has moved.*
