# Printer Backends

One backend class per printer family implements the printer-facing API. Selection is
model detection + capability flags; nothing else in the app talks printer protocols.

## Hierarchy (verified)

```
BasePrinterBackend (abstract)
├── GenericLegacyBackend        # TCP/M115 legacy printers
├── DualAPIBackend              # legacy TCP + 5M HTTP hybrid
│   ├── Adventurer5MBackend
│   └── Adventurer5MProBackend  # isPro via firmware pid
└── MaterialStationBackend (abstract, 4-slot shared behavior)
    ├── AD5XBackend             # + ad5x/ transforms
    └── Creator5Backend         # handles Creator 5 AND Creator 5 Pro via isCreator5Pro()
```

All in `src/main/printer-backends/`. `buildFeatureSet()` on the base declares
capabilities (`localJobs`, `gcodeCommands`, `statusMonitoring`, …); children override —
the base must not silently discard child declarations (regression caught by
creator5-gating.spec).

- **HTTP-only models:** Creator 5 / Creator 5 Pro run no TCP server on 8899.
  `ConnectionEstablishmentService.ts` checks `isHttpOnlyModel()` and connects over
  HTTP directly; a stale `forceLegacyMode` flag heals on the next HTTP connect.
- **After pairing, trust the library:** `client.isPro` / `client.isAD5X` / `info.Pid`
  come from the firmware `pid` (35 = 5M, 36 = 5M Pro, 38 = AD5X, 40 = Creator 5,
  41 = Creator 5 Pro). Never re-derive capabilities from `info.Name` — user-mutable.
  Never mutate `client.isAD5X` after the fact; fix selection upstream instead.

## Selection: discovery-PID-first, TCP fallback

- **Modern printers are typed from the discovery broadcast**, not a TCP probe. The
  276-byte UDP packet carries name at `0x00`, USB product ID at `0x88`, serial at
  `0x92`. `ConnectionEstablishmentService.createTemporaryConnection()` short-circuits
  on any PID in `NEW_API_PRODUCT_IDS` (35/36/38/40/41) and synthesizes type info from
  the packet — no TCP probe runs for modern models.
- **TCP probe is the fallback for PID-less cases:** genuine legacy printers and
  manual/headless connects that named no model open an unauthenticated TCP `M115`
  (`tcpClient.getPrinterInfo()`). The firmware-set `TypeName` (not the user-mutable
  `Name`) drives `detectPrinterModelType` / `detectPrinterFamily` in
  `src/main/utils/PrinterUtils.ts`.
- **Manual connects supply what the broadcast would have:** the manual connect dialog
  collects IP + type + serial + check code; `ConnectionFlowManager.connectDirectlyToIP()`
  maps the type to a PID hint. "Legacy Printer" sends no PID and is probed as before.
- **Legacy mode is per-printer:** backend selection reads the saved printer setting,
  never a global `ForceLegacyAPI` override.

## Gating contracts pinned by tests

- Creator 5 series: no resident-file material mappings → Start Recent AND Start Local
  disabled; `#btn-home-axes` disabled (no G-code passthrough).
- AD5X: `localJobs: false` → Start Local disabled only.
- Pinned in `tests/e2e/electron/specs/creator5-gating.spec.ts` (renderer
  `controls-grid.ts` + WebUI `panels.ts`/`dialogs.ts`); change them together.
