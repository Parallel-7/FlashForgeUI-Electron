# Source: https://www.electronjs.org/docs/latest/api/webview-tag

On this page

## Warning[â](#warning "Direct link to Warning")

Electron's `webview` tag is based on [Chromium's `webview`](https://developer.chrome.com/docs/extensions/reference/webviewTag/), which
is undergoing dramatic architectural changes. This impacts the stability of `webviews`,
including rendering, navigation, and event routing. We currently recommend to
not use the `webview` tag and to consider alternatives, like `iframe`, a
[`WebContentsView`](/docs/latest/api/web-contents-view), or an architecture that avoids
embedded content altogether.

## Enabling[â](#enabling "Direct link to Enabling")

By default the `webview` tag is disabled in Electron >= 5. You need to enable the tag by
setting the `webviewTag` webPreferences option when constructing your `BrowserWindow`. For
more information see the [BrowserWindow constructor docs](/docs/latest/api/browser-window).

## Overview[â](#overview "Direct link to Overview")

> Display external web content in an isolated frame and process.

Process: [Renderer](/docs/latest/glossary#renderer-process)
*This class is not exported from the `'electron'` module. It is only available as a return value of other methods in the Electron API.*

Use the `webview` tag to embed 'guest' content (such as web pages) in your
Electron app. The guest content is contained within the `webview` container.
An embedded page within your app controls how the guest content is laid out and
rendered.

Unlike an `iframe`, the `webview` runs in a separate process than your
app. It doesn't have the same permissions as your web page and all interactions
between your app and embedded content will be asynchronous. This keeps your app
safe from the embedded content.

note

Most methods called on the webview from the host page require a synchronous call to the main process.

## Example[â](#example "Direct link to Example")

To embed a web page in your app, add the `webview` tag to your app's embedder
page (this is the app page that will display the guest content). In its simplest
form, the `webview` tag includes the `src` of the web page and css styles that
control the appearance of the `webview` container:

```
<webview id="foo" src="https://www.github.com/" style="display:inline-flex; width:640px; height:480px"></webview>
```

If you want to control the guest content in any way, you can write JavaScript
that listens for `webview` events and responds to those events using the
`webview` methods. Here's sample code with two event listeners: one that listens
for the web page to start loading, the other for the web page to stop loading,
and displays a "loading..." message during the load time:

```
<script>
onload = () => {
const webview = document.querySelector('webview')
const indicator = document.querySelector('.indicator')

const loadstart = () => {
indicator.innerText = 'loading...'
}

const loadstop = () => {
indicator.innerText = ''
}

webview.addEventListener('did-start-loading', loadstart)
webview.addEventListener('did-stop-loading', loadstop)
}
</script>
```

## Internal implementation[â](#internal-implementation "Direct link to Internal implementation")

Under the hood `webview` is implemented with [Out-of-Process iframes (OOPIFs)](https://www.chromium.org/developers/design-documents/oop-iframes).
The `webview` tag is essentially a custom element using shadow DOM to wrap an
`iframe` element inside it.

So the behavior of `webview` is very similar to a cross-domain `iframe`, as
examples:

* When clicking into a `webview`, the page focus will move from the embedder
frame to `webview`.
* You can not add keyboard, mouse, and scroll event listeners to `webview`.
* All reactions between the embedder frame and `webview` are asynchronous.

## CSS Styling Notes[â](#css-styling-notes "Direct link to CSS Styling Notes")

Please note that the `webview` tag's style uses `display:flex;` internally to
ensure the child `iframe` element fills the full height and width of its `webview`
container when used with traditional and flexbox layouts. Please do not
overwrite the default `display:flex;` CSS property, unless specifying
`display:inline-flex;` for inline layout.

## Tag Attributes[â](#tag-attributes "Direct link to Tag Attributes")

The `webview` tag has the following attributes:

### `src`[â](#src "Direct link to src")

```
<webview src="https://www.github.com/"></webview>
```

A `string` representing the visible URL. Writing to this attribute initiates top-level
navigation.

Assigning `src` its own value will reload the current page.

The `src` attribute can also accept data URLs, such as
`data:text/plain,Hello, world!`.

### `nodeintegration`[â](#nodeintegration "Direct link to nodeintegration")

```
<webview src="https://www.google.com/" nodeintegration></webview>
```

A `boolean`. When this attribute is present the guest page in `webview` will have node
integration and can use node APIs like `require` and `process` to access low
level system resources. Node integration is disabled by default in the guest
page.

### `nodeintegrationinsubframes`[â](#nodeintegrationinsubframes "Direct link to nodeintegrationinsubframes")

```
<webview src="https://www.google.com/" nodeintegrationinsubframes></webview>
```

A `boolean` for the experimental option for enabling NodeJS support in sub-frames such as iframes
inside the `webview`. All your preloads will load for every iframe, you can
use `process.isMainFrame` to determine if you are in the main frame or not.
This option is disabled by default in the guest page.

### `plugins`[â](#plugins "Direct link to plugins")

```
<webview src="https://www.github.com/" plugins></webview>
```

A `boolean`. When this attribute is present the guest page in `webview` will be able to use
browser plugins. Plugins are disabled by default.

### `preload`[â](#preload "Direct link to preload")

```
<!-- from a file -->
<webview src="https://www.github.com/" preload="./test.js"></webview>
<!-- or if you want to load from an asar archive -->
<webview src="https://www.github.com/" preload="./app.asar/test.js"></webview>
```

A `string` that specifies a script that will be loaded before other scripts run in the guest
page. The protocol of script's URL must be `file:` (even when using `asar:` archives) because
it will be loaded by Node's `require` under the hood, which treats `asar:` archives as virtual
directories.

When the guest page doesn't have node integration this script will still have
access to all Node APIs, but global objects injected by Node will be deleted
after this script has finished executing.

### `httpreferrer`[â](#httpreferrer "Direct link to httpreferrer")

```
<webview src="https://www.github.com/" httpreferrer="https://example.com/"></webview>
```

A `string` that sets the referrer URL for the guest page.

### `useragent`[â](#useragent "Direct link to useragent")

```
<webview src="https://www.github.com/" useragent="Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) like Gecko"></webview>
```

A `string` that sets the user agent for the guest page before the page is navigated to. Once the
page is loaded, use the `setUserAgent` method to change the user agent.

### `disablewebsecurity`[â](#disablewebsecurity "Direct link to disablewebsecurity")

```
<webview src="https://www.github.com/" disablewebsecurity></webview>
```

A `boolean`. When this attribute is present the guest page will have web security disabled.
Web security is enabled by default.

This value can only be modified before the first navigation.

### `partition`[â](#partition "Direct link to partition")

```
<webview src="https://github.com" partition="persist:github"></webview>
<webview src="https://electronjs.org" partition="electron"></webview>
```

A `string` that sets the session used by the page. If `partition` starts with `persist:`, the
page will use a persistent session available to all pages in the app with the
same `partition`. if there is no `persist:` prefix, the page will use an
in-memory session. By assigning the same `partition`, multiple pages can share
the same session. If the `partition` is unset then default session of the app
will be used.

This value can only be modified before the first navigation, since the session
of an active renderer process cannot change. Subsequent attempts to modify the
value will fail with a DOM exception.

### `allowpopups`[â](#allowpopups "Direct link to allowpopups")

```
<webview src="https://www.github.com/" allowpopups></webview>
```

A `boolean`. When this attribute is present the guest page will be allowed to open new
windows. Popups are disabled by default.

### `webpreferences`[â](#webpreferences "Direct link to webpreferences")

```
<webview src="https://github.com" webpreferences="allowRunningInsecureContent, javascript=no"></webview>
```

A `string` which is a comma separated list of strings which specifies the web preferences to be set on the webview.
The full list of supported preference strings can be found in [BrowserWindow](/docs/latest/api/browser-window#new-browserwindowoptions).

The string follows the same format as the features string in `window.open`.
A name by itself is given a `true` boolean value.
A preference can be set to another value by including an `=`, followed by the value.
Special values `yes` and `1` are interpreted as `true`, while `no` and `0` are interpreted as `false`.

### `enableblinkfeatures`[â](#enableblinkfeatures "Direct link to enableblinkfeatures")

```
<webview src="https://www.github.com/" enableblinkfeatures="PreciseMemoryInfo, CSSVariables"></webview>
```

A `string` which is a list of strings which specifies the blink features to be enabled separated by `,`.
The full list of supported feature strings can be found in the
[RuntimeEnabledFeatures.json5](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/runtime_enabled_features.json5) file.

### `disableblinkfeatures`[â](#disableblinkfeatures "Direct link to disableblinkfeatures")

```
<webview src="https://www.github.com/" disableblinkfeatures="PreciseMemoryInfo, CSSVariables"></webview>
```

A `string` which is a list of strings which specifies the blink features to be disabled separated by `,`.
The full list of supported feature strings can be found in the
[RuntimeEnabledFeatures.json5](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/runtime_enabled_features.json5) file.

## Methods[â](#methods "Direct link to Methods")

The `webview` tag has the following methods:

note

The webview element must be loaded before using the methods.

**Example**

```
const webview = document.querySelector('webview')
webview.addEventListener('dom-ready', () => {
webview.openDevTools()
})
```

### `<webview>.loadURL(url[, options])`[â](#webviewloadurlurl-options "Direct link to webviewloadurlurl-options")

* `url` URL
* `options` Object (optional)
+ `httpReferrer` (string | [Referrer](/docs/latest/api/structures/referrer)) (optional) - An HTTP Referrer url.
+ `userAgent` string (optional) - A user agent originating the request.
+ `extraHeaders` string (optional) - Extra headers separated by "\n"
+ `postData` ([UploadRawData](/docs/latest/api/structures/upload-raw-data) | [UploadFile](/docs/latest/api/structures/upload-file))[] (optional)
+ `baseURLForDataURL` string (optional) - Base url (with trailing path separator) for files to be loaded by the data url. This is needed only if the specified `url` is a data url and needs to load other files.

Returns `Promise<void>` - The promise will resolve when the page has finished loading
(see [`did-finish-load`](/docs/latest/api/webview-tag#event-did-finish-load)), and rejects
if the page fails to load (see
[`did-fail-load`](/docs/latest/api/webview-tag#event-did-fail-load)).

Loads the `url` in the webview, the `url` must contain the protocol prefix,
e.g. the `http://` or `file://`.

### `<webview>.downloadURL(url[, options])`[â](#webviewdownloadurlurl-options "Direct link to webviewdownloadurlurl-options")

* `url` string
* `options` Object (optional)
+ `headers` Record<string, string> (optional) - HTTP request headers.

Initiates a download of the resource at `url` without navigating.

### `<webview>.getURL()`[â](#webviewgeturl "Direct link to webviewgeturl")

Returns `string` - The URL of guest page.

### `<webview>.getTitle()`[â](#webviewgettitle "Direct link to webviewgettitle")

Returns `string` - The title of guest page.

### `<webview>.isLoading()`[â](#webviewisloading "Direct link to webviewisloading")

Returns `boolean` - Whether guest page is still loading resources.

### `<webview>.isLoadingMainFrame()`[â](#webviewisloadingmainframe "Direct link to webviewisloadingmainframe")

Returns `boolean` - Whether the main frame (and not just iframes or frames within it) is
still loading.

### `<webview>.isWaitingForResponse()`[â](#webviewiswaitingforresponse "Direct link to webviewiswaitingforresponse")

Returns `boolean` - Whether the guest page is waiting for a first-response for the
main resource of the page.

### `<webview>.stop()`[â](#webviewstop "Direct link to webviewstop")

Stops any pending navigation.

### `<webview>.reload()`[â](#webviewreload "Direct link to webviewreload")

Reloads the guest page.

### `<webview>.reloadIgnoringCache()`[â](#webviewreloadignoringcache "Direct link to webviewreloadignoringcache")

Reloads the guest page and ignores cache.

### `<webview>.canGoBack()`[â](#webviewcangoback "Direct link to webviewcangoback")

Returns `boolean` - Whether the guest page can go back.

### `<webview>.canGoForward()`[â](#webviewcangoforward "Direct link to webviewcangoforward")

Returns `boolean` - Whether the guest page can go forward.

### `<webview>.canGoToOffset(offset)`[â](#webviewcangotooffsetoffset "Direct link to webviewcangotooffsetoffset")

* `offset` Integer

Returns `boolean` - Whether the guest page can go to `offset`.

### `<webview>.clearHistory()`[â](#webviewclearhistory "Direct link to webviewclearhistory")

Clears the navigation history.

### `<webview>.goBack()`[â](#webviewgoback "Direct link to webviewgoback")

Makes the guest page go back.

### `<webview>.goForward()`[â](#webviewgoforward "Direct link to webviewgoforward")

Makes the guest page go forward.

### `<webview>.goToIndex(index)`[â](#webviewgotoindexindex "Direct link to webviewgotoindexindex")

* `index` Integer

Navigates to the specified absolute index.

### `<webview>.goToOffset(offset)`[â](#webviewgotooffsetoffset "Direct link to webviewgotooffsetoffset")

* `offset` Integer

Navigates to the specified offset from the "current entry".

### `<webview>.isCrashed()`[â](#webviewiscrashed "Direct link to webviewiscrashed")

Returns `boolean` - Whether the renderer process has crashed.

### `<webview>.setUserAgent(userAgent)`[â](#webviewsetuseragentuseragent "Direct link to webviewsetuseragentuseragent")

* `userAgent` string

Overrides the user agent for the guest page.

### `<webview>.getUserAgent()`[â](#webviewgetuseragent "Direct link to webviewgetuseragent")

Returns `string` - The user agent for guest page.

### `<webview>.insertCSS(css)`[â](#webviewinsertcsscss "Direct link to webviewinsertcsscss")

* `css` string

Returns `Promise<string>` - A promise that resolves with a key for the inserted
CSS that can later be used to remove the CSS via
`<webview>.removeInsertedCSS(key)`.

Injects CSS into the current web page and returns a unique key for the inserted
stylesheet.

### `<webview>.removeInsertedCSS(key)`[â](#webviewremoveinsertedcsskey "Direct link to webviewremoveinsertedcsskey")

* `key` string

Returns `Promise<void>` - Resolves if the removal was successful.

Removes the inserted CSS from the current web page. The stylesheet is identified
by its key, which is returned from `<webview>.insertCSS(css)`.

### `<webview>.executeJavaScript(code[, userGesture])`[â](#webviewexecutejavascriptcode-usergesture "Direct link to webviewexecutejavascriptcode-usergesture")

* `code` string
* `userGesture` boolean (optional) - Default `false`.

Returns `Promise<any>` - A promise that resolves with the result of the executed code
or is rejected if the result of the code is a rejected promise.

Evaluates `code` in page. If `userGesture` is set, it will create the user
gesture context in the page. HTML APIs like `requestFullScreen`, which require
user action, can take advantage of this option for automation.

### `<webview>.openDevTools()`[â](#webviewopendevtools "Direct link to webviewopendevtools")

Opens a DevTools window for guest page.

### `<webview>.closeDevTools()`[â](#webviewclosedevtools "Direct link to webviewclosedevtools")

Closes the DevTools window of guest page.

### `<webview>.isDevToolsOpened()`[â](#webviewisdevtoolsopened "Direct link to webviewisdevtoolsopened")

Returns `boolean` - Whether guest page has a DevTools window attached.

### `<webview>.isDevToolsFocused()`[â](#webviewisdevtoolsfocused "Direct link to webviewisdevtoolsfocused")

Returns `boolean` - Whether DevTools window of guest page is focused.

### `<webview>.inspectElement(x, y)`[â](#webviewinspectelementx-y "Direct link to webviewinspectelementx-y")

* `x` Integer
* `y` Integer

Starts inspecting element at position (`x`, `y`) of guest page.

### `<webview>.inspectSharedWorker()`[â](#webviewinspectsharedworker "Direct link to webviewinspectsharedworker")

Opens the DevTools for the shared worker context present in the guest page.

### `<webview>.inspectServiceWorker()`[â](#webviewinspectserviceworker "Direct link to webviewinspectserviceworker")

Opens the DevTools for the service worker context present in the guest page.

### `<webview>.setAudioMuted(muted)`[â](#webviewsetaudiomutedmuted "Direct link to webviewsetaudiomutedmuted")

* `muted` boolean

Set guest page muted.

### `<webview>.isAudioMuted()`[â](#webviewisaudiomuted "Direct link to webviewisaudiomuted")

Returns `boolean` - Whether guest page has been muted.

### `<webview>.isCurrentlyAudible()`[â](#webviewiscurrentlyaudible "Direct link to webviewiscurrentlyaudible")

Returns `boolean` - Whether audio is currently playing.

### `<webview>.undo()`[â](#webviewundo "Direct link to webviewundo")

Executes editing command `undo` in page.

### `<webview>.redo()`[â](#webviewredo "Direct link to webviewredo")

Executes editing command `redo` in page.

### `<webview>.cut()`[â](#webviewcut "Direct link to webviewcut")

Executes editing command `cut` in page.

### `<webview>.copy()`[â](#webviewcopy "Direct link to webviewcopy")

Executes editing command `copy` in page.

#### `<webview>.centerSelection()`[â](#webviewcenterselection "Direct link to webviewcenterselection")

Centers the current text selection in page.

### `<webview>.paste()`[â](#webviewpaste "Direct link to webviewpaste")

Executes editing command `paste` in page.

### `<webview>.pasteAndMatchStyle()`[â](#webviewpasteandmatchstyle "Direct link to webviewpasteandmatchstyle")

Executes editing command `pasteAndMatchStyle` in page.

### `<webview>.delete()`[â](#webviewdelete "Direct link to webviewdelete")

Executes editing command `delete` in page.

### `<webview>.selectAll()`[â](#webviewselectall "Direct link to webviewselectall")

Executes editing command `selectAll` in page.

### `<webview>.unselect()`[â](#webviewunselect "Direct link to webviewunselect")

Executes editing command `unselect` in page.

#### `<webview>.scrollToTop()`[â](#webviewscrolltotop "Direct link to webviewscrolltotop")

Scrolls to the top of the current `<webview>`.

#### `<webview>.scrollToBottom()`[â](#webviewscrolltobottom "Direct link to webviewscrolltobottom")

Scrolls to the bottom of the current `<webview>`.

#### `<webview>.adjustSelection(options)`[â](#webviewadjustselectionoptions "Direct link to webviewadjustselectionoptions")

* `options` Object
+ `start` Number (optional) - Amount to shift the start index of the current selection.
+ `end` Number (optional) - Amount to shift the end index of the current selection.

Adjusts the current text selection starting and ending points in the focused frame by the given amounts. A negative amount moves the selection towards the beginning of the document, and a positive amount moves the selection towards the end of the document.

See [`webContents.adjustSelection`](/docs/latest/api/web-contents#contentsadjustselectionoptions) for
examples.

### `<webview>.replace(text)`[â](#webviewreplacetext "Direct link to webviewreplacetext")

* `text` string

Executes editing command `replace` in page.

### `<webview>.replaceMisspelling(text)`[â](#webviewreplacemisspellingtext "Direct link to webviewreplacemisspellingtext")

* `text` string

Executes editing command `replaceMisspelling` in page.

### `<webview>.insertText(text)`[â](#webviewinserttexttext "Direct link to webviewinserttexttext")

* `text` string

Returns `Promise<void>`

Inserts `text` to the focused element.

### `<webview>.findInPage(text[, options])`[â](#webviewfindinpagetext-options "Direct link to webviewfindinpagetext-options")

* `text` string - Content to be searched, must not be empty.
* `options` Object (optional)
+ `forward` boolean (optional) - Whether to search forward or backward, defaults to `true`.
+ `findNext` boolean (optional) - Whether to begin a new text finding session with this request. Should be `true` for initial requests, and `false` for follow-up requests. Defaults to `false`.
+ `matchCase` boolean (optional) - Whether search should be case-sensitive,
defaults to `false`.

Returns `Integer` - The request id used for the request.

Starts a request to find all matches for the `text` in the web page. The result of the request
can be obtained by subscribing to [`found-in-page`](/docs/latest/api/webview-tag#event-found-in-page) event.

### `<webview>.stopFindInPage(action)`[â](#webviewstopfindinpageaction "Direct link to webviewstopfindinpageaction")

* `action` string - Specifies the action to take place when ending
[`<webview>.findInPage`](#webviewfindinpagetext-options) request.
+ `clearSelection` - Clear the selection.
+ `keepSelection` - Translate the selection into a normal selection.
+ `activateSelection` - Focus and click the selection node.

Stops any `findInPage` request for the `webview` with the provided `action`.

### `<webview>.print([options])`[â](#webviewprintoptions "Direct link to webviewprintoptions")

* `options` Object (optional)
+ `silent` boolean (optional) - Don't ask user for print settings. Default is `false`.
+ `printBackground` boolean (optional) - Prints the background color and image of
the web page. Default is `false`.
+ `deviceName` string (optional) - Set the printer device name to use. Must be the system-defined name and not the 'friendly' name, e.g 'Brother\_QL\_820NWB' and not 'Brother QL-820NWB'.
+ `color` boolean (optional) - Set whether the printed web page will be in color or grayscale. Default is `true`.
+ `margins` Object (optional)
- `marginType` string (optional) - Can be `default`, `none`, `printableArea`, or `custom`. If `custom` is chosen, you will also need to specify `top`, `bottom`, `left`, and `right`.
- `top` number (optional) - The top margin of the printed web page, in pixels.
- `bottom` number (optional) - The bottom margin of the printed web page, in pixels.
- `left` number (optional) - The left margin of the printed web page, in pixels.
- `right` number (optional) - The right margin of the printed web page, in pixels.
+ `landscape` boolean (optional) - Whether the web page should be printed in landscape mode. Default is `false`.
+ `scaleFactor` number (optional) - The scale factor of the web page.
+ `pagesPerSheet` number (optional) - The number of pages to print per page sheet.
+ `collate` boolean (optional) - Whether the web page should be collated.
+ `copies` number (optional) - The number of copies of the web page to print.
+ `pageRanges` Object[] (optional) - The page range to print.
- `from` number - Index of the first page to print (0-based).
- `to` number - Index of the last page to print (inclusive) (0-based).
+ `duplexMode` string (optional) - Set the duplex mode of the printed web page. Can be `simplex`, `shortEdge`, or `longEdge`.
+ `dpi` Record<string, number> (optional)
- `horizontal` number (optional) - The horizontal dpi.
- `vertical` number (optional) - The vertical dpi.
+ `header` string (optional) - string to be printed as page header.
+ `footer` string (optional) - string to be printed as page footer.
+ `pageSize` string | Size (optional) - Specify page size of the printed document. Can be `A3`,
`A4`, `A5`, `Legal`, `Letter`, `Tabloid` or an Object containing `height` in microns.

Returns `Promise<void>`

Prints `webview`'s web page. Same as `webContents.print([options])`.

### `<webview>.printToPDF(options)`[â](#webviewprinttopdfoptions "Direct link to webviewprinttopdfoptions")

* `options` Object
+ `landscape` boolean (optional) - Paper orientation.`true` for landscape, `false` for portrait. Defaults to false.
+ `displayHeaderFooter` boolean (optional) - Whether to display header and footer. Defaults to false.
+ `printBackground` boolean (optional) - Whether to print background graphics. Defaults to false.
+ `scale` number(optional) - Scale of the webpage rendering. Defaults to 1.
+ `pageSize` string | Size (optional) - Specify page size of the generated PDF. Can be `A0`, `A1`, `A2`, `A3`,
`A4`, `A5`, `A6`, `Legal`, `Letter`, `Tabloid`, `Ledger`, or an Object containing `height` and `width` in inches. Defaults to `Letter`.
+ `margins` Object (optional)
- `top` number (optional) - Top margin in inches. Defaults to 1cm (~0.4 inches).
- `bottom` number (optional) - Bottom margin in inches. Defaults to 1cm (~0.4 inches).
- `left` number (optional) - Left margin in inches. Defaults to 1cm (~0.4 inches).
- `right` number (optional) - Right margin in inches. Defaults to 1cm (~0.4 inches).
+ `pageRanges` string (optional) - Page ranges to print, e.g., '1-5, 8, 11-13'. Defaults to the empty string, which means print all pages.
+ `headerTemplate` string (optional) - HTML template for the print header. Should be valid HTML markup with following classes used to inject printing values into them: `date` (formatted print date), `title` (document title), `url` (document location), `pageNumber` (current page number) and `totalPages` (total pages in the document). For example, `<span class=title></span>` would generate span containing the title.
+ `footerTemplate` string (optional) - HTML template for the print footer. Should use the same format as the `headerTemplate`.
+ `preferCSSPageSize` boolean (optional) - Whether or not to prefer page size as defined by css. Defaults to false, in which case the content will be scaled to fit the paper size.
+ `generateTaggedPDF` boolean (optional) *Experimental* - Whether or not to generate a tagged (accessible) PDF. Defaults to false. As this property is experimental, the generated PDF may not adhere fully to PDF/UA and WCAG standards.
+ `generateDocumentOutline` boolean (optional) *Experimental* - Whether or not to generate a PDF document outline from content headers. Defaults to false.

Returns `Promise<Uint8Array>` - Resolves with the generated PDF data.

Prints `webview`'s web page as PDF, Same as `webContents.printToPDF(options)`.

### `<webview>.capturePage([rect])`[â](#webviewcapturepagerect "Direct link to webviewcapturepagerect")

* `rect` [Rectangle](/docs/latest/api/structures/rectangle) (optional) - The area of the page to be captured.

Returns `Promise<NativeImage>` - Resolves with a [NativeImage](/docs/latest/api/native-image)

Captures a snapshot of the page within `rect`. Omitting `rect` will capture the whole visible page.

### `<webview>.send(channel, ...args)`[â](#webviewsendchannel-args "Direct link to webviewsendchannel-args")

* `channel` string
* `...args` any[]

Returns `Promise<void>`

Send an asynchronous message to renderer process via `channel`, you can also
send arbitrary arguments. The renderer process can handle the message by
listening to the `channel` event with the [`ipcRenderer`](/docs/latest/api/ipc-renderer) module.

See [webContents.send](/docs/latest/api/web-contents#contentssendchannel-args) for
examples.

### `<webview>.sendToFrame(frameId, channel, ...args)`[â](#webviewsendtoframeframeid-channel-args "Direct link to webviewsendtoframeframeid-channel-args")

* `frameId` [number, number] - `[processId, frameId]`
* `channel` string
* `...args` any[]

Returns `Promise<void>`

Send an asynchronous message to renderer process via `channel`, you can also
send arbitrary arguments. The renderer process can handle the message by
listening to the `channel` event with the [`ipcRenderer`](/docs/latest/api/ipc-renderer) module.

See [webContents.sendToFrame](/docs/latest/api/web-contents#contentssendtoframeframeid-channel-args) for
examples.

### `<webview>.sendInputEvent(event)`[â](#webviewsendinputeventevent "Direct link to webviewsendinputeventevent")

* `event` [MouseInputEvent](/docs/latest/api/structures/mouse-input-event) | [MouseWheelInputEvent](/docs/latest/api/structures/mouse-wheel-input-event) | [KeyboardInputEvent](/docs/latest/api/structures/keyboard-input-event)

Returns `Promise<void>`

Sends an input `event` to the page.

See [webContents.sendInputEvent](/docs/latest/api/web-contents#contentssendinputeventinputevent)
for detailed description of `event` object.

### `<webview>.setZoomFactor(factor)`[â](#webviewsetzoomfactorfactor "Direct link to webviewsetzoomfactorfactor")

* `factor` number - Zoom factor.

Changes the zoom factor to the specified factor. Zoom factor is
zoom percent divided by 100, so 300% = 3.0.

### `<webview>.setZoomLevel(level)`[â](#webviewsetzoomlevellevel "Direct link to webviewsetzoomlevellevel")

* `level` number - Zoom level.

Changes the zoom level to the specified level. The original size is 0 and each
increment above or below represents zooming 20% larger or smaller to default
limits of 300% and 50% of original size, respectively. The formula for this is
`scale := 1.2 ^ level`.

note

The zoom policy at the Chromium level is same-origin, meaning that the
zoom level for a specific domain propagates across all instances of windows with
the same domain. Differentiating the window URLs will make zoom work per-window.

### `<webview>.getZoomFactor()`[â](#webviewgetzoomfactor "Direct link to webviewgetzoomfactor")

Returns `number` - the current zoom factor.

### `<webview>.getZoomLevel()`[â](#webviewgetzoomlevel "Direct link to webviewgetzoomlevel")

Returns `number` - the current zoom level.

### `<webview>.setVisualZoomLevelLimits(minimumLevel, maximumLevel)`[â](#webviewsetvisualzoomlevellimitsminimumlevel-maximumlevel "Direct link to webviewsetvisualzoomlevellimitsminimumlevel-maximumlevel")

* `minimumLevel` number
* `maximumLevel` number

Returns `Promise<void>`

Sets the maximum and minimum pinch-to-zoom level.

### `<webview>.showDefinitionForSelection()` *macOS*[â](#webviewshowdefinitionforselection-macos "Direct link to webviewshowdefinitionforselection-macos")

Shows pop-up dictionary that searches the selected word on the page.

### `<webview>.getWebContentsId()`[â](#webviewgetwebcontentsid "Direct link to webviewgetwebcontentsid")

Returns `number` - The WebContents ID of this `webview`.

## DOM Events[â](#dom-events "Direct link to DOM Events")

The following DOM events are available to the `webview` tag:

### Event: 'load-commit'[â](#event-load-commit "Direct link to Event: 'load-commit'")

Returns:

* `url` string
* `isMainFrame` boolean

Fired when a load has committed. This includes navigation within the current
document as well as subframe document-level loads, but does not include
asynchronous resource loads.

### Event: 'did-finish-load'[â](#event-did-finish-load "Direct link to Event: 'did-finish-load'")

Fired when the navigation is done, i.e. the spinner of the tab will stop
spinning, and the `onload` event is dispatched.

### Event: 'did-fail-load'[â](#event-did-fail-load "Direct link to Event: 'did-fail-load'")

Returns:

* `errorCode` Integer
* `errorDescription` string
* `validatedURL` string
* `isMainFrame` boolean

This event is like `did-finish-load`, but fired when the load failed or was
cancelled, e.g. `window.stop()` is invoked.

### Event: 'did-frame-finish-load'[â](#event-did-frame-finish-load "Direct link to Event: 'did-frame-finish-load'")

Returns:

* `isMainFrame` boolean

Fired when a frame has done navigation.

### Event: 'did-start-loading'[â](#event-did-start-loading "Direct link to Event: 'did-start-loading'")

Corresponds to the points in time when the spinner of the tab starts spinning.

### Event: 'did-stop-loading'[â](#event-did-stop-loading "Direct link to Event: 'did-stop-loading'")

Corresponds to the points in time when the spinner of the tab stops spinning.

### Event: 'did-attach'[â](#event-did-attach "Direct link to Event: 'did-attach'")

Fired when attached to the embedder web contents.

### Event: 'dom-ready'[â](#event-dom-ready "Direct link to Event: 'dom-ready'")

Fired when document in the given frame is loaded.

### Event: 'page-title-updated'[â](#event-page-title-updated "Direct link to Event: 'page-title-updated'")

Returns:

* `title` string
* `explicitSet` boolean

Fired when page title is set during navigation. `explicitSet` is false when
title is synthesized from file url.

### Event: 'page-favicon-updated'[â](#event-page-favicon-updated "Direct link to Event: 'page-favicon-updated'")

Returns:

* `favicons` string[] - Array of URLs.

Fired when page receives favicon urls.

### Event: 'enter-html-full-screen'[â](#event-enter-html-full-screen "Direct link to Event: 'enter-html-full-screen'")

Fired when page enters fullscreen triggered by HTML API.

### Event: 'leave-html-full-screen'[â](#event-leave-html-full-screen "Direct link to Event: 'leave-html-full-screen'")

Fired when page leaves fullscreen triggered by HTML API.

### Event: 'console-message'[â](#event-console-message "Direct link to Event: 'console-message'")

Returns:

* `level` Integer - The log level, from 0 to 3. In order it matches `verbose`, `info`, `warning` and `error`.
* `message` string - The actual console message
* `line` Integer - The line number of the source that triggered this console message
* `sourceId` string

Fired when the guest window logs a console message.

The following example code forwards all log messages to the embedder's console
without regard for log level or other properties.

```
const webview = document.querySelector('webview')
webview.addEventListener('console-message', (e) => {
console.log('Guest page logged a message:', e.message)
})
```

### Event: 'found-in-page'[â](#event-found-in-page "Direct link to Event: 'found-in-page'")

Returns:

* `result` Object
+ `requestId` Integer
+ `activeMatchOrdinal` Integer - Position of the active match.
+ `matches` Integer - Number of Matches.
+ `selectionArea` Rectangle - Coordinates of first match region.
+ `finalUpdate` boolean

Fired when a result is available for
[`webview.findInPage`](#webviewfindinpagetext-options) request.

```
const webview = document.querySelector('webview')
webview.addEventListener('found-in-page', (e) => {
webview.stopFindInPage('keepSelection')
})

const requestId = webview.findInPage('test')
console.log(requestId)
```

### Event: 'will-navigate'[â](#event-will-navigate "Direct link to Event: 'will-navigate'")

Returns:

* `url` string

Emitted when a user or the page wants to start navigation. It can happen when
the `window.location` object is changed or a user clicks a link in the page.

This event will not emit when the navigation is started programmatically with
APIs like `<webview>.loadURL` and `<webview>.back`.

It is also not emitted during in-page navigation, such as clicking anchor links
or updating the `window.location.hash`. Use `did-navigate-in-page` event for
this purpose.

Calling `event.preventDefault()` does **NOT** have any effect.

### Event: 'will-frame-navigate'[â](#event-will-frame-navigate "Direct link to Event: 'will-frame-navigate'")

Returns:

* `url` string
* `isMainFrame` boolean
* `frameProcessId` Integer
* `frameRoutingId` Integer

Emitted when a user or the page wants to start navigation anywhere in the `<webview>`
or any frames embedded within. It can happen when the `window.location` object is
changed or a user clicks a link in the page.

This event will not emit when the navigation is started programmatically with
APIs like `<webview>.loadURL` and `<webview>.back`.

It is also not emitted during in-page navigation, such as clicking anchor links
or updating the `window.location.hash`. Use `did-navigate-in-page` event for
this purpose.

Calling `event.preventDefault()` does **NOT** have any effect.

### Event: 'did-start-navigation'[â](#event-did-start-navigation "Direct link to Event: 'did-start-navigation'")

Returns:

* `url` string
* `isInPlace` boolean
* `isMainFrame` boolean
* `frameProcessId` Integer
* `frameRoutingId` Integer

Emitted when any frame (including main) starts navigating. `isInPlace` will be
`true` for in-page navigations.

### Event: 'did-redirect-navigation'[â](#event-did-redirect-navigation "Direct link to Event: 'did-redirect-navigation'")

Returns:

* `url` string
* `isInPlace` boolean
* `isMainFrame` boolean
* `frameProcessId` Integer
* `frameRoutingId` Integer

Emitted after a server side redirect occurs during navigation. For example a 302
redirect.

### Event: 'did-navigate'[â](#event-did-navigate "Direct link to Event: 'did-navigate'")

Returns:

* `url` string

Emitted when a navigation is done.

This event is not emitted for in-page navigations, such as clicking anchor links
or updating the `window.location.hash`. Use `did-navigate-in-page` event for
this purpose.

### Event: 'did-frame-navigate'[â](#event-did-frame-navigate "Direct link to Event: 'did-frame-navigate'")

Returns:

* `url` string
* `httpResponseCode` Integer - -1 for non HTTP navigations
* `httpStatusText` string - empty for non HTTP navigations,
* `isMainFrame` boolean
* `frameProcessId` Integer
* `frameRoutingId` Integer

Emitted when any frame navigation is done.

This event is not emitted for in-page navigations, such as clicking anchor links
or updating the `window.location.hash`. Use `did-navigate-in-page` event for
this purpose.

### Event: 'did-navigate-in-page'[â](#event-did-navigate-in-page "Direct link to Event: 'did-navigate-in-page'")

Returns:

* `isMainFrame` boolean
* `url` string

Emitted when an in-page navigation happened.

When in-page navigation happens, the page URL changes but does not cause
navigation outside of the page. Examples of this occurring are when anchor links
are clicked or when the DOM `hashchange` event is triggered.

### Event: 'close'[â](#event-close "Direct link to Event: 'close'")

Fired when the guest page attempts to close itself.

The following example code navigates the `webview` to `about:blank` when the
guest attempts to close itself.

```
const webview = document.querySelector('webview')
webview.addEventListener('close', () => {
webview.src = 'about:blank'
})
```

### Event: 'ipc-message'[â](#event-ipc-message "Direct link to Event: 'ipc-message'")

Returns:

* `frameId` [number, number] - pair of `[processId, frameId]`.
* `channel` string
* `args` any[]

Fired when the guest page has sent an asynchronous message to embedder page.

With `sendToHost` method and `ipc-message` event you can communicate
between guest page and embedder page:

```
// In embedder page.
const webview = document.querySelector('webview')
webview.addEventListener('ipc-message', (event) => {
console.log(event.channel)
// Prints "pong"
})
webview.send('ping')
```

```
// In guest page.
const { ipcRenderer } = require('electron')

ipcRenderer.on('ping', () => {
ipcRenderer.sendToHost('pong')
})
```

### Event: 'render-process-gone'[â](#event-render-process-gone "Direct link to Event: 'render-process-gone'")

Returns:

* `details` [RenderProcessGoneDetails](/docs/latest/api/structures/render-process-gone-details)

Fired when the renderer process unexpectedly disappears. This is normally
because it was crashed or killed.

### Event: 'destroyed'[â](#event-destroyed "Direct link to Event: 'destroyed'")

Fired when the WebContents is destroyed.

### Event: 'media-started-playing'[â](#event-media-started-playing "Direct link to Event: 'media-started-playing'")

Emitted when media starts playing.

### Event: 'media-paused'[â](#event-media-paused "Direct link to Event: 'media-paused'")

Emitted when media is paused or done playing.

### Event: 'did-change-theme-color'[â](#event-did-change-theme-color "Direct link to Event: 'did-change-theme-color'")

Returns:

* `themeColor` string

Emitted when a page's theme color changes. This is usually due to encountering a meta tag:

```
<meta name='theme-color' content='#ff0000'>
```

### Event: 'update-target-url'[â](#event-update-target-url "Direct link to Event: 'update-target-url'")

Returns:

* `url` string

Emitted when mouse moves over a link or the keyboard moves the focus to a link.

### Event: 'devtools-open-url'[â](#event-devtools-open-url "Direct link to Event: 'devtools-open-url'")

Returns:

* `url` string - URL of the link that was clicked or selected.

Emitted when a link is clicked in DevTools or 'Open in new tab' is selected for a link in its context menu.

#### Event: 'devtools-search-query'[â](#event-devtools-search-query "Direct link to Event: 'devtools-search-query'")

Returns:

* `event` Event
* `query` string - text to query for.

Emitted when 'Search' is selected for text in its context menu.

### Event: 'devtools-opened'[â](#event-devtools-opened "Direct link to Event: 'devtools-opened'")

Emitted when DevTools is opened.

### Event: 'devtools-closed'[â](#event-devtools-closed "Direct link to Event: 'devtools-closed'")

Emitted when DevTools is closed.

### Event: 'devtools-focused'[â](#event-devtools-focused "Direct link to Event: 'devtools-focused'")

Emitted when DevTools is focused / opened.

### Event: 'context-menu'[â](#event-context-menu "Direct link to Event: 'context-menu'")

Returns:

* `params` Object
+ `x` Integer - x coordinate.
+ `y` Integer - y coordinate.
+ `linkURL` string - URL of the link that encloses the node the context menu
was invoked on.
+ `linkText` string - Text associated with the link. May be an empty
string if the contents of the link are an image.
+ `pageURL` string - URL of the top level page that the context menu was
invoked on.
+ `frameURL` string - URL of the subframe that the context menu was invoked
on.
+ `srcURL` string - Source URL for the element that the context menu
was invoked on. Elements with source URLs are images, audio and video.
+ `mediaType` string - Type of the node the context menu was invoked on. Can
be `none`, `image`, `audio`, `video`, `canvas`, `file` or `plugin`.
+ `hasImageContents` boolean - Whether the context menu was invoked on an image
which has non-empty contents.
+ `isEditable` boolean - Whether the context is editable.
+ `selectionText` string - Text of the selection that the context menu was
invoked on.
+ `titleText` string - Title text of the selection that the context menu was
invoked on.
+ `altText` string - Alt text of the selection that the context menu was
invoked on.
+ `suggestedFilename` string - Suggested filename to be used when saving file through 'Save
Link As' option of context menu.
+ `selectionRect` [Rectangle](/docs/latest/api/structures/rectangle) - Rect representing the coordinates in the document space of the selection.
+ `selectionStartOffset` number - Start position of the selection text.
+ `referrerPolicy` [Referrer](/docs/latest/api/structures/referrer) - The referrer policy of the frame on which the menu is invoked.
+ `misspelledWord` string - The misspelled word under the cursor, if any.
+ `dictionarySuggestions` string[] - An array of suggested words to show the
user to replace the `misspelledWord`. Only available if there is a misspelled
word and spellchecker is enabled.
+ `frameCharset` string - The character encoding of the frame on which the
menu was invoked.
+ `formControlType` string - The source that the context menu was invoked on.
Possible values include `none`, `button-button`, `field-set`,
`input-button`, `input-checkbox`, `input-color`, `input-date`,
`input-datetime-local`, `input-email`, `input-file`, `input-hidden`,
`input-image`, `input-month`, `input-number`, `input-password`, `input-radio`,
`input-range`, `input-reset`, `input-search`, `input-submit`, `input-telephone`,
`input-text`, `input-time`, `input-url`, `input-week`, `output`, `reset-button`,
`select-list`, `select-list`, `select-multiple`, `select-one`, `submit-button`,
and `text-area`,
+ `spellcheckEnabled` boolean - If the context is editable, whether or not spellchecking is enabled.
+ `menuSourceType` string - Input source that invoked the context menu.
Can be `none`, `mouse`, `keyboard`, `touch`, `touchMenu`, `longPress`, `longTap`, `touchHandle`, `stylus`, `adjustSelection`, or `adjustSelectionReset`.
+ `mediaFlags` Object - The flags for the media element the context menu was
invoked on.
- `inError` boolean - Whether the media element has crashed.
- `isPaused` boolean - Whether the media element is paused.
- `isMuted` boolean - Whether the media element is muted.
- `hasAudio` boolean - Whether the media element has audio.
- `isLooping` boolean - Whether the media element is looping.
- `isControlsVisible` boolean - Whether the media element's controls are
visible.
- `canToggleControls` boolean - Whether the media element's controls are
toggleable.
- `canPrint` boolean - Whether the media element can be printed.
- `canSave` boolean - Whether or not the media element can be downloaded.
- `canShowPictureInPicture` boolean - Whether the media element can show picture-in-picture.
- `isShowingPictureInPicture` boolean - Whether the media element is currently showing picture-in-picture.
- `canRotate` boolean - Whether the media element can be rotated.
- `canLoop` boolean - Whether the media element can be looped.
+ `editFlags` Object - These flags indicate whether the renderer believes it
is able to perform the corresponding action.
- `canUndo` boolean - Whether the renderer believes it can undo.
- `canRedo` boolean - Whether the renderer believes it can redo.
- `canCut` boolean - Whether the renderer believes it can cut.
- `canCopy` boolean - Whether the renderer believes it can copy.
- `canPaste` boolean - Whether the renderer believes it can paste.
- `canDelete` boolean - Whether the renderer believes it can delete.
- `canSelectAll` boolean - Whether the renderer believes it can select all.
- `canEditRichly` boolean - Whether the renderer believes it can edit text richly.

Emitted when there is a new context menu that needs to be handled.

* [Warning](#warning)* [Enabling](#enabling)* [Overview](#overview)* [Example](#example)* [Internal implementation](#internal-implementation)* [CSS Styling Notes](#css-styling-notes)* [Tag Attributes](#tag-attributes)
+ [`src`](#src)+ [`nodeintegration`](#nodeintegration)+ [`nodeintegrationinsubframes`](#nodeintegrationinsubframes)+ [`plugins`](#plugins)+ [`preload`](#preload)+ [`httpreferrer`](#httpreferrer)+ [`useragent`](#useragent)+ [`disablewebsecurity`](#disablewebsecurity)+ [`partition`](#partition)+ [`allowpopups`](#allowpopups)+ [`webpreferences`](#webpreferences)+ [`enableblinkfeatures`](#enableblinkfeatures)+ [`disableblinkfeatures`](#disableblinkfeatures)* [Methods](#methods)
+ [`<webview>.loadURL(url[, options])`](#webviewloadurlurl-options)+ [`<webview>.downloadURL(url[, options])`](#webviewdownloadurlurl-options)+ [`<webview>.getURL()`](#webviewgeturl)+ [`<webview>.getTitle()`](#webviewgettitle)+ [`<webview>.isLoading()`](#webviewisloading)+ [`<webview>.isLoadingMainFrame()`](#webviewisloadingmainframe)+ [`<webview>.isWaitingForResponse()`](#webviewiswaitingforresponse)+ [`<webview>.stop()`](#webviewstop)+ [`<webview>.reload()`](#webviewreload)+ [`<webview>.reloadIgnoringCache()`](#webviewreloadignoringcache)+ [`<webview>.canGoBack()`](#webviewcangoback)+ [`<webview>.canGoForward()`](#webviewcangoforward)+ [`<webview>.canGoToOffset(offset)`](#webviewcangotooffsetoffset)+ [`<webview>.clearHistory()`](#webviewclearhistory)+ [`<webview>.goBack()`](#webviewgoback)+ [`<webview>.goForward()`](#webviewgoforward)+ [`<webview>.goToIndex(index)`](#webviewgotoindexindex)+ [`<webview>.goToOffset(offset)`](#webviewgotooffsetoffset)+ [`<webview>.isCrashed()`](#webviewiscrashed)+ [`<webview>.setUserAgent(userAgent)`](#webviewsetuseragentuseragent)+ [`<webview>.getUserAgent()`](#webviewgetuseragent)+ [`<webview>.insertCSS(css)`](#webviewinsertcsscss)+ [`<webview>.removeInsertedCSS(key)`](#webviewremoveinsertedcsskey)+ [`<webview>.executeJavaScript(code[, userGesture])`](#webviewexecutejavascriptcode-usergesture)+ [`<webview>.openDevTools()`](#webviewopendevtools)+ [`<webview>.closeDevTools()`](#webviewclosedevtools)+ [`<webview>.isDevToolsOpened()`](#webviewisdevtoolsopened)+ [`<webview>.isDevToolsFocused()`](#webviewisdevtoolsfocused)+ [`<webview>.inspectElement(x, y)`](#webviewinspectelementx-y)+ [`<webview>.inspectSharedWorker()`](#webviewinspectsharedworker)+ [`<webview>.inspectServiceWorker()`](#webviewinspectserviceworker)+ [`<webview>.setAudioMuted(muted)`](#webviewsetaudiomutedmuted)+ [`<webview>.isAudioMuted()`](#webviewisaudiomuted)+ [`<webview>.isCurrentlyAudible()`](#webviewiscurrentlyaudible)+ [`<webview>.undo()`](#webviewundo)+ [`<webview>.redo()`](#webviewredo)+ [`<webview>.cut()`](#webviewcut)+ [`<webview>.copy()`](#webviewcopy)
- [`<webview>.centerSelection()`](#webviewcenterselection)+ [`<webview>.paste()`](#webviewpaste)+ [`<webview>.pasteAndMatchStyle()`](#webviewpasteandmatchstyle)+ [`<webview>.delete()`](#webviewdelete)+ [`<webview>.selectAll()`](#webviewselectall)+ [`<webview>.unselect()`](#webviewunselect)
- [`<webview>.scrollToTop()`](#webviewscrolltotop)- [`<webview>.scrollToBottom()`](#webviewscrolltobottom)- [`<webview>.adjustSelection(options)`](#webviewadjustselectionoptions)+ [`<webview>.replace(text)`](#webviewreplacetext)+ [`<webview>.replaceMisspelling(text)`](#webviewreplacemisspellingtext)+ [`<webview>.insertText(text)`](#webviewinserttexttext)+ [`<webview>.findInPage(text[, options])`](#webviewfindinpagetext-options)+ [`<webview>.stopFindInPage(action)`](#webviewstopfindinpageaction)+ [`<webview>.print([options])`](#webviewprintoptions)+ [`<webview>.printToPDF(options)`](#webviewprinttopdfoptions)+ [`<webview>.capturePage([rect])`](#webviewcapturepagerect)+ [`<webview>.send(channel, ...args)`](#webviewsendchannel-args)+ [`<webview>.sendToFrame(frameId, channel, ...args)`](#webviewsendtoframeframeid-channel-args)+ [`<webview>.sendInputEvent(event)`](#webviewsendinputeventevent)+ [`<webview>.setZoomFactor(factor)`](#webviewsetzoomfactorfactor)+ [`<webview>.setZoomLevel(level)`](#webviewsetzoomlevellevel)+ [`<webview>.getZoomFactor()`](#webviewgetzoomfactor)+ [`<webview>.getZoomLevel()`](#webviewgetzoomlevel)+ [`<webview>.setVisualZoomLevelLimits(minimumLevel, maximumLevel)`](#webviewsetvisualzoomlevellimitsminimumlevel-maximumlevel)+ [`<webview>.showDefinitionForSelection()` *macOS*](#webviewshowdefinitionforselection-macos)+ [`<webview>.getWebContentsId()`](#webviewgetwebcontentsid)* [DOM Events](#dom-events)
+ [`'load-commit'`](#event-load-commit)+ [`'did-finish-load'`](#event-did-finish-load)+ [`'did-fail-load'`](#event-did-fail-load)+ [`'did-frame-finish-load'`](#event-did-frame-finish-load)+ [`'did-start-loading'`](#event-did-start-loading)+ [`'did-stop-loading'`](#event-did-stop-loading)+ [`'did-attach'`](#event-did-attach)+ [`'dom-ready'`](#event-dom-ready)+ [`'page-title-updated'`](#event-page-title-updated)+ [`'page-favicon-updated'`](#event-page-favicon-updated)+ [`'enter-html-full-screen'`](#event-enter-html-full-screen)+ [`'leave-html-full-screen'`](#event-leave-html-full-screen)+ [`'console-message'`](#event-console-message)+ [`'found-in-page'`](#event-found-in-page)+ [`'will-navigate'`](#event-will-navigate)+ [`'will-frame-navigate'`](#event-will-frame-navigate)+ [`'did-start-navigation'`](#event-did-start-navigation)+ [`'did-redirect-navigation'`](#event-did-redirect-navigation)+ [`'did-navigate'`](#event-did-navigate)+ [`'did-frame-navigate'`](#event-did-frame-navigate)+ [`'did-navigate-in-page'`](#event-did-navigate-in-page)+ [`'close'`](#event-close)+ [`'ipc-message'`](#event-ipc-message)+ [`'render-process-gone'`](#event-render-process-gone)+ [`'destroyed'`](#event-destroyed)+ [`'media-started-playing'`](#event-media-started-playing)+ [`'media-paused'`](#event-media-paused)+ [`'did-change-theme-color'`](#event-did-change-theme-color)+ [`'update-target-url'`](#event-update-target-url)+ [`'devtools-open-url'`](#event-devtools-open-url)
- [`'devtools-search-query'`](#event-devtools-search-query)+ [`'devtools-opened'`](#event-devtools-opened)+ [`'devtools-closed'`](#event-devtools-closed)+ [`'devtools-focused'`](#event-devtools-focused)+ [`'context-menu'`](#event-context-menu)