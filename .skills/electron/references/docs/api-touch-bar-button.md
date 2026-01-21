# Source: https://www.electronjs.org/docs/latest/api/touch-bar-button

On this page

## Class: TouchBarButton[â](#class-touchbarbutton "Direct link to Class: TouchBarButton")

> Create a button in the touch bar for native macOS applications

Process: [Main](/docs/latest/glossary#main-process)
*This class is not exported from the `'electron'` module. It is only available as a return value of other methods in the Electron API.*

### `new TouchBarButton(options)`[â](#new-touchbarbuttonoptions "Direct link to new-touchbarbuttonoptions")

* `options` Object
+ `label` string (optional) - Button text.
+ `accessibilityLabel` string (optional) - A short description of the button for use by screenreaders like VoiceOver.
+ `backgroundColor` string (optional) - Button background color in hex format,
i.e `#ABCDEF`.
+ `icon` [NativeImage](/docs/latest/api/native-image) | string (optional) - Button icon.
+ `iconPosition` string (optional) - Can be `left`, `right` or `overlay`. Defaults to `overlay`.
+ `click` Function (optional) - Function to call when the button is clicked.
+ `enabled` boolean (optional) - Whether the button is in an enabled state. Default is `true`.

When defining `accessibilityLabel`, ensure you have considered macOS [best practices](https://developer.apple.com/documentation/appkit/nsaccessibilitybutton/1524910-accessibilitylabel?language=objc).

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

The following properties are available on instances of `TouchBarButton`:

#### `touchBarButton.accessibilityLabel`[â](#touchbarbuttonaccessibilitylabel "Direct link to touchbarbuttonaccessibilitylabel")

A `string` representing the description of the button to be read by a screen reader. Will only be read by screen readers if no label is set.

#### `touchBarButton.label`[â](#touchbarbuttonlabel "Direct link to touchbarbuttonlabel")

A `string` representing the button's current text. Changing this value immediately updates the button
in the touch bar.

#### `touchBarButton.backgroundColor`[â](#touchbarbuttonbackgroundcolor "Direct link to touchbarbuttonbackgroundcolor")

A `string` hex code representing the button's current background color. Changing this value immediately updates
the button in the touch bar.

#### `touchBarButton.icon`[â](#touchbarbuttonicon "Direct link to touchbarbuttonicon")

A `NativeImage` representing the button's current icon. Changing this value immediately updates the button
in the touch bar.

#### `touchBarButton.iconPosition`[â](#touchbarbuttoniconposition "Direct link to touchbarbuttoniconposition")

A `string` - Can be `left`, `right` or `overlay`. Defaults to `overlay`.

#### `touchBarButton.enabled`[â](#touchbarbuttonenabled "Direct link to touchbarbuttonenabled")

A `boolean` representing whether the button is in an enabled state.

* [Class: TouchBarButton](#class-touchbarbutton)
+ [`new TouchBarButton(options)`](#new-touchbarbuttonoptions)+ [Instance Properties](#instance-properties)
- [`accessibilityLabel`](#touchbarbuttonaccessibilitylabel)- [`label`](#touchbarbuttonlabel)- [`backgroundColor`](#touchbarbuttonbackgroundcolor)- [`icon`](#touchbarbuttonicon)- [`iconPosition`](#touchbarbuttoniconposition)- [`enabled`](#touchbarbuttonenabled)