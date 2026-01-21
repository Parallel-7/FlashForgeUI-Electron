# Source: https://www.electronjs.org/docs/latest/tutorial/context-menu

On this page

Context menus are pop-up menus that appear when right-clicking (or pressing a shortcut
such as `Shift` + `F10` on Windows) somewhere in an app's interface.

No context menu will appear by default in Electron. However, context menus can be created by using
the [`menu.popup`](/docs/latest/api/menu#menupopupoptions) function on an instance of the
[Menu](/docs/latest/api/menu) class. You will need to listen for specific context menu events and set up
the trigger for `menu.popup` manually.

There are two ways of listening for context menu events in Electron: either via the main process
through [webContents](/docs/latest/api/web-contents) or in the renderer process via the
[`contextmenu`](https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event) web event.

## Using the `context-menu` event (main)[â](#using-the-context-menu-event-main "Direct link to using-the-context-menu-event-main")

Whenever a right-click is detected within the bounds of a specific `WebContents` instance, a
[`context-menu`](/docs/latest/api/web-contents#event-context-menu) event is triggered. The `params` object
passed to the listener provides an extensive list of attributes to distinguish which type of element
is receiving the event.

For example, if you want to provide a context menu for links, check for the `linkURL` parameter.
If you want to check for editable elements such as `<textarea/>`, check for the `isEditable` parameter.

[docs/fiddles/menus/context-menu/web-contents (40.0.0)](https://github.com/electron/electron/tree/v40.0.0/docs/fiddles/menus/context-menu/web-contents)[Open in Fiddle](https://fiddle.electronjs.org/launch?target=electron/v40.0.0/docs/fiddles/menus/context-menu/web-contents)

* main.js* index.html

```
const { app, BrowserWindow, Menu } = require('electron/main')

function createWindow () {
const win = new BrowserWindow()
const menu = Menu.buildFromTemplate([
{ role: 'copy' },
{ role: 'cut' },
{ role: 'paste' },
{ role: 'selectall' }
])
win.webContents.on('context-menu', (_event, params) => {
// only show the context menu if the element is editable
if (params.isEditable) {
menu.popup()
}
})
win.loadFile('index.html')
}

app.whenReady().then(() => {
createWindow()

app.on('activate', function () {
if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
})

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
<title>Context Menu Demo</title>
</head>
<body>
<h1>Context Menu Demo</h1>
<textarea></textarea>
</body>
</html>
```

## Using the `contextmenu` event (renderer)[â](#using-the-contextmenu-event-renderer "Direct link to using-the-contextmenu-event-renderer")

Alternatively, you can also listen to the [`contextmenu`](https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event)
event available on DOM elements in the renderer process and call the `menu.popup` function via IPC.

tip

To learn more about IPC basics in Electron, see the [Inter-Process Communication](/docs/latest/tutorial/ipc) guide.

[docs/fiddles/menus/context-menu/dom (40.0.0)](https://github.com/electron/electron/tree/v40.0.0/docs/fiddles/menus/context-menu/dom)[Open in Fiddle](https://fiddle.electronjs.org/launch?target=electron/v40.0.0/docs/fiddles/menus/context-menu/dom)

* main.js* preload.js* index.html

```
// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, Menu } = require('electron/main')
const path = require('node:path')

function createWindow () {
const mainWindow = new BrowserWindow({
webPreferences: {
preload: path.join(__dirname, 'preload.js')
}
})

mainWindow.loadFile('index.html')
const menu = Menu.buildFromTemplate([
{ role: 'copy' },
{ role: 'cut' },
{ role: 'paste' },
{ role: 'selectall' }
])

ipcMain.on('context-menu', (event) => {
menu.popup({
window: BrowserWindow.fromWebContents(event.sender)
})
})
}

app.whenReady().then(() => {
createWindow()

app.on('activate', function () {
if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
})

app.on('window-all-closed', function () {
if (process.platform !== 'darwin') app.quit()
})
```

```
const { ipcRenderer } = require('electron/renderer')

document.addEventListener('DOMContentLoaded', () => {
const textarea = document.getElementById('editable')
textarea.addEventListener('contextmenu', (event) => {
event.preventDefault()
ipcRenderer.send('context-menu')
})
})
```

```
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<!-- https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">
<title>Context Menu Demo</title>
</head>
<body>
<h1>Context Menu Demo</h1>
<textarea id="editable"></textarea>
</body>
</html>
```

## Additional macOS menu items (e.g. Writing Tools)[â](#additional-macos-menu-items-eg-writing-tools "Direct link to Additional macOS menu items (e.g. Writing Tools)")

On macOS, the [Writing Tools](https://support.apple.com/en-ca/guide/mac-help/mchldcd6c260/15.0/mac/15.0),
[AutoFill](https://support.apple.com/en-mz/guide/safari/ibrwf71ba236/mac), and
[Services](https://support.apple.com/en-ca/guide/mac-help/mchlp1012/mac) menu items
are disabled by default for context menus in Electron. To enable these features, pass the
[WebFrameMain](/docs/latest/api/web-frame-main) associated to the target `webContents` to the `frame`
parameter in `menu.popup`.

Associating a frame to the context menu

```
const { BrowserWindow, Menu } = require('electron/main')

const menu = Menu.buildFromTemplate([{ role: 'editMenu' }])
const win = new BrowserWindow()
win.webContents.on('context-menu', (_event, params) => {
// Whether the context is editable.
if (params.isEditable) {
menu.popup({
frame: params.frame
})
}
})
```

* [Using the `context-menu` event (main)](#using-the-context-menu-event-main)* [Using the `contextmenu` event (renderer)](#using-the-contextmenu-event-renderer)* [Additional macOS menu items (e.g. Writing Tools)](#additional-macos-menu-items-eg-writing-tools)