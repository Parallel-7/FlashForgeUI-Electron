# Source: https://www.electronjs.org/docs/latest/api/touch-bar

On this page

warning

Electron's built-in classes cannot be subclassed in user code.
For more information, see [the FAQ](/docs/latest/faq#class-inheritance-does-not-work-with-electron-built-in-modules).

## Class: TouchBar[â](#class-touchbar "Direct link to Class: TouchBar")

> Create TouchBar layouts for native macOS applications

Process: [Main](/docs/latest/glossary#main-process)

### `new TouchBar(options)`[â](#new-touchbaroptions "Direct link to new-touchbaroptions")

* `options` Object
+ `items` ([TouchBarButton](/docs/latest/api/touch-bar-button) | [TouchBarColorPicker](/docs/latest/api/touch-bar-color-picker) | [TouchBarGroup](/docs/latest/api/touch-bar-group) | [TouchBarLabel](/docs/latest/api/touch-bar-label) | [TouchBarPopover](/docs/latest/api/touch-bar-popover) | [TouchBarScrubber](/docs/latest/api/touch-bar-scrubber) | [TouchBarSegmentedControl](/docs/latest/api/touch-bar-segmented-control) | [TouchBarSlider](/docs/latest/api/touch-bar-slider) | [TouchBarSpacer](/docs/latest/api/touch-bar-spacer))[] (optional)
+ `escapeItem` ([TouchBarButton](/docs/latest/api/touch-bar-button) | [TouchBarColorPicker](/docs/latest/api/touch-bar-color-picker) | [TouchBarGroup](/docs/latest/api/touch-bar-group) | [TouchBarLabel](/docs/latest/api/touch-bar-label) | [TouchBarPopover](/docs/latest/api/touch-bar-popover) | [TouchBarScrubber](/docs/latest/api/touch-bar-scrubber) | [TouchBarSegmentedControl](/docs/latest/api/touch-bar-segmented-control) | [TouchBarSlider](/docs/latest/api/touch-bar-slider) | [TouchBarSpacer](/docs/latest/api/touch-bar-spacer) | null) (optional)

Creates a new touch bar with the specified items. Use
`BrowserWindow.setTouchBar` to add the `TouchBar` to a window.

note

The TouchBar API is currently experimental and may change or be
removed in future Electron releases.

tip

If you don't have a MacBook with Touch Bar, you can use
[Touch Bar Simulator](https://github.com/sindresorhus/touch-bar-simulator)
to test Touch Bar usage in your app.

### Static Properties[â](#static-properties "Direct link to Static Properties")

#### `TouchBarButton`[â](#touchbarbutton "Direct link to touchbarbutton")

A [`typeof TouchBarButton`](/docs/latest/api/touch-bar-button) reference to the `TouchBarButton` class.

#### `TouchBarColorPicker`[â](#touchbarcolorpicker "Direct link to touchbarcolorpicker")

A [`typeof TouchBarColorPicker`](/docs/latest/api/touch-bar-color-picker) reference to the `TouchBarColorPicker` class.

#### `TouchBarGroup`[â](#touchbargroup "Direct link to touchbargroup")

A [`typeof TouchBarGroup`](/docs/latest/api/touch-bar-group) reference to the `TouchBarGroup` class.

#### `TouchBarLabel`[â](#touchbarlabel "Direct link to touchbarlabel")

A [`typeof TouchBarLabel`](/docs/latest/api/touch-bar-label) reference to the `TouchBarLabel` class.

#### `TouchBarPopover`[â](#touchbarpopover "Direct link to touchbarpopover")

A [`typeof TouchBarPopover`](/docs/latest/api/touch-bar-popover) reference to the `TouchBarPopover` class.

#### `TouchBarScrubber`[â](#touchbarscrubber "Direct link to touchbarscrubber")

A [`typeof TouchBarScrubber`](/docs/latest/api/touch-bar-scrubber) reference to the `TouchBarScrubber` class.

#### `TouchBarSegmentedControl`[â](#touchbarsegmentedcontrol "Direct link to touchbarsegmentedcontrol")

A [`typeof TouchBarSegmentedControl`](/docs/latest/api/touch-bar-segmented-control) reference to the `TouchBarSegmentedControl` class.

#### `TouchBarSlider`[â](#touchbarslider "Direct link to touchbarslider")

A [`typeof TouchBarSlider`](/docs/latest/api/touch-bar-slider) reference to the `TouchBarSlider` class.

#### `TouchBarSpacer`[â](#touchbarspacer "Direct link to touchbarspacer")

A [`typeof TouchBarSpacer`](/docs/latest/api/touch-bar-spacer) reference to the `TouchBarSpacer` class.

#### `TouchBarOtherItemsProxy`[â](#touchbarotheritemsproxy "Direct link to touchbarotheritemsproxy")

A [`typeof TouchBarOtherItemsProxy`](/docs/latest/api/touch-bar-other-items-proxy) reference to the `TouchBarOtherItemsProxy` class.

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

The following properties are available on instances of `TouchBar`:

#### `touchBar.escapeItem`[â](#touchbarescapeitem "Direct link to touchbarescapeitem")

A `TouchBarItem` that will replace the "esc" button on the touch bar when set.
Setting to `null` restores the default "esc" button. Changing this value
immediately updates the escape item in the touch bar.

## Examples[â](#examples "Direct link to Examples")

Below is an example of a simple slot machine touch bar game with a button
and some labels.

```
const { app, BrowserWindow, TouchBar } = require('electron')

const { TouchBarLabel, TouchBarButton, TouchBarSpacer } = TouchBar

let spinning = false

// Reel labels
const reel1 = new TouchBarLabel({ label: '' })
const reel2 = new TouchBarLabel({ label: '' })
const reel3 = new TouchBarLabel({ label: '' })

// Spin result label
const result = new TouchBarLabel({ label: '' })

// Spin button
const spin = new TouchBarButton({
label: 'ð° Spin',
backgroundColor: '#7851A9',
click: () => {
// Ignore clicks if already spinning
if (spinning) {
return
}

spinning = true
result.label = ''

let timeout = 10
const spinLength = 4 * 1000 // 4 seconds
const startTime = Date.now()

const spinReels = () => {
updateReels()

if ((Date.now() - startTime) >= spinLength) {
finishSpin()
} else {
// Slow down a bit on each spin
timeout *= 1.1
setTimeout(spinReels, timeout)
}
}

spinReels()
}
})

const getRandomValue = () => {
const values = ['ð', 'ð', '7ï¸â£', 'ð', 'ð', 'â­', 'ð', 'ð']
return values[Math.floor(Math.random() * values.length)]
}

const updateReels = () => {
reel1.label = getRandomValue()
reel2.label = getRandomValue()
reel3.label = getRandomValue()
}

const finishSpin = () => {
const uniqueValues = new Set([reel1.label, reel2.label, reel3.label]).size
if (uniqueValues === 1) {
// All 3 values are the same
result.label = 'ð° Jackpot!'
result.textColor = '#FDFF00'
} else if (uniqueValues === 2) {
// 2 values are the same
result.label = 'ð Winner!'
result.textColor = '#FDFF00'
} else {
// No values are the same
result.label = 'ð Spin Again'
result.textColor = null
}
spinning = false
}

const touchBar = new TouchBar({
items: [
spin,
new TouchBarSpacer({ size: 'large' }),
reel1,
new TouchBarSpacer({ size: 'small' }),
reel2,
new TouchBarSpacer({ size: 'small' }),
reel3,
new TouchBarSpacer({ size: 'large' }),
result
]
})

let window

app.whenReady().then(() => {
window = new BrowserWindow({
frame: false,
titleBarStyle: 'hiddenInset',
width: 200,
height: 200,
backgroundColor: '#000'
})
window.loadURL('about:blank')
window.setTouchBar(touchBar)
})
```

### Running the above example[â](#running-the-above-example "Direct link to Running the above example")

To run the example above, you'll need to (assuming you've got a terminal open in the directory you want to run the example):

1. Save the above file to your computer as `touchbar.js`
2. Install Electron via `npm install electron`
3. Run the example inside Electron: `./node_modules/.bin/electron touchbar.js`

You should then see a new Electron window and the app running in your touch bar (or touch bar emulator).

* [Class: TouchBar](#class-touchbar)
+ [`new TouchBar(options)`](#new-touchbaroptions)+ [Static Properties](#static-properties)
- [`TouchBarButton`](#touchbarbutton)- [`TouchBarColorPicker`](#touchbarcolorpicker)- [`TouchBarGroup`](#touchbargroup)- [`TouchBarLabel`](#touchbarlabel)- [`TouchBarPopover`](#touchbarpopover)- [`TouchBarScrubber`](#touchbarscrubber)- [`TouchBarSegmentedControl`](#touchbarsegmentedcontrol)- [`TouchBarSlider`](#touchbarslider)- [`TouchBarSpacer`](#touchbarspacer)- [`TouchBarOtherItemsProxy`](#touchbarotheritemsproxy)+ [Instance Properties](#instance-properties)
- [`escapeItem`](#touchbarescapeitem)* [Examples](#examples)
+ [Running the above example](#running-the-above-example)