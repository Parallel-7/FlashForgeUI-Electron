# Source: https://www.electronjs.org/docs/latest/api/touch-bar-scrubber

On this page

## Class: TouchBarScrubber[â](#class-touchbarscrubber "Direct link to Class: TouchBarScrubber")

> Create a scrubber (a scrollable selector)

Process: [Main](/docs/latest/glossary#main-process)
*This class is not exported from the `'electron'` module. It is only available as a return value of other methods in the Electron API.*

### `new TouchBarScrubber(options)`[â](#new-touchbarscrubberoptions "Direct link to new-touchbarscrubberoptions")

* `options` Object
+ `items` [ScrubberItem[]](/docs/latest/api/structures/scrubber-item) - An array of items to place in this scrubber.
+ `select` Function (optional) - Called when the user taps an item that was not the last tapped item.
- `selectedIndex` Integer - The index of the item the user selected.
+ `highlight` Function (optional) - Called when the user taps any item.
- `highlightedIndex` Integer - The index of the item the user touched.
+ `selectedStyle` string (optional) - Selected item style. Can be `background`, `outline` or `none`. Defaults to `none`.
+ `overlayStyle` string (optional) - Selected overlay item style. Can be `background`, `outline` or `none`. Defaults to `none`.
+ `showArrowButtons` boolean (optional) - Whether to show arrow buttons. Defaults to `false` and is only shown if `items` is non-empty.
+ `mode` string (optional) - Can be `fixed` or `free`. The default is `free`.
+ `continuous` boolean (optional) - Defaults to `true`.

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

The following properties are available on instances of `TouchBarScrubber`:

#### `touchBarScrubber.items`[â](#touchbarscrubberitems "Direct link to touchbarscrubberitems")

A `ScrubberItem[]` array representing the items in this scrubber. Updating this value immediately
updates the control in the touch bar. Updating deep properties inside this array **does not update the touch bar**.

#### `touchBarScrubber.selectedStyle`[â](#touchbarscrubberselectedstyle "Direct link to touchbarscrubberselectedstyle")

A `string` representing the style that selected items in the scrubber should have. Updating this value immediately
updates the control in the touch bar. Possible values:

* `background` - Maps to `[NSScrubberSelectionStyle roundedBackgroundStyle]`.
* `outline` - Maps to `[NSScrubberSelectionStyle outlineOverlayStyle]`.
* `none` - Removes all styles.

#### `touchBarScrubber.overlayStyle`[â](#touchbarscrubberoverlaystyle "Direct link to touchbarscrubberoverlaystyle")

A `string` representing the style that selected items in the scrubber should have. This style is overlaid on top
of the scrubber item instead of being placed behind it. Updating this value immediately updates the control in the
touch bar. Possible values:

* `background` - Maps to `[NSScrubberSelectionStyle roundedBackgroundStyle]`.
* `outline` - Maps to `[NSScrubberSelectionStyle outlineOverlayStyle]`.
* `none` - Removes all styles.

#### `touchBarScrubber.showArrowButtons`[â](#touchbarscrubbershowarrowbuttons "Direct link to touchbarscrubbershowarrowbuttons")

A `boolean` representing whether to show the left / right selection arrows in this scrubber. Updating this value
immediately updates the control in the touch bar.

#### `touchBarScrubber.mode`[â](#touchbarscrubbermode "Direct link to touchbarscrubbermode")

A `string` representing the mode of this scrubber. Updating this value immediately
updates the control in the touch bar. Possible values:

* `fixed` - Maps to `NSScrubberModeFixed`.
* `free` - Maps to `NSScrubberModeFree`.

#### `touchBarScrubber.continuous`[â](#touchbarscrubbercontinuous "Direct link to touchbarscrubbercontinuous")

A `boolean` representing whether this scrubber is continuous or not. Updating this value immediately
updates the control in the touch bar.

* [Class: TouchBarScrubber](#class-touchbarscrubber)
+ [`new TouchBarScrubber(options)`](#new-touchbarscrubberoptions)+ [Instance Properties](#instance-properties)
- [`items`](#touchbarscrubberitems)- [`selectedStyle`](#touchbarscrubberselectedstyle)- [`overlayStyle`](#touchbarscrubberoverlaystyle)- [`showArrowButtons`](#touchbarscrubbershowarrowbuttons)- [`mode`](#touchbarscrubbermode)- [`continuous`](#touchbarscrubbercontinuous)