# Multi-Context: Polling

`src/main/services/MultiContextPollingCoordinator.ts` owns one
`PrinterPollingService` per context. Legacy single-printer paths still use
`MainProcessPollingCoordinator`.

## Frequency strategy

- **All contexts (active and inactive): 3 seconds.** Inactive contexts must keep
  polling — printers drop TCP keep-alive if not polled regularly.
- **Instant switch:** cached data is emitted immediately on context switch, so tab
  changes never show a blank period.

## Event chain

```
PrinterPollingService → 'data-updated'
    ↓
MultiContextPollingCoordinator → 'polling-data' (contextId, payload)
    ↓
├── Renderer (if context active) → 'polling-update'
├── DiscordNotificationService → updatePrinterStatus(contextId)
└── Derived monitors (print state, temperature, Spoolman, notifications)
```

Rules that have bitten before:

- The `polling-update` payload must reach `ComponentManager.updateAll` UNTRANSFORMED.
  Shape changes between producer and component break every widget at once.
- Wall-clock ETA conversion gates on `isPrintAdvancing` (Printing only — not Paused,
  not Heating). See [../architecture/managers-services.md](../architecture/managers-services.md).
- Status mapping comes from the `@ghosttypes/ff-api` library (`FFMachineStatus`);
  Creator 5 Pro `"pause"` mapping exists since ff-api 2.0.0.
