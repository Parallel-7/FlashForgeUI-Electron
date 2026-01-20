# Source: https://www.electronjs.org/docs/latest/api/touch-bar-popover

On this page

## Class: TouchBarPopover[â](#class-touchbarpopover "Direct link to Class: TouchBarPopover")

> Create a popover in the touch bar for native macOS applications

Process: [Main](/docs/latest/glossary#main-process)
*This class is not exported from the `'electron'` module. It is only available as a return value of other methods in the Electron API.*

### `new TouchBarPopover(options)`[â](#new-touchbarpopoveroptions "Direct link to new-touchbarpopoveroptions")

* `options` Object
+ `label` string (optional) - Popover button text.
+ `icon` [NativeImage](/docs/latest/api/native-image) (optional) - Popover button icon.
+ `items` [TouchBar](/docs/latest/api/touch-bar) - Items to display in the popover.
+ `showCloseButton` boolean (optional) - `true` to display a close button
on the left of the popover, `false` to not show it. Default is `true`.

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

The following properties are available on instances of `TouchBarPopover`:

#### `touchBarPopover.label`[â](#touchbarpopoverlabel "Direct link to touchbarpopoverlabel")

A `string` representing the popover's current button text. Changing this value immediately updates the
popover in the touch bar.

#### `touchBarPopover.icon`[â](#touchbarpopovericon "Direct link to touchbarpopovericon")

A `NativeImage` representing the popover's current button icon. Changing this value immediately updates the
popover in the touch bar.

* [Class: TouchBarPopover](#class-touchbarpopover)
+ [`new TouchBarPopover(options)`](#new-touchbarpopoveroptions)+ [Instance Properties](#instance-properties)
- [`label`](#touchbarpopoverlabel)- [`icon`](#touchbarpopovericon)