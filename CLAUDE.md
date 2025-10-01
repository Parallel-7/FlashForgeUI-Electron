# FlashForgeUI-Electron Development Guide

**Last Updated:** 2025-10-01 (timestamp placeholder - update on first session use)

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

FlashForgeUI is an Electron-based desktop application for monitoring and controlling FlashForge 3D printers. The application provides comprehensive printer management, job control, material station monitoring, and camera streaming capabilities.

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

---

External References:

@ai_reference\AGENTS.md
@ai_reference\ARCHITECTURE.md
