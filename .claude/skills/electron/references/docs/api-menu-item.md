# Source: https://www.electronjs.org/docs/latest/api/menu-item

On this page

## Class: MenuItem[â](#class-menuitem "Direct link to Class: MenuItem")

> Add items to native application menus and context menus.

Process: [Main](/docs/latest/glossary#main-process)

See [`Menu`](/docs/latest/api/menu) for examples.

warning

Electron's built-in classes cannot be subclassed in user code.
For more information, see [the FAQ](/docs/latest/faq#class-inheritance-does-not-work-with-electron-built-in-modules).

### `new MenuItem(options)`[â](#new-menuitemoptions "Direct link to new-menuitemoptions")

* `options` Object
+ `click` Function (optional) - Will be called with
`click(menuItem, window, event)` when the menu item is clicked.
- `menuItem` MenuItem
- `window` [BaseWindow](/docs/latest/api/base-window) | undefined - This will not be defined if no window is open.
- `event` [KeyboardEvent](/docs/latest/api/structures/keyboard-event)
+ `role` string (optional) - Can be `undo`, `redo`, `cut`, `copy`, `paste`, `pasteAndMatchStyle`, `delete`, `selectAll`, `reload`, `forceReload`, `toggleDevTools`, `resetZoom`, `zoomIn`, `zoomOut`, `toggleSpellChecker`, `togglefullscreen`, `window`, `minimize`, `close`, `help`, `about`, `services`, `hide`, `hideOthers`, `unhide`, `quit`, `showSubstitutions`, `toggleSmartQuotes`, `toggleSmartDashes`, `toggleTextReplacement`, `startSpeaking`, `stopSpeaking`, `zoom`, `front`, `appMenu`, `fileMenu`, `editMenu`, `viewMenu`, `shareMenu`, `recentDocuments`, `toggleTabBar`, `selectNextTab`, `selectPreviousTab`, `showAllTabs`, `mergeAllWindows`, `clearRecentDocuments`, `moveTabToNewWindow` or `windowMenu` - Define the action of the menu item, when specified the
`click` property will be ignored. See [roles](/docs/latest/tutorial/menus#roles).
+ `type` string (optional)
- `normal`
- `separator`
- `submenu`
- `checkbox`
- `radio`
- `header` - Only available on macOS 14 and up.
- `palette` - Only available on macOS 14 and up.
+ `label` string (optional)
+ `sublabel` string (optional) *macOS* - Available in macOS >= 14.4
+ `toolTip` string (optional) *macOS* - Hover text for this menu item.
+ `accelerator` string (optional) - An [Accelerator](/docs/latest/tutorial/keyboard-shortcuts#accelerators) string.
+ `icon` ([NativeImage](/docs/latest/api/native-image) | string) (optional) - Can be a
[NativeImage](/docs/latest/api/native-image) or the file path of an icon.
+ `enabled` boolean (optional) - If false, the menu item will be greyed out and
unclickable.
+ `acceleratorWorksWhenHidden` boolean (optional) *macOS* - default is `true`, and when `false` will prevent the accelerator from triggering the item if the item is not visible.
+ `visible` boolean (optional) - If false, the menu item will be entirely hidden.
+ `checked` boolean (optional) - Should only be specified for `checkbox` or `radio` type
menu items.
+ `registerAccelerator` boolean (optional) *Linux* *Windows* - If false, the accelerator won't be registered
with the system, but it will still be displayed. Defaults to true.
+ `sharingItem` SharingItem (optional) *macOS* - The item to share when the `role` is `shareMenu`.
+ `submenu` (MenuItemConstructorOptions[] | [Menu](/docs/latest/api/menu)) (optional) - Should be specified
for `submenu` type menu items. If `submenu` is specified, the `type: 'submenu'` can be omitted.
If the value is not a [`Menu`](/docs/latest/api/menu) then it will be automatically converted to one using
`Menu.buildFromTemplate`.
+ `id` string (optional) - Unique within a single menu. If defined then it can be used
as a reference to this item by the position attribute.
+ `before` string[] (optional) - Inserts this item before the item with the specified id. If
the referenced item doesn't exist the item will be inserted at the end of the menu. Also implies
that the menu item in question should be placed in the same âgroupâ as the item.
+ `after` string[] (optional) - Inserts this item after the item with the specified id. If the
referenced item doesn't exist the item will be inserted at the end of
the menu.
+ `beforeGroupContaining` string[] (optional) - Provides a means for a single context menu to declare
the placement of their containing group before the containing group of the item
with the specified id.
+ `afterGroupContaining` string[] (optional) - Provides a means for a single context menu to declare
the placement of their containing group after the containing group of the item
with the specified id.

note

`acceleratorWorksWhenHidden` is specified as being macOS-only because accelerators always work when items are hidden on Windows and Linux. The option is exposed to users to give them the option to turn it off, as this is possible in native macOS development.

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

The following properties are available on instances of `MenuItem`:

#### `menuItem.id`[â](#menuitemid "Direct link to menuitemid")

A `string` indicating the item's unique id. This property can be
dynamically changed.

#### `menuItem.label`[â](#menuitemlabel "Direct link to menuitemlabel")

A `string` indicating the item's visible label.

#### `menuItem.click`[â](#menuitemclick "Direct link to menuitemclick")

A `Function` that is fired when the MenuItem receives a click event.
It can be called with `menuItem.click(event, focusedWindow, focusedWebContents)`.

* `event` [KeyboardEvent](/docs/latest/api/structures/keyboard-event)
* `focusedWindow` [BaseWindow](/docs/latest/api/browser-window)
* `focusedWebContents` [WebContents](/docs/latest/api/web-contents)

#### `menuItem.submenu`[â](#menuitemsubmenu "Direct link to menuitemsubmenu")

A `Menu` (optional) containing the menu
item's submenu, if present.

#### `menuItem.type`[â](#menuitemtype "Direct link to menuitemtype")

A `string` indicating the type of the item. Can be `normal`, `separator`, `submenu`, `checkbox`, `radio`, `header` or `palette`.

note

`header` and `palette` are only available on macOS 14 and up.

#### `menuItem.role`[â](#menuitemrole "Direct link to menuitemrole")

A `string` (optional) indicating the item's role, if set. Can be `undo`, `redo`, `cut`, `copy`, `paste`, `pasteAndMatchStyle`, `delete`, `selectAll`, `reload`, `forceReload`, `toggleDevTools`, `resetZoom`, `zoomIn`, `zoomOut`, `toggleSpellChecker`, `togglefullscreen`, `window`, `minimize`, `close`, `help`, `about`, `services`, `hide`, `hideOthers`, `unhide`, `quit`, `startSpeaking`, `stopSpeaking`, `zoom`, `front`, `appMenu`, `fileMenu`, `editMenu`, `viewMenu`, `shareMenu`, `recentDocuments`, `toggleTabBar`, `selectNextTab`, `selectPreviousTab`, `showAllTabs`, `mergeAllWindows`, `clearRecentDocuments`, `moveTabToNewWindow` or `windowMenu`

#### `menuItem.accelerator`[â](#menuitemaccelerator "Direct link to menuitemaccelerator")

An `Accelerator` (optional) indicating the item's accelerator, if set.

#### `menuItem.userAccelerator` *Readonly* *macOS*[â](#menuitemuseraccelerator-readonly-macos "Direct link to menuitemuseraccelerator-readonly-macos")

An `Accelerator | null` indicating the item's [user-assigned accelerator](https://developer.apple.com/documentation/appkit/nsmenuitem/1514850-userkeyequivalent?language=objc) for the menu item.

note

This property is only initialized after the `MenuItem` has been added to a `Menu`. Either via `Menu.buildFromTemplate` or via `Menu.append()/insert()`. Accessing before initialization will just return `null`.

#### `menuItem.icon`[â](#menuitemicon "Direct link to menuitemicon")

A `NativeImage | string` (optional) indicating the
item's icon, if set.

#### `menuItem.sublabel`[â](#menuitemsublabel "Direct link to menuitemsublabel")

A `string` indicating the item's sublabel.

#### `menuItem.toolTip` *macOS*[â](#menuitemtooltip-macos "Direct link to menuitemtooltip-macos")

A `string` indicating the item's hover text.

#### `menuItem.enabled`[â](#menuitemenabled "Direct link to menuitemenabled")

A `boolean` indicating whether the item is enabled. This property can be
dynamically changed.

#### `menuItem.visible`[â](#menuitemvisible "Direct link to menuitemvisible")

A `boolean` indicating whether the item is visible. This property can be
dynamically changed.

#### `menuItem.checked`[â](#menuitemchecked "Direct link to menuitemchecked")

A `boolean` indicating whether the item is checked. This property can be
dynamically changed.

A `checkbox` menu item will toggle the `checked` property on and off when
selected.

A `radio` menu item will turn on its `checked` property when clicked, and
will turn off that property for all adjacent items in the same menu.

You can add a `click` function for additional behavior.

#### `menuItem.registerAccelerator`[â](#menuitemregisteraccelerator "Direct link to menuitemregisteraccelerator")

A `boolean` indicating if the accelerator should be registered with the
system or just displayed.

This property can be dynamically changed.

#### `menuItem.sharingItem` *macOS*[â](#menuitemsharingitem-macos "Direct link to menuitemsharingitem-macos")

A `SharingItem` indicating the item to share when the `role` is `shareMenu`.

This property can be dynamically changed.

#### `menuItem.commandId`[â](#menuitemcommandid "Direct link to menuitemcommandid")

A `number` indicating an item's sequential unique id.

#### `menuItem.menu`[â](#menuitemmenu "Direct link to menuitemmenu")

A `Menu` that the item is a part of.

* [Class: MenuItem](#class-menuitem)
+ [`new MenuItem(options)`](#new-menuitemoptions)+ [Instance Properties](#instance-properties)
- [`id`](#menuitemid)- [`label`](#menuitemlabel)- [`click`](#menuitemclick)- [`submenu`](#menuitemsubmenu)- [`type`](#menuitemtype)- [`role`](#menuitemrole)- [`accelerator`](#menuitemaccelerator)- [`userAccelerator`](#menuitemuseraccelerator-readonly-macos)- [`icon`](#menuitemicon)- [`sublabel`](#menuitemsublabel)- [`toolTip`](#menuitemtooltip-macos)- [`enabled`](#menuitemenabled)- [`visible`](#menuitemvisible)- [`checked`](#menuitemchecked)- [`registerAccelerator`](#menuitemregisteraccelerator)- [`sharingItem`](#menuitemsharingitem-macos)- [`commandId`](#menuitemcommandid)- [`menu`](#menuitemmenu)