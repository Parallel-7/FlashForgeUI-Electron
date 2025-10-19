# Codex Agent Handbook

This guide captures project-specific expectations for OpenAI Codex agents assisting in the FlashForgeUI-Electron repository. It summarizes operational guardrails, preferred workflows, and high-value reference points so future Codex sessions can ramp up quickly without depending on Claude-only resources.

## Operating Rules for Codex

- **Shell usage**: Always invoke commands through `["bash","-lc", "<command>"]` and set the `workdir` on every call. Prefer `rg`/`rg --files` for search.
- **File editing**: Use `apply_patch` for hand-written edits; avoid it for auto-generated outputs (e.g., `npm install`, formatters). Never touch files outside user instructions and never revert user-owned changes.
- **Planning discipline**: Create multi-step plans for anything non-trivial and keep the plan in sync as work progresses. Skip planning only for the simplest tasks.
- **Testing mindset**: Favor targeted verification (type checking, linting) over full builds unless the user requests otherwise or build validation is obviously necessary.
- **Escalation etiquette**: Sandbox is `workspace-write`, network is restricted, and approval policy is `on-request`. Request elevation only when essential, providing concise justification.
- **Interaction style**: Keep responses concise, friendly, and actionable. Reference files with `path:line` syntax. Suggest next steps only when they are natural.

## Key Repository Facts

- **Project scope**: FlashForgeUI is an Electron desktop application that supports multiple simultaneous printer contexts with tabbed switching, camera streaming, and backend polling coordination.
- **Architecture anchors**:
  - `src/managers/PrinterContextManager.ts`: lifecycle for per-printer contexts.
  - `src/services/MultiContextPollingCoordinator.ts`: adjusts polling cadence per context.
  - `src/ui/components/printer-tabs/`: renderer-side UI for active context selection.
  - `src/utils/PortAllocator.ts`: assigns unique camera proxy ports (8181-8191).
- **Feature status**: Multi-printer support is fully implemented but still untested in runtime scenarios (filament tracking, WebUI flows, simultaneous jobs, camera streams, etc.).
- **Documentation standard**: Every TypeScript/JavaScript source file should carry an `@fileoverview` header describing purpose, responsibilities, dependencies, and usage context.

### Sample `@fileoverview` Blocks

```ts
/**
 * @fileoverview Connection flow orchestrator for managing printer discovery and connection workflows.
 *
 * Provides high-level coordination of printer connection operations in multi-context environment:
 * - Network discovery flow management with printer selection
 * - Direct IP connection support with check code prompts
 * - Auto-connect functionality for previously connected printers
 * - Saved printer management and connection restoration
 * - Connection state tracking and event forwarding
 * - Multi-context connection flow tracking for concurrent connections
 *
 * Key exports:
 * - ConnectionFlowManager class: Main connection orchestrator
 * - getPrinterConnectionManager(): Singleton accessor function
 *
 * The manager coordinates multiple specialized services:
 * - PrinterDiscoveryService: Network scanning and printer detection
 * - SavedPrinterService: Persistent printer storage
 * - AutoConnectService: Automatic connection on startup
 * - ConnectionStateManager: Connection state tracking
 * - DialogIntegrationService: User interaction dialogs
 * - ConnectionEstablishmentService: Low-level connection setup
 *
 * Supports concurrent connection flows with unique flow IDs and context tracking,
 * enabling multi-printer connections while maintaining proper state isolation.
 */
```

```ts
/**
 * @fileoverview Central WebUI server coordinator managing Express HTTP server and WebSocket lifecycle.
 *
 * Provides comprehensive management of the WebUI server including Express HTTP server initialization,
 * static file serving, middleware configuration, API route registration, WebSocket server setup,
 * and integration with printer backend services. Automatically starts when a printer connects
 * (if enabled in settings) and stops on disconnect. Handles administrator privilege requirements
 * on Windows platforms, network interface detection for LAN access, and configuration changes
 * for dynamic server restart. Coordinates between HTTP API routes, WebSocket real-time updates,
 * and polling data from the main process to provide seamless remote printer control and monitoring.
 *
 * Key exports:
 * - WebUIManager class: Main server coordinator with singleton pattern
 * - getWebUIManager(): Singleton accessor function
 * - Lifecycle: start, stop, initialize, startForPrinter, stopForPrinter
 * - Status: getStatus, isServerRunning, getExpressApp, getHttpServer
 * - Integration: handlePollingUpdate (receives status from main process)
 * - Events: 'server-started', 'server-stopped', 'printer-connected', 'printer-disconnected'
 */
```

```ts
/**
 * @fileoverview Printer Tabs Component for Multi-Printer Support
 *
 * This component provides a tabbed interface for managing multiple printer connections
 * similar to Orca-FlashForge's tabbed interface. It extends EventEmitter to notify
 * the renderer process of user interactions with tabs.
 *
 * Key features:
 * - Tab management (add, remove, switch, update)
 * - Connection status indicators (connected, connecting, disconnected, error)
 * - Close buttons on tabs with hover effects
 * - "Add Printer" button for creating new connections
 * - Event emission for tab interactions (click, close, add)
 * - Visual distinction between active and inactive tabs
 *
 * Events:
 * - 'tab-clicked': Emitted when a tab is clicked (contextId: string)
 * - 'tab-closed': Emitted when a tab's close button is clicked (contextId: string)
 * - 'add-printer-clicked': Emitted when the add printer button is clicked
 */
```

## High-Value Scripts & Commands

Use these npm scripts to enforce quality checks and gather insights:

| Command | Purpose | Notes |
| --- | --- | --- |
| `npm run type-check` | TypeScript validation (`tsc --noEmit`). | Report success/fail clearly; fix root causes before completion. |
| `npm run lint` / `npm run lint:fix` | ESLint checks and auto-fixes on `src/**/*.ts`. | Auto-fix first; re-run lint to confirm clean state. |
| `npm run docs:check` | PowerShell script scanning for missing `@fileoverview`. | Use findings to prioritize documentation updates. |
| `npm run knip` (+ variants) | Dead code and dependency analysis via Knip. | Review results carefully; Electron patterns create false positives. |
| `npm run build:*` | Build main, renderer, WebUI, or platform packages. | Run only when requested or required for verification. |

Remember PowerShell scripts (`docs:*`, `linecount`) assume Windows-friendly environment; confirm availability before invoking.

## Recommended Workflow Templates

### General Code Change

1. **Context**: Review relevant files (`rg`, `codebase exploration`) and check `CLAUDE.md` for recent architecture notes.
2. **Plan**: Outline steps, call out affected modules and validation strategy.
3. **Implement**: Modify files via `apply_patch` with minimal, well-structured commits.
4. **Document**: Ensure new/changed files keep `@fileoverview` headers up to date.
5. **Verify**: Run `npm run type-check` and `npm run lint`; add other checks only if warranted.
6. **Report**: Summarize changes, mention validations, and suggest next steps (e.g., build, documentation review).

### Documentation-Only Task

1. Identify files lacking headers with `npm run docs:check`.
2. Read the target file to understand responsibilities.
3. Add or update the `@fileoverview` block using succinct prose that covers purpose, key exports, dependencies, and usage notes.
4. Re-run `npm run docs:check` if the user requests confirmation.

### Bug Investigation

1. Capture current state with `git status`/`git diff` if necessary (respect sandbox rules).
2. Trace the data flow and key code paths using targeted `rg` queries.
3. Hypothesize root cause; confirm by inspecting adjacent modules (services, managers, IPC handlers).
4. Plan remediation, communicate assumptions, and only then implement.

### Review Request

1. Focus on identifying defects, risky patterns, missing tests, or documentation gaps.
2. Reference findings with precise file locations (`path:line`).
3. Keep high-level summaries short; lead with concrete issues.

## Testing & Runtime Limitations

- Cannot launch the Electron app, manipulate real printers, or validate UI visually.
- Restricted to static analysis, type checking, linting, and script-driven tooling.
- Treat any runtime-dependent assumption as unverified; call it out in deliverables.

## Helpful Reference Files

- `CLAUDE.md`: High-level development guide (multi-printer architecture, testing limitations).
- `ai_reference/ARCHITECTURE.md`: Deep dive into system components and interactions.
- `ai_reference` folder: Central knowledge base for this project. Add new long-form guidance here and consult existing references before tackling related work.
- `ai_reference/typescript-best-practices.md` & `ai_reference/electron-typescript-best-practices.md`: **Mandatory pre-reading before any programming task.** Revisit these documents at the start of every coding session to stay aligned with project standards.
- `.claude/commands/*.md`: Predefined workflows (load changes, lint, type-check, auto-document, dead code analysis).

Consult these resources early in a session to align with established expectations.

## Recent Lessons

- Component dialog preload files must never import `.d.ts` modules at runtime—use `import type {} from '../../types/global';` to keep typings without breaking the window bootstrap.
- The dialog relies on untouched `polling-update` payloads; avoid “fixing” the shape or you risk swallowing updates and rendering an empty dialog.
- GridStack initialization already performs component registration/initialization; removing or duplicating that logic leaves global references (e.g., log panel) unset. Preserve the existing flow unless you have a tested replacement.

## Practical Tips for Codex

- Prefer incremental `rg` searches over full `find`/`grep` when locating files or symbols.
- When editing large files, consider using `sed -n 'start,endp'` to preview relevant sections before patching.
- Keep diffs minimal and purposeful; bundle related changes together.
- If instructions conflict, prioritize user directives → developer message → system message hierarchy.
- Surface uncertainties explicitly and propose validation steps the user can run (e.g., `npm run build`, manual UI tests).

By following this handbook, Codex agents can contribute confidently while honoring repository standards and operational constraints.
