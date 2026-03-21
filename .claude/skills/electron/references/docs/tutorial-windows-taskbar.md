# Source: https://www.electronjs.org/docs/latest/tutorial/windows-taskbar

On this page

## Overview[â](#overview "Direct link to Overview")

Electron has APIs to configure the app's icon in the Windows taskbar. This API
supports both Windows-only features like [creation of a `JumpList`](#jumplist),
[custom thumbnails and toolbars](#thumbnail-toolbars),
[icon overlays](#icon-overlays-in-taskbar), and the so-called
["Flash Frame" effect](#flash-frame), and cross-platform features
like [recent documents](/docs/latest/tutorial/recent-documents) and
[application progress](/docs/latest/tutorial/progress-bar).

## JumpList[â](#jumplist "Direct link to JumpList")

Windows allows apps to define a custom context menu that shows up when users
right-click the app's icon in the taskbar. That context menu is called
`JumpList`. You specify custom actions in the `Tasks` category of JumpList,
as quoted from [MSDN](https://learn.microsoft.com/en-us/windows/win32/shell/taskbar-extensions#tasks):

> Applications define tasks based on both the program's features and the key
> things a user is expected to do with them. Tasks should be context-free, in
> that the application does not need to be running for them to work. They
> should also be the statistically most common actions that a normal user would
> perform in an application, such as compose an email message or open the
> calendar in a mail program, create a new document in a word processor, launch
> an application in a certain mode, or launch one of its subcommands. An
> application should not clutter the menu with advanced features that standard
> users won't need or one-time actions such as registration. Do not use tasks
> for promotional items such as upgrades or special offers.
>
> It is strongly recommended that the task list be static. It should remain the
> same regardless of the state or status of the application. While it is
> possible to vary the list dynamically, you should consider that this could
> confuse the user who does not expect that portion of the destination list to
> change.

![Taskbar JumpList](/assets/images/windows-taskbar-jumplist-150789129102203795fc34e12d8b0a3d.png)

> NOTE: The screenshot above is an example of general tasks for Microsoft Edge

Unlike the dock menu in macOS which is a real menu, user tasks in Windows work
like application shortcuts. For example, when a user clicks a task, the program
will be executed with specified arguments.

To set user tasks for your application, you can use
[app.setUserTasks](/docs/latest/api/app#appsetusertaskstasks-windows) API.

#### Examples[â](#examples "Direct link to Examples")

##### Set user tasks[â](#set-user-tasks "Direct link to Set user tasks")

Starting with a working application from the
[tutorial starter code](/docs/latest/tutorial/tutorial-first-app#final-starter-code), update the `main.js` file with the
following lines:

```
const { app } = require('electron')

app.setUserTasks([
{
program: process.execPath,
arguments: '--new-window',
iconPath: process.execPath,
iconIndex: 0,
title: 'New Window',
description: 'Create a new window'
}
])
```

##### Clear tasks list[â](#clear-tasks-list "Direct link to Clear tasks list")

To clear your tasks list, you need to call `app.setUserTasks` with an empty
array in the `main.js` file.

```
const { app } = require('electron')

app.setUserTasks([])
```

> NOTE: The user tasks will still be displayed even after closing your
> application, so the icon and program path specified for a task should exist until your application is uninstalled.

### Thumbnail Toolbars[â](#thumbnail-toolbars "Direct link to Thumbnail Toolbars")

On Windows, you can add a thumbnail toolbar with specified buttons to a taskbar
layout of an application window. It provides users with a way to access a
particular window's command without restoring or activating the window.

As quoted from [MSDN](https://learn.microsoft.com/en-us/windows/win32/shell/taskbar-extensions#thumbnail-toolbars):

> This toolbar is the familiar standard toolbar common control. It has a
> maximum of seven buttons. Each button's ID, image, tooltip, and state are defined
> in a structure, which is then passed to the taskbar. The application can show,
> enable, disable, or hide buttons from the thumbnail toolbar as required by its
> current state.
>
> For example, Windows Media Player might offer standard media transport controls
> such as play, pause, mute, and stop.

![Thumbnail toolbar](/assets/images/windows-taskbar-thumbnail-toolbar-22cd663bb43cf384c21b3a35f366bc03.png)

> NOTE: The screenshot above is an example of thumbnail toolbar of Windows
> Media Player

To set thumbnail toolbar in your application, you need to use
[BrowserWindow.setThumbarButtons](/docs/latest/api/browser-window#winsetthumbarbuttonsbuttons-windows)

#### Examples[â](#examples-1 "Direct link to Examples")

##### Set thumbnail toolbar[â](#set-thumbnail-toolbar "Direct link to Set thumbnail toolbar")

Starting with a working application from the
[tutorial starter code](/docs/latest/tutorial/tutorial-first-app#final-starter-code), update the `main.js` file with the
following lines:

```
const { BrowserWindow, nativeImage } = require('electron')

const path = require('node:path')

const win = new BrowserWindow()

win.setThumbarButtons([
{
tooltip: 'button1',
icon: nativeImage.createFromPath(path.join(__dirname, 'button1.png')),
click () { console.log('button1 clicked') }
}, {
tooltip: 'button2',
icon: nativeImage.createFromPath(path.join(__dirname, 'button2.png')),
flags: ['enabled', 'dismissonclick'],
click () { console.log('button2 clicked.') }
}
])
```

##### Clear thumbnail toolbar[â](#clear-thumbnail-toolbar "Direct link to Clear thumbnail toolbar")

To clear thumbnail toolbar buttons, you need to call
`BrowserWindow.setThumbarButtons` with an empty array in the `main.js` file.

```
const { BrowserWindow } = require('electron')

const win = new BrowserWindow()
win.setThumbarButtons([])
```

### Icon Overlays in Taskbar[â](#icon-overlays-in-taskbar "Direct link to Icon Overlays in Taskbar")

On Windows, a taskbar button can use a small overlay to display application
status.

As quoted from [MSDN](https://learn.microsoft.com/en-us/windows/win32/shell/taskbar-extensions#icon-overlays):

> Icon overlays serve as a contextual notification of status, and are intended
> to negate the need for a separate notification area status icon to communicate
> that information to the user. For instance, the new mail status in Microsoft
> Outlook, currently shown in the notification area, can now be indicated
> through an overlay on the taskbar button. Again, you must decide during your
> development cycle which method is best for your application. Overlay icons are
> intended to supply important, long-standing status or notifications such as
> network status, messenger status, or new mail. The user should not be
> presented with constantly changing overlays or animations.

![Overlay on taskbar button](/assets/images/windows-taskbar-icon-overlay-09789472d59274bd9e408da750519e94.png)

> NOTE: The screenshot above is an example of overlay on a taskbar button

To set the overlay icon for a window, you need to use the
[BrowserWindow.setOverlayIcon](/docs/latest/api/browser-window#winsetoverlayiconoverlay-description-windows) API.

#### Example[â](#example "Direct link to Example")

Starting with a working application from the
[tutorial starter code](/docs/latest/tutorial/tutorial-first-app#final-starter-code), update the `main.js` file with the
following lines:

```
const { BrowserWindow, nativeImage } = require('electron')

const win = new BrowserWindow()

win.setOverlayIcon(nativeImage.createFromPath('path/to/overlay.png'), 'Description for overlay')
```

### Flash Frame[â](#flash-frame "Direct link to Flash Frame")

On Windows, you can highlight the taskbar button to get the user's attention.
This is similar to bouncing the dock icon in macOS.

As quoted from [MSDN](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-flashwindow#remarks):

> Typically, a window is flashed to inform the user that the window requires
> attention but that it does not currently have the keyboard focus.

To flash the BrowserWindow taskbar button, you need to use the
[BrowserWindow.flashFrame](/docs/latest/api/browser-window#winflashframeflag) API.

#### Example[â](#example-1 "Direct link to Example")

Starting with a working application from the
[tutorial starter code](/docs/latest/tutorial/tutorial-first-app#final-starter-code), update the `main.js` file with the
following lines:

```
const { BrowserWindow } = require('electron')

const win = new BrowserWindow()

win.once('focus', () => win.flashFrame(false))
win.flashFrame(true)
```

> NOTE: Don't forget to call `win.flashFrame(false)` to turn off the flash.
> In the above example, it is called when the window comes into focus,
> but you might use a timeout or some other event to disable it.

* [Overview](#overview)* [JumpList](#jumplist)
+ [Examples](#examples)+ [Thumbnail Toolbars](#thumbnail-toolbars)
- [Examples](#examples-1)+ [Icon Overlays in Taskbar](#icon-overlays-in-taskbar)
- [Example](#example)+ [Flash Frame](#flash-frame)
- [Example](#example-1)