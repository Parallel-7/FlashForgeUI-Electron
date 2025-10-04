# Headless Mode Usage Guide

FlashForgeUI supports running in headless mode, where the application runs without the desktop UI and is accessed exclusively through a web browser.

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

## Ports Used

- **3001**: WebUI server (configurable with `--webui-port=`)
- **8181-8191**: Camera proxy servers (one per printer)

## Troubleshooting

**WebUI not accessible:**
- Check firewall settings allow the WebUI port
- Verify you're using the correct IP address

**Printer won't connect:**
- Ensure printer is on the same network
- Verify printer type (`new` vs `legacy`)
- For `new` type printers, ensure checkcode is correct

**Camera not working:**
- Verify printer camera is enabled
- Check ports 8181+ are not blocked
