# FlashForgeUI Main UI Rewrite Plan

## Project Overview
This document outlines the comprehensive plan for refactoring the FlashForgeUI main interface into a configurable, component-based layout system. The goal is to eliminate platform-specific UI bugs while providing users with a fully customizable interface that adapts to their specific setups.

## Current UI Structure Analysis

### Identified Components (Based on src/index.html)
From analysis of the current HTML structure, the main UI consists of these distinct sections:

1. **Camera Preview Component** (`lines 37-40, 51-53`)
   - `.camera-view` container
   - Preview enable/disable controls
   - Current job and progress display

2. **Job Info Component** (`lines 41-54`) 
   - Current job status
   - Progress bar and percentage
   - Camera controls (Preview button)

3. **Controls Button Section** (`lines 60-86`)
   - 6x2 grid of control buttons
   - LED controls, status clearing, homing
   - Print job controls (pause, resume, stop)
   - File operations (upload, start recent/local)
   - Filament and command operations

4. **Model Preview Component** (`lines 88-92`)
   - Panel with header "Model Preview"
   - Content area for 3D model visualization

5. **Job Statistics Panel** (`lines 94-119`)
   - Layer information
   - ETA and job time
   - Weight and length data

6. **Printer Status Section** (`lines 125-130`)
   - Printer state display
   - Runtime and filament usage

7. **Temperature Controls** (`lines 131-150`)
   - Bed and extruder temperature display/controls
   - Fan status information
   - Set/Off buttons for temperature management

8. **Filtration Controls** (`lines 152-161`)
   - Filtration mode status
   - TVOC level display
   - Mode selection buttons (External/Internal/None)

9. **Additional Printer Info** (`lines 163-169`)
   - Nozzle size, filament type
   - Speed and Z-axis offsets

10. **Log Panel Component** (`lines 172-175`)
    - Scrollable log output area

### Current Layout Structure
```
Header (Fixed - NOT PART OF REWRITE)
├── Left Side
│   ├── Camera View
│   └── Job Info Panel
└── Right Side
    ├── Controls Grid (6x2 buttons)
    ├── Model Preview Panel
    └── Job Stats Panel
Status Bar (Bottom)
├── Printer Status
├── Temperature Controls  
├── Filtration Section
└── Additional Info
Log Panel (Bottom)
```

## Library Recommendation

After extensive research, **Gridstack.js** is the recommended solution:

### Why Gridstack.js?
- **Framework Agnostic**: Pure TypeScript, works with vanilla JS/TS
- **Electron Compatible**: No browser-specific dependencies
- **Feature Complete**: Drag, resize, responsive, save/restore layouts
- **Modern & Maintained**: Active development, 4.4k GitHub stars
- **Mobile Support**: Touch-friendly for different screen sizes
- **No External Dependencies**: Clean integration
- **MIT License**: Commercial use friendly

### Alternative Considered
- **Interact.js**: Good for basic drag/drop but requires more custom work for grid layouts
- **React-Grid-Layout**: Excellent but requires React framework
- **Muuri.js**: Good but less dashboard-focused

## Phase 1: Component Extraction

### Component Structure
Each component will be structured as:
```
src/ui/components/[component-name]/
├── [component-name].html     # Component markup
├── [component-name].css      # Component styles  
├── [component-name].ts       # Component logic (if needed)
└── index.ts                  # Export/registration
```

### Component List & Dependencies

1. **CameraPreview** (`camera-preview`)
   - Dependencies: Camera API, job status data
   - Size: Large (video aspect ratio)
   - Position: Primary left panel

2. **JobInfo** (`job-info`)
   - Dependencies: Current job data, progress updates
   - Size: Medium (fixed height)
   - Position: Below camera

3. **ControlsGrid** (`controls-grid`) 
   - Dependencies: Printer command APIs
   - Size: Large (6x2 button grid)
   - Position: Main right panel

4. **ModelPreview** (`model-preview`)
   - Dependencies: 3D model data
   - Size: Medium-Large (square/rectangular)
   - Position: Right side

5. **JobStats** (`job-stats`)
   - Dependencies: Job metadata, real-time updates
   - Size: Medium (list format)
   - Position: Right side

6. **PrinterStatus** (`printer-status`)
   - Dependencies: Printer state, runtime data
   - Size: Small-Medium (horizontal)
   - Position: Status bar area

7. **TemperatureControls** (`temperature-controls`)
   - Dependencies: Temperature APIs, fan data  
   - Size: Medium (control buttons + displays)
   - Position: Status bar area

8. **FiltrationControls** (`filtration-controls`)
   - Dependencies: Filtration API, TVOC sensor
   - Size: Medium (buttons + status)
   - Position: Status bar area

9. **AdditionalInfo** (`additional-info`)
   - Dependencies: Printer configuration data
   - Size: Small (info display)
   - Position: Status bar area

10. **LogPanel** (`log-panel`)
    - Dependencies: Log service
    - Size: Variable (resizable height)
    - Position: Bottom panel

### Component Integration Approach
- **Minimal Functional Changes**: Pure UI restructuring only
- **Preserve All Event Handlers**: Move existing event listeners to components
- **Maintain API Contracts**: Keep all existing IPC communication
- **CSS Variable System**: Use existing CSS variables for theming
- **Platform Compatibility**: Ensure macOS traffic light compatibility

## Phase 2: Configurable Layout System

### Architecture Design

#### Grid System Integration
```typescript
// GridLayoutManager.ts
class GridLayoutManager {
  private grid: GridStack;
  private config: LayoutConfig;
  
  initialize(container: HTMLElement): void
  loadLayout(config: LayoutConfig): void  
  saveLayout(): LayoutConfig
  enterEditMode(): void
  exitEditMode(): void
  resetToDefault(): void
}
```

#### Configuration System
```typescript
interface ComponentConfig {
  id: string;
  type: ComponentType;
  x: number;
  y: number; 
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  locked?: boolean;
}

interface LayoutConfig {
  version: string;
  components: ComponentConfig[];
  gridSettings: {
    cellHeight: number;
    margin: number;
    columns: number;
  };
}
```

#### Edit Mode Features
- **Keyboard Shortcut**: `Ctrl/Cmd + E` to toggle edit mode
- **Visual Indicators**: Border highlights, resize handles, grid overlay
- **Smart Snapping**: Automatic alignment, prevent overlaps
- **Undo/Redo**: Layout change history
- **Reset Option**: Restore default layout

#### Persistence System
- **Storage Location**: Electron userData directory
- **File Format**: JSON configuration file
- **Backup Strategy**: Keep last 5 layout versions
- **Migration Support**: Handle config version updates

### Default Layout Configuration
```json
{
  "version": "1.0.0",
  "components": [
    {"id": "camera-preview", "x": 0, "y": 0, "width": 4, "height": 6},
    {"id": "job-info", "x": 0, "y": 6, "width": 4, "height": 2},
    {"id": "controls-grid", "x": 4, "y": 0, "width": 4, "height": 4},
    {"id": "model-preview", "x": 4, "y": 4, "width": 4, "height": 4},
    {"id": "job-stats", "x": 8, "y": 0, "width": 4, "height": 4},
    {"id": "printer-status", "x": 0, "y": 8, "width": 3, "height": 1},
    {"id": "temperature-controls", "x": 3, "y": 8, "width": 3, "height": 1},
    {"id": "filtration-controls", "x": 6, "y": 8, "width": 3, "height": 1},
    {"id": "additional-info", "x": 9, "y": 8, "width": 3, "height": 1},
    {"id": "log-panel", "x": 0, "y": 9, "width": 12, "height": 2}
  ],
  "gridSettings": {
    "cellHeight": 60,
    "margin": 8,
    "columns": 12
  }
}
```

### Fullscreen Scaling Strategy
- **Proportional Scaling**: Maintain aspect ratios
- **Responsive Breakpoints**: Adjust grid columns for different sizes
- **Component Priority**: Critical components get minimum size guarantees
- **Overflow Handling**: Scrollable containers for small screens

## Implementation Phases

### Phase 1: Component Extraction
1. Extract Camera Preview and Job Info components
2. Extract Controls Grid and Model Preview
3. Extract remaining status bar components  
4. Integration testing and bug fixes

### Phase 2: Layout System
1. Integrate Gridstack.js and basic grid setup
2. Implement edit mode and configuration system
3. Add persistence and keyboard shortcuts
4. Fullscreen scaling and responsive behavior

### Phase 3: Polish & Testing
1. Cross-platform testing and adjustments
2. Performance optimization and cleanup

## Technical Considerations

### CSS Variable Integration
Maintain existing CSS variable system:
- `--ui-background`, `--ui-padding`, `--ui-border-radius`
- `--dark-bg`, `--text-color`, `--accent-color` 
- Component styles will inherit from root variables

### Platform-Specific Constraints
- **Header Bar**: Completely untouched (traffic lights, window controls)
- **macOS Traffic Lights**: Preserved CSS selector specificity
- **Existing CSS Classes**: Maintain `.platform-darwin` targeting

### IPC Communication Preservation
- All existing `window.api` calls remain unchanged
- Event handlers transfer to component files
- Button mapping and command channels preserved

### Performance Considerations
- **Lazy Loading**: Components load only when visible
- **Event Delegation**: Efficient event handling across components
- **Memory Management**: Proper cleanup on component removal
- **Grid Optimization**: Minimal DOM manipulation during layout changes

## Dependencies

### New Dependencies
```json
{
  "gridstack": "^10.x.x"  // Latest stable version
}
```

### Development Dependencies  
```json
{
  "@types/gridstack": "^latest"  // TypeScript definitions
}
```

## File Structure Changes

### New Directory Structure
```
src/
├── ui/
│   └── components/           # New component system
│       ├── camera-preview/
│       ├── job-info/
│       ├── controls-grid/
│       ├── model-preview/
│       ├── job-stats/
│       ├── printer-status/
│       ├── temperature-controls/
│       ├── filtration-controls/
│       ├── additional-info/
│       └── log-panel/
├── managers/
│   └── GridLayoutManager.ts  # New layout management
├── types/
│   └── layout.ts            # Layout configuration types
└── index.html              # Simplified main container
```

### Updated Main Files
- `src/index.html`: Simplified to grid container + component placeholders
- `src/index.css`: Grid system styles + component imports
- `src/renderer.ts`: Component initialization + layout manager

## Success Criteria

### Phase 1 Success
- ✅ All UI components extracted to separate files
- ✅ Zero functional regressions 
- ✅ All existing features working identically
- ✅ Clean separation of concerns

### Phase 2 Success
- ✅ Drag and drop layout editing working
- ✅ Layout persistence across app restarts
- ✅ Keyboard shortcut for edit mode toggle
- ✅ Smart snapping and collision prevention
- ✅ Fullscreen scaling maintains custom layouts

### Overall Success
- ✅ Users can customize UI to their preferences
- ✅ Platform-specific bugs eliminated through flexibility
- ✅ Maintainable, modular codebase
- ✅ Performance equal or better than current implementation

## Risk Mitigation

### Potential Issues
1. **CSS Conflicts**: Component styles interfering with each other
2. **Event Handler Loss**: Missing functionality after extraction  
3. **Performance Degradation**: Grid system overhead
4. **Layout Corruption**: Invalid saved configurations

### Mitigation Strategies
1. **Scoped CSS**: Use component-specific selectors and CSS modules
2. **Thorough Testing**: Systematic verification of all button functions
3. **Performance Monitoring**: Benchmark before/after measurements
4. **Configuration Validation**: Schema validation and fallback defaults

## Future Enhancements

### Potential v2 Features
- **Component Marketplace**: Additional component types
- **Layout Themes**: Pre-configured layouts for different workflows
- **Multiple Profiles**: Different layouts for different printers
- **Advanced Widgets**: Custom dashboard widgets
- **Import/Export**: Share layouts with other users

---

This plan provides the roadmap for transforming FlashForgeUI into a modern, configurable interface that adapts to user needs while maintaining all existing functionality. The modular approach ensures maintainability and provides a foundation for future enhancements.