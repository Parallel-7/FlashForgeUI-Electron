# Source: https://www.electronjs.org/docs/latest/api/web-contents-view

On this page

> A View that displays a WebContents.

Process: [Main](/docs/latest/glossary#main-process)

This module cannot be used until the `ready` event of the `app`
module is emitted.

```
const { BaseWindow, WebContentsView } = require('electron')

const win = new BaseWindow({ width: 800, height: 400 })

const view1 = new WebContentsView()
win.contentView.addChildView(view1)
view1.webContents.loadURL('https://electronjs.org')
view1.setBounds({ x: 0, y: 0, width: 400, height: 400 })

const view2 = new WebContentsView()
win.contentView.addChildView(view2)
view2.webContents.loadURL('https://github.com/electron/electron')
view2.setBounds({ x: 400, y: 0, width: 400, height: 400 })
```

## Class: WebContentsView extends `View`[â](#class-webcontentsview-extends-view "Direct link to class-webcontentsview-extends-view")

> A View that displays a WebContents.

Process: [Main](/docs/latest/glossary#main-process)

`WebContentsView` inherits from [`View`](/docs/latest/api/view).

`WebContentsView` is an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter).

warning

Electron's built-in classes cannot be subclassed in user code.
For more information, see [the FAQ](/docs/latest/faq#class-inheritance-does-not-work-with-electron-built-in-modules).

### `new WebContentsView([options])`[â](#new-webcontentsviewoptions "Direct link to new-webcontentsviewoptions")

* `options` Object (optional)
+ `webPreferences` [WebPreferences](/docs/latest/api/structures/web-preferences) (optional) - Settings of web page's features.
+ `webContents` [WebContents](/docs/latest/api/web-contents) (optional) - If present, the given WebContents will be adopted by the WebContentsView. A WebContents may only be presented in one WebContentsView at a time.

Creates a WebContentsView.

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

Objects created with `new WebContentsView` have the following properties, in
addition to those inherited from [View](/docs/latest/api/view):

#### `view.webContents` *Readonly*[â](#viewwebcontents-readonly "Direct link to viewwebcontents-readonly")

A `WebContents` property containing a reference to the displayed `WebContents`.
Use this to interact with the `WebContents`, for instance to load a URL.

```
const { WebContentsView } = require('electron')

const view = new WebContentsView()
view.webContents.loadURL('https://electronjs.org/')
```

* [Class: WebContentsView extends `View`](#class-webcontentsview-extends-view)
+ [`new WebContentsView([options])`](#new-webcontentsviewoptions)+ [Instance Properties](#instance-properties)
- [`webContents`](#viewwebcontents-readonly)