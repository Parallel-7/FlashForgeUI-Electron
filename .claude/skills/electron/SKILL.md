---
name: electron
description: "Complete Electron documentation reference for building cross-platform desktop applications with JavaScript, HTML, and CSS. Use when Claude needs to: (1) Create or modify Electron applications, (2) Work with Electron APIs (main process, renderer process, IPC, windows, menus, etc.), (3) Implement Electron features like auto-updater, notifications, tray icons, native modules, (4) Handle Electron-specific concerns like security, sandboxing, packaging, distribution, (5) Debug or troubleshoot Electron applications, (6) Understand Electron's process model and architecture, (7) Reference Electron API methods, events, and structures."
---

# Electron Documentation

Complete reference documentation for Electron (latest version), scraped from https://www.electronjs.org/docs/latest/.

## Quick Reference

| Task | Index | Key Files |
|------|-------|-----------|
| **New to Electron?** | `00-main-index.md` | Start with overview and glossary |
| **First app** | `03-tutorials-index.md` | `tutorial-first-app.md` |
| **API lookup** | `01-api-index.md` | All 80+ API modules |
| **Type definitions** | `02-structures-index.md` | All 100+ structures |
| **Security** | `03-tutorials-index.md` | `tutorial-security.md`, `tutorial-sandbox.md` |
| **IPC/Communication** | `01-api-index.md` | `api-ipc-main.md`, `api-ipc-renderer.md` |
| **Windows** | `01-api-index.md` | `api-browser-window.md` |
| **Packaging** | `03-tutorials-index.md` | `tutorial-application-distribution.md` |
| **Auto-updates** | `01-api-index.md` | `api-auto-updater.md` |

## Documentation Navigation

### `00-main-index.md`
**Start here.** Core reference pages including:
- Overview and architecture (`why-electron.md`)
- Glossary of Electron terminology
- FAQ
- Breaking changes (for upgrades)

### `01-api-index.md`
All Electron API modules organized by category:
- **Application Lifecycle** - app, auto-updater, command-line
- **Windows & Views** - BrowserWindow, WebContents, BaseWindow
- **IPC** - ipc-main, ipc-renderer, context-bridge
- **Menus & UI** - menu, tray, dock, touch-bar
- **Networking** - net, web-request, protocol, session
- **System Integration** - shell, notification, global-shortcut
- And 15+ more categories

### `02-structures-index.md`
Type definitions and interfaces:
- Window options (BrowserWindowOptions, WebPreferences)
- IPC event objects
- Input events (keyboard, mouse)
- Permission requests
- Network types (cookie, upload, protocol)

### `03-tutorials-index.md`
Step-by-step guides organized by topic:
- **Getting Started** - first app, installation, prerequisites
- **Core Concepts** - process model, security, sandbox, IPC
- **Window Management** - customization, styles, title bar
- **UI Components** - menus, tray, shortcuts
- **Distribution** - packaging, code signing, updates, stores
- Includes suggested learning path for beginners

## Common Patterns

### Creating a Window
Reference: `api-browser-window.md`
```js
const { BrowserWindow } = require('electron')
const win = new BrowserWindow({ width: 800, height: 600 })
win.loadFile('index.html')
```

### IPC Communication
Reference: `api-ipc-main.md`, `api-ipc-renderer.md`, `tutorial-ipc.md`

### Security Checklist
Reference: `tutorial-security.md`
- Enable context isolation
- Enable sandbox
- Use context-bridge (not nodeIntegration)
- Validate all input

## File Locations

All 237 documentation pages are in `references/docs/`:
- `api-*.md` - API modules
- `api-structures-*.md` - Type definitions
- `tutorial-*.md` - Tutorials
- `breaking-changes.md`, `faq.md`, `glossary.md`, `why-electron.md` - Core reference
