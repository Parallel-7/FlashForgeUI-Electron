# Known Coverage Gaps

Ordered by likelihood of catching a real regression. Check before assuming a
behavior is covered.

## High value

1. **No print lifecycle coverage** — nothing starts, pauses, resumes, or cancels a
   job. Most-used controls in the app, entirely untested end to end. The emulator
   supports `simulationMode: 'auto'`; the suite never uses it.
2. **No printer control coverage from the WebUI** — browser suite exercises auth,
   assets, context switching only. LED/temperature/job routes have no browser test.
3. **Headless coverage is boot-only** — CLI modes (`--printers=`, `--last-used`) and
   the shutdown path are untested.
4. **No temperature control coverage** — same shape as the LED test, which already
   proved the pattern.
5. **No settings persistence coverage** — nothing changes a global/per-printer
   setting, restarts, and confirms it stuck. Per-printer settings on
   `PrinterDetails` are easy to regress.
6. **Material station state never asserted** — the matching *dialog* is tested;
   slot readback, material type/color changes, and the `material:set-slot` IPC path
   (incl. the component-dialog preload mirroring that broke once) are not.

## Medium value

7. **Legacy printers never exercised** — emulator supports Adventurer 3/4 and
   `track.ts` maps them, but no descriptor enables them; the legacy backend and TCP
   `M115` probe path are untested.
8. **No camera E2E** — go2rtc lifecycle, the authenticated `CameraStreamProxy`
   (security boundary, issue #76), and WebRTC/MSE negotiation are unit-tested only.
   Missing piece: a camera source the emulator can offer.
9. **No grid layout coverage** — add/remove/rearrange widgets + persistence across
   restarts; `gridController.ts` regressed once already (issue #77).
10. **No update/notification coverage** — desktop notifications and
    electron-updater channel selection untested.
11. **`removeUploadedFile()` is a no-op on the emulator** — delete path is
    hardware-only.

## Low value / cheap wins

12. The `#` slot-colour regression is uncoverable (emulator always emits a prefixed
    colour; teaching it to emit unprefixed would pin the fix in CI).
13. No spec asserts WebUI and desktop show the same data for the same printer.
14. Retries off + `workers: 1` on both Playwright configs (correct, but one flaky
    hiccup fails the run).
15. No coverage thresholds in `jest.config.cjs` — unit coverage can silently decline.
