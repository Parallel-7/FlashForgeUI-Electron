# Source: https://www.electronjs.org/docs/latest/tutorial/macos-dock

On this page

On macOS, the [Dock](https://support.apple.com/en-ca/guide/mac-help/mh35859/mac) is an interface
element that displays open and frequently-used apps. While opened or pinned, each app has its own
icon in the Dock.

note

On macOS, the Dock is the entry point for certain cross-platform features like
[Recent Documents](/docs/latest/tutorial/recent-documents) and [Application Progress](/docs/latest/tutorial/progress-bar).
Read those guides for more details.

## Dock API[â](#dock-api "Direct link to Dock API")

All functionality for the Dock is exposed via the [Dock](/docs/latest/api/dock) class exposed via
[`app.dock`](/docs/latest/api/app#appdock-macos-readonly) property. There is a single `Dock` instance per
Electron application, and this property only exists on macOS.

One of the main uses for your app's Dock icon is to expose additional app menus. The Dock menu is
triggered by right-clicking or `Ctrl`-clicking the app icon. By default, the app's Dock menu
will come with system-provided window management utilities, including the ability to show all windows,
hide the app, and switch betweeen different open windows.

To set an app-defined custom Dock menu, pass any [Menu](/docs/latest/api/menu) instance into the
[`dock.setMenu`](/docs/latest/api/dock#docksetmenumenu-macos) API.

tip

For best practices to make your Dock menu feel more native, see Apple's
[Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/dock-menus)
page on Dock menus.

## Attaching a context menu[â](#attaching-a-context-menu "Direct link to Attaching a context menu")

Setting a Dock menu

```
const { app, BrowserWindow, Menu } = require('electron/main')

// dock.setMenu only works after the 'ready' event is fired
app.whenReady().then(() => {
const dockMenu = Menu.buildFromTemplate([
{
label: 'New Window',
click: () => { const win = new BrowserWindow() }
}
// add more menu options to the array
])

// Dock is undefined on platforms outside of macOS
app.dock?.setMenu(dockMenu)
})
```

note

Unlike with regular [context menus](/docs/latest/tutorial/context-menu), Dock context menus don't need to be
manually instrumented using the `menu.popup` API. Instead, the Dock object handles click events
for you.

tip

To learn more about crafting menus in Electron, see the [Menus](/docs/latest/tutorial/menus#building-menus) guide.

## Runnable Fiddle demo[â](#runnable-fiddle-demo "Direct link to Runnable Fiddle demo")

Below is a runnable example of how you can use the Dock menu to create and close windows in your
Electron app.

[docs/fiddles/menus/dock-menu (40.0.0)](https://github.com/electron/electron/tree/v40.0.0/docs/fiddles/menus/dock-menu)[Open in Fiddle](https://fiddle.electronjs.org/launch?target=electron/v40.0.0/docs/fiddles/menus/dock-menu)

* main.js* index.html* renderer.js

```
const { app, BrowserWindow, Menu } = require('electron/main')
const { shell } = require('electron/common')

function createWindow () {
const win = new BrowserWindow()
win.loadFile('index.html')
}

function closeAllWindows () {
const wins = BrowserWindow.getAllWindows()
for (const win of wins) {
win.close()
}
}

app.whenReady().then(() => {
createWindow()

const dockMenu = Menu.buildFromTemplate([
{
label: 'New Window',
click: () => { createWindow() }
},
{
label: 'Close All Windows',
click: () => { closeAllWindows() }
},
{
label: 'Open Electron Docs',
click: () => {
shell.openExternal('https://electronjs.org/docs')
}
}
// add more menu options to the array
])

app.dock.setMenu(dockMenu)

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
<title>Dock Menu Demo</title>
</head>
<body>
<h1>Dock Menu Demo</h1>
<ul>
<li>Create new BrowserWindow instances via the "New Window" option</li>
<li>Close all BrowserWindow instances via the "Close All Windows" option</li>
<li>Read the docs via the "Show Electron Docs" option</li>
</ul>
<script src="./renderer.js"></script>
</body>
</html>
```

```
document.title = `${document.title} - ${new Date()}`
```

* [Dock API](#dock-api)* [Attaching a context menu](#attaching-a-context-menu)* [Runnable Fiddle demo](#runnable-fiddle-demo)