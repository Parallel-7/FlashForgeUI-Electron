# Source: https://www.electronjs.org/docs/latest/tutorial/progress-bar

On this page

## Overview[â](#overview "Direct link to Overview")

A progress bar enables a window to provide progress information to the user
without the need of switching to the window itself.

On Windows, you can use a taskbar button to display a progress bar.

![Windows Progress Bar](/assets/images/windows-progress-bar-8c868cb15a368b762dc7226ccf6b39a1.png)

On macOS, the progress bar will be displayed as a part of the dock icon.

![macOS Progress Bar](/assets/images/macos-progress-bar-9dce59a0e807a3463779c06a9c4c2002.png)

On Linux, the Unity graphical interface also has a similar feature that allows
you to specify the progress bar in the launcher.

![Linux Progress Bar](/assets/images/linux-progress-bar-bcc23bc8192ec1ba0cd6e78a8fbc4416.png)

> NOTE: on Windows, each window can have its own progress bar, whereas on macOS
> and Linux (Unity) there can be only one progress bar for the application.

---

All three cases are covered by the same API - the
[`setProgressBar()`](/docs/latest/api/browser-window#winsetprogressbarprogress-options) method available on an instance of
`BrowserWindow`. To indicate your progress, call this method with a number
between `0` and `1`. For example, if you have a long-running task that is
currently at 63% towards completion, you would call it as
`setProgressBar(0.63)`.

Setting the parameter to negative values (e.g. `-1`) will remove the progress
bar. Setting it to a value greater than `1` will indicate an indeterminate progress bar
in Windows or clamp to 100% in other operating systems. An indeterminate progress bar
remains active but does not show an actual percentage, and is used for situations when
you do not know how long an operation will take to complete.

See the [API documentation for more options and modes](/docs/latest/api/browser-window#winsetprogressbarprogress-options).

## Example[â](#example "Direct link to Example")

In this example, we add a progress bar to the main window that increments over time
using Node.js timers.

[docs/fiddles/features/progress-bar (40.0.0)](https://github.com/electron/electron/tree/v40.0.0/docs/fiddles/features/progress-bar)[Open in Fiddle](https://fiddle.electronjs.org/launch?target=electron/v40.0.0/docs/fiddles/features/progress-bar)

* main.js* index.html

```
const { app, BrowserWindow } = require('electron/main')

let progressInterval

function createWindow () {
const win = new BrowserWindow({
width: 800,
height: 600
})

win.loadFile('index.html')

const INCREMENT = 0.03
const INTERVAL_DELAY = 100 // ms

let c = 0
progressInterval = setInterval(() => {
// update progress bar to next value
// values between 0 and 1 will show progress, >1 will show indeterminate or stick at 100%
win.setProgressBar(c)

// increment or reset progress bar
if (c < 2) {
c += INCREMENT
} else {
c = (-INCREMENT * 5) // reset to a bit less than 0 to show reset state
}
}, INTERVAL_DELAY)
}

app.whenReady().then(createWindow)

// before the app is terminated, clear both timers
app.on('before-quit', () => {
clearInterval(progressInterval)
})

app.on('window-all-closed', () => {
if (process.platform !== 'darwin') {
app.quit()
}
})

app.on('activate', () => {
if (BrowserWindow.getAllWindows().length === 0) {
createWindow()
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
<p>Keep an eye on the dock (Mac) or taskbar (Windows, Unity) for this application!</p>
<p>It should indicate a progress that advances from 0 to 100%.</p>
<p>It should then show indeterminate (Windows) or pin at 100% (other operating systems)
briefly and then loop.</p>
</body>
</html>
```

After launching the Electron application, the dock (macOS) or taskbar (Windows, Unity)
should show a progress bar that starts at zero and progresses through 100% to completion.
It should then show indeterminate (Windows) or pin to 100% (other operating systems)
briefly and then loop.

![macOS dock progress bar](/assets/images/dock-progress-bar-1beb706f09517d1dac6f58fa7c76c64a.png)

For macOS, the progress bar will also be indicated for your application
when using [Mission Control](https://support.apple.com/en-us/HT204100):

![Mission Control Progress Bar](/assets/images/mission-control-progress-bar-df4b961d1393e199599f4bd9763934f4.png)

* [Overview](#overview)* [Example](#example)