# Source: https://www.electronjs.org/docs/latest/tutorial/tutorial-first-app

On this page

Follow along the tutorial

This is **part 2** of the Electron tutorial.

1. [Prerequisites](/docs/latest/tutorial/tutorial-prerequisites)
2. **[Building your First App](/docs/latest/tutorial/tutorial-first-app)**
3. [Using Preload Scripts](/docs/latest/tutorial/tutorial-preload)
4. [Adding Features](/docs/latest/tutorial/tutorial-adding-features)
5. [Packaging Your Application](/docs/latest/tutorial/tutorial-packaging)
6. [Publishing and Updating](/docs/latest/tutorial/tutorial-publishing-updating)

## Learning goals[â](#learning-goals "Direct link to Learning goals")

In this part of the tutorial, you will learn how to set up your Electron project
and write a minimal starter application. By the end of this section,
you should be able to run a working Electron app in development mode from
your terminal.

## Setting up your project[â](#setting-up-your-project "Direct link to Setting up your project")

Avoid WSL

If you are on a Windows machine, please do not use [Windows Subsystem for Linux](https://learn.microsoft.com/en-us/windows/wsl/about#what-is-wsl-2) (WSL)
when following this tutorial as you will run into issues when trying to execute the
application.

### Initializing your npm project[â](#initializing-your-npm-project "Direct link to Initializing your npm project")

Electron apps are scaffolded using npm, with the package.json file
as an entry point. Start by creating a folder and initializing an npm package
within it with `npm init`.

* npm* Yarn

```
mkdir my-electron-app && cd my-electron-app
npm init
```

```
mkdir my-electron-app && cd my-electron-app
yarn init
```

This command will prompt you to configure some fields in your package.json.
There are a few rules to follow for the purposes of this tutorial:

* *entry point* should be `main.js` (you will be creating that file soon).
* *author*, *license*, and *description* can be any value, but will be necessary for
[packaging](/docs/latest/tutorial/tutorial-packaging) later on.

Install dependencies with a regular `node_modules` folder

Electron's packaging toolchain requires the `node_modules` folder to be physically on disk in the
way that npm installs Node dependencies. By default, [Yarn Berry](https://yarnpkg.com/) and
[pnpm](http://pnpm.io/) both use alternative installation strategies.

Therefore, you must set [`nodeLinker: node-modules`](https://yarnpkg.com/configuration/yarnrc#nodeLinker)
in Yarn or [`nodeLinker: hoisted`](https://pnpm.io/settings#nodelinker) in pnpm if you are using
those package managers.

Then, install Electron into your app's **devDependencies**, which is the list of external
development-only package dependencies not required in production.

Why is Electron a dev dependency?

This may seem counter-intuitive since your production code is running Electron APIs. Under the hood,
Electron's JavaScript API binds to a binary that contains its implementations. The packaging step for
Electron handles the bundling of this binary, eliminating the need to specify it as a production
dependency.

* npm* Yarn

```
npm install electron --save-dev
```

```
yarn add electron --dev
```

warning

In order to correctly install Electron, you need to ensure that its `postinstall` lifecycle
script is able to run. This means avoiding the `--ignore-scripts` flag on npm and allowlisting
`electron` to run build scripts on other package managers.

This is likely to change in a future version of Electron. See
[electron/rfcs#22](https://github.com/electron/rfcs/pull/22) for more details.

Your package.json file should look something like this after initializing your package
and installing Electron. You should also now have a `node_modules` folder containing
the Electron executable, as well as a `package-lock.json` lockfile that specifies
the exact dependency versions to install.

package.json

```
{
"name": "my-electron-app",
"version": "1.0.0",
"description": "Hello World!",
"main": "main.js",
"scripts": {
"test": "echo \"Error: no test specified\" && exit 1"
},
"author": "Jane Doe",
"license": "MIT",
"devDependencies": {
"electron": "23.1.3"
}
}
```

Advanced Electron installation steps

If installing Electron directly fails, please refer to our [Advanced Installation](/docs/latest/tutorial/installation)
documentation for instructions on download mirrors, proxies, and troubleshooting steps.

### Adding a .gitignore[â](#adding-a-gitignore "Direct link to Adding a .gitignore")

The [`.gitignore`](https://git-scm.com/docs/gitignore) file specifies which files and directories to avoid tracking
with Git. You should place a copy of [GitHub's Node.js gitignore template](https://github.com/github/gitignore/blob/main/Node.gitignore)
into your project's root folder to avoid committing your project's `node_modules` folder.

## Running an Electron app[â](#running-an-electron-app "Direct link to Running an Electron app")

Further reading

Read [Electron's process model](/docs/latest/tutorial/process-model) documentation to better
understand how Electron's multiple processes work together.

The [`main`](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#main) script you defined in package.json is the entry point of any
Electron application. This script controls the **main process**, which runs in a Node.js
environment and is responsible for controlling your app's lifecycle, displaying native
interfaces, performing privileged operations, and managing renderer processes
(more on that later).

Before creating your first Electron app, you will first use a trivial script to ensure your
main process entry point is configured correctly. Create a `main.js` file in the root folder
of your project with a single line of code:

main.js

```
console.log('Hello from Electron ð')
```

Because Electron's main process is a Node.js runtime, you can execute arbitrary Node.js code
with the `electron` command (you can even use it as a [REPL](/docs/latest/tutorial/repl)). To execute this script,
add `electron .` to the `start` command in the [`scripts`](https://docs.npmjs.com/cli/v7/using-npm/scripts)
field of your package.json. This command will tell the Electron executable to look for the main
script in the current directory and run it in dev mode.

package.json

```
{
"name": "my-electron-app",
"version": "1.0.0",
"description": "Hello World!",
"main": "main.js",
"scripts": {
"start": "electron .",
"test": "echo \"Error: no test specified\" && exit 1"
},
"author": "Jane Doe",
"license": "MIT",
"devDependencies": {
"electron": "23.1.3"
}
}
```

* npm* Yarn

```
npm run start
```

```
yarn run start
```

Your terminal should print out `Hello from Electron ð`. Congratulations,
you have executed your first line of code in Electron! Next, you will learn
how to create user interfaces with HTML and load that into a native window.

## Loading a web page into a BrowserWindow[â](#loading-a-web-page-into-a-browserwindow "Direct link to Loading a web page into a BrowserWindow")

In Electron, each window displays a web page that can be loaded either from a local HTML
file or a remote web address. For this example, you will be loading in a local file. Start
by creating a barebones web page in an `index.html` file in the root folder of your project:

index.html

```
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<!-- https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP -->
<meta
http-equiv="Content-Security-Policy"
content="default-src 'self'; script-src 'self'"
/>
<meta
http-equiv="X-Content-Security-Policy"
content="default-src 'self'; script-src 'self'"
/>
<title>Hello from Electron renderer!</title>
</head>
<body>
<h1>Hello from Electron renderer!</h1>
<p>ð</p>
</body>
</html>
```

Now that you have a web page, you can load it into an Electron [BrowserWindow](/docs/latest/api/browser-window).
Replace the contents of your `main.js` file with the following code. We will explain each
highlighted block separately.

main.js

```
const { app, BrowserWindow } = require('electron')

const createWindow = () => {
const win = new BrowserWindow({
width: 800,
height: 600
})

win.loadFile('index.html')
}

app.whenReady().then(() => {
createWindow()
})
```

### Importing modules[â](#importing-modules "Direct link to Importing modules")

main.js (Line 1)

```
const { app, BrowserWindow } = require('electron')
```

In the first line, we are importing two Electron modules
with CommonJS module syntax:

* [app](/docs/latest/api/app), which controls your application's event lifecycle.
* [BrowserWindow](/docs/latest/api/browser-window), which creates and manages app windows.

Module capitalization conventions

You might have noticed the capitalization difference between the **a**pp
and **B**rowser**W**indow modules. Electron follows typical JavaScript conventions here,
where PascalCase modules are instantiable class constructors (e.g. BrowserWindow, Tray,
Notification) whereas camelCase modules are not instantiable (e.g. app, ipcRenderer, webContents).

Typed import aliases

For better type checking when writing TypeScript code, you can choose to import
main process modules from `electron/main`.

```
const { app, BrowserWindow } = require('electron/main')
```

For more information, see the [Process Model docs](/docs/latest/tutorial/process-model#process-specific-module-aliases-typescript).

ES Modules in Electron

[ECMAScript modules](https://nodejs.org/api/esm.html) (i.e. using `import` to load a module)
are supported in Electron as of Electron 28. You can find more information about the
state of ESM in Electron and how to use them in our app in [our ESM guide](/docs/latest/tutorial/esm).

### Writing a reusable function to instantiate windows[â](#writing-a-reusable-function-to-instantiate-windows "Direct link to Writing a reusable function to instantiate windows")

The `createWindow()` function loads your web page into a new BrowserWindow instance:

main.js (Lines 3-10)

```
const createWindow = () => {
const win = new BrowserWindow({
width: 800,
height: 600
})

win.loadFile('index.html')
}
```

### Calling your function when the app is ready[â](#calling-your-function-when-the-app-is-ready "Direct link to Calling your function when the app is ready")

main.js (Lines 12-14)

```
app.whenReady().then(() => {
createWindow()
})
```

Many of Electron's core modules are Node.js [event emitters](https://nodejs.org/api/events.html#events) that adhere to Node's asynchronous
event-driven architecture. The app module is one of these emitters.

In Electron, BrowserWindows can only be created after the app module's [`ready`](/docs/latest/api/app#event-ready) event
is fired. You can wait for this event by using the [`app.whenReady()`](/docs/latest/api/app#appwhenready) API and
calling `createWindow()` once its promise is fulfilled.

info

You typically listen to Node.js events by using an emitter's `.on` function.

```
+ app.on('ready', () => {
- app.whenReady().then(() => {
createWindow()
})
```

However, Electron exposes `app.whenReady()` as a helper specifically for the `ready` event to
avoid subtle pitfalls with directly listening to that event in particular.
See [electron/electron#21972](https://github.com/electron/electron/pull/21972) for details.

At this point, running your Electron application's `start` command should successfully
open a window that displays your web page!

Each web page your app displays in a window will run in a separate process called a
**renderer** process (or simply *renderer* for short). Renderer processes have access
to the same JavaScript APIs and tooling you use for typical front-end web
development, such as using [webpack](https://webpack.js.org) to bundle and minify your code or [React](https://reactjs.org)
to build your user interfaces.

## Managing your app's window lifecycle[â](#managing-your-apps-window-lifecycle "Direct link to Managing your app's window lifecycle")

Application windows behave differently on each operating system. Rather than
enforce these conventions by default, Electron gives you the choice to implement
them in your app code if you wish to follow them. You can implement basic window
conventions by listening for events emitted by the app and BrowserWindow modules.

Process-specific control flow

Checking against Node's [`process.platform`](https://nodejs.org/api/process.html#process_process_platform) variable can help you
to run code conditionally on certain platforms. Note that there are only three
possible platforms that Electron can run in: `win32` (Windows), `linux` (Linux),
and `darwin` (macOS).

### Quit the app when all windows are closed (Windows & Linux)[â](#quit-the-app-when-all-windows-are-closed-windows--linux "Direct link to Quit the app when all windows are closed (Windows & Linux)")

On Windows and Linux, closing all windows will generally quit an application entirely.
To implement this pattern in your Electron app, listen for the app module's
[`window-all-closed`](/docs/latest/api/app#event-window-all-closed) event, and call [`app.quit()`](/docs/latest/api/app#appquit)
to exit your app if the user is not on macOS.

```
app.on('window-all-closed', () => {
if (process.platform !== 'darwin') app.quit()
})
```

### Open a window if none are open (macOS)[â](#open-a-window-if-none-are-open-macos "Direct link to Open a window if none are open (macOS)")

In contrast, macOS apps generally continue running even without any windows open.
Activating the app when no windows are available should open a new one.

To implement this feature, listen for the app module's [`activate`](/docs/latest/api/app#event-activate-macos)
event, and call your existing `createWindow()` method if no BrowserWindows are open.

Because windows cannot be created before the `ready` event, you should only listen for
`activate` events after your app is initialized. Do this by only listening for activate
events inside your existing `whenReady()` callback.

```
app.whenReady().then(() => {
createWindow()

app.on('activate', () => {
if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
})
```

## Final starter code[â](#final-starter-code "Direct link to Final starter code")

[docs/fiddles/tutorial-first-app (40.0.0)](https://github.com/electron/electron/tree/v40.0.0/docs/fiddles/tutorial-first-app)[Open in Fiddle](https://fiddle.electronjs.org/launch?target=electron/v40.0.0/docs/fiddles/tutorial-first-app)

* main.js* index.html

```
const { app, BrowserWindow } = require('electron/main')

const createWindow = () => {
const win = new BrowserWindow({
width: 800,
height: 600
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
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta
http-equiv="Content-Security-Policy"
content="default-src 'self'; script-src 'self'"
/>
<meta
http-equiv="X-Content-Security-Policy"
content="default-src 'self'; script-src 'self'"
/>
<title>Hello from Electron renderer!</title>
</head>
<body>
<h1>Hello from Electron renderer!</h1>
<p>ð</p>
<p id="info"></p>
</body>
<script src="./renderer.js"></script>
</html>
```

## Optional: Debugging from VS Code[â](#optional-debugging-from-vs-code "Direct link to Optional: Debugging from VS Code")

If you want to debug your application using VS Code, you need to attach VS Code to
both the main and renderer processes. Here is a sample configuration for you to
run. Create a launch.json configuration in a new `.vscode` folder in your project:

.vscode/launch.json

```
{
"version": "0.2.0",
"compounds": [
{
"name": "Main + renderer",
"configurations": ["Main", "Renderer"],
"stopAll": true
}
],
"configurations": [
{
"name": "Renderer",
"port": 9222,
"request": "attach",
"type": "chrome",
"webRoot": "${workspaceFolder}"
},
{
"name": "Main",
"type": "node",
"request": "launch",
"cwd": "${workspaceFolder}",
"runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
"windows": {
"runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
},
"args": [".", "--remote-debugging-port=9222"],
"outputCapture": "std",
"console": "integratedTerminal"
}
]
}
```

The "Main + renderer" option will appear when you select "Run and Debug"
from the sidebar, allowing you to set breakpoints and inspect all the variables among
other things in both the main and renderer processes.

What we have done in the `launch.json` file is to create 3 configurations:

* `Main` is used to start the main process and also expose port 9222 for remote debugging
(`--remote-debugging-port=9222`). This is the port that we will use to attach the debugger
for the `Renderer`. Because the main process is a Node.js process, the type is set to
`node`.
* `Renderer` is used to debug the renderer process. Because the main process is the one
that creates the process, we have to "attach" to it (`"request": "attach"`) instead of
creating a new one.
The renderer process is a web one, so the debugger we have to use is `chrome`.
* `Main + renderer` is a [compound task](https://code.visualstudio.com/Docs/editor/tasks#_compound-tasks) that executes the previous ones simultaneously.

caution

Because we are attaching to a process in `Renderer`, it is possible that the first lines of
your code will be skipped as the debugger will not have had enough time to connect before they are
being executed.
You can work around this by refreshing the page or setting a timeout before executing the code
in development mode.

Further reading

If you want to dig deeper in the debugging area, the following guides provide more information:

* [Application Debugging](/docs/latest/tutorial/application-debugging)
* [DevTools Extensions](/docs/latest/tutorial/devtools-extension)

## Summary[â](#summary "Direct link to Summary")

Electron applications are set up using npm packages. The Electron executable should be installed
in your project's `devDependencies` and can be run in development mode using a script in your
package.json file.

The executable runs the JavaScript entry point found in the `main` property of your package.json.
This file controls Electron's **main process**, which runs an instance of Node.js and is
responsible for your app's lifecycle, displaying native interfaces, performing privileged operations,
and managing renderer processes.

**Renderer processes** (or renderers for short) are responsible for displaying graphical content. You can
load a web page into a renderer by pointing it to either a web address or a local HTML file.
Renderers behave very similarly to regular web pages and have access to the same web APIs.

In the next section of the tutorial, we will be learning how to augment the renderer process with
privileged APIs and how to communicate between processes.

* [Learning goals](#learning-goals)* [Setting up your project](#setting-up-your-project)
+ [Initializing your npm project](#initializing-your-npm-project)+ [Adding a .gitignore](#adding-a-gitignore)* [Running an Electron app](#running-an-electron-app)* [Loading a web page into a BrowserWindow](#loading-a-web-page-into-a-browserwindow)
+ [Importing modules](#importing-modules)+ [Writing a reusable function to instantiate windows](#writing-a-reusable-function-to-instantiate-windows)+ [Calling your function when the app is ready](#calling-your-function-when-the-app-is-ready)* [Managing your app's window lifecycle](#managing-your-apps-window-lifecycle)
+ [Quit the app when all windows are closed (Windows & Linux)](#quit-the-app-when-all-windows-are-closed-windows--linux)+ [Open a window if none are open (macOS)](#open-a-window-if-none-are-open-macos)* [Final starter code](#final-starter-code)* [Optional: Debugging from VS Code](#optional-debugging-from-vs-code)* [Summary](#summary)