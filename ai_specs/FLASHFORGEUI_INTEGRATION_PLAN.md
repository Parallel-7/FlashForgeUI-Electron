# FlashForgeUI Integration Plan - HTTP API for Filament Tracking

**Target Project**: FlashForgeUI-Electron
**Integration Purpose**: Expose filament usage data via HTTP API for consumption by filament-tracker-electron
**Estimated Implementation Time**: 1-2 hours in a single session

---

## Overview

Add HTTP API endpoints to the existing Express server to expose real-time filament usage data, printer connection status, and printer state information. Enable configuration of the integration via the settings UI.

---

## Implementation Tasks

### 1. Add Configuration Settings

**File**: `src/types/config.ts`

**Changes**:
- Add new fields to `AppConfig` interface:
  ```typescript
  FilamentTrackerIntegrationEnabled: boolean;
  FilamentTrackerAPIPort: number;
  FilamentTrackerAPIKey: string; // Optional authentication
  ```
- Update `DEFAULT_CONFIG` with default values:
  ```typescript
  FilamentTrackerIntegrationEnabled: false,
  FilamentTrackerAPIPort: 3001,
  FilamentTrackerAPIKey: '',
  ```

**File**: `src/validation/config-schemas.ts`

**Changes**:
- Add Zod validation schemas for new config fields:
  ```typescript
  FilamentTrackerIntegrationEnabled: z.boolean().default(false),
  FilamentTrackerAPIPort: z.number().min(1).max(65535).default(3001),
  FilamentTrackerAPIKey: z.string().default(''),
  ```

---

### 2. Create HTTP API Routes

**New File**: `src/webui/server/filament-tracker-routes.ts`

**Purpose**: Define HTTP endpoints for filament tracking integration

**Endpoints to Implement**:

#### GET `/api/filament-tracker/status`
Returns comprehensive status including connection, printer state, and current job info.

**Response**:
```json
{
  "success": true,
  "data": {
    "isConnected": true,
    "printerName": "FlashForge Adventurer 5M Pro",
    "printerState": "Printing",
    "isPrinting": true,
    "currentJob": {
      "fileName": "benchy.gcode",
      "displayName": "benchy",
      "startTime": "2025-10-01T14:30:00.000Z",
      "progress": {
        "percentage": 45,
        "currentLayer": 120,
        "totalLayers": 267,
        "timeRemaining": 135,
        "elapsedTime": 82,
        "weightUsed": 12.5,
        "lengthUsed": 4.2
      }
    }
  }
}
```

**When not connected**:
```json
{
  "success": true,
  "data": {
    "isConnected": false,
    "printerState": null,
    "isPrinting": false,
    "currentJob": null
  }
}
```

#### GET `/api/filament-tracker/current`
Returns current job filament usage only.

**Response** (when printing):
```json
{
  "success": true,
  "data": {
    "grams": 12.5,
    "meters": 4.2,
    "jobName": "benchy.gcode",
    "elapsedMinutes": 82
  }
}
```

**When not printing**:
```json
{
  "success": false,
  "error": "No active print job"
}
```

#### GET `/api/filament-tracker/lifetime`
Returns lifetime statistics.

**Response**:
```json
{
  "success": true,
  "data": {
    "totalMeters": 1250.5,
    "totalMinutes": 18420
  }
}
```

**Implementation Details**:
- Use `getPrinterPollingService()` to get current polling data
- Use `getGlobalStateTracker()` to get printer state
- Use `getConnectionStateManager()` to get connection status
- Apply authentication middleware to all routes
- Follow existing API route patterns from `api-routes.ts`

---

### 3. Create Authentication Middleware

**New File**: `src/webui/server/filament-tracker-auth.ts`

**Purpose**: Protect API endpoints with optional API key authentication

**Functionality**:
- Check if `FilamentTrackerIntegrationEnabled` is true, return 503 if disabled
- If `FilamentTrackerAPIKey` is set, validate `x-api-key` header
- Return 401 if API key doesn't match
- Allow requests to proceed if validation passes

**Implementation Pattern**:
```typescript
export function createFilamentTrackerAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    const config = getConfigManager();

    if (!config.get('FilamentTrackerIntegrationEnabled')) {
      return res.status(503).json({
        success: false,
        error: 'Filament tracker integration disabled'
      });
    }

    const apiKey = config.get('FilamentTrackerAPIKey');
    if (apiKey) {
      const providedKey = req.headers['x-api-key'];
      if (providedKey !== apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
      }
    }

    next();
  };
}
```

---

### 4. Register Routes in WebUIManager

**File**: `src/webui/server/WebUIManager.ts`

**Changes**:
- Import the new route creator: `import { createFilamentTrackerRoutes } from './filament-tracker-routes';`
- In `setupRoutes()` method (around line 178), add:
  ```typescript
  // Filament tracker integration routes
  const filamentTrackerRoutes = createFilamentTrackerRoutes();
  this.expressApp.use('/api', filamentTrackerRoutes);
  ```

---

### 5. Update Settings UI

**File**: `src/ui/settings/settings.html`

**Changes**:
Add new section in the settings UI (after WebUI settings section):

```html
<!-- Filament Tracker Integration -->
<div class="settings-section">
  <h3>Filament Tracker Integration</h3>
  <p class="settings-description">
    Enable HTTP API endpoints for integration with filament-tracker-electron application.
  </p>

  <label class="checkbox-label">
    <input type="checkbox" id="filament-tracker-enabled">
    Enable Filament Tracker Integration
  </label>

  <div class="input-group">
    <label for="filament-tracker-api-port">API Port:</label>
    <input type="number"
           id="filament-tracker-api-port"
           class="settings-input"
           min="1"
           max="65535"
           placeholder="3001">
    <span class="input-help">Port for filament tracker API (1-65535)</span>
  </div>

  <div class="input-group">
    <label for="filament-tracker-api-key">API Key (Optional):</label>
    <input type="text"
           id="filament-tracker-api-key"
           class="settings-input"
           placeholder="Leave empty for no authentication">
    <span class="input-help">Optional API key for authentication</span>
  </div>
</div>
```

---

### 6. Update Settings Renderer Logic

**File**: `src/ui/settings/settings-renderer.ts`

**Changes**:

Add initialization code in the load settings section:
```typescript
// Filament tracker integration settings
const filamentTrackerEnabled = configData.FilamentTrackerIntegrationEnabled ?? false;
const filamentTrackerPort = configData.FilamentTrackerAPIPort ?? 3001;
const filamentTrackerKey = configData.FilamentTrackerAPIKey ?? '';

document.getElementById('filament-tracker-enabled')!.checked = filamentTrackerEnabled;
document.getElementById('filament-tracker-api-port')!.value = filamentTrackerPort.toString();
document.getElementById('filament-tracker-api-key')!.value = filamentTrackerKey;
```

Add save logic in the save settings section:
```typescript
// Filament tracker integration
const filamentTrackerEnabled = document.getElementById('filament-tracker-enabled')!.checked;
const filamentTrackerPort = parseInt(
  document.getElementById('filament-tracker-api-port')!.value, 10
);
const filamentTrackerKey = document.getElementById('filament-tracker-api-key')!.value.trim();

updates.FilamentTrackerIntegrationEnabled = filamentTrackerEnabled;
updates.FilamentTrackerAPIPort = filamentTrackerPort;
updates.FilamentTrackerAPIKey = filamentTrackerKey;
```

Add validation:
```typescript
// Validate filament tracker API port
if (filamentTrackerPort < 1 || filamentTrackerPort > 65535) {
  validationErrors.push('Filament Tracker API port must be between 1 and 65535');
}
```

---

### 7. Add Documentation Headers

**New Files Created**:
- `src/webui/server/filament-tracker-routes.ts`
- `src/webui/server/filament-tracker-auth.ts`

**Documentation Template**:
```typescript
/**
 * @fileoverview HTTP API routes for filament tracker integration.
 *
 * Exposes real-time filament usage data, printer connection status, and printer state
 * information via HTTP endpoints for consumption by external applications like
 * filament-tracker-electron. Routes are protected by optional API key authentication
 * and can be enabled/disabled via application settings.
 *
 * Endpoints:
 * - GET /api/filament-tracker/status - Comprehensive status and current job info
 * - GET /api/filament-tracker/current - Current job filament usage only
 * - GET /api/filament-tracker/lifetime - Lifetime filament statistics
 */
```

---

## Testing Checklist

After implementation, verify:

1. **Configuration**:
   - [ ] Settings appear correctly in settings UI
   - [ ] Settings persist after restart
   - [ ] Default values are applied correctly
   - [ ] Validation works for port numbers

2. **API Endpoints** (when integration enabled):
   - [ ] `/api/filament-tracker/status` returns correct data when connected
   - [ ] `/api/filament-tracker/status` returns `isConnected: false` when disconnected
   - [ ] `/api/filament-tracker/current` returns usage data during active print
   - [ ] `/api/filament-tracker/current` returns error when not printing
   - [ ] `/api/filament-tracker/lifetime` returns cumulative statistics
   - [ ] All endpoints return proper JSON structure

3. **Authentication**:
   - [ ] Endpoints return 503 when integration is disabled
   - [ ] Endpoints allow access when no API key is set
   - [ ] Endpoints return 401 when API key is set but missing in request
   - [ ] Endpoints return 401 when API key is incorrect
   - [ ] Endpoints allow access when API key is correct

4. **Integration Testing**:
   - [ ] Test with curl/Postman to verify responses
   - [ ] Verify data accuracy matches UI display
   - [ ] Test during different printer states (ready, printing, paused, etc.)
   - [ ] Verify behavior when printer disconnects mid-print

---

## Example curl Commands for Testing

```bash
# Test status endpoint (no auth)
curl http://localhost:3001/api/filament-tracker/status

# Test status endpoint (with API key)
curl -H "x-api-key: your-secret-key" http://localhost:3001/api/filament-tracker/status

# Test current job endpoint
curl http://localhost:3001/api/filament-tracker/current

# Test lifetime statistics endpoint
curl http://localhost:3001/api/filament-tracker/lifetime
```

---

## Notes

- The API uses the same port as the existing WebUI server (default 3000, configurable)
- The new `FilamentTrackerAPIPort` setting is actually redundant since it uses the WebUI port - consider removing it or clarifying in the UI that it displays the WebUI port
- API endpoints only work when WebUI is enabled and printer is connected
- Authentication is optional - leave API key blank for no authentication
- All data comes from existing polling services, no new data collection needed
- Follow the project's documentation standards - add `@fileoverview` headers to all new files
- Run `npm run docs:check` after implementation to verify documentation

---

## Port Configuration Clarification

**IMPORTANT**: The API endpoints will run on the **same port as the WebUI** (configured via `WebUIPort` setting). The `FilamentTrackerAPIPort` setting in this plan should either:

**Option A** (Recommended): Remove `FilamentTrackerAPIPort` entirely and just use the existing `WebUIPort`
- Simpler configuration
- Less user confusion
- One port to manage

**Option B**: Keep `FilamentTrackerAPIPort` as a display-only field that mirrors `WebUIPort`
- Shows users which port to configure in filament-tracker-electron
- Helpful reminder but potentially confusing

**Recommendation**: Go with **Option A** and update the settings UI to clearly indicate that the integration uses the WebUI port. Update the filament-tracker-electron settings to ask for the "FlashForgeUI Web Port" instead.

---

## Implementation Order

1. Add configuration types and schemas (Task 1)
2. Create authentication middleware (Task 3)
3. Create API routes (Task 2)
4. Register routes in WebUIManager (Task 4)
5. Update settings UI and renderer (Tasks 5-6)
6. Add documentation headers (Task 7)
7. Test all endpoints and settings (Testing Checklist)

---

## Success Criteria

✅ All three API endpoints return correct data
✅ Settings UI allows enabling/disabling integration
✅ Optional API key authentication works correctly
✅ Integration gracefully handles disconnected printer state
✅ All new files have proper `@fileoverview` documentation
✅ `npm run docs:check` shows no new missing documentation
✅ Manual testing with curl confirms all endpoints work

---

**Ready to implement in FlashForgeUI-Electron workspace!**
