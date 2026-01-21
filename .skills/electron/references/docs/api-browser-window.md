# Source: https://www.electronjs.org/docs/latest/api/browser-window

On this page

> Create and control browser windows.

Process: [Main](/docs/latest/glossary#main-process)

This module cannot be used until the `ready` event of the `app`
module is emitted.

```
// In the main process.
const { BrowserWindow } = require('electron')

const win = new BrowserWindow({ width: 800, height: 600 })

// Load a remote URL
win.loadURL('https://github.com')

// Or load a local HTML file
win.loadFile('index.html')
```

## Window customization[â](#window-customization "Direct link to Window customization")

The `BrowserWindow` class exposes various ways to modify the look and behavior of
your app's windows. For more details, see the [Window Customization](/docs/latest/tutorial/window-customization)
tutorial.

## Showing the window gracefully[â](#showing-the-window-gracefully "Direct link to Showing the window gracefully")

When loading a page in the window directly, users may see the page load incrementally,
which is not a good experience for a native app. To make the window display
without a visual flash, there are two solutions for different situations.

### Using the `ready-to-show` event[â](#using-the-ready-to-show-event "Direct link to using-the-ready-to-show-event")

While loading the page, the `ready-to-show` event will be emitted when the renderer
process has rendered the page for the first time if the window has not been shown yet. Showing
the window after this event will have no visual flash:

```
const { BrowserWindow } = require('electron')

const win = new BrowserWindow({ show: false })
win.once('ready-to-show', () => {
win.show()
})
```

This event is usually emitted after the `did-finish-load` event, but for
pages with many remote resources, it may be emitted before the `did-finish-load`
event.

Please note that using this event implies that the renderer will be considered "visible" and
paint even though `show` is false. This event will never fire if you use `paintWhenInitiallyHidden: false`

### Setting the `backgroundColor` property[â](#setting-the-backgroundcolor-property "Direct link to setting-the-backgroundcolor-property")

For a complex app, the `ready-to-show` event could be emitted too late, making
the app feel slow. In this case, it is recommended to show the window
immediately, and use a `backgroundColor` close to your app's background:

```
const { BrowserWindow } = require('electron')

const win = new BrowserWindow({ backgroundColor: '#2e2c29' })
win.loadURL('https://github.com')
```

Note that even for apps that use `ready-to-show` event, it is still recommended
to set `backgroundColor` to make the app feel more native.

Some examples of valid `backgroundColor` values include:

```
const win = new BrowserWindow()
win.setBackgroundColor('hsl(230, 100%, 50%)')
win.setBackgroundColor('rgb(255, 145, 145)')
win.setBackgroundColor('#ff00a3')
win.setBackgroundColor('blueviolet')
```

For more information about these color types see valid options in [win.setBackgroundColor](/docs/latest/api/browser-window#winsetbackgroundcolorbackgroundcolor).

## Parent and child windows[â](#parent-and-child-windows "Direct link to Parent and child windows")

By using `parent` option, you can create child windows:

```
const { BrowserWindow } = require('electron')

const top = new BrowserWindow()
const child = new BrowserWindow({ parent: top })
child.show()
top.show()
```

The `child` window will always show on top of the `top` window.

## Modal windows[â](#modal-windows "Direct link to Modal windows")

A modal window is a child window that disables parent window. To create a modal
window, you have to set both the `parent` and `modal` options:

```
const { BrowserWindow } = require('electron')

const top = new BrowserWindow()
const child = new BrowserWindow({ parent: top, modal: true, show: false })
child.loadURL('https://github.com')
child.once('ready-to-show', () => {
child.show()
})
```

## Page visibility[â](#page-visibility "Direct link to Page visibility")

The [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) works as follows:

* On all platforms, the visibility state tracks whether the window is
hidden/minimized or not.
* Additionally, on macOS, the visibility state also tracks the window
occlusion state. If the window is occluded (i.e. fully covered) by another
window, the visibility state will be `hidden`. On other platforms, the
visibility state will be `hidden` only when the window is minimized or
explicitly hidden with `win.hide()`.
* If a `BrowserWindow` is created with `show: false`, the initial visibility
state will be `visible` despite the window actually being hidden.
* If `backgroundThrottling` is disabled, the visibility state will remain
`visible` even if the window is minimized, occluded, or hidden.

It is recommended that you pause expensive operations when the visibility
state is `hidden` in order to minimize power consumption.

## Platform notices[â](#platform-notices "Direct link to Platform notices")

* On macOS modal windows will be displayed as sheets attached to the parent window.
* On macOS the child windows will keep the relative position to parent window
when parent window moves, while on Windows and Linux child windows will not
move.
* On Linux the type of modal windows will be changed to `dialog`.
* On Linux many desktop environments do not support hiding a modal window.

## Class: BrowserWindow extends `BaseWindow`[â](#class-browserwindow-extends-basewindow "Direct link to class-browserwindow-extends-basewindow")

> Create and control browser windows.

Process: [Main](/docs/latest/glossary#main-process)

`BrowserWindow` is an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter).

It creates a new `BrowserWindow` with native properties as set by the `options`.

warning

Electron's built-in classes cannot be subclassed in user code.
For more information, see [the FAQ](/docs/latest/faq#class-inheritance-does-not-work-with-electron-built-in-modules).

### `new BrowserWindow([options])`[â](#new-browserwindowoptions "Direct link to new-browserwindowoptions")

* `options` [BrowserWindowConstructorOptions](/docs/latest/api/structures/browser-window-options) (optional)
+ `webPreferences` [WebPreferences](/docs/latest/api/structures/web-preferences) (optional) - Settings of web page's features.
- `devTools` boolean (optional) - Whether to enable DevTools. If it is set to `false`, can not use `BrowserWindow.webContents.openDevTools()` to open DevTools. Default is `true`.
- `nodeIntegration` boolean (optional) - Whether node integration is enabled.
Default is `false`.
- `nodeIntegrationInWorker` boolean (optional) - Whether node integration is
enabled in web workers. Default is `false`. More about this can be found
in [Multithreading](/docs/latest/tutorial/multithreading).
- `nodeIntegrationInSubFrames` boolean (optional) - Experimental option for
enabling Node.js support in sub-frames such as iframes and child windows. All your preloads will load for
every iframe, you can use `process.isMainFrame` to determine if you are
in the main frame or not.
- `preload` string (optional) - Specifies a script that will be loaded before other
scripts run in the page. This script will always have access to node APIs
no matter whether node integration is turned on or off. The value should
be the absolute file path to the script.
When node integration is turned off, the preload script can reintroduce
Node global symbols back to the global scope. See example
[here](/docs/latest/api/context-bridge#exposing-node-global-symbols).
- `sandbox` boolean (optional) - If set, this will sandbox the renderer
associated with the window, making it compatible with the Chromium
OS-level sandbox and disabling the Node.js engine. This is not the same as
the `nodeIntegration` option and the APIs available to the preload script
are more limited. Default is `true` since Electron 20. The sandbox will
automatically be disabled when `nodeIntegration` is set to `true`.
Read more about the option [here](/docs/latest/tutorial/sandbox).
- `session` [Session](/docs/latest/api/session#class-session) (optional) - Sets the session used by the
page. Instead of passing the Session object directly, you can also choose to
use the `partition` option instead, which accepts a partition string. When
both `session` and `partition` are provided, `session` will be preferred.
Default is the default session.
- `partition` string (optional) - Sets the session used by the page according to the
session's partition string. If `partition` starts with `persist:`, the page
will use a persistent session available to all pages in the app with the
same `partition`. If there is no `persist:` prefix, the page will use an
in-memory session. By assigning the same `partition`, multiple pages can share
the same session. Default is the default session.
- `zoomFactor` number (optional) - The default zoom factor of the page, `3.0` represents
`300%`. Default is `1.0`.
- `javascript` boolean (optional) - Enables JavaScript support. Default is `true`.
- `webSecurity` boolean (optional) - When `false`, it will disable the
same-origin policy (usually using testing websites by people), and set
`allowRunningInsecureContent` to `true` if this options has not been set
by user. Default is `true`.
- `allowRunningInsecureContent` boolean (optional) - Allow an https page to run
JavaScript, CSS or plugins from http URLs. Default is `false`.
- `images` boolean (optional) - Enables image support. Default is `true`.
- `imageAnimationPolicy` string (optional) - Specifies how to run image animations (E.g. GIFs). Can be `animate`, `animateOnce` or `noAnimation`. Default is `animate`.
- `textAreasAreResizable` boolean (optional) - Make TextArea elements resizable. Default
is `true`.
- `webgl` boolean (optional) - Enables WebGL support. Default is `true`.
- `plugins` boolean (optional) - Whether plugins should be enabled. Default is `false`.
- `experimentalFeatures` boolean (optional) - Enables Chromium's experimental features.
Default is `false`.
- `scrollBounce` boolean (optional) *macOS* - Enables scroll bounce
(rubber banding) effect on macOS. Default is `false`.
- `enableBlinkFeatures` string (optional) - A list of feature strings separated by `,`, like
`CSSVariables,KeyboardEventKey` to enable. The full list of supported feature
strings can be found in the [RuntimeEnabledFeatures.json5](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/runtime_enabled_features.json5)
file.
- `disableBlinkFeatures` string (optional) - A list of feature strings separated by `,`,
like `CSSVariables,KeyboardEventKey` to disable. The full list of supported
feature strings can be found in the
[RuntimeEnabledFeatures.json5](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/runtime_enabled_features.json5) file.
- `defaultFontFamily` Object (optional) - Sets the default font for the font-family.
* `standard` string (optional) - Defaults to `Times New Roman`.
* `serif` string (optional) - Defaults to `Times New Roman`.
* `sansSerif` string (optional) - Defaults to `Arial`.
* `monospace` string (optional) - Defaults to `Courier New`.
* `cursive` string (optional) - Defaults to `Script`.
* `fantasy` string (optional) - Defaults to `Impact`.
* `math` string (optional) - Defaults to `Latin Modern Math`.
- `defaultFontSize` Integer (optional) - Defaults to `16`.
- `defaultMonospaceFontSize` Integer (optional) - Defaults to `13`.
- `minimumFontSize` Integer (optional) - Defaults to `0`.
- `defaultEncoding` string (optional) - Defaults to `ISO-8859-1`.
- `backgroundThrottling` boolean (optional) - Whether to throttle animations and timers
when the page becomes background. This also affects the
[Page Visibility API](/docs/latest/api/browser-window#page-visibility). When at least one
[webContents](/docs/latest/api/web-contents) displayed in a single
[browserWindow](/docs/latest/api/browser-window) has disabled `backgroundThrottling` then
frames will be drawn and swapped for the whole window and other
[webContents](/docs/latest/api/web-contents) displayed by it. Defaults to `true`.
- `offscreen` Object | boolean (optional) - Whether to enable offscreen rendering for the browser
window. Defaults to `false`. See the
[offscreen rendering tutorial](/docs/latest/tutorial/offscreen-rendering) for
more details.
* `useSharedTexture` boolean (optional) *Experimental* - Whether to use GPU shared texture for accelerated
paint event. Defaults to `false`. See the
[offscreen rendering tutorial](/docs/latest/tutorial/offscreen-rendering) for
more details.
* `sharedTexturePixelFormat` string (optional) *Experimental* - The requested output format of the shared texture. Defaults to `argb`.
The name is originated from Chromium [`media::VideoPixelFormat`](https://source.chromium.org/chromium/chromium/src/+/main:media/base/video_types.h) enum suffix and only subset of them are supported.
The actual output pixel format and color space of the texture should refer to [OffscreenSharedTexture](/docs/latest/api/structures/offscreen-shared-texture) object in the `paint` event.
+ `argb` - The requested output texture format is 8-bit unorm RGBA, with SRGB SDR color space.
+ `rgbaf16` - The requested output texture format is 16-bit float RGBA, with scRGB HDR color space.
- `contextIsolation` boolean (optional) - Whether to run Electron APIs and
the specified `preload` script in a separate JavaScript context. Defaults
to `true`. The context that the `preload` script runs in will only have
access to its own dedicated `document` and `window` globals, as well as
its own set of JavaScript builtins (`Array`, `Object`, `JSON`, etc.),
which are all invisible to the loaded content. The Electron API will only
be available in the `preload` script and not the loaded page. This option
should be used when loading potentially untrusted remote content to ensure
the loaded content cannot tamper with the `preload` script and any
Electron APIs being used. This option uses the same technique used by
[Chrome Content Scripts](https://developer.chrome.com/extensions/content_scripts#execution-environment). You can access this
context in the dev tools by selecting the 'Electron Isolated Context'
entry in the combo box at the top of the Console tab.
- `webviewTag` boolean (optional) - Whether to enable the [`<webview>` tag](/docs/latest/api/webview-tag).
Defaults to `false`. **Note:** The
`preload` script configured for the `<webview>` will have node integration
enabled when it is executed so you should ensure remote/untrusted content
is not able to create a `<webview>` tag with a possibly malicious `preload`
script. You can use the `will-attach-webview` event on [webContents](/docs/latest/api/web-contents)
to strip away the `preload` script and to validate or alter the
`<webview>`'s initial settings.
- `additionalArguments` string[] (optional) - A list of strings that will be appended
to `process.argv` in the renderer process of this app. Useful for passing small
bits of data down to renderer process preload scripts.
- `safeDialogs` boolean (optional) - Whether to enable browser style
consecutive dialog protection. Default is `false`.
- `safeDialogsMessage` string (optional) - The message to display when
consecutive dialog protection is triggered. If not defined the default
message would be used, note that currently the default message is in
English and not localized.
- `disableDialogs` boolean (optional) - Whether to disable dialogs
completely. Overrides `safeDialogs`. Default is `false`.
- `navigateOnDragDrop` boolean (optional) - Whether dragging and dropping a
file or link onto the page causes a navigation. Default is `false`.
- `autoplayPolicy` string (optional) - Autoplay policy to apply to
content in the window, can be `no-user-gesture-required`,
`user-gesture-required`, `document-user-activation-required`. Defaults to
`no-user-gesture-required`.
- `disableHtmlFullscreenWindowResize` boolean (optional) - Whether to
prevent the window from resizing when entering HTML Fullscreen. Default
is `false`.
- `accessibleTitle` string (optional) - An alternative title string provided only
to accessibility tools such as screen readers. This string is not directly
visible to users.
- `spellcheck` boolean (optional) - Whether to enable the builtin spellchecker.
Default is `true`.
- `enableWebSQL` boolean (optional) - Whether to enable the [WebSQL api](https://www.w3.org/TR/webdatabase/).
Default is `true`.
- `v8CacheOptions` string (optional) - Enforces the v8 code caching policy
used by blink. Accepted values are
* `none` - Disables code caching
* `code` - Heuristic based code caching
* `bypassHeatCheck` - Bypass code caching heuristics but with lazy compilation
* `bypassHeatCheckAndEagerCompile` - Same as above except compilation is eager.
Default policy is `code`.
- `enablePreferredSizeMode` boolean (optional) - Whether to enable
preferred size mode. The preferred size is the minimum size needed to
contain the layout of the documentâwithout requiring scrolling. Enabling
this will cause the `preferred-size-changed` event to be emitted on the
`WebContents` when the preferred size changes. Default is `false`.
- `transparent` boolean (optional) - Whether to enable background transparency for the guest page. Default is `true`. **Note:** The guest page's text and background colors are derived from the [color scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme) of its root element. When transparency is enabled, the text color will still change accordingly but the background will remain transparent.
- `enableDeprecatedPaste` boolean (optional) *Deprecated* - Whether to enable the `paste` [execCommand](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand). Default is `false`.
+ `paintWhenInitiallyHidden` boolean (optional) - Whether the renderer should be active when `show` is `false` and it has just been created. In order for `document.visibilityState` to work correctly on first load with `show: false` you should set this to `false`. Setting this to `false` will cause the `ready-to-show` event to not fire. Default is `true`.

### Instance Events[â](#instance-events "Direct link to Instance Events")

Objects created with `new BrowserWindow` emit the following events:

note

Some events are only available on specific operating systems and are
labeled as such.

#### Event: 'page-title-updated'[â](#event-page-title-updated "Direct link to Event: 'page-title-updated'")

Returns:

* `event` Event
* `title` string
* `explicitSet` boolean

Emitted when the document changed its title, calling `event.preventDefault()`
will prevent the native window's title from changing.
`explicitSet` is false when title is synthesized from file URL.

#### Event: 'close'[â](#event-close "Direct link to Event: 'close'")

Returns:

* `event` Event

Emitted when the window is going to be closed. It's emitted before the
`beforeunload` and `unload` event of the DOM. Calling `event.preventDefault()`
will cancel the close.

Usually you would want to use the `beforeunload` handler to decide whether the
window should be closed, which will also be called when the window is
reloaded. In Electron, returning any value other than `undefined` would cancel the
close. For example:

```
window.onbeforeunload = (e) => {
console.log('I do not want to be closed')

// Unlike usual browsers that a message box will be prompted to users, returning
// a non-void value will silently cancel the close.
// It is recommended to use the dialog API to let the user confirm closing the
// application.
e.returnValue = false
}
```

note

There is a subtle difference between the behaviors of `window.onbeforeunload = handler` and
`window.addEventListener('beforeunload', handler)`. It is recommended to always set the
`event.returnValue` explicitly, instead of only returning a value, as the former works more
consistently within Electron.

#### Event: 'closed'[â](#event-closed "Direct link to Event: 'closed'")

Emitted when the window is closed. After you have received this event you should
remove the reference to the window and avoid using it any more.

#### Event: 'query-session-end' *Windows*[â](#event-query-session-end-windows "Direct link to event-query-session-end-windows")

Returns:

* `event` [WindowSessionEndEvent](/docs/latest/api/structures/window-session-end-event)

Emitted when a session is about to end due to a shutdown, machine restart, or user log-off.
Calling `event.preventDefault()` can delay the system shutdown, though itâs generally best
to respect the userâs choice to end the session. However, you may choose to use it if
ending the session puts the user at risk of losing data.

#### Event: 'session-end' *Windows*[â](#event-session-end-windows "Direct link to event-session-end-windows")

Returns:

* `event` [WindowSessionEndEvent](/docs/latest/api/structures/window-session-end-event)

Emitted when a session is about to end due to a shutdown, machine restart, or user log-off. Once this event fires, there is no way to prevent the session from ending.

#### Event: 'unresponsive'[â](#event-unresponsive "Direct link to Event: 'unresponsive'")

Emitted when the web page becomes unresponsive.

#### Event: 'responsive'[â](#event-responsive "Direct link to Event: 'responsive'")

Emitted when the unresponsive web page becomes responsive again.

#### Event: 'blur'[â](#event-blur "Direct link to Event: 'blur'")

Emitted when the window loses focus.

#### Event: 'focus'[â](#event-focus "Direct link to Event: 'focus'")

Emitted when the window gains focus.

#### Event: 'show'[â](#event-show "Direct link to Event: 'show'")

Emitted when the window is shown.

#### Event: 'hide'[â](#event-hide "Direct link to Event: 'hide'")

Emitted when the window is hidden.

#### Event: 'ready-to-show'[â](#event-ready-to-show "Direct link to Event: 'ready-to-show'")

Emitted when the web page has been rendered (while not being shown) and window can be displayed without
a visual flash.

Please note that using this event implies that the renderer will be considered "visible" and
paint even though `show` is false. This event will never fire if you use `paintWhenInitiallyHidden: false`

#### Event: 'maximize'[â](#event-maximize "Direct link to Event: 'maximize'")

Emitted when window is maximized.

#### Event: 'unmaximize'[â](#event-unmaximize "Direct link to Event: 'unmaximize'")

Emitted when the window exits from a maximized state.

#### Event: 'minimize'[â](#event-minimize "Direct link to Event: 'minimize'")

Emitted when the window is minimized.

#### Event: 'restore'[â](#event-restore "Direct link to Event: 'restore'")

Emitted when the window is restored from a minimized state.

#### Event: 'will-resize' *macOS* *Windows*[â](#event-will-resize-macos-windows "Direct link to event-will-resize-macos-windows")

Returns:

* `event` Event
* `newBounds` [Rectangle](/docs/latest/api/structures/rectangle) - Size the window is being resized to.
* `details` Object
+ `edge` (string) - The edge of the window being dragged for resizing. Can be `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left` or `bottom-right`.

Emitted before the window is resized. Calling `event.preventDefault()` will prevent the window from being resized.

Note that this is only emitted when the window is being resized manually. Resizing the window with `setBounds`/`setSize` will not emit this event.

The possible values and behaviors of the `edge` option are platform dependent. Possible values are:

* On Windows, possible values are `bottom`, `top`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`.
* On macOS, possible values are `bottom` and `right`.
+ The value `bottom` is used to denote vertical resizing.
+ The value `right` is used to denote horizontal resizing.

#### Event: 'resize'[â](#event-resize "Direct link to Event: 'resize'")

Emitted after the window has been resized.

#### Event: 'resized' *macOS* *Windows*[â](#event-resized-macos-windows "Direct link to event-resized-macos-windows")

Emitted once when the window has finished being resized.

This is usually emitted when the window has been resized manually. On macOS, resizing the window with `setBounds`/`setSize` and setting the `animate` parameter to `true` will also emit this event once resizing has finished.

#### Event: 'will-move' *macOS* *Windows*[â](#event-will-move-macos-windows "Direct link to event-will-move-macos-windows")

Returns:

* `event` Event
* `newBounds` [Rectangle](/docs/latest/api/structures/rectangle) - Location the window is being moved to.

Emitted before the window is moved. On Windows, calling `event.preventDefault()` will prevent the window from being moved.

Note that this is only emitted when the window is being moved manually. Moving the window with `setPosition`/`setBounds`/`center` will not emit this event.

#### Event: 'move'[â](#event-move "Direct link to Event: 'move'")

Emitted when the window is being moved to a new position.

#### Event: 'moved' *macOS* *Windows*[â](#event-moved-macos-windows "Direct link to event-moved-macos-windows")

Emitted once when the window is moved to a new position.

note

On macOS, this event is an alias of `move`.

#### Event: 'enter-full-screen'[â](#event-enter-full-screen "Direct link to Event: 'enter-full-screen'")

Emitted when the window enters a full-screen state.

#### Event: 'leave-full-screen'[â](#event-leave-full-screen "Direct link to Event: 'leave-full-screen'")

Emitted when the window leaves a full-screen state.

#### Event: 'enter-html-full-screen'[â](#event-enter-html-full-screen "Direct link to Event: 'enter-html-full-screen'")

Emitted when the window enters a full-screen state triggered by HTML API.

#### Event: 'leave-html-full-screen'[â](#event-leave-html-full-screen "Direct link to Event: 'leave-html-full-screen'")

Emitted when the window leaves a full-screen state triggered by HTML API.

#### Event: 'always-on-top-changed'[â](#event-always-on-top-changed "Direct link to Event: 'always-on-top-changed'")

Returns:

* `event` Event
* `isAlwaysOnTop` boolean

Emitted when the window is set or unset to show always on top of other windows.

#### Event: 'app-command' *Windows* *Linux*[â](#event-app-command-windows-linux "Direct link to event-app-command-windows-linux")

Returns:

* `event` Event
* `command` string

Emitted when an [App Command](https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-appcommand)
is invoked. These are typically related to keyboard media keys or browser
commands, as well as the "Back" button built into some mice on Windows.

Commands are lowercased, underscores are replaced with hyphens, and the
`APPCOMMAND_` prefix is stripped off.
e.g. `APPCOMMAND_BROWSER_BACKWARD` is emitted as `browser-backward`.

```
const { BrowserWindow } = require('electron')

const win = new BrowserWindow()
win.on('app-command', (e, cmd) => {
// Navigate the window back when the user hits their mouse back button
if (cmd === 'browser-backward' && win.webContents.canGoBack()) {
win.webContents.goBack()
}
})
```

The following app commands are explicitly supported on Linux:

* `browser-backward`
* `browser-forward`

#### Event: 'swipe' *macOS*[â](#event-swipe-macos "Direct link to event-swipe-macos")

Returns:

* `event` Event
* `direction` string

Emitted on 3-finger swipe. Possible directions are `up`, `right`, `down`, `left`.

The method underlying this event is built to handle older macOS-style trackpad swiping,
where the content on the screen doesn't move with the swipe. Most macOS trackpads are not
configured to allow this kind of swiping anymore, so in order for it to emit properly the
'Swipe between pages' preference in `System Preferences > Trackpad > More Gestures` must be
set to 'Swipe with two or three fingers'.

#### Event: 'rotate-gesture' *macOS*[â](#event-rotate-gesture-macos "Direct link to event-rotate-gesture-macos")

Returns:

* `event` Event
* `rotation` Float

Emitted on trackpad rotation gesture. Continually emitted until rotation gesture is
ended. The `rotation` value on each emission is the angle in degrees rotated since
the last emission. The last emitted event upon a rotation gesture will always be of
value `0`. Counter-clockwise rotation values are positive, while clockwise ones are
negative.

#### Event: 'sheet-begin' *macOS*[â](#event-sheet-begin-macos "Direct link to event-sheet-begin-macos")

Emitted when the window opens a sheet.

#### Event: 'sheet-end' *macOS*[â](#event-sheet-end-macos "Direct link to event-sheet-end-macos")

Emitted when the window has closed a sheet.

#### Event: 'new-window-for-tab' *macOS*[â](#event-new-window-for-tab-macos "Direct link to event-new-window-for-tab-macos")

Emitted when the native new tab button is clicked.

#### Event: 'system-context-menu' *Windows* *Linux*[â](#event-system-context-menu-windows-linux "Direct link to event-system-context-menu-windows-linux")

Returns:

* `event` Event
* `point` [Point](/docs/latest/api/structures/point) - The screen coordinates where the context menu was triggered.

Emitted when the system context menu is triggered on the window, this is
normally only triggered when the user right clicks on the non-client area
of your window. This is the window titlebar or any area you have declared
as `-webkit-app-region: drag` in a frameless window.

Calling `event.preventDefault()` will prevent the menu from being displayed.

To convert `point` to DIP, use [`screen.screenToDipPoint(point)`](/docs/latest/api/screen#screenscreentodippointpoint-windows-linux).

### Static Methods[â](#static-methods "Direct link to Static Methods")

The `BrowserWindow` class has the following static methods:

#### `BrowserWindow.getAllWindows()`[â](#browserwindowgetallwindows "Direct link to browserwindowgetallwindows")

Returns `BrowserWindow[]` - An array of all opened browser windows.

#### `BrowserWindow.getFocusedWindow()`[â](#browserwindowgetfocusedwindow "Direct link to browserwindowgetfocusedwindow")

Returns `BrowserWindow | null` - The window that is focused in this application, otherwise returns `null`.

#### `BrowserWindow.fromWebContents(webContents)`[â](#browserwindowfromwebcontentswebcontents "Direct link to browserwindowfromwebcontentswebcontents")

* `webContents` [WebContents](/docs/latest/api/web-contents)

Returns `BrowserWindow | null` - The window that owns the given `webContents`
or `null` if the contents are not owned by a window.

#### `BrowserWindow.fromBrowserView(browserView)` *Deprecated*[â](#browserwindowfrombrowserviewbrowserview-deprecated "Direct link to browserwindowfrombrowserviewbrowserview-deprecated")

* `browserView` [BrowserView](/docs/latest/api/browser-view)

note

The `BrowserView` class is deprecated, and replaced by the new
[`WebContentsView`](/docs/latest/api/web-contents-view) class.

Returns `BrowserWindow | null` - The window that owns the given `browserView`. If the given view is not attached to any window, returns `null`.

#### `BrowserWindow.fromId(id)`[â](#browserwindowfromidid "Direct link to browserwindowfromidid")

* `id` Integer

Returns `BrowserWindow | null` - The window with the given `id`.

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

Objects created with `new BrowserWindow` have the following properties:

```
const { BrowserWindow } = require('electron')
// In this example `win` is our instance
const win = new BrowserWindow({ width: 800, height: 600 })
win.loadURL('https://github.com')
```

#### `win.webContents` *Readonly*[â](#winwebcontents-readonly "Direct link to winwebcontents-readonly")

A `WebContents` object this window owns. All web page related events and
operations will be done via it.

See the [`webContents` documentation](/docs/latest/api/web-contents) for its methods and
events.

#### `win.id` *Readonly*[â](#winid-readonly "Direct link to winid-readonly")

A `Integer` property representing the unique ID of the window. Each ID is unique among all `BrowserWindow` instances of the entire Electron application.

#### `win.tabbingIdentifier` *macOS* *Readonly*[â](#wintabbingidentifier-macos-readonly "Direct link to wintabbingidentifier-macos-readonly")

A `string` (optional) property that is equal to the `tabbingIdentifier` passed to the `BrowserWindow` constructor or `undefined` if none was set.

#### `win.autoHideMenuBar` *Linux* *Windows*[â](#winautohidemenubar-linux-windows "Direct link to winautohidemenubar-linux-windows")

A `boolean` property that determines whether the window menu bar should hide itself automatically. Once set, the menu bar will only show when users press the single `Alt` key.

If the menu bar is already visible, setting this property to `true` won't
hide it immediately.

#### `win.simpleFullScreen`[â](#winsimplefullscreen "Direct link to winsimplefullscreen")

A `boolean` property that determines whether the window is in simple (pre-Lion) fullscreen mode.

#### `win.fullScreen`[â](#winfullscreen "Direct link to winfullscreen")

A `boolean` property that determines whether the window is in fullscreen mode.

#### `win.focusable` *Windows* *macOS*[â](#winfocusable-windows-macos "Direct link to winfocusable-windows-macos")

A `boolean` property that determines whether the window is focusable.

#### `win.visibleOnAllWorkspaces` *macOS* *Linux*[â](#winvisibleonallworkspaces-macos-linux "Direct link to winvisibleonallworkspaces-macos-linux")

A `boolean` property that determines whether the window is visible on all workspaces.

note

Always returns false on Windows.

#### `win.shadow`[â](#winshadow "Direct link to winshadow")

A `boolean` property that determines whether the window has a shadow.

#### `win.menuBarVisible` *Windows* *Linux*[â](#winmenubarvisible-windows-linux "Direct link to winmenubarvisible-windows-linux")

A `boolean` property that determines whether the menu bar should be visible.

note

If the menu bar is auto-hide, users can still bring up the menu bar by pressing the single `Alt` key.

#### `win.kiosk`[â](#winkiosk "Direct link to winkiosk")

A `boolean` property that determines whether the window is in kiosk mode.

#### `win.documentEdited` *macOS*[â](#windocumentedited-macos "Direct link to windocumentedited-macos")

A `boolean` property that specifies whether the windowâs document has been edited.

The icon in title bar will become gray when set to `true`.

#### `win.representedFilename` *macOS*[â](#winrepresentedfilename-macos "Direct link to winrepresentedfilename-macos")

A `string` property that determines the pathname of the file the window represents,
and the icon of the file will show in window's title bar.

#### `win.title`[â](#wintitle "Direct link to wintitle")

A `string` property that determines the title of the native window.

note

The title of the web page can be different from the title of the native window.

#### `win.minimizable` *macOS* *Windows*[â](#winminimizable-macos-windows "Direct link to winminimizable-macos-windows")

A `boolean` property that determines whether the window can be manually minimized by user.

On Linux the setter is a no-op, although the getter returns `true`.

#### `win.maximizable` *macOS* *Windows*[â](#winmaximizable-macos-windows "Direct link to winmaximizable-macos-windows")

A `boolean` property that determines whether the window can be manually maximized by user.

On Linux the setter is a no-op, although the getter returns `true`.

#### `win.fullScreenable`[â](#winfullscreenable "Direct link to winfullscreenable")

A `boolean` property that determines whether the maximize/zoom window button toggles fullscreen mode or
maximizes the window.

#### `win.resizable`[â](#winresizable "Direct link to winresizable")

A `boolean` property that determines whether the window can be manually resized by user.

#### `win.closable` *macOS* *Windows*[â](#winclosable-macos-windows "Direct link to winclosable-macos-windows")

A `boolean` property that determines whether the window can be manually closed by user.

On Linux the setter is a no-op, although the getter returns `true`.

#### `win.movable` *macOS* *Windows*[â](#winmovable-macos-windows "Direct link to winmovable-macos-windows")

A `boolean` property that determines Whether the window can be moved by user.

On Linux the setter is a no-op, although the getter returns `true`.

#### `win.excludedFromShownWindowsMenu` *macOS*[â](#winexcludedfromshownwindowsmenu-macos "Direct link to winexcludedfromshownwindowsmenu-macos")

A `boolean` property that determines whether the window is excluded from the applicationâs Windows menu. `false` by default.

```
const win = new BrowserWindow({ height: 600, width: 600 })

const template = [
{
role: 'windowmenu'
}
]

win.excludedFromShownWindowsMenu = true

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)
```

#### `win.accessibleTitle`[â](#winaccessibletitle "Direct link to winaccessibletitle")

A `string` property that defines an alternative title provided only to
accessibility tools such as screen readers. This string is not directly
visible to users.

#### `win.snapped` *Windows* *Readonly*[â](#winsnapped-windows-readonly "Direct link to winsnapped-windows-readonly")

A `boolean` property that indicates whether the window is arranged via [Snap.](https://support.microsoft.com/en-us/windows/snap-your-windows-885a9b1e-a983-a3b1-16cd-c531795e6241)

### Instance Methods[â](#instance-methods "Direct link to Instance Methods")

Objects created with `new BrowserWindow` have the following instance methods:

note

Some methods are only available on specific operating systems and are
labeled as such.

#### `win.destroy()`[â](#windestroy "Direct link to windestroy")

Force closing the window, the `unload` and `beforeunload` event won't be emitted
for the web page, and `close` event will also not be emitted
for this window, but it guarantees the `closed` event will be emitted.

#### `win.close()`[â](#winclose "Direct link to winclose")

Try to close the window. This has the same effect as a user manually clicking
the close button of the window. The web page may cancel the close though. See
the [close event](#event-close).

#### `win.focus()`[â](#winfocus "Direct link to winfocus")

Focuses on the window.

#### `win.blur()`[â](#winblur "Direct link to winblur")

Removes focus from the window.

#### `win.isFocused()`[â](#winisfocused "Direct link to winisfocused")

Returns `boolean` - Whether the window is focused.

#### `win.isDestroyed()`[â](#winisdestroyed "Direct link to winisdestroyed")

Returns `boolean` - Whether the window is destroyed.

#### `win.show()`[â](#winshow "Direct link to winshow")

Shows and gives focus to the window.

#### `win.showInactive()`[â](#winshowinactive "Direct link to winshowinactive")

Shows the window but doesn't focus on it.

#### `win.hide()`[â](#winhide "Direct link to winhide")

Hides the window.

#### `win.isVisible()`[â](#winisvisible "Direct link to winisvisible")

Returns `boolean` - Whether the window is visible to the user in the foreground of the app.

#### `win.isModal()`[â](#winismodal "Direct link to winismodal")

Returns `boolean` - Whether current window is a modal window.

#### `win.maximize()`[â](#winmaximize "Direct link to winmaximize")

Maximizes the window. This will also show (but not focus) the window if it
isn't being displayed already.

#### `win.unmaximize()`[â](#winunmaximize "Direct link to winunmaximize")

Unmaximizes the window.

#### `win.isMaximized()`[â](#winismaximized "Direct link to winismaximized")

Returns `boolean` - Whether the window is maximized.

#### `win.minimize()`[â](#winminimize "Direct link to winminimize")

Minimizes the window. On some platforms the minimized window will be shown in
the Dock.

#### `win.restore()`[â](#winrestore "Direct link to winrestore")

Restores the window from minimized state to its previous state.

#### `win.isMinimized()`[â](#winisminimized "Direct link to winisminimized")

Returns `boolean` - Whether the window is minimized.

#### `win.setFullScreen(flag)`[â](#winsetfullscreenflag "Direct link to winsetfullscreenflag")

* `flag` boolean

Sets whether the window should be in fullscreen mode.

note

On macOS, fullscreen transitions take place asynchronously. If further actions depend on the fullscreen state, use the ['enter-full-screen'](/docs/latest/api/browser-window#event-enter-full-screen) or ['leave-full-screen'](/docs/latest/api/browser-window#event-leave-full-screen) events.

#### `win.isFullScreen()`[â](#winisfullscreen "Direct link to winisfullscreen")

Returns `boolean` - Whether the window is in fullscreen mode.

note

On macOS, fullscreen transitions take place asynchronously. When querying for a BrowserWindow's fullscreen status, you should ensure that either the ['enter-full-screen'](/docs/latest/api/browser-window#event-enter-full-screen) or ['leave-full-screen'](/docs/latest/api/browser-window#event-leave-full-screen) events have been emitted.

#### `win.setSimpleFullScreen(flag)` *macOS*[â](#winsetsimplefullscreenflag-macos "Direct link to winsetsimplefullscreenflag-macos")

* `flag` boolean

Enters or leaves simple fullscreen mode.

Simple fullscreen mode emulates the native fullscreen behavior found in versions of macOS prior to Lion (10.7).

#### `win.isSimpleFullScreen()` *macOS*[â](#winissimplefullscreen-macos "Direct link to winissimplefullscreen-macos")

Returns `boolean` - Whether the window is in simple (pre-Lion) fullscreen mode.

#### `win.isNormal()`[â](#winisnormal "Direct link to winisnormal")

Returns `boolean` - Whether the window is in normal state (not maximized, not minimized, not in fullscreen mode).

#### `win.setAspectRatio(aspectRatio[, extraSize])`[â](#winsetaspectratioaspectratio-extrasize "Direct link to winsetaspectratioaspectratio-extrasize")

* `aspectRatio` Float - The aspect ratio to maintain for some portion of the
content view.
* `extraSize` [Size](/docs/latest/api/structures/size) (optional) *macOS* - The extra size not to be included while
maintaining the aspect ratio.

This will make a window maintain an aspect ratio. The extra size allows a
developer to have space, specified in pixels, not included within the aspect
ratio calculations. This API already takes into account the difference between a
window's size and its content size.

Consider a normal window with an HD video player and associated controls.
Perhaps there are 15 pixels of controls on the left edge, 25 pixels of controls
on the right edge and 50 pixels of controls below the player. In order to
maintain a 16:9 aspect ratio (standard aspect ratio for HD @1920x1080) within
the player itself we would call this function with arguments of 16/9 and
{ width: 40, height: 50 }. The second argument doesn't care where the extra width and height
are within the content view--only that they exist. Sum any extra width and
height areas you have within the overall content view.

The aspect ratio is not respected when window is resized programmatically with
APIs like `win.setSize`.

To reset an aspect ratio, pass 0 as the `aspectRatio` value: `win.setAspectRatio(0)`.

#### `win.setBackgroundColor(backgroundColor)`[â](#winsetbackgroundcolorbackgroundcolor "Direct link to winsetbackgroundcolorbackgroundcolor")

* `backgroundColor` string - Color in Hex, RGB, RGBA, HSL, HSLA or named CSS color format. The alpha channel is optional for the hex type.

Examples of valid `backgroundColor` values:

* Hex
+ #fff (shorthand RGB)
+ #ffff (shorthand ARGB)
+ #ffffff (RGB)
+ #ffffffff (ARGB)
* RGB
+ `rgb\(([\d]+),\s*([\d]+),\s*([\d]+)\)`
- e.g. rgb(255, 255, 255)
* RGBA
+ `rgba\(([\d]+),\s*([\d]+),\s*([\d]+),\s*([\d.]+)\)`
- e.g. rgba(255, 255, 255, 1.0)
* HSL
+ `hsl\((-?[\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)`
- e.g. hsl(200, 20%, 50%)
* HSLA
+ `hsla\((-?[\d.]+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\)`
- e.g. hsla(200, 20%, 50%, 0.5)
* Color name
+ Options are listed in [SkParseColor.cpp](https://source.chromium.org/chromium/chromium/src/+/main:third_party/skia/src/utils/SkParseColor.cpp;l=11-152;drc=eea4bf52cb0d55e2a39c828b017c80a5ee054148)
+ Similar to CSS Color Module Level 3 keywords, but case-sensitive.
- e.g. `blueviolet` or `red`

Sets the background color of the window. See [Setting `backgroundColor`](#setting-the-backgroundcolor-property).

#### `win.previewFile(path[, displayName])` *macOS*[â](#winpreviewfilepath-displayname-macos "Direct link to winpreviewfilepath-displayname-macos")

* `path` string - The absolute path to the file to preview with QuickLook. This
is important as Quick Look uses the file name and file extension on the path
to determine the content type of the file to open.
* `displayName` string (optional) - The name of the file to display on the
Quick Look modal view. This is purely visual and does not affect the content
type of the file. Defaults to `path`.

Uses [Quick Look](https://en.wikipedia.org/wiki/Quick_Look) to preview a file at a given path.

#### `win.closeFilePreview()` *macOS*[â](#winclosefilepreview-macos "Direct link to winclosefilepreview-macos")

Closes the currently open [Quick Look](https://en.wikipedia.org/wiki/Quick_Look) panel.

#### `win.setBounds(bounds[, animate])`[â](#winsetboundsbounds-animate "Direct link to winsetboundsbounds-animate")

* `bounds` Partial<[Rectangle](/docs/latest/api/structures/rectangle)>
* `animate` boolean (optional) *macOS*

Resizes and moves the window to the supplied bounds. Any properties that are not supplied will default to their current values.

```
const { BrowserWindow } = require('electron')

const win = new BrowserWindow()

// set all bounds properties
win.setBounds({ x: 440, y: 225, width: 800, height: 600 })

// set a single bounds property
win.setBounds({ width: 100 })

// { x: 440, y: 225, width: 100, height: 600 }
console.log(win.getBounds())
```

note

On macOS, the y-coordinate value cannot be smaller than the [Tray](/docs/latest/api/tray) height. The tray height has changed over time and depends on the operating system, but is between 20-40px. Passing a value lower than the tray height will result in a window that is flush to the tray.

#### `win.getBounds()`[â](#wingetbounds "Direct link to wingetbounds")

Returns [Rectangle](/docs/latest/api/structures/rectangle) - The `bounds` of the window as `Object`.

note

On macOS, the y-coordinate value returned will be at minimum the [Tray](/docs/latest/api/tray) height. For example, calling `win.setBounds({ x: 25, y: 20, width: 800, height: 600 })` with a tray height of 38 means that `win.getBounds()` will return `{ x: 25, y: 38, width: 800, height: 600 }`.

#### `win.getBackgroundColor()`[â](#wingetbackgroundcolor "Direct link to wingetbackgroundcolor")

Returns `string` - Gets the background color of the window in Hex (`#RRGGBB`) format.

See [Setting `backgroundColor`](#setting-the-backgroundcolor-property).

note

The alpha value is *not* returned alongside the red, green, and blue values.

#### `win.setContentBounds(bounds[, animate])`[â](#winsetcontentboundsbounds-animate "Direct link to winsetcontentboundsbounds-animate")

* `bounds` [Rectangle](/docs/latest/api/structures/rectangle)
* `animate` boolean (optional) *macOS*

Resizes and moves the window's client area (e.g. the web page) to
the supplied bounds.

#### `win.getContentBounds()`[â](#wingetcontentbounds "Direct link to wingetcontentbounds")

Returns [Rectangle](/docs/latest/api/structures/rectangle) - The `bounds` of the window's client area as `Object`.

#### `win.getNormalBounds()`[â](#wingetnormalbounds "Direct link to wingetnormalbounds")

Returns [Rectangle](/docs/latest/api/structures/rectangle) - Contains the window bounds of the normal state

note

Whatever the current state of the window (maximized, minimized or in fullscreen), this function always returns the position and size of the window in normal state. In normal state, `getBounds` and `getNormalBounds` return the same [Rectangle](/docs/latest/api/structures/rectangle).

#### `win.setEnabled(enable)`[â](#winsetenabledenable "Direct link to winsetenabledenable")

* `enable` boolean

Disable or enable the window.

#### `win.isEnabled()`[â](#winisenabled "Direct link to winisenabled")

Returns `boolean` - whether the window is enabled.

#### `win.setSize(width, height[, animate])`[â](#winsetsizewidth-height-animate "Direct link to winsetsizewidth-height-animate")

* `width` Integer
* `height` Integer
* `animate` boolean (optional) *macOS*

Resizes the window to `width` and `height`. If `width` or `height` are below any set minimum size constraints the window will snap to its minimum size.

#### `win.getSize()`[â](#wingetsize "Direct link to wingetsize")

Returns `Integer[]` - Contains the window's width and height.

#### `win.setContentSize(width, height[, animate])`[â](#winsetcontentsizewidth-height-animate "Direct link to winsetcontentsizewidth-height-animate")

* `width` Integer
* `height` Integer
* `animate` boolean (optional) *macOS*

Resizes the window's client area (e.g. the web page) to `width` and `height`.

#### `win.getContentSize()`[â](#wingetcontentsize "Direct link to wingetcontentsize")

Returns `Integer[]` - Contains the window's client area's width and height.

#### `win.setMinimumSize(width, height)`[â](#winsetminimumsizewidth-height "Direct link to winsetminimumsizewidth-height")

* `width` Integer
* `height` Integer

Sets the minimum size of window to `width` and `height`.

#### `win.getMinimumSize()`[â](#wingetminimumsize "Direct link to wingetminimumsize")

Returns `Integer[]` - Contains the window's minimum width and height.

#### `win.setMaximumSize(width, height)`[â](#winsetmaximumsizewidth-height "Direct link to winsetmaximumsizewidth-height")

* `width` Integer
* `height` Integer

Sets the maximum size of window to `width` and `height`.

#### `win.getMaximumSize()`[â](#wingetmaximumsize "Direct link to wingetmaximumsize")

Returns `Integer[]` - Contains the window's maximum width and height.

#### `win.setResizable(resizable)`[â](#winsetresizableresizable "Direct link to winsetresizableresizable")

* `resizable` boolean

Sets whether the window can be manually resized by the user.

#### `win.isResizable()`[â](#winisresizable "Direct link to winisresizable")

Returns `boolean` - Whether the window can be manually resized by the user.

#### `win.setMovable(movable)` *macOS* *Windows*[â](#winsetmovablemovable-macos-windows "Direct link to winsetmovablemovable-macos-windows")

* `movable` boolean

Sets whether the window can be moved by user. On Linux does nothing.

#### `win.isMovable()` *macOS* *Windows*[â](#winismovable-macos-windows "Direct link to winismovable-macos-windows")

Returns `boolean` - Whether the window can be moved by user.

On Linux always returns `true`.

#### `win.setMinimizable(minimizable)` *macOS* *Windows*[â](#winsetminimizableminimizable-macos-windows "Direct link to winsetminimizableminimizable-macos-windows")

* `minimizable` boolean

Sets whether the window can be manually minimized by user. On Linux does nothing.

#### `win.isMinimizable()` *macOS* *Windows*[â](#winisminimizable-macos-windows "Direct link to winisminimizable-macos-windows")

Returns `boolean` - Whether the window can be manually minimized by the user.

On Linux always returns `true`.

#### `win.setMaximizable(maximizable)` *macOS* *Windows*[â](#winsetmaximizablemaximizable-macos-windows "Direct link to winsetmaximizablemaximizable-macos-windows")

* `maximizable` boolean

Sets whether the window can be manually maximized by user. On Linux does nothing.

#### `win.isMaximizable()` *macOS* *Windows*[â](#winismaximizable-macos-windows "Direct link to winismaximizable-macos-windows")

Returns `boolean` - Whether the window can be manually maximized by user.

On Linux always returns `true`.

#### `win.setFullScreenable(fullscreenable)`[â](#winsetfullscreenablefullscreenable "Direct link to winsetfullscreenablefullscreenable")

* `fullscreenable` boolean

Sets whether the maximize/zoom window button toggles fullscreen mode or maximizes the window.

#### `win.isFullScreenable()`[â](#winisfullscreenable "Direct link to winisfullscreenable")

Returns `boolean` - Whether the maximize/zoom window button toggles fullscreen mode or maximizes the window.

#### `win.setClosable(closable)` *macOS* *Windows*[â](#winsetclosableclosable-macos-windows "Direct link to winsetclosableclosable-macos-windows")

* `closable` boolean

Sets whether the window can be manually closed by user. On Linux does nothing.

#### `win.isClosable()` *macOS* *Windows*[â](#winisclosable-macos-windows "Direct link to winisclosable-macos-windows")

Returns `boolean` - Whether the window can be manually closed by user.

On Linux always returns `true`.

#### `win.setHiddenInMissionControl(hidden)` *macOS*[â](#winsethiddeninmissioncontrolhidden-macos "Direct link to winsethiddeninmissioncontrolhidden-macos")

* `hidden` boolean

Sets whether the window will be hidden when the user toggles into mission control.

#### `win.isHiddenInMissionControl()` *macOS*[â](#winishiddeninmissioncontrol-macos "Direct link to winishiddeninmissioncontrol-macos")

Returns `boolean` - Whether the window will be hidden when the user toggles into mission control.

#### `win.setAlwaysOnTop(flag[, level][, relativeLevel])`[â](#winsetalwaysontopflag-level-relativelevel "Direct link to winsetalwaysontopflag-level-relativelevel")

* `flag` boolean
* `level` string (optional) *macOS* *Windows* - Values include `normal`,
`floating`, `torn-off-menu`, `modal-panel`, `main-menu`, `status`,
`pop-up-menu`, `screen-saver`, and ~~`dock`~~ (Deprecated). The default is
`floating` when `flag` is true. The `level` is reset to `normal` when the
flag is false. Note that from `floating` to `status` included, the window is
placed below the Dock on macOS and below the taskbar on Windows. From
`pop-up-menu` to a higher it is shown above the Dock on macOS and above the
taskbar on Windows. See the [macOS docs](https://developer.apple.com/documentation/appkit/nswindow/level) for more details.
* `relativeLevel` Integer (optional) *macOS* - The number of layers higher to set
this window relative to the given `level`. The default is `0`. Note that Apple
discourages setting levels higher than 1 above `screen-saver`.

Sets whether the window should show always on top of other windows. After
setting this, the window is still a normal window, not a toolbox window which
can not be focused on.

#### `win.isAlwaysOnTop()`[â](#winisalwaysontop "Direct link to winisalwaysontop")

Returns `boolean` - Whether the window is always on top of other windows.

#### `win.moveAbove(mediaSourceId)`[â](#winmoveabovemediasourceid "Direct link to winmoveabovemediasourceid")

* `mediaSourceId` string - Window id in the format of DesktopCapturerSource's id. For example "window:1869:0".

Moves window above the source window in the sense of z-order. If the
`mediaSourceId` is not of type window or if the window does not exist then
this method throws an error.

#### `win.moveTop()`[â](#winmovetop "Direct link to winmovetop")

Moves window to top(z-order) regardless of focus

#### `win.center()`[â](#wincenter "Direct link to wincenter")

Moves window to the center of the screen.

#### `win.setPosition(x, y[, animate])`[â](#winsetpositionx-y-animate "Direct link to winsetpositionx-y-animate")

* `x` Integer
* `y` Integer
* `animate` boolean (optional) *macOS*

Moves window to `x` and `y`.

#### `win.getPosition()`[â](#wingetposition "Direct link to wingetposition")

Returns `Integer[]` - Contains the window's current position.

#### `win.setTitle(title)`[â](#winsettitletitle "Direct link to winsettitletitle")

* `title` string

Changes the title of native window to `title`.

#### `win.getTitle()`[â](#wingettitle "Direct link to wingettitle")

Returns `string` - The title of the native window.

note

The title of the web page can be different from the title of the native
window.

#### `win.setSheetOffset(offsetY[, offsetX])` *macOS*[â](#winsetsheetoffsetoffsety-offsetx-macos "Direct link to winsetsheetoffsetoffsety-offsetx-macos")

* `offsetY` Float
* `offsetX` Float (optional)

Changes the attachment point for sheets on macOS. By default, sheets are
attached just below the window frame, but you may want to display them beneath
a HTML-rendered toolbar. For example:

```
const { BrowserWindow } = require('electron')

const win = new BrowserWindow()

const toolbarRect = document.getElementById('toolbar').getBoundingClientRect()
win.setSheetOffset(toolbarRect.height)
```

#### `win.flashFrame(flag)`[â](#winflashframeflag "Direct link to winflashframeflag")

History

|  |  |  |  |
| --- | --- | --- | --- |
| Version(s) Changes|  |  | | --- | --- | | ``` None ```   [`window.flashFrame(bool)` will flash dock icon continuously on macOS](/docs/latest/breaking-changes#behavior-changed-windowflashframebool-will-flash-dock-icon-continuously-on-macos) | | | |

* `flag` boolean

Starts or stops flashing the window to attract user's attention.

#### `win.setSkipTaskbar(skip)` *macOS* *Windows*[â](#winsetskiptaskbarskip-macos-windows "Direct link to winsetskiptaskbarskip-macos-windows")

* `skip` boolean

Makes the window not show in the taskbar.

#### `win.setKiosk(flag)`[â](#winsetkioskflag "Direct link to winsetkioskflag")

* `flag` boolean

Enters or leaves kiosk mode.

#### `win.isKiosk()`[â](#winiskiosk "Direct link to winiskiosk")

Returns `boolean` - Whether the window is in kiosk mode.

#### `win.isTabletMode()` *Windows*[â](#winistabletmode-windows "Direct link to winistabletmode-windows")

Returns `boolean` - Whether the window is in Windows 10 tablet mode.

Since Windows 10 users can [use their PC as tablet](https://support.microsoft.com/en-us/help/17210/windows-10-use-your-pc-like-a-tablet),
under this mode apps can choose to optimize their UI for tablets, such as
enlarging the titlebar and hiding titlebar buttons.

This API returns whether the window is in tablet mode, and the `resize` event
can be be used to listen to changes to tablet mode.

#### `win.getMediaSourceId()`[â](#wingetmediasourceid "Direct link to wingetmediasourceid")

Returns `string` - Window id in the format of DesktopCapturerSource's id. For example "window:1324:0".

More precisely the format is `window:id:other_id` where `id` is `HWND` on
Windows, `CGWindowID` (`uint64_t`) on macOS and `Window` (`unsigned long`) on
Linux. `other_id` is used to identify web contents (tabs) so within the same
top level window.

#### `win.getNativeWindowHandle()`[â](#wingetnativewindowhandle "Direct link to wingetnativewindowhandle")

Returns `Buffer` - The platform-specific handle of the window.

The native type of the handle is `HWND` on Windows, `NSView*` on macOS, and
`Window` (`unsigned long`) on Linux.

#### `win.hookWindowMessage(message, callback)` *Windows*[â](#winhookwindowmessagemessage-callback-windows "Direct link to winhookwindowmessagemessage-callback-windows")

* `message` Integer
* `callback` Function
+ `wParam` Buffer - The `wParam` provided to the WndProc
+ `lParam` Buffer - The `lParam` provided to the WndProc

Hooks a windows message. The `callback` is called when
the message is received in the WndProc.

#### `win.isWindowMessageHooked(message)` *Windows*[â](#winiswindowmessagehookedmessage-windows "Direct link to winiswindowmessagehookedmessage-windows")

* `message` Integer

Returns `boolean` - `true` or `false` depending on whether the message is hooked.

#### `win.unhookWindowMessage(message)` *Windows*[â](#winunhookwindowmessagemessage-windows "Direct link to winunhookwindowmessagemessage-windows")

* `message` Integer

Unhook the window message.

#### `win.unhookAllWindowMessages()` *Windows*[â](#winunhookallwindowmessages-windows "Direct link to winunhookallwindowmessages-windows")

Unhooks all of the window messages.

#### `win.setRepresentedFilename(filename)` *macOS*[â](#winsetrepresentedfilenamefilename-macos "Direct link to winsetrepresentedfilenamefilename-macos")

* `filename` string

Sets the pathname of the file the window represents, and the icon of the file
will show in window's title bar.

#### `win.getRepresentedFilename()` *macOS*[â](#wingetrepresentedfilename-macos "Direct link to wingetrepresentedfilename-macos")

Returns `string` - The pathname of the file the window represents.

#### `win.setDocumentEdited(edited)` *macOS*[â](#winsetdocumenteditededited-macos "Direct link to winsetdocumenteditededited-macos")

* `edited` boolean

Specifies whether the windowâs document has been edited, and the icon in title
bar will become gray when set to `true`.

#### `win.isDocumentEdited()` *macOS*[â](#winisdocumentedited-macos "Direct link to winisdocumentedited-macos")

Returns `boolean` - Whether the window's document has been edited.

#### `win.focusOnWebView()`[â](#winfocusonwebview "Direct link to winfocusonwebview")

#### `win.blurWebView()`[â](#winblurwebview "Direct link to winblurwebview")

#### `win.capturePage([rect, opts])`[â](#wincapturepagerect-opts "Direct link to wincapturepagerect-opts")

* `rect` [Rectangle](/docs/latest/api/structures/rectangle) (optional) - The bounds to capture
* `opts` Object (optional)
+ `stayHidden` boolean (optional) - Keep the page hidden instead of visible. Default is `false`.
+ `stayAwake` boolean (optional) - Keep the system awake instead of allowing it to sleep. Default is `false`.

Returns `Promise<NativeImage>` - Resolves with a [NativeImage](/docs/latest/api/native-image)

Captures a snapshot of the page within `rect`. Omitting `rect` will capture the whole visible page. If the page is not visible, `rect` may be empty. The page is considered visible when its browser window is hidden and the capturer count is non-zero. If you would like the page to stay hidden, you should ensure that `stayHidden` is set to true.

#### `win.loadURL(url[, options])`[â](#winloadurlurl-options "Direct link to winloadurlurl-options")

* `url` string
* `options` Object (optional)
+ `httpReferrer` (string | [Referrer](/docs/latest/api/structures/referrer)) (optional) - An HTTP Referrer URL.
+ `userAgent` string (optional) - A user agent originating the request.
+ `extraHeaders` string (optional) - Extra headers separated by "\n"
+ `postData` ([UploadRawData](/docs/latest/api/structures/upload-raw-data) | [UploadFile](/docs/latest/api/structures/upload-file))[] (optional)
+ `baseURLForDataURL` string (optional) - Base URL (with trailing path separator) for files to be loaded by the data URL. This is needed only if the specified `url` is a data URL and needs to load other files.

Returns `Promise<void>` - the promise will resolve when the page has finished loading
(see [`did-finish-load`](/docs/latest/api/web-contents#event-did-finish-load)), and rejects
if the page fails to load (see
[`did-fail-load`](/docs/latest/api/web-contents#event-did-fail-load)). A noop rejection handler is already attached, which avoids unhandled rejection errors. If the existing page has a beforeUnload handler, [`did-fail-load`](/docs/latest/api/web-contents#event-did-fail-load) will be called unless [`will-prevent-unload`](/docs/latest/api/web-contents#event-did-fail-load) is handled.

Same as [`webContents.loadURL(url[, options])`](/docs/latest/api/web-contents#contentsloadurlurl-options).

The `url` can be a remote address (e.g. `http://`) or a path to a local
HTML file using the `file://` protocol.

To ensure that file URLs are properly formatted, it is recommended to use
Node's [`url.format`](https://nodejs.org/api/url.html#url_url_format_urlobject)
method:

```
const { BrowserWindow } = require('electron')

const win = new BrowserWindow()

const url = require('node:url').format({
protocol: 'file',
slashes: true,
pathname: require('node:path').join(__dirname, 'index.html')
})

win.loadURL(url)
```

You can load a URL using a `POST` request with URL-encoded data by doing
the following:

```
const { BrowserWindow } = require('electron')

const win = new BrowserWindow()

win.loadURL('http://localhost:8000/post', {
postData: [{
type: 'rawData',
bytes: Buffer.from('hello=world')
}],
extraHeaders: 'Content-Type: application/x-www-form-urlencoded'
})
```

#### `win.loadFile(filePath[, options])`[â](#winloadfilefilepath-options "Direct link to winloadfilefilepath-options")

* `filePath` string
* `options` Object (optional)
+ `query` Record<string, string> (optional) - Passed to `url.format()`.
+ `search` string (optional) - Passed to `url.format()`.
+ `hash` string (optional) - Passed to `url.format()`.

Returns `Promise<void>` - the promise will resolve when the page has finished loading
(see [`did-finish-load`](/docs/latest/api/web-contents#event-did-finish-load)), and rejects
if the page fails to load (see [`did-fail-load`](/docs/latest/api/web-contents#event-did-fail-load)).

Same as `webContents.loadFile`, `filePath` should be a path to an HTML
file relative to the root of your application. See the `webContents` docs
for more information.

#### `win.reload()`[â](#winreload "Direct link to winreload")

Same as `webContents.reload`.

#### `win.setMenu(menu)` *Linux* *Windows*[â](#winsetmenumenu-linux-windows "Direct link to winsetmenumenu-linux-windows")

* `menu` Menu | null

Sets the `menu` as the window's menu bar.

#### `win.removeMenu()` *Linux* *Windows*[â](#winremovemenu-linux-windows "Direct link to winremovemenu-linux-windows")

Remove the window's menu bar.

#### `win.setProgressBar(progress[, options])`[â](#winsetprogressbarprogress-options "Direct link to winsetprogressbarprogress-options")

* `progress` Double
* `options` Object (optional)
+ `mode` string *Windows* - Mode for the progress bar. Can be `none`, `normal`, `indeterminate`, `error` or `paused`.

Sets progress value in progress bar. Valid range is [0, 1.0].

Remove progress bar when progress < 0;
Change to indeterminate mode when progress > 1.

On Linux platform, only supports Unity desktop environment, you need to specify
the `*.desktop` file name to `desktopName` field in `package.json`. By default,
it will assume `{app.name}.desktop`.

On Windows, a mode can be passed. Accepted values are `none`, `normal`,
`indeterminate`, `error`, and `paused`. If you call `setProgressBar` without a
mode set (but with a value within the valid range), `normal` will be assumed.

#### `win.setOverlayIcon(overlay, description)` *Windows*[â](#winsetoverlayiconoverlay-description-windows "Direct link to winsetoverlayiconoverlay-description-windows")

* `overlay` [NativeImage](/docs/latest/api/native-image) | null - the icon to display on the bottom
right corner of the taskbar icon. If this parameter is `null`, the overlay is
cleared
* `description` string - a description that will be provided to Accessibility
screen readers

Sets a 16 x 16 pixel overlay onto the current taskbar icon, usually used to
convey some sort of application status or to passively notify the user.

#### `win.invalidateShadow()` *macOS*[â](#wininvalidateshadow-macos "Direct link to wininvalidateshadow-macos")

Invalidates the window shadow so that it is recomputed based on the current window shape.

`BrowserWindows` that are transparent can sometimes leave behind visual artifacts on macOS.
This method can be used to clear these artifacts when, for example, performing an animation.

#### `win.setHasShadow(hasShadow)`[â](#winsethasshadowhasshadow "Direct link to winsethasshadowhasshadow")

* `hasShadow` boolean

Sets whether the window should have a shadow.

#### `win.hasShadow()`[â](#winhasshadow "Direct link to winhasshadow")

Returns `boolean` - Whether the window has a shadow.

#### `win.setOpacity(opacity)` *Windows* *macOS*[â](#winsetopacityopacity-windows-macos "Direct link to winsetopacityopacity-windows-macos")

* `opacity` number - between 0.0 (fully transparent) and 1.0 (fully opaque)

Sets the opacity of the window. On Linux, does nothing. Out of bound number
values are clamped to the [0, 1] range.

#### `win.getOpacity()`[â](#wingetopacity "Direct link to wingetopacity")

Returns `number` - between 0.0 (fully transparent) and 1.0 (fully opaque). On
Linux, always returns 1.

#### `win.setShape(rects)` *Windows* *Linux* *Experimental*[â](#winsetshaperects-windows-linux-experimental "Direct link to winsetshaperects-windows-linux-experimental")

* `rects` [Rectangle[]](/docs/latest/api/structures/rectangle) - Sets a shape on the window.
Passing an empty list reverts the window to being rectangular.

Setting a window shape determines the area within the window where the system
permits drawing and user interaction. Outside of the given region, no pixels
will be drawn and no mouse events will be registered. Mouse events outside of
the region will not be received by that window, but will fall through to
whatever is behind the window.

#### `win.setThumbarButtons(buttons)` *Windows*[â](#winsetthumbarbuttonsbuttons-windows "Direct link to winsetthumbarbuttonsbuttons-windows")

* `buttons` [ThumbarButton[]](/docs/latest/api/structures/thumbar-button)

Returns `boolean` - Whether the buttons were added successfully

Add a thumbnail toolbar with a specified set of buttons to the thumbnail image
of a window in a taskbar button layout. Returns a `boolean` object indicates
whether the thumbnail has been added successfully.

The number of buttons in thumbnail toolbar should be no greater than 7 due to
the limited room. Once you setup the thumbnail toolbar, the toolbar cannot be
removed due to the platform's limitation. But you can call the API with an empty
array to clean the buttons.

The `buttons` is an array of `Button` objects:

* `Button` Object
+ `icon` [NativeImage](/docs/latest/api/native-image) - The icon showing in thumbnail
toolbar.
+ `click` Function
+ `tooltip` string (optional) - The text of the button's tooltip.
+ `flags` string[] (optional) - Control specific states and behaviors of the
button. By default, it is `['enabled']`.

The `flags` is an array that can include following `string`s:

* `enabled` - The button is active and available to the user.
* `disabled` - The button is disabled. It is present, but has a visual state
indicating it will not respond to user action.
* `dismissonclick` - When the button is clicked, the thumbnail window closes
immediately.
* `nobackground` - Do not draw a button border, use only the image.
* `hidden` - The button is not shown to the user.
* `noninteractive` - The button is enabled but not interactive; no pressed
button state is drawn. This value is intended for instances where the button
is used in a notification.

#### `win.setThumbnailClip(region)` *Windows*[â](#winsetthumbnailclipregion-windows "Direct link to winsetthumbnailclipregion-windows")

* `region` [Rectangle](/docs/latest/api/structures/rectangle) - Region of the window

Sets the region of the window to show as the thumbnail image displayed when
hovering over the window in the taskbar. You can reset the thumbnail to be
the entire window by specifying an empty region:
`{ x: 0, y: 0, width: 0, height: 0 }`.

#### `win.setThumbnailToolTip(toolTip)` *Windows*[â](#winsetthumbnailtooltiptooltip-windows "Direct link to winsetthumbnailtooltiptooltip-windows")

* `toolTip` string

Sets the toolTip that is displayed when hovering over the window thumbnail
in the taskbar.

#### `win.setAppDetails(options)` *Windows*[â](#winsetappdetailsoptions-windows "Direct link to winsetappdetailsoptions-windows")

* `options` Object
+ `appId` string (optional) - Window's [App User Model ID](https://learn.microsoft.com/en-us/windows/win32/shell/appids).
It has to be set, otherwise the other options will have no effect.
+ `appIconPath` string (optional) - Window's [Relaunch Icon](https://learn.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-relaunchiconresource).
+ `appIconIndex` Integer (optional) - Index of the icon in `appIconPath`.
Ignored when `appIconPath` is not set. Default is `0`.
+ `relaunchCommand` string (optional) - Window's [Relaunch Command](https://learn.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-relaunchcommand).
+ `relaunchDisplayName` string (optional) - Window's [Relaunch Display Name](https://learn.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-relaunchdisplaynameresource).

Sets the properties for the window's taskbar button.

note

`relaunchCommand` and `relaunchDisplayName` must always be set
together. If one of those properties is not set, then neither will be used.

#### `win.setAccentColor(accentColor)` *Windows*[â](#winsetaccentcoloraccentcolor-windows "Direct link to winsetaccentcoloraccentcolor-windows")

* `accentColor` boolean | string | null - The accent color for the window. By default, follows user preference in System Settings. To reset to system default, pass `null`.

Sets the system accent color and highlighting of active window border.

The `accentColor` parameter accepts the following values:

* **Color string** - Like `true`, but sets a custom accent color using standard CSS color formats (Hex, RGB, RGBA, HSL, HSLA, or named colors). Alpha values in RGBA/HSLA formats are ignored and the color is treated as fully opaque.
* **`true`** - Enable accent color highlighting for the window with the system accent color regardless of whether accent colors are enabled for windows in System `Settings.`
* **`false`** - Disable accent color highlighting for the window regardless of whether accent colors are currently enabled for windows in System Settings.
* **`null`** - Reset window accent color behavior to follow behavior set in System Settings.

Examples:

```
const win = new BrowserWindow({ frame: false })

// Set red accent color.
win.setAccentColor('#ff0000')

// RGB format (alpha ignored if present).
win.setAccentColor('rgba(255,0,0,0.5)')

// Enable accent color, using the color specified in System Settings.
win.setAccentColor(true)

// Disable accent color.
win.setAccentColor(false)

// Reset window accent color behavior to follow behavior set in System Settings.
win.setAccentColor(null)
```

#### `win.getAccentColor()` *Windows*[â](#wingetaccentcolor-windows "Direct link to wingetaccentcolor-windows")

Returns `string | boolean` - the system accent color and highlighting of active window border in Hex RGB format.

If a color has been set for the window that differs from the system accent color, the window accent color will
be returned. Otherwise, a boolean will be returned, with `true` indicating that the window uses the global system accent color, and `false` indicating that accent color highlighting is disabled for this window.

#### `win.showDefinitionForSelection()` *macOS*[â](#winshowdefinitionforselection-macos "Direct link to winshowdefinitionforselection-macos")

Same as `webContents.showDefinitionForSelection()`.

#### `win.setIcon(icon)` *Windows* *Linux*[â](#winseticonicon-windows-linux "Direct link to winseticonicon-windows-linux")

* `icon` [NativeImage](/docs/latest/api/native-image) | string

Changes window icon.

#### `win.setWindowButtonVisibility(visible)` *macOS*[â](#winsetwindowbuttonvisibilityvisible-macos "Direct link to winsetwindowbuttonvisibilityvisible-macos")

* `visible` boolean

Sets whether the window traffic light buttons should be visible.

#### `win.setAutoHideMenuBar(hide)` *Windows* *Linux*[â](#winsetautohidemenubarhide-windows-linux "Direct link to winsetautohidemenubarhide-windows-linux")

* `hide` boolean

Sets whether the window menu bar should hide itself automatically. Once set the
menu bar will only show when users press the single `Alt` key.

If the menu bar is already visible, calling `setAutoHideMenuBar(true)` won't hide it immediately.

#### `win.isMenuBarAutoHide()` *Windows* *Linux*[â](#winismenubarautohide-windows-linux "Direct link to winismenubarautohide-windows-linux")

Returns `boolean` - Whether menu bar automatically hides itself.

#### `win.setMenuBarVisibility(visible)` *Windows* *Linux*[â](#winsetmenubarvisibilityvisible-windows-linux "Direct link to winsetmenubarvisibilityvisible-windows-linux")

* `visible` boolean

Sets whether the menu bar should be visible. If the menu bar is auto-hide, users can still bring up the menu bar by pressing the single `Alt` key.

#### `win.isMenuBarVisible()` *Windows* *Linux*[â](#winismenubarvisible-windows-linux "Direct link to winismenubarvisible-windows-linux")

Returns `boolean` - Whether the menu bar is visible.

#### `win.isSnapped()` *Windows*[â](#winissnapped-windows "Direct link to winissnapped-windows")

Returns `boolean` - whether the window is arranged via [Snap.](https://support.microsoft.com/en-us/windows/snap-your-windows-885a9b1e-a983-a3b1-16cd-c531795e6241)

The window is snapped via buttons shown when the mouse is hovered over window
maximize button, or by dragging it to the edges of the screen.

#### `win.setVisibleOnAllWorkspaces(visible[, options])` *macOS* *Linux*[â](#winsetvisibleonallworkspacesvisible-options-macos-linux "Direct link to winsetvisibleonallworkspacesvisible-options-macos-linux")

* `visible` boolean
* `options` Object (optional)
+ `visibleOnFullScreen` boolean (optional) *macOS* - Sets whether
the window should be visible above fullscreen windows.
+ `skipTransformProcessType` boolean (optional) *macOS* - Calling
setVisibleOnAllWorkspaces will by default transform the process
type between UIElementApplication and ForegroundApplication to
ensure the correct behavior. However, this will hide the window
and dock for a short time every time it is called. If your window
is already of type UIElementApplication, you can bypass this
transformation by passing true to skipTransformProcessType.

Sets whether the window should be visible on all workspaces.

note

This API does nothing on Windows.

#### `win.isVisibleOnAllWorkspaces()` *macOS* *Linux*[â](#winisvisibleonallworkspaces-macos-linux "Direct link to winisvisibleonallworkspaces-macos-linux")

Returns `boolean` - Whether the window is visible on all workspaces.

note

This API always returns false on Windows.

#### `win.setIgnoreMouseEvents(ignore[, options])`[â](#winsetignoremouseeventsignore-options "Direct link to winsetignoremouseeventsignore-options")

* `ignore` boolean
* `options` Object (optional)
+ `forward` boolean (optional) *macOS* *Windows* - If true, forwards mouse move
messages to Chromium, enabling mouse related events such as `mouseleave`.
Only used when `ignore` is true. If `ignore` is false, forwarding is always
disabled regardless of this value.

Makes the window ignore all mouse events.

All mouse events happened in this window will be passed to the window below
this window, but if this window has focus, it will still receive keyboard
events.

#### `win.setContentProtection(enable)` *macOS* *Windows*[â](#winsetcontentprotectionenable-macos-windows "Direct link to winsetcontentprotectionenable-macos-windows")

* `enable` boolean

Prevents the window contents from being captured by other apps.

On Windows, it calls [`SetWindowDisplayAffinity`](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity) with `WDA_EXCLUDEFROMCAPTURE`.
For Windows 10 version 2004 and up the window will be removed from capture entirely,
older Windows versions behave as if `WDA_MONITOR` is applied capturing a black window.

On macOS, it sets the `NSWindow`'s
[`sharingType`](https://developer.apple.com/documentation/appkit/nswindow/sharingtype-swift.property?language=objc)
to
[`NSWindowSharingNone`](https://developer.apple.com/documentation/appkit/nswindow/sharingtype-swift.enum/none?language=objc).
Unfortunately, due to an intentional change in macOS, newer Mac applications that use
`ScreenCaptureKit` will capture your window despite `win.setContentProtection(true)`.
See [here](https://github.com/electron/electron/issues/48258#issuecomment-3269893618).

#### `win.isContentProtected()` *macOS* *Windows*[â](#winiscontentprotected-macos-windows "Direct link to winiscontentprotected-macos-windows")

Returns `boolean` - whether or not content protection is currently enabled.

#### `win.setFocusable(focusable)` *macOS* *Windows*[â](#winsetfocusablefocusable-macos-windows "Direct link to winsetfocusablefocusable-macos-windows")

* `focusable` boolean

Changes whether the window can be focused.

On macOS it does not remove the focus from the window.

#### `win.isFocusable()` *macOS* *Windows*[â](#winisfocusable-macos-windows "Direct link to winisfocusable-macos-windows")

Returns `boolean` - Whether the window can be focused.

#### `win.setParentWindow(parent)`[â](#winsetparentwindowparent "Direct link to winsetparentwindowparent")

* `parent` BrowserWindow | null

Sets `parent` as current window's parent window, passing `null` will turn
current window into a top-level window.

#### `win.getParentWindow()`[â](#wingetparentwindow "Direct link to wingetparentwindow")

Returns `BrowserWindow | null` - The parent window or `null` if there is no parent.

#### `win.getChildWindows()`[â](#wingetchildwindows "Direct link to wingetchildwindows")

Returns `BrowserWindow[]` - All child windows.

#### `win.setAutoHideCursor(autoHide)` *macOS*[â](#winsetautohidecursorautohide-macos "Direct link to winsetautohidecursorautohide-macos")

* `autoHide` boolean

Controls whether to hide cursor when typing.

#### `win.selectPreviousTab()` *macOS*[â](#winselectprevioustab-macos "Direct link to winselectprevioustab-macos")

Selects the previous tab when native tabs are enabled and there are other
tabs in the window.

#### `win.selectNextTab()` *macOS*[â](#winselectnexttab-macos "Direct link to winselectnexttab-macos")

Selects the next tab when native tabs are enabled and there are other
tabs in the window.

#### `win.showAllTabs()` *macOS*[â](#winshowalltabs-macos "Direct link to winshowalltabs-macos")

Shows or hides the tab overview when native tabs are enabled.

#### `win.mergeAllWindows()` *macOS*[â](#winmergeallwindows-macos "Direct link to winmergeallwindows-macos")

Merges all windows into one window with multiple tabs when native tabs
are enabled and there is more than one open window.

#### `win.moveTabToNewWindow()` *macOS*[â](#winmovetabtonewwindow-macos "Direct link to winmovetabtonewwindow-macos")

Moves the current tab into a new window if native tabs are enabled and
there is more than one tab in the current window.

#### `win.toggleTabBar()` *macOS*[â](#wintoggletabbar-macos "Direct link to wintoggletabbar-macos")

Toggles the visibility of the tab bar if native tabs are enabled and
there is only one tab in the current window.

#### `win.addTabbedWindow(browserWindow)` *macOS*[â](#winaddtabbedwindowbrowserwindow-macos "Direct link to winaddtabbedwindowbrowserwindow-macos")

* `browserWindow` BrowserWindow

Adds a window as a tab on this window, after the tab for the window instance.

#### `win.setVibrancy(type[, options])` *macOS*[â](#winsetvibrancytype-options-macos "Direct link to winsetvibrancytype-options-macos")

* `type` string | null - Can be `titlebar`, `selection`, `menu`, `popover`, `sidebar`, `header`, `sheet`, `window`, `hud`, `fullscreen-ui`, `tooltip`, `content`, `under-window`, or `under-page`. See
the [macOS documentation](https://developer.apple.com/documentation/appkit/nsvisualeffectview?preferredLanguage=objc) for more details.
* `options` Object (optional)
+ `animationDuration` number (optional) - if greater than zero, the change to vibrancy will be animated over the given duration (in milliseconds).

Adds a vibrancy effect to the browser window. Passing `null` or an empty string
will remove the vibrancy effect on the window. The `animationDuration` parameter only
animates fading in or fading out the vibrancy effect. Animating between
different types of vibrancy is not supported.

#### `win.setBackgroundMaterial(material)` *Windows*[â](#winsetbackgroundmaterialmaterial-windows "Direct link to winsetbackgroundmaterialmaterial-windows")

* `material` string
+ `auto` - Let the Desktop Window Manager (DWM) automatically decide the system-drawn backdrop material for this window. This is the default.
+ `none` - Don't draw any system backdrop.
+ `mica` - Draw the backdrop material effect corresponding to a long-lived window.
+ `acrylic` - Draw the backdrop material effect corresponding to a transient window.
+ `tabbed` - Draw the backdrop material effect corresponding to a window with a tabbed title bar.

This method sets the browser window's system-drawn background material, including behind the non-client area.

See the [Windows documentation](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwm_systembackdrop_type) for more details.

note

This method is only supported on Windows 11 22H2 and up.

#### `win.setWindowButtonPosition(position)` *macOS*[â](#winsetwindowbuttonpositionposition-macos "Direct link to winsetwindowbuttonpositionposition-macos")

* `position` [Point](/docs/latest/api/structures/point) | null

Set a custom position for the traffic light buttons in frameless window.
Passing `null` will reset the position to default.

#### `win.getWindowButtonPosition()` *macOS*[â](#wingetwindowbuttonposition-macos "Direct link to wingetwindowbuttonposition-macos")

Returns `Point | null` - The custom position for the traffic light buttons in
frameless window, `null` will be returned when there is no custom position.

#### `win.setTouchBar(touchBar)` *macOS*[â](#winsettouchbartouchbar-macos "Direct link to winsettouchbartouchbar-macos")

* `touchBar` TouchBar | null

Sets the touchBar layout for the current window. Specifying `null` or
`undefined` clears the touch bar. This method only has an effect if the
machine has a touch bar.

note

The TouchBar API is currently experimental and may change or be
removed in future Electron releases.

#### `win.setBrowserView(browserView)` *Experimental* *Deprecated*[â](#winsetbrowserviewbrowserview-experimental-deprecated "Direct link to winsetbrowserviewbrowserview-experimental-deprecated")

* `browserView` [BrowserView](/docs/latest/api/browser-view) | null - Attach `browserView` to `win`.
If there are other `BrowserView`s attached, they will be removed from
this window.

warning

The `BrowserView` class is deprecated, and replaced by the new
[`WebContentsView`](/docs/latest/api/web-contents-view) class.

#### `win.getBrowserView()` *Experimental* *Deprecated*[â](#wingetbrowserview-experimental-deprecated "Direct link to wingetbrowserview-experimental-deprecated")

Returns `BrowserView | null` - The `BrowserView` attached to `win`. Returns `null`
if one is not attached. Throws an error if multiple `BrowserView`s are attached.

warning

The `BrowserView` class is deprecated, and replaced by the new
[`WebContentsView`](/docs/latest/api/web-contents-view) class.

#### `win.addBrowserView(browserView)` *Experimental* *Deprecated*[â](#winaddbrowserviewbrowserview-experimental-deprecated "Direct link to winaddbrowserviewbrowserview-experimental-deprecated")

* `browserView` [BrowserView](/docs/latest/api/browser-view)

Replacement API for setBrowserView supporting work with multi browser views.

warning

The `BrowserView` class is deprecated, and replaced by the new
[`WebContentsView`](/docs/latest/api/web-contents-view) class.

#### `win.removeBrowserView(browserView)` *Experimental* *Deprecated*[â](#winremovebrowserviewbrowserview-experimental-deprecated "Direct link to winremovebrowserviewbrowserview-experimental-deprecated")

* `browserView` [BrowserView](/docs/latest/api/browser-view)

warning

The `BrowserView` class is deprecated, and replaced by the new
[`WebContentsView`](/docs/latest/api/web-contents-view) class.

#### `win.setTopBrowserView(browserView)` *Experimental* *Deprecated*[â](#winsettopbrowserviewbrowserview-experimental-deprecated "Direct link to winsettopbrowserviewbrowserview-experimental-deprecated")

* `browserView` [BrowserView](/docs/latest/api/browser-view)

Raises `browserView` above other `BrowserView`s attached to `win`.
Throws an error if `browserView` is not attached to `win`.

warning

The `BrowserView` class is deprecated, and replaced by the new
[`WebContentsView`](/docs/latest/api/web-contents-view) class.

#### `win.getBrowserViews()` *Experimental* *Deprecated*[â](#wingetbrowserviews-experimental-deprecated "Direct link to wingetbrowserviews-experimental-deprecated")

Returns `BrowserView[]` - a sorted by z-index array of all BrowserViews that have been attached
with `addBrowserView` or `setBrowserView`. The top-most BrowserView is the last element of the array.

warning

The `BrowserView` class is deprecated, and replaced by the new
[`WebContentsView`](/docs/latest/api/web-contents-view) class.

#### `win.setTitleBarOverlay(options)` *Windows* *Linux*[â](#winsettitlebaroverlayoptions-windows-linux "Direct link to winsettitlebaroverlayoptions-windows-linux")

* `options` Object
+ `color` String (optional) - The CSS color of the Window Controls Overlay when enabled.
+ `symbolColor` String (optional) - The CSS color of the symbols on the Window Controls Overlay when enabled.
+ `height` Integer (optional) - The height of the title bar and Window Controls Overlay in pixels.

On a window with Window Controls Overlay already enabled, this method updates the style of the title bar overlay.

On Linux, the `symbolColor` is automatically calculated to have minimum accessible contrast to the `color` if not explicitly set.

* [Window customization](#window-customization)* [Showing the window gracefully](#showing-the-window-gracefully)
+ [Using the `ready-to-show` event](#using-the-ready-to-show-event)+ [Setting the `backgroundColor` property](#setting-the-backgroundcolor-property)* [Parent and child windows](#parent-and-child-windows)* [Modal windows](#modal-windows)* [Page visibility](#page-visibility)* [Platform notices](#platform-notices)* [Class: BrowserWindow extends `BaseWindow`](#class-browserwindow-extends-basewindow)
+ [`new BrowserWindow([options])`](#new-browserwindowoptions)+ [Instance Events](#instance-events)
- [`'page-title-updated'`](#event-page-title-updated)- [`'close'`](#event-close)- [`'closed'`](#event-closed)- [`'query-session-end'`](#event-query-session-end-windows)- [`'session-end'`](#event-session-end-windows)- [`'unresponsive'`](#event-unresponsive)- [`'responsive'`](#event-responsive)- [`'blur'`](#event-blur)- [`'focus'`](#event-focus)- [`'show'`](#event-show)- [`'hide'`](#event-hide)- [`'ready-to-show'`](#event-ready-to-show)- [`'maximize'`](#event-maximize)- [`'unmaximize'`](#event-unmaximize)- [`'minimize'`](#event-minimize)- [`'restore'`](#event-restore)- [`'will-resize'`](#event-will-resize-macos-windows)- [`'resize'`](#event-resize)- [`'resized'`](#event-resized-macos-windows)- [`'will-move'`](#event-will-move-macos-windows)- [`'move'`](#event-move)- [`'moved'`](#event-moved-macos-windows)- [`'enter-full-screen'`](#event-enter-full-screen)- [`'leave-full-screen'`](#event-leave-full-screen)- [`'enter-html-full-screen'`](#event-enter-html-full-screen)- [`'leave-html-full-screen'`](#event-leave-html-full-screen)- [`'always-on-top-changed'`](#event-always-on-top-changed)- [`'app-command'`](#event-app-command-windows-linux)- [`'swipe'`](#event-swipe-macos)- [`'rotate-gesture'`](#event-rotate-gesture-macos)- [`'sheet-begin'`](#event-sheet-begin-macos)- [`'sheet-end'`](#event-sheet-end-macos)- [`'new-window-for-tab'`](#event-new-window-for-tab-macos)- [`'system-context-menu'`](#event-system-context-menu-windows-linux)+ [Static Methods](#static-methods)
- [`getAllWindows`](#browserwindowgetallwindows)- [`getFocusedWindow`](#browserwindowgetfocusedwindow)- [`fromWebContents`](#browserwindowfromwebcontentswebcontents)- [`fromBrowserView`](#browserwindowfrombrowserviewbrowserview-deprecated)- [`fromId`](#browserwindowfromidid)+ [Instance Properties](#instance-properties)
- [`webContents`](#winwebcontents-readonly)- [`id`](#winid-readonly)- [`tabbingIdentifier`](#wintabbingidentifier-macos-readonly)- [`autoHideMenuBar`](#winautohidemenubar-linux-windows)- [`simpleFullScreen`](#winsimplefullscreen)- [`fullScreen`](#winfullscreen)- [`focusable`](#winfocusable-windows-macos)- [`visibleOnAllWorkspaces`](#winvisibleonallworkspaces-macos-linux)- [`shadow`](#winshadow)- [`menuBarVisible`](#winmenubarvisible-windows-linux)- [`kiosk`](#winkiosk)- [`documentEdited`](#windocumentedited-macos)- [`representedFilename`](#winrepresentedfilename-macos)- [`title`](#wintitle)- [`minimizable`](#winminimizable-macos-windows)- [`maximizable`](#winmaximizable-macos-windows)- [`fullScreenable`](#winfullscreenable)- [`resizable`](#winresizable)- [`closable`](#winclosable-macos-windows)- [`movable`](#winmovable-macos-windows)- [`excludedFromShownWindowsMenu`](#winexcludedfromshownwindowsmenu-macos)- [`accessibleTitle`](#winaccessibletitle)- [`snapped`](#winsnapped-windows-readonly)+ [Instance Methods](#instance-methods)
- [`destroy`](#windestroy)- [`close`](#winclose)- [`focus`](#winfocus)- [`blur`](#winblur)- [`isFocused`](#winisfocused)- [`isDestroyed`](#winisdestroyed)- [`show`](#winshow)- [`showInactive`](#winshowinactive)- [`hide`](#winhide)- [`isVisible`](#winisvisible)- [`isModal`](#winismodal)- [`maximize`](#winmaximize)- [`unmaximize`](#winunmaximize)- [`isMaximized`](#winismaximized)- [`minimize`](#winminimize)- [`restore`](#winrestore)- [`isMinimized`](#winisminimized)- [`setFullScreen`](#winsetfullscreenflag)- [`isFullScreen`](#winisfullscreen)- [`setSimpleFullScreen`](#winsetsimplefullscreenflag-macos)- [`isSimpleFullScreen`](#winissimplefullscreen-macos)- [`isNormal`](#winisnormal)- [`setAspectRatio`](#winsetaspectratioaspectratio-extrasize)- [`setBackgroundColor`](#winsetbackgroundcolorbackgroundcolor)- [`previewFile`](#winpreviewfilepath-displayname-macos)- [`closeFilePreview`](#winclosefilepreview-macos)- [`setBounds`](#winsetboundsbounds-animate)- [`getBounds`](#wingetbounds)- [`getBackgroundColor`](#wingetbackgroundcolor)- [`setContentBounds`](#winsetcontentboundsbounds-animate)- [`getContentBounds`](#wingetcontentbounds)- [`getNormalBounds`](#wingetnormalbounds)- [`setEnabled`](#winsetenabledenable)- [`isEnabled`](#winisenabled)- [`setSize`](#winsetsizewidth-height-animate)- [`getSize`](#wingetsize)- [`setContentSize`](#winsetcontentsizewidth-height-animate)- [`getContentSize`](#wingetcontentsize)- [`setMinimumSize`](#winsetminimumsizewidth-height)- [`getMinimumSize`](#wingetminimumsize)- [`setMaximumSize`](#winsetmaximumsizewidth-height)- [`getMaximumSize`](#wingetmaximumsize)- [`setResizable`](#winsetresizableresizable)- [`isResizable`](#winisresizable)- [`setMovable`](#winsetmovablemovable-macos-windows)- [`isMovable`](#winismovable-macos-windows)- [`setMinimizable`](#winsetminimizableminimizable-macos-windows)- [`isMinimizable`](#winisminimizable-macos-windows)- [`setMaximizable`](#winsetmaximizablemaximizable-macos-windows)- [`isMaximizable`](#winismaximizable-macos-windows)- [`setFullScreenable`](#winsetfullscreenablefullscreenable)- [`isFullScreenable`](#winisfullscreenable)- [`setClosable`](#winsetclosableclosable-macos-windows)- [`isClosable`](#winisclosable-macos-windows)- [`setHiddenInMissionControl`](#winsethiddeninmissioncontrolhidden-macos)- [`isHiddenInMissionControl`](#winishiddeninmissioncontrol-macos)- [`setAlwaysOnTop`](#winsetalwaysontopflag-level-relativelevel)- [`isAlwaysOnTop`](#winisalwaysontop)- [`moveAbove`](#winmoveabovemediasourceid)- [`moveTop`](#winmovetop)- [`center`](#wincenter)- [`setPosition`](#winsetpositionx-y-animate)- [`getPosition`](#wingetposition)- [`setTitle`](#winsettitletitle)- [`getTitle`](#wingettitle)- [`setSheetOffset`](#winsetsheetoffsetoffsety-offsetx-macos)- [`flashFrame`](#winflashframeflag)- [`setSkipTaskbar`](#winsetskiptaskbarskip-macos-windows)- [`setKiosk`](#winsetkioskflag)- [`isKiosk`](#winiskiosk)- [`isTabletMode`](#winistabletmode-windows)- [`getMediaSourceId`](#wingetmediasourceid)- [`getNativeWindowHandle`](#wingetnativewindowhandle)- [`hookWindowMessage`](#winhookwindowmessagemessage-callback-windows)- [`isWindowMessageHooked`](#winiswindowmessagehookedmessage-windows)- [`unhookWindowMessage`](#winunhookwindowmessagemessage-windows)- [`unhookAllWindowMessages`](#winunhookallwindowmessages-windows)- [`setRepresentedFilename`](#winsetrepresentedfilenamefilename-macos)- [`getRepresentedFilename`](#wingetrepresentedfilename-macos)- [`setDocumentEdited`](#winsetdocumenteditededited-macos)- [`isDocumentEdited`](#winisdocumentedited-macos)- [`focusOnWebView`](#winfocusonwebview)- [`blurWebView`](#winblurwebview)- [`capturePage`](#wincapturepagerect-opts)- [`loadURL`](#winloadurlurl-options)- [`loadFile`](#winloadfilefilepath-options)- [`reload`](#winreload)- [`setMenu`](#winsetmenumenu-linux-windows)- [`removeMenu`](#winremovemenu-linux-windows)- [`setProgressBar`](#winsetprogressbarprogress-options)- [`setOverlayIcon`](#winsetoverlayiconoverlay-description-windows)- [`invalidateShadow`](#wininvalidateshadow-macos)- [`setHasShadow`](#winsethasshadowhasshadow)- [`hasShadow`](#winhasshadow)- [`setOpacity`](#winsetopacityopacity-windows-macos)- [`getOpacity`](#wingetopacity)- [`setShape`](#winsetshaperects-windows-linux-experimental)- [`setThumbarButtons`](#winsetthumbarbuttonsbuttons-windows)- [`setThumbnailClip`](#winsetthumbnailclipregion-windows)- [`setThumbnailToolTip`](#winsetthumbnailtooltiptooltip-windows)- [`setAppDetails`](#winsetappdetailsoptions-windows)- [`setAccentColor`](#winsetaccentcoloraccentcolor-windows)- [`getAccentColor`](#wingetaccentcolor-windows)- [`showDefinitionForSelection`](#winshowdefinitionforselection-macos)- [`setIcon`](#winseticonicon-windows-linux)- [`setWindowButtonVisibility`](#winsetwindowbuttonvisibilityvisible-macos)- [`setAutoHideMenuBar`](#winsetautohidemenubarhide-windows-linux)- [`isMenuBarAutoHide`](#winismenubarautohide-windows-linux)- [`setMenuBarVisibility`](#winsetmenubarvisibilityvisible-windows-linux)- [`isMenuBarVisible`](#winismenubarvisible-windows-linux)- [`isSnapped`](#winissnapped-windows)- [`setVisibleOnAllWorkspaces`](#winsetvisibleonallworkspacesvisible-options-macos-linux)- [`isVisibleOnAllWorkspaces`](#winisvisibleonallworkspaces-macos-linux)- [`setIgnoreMouseEvents`](#winsetignoremouseeventsignore-options)- [`setContentProtection`](#winsetcontentprotectionenable-macos-windows)- [`isContentProtected`](#winiscontentprotected-macos-windows)- [`setFocusable`](#winsetfocusablefocusable-macos-windows)- [`isFocusable`](#winisfocusable-macos-windows)- [`setParentWindow`](#winsetparentwindowparent)- [`getParentWindow`](#wingetparentwindow)- [`getChildWindows`](#wingetchildwindows)- [`setAutoHideCursor`](#winsetautohidecursorautohide-macos)- [`selectPreviousTab`](#winselectprevioustab-macos)- [`selectNextTab`](#winselectnexttab-macos)- [`showAllTabs`](#winshowalltabs-macos)- [`mergeAllWindows`](#winmergeallwindows-macos)- [`moveTabToNewWindow`](#winmovetabtonewwindow-macos)- [`toggleTabBar`](#wintoggletabbar-macos)- [`addTabbedWindow`](#winaddtabbedwindowbrowserwindow-macos)- [`setVibrancy`](#winsetvibrancytype-options-macos)- [`setBackgroundMaterial`](#winsetbackgroundmaterialmaterial-windows)- [`setWindowButtonPosition`](#winsetwindowbuttonpositionposition-macos)- [`getWindowButtonPosition`](#wingetwindowbuttonposition-macos)- [`setTouchBar`](#winsettouchbartouchbar-macos)- [`setBrowserView`](#winsetbrowserviewbrowserview-experimental-deprecated)- [`getBrowserView`](#wingetbrowserview-experimental-deprecated)- [`addBrowserView`](#winaddbrowserviewbrowserview-experimental-deprecated)- [`removeBrowserView`](#winremovebrowserviewbrowserview-experimental-deprecated)- [`setTopBrowserView`](#winsettopbrowserviewbrowserview-experimental-deprecated)- [`getBrowserViews`](#wingetbrowserviews-experimental-deprecated)- [`setTitleBarOverlay`](#winsettitlebaroverlayoptions-windows-linux)