# Source: https://www.electronjs.org/docs/latest/api/touch-bar-spacer

On this page

## Class: TouchBarSpacer[â](#class-touchbarspacer "Direct link to Class: TouchBarSpacer")

> Create a spacer between two items in the touch bar for native macOS applications

Process: [Main](/docs/latest/glossary#main-process)
*This class is not exported from the `'electron'` module. It is only available as a return value of other methods in the Electron API.*

### `new TouchBarSpacer(options)`[â](#new-touchbarspaceroptions "Direct link to new-touchbarspaceroptions")

* `options` Object
+ `size` string (optional) - Size of spacer, possible values are:
- `small` - Small space between items. Maps to `NSTouchBarItemIdentifierFixedSpaceSmall`. This is the default.
- `large` - Large space between items. Maps to `NSTouchBarItemIdentifierFixedSpaceLarge`.
- `flexible` - Take up all available space. Maps to `NSTouchBarItemIdentifierFlexibleSpace`.

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

The following properties are available on instances of `TouchBarSpacer`:

#### `touchBarSpacer.size`[â](#touchbarspacersize "Direct link to touchbarspacersize")

A `string` representing the size of the spacer. Can be `small`, `large` or `flexible`.

* [Class: TouchBarSpacer](#class-touchbarspacer)
+ [`new TouchBarSpacer(options)`](#new-touchbarspaceroptions)+ [Instance Properties](#instance-properties)
- [`size`](#touchbarspacersize)