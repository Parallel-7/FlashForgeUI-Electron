# Source: https://www.electronjs.org/docs/latest/

On this page

Electron is a framework for building desktop applications using JavaScript,
HTML, and CSS. By embedding [Chromium](https://www.chromium.org/) and [Node.js](https://nodejs.org/) into its
binary, Electron allows you to maintain one JavaScript codebase and create
cross-platform apps that work on Windows, macOS, and Linux â no native development
experience required.

## Getting started[â](#getting-started "Direct link to Getting started")

We recommend you to start with the [tutorial](/docs/latest/tutorial/tutorial-prerequisites), which guides you through the
process of developing an Electron app and distributing it to users.
The [examples](/docs/latest/tutorial/examples) and [API documentation](/docs/latest/api/app) are also good places to browse around
and discover new things.

## Running examples with Electron Fiddle[â](#running-examples-with-electron-fiddle "Direct link to Running examples with Electron Fiddle")

[Electron Fiddle](https://www.electronjs.org/fiddle) is a sandbox app written with Electron and supported by
Electron's maintainers. We highly recommend installing it as a learning tool to
experiment with Electron's APIs or to prototype features during development.

Fiddle also integrates nicely with our documentation. When browsing through examples
in our tutorials, you'll frequently see an "Open in Electron Fiddle" button underneath
a code block. If you have Fiddle installed, this button will open a
`fiddle.electronjs.org` link that will automatically load the example into Fiddle,
no copy-pasting required.

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

## What is in the docs?[â](#what-is-in-the-docs "Direct link to What is in the docs?")

All the official documentation is available from the sidebar. These
are the different categories and what you can expect on each one:

* **Tutorial**: An end-to-end guide on how to create and publish your first Electron
application.
* **Processes in Electron**: In-depth reference on Electron processes and how to work with them.
* **Best Practices**: Important checklists to keep in mind when developing an Electron app.
* **Examples**: Quick references to add features to your Electron app.
* **Development**: Miscellaneous development guides.
* **Distribution**: Learn how to distribute your app to end users.
* **Testing And Debugging**: How to debug JavaScript, write tests, and other tools used
to create quality Electron applications.
* **References**: Useful links to better understand how the Electron project works
and is organized.
* **Contributing**: Compiling Electron and making contributions can be daunting.
We try to make it easier in this section.

## Getting help[â](#getting-help "Direct link to Getting help")

Are you getting stuck anywhere? Here are a few links to places to look:

* If you need help with developing your app, our [community Discord server](https://discord.gg/electronjs)
is a great place to get advice from other Electron app developers.
* If you suspect you're running into a bug with the `electron` package, please check
the [GitHub issue tracker](https://github.com/electron/electron/issues) to see if any existing issues match your
problem. If not, feel free to fill out our bug report template and submit a new issue.

* [Getting started](#getting-started)* [Running examples with Electron Fiddle](#running-examples-with-electron-fiddle)* [What is in the docs?](#what-is-in-the-docs)* [Getting help](#getting-help)