# Printer Tabs Component

Multi-printer tabbed interface for FlashForgeUI-Electron, matching Orca-FlashForge design language.

## Overview

The PrinterTabsComponent provides a modern tabbed interface for managing multiple printer connections simultaneously. It features connection status indicators, tab switching, close buttons, and an "Add Printer" button for creating new connections.

## Features

- ✅ **Tab Management**: Add, remove, update, and switch between printer tabs
- ✅ **Connection Status**: Visual indicators for connected, connecting, disconnected, and error states
- ✅ **Event-Driven**: Emits events for user interactions (tab click, close, add printer)
- ✅ **Responsive Design**: Horizontal scrolling, mobile-friendly layout
- ✅ **Accessibility**: Keyboard navigation, ARIA labels, focus indicators
- ✅ **Clean Styling**: Matches existing FlashForgeUI dark theme and color scheme

## Files

```
src/ui/components/printer-tabs/
├── PrinterTabsComponent.ts   # Main component class (323 lines)
├── printer-tabs.css          # Comprehensive styling (321 lines)
├── index.ts                  # Export file (8 lines)
├── USAGE_EXAMPLE.md          # Detailed usage examples
└── README.md                 # This file
```

## Quick Start

```typescript
import { PrinterTabsComponent } from './ui/components/printer-tabs';

// Initialize component
const tabsContainer = document.getElementById('printer-tabs-container');
const printerTabs = new PrinterTabsComponent();
await printerTabs.initialize(tabsContainer);

// Add a tab
printerTabs.addTab({
  id: 'context-1',
  name: 'FlashForge AD5M',
  ip: '192.168.1.100',
  model: 'Adventurer 5M',
  status: 'connected',
  isActive: true,
  hasCamera: true,
  cameraUrl: 'http://localhost:8181/stream',
  createdAt: new Date().toISOString(),
  lastActivity: new Date().toISOString()
});

// Listen for events
printerTabs.on('tab-clicked', (contextId) => {
  console.log('Tab clicked:', contextId);
});
```

## API Reference

### Methods

#### `initialize(containerElement: HTMLElement): Promise<void>`
Initialize the component in the specified container.

#### `addTab(context: PrinterContextInfo): void`
Add a new tab for a printer context.

#### `removeTab(contextId: string): void`
Remove a tab by context ID.

#### `updateTab(contextId: string, updates: Partial<PrinterContextInfo>): void`
Update a tab with new context information.

#### `setActiveTab(contextId: string): void`
Set the active tab by context ID.

#### `clearTabs(): void`
Remove all tabs.

#### `getTabCount(): number`
Get the number of tabs.

#### `hasTab(contextId: string): boolean`
Check if a tab exists for a context ID.

#### `destroy(): void`
Destroy the component and clean up resources.

### Events

#### `'tab-clicked'`
Emitted when a tab is clicked.
- **Payload**: `contextId: string`

#### `'tab-closed'`
Emitted when a tab's close button is clicked.
- **Payload**: `contextId: string`

#### `'add-printer-clicked'`
Emitted when the "Add Printer" button is clicked.
- **Payload**: None

## Connection Status Indicators

| Status | Color | Animation | Description |
|--------|-------|-----------|-------------|
| `connected` | Green (#00e676) | None | Printer is connected and ready |
| `connecting` | Yellow (#ffd54f) | Pulsing | Connection in progress |
| `disconnected` | Gray (#9e9e9e) | None | Printer is disconnected |
| `error` | Red (#f44336) | None | Connection error occurred |

## Visual Design

### Tabs
- **Height**: 34px
- **Min Width**: 200px
- **Max Width**: 280px
- **Border Radius**: 6px (top corners only)
- **Gap**: 6px between tabs

### Colors
- **Inactive Tab**: Gradient from #2d2d2d to #272727
- **Active Tab**: Gradient from #4285f4 to #357abd (matches app accent color)
- **Tab Border**: #3a3a3a (inactive), #5a95f5 (active)
- **Tab Bar Background**: #222222

### Typography
- **Tab Name**: 13px, font-weight 600, #e0e0e0 (inactive), #ffffff (active)
- **Tab Details**: 11px, #a0a0a0 (inactive), rgba(255,255,255,0.8) (active)

## Responsive Behavior

### Desktop (>768px)
- Full tab text visible
- "Add Printer" button shows text and icon
- Horizontal scrolling when many tabs

### Mobile (<768px)
- Tab widths reduced (150-200px)
- "Add Printer" button shows only "+" icon
- Font sizes slightly reduced

## Accessibility

- **Keyboard Navigation**: Full tab and focus support
- **ARIA Labels**: Close buttons have descriptive labels
- **Focus Indicators**: 2px outlines for focus-visible state
- **High Contrast**: Clear status indicators and text
- **Semantic HTML**: Proper button and container elements

## Integration with PrinterContextManager

This component is designed to work with the `PrinterContextManager` from Phase 1 of the multi-printer implementation:

1. **Context Creation**: When a new printer is connected, `PrinterContextManager` creates a context and emits a `context-created` event
2. **Context Switching**: When a tab is clicked, the renderer calls `PrinterContextManager.switchContext()`
3. **Context Removal**: When a close button is clicked, the renderer calls `PrinterContextManager.removeContext()`
4. **Context Updates**: When connection state changes, `PrinterContextManager` emits updates that trigger tab visual changes

## Dependencies

- **EventEmitter**: From Node.js (built into Electron)
- **PrinterContextInfo**: Type from `src/types/PrinterContext.ts`
- **Modern CSS**: Flexbox, Grid, CSS Variables, Transitions

## Browser Requirements

- Electron 25+ (Chromium 114+)
- ES2020+ JavaScript features
- Modern CSS features (Grid, Flexbox, CSS Variables)

## Performance

- **Lightweight DOM**: ~100 bytes per tab
- **Efficient Updates**: Only update changed properties
- **GPU-Accelerated Animations**: CSS transitions use transform/opacity
- **Memory Safe**: Proper cleanup in destroy()

## Testing

See `USAGE_EXAMPLE.md` for comprehensive testing examples including:
- Unit tests for tab operations
- Integration tests with IPC
- Visual regression testing scenarios
- Accessibility testing checklist

## Known Limitations

- Maximum recommended tabs: ~10 (UI will scroll beyond this)
- Tab reordering not supported in v1
- No drag-and-drop support in v1
- No tab persistence (handled by PrinterContextManager)

## Future Enhancements

Planned for future versions:
- Drag-and-drop tab reordering
- Right-click context menus
- Tab grouping for multiple printers of same model
- Custom tab colors/icons per printer
- Tab preview on hover (camera thumbnail)

## License

Part of FlashForgeUI-Electron project. See main project LICENSE file.

## Support

For issues, questions, or contributions related to this component:
- Open an issue in the main repository
- Reference this component in bug reports: `[printer-tabs]`
- Check `USAGE_EXAMPLE.md` for detailed integration examples

---

**Version**: 1.0.0
**Last Updated**: 2025-10-01
**Status**: Ready for integration (Phase 3 complete)
