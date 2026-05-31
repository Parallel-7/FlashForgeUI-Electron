# Source: https://www.electronjs.org/docs/latest/api/image-view

On this page

> A View that displays an image.

Process: [Main](/docs/latest/glossary#main-process)

This module cannot be used until the `ready` event of the `app`
module is emitted.

Useful for showing splash screens that will be swapped for `WebContentsView`s
when the content finishes loading.

Note that `ImageView` is experimental and may be changed or removed in the future.

```
const { BaseWindow, ImageView, nativeImage, WebContentsView } = require('electron')

const path = require('node:path')

const win = new BaseWindow({ width: 800, height: 600 })

// Create a "splash screen" image to display while the WebContentsView loads
const splashView = new ImageView()
const splashImage = nativeImage.createFromPath(path.join(__dirname, 'loading.png'))
splashView.setImage(splashImage)
win.setContentView(splashView)

const webContentsView = new WebContentsView()
webContentsView.webContents.once('did-finish-load', () => {
// Now that the WebContentsView has loaded, swap out the "splash screen" ImageView
win.setContentView(webContentsView)
})
webContentsView.webContents.loadURL('https://electronjs.org')
```

## Class: ImageView extends `View`[â](#class-imageview-extends-view "Direct link to class-imageview-extends-view")

> A View that displays an image.

Process: [Main](/docs/latest/glossary#main-process)

`ImageView` inherits from [`View`](/docs/latest/api/view).

`ImageView` is an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter).

warning

Electron's built-in classes cannot be subclassed in user code.
For more information, see [the FAQ](/docs/latest/faq#class-inheritance-does-not-work-with-electron-built-in-modules).

### `new ImageView()` *Experimental*[â](#new-imageview-experimental "Direct link to new-imageview-experimental")

Creates an ImageView.

### Instance Methods[â](#instance-methods "Direct link to Instance Methods")

The following methods are available on instances of the `ImageView` class, in
addition to those inherited from [View](/docs/latest/api/view):

#### `image.setImage(image)` *Experimental*[â](#imagesetimageimage-experimental "Direct link to imagesetimageimage-experimental")

* `image` NativeImage

Sets the image for this `ImageView`. Note that only image formats supported by
`NativeImage` can be used with an `ImageView`.

* [Class: ImageView extends `View`](#class-imageview-extends-view)
+ [`new ImageView()` *Experimental*](#new-imageview-experimental)+ [Instance Methods](#instance-methods)
- [`setImage`](#imagesetimageimage-experimental)