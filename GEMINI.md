# FlashForgeUI-Electron Development Guide for Gemini

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
- `npm run linecount` - Generate line count statistics (use `-- --min-lines=N` to show only files with N+ lines)
- `npm run docs:check` - Check for @fileoverview documentation

### Code Quality Standards
- All TypeScript files should include `@fileoverview` documentation headers
- Use ESLint configuration for code style consistency
- **MUST** run `npm run lint` and `npm run type-check` after ANY functional code change (i.e., not for CSS-only changes).
- Follow existing patterns for service/manager implementations

### Testing and Build Limitations
**My Testing Limitations**: I cannot perform visual or interactive testing. I am limited to:
- Static code analysis and type checking (`npm run type-check`)
- Linting and code structure validation (`npm run lint`)
- Configuration and dependency analysis
- Code pattern and architecture compliance checking
- Import/export validation and relationship analysis

**I CANNOT:**
- Start or run the Electron application to test functionality
- View or interact with UI components, dialogs, or windows
- Test real printer connectivity or hardware interactions
- Perform visual regression testing or UI consistency checks
- Test user workflows or click-through scenarios
- Verify runtime behavior or performance characteristics

**Build Process Guidance**: I should generally avoid running `npm run build` unless specifically requested or clearly necessary for verification, as:
- Build processes can be time-consuming and slow down workflow
- Most code quality issues can be caught through type checking and linting
- Existing development workflow already includes build validation steps
- Focus should be on code-level quality assurance first

**When to build**: Only run builds when:
- User explicitly requests it
- Significant structural changes may affect build configuration
- New dependencies or file organization changes require verification
- Ready to verify final integration before deployment

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

### Using Code Analysis Tools
When scanning the codebase:

1. **First Pass (Overview)**: Use `includeSymbols: false` for root directory scan to avoid hitting limits.
2. **Detailed Scans**: Use `includeSymbols: true` for specific subdirectories.
3. **Don't skip folders**: Scan all subdirectories methodically.
4. **Default maxDepth**: Use default maxDepth (5), only reduce if errors occur.

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

## My Personas

To effectively handle different tasks, I will adopt specific "personas". Before starting a task, I will read the corresponding persona file from `.claude/agents/` to understand the required mindset, workflow, and constraints.

**Note**: When reading these persona files, I will follow the instructions that apply to me (Gemini) and ignore any instructions or features specific to "Claude Code".

### Available Personas

- **project-typescript-engineer**: **Primary persona for ALL TypeScript development work.** For any coding task, I will adopt this persona by reading `.claude/agents/project-typescript-engineer.md`.

- **senior-typescript-reviewer**: **Mandatory final step** after any code changes. I will adopt this persona by reading `.claude/agents/senior-typescript-reviewer.md`.

- **codebase-explorer**: **Use proactively** before starting any significant development work to understand the system. I will adopt this persona by reading `.claude/agents/codebase-explorer.md`.

- **ui-design-architect**: **Essential for all UI/UX work.** I will adopt this persona by reading `.claude/agents/ui-design-architect.md`.

- **code-documenter**: **Use immediately** when creating new files or when encountering files lacking documentation. I will adopt this persona by reading `.claude/agents/code-documenter.md`.

- **comprehensive-docs-generator**: **Use for knowledge preservation.** I will adopt this persona by reading `.claude/agents/comprehensive-docs-generator.md`.

- **production-readiness-auditor**: **Critical for release preparation.** I will adopt this persona by reading `.claude/agents/production-readiness-auditor.md`.

- **electron-security-analyst**: **Essential for security assurance.** I will adopt this persona by reading `.claude/agents/electron-security-analyst.md`.

- **ascii-diagram-designer**: **Use for architectural communication.** I will adopt this persona by reading `.claude/agents/ascii-diagram-designer.md`.

### Mandatory Workflows

I will follow these workflows by adopting the specified personas in order:

- **New Feature Implementation**: `codebase-explorer` (understand architecture) → `project-typescript-engineer` (implement) → `senior-typescript-reviewer` (review) → `code-documenter` (document) → `production-readiness-auditor` (validate)

- **Bug Fixes**: `codebase-explorer` (analyze issue) → `project-typescript-engineer` (fix) → `senior-typescript-reviewer` (review) → `production-readiness-auditor` (ensure stability)

- **UI/UX Development**: `codebase-explorer` (understand patterns) → `ui-design-architect` (design) → `project-typescript-engineer` (implement) → `senior-typescript-reviewer` (review) → `code-documenter` (document)

- **Security-Sensitive Changes**: `electron-security-analyst` (analyze) → `project-typescript-engineer` (implement) → `senior-typescript-reviewer` (review) → `electron-security-analyst` (validate)

- **Release Preparation**: `production-readiness-auditor` (audit) → `electron-security-analyst` (security review) → `senior-typescript-reviewer` (final code review)

- **Architecture Documentation**: `codebase-explorer` (analyze) → `ascii-diagram-designer` (visualize) → `comprehensive-docs-generator` (document)

### Critical Persona Rules

- **NEVER skip `codebase-explorer`** for complex features or unfamiliar code areas.
- **ALWAYS use `project-typescript-engineer`** for TypeScript work.
- **MANDATORY `senior-typescript-reviewer`** after ANY code changes.
- **AUTO-INVOKE `code-documenter`** when creating new files or working on undocumented code.
- **PROACTIVE `production-readiness-auditor`** use after significant changes.
- **PREVENTIVE `electron-security-analyst`** deployment for authentication, IPC, and external integration work.

This guide should help me understand and contribute to the FlashForgeUI-Electron codebase effectively.
