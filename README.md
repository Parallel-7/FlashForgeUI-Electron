<div align="center">

<img width="48" height="48" alt="icon" src="https://github.com/user-attachments/assets/6f187987-027f-4b66-a4e4-3bc30be4ca90" />

# FlashForgeUI

**A modern cross-platform interface for FlashForge 3D printers**

![Platforms](https://img.shields.io/badge/Platforms-Win%20%7C%20macOS%20%7C%20Linux-3178c6?style=for-the-badge)
![Downloads](https://img.shields.io/github/downloads/Parallel-7/FlashForgeUI-Electron/total?style=for-the-badge&color=brightgreen)
![Latest](https://img.shields.io/github/downloads/Parallel-7/FlashForgeUI-Electron/latest/total?style=for-the-badge&color=blue)
![Version](https://img.shields.io/badge/Version-1.0.3--alpha.1-orange?style=for-the-badge)

**FlashForgeUI provides more features than all FlashForge software and is fully open-source**

</div>

---

<div align="center">

## Quick Links

| Resource | Description |
| --- | --- |
| **[Download Stable Release](https://github.com/Parallel-7/FlashForgeUI-Electron/releases/tag/v1.0.2)** | Production-ready stable build |
| **[Download Alpha Release](https://github.com/Parallel-7/FlashForgeUI-Electron/releases/tag/v1.0.2-alpha.9)** | Latest features and improvements |
| **[User Guide](https://github.com/Parallel-7/FlashForgeUI-Electron/tree/main/docs)** | Documentation and setup instructions |

</div>

---

<div align="center">

## Feature Comparison

**FlashForgeUI vs. Other FlashForge Software**

</div>

<div align="center">

| Feature | FlashForgeUI | OrcaSlicer | Orca-FlashForge | FlashPrint |
| --- | --- | --- | --- | --- |
| **Open Source** | Yes | Yes | No | No |
| **Cross-Platform** | Yes | Yes | Yes | Yes |
| **Preview File Metadata** | Full | Limited | Limited | No |
| **List Recent & Local Jobs** | Yes | No | Limited | Yes |
| **Full Printer Control** | Yes | No | No | No |
| **Multi-Printer Support** | Yes | No | No | No |
| **Mobile/Remote Access** | Yes (WebUI) | No | No | No |
| **Camera Preview** | Yes (Multi-Device) | Yes | Yes | Yes |
| **Spoolman Integration** | Yes | No | No | No |
| **Discord Notifications** | Yes | No | No | No |
| **Headless Mode** | Yes | No | No | No |

</div>

---

<div align="center">

## API Feature Coverage

**FlashForgeUI supports any network-enabled FlashForge printer**

</div>

<div align="center">

| Feature | Legacy Mode | New API |
| --- | --- | --- |
| **Recent & Local Files** | Yes | Yes |
| **Model Preview Images** | Yes (Slow) | Yes (Fast) |
| **Full Job Control** | Yes | Yes |
| **LED Control** | Yes | Yes |
| **Upload New Files** | No | Yes |
| **Printer Information** | Limited | Full |
| **Job Information** | Very Limited | Full |
| **Job Time & ETA** | No | Yes |
| **G&M Code Control** | Yes | Yes |
| **Camera Preview** | Setup Required | Built-in |
| **Material Station** | No | Yes (AD5X) |
| **Filtration Control** | No | Yes (AD5M Pro) |

</div>

---

<div align="center">

## Core Capabilities

</div>

<div align="center">

| Category | Features |
| --- | --- |
| **Multi-Printer Management** | Concurrent connections to multiple printers • Context-based architecture with unique IDs • Tab-based desktop UI and dropdown WebUI selector • Independent polling (3s active, 30s inactive) • Per-printer settings and saved configurations |
| **Camera Streaming** | MJPEG camera proxy (ports 8181-8191) • RTSP-to-WebSocket streaming with ffmpeg • Multi-device concurrent viewing • Auto-reconnection with exponential backoff • Custom camera URL support • FPS display overlay |
| **Job Management** | Local and recent job listing • File upload (.gcode, .gx, .3mf) • Start, pause, resume, cancel operations • Thumbnail preview caching • Metadata parsing (slicer info, print time, material usage) • AD5X multi-material 3MF support |
| **Real-Time Monitoring** | 3-second polling for active contexts • Live status updates (state, progress, temperatures) • Layer count and ETA tracking • Material usage monitoring • Material station status (AD5X) • Filtration state (AD5M Pro) |
| **Spoolman Integration** | Active spool assignment per printer • Automatic usage tracking on print completion • Weight and length-based tracking modes • Connection health monitoring • Search and select from Spoolman database • Badge display in UI |
| **Notifications** | Desktop notifications (complete, cooled) • Discord webhook integration with rich embeds • Configurable update intervals • Audio and visual alert options • Multi-context notification coordination • Rate limiting and error handling |
| **Remote Access (WebUI)** | Headless mode operation • Password-protected authentication • Real-time WebSocket updates • Responsive mobile design • GridStack layout with persistence • Full feature parity with desktop UI |
| **Advanced Controls** | G-code/M-code terminal • Temperature control (bed, nozzle, cooling) • LED control (built-in and custom) • Filtration modes (AD5M Pro) • Axis homing and platform clearing • Custom command execution |

</div>

---

<div align="center">

## Printer Support Matrix

</div>

<div align="center">

| Printer Model | Support Status | Testing Status | API Type | Material Station | Built-in Camera |
| --- | --- | --- | --- | --- | --- |
| **AD5X** | Full | Tested | HTTP + TCP | Yes (4 slots) | No |
| **Adventurer 5M Pro** | Full | Tested | HTTP + TCP | No | Yes (RTSP) |
| **Adventurer 5M** | Full | Tested | HTTP + TCP | No | No |
| **Adventurer 3/4** | Full | Partial | TCP (Legacy) | No | No |
| **Older Models** | Legacy Mode | Untested | TCP (Legacy) | No | No |

**Note:** Full local file listing is not available on AD5X and may be removed by FlashForge in future firmware updates to 5M/Pro models.

</div>

---

<div align="center">

## Backend Capabilities

</div>

<div align="center">

| Feature | Legacy | AD5M | AD5M Pro | AD5X |
| --- | --- | --- | --- | --- |
| **Local Jobs List** | Yes (M661) | Yes | Yes | No |
| **Recent Jobs List** | Yes (10 files) | Yes | Yes | Yes |
| **File Upload** | No | Yes | Yes | Yes (3MF) |
| **Job Control** | Yes | Yes | Yes | Yes |
| **Model Preview** | Yes (M662, slow) | Yes (fast) | Yes (fast) | Yes (fast) |
| **Thumbnail Cache** | Yes | Yes | Yes | Yes |
| **Built-in Camera** | No | No | Yes (RTSP) | No |
| **Custom Camera** | Yes | Yes | Yes | Yes |
| **LED Control** | G-code | G-code | Built-in + G-code | G-code (custom) |
| **Filtration Control** | No | No | Yes | No |
| **Material Station** | No | No | No | Yes (4 slots) |
| **Spoolman Support** | Yes | Yes | Yes | No (blocked) |

</div>

---

<div align="center">

## Platform Support

</div>

<div align="center">

| Platform | Architecture | Status |
| --- | --- | --- |
| **Windows** | x64 | Full Support |
| **macOS** | Intel, Apple Silicon | Full Support |
| **Linux** | x64, ARM64 | Full Support |

**Electron-based cross-platform architecture ensures consistent behavior across all operating systems**

</div>

---

<div align="center">

## Quick Start

</div>

<div align="center">

| Step | Instructions |
| --- | --- |
| **1. Download** | Get the latest release for your platform from the [Releases](https://github.com/Parallel-7/FlashForgeUI-Electron/releases) page |
| **2. Install** | **Windows:** Run `.exe` installer • **macOS:** Open `.dmg` and drag to Applications • **Linux:** Use `.AppImage`, `.deb`, or `.rpm` package |
| **3. Connect Printer** | Launch FlashForgeUI • Use auto-discovery or manual IP entry • Enter pairing code if required (AD5M/Pro/AD5X) |
| **4. Configure (Optional)** | Set up WebUI password • Configure Discord webhook • Connect Spoolman server • Customize themes and camera settings |

</div>

---

<div align="center">

## Headless Mode

**Run FlashForgeUI as a server without desktop UI**

</div>

<div align="center">

| Argument | Description | Example |
| --- | --- | --- |
| `--headless` | Enable headless mode (WebUI only) | `./FlashForgeUI --headless` |
| `--last-used` | Connect to last used printer | `./FlashForgeUI --headless --last-used` |
| `--all-saved-printers` | Connect to all saved printers | `./FlashForgeUI --headless --all-saved-printers` |
| `--printers` | Connect to specific printers | `--printers="192.168.1.100:AD5M:12345678"` |
| `--webui-port` | Set WebUI port (default: 3000) | `--webui-port=8080` |
| `--webui-password` | Override WebUI password | `--webui-password=mypassword` |

**Format for `--printers`:** `<ip>:<type>:<checkcode>[,<ip>:<type>:<checkcode>...]`
**Types:** `AD5X`, `AD5M`, `AD5M_PRO`, `LEGACY`

</div>

---

<div align="center">

## Development

</div>

<div align="center">

| Command | Description |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build main process, renderer, and WebUI |
| `npm run build:win` | Build Windows installer |
| `npm run build:mac` | Build macOS package |
| `npm run build:linux` | Build Linux packages |
| `npm run type-check` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix linting issues |
| `npm run docs:check` | Validate fileoverview documentation |

</div>

---

<div align="center">

## Technology Stack

</div>

<div align="center">

| Component | Technology | Version |
| --- | --- | --- |
| **Framework** | Electron | ^35.7.5 |
| **Build Tool** | Vite (via electron-vite) | ^7.2.4 |
| **Language** | TypeScript | ^5.7.2 |
| **UI Framework** | GridStack | ^12.3.3 |
| **Icons** | Lucide | ^0.552.0 |
| **Backend** | Express | ^5.1.0 |
| **WebSocket** | ws | ^8.18.3 |
| **RTSP Streaming** | node-rtsp-stream | ^0.0.9 |
| **Validation** | Zod | ^4.0.5 |
| **Metadata Parsing** | @parallel-7/slicer-meta | ^1.1.0 |
| **FF API** | @ghosttypes/ff-api | latest |

</div>

---

<div align="center">

## Configuration

</div>

<div align="center">

| Category | Settings |
| --- | --- |
| **Notifications** | Print completion alerts • Cooling alerts • Audio alerts • Visual alerts • Discord webhook integration |
| **Camera** | Custom camera URL • RTSP frame rate and quality • MJPEG proxy port • FPS overlay display |
| **WebUI** | Enable/disable • Port configuration • Password protection • Authentication settings |
| **Spoolman** | Server URL • Weight vs length tracking mode • Connection testing • Active spool selection |
| **Theme** | Desktop theme profiles • WebUI theme profiles • Custom color palettes • Rounded UI mode |
| **Updates** | Update channel (stable/alpha) • Check on launch • Auto-download updates |
| **Advanced** | Debug mode • Force legacy API • Custom LED support • Always on top window |

**Settings are stored in:**
- **Global:** `config.json` in app data directory
- **Per-Printer:** `printer_details.json` in app data directory

</div>

---

<div align="center">

## G-code/M-code Support

**FlashForgeUI supports 50+ G-code and M-code commands**

</div>

<div align="center">

| Category | Commands |
| --- | --- |
| **Movement** | G0, G1, G28 (home), G29 (bed level), G90, G91, G92 |
| **Temperature** | M104 (set extruder), M105 (get temp), M109 (set and wait), M140 (set bed), M190 (bed and wait) |
| **Fans** | M106 (fan on), M107 (fan off) |
| **Job Control** | M20 (list SD), M23 (select file), M24 (start/resume), M25 (pause), M26 (cancel) |
| **Advanced** | M220 (speed factor), M221 (flow rate), M301-M304 (PID tuning), M500-M504 (EEPROM) |

</div>

---

<div align="center">

## Material Station (AD5X)

**4-slot filament management system for multi-color printing**

</div>

<div align="center">

| Feature | Description |
| --- | --- |
| **Slot Monitoring** | Real-time tracking of all 4 material slots • Material type and color detection • Active slot indication |
| **Multi-Material Printing** | Upload 3MF files with material mappings • Assign virtual extruders to physical slots • Color matching and validation |
| **Status Display** | Per-slot heating temperatures • Loaded material information • Material station component in UI |
| **Spoolman Exclusion** | Spoolman integration automatically disabled for AD5X • Material station takes precedence for filament tracking |

</div>

---

<div align="center">

## Architecture

</div>

<div align="center">

| Component | Description |
| --- | --- |
| **Main Process** | Electron main process • Manager singletons (Config, Context, Backend, HeadlessDetails) • Service coordination • IPC handler registration |
| **Renderer Process** | Component system • GridStack layout engine • Tab management • Real-time polling updates |
| **WebUI Server** | Express REST API • WebSocket manager • JWT authentication • Static file serving |
| **Printer Backends** | Backend abstraction layer • AD5X, AD5M, AD5M Pro, Legacy implementations • Feature detection and capability flags |
| **Service Layer** | Polling coordinators • Print state monitors • Temperature monitors • Notification coordinators • Spoolman trackers |
| **IPC Layer** | 15+ handler modules • Type-safe preload bridge • Channel whitelisting • Multi-window support |

</div>

---

<div align="center">

## License

MIT License - Copyright (c) 2025 GhostTypes

</div>

---

<div align="center">

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Parallel-7/FlashForgeUI,Parallel-7/FlashForgeUI-Electron&type=Date)](https://www.star-history.com/#Parallel-7/FlashForgeUI&Parallel-7/FlashForgeUI-Electron&Date)

</div>
