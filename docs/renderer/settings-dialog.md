# Settings Dialog

Modular, section-based architecture for maintainability.

- **Base contract**: `src/renderer/src/ui/settings/sections/SettingsSection.ts` —
  `initialize()` / `dispose()` lifecycle hooks.
- **Sections** (`sections/*.ts`, verified): `AutoUpdateSection`, `DesktopThemeSection`
  (live CSS variable updates), `DiscordWebhookSection` (config + testing),
  `InputDependencySection` (dependent input states), `PrinterContextSection`
  (per-printer indicator/settings), `RoundedUISection` (platform compatibility +
  CSS injection), `SSHSection` (desktop-only SSH credential editing), 
  `SpoolmanTestSection`, `TabSection` (navigation).
- **Orchestrator**: `settings-renderer.ts` instantiates sections, coordinates
  lifecycle, and routes dual settings: global (`config.json`) vs per-printer
  (`printer_details.json`), including save/validation.
- **Types**: `settings/types.ts`, `settings/types/external.ts`.

## Adding a section

1. New class in `sections/` implementing `SettingsSection`.
2. Wire it in `settings-renderer.ts` `initializeElements()`.
3. Call `initialize()` on setup, `dispose()` on cleanup.
4. Sections stay isolated — no cross-section state manipulation.

Note: SSH settings editing is desktop-only; the WebUI has no SSH-edit UI yet
(the underlying `ssh-settings:get/update/reset` handlers exist — see
[integrations/ssh-sftp.md](../integrations/ssh-sftp.md)).
