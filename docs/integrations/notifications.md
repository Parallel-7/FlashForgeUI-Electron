# Notifications

## Desktop (`src/main/services/notifications/`)

- `NotificationService` — wrapper with platform compatibility detection, lifecycle
  events (sent/clicked/closed), 24h retention, silent-notification support.
- `PrinterNotificationCoordinator` — per-printer notification logic.
- `MultiContextNotificationCoordinator` — every context gets its own coordinator
  regardless of the active tab; shared `NotificationService`, independent state.
- Types: completion, cooling, errors, material station.

## Discord (`src/main/services/discord/DiscordNotificationService.ts`)

- Webhook embeds with temperatures, progress, material usage.
- Event-driven: print complete, printer cooled, idle transition.
- Timer-based status updates (configurable `DiscordUpdateIntervalMinutes`,
  default 5 min); per-context tracking with state caching; 1s rate limit between
  messages.
- Config keys: `DiscordSync`, `WebhookUrl`, `DiscordUpdateIntervalMinutes`.
- Wall-clock ETAs in embeds gate on `isPrintAdvancing` like every other surface
  (see [../architecture/managers-services.md](../architecture/managers-services.md)).
- Hardware E2E coverage: `tests/e2e/electron/discord-hardware.spec.ts` (outside
  `specs/` so the emulator runner skips it).

Web push notifications were considered and dropped — not on any roadmap.
