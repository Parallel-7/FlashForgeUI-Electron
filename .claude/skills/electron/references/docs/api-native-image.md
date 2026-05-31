# Source: https://www.electronjs.org/docs/latest/api/native-image

On this page

> Create tray, dock, and application icons using PNG or JPG files.

Process: [Main](/docs/latest/glossary#main-process), [Renderer](/docs/latest/glossary#renderer-process)

info

If you want to call this API from a renderer process with context isolation enabled,
place the API call in your preload script and
[expose](/docs/latest/tutorial/context-isolation#after-context-isolation-enabled) it using the
[`contextBridge`](/docs/latest/api/context-bridge) API.

The `nativeImage` module provides a unified interface for manipulating
system images. These can be handy if you want to provide multiple scaled
versions of the same icon or take advantage of macOS [template images](https://developer.apple.com/documentation/appkit/nsimage/1520017-template).

Electron APIs that take image files accept either file paths or
`NativeImage` instances. An empty and transparent image will be used when `null` is passed.

For example, when creating a [Tray](/docs/latest/api/tray) or setting a [BrowserWindow](/docs/latest/api/browser-window)'s
icon, you can either pass an image file path as a string:

Main Process

```
const { BrowserWindow, Tray } = require('electron')

const tray = new Tray('/Users/somebody/images/icon.png')
const win = new BrowserWindow({ icon: '/Users/somebody/images/window.png' })
```

or generate a `NativeImage` instance from the same file:

Main Process

```
const { BrowserWindow, nativeImage, Tray } = require('electron')

const trayIcon = nativeImage.createFromPath('/Users/somebody/images/icon.png')
const appIcon = nativeImage.createFromPath('/Users/somebody/images/window.png')
const tray = new Tray(trayIcon)
const win = new BrowserWindow({ icon: appIcon })
```

## Supported Formats[â](#supported-formats "Direct link to Supported Formats")

Currently, `PNG` and `JPEG` image formats are supported across all platforms.
`PNG` is recommended because of its support for transparency and lossless compression.

On Windows, you can also load `ICO` icons from file paths. For best visual
quality, we recommend including at least the following sizes:

* Small icon
+ 16x16 (100% DPI scale)
+ 20x20 (125% DPI scale)
+ 24x24 (150% DPI scale)
+ 32x32 (200% DPI scale)
* Large icon
+ 32x32 (100% DPI scale)
+ 40x40 (125% DPI scale)
+ 48x48 (150% DPI scale)
+ 64x64 (200% DPI scale)
+ 256x256

Check the *Icon Scaling* section in the Windows [App Icon Construction](https://learn.microsoft.com/en-us/windows/apps/design/style/iconography/app-icon-construction#icon-scaling) reference.

note

EXIF metadata is currently not supported and will not be taken into account during
image encoding and decoding.

## High Resolution Image[â](#high-resolution-image "Direct link to High Resolution Image")

On platforms that support high pixel density displays (such as Apple Retina),
you can append `@2x` after image's base filename to mark it as a 2x scale
high resolution image.

For example, if `icon.png` is a normal image that has standard resolution, then
`icon@2x.png` will be treated as a high resolution image that has double
Dots per Inch (DPI) density.

If you want to support displays with different DPI densities at the same time,
you can put images with different sizes in the same folder and use the filename
without DPI suffixes within Electron. For example:

```
images/
âââ icon.png
âââ icon@2x.png
âââ icon@3x.png
```

Main Process

```
const { Tray } = require('electron')

const appTray = new Tray('/Users/somebody/images/icon.png')
```

The following suffixes for DPI are also supported:

* `@1x`
* `@1.25x`
* `@1.33x`
* `@1.4x`
* `@1.5x`
* `@1.8x`
* `@2x`
* `@2.5x`
* `@3x`
* `@4x`
* `@5x`

## Template Image *macOS*[â](#template-image-macos "Direct link to template-image-macos")

On macOS, [template images](https://developer.apple.com/documentation/appkit/nsimage/1520017-template) consist of black and an alpha channel.
Template images are not intended to be used as standalone images and are usually
mixed with other content to create the desired final appearance.

The most common case is to use template images for a menu bar (Tray) icon, so it can
adapt to both light and dark menu bars.

To mark an image as a template image, its base filename should end with the word
`Template` (e.g. `xxxTemplate.png`). You can also specify template images at
different DPI densities (e.g. `xxxTemplate@2x.png`).

## Methods[â](#methods "Direct link to Methods")

The `nativeImage` module has the following methods, all of which return
an instance of the [`NativeImage`](#class-nativeimage) class:

### `nativeImage.createEmpty()`[â](#nativeimagecreateempty "Direct link to nativeimagecreateempty")

Returns `NativeImage`

Creates an empty `NativeImage` instance.

### `nativeImage.createThumbnailFromPath(path, size)` *macOS* *Windows*[â](#nativeimagecreatethumbnailfrompathpath-size-macos-windows "Direct link to nativeimagecreatethumbnailfrompathpath-size-macos-windows")

* `path` string - path to a file that we intend to construct a thumbnail out of.
* `size` [Size](/docs/latest/api/structures/size) - the desired width and height (positive numbers) of the thumbnail.

Returns `Promise<NativeImage>` - fulfilled with the file's thumbnail preview image, which is a [NativeImage](/docs/latest/api/native-image).

note

Windows implementation will ignore `size.height` and scale the height according to `size.width`.

### `nativeImage.createFromPath(path)`[â](#nativeimagecreatefrompathpath "Direct link to nativeimagecreatefrompathpath")

* `path` string - path to a file that we intend to construct an image out of.

Returns `NativeImage`

Creates a new `NativeImage` instance from an image file (e.g., PNG or JPEG) located at `path`.
This method returns an empty image if the `path` does not exist, cannot be read, or is not
a valid image.

```
const { nativeImage } = require('electron')

const image = nativeImage.createFromPath('/Users/somebody/images/icon.png')
console.log(image)
```

### `nativeImage.createFromBitmap(buffer, options)`[â](#nativeimagecreatefrombitmapbuffer-options "Direct link to nativeimagecreatefrombitmapbuffer-options")

* `buffer` [Buffer](https://nodejs.org/api/buffer.html#buffer_class_buffer)
* `options` Object
+ `width` Integer
+ `height` Integer
+ `scaleFactor` Number (optional) - Defaults to 1.0.

Returns `NativeImage`

Creates a new `NativeImage` instance from `buffer` that contains the raw bitmap
pixel data returned by `toBitmap()`. The specific format is platform-dependent.

### `nativeImage.createFromBuffer(buffer[, options])`[â](#nativeimagecreatefrombufferbuffer-options "Direct link to nativeimagecreatefrombufferbuffer-options")

* `buffer` [Buffer](https://nodejs.org/api/buffer.html#buffer_class_buffer)
* `options` Object (optional)
+ `width` Integer (optional) - Required for bitmap buffers.
+ `height` Integer (optional) - Required for bitmap buffers.
+ `scaleFactor` Number (optional) - Defaults to 1.0.

Returns `NativeImage`

Creates a new `NativeImage` instance from `buffer`. Tries to decode as PNG or JPEG first.

### `nativeImage.createFromDataURL(dataURL)`[â](#nativeimagecreatefromdataurldataurl "Direct link to nativeimagecreatefromdataurldataurl")

* `dataURL` string

Returns `NativeImage`

Creates a new `NativeImage` instance from `dataUrl`, a base 64 encoded [Data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs) string.

### `nativeImage.createFromNamedImage(imageName[, hslShift])` *macOS*[â](#nativeimagecreatefromnamedimageimagename-hslshift-macos "Direct link to nativeimagecreatefromnamedimageimagename-hslshift-macos")

* `imageName` string
* `hslShift` number[] (optional)

Returns `NativeImage`

Creates a new `NativeImage` instance from the `NSImage` that maps to the
given image name. See Apple's [`NSImageName`](https://developer.apple.com/documentation/appkit/nsimagename#2901388) documentation and [SF Symbols](https://developer.apple.com/sf-symbols/) for a list of possible values.

The `hslShift` is applied to the image with the following rules:

* `hsl_shift[0]` (hue): The absolute hue value for the image - 0 and 1 map
to 0 and 360 on the hue color wheel (red).
* `hsl_shift[1]` (saturation): A saturation shift for the image, with the
following key values:
0 = remove all color.
0.5 = leave unchanged.
1 = fully saturate the image.
* `hsl_shift[2]` (lightness): A lightness shift for the image, with the
following key values:
0 = remove all lightness (make all pixels black).
0.5 = leave unchanged.
1 = full lightness (make all pixels white).

This means that `[-1, 0, 1]` will make the image completely white and
`[-1, 1, 0]` will make the image completely black.

In some cases, the `NSImageName` doesn't match its string representation; one example of this is `NSFolderImageName`, whose string representation would actually be `NSFolder`. Therefore, you'll need to determine the correct string representation for your image before passing it in. This can be done with the following:

```
echo -e '#import <Cocoa/Cocoa.h>\nint main() { NSLog(@"%@", SYSTEM_IMAGE_NAME); }' | clang -otest -x objective-c -framework Cocoa - && ./test
```

where `SYSTEM_IMAGE_NAME` should be replaced with any value from [this list](https://developer.apple.com/documentation/appkit/nsimagename?language=objc).

For SF Symbols, usage looks as follows:

```
const image = nativeImage.createFromNamedImage('square.and.pencil')
```

where `'square.and.pencil'` is the symbol name from the
[SF Symbols app](https://developer.apple.com/sf-symbols/).

## Class: NativeImage[â](#class-nativeimage "Direct link to Class: NativeImage")

> Natively wrap images such as tray, dock, and application icons.

Process: [Main](/docs/latest/glossary#main-process), [Renderer](/docs/latest/glossary#renderer-process)
*This class is not exported from the `'electron'` module. It is only available as a return value of other methods in the Electron API.*

### Instance Methods[â](#instance-methods "Direct link to Instance Methods")

The following methods are available on instances of the `NativeImage` class:

#### `image.toPNG([options])`[â](#imagetopngoptions "Direct link to imagetopngoptions")

* `options` Object (optional)
+ `scaleFactor` Number (optional) - Defaults to 1.0.

Returns `Buffer` - A [Buffer](https://nodejs.org/api/buffer.html#buffer_class_buffer) that contains the image's `PNG` encoded data.

#### `image.toJPEG(quality)`[â](#imagetojpegquality "Direct link to imagetojpegquality")

* `quality` Integer - Between 0 - 100.

Returns `Buffer` - A [Buffer](https://nodejs.org/api/buffer.html#buffer_class_buffer) that contains the image's `JPEG` encoded data.

#### `image.toBitmap([options])`[â](#imagetobitmapoptions "Direct link to imagetobitmapoptions")

* `options` Object (optional)
+ `scaleFactor` Number (optional) - Defaults to 1.0.

Returns `Buffer` - A [Buffer](https://nodejs.org/api/buffer.html#buffer_class_buffer) that contains a copy of the image's raw bitmap pixel
data.

#### `image.toDataURL([options])`[â](#imagetodataurloptions "Direct link to imagetodataurloptions")

History

|  |  |  |  |
| --- | --- | --- | --- |
| Version(s) Changes|  |  | | --- | --- | | ``` None ```   [`nativeImage.toDataURL` will preserve PNG colorspace](/docs/latest/breaking-changes#behavior-changed-nativeimagetodataurl-will-preserve-png-colorspace) | | | |

* `options` Object (optional)
+ `scaleFactor` Number (optional) - Defaults to 1.0.

Returns `string` - The [Data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs) of the image.

#### `image.getBitmap([options])` *Deprecated*[â](#imagegetbitmapoptions-deprecated "Direct link to imagegetbitmapoptions-deprecated")

* `options` Object (optional)
+ `scaleFactor` Number (optional) - Defaults to 1.0.

Legacy alias for `image.toBitmap()`.

#### `image.getNativeHandle()` *macOS*[â](#imagegetnativehandle-macos "Direct link to imagegetnativehandle-macos")

Returns `Buffer` - A [Buffer](https://nodejs.org/api/buffer.html#buffer_class_buffer) that stores C pointer to underlying native handle of
the image. On macOS, a pointer to `NSImage` instance is returned.

Notice that the returned pointer is a weak pointer to the underlying native
image instead of a copy, so you *must* ensure that the associated
`nativeImage` instance is kept around.

#### `image.isEmpty()`[â](#imageisempty "Direct link to imageisempty")

Returns `boolean` - Whether the image is empty.

#### `image.getSize([scaleFactor])`[â](#imagegetsizescalefactor "Direct link to imagegetsizescalefactor")

* `scaleFactor` Number (optional) - Defaults to 1.0.

Returns [Size](/docs/latest/api/structures/size).

If `scaleFactor` is passed, this will return the size corresponding to the image representation most closely matching the passed value.

#### `image.setTemplateImage(option)`[â](#imagesettemplateimageoption "Direct link to imagesettemplateimageoption")

* `option` boolean

Marks the image as a macOS [template image](https://developer.apple.com/documentation/appkit/nsimage/1520017-template).

#### `image.isTemplateImage()`[â](#imageistemplateimage "Direct link to imageistemplateimage")

Returns `boolean` - Whether the image is a macOS [template image](https://developer.apple.com/documentation/appkit/nsimage/1520017-template).

#### `image.crop(rect)`[â](#imagecroprect "Direct link to imagecroprect")

* `rect` [Rectangle](/docs/latest/api/structures/rectangle) - The area of the image to crop.

Returns `NativeImage` - The cropped image.

#### `image.resize(options)`[â](#imageresizeoptions "Direct link to imageresizeoptions")

* `options` Object
+ `width` Integer (optional) - Defaults to the image's width.
+ `height` Integer (optional) - Defaults to the image's height.
+ `quality` string (optional) - The desired quality of the resize image.
Possible values include `good`, `better`, or `best`. The default is `best`.
These values express a desired quality/speed tradeoff. They are translated
into an algorithm-specific method that depends on the capabilities
(CPU, GPU) of the underlying platform. It is possible for all three methods
to be mapped to the same algorithm on a given platform.

Returns `NativeImage` - The resized image.

If only the `height` or the `width` are specified then the current aspect ratio
will be preserved in the resized image.

#### `image.getAspectRatio([scaleFactor])`[â](#imagegetaspectratioscalefactor "Direct link to imagegetaspectratioscalefactor")

* `scaleFactor` Number (optional) - Defaults to 1.0.

Returns `Number` - The image's aspect ratio (width divided by height).

If `scaleFactor` is passed, this will return the aspect ratio corresponding to the image representation most closely matching the passed value.

#### `image.getScaleFactors()`[â](#imagegetscalefactors "Direct link to imagegetscalefactors")

Returns `Number[]` - An array of all scale factors corresponding to representations for a given `NativeImage`.

#### `image.addRepresentation(options)`[â](#imageaddrepresentationoptions "Direct link to imageaddrepresentationoptions")

* `options` Object
+ `scaleFactor` Number (optional) - The scale factor to add the image representation for.
+ `width` Integer (optional) - Defaults to 0. Required if a bitmap buffer
is specified as `buffer`.
+ `height` Integer (optional) - Defaults to 0. Required if a bitmap buffer
is specified as `buffer`.
+ `buffer` Buffer (optional) - The buffer containing the raw image data.
+ `dataURL` string (optional) - The data URL containing either a base 64
encoded PNG or JPEG image.

Add an image representation for a specific scale factor. This can be used
to programmatically add different scale factor representations to an image. This
can be called on empty images.

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

#### `nativeImage.isMacTemplateImage` *macOS*[â](#nativeimageismactemplateimage-macos "Direct link to nativeimageismactemplateimage-macos")

A `boolean` property that determines whether the image is considered a [template image](https://developer.apple.com/documentation/appkit/nsimage/1520017-template).

Please note that this property only has an effect on macOS.

* [Supported Formats](#supported-formats)* [High Resolution Image](#high-resolution-image)* [Template Image *macOS*](#template-image-macos)* [Methods](#methods)
+ [`createEmpty`](#nativeimagecreateempty)+ [`createThumbnailFromPath`](#nativeimagecreatethumbnailfrompathpath-size-macos-windows)+ [`createFromPath`](#nativeimagecreatefrompathpath)+ [`createFromBitmap`](#nativeimagecreatefrombitmapbuffer-options)+ [`createFromBuffer`](#nativeimagecreatefrombufferbuffer-options)+ [`createFromDataURL`](#nativeimagecreatefromdataurldataurl)+ [`createFromNamedImage`](#nativeimagecreatefromnamedimageimagename-hslshift-macos)* [Class: NativeImage](#class-nativeimage)
+ [Instance Methods](#instance-methods)
- [`toPNG`](#imagetopngoptions)- [`toJPEG`](#imagetojpegquality)- [`toBitmap`](#imagetobitmapoptions)- [`toDataURL`](#imagetodataurloptions)- [`getBitmap`](#imagegetbitmapoptions-deprecated)- [`getNativeHandle`](#imagegetnativehandle-macos)- [`isEmpty`](#imageisempty)- [`getSize`](#imagegetsizescalefactor)- [`setTemplateImage`](#imagesettemplateimageoption)- [`isTemplateImage`](#imageistemplateimage)- [`crop`](#imagecroprect)- [`resize`](#imageresizeoptions)- [`getAspectRatio`](#imagegetaspectratioscalefactor)- [`getScaleFactors`](#imagegetscalefactors)- [`addRepresentation`](#imageaddrepresentationoptions)+ [Instance Properties](#instance-properties)
- [`isMacTemplateImage`](#nativeimageismactemplateimage-macos)