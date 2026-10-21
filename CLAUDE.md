# FlashForgeUI-Electron

Electron desktop + headless controller for FlashForge printers (Adventurer 5M /
5M Pro, AD5X, Creator 5 / Creator 5 Pro) with camera streaming, Spoolman tracking,
SFTP file management, and an authenticated WebUI.

**All documentation lives in [docs/](docs/README.md)** — start from its routing
index. The high-traffic pages:

- [docs/agent/lessons.md](docs/agent/lessons.md) — 25 hard-won rules; read before
  touching renderer, services, backends, or releases.
- [docs/architecture/overview.md](docs/architecture/overview.md) — process model,
  layers, and pointers into every subsystem.
- [docs/testing/overview.md](docs/testing/overview.md) — read before writing,
  changing, or reasoning about any test.
- [docs/agent/release-state.md](docs/agent/release-state.md) — current versions,
  pending bumps, Electron 44 plan, release mechanics.
- [docs/tooling/validation-gates.md](docs/tooling/validation-gates.md) — the
  ordered completion gates (type-check -> build -> lint) and commit conventions.

## Non-negotiable rules

1. **pnpm** only. Windows dev machines: `python`, not `python3`.
2. Complete nothing without the validation gates passing (see above).
3. Never hardcode colors — theme variables only ([docs/renderer/theme-system.md](docs/renderer/theme-system.md)).
4. Gate features on printer capabilities, never on user-editable printer names.
5. Keep the two preloads in sync when adding IPC channels.
6. macOS artifacts must stay ad-hoc signed (Windows unsigned is expected) — see
   lessons #24.
7. Invoke the `best-practices` and `electron` skills when doing general or
   Electron-specific engineering work.

## Related repos

`@ghosttypes/ff-api` (npm) is the 5M-platform API library this app builds on;
behavior fixes there propagate to the other `ff-5mp-api-*` ports, the frontends,
flashforge-api-docs, and flashforge-emulator-v2. FlashForgeWebUI shares the WebUI
client — mirror user-facing WebUI changes into it. FlashForge-EasySSH provisions
the SSH/SFTP surface ([docs/integrations/ssh-sftp.md](docs/integrations/ssh-sftp.md)).
