# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.4-alpha.3] - 2025-12-09

### Added
- Dynamic WebUISecret generation per-installation for session token signing (4c7433b)

### Changed
- Centralize agent skills with symlink structure (9f27c43)
- Update AuthManager.ts (63d9144)
- Pin @ghosttypes/ff-api to specific version for frozen-lockfile compatibility (3968134)
- Update pnpm version to 10.23.0 in release workflow (1d691e3)
- Bump version to 1.0.4 and fix security vulnerabilities (81816a1)
- Update src/main/webui/server/WebUIManager.ts (1c89cc0)

### Security
- [CRITICAL] Fix path traversal in job filename by rejecting .. patterns with Zod schema refinement (3d51c6e)
- [HIGH] Add input validation for theme profiles using Zod schemas (da95ee6)
- [HIGH] Fix timing attack in auth verification using crypto.timingSafeEqual() (6366705)
- [HIGH] Add security headers middleware (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP) (e2905d6)
- Fix ineffective token revocation on logout by manually extracting token from Authorization header (c91e8d1)
- Prevent stored XSS in theme profile name rendering using textContent instead of innerHTML (235a225)
- Hash WebUI password in config with PBKDF2 and automatic migration from plaintext (d98e809)
- Increase PBKDF2 iterations from 10,000 to 210,000 (OWASP minimum) (649f704)
- Fix insecure go2rtc API binding and implement secure proxy (98ea4ec)

---

## [1.0.4-alpha.2] - 2025-12-09

### Added
- Comprehensive file-based debug logging system with session management and log rotation (be53b98)
- Network-specific debug logs for connection troubleshooting (be53b98)
- CLI flags (--debug, --debug-network) for both desktop and headless (be53b98)
- Settings UI toggle with nested network logging option (be53b98)
- WebUI API endpoints to list/download debug logs (be53b98)
- IFS material station as GridStack component with responsive layouts (1x4, 4x1, 2x2, compact) (e14e058)
- Dynamic spool sizing using aspect-ratio for IFS component (e14e058)
- Go2rtcBinaryManager for binary lifecycle, config generation, and process spawning (462f35a)
- Go2rtcService for stream management via go2rtc REST API (462f35a)
- video-rtc.js custom element for WebRTC/MSE/MJPEG playback (462f35a)
- Modular agent architecture with specialized agents (code-cleaner, electron-specialist, typescript-specialist, vite-specialist) (5574dbe)
- generate-agent command for creating new agent configs (5574dbe)
- get-time skill for accurate timezone-aware timestamps (1a3dedf)
- Security headers middleware (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Content-Security-Policy) (e2905d6)

### Changed
- Migrate from npm to pnpm package manager (0adcdca)
- Refactor IFS material station from dialog to GridStack component (e14e058)
- Replace node-rtsp-stream with go2rtc streaming gateway (462f35a)
- Complete go2rtc integration with MJPEG support and FPS tracking (b3ebb4f)
- Standardize executable name to FlashForgeUI on Linux (1ba530b)
- Refactor CLI from monolithic commands to modular agent architecture (5574dbe)
- Preserve and pass 1-based slot index from API for material station (283b78e)
- Migrate from package-lock.json to pnpm-lock.yaml (0adcdca)
- Update release workflow for pnpm compatibility (0adcdca, 1d691e3)
- Centralize agent skills with symlink structure (9f27c43)
- Clean up and reorganize AI documentation from ai_reference to ai_docs (8baf635)
- Comprehensive code cleanup removing dead code and dynamic imports (eb61743)
- Add centralized web-api.types.ts for WebUI type definitions (eb61743)
- Fix DualAPIBackend error handling to report actual fallback error (b34fd01)
- Apply Biome formatting across codebase (b34fd01)
- Configure Jest for electron-vite compatibility (fea97d3)
- Increase PBKDF2 iterations from 10,000 to 210,000 (OWASP minimum) (649f704)

### Removed
- CameraProxyService, RtspStreamService, and PortAllocator (replaced by go2rtc) (462f35a)
- JSMpeg canvas rendering and related types (jsmpeg.d.ts, node-rtsp-stream.d.ts) (462f35a)
- Legacy IFS dialog window factory methods, IPC handlers, and Ctrl+M shortcut (e14e058)
- src/renderer/src/ui/ifs-dialog/ folder entirely (e14e058)
- IFS menu item from renderer (e14e058)
- Legacy rotation drift CSS workarounds (b3ebb4f)
- Unused camera types: CameraProxyConfig, CameraProxyClient, CameraProxyEvent (b3ebb4f)
- Old monolithic CLI commands (find-disabled-lint, fix-lint, load-changes, production-status, project-status, security-audit, type-check) (5574dbe)
- Old AI agent files and AGENTS.md (8baf635)
- Old spec files and ai_reference documentation (65d9409, 8baf635)
- Knip.json configuration (8baf635)
- Legacy instance variables and methods across managers and services (eb61743)

### Fixed
- Use separate x64/arm64 builds for macOS to fix electron-builder errors with go2rtc binaries (759032f)
- Fix MJPEG streams not loading by using correct playback mode (b3ebb4f)
- Fix go2rtc automatic format detection for MJPEG (b3ebb4f)
- Correct auto-updater stable channel configuration (cf3052d)
- Linux executable name standardization with cleanup of old flashforge-ui-ts entries (1ba530b)
- Resolve Biome warnings and fix error handling bug in DualAPIBackend (b34fd01)
- Fix ConfigManager emitting events for unchanged config keys (be53b98)
- Fix EnvironmentDetectionService.test.ts for electron-vite path expectations (fea97d3)
- Fix active slot display and slot comparison logic for material station (283b78e)
- Fix electron-builder macOS build with go2rtc binary resources (a439d98, fabfdf2)
- Fix package.json electron-builder dependency (90d8fc8)
- Pin @ghosttypes/ff-api to specific version for frozen-lockfile compatibility (3968134)
- Fix ineffective token revocation on logout by manually extracting token from Authorization header (c91e8d1)
- Prevent stored XSS in theme profile name rendering using textContent instead of innerHTML (235a225)

### Security
- [HIGH] Fix timing attack in auth verification using crypto.timingSafeEqual() (6366705)
- Fix path traversal in job filename by rejecting .. patterns with Zod schema refinement (3d51c6e)
- Replace hardcoded auth salt with dynamic secret generated per-installation (4c7433b)
- Add security headers middleware (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) (e2905d6)
- Add input validation for theme profile API operations using Zod schemas (da95ee6)
- Add regex validation for theme profile names to prevent injection (da95ee6)
- Patch transitive dependency vulnerabilities (tar 7.5.4, lodash 4.17.23) (81816a1)
- Update electron-builder to 26.5.0 (104a6e7)

---

## [1.0.4-alpha.1] - 2025-12-09

### Added
- Theme profile management system for Desktop and WebUI with create, rename, and delete custom profiles (67b6971, 24f765d)
- Update UI component sizes and enable resizing (5931146)
- Agent skills system for best-practices, electron, vite, and typescript (1a3dedf)
- Script to list AI spec files for agents (0cc350b)
- Platform build wrapper (e4af4fc)
- Scripts to find console and Lucide icon usage (a74e819)
- Migrate scripts to TypeScript (044b886)

### Changed
- Migrate entire Electron app to native ESM (c4a5d3c)
- Reduce logging spam (8da2e6d)
- Apply WebUI theming on login page and improve theme loading (8391773)

### Security
- Fix glob security vulnerability (ff1c053)

---

## [1.0.3-alpha.2] - 2025-12-30

### Added
- FPS overlay for RTSP cameras with frame counter and theme-aware styling (c90c1cd)
- Camera FPS overlay toggle setting with showCameraFps per-printer setting (73c56be)
- Global hide scrollbars option with redesigned IFS dialog header (31d9bd2)
- 4 light themes: Aurora Light, Glacial Prism, Sandstone Dawn, Sage Studio (710d253)
- Dynamic theme propagation across all dialog windows - broadcast theme changes to all windows (8b6ce51)
- Dynamic theme status messages with context-aware status and instant apply (d350957)

### Changed
- Reorganize documentation - split CLAUDE.md into 7 specialized guides (8bdbb9e)
- Migrate from ESLint to Biome - replace ESLint with unified Biome linter/formatter (7599e0b)
- Migrate from webpack to vite - faster builds and hot reloading (1b34dd7, 524a104)
- Migrate maintenance scripts to Go for better performance (a62a6fd)
- Migrate UI styles to CSS variables and theme system across 15 components (c546d51)
- Complete spoolman-dialog CSS migration and generate 15 migration specs (35da6d2)
- Centralize theme system and expand architecture docs to 1300+ lines (9e6bf3f)
- Unify dialog IPC bridges under window.api.dialog namespace (8f5288e)
- Migrate to ESM - convert .js to .cjs, .ts to .cts (3886539)
- Replace MJPEG heartbeat with backend stats polling to eliminate port churn (55ecc3b)
- Migrate WebUI CSS to theme system variables - replace ~60 hardcoded colors (50850cd)
- Improve type safety and eliminate dead code (94b8a3e)
- Migrate from code-context-provider to code-search-mcp (02fed0e)
- Unify CSS to use theme system variables across 27 files (7eaac02)
- Update README.md multiple times (69e344e, 394d166, fb2bbc1, 2ff92bb)

### Fixed
- Correct Spoolman dialog preload paths - replace hardcoded paths with createUIPreloadPath() (28ab39d)
- Centralize per-printer settings defaults - create printerSettingsDefaults utility (4fa2a45)
- Forward polling data to component dialog windows - fix filtration-controls showing incorrect values (aea1e24)
- Resolve all ESLint warnings (348 to 0) (8d0b972)
- Fix Settings Dialog and IFS Match Dialog race conditions (955f5f1)
- Migrate ifs-dialog CSS to theme system and unify spool design (61edbc4)
- Migrate material-info-dialog to theme system (d026323)
- Migrate material-matching and job-picker dialogs to theme system (c64287d)
- Migrate job upload dialog to theme system (9fab1de)
- Migrate 5 dialog and component CSS files to theme system (4c0edc0)
- Migrate 5 core desktop components to theme system (611bf8f)
- Migrate controls-grid, job-info, and model-preview to theme system (54db330)
- Fix color pickers default selection (0eeea5b)

### Removed
- Remove unnecessary files - .idea/, .qwen/, QWEN.md, css-migration-report.md (93efbb1)
- Remove old files - error.png, fileoverview-report.md, window-api-audit-report.md (15c627f)

---

## [1.0.3-alpha.1] - 2025-12-18

### Security
- Fix glob security vulnerability (GHSA-5j98-mcp5-4vw2) (91d137f, d862280)

### Changed
- Update download links in README (e38ce38)

---

## [1.0.3] - 2025-11-16

### Changed
- Bump version to 1.0.3 (stable release) (8567a69)

---

## [1.0.2-alpha.10] - 2025-11-16

### Added
- About dialog with app metadata, version info, and external links (1efa7f3)
- Spoolman health monitoring and offline handling with automatic detection and recovery (e3ee61d)
- Per-printer WebUI control with granular opt-in/opt-out (01e9bb1)
- HSV color picker interface for custom theme colors (0a30fbe)
- Redesigned welcome screen with larger, cleaner layout (da9c2cd)
- Per-printer layouts and shortcuts with stable serial-based persistence (bf073da)
- Reset layout button to edit mode indicator (2f1d9ea)
- Responsive layout system with CSS variable scaling (c4a952b)
- Slicer-meta v1.1.0 integration with enhanced filament display (1c18216)
- Keyboard shortcuts to main menu with visual indicators (b9f7e71)
- Toggle to disable Web UI password requirement (581bc6e)
- Mobile-responsive layout to WebUI with viewport-aware switching (b07c3d5)
- Auto-update system with GitHub integration and release channels (1f28d5d)
- GridStack layout system for WebUI with modern dark theme (f616dcd)
- AD5X material station matching to WebUI (77bdba4)

### Changed
- Optimized Lucide icons with static ESM imports, reducing bundle size from ~7.5 MiB to ~3 MiB (c33c893)
- Modularized settings window into reusable sections (77a5067)
- Extracted renderer and WebUI routes into modular files (2607b28)
- Major WebUI refactoring from monolithic ~3,000-line file into modular architecture (4b25169, 5c1b90e, 335a8bc, ead74db, 88919cd)
- Revamped README for improved clarity and aesthetics (9e3183a)
- Updated README with post-process script instructions (a07a88e)
- Replaced emoji icons with Lucide SVG system (683796c)
- Consolidated topbar with hamburger menu (1b4316d)
- Modernized dialog system with tabbed settings and rounded windows (5fda8d4)
- Modernized status dialog with tabbed interface (d2d2499)
- Migrated window controls to Lucide icons (07b41fd)
- Completed dialog close button migration to Lucide icons (38c4448)
- Streamlined WebUI push notifications spec (1488405)
- Unified log panel rendering with shared controller (df82527)
- Streamlined update dialog and improved release notes rendering (764d087)
- Archived completed specs and updated project documentation (26a15d5)
- Improved WebUI grid layout validation and sizing (9ee555a)
- Standardized GridStack component minimum sizes to 2x2 (60b368a)

### Fixed
- Resolved js-yaml security vulnerability (GHSA-mh29-5h37-fv8m) with npm override (6ff96c1)
- Disabled Clear Status button during active prints (7101310)
- AD5X WebUI styling (67ebf16)
- Resolved component initialization race conditions and icon rendering (e3a1835)
- Window controls hover coverage on Windows/Linux (db69004)
- Mirror alpha branch AD5X bugfixes in WebUI (f5c85c0)
- Standardized NSIS installer filename for auto-updater (cbe48d4)
- Show material matching dialog for all AD5X 3MF files (80c1d8e)

### Removed
- Deprecated filament tracker integration (926be79)

---

## [1.0.2-alpha.9] - 2025-11-03

### Added
- Per-printer WebUI control with granular opt-in/opt-out (01e9bb1)
- Per-printer layouts and shortcuts with stable serial-based persistence (bf073da)
- HSV color picker interface for custom theme colors (0a30fbe)
- Redesigned welcome screen with larger, cleaner layout (da9c2cd)
- Responsive layout system with CSS variable scaling (c4a952b)
- Reset layout button to edit mode indicator (2f1d9ea)
- Slicer-meta v1.1.0 integration with enhanced filament display (1c18216)
- Discord webhook sync in TypeScript with hybrid notification system (469ee23)
- Keyboard shortcuts to main menu with visual indicators (b9f7e71)
- Toggle to disable Web UI password requirement (581bc6e)
- Mobile-responsive layout to WebUI with viewport-aware switching (b07c3d5)
- Auto-update system with GitHub integration and release channels (1f28d5d)
- GridStack layout system for WebUI with modern dark theme (f616dcd)
- AD5X material station matching to WebUI (77bdba4)
- Improved job timer precision with isInitializing flag and elapsedTimeSeconds field (8aac234)
- macOS local network permission for Sequoia 15.0+ (912193d)
- Test button for Discord webhook integration (18d1588)

### Changed
- Extended Rounded UI compatibility to detect and disable on Windows 11 (d630743)
- Replaced vertical color input list with responsive grid layout in theme editor (bffd6b8)
- Added hex input fields with paste support (#RGB and #RRGGBB validation) (bffd6b8)
- Interactive color swatches with visual feedback (bffd6b8)
- Standardized Desktop and WebUI component minimum sizes (60b368a, bf3d3ac)
- Optimized Lucide icons with static ESM imports, reducing bundle size from ~7.5 MiB to ~3 MiB (c33c893)
- Modularized settings window into reusable sections (77a5067)
- Extracted renderer and WebUI routes into modular files (2607b28)
- Major WebUI refactoring from monolithic ~3,000-line file into modular architecture (4b25169, 5c1b90e, 335a8bc, ead74db, 88919cd)
- Revamped README for improved clarity and aesthetics (9e3183a)
- Updated README with post-process script instructions (a07a88e)
- Replaced emoji icons with Lucide SVG system (683796c)
- Consolidated topbar with hamburger menu (1b4316d)
- Modernized dialog system with tabbed settings and rounded windows (5fda8d4)
- Modernized status dialog with tabbed interface (d2d2499)
- Migrated window controls to Lucide icons (07b41fd)
- Completed dialog close button migration to Lucide icons (38c4448)
- Streamlined WebUI push notifications spec (1488405)
- Unified log panel rendering with shared controller (df82527)
- Streamlined update dialog and improved release notes rendering (764d087)
- Archived completed specs and updated project documentation (26a15d5)
- Improved WebUI grid layout validation and sizing (9ee555a)
- Standardized GridStack component minimum sizes to 2x2 (60b368a)
- Ensure all components wait for config to be loaded before initialization (01e9bb1)

### Fixed
- Window controls hover coverage on Windows/Linux (db69004)
- Material matching dialog for single-color 3MF files - show for all AD5X 3MF files with filament data (80c1d8e)
- Context switching and layout breakage in WebUI (6f9f2ae)
- Component initialization race conditions and icon rendering (e3a1835)
- Mirror alpha branch AD5X bugfixes in WebUI (f5c85c0)
- Standardized NSIS installer filename for auto-updater (cbe48d4)

---

## [1.0.2-alpha.8] - 2025-11-03

### Fixed
- Load dialog Lucide icons from node_modules instead of vendored copy (8d3a2ab)
- Resolve cross-platform Lucide icon loading inconsistency (b424245)
- Add ffmpeg directory to PATH so node-rtsp-stream can spawn it (0bbd3d0)
- Enhance ffmpeg detection to support macOS and cross-platform installations (2cfc722)

---

## [1.0.2-alpha.7] - 2025-11-02

### Added
- GridStack layout system for WebUI with modern dark theme (f616dcd)
- Auto-update system with GitHub integration and release channels (1f28d5d)
- Mobile-responsive layout to WebUI with viewport-aware switching (b07c3d5)
- Keyboard shortcuts to main menu with visual indicators (b9f7e71)
- Toggle to disable Web UI password requirement (581bc6e)
- AD5X material station matching to WebUI (77bdba4)
- Replaced emoji icons with Lucide SVG system (683796c)

### Changed
- Consolidated topbar with hamburger menu (1b4316d)
- Modernized dialog system with tabbed settings and rounded windows (5fda8d4)
- Modernized status dialog with tabbed interface (d2d2499)
- Migrated window controls to Lucide icons (07b41fd)
- Completed dialog close button migration to Lucide icons (38c4448)
- Migrated UI to Lucide icon library (3b86865)
- Streamlined WebUI push notifications spec and enhanced job components (1488405)
- Unified log panel rendering with shared controller (df82527)
- Streamlined update dialog and improved release notes rendering (764d087)
- Archived completed specs and updated project documentation (26a15d5)
- Improved WebUI grid layout validation and sizing (9ee555a)
- Improved LED control logic and reorganized docs (ae8176d)

### Fixed
- Resolve macOS auto-update "ZIP file not provided" error (b93bd13)
- Resolve RTSP streaming initialization and settings persistence (2103d28)
- Restore WebUI camera stream and button functionality after GridStack refactor (1d7ea08)
- Prevent grid components from appearing squished (68666ea)
- Remove CORS middleware to support non-standard network IPs (5b129a5)
- Enable Lucide icon rendering in component palette dialog (b08e7cd)

---

## [1.0.2-alpha.6] - 2025-10-22

### Fixed
- Resolve headless mode config path on macOS/Linux by creating bootstrap.ts to set app name before module imports (5669d69)

---

## [1.0.2-alpha.5] - 2025-10-28

### Fixed
- Resolve headless mode config path on macOS/Linux by creating bootstrap.ts to set app name before module imports (5669d69)

---

## [1.0.2-alpha.4] - 2025-10-26

### Fixed
- Resolve headless mode config path on macOS/Linux by creating bootstrap.ts to set app name before module imports (5669d69)

---

## [1.0.2-alpha.3] - 2025-10-25

### Fixed
- Resolve headless mode config path on macOS/Linux by creating bootstrap.ts to set app name before module imports (5669d69)

---

## [1.0.2-alpha.2] - 2025-10-23

### Fixed
- Resolve headless mode config path on macOS/Linux by creating bootstrap.ts to set app name before module imports (5669d69)

---

## [1.0.2-alpha.1] - 2025-10-21

### Fixed
- Configure .npmrc for GitHub Packages authentication in CI to fix 401 errors (9ba4919)
- Migrate to GitHub Packages for dependencies (b1d11da)
- Add link to user guide (33fe005)

---

## [1.0.2] - 2025-10-18

### Added
- Multi-printer support with context-based architecture allowing simultaneous monitoring and control of multiple FlashForge 3D printers (237345b)
- Headless mode for server-only operation with WebUI access (a5d0e25)
- RTSP streaming support using node-rtsp-stream and JSMpeg for camera feeds (5ec48a4)
- Per-printer settings system (customCameraEnabled, customCameraUrl, customLedsEnabled, forceLegacyMode) (5ec48a4)
- RtspStreamService for managing RTSP streams with ffmpeg-based transcoding to MPEG1 (5ec48a4)
- Per-context notification system for multi-printer support (96fbaa2)
- RTSP stream configuration settings (frame rate 1-60 fps, quality 1-5) per printer (d4721d1)
- User guide documentation (f7e91f9)
- PrinterTabsComponent with tabbed UI for switching between connected printers (237345b)
- PortAllocator utility for unique camera proxy port allocation per context (237345b)
- HeadlessManager for lifecycle management and connection orchestration (a5d0e25)
- HeadlessArguments for configuration validation and parsing (a5d0e25)
- HeadlessDetection utility for mode-aware service initialization (a5d0e25)
- HeadlessLogger for structured file-based logging (a5d0e25)
- TypeScript declaration files for JSMpeg and node-rtsp-stream (dddcd0a)
- MultiContextNotificationCoordinator service (96fbaa2)

### Changed
- Migrated from local file dependencies to GitHub Packages for ff-api and slicer-meta packages (b1d11da, d60d94e)
- Simplified GitHub Actions workflow by removing manual dependency cloning (b1d11da, d60d94e)
- Replace singleton notification coordinator with per-context architecture (96fbaa2)
- WebUI now vendors JSMpeg library locally instead of using CDN for offline support (8066c8d)
- IPC platform detection replaced with direct contextBridge exposure as window.PLATFORM (77e1c09)
- Camera setup now context-aware with per-context RTSP streams (5ec48a4)
- Connection flow initializes per-printer settings with defaults for new printers (5ec48a4)
- Improved RTSP streaming lifecycle in RtspStreamService (dddcd0a)
- Strengthened dynamic import typings for connection and camera handlers (dddcd0a)
- Added @fileoverview headers across entire codebase (113 TypeScript files) (fdf456a)

### Fixed
- Resolve headless mode config path on macOS/Linux (5669d69)
- Configure .npmrc for GitHub Packages authentication in CI to fix 401 errors (b1d11da, d60d94e)
- Duplicate printer cooled notifications caused by race condition (2910043)
- Windows 11 notification system by fixing AppUserModelId to match electron-builder appId (d4721d1)
- RTSP streaming cleanup with proper ffmpeg process cleanup, timeout, and exit handling (8066c8d)
- Multi-printer context handling with pre-disconnect event for camera cleanup per context (8066c8d)
- WebUI context handling for polling updates and LED control visibility (8066c8d)
- ConnectionFlowManager to preserve per-printer settings on reconnect (5ec48a4)
- HeadlessManager to only forward active context polling data to WebUI (a5d0e25)

### Removed
- Unused legacy files: src/services/printer-polling.ts, src/utils/dom.utils.ts, src/validation/*-schemas.ts (b021a1c)
- Unused dependencies: axios, express-ws, p-limit, @electron-forge/plugin-fuses, @electron/fuses, @types/express-ws, webpack-dev-server (b021a1c)
- Stale title update logic from UI updater (dddcd0a)
- Obsolete planning documents: HEADLESS.md, RTSP_Integration_Plan.md, FLASHFORGEUI_INTEGRATION_PLAN.md, MULTI_PRINTER_IMPLEMENTATION.md, HEADLESS_MODE_IMPLEMENTATION_PLAN.md (fdf456a, a5d0e25)

---

## [1.0.1-alpha.10] - 2025-10-16

### Fixed
- Platform specific styling not applying (macOS traffic lights)
- Properly fix notifications on all platforms (broken in earlier alpha releases)

---

## [1.0.1-alpha.9] - 2025-10-14

### Added
- RTSP Configuration - FPS and Quality options in Settings Menu (saved per-printer)

### Fixed
- Removed leftover code causing Title Bar to show "FlashForgeUI 1.0.1- Disconnected" when there was an active connection

### Changed
- Increased default size of some windows to ensure all contents are properly displayed

---

## [1.0.1-alpha.8] - 2025-10-05

### Added
- RTSP streaming support with RtspStreamService for managing RTSP streams with ffmpeg-based transcoding to MPEG1
- Each printer context gets unique WebSocket port (9000-9009) for RTSP streaming
- Explicit ffmpeg process cleanup with SIGKILL on stream stop
- Desktop app and WebUI both support RTSP cameras via JSMpeg player
- Stream type detection (MJPEG vs RTSP) in camera-utils
- Extended PrinterDetails type with per-printer settings: customCameraEnabled, customCameraUrl, customLedsEnabled, forceLegacyMode
- Settings are preserved across reconnections and persist in printer_details.json
- New printer-settings-handlers.ts for IPC operations
- Vendor JSMpeg library locally instead of using CDN for offline support
- Pre-disconnect event to handle camera cleanup per context
- Camera IPC handler accepts optional contextId parameter

### Changed
- Camera setup now context-aware with per-context RTSP streams
- PrinterContextManager emits context-updated events for settings changes
- Connection flow initializes per-printer settings with defaults for new printers
- Headless mode supports per-printer settings
- Filament tracker API routes use active context
- Fixed dev script to build WebUI files before starting watch mode
- Added canvas element for RTSP playback alongside img for MJPEG
- WebUI supports both MJPEG and RTSP camera streams

---

## [1.0.1-alpha.7] - 2025-10-04

### Added
- Filament tracker integration API with HTTP endpoints for integration with filament-tracker-electron application (10f2f31)
- FilamentTrackerIntegrationEnabled and FilamentTrackerAPIKey config settings (10f2f31)
- Dedicated API routes (/api/filament-tracker/status) with optional API key auth (10f2f31)
- Settings UI controls for enabling integration and configuring API key (10f2f31)
- wait-for-build.js script to automatically launch Electron in dev mode (10f2f31)
- Integration plan documentation in ai_specs/ (10f2f31)

### Changed
- Reorganized documentation with AGENTS.md containing AI agent workflows and guidelines (59501a6)
- Created ARCHITECTURE.md with complete technical reference (59501a6)
- Streamlined CLAUDE.md to Claude Code-specific guidance only (59501a6)
- Organized ai_specs/ folder for integration plans (59501a6)
- Removed Gemini MCP tools from all workflows (59501a6)
- Standardized on sequential-thinking for analysis (59501a6)
- Simplified command workflows (lint, type-check, disabled-lint) (59501a6)
- Updated electron-security-analyst tool list (59501a6)
- Deleted PROJECT.md and KEY-NOTES.md (consolidated into other docs) (59501a6)
- Enhanced CORS middleware to restrict to localhost and private networks (RFC 1918) (10f2f31)
- Updated WebUI routing to bypass standard auth for filament tracker endpoints (10f2f31)

### Fixed
- Duplicate connection warning dialog by replacing built-in system dialog with custom themed dialog (170b588)
- Created new PrinterConnectedWarning dialog component with HTML/CSS/TypeScript (170b588)
- Updated DialogHandlers, ConnectionFlowManager, and DialogIntegrationService to use custom dialog (170b588)

---

## [1.0.1-alpha.6] - 2025-09-23

### Fixed
- Auto connect choice dialog (f22f827)
- Active slot display showing wrong slot in IFS Material Station dialog (d865ff1)
- Slot comparison logic in dialog-handlers.ts to properly map 1-based activeSlot to 0-based slot data (d865ff1)
- Double conversion in ifs-dialog-renderer.ts that was adding extra +1 to already 1-based activeSlot (d865ff1)
- Updated PrinterDataTransformer.ts to accept 0-based activeSlot values (>= 0 instead of > 0) (d865ff1)
- Background throttling causing app to pause when unfocused by implementing proper WebContents-based solution (468915a)
- Removed ineffective legacy command line switches for background throttling (468915a)
- Added mainWindow.webContents.setBackgroundThrottling(false) for proper throttling prevention (468915a)
- Model preview image sizing and layout issues by applying maxWidth/maxHeight constraints in TypeScript (0d4e6b8)
- Job stats scrollbar by changing overflow from 'auto' to 'hidden' (0d4e6b8)
- Panel header styling to match job-stats component (0d4e6b8)

### Changed
- Updated supported models documentation to clarify AD5X support and legacy mode (c59d702)
- Added note about local file list functionality not being compatible with AD5X (c59d702)
- Added pairing code instructions to documentation (4f4e2b9)

---

## [1.0.1-alpha.5] - 2025-09-22

### Fixed
- ESLint warnings for unused imports and floating promises (477e34d)
- Removed unused getUIWindowOptions import from index.ts and UtilityWindowFactory.ts (477e34d)
- Removed unused DiscoveredPrinter type import from connection-handlers.ts (477e34d)
- Removed unused formatTime import from printer-status component (477e34d)
- Floating promise warnings in log-dialog-renderer by adding void operator (477e34d)
- IPC channel names and parameter formats broken during UI refactoring (8e9ca3c)
- Filtration and temperature button handlers after UI component refactoring (8e9ca3c)
- Unsafe 'any' type assertions with proper PrinterState typing in filtration and temperature controls (bb83e3f)
- Added proper error handling to async event handlers with .catch() and void operator (bb83e3f)
- Unsafe 'any' type assertions with proper Record<string, unknown> typing in job-uploader (ddd6174)
- Added explicit type guards for layerHeight, infill, and layerCount properties (ddd6174)
- Unsafe 'any' type assertions with proper TypeScript types in controls-grid component (f310c65)
- Removed (window as any).api usage in favor of typed window.api interface (f310c65)
- Replaced (globalThis as any).logMessage with proper type annotations (f310c65)
- Added logMessage function type to global.d.ts for Window and globalThis (f310c65)
- Camera IPC handler race condition by moving handler registration to main registerAllIpcHandlers function (856660e)
- Created dedicated camera-handlers.ts module following project patterns (856660e)
- Removed duplicate cameraIPCHandler.initialize() call from main process (856660e)
- Fixed initialization order - handlers now registered before window creation (856660e)

### Security
- Updated dependencies to fix vulnerabilities (ea1cf2b)
- Updated axios from 1.10.0 to 1.12.2 (fixes DoS attack vulnerability) (ea1cf2b)
- Updated electron from 35.1.4 to 35.7.5 (fixes ASAR integrity bypass) (ea1cf2b)

---

## [1.0.1-alpha.4] - 2025-09-21

### Added
- Complete Phase 1 UI modernization with modular component system (2f1b363)
- ComponentManager for centralized component lifecycle management (2f1b363)
- Comprehensive component library (temperature-controls, printer-status, filtration-controls, additional-info, camera-preview, controls-grid, job-stats, model-preview, log-panel) (2f1b363)
- LogService for enhanced logging functionality (2f1b363)
- Secure macOS platform detection and native styling (4e5e4e5)
- Secure IPC-based platform detection system for cross-platform styling (4e5e4e5)
- Native macOS traffic light controls with authentic styling (4e5e4e5)
- Platform-specific CSS classes (platform-darwin, platform-win32, etc.) (4e5e4e5)
- TypeScript types for secure platform detection interface (4e5e4e5)

### Changed
- Moved logs from main UI to dedicated dialog opened via button (2f1b363)
- Updated window management and dialog systems for component integration (2f1b363)
- Refactored app launch to prevent timing related issues - main UI shown immediately after config is loaded (b1b9314)
- Fixed issue where check code input dialog showed twice and showed two error messages when cancelled (b1b9314)
- Final adjustments to status section (b747759)
- Updated README.md with documentation updates (5166749)

### Removed
- BIOME_MIGRATION_RESEARCH.md, OXLINT_MIGRATION_ANALYSIS.md, UI_REWRITE_PHASE_1.md, and UI_REWRITE_PLAN.md (1a44994)

---

## [1.0.1-alpha.3] - 2025-09-04

### Changed
- Enhanced connection reliability and improved UI consistency (56f8b7c)
- Improved connection flow for manual IP connections by extracting real printer names and serial numbers from temporary connections (56f8b7c)
- Added robust error handling and logging for dual API connection establishment (56f8b7c)
- Fixed macOS window button visibility by hiding traffic light buttons (56f8b7c)
- Replaced info icon from unicode symbol to text for better cross-platform compatibility (56f8b7c)
- Standardized border radius for info buttons to match rounded UI design system (56f8b7c)
- Improved material matching dialog responsiveness by adjusting breakpoint threshold (56f8b7c)
- Added comprehensive connection state logging and validation throughout the flow (56f8b7c)
- Ensured proper client disposal and cleanup on connection failures (56f8b7c)

---

## [1.0.1-alpha.2] - 2025-08-31

### Added
- Comprehensive UI modernization with rounded design system (54db3b1)
- Shared rounded-dialog-template.css for standardized component styling (54db3b1)
- Rounded corners, transparent backgrounds, and modern aesthetics across entire application (54db3b1)
- Consistent gradient headers and improved visual hierarchy (54db3b1)
- CSSVariables.ts utility for UI mode CSS variable injection (af70a91)
- edit-agent command for agent management (54db3b1)

### Changed
- Main application window updated with modern rounded styling (54db3b1)
- All dialog windows updated with rounded design system (connect-choice-dialog, ifs-dialog, input-dialog, job-picker, job-uploader, material-info-dialog, material-matching-dialog, printer-selection, send-cmds, settings, single-color-confirmation-dialog, status-dialog) (54db3b1)
- Window factories and types updated to support new sizing and transparency requirements (54db3b1)
- Window configuration updated to use consistent transparency settings (af70a91)
- Agent system improved with better workflows and compliance guidelines (af70a91)
- CLAUDE.md updated with comprehensive UI debugging methods (af70a91)

### Fixed
- Dialog spacing problems in send-cmds, job-picker, and connect-choice dialogs (af70a91)
- Spacing issues in square UI mode with universal CSS reset and dialog-container height fixes (af70a91)
- IFS dialog layout with better header positioning and increased height (af70a91)
- Window positioning issues (>600x500 dimensions) (af70a91)
- All dialogs now work correctly in both rounded and square UI modes with proper edge-to-edge filling (af70a91)

### Removed
- rounded-ui-implementation-plan.md (af70a91)

---

## [1.0.1-alpha.1] - 2025-08-26

### Added
- AI agent system for development automation (ff2f017)
- CLAUDE.md development guide (ff2f017)
- KEY-NOTES.md development documentation (ff2f017)
- PROJECT.md comprehensive project documentation (ff2f017)
- 8 specialized AI agents: ascii-diagram-designer, code-documenter, codebase-explorer, comprehensive-docs-generator, electron-security-analyst, production-readiness-auditor, project-typescript-engineer, senior-typescript-reviewer, ui-design-architect (f015cce)
- 11 development automation commands: auto-document, find-disabled-lint, lint-check, load-changes, new-command, production-status, project-status, push, security-audit, type-check (f015cce)
- Auto-connect choice dialog UI (f015cce)
- PowerShell utility scripts for documentation validation and project analysis (f015cce)
- AI reference documentation for TypeScript and Electron best practices (f015cce)
- Connect choice dialog UI component with modern styling (4db4ac6)
- Enhanced auto-connect-choice dialog with improved CSS, accessibility, and visual consistency (4db4ac6)
- ESLint test configuration with Jest globals and relaxed test rules (4db4ac6)
- tsconfig.test.json for proper test file type checking (4db4ac6)
- Manual IP printer connection support with serial number and name extraction (0813d17)
- Flexible ConnectChoiceDialogData interface with index signature (0813d17)
- Oxlint migration analysis documentation (4db4ac6)
- BIOME_MIGRATION_RESEARCH.md documentation (f015cce)

### Changed
- DialogHandlers refactored to use connect choice dialog for better UX flow (4db4ac6)
- Window management system updated to support new dialog types (4db4ac6)
- Connection management system enhanced (f015cce)
- Dialog integration service improved (f015cce)
- Window factory system enhanced with new dialog support (f015cce)
- CLAUDE.md completely rewritten with comprehensive development guide (f015cce)
- Project permissions and configuration updated for expanded development capabilities (f015cce)

### Fixed
- Type safety issues in connect choice dialog with proper interface definitions (0813d17)
- Unused state variables removed in dialog renderer (0813d17)
- ESLint issues caused by improper test setup and missing test configuration (4db4ac6)

### Security
- Updated npm dependencies for security patches (0813d17)
- Updated @eslint/plugin-kit, compression, form-data, on-headers, tmp (0813d17)

---

## [1.0.1] - 2025-07-27

### Added
- TypeScript support - Complete project rewrite from JavaScript to TypeScript (7932309)
- AD5X printer backend support (material station, transforms, types, utilities) (7932309)
- Adventurer5M backend (7932309)
- Adventurer5MPro backend (7932309)
- DualAPI backend for printers supporting both legacy and new APIs (7932309)
- GenericLegacy backend (7932309)
- Multi-printer support - Save and manage multiple printer configurations (7932309)
- Config migration system for existing single-printer configs (7932309)
- TypeScript type definitions for camera, config, IPC, notifications, polling, printer backend operations, printer features, and global types (7932309)
- ESLint configuration (7932309)
- AutoConnectService (7932309)
- CameraProxyService (7932309)
- ConnectionEstablishmentService (7932309)
- ConnectionStateManager (7932309)
- DialogIntegrationService (7932309)
- EnvironmentDetectionService (7932309)
- MainProcessPollingCoordinator (7932309)
- PrinterDataTransformer (7932309)
- PrinterDiscoveryService (7932309)
- PrinterPollingService (7932309)
- SavedPrinterService (7932309)
- StaticFileManager (7932309)
- ThumbnailCacheService (7932309)
- ThumbnailRequestQueue (7932309)
- NotificationService (7932309)
- PrinterNotificationCoordinator (7932309)
- Validation schemas for config, jobs, and printers (7932309)
- WebUI server with AuthManager, WebSocketManager, WebUIManager, API routes (7932309)
- WebUI static client with TypeScript rewrite (7932309)
- Window factory system with CoreWindowFactory, DialogWindowFactory, UtilityWindowFactory (7932309)
- IFS dialog for material station (7932309)
- Input dialog (7932309)
- Material info dialog (7932309)
- Material matching dialog (7932309)
- Single color confirmation dialog (7932309)
- Utility modules: EventEmitter, PrinterUtils, camera-utils, dom.utils, error.utils, extraction.utils, time.utils, validation.utils (7932309)
- TypeScript configuration (tsconfig.json, tsconfig.renderer.json) (7932309)
- Webpack configuration (7932309)
- Linux asset scripts (afterInstall.sh, afterRemove.sh) (7932309)
- PowerShell script for counting lines (7932309)
- copy-webui-assets.js script (7932309)
- Unit tests for EnvironmentDetectionService and StaticFileManager (7932309)

### Changed
- Version bumped from 1.0.0 to 1.0.1 (b7eaf6b)
- README.md download link updated to v1.0.1 (b7eaf6b)
- package-lock.json regenerated with new dependencies (b7eaf6b)
- package.json updated with TypeScript dependencies (7932309)
- .github/workflows/release.yml updated for TypeScript build (7932309)
- .gitignore updated for TypeScript and build artifacts (7932309)
- electron-builder-config.js updated for TypeScript build (7932309)
- jest.config.js updated for TypeScript (7932309)
- Application entry points converted to TypeScript (index.ts, preload.ts, renderer.ts) (7932309)
- All UI dialogs rewritten in TypeScript with improved type safety (7932309)
- CSS styling updated across all UI components (7932309)
- IPC handlers reorganized into domain-specific modules (7932309)
- Complete architecture refactor from manager-based to service-based system (7932309)
- WebUI server rewritten in TypeScript with improved type safety (7932309)
- WebUI static client completely rewritten in TypeScript (7932309)
- All dialogs modernized with improved UX and TypeScript (7932309)

### Fixed
- Numerous bugs fixed during TypeScript rewrite (7932309)
- Type safety issues resolved across entire codebase (7932309)
- Config migration from single-printer to multi-printer system (7932309)

### Removed
- Legacy JavaScript files removed after TypeScript conversion (7932309)
- Old manager-based architecture files (7932309)
- Legacy WebUI server JavaScript files (7932309)
- Old build/linux scripts (moved to assets/linux) (7932309)

### Security
- npm dependencies updated with security patches (b7eaf6b)

---

## [1.0.0] - 2025-05-31

### Added
- Initial release of FlashForgeUI (68035df)
- Complete application architecture including ApplicationBootstrapper, ApplicationLifecycle, EventCoordinator, ServiceManager (65479a5)
- IPC communication system with handlers for cameras, dialogs, jobs, printers, settings, WebUI, windows (65479a5)
- Camera management with CameraManager, CameraService, SimpleCameraProxy (65479a5)
- Dialog management system (65479a5)
- Printer connection manager with client adapter (65479a5)
- Printer modules: CommandForwarder, ConnectionFlowManager, ConnectionStateManager, PrinterEventHandler, PrinterNotificationCoordinator (65479a5)
- Window management system (65479a5)
- Discord notification manager (65479a5)
- Job picker dialog with UI components (65479a5)
- Job uploader with drag-and-drop support (65479a5)
- Printer selection dialog (65479a5)
- Send commands dialog (65479a5)
- Settings dialog (65479a5)
- Status dialog (65479a5)
- Utility modules: ApplicationUtils, CSSUtils, EventUtils, MachineStateUtils, NotificationUtils, ThumbnailCache, UIUtils (65479a5)
- WebUI server with authentication, WebSocket support, API routes, command processor (65479a5)
- WebUI static client with modules for auth, camera, DOM management, file management, printer data, UI utils, WebSocket (65479a5)
- GitHub Actions release workflow (65479a5)
- Electron builder configuration (65479a5)
- Jest test configuration (65479a5)
- Babel configuration (65479a5)
- Linux build scripts (afterInstall, afterRemove) (65479a5)
- Application icons (ico, icns, png) (65479a5)

### Changed
- README.md - Added download link to v1.0.0 release and feature comparison table (fcd8750)
