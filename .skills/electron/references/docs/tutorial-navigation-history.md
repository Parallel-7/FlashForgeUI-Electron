# Source: https://www.electronjs.org/docs/latest/tutorial/navigation-history

On this page

## Overview[â](#overview "Direct link to Overview")

The [NavigationHistory](/docs/latest/api/navigation-history) class allows you to manage and interact with the browsing history of your Electron application. This powerful feature enables you to create intuitive navigation experiences for your users.

## Accessing NavigationHistory[â](#accessing-navigationhistory "Direct link to Accessing NavigationHistory")

Navigation history is stored per [`WebContents`](/docs/latest/api/web-contents) instance. To access a specific instance of the NavigationHistory class, use the WebContents class's [`contents.navigationHistory` instance property](https://www.electronjs.org/docs/latest/api/web-contents#contentsnavigationhistory-readonly).

```
const { BrowserWindow } = require('electron')

const mainWindow = new BrowserWindow()
const { navigationHistory } = mainWindow.webContents
```

## Navigating through history[â](#navigating-through-history "Direct link to Navigating through history")

Easily implement back and forward navigation:

```
// Go back
if (navigationHistory.canGoBack()) {
navigationHistory.goBack()
}

// Go forward
if (navigationHistory.canGoForward()) {
navigationHistory.goForward()
}
```

## Accessing history entries[â](#accessing-history-entries "Direct link to Accessing history entries")

Retrieve and display the user's browsing history:

```
const entries = navigationHistory.getAllEntries()

entries.forEach((entry) => {
console.log(`${entry.title}: ${entry.url}`)
})
```

Each navigation entry corresponds to a specific page. The indexing system follows a sequential order:

* Index 0: Represents the earliest visited page.
* Index N: Represents the most recent page visited.

## Navigating to specific entries[â](#navigating-to-specific-entries "Direct link to Navigating to specific entries")

Allow users to jump to any point in their browsing history:

```
// Navigate to the 5th entry in the history, if the index is valid
navigationHistory.goToIndex(4)

// Navigate to the 2nd entry forward from the current position
if (navigationHistory.canGoToOffset(2)) {
navigationHistory.goToOffset(2)
}
```

## Restoring history[â](#restoring-history "Direct link to Restoring history")

A common flow is that you want to restore the history of a webContents - for instance to implement an "undo close tab" feature. To do so, you can call `navigationHistory.restore({ index, entries })`. This will restore the webContent's navigation history and the webContents location in said history, meaning that `goBack()` and `goForward()` navigate you through the stack as expected.

```
const firstWindow = new BrowserWindow()

// Later, you want a second window to have the same history and navigation position
async function restore () {
const entries = firstWindow.webContents.navigationHistory.getAllEntries()
const index = firstWindow.webContents.navigationHistory.getActiveIndex()

const secondWindow = new BrowserWindow()
await secondWindow.webContents.navigationHistory.restore({ index, entries })
}
```

Here's a full example that you can open with Electron Fiddle:

[docs/fiddles/features/navigation-history (40.0.0)](https://github.com/electron/electron/tree/v40.0.0/docs/fiddles/features/navigation-history)[Open in Fiddle](https://fiddle.electronjs.org/launch?target=electron/v40.0.0/docs/fiddles/features/navigation-history)

* main.js* preload.js* index.html* renderer.js* style.css

```
const { app, BrowserWindow, BrowserView, ipcMain } = require('electron')
const path = require('path')

function createWindow () {
const mainWindow = new BrowserWindow({
width: 1000,
height: 800,
webPreferences: {
preload: path.join(__dirname, 'preload.js'),
nodeIntegration: false,
contextIsolation: true
}
})

mainWindow.loadFile('index.html')

const view = new BrowserView()
mainWindow.setBrowserView(view)
view.setBounds({ x: 0, y: 100, width: 1000, height: 800 })
view.setAutoResize({ width: true, height: true })

const navigationHistory = view.webContents.navigationHistory
ipcMain.handle('nav:back', () =>
navigationHistory.goBack()
)

ipcMain.handle('nav:forward', () => {
navigationHistory.goForward()
})

ipcMain.handle('nav:canGoBack', () => navigationHistory.canGoBack())
ipcMain.handle('nav:canGoForward', () => navigationHistory.canGoForward())
ipcMain.handle('nav:loadURL', (_, url) =>
view.webContents.loadURL(url)
)
ipcMain.handle('nav:getCurrentURL', () => view.webContents.getURL())
ipcMain.handle('nav:getHistory', () => {
return navigationHistory.getAllEntries()
})

view.webContents.on('did-navigate', () => {
mainWindow.webContents.send('nav:updated')
})

view.webContents.on('did-navigate-in-page', () => {
mainWindow.webContents.send('nav:updated')
})
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

```
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
goBack: () => ipcRenderer.invoke('nav:back'),
goForward: () => ipcRenderer.invoke('nav:forward'),
canGoBack: () => ipcRenderer.invoke('nav:canGoBack'),
canGoForward: () => ipcRenderer.invoke('nav:canGoForward'),
loadURL: (url) => ipcRenderer.invoke('nav:loadURL', url),
getCurrentURL: () => ipcRenderer.invoke('nav:getCurrentURL'),
getHistory: () => ipcRenderer.invoke('nav:getHistory'),
onNavigationUpdate: (callback) => ipcRenderer.on('nav:updated', callback)
})
```

```
<!DOCTYPE html>
<html>

<head>
<title>Enhanced Browser with Navigation History</title>
<link href="styles.css" rel="stylesheet" />
</head>

<body>

<div id="controls">
<button id="backBtn" title="Go back">Back</button>
<button id="forwardBtn" title="Go forward">Forward</button>
<button id="backHistoryBtn" title="Show back history">Back History</button>
<button id="forwardHistoryBtn" title="Show forward history">Forward History</button>
<input id="urlInput" type="text" placeholder="Enter URL">
<button id="goBtn" title="Navigate to URL">Go</button>
</div>

<div id="historyPanel" class="history-panel"></div>

<div id="description">
<h2>Navigation History Demo</h2>
<p>This demo showcases Electron's NavigationHistory API functionality.</p>
<p><strong>Back/Forward:</strong> Navigate through your browsing history.</p>
<p><strong>Back History/Forward History:</strong> View and select from your browsing history.</p>
<p><strong>URL Bar:</strong> Enter a URL and click 'Go' or press Enter to navigate.</p>
</div>
<script src="renderer.js"></script>
</body>

</html>
```

```
const backBtn = document.getElementById('backBtn')
const forwardBtn = document.getElementById('forwardBtn')
const backHistoryBtn = document.getElementById('backHistoryBtn')
const forwardHistoryBtn = document.getElementById('forwardHistoryBtn')
const urlInput = document.getElementById('urlInput')
const goBtn = document.getElementById('goBtn')
const historyPanel = document.getElementById('historyPanel')

async function updateButtons () {
const canGoBack = await window.electronAPI.canGoBack()
const canGoForward = await window.electronAPI.canGoForward()
backBtn.disabled = !canGoBack
backHistoryBtn.disabled = !canGoBack

forwardBtn.disabled = !canGoForward
forwardHistoryBtn.disabled = !canGoForward
}

async function updateURL () {
urlInput.value = await window.electronAPI.getCurrentURL()
}

function transformURL (url) {
if (!url.startsWith('http://') && !url.startsWith('https://')) {
const updatedUrl = 'https://' + url
return updatedUrl
}
return url
}

async function navigate (url) {
const urlInput = transformURL(url)

await window.electronAPI.loadURL(urlInput)
}

async function showHistory (forward = false) {
const history = await window.electronAPI.getHistory()
const currentIndex = history.findIndex(entry => entry.url === transformURL(urlInput.value))

if (!currentIndex) {
return
}

const relevantHistory = forward
? history.slice(currentIndex + 1)
: history.slice(0, currentIndex).reverse()

historyPanel.innerHTML = ''
relevantHistory.forEach(entry => {
const div = document.createElement('div')
div.textContent = `Title: ${entry.title}, URL: ${entry.url}`
div.onclick = () => navigate(entry.url)
historyPanel.appendChild(div)
})

historyPanel.style.display = 'block'
}

backBtn.addEventListener('click', () => window.electronAPI.goBack())
forwardBtn.addEventListener('click', () => window.electronAPI.goForward())
backHistoryBtn.addEventListener('click', () => showHistory(false))
forwardHistoryBtn.addEventListener('click', () => showHistory(true))
goBtn.addEventListener('click', () => navigate(urlInput.value))

urlInput.addEventListener('keypress', (e) => {
if (e.key === 'Enter') {
navigate(urlInput.value)
}
})

document.addEventListener('click', (e) => {
if (e.target !== historyPanel && !historyPanel.contains(e.target) &&
e.target !== backHistoryBtn && e.target !== forwardHistoryBtn) {
historyPanel.style.display = 'none'
}
})

window.electronAPI.onNavigationUpdate(() => {
updateButtons()
updateURL()
})

updateButtons()
```

```
body {
margin: 0;
font-family: Arial, sans-serif;
background-color: #f0f0f0;
}
#controls {
display: flex;
align-items: center;
padding: 10px;
background-color: #ffffff;
border-bottom: 1px solid #ccc;
}
button {
margin-right: 10px;
padding: 8px 12px;
font-size: 14px;
background-color: #4CAF50;
color: white;
border: none;
cursor: pointer;
transition: background-color 0.3s;
}
button:hover {
background-color: #45a049;
}
button:disabled {
background-color: #cccccc;
cursor: not-allowed;
}
#urlInput {
flex-grow: 1;
margin: 0 10px;
padding: 8px;
font-size: 14px;
}

#historyPanel {
display: none;
position: absolute;
top: 60px;
left: 10px;
background: white;
border: 1px solid #ccc;
padding: 10px;
max-height: 300px;
overflow-y: auto;
z-index: 1000;
}
#historyPanel div {
cursor: pointer;
padding: 5px;
}

#description {
background-color: #f0f0f0;
padding: 10px;
margin-top: 150px;
}
```

* [Overview](#overview)* [Accessing NavigationHistory](#accessing-navigationhistory)* [Navigating through history](#navigating-through-history)* [Accessing history entries](#accessing-history-entries)* [Navigating to specific entries](#navigating-to-specific-entries)* [Restoring history](#restoring-history)