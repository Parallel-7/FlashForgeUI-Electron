# FlashForgeUI-Electron Development Guide

## Project Overview
FlashForgeUI is an Electron-based desktop application for monitoring and controlling FlashForge 3D printers. The application provides comprehensive printer management, job control, material station monitoring, and camera streaming capabilities.

## Architecture Overview

### Core Components
- **Main Process** (`src/index.ts`): Electron main process entry point
- **Renderer Process** (`src/renderer.ts`): Main UI renderer
- **Preload Scripts** (`src/preload.ts`): Secure IPC bridge between main and renderer
- **WebUI Server** (`src/webui/`): Express-based web interface for remote access

### Key Directories
- `src/managers/`: Core application managers (Config, Connection, Backend, etc.)
- `src/services/`: Business logic services (Discovery, Polling, Notifications, etc.)
- `src/printer-backends/`: Printer-specific backend implementations
- `src/ui/`: Various dialog windows and UI components
- `src/webui/`: Web-based interface with REST API and WebSocket support
- `src/types/`: TypeScript type definitions
- `src/utils/`: Utility functions and helpers

## Development Workflow

### Essential Commands
- `npm run build` - Build all components (main, renderer, webui)
- `npm run dev` - Development mode with file watching
- `npm start` - Build and run the application
- `npm run lint` - Run ESLint on TypeScript files
- `npm run type-check` - TypeScript type checking without emit
- `npm run linecount` - Generate line count statistics
- `npm run docs:check` - Check for @fileoverview documentation

### Code Quality Standards
- All TypeScript files should include `@fileoverview` documentation headers
- Use ESLint configuration for code style consistency
- Run type checking before commits
- Follow existing patterns for service/manager implementations

## Key Services and Managers

### Managers (Singleton Pattern)
- **ConfigManager**: Application configuration management
- **ConnectionFlowManager**: Printer connection orchestration
- **LoadingManager**: UI loading state management
- **PrinterBackendManager**: Backend lifecycle and selection
- **PrinterDetailsManager**: Saved printer data persistence

### Services
- **PrinterDiscoveryService**: Network printer discovery
- **PrinterPollingService**: Real-time printer status updates
- **ConnectionEstablishmentService**: Connection establishment logic
- **NotificationService**: System notifications for print events
- **CameraProxyService**: Camera stream proxy server
- **ThumbnailRequestQueue**: Job thumbnail processing

### Printer Backends
- **GenericLegacyBackend**: Legacy FlashForge API support
- **DualAPIBackend**: Base for printers supporting both APIs
- **AD5XBackend**: Adventurer 5X series with material station
- **Adventurer5MBackend**: Adventurer 5M series
- **Adventurer5MProBackend**: Adventurer 5M Pro with advanced features

## WebUI Architecture
The application includes a web-based interface accessible via browser:
- **Express Server**: REST API endpoints for printer control
- **WebSocket Manager**: Real-time status updates
- **Authentication**: Token-based auth with rate limiting
- **Static Files**: HTML/CSS/JS served from `src/webui/static/`

## IPC Communication
- **Main-Renderer IPC**: Secure communication via preload scripts
- **Dialog Windows**: Separate renderer processes for various dialogs
- **Event-Driven**: Extensive use of EventEmitter pattern

## Testing
- Jest configuration for unit tests
- Test files located in `src/services/__tests__/`
- Test utilities and mocks for service testing

## Build System
- **TypeScript**: Main and renderer process compilation
- **Webpack**: Renderer bundling with CSS/HTML processing
- **Electron Builder**: Cross-platform distribution builds
- **Platform Targets**: Windows, Linux, macOS support

## Configuration
- **Config Schema**: Zod-based validation in `src/validation/`
- **User Data**: Stored in Electron's userData directory
- **Printer Profiles**: JSON-based printer configuration storage

## Development Tips

### Using Code Context Provider
When scanning the codebase with the code-context-provider-mcp tool:

1. **First Pass (Overview)**: Use `includeSymbols: false` for root directory scan to avoid hitting limits
2. **Detailed Scans**: Use `includeSymbols: true` for specific subdirectories
3. **Don't skip folders**: Scan all subdirectories methodically rather than trying to be "efficient"
4. **Default maxDepth**: Use default maxDepth (5), only reduce if errors occur

### Common Patterns
- Singleton managers accessed via `getXXXManager()` functions
- Service classes extending EventEmitter for event-driven architecture
- Type-safe IPC with Zod schema validation
- Feature flags and backend capabilities for printer-specific functionality

### Code Documentation
- Use `@fileoverview` comments at the top of each file
- Run `npm run docs:check` to verify documentation coverage
- Include purpose, key exports, and usage notes in file headers

## External Dependencies
- **ff-api**: FlashForge printer communication library
- **slicer-meta**: G-code metadata parsing
- **electron**: Desktop application framework
- **express**: Web server for WebUI
- **ws**: WebSocket implementation
- **zod**: Runtime type validation
- **axios**: HTTP client for API calls

## File Structure Conventions
- TypeScript files use `.ts` extension
- React components (if any) use `.tsx`
- Type definitions in `src/types/` with clear module organization
- Utility functions grouped by purpose in `src/utils/`
- Service tests co-located in `__tests__` directories

## AI Agents

Claude Code provides specialized agents for different development tasks. Use the Task tool to invoke these agents:

### Available Agents

- **general-purpose**: For researching complex questions, searching code, and executing multi-step tasks. Use when you need comprehensive codebase exploration or when unsure which specific agent to use.

- **project-typescript-engineer**: Expert TypeScript engineer specialized for the FlashForgeUI-Electron project. Use for implementing new features, fixing bugs, refactoring code, or any TypeScript programming tasks. **CRITICAL**: This agent must read reference files (ai_reference/typescript-best-practices.md and ai_reference/electron-typescript-best-practices.md) before starting any work. Follows project-specific patterns, architecture, and coding standards.

- **senior-typescript-reviewer**: Comprehensive TypeScript code review expert. Use as the final step in development workflow to ensure code quality and adherence to best practices. **CRITICAL**: Must read reference documents and use codebase-explorer for context before reviewing. Performs thorough quality assurance focusing on type safety, maintainability, performance, and security.

- **codebase-explorer**: Senior software architect specializing in deep codebase analysis and system understanding. Use when you need to thoroughly analyze codebase structure, explore code patterns, investigate specific implementations, or understand how different parts work together. Systematically maps architectural patterns, data flows, and dependencies.

- **ui-design-architect**: Expert UI design architect for creating and modifying UI components, windows, pages, and themes. Use for designing new dialog windows, updating UI layouts, implementing design changes, or modernizing visual components. Always starts by exploring existing UI patterns and maintains consistency with project architecture.

- **code-documenter**: Expert technical documentation writer for TypeScript/JavaScript codebases. Use when files need documentation headers, creating new files that require documentation, or updating existing files that lack proper `@fileoverview` comments. Ensures consistent documentation standards and comprehensive file-level documentation.

- **comprehensive-docs-generator**: Documentation architect for creating comprehensive technical documentation that serves as reference material for future AI agents and developers. Use when you need complete documentation for libraries, APIs, frameworks, or technical topics. Saves all documentation to `ai_reference` folder and ensures completeness and accuracy.

- **statusline-setup**: Configure Claude Code status line settings
- **output-style-setup**: Create Claude Code output styles

### When to Use Each Agent

- **New Feature Implementation**: project-typescript-engineer → senior-typescript-reviewer → code-documenter
- **Bug Fixes**: project-typescript-engineer → senior-typescript-reviewer
- **Code Architecture Analysis**: codebase-explorer
- **UI/UX Development**: ui-design-architect → project-typescript-engineer → senior-typescript-reviewer
- **Code Review**: senior-typescript-reviewer
- **Documentation**: code-documenter
- **Comprehensive Reference Docs**: comprehensive-docs-generator
- **Research/Exploration**: general-purpose or codebase-explorer (depending on depth needed)

### Agent Collaboration Patterns

- **codebase-explorer** is often used by other agents to gain context before implementation or review
- **project-typescript-engineer** must read reference files before any programming work
- **senior-typescript-reviewer** must collaborate with codebase-explorer for comprehensive context
- **ui-design-architect** should use codebase-explorer to understand existing UI patterns first

This guide should help you understand and contribute to the FlashForgeUI-Electron codebase effectively.