# FlashForgeUI-Electron Development Guide

**Last Updated:** 2025-10-03 21:38 ET

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Keeping This File Current

**IMPORTANT**: This file is automatically loaded into Claude Code's context at the start of each session. To ensure accuracy:

1. **Check the timestamp** above against the current date/time at the start of each session
2. **If it's been more than 24 hours** since the last update, suggest reviewing and updating this file
3. **After confirming with the user**, review all sections for accuracy against the current codebase state
4. **Update the timestamp** after making any changes to this file
5. **CRITICAL**: ALWAYS use the `mcp__time__get_current_time` tool with timezone `America/New_York` to get the accurate current time before updating the timestamp - NEVER guess or manually write timestamps

The information in this file directly influences how Claude Code understands and works with the codebase, so keeping it current is essential for effective assistance.

## Project Overview

FlashForgeUI is an Electron-based desktop application for monitoring and controlling FlashForge 3D printers. The application provides comprehensive printer management, job control, material station monitoring, and camera streaming capabilities with full support for managing multiple simultaneous printer connections.

### Multi-Printer Architecture

The application now supports managing multiple printer connections simultaneously with a tabbed interface:

**Core Components:**
- **PrinterContextManager** (`src/managers/PrinterContextManager.ts`): Singleton manager that creates and tracks multiple printer contexts, each with its own backend, polling service, camera proxy, and connection state
- **MultiContextPollingCoordinator** (`src/services/MultiContextPollingCoordinator.ts`): Manages polling services across contexts with dynamic frequency adjustment (active contexts poll at 3s, inactive at 3s to maintain TCP keep-alive)
- **PrinterTabsComponent** (`src/ui/components/printer-tabs/`): Tabbed UI interface for switching between connected printers
- **PortAllocator** (`src/utils/PortAllocator.ts`): Manages unique camera proxy port allocation per context (range: 8181-8191)

**Key Concepts:**
- Each printer connection gets a unique **context ID** (e.g., `context-1-1733357937000`)
- One context is "active" at any time, determining which printer the UI displays
- All IPC handlers support optional `contextId` parameter for multi-context operations
- Services like CameraProxyService, ConnectionStateManager, and PrinterPollingService are context-aware

**Event Flow:**
1. User connects to printer → PrinterContextManager creates new context
2. ConnectionFlowManager sets up backend for that context
3. MultiContextPollingCoordinator starts polling for the context
4. Context becomes active, UI switches to show that printer
5. User can switch contexts via PrinterTabsComponent tabs

For detailed architecture information, see `ARCHITECTURE.md`.

## Development Workflow

### Code Quality Standards
- All TypeScript files should include `@fileoverview` documentation headers
- Use ESLint configuration for code style consistency
- Run type checking before commits
- Follow existing patterns for service/manager implementations

### Testing and Build Limitations
**Claude Code Testing Limitations**: Claude Code agents cannot perform visual or interactive testing. Agents are limited to:
- Static code analysis and type checking (`npm run type-check`)
- Linting and code structure validation (`npm run lint`)
- Configuration and dependency analysis
- Code pattern and architecture compliance checking
- Import/export validation and relationship analysis

**Agents CANNOT:**
- Start or run the Electron application to test functionality
- View or interact with UI components, dialogs, or windows
- Test real printer connectivity or hardware interactions  
- Perform visual regression testing or UI consistency checks
- Test user workflows or click-through scenarios
- Verify runtime behavior or performance characteristics

**Build Process Guidance**: Agents should generally avoid running `npm run build` unless specifically requested or clearly necessary for verification, as:
- Build processes can be time-consuming and slow down workflow
- Most code quality issues can be caught through type checking and linting
- Existing development workflow already includes build validation steps
- Focus should be on code-level quality assurance first

**When to build**: Only run builds when:
- User explicitly requests it
- Significant structural changes may affect build configuration
- New dependencies or file organization changes require verification
- Ready to verify final integration before deployment

## Development Tips

### Using Code Context Provider
When scanning the codebase with the code-context-provider-mcp tool:

1. **First Pass (Overview)**: Use `includeSymbols: false` for root directory scan to avoid hitting limits
2. **Detailed Scans**: Use `includeSymbols: true` for specific subdirectories
3. **Don't skip folders**: Scan all subdirectories methodically rather than trying to be "efficient"
4. **Default maxDepth**: Use default maxDepth (5), only reduce if errors occur

### Code Documentation

- Use `@fileoverview` comments at the top of each file
- Run `npm run docs:check` to verify documentation coverage
- Include purpose, key exports, and usage notes in file headers

## Multi-Printer Development Notes

When working with multi-printer features:

1. **Context-Aware Operations**: Most operations now accept an optional `contextId` parameter. If not provided, they operate on the active context.

2. **IPC Handler Pattern**:
   ```typescript
   // Old: ipcMain.handle('some-operation', async () => { ... })
   // New: ipcMain.handle('some-operation', async (_event, contextId?: string) => { ... })
   ```

3. **Getting the Right Context**:
   ```typescript
   const contextManager = getPrinterContextManager();
   const context = contextId
     ? contextManager.getContext(contextId)
     : contextManager.getActiveContext();
   ```

4. **Event Notifications**: Context-specific events should include the context ID in their payload for UI routing.

5. **Camera Proxy Ports**: Each context gets a unique port (8181-8191). The PortAllocator manages this range.

6. **Polling Coordination**: MultiContextPollingCoordinator automatically adjusts polling frequency when contexts switch (active=3s, inactive=3s).

### ⚠️ Multi-Printer Testing Status (as of 2025-10-03)

The multi-printer implementation is **complete but untested**. The following areas require runtime testing before considering this feature production-ready:

**Critical Testing Required:**
- [ ] **Filament tracker integration** - Verify filament tracker API works correctly with multi-printer contexts
- [ ] **WebUI multi-printer functionality** - Test WebUI context switching, multi-printer displays, and per-context operations
- [ ] **Context switching behavior** - Verify UI updates correctly when switching between printer tabs
- [ ] **Simultaneous printer operations** - Test multiple printers connected and operating at the same time
- [ ] **Camera streaming per context** - Verify each printer's camera stream works with unique port allocation
- [ ] **Polling coordination** - Confirm active/inactive polling frequency adjustment works as expected
- [ ] **Context cleanup** - Test disconnect flow properly cleans up all context resources
- [ ] **Edge cases** - Connection failures, mid-operation context switches, rapid tab switching

**Known Limitations:**
- Static code analysis and type checking have passed
- Code patterns follow established architecture
- Documentation is complete
- **Runtime behavior has not been verified**

## Key File Locations

**Multi-Printer Core:**
- `src/managers/PrinterContextManager.ts` - Context lifecycle management
- `src/types/PrinterContext.ts` - Context type definitions
- `src/ipc/printer-context-handlers.ts` - Context IPC handlers
- `src/services/MultiContextPollingCoordinator.ts` - Multi-context polling
- `src/ui/components/printer-tabs/` - Tab UI component
- `src/utils/PortAllocator.ts` - Port management utility

**Modified for Multi-Printer:**
- `src/managers/ConnectionFlowManager.ts` - Context-aware connection flow
- `src/managers/PrinterBackendManager.ts` - Per-context backend management
- `src/services/CameraProxyService.ts` - Per-context camera proxies
- `src/services/ConnectionStateManager.ts` - Context-aware state tracking
- `src/renderer.ts` - Multi-printer UI integration
- `src/webui/server/api-routes.ts` - WebUI multi-printer API support

---

External References:

@ai_reference\AGENTS.md
@ai_reference\ARCHITECTURE.md
- Don't add @author to @fileoverview headers when creating docs