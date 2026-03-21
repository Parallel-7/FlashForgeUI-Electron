# Source: https://www.electronjs.org/docs/latest/api/desktop-capturer

On this page

> Access information about media sources that can be used to capture audio and
> video from the desktop using the [`navigator.mediaDevices.getUserMedia`](https://developer.mozilla.org/en/docs/Web/API/MediaDevices/getUserMedia) API.

Process: [Main](/docs/latest/glossary#main-process)

The following example shows how to capture video from a desktop window whose
title is `Electron`:

```
// main.js
const { app, BrowserWindow, desktopCapturer, session } = require('electron')

app.whenReady().then(() => {
const mainWindow = new BrowserWindow()

session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
// Grant access to the first screen found.
callback({ video: sources[0], audio: 'loopback' })
})
// If true, use the system picker if available.
// Note: this is currently experimental. If the system picker
// is available, it will be used and the media request handler
// will not be invoked.
}, { useSystemPicker: true })

mainWindow.loadFile('index.html')
})
```

```
// renderer.js
const startButton = document.getElementById('startButton')
const stopButton = document.getElementById('stopButton')
const video = document.querySelector('video')

startButton.addEventListener('click', () => {
navigator.mediaDevices.getDisplayMedia({
audio: true,
video: {
width: 320,
height: 240,
frameRate: 30
}
}).then(stream => {
video.srcObject = stream
video.onloadedmetadata = (e) => video.play()
}).catch(e => console.log(e))
})

stopButton.addEventListener('click', () => {
video.pause()
})
```

```
<!-- index.html -->
<html>
<meta http-equiv="content-security-policy" content="script-src 'self' 'unsafe-inline'" />
<body>
<button id="startButton" class="button">Start</button>
<button id="stopButton" class="button">Stop</button>
<video width="320" height="240" autoplay></video>
<script src="renderer.js"></script>
</body>
</html>
```

See [`navigator.mediaDevices.getDisplayMedia`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) for more information.

note

`navigator.mediaDevices.getDisplayMedia` does not permit the use of `deviceId` for
selection of a source - see [specification](https://w3c.github.io/mediacapture-screen-share/#constraints).

## Methods[â](#methods "Direct link to Methods")

The `desktopCapturer` module has the following methods:

### `desktopCapturer.getSources(options)`[â](#desktopcapturergetsourcesoptions "Direct link to desktopcapturergetsourcesoptions")

* `options` Object
+ `types` string[] - An array of strings that lists the types of desktop sources
to be captured, available types can be `screen` and `window`.
+ `thumbnailSize` [Size](/docs/latest/api/structures/size) (optional) - The size that the media source thumbnail
should be scaled to. Default is `150` x `150`. Set width or height to 0 when you do not need
the thumbnails. This will save the processing time required for capturing the content of each
window and screen.
+ `fetchWindowIcons` boolean (optional) - Set to true to enable fetching window icons. The default
value is false. When false the appIcon property of the sources return null. Same if a source has
the type screen.

Returns `Promise<DesktopCapturerSource[]>` - Resolves with an array of [DesktopCapturerSource](/docs/latest/api/structures/desktop-capturer-source) objects, each `DesktopCapturerSource` represents a screen or an individual window that can be captured.

note

Capturing the screen contents requires user consent on macOS 10.15 Catalina or higher,
which can detected by [`systemPreferences.getMediaAccessStatus`](/docs/latest/api/system-preferences#systempreferencesgetmediaaccessstatusmediatype-windows-macos).

## Caveats[â](#caveats "Direct link to Caveats")

`desktopCapturer.getSources(options)` only returns a single source on Linux when using Pipewire.

PipeWire supports a single capture for both screens and windows. If you request the window and screen type, the selected source will be returned as a window capture.

`navigator.mediaDevices.getUserMedia` does not work on macOS for audio capture due to a fundamental limitation whereby apps that want to access the system's audio require a [signed kernel extension](https://developer.apple.com/library/archive/documentation/Security/Conceptual/System_Integrity_Protection_Guide/KernelExtensions/KernelExtensions.html). Chromium, and by extension Electron, does not provide this.

It is possible to circumvent this limitation by capturing system audio with another macOS app like Soundflower and passing it through a virtual audio input device. This virtual device can then be queried with `navigator.mediaDevices.getUserMedia`.

* [Methods](#methods)
+ [`getSources`](#desktopcapturergetsourcesoptions)* [Caveats](#caveats)