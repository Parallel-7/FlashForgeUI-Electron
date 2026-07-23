# FlashForgeUI User Guide

## Initial Setup
Legacy printers are supported out of the box , as they don't use the new HTTP API.

For new printers (5M series+), you will need to enable LAN-Only mode to connect with FlashForgeUI

> Enabling LAN-only mode will *prevent* FlashCloud/PolarCloud from working, but provides the benefit of a true direct-connection to the printer. You will notice faster control and a smoother camera stream when comparing to Orca-FlashForge, or any of their cloud services.

The LAN-only mode setting is located in the same screen as the pairing code, see below

## 5M & AD5X Pairing Code
The Adventurer 5M, 5M Pro, and AD5X require a pairing code when connecting for the first time.

You can find the code in this settings menu on the printer (Printer ID = pairing code)
<img width="816" height="447" alt="image" src="https://github.com/user-attachments/assets/63ceea70-c956-4626-9690-c4ce20d74018" />

## Camera Setup
For 5M-series printers, OEM cameras are detected automatically whenever the printer reports a `cameraStreamUrl`. You do not need to enable any custom camera setting for an official FlashForge camera.

If you disable the printer-side camera in firmware, FlashForgeUI will treat the camera as unavailable until it is re-enabled on the printer.

For a separate custom RTSP or HTTP camera, enable the custom camera option in settings and paste the full camera URL into the camera URL box. You will then be able to view it from the Desktop and WebUI.

## Custom LED Setup
For users with an Adventurer 5M or AD5X that have installed custom LEDs , you'll need to enable the "Custom LEDs" option in settings. This tells the program that you've installed your own LEDs, and allows you to control them from the Desktop / WebUI


## Headless Mode Usage
For Linux and MacOS, replace `FlashForgeUI.exe` with the correct way to start from the CLI, for your OS. The `--enable-logging` flag is only needed for Windows, or if it's not spawning a new CLI window after starting the program.

For MacOS, the command structure starts with
```bash
open "/Applications/FlashForgeUI.app/Contents/MacOS/FlashForgeUI"
```

For Linux, the command depends on which package you installed.

Installed from the `.deb` or `.rpm` — the installer puts `FlashForgeUI` on your `PATH`:
```bash
FlashForgeUI --headless
```

Running the AppImage — call it by path (make it executable once with `chmod +x` if you have not already):
```bash
./FlashForgeUI-*.AppImage --headless
```

Both accept the same flags as the Windows examples below.

## Starting Headless Mode

Launch FlashForgeUI with the `--headless` flag:

```bash
FlashForgeUI.exe --enable-logging --headless
```

The WebUI will be accessible at `http://localhost:3000` by default.

## Command-Line Arguments

### Core Flags

**`--headless`**
- Runs without the desktop UI
- Starts the WebUI server automatically
- Required for all headless operations

### Printer Connection Modes

**`--last-used`**
- Connects to the last printer you used
```bash
FlashForgeUI.exe --enable-logging --headless --last-used
```

**`--all-saved-printers`**
- Connects to all saved printers
- Enables multi-printer mode with dropdown selector
```bash
FlashForgeUI.exe --enable-logging --headless --all-saved-printers
```

**`--printers=<spec>`**
- Connects to specific printer(s) by IP address and type
- Format: `--printers="<ip>:<type>:<checkcode>,<ip>:<type>:<checkcode>,..."`
- Type: `new` (5M family) or `legacy` (older models)
- Checkcode: Required for `new` type printers (8-digit code)

Single printer example:
```bash
FlashForgeUI.exe --enable-logging --headless --printers="192.168.1.100:new:12345678"
```

Multiple printers example:
```bash
FlashForgeUI.exe --enable-logging --headless --printers="192.168.1.100:new:12345678,192.168.1.101:legacy"
```

### WebUI Server Configuration

**`--webui-port=<port>`**
- Sets the WebUI server port (default: 3000)
```bash
FlashForgeUI.exe --enable-logging --headless --webui-port=8080
```

**`--webui-password=<password>`**
- Overrides the default WebUI password
```bash
FlashForgeUI.exe --enable-logging --headless --webui-password=mypassword
```

### Debug Logging

**`--debug`**
- Enables debug logging to file
- Logs are saved to timestamped files in the app's logs directory
- Includes verbose application logs, status updates, and general debugging info
- Can be combined with `--debug-network` for comprehensive logging
```bash
FlashForgeUI.exe --enable-logging --headless --last-used --debug
```

**`--debug-network`**
- Enables network-specific debug logging
- Requires debug mode to be enabled (via `--debug` flag or the DebugMode config setting)
- Logs connection attempts, failures, polling errors, and disconnections
- Useful for diagnosing printer connectivity issues
```bash
FlashForgeUI.exe --enable-logging --headless --last-used --debug --debug-network
```

Debug logs can be downloaded from the WebUI at:
- `/api/debug/logs` - List all debug log files
- `/api/debug/latest` - Download most recent debug log
- `/api/debug/network-logs` - List all network debug log files
- `/api/debug/network-latest` - Download most recent network log

## Common Usage Examples

### Single Printer (Last Used)
```bash
FlashForgeUI.exe --enable-logging --headless --last-used
```

### Multiple Printers (All Saved)
```bash
FlashForgeUI.exe --enable-logging --headless --all-saved-printers
```

### Specific Printer by IP (New API)
```bash
FlashForgeUI.exe --enable-logging --headless --printers="192.168.1.146:new:12345678"
```

### Specific Printer by IP (Legacy API)
```bash
FlashForgeUI.exe --enable-logging -headless --printers="192.168.1.100:legacy"
```

### Multiple Specific Printers
```bash
FlashForgeUI.exe --enable-logging --headless --printers="192.168.1.146:new:12345678,192.168.1.129:new:87654321"
```

### Custom Port and Password
```bash
FlashForgeUI.exe --enable-logging --headless --last-used --webui-port=8080 --webui-password=secret
```

## Accessing the WebUI

Once running, access the WebUI from any browser on your network:

```
http://<server-ip>:3000
```

Default password is configured in your application settings (or use `--webui-password=` to override).

### Remote Access / Port Forwarding

Everything the WebUI needs - including live camera streams - is served over the single WebUI port (default `3000`). If you expose the WebUI outside your LAN, forward **only** that port. Camera video is tunneled through the authenticated WebUI server, so do **not** forward the internal go2rtc streaming port (`1984`); it has no authentication of its own and should never be reachable from outside your machine's network.

## Multi-Printer Mode

When using `--all-saved-printers` or specifying multiple printers with `--printers=`, the WebUI provides:

- **Printer Selector**: Dropdown to switch between printers
- **Per-Printer Camera**: Each printer gets its own camera stream, served through the WebUI port
- **Independent Control**: Each printer maintains its own state and features

## Troubleshooting

### My printer is not being discovered automatically
- If your printer is before the 5M series, automatic discovery won't work. Use the direct IP connection option, and it will be saved for future usage.
- If your printer is 5M series+, first make sure LAN-only mode has been properly enabled. After verifying, make sure your PC and printer are on the same network. Occasionally the printer will not respond to the scan, so simply re-scanning can cause your printer to appear.

### ETA and/or filament usage is not correct/being reported
- The file has been sliced with OrcaSlicer and lacks the correct (and correct ordering of) metadata. FlashForge printers only "broadcast" this information to the API for files sliced by Orca-FlashForge. Both slicers include the information, but in different formats, and FlashForge printers only look for/accept the format from Orca-FlashForge.
- Please download and set up [this](https://github.com/GhostTypes/orca2flashforge) post-process script
- If you already have a script for MD5 generation, remove it and add `-m` to the end of this. It will generate both the MD5 hash and the corrected metadata.

## Linux Notes

### Start with system / Start minimized

"Start with system" writes a standard freedesktop autostart entry to `~/.config/autostart/flashforgeui.desktop` (or `$XDG_CONFIG_HOME/autostart/` if you set that variable). Every major desktop environment honors it - GNOME, KDE, XFCE, Cinnamon, MATE - so it works the same on any distro. Turning the setting off deletes the file.

"Start minimized" only applies to sessions the system auto-launched; launching FlashForgeUI yourself always shows the window.

Be aware that some environments ignore requests from an application to minimize itself. Wayland in particular has no "minimized" window state, so on a Wayland session the window may simply open normally instead of minimizing. Use the tray icon to get back to the window whenever it is out of sight. On GNOME, tray icons require the AppIndicator extension - without it the icon will not appear, though relaunching FlashForgeUI always brings the existing window to the front.

### Headless start with system

The "Start with system" setting is part of the desktop app and does not apply to headless mode. To start headless FlashForgeUI at login, create a systemd user service at `~/.config/systemd/user/flashforgeui.service`:

```ini
[Unit]
Description=FlashForgeUI (headless)
After=network-online.target

[Service]
Type=simple
ExecStart=/opt/FlashForgeUI/FlashForgeUI --headless
Restart=on-failure

[Install]
WantedBy=default.target
```

Adjust `ExecStart` to match your install (for an AppImage, use the full path to the `.AppImage` file). Then enable it:

```bash
systemctl --user daemon-reload
systemctl --user enable --now flashforgeui
loginctl enable-linger "$USER"   # start without an active login session
```

### The AppImage runs without Chromium's sandbox on Ubuntu

Ubuntu 23.10 and newer ship `kernel.apparmor_restrict_unprivileged_userns=1`, which stops unprivileged programs from creating user namespaces. Chromium - which Electron is built on - needs either those namespaces or a root-owned `chrome-sandbox` helper to sandbox itself. An AppImage runs from a temporary user-owned mount, so the helper can never be root-owned, and the namespace route is now blocked. With neither available, Chromium refuses to start and the app appears to do nothing when launched.

FlashForgeUI detects this at launch and starts with `--no-sandbox` so the app remains usable. This happens **only** when running the AppImage on a system where namespaces are blocked; the `.deb` and `.rpm` packages always run fully sandboxed.

**If you want the AppImage sandboxed as well**, you can install an AppArmor profile yourself. This is optional and unsupported - it depends on where you keep the AppImage and is not something the app can do for you, since granting the permission requires root. Create `/etc/apparmor.d/flashforgeui` with the path to your AppImage:

```
abi <abi/4.0>,
include <tunables/global>

profile flashforgeui /home/YOUR_USER/Applications/FlashForgeUI.AppImage flags=(unconfined) {
  userns,
  include if exists <local/flashforgeui>
}
```

Then load it:

```bash
sudo apparmor_parser -r /etc/apparmor.d/flashforgeui
```

The profile is tied to that exact path, so moving or renaming the AppImage means updating it. Installing the **`.deb` (or `.rpm`) instead** avoids all of this - those packages install their own AppArmor profile automatically during installation and need no manual steps. On Ubuntu 24.04+ the `.deb` is the recommended download.

Background: [electron#41066](https://github.com/electron/electron/issues/41066) and [Ubuntu bug #2046844](https://bugs.launchpad.net/ubuntu/+source/apparmor/+bug/2046844).
