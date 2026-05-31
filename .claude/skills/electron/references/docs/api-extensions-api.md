# Source: https://www.electronjs.org/docs/latest/api/extensions-api

On this page

## Class: Extensions[â](#class-extensions "Direct link to Class: Extensions")

> Load and interact with extensions.

Process: [Main](/docs/latest/glossary#main-process)
*This class is not exported from the `'electron'` module. It is only available as a return value of other methods in the Electron API.*

Instances of the `Extensions` class are accessed by using `extensions` property of
a `Session`.

### Instance Events[â](#instance-events "Direct link to Instance Events")

The following events are available on instances of `Extensions`:

#### Event: 'extension-loaded'[â](#event-extension-loaded "Direct link to Event: 'extension-loaded'")

Returns:

* `event` Event
* `extension` [Extension](/docs/latest/api/structures/extension)

Emitted after an extension is loaded. This occurs whenever an extension is
added to the "enabled" set of extensions. This includes:

* Extensions being loaded from `Extensions.loadExtension`.
* Extensions being reloaded:
+ from a crash.
+ if the extension requested it ([`chrome.runtime.reload()`](https://developer.chrome.com/extensions/runtime#method-reload)).

#### Event: 'extension-unloaded'[â](#event-extension-unloaded "Direct link to Event: 'extension-unloaded'")

Returns:

* `event` Event
* `extension` [Extension](/docs/latest/api/structures/extension)

Emitted after an extension is unloaded. This occurs when
`Session.removeExtension` is called.

#### Event: 'extension-ready'[â](#event-extension-ready "Direct link to Event: 'extension-ready'")

Returns:

* `event` Event
* `extension` [Extension](/docs/latest/api/structures/extension)

Emitted after an extension is loaded and all necessary browser state is
initialized to support the start of the extension's background page.

### Instance Methods[â](#instance-methods "Direct link to Instance Methods")

The following methods are available on instances of `Extensions`:

#### `extensions.loadExtension(path[, options])`[â](#extensionsloadextensionpath-options "Direct link to extensionsloadextensionpath-options")

* `path` string - Path to a directory containing an unpacked Chrome extension
* `options` Object (optional)
+ `allowFileAccess` boolean - Whether to allow the extension to read local files over `file://`
protocol and inject content scripts into `file://` pages. This is required e.g. for loading
DevTools extensions on `file://` URLs. Defaults to false.

Returns `Promise<Extension>` - resolves when the extension is loaded.

This method will raise an exception if the extension could not be loaded. If
there are warnings when installing the extension (e.g. if the extension
requests an API that Electron does not support) then they will be logged to the
console.

Note that Electron does not support the full range of Chrome extensions APIs.
See [Supported Extensions APIs](/docs/latest/api/extensions#supported-extensions-apis) for
more details on what is supported.

Note that in previous versions of Electron, extensions that were loaded would
be remembered for future runs of the application. This is no longer the case:
`loadExtension` must be called on every boot of your app if you want the
extension to be loaded.

```
const { app, session } = require('electron')

const path = require('node:path')

app.whenReady().then(async () => {
await session.defaultSession.extensions.loadExtension(
path.join(__dirname, 'react-devtools'),
// allowFileAccess is required to load the DevTools extension on file:// URLs.
{ allowFileAccess: true }
)
// Note that in order to use the React DevTools extension, you'll need to
// download and unzip a copy of the extension.
})
```

This API does not support loading packed (.crx) extensions.

note

This API cannot be called before the `ready` event of the `app` module
is emitted.

note

Loading extensions into in-memory (non-persistent) sessions is not
supported and will throw an error.

#### `extensions.removeExtension(extensionId)`[â](#extensionsremoveextensionextensionid "Direct link to extensionsremoveextensionextensionid")

* `extensionId` string - ID of extension to remove

Unloads an extension.

note

This API cannot be called before the `ready` event of the `app` module
is emitted.

#### `extensions.getExtension(extensionId)`[â](#extensionsgetextensionextensionid "Direct link to extensionsgetextensionextensionid")

* `extensionId` string - ID of extension to query

Returns `Extension | null` - The loaded extension with the given ID.

note

This API cannot be called before the `ready` event of the `app` module
is emitted.

#### `extensions.getAllExtensions()`[â](#extensionsgetallextensions "Direct link to extensionsgetallextensions")

Returns `Extension[]` - A list of all loaded extensions.

note

This API cannot be called before the `ready` event of the `app` module
is emitted.

* [Class: Extensions](#class-extensions)
+ [Instance Events](#instance-events)
- [`'extension-loaded'`](#event-extension-loaded)- [`'extension-unloaded'`](#event-extension-unloaded)- [`'extension-ready'`](#event-extension-ready)+ [Instance Methods](#instance-methods)
- [`loadExtension`](#extensionsloadextensionpath-options)- [`removeExtension`](#extensionsremoveextensionextensionid)- [`getExtension`](#extensionsgetextensionextensionid)- [`getAllExtensions`](#extensionsgetallextensions)