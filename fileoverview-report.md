# Fileoverview Report

Generated: 2025-11-26T23:31:33.662Z
Total files scanned: 242
Files with @fileoverview: 230

## src/bootstrap.ts

Bootstrap module for FlashForgeUI Electron application.

CRITICAL: This file must be imported FIRST in index.ts, before any other imports.

Purpose:
Sets the Electron app name and user model ID before any singletons are instantiated.
This ensures that all services using app.getPath('userData') point to the correct
directory across all platforms and execution modes (normal UI and headless).

Problem it solves:
- Singletons like ConfigManager and PrinterDetailsManager capture app.getPath('userData')
  during construction
- If app.setName() is called after these singletons are created, they will use the wrong
  directory (e.g., "Electron" instead of "FlashForgeUI")
- This caused headless mode on macOS/Linux to read from a different config directory
  than the main UI, resulting in missing per-printer settings (custom camera/LED config)

Platform-specific userData paths:
- macOS: ~/Library/Application Support/FlashForgeUI/
- Linux: ~/.config/FlashForgeUI/
- Windows: %APPDATA%/FlashForgeUI/

Without this bootstrap (default "Electron" name):
- macOS: ~/Library/Application Support/Electron/
- Linux: ~/.config/Electron/
- Windows: %APPDATA%/Electron/

## src/index.ts

Main Electron process entry point.

This file is the heart of the Electron application, responsible for initializing
the app, creating the main browser window, and orchestrating all backend

services and managers. It follows a modular architecture, delegating specific
responsibilities to dedicated modules for better organization and maintainability.

Key responsibilities include:
- Handling the Electron app lifecycle (ready, activate, window-all-closed, before-quit).
- Ensuring a single instance of the application is running.
- Creating and managing the main application window (BrowserWindow).
- Initializing all core managers (ConfigManager, ConnectionFlowManager, etc.).
- Setting up IPC handlers for communication between the main and renderer processes.
- Coordinating background services like printer polling and camera streaming.
- Managing application-level concerns like power-saving and environment detection.

## src/ipc/camera-ipc-handler.ts

Camera IPC handler for managing camera streaming operations across printer contexts.

Provides comprehensive camera management through IPC handlers for both MJPEG and RTSP streaming:
- Multi-context camera support with per-printer camera proxy servers
- Automatic camera configuration resolution based on printer capabilities and user preferences
- RTSP stream relay for streaming RTSP camera feeds via WebSocket (5M Pro)
- MJPEG camera proxy setup with unique port allocation per context
- Camera stream restoration and error recovery mechanisms
- Integration with per-printer settings for camera source configuration

Key exports:
- CameraIPCHandler class: Main handler for all camera-related IPC operations
- cameraIPCHandler singleton: Pre-initialized handler instance

The handler coordinates with CameraProxyService, RtspStreamService, and PrinterContextManager
to provide seamless camera streaming across multiple printer connections. Each printer context
maintains its own camera proxy on a unique port (8181-8191 range).

## src/ipc/DialogHandlers.ts

Legacy dialog handlers for loading overlay and printer connection flow.

Provides IPC handlers for application-level dialogs and loading states:
- Enhanced printer connection flow with network scan vs manual IP entry choice
- Loading overlay state management (show/hide/progress/success/error)
- Connection confirmation dialogs when switching printers
- Integration with LoadingManager for centralized loading state

Key functionality:
- setupDialogHandlers(): Initializes all dialog-related IPC handlers
- Connect choice dialog for network scan or manual IP input
- Loading manager event forwarding to renderer process
- Printer connected warning dialog for connection switching

Note: Most domain-specific dialog handlers have been moved to modular handlers in
src/ipc/handlers/ (job-handlers, material-handlers, etc.). This file primarily handles
connection flow and loading overlay operations.

## src/ipc/handlers/backend-handlers.ts

Backend-related IPC handlers for printer status and data retrieval operations.

Provides IPC handlers for accessing printer backend data in multi-context environment:
- Model preview retrieval for current print jobs
- General printer data requests (legacy compatibility)
- Material station status queries
- Printer feature detection and capability information

Key exports:
- registerBackendHandlers(): Registers all backend-related IPC handlers

All handlers are context-aware and operate on the active printer context by default.
The centralized polling system (MainProcessPollingCoordinator) provides real-time updates
via the 'polling-update' IPC channel, reducing the need for manual polling from renderer.

## src/ipc/handlers/camera-handlers.ts

Camera IPC handler registration

Provides registration function for camera-related IPC handlers to be included
in the central handler registration system. This ensures camera handlers are
available before any windows are created.

## src/ipc/handlers/component-dialog-handlers.ts

IPC handlers for component dialog windows

Provides IPC communication handlers for opening component dialogs and
retrieving component metadata for rendering.

Handlers:
- component-dialog:open: Opens dialog for specified component
- component-dialog:get-info: Returns component metadata (forwarded to main window)

@author FlashForgeUI Team
@module ipc/handlers/component-dialog-handlers

## src/ipc/handlers/connection-handlers.ts

Connection-related IPC handlers for printer discovery and connection management.

Provides IPC handlers for managing printer connections in multi-context environment:
- Network discovery initiation and flow management
- Manual IP address connection support
- Printer selection dialog control (open/cancel)
- Integration with ConnectionFlowManager for connection orchestration

Key exports:
- registerConnectionHandlers(): Registers all connection-related IPC handlers

Note: Direct printer selection handlers have been removed to prevent duplicate connections.
Connection is now handled exclusively through DialogIntegrationService to ensure proper
context creation and resource management in the multi-printer architecture.

## src/ipc/handlers/control-handlers.ts

Printer control IPC handlers for temperature, LED, print control, and operational commands.

Provides IPC handlers for direct printer control operations with dual-API support:
- Temperature control (bed/extruder set/cancel) via legacy G-code client
- LED control (on/off) with support for built-in and custom LED configurations
- Print job control (pause/resume/cancel) via backend manager
- Axis homing operations via legacy G-code client
- Filtration control (off/internal/external) for 5M Pro printers
- Platform clearing operations for new API printers

Key exports:
- registerControlHandlers(): Registers all printer control IPC handlers
- getLegacyClient(): Helper to extract legacy FlashForgeClient from backend

The handlers intelligently route operations to the appropriate client (FiveMClient for new API,
FlashForgeClient for legacy/G-code operations) based on printer capabilities and operation type.
All operations are context-aware and operate on the active printer context.

## src/ipc/handlers/dialog-handlers.ts

Dialog-related IPC handlers for application dialogs and window management.

Provides comprehensive IPC handlers for all application dialogs and their operations:
- Settings dialog (open/close/save configuration)
- Status dialog (system stats, printer info, WebUI/camera status)
- Log dialog (view/clear application logs with real-time updates)
- Input dialog (generic user input prompts)
- Job management dialogs (uploader, picker)
- Send commands dialog (G-code/command execution)
- Material dialogs (IFS, material info, matching, single-color confirmation)
- Generic window controls (minimize/close for sub-windows)

Key exports:
- registerDialogHandlers(): Registers all dialog-related IPC handlers

The handlers coordinate with multiple managers (ConfigManager, WindowManager, BackendManager)
and services (LogService, WebUIManager, CameraProxyService) to provide comprehensive dialog
functionality. Supports context-aware operations for multi-printer architecture.

## src/ipc/handlers/index.ts

Central registration point for all IPC handlers in the application.

Provides unified registration of all domain-specific IPC handler modules:
- Connection handlers for printer discovery and connection management
- Backend handlers for printer status and data retrieval
- Job handlers for job management and file operations
- Dialog handlers for application dialogs and window management
- Material handlers for material station operations
- Control handlers for printer control commands
- WebUI handlers for web server control
- Camera handlers for camera streaming operations
- Printer settings handlers for per-printer configuration

Key exports:
- AppManagers interface: Required managers for IPC handler initialization
- registerAllIpcHandlers(): Main registration function called during app initialization

This module serves as the single entry point for IPC handler registration, ensuring
consistent initialization order and dependency injection for all handler modules.

## src/ipc/handlers/job-handlers.ts

Job-related IPC handlers for print job management and file operations.

Provides comprehensive job management IPC handlers with support for different printer types:
- Local job listing and retrieval from printer storage
- Recent job listing from printer history
- Job starting with leveling and material mapping support
- File upload with progress tracking (standard and AD5X workflows)
- Thumbnail retrieval with caching and queue management
- Slicer file metadata parsing and validation

Key exports:
- registerJobHandlers(): Registers all job-related IPC handlers

Special features:
- AD5X upload workflow with material station integration
- Progress simulation for user feedback during uploads
- Thumbnail caching with printer serial number keying
- Request queue management for efficient thumbnail fetching
- Integration with ThumbnailCacheService and ThumbnailRequestQueue

All handlers are context-aware and operate on the active printer context, with feature
detection to ensure operations are only available on supported printer models.

## src/ipc/handlers/material-handlers.ts

Material station IPC handlers for material management operations.

Provides IPC handlers for material station operations on AD5X printers:
- Material station status monitoring (currently via centralized polling)
- Future material control operations (slot selection, eject, load)
- Material information queries

Key exports:
- registerMaterialHandlers(): Registers material station IPC handlers

Note: Material station status is currently provided through the centralized polling system
via MainProcessPollingCoordinator and the 'polling-update' IPC channel. This module serves
as a placeholder for future direct material control operations when implemented.

Planned future handlers:
- set-active-material-slot: Change active material slot
- eject-material: Eject filament from slot
- load-material: Load filament into slot
- get-material-info: Query detailed material information

## src/ipc/handlers/printer-settings-handlers.ts

Per-Printer Settings IPC Handlers

Handles IPC communication for per-printer settings (camera, LEDs, legacy mode).
Settings are stored per-printer in printer_details.json.

## src/ipc/handlers/shortcut-config-handlers.ts

IPC handlers for shortcut button configuration

Provides IPC communication handlers for the shortcut configuration dialog,
including opening the dialog, loading/saving configuration, and getting
available components.

Handlers:
- shortcut-config:open: Opens the configuration dialog
- shortcut-config:get-current: Returns current shortcut configuration
- shortcut-config:save: Saves new configuration and notifies main window
- shortcut-config:get-available-components: Returns component list with pinned status

@author FlashForgeUI Team
@module ipc/handlers/shortcut-config-handlers

## src/ipc/handlers/spoolman-handlers.ts

Spoolman IPC handlers for dialog and API operations

Provides IPC communication layer between renderer processes and Spoolman service.
Handles dialog window management, spool search operations, spool selection broadcasting,
and connection with the SpoolmanService for REST API calls.

Key Features:
- Open spool selection dialog with singleton behavior
- Search spools via SpoolmanService REST API
- Broadcast spool selection to all renderer windows
- Validate Spoolman configuration before operations

IPC Channels:
- `spoolman:open-dialog` - Open spool selection dialog
- `spoolman:search-spools` - Search for spools matching query
- `spoolman:select-spool` - Broadcast selected spool to renderers

@module ipc/handlers/spoolman-handlers

## src/ipc/handlers/theme-handlers.ts

IPC handlers for theme-related operations.

## src/ipc/handlers/update-handlers.ts

IPC handlers coordinating auto-update operations between renderer dialogs and the main process.

Registers invoke handlers and event forwarding for the AutoUpdateService:
- Manual update checks and downloads triggered from settings or dialogs
- Platform-aware installation commands (auto on Windows, manual on macOS/Linux)
- Release page fallback for Linux users
- Channel switching between stable and alpha streams
- State change broadcasting to main window and update dialog renderer

Integration Points:
- AutoUpdateService for core update lifecycle
- ConfigManager for storing user preferences (channel)
- WindowManager + Dialog factory for update notification dialog management

## src/ipc/handlers/webui-handlers.ts

IPC handlers for WebUI server control and status management.

Provides main process API for controlling the embedded web server from renderer process:
- Start/stop WebUI server operations
- Server status queries (running state, URL, port, client count)
- Printer status broadcasting to connected WebUI clients
- Integration with WebUIManager for server lifecycle management

Key exports:
- registerWebUIHandlers(): Registers WebUI server control IPC handlers
- unregisterWebUIHandlers(): Cleanup function for handler removal

The WebUI server provides remote access to printer monitoring and control through a
web interface accessible from any device on the local network. These handlers enable
the desktop application to manage the server lifecycle and forward printer status
updates to connected web clients via WebSocket.

## src/ipc/printer-context-handlers.ts

IPC handlers for printer context management.

Provides IPC communication layer for multi-printer context management,
enabling the renderer process to manage multiple simultaneous printer connections.

Key exports:
- setupPrinterContextHandlers(): Registers all printer context IPC handlers

## src/ipc/WindowControlHandlers.ts

Window control IPC handlers for main window frame operations.

Provides IPC handlers for custom title bar window controls:
- Window minimize operation
- Window maximize/restore toggle operation
- Window close operation (triggers app quit)

Key exports:
- setupWindowControlHandlers(): Registers all window control IPC handlers

These handlers enable the custom frameless window title bar to control the main window,
replacing the native OS window controls. The close handler directly quits the application
to ensure proper process cleanup when using a custom title bar.

## src/managers/ConfigManager.ts

Centralized configuration manager for application settings with automatic persistence.

Provides type-safe configuration management with event-driven updates and file persistence:
- Live in-memory configuration access with atomic updates
- Automatic file persistence on changes with debounced saves
- Event emission for configuration updates across the application
- Thread-safe access through getters/setters
- Type safety with branded types and validation
- Lock file handling to prevent concurrent modifications

Key exports:
- ConfigManager class: Singleton configuration manager
- getConfigManager(): Singleton accessor function

The configuration is stored in the user data directory (config.json) and includes
application-wide settings like WebUI, camera, LED, polling, and auto-connect preferences.
All configuration changes are validated and sanitized before persistence.

## src/managers/ConnectionFlowManager.ts

Connection flow orchestrator for managing printer discovery and connection workflows.

Provides high-level coordination of printer connection operations in multi-context environment:
- Network discovery flow management with printer selection
- Direct IP connection support with check code prompts
- Auto-connect functionality for previously connected printers
- Saved printer management and connection restoration
- Connection state tracking and event forwarding
- Multi-context connection flow tracking for concurrent connections

Key exports:
- ConnectionFlowManager class: Main connection orchestrator
- getPrinterConnectionManager(): Singleton accessor function

The manager coordinates multiple specialized services:
- PrinterDiscoveryService: Network scanning and printer detection
- SavedPrinterService: Persistent printer storage
- AutoConnectService: Automatic connection on startup
- ConnectionStateManager: Connection state tracking
- DialogIntegrationService: User interaction dialogs
- ConnectionEstablishmentService: Low-level connection setup

Supports concurrent connection flows with unique flow IDs and context tracking,
enabling multi-printer connections while maintaining proper state isolation.

## src/managers/HeadlessManager.ts

Headless Mode Manager - Orchestrates headless mode initialization

Manages the complete lifecycle of headless mode operation including:
- Connection to printers (saved, last-used, or explicit)
- WebUI server startup and monitoring
- Polling coordination across multiple printers
- Graceful shutdown with resource cleanup

## src/managers/LoadingManager.ts

Centralized loading state manager for modal loading overlays and user feedback.

Provides comprehensive loading state management for preventing user interaction during async operations:
- Modal loading overlay control (show/hide/progress)
- Success and error state display with auto-hide functionality
- Progress tracking with percentage updates
- Cancelable operations support
- Event-driven state updates for renderer synchronization

Key exports:
- LoadingManager class: Main loading state controller
- getLoadingManager(): Singleton accessor function
- LoadingState type: State enumeration (hidden/loading/success/error)
- LoadingOptions interface: Configuration for loading operations

The manager emits events that are forwarded to the renderer process via IPC handlers,
enabling synchronized loading state display across the application. Supports auto-hide
functionality for success/error states with configurable timeout values.

## src/managers/PrinterBackendManager.ts

Central coordinator for printer backend operations in multi-context environment.

Provides unified management of printer backends with support for multiple concurrent connections:
- Backend selection and instantiation based on printer model type
- Multi-context backend lifecycle management (initialization/disposal)
- Feature detection and capability queries for UI adaptation
- Job operations routing to appropriate backend (start/pause/resume/cancel)
- Material station operations for AD5X printers
- G-code command execution with client type routing
- Event forwarding for backend state changes

Supported backends:
- Adventurer5MBackend: For Adventurer 5M printers
- Adventurer5MProBackend: For Adventurer 5M Pro printers
- AD5XBackend: For AD5X series printers with material station
- GenericLegacyBackend: Fallback for legacy/unknown printers

Key exports:
- PrinterBackendManager class: Main backend coordinator
- getPrinterBackendManager(): Singleton accessor function

The manager maintains a context-to-backend mapping, enabling independent backend operations
for each connected printer. All operations accept an optional contextId parameter, defaulting
to the active context if not provided.

## src/managers/PrinterContextManager.ts

Manages multiple printer contexts for simultaneous multi-printer connections.

The PrinterContextManager is a singleton service that coordinates multiple printer
connections by maintaining separate contexts for each printer. Each context contains
all the state needed for a complete printer connection: backend, polling service,
camera proxy, and connection state.

Key Responsibilities:
- Create and manage printer contexts with unique IDs
- Track the active context for UI/API operations
- Provide context switching with proper event notifications
- Clean up resources when contexts are removed
- Emit events for UI synchronization

Architecture:
- Uses EventEmitter pattern for loose coupling with UI/services
- Maintains Map of contexts indexed by unique string IDs
- Tracks single active context ID for default operations
- Delegates resource cleanup to context owners (backends, services)

Usage:
```typescript
const manager = PrinterContextManager.getInstance();

// Create new context for a printer
const contextId = manager.createContext(printerDetails);

// Switch to a different context
manager.switchContext(contextId);

// Get active context for operations
const context = manager.getActiveContext();
if (context?.backend) {
  await context.backend.sendGCode('M105');
}
```

Events:
- 'context-created': (contextId: string) - New context created
- 'context-removed': (contextId: string) - Context removed and cleaned up
- 'context-switched': (contextId: string, previousId: string | null) - Active context changed

Related:
- PrinterBackendManager: Manages backends within contexts
- PrinterPollingService: Per-context polling service
- CameraProxyService: Per-context camera streaming

## src/managers/PrinterDetailsManager.ts

Multi-printer details persistence manager for storing printer connection information.

Provides comprehensive printer details storage and retrieval with multi-printer support:
- Multi-printer configuration persistence to printer_details.json
- Printer details validation and sanitization
- Last-used printer tracking (global and per-context)
- Per-printer settings storage (camera, LEDs, legacy mode)
- Runtime per-context last-used tracking
- Automatic migration of legacy single-printer configurations

Key exports:
- PrinterDetailsManager class: Main persistence manager
- getPrinterDetailsManager(): Singleton accessor function

Storage structure:
- Global last-used printer serial number
- Per-printer details keyed by serial number
- Per-printer custom settings (camera URLs, LED configuration)
- Runtime context-to-printer mapping (not persisted)

The manager validates all printer details before persistence, ensuring required fields
(Name, IPAddress, SerialNumber, CheckCode, ClientType, printerModel) are present and
properly formatted. Supports backward compatibility with legacy single-printer storage.

## src/printer-backends/ad5x/ad5x-transforms.ts

AD5X data transformation functions for converting API responses to UI-friendly structures.

Provides transformation functions to convert ff-api data structures to UI-specific types:
- Material station transformation (MatlStationInfo → MaterialStationStatus)
- Slot information transformation (SlotInfo → MaterialSlotInfo)
- Status determination and state mapping
- Empty state creation for error conditions

Key exports:
- transformMaterialStation(): Convert API material station to UI structure
- transformSlotInfo(): Convert API slot to UI slot (0-based indexing, isEmpty flag)
- createEmptyMaterialStation(): Generate disconnected state for error cases
- determineOverallStatus(): Map API state to UI status indicators

Transformations handle:
- Index conversion (1-based API → 0-based UI)
- Field inversions (hasFilament → isEmpty for UI clarity)
- Status mapping (stateAction/stateStep → ready/warming/error/disconnected)
- Error state creation with appropriate default values

## src/printer-backends/ad5x/ad5x-types.ts

AD5X type definitions and re-exports for material station and job management.

Centralizes all AD5X-related types with two-layer type system:
- ff-api types: Raw API response structures from printer
- UI-specific types: Transformed structures for consistent UI presentation

Key exports:
- Material station types (MatlStationInfo, SlotInfo from ff-api)
- Job types (FFGcodeToolData, AD5XMaterialMapping, job params)
- UI types (MaterialStationStatus, MaterialSlotInfo for consistent rendering)
- Type guards (isAD5XMachineInfo, hasValidMaterialStationInfo)

The two-layer approach separates API concerns from UI concerns:
- ff-api types match the printer's raw responses exactly
- UI types provide 0-based indexing, isEmpty flags, and friendly field names
This separation enables API evolution without breaking UI components.

## src/printer-backends/ad5x/ad5x-utils.ts

AD5X utility functions for type guards, validation, and material station operations.

Provides centralized utility functions for AD5X printer operations:
- Type guards for AD5X-specific data structures
- Material compatibility validation
- Material station status extraction and transformation
- Multi-color job detection
- Job validation and analysis

Key exports:
- isAD5XJobInfo(): Type guard for AD5X job detection
- isMultiColorJob(): Detect if job requires material station
- validateMaterialCompatibility(): Check tool-slot material matching
- extractMaterialStationStatus(): Extract and transform material station from machine info

This module centralizes logic previously scattered across multiple dialog files,
providing a single source of truth for AD5X-specific validation and extraction logic.
Used by AD5XBackend and material-related dialogs for consistent material management.

## src/printer-backends/ad5x/index.ts

AD5X module barrel export for centralized access to AD5X functionality.

Provides a single export point for all AD5X-related types, transforms, and utilities:
- AD5X type definitions and type guards
- Material station data transformation functions
- Material compatibility validation utilities
- Job validation and helper functions

Key exports:
- All types from ad5x-types.ts (Material station, slot info, job types)
- All transforms from ad5x-transforms.ts (Data structure conversions)
- All utilities from ad5x-utils.ts (Type guards, validators, extractors)

This barrel export enables clean imports throughout the application:
- import { isAD5XJobInfo, extractMaterialStationStatus } from './ad5x'
Instead of navigating individual module paths.

## src/printer-backends/AD5XBackend.ts

Backend implementation for AD5X printers with material station support.

Provides backend functionality specific to the AD5X series with advanced material management:
- Dual API support (FiveMClient + FlashForgeClient)
- Material station integration with 4-slot filament management
- Multi-color printing support with material mapping
- AD5X-specific job operations (upload 3MF with material mappings)
- Material station status monitoring (slot contents, active slot, heating status)
- No built-in camera (custom camera URL supported)
- Custom LED control via G-code (when enabled)
- No built-in filtration control

Key exports:
- AD5XBackend class: Backend for AD5X series printers

This backend extends DualAPIBackend and adds material station functionality through
ff-api's AD5X-specific methods. It handles material validation, slot mapping, and
multi-color job preparation using the integrated filament feeding system.

## src/printer-backends/Adventurer5MBackend.ts

Backend implementation for Adventurer 5M standard printer with dual API support.

Provides backend functionality specific to the Adventurer 5M standard model:
- Dual API support (FiveMClient + FlashForgeClient)
- No built-in camera (custom camera URL supported)
- LED control via G-code (auto-detected from product endpoint)
- No filtration control (5M standard lacks this feature)
- Full job management capabilities (local/recent jobs, upload, start/pause/resume/cancel)
- Real-time status monitoring
- Custom LED and camera configuration via per-printer settings

Key exports:
- Adventurer5MBackend class: Backend for Adventurer 5M standard printers

This backend extends DualAPIBackend to leverage common dual-API functionality while
defining model-specific features. The main difference from the Pro model is the lack
of built-in camera and filtration control features.

## src/printer-backends/Adventurer5MProBackend.ts

Backend implementation for Adventurer 5M Pro printer with enhanced features.

Provides backend functionality specific to the Adventurer 5M Pro model:
- Dual API support (FiveMClient + FlashForgeClient)
- Built-in RTSP camera support (rtsp://printer-ip:8554/stream)
- Built-in LED control via new API
- Filtration control (off/internal/external modes)
- Full job management capabilities (local/recent jobs, upload, start/pause/resume/cancel)
- Real-time status monitoring
- Enhanced features over standard 5M model

Key exports:
- Adventurer5MProBackend class: Backend for Adventurer 5M Pro printers

This backend extends DualAPIBackend to leverage common dual-API functionality while
defining Pro-specific features. Key differences from standard 5M include built-in
RTSP camera and filtration control capabilities.

## src/printer-backends/BasePrinterBackend.ts

Abstract base class for all printer-specific backend implementations.

Provides common functionality and enforces interface contracts for printer backends:
- Client management (primary and optional secondary clients)
- Feature detection and capability reporting
- Command execution routing (G-code and printer control)
- Status monitoring and data retrieval
- Event emission for backend state changes
- Per-printer settings integration (camera, LEDs, legacy mode)
- Feature override mechanism for UI-driven capability changes

Key exports:
- BasePrinterBackend abstract class: Foundation for all backend implementations

All printer backends must extend this class and implement:
- getBaseFeatures(): Define printer-specific feature set
- getPrinterStatus(): Fetch current printer status
- Various operation methods (job control, material station, etc.)

The backend system supports dual-API printers (FiveMClient + FlashForgeClient) and
legacy printers (FlashForgeClient only), providing a unified interface for UI operations
regardless of the underlying API implementation.

## src/printer-backends/DualAPIBackend.ts

Abstract base class for dual-API printer backends using both FiveMClient and FlashForgeClient.

Provides common implementation for modern printers that support both HTTP and TCP APIs:
- Dual client management (FiveMClient for HTTP, FlashForgeClient for G-code)
- Product information fetching and caching
- Automatic LED and filtration detection from product endpoint
- Enhanced job management (local/recent jobs, upload, start with leveling)
- Real-time status monitoring via new API
- Reduced code duplication across Adventurer 5M/Pro and AD5X backends

Key exports:
- DualAPIBackend abstract class: Foundation for dual-API printers

Child classes must implement:
- getChildBaseFeatures(): Define model-specific base features
- getMaterialStationStatus(): Material station support (or return empty status)

This abstraction extracts common functionality from Adventurer5MBackend, Adventurer5MProBackend,
and AD5XBackend, reducing code duplication while maintaining model-specific feature differentiation.

## src/printer-backends/GenericLegacyBackend.ts

Backend implementation for legacy FlashForge printers using FlashForgeClient only.

Provides backend support for legacy printers that only support the legacy TCP API:
- Single client operation (FlashForgeClient only, no FiveMClient)
- Basic job control (pause/resume/cancel via G-code)
- G-code command execution
- Status monitoring through legacy status parsing
- Custom camera URL support (no built-in camera)
- Custom LED control via G-code (when enabled)
- No built-in features (filtration, material station)

Key exports:
- GenericLegacyBackend class: Backend for legacy printer models

This backend serves as a fallback for older printer models that don't support the
newer HTTP-based FiveMClient API. It provides basic functionality through G-code
commands and legacy status parsing, ensuring compatibility with all FlashForge printers.

## src/renderer.ts

Main Renderer Process - Component System Integration

This file serves as the main entry point for the renderer process and integrates
the new component system with existing functionality. It replaces the monolithic
UI approach with a clean component-based architecture while preserving all
existing features and behaviors.

Key responsibilities:
- Component system initialization and lifecycle management
- IPC event handling and data flow
- Window controls and basic UI functionality
- Platform detection and styling
- Loading state management
- State tracking integration

Integration approach:
- Uses ComponentManager for centralized component updates
- Preserves all existing event handlers and IPC communication
- Maintains backward compatibility with logging and state tracking
- Provides graceful degradation if components fail to initialize

## src/renderer/gridController.ts

Renderer GridStack controller.

Encapsulates GridStack/component initialization, palette integration, and
helpers for reloading layouts when printer contexts change.

## src/renderer/logging.ts

Renderer logging helpers.

Provides shared log message handling and log panel hydration so modules can
log events without duplicating DOM fallbacks or preload IPC wiring.

## src/renderer/perPrinterStorage.ts

Helper utilities for per-printer layout and shortcut persistence.

## src/renderer/shortcutButtons.ts

Renderer shortcut button controller.

Handles top-bar shortcut slots, IPC wiring with the shortcut config dialog,
and grid reloads when pins change.

## src/services/__tests__/EnvironmentDetectionService.test.ts

Unit tests for EnvironmentDetectionService

Comprehensive test suite validating environment detection, path resolution, and asset
validation functionality across development and production environments. Tests cover
singleton pattern implementation, packaged vs unpackaged detection, environment-aware
path generation, file system validation, and diagnostic information reporting.

Key Features Tested:
- Singleton instance management and consistency
- Environment detection (development/production, packaged/unpackaged)
- Path resolution for WebUI, assets, static files, and preload scripts
- Asset existence and accessibility validation
- Critical asset validation with comprehensive error reporting
- Platform-specific path handling and diagnostic logging

@module services/__tests__/EnvironmentDetectionService.test

## src/services/__tests__/StaticFileManager.test.ts

Unit tests for StaticFileManager service

Validates static file path resolution, asset validation, and environment-aware resource
management. Tests ensure correct behavior across development and production builds,
proper handling of missing or inaccessible assets, and accurate manifest generation.

Key Features Tested:
- Singleton pattern implementation and instance management
- Environment-aware path resolution (main HTML, renderer bundle, preload script)
- Asset type-specific path generation (HTML, CSS, JS, icons, images)
- File validation including existence, accessibility, and metadata checks
- Critical asset validation with comprehensive error reporting
- Asset manifest generation for deployment verification
- Graceful handling of file system errors and permission issues

@module services/__tests__/StaticFileManager.test

## src/services/AutoConnectService.ts

AutoConnectService.ts

Provides automated printer connection functionality for the FlashForgeUI-Electron application.
This service handles the logic for determining when and how to automatically connect to 
previously saved printers based on network discovery results. It implements decision-making
algorithms for selecting the appropriate printer when multiple matches are found, and manages
auto-connect preferences and retry logic. The service follows a singleton pattern and extends
EventEmitter to provide event-based communication with other components.

Key responsibilities:
- Determine when auto-connection should be attempted
- Make decisions about which printer to connect to when multiple options exist
- Manage auto-connect preferences and configuration
- Handle auto-connect retry logic and logging

## src/services/AutoUpdateService.ts

Auto update service orchestrating electron-updater across platforms.

Provides centralized state management and IPC-friendly events for application updates:
- Configures electron-updater for GitHub-based release channels
- Manages stable/alpha channel switching with downgrade control
- Handles update lifecycle states (checking, available, downloading, downloaded, error)
- Tracks download progress and exposes current status snapshots
- Respects configuration preferences (auto download, launch checks)
- Provides platform-aware installation helpers (auto-install on Windows, manual on macOS/Linux)

Key exports:
- UpdateState enum describing lifecycle stages
- getAutoUpdateService(): singleton accessor for AutoUpdateService

The service defers UI responsibilities to IPC handlers while ensuring consistent logging,
platform-specific behavior, and graceful degradation when running in development builds.

## src/services/CameraProxyService.ts

Camera Proxy Service for multi-context camera streaming.

Manages HTTP proxy servers for camera streaming using Express. In multi-context mode,
each printer context gets its own camera proxy server on a unique port, allowing
simultaneous viewing of multiple printer cameras.

Key Responsibilities:
- Allocate unique ports for each context's camera stream (8181-8191 range)
- Manage multiple camera proxy servers, one per context
- Maintain upstream connection to camera sources
- Distribute streams to multiple downstream clients
- Automatic reconnection with exponential backoff
- Clean up resources when contexts are removed

Architecture:
- Multiple Express HTTP servers, one per context
- Port allocation using PortAllocator utility
- Map-based storage of stream info indexed by context ID
- Integration with PrinterContextManager for lifecycle management

Usage:
```typescript
const service = CameraProxyService.getInstance();

// Set stream URL for a context, returns local proxy URL
const localUrl = await service.setStreamUrl(contextId, 'http://printer-ip/camera');

// Get stream URL for active context
const activeUrl = service.getCurrentStreamUrl();

// Remove context stream when disconnecting
await service.removeContext(contextId);
```

Events:
- 'proxy-started': { contextId: string, port: number }
- 'proxy-stopped': { contextId: string }
- 'stream-connected': { contextId: string }
- 'stream-error': { contextId: string, error: string }

Related:
- PortAllocator: Manages port allocation for camera streams
- PrinterContextManager: Context lifecycle management

## src/services/ConnectionEstablishmentService.ts

Service for establishing and validating printer connections with type detection.

Handles the technical aspects of creating and validating printer connections:
- Temporary connection establishment for printer detection
- Printer type and family detection (5M, 5M Pro, AD5X, legacy)
- Client instance creation (FiveMClient and/or FlashForgeClient)
- Connection validation and error handling
- Dual-API support determination
- Check code validation and firmware version retrieval

Key exports:
- ConnectionEstablishmentService class: Low-level connection establishment
- getConnectionEstablishmentService(): Singleton accessor

This service provides the foundation for printer connections, handling the complexity
of determining which API(s) to use and creating appropriate client instances. Works in
conjunction with ConnectionFlowManager for complete connection workflows.

## src/services/ConnectionStateManager.ts

Manager for tracking printer connection state across multiple printer contexts.

Provides centralized connection state management for multi-printer support:
- Per-context connection state tracking
- Client instance storage (primary and secondary clients)
- Printer details management
- Connection status monitoring (connected/disconnected, timestamps)
- Event emission for connection state changes
- Activity tracking for connection health monitoring

Key exports:
- ConnectionStateManager class: Multi-context connection state tracker
- getConnectionStateManager(): Singleton accessor

The manager maintains a separate connection state for each printer context, enabling
independent tracking of multiple simultaneous printer connections. State includes client
instances, printer details, connection status, and activity timestamps.

## src/services/DialogIntegrationService.ts

Service for integrating printer selection dialogs with connection workflows.

Manages user interaction through dialogs during printer connection:
- Printer selection dialog creation and management
- Disconnect confirmation prompts
- Dialog IPC communication setup
- User choice handling (discovered vs saved printers)
- Dialog lifecycle management (creation, data population, cleanup)

Key exports:
- DialogIntegrationService class: Dialog integration coordinator
- getDialogIntegrationService(): Singleton accessor

This service bridges the gap between connection workflows and user interaction,
presenting discovered and saved printers in a selection dialog and handling user
choices to complete connection establishment.

## src/services/discord/DiscordNotificationService.ts

Discord webhook notification service for multi-printer status updates

Provides Discord webhook integration with support for multiple printer contexts.
Sends rich embeds with printer status, temperatures, progress, and print information
to a configured Discord webhook URL. Supports both timer-based periodic updates
and event-driven immediate notifications.

Key Features:
- Multi-context support: Independent timers and state tracking per printer
- Hybrid update mode: Timer-based intervals + event-driven state changes
- Rate limiting: Sequential message sending with configurable delays
- 1:1 embed structure: Matches original JavaScript implementation exactly
- Idle transition detection: Sends notification when transitioning to idle state
- Config-driven: Respects DiscordSync, WebhookUrl, and interval settings
- Error handling: Network failures don't crash the service

Architecture:
- Per-context update timers (Map<contextId, timer>)
- Per-context state tracking for idle transition detection
- Integration with PrinterContextManager for multi-printer iteration
- Integration with ConfigManager for settings and change detection
- Event emitter pattern for state changes and notifications sent

Update Behavior:
- Timer-based: Send updates for all contexts at configured interval (default 5 min)
- Event-driven: Immediate updates on print complete, printer cooled, idle transition
- Idle logic: Only send idle notification when transitioning FROM active TO idle
- Skip idle on timers: Timer updates skip idle printers, only send when printing

@module services/discord/DiscordNotificationService

## src/services/discord/index.ts

Discord webhook notification service exports

Barrel export for Discord notification service and singleton accessor.

@module services/discord

## src/services/EnvironmentDetectionService.ts

Environment detection service for reliable Electron app environment and path resolution.

Provides comprehensive environment detection and resource path management:
- Development vs production mode detection
- Packaged vs unpackaged execution context
- Appropriate resource path resolution for each environment
- WebUI static file path configuration
- Asset and preload script path management
- Environment-specific configuration

Key exports:
- EnvironmentDetectionService class: Environment detection and path resolver
- getEnvironmentDetectionService(): Singleton accessor
- Environment/ExecutionContext types

Essential for proper static file serving and asset loading across different deployment
scenarios. Handles the complexity of Electron's packaged vs development paths, ensuring
correct resource loading regardless of how the application is executed.

## src/services/LogService.ts

Centralized Log Service

This service provides centralized log message storage and management for the application.
It stores log messages in memory and provides APIs for:
- Adding new log messages
- Retrieving all stored messages
- Clearing log messages
- Broadcasting new messages to interested parties (like the log dialog)

The service uses the EventEmitter pattern to notify subscribers of new log messages,
allowing for real-time updates in the log dialog window.

Key features:
- Memory-based log storage with configurable maximum entries
- Real-time message broadcasting via EventEmitter
- Timestamp management for log entries
- Thread-safe operations for concurrent access

Usage:
  const logService = LogService.getInstance();
  logService.addMessage('Application started');
  const messages = logService.getMessages();

## src/services/MainProcessPollingCoordinator.ts

Centralized polling coordinator running in main process for single-printer mode.

Manages centralized printer status polling and distribution to all consumers:
- Direct backend polling without IPC chains
- Update distribution to renderer process via IPC
- Update distribution to WebUI clients via WebSocket
- Polling pause/resume control
- Polling data caching for immediate access
- Notification coordination for status changes

Key exports:
- MainProcessPollingCoordinator class: Centralized polling manager
- getMainProcessPollingCoordinator(): Singleton accessor

Note: This coordinator is used for single-printer mode. For multi-printer support,
see MultiContextPollingCoordinator which handles polling across multiple printer
contexts with dynamic frequency adjustment based on active context.

## src/services/MultiContextNotificationCoordinator.ts

Multi-context notification coordinator for managing notifications across multiple printer contexts.

This service manages per-context PrinterNotificationCoordinator instances, ensuring that
each connected printer gets its own notification coordinator that monitors its state
independently. Notifications are sent for ALL connected printers regardless of which
context is currently active in the UI.

Key Features:
- Creates notification coordinator for each printer context
- Connects coordinators to their respective polling services
- Ensures notifications work for all printers simultaneously
- Handles coordinator cleanup when contexts are removed
- Integrates with headless mode detection

Architecture:
- Maps context IDs to PrinterNotificationCoordinator instances
- Listens to PrinterContextManager events for context lifecycle
- Shares single NotificationService instance across all coordinators
- Independent notification state per printer context

Usage:
```typescript
const coordinator = getMultiContextNotificationCoordinator();

// Coordinators are created automatically when contexts are created
// and polling services are attached
```

@module services/MultiContextNotificationCoordinator

## src/services/MultiContextPollingCoordinator.ts

Multi-context polling coordinator for managing polling across multiple printer contexts.

This service coordinates multiple PrinterPollingService instances, one per printer context,
with dynamic polling frequency based on whether a context is active or inactive.
Active contexts poll every 3 seconds, inactive contexts poll every 30 seconds to reduce
load while maintaining status awareness across all connected printers.

Key Responsibilities:
- Create and manage polling service instances per context
- Adjust polling frequencies based on active/inactive context state
- Forward polling events with context identification
- Clean up polling services when contexts are removed
- Listen to PrinterContextManager events for automatic coordination

Architecture:
- Singleton pattern for centralized polling coordination
- Event-driven integration with PrinterContextManager
- Map-based storage of polling services indexed by context ID
- Automatic frequency adjustment on context switch

Usage:
```typescript
const coordinator = MultiContextPollingCoordinator.getInstance();

// Start polling for a context
coordinator.startPollingForContext(contextId);

// Context switching automatically adjusts polling frequencies
// via PrinterContextManager event listeners

// Stop polling for a context
coordinator.stopPollingForContext(contextId);
```

Events:
- 'polling-data': (contextId: string, data: PollingData) - Polling data updated for a context
- 'polling-error': (contextId: string, error: string) - Polling error occurred
- 'polling-started': (contextId: string) - Polling started for context
- 'polling-stopped': (contextId: string) - Polling stopped for context

Related:
- PrinterPollingService: Per-context polling service
- PrinterContextManager: Context lifecycle management
- PrinterBackendManager: Backend instances for polling

## src/services/MultiContextPrintStateMonitor.ts

Multi-context coordinator for print state monitoring services.

Manages PrintStateMonitor instances across multiple printer contexts, ensuring
each printer connection has its own isolated state monitoring instance.

Key Responsibilities:
- Create PrintStateMonitor instances for new printer contexts
- Destroy monitors when contexts are removed
- Provide access to monitors by context ID
- Maintain lifecycle and cleanup for all monitors

@exports MultiContextPrintStateMonitor - Multi-context state monitor coordinator

## src/services/MultiContextSpoolmanTracker.ts

Multi-context Spoolman tracker for managing filament usage tracking across multiple printer contexts.

This service manages per-context SpoolmanUsageTracker instances, ensuring that each
connected printer gets its own usage tracker that monitors filament consumption independently.
Spoolman tracking works for ALL connected printers in both GUI and headless modes.

Key Features:
- Creates Spoolman usage tracker for each printer context
- Connects trackers to their respective temperature monitors
- Handles tracker cleanup when contexts are removed
- Works in both GUI and headless modes (no mode-specific checks)
- Singleton pattern with global instance management

Architecture:
- Maps context IDs to SpoolmanUsageTracker instances
- Listens to PrinterContextManager events for context lifecycle
- Independent usage tracking per printer context
- Integrates with MultiContextTemperatureMonitor for cooling events

Usage:
```typescript
const tracker = getMultiContextSpoolmanTracker();
tracker.initialize();

// Trackers are created automatically when temperature monitors are ready
```

@exports MultiContextSpoolmanTracker - Main coordinator class
@exports getMultiContextSpoolmanTracker - Singleton instance accessor

## src/services/MultiContextTemperatureMonitor.ts

Multi-context temperature monitor for managing temperature monitoring across multiple printer contexts.

This service manages per-context TemperatureMonitoringService instances, ensuring that
each connected printer gets its own temperature monitor that tracks cooling independently.
Temperature monitoring works for ALL connected printers in both GUI and headless modes.

Key Features:
- Creates temperature monitor for each printer context
- Connects monitors to their respective polling services
- Handles monitor cleanup when contexts are removed
- Works in both GUI and headless modes (no mode-specific checks)
- Singleton pattern with global instance management

Architecture:
- Maps context IDs to TemperatureMonitoringService instances
- Listens to PrinterContextManager events for context lifecycle
- Independent temperature monitoring per printer context
- Event forwarding from individual monitors to global listeners

Usage:
```typescript
const monitor = getMultiContextTemperatureMonitor();
monitor.initialize();

// Monitors are created automatically when polling services are ready
```

@exports MultiContextTemperatureMonitor - Main coordinator class
@exports getMultiContextTemperatureMonitor - Singleton instance accessor

## src/services/notifications/index.ts

Notifications module entry point for desktop notification system

Provides centralized access to the complete desktop notification system for printer
events, upload status, and connection state changes. Manages initialization and disposal
of notification services, exports factory functions for creating typed notifications,
and provides convenient wrapper functions for common notification scenarios.

Key Exports:
- NotificationService: Core Electron notification wrapper with OS support detection
- PrinterNotificationCoordinator: Business logic for printer state-based notifications
- Factory functions: Type-safe notification creation with proper data validation
- Utility functions: Settings extraction, state checking, and temperature monitoring
- Initialization: Complete system setup with error handling and headless mode support

Integration Points:
- ConfigManager: Notification preferences and alert settings
- PrinterPollingService: Real-time printer state monitoring
- BasePrinterBackend: Upload completion and error notifications
- ConnectionEstablishmentService: Connection state change notifications

@module services/notifications

## src/services/notifications/NotificationService.ts

Core notification service that wraps Electron's Notification API with proper error handling,
OS support checking, and TypeScript type safety.

This service provides a robust abstraction layer over Electron's native notification system,
managing the entire notification lifecycle from creation to cleanup. It handles platform-specific
compatibility checks, tracks notification state, and provides event-based notification management
with comprehensive error handling.

Key Features:
- Platform compatibility detection using Electron's isSupported() API
- Type-safe wrapper around Electron Notification API with custom notification types
- Event emitter pattern for notification lifecycle events (sent, failed, clicked, closed)
- Automatic notification tracking with metadata (sent time, active status, notification data)
- Priority-based notification timeout configuration (default vs. never timeout)
- Automatic cleanup of old notification tracking data (24-hour retention)
- Support for silent notifications and custom icons
- Singleton pattern with global instance management and test-friendly reset functionality

Core Responsibilities:
- Wrap Electron Notification API with type safety and consistent error handling
- Handle OS compatibility and feature detection before attempting notification display
- Provide comprehensive error handling and fallback behavior for unsupported platforms
- Support notification options including silent mode, icons, and timeout configuration
- Track sent notifications with metadata for management and debugging purposes
- Emit events for notification lifecycle stages (sent, failed, clicked, closed)
- Manage notification cleanup and disposal with automatic resource release

@exports NotificationService - Main service class for notification management
@exports getNotificationService - Singleton instance accessor
@exports resetNotificationService - Test helper for instance reset
@exports NotificationTrackingInfo - Type for notification tracking data

## src/services/notifications/PrinterNotificationCoordinator.ts

Printer notification coordinator that manages notification business logic,
state tracking, and integration with printer polling and configuration systems.

This coordinator acts as the bridge between printer state monitoring (PrinterPollingService),
user notification preferences (ConfigManager), and notification delivery (NotificationService).
It implements intelligent notification logic including duplicate prevention and state-based
notification triggers tied to the printer's operational lifecycle.

Key Features:
- Integration with PrinterPollingService for real-time printer state monitoring
- Configuration-driven notification behavior based on user preferences from ConfigManager
- Stateful notification tracking to prevent duplicate notifications during a print job
- Temperature monitoring coordination via TemperatureMonitoringService for cooled notifications
- Automatic state reset on print start/cancel/error to ensure clean notification cycles
- Support for multiple notification types: print complete, printer cooled, upload complete/failed, connection events
- Event emitter pattern for notification triggers and state changes
- Singleton pattern with global instance management and test-friendly dependency injection

Core Responsibilities:
- Monitor printer state changes from PrinterPollingService and handle state transitions
- Check notification settings from ConfigManager to respect user preferences
- Manage notification state to prevent duplicate notifications within a print cycle
- Coordinate notification sending through NotificationService based on state and settings
- Delegate temperature monitoring to TemperatureMonitoringService for cooled notifications
- Reset state appropriately during print cycles (start, complete, cancel, error transitions)
- Handle connection changes and cleanup resources on disconnect

Temperature Monitoring Coordination:
- Delegates to TemperatureMonitoringService for bed cooling detection
- Listens for 'printer-cooled' events from temperature monitor
- Sends cooled notifications when temperature threshold is met
- Respects notification settings for cooled notifications

@exports PrinterNotificationCoordinator - Main coordinator class for printer notifications
@exports getPrinterNotificationCoordinator - Singleton instance accessor
@exports resetPrinterNotificationCoordinator - Test helper for instance reset
@exports CoordinatorEventMap - Type for coordinator event emissions

## src/services/printer-state.ts

Simple printer state tracker for monitoring printer operational states.

Provides straightforward printer state tracking without complex abstractions:
- Current state tracking (Ready, Printing, Paused, Completed, etc.)
- Simple state checking methods (isPrinting, isReady, etc.)
- Basic state transition validation
- Event emission for state changes
- Connection state monitoring
- No history tracking or complex state machines

Key exports:
- PrinterStateTracker class: Simple state tracker
- STATE_EVENTS: Event name constants
- StateChangeEvent interface

This service intentionally avoids complex state machine patterns, providing a simple
and predictable state tracking mechanism for UI updates. Focuses on current state only
without maintaining transition history or complex validation rules.

## src/services/PrinterDataTransformer.ts

Service for transforming raw printer API data into structured, type-safe formats.

Provides data transformation functions for printer status and material station data:
- Raw API data to PrinterStatus transformation
- Material station data normalization
- State mapping (printer states, print states)
- Safe data extraction with fallbacks
- Default/empty state creation
- Time conversion utilities (seconds to minutes)

Key exports:
- printerDataTransformer singleton: Main transformation service
- transformPrinterStatus(): Convert raw printer data to PrinterStatus
- transformMaterialStation(): Convert raw material station data
- createDefaultStatus(): Generate default PrinterStatus
- createDefaultMaterialStation(): Generate empty material station status

Separates data transformation logic from polling logic, providing a single source of
truth for data structure conversions. Uses safe extraction utilities to handle missing
or malformed data gracefully.

## src/services/PrinterDiscoveryService.ts

Service for network scanning and printer discovery operations.

Provides network-based printer discovery functionality:
- Network-wide printer scanning
- Specific IP address printer detection
- Discovery timeout and interval configuration
- Discovered printer data normalization
- Discovery state management (in-progress tracking)
- Integration with ff-api's FlashForgePrinterDiscovery

Key exports:
- PrinterDiscoveryService class: Network discovery coordinator
- getPrinterDiscoveryService(): Singleton accessor

This service encapsulates all network scanning logic, providing a simple interface
for discovering FlashForge printers on the local network. Used by ConnectionFlowManager
during the printer connection workflow to present available printers to the user.

## src/services/PrinterPollingService.ts

Focused polling service for managing printer status polling loops.

Manages the polling loop with single responsibility principle:
- Periodic printer status polling
- Material station status polling
- Thumbnail data retrieval
- Error handling and retry logic
- Event emission for status updates
- Configurable polling intervals
- Polling start/stop/pause/resume control

Key exports:
- PrinterPollingService class: Main polling loop manager
- createPollingService(): Factory for creating polling service instances
- getGlobalPollingService(): Global polling service accessor
- POLLING_EVENTS: Event name constants

This service focuses solely on the polling loop mechanics, delegating data transformation
to PrinterDataTransformer. Simplified from the original monolithic printer-polling.ts
to adhere to single responsibility principle.

## src/services/PrintStateMonitor.ts

Print state monitoring service for tracking printer state transitions.

This service provides centralized state change detection that can be used by multiple
systems (notifications, Spoolman tracking, temperature monitoring, etc.) without
coupling them to the polling service or duplicating state-tracking logic.

Key Features:
- Per-context state monitoring with centralized detection
- State transition tracking (previousState → currentState)
- Event emissions for all state changes
- Specialized events for print lifecycle (started, completed, cancelled, error)
- Integration with PrinterPollingService for real-time status data
- Multi-context safe (per-instance tracking)

Core Responsibilities:
- Monitor printer status updates from polling service
- Detect state transitions and emit generic 'state-changed' events
- Detect print lifecycle events and emit specialized events
- Track current job name for print lifecycle detection
- Provide current state access for consumers

@exports PrintStateMonitor - Main state monitoring class

## src/services/RtspStreamService.ts

RTSP Stream Service using node-rtsp-stream

Provides RTSP-to-WebSocket streaming using node-rtsp-stream library.
Converts RTSP streams to MPEG1 via ffmpeg and streams via WebSocket for browser playback
using JSMpeg on the client side.

Key Responsibilities:
- Check for ffmpeg availability
- Setup RTSP streams with dedicated WebSocket ports per context
- Manage multiple RTSP streams per printer context
- Handle graceful stream cleanup on disconnect

Usage:
```typescript
const service = getRtspStreamService();
await service.initialize();

// Setup RTSP stream for a context
const wsPort = await service.setupStream(contextId, rtspUrl, { frameRate: 30, quality: 3 });
// Client connects to ws://localhost:${wsPort}

// Stop stream when context disconnects
await service.stopStream(contextId);
```

Related:
- CameraProxyService: Handles MJPEG streaming
- camera-preview component: JSMpeg player for RTSP streams

## src/services/SavedPrinterService.ts

Service for managing saved printer configurations and discovery matching

Manages persistent storage and retrieval of printer configurations, providing matching
logic to correlate saved printers with network-discovered devices. Handles printer
persistence, IP address change detection, last-used tracking, and UI data preparation.

Key Features:
- Persistent printer configuration storage via PrinterDetailsManager integration
- Serial number-based matching between saved and discovered printers
- IP address change detection and automatic update support
- Last connected timestamp tracking for connection priority
- Event emission for configuration changes and updates
- UI-ready data transformation for saved printer display

Singleton Pattern:
Uses singleton pattern to ensure consistent printer data access across the application.
Access via getSavedPrinterService() factory function.

@module services/SavedPrinterService

## src/services/SpoolmanHealthMonitor.ts

Spoolman health monitor coordinating connectivity tests, refreshes, and UI events.

Tracks Spoolman server availability, periodically pings the configured server,
refreshes cached spool data when connectivity is restored, and emits events
so the UI layer can surface offline dialogs or success notifications.

Core responsibilities:
- Periodic connection tests with configurable interval
- Automatic clearing of cached spool data when the server becomes unreachable
- Automatic refresh of active spools when connectivity returns
- Event emission for offline/online transitions and status updates
- Manual retry support for the offline dialog

## src/services/SpoolmanIntegrationService.ts

Spoolman integration service with persistence and AD5X protection

Manages active spool selections across printer contexts with per-printer persistence,
AD5X printer detection/blocking, and event broadcasting for desktop/WebUI synchronization.
This service acts as the single source of truth for active spool data.

Key Features:
- Persistent storage of active spool selections per printer in printer_details.json
- AD5X printer detection and automatic disablement
- Event-driven updates for real-time synchronization
- Integration with SpoolmanService for spool search and details
- Spoolman configuration validation and connection testing

AD5X Detection Logic:
- Material station feature flag (materialStation.available === true), OR
- Printer model string starts with "AD5"

@module services/SpoolmanIntegrationService

## src/services/SpoolmanService.ts

Spoolman API service for filament inventory management

Provides a REST API client for communicating with Spoolman servers to search for
spools, update filament usage, and test connectivity. Implements timeout handling,
error management, and proper request/response validation.

Key Features:
- Search spools with flexible query parameters
- Update filament usage by weight or length (mutually exclusive)
- Connection testing with health check endpoint
- 10-second request timeout with abort controller
- Comprehensive error handling and logging

API Documentation: https://github.com/Donkie/Spoolman
Base API Path: /api/v1/

@module services/SpoolmanService

## src/services/SpoolmanUsageTracker.ts

Spoolman usage tracker for updating filament usage when prints complete.

This service tracks filament usage and updates Spoolman immediately when prints complete, extracted from
PrinterNotificationCoordinator to enable functionality in both GUI and headless modes.

Key Features:
- Listens to PrintStateMonitor 'print-completed' events
- Extracts usage data from printer status (weight/length based on config)
- Updates Spoolman via SpoolmanService API
- Persists updated spool data via SpoolmanIntegrationService
- Per-context tracking with duplicate prevention
- Works in both GUI and headless modes

Core Responsibilities:
- Monitor print state for completion events
- Verify Spoolman is enabled and configured
- Resolve context ID and active spool assignment
- Extract filament usage from print job data
- Update Spoolman server with usage data
- Update local active spool state
- Prevent duplicate updates for the same print

Usage Flow:
1. Print completes
2. PrintStateMonitor emits 'print-completed' event
3. SpoolmanUsageTracker receives event
4. Checks if usage already recorded for this print
5. Verifies Spoolman configuration and active spool
6. Extracts usage data from printer status
7. Calls SpoolmanService.updateUsage() API
8. Updates local state via SpoolmanIntegrationService
9. Marks usage as recorded

@exports SpoolmanUsageTracker - Main tracker class

## src/services/TemperatureMonitoringService.ts

Temperature monitoring service for tracking printer bed cooling after print completion.

This service provides shared temperature monitoring functionality that can be used by multiple
systems (notifications, Spoolman tracking, etc.) without coupling them to each other.

Key Features:
- Per-context temperature monitoring with configurable intervals
- State tracking for print completion and cooling status
- Event emissions when printer bed reaches cooling threshold
- Integration with PrinterPollingService for real-time temperature data
- Integration with PrintStateMonitor for state transition detection
- Automatic state reset on new print start

Core Responsibilities:
- Listen to PrintStateMonitor for print lifecycle events
- Start temperature monitoring when print completes
- Check bed temperature at regular intervals (default: 10 seconds)
- Emit events when bed temperature falls below threshold (default: 35°C)
- Stop monitoring after cooling threshold is met
- Reset state when new print starts

@exports TemperatureMonitoringService - Main temperature monitoring class

## src/services/ThumbnailCacheService.ts

Persistent file-based cache service for printer job thumbnails

Provides a robust file-based caching system for printer job thumbnails to minimize
network requests and improve UI responsiveness. Organizes cache by printer serial
number with MD5-hashed filenames for collision avoidance. Includes metadata tracking,
validation, and comprehensive cache management operations.

Key Features:
- File-based persistence in Electron userData directory
- Per-printer cache organization with metadata tracking
- MD5 hashing of filenames to prevent collisions
- Base64 image storage with automatic data URL handling
- Cache validation and automatic cleanup of orphaned metadata
- Statistics reporting for cache monitoring
- Graceful error handling with detailed result types

Cache Structure:
- Thumbnails/{printerSerial}/{fileNameHash}.png - Thumbnail images
- Thumbnails/{printerSerial}/metadata.json - Cache metadata and timestamps

Singleton Pattern:
Access via getThumbnailCacheService() factory function.

@module services/ThumbnailCacheService

## src/services/ThumbnailRequestQueue.ts

Backend-aware thumbnail request queue with controlled concurrency

Manages thumbnail requests with printer model-specific concurrency limits to prevent
TCP socket exhaustion on legacy printers while maximizing throughput on modern models.
Implements request deduplication, priority ordering, automatic retry logic, and
graceful cancellation support.

Key Features:
- Backend-specific concurrency (legacy: 1, modern: 3 concurrent requests)
- Request deduplication to avoid redundant network calls
- Priority-based queue ordering with FIFO within priority levels
- Automatic retry with exponential backoff (up to 2 retries)
- Multi-context support via PrinterContextManager integration
- Comprehensive statistics tracking and event emission
- Graceful cancellation and queue reset capabilities

Backend Concurrency Configuration:
- generic-legacy: 1 concurrent, 100ms delay (prevents TCP overload)
- adventurer-5m/pro: 3 concurrent, 50ms delay (optimized throughput)
- ad5x: 3 concurrent, 50ms delay (optimized throughput)

Singleton Pattern:
Access via getThumbnailRequestQueue() factory function.

@module services/ThumbnailRequestQueue

## src/types/camera/camera.types.ts

Comprehensive type definitions for camera proxy system

Provides complete type safety for camera configuration, proxy server management,
stream URL resolution, and client connection tracking. Supports both built-in printer
cameras (MJPEG/RTSP) and custom camera URLs with proper validation and type guards.

Key Type Groups:
- Configuration: CameraProxyConfig, CameraUserConfig, ResolvedCameraConfig
- Status & Monitoring: CameraProxyStatus, CameraProxyClient, CameraProxyEvent
- URL Resolution: CameraUrlResolutionParams, CameraUrlBuilder, validation results
- Service Interfaces: ICameraProxyService, CameraIPCMethods for main/renderer bridge
- Protocol Support: MJPEG and RTSP stream types with default URL patterns

Camera Source Priority:
1. Custom camera URL (if enabled in user config)
2. Built-in printer camera (if supported by printer features)
3. None (camera unavailable with reason tracking)

Type Guards:
- isCameraAvailable: Validates camera configuration availability
- isCustomCamera/isBuiltinCamera: Source type discrimination

@module types/camera/camera.types

## src/types/camera/index.ts

Camera types module entry point

Central export point for all camera-related type definitions including configuration
interfaces, proxy status types, URL resolution parameters, and type guard functions.
Re-exports all public types from camera.types.ts for convenient importing.

@module types/camera

## src/types/config.ts

Application configuration type definitions with legacy format compatibility

Defines the complete application configuration schema with exact property name matching
to the legacy JavaScript implementation for seamless config migration. Includes type-safe
defaults, validation functions, sanitization helpers, and change event tracking.

Key Features:
- AppConfig interface with readonly properties for immutability
- MutableAppConfig for internal modification scenarios
- DEFAULT_CONFIG with type-safe constant values
- Configuration validation with isValidConfig type guard
- Sanitization function for safe config loading
- ConfigUpdateEvent for change tracking and listeners
- Port number validation (1-65535 range)

Configuration Categories:
- Notifications: AlertWhenComplete, AlertWhenCooled, AudioAlerts, VisualAlerts
- UI Behavior: AlwaysOnTop, RoundedUI, DebugMode
- Camera: CustomCamera, CustomCameraUrl, CameraProxyPort
- WebUI: WebUIEnabled, WebUIPort, WebUIPassword
- Integrations: DiscordSync, Spoolman
- Themes: DesktopTheme, WebUITheme
- Advanced: ForceLegacyAPI, CustomLeds
- Auto-Update: CheckForUpdatesOnLaunch, UpdateChannel, AutoDownloadUpdates

@module types/config

## src/types/discord.ts

Discord webhook integration type definitions

Defines type-safe interfaces for Discord webhook payloads, embeds, and service configuration.
These types ensure proper structure for Discord API communication and internal service configuration.

Key Features:
- Discord embed structure matching Discord API specification
- Webhook payload format for POST requests
- Service configuration for Discord integration settings
- Type safety for embed field formatting

@module types/discord

## src/types/global-main.d.ts

Global type augmentations for main process

Extends the global namespace and globalThis with main process-specific type definitions.
Provides type safety for global singleton managers and services accessible throughout
the Electron main process.

Global Augmentations:
- printerBackendManager: Global singleton for printer backend orchestration

Usage:
This file is automatically included via tsconfig.json types configuration.
Enables type-safe access to global.printerBackendManager and globalThis.printerBackendManager
without explicit imports.

@module types/global-main

## src/types/global.d.ts

Global type augmentations for renderer process Window interface

Extends the Window interface with Electron API methods exposed by the preload script
via contextBridge, providing complete type safety for IPC communication between
renderer and main processes. Defines interfaces for all exposed APIs including
printer control, camera management, loading states, and window controls.

Key Interface Groups:
- ElectronAPI: Core IPC communication (send, receive, invoke)
- LoadingAPI: Loading state management and progress indication
- CameraAPI: Camera proxy control and stream configuration
- PrinterContextsAPI: Multi-printer context management
- ConnectionStateAPI: Connection status and state queries
- PrinterSettingsAPI: Per-printer settings management
- SpoolmanAPI: Filament tracking and spool management
- WindowControls: Sub-window control methods (minimize, close)

Window Extensions:
- window.api: Main ElectronAPI interface
- window.CAMERA_URL: Camera stream URL constant
- window.windowControls: Window management (sub-windows only)
- window.logMessage: Debug logging helper

@module types/global

## src/types/ipc.ts

Shared IPC type definitions for main/renderer process communication

Provides type-safe interfaces for IPC communication payloads ensuring consistency
between IPC handlers in the main process and preload script type definitions. Covers
job upload parameters, material mappings, and slicer metadata parsing.

Key Types:
- UploadJobPayload: Standard printer job upload with leveling and auto-start options
- AD5XUploadParams: Enhanced upload for AD5X printers with material station mappings
- SlicerMetadata: Parsed gcode/x3g metadata with error handling via slicer-meta library

Integration Points:
- job-handlers.ts: Upload IPC handler implementation
- material-handlers.ts: Material mapping validation
- BasePrinterBackend: Upload method parameter validation
- Preload script: Type-safe API method signatures

@module types/ipc

## src/types/jsmpeg.d.ts

Type definitions for @cycjimmy/jsmpeg-player

Since the @cycjimmy/jsmpeg-player library doesn't provide official TypeScript
type definitions, this file provides type safety for the JSMpeg player used
for RTSP stream rendering via WebSocket.

Based on JSMpeg.js library documentation and actual usage in the application.

Also provides global type declarations for JSMpeg vendored locally in WebUI.

## src/types/node-rtsp-stream.d.ts

Type definitions for node-rtsp-stream-es6

Provides TypeScript type definitions for the node-rtsp-stream-es6 library,
which converts RTSP streams to MPEG1 via ffmpeg and streams via WebSocket.

## src/types/notification.ts

Comprehensive type system for desktop notification management

Provides complete type definitions for the desktop notification system including
notification types, state management, configuration integration, and printer state
coordination. Uses discriminated unions and branded types for maximum type safety.

Key Type Categories:
- Branded Types: NotificationId, NotificationTemperature for type safety
- Notification Types: PrintComplete, PrinterCooled, Upload, Connection notifications
- State Management: NotificationState, NotificationStateTransition for duplicate prevention
- Configuration: NotificationSettings extracted from AppConfig
- Printer Integration: State transitions, temperature thresholds, trigger conditions
- Events: NotificationEvent enum with typed event payloads

Factory Functions:
- createPrintCompleteNotification: Print job completion alerts
- createPrinterCooledNotification: Bed temperature cooled alerts
- createUploadCompleteNotification: File upload success
- createUploadFailedNotification: File upload errors
- createConnectionLostNotification: Printer disconnection
- createConnectionErrorNotification: Connection failures

Type Guards:
- isPrintCompleteNotification, isPrinterCooledNotification, etc.
- shouldSendNotification: Settings-based notification filtering
- shouldCheckForNotifications, shouldResetNotificationFlags: State-based logic

Integration Points:
- PrinterNotificationCoordinator: Business logic and state tracking
- NotificationService: OS notification delivery
- PrinterPollingService: Real-time state monitoring
- ConfigManager: User notification preferences

@module types/notification

## src/types/polling.ts

Type definitions for real-time printer data polling system

Provides simple, direct-to-UI type definitions for printer status polling data.
Designed for clarity and ease of maintenance with straightforward interfaces that
map directly to backend API responses and UI display requirements.

Key Type Groups:
- Printer State: PrinterState enum for operating status (Ready, Printing, Paused, etc.)
- Temperature Data: TemperatureData, PrinterTemperatures for thermal monitoring
- Job Progress: JobProgress, CurrentJobInfo for print job tracking
- Printer Status: PrinterStatus master interface combining all status data
- Material Station: MaterialSlot, MaterialStationStatus for AD5X multi-material
- Polling Container: PollingData aggregates all polling information for UI updates

Utility Functions:
- State Checking: isActiveState, isReadyForJob, canControlPrint
- Formatting: formatTemperature, formatTime, formatPercentage, formatWeight, formatLength
- Factory: createEmptyPollingData for initialization

Configuration:
- DEFAULT_POLLING_CONFIG: 2.5s interval, 3 retries, 1s retry delay

Integration Points:
- PrinterPollingService: Data collection and transformation
- BasePrinterBackend: Raw status data source
- ui-updater.ts: Direct UI element updates
- PrinterNotificationCoordinator: State change monitoring

@module types/polling

## src/types/printer-backend/backend-operations.ts

Printer backend operation type definitions and command interfaces.

Provides comprehensive TypeScript types for printer backend operations including job management,
G-code execution, status monitoring, and feature capabilities. Defines initialization options,
command results, and backend events for all supported printer models (AD5X, 5M, 5M Pro, generic legacy).
Includes model-specific job information types with rich metadata for AD5X and basic info for other models.

Key exports:
- BackendInitOptions: Backend initialization configuration
- JobStartParams/JobStartResult: Job control operations using fileName (not jobId)
- AD5XJobInfo/BasicJobInfo: Model-specific job metadata structures
- BackendCapabilities: Feature and API client availability
- BackendEvent: Event system for backend state changes

## src/types/printer-backend/index.ts

Centralized export module for all printer backend type definitions.

Aggregates and re-exports TypeScript types from printer-features and backend-operations modules.
Provides a single import point for all backend-related types including feature configurations,
operational interfaces, job management structures, and capability definitions. Used throughout
the application for type-safe printer backend interactions.

Key export categories:
- Feature types: Camera, LED, filtration, material station configurations
- Operation types: Job management, G-code commands, status monitoring
- Model types: Printer model identifiers and capabilities
- Backend types: Initialization, events, and factory options

## src/types/printer-backend/printer-features.ts

Printer feature capability definitions and configuration interfaces.

Defines comprehensive feature sets available across different FlashForge printer models including
camera streaming, LED control, filtration, G-code execution, status monitoring, job management,
and material station support. Each feature includes availability flags, API routing information,
and model-specific configuration options. Supports feature overrides from user settings.

Key exports:
- PrinterFeatureSet: Complete feature configuration for a printer instance
- MaterialStationStatus: AD5X material station slot information
- FeatureAvailabilityResult: UI query results for feature availability
- CameraFeature/LEDControlFeature: Individual feature configurations
- FeatureDisableReason: User-facing explanations for unavailable features

## src/types/printer.ts

Core printer connection and configuration type definitions.

Defines comprehensive TypeScript interfaces for printer discovery, connection management,
and multi-printer configuration storage. Supports both legacy and modern API clients with
per-printer settings including custom camera URLs, LED control, and material station features.
Includes types for auto-connect workflows, printer family detection, and saved printer matching.

Key exports:
- PrinterDetails: Complete printer configuration with per-printer overrides
- MultiPrinterConfig: Top-level configuration structure for multiple saved printers
- DiscoveredPrinter: Network discovery results
- ConnectionResult: Connection flow outcomes
- AutoConnectDecision: Auto-connect strategy determination

## src/types/PrinterContext.ts

Type definitions for the multi-printer context system.

This module defines the core types used by the PrinterContextManager to manage
multiple simultaneous printer connections. Each context represents a complete
printer connection state including backend, polling service, camera proxy, and
connection state.

Key Types:
- PrinterContextInfo: Serializable context information for UI display
- ContextSwitchEvent: Event payload for context switching events

Related:
- PrinterContext interface is defined in PrinterContextManager.ts
- Uses PrinterDetails from types/printer.ts
- Integrates with existing backend and service types

## src/types/shortcut-config.ts

Shared type definitions for shortcut configuration dialog IPC.

Captures the payloads exchanged between the shortcut configuration renderer,
preload script, and main process. Centralizing these interfaces keeps the
renderer and preload layers in sync and avoids duplicating structures for
shortcut slots, available component metadata, initialization payloads, and
save responses.

## src/types/spoolman.ts

Type definitions for Spoolman integration

Defines TypeScript interfaces for the Spoolman REST API responses and request payloads.
Spoolman is a self-hosted filament inventory management system that tracks spool usage,
material properties, and vendor information.

API Documentation: https://github.com/Donkie/Spoolman

Key Types:
- SpoolResponse: Complete spool object with filament and usage data
- FilamentObject: Filament properties including material, color, and vendor
- VendorObject: Filament vendor information
- SpoolSearchQuery: Query parameters for searching spools
- SpoolUsageUpdate: Payload for updating filament usage
- ActiveSpoolData: Simplified spool data for UI components

@module types/spoolman

## src/ui/about-dialog/about-dialog-renderer.ts

Renderer controller for the About dialog showing app metadata and resource links.

## src/ui/auto-connect-choice/auto-connect-choice-renderer.ts

Auto-connect choice dialog renderer - Handles UI interactions and user choice
management for the auto-connect options dialog. Provides interface for choosing between
different connection options when auto-connect discovery fails.

## src/ui/component-dialog/component-dialog.ts

Component Dialog Renderer

Handles rendering and lifecycle management of components in standalone dialog windows.
Creates a local ComponentManager instance to manage the component and receives
real-time polling updates from the main process.

Key features:
- Component instantiation and initialization
- Real-time polling data updates
- Proper cleanup on window close
- Dialog header customization based on component type

@author FlashForgeUI Team
@module ui/component-dialog/component-dialog

## src/ui/components/additional-info/additional-info.ts

Additional Info Component

Display-only component showing printer configuration and settings information.
Displays nozzle size, filament type, speed settings, and Z-axis offsets with
visual indicators for different value ranges and states.

Key features:
- Nozzle size display with size-specific indicators
- Filament type information
- Speed offset percentage with range indicators
- Z-axis offset with positive/negative/zero indicators
- Availability checking (dim if settings unavailable)
- No user interactions (display-only component)

## src/ui/components/additional-info/index.ts

Additional Info Component Module

Exports the AdditionalInfoComponent class for use in the component system.
This component displays printer configuration and settings information.

## src/ui/components/base/component.ts

Base Component Class for UI Components

This file provides the abstract BaseComponent class that serves as the foundation
for all UI components in the FlashForgeUI component system. It handles common
functionality including lifecycle management, DOM manipulation, event handling,
and error handling patterns. All components extend this base class to ensure
consistent behavior and interfaces across the application.

Key features:
- Component lifecycle management (initialize, update, destroy)
- DOM manipulation utilities with null safety
- Event handling setup and cleanup
- Error handling and state validation
- Type-safe helper methods for common operations

## src/ui/components/base/index.ts

Base Component System Exports

This file exports all the core components of the UI component system,
providing a clean public API for importing components, types, and managers
throughout the application.

## src/ui/components/base/types.ts

Component system type definitions

This file defines the core TypeScript interfaces and types for the component
system, including configuration, update data structures, and event handling
patterns. These types ensure type safety across the entire component architecture
and maintain compatibility with existing IPC and polling data patterns.

## src/ui/components/camera-preview/camera-preview.ts

Camera Preview with Integrated Job Info Component

This component handles the display and management of camera preview streams
from FlashForge 3D printers while integrating job information display at the bottom.
It provides a seamless visual unit that fills the left side properly, combining
camera functionality with real-time job progress information.

Key features:
- MJPEG camera stream display with proper cleanup
- Integrated job information panel at the bottom
- Camera preview toggle button within the component
- Real-time job progress updates via polling system
- Progress bar styling based on printer state
- Camera configuration resolution via window.api.camera
- State management for disabled/loading/streaming/error states
- Proper image element lifecycle management
- Integration with camera proxy service

The component creates one cohesive visual unit that matches the original
seamless design where camera and job info were integrated together.

## src/ui/components/camera-preview/index.ts

Camera Preview Component Exports

This module exports the camera preview component and related types
for use in other parts of the application. The camera preview component
handles MJPEG camera streaming, camera configuration, and preview state management.

## src/ui/components/ComponentManager.ts

Component Manager for UI Component System

The ComponentManager class serves as the central coordinator for all UI components
in the FlashForgeUI application. It handles component registration, lifecycle
management, and centralized data updates. This manager ensures that all components
are properly initialized, updated with fresh data from polling cycles, and cleaned
up when necessary.

Key responsibilities:
- Component registration and lifecycle management
- Centralized data updates to all components
- Error handling and graceful degradation
- Component lookup and inter-component communication
- Proper cleanup and resource management

Usage:
```typescript
const manager = new ComponentManager();
manager.registerComponent(new JobInfoComponent(container));
await manager.initializeAll();
manager.updateAll(pollingData);
```

## src/ui/components/controls-grid/controls-grid.ts

Controls Grid Component

This component provides the main control interface with a 6x2 grid of buttons
for printer control operations. It extends the BaseComponent class and implements
sophisticated button state management, IPC communication handling, and logging
integration that was previously part of the monolithic UI.

Key features:
- 6x2 grid of control buttons with proper ID mapping
- Dynamic button state management based on printer state and connection status  
- Mixed IPC communication (invoke for commands, send for dialogs)
- Complex state-based enable/disable logic
- Integration with existing logging system
- Support for legacy printer limitations
- Special button styling for different action types

Button Mapping:
Row 1: LED On, Clear Status
Row 2: LED Off, Home Axes
Row 3: Pause, Upload Job
Row 4: Resume, Start Recent
Row 5: Stop, Start Local
Row 6: Swap Filament, Send Cmds

Usage:
  const controlsGrid = new ControlsGridComponent(parentElement);
  await controlsGrid.initialize();
  controlsGrid.update({ printerState: 'Printing', connectionState: true });

## src/ui/components/controls-grid/index.ts

Controls Grid Component Export

This module exports the ControlsGridComponent class and related types
for use in the FlashForgeUI component system. The controls grid provides
the main 6x2 button interface for printer control operations.

## src/ui/components/filtration-controls/filtration-controls.ts

Filtration Controls Component

Interactive component for controlling printer filtration systems and monitoring
TVOC (Total Volatile Organic Compounds) levels. Provides mode selection buttons
for External/Internal/None filtration modes with feature availability checking.

Key features:
- Current filtration mode display and selection
- TVOC level monitoring with color-coded indicators
- Interactive mode selection buttons (External/Internal/None)
- Feature availability checking (hide if not supported)
- State-dependent button enabling/disabling
- Visual feedback for active filtration mode

## src/ui/components/filtration-controls/index.ts

Filtration Controls Component Module

Exports the FiltrationControlsComponent class for use in the component system.
This component handles filtration mode control and TVOC level monitoring.

## src/ui/components/index.ts

UI Components System Exports

This file serves as the main export point for the entire UI component system,
providing access to the ComponentManager, base components, and type definitions.
This structure will be extended as individual components are extracted in Phase 1.

## src/ui/components/job-info/index.ts

Job Info Component Exports

This module exports the job info component and related types for use
in other parts of the application. The job info component displays
current print job information, progress, and provides camera preview
toggle functionality.

## src/ui/components/job-info/job-info.ts

Job Info Component

This component displays current job information including job name, progress,
and provides camera preview control functionality. It integrates with the
polling system to show real-time job progress and updates the progress bar
visual state based on printer status.

Key features:
- Displays current job name (displayName or fileName fallback)
- Shows progress percentage and visual progress bar
- State-based progress bar styling (printing/paused/completed/error)
- Camera preview toggle button functionality
- Communication with CameraPreviewComponent via ComponentManager
- Proper cleanup and error handling

The component receives updates through the polling system and manages
its own UI state while communicating with other components for camera control.

## src/ui/components/job-stats/index.ts

Job Statistics Component Barrel Export

This file provides a clean barrel export interface for the Job Statistics
component, allowing other parts of the application to import the component
and its related types through a single import statement.

Usage:
```typescript
import { JobStatsComponent } from '../components/job-stats';

const jobStats = new JobStatsComponent(containerElement);
await jobStats.initialize();
```

## src/ui/components/job-stats/job-stats.ts

Job Statistics Component

This component displays real-time job statistics including layer information, 
ETA, job timing, and material usage data. It extends the BaseComponent class
and integrates with the existing polling data system to provide live updates
of printer job progress.

Key features:
- Displays layer progress (current/total layers)
- Shows ETA with proper time formatting and calculation
- Tracks elapsed printing time with formatTime utility
- Shows material usage (weight in grams, length in meters)
- Handles ETA calculation from formattedEta and timeRemaining fields
- Clears display when no active job
- Uses existing formatting utilities from polling types

Data Sources:
- PollingData.printerStatus.currentJob for job information
- JobProgress for progress tracking and timing
- Formatting utilities from polling types

## src/ui/components/log-panel/index.ts

Log Panel Component Module Exports

This file provides the main exports for the Log Panel component module,
including the component class and any related types or utilities.

The CSS is imported automatically when the component is imported, ensuring
that the styles are available when the component is used.

## src/ui/components/log-panel/log-panel.ts

Log Panel Component

This component provides a real-time log display panel that shows application
events, printer status changes, and system messages. It extends the BaseComponent
class and implements the log message display functionality that was previously
part of the monolithic UI.

Key features:
- Real-time log message display with timestamps
- Auto-scrolling to show latest messages
- Monospace font for consistent formatting
- Component-scoped styling and behavior
- Integration with existing global logMessage function

Usage:
  const logPanel = new LogPanelComponent(parentElement);
  await logPanel.initialize();
  logPanel.addLogMessage('Status update: Printer connected');

## src/ui/components/model-preview/index.ts

Model Preview Component Exports

This file provides the public exports for the Model Preview component,
following the established pattern used throughout the component system.
It exports the main component class for use by the ComponentManager
and other parts of the application.

## src/ui/components/model-preview/model-preview.ts

Model Preview Component

This component displays 3D model thumbnails and job preview information.
It shows the current job's thumbnail when available, and provides appropriate
placeholder messages for different states (no job, job without thumbnail).
The component integrates with the polling system to display real-time data
and handles thumbnail loading, error states, and visual updates.

Key features:
- Displays job thumbnails from polling data
- Shows placeholder messages for different states
- Handles thumbnail loading and error states
- Updates in real-time with polling data
- Supports both "rounded" and "square" UI modes
- Follows component-scoped CSS patterns

## src/ui/components/printer-status/index.ts

Printer Status Component Module

Exports the PrinterStatusComponent class for use in the component system.
This component displays current printer state and cumulative statistics.

## src/ui/components/printer-status/printer-status.ts

Printer Status Component

Display-only component showing current printer state, runtime information,
and cumulative filament usage statistics. Updates with polling data and
provides visual feedback for different printer states through CSS classes.

Key features:
- Current printer state display (Ready, Printing, Paused, etc.)
- Runtime tracking with formatted display
- Filament usage statistics in meters
- State-specific styling for visual feedback
- No user interactions (display-only component)

## src/ui/components/printer-tabs/index.ts

Printer Tabs Component Export

Exports the PrinterTabsComponent for use in the main renderer process.
This component provides a tabbed interface for managing multiple printer connections.

## src/ui/components/printer-tabs/PrinterTabsComponent.ts

Printer Tabs Component for Multi-Printer Support

This component provides a tabbed interface for managing multiple printer connections
similar to Orca-FlashForge's tabbed interface. It extends EventEmitter to notify
the renderer process of user interactions with tabs.

Key features:
- Tab management (add, remove, switch, update)
- Connection status indicators (connected, connecting, disconnected, error)
- Close buttons on tabs with hover effects
- "Add Printer" button for creating new connections
- Event emission for tab interactions (click, close, add)
- Visual distinction between active and inactive tabs

Events:
- 'tab-clicked': Emitted when a tab is clicked (contextId: string)
- 'tab-closed': Emitted when a tab's close button is clicked (contextId: string)
- 'add-printer-clicked': Emitted when the add printer button is clicked

## src/ui/components/spoolman/index.ts

Spoolman Component Exports

Central export point for Spoolman component and related types.

@module ui/components/spoolman

## src/ui/components/spoolman/spoolman.ts

Spoolman Filament Tracker Component

GridStack component for displaying active spool selection and integrating with Spoolman server.
Shows three states: disabled (integration off), no spool selected, and active spool display
with color visualization. Supports per-printer context with main process state management.

Key Features:
- Three visual states: disabled, no spool, active spool
- Color-coded spool visualization matching filament color
- Integration with Spoolman server for spool selection
- Per-context main process storage (no localStorage)
- Click-to-open spool selection dialog
- Real-time spool data updates from main process
- Works even if component not on grid (state in main process)

@module ui/components/spoolman

## src/ui/components/spoolman/types.ts

Type definitions for Spoolman component

Defines UI-specific types for the Spoolman filament tracker component,
including simplified spool data structures optimized for display.

@module ui/components/spoolman/types

## src/ui/components/temperature-controls/index.ts

Temperature Controls Component Module

Exports the TemperatureControlsComponent class for use in the component system.
This component handles temperature monitoring and control for bed and extruder.

## src/ui/components/temperature-controls/temperature-controls.ts

Temperature Controls Component

Interactive component for controlling and monitoring printer temperatures.
Displays bed and extruder temperatures with Set/Off buttons, and shows
fan status information. Handles temperature input dialogs via IPC.

Key features:
- Real-time temperature display for bed and extruder
- Interactive Set/Off buttons for temperature control
- Fan status monitoring (cooling and chamber fans)
- Temperature input dialog integration
- State-dependent button enabling/disabling
- Visual feedback for heating states

## src/ui/connect-choice-dialog/connect-choice-dialog-renderer.ts

Connect choice dialog renderer - Handles UI interactions and user choice
management for the connect options dialog. Provides interface for choosing between
manual IP entry and network scanning for printer connections.

## src/ui/gridstack/ComponentRegistry.ts

Component registry for GridStack dashboard widgets

Central registry of all available dashboard components with their metadata,
including display names, icons, size constraints, and categorization. Provides
query functions for component lookup, validation, and filtering by category.
Used by the component palette and layout editor to present available components.

Key exports:
- getComponentDefinition(): Lookup component by ID
- getAllComponents(): Get all registered components (9 total)
- getComponentsByCategory(): Filter components by category
- getRequiredComponents(): Get only required components
- getOptionalComponents(): Get only optional components
- isValidComponentId(): Check if component ID exists
- getComponentDisplayName(): Get display name for component
- getComponentIcon(): Get icon string for component
- validateComponentSize(): Validate and clamp widget dimensions
- getRecommendedComponents(): Get recommended component set

Component categories:
- main: Primary content components (camera, controls, model preview, job stats)
- status-bar: Bottom status bar components (printer status, temperature, etc.)
- utility: Utility components (log panel, accessible via Logs button)

Usage:
```typescript
import { getComponentDefinition } from './ComponentRegistry';

const camera = getComponentDefinition('camera-preview');
if (camera) {
  console.log(camera.name); // "Camera Preview"
  console.log(camera.defaultSize); // { w: 6, h: 6 }
}
```

@module ui/gridstack/ComponentRegistry

## src/ui/gridstack/defaults.ts

Default layout configurations for GridStack dashboard

Defines the default grid layout that matches the original fixed layout in FlashForgeUI.
Includes grid options, widget positions, and helper functions for layout validation
and merging. The default layout uses a 12-column grid system with 80px cell height,
replicating the existing UI structure while enabling future customization.

Key exports:
- DEFAULT_GRID_OPTIONS: 12-column grid with 80px cell height and 8px margins
- DEFAULT_WIDGETS: Component positions matching original layout (8 components)
- DEFAULT_LAYOUT: Complete default layout configuration with metadata
- getDefaultLayout(): Factory function for fresh default layouts
- getDefaultGridOptions(): Returns fresh copy of default grid options
- getDefaultWidgets(): Returns fresh copy of default widget configurations
- isValidLayout(): Validates layout configuration structure
- mergeWithDefaults(): Merges user layout with defaults to fill missing properties

Layout structure (12-column grid, 80px cell height):
- Left: Camera preview (6w×6h, columns 0-5)
- Right top: Controls grid (6w×3h, columns 6-11, rows 0-2)
- Right middle: Model preview (6w×3h, columns 6-11, rows 3-5)
- Right bottom: Job stats (6w×2h, columns 6-11, rows 6-7)
- Bottom: Status bar (4 components, 3w×1h each, row 8)

@module ui/gridstack/defaults

## src/ui/gridstack/EditModeController.ts

Edit mode controller for GridStack dashboard

Manages the edit mode state for the GridStack dashboard, including CTRL+E
keyboard shortcut handling, visual indicators, grid enable/disable coordination,
and component palette window management. Provides auto-save on exit and
change tracking for unsaved modifications.

Key exports:
- EditModeController: Main edit mode controller class
- editModeController: Singleton instance for application-wide use

Features:
- CTRL+E (or CMD+E on Mac) keyboard shortcut toggle
- Visual edit mode indicator with instructions
- Grid editing enable/disable (dragging and resizing)
- Component palette window coordination (open on enter, close on exit)
- Auto-save on exit with change tracking
- Unsaved changes indicator
- Reset to default layout
- Force save operation

Usage:
```typescript
import { editModeController } from './EditModeController';
import { gridStackManager } from './GridStackManager';
import { layoutPersistence } from './LayoutPersistence';

// Initialize (call after GridStack and LayoutPersistence)
editModeController.initialize(gridStackManager, layoutPersistence);

// Programmatically toggle edit mode
editModeController.toggle();

// Check if edit mode is enabled
if (editModeController.isEnabled()) {
  console.log('Edit mode active');
}

// Force save current layout
editModeController.forceSave();

// Reset to default layout
await editModeController.resetToDefault();
```

@module ui/gridstack/EditModeController

## src/ui/gridstack/GridStackManager.ts

GridStack.js wrapper and manager for FlashForgeUI

Provides a clean TypeScript API wrapper around GridStack.js for managing
the dashboard grid. Handles widget lifecycle, drag-and-drop configuration,
layout serialization, and event management. Follows the principle of "don't
hack the framework" - all grid logic is delegated to GridStack with minimal
abstraction overhead.

Key exports:
- GridStackManager: Main grid management class
- gridStackManager: Singleton instance for application-wide use

Features:
- Widget add/remove/update operations with validation
- Enable/disable editing mode (dragging and resizing)
- Layout serialization/deserialization for persistence
- External drag-in support (from component palette)
- Event system (change, added, removed, dropped)
- Batch operations for performance optimization
- Grid compaction and layout cleanup
- Lifecycle management and cleanup

Usage:
```typescript
import { gridStackManager } from './GridStackManager';

// Initialize grid with options
gridStackManager.initialize({ column: 12, cellHeight: 80 });

// Add widget
const element = createGridWidget('camera-preview');
gridStackManager.addWidget(widgetConfig, element);

// Enable editing
gridStackManager.enable();

// Listen for changes
gridStackManager.onChange((widgets) => {
  console.log('Grid changed:', widgets);
});

// Serialize current layout
const layout = gridStackManager.serialize();
```

@module ui/gridstack/GridStackManager

## src/ui/gridstack/index.ts

GridStack module exports

Central export point for all GridStack-related modules, types, and utilities.
Import from this file to access GridStack functionality throughout the application.
Provides managers, controllers, type definitions, defaults, and component registry.

Exported modules:
- GridStackManager: Core grid management and widget operations
- LayoutPersistence: Layout saving/loading to localStorage
- EditModeController: Edit mode state and keyboard shortcuts
- ComponentRegistry: Component definitions and metadata
- Types: All TypeScript type definitions
- Defaults: Default layout configurations and helpers

Usage:
```typescript
// Import managers
import {
  gridStackManager,
  layoutPersistence,
  editModeController
} from './ui/gridstack';

// Import types
import type {
  LayoutConfig,
  GridStackWidgetConfig
} from './ui/gridstack';

// Import component registry
import {
  getComponentDefinition,
  getAllComponents
} from './ui/gridstack';
```

@module ui/gridstack

## src/ui/gridstack/LayoutPersistence.ts

Layout Persistence Manager

This class handles saving and loading GridStack layouts to/from localStorage.
It provides automatic debouncing for frequent saves, multi-context support
for multiple printer layouts, and fallback to default layout when needed.

Key features:
- Save layouts to localStorage with debouncing
- Load layouts with validation and migration support
- Multi-context support for different printer layouts
- Graceful fallback to defaults on errors
- Layout history and versioning support

## src/ui/gridstack/types.ts

GridStack Type Definitions

This file defines TypeScript types and interfaces for the GridStack.js integration.
It provides type safety for grid layouts, widget configurations, and component metadata.

Key types:
- GridStackWidgetConfig: Individual widget position and size configuration
- LayoutConfig: Complete layout configuration with metadata
- GridOptions: GridStack initialization options
- ComponentDefinition: Component metadata for registry

## src/ui/ifs-dialog/ifs-dialog-renderer.ts

Renderer process for IFS material station status display dialog.

Implements visual material station display for AD5X printers showing real-time slot status,
filament types, colors, and active slot information. Handles dynamic UI updates for material
presence detection, connection status, and visual spool representations with color coding.
Manages slot indexing conversion between backend (0-based) and UI (1-based) displays.

Key features:
- Real-time material slot status visualization
- Color-coded spool displays matching actual filament colors
- Connection status indicator with error messaging
- Active slot highlighting and empty slot detection
- Event-driven updates from main process via IPC

## src/ui/input-dialog/input-dialog-renderer.ts

Renderer process for generic modal input dialog with keyboard support.

Implements interactive input dialog supporting multiple modes (text, password, hidden) with
comprehensive keyboard navigation and accessibility features. Handles dialog initialization,
user input validation, and result submission. Includes auto-focus, text selection, and
escape/enter keyboard shortcuts. Hidden mode supports confirmation dialogs without input fields.

Key features:
- Multiple input types: text, password, hidden (for confirmations)
- Keyboard shortcuts: Enter to submit, Escape to cancel
- Auto-focus and text selection for improved UX
- Dynamic UI configuration from initialization options
- Type-safe event handlers with proper DOM element validation

## src/ui/job-picker/job-picker-renderer.ts

Renderer process for job picker dialog with material info and selection.

Implements interactive job selection interface with grid-based file display, thumbnail loading,
and material information visualization for multi-color prints. Handles printer capability
detection, job listing (local/recent), and intelligent routing to material matching dialogs
for AD5X multi-color jobs. Includes staggered thumbnail requests, job metadata display,
and auto-leveling/start-now configuration options.

Key features:
- Grid-based file display with lazy-loaded thumbnails
- Material info (i) icon for multi-color jobs with toolData
- Automatic material matching dialog for AD5X multi-color prints
- Single-color confirmation workflow for AD5X printers
- Printer capability-aware UI (hides unsupported features)
- Job start with leveling and immediate start options

## src/ui/job-uploader/job-uploader-renderer.ts

Renderer process for job uploader dialog with 3MF multi-color workflow.

Implements comprehensive file upload interface with slicer metadata display, AD5X 3MF validation,
and intelligent multi-color material matching integration. Handles file browsing, metadata
visualization (thumbnails, print settings, filament info), and upload progress tracking.
Routes AD5X 3MF files through material matching dialogs while supporting legacy upload for
other printer models.

Key features:
- Slicer metadata parsing and display (3MF, G-code)
- AD5X 3MF-only validation with user-friendly error messages
- Multi-color filament detection and material matching dialog routing
- Single-color AD5X workflow with confirmation dialog
- Upload progress overlay with percentage and status updates
- Auto-close on successful upload with 2-second delay
- Comprehensive error handling and user feedback

## src/ui/legacy/LegacyUiController.ts

Shell UI controller for renderer chrome and legacy menus.

Manages window controls, hamburger menu (including keyboard shortcuts),
and the loading overlay that predates the component/GridStack system.
All printer-specific controls now live in dedicated components, so this
controller only keeps the shared chrome responsibilities.

## src/ui/log-dialog/log-dialog-renderer.ts

Log Dialog Renderer

This renderer handles the log dialog window functionality including:
- Loading and displaying current log messages
- Real-time updates of new log messages
- Clearing log messages
- Auto-scrolling to show latest messages
- Message count display
- Window controls and event handling

The renderer integrates with the log panel component functionality
while providing a dedicated dialog interface for viewing logs.

## src/ui/material-info-dialog/material-info-dialog-renderer.ts

Renderer process for material information visualization dialog.

Implements visual display of multi-color print material requirements with spool-styled
color representations. Shows per-tool material information including type, color, weight,
and material station slot assignments. Displays total filament weight and material station
usage indicators. Provides read-only visualization of print material requirements.

Key features:
- Color-coded spool visualizations matching actual filament colors
- Per-tool material breakdown (type, color, weight)
- Material station slot ID display (1-based UI, 0 indicates direct feed)
- Total filament weight calculation and display
- Material station usage indicator
- Clean, visual representation for user verification

## src/ui/material-matching-dialog/material-matching-dialog-renderer.ts

Renderer process for interactive material-to-slot matching interface.

Implements dual-panel selection UI for mapping print job material requirements to physical
material station slots. Validates material type compatibility, warns on color differences,
and prevents invalid mappings (empty slots, type mismatches, duplicate assignments). Provides
visual feedback through color swatches, selection states, and real-time mapping display.
Context-aware button text (Start Print vs Confirm) based on workflow origin.

Key features:
- Dual-panel selection: print requirements and available IFS slots
- Material type compatibility validation with error messages
- Color difference warnings (allowed but highlighted)
- Real-time mapping visualization with removal capability
- Disabled states for empty and already-assigned slots
- Complete mapping requirement before confirmation
- Context-aware UI (job-start vs file-upload workflows)

## src/ui/palette/palette.ts

Component palette window renderer

Presents the list of available dashboard components and exposes simple
buttons for adding them to the grid. Component removal is now handled on
the grid itself, so this implementation focuses on reflecting component
availability and dispatching add requests.

## src/ui/printer-connected-warning/printer-connected-warning-renderer.ts

Printer Connected Warning Dialog Renderer

Handles the printer connection warning dialog that appears when a user tries to
connect while already connected to a printer. Provides clear warning message
and allows user to confirm or cancel the action.

## src/ui/printer-selection/printer-selection-renderer.ts

Printer Selection Dialog renderer process implementation supporting dual-mode operation
for both network-discovered printers and saved printer connections. Manages UI state, printer discovery
events, table rendering, and user interaction for printer selection workflows. Implements auto-discovery
timeout handling, connection status feedback, and supports printer reconnection from saved configurations.

Key Features:
- Dual-mode selection: discovered printers (network scan) or saved printers (from history)
- Real-time printer discovery with 15-second timeout and retry capability
- Auto-selection of last-used printer when viewing saved printers
- IP address change detection for saved printers with visual indicators
- Connection status feedback (connecting, success, failure)
- Double-click selection with visual row highlighting
- Comprehensive error handling for discovery failures

Dialog Modes:
- Discovered Mode: Shows printers found via network discovery scan
- Saved Mode: Shows previously connected printers with online status filtering

IPC Events:
- receiveMode: Sets dialog mode (discovered/saved)
- receivePrinters: Updates discovered printer list
- receiveSavedPrinters: Updates saved printer list with last-used info
- onDiscoveryStarted: Triggers discovery timeout timer
- onDiscoveryError: Handles discovery failures with user feedback
- onConnecting/onConnectionFailed: Connection status updates

## src/ui/send-cmds/send-cmds-renderer.ts

Send Commands Dialog renderer process for manual printer command transmission.
Provides a developer-focused UI for sending raw FlashForge printer protocol commands with
live response logging, auto-scrolling output, and command history. Automatically prefixes
commands with the FlashForge protocol tilde (~) marker if not already present.

Key Features:
- Real-time command transmission to connected printer
- Timestamped log output with color-coded entry types (info/command/response/error)
- Automatic tilde (~) prefix for FlashForge commands
- Enter-key submission for rapid command testing
- Auto-scroll log view to most recent entries
- Input field auto-clear and focus after submission
- Async command handling with loading state management

UI Components:
- Command input field with keyboard shortcuts
- Scrollable log output with categorized message styling
- Send button with disabled state during transmission
- Close button for dialog dismissal

Usage Context:
Primarily used for debugging, testing printer responses, and advanced printer
control. Not intended for end-user operations.

## src/ui/settings/sections/AutoUpdateSection.ts

Manages auto-update support detection and manual update checks.

Abstracts away IPC calls, button state, and status messages so the main
settings renderer only needs to consume a boolean indicating whether auto
download is supported.

## src/ui/settings/sections/DesktopThemeSection.ts

Desktop theme section controller for the settings dialog renderer.

Encapsulates all DOM bindings, color picker behavior, and theme value propagation for
the desktop theme customization area. Exposes a simple API for loading an initial theme,
reacting to user edits, and notifying the parent settings renderer whenever the theme
changes so global configuration state can stay in sync.

Responsibilities:
- Map DOM inputs (native color pickers, hex fields, swatches) to ThemeColors keys
- Drive the custom color picker modal with hue/SV field interactions
- Normalize and validate color input before emitting theme changes
- Provide lifecycle hooks for initialization, updates, and cleanup

## src/ui/settings/sections/DiscordWebhookSection.ts

Handles the Discord webhook test controls.

## src/ui/settings/sections/InputDependencySection.ts

Handles enable/disable logic for dependent settings inputs.

Centralizes state transitions for the WebUI, Spoolman, Discord, and per-printer
fields so the main settings renderer can simply call `updateStates` when
relevant toggles change.

## src/ui/settings/sections/PrinterContextSection.ts

Handles UI updates tied to per-printer context availability.

## src/ui/settings/sections/RoundedUISection.ts

Handles Rounded UI capability detection + warnings.

## src/ui/settings/sections/SettingsSection.ts

Base contract for modular settings sections in the renderer.

Each section encapsulates one logical area of the settings dialog (tabs,
auto-update, Spoolman integration, etc.) and exposes lifecycle hooks so the
root renderer can initialize and dispose them in a predictable order.

## src/ui/settings/sections/SpoolmanTestSection.ts

Handles the Spoolman connection test controls.

## src/ui/settings/sections/TabSection.ts

Handles tab navigation and persistence for the settings dialog.

Manages active tab state, keyboard navigation, and localStorage persistence so
SettingsRenderer no longer needs to track DOM state for the tab strip.

## src/ui/settings/settings-renderer.ts

Settings Dialog renderer process managing both global application settings
and per-printer configuration through a unified UI. Implements intelligent settings routing
(global vs. per-printer), real-time validation, dependency-aware input state management,
and unsaved changes protection.

Key Features:
- Dual settings management: global config (config.json) and per-printer settings (printer_details.json)
- Automatic settings categorization and routing based on setting type
- Real-time input validation with visual feedback
- Dependent input state management (e.g., port fields enabled only when feature is enabled)
- Unsaved changes detection with confirmation prompts
- Per-printer context indicator showing which printer's settings are being edited
- Platform compatibility handling (Rounded UI disabled when unsupported)
- Port number validation with range checking (1-65535)

Settings Categories:
- Global Settings: WebUI, Discord, alerts, Spoolman, debug mode
- Per-Printer Settings: Custom camera, custom LEDs, force legacy mode

UI State Management:
- Dynamic enable/disable of dependent fields
- Save button state based on unsaved changes
- Status message display with auto-hide timers
- Input-to-config property mapping for consistency

Dependencies:
Integrates with ConfigManager for global settings and PrinterDetailsManager for per-printer
settings through the exposed IPC APIs.

## src/ui/settings/types.ts

Shared types for the settings renderer.

Provides cross-module typings for the mutable settings state that the renderer
uses while editing both global (config.json) and per-printer settings.

## src/ui/settings/types/external.ts

Shared API interfaces for the settings renderer sections.

## src/ui/shared/log-panel/index.ts

Shared log panel exports.

## src/ui/shared/log-panel/LogPanelController.ts

Shared log panel view + controller for grid and dialog usage.

Provides a reusable DOM layout and utility methods for rendering log entries,
managing placeholder state, auto-scrolling, and message counts. Both the
GridStack log widget and the pinned dialog reuse this module to guarantee a
consistent visual experience and identical data-handling semantics.

## src/ui/shared/lucide.ts

Shared helper for initializing Lucide icons in dialog renderer contexts.

Leverages the global UMD `window.lucide` exposed by bundled lucide.min.js to hydrate
`<i data-lucide="...">` placeholders without importing the ES module build. Keeps the
icon normalization logic in one place so dialogs can register the icons they need with a
single call.

## src/ui/shared/theme-utils.ts

Shared theme utilities for dialog renderers.

Provides reusable functions for applying theme colors to dialogs and lightening colors
for hover states. Use these helpers to add live theme update support to any dialog.

## src/ui/shortcut-config-dialog/shortcut-config-dialog.ts

Renderer script for shortcut configuration dialog

Manages the shortcut configuration UI, allowing users to assign components
to up to 3 shortcut button slots. Handles validation, conflict detection,
and communication with the main process.

Key responsibilities:
- Load current configuration and available components
- Populate dropdowns with available components
- Handle slot assignment changes
- Validate no duplicate assignments
- Save configuration and close dialog

@author FlashForgeUI Team
@module ui/shortcut-config-dialog/shortcut-config-dialog

## src/ui/shortcuts/ShortcutConfigManager.ts

Manager for shortcut button configuration persistence and validation

This module provides centralized management of shortcut button configuration,
including loading, saving, and validation of component-to-slot assignments.

The configuration is stored globally in localStorage and applies to all printer
contexts. Components assigned to shortcuts are excluded from the grid layout.

Key responsibilities:
- Load/save configuration from/to localStorage
- Validate configuration schema and component assignments
- Provide utility methods for checking pinned status
- Ensure mutual exclusivity (component can't be in grid and pinned)

@author FlashForgeUI Team
@module ui/shortcuts/ShortcutConfigManager

## src/ui/shortcuts/types.ts

Type definitions for shortcut button configuration system

This module defines the types used for managing customizable topbar shortcut buttons.
Shortcuts allow users to "pin" grid components as quick-access buttons that open
in modal dialogs.

Key types:
- SlotNumber: Type-safe slot identifiers (1, 2, 3)
- ShortcutButtonConfig: Storage schema for shortcut configuration
- SlotAssignment: Rendering metadata for a shortcut slot

@author FlashForgeUI Team
@module ui/shortcuts/types

## src/ui/single-color-confirmation-dialog/single-color-confirmation-dialog-renderer.ts

Single Color Confirmation Dialog renderer process for material verification
before starting single-color print jobs on material-station-equipped printers. Displays the
active material slot's type and color, validates material availability, and collects user
confirmation with optional bed leveling toggle.

Key Features:
- Material station status integration for active slot detection
- Visual material type and color display from active IFS slot
- Empty slot detection with error messaging and print blocking
- Bed leveling toggle with default preference handling
- Real-time material station communication errors
- Graceful handling of disconnected material stations

Workflow:
1. Receives initialization data (file name, default leveling state)
2. Queries material station for active slot information
3. Displays active slot material type and color swatch
4. Validates material is loaded (blocks print if empty)
5. Collects confirmation with optional leveling adjustment

Error Handling:
- Material station not connected
- No active slot selected
- Active slot is empty
- Material station query failures

UI Components:
- File name display
- Slot label and material type indicator
- Color swatch visualization
- Leveling checkbox
- Start/Cancel buttons with conditional enablement

Context:
Specifically designed for AD5X and similar printers with Intelligent Filament System (IFS)
material stations to prevent print failures from incorrect material selection.

## src/ui/spoolman-dialog/spoolman-dialog-renderer.ts

Spoolman Dialog Renderer Process

Handles the spool selection dialog UI logic including search input, spool grid rendering,
state management (loading, error, empty), and user interactions. Communicates with main
process via the preload API to search spools and notify selection.

Key Features:
- Debounced search input (300ms)
- Dynamic spool card rendering with color visualization
- Multiple view states: loading, error, empty, grid
- Click-to-select spool interaction
- Keyboard navigation (Escape to close)

@module ui/spoolman-dialog/spoolman-dialog-renderer

## src/ui/spoolman-offline-dialog/spoolman-offline-dialog-renderer.ts

Renderer logic for Spoolman offline dialog.

## src/ui/status-dialog/status-dialog-renderer.ts

Status Dialog renderer process providing comprehensive system and printer
status monitoring with auto-refresh capabilities. Displays printer information, WebUI server
status, camera proxy status, and application health metrics in a formatted dashboard interface.

Key Features:
- Auto-refreshing status display (5-second intervals)
- Comprehensive printer information panel (model, firmware, serial, IP, connection state)
- WebUI server monitoring (status, active clients, access URL)
- Camera proxy status tracking (enabled, streaming, clients, ports)
- System health metrics (uptime, memory usage)
- Visual status indicators with color-coded states
- Human-readable formatting for durations and memory values

Display Sections:
- Printer Information: Hardware details and connection status
- WebUI Server: Server availability and client connections
- Camera System: Proxy status and streaming state
- System Information: Application health metrics

Auto-Refresh:
- 5-second polling interval for real-time updates
- Automatic start on dialog load
- Cleanup on window unload to prevent memory leaks

Formatting Utilities:
- formatUptime(): Converts seconds to "Xh Ym Zs" format
- formatMemory(): Converts bytes to "X.X MB" format
- Status indicators: Active (green) / Inactive (gray) visual cues

Context:
Used for system diagnostics, troubleshooting connectivity issues, monitoring resource
usage, and verifying WebUI/camera server availability. Essential for technical support.

## src/ui/update-available/update-available-renderer.ts

Renderer logic for the auto-update dialog handling platform-specific UI states.

Handles update lifecycle visualization, platform-aware actions, and IPC communication:
- Renders version comparison and release notes
- Drives download / install workflows for Windows and macOS
- Opens GitHub releases for Linux users
- Tracks download progress and error states in real time

## src/utils/__tests__/PortAllocator.test.ts

Tests for PortAllocator utility

## src/utils/camera-utils.ts

Camera configuration resolution and validation utilities implementing priority-based
camera URL selection logic. Supports both built-in printer cameras and custom camera URLs (MJPEG/RTSP),
with context-aware settings retrieval for multi-printer environments. Provides stream type detection,
URL validation, and human-readable status messaging.

Key Features:
- Priority-based camera resolution: custom camera > built-in camera > none
- MJPEG and RTSP stream type detection and validation
- Context-aware camera configuration (per-printer or global settings)
- Automatic URL generation for custom cameras without explicit URLs
- Comprehensive URL validation (protocol, hostname, format)
- Camera availability checking with detailed unavailability reasons
- Proxy URL formatting for client consumption

Resolution Priority:
1. Custom camera (if enabled): Uses user-provided URL or auto-generates default FlashForge URL
2. Built-in camera: Uses default FlashForge MJPEG pattern if printer supports camera
3. No camera: Returns unavailable status with reason

Stream Types Supported:
- MJPEG (Motion JPEG over HTTP/HTTPS)
- RTSP (Real-Time Streaming Protocol)

Context Awareness:
- Supports per-printer camera settings when contextId is provided
- Falls back to global configuration for backward compatibility
- Integrates with PrinterContextManager for multi-printer camera configurations

Usage:
- resolveCameraConfig(): Main resolution function with comprehensive config object
- validateCameraUrl(): Standalone URL validation with detailed error messages
- getCameraUserConfig(): Context-aware settings retrieval
- isCameraFeatureAvailable(): Boolean availability check

## src/utils/CSSVariables.ts

CSS Variables injection utility for conditional UI styling

This utility provides functions to inject CSS variables into dialog windows
based on the RoundedUI configuration setting, allowing seamless switching
between rounded and square UI designs without code duplication.

Also injects theme color variables for consistent theming across all dialogs.

## src/utils/error.utils.ts

Structured error handling system with typed error codes, contextual metadata,
and user-friendly message generation. Provides custom AppError class extending Error with
categorized error codes, serialization support, and comprehensive error factory functions
for common error scenarios across the application.

Key Features:
- Typed error code enumeration covering all application error categories
- Enhanced AppError class with context, timestamp, and original error tracking
- User-friendly message generation from error codes
- JSON serialization support for IPC transmission and logging
- Error factory functions for common scenarios (network, timeout, validation, etc.)
- Zod validation error conversion to structured AppError
- Error handling utilities (type guards, async wrappers, logging)
- IPC-compatible error result formatting

Error Categories:
- General: UNKNOWN, VALIDATION, NETWORK, TIMEOUT
- Printer: NOT_CONNECTED, BUSY, ERROR, COMMUNICATION
- Backend: NOT_INITIALIZED, OPERATION_FAILED, UNSUPPORTED
- File: NOT_FOUND, TOO_LARGE, INVALID_FORMAT, UPLOAD_FAILED
- Configuration: INVALID, SAVE_FAILED, LOAD_FAILED
- IPC: CHANNEL_INVALID, TIMEOUT, HANDLER_NOT_FOUND

AppError Properties:
- code: ErrorCode enum value for programmatic handling
- context: Record of additional metadata (printer info, operation details, etc.)
- timestamp: Error occurrence time for debugging
- originalError: Wrapped native Error for stack trace preservation

Factory Functions:
- fromZodError(): Converts Zod validation errors with issue details
- networkError(): Creates network-related errors with context
- timeoutError(): Timeout errors with operation and duration info
- printerError(): Printer-specific errors with contextual data
- backendError(): Backend operation failures
- fileError(): File operation errors with file name context

Utilities:
- isAppError(): Type guard for AppError instances
- toAppError(): Converts unknown errors to AppError
- withErrorHandling(): Async wrapper with error handling
- createErrorResult(): Formats errors for IPC responses
- logError(): Structured error logging with context

## src/utils/EventEmitter.ts

Browser-compatible EventEmitter implementation with full TypeScript generic
type safety for event names and payloads. Provides a lightweight, Node.js-independent event
system suitable for renderer processes and browser contexts. Uses generic event map interfaces
to enforce compile-time type checking on event emissions and listener registrations.

Key Features:
- Generic type parameters for event map specification
- Type-safe event listener registration with parameter inference
- Standard EventEmitter API (on, once, off, emit, removeAllListeners)
- Error isolation: listener exceptions don't break other listeners
- Copy-on-iterate pattern to prevent modification-during-iteration issues
- Listener count tracking and event name enumeration
- No Node.js dependencies (browser-safe)

Type Safety:
- Event map interface defines event names as keys and parameter arrays as values
- Listener functions automatically infer correct parameter types from event map
- Compile-time errors for mismatched event names or parameter types

API Methods:
- on(event, listener): Register persistent listener
- once(event, listener): Register one-time listener with auto-cleanup
- off(event, listener): Remove specific listener
- emit(event, ...args): Trigger all listeners for event with type-safe arguments
- removeAllListeners(event?): Remove all or event-specific listeners
- listenerCount(event): Count active listeners for event
- eventNames(): Get array of registered event names

Error Handling:
- Listener exceptions are caught and logged without affecting other listeners
- Error details include event name for debugging context

Usage Pattern:
Define event map interface, instantiate EventEmitter with map type, register listeners
with automatic type inference, emit events with compile-time argument validation.

Context:
Used throughout the application for component communication, state change notifications,
and asynchronous event coordination in both main and renderer processes.

## src/utils/extraction.utils.ts

Type-safe data extraction utilities for safely retrieving and converting
values from unknown or untyped objects. Provides defensive programming helpers for parsing
API responses, configuration files, and IPC message payloads with robust default value
handling and type coercion capabilities.

Key Features:
- Safe extraction of primitives (string, number, boolean) from unknown objects
- Array extraction with generic type support
- Nested property access via dot-notation paths
- Multi-property extraction with schema-based defaults
- Value existence checking with empty string/array detection
- Type coercion with validation and range clamping
- Default value fallback for all extraction operations

Primary Functions:
- safeExtractString(obj, key, default): Extract string with fallback
- safeExtractNumber(obj, key, default): Extract/parse number with fallback
- safeExtractBoolean(obj, key, default): Extract/coerce boolean with fallback
- safeExtractArray(obj, key, default): Extract array with type parameter
- safeExtractNested(obj, path, default): Dot-notation property access
- safeExtractMultiple(obj, schema): Batch extraction with schema definition

Utility Functions:
- isValidObject(value): Type guard for non-null, non-array objects
- toNumber(value, default, min, max): Convert to number with range validation
- hasValue(value): Check for non-empty, non-null values

Type Coercion:
- Numbers: Parses strings, validates finite values
- Booleans: Handles string "true"/"false", numbers (0=false), and native booleans
- Strings: Converts non-null values via String() constructor

Usage Context:
Extensively used for parsing printer API responses, configuration file loading,
IPC message handling, and any scenario requiring safe access to potentially
undefined or incorrectly typed data.

## src/utils/HeadlessArguments.ts

CLI argument parser for headless mode

Parses and validates command-line arguments for running FlashForgeUI in headless mode.
Supports single printer, multiple printers, last-used printer, and all saved printers.

Examples:
  --headless --last-used
  --headless --all-saved-printers
  --headless --printers="192.168.1.100:new:12345678,192.168.1.101:legacy"
  --headless --webui-port=3001 --webui-password=mypassword

## src/utils/HeadlessDetection.ts

Headless mode detection utility

Simple flag to track whether the application is running in headless mode.
Used throughout the application to conditionally skip UI-dependent features.

## src/utils/HeadlessLogger.ts

Structured console logging for headless mode

Provides formatted console output for headless mode operations including
connection status, WebUI status, errors, and general information.

## src/utils/icons.ts

Shared Lucide icon utilities for renderer processes.

Resolves the Lucide runtime in secured Electron environments, provides
helpers for initializing data-lucide declarations, and exposes utilities
for programmatic SVG creation and custom numbered badge icons.

## src/utils/logging.ts

Shared logging utilities for gating verbose console output.

Provides helpers for feature-flagged verbose logging across both the main
and renderer processes. The helpers read from environment variables or a
global runtime flag so developers can opt into detailed tracing without
spamming release builds.

## src/utils/PortAllocator.ts

Port allocation utility for managing port ranges in multi-context scenarios.

This utility manages the allocation and deallocation of ports within a specified range,
ensuring that each context gets a unique port for services like camera proxy servers.
Used by CameraProxyService to manage multiple camera streams across different printer contexts.

Key features:
- Sequential port allocation within a range
- Automatic tracking of allocated ports
- Port release and reuse
- Exhaustion detection with error handling

@example
const allocator = new PortAllocator(8181, 8191);
const port1 = allocator.allocatePort(); // 8181
const port2 = allocator.allocatePort(); // 8182
allocator.releasePort(port1);
const port3 = allocator.allocatePort(); // 8181 (reused)

## src/utils/PrinterUtils.ts

Printer family detection, model identification, and connection utilities
for FlashForge printer compatibility management. Provides comprehensive printer classification
(5M family vs. legacy), feature detection (camera, LED, filtration, material station), and
validation helpers for IP addresses, serial numbers, and check codes.

Key Features:
- Printer model type detection from typeName strings (5M, 5M Pro, AD5X, legacy)
- Enhanced printer family information with feature capability flags
- Client type determination (new API vs. legacy API)
- Connection parameter validation (IP, serial number, check code)
- Feature availability checking and override capability detection
- Error message generation for connection failures
- Timeout calculation based on printer family
- Display name formatting and sanitization

Printer Classification:
- 5M Family: Adventurer 5M, 5M Pro, AD5X (new API, check code required)
- Legacy: All other models (legacy API, direct connection)

Model-Specific Features:
- Adventurer 5M Pro: Built-in camera, LED, filtration
- Adventurer 5M: No built-in peripherals
- AD5X: Material station support, no built-in camera/LED/filtration
- Generic Legacy: No built-in peripherals, no material station

Key Functions:
- detectPrinterModelType(typeName): Returns PrinterModelType enum
- getPrinterModelInfo(typeName): Returns comprehensive feature info
- detectPrinterFamily(typeName): Returns family classification with check code requirement
- determineClientType(is5MFamily): Returns 'new' or 'legacy' client type
- supportsDualAPI(modelType): Checks if printer can use both APIs

Validation Functions:
- isValidIPAddress(ip): IPv4 format validation
- isValidSerialNumber(serial): Serial number format validation
- isValidCheckCode(code): Check code format validation
- shouldPromptForCheckCode(): Determines if check code prompt is needed

Utilities:
- formatPrinterName/sanitizePrinterName: Display and filesystem-safe naming
- getConnectionErrorMessage(error): User-friendly error messages
- getConnectionTimeout(is5MFamily): Dynamic timeout based on printer type
- formatConnectionStatus(isConnected, name): Status string generation

Context:
Central to printer backend selection, connection workflow, and feature availability
throughout the application. Used by ConnectionFlowManager, PrinterBackendManager,
and UI components for printer-specific behavior.

## src/utils/RoundedUICompatibility.ts

Rounded UI compatibility helpers for platform-aware UI enforcement.

Centralizes logic for determining whether the Rounded UI experiment can run on the
current platform, ensuring every window configuration uses the same compatibility
checks. Prevents duplicate platform-specific heuristics by exposing a small API:
- isRoundedUISupported(): boolean flag for current process/platform
- getRoundedUIUnsupportedReason(): identifies why Rounded UI is blocked
- getRoundedUISupportInfo(): structured object for IPC responses

Rounded UI is currently disabled on:
- macOS: custom title bar conflicts with traffic light controls
- Windows 11 (build >= 22000): OS already applies rounded chrome that clashes with ours

## src/utils/time.utils.ts

Time conversion, formatting, and calculation utilities for human-readable
duration display, print time estimation, and ETA calculations. Provides consistent time
formatting across the application with support for elapsed time tracking, remaining time
calculations, and smart date/time formatting based on relative dates.

Key Features:
- Time unit conversion (seconds/minutes) with rounding
- Human-readable duration formatting (e.g., "2h 15m", "45m", "30s")
- Date and time formatting (ISO dates, 24-hour time, localized strings)
- Elapsed time calculation from start timestamps
- Remaining time and ETA calculations based on progress
- Duration string parsing (e.g., "2h 15m" to seconds)
- Relative date formatting (today, tomorrow, specific date/time)
- Time range checking and next occurrence calculations

Conversion Functions:
- secondsToMinutes(seconds): Seconds to minutes (rounded)
- minutesToSeconds(minutes): Minutes to seconds
- formatDuration(seconds): Seconds to "Xh Ym" or "Xm" or "Xs"
- formatMinutes(minutes): Minutes to "Xh Ym" or "Xm"
- formatJobTime(seconds): Seconds to "mm:ss" or "HH:mm:ss" for job elapsed time display
- parseDuration(string): "Xh Ym Zs" to seconds

Date/Time Formatting:
- formatTime(date): "HH:MM:SS" 24-hour format
- formatDate(date): "YYYY-MM-DD" ISO date
- formatDateTime(date): Combined date and time
- formatETA(seconds): Smart relative ETA ("HH:MM", "Tomorrow HH:MM", or full date/time)

Calculation Functions:
- calculateElapsed(start, end?): Elapsed seconds between timestamps
- calculateRemaining(elapsed, total): Remaining time (clamped to 0)
- calculateETA(progress, elapsed): Total estimated time from progress percentage

Utility Functions:
- isWithinRange(date, start, end): Date range checking
- getTimeUntil(hour, minute): Seconds until next occurrence of time

Usage Context:
Used throughout the UI for print job time displays, progress tracking, ETA calculations,
uptime displays, and any scenario requiring human-friendly time representation.

## src/webui/schemas/web-api.schemas.ts

Zod validation schemas for WebUI API requests and WebSocket communication.

Provides comprehensive runtime validation for all data received from web clients including
authentication requests, WebSocket commands, printer control operations, and API endpoint
payloads. These schemas ensure type safety and security by validating all incoming data
before processing, protecting against malformed requests, injection attacks, and type-related
runtime errors. Includes specialized validators for temperature controls, job operations,
and command-specific data with helpful error messages for client-side feedback.

Key exports:
- Authentication schemas: WebUILoginRequestSchema, AuthTokenSchema
- WebSocket schemas: WebSocketCommandSchema, WebSocketCommandTypeSchema
- Command validation: PrinterCommandSchema, CommandDataValidators
- Temperature/Job schemas: TemperatureSetRequestSchema, JobStartRequestSchema, GCodeCommandRequestSchema
- Helper functions: validateWebSocketCommand, extractBearerToken, createValidationError
- Type exports: ValidatedLoginRequest, ValidatedWebSocketCommand, ValidatedPrinterCommand

## src/webui/server/api-routes.ts

Express router composition for the WebUI HTTP API.

Wires together modular route registrations so each domain (status, control, jobs, etc.) can
stay focused and reusable. Shared manager dependencies are resolved once and passed into the
registration helpers, enabling multi-context REST support and easier future maintenance.

## src/webui/server/auth-middleware.ts

Express middleware for WebUI authentication, rate limiting, and request logging.

Provides comprehensive middleware stack for securing and monitoring WebUI API endpoints including
authentication token validation, login rate limiting to prevent brute force attacks, error handling
with standardized responses, and request logging for debugging. The authentication middleware extends
Express Request with auth information and validates Bearer tokens on all protected routes. Rate limiting
middleware tracks login attempts by IP address with configurable thresholds and time windows.

Key exports:
- createAuthMiddleware(): Required authentication for protected routes
- createOptionalAuthMiddleware(): Optional authentication that checks but doesn't require tokens
- createLoginRateLimiter(): Rate limiting for login endpoint (5 attempts per 15 minutes)
- createErrorMiddleware(): Centralized error handling with standardized responses
- createRequestLogger(): Request logging with method, path, status code, and duration
- AuthenticatedRequest: Extended Request interface with auth property

## src/webui/server/AuthManager.ts

Authentication manager for WebUI providing password validation and session token management.

Manages all aspects of WebUI authentication including password validation against configured
credentials, secure JWT-style token generation with HMAC signatures, session lifecycle tracking,
and automatic session cleanup. Supports both persistent (24-hour) and temporary (1-hour) sessions
based on "remember me" preferences. Tokens are cryptographically signed using SHA-256 HMAC with
a secret derived from the WebUI password, preventing tampering and ensuring secure authentication.
Integrates with ConfigManager for password storage and provides session management including
token revocation, activity tracking, and automatic expiration cleanup.

Key exports:
- AuthManager class: Main authentication service with singleton pattern
- getAuthManager(): Singleton accessor function
- Session management: validateLogin, validateToken, revokeToken, getActiveSessionCount
- Token utilities: extractTokenFromHeader, getAuthStatus
- Cleanup: Automatic session expiration every 5 minutes, manual clearAllSessions

## src/webui/server/routes/camera-routes.ts

Camera status and proxy configuration routes for the WebUI server.

## src/webui/server/routes/context-routes.ts

Printer context management routes (list + switch active context).

## src/webui/server/routes/filtration-routes.ts

Filtration (AD5M Pro) control routes for the WebUI server.

## src/webui/server/routes/job-routes.ts

Job listing and control routes (local/recent files plus start job).

## src/webui/server/routes/printer-control-routes.ts

Printer control route registrations (movement, job control, LEDs, status operations).

## src/webui/server/routes/printer-status-routes.ts

Printer status and capability API route registrations for the WebUI server.

Handles status polling, feature discovery, and material station insight endpoints with
shared context resolution so browser clients can query different printers independently.

## src/webui/server/routes/route-helpers.ts

Shared helper utilities and dependency contracts for WebUI API route modules.

Centralizes common plumbing for context resolution, backend readiness enforcement, and
standardized error responses so individual route modules can focus on business logic. The
helpers understand optional `contextId` overrides (query/body/params) to unlock true
multi-context REST support while keeping consistent HTTP status codes across endpoints.

## src/webui/server/routes/spoolman-routes.ts

Spoolman integration routes (config, search, active spool management).

## src/webui/server/routes/temperature-routes.ts

Temperature control API routes for the WebUI server.

## src/webui/server/routes/theme-routes.ts

WebUI theme configuration routes.

## src/webui/server/WebSocketManager.ts

WebSocket server manager for real-time bidirectional WebUI communication.

Manages all WebSocket connections for the WebUI providing real-time printer status updates,
command execution, and bidirectional communication between browser clients and the main process.
Implements connection authentication via token validation, automatic reconnection handling,
keep-alive ping/pong mechanisms, and efficient message broadcasting to all connected clients.
Integrates with WebUIManager to receive polling updates from the main process and forwards
formatted status data to clients. Supports multi-tab sessions per authentication token with
proper client tracking and cleanup. All messages follow a type-safe protocol with discriminated
union types for robust error handling.

Key exports:
- WebSocketManager class: Main WebSocket server with singleton pattern
- getWebSocketManager(): Singleton accessor function
- Connection management: initialize, shutdown, getClientCount, disconnectToken
- Broadcasting: broadcastPrinterStatus, broadcastToToken
- Message types: AUTH_SUCCESS, STATUS_UPDATE, ERROR, COMMAND_RESULT, PONG

## src/webui/server/WebUIManager.ts

Central WebUI server coordinator managing Express HTTP server and WebSocket lifecycle.

Provides comprehensive management of the WebUI server including Express HTTP server initialization,
static file serving, middleware configuration, API route registration, WebSocket server setup,
and integration with printer backend services. Automatically starts when a printer connects
(if enabled in settings) and stops on disconnect. Handles administrator privilege requirements
on Windows platforms, network interface detection for LAN access, and configuration changes
for dynamic server restart. Coordinates between HTTP API routes, WebSocket real-time updates,
and polling data from the main process to provide seamless remote printer control and monitoring.

Key exports:
- WebUIManager class: Main server coordinator with singleton pattern
- getWebUIManager(): Singleton accessor function
- Lifecycle: start, stop, initialize, startForPrinter, stopForPrinter
- Status: getStatus, isServerRunning, getExpressApp, getHttpServer
- Integration: handlePollingUpdate (receives status from main process)
- Events: 'server-started', 'server-stopped', 'printer-connected', 'printer-disconnected'

## src/webui/static/app.ts

Browser-based WebUI client application for remote printer control and monitoring.

Provides comprehensive browser interface for remote FlashForge printer control including
authentication with token persistence, real-time WebSocket communication for status updates,
printer control operations (temperature, job management, LED, filtration), multi-printer
context switching, camera stream viewing (MJPEG and RTSP with JSMpeg), file selection dialogs,
and responsive UI updates. Implements automatic reconnection logic, keep-alive ping mechanisms,
and graceful degradation when features are unavailable. All communication uses type-safe
interfaces with proper error handling and user feedback via toast notifications.

Key features:
- Authentication: Login with remember-me, token persistence in localStorage/sessionStorage
- WebSocket: Real-time status updates, command execution, automatic reconnection
- Printer control: Temperature set/off, job pause/resume/cancel, home axes, LED control
- Multi-printer: Context switching with dynamic UI updates and feature detection
- Camera: MJPEG proxy streaming and RTSP streaming via JSMpeg with WebSocket
- File management: Recent/local file browsing, file selection dialogs, job start with options
- Material matching: AD5X multi-color job mapping to material station slots prior to start
- UI updates: Real-time temperature, progress, layer info, ETA, lifetime statistics, thumbnails

## src/webui/static/core/AppState.ts

Centralized WebUI application state and shared singletons.

Hosts the mutable AppState container along with layout managers, context
tracking helpers, and layout configuration constants. Provides accessor
utilities so other modules can read and mutate shared state without reaching
into module-level variables directly.

## src/webui/static/core/Transport.ts

REST and WebSocket transport utilities for the WebUI client.

Provides fetch helpers with automatic auth header injection plus WebSocket
connection management with simple callback registration for status and
spoolman updates. Keeps transport concerns isolated from UI orchestration.

## src/webui/static/features/authentication.ts

Authentication helpers and event wiring for the WebUI client.

Manages login/logout flows, token persistence, and authentication status
checks. Exposes event handler setup with optional hooks so the orchestrator
can trigger additional work (e.g., WebSocket connect, context refresh)
without tightly coupling modules.

## src/webui/static/features/camera.ts

Camera streaming helpers for the WebUI client.

Fetches camera proxy configuration, initializes MJPEG or RTSP (JSMpeg)
rendering, and provides teardown utilities so contexts can be switched
without stale DOM state. Keeps camera concerns isolated from the main app
orchestrator.

## src/webui/static/features/context-switching.ts

Multi-printer context management utilities.

Handles context discovery, selector population, and switching logic with
optional hooks so the orchestrator can run follow-up tasks (feature reloads,
camera refreshes, etc.) without embedding those concerns into this module.

## src/webui/static/features/job-control.ts

Printer job control helpers and event wiring for the WebUI client.

Handles printer command dispatch, feature loading, and job start workflow
orchestration (including AD5X material matching hand-off). Also wires up the
core control panel buttons plus the WebSocket keep-alive ping so `app.ts`
can focus purely on high-level initialization.

## src/webui/static/features/layout-theme.ts

Layout and theme management utilities for the WebUI client.

Provides GridStack initialization, per-printer layout persistence, settings
dialog management, responsive handling, and WebUI theme customization.
Exposes hooks that let the orchestrator react to layout rehydration without
introducing direct coupling to UI rendering functions.

## src/webui/static/features/material-matching.ts

AD5X material matching workflow for multi-color jobs.

Manages the modal experience for mapping tool requirements to material
station slots including validation, warnings, and final job start submission.
Encapsulates all DOM rendering plus state management so callers only need
to trigger the modal or respond to confirmation events.

## src/webui/static/features/spoolman.ts

Spoolman integration helpers for the WebUI client.

Loads Spoolman configuration, manages the active spool per context, and
wires up the selection modal (search, select, clear). Keeps API interaction
and DOM updates contained so higher-level orchestration simply calls the
exported hooks.

## src/webui/static/grid/types.ts

Type definitions for the WebUI grid layout system.

Defines shared interfaces for GridStack-backed layout management in the
browser-based WebUI. These types describe component metadata, layout
serialization formats, persistence payloads, and callback signatures used
by the Grid manager and persistence layer. The definitions are intentionally
decoupled from Electron renderer-specific types to keep the WebUI self-
contained and browser-friendly.

## src/webui/static/grid/WebUIComponentRegistry.ts

Metadata and template registry for WebUI GridStack components.

Exposes component definitions, default layout configuration, and HTML
templates for each panel rendered inside the browser WebUI. The registry
keeps component information centralized so layout logic and persistence can
look up defaults, while the Grid manager can instantiate panel content
without duplicating markup definitions throughout the application.

## src/webui/static/grid/WebUIGridManager.ts

Browser-focused GridStack manager for the WebUI layout system.

Wraps the GridStack library with WebUI-specific helpers for initializing the
dashboard grid, managing component widgets, toggling edit mode, and emitting
serialized layout updates for persistence. The manager operates exclusively
in the browser environment and assumes GridStack's UMD bundle is available
globally via gridstack-all.js.

## src/webui/static/grid/WebUILayoutPersistence.ts

localStorage persistence manager for WebUI Grid layouts.

Handles saving, loading, and resetting per-printer layouts using browser
localStorage. Implements debounced writes to avoid excessive synchronous
storage operations while ensuring each printer serial number maintains an
independent layout record. The persistence layer also validates stored
payloads to guard against corrupted data and falls back to default layouts
when necessary.

## src/webui/static/grid/WebUIMobileLayoutManager.ts

Manages static mobile layout for WebUI.
Provides single-column vertical layout for mobile devices with predefined component order.

## src/webui/static/shared/dom.ts

Shared DOM helper utilities for the WebUI static client.

Provides lightweight wrappers for common DOM interactions including
element lookup, visibility toggling, text updates, and toast notifications.
These helpers keep `app.ts` focused on higher-level orchestration logic.

## src/webui/static/shared/formatting.ts

Formatting helpers and type guards for WebUI job metadata.

Centralizes logic for determining AD5X job characteristics along with
formatting utilities for materials, durations, ETA display, and lifetime
usage statistics. These helpers are shared across multiple WebUI features.

## src/webui/static/shared/icons.ts

Lucide icon utilities for the WebUI static client.

Handles converting icon names to PascalCase, hydrating Lucide icons inside
dynamically rendered DOM nodes, and initializing the global set of icons
required by the WebUI header and dialogs.

## src/webui/static/ui/dialogs.ts

Dialog orchestration utilities for the WebUI client.

Handles file selection, temperature prompts, and shared modal event
registration. These helpers keep `app.ts` focused on orchestration by
centralizing DOM interactions while delegating business logic (job start,
material matching, printer commands) through dependency callbacks.

## src/webui/static/ui/header.ts

Header UI helpers for the WebUI client.

Encapsulates header-specific DOM interactions including the edit mode toggle
button so layout logic can inject its own persistence and grid handling
without tightly coupling to DOM querying code.

## src/webui/static/ui/panels.ts

UI panel rendering helpers for the WebUI client.

Contains pure rendering logic for the header connection indicator, printer
status cards, statistics panels, and Spoolman tracker. These functions are
stateless aside from reading from the shared AppState container and can be
safely reused by WebSocket handlers, layout refresh hooks, or manual refresh
actions.

## src/webui/types/web-api.types.ts

TypeScript type definitions for WebUI API communication and message protocols.

Provides comprehensive type definitions for all communication between WebUI browser clients
and the WebUI server including authentication payloads, WebSocket message protocols, API
request/response structures, and printer command types. Uses discriminated union types for
type-safe message handling and readonly properties to prevent accidental mutation. The unified
PrinterStatusData interface ensures consistency across WebSocket messages, API responses, and
frontend state management. All types follow strict TypeScript patterns with readonly modifiers,
literal types for enums, and branded types where appropriate for compile-time safety.

Key exports:
- Authentication: WebUILoginRequest, WebUILoginResponse, WebUIAuthStatus
- WebSocket: WebSocketMessage, WebSocketCommand, WebSocketMessageType, WebSocketCommandType
- Printer data: PrinterStatusData (unified status interface), PrinterFeatures
- API responses: PrinterStatusResponse, StandardAPIResponse, CameraStatusResponse
- Commands: PRINTER_COMMANDS constant object, PrinterCommand type
- Errors: WebUIError, WEB_UI_ERROR_CODES constant object, WebUIErrorCode type

## src/windows/dialogs/SpoolmanOfflineDialog.ts

Helper for creating and managing the Spoolman offline warning dialog.

## src/windows/factories/ComponentDialogWindowFactory.ts

Factory for creating component dialog windows

Creates modal dialog windows that display individual grid components.
Each component is rendered in its own dialog with full real-time functionality,
receiving polling updates just like grid-based components.

Dialog specifications:
- Size: Component-specific (e.g., 500x400 for temperature controls)
- Modal: true (blocks main window)
- Frameless: true
- Transparent: true
- Resizable: true

Communication pattern:
- Dialog receives componentId on creation
- Component is instantiated in dialog renderer
- Dialog listens to same 'polling-update' channel as main window
- ComponentManager in dialog distributes updates to component

@author FlashForgeUI Team
@module windows/factories/ComponentDialogWindowFactory

## src/windows/factories/CoreWindowFactory.ts

CoreWindowFactory handles creation of primary application windows including
settings, status, and log dialog windows.

This factory module provides creation functions for core application windows that represent
primary functionality. All windows are created as modal children of the main window with
standardized lifecycle management, development tools integration, and WindowManager state
tracking. The module maintains exact backward compatibility with the original WindowFactory
implementation while providing consistent patterns for window creation and cleanup.

Key Features:
- Modal window behavior with parent window relationships to the main window
- Single-instance enforcement with focus-on-existing behavior to prevent duplicates
- Standardized window dimensions using WINDOW_SIZES constants from WindowTypes
- Consistent security configuration with contextIsolation and no nodeIntegration
- Automatic WindowManager registration and cleanup on window close
- Development tools integration with automatic DevTools opening in development mode
- Environment-aware HTML loading from src directory structure
- Configurable frame and transparency based on UI configuration settings

Core Responsibilities:
- Create settings window for application configuration with resizable, frameless design
- Create status window for detailed printer status display with resizable layout
- Create log dialog window for application logging and debugging information
- Enforce single-instance behavior by focusing existing windows when creation is attempted
- Register windows with WindowManager for centralized state management
- Setup proper lifecycle handlers for cleanup on window close events
- Validate parent window existence before creating child windows to prevent errors

Window Creation Pattern:
1. Check for existing window and focus if present (single-instance enforcement)
2. Validate parent window exists to prevent creation errors
3. Get standardized dimensions from WINDOW_SIZES constant
4. Create UI preload path for the specific component
5. Create modal window with standard security configuration
6. Load HTML file from src directory structure
7. Setup lifecycle handlers for cleanup on close
8. Setup development tools if in development mode
9. Register window with WindowManager for state tracking

Window Specifications:
- Settings Window: 600x500 (min 500x400), resizable, frameless, transparent
- Status Window: 650x600 (min 500x500), resizable, frameless, configurable transparency
- Log Dialog: 800x600 (min 600x400), resizable, frameless, configurable transparency

@exports createSettingsWindow - Create settings window for application configuration
@exports createStatusWindow - Create status window for detailed printer status
@exports createLogDialog - Create log dialog for application logging and debugging

## src/windows/factories/ShortcutConfigWindowFactory.ts

Factory for creating shortcut configuration dialog window

Creates modal dialog windows for managing topbar shortcut button configuration.
Users can assign up to 3 components to quick-access shortcut slots. The dialog
provides dropdowns for slot assignment and displays current configuration status.

Dialog specifications:
- Size: 540x680 (min 500x620)
- Modal: true (blocks main window)
- Frameless: true
- Transparent: true
- Resizable: false

Communication pattern:
- Uses unique dialog ID and response channel for each instance
- Promise-based result handling
- Sends updated configuration to main window on save
- Proper cleanup of IPC handlers on close

@author FlashForgeUI Team
@module windows/factories/ShortcutConfigWindowFactory
