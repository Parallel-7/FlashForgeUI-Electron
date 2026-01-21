# Source: https://www.electronjs.org/docs/latest/api/view

On this page

> Create and layout native views.

Process: [Main](/docs/latest/glossary#main-process)

This module cannot be used until the `ready` event of the `app`
module is emitted.

```
const { BaseWindow, View } = require('electron')

const win = new BaseWindow()
const view = new View()

view.setBackgroundColor('red')
view.setBounds({ x: 0, y: 0, width: 100, height: 100 })
win.contentView.addChildView(view)
```

## Class: View[â](#class-view "Direct link to Class: View")

> A basic native view.

Process: [Main](/docs/latest/glossary#main-process)

`View` is an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter).

warning

Electron's built-in classes cannot be subclassed in user code.
For more information, see [the FAQ](/docs/latest/faq#class-inheritance-does-not-work-with-electron-built-in-modules).

### `new View()`[â](#new-view "Direct link to new-view")

Creates a new `View`.

### Instance Events[â](#instance-events "Direct link to Instance Events")

Objects created with `new View` emit the following events:

#### Event: 'bounds-changed'[â](#event-bounds-changed "Direct link to Event: 'bounds-changed'")

Emitted when the view's bounds have changed in response to being laid out. The
new bounds can be retrieved with [`view.getBounds()`](#viewgetbounds).

### Instance Methods[â](#instance-methods "Direct link to Instance Methods")

Objects created with `new View` have the following instance methods:

#### `view.addChildView(view[, index])`[â](#viewaddchildviewview-index "Direct link to viewaddchildviewview-index")

* `view` View - Child view to add.
* `index` Integer (optional) - Index at which to insert the child view.
Defaults to adding the child at the end of the child list.

If the same View is added to a parent which already contains it, it will be reordered such that
it becomes the topmost view.

#### `view.removeChildView(view)`[â](#viewremovechildviewview "Direct link to viewremovechildviewview")

* `view` View - Child view to remove.

If the view passed as a parameter is not a child of this view, this method is a no-op.

#### `view.setBounds(bounds)`[â](#viewsetboundsbounds "Direct link to viewsetboundsbounds")

* `bounds` [Rectangle](/docs/latest/api/structures/rectangle) - New bounds of the View.

#### `view.getBounds()`[â](#viewgetbounds "Direct link to viewgetbounds")

Returns [Rectangle](/docs/latest/api/structures/rectangle) - The bounds of this View, relative to its parent.

#### `view.setBackgroundColor(color)`[â](#viewsetbackgroundcolorcolor "Direct link to viewsetbackgroundcolorcolor")

* `color` string - Color in Hex, RGB, ARGB, HSL, HSLA or named CSS color format. The alpha channel is
optional for the hex type.

Examples of valid `color` values:

* Hex
+ `#fff` (RGB)
+ `#ffff` (ARGB)
+ `#ffffff` (RRGGBB)
+ `#ffffffff` (AARRGGBB)
* RGB
+ `rgb\(([\d]+),\s*([\d]+),\s*([\d]+)\)`
- e.g. `rgb(255, 255, 255)`
* RGBA
+ `rgba\(([\d]+),\s*([\d]+),\s*([\d]+),\s*([\d.]+)\)`
- e.g. `rgba(255, 255, 255, 1.0)`
* HSL
+ `hsl\((-?[\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)`
- e.g. `hsl(200, 20%, 50%)`
* HSLA
+ `hsla\((-?[\d.]+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\)`
- e.g. `hsla(200, 20%, 50%, 0.5)`
* Color name
+ Options are listed in [SkParseColor.cpp](https://source.chromium.org/chromium/chromium/src/+/main:third_party/skia/src/utils/SkParseColor.cpp;l=11-152;drc=eea4bf52cb0d55e2a39c828b017c80a5ee054148)
+ Similar to CSS Color Module Level 3 keywords, but case-sensitive.
- e.g. `blueviolet` or `red`

note

Hex format with alpha takes `AARRGGBB` or `ARGB`, *not* `RRGGBBAA` or `RGB`.

#### `view.setBorderRadius(radius)`[â](#viewsetborderradiusradius "Direct link to viewsetborderradiusradius")

* `radius` Integer - Border radius size in pixels.

note

The area cutout of the view's border still captures clicks.

#### `view.setVisible(visible)`[â](#viewsetvisiblevisible "Direct link to viewsetvisiblevisible")

* `visible` boolean - If false, the view will be hidden from display.

#### `view.getVisible()`[â](#viewgetvisible "Direct link to viewgetvisible")

Returns `boolean` - Whether the view should be drawn. Note that this is
different from whether the view is visible on screenâit may still be obscured
or out of view.

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

Objects created with `new View` have the following properties:

#### `view.children` *Readonly*[â](#viewchildren-readonly "Direct link to viewchildren-readonly")

A `View[]` property representing the child views of this view.

* [Class: View](#class-view)
+ [`new View()`](#new-view)+ [Instance Events](#instance-events)
- [`'bounds-changed'`](#event-bounds-changed)+ [Instance Methods](#instance-methods)
- [`addChildView`](#viewaddchildviewview-index)- [`removeChildView`](#viewremovechildviewview)- [`setBounds`](#viewsetboundsbounds)- [`getBounds`](#viewgetbounds)- [`setBackgroundColor`](#viewsetbackgroundcolorcolor)- [`setBorderRadius`](#viewsetborderradiusradius)- [`setVisible`](#viewsetvisiblevisible)- [`getVisible`](#viewgetvisible)+ [Instance Properties](#instance-properties)
- [`children`](#viewchildren-readonly)