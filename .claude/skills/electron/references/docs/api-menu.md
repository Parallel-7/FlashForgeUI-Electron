# Source: https://www.electronjs.org/docs/latest/api/menu

On this page

## Class: Menu[â](#class-menu "Direct link to Class: Menu")

> Create native application menus and context menus.

Process: [Main](/docs/latest/glossary#main-process)

tip

See also: [A detailed guide about how to implement menus in your application](/docs/latest/tutorial/menus).

warning

Electron's built-in classes cannot be subclassed in user code.
For more information, see [the FAQ](/docs/latest/faq#class-inheritance-does-not-work-with-electron-built-in-modules).

### `new Menu()`[â](#new-menu "Direct link to new-menu")

Creates a new menu.

### Static Methods[â](#static-methods "Direct link to Static Methods")

The `Menu` class has the following static methods:

#### `Menu.setApplicationMenu(menu)`[â](#menusetapplicationmenumenu "Direct link to menusetapplicationmenumenu")

* `menu` Menu | null

Sets `menu` as the application menu on macOS. On Windows and Linux, the
`menu` will be set as each window's top menu.

Also on Windows and Linux, you can use a `&` in the top-level item name to
indicate which letter should get a generated accelerator. For example, using
`&File` for the file menu would result in a generated `Alt-F` accelerator that
opens the associated menu. The indicated character in the button label then gets an
underline, and the `&` character is not displayed on the button label.

In order to escape the `&` character in an item name, add a proceeding `&`. For example, `&&File` would result in `&File` displayed on the button label.

Passing `null` will suppress the default menu. On Windows and Linux,
this has the additional effect of removing the menu bar from the window.

note

The default menu will be created automatically if the app does not set one.
It contains standard items such as `File`, `Edit`, `View`, `Window` and `Help`.

#### `Menu.getApplicationMenu()`[â](#menugetapplicationmenu "Direct link to menugetapplicationmenu")

Returns `Menu | null` - The application menu, if set, or `null`, if not set.

note

The returned `Menu` instance doesn't support dynamic addition or
removal of menu items. [Instance properties](#instance-properties) can still
be dynamically modified.

#### `Menu.sendActionToFirstResponder(action)` *macOS*[â](#menusendactiontofirstresponderaction-macos "Direct link to menusendactiontofirstresponderaction-macos")

* `action` string

Sends the `action` to the first responder of application. This is used for
emulating default macOS menu behaviors. Usually you would use the
[`role`](/docs/latest/tutorial/menus#roles) property of a [`MenuItem`](/docs/latest/api/menu-item).

See the [macOS Cocoa Event Handling Guide](https://developer.apple.com/library/mac/documentation/Cocoa/Conceptual/EventOverview/EventArchitecture/EventArchitecture.html#//apple_ref/doc/uid/10000060i-CH3-SW7)
for more information on macOS' native actions.

#### `Menu.buildFromTemplate(template)`[â](#menubuildfromtemplatetemplate "Direct link to menubuildfromtemplatetemplate")

* `template` (MenuItemConstructorOptions | MenuItem)[]

Returns `Menu`

Generally, the `template` is an array of `options` for constructing a
[MenuItem](/docs/latest/api/menu-item). The usage can be referenced above.

You can also attach other fields to the element of the `template` and they will become properties of the constructed menu items.

### Instance Methods[â](#instance-methods "Direct link to Instance Methods")

The `menu` object has the following instance methods:

#### `menu.popup([options])`[â](#menupopupoptions "Direct link to menupopupoptions")

* `options` Object (optional)
+ `window` [BaseWindow](/docs/latest/api/base-window) (optional) - Default is the focused window.
+ `frame` [WebFrameMain](/docs/latest/api/web-frame-main) (optional) - Provide the relevant frame
if you want certain OS-level features such as Writing Tools on macOS to function correctly. Typically, this should be `params.frame` from the [`context-menu` event](/docs/latest/api/web-contents#event-context-menu) on a WebContents, or the [`focusedFrame` property](/docs/latest/api/web-contents#contentsfocusedframe-readonly) of a WebContents.
+ `x` number (optional) - Default is the current mouse cursor position.
Must be declared if `y` is declared.
+ `y` number (optional) - Default is the current mouse cursor position.
Must be declared if `x` is declared.
+ `positioningItem` number (optional) *macOS* - The index of the menu item to
be positioned under the mouse cursor at the specified coordinates. Default
is -1.
+ `sourceType` string (optional) *Windows* *Linux* - This should map to the `menuSourceType`
provided by the `context-menu` event. It is not recommended to set this value manually,
only provide values you receive from other APIs or leave it `undefined`.
Can be `none`, `mouse`, `keyboard`, `touch`, `touchMenu`, `longPress`, `longTap`, `touchHandle`, `stylus`, `adjustSelection`, or `adjustSelectionReset`.
+ `callback` Function (optional) - Called when menu is closed.

Pops up this menu as a context menu in the [`BaseWindow`](/docs/latest/api/base-window).

tip

For more details, see the [Context Menu](/docs/latest/tutorial/context-menu) guide.

#### `menu.closePopup([window])`[â](#menuclosepopupwindow "Direct link to menuclosepopupwindow")

* `window` [BaseWindow](/docs/latest/api/base-window) (optional) - Default is the focused window.

Closes the context menu in the `window`.

#### `menu.append(menuItem)`[â](#menuappendmenuitem "Direct link to menuappendmenuitem")

* `menuItem` [MenuItem](/docs/latest/api/menu-item)

Appends the `menuItem` to the menu.

#### `menu.getMenuItemById(id)`[â](#menugetmenuitembyidid "Direct link to menugetmenuitembyidid")

* `id` string

Returns `MenuItem | null` the item with the specified `id`

#### `menu.insert(pos, menuItem)`[â](#menuinsertpos-menuitem "Direct link to menuinsertpos-menuitem")

* `pos` Integer
* `menuItem` [MenuItem](/docs/latest/api/menu-item)

Inserts the `menuItem` to the `pos` position of the menu.

### Instance Events[â](#instance-events "Direct link to Instance Events")

Objects created with `new Menu` or returned by `Menu.buildFromTemplate` emit the following events:

note

Some events are only available on specific operating systems and are
labeled as such.

#### Event: 'menu-will-show'[â](#event-menu-will-show "Direct link to Event: 'menu-will-show'")

Returns:

* `event` Event

Emitted when `menu.popup()` is called.

#### Event: 'menu-will-close'[â](#event-menu-will-close "Direct link to Event: 'menu-will-close'")

Returns:

* `event` Event

Emitted when a popup is closed either manually or with `menu.closePopup()`.

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

`menu` objects also have the following properties:

#### `menu.items`[â](#menuitems "Direct link to menuitems")

A `MenuItem[]` array containing the menu's items.

Each `Menu` consists of multiple [`MenuItem`](/docs/latest/api/menu-item) instances and each `MenuItem`
can nest a `Menu` into its `submenu` property.

* [Class: Menu](#class-menu)
+ [`new Menu()`](#new-menu)+ [Static Methods](#static-methods)
- [`setApplicationMenu`](#menusetapplicationmenumenu)- [`getApplicationMenu`](#menugetapplicationmenu)- [`sendActionToFirstResponder`](#menusendactiontofirstresponderaction-macos)- [`buildFromTemplate`](#menubuildfromtemplatetemplate)+ [Instance Methods](#instance-methods)
- [`popup`](#menupopupoptions)- [`closePopup`](#menuclosepopupwindow)- [`append`](#menuappendmenuitem)- [`getMenuItemById`](#menugetmenuitembyidid)- [`insert`](#menuinsertpos-menuitem)+ [Instance Events](#instance-events)
- [`'menu-will-show'`](#event-menu-will-show)- [`'menu-will-close'`](#event-menu-will-close)+ [Instance Properties](#instance-properties)
- [`items`](#menuitems)