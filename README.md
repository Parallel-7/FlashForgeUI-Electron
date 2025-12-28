<div align="center">

<img width="48" height="48" alt="icon" src="https://github.com/user-attachments/assets/6f187987-027f-4b66-a4e4-3bc30be4ca90" />

# FlashForgeUI

**A modern cross-platform interface for FlashForge 3D printers**

![Platforms](https://img.shields.io/badge/Platforms-Win%20%7C%20macOS%20%7C%20Linux-3178c6?style=flat)
![Downloads](https://img.shields.io/github/downloads/Parallel-7/FlashForgeUI-Electron/total?style=flat&color=brightgreen)
![Latest](https://img.shields.io/github/downloads/Parallel-7/FlashForgeUI-Electron/latest/total?style=flat&color=blue)
![Version](https://img.shields.io/badge/Version-1.0.3--alpha.1-orange?style=flat)

![Electron](https://img.shields.io/badge/Electron-35.7.5-47848f?style=flat&logo=electron)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-3178c6?style=flat&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7.2.4-646cff?style=flat&logo=vite)
![Express](https://img.shields.io/badge/Express-5.1.0-000000?style=flat&logo=express)
![GridStack](https://img.shields.io/badge/GridStack-12.3.3-purple?style=flat)
![Lucide](https://img.shields.io/badge/Lucide-0.552.0-f56565?style=flat)

**FlashForgeUI provides more features than all FlashForge software and is fully open-source**

</div>

<div align="center">

## Quick Links

| Resource | Description |
| --- | --- |
| **[Download Stable Release](https://github.com/Parallel-7/FlashForgeUI-Electron/releases/tag/v1.0.2)** | Production-ready stable build |
| **[Download Alpha Release](https://github.com/Parallel-7/FlashForgeUI-Electron/releases/tag/v1.0.2-alpha.9)** | Latest features and improvements |
| **[User Guide](https://github.com/Parallel-7/FlashForgeUI-Electron/tree/main/docs)** | Documentation and setup instructions |

</div>

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

<div align="center">

## Core Capabilities

</div>

<div align="center">

| Category | Features |
| --- | --- |
| **Multi-Printer Management** | Concurrent connections to multiple printers<br>Context-based architecture with unique IDs<br>Tab-based desktop UI and dropdown WebUI selector<br>Independent polling (3s active, 30s inactive)<br>Per-printer settings and saved configurations |
| **Camera Streaming** | MJPEG camera proxy (ports 8181-8191)<br>RTSP-to-WebSocket streaming with ffmpeg<br>Multi-device concurrent viewing<br>Auto-reconnection with exponential backoff<br>Custom camera URL support<br>FPS display overlay |
| **Job Management** | Local and recent job listing<br>File upload (.gcode, .gx, .3mf)<br>Start, pause, resume, cancel operations<br>Thumbnail preview caching<br>Metadata parsing (slicer info, print time, material usage)<br>AD5X multi-material 3MF support |
| **Real-Time Monitoring** | 3-second polling for active contexts<br>Live status updates (state, progress, temperatures)<br>Layer count and ETA tracking<br>Material usage monitoring<br>Material station status (AD5X)<br>Filtration state (AD5M Pro) |
| **Spoolman Integration** | Active spool assignment per printer<br>Automatic usage tracking on print completion<br>Weight and length-based tracking modes<br>Connection health monitoring<br>Search and select from Spoolman database<br>Badge display in UI |
| **Notifications** | Desktop notifications (complete, cooled)<br>Discord webhook integration with rich embeds<br>Configurable update intervals<br>Audio and visual alert options<br>Multi-context notification coordination<br>Rate limiting and error handling |
| **Remote Access (WebUI)** | Headless mode operation<br>Password-protected authentication<br>Real-time WebSocket updates<br>Responsive mobile design<br>GridStack layout with persistence<br>Full feature parity with desktop UI |
| **Advanced Controls** | G-code/M-code terminal<br>Temperature control (bed, nozzle, cooling)<br>LED control (built-in and custom)<br>Filtration modes (AD5M Pro)<br>Axis homing and platform clearing<br>Custom command execution |

</div>

<div align="center">

## Printer Support Matrix

</div>

<div align="center">

| Printer Model | Support Status | Testing Status | API Type | Material Station | Built-in Camera |
| --- | --- | --- | --- | --- | --- |
| **AD5X** | Full | Tested | HTTP + TCP | Yes (4 slots) | No |
| **Adventurer 5M Pro** | Full | Tested | HTTP + TCP | No | Yes |
| **Adventurer 5M** | Full | Tested | HTTP + TCP | No | No |
| **Adventurer 3/4** | Full | Partial | TCP (Legacy) | No | No |
| **Older Models** | Legacy Mode | Untested | TCP (Legacy) | No | No |

**Note:** Full local file listing is not available on AD5X and may be removed by FlashForge in future firmware updates to 5M/Pro models.

</div>

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

<div align="center">

## Quick Start

</div>

<div align="center">

| Step | Instructions |
| --- | --- |
| **1. Download** | Get the latest release for your platform from the [Releases](https://github.com/Parallel-7/FlashForgeUI-Electron/releases) page |
| **2. Install** | **Windows:** Run `.exe` installer<br>**macOS:** Open `.dmg` and drag to Applications<br>**Linux:** Use `.AppImage`, `.deb`, or `.rpm` package |
| **3. Connect Printer** | Launch FlashForgeUI<br>Use auto-discovery or manual IP entry<br>Enter pairing code if required (AD5M/Pro/AD5X) |
| **4. Configure (Optional)** | Set up WebUI password<br>Configure Discord webhook<br>Connect Spoolman server<br>Customize themes and camera settings |

</div>

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

**Format for `--printers`:** `<ip>:<type>:<checkcode>[,<ip>:<type>:<checkcode>...]`<br>
**Types:** `AD5X`, `AD5M`, `AD5M_PRO`, `LEGACY`

</div>

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

<div align="center">

## Configuration

</div>

<div align="center">

| Category | Settings |
| --- | --- |
| **Notifications** | Print completion alerts<br>Cooling alerts<br>Audio alerts<br>Visual alerts<br>Discord webhook integration |
| **Camera** | Custom camera URL<br>RTSP frame rate and quality<br>MJPEG proxy port<br>FPS overlay display |
| **WebUI** | Enable/disable<br>Port configuration<br>Password protection<br>Authentication settings |
| **Spoolman** | Server URL<br>Weight vs length tracking mode<br>Connection testing<br>Active spool selection |
| **Theme** | Desktop theme profiles<br>WebUI theme profiles<br>Custom color palettes<br>Rounded UI mode |
| **Updates** | Update channel (stable/alpha)<br>Check on launch<br>Auto-download updates |
| **Advanced** | Debug mode<br>Force legacy API<br>Custom LED support<br>Always on top window |
| **Storage** | **Global:** `config.json` in app data directory<br>**Per-Printer:** `printer_details.json` in app data directory |

</div>

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

<div align="center">

## Material Station (AD5X)

**4-slot filament management system for multi-color printing**

</div>

<div align="center">

| Feature | Description |
| --- | --- |
| **Slot Monitoring** | Real-time tracking of all 4 material slots<br>Material type and color detection<br>Active slot indication |
| **Multi-Material Printing** | Upload 3MF files with material mappings<br>Assign virtual extruders to physical slots<br>Color matching and validation |
| **Status Display** | Per-slot heating temperatures<br>Loaded material information<br>Material station component in UI |
| **Spoolman Exclusion** | Spoolman integration automatically disabled for AD5X<br>Material station takes precedence for filament tracking |

</div>

<div align="center">

## Architecture

</div>

<div align="center">

| Component | Description |
| --- | --- |
| **Main Process** | Electron main process<br>Manager singletons (Config, Context, Backend, Details)<br>Service coordination<br>IPC handler registration |
| **Renderer Process** | Component system<br>GridStack layout engine<br>Tab management<br>Real-time polling updates |
| **WebUI Server** | Express REST API<br>WebSocket manager<br>JWT authentication<br>Static file serving |
| **Printer Backends** | Backend abstraction layer<br>AD5X, AD5M, AD5M Pro, Legacy implementations<br>Feature detection and capability flags |
| **Service Layer** | Polling coordinators<br>Print state monitors<br>Temperature monitors<br>Notification coordinators<br>Spoolman trackers |
| **IPC Layer** | 15+ handler modules<br>Type-safe preload bridge<br>Channel whitelisting<br>Multi-window support |

</div>

<div align="center">

## License

MIT License - Copyright (c) 2025 GhostTypes

</div>

<div align="center">

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Parallel-7/FlashForgeUI,Parallel-7/FlashForgeUI-Electron&type=Date)](https://www.star-history.com/#Parallel-7/FlashForgeUI&Parallel-7/FlashForgeUI-Electron&Date)

</div>
