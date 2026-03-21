# Source: https://www.electronjs.org/docs/latest/api/web-frame

On this page

> Customize the rendering of the current web page.

Process: [Renderer](/docs/latest/glossary#renderer-process)

info

If you want to call this API from a renderer process with context isolation enabled,
place the API call in your preload script and
[expose](/docs/latest/tutorial/context-isolation#after-context-isolation-enabled) it using the
[`contextBridge`](/docs/latest/api/context-bridge) API.

`webFrame` export of the Electron module is an instance of the `WebFrame`
class representing the current frame. Sub-frames can be retrieved by
certain properties and methods (e.g. `webFrame.firstChild`).

An example of zooming current page to 200%.

```
const { webFrame } = require('electron')

webFrame.setZoomFactor(2)
```

## Methods[â](#methods "Direct link to Methods")

The `WebFrame` class has the following instance methods:

### `webFrame.setZoomFactor(factor)`[â](#webframesetzoomfactorfactor "Direct link to webframesetzoomfactorfactor")

* `factor` Double - Zoom factor; default is 1.0.

Changes the zoom factor to the specified factor. Zoom factor is
zoom percent divided by 100, so 300% = 3.0.

The factor must be greater than 0.0.

### `webFrame.getZoomFactor()`[â](#webframegetzoomfactor "Direct link to webframegetzoomfactor")

Returns `number` - The current zoom factor.

### `webFrame.setZoomLevel(level)`[â](#webframesetzoomlevellevel "Direct link to webframesetzoomlevellevel")

* `level` number - Zoom level.

Changes the zoom level to the specified level. The original size is 0 and each
increment above or below represents zooming 20% larger or smaller to default
limits of 300% and 50% of original size, respectively.

note

The zoom policy at the Chromium level is same-origin, meaning that the
zoom level for a specific domain propagates across all instances of windows with
the same domain. Differentiating the window URLs will make zoom work per-window.

### `webFrame.getZoomLevel()`[â](#webframegetzoomlevel "Direct link to webframegetzoomlevel")

Returns `number` - The current zoom level.

### `webFrame.setVisualZoomLevelLimits(minimumLevel, maximumLevel)`[â](#webframesetvisualzoomlevellimitsminimumlevel-maximumlevel "Direct link to webframesetvisualzoomlevellimitsminimumlevel-maximumlevel")

* `minimumLevel` number
* `maximumLevel` number

Sets the maximum and minimum pinch-to-zoom level.

note

Visual zoom is disabled by default in Electron. To re-enable it, call:

```
webFrame.setVisualZoomLevelLimits(1, 3)
```

note

Visual zoom only applies to pinch-to-zoom behavior. Cmd+/-/0 zoom shortcuts are
controlled by the 'zoomIn', 'zoomOut', and 'resetZoom' MenuItem roles in the application
Menu. To disable shortcuts, manually [define the Menu](/docs/latest/tutorial/menus) and omit zoom roles
from the definition.

### `webFrame.setSpellCheckProvider(language, provider)`[â](#webframesetspellcheckproviderlanguage-provider "Direct link to webframesetspellcheckproviderlanguage-provider")

* `language` string
* `provider` Object
+ `spellCheck` Function
- `words` string[]
- `callback` Function
* `misspeltWords` string[]

Sets a provider for spell checking in input fields and text areas.

If you want to use this method you must disable the builtin spellchecker when you
construct the window.

```
const mainWindow = new BrowserWindow({
webPreferences: {
spellcheck: false
}
})
```

The `provider` must be an object that has a `spellCheck` method that accepts
an array of individual words for spellchecking.
The `spellCheck` function runs asynchronously and calls the `callback` function
with an array of misspelt words when complete.

An example of using [node-spellchecker](https://github.com/atom/node-spellchecker) as provider:

```
const { webFrame } = require('electron')

const spellChecker = require('spellchecker')

webFrame.setSpellCheckProvider('en-US', {
spellCheck (words, callback) {
setTimeout(() => {
const misspelled = words.filter(x => spellchecker.isMisspelled(x))
callback(misspelled)
}, 0)
}
})
```

### `webFrame.insertCSS(css[, options])`[â](#webframeinsertcsscss-options "Direct link to webframeinsertcsscss-options")

* `css` string
* `options` Object (optional)
+ `cssOrigin` string (optional) - Can be 'user' or 'author'. Sets the [cascade origin](https://www.w3.org/TR/css3-cascade/#cascade-origin) of the inserted stylesheet. Default is 'author'.

Returns `string` - A key for the inserted CSS that can later be used to remove
the CSS via `webFrame.removeInsertedCSS(key)`.

Injects CSS into the current web page and returns a unique key for the inserted
stylesheet.

### `webFrame.removeInsertedCSS(key)`[â](#webframeremoveinsertedcsskey "Direct link to webframeremoveinsertedcsskey")

* `key` string

Removes the inserted CSS from the current web page. The stylesheet is identified
by its key, which is returned from `webFrame.insertCSS(css)`.

### `webFrame.insertText(text)`[â](#webframeinserttexttext "Direct link to webframeinserttexttext")

* `text` string

Inserts `text` to the focused element.

### `webFrame.executeJavaScript(code[, userGesture][, callback])`[â](#webframeexecutejavascriptcode-usergesture-callback "Direct link to webframeexecutejavascriptcode-usergesture-callback")

* `code` string
* `userGesture` boolean (optional) - Default is `false`.
* `callback` Function (optional) - Called after script has been executed. Unless
the frame is suspended (e.g. showing a modal alert), execution will be
synchronous and the callback will be invoked before the method returns. For
compatibility with an older version of this method, the error parameter is
second.
+ `result` Any
+ `error` Error

Returns `Promise<any>` - A promise that resolves with the result of the executed
code or is rejected if execution throws or results in a rejected promise.

Evaluates `code` in page.

In the browser window some HTML APIs like `requestFullScreen` can only be
invoked by a gesture from the user. Setting `userGesture` to `true` will remove
this limitation.

### `webFrame.executeJavaScriptInIsolatedWorld(worldId, scripts[, userGesture][, callback])`[â](#webframeexecutejavascriptinisolatedworldworldid-scripts-usergesture-callback "Direct link to webframeexecutejavascriptinisolatedworldworldid-scripts-usergesture-callback")

* `worldId` Integer - The ID of the world to run the javascript
in, `0` is the default main world (where content runs), `999` is the
world used by Electron's `contextIsolation` feature. Accepts values
in the range 1..536870911.
* `scripts` [WebSource[]](/docs/latest/api/structures/web-source)
* `userGesture` boolean (optional) - Default is `false`.
* `callback` Function (optional) - Called after script has been executed. Unless
the frame is suspended (e.g. showing a modal alert), execution will be
synchronous and the callback will be invoked before the method returns. For
compatibility with an older version of this method, the error parameter is
second.
+ `result` Any
+ `error` Error

Returns `Promise<any>` - A promise that resolves with the result of the executed
code or is rejected if execution could not start.

Works like `executeJavaScript` but evaluates `scripts` in an isolated context.

Note that when the execution of script fails, the returned promise will not
reject and the `result` would be `undefined`. This is because Chromium does not
dispatch errors of isolated worlds to foreign worlds.

### `webFrame.setIsolatedWorldInfo(worldId, info)`[â](#webframesetisolatedworldinfoworldid-info "Direct link to webframesetisolatedworldinfoworldid-info")

* `worldId` Integer - The ID of the world to run the javascript in, `0` is the default world, `999` is the world used by Electron's `contextIsolation` feature. Chrome extensions reserve the range of IDs in `[1 << 20, 1 << 29)`. You can provide any integer here.
* `info` Object
+ `securityOrigin` string (optional) - Security origin for the isolated world.
+ `csp` string (optional) - Content Security Policy for the isolated world.
+ `name` string (optional) - Name for isolated world. Useful in DevTools.

Set the security origin, content security policy and name of the isolated world.

note

If the `csp` is specified, then the `securityOrigin` also has to be specified.

### `webFrame.getResourceUsage()`[â](#webframegetresourceusage "Direct link to webframegetresourceusage")

Returns `Object`:

* `images` [MemoryUsageDetails](/docs/latest/api/structures/memory-usage-details)
* `scripts` [MemoryUsageDetails](/docs/latest/api/structures/memory-usage-details)
* `cssStyleSheets` [MemoryUsageDetails](/docs/latest/api/structures/memory-usage-details)
* `xslStyleSheets` [MemoryUsageDetails](/docs/latest/api/structures/memory-usage-details)
* `fonts` [MemoryUsageDetails](/docs/latest/api/structures/memory-usage-details)
* `other` [MemoryUsageDetails](/docs/latest/api/structures/memory-usage-details)

Returns an object describing usage information of Blink's internal memory
caches.

```
const { webFrame } = require('electron')

console.log(webFrame.getResourceUsage())
```

This will generate:

```
{
images: {
count: 22,
size: 2549,
liveSize: 2542
},
cssStyleSheets: { /* same with "images" */ },
xslStyleSheets: { /* same with "images" */ },
fonts: { /* same with "images" */ },
other: { /* same with "images" */ }
}
```

### `webFrame.clearCache()`[â](#webframeclearcache "Direct link to webframeclearcache")

Attempts to free memory that is no longer being used (like images from a
previous navigation).

Note that blindly calling this method probably makes Electron slower since it
will have to refill these emptied caches, you should only call it if an event
in your app has occurred that makes you think your page is actually using less
memory (i.e. you have navigated from a super heavy page to a mostly empty one,
and intend to stay there).

### `webFrame.getFrameForSelector(selector)`[â](#webframegetframeforselectorselector "Direct link to webframegetframeforselectorselector")

* `selector` string - CSS selector for a frame element.

Returns `WebFrame | null` - The frame element in `webFrame's` document selected by
`selector`, `null` would be returned if `selector` does not select a frame or
if the frame is not in the current renderer process.

### `webFrame.findFrameByName(name)`[â](#webframefindframebynamename "Direct link to webframefindframebynamename")

* `name` string

Returns `WebFrame | null` - A child of `webFrame` with the supplied `name`, `null`
would be returned if there's no such frame or if the frame is not in the current
renderer process.

### `webFrame.findFrameByRoutingId(routingId)` *Deprecated*[â](#webframefindframebyroutingidroutingid-deprecated "Direct link to webframefindframebyroutingidroutingid-deprecated")

* `routingId` Integer - An `Integer` representing the unique frame id in the
current renderer process. Routing IDs can be retrieved from `WebFrame`
instances (`webFrame.routingId`) and are also passed by frame
specific `WebContents` navigation events (e.g. `did-frame-navigate`)

Returns `WebFrame | null` - that has the supplied `routingId`, `null` if not found.

**Deprecated:** Use the new `webFrame.findFrameByToken` API.

### `webFrame.findFrameByToken(frameToken)`[â](#webframefindframebytokenframetoken "Direct link to webframefindframebytokenframetoken")

* `frameToken` string - A `string` representing the unique frame id in the
current renderer process. Frame tokens can be retrieved from `WebFrame`
instances (`webFrame.frameToken`) and can also be retrieved from
`WebFrameMain` instances using `webFrameMain.frameToken`.

Returns `WebFrame | null` - that has the supplied `frameToken`, `null` if not found.

### `webFrame.isWordMisspelled(word)`[â](#webframeiswordmisspelledword "Direct link to webframeiswordmisspelledword")

* `word` string - The word to be spellchecked.

Returns `boolean` - True if the word is misspelled according to the built in
spellchecker, false otherwise. If no dictionary is loaded, always return false.

### `webFrame.getWordSuggestions(word)`[â](#webframegetwordsuggestionsword "Direct link to webframegetwordsuggestionsword")

* `word` string - The misspelled word.

Returns `string[]` - A list of suggested words for a given word. If the word
is spelled correctly, the result will be empty.

## Properties[â](#properties "Direct link to Properties")

### `webFrame.top` *Readonly*[â](#webframetop-readonly "Direct link to webframetop-readonly")

A `WebFrame | null` representing top frame in frame hierarchy to which `webFrame`
belongs, the property would be `null` if top frame is not in the current
renderer process.

### `webFrame.opener` *Readonly*[â](#webframeopener-readonly "Direct link to webframeopener-readonly")

A `WebFrame | null` representing the frame which opened `webFrame`, the property would
be `null` if there's no opener or opener is not in the current renderer process.

### `webFrame.parent` *Readonly*[â](#webframeparent-readonly "Direct link to webframeparent-readonly")

A `WebFrame | null` representing parent frame of `webFrame`, the property would be
`null` if `webFrame` is top or parent is not in the current renderer process.

### `webFrame.firstChild` *Readonly*[â](#webframefirstchild-readonly "Direct link to webframefirstchild-readonly")

A `WebFrame | null` representing the first child frame of `webFrame`, the property
would be `null` if `webFrame` has no children or if first child is not in the
current renderer process.

### `webFrame.nextSibling` *Readonly*[â](#webframenextsibling-readonly "Direct link to webframenextsibling-readonly")

A `WebFrame | null` representing next sibling frame, the property would be `null` if
`webFrame` is the last frame in its parent or if the next sibling is not in the
current renderer process.

### `webFrame.routingId` *Readonly* *Deprecated*[â](#webframeroutingid-readonly-deprecated "Direct link to webframeroutingid-readonly-deprecated")

An `Integer` representing the unique frame id in the current renderer process.
Distinct WebFrame instances that refer to the same underlying frame will have
the same `routingId`.

**Deprecated:** Use the new `webFrame.frameToken` API.

### `webFrame.frameToken` *Readonly*[â](#webframeframetoken-readonly "Direct link to webframeframetoken-readonly")

A `string` representing the unique frame token in the current renderer process.
Distinct WebFrame instances that refer to the same underlying frame will have
the same `frameToken`.

* [Methods](#methods)
+ [`setZoomFactor`](#webframesetzoomfactorfactor)+ [`getZoomFactor`](#webframegetzoomfactor)+ [`setZoomLevel`](#webframesetzoomlevellevel)+ [`getZoomLevel`](#webframegetzoomlevel)+ [`setVisualZoomLevelLimits`](#webframesetvisualzoomlevellimitsminimumlevel-maximumlevel)+ [`setSpellCheckProvider`](#webframesetspellcheckproviderlanguage-provider)+ [`insertCSS`](#webframeinsertcsscss-options)+ [`removeInsertedCSS`](#webframeremoveinsertedcsskey)+ [`insertText`](#webframeinserttexttext)+ [`executeJavaScript`](#webframeexecutejavascriptcode-usergesture-callback)+ [`executeJavaScriptInIsolatedWorld`](#webframeexecutejavascriptinisolatedworldworldid-scripts-usergesture-callback)+ [`setIsolatedWorldInfo`](#webframesetisolatedworldinfoworldid-info)+ [`getResourceUsage`](#webframegetresourceusage)+ [`clearCache`](#webframeclearcache)+ [`getFrameForSelector`](#webframegetframeforselectorselector)+ [`findFrameByName`](#webframefindframebynamename)+ [`findFrameByRoutingId`](#webframefindframebyroutingidroutingid-deprecated)+ [`findFrameByToken`](#webframefindframebytokenframetoken)+ [`isWordMisspelled`](#webframeiswordmisspelledword)+ [`getWordSuggestions`](#webframegetwordsuggestionsword)* [Properties](#properties)
+ [`top`](#webframetop-readonly)+ [`opener`](#webframeopener-readonly)+ [`parent`](#webframeparent-readonly)+ [`firstChild`](#webframefirstchild-readonly)+ [`nextSibling`](#webframenextsibling-readonly)+ [`routingId`](#webframeroutingid-readonly-deprecated)+ [`frameToken`](#webframeframetoken-readonly)