# Headless Mode

Run the app as a WebUI server with no desktop window.

- CLI flags parsed in `src/main/utils/HeadlessArguments.ts`, validated by
  `validateHeadlessConfig`. Modes: `--last-used`, `--all-saved-printers`,
  `--printers="<ip>:<type>:<checkcode,...>"`. Overrides: `--webui-port`,
  `--webui-password`, camera overrides. Debug: `--debug`, `--debug-network`
  (work in both modes).
- `HeadlessManager.initialize()` (from `src/main/index.ts`) forces `WebUIEnabled`,
  applies overrides, connects printers, starts the WebUI server, launches
  polling/camera proxies, sets up graceful shutdown.
- `DEFAULT_CONFIG.WebUIPort` is **3000**. Any mention of 3001 is legacy.
- User-facing docs: the
  [Headless Mode](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/Headless-Mode)
  wiki page — update it whenever CLI or defaults change.

## Initialization order

```
applyConfigOverrides() → connectPrinters() → startWebUI()
→ setupEventForwarding() → startPolling() → initializeCameraStreams()
→ setupSignalHandlers()
```

## Shutdown

```
SIGINT/SIGTERM → shutdown() → stop polling → disconnect printers
→ go2rtcService.shutdown() → stop WebUI → exit(0)
```

Headless shares the desktop connection/polling/camera stack — keep
`isHeadlessMode()` conditionals to a minimum; duplicated logic drifts
(see [../agent/lessons.md](../agent/lessons.md)).
