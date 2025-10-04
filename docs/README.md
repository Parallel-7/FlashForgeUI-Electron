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


## Headless Mode Usage
For Linux and MacOS, replace `FlashForgeUI.exe` with the correct way to start from the CLI, for your OS

## Starting Headless Mode

Launch FlashForgeUI with the `--headless` flag:

```bash
FlashForgeUI.exe --headless
```

The WebUI will be accessible at `http://localhost:3001` by default.

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
FlashForgeUI.exe --headless --last-used
```

**`--all-saved-printers`**
- Connects to all saved printers
- Enables multi-printer mode with dropdown selector
```bash
FlashForgeUI.exe --headless --all-saved-printers
```

**`--printers=<spec>`**
- Connects to specific printer(s) by IP address and type
- Format: `--printers="<ip>:<type>:<checkcode>,<ip>:<type>:<checkcode>,..."`
- Type: `new` (5M family) or `legacy` (older models)
- Checkcode: Required for `new` type printers (8-digit code)

Single printer example:
```bash
FlashForgeUI.exe --headless --printers="192.168.1.100:new:12345678"
```

Multiple printers example:
```bash
FlashForgeUI.exe --headless --printers="192.168.1.100:new:12345678,192.168.1.101:legacy"
```

### WebUI Server Configuration

**`--webui-port=<port>`**
- Sets the WebUI server port (default: 3001)
```bash
FlashForgeUI.exe --headless --webui-port=8080
```

**`--webui-password=<password>`**
- Overrides the default WebUI password
```bash
FlashForgeUI.exe --headless --webui-password=mypassword
```

## Common Usage Examples

### Single Printer (Last Used)
```bash
FlashForgeUI.exe --headless --last-used
```

### Multiple Printers (All Saved)
```bash
FlashForgeUI.exe --headless --all-saved-printers
```

### Specific Printer by IP (New API)
```bash
FlashForgeUI.exe --headless --printers="192.168.1.146:new:12345678"
```

### Specific Printer by IP (Legacy API)
```bash
FlashForgeUI.exe --headless --printers="192.168.1.100:legacy"
```

### Multiple Specific Printers
```bash
FlashForgeUI.exe --headless --printers="192.168.1.146:new:12345678,192.168.1.129:new:87654321"
```

### Custom Port and Password
```bash
FlashForgeUI.exe --headless --last-used --webui-port=8080 --webui-password=secret
```

## Accessing the WebUI

Once running, access the WebUI from any browser on your network:

```
http://<server-ip>:3001
```

Default password is configured in your application settings (or use `--webui-password=` to override).

## Multi-Printer Mode

When using `--all-saved-printers` or specifying multiple printers with `--printers=`, the WebUI provides:

- **Printer Selector**: Dropdown to switch between printers
- **Per-Printer Camera**: Each printer gets its own camera stream (ports 8181+)
- **Independent Control**: Each printer maintains its own state and features

