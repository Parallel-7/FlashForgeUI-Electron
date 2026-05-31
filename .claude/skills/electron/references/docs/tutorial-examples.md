# Source: https://www.electronjs.org/docs/latest/tutorial/examples

On this page

In this section, we have collected a set of guides for common features
that you may want to implement in your Electron application. Each guide
contains a practical example in a minimal, self-contained example app.
The easiest way to run these examples is by downloading [Electron Fiddle](https://www.electronjs.org/fiddle).

Once Fiddle is installed, you can press on the "Open in Fiddle" button that you
will find below code samples like the following one:

[docs/fiddles/quick-start (40.0.0)](https://github.com/electron/electron/tree/v40.0.0/docs/fiddles/quick-start)[Open in Fiddle](https://fiddle.electronjs.org/launch?target=electron/v40.0.0/docs/fiddles/quick-start)

* main.js* preload.js* index.html

```
const { app, BrowserWindow } = require('electron/main')
const path = require('node:path')

function createWindow () {
const win = new BrowserWindow({
width: 800,
height: 600,
webPreferences: {
preload: path.join(__dirname, 'preload.js')
}
})

win.loadFile('index.html')
}

app.whenReady().then(() => {
createWindow()

app.on('activate', () => {
if (BrowserWindow.getAllWindows().length === 0) {
createWindow()
}
})
})

app.on('window-all-closed', () => {
if (process.platform !== 'darwin') {
app.quit()
}
})
```

```
window.addEventListener('DOMContentLoaded', () => {
const replaceText = (selector, text) => {
const element = document.getElementById(selector)
if (element) element.innerText = text
}

for (const type of ['chrome', 'node', 'electron']) {
replaceText(`${type}-version`, process.versions[type])
}
})
```

```
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Hello World!</title>
<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline';" />
</head>
<body>
<h1>Hello World!</h1>
<p>
We are using Node.js <span id="node-version"></span>,
Chromium <span id="chrome-version"></span>,
and Electron <span id="electron-version"></span>.
</p>
</body>
</html>
```

## How to...?[â](#how-to "Direct link to How to...?")

You can find the full list of "How to?" in the sidebar. If there is
something that you would like to do that is not documented, please join
our [Discord server](https://discord.com/invite/electronjs) and let us know!

* [How to...?](#how-to)