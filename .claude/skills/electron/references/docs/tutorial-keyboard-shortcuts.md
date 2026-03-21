# Source: https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts

On this page

## Accelerators[â](#accelerators "Direct link to Accelerators")

Accelerators are strings that can be used to represent keyboard shortcuts throughout your Electron.
These strings can contain multiple modifiers keys and a single key code joined by the `+` character.

note

Accelerators are **case-insensitive**.

### Available modifiers[â](#available-modifiers "Direct link to Available modifiers")

* `Command` (or `Cmd` for short)
* `Control` (or `Ctrl` for short)
* `CommandOrControl` (or `CmdOrCtrl` for short)
* `Alt`
* `Option`
* `AltGr`
* `Shift`
* `Super` (or `Meta` as alias)

### Available key codes[â](#available-key-codes "Direct link to Available key codes")

* `0` to `9`
* `A` to `Z`
* `F1` to `F24`
* Various Punctuation: `)`, `!`, `@`, `#`, `$`, `%`, `^`, `&`, `*`, `(`, `:`, `;`, `:`, `+`, `=`, `<`, `,`, `_`, `-`, `>`, `.`, `?`, `/`, `~`, `` ` ``, `{`, `]`, `[`, `|`, `\`, `}`, `"`
* `Plus`
* `Space`
* `Tab`
* `Capslock`
* `Numlock`
* `Scrolllock`
* `Backspace`
* `Delete`
* `Insert`
* `Return` (or `Enter` as alias)
* `Up`, `Down`, `Left` and `Right`
* `Home` and `End`
* `PageUp` and `PageDown`
* `Escape` (or `Esc` for short)
* `VolumeUp`, `VolumeDown` and `VolumeMute`
* `MediaNextTrack`, `MediaPreviousTrack`, `MediaStop` and `MediaPlayPause`
* `PrintScreen`
* NumPad Keys
+ `num0` - `num9`
+ `numdec` - decimal key
+ `numadd` - numpad `+` key
+ `numsub` - numpad `-` key
+ `nummult` - numpad `*` key
+ `numdiv` - numpad `Ã·` key

### Cross-platform modifiers[â](#cross-platform-modifiers "Direct link to Cross-platform modifiers")

Many modifier accelerators map to different keys between operating systems.

|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Modifier macOS Windows and Linux|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | | `CommandOrControl` Command (â) Control|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | | `Command` Command (â) N/A|  |  |  |  |  |  |  |  |  |  |  |  | | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | | `Control` Control (^) Control|  |  |  |  |  |  |  |  |  | | --- | --- | --- | --- | --- | --- | --- | --- | --- | | `Alt` Option (â¥) Alt|  |  |  |  |  |  | | --- | --- | --- | --- | --- | --- | | `Option` Option (â¥) N/A|  |  |  | | --- | --- | --- | | `Super` (`Meta`) Command (â) Windows (â) | | | | | | | | | | | | | | | | | | | | |

info

* On Linux and Windows, the `Command` modifier does not have any effect. In general, you should use
the `CommandOrControl` modifier instead, which represents `â Cmd` on macOS and `Ctrl`
on Linux and Windows.
* Use `Alt` instead of `Option`. The `â¥ Opt` key only exists on macOS, whereas the `Alt` will
map to the appropriate modifier on all platforms.

#### Examples[â](#examples "Direct link to Examples")

Here are some examples of cross-platform Electron accelerators for common editing operations:

* Copy: `CommandOrControl+C`
* Paste: `CommandOrControl+V`
* Undo: `CommandOrControl+Z`
* Redo: `CommandOrControl+Shift+Z`

## Local shortcuts[â](#local-shortcuts "Direct link to Local shortcuts")

**Local** keyboard shortcuts are triggered only when the application is focused. These shortcuts
map to specific menu items within the app's main [application menu](/docs/latest/tutorial/application-menu).

To define a local keyboard shortcut, you need to configure the `accelerator` property when creating
a [MenuItem](/docs/latest/api/menu-item). Then, the `click` event associated to that menu item will trigger
upon using that accelerator.

Opening a dialog via accelerator (local)

```
const { dialog, Menu, MenuItem } = require('electron/main')

const menu = new Menu()

// The first submenu needs to be the app menu on macOS
if (process.platform === 'darwin') {
const appMenu = new MenuItem({ role: 'appMenu' })
menu.append(appMenu)
}

const submenu = Menu.buildFromTemplate([{
label: 'Open a Dialog',
click: () => dialog.showMessageBox({ message: 'Hello World!' }),
accelerator: 'CommandOrControl+Alt+R'
}])
menu.append(new MenuItem({ label: 'Custom Menu', submenu }))

Menu.setApplicationMenu(menu)
```

In the above example, a native "Hello World" dialog will open when pressing `â Cmd`+`â¥ Opt`+`R`
on macOS or `Ctrl`+`Alt`+`R` on other platforms.

tip

Accelerators can work even when menu items are hidden. On macOS, this feature can be disabled by
setting `acceleratorWorksWhenHidden: false` when building a `MenuItem`.

tip

On Windows and Linux, the `registerAccelerator` property of the `MenuItem` can be set to `false`
so that the accelerator is visible in the system menu but not enabled.

## Global shortcuts[â](#global-shortcuts "Direct link to Global shortcuts")

**Global** keyboard shortcuts work even when your app is out of focus. To configure a global keyboard
shortcut, you can use the [`globalShortcut.register`](/docs/latest/api/global-shortcut#globalshortcutregisteraccelerator-callback)
function to specify shortcuts.

Opening a dialog via accelerator (global)

```
const { dialog, globalShortcut } = require('electron/main')

globalShortcut.register('CommandOrControl+Alt+R', () => {
dialog.showMessageBox({ message: 'Hello World!' })
})
```

To later unregister a shortcut, you can use the [`globalShortcut.unregisterAccelerator`](/docs/latest/api/global-shortcut#globalshortcutunregisteraccelerator)
function.

Opening a dialog via accelerator (global)

```
const { globalShortcut } = require('electron/main')

globalShortcut.unregister('CommandOrControl+Alt+R')
```

warning

On macOS, there's a long-standing bug with `globalShortcut` that prevents it from working with
keyboard layouts other than QWERTY ([electron/electron#19747](https://github.com/electron/electron/issues/19747)).

## Shortcuts within a window[â](#shortcuts-within-a-window "Direct link to Shortcuts within a window")

### In the renderer process[â](#in-the-renderer-process "Direct link to In the renderer process")

If you want to handle keyboard shortcuts within a [BaseWindow](/docs/latest/api/base-window), you can
listen for the [`keyup`](https://developer.mozilla.org/en-US/docs/Web/API/Element/keyup_event) and
[`keydown`](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event) DOM Events inside
the renderer process using the [addEventListener](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) API.

[docs/fiddles/features/keyboard-shortcuts/web-apis (40.0.0)](https://github.com/electron/electron/tree/v40.0.0/docs/fiddles/features/keyboard-shortcuts/web-apis)[Open in Fiddle](https://fiddle.electronjs.org/launch?target=electron/v40.0.0/docs/fiddles/features/keyboard-shortcuts/web-apis)

* main.js* index.html* renderer.js

```
// Modules to control application life and create native browser window
const { app, BrowserWindow } = require('electron/main')

function createWindow () {
// Create the browser window.
const mainWindow = new BrowserWindow({
width: 800,
height: 600
})

// and load the index.html of the app.
mainWindow.loadFile('index.html')
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
createWindow()

app.on('activate', function () {
// On macOS it's common to re-create a window in the app when the
// dock icon is clicked and there are no other windows open.
if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
if (process.platform !== 'darwin') app.quit()
})
```

```
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<!-- https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">
<meta http-equiv="X-Content-Security-Policy" content="default-src 'self'; script-src 'self'">
<title>Hello World!</title>
</head>
<body>
<h1>Hello World!</h1>

<p>Hit any key with this window focused to see it captured here.</p>
<div><span>Last Key Pressed: </span><span id="last-keypress"></span></div>
<script src="./renderer.js"></script>
</body>
</html>
```

```
function handleKeyPress (event) {
// You can put code here to handle the keypress.
document.getElementById('last-keypress').innerText = event.key
console.log(`You pressed ${event.key}`)
}

window.addEventListener('keyup', handleKeyPress, true)
```

note

The third parameter `true` indicates that the listener will always receive
key presses before other listeners so they can't have `stopPropagation()`
called on them.

#### Intercepting events in the main process[â](#intercepting-events-in-the-main-process "Direct link to Intercepting events in the main process")

The [`before-input-event`](/docs/latest/api/web-contents#event-before-input-event) event
is emitted before dispatching `keydown` and `keyup` events in the renderer process. It can
be used to catch and handle custom shortcuts that are not visible in the menu.

Intercepting the Ctrl+I event from the main process

```
const { app, BrowserWindow } = require('electron/main')

app.whenReady().then(() => {
const win = new BrowserWindow()

win.loadFile('index.html')
win.webContents.on('before-input-event', (event, input) => {
if (input.control && input.key.toLowerCase() === 'i') {
console.log('Pressed Control+I')
event.preventDefault()
}
})
})
```

* [Accelerators](#accelerators)
+ [Available modifiers](#available-modifiers)+ [Available key codes](#available-key-codes)+ [Cross-platform modifiers](#cross-platform-modifiers)
- [Examples](#examples)* [Local shortcuts](#local-shortcuts)* [Global shortcuts](#global-shortcuts)* [Shortcuts within a window](#shortcuts-within-a-window)
+ [In the renderer process](#in-the-renderer-process)
- [Intercepting events in the main process](#intercepting-events-in-the-main-process)