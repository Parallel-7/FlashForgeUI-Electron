# WebUI Spoolman Integration Specification

**Created:** 2025-11-04
**Status:** Ready for Implementation
**Related:** Original Spoolman spec in `ai_specs/SPOOLMAN_INTEGRATION_SPEC.md`

---

## Overview

Add full Spoolman integration to the WebUI with feature parity to the desktop app, ensuring headless mode compatibility. Users configure Spoolman via desktop app settings; WebUI provides spool selection and display functionality.

---

## Architecture Decisions

### Storage Strategy

- **Server-side (ConfigManager)**: Active spool selections per context/tool
  - Key format: `ActiveSpools_${contextId}` → `{ [toolId]: spoolId }`
  - Accessible in both desktop and headless modes
- **Client-side (localStorage)**: Only UI preferences (component visibility, layout)

### API Layer

- New routes in `src/webui/server/api-routes.ts` (or separate `spoolman-routes.ts`)
- All routes context-aware, use existing auth middleware
- Proxy Spoolman server requests through backend

### Component Design

- New component: `spoolman-selector` in WebUIComponentRegistry
- **Three states**:
  1. Disabled (Spoolman not enabled)
  2. No Spool (enabled but none selected)
  3. Active (spool selected)
- Display active spools per tool (matching printer's tool count)
- Dropdown selectors to change active spool per tool
- Visual spool indicators with color/material info
- **Always visible in component list** - shows disabled state if not configured
- **Icons from Lucide** - use `data-lucide` attributes, not text/emoji icons

---

## Implementation Phases

### Phase 1: Backend API Routes (Server-side)

**Files to modify:**
- `src/webui/server/api-routes.ts` (add routes, ~150 lines)

**New routes:**

```typescript
// GET /api/spoolman/config - Get Spoolman enabled status & server URL
router.get('/spoolman/config', async (req: AuthenticatedRequest, res: Response) => {
  const config = getConfigManager().getConfig();
  return res.json({
    success: true,
    enabled: config.SpoolmanEnabled,
    serverUrl: config.SpoolmanServerUrl,
    updateMode: config.SpoolmanUpdateMode
  });
});

// GET /api/spoolman/spools - Search/list available spools (proxied to Spoolman server)
router.get('/spoolman/spools', async (req: AuthenticatedRequest, res: Response) => {
  const config = getConfigManager().getConfig();
  if (!config.SpoolmanEnabled) {
    return res.status(503).json({ success: false, error: 'Spoolman not enabled' });
  }

  const spoolmanService = new SpoolmanService(config.SpoolmanServerUrl);
  const spools = await spoolmanService.searchSpools({
    'filament.name': req.query.search as string | undefined,
    limit: 50,
    allow_archived: false
  });

  return res.json({ success: true, spools });
});

// GET /api/spoolman/active-spools/:contextId - Get active spool selections for context
router.get('/spoolman/active-spools/:contextId', async (req: AuthenticatedRequest, res: Response) => {
  const { contextId } = req.params;
  const spoolmanService = getSpoolmanService();
  const activeSpools = spoolmanService.getActiveSpools(contextId);
  return res.json({ success: true, activeSpools });
});

// POST /api/spoolman/select-spool - Set active spool for tool in current context
router.post('/spoolman/select-spool', async (req: AuthenticatedRequest, res: Response) => {
  const { toolId, spoolId } = req.body;
  const contextId = contextManager.getActiveContextId();
  if (!contextId) {
    return res.status(503).json({ success: false, error: 'No active context' });
  }

  const spoolmanService = getSpoolmanService();
  await spoolmanService.setActiveSpool(contextId, toolId, spoolId);
  return res.json({ success: true });
});

// DELETE /api/spoolman/clear-spool - Clear active spool for tool
router.delete('/spoolman/clear-spool', async (req: AuthenticatedRequest, res: Response) => {
  const { toolId } = req.body;
  const contextId = contextManager.getActiveContextId();
  if (!contextId) {
    return res.status(503).json({ success: false, error: 'No active context' });
  }

  const spoolmanService = getSpoolmanService();
  await spoolmanService.clearActiveSpool(contextId, toolId);
  return res.json({ success: true });
});
```

**Service integration:**
- Modify `SpoolmanService` to support server-side state management
- Add methods: `getActiveSpools(contextId)`, `setActiveSpool(contextId, toolId, spoolId)`, `clearActiveSpool(contextId, toolId)`
- Use ConfigManager for persistence

---

### Phase 2: WebUI Component (Frontend)

**Files to modify:**
- `src/webui/static/grid/WebUIComponentRegistry.ts` (add component definition & template)
- `src/webui/static/grid/WebUIMobileLayoutManager.ts` (add to mobile static layout)
- `src/webui/static/index.html` (add component visibility toggle in settings modal)
- `src/webui/static/app.ts` (add event handlers for spool selection, ~100 lines)
- `src/webui/static/webui.css` (add component styles, ~50 lines)

**Component Definition:**

```typescript
// In WebUIComponentRegistry.ts
'spoolman-selector': {
  id: 'spoolman-selector',
  displayName: 'Spoolman Tracker',
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 4, h: 2 },
  defaultPosition: { x: 0, y: 10 },
}
```

**Component Template:**

```typescript
// In COMPONENT_TEMPLATES
'spoolman-selector': {
  id: 'spoolman-selector',
  html: `
    <div class="panel" id="spoolman-panel">
      <div class="panel-header">Spoolman Tracker</div>
      <div class="panel-content">
        <!-- Disabled State -->
        <div class="spoolman-state spoolman-disabled">
          <i data-lucide="package" class="spoolman-icon"></i>
          <p class="spoolman-message">
            Spoolman integration is disabled.<br>
            Enable in desktop app Settings to track filament usage.
          </p>
        </div>

        <!-- No Spool State -->
        <div class="spoolman-state spoolman-no-spool" style="display: none;">
          <button class="btn-set-spool">Set Active Spools</button>
          <p class="spoolman-hint">No active spools selected</p>
        </div>

        <!-- Active Spools State -->
        <div class="spoolman-state spoolman-active" style="display: none;">
          <div id="spoolman-tool-list" class="spoolman-tools">
            <!-- Dynamic tool/spool rows injected here -->
          </div>
        </div>
      </div>
    </div>
  `
}
```

**Component Features:**
- **Disabled state**: Shows Lucide `package` icon + "Spoolman integration is disabled. Enable in desktop app Settings."
- **No spool state**: Shows "Set Active Spools" button, hint text
- **Active state**: Displays tool list with dropdowns, colored spool previews, material/weight info
- Real-time updates when spools change or print completes
- Responsive design for mobile layout

**Mobile Layout Integration:**

```typescript
// In WebUIMobileLayoutManager.ts
// Add 'spoolman-selector' to component order
private static readonly MOBILE_COMPONENT_ORDER = [
  'camera',
  'controls',
  'spoolman-selector', // <-- Add here
  'model-preview',
  'printer-state',
  'temp-control',
  'job-progress',
  'filtration-tvoc',
  'job-details',
];
```

**Event Handlers in app.ts:**

```typescript
// Load Spoolman configuration on startup
async function loadSpoolmanConfig(): Promise<void> {
  const response = await fetch('/api/spoolman/config', { headers: buildAuthHeaders() });
  const result = await response.json();

  if (result.success) {
    updateSpoolmanState(result.enabled, result.serverUrl);
  }
}

// Load active spools for current context
async function loadActiveSpools(): Promise<void> {
  const contextId = getCurrentContextId();
  if (!contextId) return;

  const response = await fetch(`/api/spoolman/active-spools/${contextId}`, {
    headers: buildAuthHeaders()
  });

  const result = await response.json();
  if (result.success) {
    renderActiveSpools(result.activeSpools);
  }
}

// Handle "Set Active Spools" button click
document.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).classList.contains('btn-set-spool')) {
    void openSpoolSelectionModal();
  }
});

// Open spool selection modal (fetch spools, show dropdown UI)
async function openSpoolSelectionModal(): Promise<void> {
  const response = await fetch('/api/spoolman/spools', { headers: buildAuthHeaders() });
  const result = await response.json();

  if (result.success) {
    showSpoolSelectionModal(result.spools);
  }
}

// Handle spool selection from dropdown
async function selectSpoolForTool(toolId: number, spoolId: number): Promise<void> {
  const response = await fetch('/api/spoolman/select-spool', {
    method: 'POST',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ toolId, spoolId })
  });

  if (response.ok) {
    await loadActiveSpools(); // Refresh UI
    showToast('Spool selected successfully');
  }
}
```

**CSS Styling:**

```css
/* Spoolman Component */
.spoolman-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

/* Disabled State */
.spoolman-disabled {
  text-align: center;
}

.spoolman-icon {
  width: 48px;
  height: 48px;
  opacity: 0.5;
  margin-bottom: 12px;
}

.spoolman-message {
  color: #888;
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
}

/* No Spool State */
.btn-set-spool {
  padding: 12px 24px;
  background: #5c6bc0;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.spoolman-hint {
  color: #888;
  font-size: 12px;
  margin-top: 12px;
}

/* Active Spools */
.spoolman-tools {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.spoolman-tool-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.spool-visual {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
}

.spool-info {
  flex: 1;
  font-size: 13px;
}

.spool-name {
  font-weight: 600;
  color: #fff;
}

.spool-material {
  color: #aaa;
  font-size: 11px;
}
```

---

### Phase 3: Headless Mode Compatibility

**Files to check/modify:**
- `src/services/SpoolmanService.ts` (ensure no Electron-specific code)
- `src/utils/HeadlessDetection.ts` (use to skip desktop-only features)
- `src/managers/HeadlessManager.ts` (verify SpoolmanService initializes)

**Considerations:**
- Skip IPC handlers in headless mode (WebUI uses REST API instead)
- Ensure SpoolmanService uses fetch/HTTP client (not Electron net module)
- Test configuration loading from ConfigManager in headless mode
- Verify print completion updates work without Electron notifications

**Example check in SpoolmanService:**

```typescript
import { isHeadlessMode } from '../utils/HeadlessDetection';

class SpoolmanService {
  constructor(serverUrl: string) {
    this.baseUrl = serverUrl.replace(/\/$/, '') + '/api/v1';

    // Use node-fetch in all cases (works in both desktop and headless)
    // Avoid Electron's net module
  }

  private sendDesktopNotification(message: string): void {
    if (isHeadlessMode()) {
      console.log('[Spoolman] Headless mode - skipping desktop notification:', message);
      return;
    }

    // Send Electron notification
  }
}
```

---

### Phase 4: Context Switching & State Sync

**Files to modify:**
- `src/webui/static/app.ts` (hook into existing context switch logic)

**Implementation:**

```typescript
// In existing switchPrinterContext() function
async function switchPrinterContext(contextId: string): Promise<void> {
  // ... existing code ...

  // Reload Spoolman data for new context
  await loadActiveSpools();
}

// Listen for status updates via WebSocket
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'STATUS_UPDATE') {
    // ... existing code ...

    // If print just completed, refresh Spoolman data
    if (data.status.printerState === 'idle' && previousState === 'printing') {
      void loadActiveSpools(); // Spool weights updated
    }
  }
});
```

---

### Phase 5: Material Station Integration (Optional Enhancement)

**Files to consider:**
- Material matching modal in WebUI (if it exists)

**Features:**
- Pre-populate material mappings from active spools
- Show active spool info when selecting materials
- Validate material types match between spool and job requirements

---

### Phase 6: Testing & Polish

**Test scenarios:**
- ✅ Desktop app: Set active spools → verify WebUI sees them
- ✅ WebUI: Change active spools → verify desktop app updates
- ✅ Headless mode: Configure & use Spoolman without Electron UI
- ✅ Multi-printer: Switch contexts, verify spool data per context
- ✅ Print completion: Verify Spoolman updates from both desktop & WebUI-triggered prints
- ✅ Error handling: Spoolman server down, network errors, invalid spools
- ✅ Disabled state: Component shows disabled message when Spoolman not enabled
- ✅ Mobile layout: Component displays correctly in mobile view
- ✅ Lucide icons: Verify icons render correctly (not emoji/text)
- ✅ Type checking: `npm run type-check`

---

## File Structure

### New Files

```
src/
└── webui/
    └── server/
        └── spoolman-routes.ts (optional, if keeping separate from api-routes.ts)
```

### Modified Files

```
src/
├── services/
│   └── SpoolmanService.ts (+150 lines: state management methods)
├── webui/
│   ├── server/
│   │   └── api-routes.ts (+200 lines: API routes)
│   └── static/
│       ├── app.ts (+150 lines: event handlers, UI updates)
│       ├── index.html (+10 lines: settings toggle)
│       ├── webui.css (+50 lines: component styles)
│       └── grid/
│           ├── WebUIComponentRegistry.ts (+80 lines: component definition)
│           └── WebUIMobileLayoutManager.ts (+5 lines: mobile layout order)
└── managers/
    └── HeadlessManager.ts (verify, may not need changes)
```

---

## Success Criteria

### Functionality
- ✅ WebUI component always visible in component list
- ✅ Shows "disabled" state with Lucide icon when Spoolman not enabled (matching desktop UI)
- ✅ Shows active spool per tool with color/material when enabled
- ✅ WebUI allows selecting spools from dropdown per tool
- ✅ Active spool selections persist per context
- ✅ Desktop and WebUI stay in sync (both directions)
- ✅ Headless mode fully supports Spoolman operations
- ✅ Print completion updates Spoolman from WebUI sessions
- ✅ Context switching updates active spool display
- ✅ Component works in mobile layout
- ✅ Error states handled gracefully (server down, etc.)
- ✅ All icons from Lucide (no emoji/text icons)

### Code Quality
- ✅ TypeScript types for all API requests/responses
- ✅ Follows existing WebUI component patterns
- ✅ No Electron-specific code in shared services
- ✅ Proper error handling and logging
- ✅ File documentation headers
- ✅ No type errors, acceptable lint warnings

### User Experience
- ✅ Clear visual feedback for spool selection
- ✅ Helpful messages when Spoolman disabled/misconfigured
- ✅ Responsive UI (dropdowns, colors)
- ✅ No breaking changes to existing WebUI features
- ✅ Works seamlessly in both desktop and headless modes
- ✅ Mobile-friendly layout

---

## Key Changes from Original Desktop Spec

1. **Storage**: ConfigManager (server-side) instead of localStorage (client-side only)
2. **API Layer**: REST endpoints instead of IPC handlers
3. **Component States**: Must handle disabled state explicitly (always show component)
4. **Mobile Support**: Added to WebUIMobileLayoutManager for responsive layout
5. **Headless Mode**: No Electron dependencies, fully functional without desktop app running
6. **Icons**: Use Lucide icons via `data-lucide` attributes, not emoji or text icons

---

## Implementation Checklist

### Backend
- [ ] Add Spoolman API routes to `api-routes.ts`
- [ ] Modify `SpoolmanService` for server-side state management
- [ ] Add ConfigManager integration for active spool storage
- [ ] Test headless mode compatibility
- [ ] Verify no Electron-specific code in services

### Frontend
- [ ] Add component definition to `WebUIComponentRegistry.ts`
- [ ] Create component HTML template with three states
- [ ] Add Lucide icons (package icon for disabled state)
- [ ] Add mobile layout integration in `WebUIMobileLayoutManager.ts`
- [ ] Add settings toggle in `index.html`
- [ ] Implement event handlers in `app.ts`
- [ ] Add CSS styling in `webui.css`
- [ ] Hook into context switching logic
- [ ] Add WebSocket update handling

### Testing
- [ ] Test disabled state display
- [ ] Test spool selection UI
- [ ] Test desktop ↔ WebUI sync
- [ ] Test headless mode operation
- [ ] Test multi-context switching
- [ ] Test mobile responsive layout
- [ ] Test print completion updates
- [ ] Run type checking
- [ ] Verify Lucide icons render

---

**End of Specification**

*This specification is ready for implementation. All technical details, file structures, code examples, and integration points are fully defined.*
