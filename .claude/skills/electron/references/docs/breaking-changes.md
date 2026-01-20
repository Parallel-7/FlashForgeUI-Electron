# Source: https://www.electronjs.org/docs/latest/breaking-changes

On this page

Breaking changes will be documented here, and deprecation warnings added to JS code where possible, at least [one major version](/docs/latest/tutorial/electron-versioning#semver) before the change is made.

### Types of Breaking Changes[â](#types-of-breaking-changes "Direct link to Types of Breaking Changes")

This document uses the following convention to categorize breaking changes:

* **API Changed:** An API was changed in such a way that code that has not been updated is guaranteed to throw an exception.
* **Behavior Changed:** The behavior of Electron has changed, but not in such a way that an exception will necessarily be thrown.
* **Default Changed:** Code depending on the old default may break, not necessarily throwing an exception. The old behavior can be restored by explicitly specifying the value.
* **Deprecated:** An API was marked as deprecated. The API will continue to function, but will emit a deprecation warning, and will be removed in a future release.
* **Removed:** An API or feature was removed, and is no longer supported by Electron.

## Planned Breaking API Changes (40.0)[â](#planned-breaking-api-changes-400 "Direct link to Planned Breaking API Changes (40.0)")

### Deprecated: `clipboard` API access from renderer processes[â](#deprecated-clipboard-api-access-from-renderer-processes "Direct link to deprecated-clipboard-api-access-from-renderer-processes")

Using the `clipboard` API directly in the renderer process is deprecated.
If you want to call this API from a renderer process, place the API call in
your preload script and expose it using the [contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge) API.

### Behavior Changed: MacOS dSYM files now compressed with tar.xz[â](#behavior-changed-macos-dsym-files-now-compressed-with-tarxz "Direct link to Behavior Changed: MacOS dSYM files now compressed with tar.xz")

Debug symbols for MacOS (dSYM) now use xz compression in order to handle larger file sizes. `dsym.zip` files are now
`dsym.tar.xz` files. End users using debug symbols may need to update their zip utilities.

## Planned Breaking API Changes (39.0)[â](#planned-breaking-api-changes-390 "Direct link to Planned Breaking API Changes (39.0)")

### Deprecated: `--host-rules` command line switch[â](#deprecated---host-rules-command-line-switch "Direct link to deprecated---host-rules-command-line-switch")

Chromium is deprecating the `--host-rules` switch.

You should use `--host-resolver-rules` instead.

### Behavior Changed: window.open popups are always resizable[â](#behavior-changed-windowopen-popups-are-always-resizable "Direct link to Behavior Changed: window.open popups are always resizable")

Per current [WHATWG spec](https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-open-dev), the `window.open` API will now always create a resizable popup window.

To restore previous behavior:

```
webContents.setWindowOpenHandler((details) => {
return {
action: 'allow',
overrideBrowserWindowOptions: {
resizable: details.features.includes('resizable=yes')
}
}
})
```

### Behavior Changed: shared texture OSR `paint` event data structure[â](#behavior-changed-shared-texture-osr-paint-event-data-structure "Direct link to behavior-changed-shared-texture-osr-paint-event-data-structure")

When using shared texture offscreen rendering feature, the `paint` event now emits a more structured object.
It moves the `sharedTextureHandle`, `planes`, `modifier` into a unified `handle` property.
See the [OffscreenSharedTexture](/docs/latest/api/structures/offscreen-shared-texture) API structure for more details.

## Planned Breaking API Changes (38.0)[â](#planned-breaking-api-changes-380 "Direct link to Planned Breaking API Changes (38.0)")

### Removed: `ELECTRON_OZONE_PLATFORM_HINT` environment variable[â](#removed-electron_ozone_platform_hint-environment-variable "Direct link to removed-electron_ozone_platform_hint-environment-variable")

The default value of the `--ozone-platform` flag [changed to `auto`](https://chromium-review.googlesource.com/c/chromium/src/+/6775426).

Electron now defaults to running as a native Wayland app when launched in a Wayland session (when `XDG_SESSION_TYPE=wayland`).
Users can force XWayland by passing `--ozone-platform=x11`.

### Removed: `ORIGINAL_XDG_CURRENT_DESKTOP` environment variable[â](#removed-original_xdg_current_desktop-environment-variable "Direct link to removed-original_xdg_current_desktop-environment-variable")

Previously, Electron changed the value of `XDG_CURRENT_DESKTOP` internally to `Unity`, and stored the original name of the desktop session
in a separate variable. `XDG_CURRENT_DESKTOP` is no longer overriden and now reflects the actual desktop environment.

### Removed: macOS 11 support[â](#removed-macos-11-support "Direct link to Removed: macOS 11 support")

macOS 11 (Big Sur) is no longer supported by [Chromium](https://chromium-review.googlesource.com/c/chromium/src/+/6594615).

Older versions of Electron will continue to run on Big Sur, but macOS 12 (Monterey)
or later will be required to run Electron v38.0.0 and higher.

### Removed: `plugin-crashed` event[â](#removed-plugin-crashed-event "Direct link to removed-plugin-crashed-event")

The `plugin-crashed` event has been removed from `webContents`.

### Deprecated: `webFrame.routingId` property[â](#deprecated-webframeroutingid-property "Direct link to deprecated-webframeroutingid-property")

The `routingId` property will be removed from `webFrame` objects.

You should use `webFrame.frameToken` instead.

### Deprecated: `webFrame.findFrameByRoutingId(routingId)`[â](#deprecated-webframefindframebyroutingidroutingid "Direct link to deprecated-webframefindframebyroutingidroutingid")

The `webFrame.findFrameByRoutingId(routingId)` function will be removed.

You should use `webFrame.findFrameByToken(frameToken)` instead.

## Planned Breaking API Changes (37.0)[â](#planned-breaking-api-changes-370 "Direct link to Planned Breaking API Changes (37.0)")

### Utility Process unhandled rejection behavior change[â](#utility-process-unhandled-rejection-behavior-change "Direct link to Utility Process unhandled rejection behavior change")

Utility Processes will now warn with an error message when an unhandled
rejection occurs instead of crashing the process.

To restore the previous behavior, you can use:

```
process.on('unhandledRejection', () => {
process.exit(1)
})
```

### Behavior Changed: `process.exit()` kills utility process synchronously[â](#behavior-changed-processexit-kills-utility-process-synchronously "Direct link to behavior-changed-processexit-kills-utility-process-synchronously")

Calling `process.exit()` in a utility process will now kill the utility process synchronously.
This brings the behavior of `process.exit()` in line with Node.js behavior.

Please refer to the
[Node.js docs](https://nodejs.org/docs/latest-v22.x/api/process.html#processexitcode) and
[PR #45690](https://github.com/electron/electron/pull/45690) to understand the potential
implications of that, e.g., when calling `console.log()` before `process.exit()`.

### Behavior Changed: WebUSB and WebSerial Blocklist Support[â](#behavior-changed-webusb-and-webserial-blocklist-support "Direct link to Behavior Changed: WebUSB and WebSerial Blocklist Support")

[WebUSB](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API) and [Web Serial](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) now support the [WebUSB Blocklist](https://wicg.github.io/webusb/#blocklist) and [Web Serial Blocklist](https://wicg.github.io/serial/#blocklist) used by Chromium and outlined in their respective specifications.

To disable these, users can pass `disable-usb-blocklist` and `disable-serial-blocklist` as command line flags.

### Removed: `null` value for `session` property in `ProtocolResponse`[â](#removed-null-value-for-session-property-in-protocolresponse "Direct link to removed-null-value-for-session-property-in-protocolresponse")

This deprecated feature has been removed.

Previously, setting the `ProtocolResponse.session` property to `null`
would create a random independent session. This is no longer supported.

Using single-purpose sessions here is discouraged due to overhead costs;
however, old code that needs to preserve this behavior can emulate it by
creating a random session with `session.fromPartition(some_random_string)`
and then using it in `ProtocolResponse.session`.

### Behavior Changed: `BrowserWindow.IsVisibleOnAllWorkspaces()` on Linux[â](#behavior-changed-browserwindowisvisibleonallworkspaces-on-linux "Direct link to behavior-changed-browserwindowisvisibleonallworkspaces-on-linux")

`BrowserWindow.IsVisibleOnAllWorkspaces()` will now return false on Linux if the
window is not currently visible.

## Planned Breaking API Changes (36.0)[â](#planned-breaking-api-changes-360 "Direct link to Planned Breaking API Changes (36.0)")

### Behavior Changes: `app.commandLine`[â](#behavior-changes-appcommandline "Direct link to behavior-changes-appcommandline")

`app.commandLine` will convert upper-cases switches and arguments to lowercase.

`app.commandLine` was only meant to handle chromium switches (which aren't case-sensitive) and switches passed via `app.commandLine` will not be passed down to any of the child processes.

If you were using `app.commandLine` to control the behavior of the main process, you should do this via `process.argv`.

### Deprecated: `NativeImage.getBitmap()`[â](#deprecated-nativeimagegetbitmap "Direct link to deprecated-nativeimagegetbitmap")

`NativeImage.toBitmap()` returns a newly-allocated copy of the bitmap. `NativeImage.getBitmap()` was originally an alternative function that returned the original instead of a copy. This changed when sandboxing was introduced, so both return a copy and are functionally equivalent.

Client code should call `NativeImage.toBitmap()` instead:

```
// Deprecated
bitmap = image.getBitmap()
// Use this instead
bitmap = image.toBitmap()
```

### Removed: `isDefault` and `status` properties on `PrinterInfo`[â](#removed-isdefault-and-status-properties-on-printerinfo "Direct link to removed-isdefault-and-status-properties-on-printerinfo")

These properties have been removed from the PrinterInfo Object
because they have been removed from upstream Chromium.

### Removed: `quota` type `syncable` in `Session.clearStorageData(options)`[â](#removed-quota-type-syncable-in-sessionclearstoragedataoptions "Direct link to removed-quota-type-syncable-in-sessionclearstoragedataoptions")

When calling `Session.clearStorageData(options)`, the `options.quota` type
`syncable` is no longer supported because it has been
[removed](https://chromium-review.googlesource.com/c/chromium/src/+/6309405)
from upstream Chromium.

### Deprecated: `null` value for `session` property in `ProtocolResponse`[â](#deprecated-null-value-for-session-property-in-protocolresponse "Direct link to deprecated-null-value-for-session-property-in-protocolresponse")

Previously, setting the ProtocolResponse.session property to `null`
Would create a random independent session. This is no longer supported.

Using single-purpose sessions here is discouraged due to overhead costs;
however, old code that needs to preserve this behavior can emulate it by
creating a random session with `session.fromPartition(some_random_string)`
and then using it in `ProtocolResponse.session`.

### Deprecated: `quota` property in `Session.clearStorageData(options)`[â](#deprecated-quota-property-in-sessionclearstoragedataoptions "Direct link to deprecated-quota-property-in-sessionclearstoragedataoptions")

When calling `Session.clearStorageData(options)`, the `options.quota`
property is deprecated. Since the `syncable` type was removed, there
is only type left -- `'temporary'` -- so specifying it is unnecessary.

### Deprecated: Extension methods and events on `session`[â](#deprecated-extension-methods-and-events-on-session "Direct link to deprecated-extension-methods-and-events-on-session")

`session.loadExtension`, `session.removeExtension`, `session.getExtension`,
`session.getAllExtensions`, 'extension-loaded' event, 'extension-unloaded'
event, and 'extension-ready' events have all moved to the new
`session.extensions` class.

### Removed: `systemPreferences.isAeroGlassEnabled()`[â](#removed-systempreferencesisaeroglassenabled "Direct link to removed-systempreferencesisaeroglassenabled")

The `systemPreferences.isAeroGlassEnabled()` function has been removed without replacement.
It has been always returning `true` since Electron 23, which only supports Windows 10+, where DWM composition can no longer be disabled.

<https://learn.microsoft.com/en-us/windows/win32/dwm/composition-ovw#disabling-dwm-composition-windows7-and-earlier>

### Changed: GTK 4 is default when running GNOME[â](#changed-gtk-4-is-default-when-running-gnome "Direct link to Changed: GTK 4 is default when running GNOME")

After an [upstream change](https://chromium-review.googlesource.com/c/chromium/src/+/6310469), GTK 4 is now the default when running GNOME.

In rare cases, this may cause some applications or configurations to [error](https://github.com/electron/electron/issues/46538) with the following message:

```
Gtk-ERROR **: 11:30:38.382: GTK 2/3 symbols detected. Using GTK 2/3 and GTK 4 in the same process is not supported
```

Affected users can work around this by specifying the `gtk-version` command-line flag:

```
$ electron --gtk-version=3   # or --gtk-version=2
```

The same can be done with the [`app.commandLine.appendSwitch`](https://www.electronjs.org/docs/latest/api/command-line#commandlineappendswitchswitch-value) function.

## Planned Breaking API Changes (35.0)[â](#planned-breaking-api-changes-350 "Direct link to Planned Breaking API Changes (35.0)")

### Behavior Changed: Dialog API's `defaultPath` option on Linux[â](#behavior-changed-dialog-apis-defaultpath-option-on-linux "Direct link to behavior-changed-dialog-apis-defaultpath-option-on-linux")

On Linux, the required portal version for file dialogs has been reverted
to 3 from 4. Using the `defaultPath` option of the Dialog API is not
supported when using portal file chooser dialogs unless the portal
backend is version 4 or higher. The `--xdg-portal-required-version`
[command-line switch](/docs/latest/api/command-line-switches#--xdg-portal-required-versionversion)
can be used to force a required version for your application.
See [#44426](https://github.com/electron/electron/pull/44426) for more details.

### Deprecated: `getFromVersionID` on `session.serviceWorkers`[â](#deprecated-getfromversionid-on-sessionserviceworkers "Direct link to deprecated-getfromversionid-on-sessionserviceworkers")

The `session.serviceWorkers.fromVersionID(versionId)` API has been deprecated
in favor of `session.serviceWorkers.getInfoFromVersionID(versionId)`. This was
changed to make it more clear which object is returned with the introduction
of the `session.serviceWorkers.getWorkerFromVersionID(versionId)` API.

```
// Deprecated
session.serviceWorkers.fromVersionID(versionId)

// Replace with
session.serviceWorkers.getInfoFromVersionID(versionId)
```

### Deprecated: `setPreloads`, `getPreloads` on `Session`[â](#deprecated-setpreloads-getpreloads-on-session "Direct link to deprecated-setpreloads-getpreloads-on-session")

`registerPreloadScript`, `unregisterPreloadScript`, and `getPreloadScripts` are introduced as a
replacement for the deprecated methods. These new APIs allow third-party libraries to register
preload scripts without replacing existing scripts. Also, the new `type` option allows for
additional preload targets beyond `frame`.

```
// Deprecated
session.setPreloads([path.join(__dirname, 'preload.js')])

// Replace with:
session.registerPreloadScript({
type: 'frame',
id: 'app-preload',
filePath: path.join(__dirname, 'preload.js')
})
```

### Deprecated: `level`, `message`, `line`, and `sourceId` arguments in `console-message` event on `WebContents`[â](#deprecated-level-message-line-and-sourceid-arguments-in-console-message-event-on-webcontents "Direct link to deprecated-level-message-line-and-sourceid-arguments-in-console-message-event-on-webcontents")

The `console-message` event on `WebContents` has been updated to provide details on the `Event`
argument.

```
// Deprecated
webContents.on('console-message', (event, level, message, line, sourceId) => {})

// Replace with:
webContents.on('console-message', ({ level, message, lineNumber, sourceId, frame }) => {})
```

Additionally, `level` is now a string with possible values of `info`, `warning`, `error`, and `debug`.

### Behavior Changed: `urls` property of `WebRequestFilter`.[â](#behavior-changed-urls-property-of-webrequestfilter "Direct link to behavior-changed-urls-property-of-webrequestfilter")

Previously, an empty urls array was interpreted as including all URLs. To explicitly include all URLs, developers should now use the `<all_urls>` pattern, which is a [designated URL pattern](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns#all_urls) that matches every possible URL. This change clarifies the intent and ensures more predictable behavior.

```
// Deprecated
const deprecatedFilter = {
urls: []
}

// Replace with
const newFilter = {
urls: ['<all_urls>']
}
```

### Deprecated: `systemPreferences.isAeroGlassEnabled()`[â](#deprecated-systempreferencesisaeroglassenabled "Direct link to deprecated-systempreferencesisaeroglassenabled")

The `systemPreferences.isAeroGlassEnabled()` function has been deprecated without replacement.
It has been always returning `true` since Electron 23, which only supports Windows 10+, where DWM composition can no longer be disabled.

<https://learn.microsoft.com/en-us/windows/win32/dwm/composition-ovw#disabling-dwm-composition-windows7-and-earlier>

## Planned Breaking API Changes (34.0)[â](#planned-breaking-api-changes-340 "Direct link to Planned Breaking API Changes (34.0)")

### Behavior Changed: menu bar will be hidden during fullscreen on Windows[â](#behavior-changed-menu-bar-will-be-hidden-during-fullscreen-on-windows "Direct link to Behavior Changed: menu bar will be hidden during fullscreen on Windows")

This brings the behavior to parity with Linux. Prior behavior: Menu bar is still visible during fullscreen on Windows. New behavior: Menu bar is hidden during fullscreen on Windows.

**Correction**: This was previously listed as a breaking change in Electron 33, but was first released in Electron 34.

## Planned Breaking API Changes (33.0)[â](#planned-breaking-api-changes-330 "Direct link to Planned Breaking API Changes (33.0)")

### Deprecated: `document.execCommand("paste")`[â](#deprecated-documentexeccommandpaste "Direct link to deprecated-documentexeccommandpaste")

The synchronous clipboard read API [document.execCommand("paste")](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard) has been
deprecated in favor of [async clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API). This is to align with the browser defaults.

The `enableDeprecatedPaste` option on `WebPreferences` that triggers the permission
checks for this API and the associated permission type `deprecated-sync-clipboard-read`
are also deprecated.

### Behavior Changed: frame properties may retrieve detached WebFrameMain instances or none at all[â](#behavior-changed-frame-properties-may-retrieve-detached-webframemain-instances-or-none-at-all "Direct link to Behavior Changed: frame properties may retrieve detached WebFrameMain instances or none at all")

APIs which provide access to a `WebFrameMain` instance may return an instance
with `frame.detached` set to `true`, or possibly return `null`.

When a frame performs a cross-origin navigation, it enters into a detached state
in which it's no longer attached to the page. In this state, it may be running
[unload](https://developer.mozilla.org/en-US/docs/Web/API/Window/unload_event)
handlers prior to being deleted. In the event of an IPC sent during this state,
`frame.detached` will be set to `true` with the frame being destroyed shortly
thereafter.

When receiving an event, it's important to access WebFrameMain properties
immediately upon being received. Otherwise, it's not guaranteed to point to the
same webpage as when received. To avoid misaligned expectations, Electron will
return `null` in the case of late access where the webpage has changed.

```
ipcMain.on('unload-event', (event) => {
event.senderFrame // â accessed immediately
})

ipcMain.on('unload-event', async (event) => {
await crossOriginNavigationPromise
event.senderFrame // â returns `null` due to late access
})
```

### Behavior Changed: custom protocol URL handling on Windows[â](#behavior-changed-custom-protocol-url-handling-on-windows "Direct link to Behavior Changed: custom protocol URL handling on Windows")

Due to changes made in Chromium to support [Non-Special Scheme URLs](http://bit.ly/url-non-special), custom protocol URLs that use Windows file paths will no longer work correctly with the deprecated `protocol.registerFileProtocol` and the `baseURLForDataURL` property on `BrowserWindow.loadURL`, `WebContents.loadURL`, and `<webview>.loadURL`. `protocol.handle` will also not work with these types of URLs but this is not a change since it has always worked that way.

```
// No longer works
protocol.registerFileProtocol('other', () => {
callback({ filePath: '/path/to/my/file' })
})

const mainWindow = new BrowserWindow()
mainWindow.loadURL('data:text/html,<script src="loaded-from-dataurl.js"></script>', { baseURLForDataURL: 'other://C:\\myapp' })
mainWindow.loadURL('other://C:\\myapp\\index.html')

// Replace with
const path = require('node:path')
const nodeUrl = require('node:url')
protocol.handle(other, (req) => {
const srcPath = 'C:\\myapp\\'
const reqURL = new URL(req.url)
return net.fetch(nodeUrl.pathToFileURL(path.join(srcPath, reqURL.pathname)).toString())
})

mainWindow.loadURL('data:text/html,<script src="loaded-from-dataurl.js"></script>', { baseURLForDataURL: 'other://' })
mainWindow.loadURL('other://index.html')
```

### Behavior Changed: `webContents` property on `login` on `app`[â](#behavior-changed-webcontents-property-on-login-on-app "Direct link to behavior-changed-webcontents-property-on-login-on-app")

The `webContents` property in the `login` event from `app` will be `null`
when the event is triggered for requests from the [utility process](/docs/latest/api/utility-process)
created with `respondToAuthRequestsFromMainProcess` option.

### Deprecated: `textured` option in `BrowserWindowConstructorOption.type`[â](#deprecated-textured-option-in-browserwindowconstructoroptiontype "Direct link to deprecated-textured-option-in-browserwindowconstructoroptiontype")

The `textured` option of `type` in `BrowserWindowConstructorOptions` has been deprecated with no replacement. This option relied on the [`NSWindowStyleMaskTexturedBackground`](https://developer.apple.com/documentation/appkit/nswindowstylemask/nswindowstylemasktexturedbackground) style mask on macOS, which has been deprecated with no alternative.

### Removed: macOS 10.15 support[â](#removed-macos-1015-support "Direct link to Removed: macOS 10.15 support")

macOS 10.15 (Catalina) is no longer supported by [Chromium](https://chromium-review.googlesource.com/c/chromium/src/+/5734361).

Older versions of Electron will continue to run on Catalina, but macOS 11 (Big Sur)
or later will be required to run Electron v33.0.0 and higher.

### Behavior Changed: Native modules now require C++20[â](#behavior-changed-native-modules-now-require-c20 "Direct link to Behavior Changed: Native modules now require C++20")

Due to changes made upstream, both
[V8](https://chromium-review.googlesource.com/c/v8/v8/+/5587859) and
[Node.js](https://github.com/nodejs/node/pull/45427) now require C++20 as a
minimum version. Developers using native node modules should build their
modules with `--std=c++20` rather than `--std=c++17`. Images using gcc9 or
lower may need to update to gcc10 in order to compile. See
[#43555](https://github.com/electron/electron/pull/43555) for more details.

### Deprecated: `systemPreferences.accessibilityDisplayShouldReduceTransparency`[â](#deprecated-systempreferencesaccessibilitydisplayshouldreducetransparency "Direct link to deprecated-systempreferencesaccessibilitydisplayshouldreducetransparency")

The `systemPreferences.accessibilityDisplayShouldReduceTransparency` property is now deprecated in favor of the new `nativeTheme.prefersReducedTransparency`, which provides identical information and works cross-platform.

```
// Deprecated
const shouldReduceTransparency = systemPreferences.accessibilityDisplayShouldReduceTransparency

// Replace with:
const prefersReducedTransparency = nativeTheme.prefersReducedTransparency
```

## Planned Breaking API Changes (32.0)[â](#planned-breaking-api-changes-320 "Direct link to Planned Breaking API Changes (32.0)")

### Removed: `File.path`[â](#removed-filepath "Direct link to removed-filepath")

The nonstandard `path` property of the Web `File` object was added in an early version of Electron as a convenience method for working with native files when doing everything in the renderer was more common. However, it represents a deviation from the standard and poses a minor security risk as well, so beginning in Electron 32.0 it has been removed in favor of the [`webUtils.getPathForFile`](/docs/latest/api/web-utils#webutilsgetpathforfilefile) method.

```
// Before (renderer)

const file = document.querySelector('input[type=file]').files[0]
alert(`Uploaded file path was: ${file.path}`)
```

```
// After (renderer)

const file = document.querySelector('input[type=file]').files[0]
electron.showFilePath(file)

// (preload)
const { contextBridge, webUtils } = require('electron')

contextBridge.exposeInMainWorld('electron', {
showFilePath (file) {
// It's best not to expose the full file path to the web content if
// possible.
const path = webUtils.getPathForFile(file)
alert(`Uploaded file path was: ${path}`)
}
})
```

### Deprecated: `clearHistory`, `canGoBack`, `goBack`, `canGoForward`, `goForward`, `goToIndex`, `canGoToOffset`, `goToOffset` on `WebContents`[â](#deprecated-clearhistory-cangoback-goback-cangoforward-goforward-gotoindex-cangotooffset-gotooffset-on-webcontents "Direct link to deprecated-clearhistory-cangoback-goback-cangoforward-goforward-gotoindex-cangotooffset-gotooffset-on-webcontents")

The navigation-related APIs are now deprecated.

These APIs have been moved to the `navigationHistory` property of `WebContents` to provide a more structured and intuitive interface for managing navigation history.

```
// Deprecated
win.webContents.clearHistory()
win.webContents.canGoBack()
win.webContents.goBack()
win.webContents.canGoForward()
win.webContents.goForward()
win.webContents.goToIndex(index)
win.webContents.canGoToOffset()
win.webContents.goToOffset(index)

// Replace with
win.webContents.navigationHistory.clear()
win.webContents.navigationHistory.canGoBack()
win.webContents.navigationHistory.goBack()
win.webContents.navigationHistory.canGoForward()
win.webContents.navigationHistory.goForward()
win.webContents.navigationHistory.canGoToOffset()
win.webContents.navigationHistory.goToOffset(index)
```

### Behavior changed: Directory `databases` in `userData` will be deleted[â](#behavior-changed-directory-databases-in-userdata-will-be-deleted "Direct link to behavior-changed-directory-databases-in-userdata-will-be-deleted")

If you have a directory called `databases` in the directory returned by
`app.getPath('userData')`, it will be deleted when Electron 32 is first run.
The `databases` directory was used by WebSQL, which was removed in Electron 31.
Chromium now performs a cleanup that deletes this directory. See
[issue #45396](https://github.com/electron/electron/issues/45396).

## Planned Breaking API Changes (31.0)[â](#planned-breaking-api-changes-310 "Direct link to Planned Breaking API Changes (31.0)")

### Removed: `WebSQL` support[â](#removed-websql-support "Direct link to removed-websql-support")

Chromium has removed support for WebSQL upstream, transitioning it to Android only. See
[Chromium's intent to remove discussion](https://groups.google.com/a/chromium.org/g/blink-dev/c/fWYb6evVA-w/m/wGI863zaAAAJ)
for more information.

### Behavior Changed: `nativeImage.toDataURL` will preserve PNG colorspace[â](#behavior-changed-nativeimagetodataurl-will-preserve-png-colorspace "Direct link to behavior-changed-nativeimagetodataurl-will-preserve-png-colorspace")

PNG decoder implementation has been changed to preserve colorspace data, the
encoded data returned from this function now matches it.

See [crbug.com/332584706](https://issues.chromium.org/issues/332584706) for more information.

### Behavior Changed: `window.flashFrame(bool)` will flash dock icon continuously on macOS[â](#behavior-changed-windowflashframebool-will-flash-dock-icon-continuously-on-macos "Direct link to behavior-changed-windowflashframebool-will-flash-dock-icon-continuously-on-macos")

This brings the behavior to parity with Windows and Linux. Prior behavior: The first `flashFrame(true)` bounces the dock icon only once (using the [NSInformationalRequest](https://developer.apple.com/documentation/appkit/nsrequestuserattentiontype/nsinformationalrequest) level) and `flashFrame(false)` does nothing. New behavior: Flash continuously until `flashFrame(false)` is called. This uses the [NSCriticalRequest](https://developer.apple.com/documentation/appkit/nsrequestuserattentiontype/nscriticalrequest) level instead. To explicitly use `NSInformationalRequest` to cause a single dock icon bounce, it is still possible to use [`dock.bounce('informational')`](https://www.electronjs.org/docs/latest/api/dock#dockbouncetype-macos).

## Planned Breaking API Changes (30.0)[â](#planned-breaking-api-changes-300 "Direct link to Planned Breaking API Changes (30.0)")

### Behavior Changed: cross-origin iframes now use Permission Policy to access features[â](#behavior-changed-cross-origin-iframes-now-use-permission-policy-to-access-features "Direct link to Behavior Changed: cross-origin iframes now use Permission Policy to access features")

Cross-origin iframes must now specify features available to a given `iframe` via the `allow`
attribute in order to access them.

See [documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#allow) for
more information.

### Removed: The `--disable-color-correct-rendering` switch[â](#removed-the---disable-color-correct-rendering-switch "Direct link to removed-the---disable-color-correct-rendering-switch")

This switch was never formally documented but it's removal is being noted here regardless. Chromium itself now has better support for color spaces so this flag should not be needed.

### Behavior Changed: `BrowserView.setAutoResize` behavior on macOS[â](#behavior-changed-browserviewsetautoresize-behavior-on-macos "Direct link to behavior-changed-browserviewsetautoresize-behavior-on-macos")

In Electron 30, BrowserView is now a wrapper around the new [WebContentsView](/docs/latest/api/web-contents-view) API.

Previously, the `setAutoResize` function of the `BrowserView` API was backed by [autoresizing](https://developer.apple.com/documentation/appkit/nsview/1483281-autoresizingmask?language=objc) on macOS, and by a custom algorithm on Windows and Linux.
For simple use cases such as making a BrowserView fill the entire window, the behavior of these two approaches was identical.
However, in more advanced cases, BrowserViews would be autoresized differently on macOS than they would be on other platforms, as the custom resizing algorithm for Windows and Linux did not perfectly match the behavior of macOS's autoresizing API.
The autoresizing behavior is now standardized across all platforms.

If your app uses `BrowserView.setAutoResize` to do anything more complex than making a BrowserView fill the entire window, it's likely you already had custom logic in place to handle this difference in behavior on macOS.
If so, that logic will no longer be needed in Electron 30 as autoresizing behavior is consistent.

### Deprecated: `BrowserView`[â](#deprecated-browserview "Direct link to deprecated-browserview")

The [`BrowserView`](/docs/latest/api/browser-view) class has been deprecated and
replaced by the new [`WebContentsView`](/docs/latest/api/web-contents-view) class.

`BrowserView` related methods in [`BrowserWindow`](/docs/latest/api/browser-window) have
also been deprecated:

```
BrowserWindow.fromBrowserView(browserView)
win.setBrowserView(browserView)
win.getBrowserView()
win.addBrowserView(browserView)
win.removeBrowserView(browserView)
win.setTopBrowserView(browserView)
win.getBrowserViews()
```

### Removed: `params.inputFormType` property on `context-menu` on `WebContents`[â](#removed-paramsinputformtype-property-on-context-menu-on-webcontents "Direct link to removed-paramsinputformtype-property-on-context-menu-on-webcontents")

The `inputFormType` property of the params object in the `context-menu`
event from `WebContents` has been removed. Use the new `formControlType`
property instead.

### Removed: `process.getIOCounters()`[â](#removed-processgetiocounters "Direct link to removed-processgetiocounters")

Chromium has removed access to this information.

## Planned Breaking API Changes (29.0)[â](#planned-breaking-api-changes-290 "Direct link to Planned Breaking API Changes (29.0)")

### Behavior Changed: `ipcRenderer` can no longer be sent over the `contextBridge`[â](#behavior-changed-ipcrenderer-can-no-longer-be-sent-over-the-contextbridge "Direct link to behavior-changed-ipcrenderer-can-no-longer-be-sent-over-the-contextbridge")

Attempting to send the entire `ipcRenderer` module as an object over the `contextBridge` will now result in
an empty object on the receiving side of the bridge. This change was made to remove / mitigate
a security footgun. You should not directly expose ipcRenderer or its methods over the bridge.
Instead, provide a safe wrapper like below:

```
contextBridge.exposeInMainWorld('app', {
onEvent: (cb) => ipcRenderer.on('foo', (e, ...args) => cb(args))
})
```

### Removed: `renderer-process-crashed` event on `app`[â](#removed-renderer-process-crashed-event-on-app "Direct link to removed-renderer-process-crashed-event-on-app")

The `renderer-process-crashed` event on `app` has been removed.
Use the new `render-process-gone` event instead.

```
// Removed
app.on('renderer-process-crashed', (event, webContents, killed) => { /* ... */ })

// Replace with
app.on('render-process-gone', (event, webContents, details) => { /* ... */ })
```

### Removed: `crashed` event on `WebContents` and `<webview>`[â](#removed-crashed-event-on-webcontents-and-webview "Direct link to removed-crashed-event-on-webcontents-and-webview")

The `crashed` events on `WebContents` and `<webview>` have been removed.
Use the new `render-process-gone` event instead.

```
// Removed
win.webContents.on('crashed', (event, killed) => { /* ... */ })
webview.addEventListener('crashed', (event) => { /* ... */ })

// Replace with
win.webContents.on('render-process-gone', (event, details) => { /* ... */ })
webview.addEventListener('render-process-gone', (event) => { /* ... */ })
```

### Removed: `gpu-process-crashed` event on `app`[â](#removed-gpu-process-crashed-event-on-app "Direct link to removed-gpu-process-crashed-event-on-app")

The `gpu-process-crashed` event on `app` has been removed.
Use the new `child-process-gone` event instead.

```
// Removed
app.on('gpu-process-crashed', (event, killed) => { /* ... */ })

// Replace with
app.on('child-process-gone', (event, details) => { /* ... */ })
```

## Planned Breaking API Changes (28.0)[â](#planned-breaking-api-changes-280 "Direct link to Planned Breaking API Changes (28.0)")

### Behavior Changed: `WebContents.backgroundThrottling` set to false affects all `WebContents` in the host `BrowserWindow`[â](#behavior-changed-webcontentsbackgroundthrottling-set-to-false-affects-all-webcontents-in-the-host-browserwindow "Direct link to behavior-changed-webcontentsbackgroundthrottling-set-to-false-affects-all-webcontents-in-the-host-browserwindow")

`WebContents.backgroundThrottling` set to false will disable frames throttling
in the `BrowserWindow` for all `WebContents` displayed by it.

### Removed: `BrowserWindow.setTrafficLightPosition(position)`[â](#removed-browserwindowsettrafficlightpositionposition "Direct link to removed-browserwindowsettrafficlightpositionposition")

`BrowserWindow.setTrafficLightPosition(position)` has been removed, the
`BrowserWindow.setWindowButtonPosition(position)` API should be used instead
which accepts `null` instead of `{ x: 0, y: 0 }` to reset the position to
system default.

```
// Removed in Electron 28
win.setTrafficLightPosition({ x: 10, y: 10 })
win.setTrafficLightPosition({ x: 0, y: 0 })

// Replace with
win.setWindowButtonPosition({ x: 10, y: 10 })
win.setWindowButtonPosition(null)
```

### Removed: `BrowserWindow.getTrafficLightPosition()`[â](#removed-browserwindowgettrafficlightposition "Direct link to removed-browserwindowgettrafficlightposition")

`BrowserWindow.getTrafficLightPosition()` has been removed, the
`BrowserWindow.getWindowButtonPosition()` API should be used instead
which returns `null` instead of `{ x: 0, y: 0 }` when there is no custom
position.

```
// Removed in Electron 28
const pos = win.getTrafficLightPosition()
if (pos.x === 0 && pos.y === 0) {
// No custom position.
}

// Replace with
const ret = win.getWindowButtonPosition()
if (ret === null) {
// No custom position.
}
```

### Removed: `ipcRenderer.sendTo()`[â](#removed-ipcrenderersendto "Direct link to removed-ipcrenderersendto")

The `ipcRenderer.sendTo()` API has been removed. It should be replaced by setting up a [`MessageChannel`](/docs/latest/tutorial/message-ports#setting-up-a-messagechannel-between-two-renderers) between the renderers.

The `senderId` and `senderIsMainFrame` properties of `IpcRendererEvent` have been removed as well.

### Removed: `app.runningUnderRosettaTranslation`[â](#removed-apprunningunderrosettatranslation "Direct link to removed-apprunningunderrosettatranslation")

The `app.runningUnderRosettaTranslation` property has been removed.
Use `app.runningUnderARM64Translation` instead.

```
// Removed
console.log(app.runningUnderRosettaTranslation)
// Replace with
console.log(app.runningUnderARM64Translation)
```

### Deprecated: `renderer-process-crashed` event on `app`[â](#deprecated-renderer-process-crashed-event-on-app "Direct link to deprecated-renderer-process-crashed-event-on-app")

The `renderer-process-crashed` event on `app` has been deprecated.
Use the new `render-process-gone` event instead.

```
// Deprecated
app.on('renderer-process-crashed', (event, webContents, killed) => { /* ... */ })

// Replace with
app.on('render-process-gone', (event, webContents, details) => { /* ... */ })
```

### Deprecated: `params.inputFormType` property on `context-menu` on `WebContents`[â](#deprecated-paramsinputformtype-property-on-context-menu-on-webcontents "Direct link to deprecated-paramsinputformtype-property-on-context-menu-on-webcontents")

The `inputFormType` property of the params object in the `context-menu`
event from `WebContents` has been deprecated. Use the new `formControlType`
property instead.

### Deprecated: `crashed` event on `WebContents` and `<webview>`[â](#deprecated-crashed-event-on-webcontents-and-webview "Direct link to deprecated-crashed-event-on-webcontents-and-webview")

The `crashed` events on `WebContents` and `<webview>` have been deprecated.
Use the new `render-process-gone` event instead.

```
// Deprecated
win.webContents.on('crashed', (event, killed) => { /* ... */ })
webview.addEventListener('crashed', (event) => { /* ... */ })

// Replace with
win.webContents.on('render-process-gone', (event, details) => { /* ... */ })
webview.addEventListener('render-process-gone', (event) => { /* ... */ })
```

### Deprecated: `gpu-process-crashed` event on `app`[â](#deprecated-gpu-process-crashed-event-on-app "Direct link to deprecated-gpu-process-crashed-event-on-app")

The `gpu-process-crashed` event on `app` has been deprecated.
Use the new `child-process-gone` event instead.

```
// Deprecated
app.on('gpu-process-crashed', (event, killed) => { /* ... */ })

// Replace with
app.on('child-process-gone', (event, details) => { /* ... */ })
```

## Planned Breaking API Changes (27.0)[â](#planned-breaking-api-changes-270 "Direct link to Planned Breaking API Changes (27.0)")

### Removed: macOS 10.13 / 10.14 support[â](#removed-macos-1013--1014-support "Direct link to Removed: macOS 10.13 / 10.14 support")

macOS 10.13 (High Sierra) and macOS 10.14 (Mojave) are no longer supported by [Chromium](https://chromium-review.googlesource.com/c/chromium/src/+/4629466).

Older versions of Electron will continue to run on these operating systems, but macOS 10.15 (Catalina)
or later will be required to run Electron v27.0.0 and higher.

### Deprecated: `ipcRenderer.sendTo()`[â](#deprecated-ipcrenderersendto "Direct link to deprecated-ipcrenderersendto")

The `ipcRenderer.sendTo()` API has been deprecated. It should be replaced by setting up a [`MessageChannel`](/docs/latest/tutorial/message-ports#setting-up-a-messagechannel-between-two-renderers) between the renderers.

The `senderId` and `senderIsMainFrame` properties of `IpcRendererEvent` have been deprecated as well.

### Removed: color scheme events in `systemPreferences`[â](#removed-color-scheme-events-in-systempreferences "Direct link to removed-color-scheme-events-in-systempreferences")

The following `systemPreferences` events have been removed:

* `inverted-color-scheme-changed`
* `high-contrast-color-scheme-changed`

Use the new `updated` event on the `nativeTheme` module instead.

```
// Removed
systemPreferences.on('inverted-color-scheme-changed', () => { /* ... */ })
systemPreferences.on('high-contrast-color-scheme-changed', () => { /* ... */ })

// Replace with
nativeTheme.on('updated', () => { /* ... */ })
```

### Removed: Some `window.setVibrancy` options on macOS[â](#removed-some-windowsetvibrancy-options-on-macos "Direct link to removed-some-windowsetvibrancy-options-on-macos")

The following vibrancy options have been removed:

* 'light'
* 'medium-light'
* 'dark'
* 'ultra-dark'
* 'appearance-based'

These were previously deprecated and have been removed by Apple in 10.15.

### Removed: `webContents.getPrinters`[â](#removed-webcontentsgetprinters "Direct link to removed-webcontentsgetprinters")

The `webContents.getPrinters` method has been removed. Use
`webContents.getPrintersAsync` instead.

```
const w = new BrowserWindow({ show: false })

// Removed
console.log(w.webContents.getPrinters())
// Replace with
w.webContents.getPrintersAsync().then((printers) => {
console.log(printers)
})
```

### Removed: `systemPreferences.{get,set}AppLevelAppearance` and `systemPreferences.appLevelAppearance`[â](#removed-systempreferencesgetsetapplevelappearance-and-systempreferencesapplevelappearance "Direct link to removed-systempreferencesgetsetapplevelappearance-and-systempreferencesapplevelappearance")

The `systemPreferences.getAppLevelAppearance` and `systemPreferences.setAppLevelAppearance`
methods have been removed, as well as the `systemPreferences.appLevelAppearance` property.
Use the `nativeTheme` module instead.

```
// Removed
systemPreferences.getAppLevelAppearance()
// Replace with
nativeTheme.shouldUseDarkColors

// Removed
systemPreferences.appLevelAppearance
// Replace with
nativeTheme.shouldUseDarkColors

// Removed
systemPreferences.setAppLevelAppearance('dark')
// Replace with
nativeTheme.themeSource = 'dark'
```

### Removed: `alternate-selected-control-text` value for `systemPreferences.getColor`[â](#removed-alternate-selected-control-text-value-for-systempreferencesgetcolor "Direct link to removed-alternate-selected-control-text-value-for-systempreferencesgetcolor")

The `alternate-selected-control-text` value for `systemPreferences.getColor`
has been removed. Use `selected-content-background` instead.

```
// Removed
systemPreferences.getColor('alternate-selected-control-text')
// Replace with
systemPreferences.getColor('selected-content-background')
```

## Planned Breaking API Changes (26.0)[â](#planned-breaking-api-changes-260 "Direct link to Planned Breaking API Changes (26.0)")

### Deprecated: `webContents.getPrinters`[â](#deprecated-webcontentsgetprinters "Direct link to deprecated-webcontentsgetprinters")

The `webContents.getPrinters` method has been deprecated. Use
`webContents.getPrintersAsync` instead.

```
const w = new BrowserWindow({ show: false })

// Deprecated
console.log(w.webContents.getPrinters())
// Replace with
w.webContents.getPrintersAsync().then((printers) => {
console.log(printers)
})
```

### Deprecated: `systemPreferences.{get,set}AppLevelAppearance` and `systemPreferences.appLevelAppearance`[â](#deprecated-systempreferencesgetsetapplevelappearance-and-systempreferencesapplevelappearance "Direct link to deprecated-systempreferencesgetsetapplevelappearance-and-systempreferencesapplevelappearance")

The `systemPreferences.getAppLevelAppearance` and `systemPreferences.setAppLevelAppearance`
methods have been deprecated, as well as the `systemPreferences.appLevelAppearance` property.
Use the `nativeTheme` module instead.

```
// Deprecated
systemPreferences.getAppLevelAppearance()
// Replace with
nativeTheme.shouldUseDarkColors

// Deprecated
systemPreferences.appLevelAppearance
// Replace with
nativeTheme.shouldUseDarkColors

// Deprecated
systemPreferences.setAppLevelAppearance('dark')
// Replace with
nativeTheme.themeSource = 'dark'
```

### Deprecated: `alternate-selected-control-text` value for `systemPreferences.getColor`[â](#deprecated-alternate-selected-control-text-value-for-systempreferencesgetcolor "Direct link to deprecated-alternate-selected-control-text-value-for-systempreferencesgetcolor")

The `alternate-selected-control-text` value for `systemPreferences.getColor`
has been deprecated. Use `selected-content-background` instead.

```
// Deprecated
systemPreferences.getColor('alternate-selected-control-text')
// Replace with
systemPreferences.getColor('selected-content-background')
```

## Planned Breaking API Changes (25.0)[â](#planned-breaking-api-changes-250 "Direct link to Planned Breaking API Changes (25.0)")

### Deprecated: `protocol.{un,}{register,intercept}{Buffer,String,Stream,File,Http}Protocol` and `protocol.isProtocol{Registered,Intercepted}`[â](#deprecated-protocolunregisterinterceptbufferstringstreamfilehttpprotocol-and-protocolisprotocolregisteredintercepted "Direct link to deprecated-protocolunregisterinterceptbufferstringstreamfilehttpprotocol-and-protocolisprotocolregisteredintercepted")

The `protocol.register*Protocol` and `protocol.intercept*Protocol` methods have
been replaced with [`protocol.handle`](/docs/latest/api/protocol#protocolhandlescheme-handler).

The new method can either register a new protocol or intercept an existing
protocol, and responses can be of any type.

```
// Deprecated in Electron 25
protocol.registerBufferProtocol('some-protocol', () => {
callback({ mimeType: 'text/html', data: Buffer.from('<h5>Response</h5>') })
})

// Replace with
protocol.handle('some-protocol', () => {
return new Response(
Buffer.from('<h5>Response</h5>'), // Could also be a string or ReadableStream.
{ headers: { 'content-type': 'text/html' } }
)
})
```

```
// Deprecated in Electron 25
protocol.registerHttpProtocol('some-protocol', () => {
callback({ url: 'https://electronjs.org' })
})

// Replace with
protocol.handle('some-protocol', () => {
return net.fetch('https://electronjs.org')
})
```

```
// Deprecated in Electron 25
protocol.registerFileProtocol('some-protocol', () => {
callback({ filePath: '/path/to/my/file' })
})

// Replace with
protocol.handle('some-protocol', () => {
return net.fetch('file:///path/to/my/file')
})
```

### Deprecated: `BrowserWindow.setTrafficLightPosition(position)`[â](#deprecated-browserwindowsettrafficlightpositionposition "Direct link to deprecated-browserwindowsettrafficlightpositionposition")

`BrowserWindow.setTrafficLightPosition(position)` has been deprecated, the
`BrowserWindow.setWindowButtonPosition(position)` API should be used instead
which accepts `null` instead of `{ x: 0, y: 0 }` to reset the position to
system default.

```
// Deprecated in Electron 25
win.setTrafficLightPosition({ x: 10, y: 10 })
win.setTrafficLightPosition({ x: 0, y: 0 })

// Replace with
win.setWindowButtonPosition({ x: 10, y: 10 })
win.setWindowButtonPosition(null)
```

### Deprecated: `BrowserWindow.getTrafficLightPosition()`[â](#deprecated-browserwindowgettrafficlightposition "Direct link to deprecated-browserwindowgettrafficlightposition")

`BrowserWindow.getTrafficLightPosition()` has been deprecated, the
`BrowserWindow.getWindowButtonPosition()` API should be used instead
which returns `null` instead of `{ x: 0, y: 0 }` when there is no custom
position.

```
// Deprecated in Electron 25
const pos = win.getTrafficLightPosition()
if (pos.x === 0 && pos.y === 0) {
// No custom position.
}

// Replace with
const ret = win.getWindowButtonPosition()
if (ret === null) {
// No custom position.
}
```

## Planned Breaking API Changes (24.0)[â](#planned-breaking-api-changes-240 "Direct link to Planned Breaking API Changes (24.0)")

### API Changed: `nativeImage.createThumbnailFromPath(path, size)`[â](#api-changed-nativeimagecreatethumbnailfrompathpath-size "Direct link to api-changed-nativeimagecreatethumbnailfrompathpath-size")

The `maxSize` parameter has been changed to `size` to reflect that the size passed in will be the size the thumbnail created. Previously, Windows would not scale the image up if it were smaller than `maxSize`, and
macOS would always set the size to `maxSize`. Behavior is now the same across platforms.

Updated Behavior:

```
// a 128x128 image.
const imagePath = path.join('path', 'to', 'capybara.png')

// Scaling up a smaller image.
const upSize = { width: 256, height: 256 }
nativeImage.createThumbnailFromPath(imagePath, upSize).then(result => {
console.log(result.getSize()) // { width: 256, height: 256 }
})

// Scaling down a larger image.
const downSize = { width: 64, height: 64 }
nativeImage.createThumbnailFromPath(imagePath, downSize).then(result => {
console.log(result.getSize()) // { width: 64, height: 64 }
})
```

Previous Behavior (on Windows):

```
// a 128x128 image
const imagePath = path.join('path', 'to', 'capybara.png')
const size = { width: 256, height: 256 }
nativeImage.createThumbnailFromPath(imagePath, size).then(result => {
console.log(result.getSize()) // { width: 128, height: 128 }
})
```

## Planned Breaking API Changes (23.0)[â](#planned-breaking-api-changes-230 "Direct link to Planned Breaking API Changes (23.0)")

### Behavior Changed: Draggable Regions on macOS[â](#behavior-changed-draggable-regions-on-macos "Direct link to Behavior Changed: Draggable Regions on macOS")

The implementation of draggable regions (using the CSS property `-webkit-app-region: drag`) has changed on macOS to bring it in line with Windows and Linux. Previously, when a region with `-webkit-app-region: no-drag` overlapped a region with `-webkit-app-region: drag`, the `no-drag` region would always take precedence on macOS, regardless of CSS layering. That is, if a `drag` region was above a `no-drag` region, it would be ignored. Beginning in Electron 23, a `drag` region on top of a `no-drag` region will correctly cause the region to be draggable.

Additionally, the `customButtonsOnHover` BrowserWindow property previously created a draggable region which ignored the `-webkit-app-region` CSS property. This has now been fixed (see [#37210](https://github.com/electron/electron/issues/37210#issuecomment-1440509592) for discussion).

As a result, if your app uses a frameless window with draggable regions on macOS, the regions which are draggable in your app may change in Electron 23.

### Removed: Windows 7 / 8 / 8.1 support[â](#removed-windows-7--8--81-support "Direct link to Removed: Windows 7 / 8 / 8.1 support")

[Windows 7, Windows 8, and Windows 8.1 are no longer supported](https://www.electronjs.org/blog/windows-7-to-8-1-deprecation-notice). Electron follows the planned Chromium deprecation policy, which will [deprecate Windows 7 support beginning in Chromium 109](https://support.google.com/chrome/thread/185534985/sunsetting-support-for-windows-7-8-8-1-in-early-2023?hl=en).

Older versions of Electron will continue to run on these operating systems, but Windows 10 or later will be required to run Electron v23.0.0 and higher.

### Removed: BrowserWindow `scroll-touch-*` events[â](#removed-browserwindow-scroll-touch--events "Direct link to removed-browserwindow-scroll-touch--events")

The deprecated `scroll-touch-begin`, `scroll-touch-end` and `scroll-touch-edge`
events on BrowserWindow have been removed. Instead, use the newly available
[`input-event` event](/docs/latest/api/web-contents#event-input-event) on WebContents.

```
// Removed in Electron 23.0
win.on('scroll-touch-begin', scrollTouchBegin)
win.on('scroll-touch-edge', scrollTouchEdge)
win.on('scroll-touch-end', scrollTouchEnd)

// Replace with
win.webContents.on('input-event', (_, event) => {
if (event.type === 'gestureScrollBegin') {
scrollTouchBegin()
} else if (event.type === 'gestureScrollUpdate') {
scrollTouchEdge()
} else if (event.type === 'gestureScrollEnd') {
scrollTouchEnd()
}
})
```

### Removed: `webContents.incrementCapturerCount(stayHidden, stayAwake)`[â](#removed-webcontentsincrementcapturercountstayhidden-stayawake "Direct link to removed-webcontentsincrementcapturercountstayhidden-stayawake")

The `webContents.incrementCapturerCount(stayHidden, stayAwake)` function has been removed.
It is now automatically handled by `webContents.capturePage` when a page capture completes.

```
const w = new BrowserWindow({ show: false })

// Removed in Electron 23
w.webContents.incrementCapturerCount()
w.capturePage().then(image => {
console.log(image.toDataURL())
w.webContents.decrementCapturerCount()
})

// Replace with
w.capturePage().then(image => {
console.log(image.toDataURL())
})
```

### Removed: `webContents.decrementCapturerCount(stayHidden, stayAwake)`[â](#removed-webcontentsdecrementcapturercountstayhidden-stayawake "Direct link to removed-webcontentsdecrementcapturercountstayhidden-stayawake")

The `webContents.decrementCapturerCount(stayHidden, stayAwake)` function has been removed.
It is now automatically handled by `webContents.capturePage` when a page capture completes.

```
const w = new BrowserWindow({ show: false })

// Removed in Electron 23
w.webContents.incrementCapturerCount()
w.capturePage().then(image => {
console.log(image.toDataURL())
w.webContents.decrementCapturerCount()
})

// Replace with
w.capturePage().then(image => {
console.log(image.toDataURL())
})
```

## Planned Breaking API Changes (22.0)[â](#planned-breaking-api-changes-220 "Direct link to Planned Breaking API Changes (22.0)")

### Deprecated: `webContents.incrementCapturerCount(stayHidden, stayAwake)`[â](#deprecated-webcontentsincrementcapturercountstayhidden-stayawake "Direct link to deprecated-webcontentsincrementcapturercountstayhidden-stayawake")

`webContents.incrementCapturerCount(stayHidden, stayAwake)` has been deprecated.
It is now automatically handled by `webContents.capturePage` when a page capture completes.

```
const w = new BrowserWindow({ show: false })

// Removed in Electron 23
w.webContents.incrementCapturerCount()
w.capturePage().then(image => {
console.log(image.toDataURL())
w.webContents.decrementCapturerCount()
})

// Replace with
w.capturePage().then(image => {
console.log(image.toDataURL())
})
```

### Deprecated: `webContents.decrementCapturerCount(stayHidden, stayAwake)`[â](#deprecated-webcontentsdecrementcapturercountstayhidden-stayawake "Direct link to deprecated-webcontentsdecrementcapturercountstayhidden-stayawake")

`webContents.decrementCapturerCount(stayHidden, stayAwake)` has been deprecated.
It is now automatically handled by `webContents.capturePage` when a page capture completes.

```
const w = new BrowserWindow({ show: false })

// Removed in Electron 23
w.webContents.incrementCapturerCount()
w.capturePage().then(image => {
console.log(image.toDataURL())
w.webContents.decrementCapturerCount()
})

// Replace with
w.capturePage().then(image => {
console.log(image.toDataURL())
})
```

### Removed: WebContents `new-window` event[â](#removed-webcontents-new-window-event "Direct link to removed-webcontents-new-window-event")

The `new-window` event of WebContents has been removed. It is replaced by [`webContents.setWindowOpenHandler()`](/docs/latest/api/web-contents#contentssetwindowopenhandlerhandler).

```
// Removed in Electron 22
webContents.on('new-window', (event) => {
event.preventDefault()
})

// Replace with
webContents.setWindowOpenHandler((details) => {
return { action: 'deny' }
})
```

### Removed: `<webview>` `new-window` event[â](#removed-webview-new-window-event "Direct link to removed-webview-new-window-event")

The `new-window` event of `<webview>` has been removed. There is no direct replacement.

```
// Removed in Electron 22
webview.addEventListener('new-window', (event) => {})
```

```
// Replace with

// main.js
mainWindow.webContents.on('did-attach-webview', (event, wc) => {
wc.setWindowOpenHandler((details) => {
mainWindow.webContents.send('webview-new-window', wc.id, details)
return { action: 'deny' }
})
})

// preload.js
const { ipcRenderer } = require('electron')
ipcRenderer.on('webview-new-window', (e, webContentsId, details) => {
console.log('webview-new-window', webContentsId, details)
document.getElementById('webview').dispatchEvent(new Event('new-window'))
})

// renderer.js
document.getElementById('webview').addEventListener('new-window', () => {
console.log('got new-window event')
})
```

### Deprecated: BrowserWindow `scroll-touch-*` events[â](#deprecated-browserwindow-scroll-touch--events "Direct link to deprecated-browserwindow-scroll-touch--events")

The `scroll-touch-begin`, `scroll-touch-end` and `scroll-touch-edge` events on
BrowserWindow are deprecated. Instead, use the newly available
[`input-event` event](/docs/latest/api/web-contents#event-input-event) on WebContents.

```
// Deprecated
win.on('scroll-touch-begin', scrollTouchBegin)
win.on('scroll-touch-edge', scrollTouchEdge)
win.on('scroll-touch-end', scrollTouchEnd)

// Replace with
win.webContents.on('input-event', (_, event) => {
if (event.type === 'gestureScrollBegin') {
scrollTouchBegin()
} else if (event.type === 'gestureScrollUpdate') {
scrollTouchEdge()
} else if (event.type === 'gestureScrollEnd') {
scrollTouchEnd()
}
})
```

## Planned Breaking API Changes (21.0)[â](#planned-breaking-api-changes-210 "Direct link to Planned Breaking API Changes (21.0)")

### Behavior Changed: V8 Memory Cage enabled[â](#behavior-changed-v8-memory-cage-enabled "Direct link to Behavior Changed: V8 Memory Cage enabled")

The V8 memory cage has been enabled, which has implications for native modules
which wrap non-V8 memory with `ArrayBuffer` or `Buffer`. See the
[blog post about the V8 memory cage](https://www.electronjs.org/blog/v8-memory-cage) for
more details.

### API Changed: `webContents.printToPDF()`[â](#api-changed-webcontentsprinttopdf "Direct link to api-changed-webcontentsprinttopdf")

`webContents.printToPDF()` has been modified to conform to [`Page.printToPDF`](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-printToPDF) in the Chrome DevTools Protocol. This has been changes in order to
address changes upstream that made our previous implementation untenable and rife with bugs.

**Arguments Changed**

* `pageRanges`

**Arguments Removed**

* `printSelectionOnly`
* `marginsType`
* `headerFooter`
* `scaleFactor`

**Arguments Added**

* `headerTemplate`
* `footerTemplate`
* `displayHeaderFooter`
* `margins`
* `scale`
* `preferCSSPageSize`

```
// Main process
const { webContents } = require('electron')

webContents.printToPDF({
landscape: true,
displayHeaderFooter: true,
printBackground: true,
scale: 2,
pageSize: 'Ledger',
margins: {
top: 2,
bottom: 2,
left: 2,
right: 2
},
pageRanges: '1-5, 8, 11-13',
headerTemplate: '<h1>Title</h1>',
footerTemplate: '<div><span class="pageNumber"></span></div>',
preferCSSPageSize: true
}).then(data => {
fs.writeFile(pdfPath, data, (error) => {
if (error) throw error
console.log(`Wrote PDF successfully to ${pdfPath}`)
})
}).catch(error => {
console.log(`Failed to write PDF to ${pdfPath}: `, error)
})
```

## Planned Breaking API Changes (20.0)[â](#planned-breaking-api-changes-200 "Direct link to Planned Breaking API Changes (20.0)")

### Removed: macOS 10.11 / 10.12 support[â](#removed-macos-1011--1012-support "Direct link to Removed: macOS 10.11 / 10.12 support")

macOS 10.11 (El Capitan) and macOS 10.12 (Sierra) are no longer supported by [Chromium](https://chromium-review.googlesource.com/c/chromium/src/+/3646050).

Older versions of Electron will continue to run on these operating systems, but macOS 10.13 (High Sierra)
or later will be required to run Electron v20.0.0 and higher.

### Default Changed: renderers without `nodeIntegration: true` are sandboxed by default[â](#default-changed-renderers-without-nodeintegration-true-are-sandboxed-by-default "Direct link to default-changed-renderers-without-nodeintegration-true-are-sandboxed-by-default")

Previously, renderers that specified a preload script defaulted to being
unsandboxed. This meant that by default, preload scripts had access to Node.js.
In Electron 20, this default has changed. Beginning in Electron 20, renderers
will be sandboxed by default, unless `nodeIntegration: true` or `sandbox: false`
is specified.

If your preload scripts do not depend on Node, no action is needed. If your
preload scripts *do* depend on Node, either refactor them to remove Node usage
from the renderer, or explicitly specify `sandbox: false` for the relevant
renderers.

### Removed: `skipTaskbar` on Linux[â](#removed-skiptaskbar-on-linux "Direct link to removed-skiptaskbar-on-linux")

On X11, `skipTaskbar` sends a `_NET_WM_STATE_SKIP_TASKBAR` message to the X11
window manager. There is not a direct equivalent for Wayland, and the known
workarounds have unacceptable tradeoffs (e.g. Window.is\_skip\_taskbar in GNOME
requires unsafe mode), so Electron is unable to support this feature on Linux.

### API Changed: `session.setDevicePermissionHandler(handler)`[â](#api-changed-sessionsetdevicepermissionhandlerhandler "Direct link to api-changed-sessionsetdevicepermissionhandlerhandler")

The handler invoked when `session.setDevicePermissionHandler(handler)` is used
has a change to its arguments. This handler no longer is passed a frame
[`WebFrameMain`](/docs/latest/api/web-frame-main), but instead is passed the `origin`, which
is the origin that is checking for device permission.

## Planned Breaking API Changes (19.0)[â](#planned-breaking-api-changes-190 "Direct link to Planned Breaking API Changes (19.0)")

### Removed: IA32 Linux binaries[â](#removed-ia32-linux-binaries "Direct link to Removed: IA32 Linux binaries")

This is a result of Chromium 102.0.4999.0 dropping support for IA32 Linux.
This concludes the [removal of support for IA32 Linux](#removed-ia32-linux-support).

## Planned Breaking API Changes (18.0)[â](#planned-breaking-api-changes-180 "Direct link to Planned Breaking API Changes (18.0)")

### Removed: `nativeWindowOpen`[â](#removed-nativewindowopen "Direct link to removed-nativewindowopen")

Prior to Electron 15, `window.open` was by default shimmed to use
`BrowserWindowProxy`. This meant that `window.open('about:blank')` did not work
to open synchronously scriptable child windows, among other incompatibilities.
Since Electron 15, `nativeWindowOpen` has been enabled by default.

See the documentation for [window.open in Electron](/docs/latest/api/window-open)
for more details.

## Planned Breaking API Changes (17.0)[â](#planned-breaking-api-changes-170 "Direct link to Planned Breaking API Changes (17.0)")

### Removed: `desktopCapturer.getSources` in the renderer[â](#removed-desktopcapturergetsources-in-the-renderer "Direct link to removed-desktopcapturergetsources-in-the-renderer")

The `desktopCapturer.getSources` API is now only available in the main process.
This has been changed in order to improve the default security of Electron
apps.

If you need this functionality, it can be replaced as follows:

```
// Main process
const { ipcMain, desktopCapturer } = require('electron')

ipcMain.handle(
'DESKTOP_CAPTURER_GET_SOURCES',
(event, opts) => desktopCapturer.getSources(opts)
)
```

```
// Renderer process
const { ipcRenderer } = require('electron')

const desktopCapturer = {
getSources: (opts) => ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts)
}
```

However, you should consider further restricting the information returned to
the renderer; for instance, displaying a source selector to the user and only
returning the selected source.

### Deprecated: `nativeWindowOpen`[â](#deprecated-nativewindowopen "Direct link to deprecated-nativewindowopen")

Prior to Electron 15, `window.open` was by default shimmed to use
`BrowserWindowProxy`. This meant that `window.open('about:blank')` did not work
to open synchronously scriptable child windows, among other incompatibilities.
Since Electron 15, `nativeWindowOpen` has been enabled by default.

See the documentation for [window.open in Electron](/docs/latest/api/window-open)
for more details.

## Planned Breaking API Changes (16.0)[â](#planned-breaking-api-changes-160 "Direct link to Planned Breaking API Changes (16.0)")

### Behavior Changed: `crashReporter` implementation switched to Crashpad on Linux[â](#behavior-changed-crashreporter-implementation-switched-to-crashpad-on-linux "Direct link to behavior-changed-crashreporter-implementation-switched-to-crashpad-on-linux")

The underlying implementation of the `crashReporter` API on Linux has changed
from Breakpad to Crashpad, bringing it in line with Windows and Mac. As a
result of this, child processes are now automatically monitored, and calling
`process.crashReporter.start` in Node child processes is no longer needed (and
is not advisable, as it will start a second instance of the Crashpad reporter).

There are also some subtle changes to how annotations will be reported on
Linux, including that long values will no longer be split between annotations
appended with `__1`, `__2` and so on, and instead will be truncated at the
(new, longer) annotation value limit.

### Deprecated: `desktopCapturer.getSources` in the renderer[â](#deprecated-desktopcapturergetsources-in-the-renderer "Direct link to deprecated-desktopcapturergetsources-in-the-renderer")

Usage of the `desktopCapturer.getSources` API in the renderer has been
deprecated and will be removed. This change improves the default security of
Electron apps.

See [here](#removed-desktopcapturergetsources-in-the-renderer) for details on
how to replace this API in your app.

## Planned Breaking API Changes (15.0)[â](#planned-breaking-api-changes-150 "Direct link to Planned Breaking API Changes (15.0)")

### Default Changed: `nativeWindowOpen` defaults to `true`[â](#default-changed-nativewindowopen-defaults-to-true "Direct link to default-changed-nativewindowopen-defaults-to-true")

Prior to Electron 15, `window.open` was by default shimmed to use
`BrowserWindowProxy`. This meant that `window.open('about:blank')` did not work
to open synchronously scriptable child windows, among other incompatibilities.
`nativeWindowOpen` is no longer experimental, and is now the default.

See the documentation for [window.open in Electron](/docs/latest/api/window-open)
for more details.

### Deprecated: `app.runningUnderRosettaTranslation`[â](#deprecated-apprunningunderrosettatranslation "Direct link to deprecated-apprunningunderrosettatranslation")

The `app.runningUnderRosettaTranslation` property has been deprecated.
Use `app.runningUnderARM64Translation` instead.

```
// Deprecated
console.log(app.runningUnderRosettaTranslation)
// Replace with
console.log(app.runningUnderARM64Translation)
```

## Planned Breaking API Changes (14.0)[â](#planned-breaking-api-changes-140 "Direct link to Planned Breaking API Changes (14.0)")

### Removed: `remote` module[â](#removed-remote-module "Direct link to removed-remote-module")

The `remote` module was deprecated in Electron 12, and will be removed in
Electron 14. It is replaced by the
[`@electron/remote`](https://github.com/electron/remote) module.

```
// Deprecated in Electron 12:
const { BrowserWindow } = require('electron').remote
```

```
// Replace with:
const { BrowserWindow } = require('@electron/remote')

// In the main process:
require('@electron/remote/main').initialize()
```

### Removed: `app.allowRendererProcessReuse`[â](#removed-appallowrendererprocessreuse "Direct link to removed-appallowrendererprocessreuse")

The `app.allowRendererProcessReuse` property will be removed as part of our plan to
more closely align with Chromium's process model for security, performance and maintainability.

For more detailed information see [#18397](https://github.com/electron/electron/issues/18397).

### Removed: Browser Window Affinity[â](#removed-browser-window-affinity "Direct link to Removed: Browser Window Affinity")

The `affinity` option when constructing a new `BrowserWindow` will be removed
as part of our plan to more closely align with Chromium's process model for security,
performance and maintainability.

For more detailed information see [#18397](https://github.com/electron/electron/issues/18397).

### API Changed: `window.open()`[â](#api-changed-windowopen "Direct link to api-changed-windowopen")

The optional parameter `frameName` will no longer set the title of the window. This now follows the specification described by the [native documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/open#parameters) under the corresponding parameter `windowName`.

If you were using this parameter to set the title of a window, you can instead use [win.setTitle(title)](/docs/latest/api/browser-window#winsettitletitle).

### Removed: `worldSafeExecuteJavaScript`[â](#removed-worldsafeexecutejavascript "Direct link to removed-worldsafeexecutejavascript")

In Electron 14, `worldSafeExecuteJavaScript` will be removed. There is no alternative, please
ensure your code works with this property enabled. It has been enabled by default since Electron
12.

You will be affected by this change if you use either `webFrame.executeJavaScript` or `webFrame.executeJavaScriptInIsolatedWorld`. You will need to ensure that values returned by either of those methods are supported by the [Context Bridge API](/docs/latest/api/context-bridge#parameter--error--return-type-support) as these methods use the same value passing semantics.

### Removed: BrowserWindowConstructorOptions inheriting from parent windows[â](#removed-browserwindowconstructoroptions-inheriting-from-parent-windows "Direct link to Removed: BrowserWindowConstructorOptions inheriting from parent windows")

Prior to Electron 14, windows opened with `window.open` would inherit
BrowserWindow constructor options such as `transparent` and `resizable` from
their parent window. Beginning with Electron 14, this behavior is removed, and
windows will not inherit any BrowserWindow constructor options from their
parents.

Instead, explicitly set options for the new window with `setWindowOpenHandler`:

```
webContents.setWindowOpenHandler((details) => {
return {
action: 'allow',
overrideBrowserWindowOptions: {
// ...
}
}
})
```

### Removed: `additionalFeatures`[â](#removed-additionalfeatures "Direct link to removed-additionalfeatures")

The deprecated `additionalFeatures` property in the `new-window` and
`did-create-window` events of WebContents has been removed. Since `new-window`
uses positional arguments, the argument is still present, but will always be
the empty array `[]`. (Though note, the `new-window` event itself is
deprecated, and is replaced by `setWindowOpenHandler`.) Bare keys in window
features will now present as keys with the value `true` in the options object.

```
// Removed in Electron 14
// Triggered by window.open('...', '', 'my-key')
webContents.on('did-create-window', (window, details) => {
if (details.additionalFeatures.includes('my-key')) {
// ...
}
})

// Replace with
webContents.on('did-create-window', (window, details) => {
if (details.options['my-key']) {
// ...
}
})
```

## Planned Breaking API Changes (13.0)[â](#planned-breaking-api-changes-130 "Direct link to Planned Breaking API Changes (13.0)")

### API Changed: `session.setPermissionCheckHandler(handler)`[â](#api-changed-sessionsetpermissioncheckhandlerhandler "Direct link to api-changed-sessionsetpermissioncheckhandlerhandler")

The `handler` methods first parameter was previously always a `webContents`, it can now sometimes be `null`. You should use the `requestingOrigin`, `embeddingOrigin` and `securityOrigin` properties to respond to the permission check correctly. As the `webContents` can be `null` it can no longer be relied on.

```
// Old code
session.setPermissionCheckHandler((webContents, permission) => {
if (webContents.getURL().startsWith('https://google.com/') && permission === 'notification') {
return true
}
return false
})

// Replace with
session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
if (new URL(requestingOrigin).hostname === 'google.com' && permission === 'notification') {
return true
}
return false
})
```

### Removed: `shell.moveItemToTrash()`[â](#removed-shellmoveitemtotrash "Direct link to removed-shellmoveitemtotrash")

The deprecated synchronous `shell.moveItemToTrash()` API has been removed. Use
the asynchronous `shell.trashItem()` instead.

```
// Removed in Electron 13
shell.moveItemToTrash(path)
// Replace with
shell.trashItem(path).then(/* ... */)
```

### Removed: `BrowserWindow` extension APIs[â](#removed-browserwindow-extension-apis "Direct link to removed-browserwindow-extension-apis")

The deprecated extension APIs have been removed:

* `BrowserWindow.addExtension(path)`
* `BrowserWindow.addDevToolsExtension(path)`
* `BrowserWindow.removeExtension(name)`
* `BrowserWindow.removeDevToolsExtension(name)`
* `BrowserWindow.getExtensions()`
* `BrowserWindow.getDevToolsExtensions()`

Use the session APIs instead:

* `ses.loadExtension(path)`
* `ses.removeExtension(extension_id)`
* `ses.getAllExtensions()`

```
// Removed in Electron 13
BrowserWindow.addExtension(path)
BrowserWindow.addDevToolsExtension(path)
// Replace with
session.defaultSession.loadExtension(path)
```

```
// Removed in Electron 13
BrowserWindow.removeExtension(name)
BrowserWindow.removeDevToolsExtension(name)
// Replace with
session.defaultSession.removeExtension(extension_id)
```

```
// Removed in Electron 13
BrowserWindow.getExtensions()
BrowserWindow.getDevToolsExtensions()
// Replace with
session.defaultSession.getAllExtensions()
```

### Removed: methods in `systemPreferences`[â](#removed-methods-in-systempreferences "Direct link to removed-methods-in-systempreferences")

The following `systemPreferences` methods have been deprecated:

* `systemPreferences.isDarkMode()`
* `systemPreferences.isInvertedColorScheme()`
* `systemPreferences.isHighContrastColorScheme()`

Use the following `nativeTheme` properties instead:

* `nativeTheme.shouldUseDarkColors`
* `nativeTheme.shouldUseInvertedColorScheme`
* `nativeTheme.shouldUseHighContrastColors`

```
// Removed in Electron 13
systemPreferences.isDarkMode()
// Replace with
nativeTheme.shouldUseDarkColors

// Removed in Electron 13
systemPreferences.isInvertedColorScheme()
// Replace with
nativeTheme.shouldUseInvertedColorScheme

// Removed in Electron 13
systemPreferences.isHighContrastColorScheme()
// Replace with
nativeTheme.shouldUseHighContrastColors
```

### Deprecated: WebContents `new-window` event[â](#deprecated-webcontents-new-window-event "Direct link to deprecated-webcontents-new-window-event")

The `new-window` event of WebContents has been deprecated. It is replaced by [`webContents.setWindowOpenHandler()`](/docs/latest/api/web-contents#contentssetwindowopenhandlerhandler).

```
// Deprecated in Electron 13
webContents.on('new-window', (event) => {
event.preventDefault()
})

// Replace with
webContents.setWindowOpenHandler((details) => {
return { action: 'deny' }
})
```

## Planned Breaking API Changes (12.0)[â](#planned-breaking-api-changes-120 "Direct link to Planned Breaking API Changes (12.0)")

### Removed: Pepper Flash support[â](#removed-pepper-flash-support "Direct link to Removed: Pepper Flash support")

Chromium has removed support for Flash, and so we must follow suit. See
Chromium's [Flash Roadmap](https://www.chromium.org/flash-roadmap) for more
details.

### Default Changed: `worldSafeExecuteJavaScript` defaults to `true`[â](#default-changed-worldsafeexecutejavascript-defaults-to-true "Direct link to default-changed-worldsafeexecutejavascript-defaults-to-true")

In Electron 12, `worldSafeExecuteJavaScript` will be enabled by default. To restore
the previous behavior, `worldSafeExecuteJavaScript: false` must be specified in WebPreferences.
Please note that setting this option to `false` is **insecure**.

This option will be removed in Electron 14 so please migrate your code to support the default
value.

### Default Changed: `contextIsolation` defaults to `true`[â](#default-changed-contextisolation-defaults-to-true "Direct link to default-changed-contextisolation-defaults-to-true")

In Electron 12, `contextIsolation` will be enabled by default. To restore
the previous behavior, `contextIsolation: false` must be specified in WebPreferences.

We [recommend having contextIsolation enabled](/docs/latest/tutorial/security#3-enable-context-isolation) for the security of your application.

Another implication is that `require()` cannot be used in the renderer process unless
`nodeIntegration` is `true` and `contextIsolation` is `false`.

For more details see: <https://github.com/electron/electron/issues/23506>

### Removed: `crashReporter.getCrashesDirectory()`[â](#removed-crashreportergetcrashesdirectory "Direct link to removed-crashreportergetcrashesdirectory")

The `crashReporter.getCrashesDirectory` method has been removed. Usage
should be replaced by `app.getPath('crashDumps')`.

```
// Removed in Electron 12
crashReporter.getCrashesDirectory()
// Replace with
app.getPath('crashDumps')
```

### Removed: `crashReporter` methods in the renderer process[â](#removed-crashreporter-methods-in-the-renderer-process "Direct link to removed-crashreporter-methods-in-the-renderer-process")

The following `crashReporter` methods are no longer available in the renderer
process:

* `crashReporter.start`
* `crashReporter.getLastCrashReport`
* `crashReporter.getUploadedReports`
* `crashReporter.getUploadToServer`
* `crashReporter.setUploadToServer`
* `crashReporter.getCrashesDirectory`

They should be called only from the main process.

See [#23265](https://github.com/electron/electron/pull/23265) for more details.

### Default Changed: `crashReporter.start({ compress: true })`[â](#default-changed-crashreporterstart-compress-true- "Direct link to default-changed-crashreporterstart-compress-true-")

The default value of the `compress` option to `crashReporter.start` has changed
from `false` to `true`. This means that crash dumps will be uploaded to the
crash ingestion server with the `Content-Encoding: gzip` header, and the body
will be compressed.

If your crash ingestion server does not support compressed payloads, you can
turn off compression by specifying `{ compress: false }` in the crash reporter
options.

### Deprecated: `remote` module[â](#deprecated-remote-module "Direct link to deprecated-remote-module")

The `remote` module is deprecated in Electron 12, and will be removed in
Electron 14. It is replaced by the
[`@electron/remote`](https://github.com/electron/remote) module.

```
// Deprecated in Electron 12:
const { BrowserWindow } = require('electron').remote
```

```
// Replace with:
const { BrowserWindow } = require('@electron/remote')

// In the main process:
require('@electron/remote/main').initialize()
```

### Deprecated: `shell.moveItemToTrash()`[â](#deprecated-shellmoveitemtotrash "Direct link to deprecated-shellmoveitemtotrash")

The synchronous `shell.moveItemToTrash()` has been replaced by the new,
asynchronous `shell.trashItem()`.

```
// Deprecated in Electron 12
shell.moveItemToTrash(path)
// Replace with
shell.trashItem(path).then(/* ... */)
```

## Planned Breaking API Changes (11.0)[â](#planned-breaking-api-changes-110 "Direct link to Planned Breaking API Changes (11.0)")

### Removed: `BrowserView.{destroy, fromId, fromWebContents, getAllViews}` and `id` property of `BrowserView`[â](#removed-browserviewdestroy-fromid-fromwebcontents-getallviews-and-id-property-of-browserview "Direct link to removed-browserviewdestroy-fromid-fromwebcontents-getallviews-and-id-property-of-browserview")

The experimental APIs `BrowserView.{destroy, fromId, fromWebContents, getAllViews}`
have now been removed. Additionally, the `id` property of `BrowserView`
has also been removed.

For more detailed information, see [#23578](https://github.com/electron/electron/pull/23578).

## Planned Breaking API Changes (10.0)[â](#planned-breaking-api-changes-100 "Direct link to Planned Breaking API Changes (10.0)")

### Deprecated: `companyName` argument to `crashReporter.start()`[â](#deprecated-companyname-argument-to-crashreporterstart "Direct link to deprecated-companyname-argument-to-crashreporterstart")

The `companyName` argument to `crashReporter.start()`, which was previously
required, is now optional, and further, is deprecated. To get the same
behavior in a non-deprecated way, you can pass a `companyName` value in
`globalExtra`.

```
// Deprecated in Electron 10
crashReporter.start({ companyName: 'Umbrella Corporation' })
// Replace with
crashReporter.start({ globalExtra: { _companyName: 'Umbrella Corporation' } })
```

### Deprecated: `crashReporter.getCrashesDirectory()`[â](#deprecated-crashreportergetcrashesdirectory "Direct link to deprecated-crashreportergetcrashesdirectory")

The `crashReporter.getCrashesDirectory` method has been deprecated. Usage
should be replaced by `app.getPath('crashDumps')`.

```
// Deprecated in Electron 10
crashReporter.getCrashesDirectory()
// Replace with
app.getPath('crashDumps')
```

### Deprecated: `crashReporter` methods in the renderer process[â](#deprecated-crashreporter-methods-in-the-renderer-process "Direct link to deprecated-crashreporter-methods-in-the-renderer-process")

Calling the following `crashReporter` methods from the renderer process is
deprecated:

* `crashReporter.start`
* `crashReporter.getLastCrashReport`
* `crashReporter.getUploadedReports`
* `crashReporter.getUploadToServer`
* `crashReporter.setUploadToServer`
* `crashReporter.getCrashesDirectory`

The only non-deprecated methods remaining in the `crashReporter` module in the
renderer are `addExtraParameter`, `removeExtraParameter` and `getParameters`.

All above methods remain non-deprecated when called from the main process.

See [#23265](https://github.com/electron/electron/pull/23265) for more details.

### Deprecated: `crashReporter.start({ compress: false })`[â](#deprecated-crashreporterstart-compress-false- "Direct link to deprecated-crashreporterstart-compress-false-")

Setting `{ compress: false }` in `crashReporter.start` is deprecated. Nearly
all crash ingestion servers support gzip compression. This option will be
removed in a future version of Electron.

### Default Changed: `enableRemoteModule` defaults to `false`[â](#default-changed-enableremotemodule-defaults-to-false "Direct link to default-changed-enableremotemodule-defaults-to-false")

In Electron 9, using the remote module without explicitly enabling it via the
`enableRemoteModule` WebPreferences option began emitting a warning. In
Electron 10, the remote module is now disabled by default. To use the remote
module, `enableRemoteModule: true` must be specified in WebPreferences:

```
const w = new BrowserWindow({
webPreferences: {
enableRemoteModule: true
}
})
```

We [recommend moving away from the remote module](https://medium.com/@nornagon/electrons-remote-module-considered-harmful-70d69500f31).

### `protocol.unregisterProtocol`[â](#protocolunregisterprotocol "Direct link to protocolunregisterprotocol")

### `protocol.uninterceptProtocol`[â](#protocoluninterceptprotocol "Direct link to protocoluninterceptprotocol")

The APIs are now synchronous and the optional callback is no longer needed.

```
// Deprecated
protocol.unregisterProtocol(scheme, () => { /* ... */ })
// Replace with
protocol.unregisterProtocol(scheme)
```

### `protocol.registerFileProtocol`[â](#protocolregisterfileprotocol "Direct link to protocolregisterfileprotocol")

### `protocol.registerBufferProtocol`[â](#protocolregisterbufferprotocol "Direct link to protocolregisterbufferprotocol")

### `protocol.registerStringProtocol`[â](#protocolregisterstringprotocol "Direct link to protocolregisterstringprotocol")

### `protocol.registerHttpProtocol`[â](#protocolregisterhttpprotocol "Direct link to protocolregisterhttpprotocol")

### `protocol.registerStreamProtocol`[â](#protocolregisterstreamprotocol "Direct link to protocolregisterstreamprotocol")

### `protocol.interceptFileProtocol`[â](#protocolinterceptfileprotocol "Direct link to protocolinterceptfileprotocol")

### `protocol.interceptStringProtocol`[â](#protocolinterceptstringprotocol "Direct link to protocolinterceptstringprotocol")

### `protocol.interceptBufferProtocol`[â](#protocolinterceptbufferprotocol "Direct link to protocolinterceptbufferprotocol")

### `protocol.interceptHttpProtocol`[â](#protocolintercepthttpprotocol "Direct link to protocolintercepthttpprotocol")

### `protocol.interceptStreamProtocol`[â](#protocolinterceptstreamprotocol "Direct link to protocolinterceptstreamprotocol")

The APIs are now synchronous and the optional callback is no longer needed.

```
// Deprecated
protocol.registerFileProtocol(scheme, handler, () => { /* ... */ })
// Replace with
protocol.registerFileProtocol(scheme, handler)
```

The registered or intercepted protocol does not have effect on current page
until navigation happens.

### `protocol.isProtocolHandled`[â](#protocolisprotocolhandled "Direct link to protocolisprotocolhandled")

This API is deprecated and users should use `protocol.isProtocolRegistered`
and `protocol.isProtocolIntercepted` instead.

```
// Deprecated
protocol.isProtocolHandled(scheme).then(() => { /* ... */ })
// Replace with
const isRegistered = protocol.isProtocolRegistered(scheme)
const isIntercepted = protocol.isProtocolIntercepted(scheme)
```

## Planned Breaking API Changes (9.0)[â](#planned-breaking-api-changes-90 "Direct link to Planned Breaking API Changes (9.0)")

### Default Changed: Loading non-context-aware native modules in the renderer process is disabled by default[â](#default-changed-loading-non-context-aware-native-modules-in-the-renderer-process-is-disabled-by-default "Direct link to Default Changed: Loading non-context-aware native modules in the renderer process is disabled by default")

As of Electron 9 we do not allow loading of non-context-aware native modules in
the renderer process. This is to improve security, performance and maintainability
of Electron as a project.

If this impacts you, you can temporarily set `app.allowRendererProcessReuse` to `false`
to revert to the old behavior. This flag will only be an option until Electron 11 so
you should plan to update your native modules to be context aware.

For more detailed information see [#18397](https://github.com/electron/electron/issues/18397).

### Deprecated: `BrowserWindow` extension APIs[â](#deprecated-browserwindow-extension-apis "Direct link to deprecated-browserwindow-extension-apis")

The following extension APIs have been deprecated:

* `BrowserWindow.addExtension(path)`
* `BrowserWindow.addDevToolsExtension(path)`
* `BrowserWindow.removeExtension(name)`
* `BrowserWindow.removeDevToolsExtension(name)`
* `BrowserWindow.getExtensions()`
* `BrowserWindow.getDevToolsExtensions()`

Use the session APIs instead:

* `ses.loadExtension(path)`
* `ses.removeExtension(extension_id)`
* `ses.getAllExtensions()`

```
// Deprecated in Electron 9
BrowserWindow.addExtension(path)
BrowserWindow.addDevToolsExtension(path)
// Replace with
session.defaultSession.loadExtension(path)
```

```
// Deprecated in Electron 9
BrowserWindow.removeExtension(name)
BrowserWindow.removeDevToolsExtension(name)
// Replace with
session.defaultSession.removeExtension(extension_id)
```

```
// Deprecated in Electron 9
BrowserWindow.getExtensions()
BrowserWindow.getDevToolsExtensions()
// Replace with
session.defaultSession.getAllExtensions()
```

### Removed: `<webview>.getWebContents()`[â](#removed-webviewgetwebcontents "Direct link to removed-webviewgetwebcontents")

This API, which was deprecated in Electron 8.0, is now removed.

```
// Removed in Electron 9.0
webview.getWebContents()
// Replace with
const { remote } = require('electron')
remote.webContents.fromId(webview.getWebContentsId())
```

### Removed: `webFrame.setLayoutZoomLevelLimits()`[â](#removed-webframesetlayoutzoomlevellimits "Direct link to removed-webframesetlayoutzoomlevellimits")

Chromium has removed support for changing the layout zoom level limits, and it
is beyond Electron's capacity to maintain it. The function was deprecated in
Electron 8.x, and has been removed in Electron 9.x. The layout zoom level limits
are now fixed at a minimum of 0.25 and a maximum of 5.0, as defined
[here](https://chromium.googlesource.com/chromium/src/+/938b37a6d2886bf8335fc7db792f1eb46c65b2ae/third_party/blink/common/page/page_zoom.cc#11).

### Behavior Changed: Sending non-JS objects over IPC now throws an exception[â](#behavior-changed-sending-non-js-objects-over-ipc-now-throws-an-exception "Direct link to Behavior Changed: Sending non-JS objects over IPC now throws an exception")

In Electron 8.0, IPC was changed to use the Structured Clone Algorithm,
bringing significant performance improvements. To help ease the transition, the
old IPC serialization algorithm was kept and used for some objects that aren't
serializable with Structured Clone. In particular, DOM objects (e.g. `Element`,
`Location` and `DOMMatrix`), Node.js objects backed by C++ classes (e.g.
`process.env`, some members of `Stream`), and Electron objects backed by C++
classes (e.g. `WebContents`, `BrowserWindow` and `WebFrame`) are not
serializable with Structured Clone. Whenever the old algorithm was invoked, a
deprecation warning was printed.

In Electron 9.0, the old serialization algorithm has been removed, and sending
such non-serializable objects will now throw an "object could not be cloned"
error.

### API Changed: `shell.openItem` is now `shell.openPath`[â](#api-changed-shellopenitem-is-now-shellopenpath "Direct link to api-changed-shellopenitem-is-now-shellopenpath")

The `shell.openItem` API has been replaced with an asynchronous `shell.openPath` API.
You can see the original API proposal and reasoning [here](https://github.com/electron/governance/blob/main/wg-api/spec-documents/shell-openitem.md).

## Planned Breaking API Changes (8.0)[â](#planned-breaking-api-changes-80 "Direct link to Planned Breaking API Changes (8.0)")

### Behavior Changed: Values sent over IPC are now serialized with Structured Clone Algorithm[â](#behavior-changed-values-sent-over-ipc-are-now-serialized-with-structured-clone-algorithm "Direct link to Behavior Changed: Values sent over IPC are now serialized with Structured Clone Algorithm")

The algorithm used to serialize objects sent over IPC (through `ipcRenderer.send`,
`ipcRenderer.sendSync`, `WebContents.send` and related methods) has been switched from a custom
algorithm to V8's built-in [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), the same algorithm used to serialize
messages for `postMessage`. This brings about a 2x performance improvement for large messages,
but also brings some breaking changes in behavior.

* Sending Functions, Promises, WeakMaps, WeakSets, or objects containing any
such values, over IPC will now throw an exception, instead of silently
converting the functions to `undefined`.

```
// Previously:
ipcRenderer.send('channel', { value: 3, someFunction: () => {} })
// => results in { value: 3 } arriving in the main process

// From Electron 8:
ipcRenderer.send('channel', { value: 3, someFunction: () => {} })
// => throws Error("() => {} could not be cloned.")
```

* `NaN`, `Infinity` and `-Infinity` will now be correctly serialized, instead
of being converted to `null`.
* Objects containing cyclic references will now be correctly serialized,
instead of being converted to `null`.
* `Set`, `Map`, `Error` and `RegExp` values will be correctly serialized,
instead of being converted to `{}`.
* `BigInt` values will be correctly serialized, instead of being converted to
`null`.
* Sparse arrays will be serialized as such, instead of being converted to dense
arrays with `null`s.
* `Date` objects will be transferred as `Date` objects, instead of being
converted to their ISO string representation.
* Typed Arrays (such as `Uint8Array`, `Uint16Array`, `Uint32Array` and so on)
will be transferred as such, instead of being converted to Node.js `Buffer`.
* Node.js `Buffer` objects will be transferred as `Uint8Array`s. You can
convert a `Uint8Array` back to a Node.js `Buffer` by wrapping the underlying
`ArrayBuffer`:

```
Buffer.from(value.buffer, value.byteOffset, value.byteLength)
```

Sending any objects that aren't native JS types, such as DOM objects (e.g.
`Element`, `Location`, `DOMMatrix`), Node.js objects (e.g. `process.env`,
`Stream`), or Electron objects (e.g. `WebContents`, `BrowserWindow`,
`WebFrame`) is deprecated. In Electron 8, these objects will be serialized as
before with a DeprecationWarning message, but starting in Electron 9, sending
these kinds of objects will throw a 'could not be cloned' error.

### Deprecated: `<webview>.getWebContents()`[â](#deprecated-webviewgetwebcontents "Direct link to deprecated-webviewgetwebcontents")

This API is implemented using the `remote` module, which has both performance
and security implications. Therefore its usage should be explicit.

```
// Deprecated
webview.getWebContents()
// Replace with
const { remote } = require('electron')
remote.webContents.fromId(webview.getWebContentsId())
```

However, it is recommended to avoid using the `remote` module altogether.

```
// main
const { ipcMain, webContents } = require('electron')

const getGuestForWebContents = (webContentsId, contents) => {
const guest = webContents.fromId(webContentsId)
if (!guest) {
throw new Error(`Invalid webContentsId: ${webContentsId}`)
}
if (guest.hostWebContents !== contents) {
throw new Error('Access denied to webContents')
}
return guest
}

ipcMain.handle('openDevTools', (event, webContentsId) => {
const guest = getGuestForWebContents(webContentsId, event.sender)
guest.openDevTools()
})

// renderer
const { ipcRenderer } = require('electron')

ipcRenderer.invoke('openDevTools', webview.getWebContentsId())
```

### Deprecated: `webFrame.setLayoutZoomLevelLimits()`[â](#deprecated-webframesetlayoutzoomlevellimits "Direct link to deprecated-webframesetlayoutzoomlevellimits")

Chromium has removed support for changing the layout zoom level limits, and it
is beyond Electron's capacity to maintain it. The function will emit a warning
in Electron 8.x, and cease to exist in Electron 9.x. The layout zoom level
limits are now fixed at a minimum of 0.25 and a maximum of 5.0, as defined
[here](https://chromium.googlesource.com/chromium/src/+/938b37a6d2886bf8335fc7db792f1eb46c65b2ae/third_party/blink/common/page/page_zoom.cc#11).

### Deprecated events in `systemPreferences`[â](#deprecated-events-in-systempreferences "Direct link to deprecated-events-in-systempreferences")

The following `systemPreferences` events have been deprecated:

* `inverted-color-scheme-changed`
* `high-contrast-color-scheme-changed`

Use the new `updated` event on the `nativeTheme` module instead.

```
// Deprecated
systemPreferences.on('inverted-color-scheme-changed', () => { /* ... */ })
systemPreferences.on('high-contrast-color-scheme-changed', () => { /* ... */ })

// Replace with
nativeTheme.on('updated', () => { /* ... */ })
```

### Deprecated: methods in `systemPreferences`[â](#deprecated-methods-in-systempreferences "Direct link to deprecated-methods-in-systempreferences")

The following `systemPreferences` methods have been deprecated:

* `systemPreferences.isDarkMode()`
* `systemPreferences.isInvertedColorScheme()`
* `systemPreferences.isHighContrastColorScheme()`

Use the following `nativeTheme` properties instead:

* `nativeTheme.shouldUseDarkColors`
* `nativeTheme.shouldUseInvertedColorScheme`
* `nativeTheme.shouldUseHighContrastColors`

```
// Deprecated
systemPreferences.isDarkMode()
// Replace with
nativeTheme.shouldUseDarkColors

// Deprecated
systemPreferences.isInvertedColorScheme()
// Replace with
nativeTheme.shouldUseInvertedColorScheme

// Deprecated
systemPreferences.isHighContrastColorScheme()
// Replace with
nativeTheme.shouldUseHighContrastColors
```

## Planned Breaking API Changes (7.0)[â](#planned-breaking-api-changes-70 "Direct link to Planned Breaking API Changes (7.0)")

### Deprecated: Atom.io Node Headers URL[â](#deprecated-atomio-node-headers-url "Direct link to Deprecated: Atom.io Node Headers URL")

This is the URL specified as `disturl` in a `.npmrc` file or as the `--dist-url`
command line flag when building native Node modules. Both will be supported for
the foreseeable future but it is recommended that you switch.

Deprecated: <https://atom.io/download/electron>

Replace with: <https://electronjs.org/headers>

### API Changed: `session.clearAuthCache()` no longer accepts options[â](#api-changed-sessionclearauthcache-no-longer-accepts-options "Direct link to api-changed-sessionclearauthcache-no-longer-accepts-options")

The `session.clearAuthCache` API no longer accepts options for what to clear, and instead unconditionally clears the whole cache.

```
// Deprecated
session.clearAuthCache({ type: 'password' })
// Replace with
session.clearAuthCache()
```

### API Changed: `powerMonitor.querySystemIdleState` is now `powerMonitor.getSystemIdleState`[â](#api-changed-powermonitorquerysystemidlestate-is-now-powermonitorgetsystemidlestate "Direct link to api-changed-powermonitorquerysystemidlestate-is-now-powermonitorgetsystemidlestate")

```
// Removed in Electron 7.0
powerMonitor.querySystemIdleState(threshold, callback)
// Replace with synchronous API
const idleState = powerMonitor.getSystemIdleState(threshold)
```

### API Changed: `powerMonitor.querySystemIdleTime` is now `powerMonitor.getSystemIdleTime`[â](#api-changed-powermonitorquerysystemidletime-is-now-powermonitorgetsystemidletime "Direct link to api-changed-powermonitorquerysystemidletime-is-now-powermonitorgetsystemidletime")

```
// Removed in Electron 7.0
powerMonitor.querySystemIdleTime(callback)
// Replace with synchronous API
const idleTime = powerMonitor.getSystemIdleTime()
```

### API Changed: `webFrame.setIsolatedWorldInfo` replaces separate methods[â](#api-changed-webframesetisolatedworldinfo-replaces-separate-methods "Direct link to api-changed-webframesetisolatedworldinfo-replaces-separate-methods")

```
// Removed in Electron 7.0
webFrame.setIsolatedWorldContentSecurityPolicy(worldId, csp)
webFrame.setIsolatedWorldHumanReadableName(worldId, name)
webFrame.setIsolatedWorldSecurityOrigin(worldId, securityOrigin)
// Replace with
webFrame.setIsolatedWorldInfo(
worldId,
{
securityOrigin: 'some_origin',
name: 'human_readable_name',
csp: 'content_security_policy'
})
```

### Removed: `marked` property on `getBlinkMemoryInfo`[â](#removed-marked-property-on-getblinkmemoryinfo "Direct link to removed-marked-property-on-getblinkmemoryinfo")

This property was removed in Chromium 77, and as such is no longer available.

### Behavior Changed: `webkitdirectory` attribute for `<input type="file"/>` now lists directory contents[â](#behavior-changed-webkitdirectory-attribute-for-input-typefile-now-lists-directory-contents "Direct link to behavior-changed-webkitdirectory-attribute-for-input-typefile-now-lists-directory-contents")

The `webkitdirectory` property on HTML file inputs allows them to select folders.
Previous versions of Electron had an incorrect implementation where the `event.target.files`
of the input returned a `FileList` that returned one `File` corresponding to the selected folder.

As of Electron 7, that `FileList` is now list of all files contained within
the folder, similarly to Chrome, Firefox, and Edge
([link to MDN docs](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory)).

As an illustration, take a folder with this structure:

```
folder
âââ file1
âââ file2
âââ file3
```

In Electron <=6, this would return a `FileList` with a `File` object for:

```
path/to/folder
```

In Electron 7, this now returns a `FileList` with a `File` object for:

```
/path/to/folder/file3
/path/to/folder/file2
/path/to/folder/file1
```

Note that `webkitdirectory` no longer exposes the path to the selected folder.
If you require the path to the selected folder rather than the folder contents,
see the `dialog.showOpenDialog` API ([link](/docs/latest/api/dialog#dialogshowopendialogwindow-options)).

### API Changed: Callback-based versions of promisified APIs[â](#api-changed-callback-based-versions-of-promisified-apis "Direct link to API Changed: Callback-based versions of promisified APIs")

Electron 5 and Electron 6 introduced Promise-based versions of existing
asynchronous APIs and deprecated their older, callback-based counterparts.
In Electron 7, all deprecated callback-based APIs are now removed.

These functions now only return Promises:

* `app.getFileIcon()` [#15742](https://github.com/electron/electron/pull/15742)
* `app.dock.show()` [#16904](https://github.com/electron/electron/pull/16904)
* `contentTracing.getCategories()` [#16583](https://github.com/electron/electron/pull/16583)
* `contentTracing.getTraceBufferUsage()` [#16600](https://github.com/electron/electron/pull/16600)
* `contentTracing.startRecording()` [#16584](https://github.com/electron/electron/pull/16584)
* `contentTracing.stopRecording()` [#16584](https://github.com/electron/electron/pull/16584)
* `contents.executeJavaScript()` [#17312](https://github.com/electron/electron/pull/17312)
* `cookies.flushStore()` [#16464](https://github.com/electron/electron/pull/16464)
* `cookies.get()` [#16464](https://github.com/electron/electron/pull/16464)
* `cookies.remove()` [#16464](https://github.com/electron/electron/pull/16464)
* `cookies.set()` [#16464](https://github.com/electron/electron/pull/16464)
* `debugger.sendCommand()` [#16861](https://github.com/electron/electron/pull/16861)
* `dialog.showCertificateTrustDialog()` [#17181](https://github.com/electron/electron/pull/17181)
* `inAppPurchase.getProducts()` [#17355](https://github.com/electron/electron/pull/17355)
* `inAppPurchase.purchaseProduct()`[#17355](https://github.com/electron/electron/pull/17355)
* `netLog.stopLogging()` [#16862](https://github.com/electron/electron/pull/16862)
* `session.clearAuthCache()` [#17259](https://github.com/electron/electron/pull/17259)
* `session.clearCache()` [#17185](https://github.com/electron/electron/pull/17185)
* `session.clearHostResolverCache()` [#17229](https://github.com/electron/electron/pull/17229)
* `session.clearStorageData()` [#17249](https://github.com/electron/electron/pull/17249)
* `session.getBlobData()` [#17303](https://github.com/electron/electron/pull/17303)
* `session.getCacheSize()` [#17185](https://github.com/electron/electron/pull/17185)
* `session.resolveProxy()` [#17222](https://github.com/electron/electron/pull/17222)
* `session.setProxy()` [#17222](https://github.com/electron/electron/pull/17222)
* `shell.openExternal()` [#16176](https://github.com/electron/electron/pull/16176)
* `webContents.loadFile()` [#15855](https://github.com/electron/electron/pull/15855)
* `webContents.loadURL()` [#15855](https://github.com/electron/electron/pull/15855)
* `webContents.hasServiceWorker()` [#16535](https://github.com/electron/electron/pull/16535)
* `webContents.printToPDF()` [#16795](https://github.com/electron/electron/pull/16795)
* `webContents.savePage()` [#16742](https://github.com/electron/electron/pull/16742)
* `webFrame.executeJavaScript()` [#17312](https://github.com/electron/electron/pull/17312)
* `webFrame.executeJavaScriptInIsolatedWorld()` [#17312](https://github.com/electron/electron/pull/17312)
* `webviewTag.executeJavaScript()` [#17312](https://github.com/electron/electron/pull/17312)
* `win.capturePage()` [#15743](https://github.com/electron/electron/pull/15743)

These functions now have two forms, synchronous and Promise-based asynchronous:

* `dialog.showMessageBox()`/`dialog.showMessageBoxSync()` [#17298](https://github.com/electron/electron/pull/17298)
* `dialog.showOpenDialog()`/`dialog.showOpenDialogSync()` [#16973](https://github.com/electron/electron/pull/16973)
* `dialog.showSaveDialog()`/`dialog.showSaveDialogSync()` [#17054](https://github.com/electron/electron/pull/17054)

## Planned Breaking API Changes (6.0)[â](#planned-breaking-api-changes-60 "Direct link to Planned Breaking API Changes (6.0)")

### API Changed: `win.setMenu(null)` is now `win.removeMenu()`[â](#api-changed-winsetmenunull-is-now-winremovemenu "Direct link to api-changed-winsetmenunull-is-now-winremovemenu")

```
// Deprecated
win.setMenu(null)
// Replace with
win.removeMenu()
```

### API Changed: `electron.screen` in the renderer process should be accessed via `remote`[â](#api-changed-electronscreen-in-the-renderer-process-should-be-accessed-via-remote "Direct link to api-changed-electronscreen-in-the-renderer-process-should-be-accessed-via-remote")

```
// Deprecated
require('electron').screen
// Replace with
require('electron').remote.screen
```

### API Changed: `require()`ing node builtins in sandboxed renderers no longer implicitly loads the `remote` version[â](#api-changed-requireing-node-builtins-in-sandboxed-renderers-no-longer-implicitly-loads-the-remote-version "Direct link to api-changed-requireing-node-builtins-in-sandboxed-renderers-no-longer-implicitly-loads-the-remote-version")

```
// Deprecated
require('child_process')
// Replace with
require('electron').remote.require('child_process')

// Deprecated
require('fs')
// Replace with
require('electron').remote.require('fs')

// Deprecated
require('os')
// Replace with
require('electron').remote.require('os')

// Deprecated
require('path')
// Replace with
require('electron').remote.require('path')
```

### Deprecated: `powerMonitor.querySystemIdleState` replaced with `powerMonitor.getSystemIdleState`[â](#deprecated-powermonitorquerysystemidlestate-replaced-with-powermonitorgetsystemidlestate "Direct link to deprecated-powermonitorquerysystemidlestate-replaced-with-powermonitorgetsystemidlestate")

```
// Deprecated
powerMonitor.querySystemIdleState(threshold, callback)
// Replace with synchronous API
const idleState = powerMonitor.getSystemIdleState(threshold)
```

### Deprecated: `powerMonitor.querySystemIdleTime` replaced with `powerMonitor.getSystemIdleTime`[â](#deprecated-powermonitorquerysystemidletime-replaced-with-powermonitorgetsystemidletime "Direct link to deprecated-powermonitorquerysystemidletime-replaced-with-powermonitorgetsystemidletime")

```
// Deprecated
powerMonitor.querySystemIdleTime(callback)
// Replace with synchronous API
const idleTime = powerMonitor.getSystemIdleTime()
```

### Deprecated: `app.enableMixedSandbox()` is no longer needed[â](#deprecated-appenablemixedsandbox-is-no-longer-needed "Direct link to deprecated-appenablemixedsandbox-is-no-longer-needed")

```
// Deprecated
app.enableMixedSandbox()
```

Mixed-sandbox mode is now enabled by default.

### Deprecated: `Tray.setHighlightMode`[â](#deprecated-traysethighlightmode "Direct link to deprecated-traysethighlightmode")

Under macOS Catalina our former Tray implementation breaks.
Apple's native substitute doesn't support changing the highlighting behavior.

```
// Deprecated
tray.setHighlightMode(mode)
// API will be removed in v7.0 without replacement.
```

## Planned Breaking API Changes (5.0)[â](#planned-breaking-api-changes-50 "Direct link to Planned Breaking API Changes (5.0)")

### Default Changed: `nodeIntegration` and `webviewTag` default to false, `contextIsolation` defaults to true[â](#default-changed-nodeintegration-and-webviewtag-default-to-false-contextisolation-defaults-to-true "Direct link to default-changed-nodeintegration-and-webviewtag-default-to-false-contextisolation-defaults-to-true")

The following `webPreferences` option default values are deprecated in favor of the new defaults listed below.

|  |  |  |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Property Deprecated Default New Default|  |  |  |  |  |  |  |  |  | | --- | --- | --- | --- | --- | --- | --- | --- | --- | | `contextIsolation` `false` `true`| `nodeIntegration` `true` `false`| `webviewTag` `nodeIntegration` if set else `true` `false` | | | | | | | | | | | |

E.g. Re-enabling the webviewTag

```
const w = new BrowserWindow({
webPreferences: {
webviewTag: true
}
})
```

### Behavior Changed: `nodeIntegration` in child windows opened via `nativeWindowOpen`[â](#behavior-changed-nodeintegration-in-child-windows-opened-via-nativewindowopen "Direct link to behavior-changed-nodeintegration-in-child-windows-opened-via-nativewindowopen")

Child windows opened with the `nativeWindowOpen` option will always have Node.js integration disabled, unless `nodeIntegrationInSubFrames` is `true`.

### API Changed: Registering privileged schemes must now be done before app ready[â](#api-changed-registering-privileged-schemes-must-now-be-done-before-app-ready "Direct link to API Changed: Registering privileged schemes must now be done before app ready")

Renderer process APIs `webFrame.registerURLSchemeAsPrivileged` and `webFrame.registerURLSchemeAsBypassingCSP` as well as browser process API `protocol.registerStandardSchemes` have been removed.
A new API, `protocol.registerSchemesAsPrivileged` has been added and should be used for registering custom schemes with the required privileges. Custom schemes are required to be registered before app ready.

### Deprecated: `webFrame.setIsolatedWorld*` replaced with `webFrame.setIsolatedWorldInfo`[â](#deprecated-webframesetisolatedworld-replaced-with-webframesetisolatedworldinfo "Direct link to deprecated-webframesetisolatedworld-replaced-with-webframesetisolatedworldinfo")

```
// Deprecated
webFrame.setIsolatedWorldContentSecurityPolicy(worldId, csp)
webFrame.setIsolatedWorldHumanReadableName(worldId, name)
webFrame.setIsolatedWorldSecurityOrigin(worldId, securityOrigin)
// Replace with
webFrame.setIsolatedWorldInfo(
worldId,
{
securityOrigin: 'some_origin',
name: 'human_readable_name',
csp: 'content_security_policy'
})
```

### API Changed: `webFrame.setSpellCheckProvider` now takes an asynchronous callback[â](#api-changed-webframesetspellcheckprovider-now-takes-an-asynchronous-callback "Direct link to api-changed-webframesetspellcheckprovider-now-takes-an-asynchronous-callback")

The `spellCheck` callback is now asynchronous, and `autoCorrectWord` parameter has been removed.

```
// Deprecated
webFrame.setSpellCheckProvider('en-US', true, {
spellCheck: (text) => {
return !spellchecker.isMisspelled(text)
}
})
// Replace with
webFrame.setSpellCheckProvider('en-US', {
spellCheck: (words, callback) => {
callback(words.filter(text => spellchecker.isMisspelled(text)))
}
})
```

### API Changed: `webContents.getZoomLevel` and `webContents.getZoomFactor` are now synchronous[â](#api-changed-webcontentsgetzoomlevel-and-webcontentsgetzoomfactor-are-now-synchronous "Direct link to api-changed-webcontentsgetzoomlevel-and-webcontentsgetzoomfactor-are-now-synchronous")

`webContents.getZoomLevel` and `webContents.getZoomFactor` no longer take callback parameters,
instead directly returning their number values.

```
// Deprecated
webContents.getZoomLevel((level) => {
console.log(level)
})
// Replace with
const level = webContents.getZoomLevel()
console.log(level)
```

```
// Deprecated
webContents.getZoomFactor((factor) => {
console.log(factor)
})
// Replace with
const factor = webContents.getZoomFactor()
console.log(factor)
```

## Planned Breaking API Changes (4.0)[â](#planned-breaking-api-changes-40 "Direct link to Planned Breaking API Changes (4.0)")

The following list includes the breaking API changes made in Electron 4.0.

### `app.makeSingleInstance`[â](#appmakesingleinstance "Direct link to appmakesingleinstance")

```
// Deprecated
app.makeSingleInstance((argv, cwd) => {
/* ... */
})
// Replace with
app.requestSingleInstanceLock()
app.on('second-instance', (event, argv, cwd) => {
/* ... */
})
```

### `app.releaseSingleInstance`[â](#appreleasesingleinstance "Direct link to appreleasesingleinstance")

```
// Deprecated
app.releaseSingleInstance()
// Replace with
app.releaseSingleInstanceLock()
```

### `app.getGPUInfo`[â](#appgetgpuinfo "Direct link to appgetgpuinfo")

```
app.getGPUInfo('complete')
// Now behaves the same with `basic` on macOS
app.getGPUInfo('basic')
```

### `win_delay_load_hook`[â](#win_delay_load_hook "Direct link to win_delay_load_hook")

When building native modules for windows, the `win_delay_load_hook` variable in
the module's `binding.gyp` must be true (which is the default). If this hook is
not present, then the native module will fail to load on Windows, with an error
message like `Cannot find module`.
See the [native module guide](/docs/latest/tutorial/using-native-node-modules) for more.

### Removed: IA32 Linux support[â](#removed-ia32-linux-support "Direct link to Removed: IA32 Linux support")

Electron 18 will no longer run on 32-bit Linux systems. See [discontinuing support for 32-bit Linux](https://www.electronjs.org/blog/linux-32bit-support) for more information.

## Breaking API Changes (3.0)[â](#breaking-api-changes-30 "Direct link to Breaking API Changes (3.0)")

The following list includes the breaking API changes in Electron 3.0.

### `app`[â](#app "Direct link to app")

```
// Deprecated
app.getAppMemoryInfo()
// Replace with
app.getAppMetrics()

// Deprecated
const metrics = app.getAppMetrics()
const { memory } = metrics[0] // Deprecated property
```

### `BrowserWindow`[â](#browserwindow "Direct link to browserwindow")

```
// Deprecated
const optionsA = { webPreferences: { blinkFeatures: '' } }
const windowA = new BrowserWindow(optionsA)
// Replace with
const optionsB = { webPreferences: { enableBlinkFeatures: '' } }
const windowB = new BrowserWindow(optionsB)

// Deprecated
window.on('app-command', (e, cmd) => {
if (cmd === 'media-play_pause') {
// do something
}
})
// Replace with
window.on('app-command', (e, cmd) => {
if (cmd === 'media-play-pause') {
// do something
}
})
```

### `clipboard`[â](#clipboard "Direct link to clipboard")

```
// Deprecated
clipboard.readRtf()
// Replace with
clipboard.readRTF()

// Deprecated
clipboard.writeRtf()
// Replace with
clipboard.writeRTF()

// Deprecated
clipboard.readHtml()
// Replace with
clipboard.readHTML()

// Deprecated
clipboard.writeHtml()
// Replace with
clipboard.writeHTML()
```

### `crashReporter`[â](#crashreporter "Direct link to crashreporter")

```
// Deprecated
crashReporter.start({
companyName: 'Crashly',
submitURL: 'https://crash.server.com',
autoSubmit: true
})
// Replace with
crashReporter.start({
companyName: 'Crashly',
submitURL: 'https://crash.server.com',
uploadToServer: true
})
```

### `nativeImage`[â](#nativeimage "Direct link to nativeimage")

```
// Deprecated
nativeImage.createFromBuffer(buffer, 1.0)
// Replace with
nativeImage.createFromBuffer(buffer, {
scaleFactor: 1.0
})
```

### `process`[â](#process "Direct link to process")

```
// Deprecated
const info = process.getProcessMemoryInfo()
```

### `screen`[â](#screen "Direct link to screen")

```
// Deprecated
screen.getMenuBarHeight()
// Replace with
screen.getPrimaryDisplay().workArea
```

### `session`[â](#session "Direct link to session")

```
// Deprecated
ses.setCertificateVerifyProc((hostname, certificate, callback) => {
callback(true)
})
// Replace with
ses.setCertificateVerifyProc((request, callback) => {
callback(0)
})
```

### `Tray`[â](#tray "Direct link to tray")

```
// Deprecated
tray.setHighlightMode(true)
// Replace with
tray.setHighlightMode('on')

// Deprecated
tray.setHighlightMode(false)
// Replace with
tray.setHighlightMode('off')
```

### `webContents`[â](#webcontents "Direct link to webcontents")

```
// Deprecated
webContents.openDevTools({ detach: true })
// Replace with
webContents.openDevTools({ mode: 'detach' })

// Removed
webContents.setSize(options)
// There is no replacement for this API
```

### `webFrame`[â](#webframe "Direct link to webframe")

```
// Deprecated
webFrame.registerURLSchemeAsSecure('app')
// Replace with
protocol.registerStandardSchemes(['app'], { secure: true })

// Deprecated
webFrame.registerURLSchemeAsPrivileged('app', { secure: true })
// Replace with
protocol.registerStandardSchemes(['app'], { secure: true })
```

### `<webview>`[â](#webview "Direct link to webview")

```
// Removed
webview.setAttribute('disableguestresize', '')
// There is no replacement for this API

// Removed
webview.setAttribute('guestinstance', instanceId)
// There is no replacement for this API

// Keyboard listeners no longer work on webview tag
webview.onkeydown = () => { /* handler */ }
webview.onkeyup = () => { /* handler */ }
```

### Node Headers URL[â](#node-headers-url "Direct link to Node Headers URL")

This is the URL specified as `disturl` in a `.npmrc` file or as the `--dist-url`
command line flag when building native Node modules.

Deprecated: <https://atom.io/download/atom-shell>

Replace with: <https://atom.io/download/electron>

## Breaking API Changes (2.0)[â](#breaking-api-changes-20 "Direct link to Breaking API Changes (2.0)")

The following list includes the breaking API changes made in Electron 2.0.

### `BrowserWindow`[â](#browserwindow-1 "Direct link to browserwindow-1")

```
// Deprecated
const optionsA = { titleBarStyle: 'hidden-inset' }
const windowA = new BrowserWindow(optionsA)
// Replace with
const optionsB = { titleBarStyle: 'hiddenInset' }
const windowB = new BrowserWindow(optionsB)
```

### `menu`[â](#menu "Direct link to menu")

```
// Removed
menu.popup(browserWindow, 100, 200, 2)
// Replaced with
menu.popup(browserWindow, { x: 100, y: 200, positioningItem: 2 })
```

### `nativeImage`[â](#nativeimage-1 "Direct link to nativeimage-1")

```
// Removed
nativeImage.toPng()
// Replaced with
nativeImage.toPNG()

// Removed
nativeImage.toJpeg()
// Replaced with
nativeImage.toJPEG()
```

### `process`[â](#process-1 "Direct link to process-1")

* `process.versions.electron` and `process.version.chrome` will be made
read-only properties for consistency with the other `process.versions`
properties set by Node.

### `webContents`[â](#webcontents-1 "Direct link to webcontents-1")

```
// Removed
webContents.setZoomLevelLimits(1, 2)
// Replaced with
webContents.setVisualZoomLevelLimits(1, 2)
```

### `webFrame`[â](#webframe-1 "Direct link to webframe-1")

```
// Removed
webFrame.setZoomLevelLimits(1, 2)
// Replaced with
webFrame.setVisualZoomLevelLimits(1, 2)
```

### `<webview>`[â](#webview-1 "Direct link to webview-1")

```
// Removed
webview.setZoomLevelLimits(1, 2)
// Replaced with
webview.setVisualZoomLevelLimits(1, 2)
```

### Duplicate ARM Assets[â](#duplicate-arm-assets "Direct link to Duplicate ARM Assets")

Each Electron release includes two identical ARM builds with slightly different
filenames, like `electron-v1.7.3-linux-arm.zip` and
`electron-v1.7.3-linux-armv7l.zip`. The asset with the `v7l` prefix was added
to clarify to users which ARM version it supports, and to disambiguate it from
future armv6l and arm64 assets that may be produced.

The file *without the prefix* is still being published to avoid breaking any
setups that may be consuming it. Starting at 2.0, the unprefixed file will
no longer be published.

For details, see
[6986](https://github.com/electron/electron/pull/6986)
and
[7189](https://github.com/electron/electron/pull/7189).

* [Types of Breaking Changes](#types-of-breaking-changes)* [Planned Breaking API Changes (40.0)](#planned-breaking-api-changes-400)
+ [Deprecated: `clipboard` API access from renderer processes](#deprecated-clipboard-api-access-from-renderer-processes)+ [Behavior Changed: MacOS dSYM files now compressed with tar.xz](#behavior-changed-macos-dsym-files-now-compressed-with-tarxz)* [Planned Breaking API Changes (39.0)](#planned-breaking-api-changes-390)
+ [Deprecated: `--host-rules` command line switch](#deprecated---host-rules-command-line-switch)+ [Behavior Changed: window.open popups are always resizable](#behavior-changed-windowopen-popups-are-always-resizable)+ [Behavior Changed: shared texture OSR `paint` event data structure](#behavior-changed-shared-texture-osr-paint-event-data-structure)* [Planned Breaking API Changes (38.0)](#planned-breaking-api-changes-380)
+ [Removed: `ELECTRON_OZONE_PLATFORM_HINT` environment variable](#removed-electron_ozone_platform_hint-environment-variable)+ [Removed: `ORIGINAL_XDG_CURRENT_DESKTOP` environment variable](#removed-original_xdg_current_desktop-environment-variable)+ [Removed: macOS 11 support](#removed-macos-11-support)+ [Removed: `plugin-crashed` event](#removed-plugin-crashed-event)+ [Deprecated: `webFrame.routingId` property](#deprecated-webframeroutingid-property)+ [Deprecated: `webFrame.findFrameByRoutingId(routingId)`](#deprecated-webframefindframebyroutingidroutingid)* [Planned Breaking API Changes (37.0)](#planned-breaking-api-changes-370)
+ [Utility Process unhandled rejection behavior change](#utility-process-unhandled-rejection-behavior-change)+ [Behavior Changed: `process.exit()` kills utility process synchronously](#behavior-changed-processexit-kills-utility-process-synchronously)+ [Behavior Changed: WebUSB and WebSerial Blocklist Support](#behavior-changed-webusb-and-webserial-blocklist-support)+ [Removed: `null` value for `session` property in `ProtocolResponse`](#removed-null-value-for-session-property-in-protocolresponse)+ [Behavior Changed: `BrowserWindow.IsVisibleOnAllWorkspaces()` on Linux](#behavior-changed-browserwindowisvisibleonallworkspaces-on-linux)* [Planned Breaking API Changes (36.0)](#planned-breaking-api-changes-360)
+ [Behavior Changes: `app.commandLine`](#behavior-changes-appcommandline)+ [Deprecated: `NativeImage.getBitmap()`](#deprecated-nativeimagegetbitmap)+ [Removed: `isDefault` and `status` properties on `PrinterInfo`](#removed-isdefault-and-status-properties-on-printerinfo)+ [Removed: `quota` type `syncable` in `Session.clearStorageData(options)`](#removed-quota-type-syncable-in-sessionclearstoragedataoptions)+ [Deprecated: `null` value for `session` property in `ProtocolResponse`](#deprecated-null-value-for-session-property-in-protocolresponse)+ [Deprecated: `quota` property in `Session.clearStorageData(options)`](#deprecated-quota-property-in-sessionclearstoragedataoptions)+ [Deprecated: Extension methods and events on `session`](#deprecated-extension-methods-and-events-on-session)+ [Removed: `systemPreferences.isAeroGlassEnabled()`](#removed-systempreferencesisaeroglassenabled)+ [Changed: GTK 4 is default when running GNOME](#changed-gtk-4-is-default-when-running-gnome)* [Planned Breaking API Changes (35.0)](#planned-breaking-api-changes-350)
+ [Behavior Changed: Dialog API's `defaultPath` option on Linux](#behavior-changed-dialog-apis-defaultpath-option-on-linux)+ [Deprecated: `getFromVersionID` on `session.serviceWorkers`](#deprecated-getfromversionid-on-sessionserviceworkers)+ [Deprecated: `setPreloads`, `getPreloads` on `Session`](#deprecated-setpreloads-getpreloads-on-session)+ [Deprecated: `level`, `message`, `line`, and `sourceId` arguments in `console-message` event on `WebContents`](#deprecated-level-message-line-and-sourceid-arguments-in-console-message-event-on-webcontents)+ [Behavior Changed: `urls` property of `WebRequestFilter`.](#behavior-changed-urls-property-of-webrequestfilter)+ [Deprecated: `systemPreferences.isAeroGlassEnabled()`](#deprecated-systempreferencesisaeroglassenabled)* [Planned Breaking API Changes (34.0)](#planned-breaking-api-changes-340)
+ [Behavior Changed: menu bar will be hidden during fullscreen on Windows](#behavior-changed-menu-bar-will-be-hidden-during-fullscreen-on-windows)* [Planned Breaking API Changes (33.0)](#planned-breaking-api-changes-330)
+ [Deprecated: `document.execCommand("paste")`](#deprecated-documentexeccommandpaste)+ [Behavior Changed: frame properties may retrieve detached WebFrameMain instances or none at all](#behavior-changed-frame-properties-may-retrieve-detached-webframemain-instances-or-none-at-all)+ [Behavior Changed: custom protocol URL handling on Windows](#behavior-changed-custom-protocol-url-handling-on-windows)+ [Behavior Changed: `webContents` property on `login` on `app`](#behavior-changed-webcontents-property-on-login-on-app)+ [Deprecated: `textured` option in `BrowserWindowConstructorOption.type`](#deprecated-textured-option-in-browserwindowconstructoroptiontype)+ [Removed: macOS 10.15 support](#removed-macos-1015-support)+ [Behavior Changed: Native modules now require C++20](#behavior-changed-native-modules-now-require-c20)+ [Deprecated: `systemPreferences.accessibilityDisplayShouldReduceTransparency`](#deprecated-systempreferencesaccessibilitydisplayshouldreducetransparency)* [Planned Breaking API Changes (32.0)](#planned-breaking-api-changes-320)
+ [Removed: `File.path`](#removed-filepath)+ [Deprecated: `clearHistory`, `canGoBack`, `goBack`, `canGoForward`, `goForward`, `goToIndex`, `canGoToOffset`, `goToOffset` on `WebContents`](#deprecated-clearhistory-cangoback-goback-cangoforward-goforward-gotoindex-cangotooffset-gotooffset-on-webcontents)+ [Behavior changed: Directory `databases` in `userData` will be deleted](#behavior-changed-directory-databases-in-userdata-will-be-deleted)* [Planned Breaking API Changes (31.0)](#planned-breaking-api-changes-310)
+ [Removed: `WebSQL` support](#removed-websql-support)+ [Behavior Changed: `nativeImage.toDataURL` will preserve PNG colorspace](#behavior-changed-nativeimagetodataurl-will-preserve-png-colorspace)+ [Behavior Changed: `window.flashFrame(bool)` will flash dock icon continuously on macOS](#behavior-changed-windowflashframebool-will-flash-dock-icon-continuously-on-macos)* [Planned Breaking API Changes (30.0)](#planned-breaking-api-changes-300)
+ [Behavior Changed: cross-origin iframes now use Permission Policy to access features](#behavior-changed-cross-origin-iframes-now-use-permission-policy-to-access-features)+ [Removed: The `--disable-color-correct-rendering` switch](#removed-the---disable-color-correct-rendering-switch)+ [Behavior Changed: `BrowserView.setAutoResize` behavior on macOS](#behavior-changed-browserviewsetautoresize-behavior-on-macos)+ [Deprecated: `BrowserView`](#deprecated-browserview)+ [Removed: `params.inputFormType` property on `context-menu` on `WebContents`](#removed-paramsinputformtype-property-on-context-menu-on-webcontents)+ [Removed: `process.getIOCounters()`](#removed-processgetiocounters)* [Planned Breaking API Changes (29.0)](#planned-breaking-api-changes-290)
+ [Behavior Changed: `ipcRenderer` can no longer be sent over the `contextBridge`](#behavior-changed-ipcrenderer-can-no-longer-be-sent-over-the-contextbridge)+ [Removed: `renderer-process-crashed` event on `app`](#removed-renderer-process-crashed-event-on-app)+ [Removed: `crashed` event on `WebContents` and `<webview>`](#removed-crashed-event-on-webcontents-and-webview)+ [Removed: `gpu-process-crashed` event on `app`](#removed-gpu-process-crashed-event-on-app)* [Planned Breaking API Changes (28.0)](#planned-breaking-api-changes-280)
+ [Behavior Changed: `WebContents.backgroundThrottling` set to false affects all `WebContents` in the host `BrowserWindow`](#behavior-changed-webcontentsbackgroundthrottling-set-to-false-affects-all-webcontents-in-the-host-browserwindow)+ [Removed: `BrowserWindow.setTrafficLightPosition(position)`](#removed-browserwindowsettrafficlightpositionposition)+ [Removed: `BrowserWindow.getTrafficLightPosition()`](#removed-browserwindowgettrafficlightposition)+ [Removed: `ipcRenderer.sendTo()`](#removed-ipcrenderersendto)+ [Removed: `app.runningUnderRosettaTranslation`](#removed-apprunningunderrosettatranslation)+ [Deprecated: `renderer-process-crashed` event on `app`](#deprecated-renderer-process-crashed-event-on-app)+ [Deprecated: `params.inputFormType` property on `context-menu` on `WebContents`](#deprecated-paramsinputformtype-property-on-context-menu-on-webcontents)+ [Deprecated: `crashed` event on `WebContents` and `<webview>`](#deprecated-crashed-event-on-webcontents-and-webview)+ [Deprecated: `gpu-process-crashed` event on `app`](#deprecated-gpu-process-crashed-event-on-app)* [Planned Breaking API Changes (27.0)](#planned-breaking-api-changes-270)
+ [Removed: macOS 10.13 / 10.14 support](#removed-macos-1013--1014-support)+ [Deprecated: `ipcRenderer.sendTo()`](#deprecated-ipcrenderersendto)+ [Removed: color scheme events in `systemPreferences`](#removed-color-scheme-events-in-systempreferences)+ [Removed: Some `window.setVibrancy` options on macOS](#removed-some-windowsetvibrancy-options-on-macos)+ [Removed: `webContents.getPrinters`](#removed-webcontentsgetprinters)+ [Removed: `systemPreferences.{get,set}AppLevelAppearance` and `systemPreferences.appLevelAppearance`](#removed-systempreferencesgetsetapplevelappearance-and-systempreferencesapplevelappearance)+ [Removed: `alternate-selected-control-text` value for `systemPreferences.getColor`](#removed-alternate-selected-control-text-value-for-systempreferencesgetcolor)* [Planned Breaking API Changes (26.0)](#planned-breaking-api-changes-260)
+ [Deprecated: `webContents.getPrinters`](#deprecated-webcontentsgetprinters)+ [Deprecated: `systemPreferences.{get,set}AppLevelAppearance` and `systemPreferences.appLevelAppearance`](#deprecated-systempreferencesgetsetapplevelappearance-and-systempreferencesapplevelappearance)+ [Deprecated: `alternate-selected-control-text` value for `systemPreferences.getColor`](#deprecated-alternate-selected-control-text-value-for-systempreferencesgetcolor)* [Planned Breaking API Changes (25.0)](#planned-breaking-api-changes-250)
+ [Deprecated: `protocol.{un,}{register,intercept}{Buffer,String,Stream,File,Http}Protocol` and `protocol.isProtocol{Registered,Intercepted}`](#deprecated-protocolunregisterinterceptbufferstringstreamfilehttpprotocol-and-protocolisprotocolregisteredintercepted)+ [Deprecated: `BrowserWindow.setTrafficLightPosition(position)`](#deprecated-browserwindowsettrafficlightpositionposition)+ [Deprecated: `BrowserWindow.getTrafficLightPosition()`](#deprecated-browserwindowgettrafficlightposition)* [Planned Breaking API Changes (24.0)](#planned-breaking-api-changes-240)
+ [API Changed: `nativeImage.createThumbnailFromPath(path, size)`](#api-changed-nativeimagecreatethumbnailfrompathpath-size)* [Planned Breaking API Changes (23.0)](#planned-breaking-api-changes-230)
+ [Behavior Changed: Draggable Regions on macOS](#behavior-changed-draggable-regions-on-macos)+ [Removed: Windows 7 / 8 / 8.1 support](#removed-windows-7--8--81-support)+ [Removed: BrowserWindow `scroll-touch-*` events](#removed-browserwindow-scroll-touch--events)+ [Removed: `webContents.incrementCapturerCount(stayHidden, stayAwake)`](#removed-webcontentsincrementcapturercountstayhidden-stayawake)+ [Removed: `webContents.decrementCapturerCount(stayHidden, stayAwake)`](#removed-webcontentsdecrementcapturercountstayhidden-stayawake)* [Planned Breaking API Changes (22.0)](#planned-breaking-api-changes-220)
+ [Deprecated: `webContents.incrementCapturerCount(stayHidden, stayAwake)`](#deprecated-webcontentsincrementcapturercountstayhidden-stayawake)+ [Deprecated: `webContents.decrementCapturerCount(stayHidden, stayAwake)`](#deprecated-webcontentsdecrementcapturercountstayhidden-stayawake)+ [Removed: WebContents `new-window` event](#removed-webcontents-new-window-event)+ [Removed: `<webview>` `new-window` event](#removed-webview-new-window-event)+ [Deprecated: BrowserWindow `scroll-touch-*` events](#deprecated-browserwindow-scroll-touch--events)* [Planned Breaking API Changes (21.0)](#planned-breaking-api-changes-210)
+ [Behavior Changed: V8 Memory Cage enabled](#behavior-changed-v8-memory-cage-enabled)+ [API Changed: `webContents.printToPDF()`](#api-changed-webcontentsprinttopdf)* [Planned Breaking API Changes (20.0)](#planned-breaking-api-changes-200)
+ [Removed: macOS 10.11 / 10.12 support](#removed-macos-1011--1012-support)+ [Default Changed: renderers without `nodeIntegration: true` are sandboxed by default](#default-changed-renderers-without-nodeintegration-true-are-sandboxed-by-default)+ [Removed: `skipTaskbar` on Linux](#removed-skiptaskbar-on-linux)+ [API Changed: `session.setDevicePermissionHandler(handler)`](#api-changed-sessionsetdevicepermissionhandlerhandler)* [Planned Breaking API Changes (19.0)](#planned-breaking-api-changes-190)
+ [Removed: IA32 Linux binaries](#removed-ia32-linux-binaries)* [Planned Breaking API Changes (18.0)](#planned-breaking-api-changes-180)
+ [Removed: `nativeWindowOpen`](#removed-nativewindowopen)* [Planned Breaking API Changes (17.0)](#planned-breaking-api-changes-170)
+ [Removed: `desktopCapturer.getSources` in the renderer](#removed-desktopcapturergetsources-in-the-renderer)+ [Deprecated: `nativeWindowOpen`](#deprecated-nativewindowopen)* [Planned Breaking API Changes (16.0)](#planned-breaking-api-changes-160)
+ [Behavior Changed: `crashReporter` implementation switched to Crashpad on Linux](#behavior-changed-crashreporter-implementation-switched-to-crashpad-on-linux)+ [Deprecated: `desktopCapturer.getSources` in the renderer](#deprecated-desktopcapturergetsources-in-the-renderer)* [Planned Breaking API Changes (15.0)](#planned-breaking-api-changes-150)
+ [Default Changed: `nativeWindowOpen` defaults to `true`](#default-changed-nativewindowopen-defaults-to-true)+ [Deprecated: `app.runningUnderRosettaTranslation`](#deprecated-apprunningunderrosettatranslation)* [Planned Breaking API Changes (14.0)](#planned-breaking-api-changes-140)
+ [Removed: `remote` module](#removed-remote-module)+ [Removed: `app.allowRendererProcessReuse`](#removed-appallowrendererprocessreuse)+ [Removed: Browser Window Affinity](#removed-browser-window-affinity)+ [API Changed: `window.open()`](#api-changed-windowopen)+ [Removed: `worldSafeExecuteJavaScript`](#removed-worldsafeexecutejavascript)+ [Removed: BrowserWindowConstructorOptions inheriting from parent windows](#removed-browserwindowconstructoroptions-inheriting-from-parent-windows)+ [Removed: `additionalFeatures`](#removed-additionalfeatures)* [Planned Breaking API Changes (13.0)](#planned-breaking-api-changes-130)
+ [API Changed: `session.setPermissionCheckHandler(handler)`](#api-changed-sessionsetpermissioncheckhandlerhandler)+ [Removed: `shell.moveItemToTrash()`](#removed-shellmoveitemtotrash)+ [Removed: `BrowserWindow` extension APIs](#removed-browserwindow-extension-apis)+ [Removed: methods in `systemPreferences`](#removed-methods-in-systempreferences)+ [Deprecated: WebContents `new-window` event](#deprecated-webcontents-new-window-event)* [Planned Breaking API Changes (12.0)](#planned-breaking-api-changes-120)
+ [Removed: Pepper Flash support](#removed-pepper-flash-support)+ [Default Changed: `worldSafeExecuteJavaScript` defaults to `true`](#default-changed-worldsafeexecutejavascript-defaults-to-true)+ [Default Changed: `contextIsolation` defaults to `true`](#default-changed-contextisolation-defaults-to-true)+ [Removed: `crashReporter.getCrashesDirectory()`](#removed-crashreportergetcrashesdirectory)+ [Removed: `crashReporter` methods in the renderer process](#removed-crashreporter-methods-in-the-renderer-process)+ [Default Changed: `crashReporter.start({ compress: true })`](#default-changed-crashreporterstart-compress-true-)+ [Deprecated: `remote` module](#deprecated-remote-module)+ [Deprecated: `shell.moveItemToTrash()`](#deprecated-shellmoveitemtotrash)* [Planned Breaking API Changes (11.0)](#planned-breaking-api-changes-110)
+ [Removed: `BrowserView.{destroy, fromId, fromWebContents, getAllViews}` and `id` property of `BrowserView`](#removed-browserviewdestroy-fromid-fromwebcontents-getallviews-and-id-property-of-browserview)* [Planned Breaking API Changes (10.0)](#planned-breaking-api-changes-100)
+ [Deprecated: `companyName` argument to `crashReporter.start()`](#deprecated-companyname-argument-to-crashreporterstart)+ [Deprecated: `crashReporter.getCrashesDirectory()`](#deprecated-crashreportergetcrashesdirectory)+ [Deprecated: `crashReporter` methods in the renderer process](#deprecated-crashreporter-methods-in-the-renderer-process)+ [Deprecated: `crashReporter.start({ compress: false })`](#deprecated-crashreporterstart-compress-false-)+ [Default Changed: `enableRemoteModule` defaults to `false`](#default-changed-enableremotemodule-defaults-to-false)+ [`unregisterProtocol`](#protocolunregisterprotocol)+ [`uninterceptProtocol`](#protocoluninterceptprotocol)+ [`registerFileProtocol`](#protocolregisterfileprotocol)+ [`registerBufferProtocol`](#protocolregisterbufferprotocol)+ [`registerStringProtocol`](#protocolregisterstringprotocol)+ [`registerHttpProtocol`](#protocolregisterhttpprotocol)+ [`registerStreamProtocol`](#protocolregisterstreamprotocol)+ [`interceptFileProtocol`](#protocolinterceptfileprotocol)+ [`interceptStringProtocol`](#protocolinterceptstringprotocol)+ [`interceptBufferProtocol`](#protocolinterceptbufferprotocol)+ [`interceptHttpProtocol`](#protocolintercepthttpprotocol)+ [`interceptStreamProtocol`](#protocolinterceptstreamprotocol)+ [`isProtocolHandled`](#protocolisprotocolhandled)* [Planned Breaking API Changes (9.0)](#planned-breaking-api-changes-90)
+ [Default Changed: Loading non-context-aware native modules in the renderer process is disabled by default](#default-changed-loading-non-context-aware-native-modules-in-the-renderer-process-is-disabled-by-default)+ [Deprecated: `BrowserWindow` extension APIs](#deprecated-browserwindow-extension-apis)+ [Removed: `<webview>.getWebContents()`](#removed-webviewgetwebcontents)+ [Removed: `webFrame.setLayoutZoomLevelLimits()`](#removed-webframesetlayoutzoomlevellimits)+ [Behavior Changed: Sending non-JS objects over IPC now throws an exception](#behavior-changed-sending-non-js-objects-over-ipc-now-throws-an-exception)+ [API Changed: `shell.openItem` is now `shell.openPath`](#api-changed-shellopenitem-is-now-shellopenpath)* [Planned Breaking API Changes (8.0)](#planned-breaking-api-changes-80)
+ [Behavior Changed: Values sent over IPC are now serialized with Structured Clone Algorithm](#behavior-changed-values-sent-over-ipc-are-now-serialized-with-structured-clone-algorithm)+ [Deprecated: `<webview>.getWebContents()`](#deprecated-webviewgetwebcontents)+ [Deprecated: `webFrame.setLayoutZoomLevelLimits()`](#deprecated-webframesetlayoutzoomlevellimits)+ [Deprecated events in `systemPreferences`](#deprecated-events-in-systempreferences)+ [Deprecated: methods in `systemPreferences`](#deprecated-methods-in-systempreferences)* [Planned Breaking API Changes (7.0)](#planned-breaking-api-changes-70)
+ [Deprecated: Atom.io Node Headers URL](#deprecated-atomio-node-headers-url)+ [API Changed: `session.clearAuthCache()` no longer accepts options](#api-changed-sessionclearauthcache-no-longer-accepts-options)+ [API Changed: `powerMonitor.querySystemIdleState` is now `powerMonitor.getSystemIdleState`](#api-changed-powermonitorquerysystemidlestate-is-now-powermonitorgetsystemidlestate)+ [API Changed: `powerMonitor.querySystemIdleTime` is now `powerMonitor.getSystemIdleTime`](#api-changed-powermonitorquerysystemidletime-is-now-powermonitorgetsystemidletime)+ [API Changed: `webFrame.setIsolatedWorldInfo` replaces separate methods](#api-changed-webframesetisolatedworldinfo-replaces-separate-methods)+ [Removed: `marked` property on `getBlinkMemoryInfo`](#removed-marked-property-on-getblinkmemoryinfo)+ [Behavior Changed: `webkitdirectory` attribute for `<input type="file"/>` now lists directory contents](#behavior-changed-webkitdirectory-attribute-for-input-typefile-now-lists-directory-contents)+ [API Changed: Callback-based versions of promisified APIs](#api-changed-callback-based-versions-of-promisified-apis)* [Planned Breaking API Changes (6.0)](#planned-breaking-api-changes-60)
+ [API Changed: `win.setMenu(null)` is now `win.removeMenu()`](#api-changed-winsetmenunull-is-now-winremovemenu)+ [API Changed: `electron.screen` in the renderer process should be accessed via `remote`](#api-changed-electronscreen-in-the-renderer-process-should-be-accessed-via-remote)+ [API Changed: `require()`ing node builtins in sandboxed renderers no longer implicitly loads the `remote` version](#api-changed-requireing-node-builtins-in-sandboxed-renderers-no-longer-implicitly-loads-the-remote-version)+ [Deprecated: `powerMonitor.querySystemIdleState` replaced with `powerMonitor.getSystemIdleState`](#deprecated-powermonitorquerysystemidlestate-replaced-with-powermonitorgetsystemidlestate)+ [Deprecated: `powerMonitor.querySystemIdleTime` replaced with `powerMonitor.getSystemIdleTime`](#deprecated-powermonitorquerysystemidletime-replaced-with-powermonitorgetsystemidletime)+ [Deprecated: `app.enableMixedSandbox()` is no longer needed](#deprecated-appenablemixedsandbox-is-no-longer-needed)+ [Deprecated: `Tray.setHighlightMode`](#deprecated-traysethighlightmode)* [Planned Breaking API Changes (5.0)](#planned-breaking-api-changes-50)
+ [Default Changed: `nodeIntegration` and `webviewTag` default to false, `contextIsolation` defaults to true](#default-changed-nodeintegration-and-webviewtag-default-to-false-contextisolation-defaults-to-true)+ [Behavior Changed: `nodeIntegration` in child windows opened via `nativeWindowOpen`](#behavior-changed-nodeintegration-in-child-windows-opened-via-nativewindowopen)+ [API Changed: Registering privileged schemes must now be done before app ready](#api-changed-registering-privileged-schemes-must-now-be-done-before-app-ready)+ [Deprecated: `webFrame.setIsolatedWorld*` replaced with `webFrame.setIsolatedWorldInfo`](#deprecated-webframesetisolatedworld-replaced-with-webframesetisolatedworldinfo)+ [API Changed: `webFrame.setSpellCheckProvider` now takes an asynchronous callback](#api-changed-webframesetspellcheckprovider-now-takes-an-asynchronous-callback)+ [API Changed: `webContents.getZoomLevel` and `webContents.getZoomFactor` are now synchronous](#api-changed-webcontentsgetzoomlevel-and-webcontentsgetzoomfactor-are-now-synchronous)* [Planned Breaking API Changes (4.0)](#planned-breaking-api-changes-40)
+ [`makeSingleInstance`](#appmakesingleinstance)+ [`releaseSingleInstance`](#appreleasesingleinstance)+ [`getGPUInfo`](#appgetgpuinfo)+ [`win_delay_load_hook`](#win_delay_load_hook)+ [Removed: IA32 Linux support](#removed-ia32-linux-support)* [Breaking API Changes (3.0)](#breaking-api-changes-30)
+ [`app`](#app)+ [`BrowserWindow`](#browserwindow)+ [`clipboard`](#clipboard)+ [`crashReporter`](#crashreporter)+ [`nativeImage`](#nativeimage)+ [`process`](#process)+ [`screen`](#screen)+ [`session`](#session)+ [`Tray`](#tray)+ [`webContents`](#webcontents)+ [`webFrame`](#webframe)+ [`<webview>`](#webview)+ [Node Headers URL](#node-headers-url)* [Breaking API Changes (2.0)](#breaking-api-changes-20)
+ [`BrowserWindow`](#browserwindow-1)+ [`menu`](#menu)+ [`nativeImage`](#nativeimage-1)+ [`process`](#process-1)+ [`webContents`](#webcontents-1)+ [`webFrame`](#webframe-1)+ [`<webview>`](#webview-1)+ [Duplicate ARM Assets](#duplicate-arm-assets)