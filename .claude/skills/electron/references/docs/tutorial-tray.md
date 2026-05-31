# Source: https://www.electronjs.org/docs/latest/tutorial/tray

On this page

This guide will take you through the process of creating an icon with its own context menu to the
system tray.

* On macOS, the icon will be located on the top right corner of your screen in the
[menu bar extras](https://developer.apple.com/design/human-interface-guidelines/the-menu-bar#Menu-bar-extras)
area.
* On Windows, the icon will be located in the [notification area](https://learn.microsoft.com/en-us/windows/win32/shell/notification-area)
at the end of the taskbar.
* On Linux, the location of the Tray will differ based on your desktop environment.

## Creating a Tray icon[â](#creating-a-tray-icon "Direct link to Creating a Tray icon")

The tray icon for your Electron app needs to be created programmatically with an instance of
the [Tray](/docs/latest/api/tray#new-trayimage-guid) class. The class constructor requires a single
instance of a [NativeImage](/docs/latest/api/native-image#class-nativeimage) or a path to a compatible icon
file.

note

File formats vary per operating system. For more details, see the
[Platform Considerations](/docs/latest/api/tray#platform-considerations) section of the Tray API documentation.

## Minimizing to tray[â](#minimizing-to-tray "Direct link to Minimizing to tray")

In order to keep the app and the system tray icon alive even when all windows are closed, you need to
have a listener for the [`window-all-closed`](/docs/latest/api/app#event-window-all-closed) event on the
`app` module. The base Electron templates generally listen for this event but quit the app on
Windows and Linux to emulate standard OS behavior.

Setting up minimize to tray

```
app.on('window-all-closed', () => {
// having this listener active will prevent the app from quitting.
})
```

## Attaching a context menu[â](#attaching-a-context-menu "Direct link to Attaching a context menu")

You can attach a context menu to the Tray object by passing in a [Menu](/docs/latest/api/menu) instance
into the [`tray.setContextMenu`](/docs/latest/api/tray#traysetcontextmenumenu) function.

note

Unlike with regular [context menus](/docs/latest/tutorial/context-menu), Tray context menus don't need to be
manually instrumented using the `menu.popup` API. Instead, the Tray object handles click events
for you (although various click-related events exist on the API for advanced use cases).

Creating a Tray menu that can quit the app

```
const { nativeImage } = require('electron/common')
const { app, Tray, Menu } = require('electron/main')

// save a reference to the Tray object globally to avoid garbage collection
let tray

// 16x16 red circle data URL
const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACTSURBVHgBpZKBCYAgEEV/TeAIjuIIbdQIuUGt0CS1gW1iZ2jIVaTnhw+Cvs8/OYDJA4Y8kR3ZR2/kmazxJbpUEfQ/Dm/UG7wVwHkjlQdMFfDdJMFaACebnjJGyDWgcnZu1/lrCrl6NCoEHJBrDwEr5NrT6ko/UV8xdLAC2N49mlc5CylpYh8wCwqrvbBGLoKGvz8Bfq0QPWEUo/EAAAAASUVORK5CYII=')

// The Tray can only be instantiated after the 'ready' event is fired
app.whenReady().then(() => {
tray = new Tray(icon)
const contextMenu = Menu.buildFromTemplate([
{ role: 'quit' }
])
tray.setContextMenu(contextMenu)
})
```

tip

To learn more about crafting menus in Electron, see the [Menus](/docs/latest/tutorial/menus#building-menus) guide.

warning

The `enabled` and `visibility` properties are not available for top-level menu items in the tray on macOS.

## Runnable Fiddle demo[â](#runnable-fiddle-demo "Direct link to Runnable Fiddle demo")

Below is a runnable example of attaching various menu items to the Tray's context menu that help
control app state and interact with the Tray API itself.

[docs/fiddles/menus/tray-menu (40.0.0)](https://github.com/electron/electron/tree/v40.0.0/docs/fiddles/menus/tray-menu)[Open in Fiddle](https://fiddle.electronjs.org/launch?target=electron/v40.0.0/docs/fiddles/menus/tray-menu)

* main.js* index.html

```
const { app, BrowserWindow, Menu, Tray } = require('electron/main')
const { nativeImage } = require('electron/common')

// save a reference to the Tray object globally to avoid garbage collection
let tray = null

function createWindow () {
const mainWindow = new BrowserWindow()
mainWindow.loadFile('index.html')
}

// The Tray object can only be instantiated after the 'ready' event is fired
app.whenReady().then(() => {
createWindow()

const red = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACTSURBVHgBpZKBCYAgEEV/TeAIjuIIbdQIuUGt0CS1gW1iZ2jIVaTnhw+Cvs8/OYDJA4Y8kR3ZR2/kmazxJbpUEfQ/Dm/UG7wVwHkjlQdMFfDdJMFaACebnjJGyDWgcnZu1/lrCrl6NCoEHJBrDwEr5NrT6ko/UV8xdLAC2N49mlc5CylpYh8wCwqrvbBGLoKGvz8Bfq0QPWEUo/EAAAAASUVORK5CYII=')
const green = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACOSURBVHgBpZLRDYAgEEOrEzgCozCCGzkCbKArOIlugJvgoRAUNcLRpvGH19TkgFQWkqIohhK8UEaKwKcsOg/+WR1vX+AlA74u6q4FqgCOSzwsGHCwbKliAF89Cv89tWmOT4VaVMoVbOBrdQUz+FrD6XItzh4LzYB1HFJ9yrEkZ4l+wvcid9pTssh4UKbPd+4vED2Nd54iAAAAAElFTkSuQmCC')

tray = new Tray(red)
tray.setToolTip('Tray Icon Demo')

const contextMenu = Menu.buildFromTemplate([
{
label: 'Open App',
click: () => {
const wins = BrowserWindow.getAllWindows()
if (wins.length === 0) {
createWindow()
} else {
wins[0].focus()
}
}
},
{
label: 'Set Green Icon',
type: 'checkbox',
click: ({ checked }) => {
checked ? tray.setImage(green) : tray.setImage(red)
}
},
{
label: 'Set Title',
type: 'checkbox',
click: ({ checked }) => {
checked ? tray.setTitle('Title') : tray.setTitle('')
}
},
{ role: 'quit' }
])

tray.setContextMenu(contextMenu)
})

app.on('window-all-closed', function () {
// This will prevent the app from closing when windows close
})

app.on('activate', function () {
if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

```
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<!-- https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">
<title>Tray Menu Demo</title>
</head>
<body>
<h1>Tray Menu Demo</h1>
<p>This app will stay running even after all windows are closed.</p>
<ul>
<li>Use the "Open App" menu item to focus the main window (or open one if it does not exist).</li>
<li>Change between red and green Tray icons with the "Set Green Icon" checkbox.</li>
<li>Give the Tray icon a title using the "Set Title" checkbox.</li>
<li>Quit the app using the "Quit" menu item.</li>
</ul>
</body>
</html>
```

* [Creating a Tray icon](#creating-a-tray-icon)* [Minimizing to tray](#minimizing-to-tray)* [Attaching a context menu](#attaching-a-context-menu)* [Runnable Fiddle demo](#runnable-fiddle-demo)