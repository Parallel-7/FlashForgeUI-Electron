# Electron Documentation - Main Index

This is the entry point for Electron documentation. Start here for overview and foundational concepts.

## Core Reference Pages

| File | Purpose |
|------|---------|
| `docs/t.md` | Main documentation landing page (index) |
| `docs/why-electron.md` | What is Electron, when to use it, architecture overview |
| `docs/glossary.md` | Electron terminology (Main Process, Renderer Process, etc.) |
| `docs/faq.md` | Frequently Asked Questions |
| `docs/breaking-changes.md` | Breaking changes by version - critical when upgrading |

## Quick Start Flow

1. **New to Electron?** Start with `why-electron.md` and `glossary.md`
2. **Building your first app?** Go to `03-tutorials-index.md` and find "tutorial-first-app"
3. **Looking up an API?** Go to `01-api-index.md`
4. **Upgrading Electron?** Check `breaking-changes.md`
5. **Contributing?** Go to `04-development-index.md`

## Key Concepts from Glossary

- **Main Process**: The entry point of every Electron app (runs Node.js)
- **Renderer Process**: Runs the web page content (Chromium)
- **Context Bridge**: Safe communication between sandboxed renderer and main process
- **IPC (Inter-Process Communication)**: How main and renderer processes communicate
