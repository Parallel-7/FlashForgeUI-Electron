# RTSP Stream Configuration Settings

**Feature Specification**
**Created:** 2025-10-05
**Status:** Ready for Implementation
**Complexity:** Medium
**Estimated Time:** 2-3 hours

---

## Overview

Add user-configurable RTSP stream settings (frame rate and quality) to the per-printer settings system. Currently, RTSP streams use hardcoded values (30 FPS, quality 3). This enhancement allows users to customize these settings per printer for optimal performance based on their network conditions and quality preferences.

---

## Current State

### Hardcoded Values in `RtspStreamService.ts:204-205`
```typescript
ffmpegOptions: {
  '-nostats': '',
  '-loglevel': 'quiet',
  '-r': 30,              // ← Hardcoded: 30 fps
  '-q:v': '3'            // ← Hardcoded: quality 3 (1-5 scale, lower=better)
}
```

### Integration Points
**File:** `src/ipc/camera-ipc-handler.ts`

**Line 213** (camera config updated):
```typescript
await this.rtspStreamService.setupStream(contextId, config.streamUrl);
```

**Line 317** (setup camera for context):
```typescript
await this.rtspStreamService.setupStream(contextId, config.streamUrl);
```

### Per-Printer Settings Pattern
Settings are already per-printer for `customCameraEnabled`, `customCameraUrl`, `customLedsEnabled`, and `forceLegacyMode`. RTSP settings will follow the same pattern.

---

## Requirements

### Functional Requirements
1. Add frame rate setting (1-60 FPS, default: 30)
2. Add quality setting (1-5, default: 3, where 1=best quality, 5=lowest)
3. Settings stored per-printer in `printer_details.json`
4. Settings apply on next RTSP stream connection (no live reload)
5. Undefined settings automatically use defaults (30 FPS, quality 3)
6. Settings only appear/work when printer is connected

### Non-Functional Requirements
- Maintain backward compatibility with existing printer configs
- Follow existing per-printer settings patterns
- Minimal UI complexity (no presets, no live preview)
- Type-safe implementation with validation

---

## Implementation Plan

### 1. Type System Updates

#### **File:** `src/types/printer.ts`

**Location:** After line 45 (after `forceLegacyMode?: boolean;`)

```typescript
export interface PrinterDetails {
  // ... existing fields ...

  // RTSP streaming settings (per-printer)
  rtspFrameRate?: number;    // 1-60 fps, default: 30
  rtspQuality?: number;       // 1-5 (1=best, 5=worst), default: 3
}
```

#### **File:** `src/ipc/handlers/printer-settings-handlers.ts`

**Location:** After line 19 (after `forceLegacyMode?: boolean;`)

```typescript
export interface PrinterSettings {
  customCameraEnabled?: boolean;
  customCameraUrl?: string;
  customLedsEnabled?: boolean;
  forceLegacyMode?: boolean;

  // RTSP configuration
  rtspFrameRate?: number;
  rtspQuality?: number;
}
```

---

### 2. Service Layer Changes

#### **File:** `src/services/RtspStreamService.ts`

**Update setupStream signature** (line 177):

```typescript
/**
 * Setup RTSP stream for a context
 *
 * @param contextId - Context ID for this stream
 * @param rtspUrl - RTSP stream URL
 * @param options - Optional stream configuration (frame rate, quality)
 * @returns WebSocket port for client connection
 */
public async setupStream(
  contextId: string,
  rtspUrl: string,
  options?: {
    frameRate?: number;
    quality?: number;
  }
): Promise<number> {
  if (!this.ffmpegStatus?.available) {
    throw new Error('ffmpeg not available - cannot setup RTSP stream');
  }

  console.log(`[RtspStreamService] Setting up RTSP stream for context ${contextId}: ${rtspUrl}`);

  // If stream already exists for this context, stop it first
  if (this.streams.has(contextId)) {
    console.log(`[RtspStreamService] Stopping existing stream for context ${contextId}`);
    await this.stopStream(contextId);
  }

  // Check if we've hit the maximum number of streams
  if (this.streams.size >= this.MAX_STREAMS) {
    throw new Error(`Maximum number of concurrent streams (${this.MAX_STREAMS}) reached`);
  }

  // Allocate a unique WebSocket port for this stream
  const wsPort = this.allocatePort();

  // Get settings with defaults
  const frameRate = options?.frameRate ?? 30;
  const quality = options?.quality ?? 3;

  console.log(`[RtspStreamService] Stream settings: ${frameRate} FPS, quality ${quality}`);

  try {
    // Create node-rtsp-stream instance
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const stream = new StreamConstructor({
      name: contextId,
      streamUrl: rtspUrl,
      wsPort,
      ffmpegOptions: {
        '-nostats': '',
        '-loglevel': 'quiet',
        '-r': String(frameRate),    // Use configurable frame rate
        '-q:v': String(quality)      // Use configurable quality
      }
    });

    // ... rest of method unchanged
```

**Update JSDoc comment** (line 20):
```typescript
// Setup RTSP stream for a context
const wsPort = await service.setupStream(contextId, rtspUrl, { frameRate: 30, quality: 3 });
```

---

### 3. Integration Layer Changes

#### **File:** `src/ipc/camera-ipc-handler.ts`

**Update line 213** (handleCameraConfigUpdated):

```typescript
// Handle based on stream type
if (config.streamType === 'rtsp') {
  try {
    // Get RTSP settings from printer details
    const { rtspFrameRate, rtspQuality } = context.printerDetails;

    await this.rtspStreamService.setupStream(contextId, config.streamUrl, {
      frameRate: rtspFrameRate,
      quality: rtspQuality
    });
    console.log(`[CameraIPC] RTSP stream setup for context ${contextId}`);
  } catch (error) {
    console.warn(`[CameraIPC] Failed to setup RTSP stream for context ${contextId}:`, error);
  }
```

**Update line 317** (setupCameraForContext):

```typescript
if (config.streamType === 'rtsp') {
  // RTSP: Setup stream for desktop JSMpeg player
  try {
    // Get RTSP settings from printer details
    const { rtspFrameRate, rtspQuality } = context.printerDetails;

    await this.rtspStreamService.setupStream(contextId, config.streamUrl, {
      frameRate: rtspFrameRate,
      quality: rtspQuality
    });
    console.log(`RTSP stream setup for context ${contextId}`);
  } catch (error) {
    console.warn(`Failed to setup RTSP stream for context ${contextId}:`, error);
```

---

### 4. Settings UI Updates

#### **File:** `src/ui/settings/settings.html`

**Location:** Add new section in Column 3, after the "Rounded UI" section (after line 114)

```html
<!-- RTSP Stream Configuration -->
<div class="settings-section" style="margin-top: 20px;">
  <h4 style="font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #666;">
    RTSP Stream Configuration
  </h4>
  <div class="settings-info-text" style="margin-bottom: 15px;">
    Settings for RTSP camera streams. Only applies to RTSP URLs (rtsp://...).
    Changes take effect on next connection.
  </div>

  <div class="input-group">
    <label for="rtsp-frame-rate">Frame Rate (FPS):</label>
    <input type="number" id="rtsp-frame-rate" class="settings-input" min="1" max="60" value="30">
  </div>
  <div class="settings-info-text">
    1-60 fps (default: 30). Lower values reduce bandwidth usage.
  </div>

  <div class="input-group">
    <label for="rtsp-quality">Quality (1-5):</label>
    <input type="number" id="rtsp-quality" class="settings-input" min="1" max="5" value="3">
  </div>
  <div class="settings-info-text">
    1 = best quality (larger file size), 5 = lowest quality (default: 3).
  </div>
</div>
```

#### **File:** `src/ui/settings/settings-renderer.ts`

**Update INPUT_TO_CONFIG_MAP** (after line 84):

```typescript
const INPUT_TO_CONFIG_MAP: Record<string, keyof AppConfig> = {
  'web-ui': 'WebUIEnabled',
  'web-ui-port': 'WebUIPort',
  'web-ui-password': 'WebUIPassword',
  'camera-proxy-port': 'CameraProxyPort',
  'discord-sync': 'DiscordSync',
  'always-on-top': 'AlwaysOnTop',
  'alert-when-complete': 'AlertWhenComplete',
  'alert-when-cooled': 'AlertWhenCooled',
  'audio-alerts': 'AudioAlerts',
  'visual-alerts': 'VisualAlerts',
  'debug-mode': 'DebugMode',
  'webhook-url': 'WebhookUrl',
  'custom-camera': 'CustomCamera',
  'custom-camera-url': 'CustomCameraUrl',
  'custom-leds': 'CustomLeds',
  'force-legacy-api': 'ForceLegacyAPI',
  'discord-update-interval': 'DiscordUpdateIntervalMinutes',
  'rounded-ui': 'RoundedUI',
  'rtsp-frame-rate': 'RtspFrameRate',      // Add this
  'rtsp-quality': 'RtspQuality'            // Add this
};
```

**Update isPerPrinterSetting()** (line 406):

```typescript
private isPerPrinterSetting(configKey: keyof AppConfig): boolean {
  return [
    'CustomCamera',
    'CustomCameraUrl',
    'CustomLeds',
    'ForceLegacyAPI',
    'RtspFrameRate',     // Add this
    'RtspQuality'        // Add this
  ].includes(configKey);
}
```

**Update configKeyToPerPrinterKey()** (line 413):

```typescript
private configKeyToPerPrinterKey(configKey: keyof AppConfig): string {
  const map: Record<string, string> = {
    'CustomCamera': 'customCameraEnabled',
    'CustomCameraUrl': 'customCameraUrl',
    'CustomLeds': 'customLedsEnabled',
    'ForceLegacyAPI': 'forceLegacyMode',
    'RtspFrameRate': 'rtspFrameRate',      // Add this
    'RtspQuality': 'rtspQuality'           // Add this
  };
  return map[configKey] || configKey;
}
```

**Add validation in handleInputChange()** (after line 258):

```typescript
} else if (input.type === 'number') {
  value = parseInt(input.value) || 0;
  // Validate port numbers
  if (configKey === 'WebUIPort' || configKey === 'CameraProxyPort') {
    if (value < 1 || value > 65535) {
      this.showSaveStatus('Invalid port number (1-65535)', true);
      return;
    }
  }
  // Validate RTSP frame rate
  if (configKey === 'RtspFrameRate') {
    if (value < 1 || value > 60) {
      this.showSaveStatus('Frame rate must be between 1-60 FPS', true);
      return;
    }
  }
  // Validate RTSP quality
  if (configKey === 'RtspQuality') {
    if (value < 1 || value > 5) {
      this.showSaveStatus('Quality must be between 1-5', true);
      return;
    }
  }
}
```

---

### 5. Type System Compatibility

#### **File:** `src/types/config.ts`

**Add placeholder properties to AppConfig** (after line 47):

**Note:** These are added to AppConfig for settings UI compatibility even though they're per-printer settings. They won't be saved to config.json.

```typescript
export interface AppConfig {
  readonly DiscordSync: boolean;
  readonly AlwaysOnTop: boolean;
  readonly AlertWhenComplete: boolean;
  readonly AlertWhenCooled: boolean;
  readonly AudioAlerts: boolean;
  readonly VisualAlerts: boolean;
  readonly DebugMode: boolean;
  readonly WebhookUrl: string;
  readonly CustomCamera: boolean;
  readonly CustomCameraUrl: string;
  readonly CustomLeds: boolean;
  readonly ForceLegacyAPI: boolean;
  readonly DiscordUpdateIntervalMinutes: number;
  readonly WebUIEnabled: boolean;
  readonly WebUIPort: number;
  readonly WebUIPassword: string;
  readonly CameraProxyPort: number;
  readonly RoundedUI: boolean;
  readonly RtspFrameRate: number;        // Add this (per-printer, not saved to config.json)
  readonly RtspQuality: number;          // Add this (per-printer, not saved to config.json)
}
```

**Update MutableAppConfig** (after line 73):

```typescript
export interface MutableAppConfig {
  DiscordSync: boolean;
  AlwaysOnTop: boolean;
  AlertWhenComplete: boolean;
  AlertWhenCooled: boolean;
  AudioAlerts: boolean;
  VisualAlerts: boolean;
  DebugMode: boolean;
  WebhookUrl: string;
  CustomCamera: boolean;
  CustomCameraUrl: string;
  CustomLeds: boolean;
  ForceLegacyAPI: boolean;
  DiscordUpdateIntervalMinutes: number;
  WebUIEnabled: boolean;
  WebUIPort: number;
  WebUIPassword: string;
  CameraProxyPort: number;
  RoundedUI: boolean;
  RtspFrameRate: number;        // Add this
  RtspQuality: number;          // Add this
}
```

**Update DEFAULT_CONFIG** (after line 99):

```typescript
export const DEFAULT_CONFIG: AppConfig = {
  DiscordSync: false,
  AlwaysOnTop: false,
  AlertWhenComplete: true,
  AlertWhenCooled: true,
  AudioAlerts: true,
  VisualAlerts: true,
  DebugMode: false,
  WebhookUrl: '',
  CustomCamera: false,
  CustomCameraUrl: '',
  CustomLeds: false,
  ForceLegacyAPI: false,
  DiscordUpdateIntervalMinutes: 5,
  WebUIEnabled: false,
  WebUIPort: 3000,
  WebUIPassword: 'changeme',
  CameraProxyPort: 8181,
  RoundedUI: false,
  RtspFrameRate: 30,           // Add this (default 30 FPS)
  RtspQuality: 3               // Add this (default quality 3)
} as const;
```

---

## Validation Rules

### Frame Rate
- **Type:** Integer
- **Range:** 1-60
- **Default:** 30
- **Error Message:** "Frame rate must be between 1-60 FPS"

### Quality
- **Type:** Integer
- **Range:** 1-5 (1=best quality, 5=lowest quality)
- **Default:** 3
- **Error Message:** "Quality must be between 1-5"

---

## Default Behavior

1. **Undefined settings:** Automatically use defaults (30 FPS, quality 3)
2. **Existing printers:** No migration needed, defaults apply automatically
3. **Settings persistence:** Saved to `printer_details.json` per printer
4. **Application timing:** Settings apply on next RTSP stream setup (not live)
5. **UI behavior:** Settings only editable when printer is connected

---

## Testing Checklist

### Unit Testing
- [ ] Verify `setupStream` accepts optional parameters
- [ ] Verify defaults (30 FPS, quality 3) when options not provided
- [ ] Verify ffmpegOptions built correctly with custom settings
- [ ] Verify settings validation in UI (1-60 FPS, 1-5 quality)

### Integration Testing
- [ ] Connect to printer with RTSP camera
- [ ] Verify settings load from printer_details.json
- [ ] Modify frame rate, save, reconnect → verify applied
- [ ] Modify quality, save, reconnect → verify applied
- [ ] Test with undefined settings → verify defaults used
- [ ] Verify settings persist across app restarts
- [ ] Test validation errors for out-of-range values

### Edge Cases
- [ ] No printer connected → settings disabled/default
- [ ] Switch between printers → correct settings loaded
- [ ] MJPEG camera → RTSP settings ignored
- [ ] Invalid values in printer_details.json → defaults used

---

## Migration Strategy

### Backward Compatibility
- **Existing configs:** No migration needed
- **Missing settings:** Automatically use hardcoded defaults
- **Data format:** Backward compatible with existing printer_details.json

### Rollout
1. Add optional fields to types (backward compatible)
2. Update service layer with optional parameters
3. Update integration points to pass settings
4. Add UI controls
5. Deploy → existing installations work unchanged

---

## Future Enhancements (Out of Scope)

- Bitrate configuration (`-b:v`)
- Encoding preset (`-preset ultrafast|fast|medium`)
- Tune for latency (`-tune zerolatency`)
- Resolution override (`-s 1280x720`)
- Audio settings (currently disabled)
- Live preview of setting changes
- Quality presets (Low/Medium/High buttons)
- Stream restart on settings change (currently requires reconnect)

---

## Files Changed Summary

| File | Change Type | Lines Modified |
|------|-------------|----------------|
| `src/types/printer.ts` | Type addition | +3 lines (after 45) |
| `src/ipc/handlers/printer-settings-handlers.ts` | Type addition | +4 lines (after 19) |
| `src/services/RtspStreamService.ts` | Signature change | ~30 lines (177-210) |
| `src/ipc/camera-ipc-handler.ts` | Integration update | ~16 lines (213, 317) |
| `src/ui/settings/settings.html` | UI addition | ~25 lines (after 114) |
| `src/ui/settings/settings-renderer.ts` | Logic update | ~20 lines (84, 258, 406, 413) |
| `src/types/config.ts` | Type compatibility | +6 lines (47, 73, 99) |

**Total:** ~7 files, ~100 lines of code

---

## Implementation Notes

1. **Settings routing:** The settings-renderer already handles per-printer vs. global settings routing. RTSP settings will automatically route to `printer_details.json`.

2. **Context access pattern:** Use `context.printerDetails` to access settings (see camera-ipc-handler.ts:306 for reference).

3. **Optional chaining:** Always use optional chaining when accessing RTSP settings since they may be undefined.

4. **Logging:** Include frame rate and quality in log messages for debugging.

5. **Type safety:** TypeScript will catch missing properties at compile time.

---

## Success Criteria

- [ ] User can configure frame rate (1-60 FPS) per printer
- [ ] User can configure quality (1-5) per printer
- [ ] Settings persist in printer_details.json
- [ ] Settings apply on next RTSP connection
- [ ] Defaults work for printers without explicit settings
- [ ] UI validation prevents invalid values
- [ ] No regression in existing RTSP functionality
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)

---

## Questions / Decisions

**Q:** Should settings apply immediately (restart stream) or on next connection?
**A:** On next connection (simpler, no disruption to active streams)

**Q:** Should these be global or per-printer settings?
**A:** Per-printer (different printers may have different network conditions)

**Q:** Should we add bitrate configuration?
**A:** Not initially. Can be added as future enhancement if needed.

**Q:** What about validation of ffmpeg options?
**A:** Basic range validation in UI. ffmpeg will handle invalid values gracefully.

---

**End of Specification**
