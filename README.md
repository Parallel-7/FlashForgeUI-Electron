<div align="center">

<img width="48" height="48" alt="icon" src="https://github.com/user-attachments/assets/6f187987-027f-4b66-a4e4-3bc30be4ca90" />

# FlashForgeUI

**A modern, open-source desktop and mobile interface for FlashForge 3D printers**

![Platforms](https://img.shields.io/badge/Platforms-Win%20%7C%20macOS%20%7C%20Linux-3178c6?style=flat)
![Downloads](https://img.shields.io/github/downloads/Parallel-7/FlashForgeUI-Electron/total?style=flat&color=brightgreen)
![Version](https://img.shields.io/github/v/release/Parallel-7/FlashForgeUI-Electron?include_prereleases&style=flat&color=orange&label=Version)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat)

**Monitor and control your printer from your desktop or any device on your network &mdash; with more features than any official FlashForge software, completely free.**

</div>

<div align="center">

| Get Started | |
| --- | --- |
| **[Download Stable](https://github.com/Parallel-7/FlashForgeUI-Electron/releases/latest)** | Recommended for most users |
| **[Download Latest Alpha](https://github.com/Parallel-7/FlashForgeUI-Electron/releases)** | Newest features, may be rough around the edges |
| **[User Guide & Wiki](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki)** | Setup, pairing, and feature walkthroughs |

</div>

## Overview

FlashForgeUI connects directly to your FlashForge printer over your local network &mdash; no cloud account required. Watch live camera and temperature data, start and manage prints, control LEDs and filtration, and keep an eye on multiple printers at once. When you're away from your desk, the built-in WebUI gives you the same control from your phone or any browser, and headless mode lets you run it as a lightweight always-on server.

<div align="center">

## How It Compares

| Feature | FlashForgeUI | OrcaSlicer | Orca-FlashForge | FlashPrint |
| --- | --- | --- | --- | --- |
| **Open Source** | Yes | Yes | No | No |
| **Cross-Platform** | Yes | Yes | Yes | Yes |
| **Full Printer Control** | Yes | No | No | No |
| **Mobile / Remote Access** | Yes (WebUI) | No | No | No |
| **Multi-Printer Management** | Yes | No | No | No |
| **Camera Preview** | Yes | Yes | Yes | Yes |
| **Headless / Server Mode** | Yes | No | No | No |
| **Spoolman Integration** | Yes | No | No | No |
| **Discord Notifications** | Yes | No | No | No |
| **Preview File Metadata** | Full | Limited | Limited | No |

</div>

<div align="center">

## Features

| Capability | What You Get |
| --- | --- |
| **Live Monitoring** | Real-time status, temperatures, progress, layer count, and ETA &mdash; updated every few seconds |
| **Full Print Control** | Start, pause, resume, and cancel jobs • upload `.gcode` / `.gx` / `.3mf` files • browse recent and local jobs with thumbnail previews |
| **[Camera Streaming](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/Custom-Camera-Setup)** | Auto-detected OEM cameras plus custom RTSP/HTTP sources • watch from multiple devices at once |
| **[Multi-Printer Management](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/Connecting-to-Multiple-Printers)** | Connect to several printers concurrently • tabbed desktop UI and dropdown WebUI selector • independent per-printer settings |
| **[Remote Access (WebUI)](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/WebUI-Setup)** | Password-protected, mobile-friendly web interface with full feature parity to the desktop app |
| **[Headless Mode](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/Headless-Mode)** | Run as a server with no desktop UI &mdash; ideal for a Raspberry Pi or always-on machine |
| **[Spoolman Integration](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/Spoolman-Integration)** | Track filament usage automatically and assign spools per printer |
| **[Notifications](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/Notifications)** | Desktop and Discord alerts for print completion, cooldown, and more |
| **Hardware Controls** | Temperature, LED, and filtration control • axis homing • clear platform • direct command terminal |
| **Printer File Manager** | Browse, rename, and delete files stored on the printer and on USB, with thumbnail previews &mdash; desktop and WebUI • 5M / 5M Pro / AD5X, requires SSH access via [FlashForge-EasySSH](https://github.com/Parallel-7/FlashForge-EasySSH) |
| **Calibration Assistant** | Read and analyze on-printer calibration data to help diagnose print quality &mdash; same models and SSH requirement as the file manager |
| **Start with System** | Optionally launch at login on Windows, macOS, and Linux &mdash; start minimized to the tray and let prints run unattended |
| **[Customizable UI](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/Customizing-the-Desktop-UI)** | Drag-and-drop layouts, light/dark themes, and custom color palettes on both desktop and WebUI |

</div>

<div align="center">

## Supported Printers

| Printer | Support | Material Station | Notes |
| --- | --- | --- | --- |
| **Creator 5 Pro** | Full | Yes (4 slots) | HTTP-only API |
| **Creator 5** | Full | Yes (4 slots) | HTTP-only API |
| **AD5X** | Full | Yes (4 slots) | Multi-material 3MF printing |
| **Adventurer 5M Pro** | Full | No | Includes filtration control |
| **Adventurer 5M** | Full | No | |
| **Adventurer 3 / 4** | Full | No | Legacy API |
| **Older Models** | Legacy Mode | No | Untested, basic control |

**Newer printers (5M series and up) require LAN-only mode and a one-time pairing code &mdash; see [Pairing Your Printer](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/1.-Pairing-your-printer).**

</div>

<div align="center">

## Quick Start

| Step | Instructions |
| --- | --- |
| **1. Download** | Grab the [latest release](https://github.com/Parallel-7/FlashForgeUI-Electron/releases/latest) for your platform |
| **2. Install** | **Windows:** run the `.exe` installer<br>**macOS:** open the `.dmg` and drag to Applications<br>**Linux:** install the `.deb` or `.rpm`, or run the `.AppImage` directly &mdash; on Ubuntu 24.04+ prefer the `.deb`, see [Linux Notes](docs/README.md#linux-notes) |
| **3. Connect** | Launch the app, use auto-discovery or enter your printer's IP, and add the [pairing code](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/1.-Pairing-your-printer) if prompted |
| **4. Configure** | Optional: set up [remote access](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/WebUI-Setup), [Discord alerts](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/Notifications), [Spoolman](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/Spoolman-Integration), and [custom cameras](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki/Custom-Camera-Setup) |

Full setup walkthroughs and troubleshooting live in the **[Wiki](https://github.com/Parallel-7/FlashForgeUI-Electron/wiki)**.

</div>

<div align="center">

## Building from Source

</div>

This project uses [pnpm](https://pnpm.io/).

```bash
pnpm install      # install dependencies
pnpm dev          # start with hot reload
pnpm build        # build main, renderer, and WebUI
pnpm build:win    # package a Windows installer
pnpm build:mac    # package a macOS build
pnpm build:linux  # package Linux artifacts
```

<div align="center">

![Electron](https://img.shields.io/badge/Electron-39.8.10-47848f?style=flat&logo=electron)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178c6?style=flat&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7.3.6-646cff?style=flat&logo=vite)
![Express](https://img.shields.io/badge/Express-5.2.1-000000?style=flat&logo=express)

## License

MIT License &mdash; Copyright (c) 2025 GhostTypes

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Parallel-7/FlashForgeUI,Parallel-7/FlashForgeUI-Electron&type=Date)](https://www.star-history.com/#Parallel-7/FlashForgeUI&Parallel-7/FlashForgeUI-Electron&Date)

</div>
