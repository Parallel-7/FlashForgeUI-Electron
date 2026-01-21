# Source: https://www.electronjs.org/docs/latest/api/touch-bar-color-picker

On this page

## Class: TouchBarColorPicker[â](#class-touchbarcolorpicker "Direct link to Class: TouchBarColorPicker")

> Create a color picker in the touch bar for native macOS applications

Process: [Main](/docs/latest/glossary#main-process)
*This class is not exported from the `'electron'` module. It is only available as a return value of other methods in the Electron API.*

### `new TouchBarColorPicker(options)`[â](#new-touchbarcolorpickeroptions "Direct link to new-touchbarcolorpickeroptions")

* `options` Object
+ `availableColors` string[] (optional) - Array of hex color strings to
appear as possible colors to select.
+ `selectedColor` string (optional) - The selected hex color in the picker,
i.e `#ABCDEF`.
+ `change` Function (optional) - Function to call when a color is selected.
- `color` string - The color that the user selected from the picker.

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

The following properties are available on instances of `TouchBarColorPicker`:

#### `touchBarColorPicker.availableColors`[â](#touchbarcolorpickeravailablecolors "Direct link to touchbarcolorpickeravailablecolors")

A `string[]` array representing the color picker's available colors to select. Changing this value immediately
updates the color picker in the touch bar.

#### `touchBarColorPicker.selectedColor`[â](#touchbarcolorpickerselectedcolor "Direct link to touchbarcolorpickerselectedcolor")

A `string` hex code representing the color picker's currently selected color. Changing this value immediately
updates the color picker in the touch bar.

* [Class: TouchBarColorPicker](#class-touchbarcolorpicker)
+ [`new TouchBarColorPicker(options)`](#new-touchbarcolorpickeroptions)+ [Instance Properties](#instance-properties)
- [`availableColors`](#touchbarcolorpickeravailablecolors)- [`selectedColor`](#touchbarcolorpickerselectedcolor)