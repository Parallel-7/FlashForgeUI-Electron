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

**ALWAYS use specialized agents proactively rather than attempting tasks directly.** The Task tool provides expert agents optimized for specific development workflows. Each agent brings deep expertise and follows established best practices for their domain.

**Important**: All agents have testing limitations and cannot run the application or perform visual testing. See [Testing and Build Limitations](#testing-and-build-limitations) for details. Agents focus on code-level quality assurance through static analysis, type checking, and linting.

### Available Agents

- **general-purpose**: **Use first** for any complex, multi-step tasks, comprehensive codebase exploration, or when determining which specialized agent to use next. This agent excels at research, code searching, and orchestrating complex workflows across the entire codebase.

- **project-typescript-engineer**: **Primary agent for ALL TypeScript development work.** Never attempt to implement features, fix bugs, or refactor TypeScript code directly - always delegate to this agent. It reads reference files automatically, follows project patterns, and ensures architecture compliance. **Use immediately** for any coding task.

- **senior-typescript-reviewer**: **Mandatory final step** after any code changes. Never consider development work complete without this comprehensive review. This agent performs deep code quality analysis, security auditing, and ensures adherence to TypeScript best practices. **Always invoke** after project-typescript-engineer work.

- **codebase-explorer**: **Use proactively** before starting any significant development work to understand system architecture, data flows, and existing patterns. This agent provides crucial context that prevents architectural misalignment and helps identify integration points. **Start with this agent** for complex features or when working in unfamiliar code areas.

- **ui-design-architect**: **Essential for all UI/UX work.** Never modify dialogs, windows, components, or themes directly - this agent ensures design consistency and proper integration with existing UI patterns. **Always use** for any visual or interface changes, from minor tweaks to major redesigns. **CRITICAL REQUIREMENTS:**

  **Dual UI Mode Compliance:** All designs must work flawlessly in both "rounded" (enabled) and "square" (disabled) UI modes. The agent must test both states and ensure visual consistency.
  
  **Shared Template Pattern:** All dialog windows MUST use `@import url('../shared/rounded-dialog-template.css')` as the foundation. Never duplicate base styles or create standalone CSS.
  
  **CSS Variables System:** Use CSS variables from `CSSVariables.ts` for dynamic styling (--ui-padding, --ui-border-radius, --ui-background, etc.). Never hardcode values that should adapt to UI mode.
  
  **Strict CSS Rules:** 
  - `!important` is **FORBIDDEN** - structure CSS properly with appropriate specificity
  - Use semantic, maintainable class hierarchies - avoid convoluted nested selectors
  - Follow existing color scheme from `:root` variables (--dark-bg, --text-color, --accent-color, etc.)
  
  **Reference Examples:** Study IFS dialog (`ifs-dialog.css`), Settings dialog (`settings.css`), Connect Choice dialog (`connect-choice-dialog.css`), and Main Window (`index.css`) for proper implementation patterns.
  
  **Component Consistency:** Maintain visual harmony with existing buttons, headers, footers, animations, and interactive states. Reuse established patterns rather than inventing new ones.

- **code-documenter**: **Use immediately** when creating new files or when encountering files lacking `@fileoverview` documentation. This agent ensures consistent documentation standards across the codebase. **Invoke automatically** after implementing new features to maintain documentation quality.

- **comprehensive-docs-generator**: **Use for knowledge preservation.** When working with complex libraries, APIs, or architectural patterns, this agent creates reference documentation for future development work. **Deploy proactively** to document integration patterns, API usage, and complex workflows for the ai_reference folder.

- **production-readiness-auditor**: **Critical for release preparation.** Use proactively after significant changes, before releases, or when build workflows fail. This agent ensures all dependencies, configurations, and build processes are production-ready. **Invoke preventively** to catch issues early.

- **electron-security-analyst**: **Essential for security assurance.** Use after implementing authentication, IPC communication, external integrations, or before releases. This agent identifies vulnerabilities, validates security patterns, and ensures Electron security best practices. **Deploy proactively** for security-critical changes.

- **ascii-diagram-designer**: **Use for architectural communication.** When explaining system relationships, data flows, or complex interactions, this agent creates clear visual representations. **Invoke when** architectural understanding is needed or when documenting complex systems.

- **statusline-setup**: Configure Claude Code status line settings
- **output-style-setup**: Create Claude Code output styles

### Mandatory Agent Workflows

**Never attempt these tasks directly - always use the prescribed agent workflows:**

- **New Feature Implementation**: codebase-explorer (understand architecture) → project-typescript-engineer (implement) → senior-typescript-reviewer (review) → code-documenter (document) → production-readiness-auditor (validate)

- **Bug Fixes**: codebase-explorer (analyze issue) → project-typescript-engineer (fix) → senior-typescript-reviewer (review) → production-readiness-auditor (ensure stability)

- **UI/UX Development**: codebase-explorer (understand patterns) → ui-design-architect (design) → project-typescript-engineer (implement) → senior-typescript-reviewer (review) → code-documenter (document)

- **Security-Sensitive Changes**: electron-security-analyst (analyze) → project-typescript-engineer (implement) → senior-typescript-reviewer (review) → electron-security-analyst (validate)

- **Release Preparation**: production-readiness-auditor (audit) → electron-security-analyst (security review) → senior-typescript-reviewer (final code review)

- **Architecture Documentation**: codebase-explorer (analyze) → ascii-diagram-designer (visualize) → comprehensive-docs-generator (document)

### Critical Agent Collaboration Rules

- **NEVER skip codebase-explorer** for complex features or unfamiliar code areas - it provides essential architectural context that prevents integration issues
- **ALWAYS use project-typescript-engineer** for TypeScript work - direct coding attempts bypass critical reference file reading and pattern adherence
- **MANDATORY senior-typescript-reviewer** after ANY code changes - no exceptions, this ensures code quality and catches issues early
- **AUTO-INVOKE code-documenter** when creating new files or working on undocumented code - maintains documentation standards
- **PROACTIVE production-readiness-auditor** use after significant changes prevents build failures and deployment issues
- **PREVENTIVE electron-security-analyst** deployment for authentication, IPC, and external integration work catches vulnerabilities early

This guide should help you understand and contribute to the FlashForgeUI-Electron codebase effectively.