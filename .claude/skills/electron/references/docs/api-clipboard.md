# Source: https://www.electronjs.org/docs/latest/api/clipboard

On this page

> Perform copy and paste operations on the system clipboard.

Process: [Main](/docs/latest/glossary#main-process), [Renderer](/docs/latest/glossary#renderer-process) *Deprecated* (non-sandboxed only)

note

Using the `clipoard` API from the renderer process is deprecated.

info

If you want to call this API from a renderer process,
place the API call in your preload script and
[expose](/docs/latest/tutorial/context-isolation#after-context-isolation-enabled) it using the
[`contextBridge`](/docs/latest/api/context-bridge) API.

On Linux, there is also a `selection` clipboard. To manipulate it
you need to pass `selection` to each method:

```
const { clipboard } = require('electron')

clipboard.writeText('Example string', 'selection')
console.log(clipboard.readText('selection'))
```

## Methods[â](#methods "Direct link to Methods")

The `clipboard` module has the following methods:

note

Experimental APIs are marked as such and could be removed in future.

### `clipboard.readText([type])`[â](#clipboardreadtexttype "Direct link to clipboardreadtexttype")

* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Returns `string` - The content in the clipboard as plain text.

```
const { clipboard } = require('electron')

clipboard.writeText('hello i am a bit of text!')

const text = clipboard.readText()
console.log(text)
// hello i am a bit of text!'
```

### `clipboard.writeText(text[, type])`[â](#clipboardwritetexttext-type "Direct link to clipboardwritetexttext-type")

* `text` string
* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Writes the `text` into the clipboard as plain text.

```
const { clipboard } = require('electron')

const text = 'hello i am a bit of text!'
clipboard.writeText(text)
```

### `clipboard.readHTML([type])`[â](#clipboardreadhtmltype "Direct link to clipboardreadhtmltype")

* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Returns `string` - The content in the clipboard as markup.

```
const { clipboard } = require('electron')

clipboard.writeHTML('<b>Hi</b>')
const html = clipboard.readHTML()

console.log(html)
// <meta charset='utf-8'><b>Hi</b>
```

### `clipboard.writeHTML(markup[, type])`[â](#clipboardwritehtmlmarkup-type "Direct link to clipboardwritehtmlmarkup-type")

* `markup` string
* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Writes `markup` to the clipboard.

```
const { clipboard } = require('electron')

clipboard.writeHTML('<b>Hi</b>')
```

### `clipboard.readImage([type])`[â](#clipboardreadimagetype "Direct link to clipboardreadimagetype")

* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Returns [`NativeImage`](/docs/latest/api/native-image) - The image content in the clipboard.

### `clipboard.writeImage(image[, type])`[â](#clipboardwriteimageimage-type "Direct link to clipboardwriteimageimage-type")

* `image` [NativeImage](/docs/latest/api/native-image)
* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Writes `image` to the clipboard.

### `clipboard.readRTF([type])`[â](#clipboardreadrtftype "Direct link to clipboardreadrtftype")

* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Returns `string` - The content in the clipboard as RTF.

```
const { clipboard } = require('electron')

clipboard.writeRTF('{\\rtf1\\ansi{\\fonttbl\\f0\\fswiss Helvetica;}\\f0\\pard\nThis is some {\\b bold} text.\\par\n}')

const rtf = clipboard.readRTF()
console.log(rtf)
// {\\rtf1\\ansi{\\fonttbl\\f0\\fswiss Helvetica;}\\f0\\pard\nThis is some {\\b bold} text.\\par\n}
```

### `clipboard.writeRTF(text[, type])`[â](#clipboardwritertftext-type "Direct link to clipboardwritertftext-type")

* `text` string
* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Writes the `text` into the clipboard in RTF.

```
const { clipboard } = require('electron')

const rtf = '{\\rtf1\\ansi{\\fonttbl\\f0\\fswiss Helvetica;}\\f0\\pard\nThis is some {\\b bold} text.\\par\n}'
clipboard.writeRTF(rtf)
```

### `clipboard.readBookmark()` *macOS* *Windows*[â](#clipboardreadbookmark-macos-windows "Direct link to clipboardreadbookmark-macos-windows")

Returns `Object`:

* `title` string
* `url` string

Returns an Object containing `title` and `url` keys representing the bookmark in
the clipboard. The `title` and `url` values will be empty strings when the
bookmark is unavailable. The `title` value will always be empty on Windows.

### `clipboard.writeBookmark(title, url[, type])` *macOS* *Windows*[â](#clipboardwritebookmarktitle-url-type-macos-windows "Direct link to clipboardwritebookmarktitle-url-type-macos-windows")

* `title` string - Unused on Windows
* `url` string
* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Writes the `title` (macOS only) and `url` into the clipboard as a bookmark.

note

Most apps on Windows don't support pasting bookmarks into them so
you can use `clipboard.write` to write both a bookmark and fallback text to the
clipboard.

```
const { clipboard } = require('electron')

clipboard.writeBookmark('Electron Homepage', 'https://electronjs.org')
```

### `clipboard.readFindText()` *macOS*[â](#clipboardreadfindtext-macos "Direct link to clipboardreadfindtext-macos")

Returns `string` - The text on the find pasteboard, which is the pasteboard that holds information about the current state of the active applicationâs find panel.

This method uses synchronous IPC when called from the renderer process.
The cached value is reread from the find pasteboard whenever the application is activated.

### `clipboard.writeFindText(text)` *macOS*[â](#clipboardwritefindtexttext-macos "Direct link to clipboardwritefindtexttext-macos")

* `text` string

Writes the `text` into the find pasteboard (the pasteboard that holds information about the current state of the active applicationâs find panel) as plain text. This method uses synchronous IPC when called from the renderer process.

### `clipboard.clear([type])`[â](#clipboardcleartype "Direct link to clipboardcleartype")

* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Clears the clipboard content.

### `clipboard.availableFormats([type])`[â](#clipboardavailableformatstype "Direct link to clipboardavailableformatstype")

* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Returns `string[]` - An array of supported formats for the clipboard `type`.

```
const { clipboard } = require('electron')

const formats = clipboard.availableFormats()
console.log(formats)
// [ 'text/plain', 'text/html' ]
```

### `clipboard.has(format[, type])` *Experimental*[â](#clipboardhasformat-type-experimental "Direct link to clipboardhasformat-type-experimental")

* `format` string
* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Returns `boolean` - Whether the clipboard supports the specified `format`.

```
const { clipboard } = require('electron')

const hasFormat = clipboard.has('public/utf8-plain-text')
console.log(hasFormat)
// 'true' or 'false'
```

### `clipboard.read(format)` *Experimental*[â](#clipboardreadformat-experimental "Direct link to clipboardreadformat-experimental")

* `format` string

Returns `string` - Reads `format` type from the clipboard.

`format` should contain valid ASCII characters and have `/` separator.
`a/c`, `a/bc` are valid formats while `/abc`, `abc/`, `a/`, `/a`, `a`
are not valid.

### `clipboard.readBuffer(format)` *Experimental*[â](#clipboardreadbufferformat-experimental "Direct link to clipboardreadbufferformat-experimental")

* `format` string

Returns `Buffer` - Reads `format` type from the clipboard.

```
const { clipboard } = require('electron')

const buffer = Buffer.from('this is binary', 'utf8')
clipboard.writeBuffer('public/utf8-plain-text', buffer)

const ret = clipboard.readBuffer('public/utf8-plain-text')

console.log(buffer.equals(ret))
// true
```

### `clipboard.writeBuffer(format, buffer[, type])` *Experimental*[â](#clipboardwritebufferformat-buffer-type-experimental "Direct link to clipboardwritebufferformat-buffer-type-experimental")

* `format` string
* `buffer` Buffer
* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Writes the `buffer` into the clipboard as `format`.

```
const { clipboard } = require('electron')

const buffer = Buffer.from('writeBuffer', 'utf8')
clipboard.writeBuffer('public/utf8-plain-text', buffer)
```

### `clipboard.write(data[, type])`[â](#clipboardwritedata-type "Direct link to clipboardwritedata-type")

* `data` Object
+ `text` string (optional)
+ `html` string (optional)
+ `image` [NativeImage](/docs/latest/api/native-image) (optional)
+ `rtf` string (optional)
+ `bookmark` string (optional) - The title of the URL at `text`.
* `type` string (optional) - Can be `selection` or `clipboard`; default is 'clipboard'. `selection` is only available on Linux.

Writes `data` to the clipboard.

```
const { clipboard } = require('electron')

clipboard.write({
text: 'test',
html: '<b>Hi</b>',
rtf: '{\\rtf1\\utf8 text}',
bookmark: 'a title'
})

console.log(clipboard.readText())
// 'test'

console.log(clipboard.readHTML())
// <meta charset='utf-8'><b>Hi</b>

console.log(clipboard.readRTF())
// '{\\rtf1\\utf8 text}'

console.log(clipboard.readBookmark())
// { title: 'a title', url: 'test' }
```

* [Methods](#methods)
+ [`readText`](#clipboardreadtexttype)+ [`writeText`](#clipboardwritetexttext-type)+ [`readHTML`](#clipboardreadhtmltype)+ [`writeHTML`](#clipboardwritehtmlmarkup-type)+ [`readImage`](#clipboardreadimagetype)+ [`writeImage`](#clipboardwriteimageimage-type)+ [`readRTF`](#clipboardreadrtftype)+ [`writeRTF`](#clipboardwritertftext-type)+ [`readBookmark`](#clipboardreadbookmark-macos-windows)+ [`writeBookmark`](#clipboardwritebookmarktitle-url-type-macos-windows)+ [`readFindText`](#clipboardreadfindtext-macos)+ [`writeFindText`](#clipboardwritefindtexttext-macos)+ [`clear`](#clipboardcleartype)+ [`availableFormats`](#clipboardavailableformatstype)+ [`has`](#clipboardhasformat-type-experimental)+ [`read`](#clipboardreadformat-experimental)+ [`readBuffer`](#clipboardreadbufferformat-experimental)+ [`writeBuffer`](#clipboardwritebufferformat-buffer-type-experimental)+ [`write`](#clipboardwritedata-type)