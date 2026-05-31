# Source: https://www.electronjs.org/docs/latest/tutorial/debugging-vscode

On this page

This guide goes over how to set up VSCode debugging for both your own Electron
project as well as the native Electron codebase.

## Debugging your Electron app[â](#debugging-your-electron-app "Direct link to Debugging your Electron app")

### Main process[â](#main-process "Direct link to Main process")

#### 1. Open an Electron project in VSCode.[â](#1-open-an-electron-project-in-vscode "Direct link to 1. Open an Electron project in VSCode.")

```
$ npx create-electron-app@latest my-app
$ code my-app
```

#### 2. Add a file `.vscode/launch.json` with the following configuration:[â](#2-add-a-file-vscodelaunchjson-with-the-following-configuration "Direct link to 2-add-a-file-vscodelaunchjson-with-the-following-configuration")

```
{
"version": "0.2.0",
"configurations": [
{
"name": "Debug Main Process",
"type": "node",
"request": "launch",
"cwd": "${workspaceFolder}",
"runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
"windows": {
"runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
},
"args" : ["."],
"outputCapture": "std"
}
]
}
```

#### 3. Debugging[â](#3-debugging "Direct link to 3. Debugging")

Set some breakpoints in `main.js`, and start debugging in the
[Debug View](https://code.visualstudio.com/docs/editor/debugging). You should
be able to hit the breakpoints.

## Debugging the Electron codebase[â](#debugging-the-electron-codebase "Direct link to Debugging the Electron codebase")

If you want to build Electron from source and modify the native Electron codebase,
this section will help you in testing your modifications.

For those unsure where to acquire this code or how to build it,
[Electron's Build Tools](https://github.com/electron/build-tools) automates and
explains most of this process. If you wish to manually set up the environment,
you can instead use these [build instructions](/docs/latest/development/build-instructions-gn).

### Windows (C++)[â](#windows-c "Direct link to Windows (C++)")

#### 1. Open an Electron project in VSCode.[â](#1-open-an-electron-project-in-vscode-1 "Direct link to 1. Open an Electron project in VSCode.")

```
$ npx create-electron-app@latest my-app
$ code my-app
```

#### 2. Add a file `.vscode/launch.json` with the following configuration:[â](#2-add-a-file-vscodelaunchjson-with-the-following-configuration-1 "Direct link to 2-add-a-file-vscodelaunchjson-with-the-following-configuration-1")

```
{
"version": "0.2.0",
"configurations": [
{
"name": "(Windows) Launch",
"type": "cppvsdbg",
"request": "launch",
"program": "${workspaceFolder}\\out\\your-executable-location\\electron.exe",
"args": ["your-electron-project-path"],
"stopAtEntry": false,
"cwd": "${workspaceFolder}",
"environment": [
{"name": "ELECTRON_ENABLE_LOGGING", "value": "true"},
{"name": "ELECTRON_ENABLE_STACK_DUMPING", "value": "true"},
{"name": "ELECTRON_RUN_AS_NODE", "value": ""},
],
"externalConsole": false,
"sourceFileMap": {
"o:\\": "${workspaceFolder}",
},
},
]
}
```

**Configuration Notes**

* `cppvsdbg` requires the
[built-in C/C++ extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools)
be enabled.
* `${workspaceFolder}` is the full path to Chromium's `src` directory.
* `your-executable-location` will be one of the following depending on a few items:
+ `Testing`: If you are using the default settings of
[Electron's Build-Tools](https://github.com/electron/build-tools) or the default
instructions when [building from source](/docs/latest/development/build-instructions-gn#building).
+ `Release`: If you built a Release build rather than a Testing build.
+ `your-directory-name`: If you modified this during your build process from
the default, this will be whatever you specified.
* The `args` array string `"your-electron-project-path"` should be the absolute
path to either the directory or `main.js` file of the Electron project you are
using for testing. In this example, it should be your path to `my-app`.

#### 3. Debugging[â](#3-debugging-1 "Direct link to 3. Debugging")

Set some breakpoints in the .cc files of your choosing in the native Electron C++
code, and start debugging in the [Debug View](https://code.visualstudio.com/docs/editor/debugging).

* [Debugging your Electron app](#debugging-your-electron-app)
+ [Main process](#main-process)
- [1. Open an Electron project in VSCode.](#1-open-an-electron-project-in-vscode)- [2. Add a file `.vscode/launch.json` with the following configuration:](#2-add-a-file-vscodelaunchjson-with-the-following-configuration)- [3. Debugging](#3-debugging)* [Debugging the Electron codebase](#debugging-the-electron-codebase)
+ [Windows (C++)](#windows-c)
- [1. Open an Electron project in VSCode.](#1-open-an-electron-project-in-vscode-1)- [2. Add a file `.vscode/launch.json` with the following configuration:](#2-add-a-file-vscodelaunchjson-with-the-following-configuration-1)- [3. Debugging](#3-debugging-1)