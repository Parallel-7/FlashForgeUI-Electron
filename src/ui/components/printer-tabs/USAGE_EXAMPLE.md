# PrinterTabsComponent Usage Example

## Basic Initialization

```typescript
import { PrinterTabsComponent } from './ui/components/printer-tabs';
import type { PrinterContextInfo } from './types/PrinterContext';

// Get the container element
const tabsContainer = document.getElementById('printer-tabs-container');
if (!tabsContainer) {
  throw new Error('Printer tabs container not found');
}

// Create and initialize the component
const printerTabs = new PrinterTabsComponent();
await printerTabs.initialize(tabsContainer);
```

## Event Handling

### Tab Clicked (Switch Context)
```typescript
printerTabs.on('tab-clicked', async (contextId: string) => {
  console.log(`Switching to printer context: ${contextId}`);

  // Call IPC to switch active context in main process
  await window.api.printerContexts.switch(contextId);

  // UI will update via context-switched event from main process
});
```

### Tab Closed (Remove Context)
```typescript
printerTabs.on('tab-closed', async (contextId: string) => {
  console.log(`Closing printer context: ${contextId}`);

  // Show confirmation dialog
  const confirmed = await window.api.dialogs.showConfirmation({
    title: 'Close Printer Connection',
    message: 'Are you sure you want to close this printer connection?',
    type: 'warning'
  });

  if (confirmed) {
    // Call IPC to remove context from main process
    await window.api.printerContexts.remove(contextId);

    // UI will update via context-removed event from main process
  }
});
```

### Add Printer Clicked
```typescript
printerTabs.on('add-printer-clicked', async () => {
  console.log('Add printer button clicked');

  // Show connection dialog
  await window.api.connection.showConnectDialog();

  // On successful connection, context-created event will fire
});
```

## Listening for Context Events from Main Process

### Context Created
```typescript
window.api.onPrinterContextCreated((contextInfo: PrinterContextInfo) => {
  console.log('New printer context created:', contextInfo);

  // Add tab to UI
  printerTabs.addTab(contextInfo);

  // Automatically switch to new tab if specified
  if (contextInfo.isActive) {
    printerTabs.setActiveTab(contextInfo.id);
  }
});
```

### Context Switched
```typescript
window.api.onPrinterContextSwitched((contextId: string, previousId: string | null) => {
  console.log(`Switched from ${previousId} to ${contextId}`);

  // Update active tab in UI
  printerTabs.setActiveTab(contextId);
});
```

### Context Removed
```typescript
window.api.onPrinterContextRemoved((contextId: string, wasActive: boolean) => {
  console.log(`Context removed: ${contextId}`);

  // Remove tab from UI
  printerTabs.removeTab(contextId);

  // If the removed context was active, the main process will
  // automatically switch to another context (if any exist)
});
```

### Context Updated (Connection State Changes)
```typescript
window.api.onPrinterContextUpdated((contextId: string, updates: Partial<PrinterContextInfo>) => {
  console.log(`Context updated: ${contextId}`, updates);

  // Update tab with new information
  printerTabs.updateTab(contextId, updates);
});
```

## Complete Integration Example

```typescript
import { PrinterTabsComponent } from './ui/components/printer-tabs';
import type { PrinterContextInfo } from './types/PrinterContext';

class PrinterTabsManager {
  private tabsComponent: PrinterTabsComponent | null = null;

  async initialize(): Promise<void> {
    const container = document.getElementById('printer-tabs-container');
    if (!container) return;

    this.tabsComponent = new PrinterTabsComponent();
    await this.tabsComponent.initialize(container);

    this.setupEventListeners();
    await this.loadExistingContexts();
  }

  private setupEventListeners(): void {
    if (!this.tabsComponent) return;

    // User interactions with tabs
    this.tabsComponent.on('tab-clicked', this.handleTabClick.bind(this));
    this.tabsComponent.on('tab-closed', this.handleTabClose.bind(this));
    this.tabsComponent.on('add-printer-clicked', this.handleAddPrinter.bind(this));

    // Main process context events
    window.api.onPrinterContextCreated(this.handleContextCreated.bind(this));
    window.api.onPrinterContextSwitched(this.handleContextSwitched.bind(this));
    window.api.onPrinterContextRemoved(this.handleContextRemoved.bind(this));
    window.api.onPrinterContextUpdated(this.handleContextUpdated.bind(this));
  }

  private async loadExistingContexts(): Promise<void> {
    if (!this.tabsComponent) return;

    // Get all existing contexts from main process
    const contexts = await window.api.printerContexts.getAll();

    // Add tabs for each existing context
    contexts.forEach(context => {
      this.tabsComponent?.addTab(context);
    });

    // Get and set active context
    const activeContext = await window.api.printerContexts.getActive();
    if (activeContext) {
      this.tabsComponent.setActiveTab(activeContext.id);
    }
  }

  private async handleTabClick(contextId: string): Promise<void> {
    await window.api.printerContexts.switch(contextId);
  }

  private async handleTabClose(contextId: string): Promise<void> {
    const confirmed = await window.api.dialogs.showConfirmation({
      title: 'Close Printer',
      message: 'Close this printer connection?',
      type: 'warning'
    });

    if (confirmed) {
      await window.api.printerContexts.remove(contextId);
    }
  }

  private async handleAddPrinter(): Promise<void> {
    await window.api.connection.showConnectDialog();
  }

  private handleContextCreated(contextInfo: PrinterContextInfo): void {
    this.tabsComponent?.addTab(contextInfo);
    if (contextInfo.isActive) {
      this.tabsComponent?.setActiveTab(contextInfo.id);
    }
  }

  private handleContextSwitched(contextId: string): void {
    this.tabsComponent?.setActiveTab(contextId);
  }

  private handleContextRemoved(contextId: string): void {
    this.tabsComponent?.removeTab(contextId);
  }

  private handleContextUpdated(contextId: string, updates: Partial<PrinterContextInfo>): void {
    this.tabsComponent?.updateTab(contextId, updates);
  }

  destroy(): void {
    this.tabsComponent?.destroy();
    this.tabsComponent = null;
  }
}

// Usage in renderer.ts or main UI initialization
const tabsManager = new PrinterTabsManager();
await tabsManager.initialize();
```

## Testing Example

```typescript
import { PrinterTabsComponent } from './ui/components/printer-tabs';
import type { PrinterContextInfo } from './types/PrinterContext';

async function testPrinterTabs(): Promise<void> {
  const container = document.getElementById('printer-tabs-container')!;
  const tabs = new PrinterTabsComponent();
  await tabs.initialize(container);

  // Create test contexts
  const context1: PrinterContextInfo = {
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
  };

  const context2: PrinterContextInfo = {
    id: 'context-2',
    name: 'FlashForge AD5M Pro',
    ip: '192.168.1.101',
    model: 'Adventurer 5M Pro',
    status: 'connecting',
    isActive: false,
    hasCamera: true,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  };

  // Add tabs
  tabs.addTab(context1);
  tabs.addTab(context2);

  // Test status update
  setTimeout(() => {
    tabs.updateTab('context-2', { status: 'connected' });
  }, 2000);

  // Test switching
  setTimeout(() => {
    tabs.setActiveTab('context-2');
  }, 4000);

  // Test adding third printer
  setTimeout(() => {
    const context3: PrinterContextInfo = {
      id: 'context-3',
      name: 'FlashForge AD5M',
      ip: '192.168.1.102',
      model: 'Adventurer 5M',
      status: 'error',
      isActive: false,
      hasCamera: false,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };
    tabs.addTab(context3);
  }, 6000);
}

// Run test
testPrinterTabs();
```

## Status State Examples

```typescript
// Connected printer
tabs.updateTab(contextId, { status: 'connected' });

// Connecting (shows pulsing animation)
tabs.updateTab(contextId, { status: 'connecting' });

// Disconnected
tabs.updateTab(contextId, { status: 'disconnected' });

// Error state (shows red indicator and border)
tabs.updateTab(contextId, { status: 'error' });
```

## Utility Methods

```typescript
// Check if a tab exists
if (tabs.hasTab('context-1')) {
  console.log('Tab exists');
}

// Get tab count
const count = tabs.getTabCount();
console.log(`${count} printers connected`);

// Clear all tabs
tabs.clearTabs();

// Destroy component
tabs.destroy();
```

## Styling Customization

The component uses standard CSS variables from the main theme. To customize:

```css
/* In your main CSS file */
:root {
  --tab-active-color: #4285f4;      /* Active tab background */
  --tab-inactive-color: #2d2d2d;    /* Inactive tab background */
  --tab-border-color: #3a3a3a;      /* Tab border */
  --status-connected: #00e676;      /* Connected indicator */
  --status-connecting: #ffd54f;     /* Connecting indicator */
  --status-disconnected: #9e9e9e;   /* Disconnected indicator */
  --status-error: #f44336;          /* Error indicator */
}
```

## Accessibility Features

The component includes:
- **Keyboard Navigation**: Tab through all tabs and buttons
- **ARIA Labels**: Close buttons have descriptive labels
- **Focus Indicators**: Visible focus outlines for keyboard users
- **High Contrast**: Status indicators are clearly visible
- **Screen Reader Support**: Proper semantic HTML structure

## Error Handling

```typescript
try {
  await tabs.initialize(container);
} catch (error) {
  console.error('Failed to initialize printer tabs:', error);
  // Show error to user
  window.api.dialogs.showError({
    title: 'Initialization Error',
    message: 'Failed to initialize printer tabs interface'
  });
}
```

## Performance Considerations

- **Lightweight Rendering**: Each tab is ~100 bytes of DOM
- **Event Delegation**: Minimal event listeners
- **Smooth Animations**: GPU-accelerated CSS transitions
- **Efficient Updates**: Only update changed properties
- **Memory Management**: Proper cleanup in destroy()

## Browser Compatibility

Requires modern browser features:
- CSS Grid/Flexbox
- ES2020+ JavaScript
- EventEmitter (Node.js)
- Modern DOM APIs

All requirements are met by Electron's built-in Chromium.
