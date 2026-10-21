# SSH / SFTP: File Manager and Calibration Assistant

Both features run over root SSH/SFTP on the printer, provisioned by the sibling
**[FlashForge-EasySSH](https://github.com/Parallel-7/FlashForge-EasySSH)** USB tool.
Credentials resolve from ONE centralized store — never per-feature.

## SSHSettingsService (`src/main/services/SSHSettingsService.ts`)

- Keyed by **serial number**, persisted to `ssh-settings.json`; passwords encrypted
  via `SecureStorage`.
- Defaults assume EasySSH provisioning: `root` / `flashforge`, port 22.
- IPC: `src/main/ipc/handlers/ssh-settings-handlers.ts` (`ssh-settings:get/update/reset`).
- Desktop editing UI: Settings → SSH (`src/renderer/src/ui/settings/sections/SSHSection.ts`);
  WebUI exposes the API (`server/routes/ssh-settings-routes.ts`) with partial UI coverage.
- The legacy `sshHost/sshPort/sshUsername/sshPassword/sshKeyPath` fields on
  `PrinterCalibrationData` are dead code slated for removal.

## SSHConnectionManager

Shared connection pool. File manager and calibration use **separate connection
keys** (`file-manager:<contextId>` vs calibration keys) over the same manager.

## FileManagerService (`src/main/services/FileManagerService.ts`)

SFTP listing/delete/rename/thumbnails. IPC: `file-manager:*` handlers (pinned to
the context active when the dialog opened). UI: `src/renderer/src/ui/file-manager/*`
(Internal + USB tabs, multi-select, confirm overlays) — opened only via the topbar
shortcut (`availability: 'shortcut'`, `file-manager:open`). Types:
`src/shared/types/file-manager.ts`.

**Supported models:** AD5X + Adventurer 5M / 5M Pro. Creator 5 / Creator 5 Pro NOT
supported yet (`FileManagerService.isModelSupported()` returns false).

### Canonical paths (match EasySSH docs)

| Model | Gcode | Thumbnails | USB |
| --- | --- | --- | --- |
| AD5X | `/usr/data/gcodes` | `thum/` + `3mf/thum/` | `/mnt` |
| 5M series | `/data` | `/data/uploadThumbnail` | `/mnt/usb` |

Thumbnails resolve: local ThumbnailCacheService → printer cache PNGs → ranged-read
extraction of `Metadata/plate_1_small.png` from `.3mf` zips (never full downloads).
USB presence is probed via `/proc/mounts`, not directory listings.

## EasySSH (companion project)

USB-boot provisioning script (`flashforge_init.sh`) — no disassembly, serial cable,
or firmware hack. 5M/5M Pro ship no sshd (EasySSH bundles static OpenSSH); AD5X
ships Dropbear but no `sftp-server` (EasySSH stages a static MIPS `sftp-server` via
`/usr/libexec` bind-mount + marker-guarded hook in `/usr/prog/app_startup.sh`).

- Default creds: `root`/`flashforge` (salt `ffuiroot`; 5M = MD5-crypt `$1$`,
  AD5X = SHA-256-crypt `$5$`).
- **AD5X firmware updates may drop the SFTP boot hook** (SSH keeps working, SFTP
  breaks; re-run the USB stick to restore).
- No uninstall path — reverting requires reflashing firmware.
- Keep the path/credential references here in sync with EasySSH's README.

## SSH reboot

Printers cannot cleanly terminate their own SSH session: reboot commands must run
in a **detached subshell** (see [../agent/lessons.md](../agent/lessons.md)).
