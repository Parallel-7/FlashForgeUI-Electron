# Source: https://www.electronjs.org/docs/latest/api/ipc-renderer

On this page

History

|  |  |  |  |
| --- | --- | --- | --- |
| Version(s) Changes|  |  | | --- | --- | | ``` None ```   [`ipcRenderer` can no longer be sent over the `contextBridge`](/docs/latest/breaking-changes#behavior-changed-ipcrenderer-can-no-longer-be-sent-over-the-contextbridge) | | | |

> Communicate asynchronously from a renderer process to the main process.

Process: [Renderer](/docs/latest/glossary#renderer-process)

info

If you want to call this API from a renderer process with context isolation enabled,
place the API call in your preload script and
[expose](/docs/latest/tutorial/context-isolation#after-context-isolation-enabled) it using the
[`contextBridge`](/docs/latest/api/context-bridge) API.

The `ipcRenderer` module is an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter). It provides a few
methods so you can send synchronous and asynchronous messages from the render
process (web page) to the main process. You can also receive replies from the
main process.

See [IPC tutorial](/docs/latest/tutorial/ipc) for code examples.

## Methods[â](#methods "Direct link to Methods")

The `ipcRenderer` module has the following method to listen for events and send messages:

### `ipcRenderer.on(channel, listener)`[â](#ipcrendereronchannel-listener "Direct link to ipcrendereronchannel-listener")

* `channel` string
* `listener` Function
+ `event` [IpcRendererEvent](/docs/latest/api/structures/ipc-renderer-event)
+ `...args` any[]

Listens to `channel`, when a new message arrives `listener` would be called with
`listener(event, args...)`.

warning

Do not expose the `event` argument to the renderer for security reasons! Wrap any
callback that you receive from the renderer in another function like this:
`ipcRenderer.on('my-channel', (event, ...args) => callback(...args))`.
Not wrapping the callback in such a function would expose dangerous Electron APIs
to the renderer process. See the
[security guide](/docs/latest/tutorial/security#20-do-not-expose-electron-apis-to-untrusted-web-content)
for more info.

### `ipcRenderer.off(channel, listener)`[â](#ipcrendereroffchannel-listener "Direct link to ipcrendereroffchannel-listener")

* `channel` string
* `listener` Function
+ `event` [IpcRendererEvent](/docs/latest/api/structures/ipc-renderer-event)
+ `...args` any[]

Removes the specified `listener` from the listener array for the specified
`channel`.

### `ipcRenderer.once(channel, listener)`[â](#ipcrendereroncechannel-listener "Direct link to ipcrendereroncechannel-listener")

* `channel` string
* `listener` Function
+ `event` [IpcRendererEvent](/docs/latest/api/structures/ipc-renderer-event)
+ `...args` any[]

Adds a one time `listener` function for the event. This `listener` is invoked
only the next time a message is sent to `channel`, after which it is removed.

### `ipcRenderer.addListener(channel, listener)`[â](#ipcrendereraddlistenerchannel-listener "Direct link to ipcrendereraddlistenerchannel-listener")

* `channel` string
* `listener` Function
+ `event` [IpcRendererEvent](/docs/latest/api/structures/ipc-renderer-event)
+ `...args` any[]

Alias for [`ipcRenderer.on`](#ipcrendereronchannel-listener).

### `ipcRenderer.removeListener(channel, listener)`[â](#ipcrendererremovelistenerchannel-listener "Direct link to ipcrendererremovelistenerchannel-listener")

* `channel` string
* `listener` Function
+ `event` [IpcRendererEvent](/docs/latest/api/structures/ipc-renderer-event)
+ `...args` any[]

Alias for [`ipcRenderer.off`](#ipcrendereroffchannel-listener).

### `ipcRenderer.removeAllListeners([channel])`[â](#ipcrendererremovealllistenerschannel "Direct link to ipcrendererremovealllistenerschannel")

* `channel` string (optional)

Removes all listeners from the specified `channel`. Removes all listeners from all channels if no channel is specified.

### `ipcRenderer.send(channel, ...args)`[â](#ipcrenderersendchannel-args "Direct link to ipcrenderersendchannel-args")

* `channel` string
* `...args` any[]

Send an asynchronous message to the main process via `channel`, along with
arguments. Arguments will be serialized with the [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm),
just like [`window.postMessage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage), so prototype chains will not be
included. Sending Functions, Promises, Symbols, WeakMaps, or WeakSets will
throw an exception.

> **NOTE:** Sending non-standard JavaScript types such as DOM objects or
> special Electron objects will throw an exception.
>
> Since the main process does not have support for DOM objects such as
> `ImageBitmap`, `File`, `DOMMatrix` and so on, such objects cannot be sent over
> Electron's IPC to the main process, as the main process would have no way to decode
> them. Attempting to send such objects over IPC will result in an error.

The main process handles it by listening for `channel` with the
[`ipcMain`](/docs/latest/api/ipc-main) module.

If you need to transfer a [`MessagePort`](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort) to the main process, use [`ipcRenderer.postMessage`](#ipcrendererpostmessagechannel-message-transfer).

If you want to receive a single response from the main process, like the result of a method call, consider using [`ipcRenderer.invoke`](#ipcrendererinvokechannel-args).

### `ipcRenderer.invoke(channel, ...args)`[â](#ipcrendererinvokechannel-args "Direct link to ipcrendererinvokechannel-args")

* `channel` string
* `...args` any[]

Returns `Promise<any>` - Resolves with the response from the main process.

Send a message to the main process via `channel` and expect a result
asynchronously. Arguments will be serialized with the [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm),
just like [`window.postMessage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage), so prototype chains will not be
included. Sending Functions, Promises, Symbols, WeakMaps, or WeakSets will
throw an exception.

The main process should listen for `channel` with
[`ipcMain.handle()`](/docs/latest/api/ipc-main#ipcmainhandlechannel-listener).

For example:

```
// Renderer process
ipcRenderer.invoke('some-name', someArgument).then((result) => {
// ...
})

// Main process
ipcMain.handle('some-name', async (event, someArgument) => {
const result = await doSomeWork(someArgument)
return result
})
```

If you need to transfer a [`MessagePort`](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort) to the main process, use [`ipcRenderer.postMessage`](#ipcrendererpostmessagechannel-message-transfer).

If you do not need a response to the message, consider using [`ipcRenderer.send`](#ipcrenderersendchannel-args).

note

Sending non-standard JavaScript types such as DOM objects or
special Electron objects will throw an exception.

Since the main process does not have support for DOM objects such as
`ImageBitmap`, `File`, `DOMMatrix` and so on, such objects cannot be sent over
Electron's IPC to the main process, as the main process would have no way to decode
them. Attempting to send such objects over IPC will result in an error.

note

If the handler in the main process throws an error,
the promise returned by `invoke` will reject.
However, the `Error` object in the renderer process
will not be the same as the one thrown in the main process.

### `ipcRenderer.sendSync(channel, ...args)`[â](#ipcrenderersendsyncchannel-args "Direct link to ipcrenderersendsyncchannel-args")

* `channel` string
* `...args` any[]

Returns `any` - The value sent back by the [`ipcMain`](/docs/latest/api/ipc-main) handler.

Send a message to the main process via `channel` and expect a result
synchronously. Arguments will be serialized with the [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm),
just like [`window.postMessage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage), so prototype chains will not be
included. Sending Functions, Promises, Symbols, WeakMaps, or WeakSets will
throw an exception.

> **NOTE:** Sending non-standard JavaScript types such as DOM objects or
> special Electron objects will throw an exception.
>
> Since the main process does not have support for DOM objects such as
> `ImageBitmap`, `File`, `DOMMatrix` and so on, such objects cannot be sent over
> Electron's IPC to the main process, as the main process would have no way to decode
> them. Attempting to send such objects over IPC will result in an error.

The main process handles it by listening for `channel` with [`ipcMain`](/docs/latest/api/ipc-main) module,
and replies by setting `event.returnValue`.

warning

Sending a synchronous message will block the whole
renderer process until the reply is received, so use this method only as a
last resort. It's much better to use the asynchronous version,
[`invoke()`](/docs/latest/api/ipc-renderer#ipcrendererinvokechannel-args).

### `ipcRenderer.postMessage(channel, message, [transfer])`[â](#ipcrendererpostmessagechannel-message-transfer "Direct link to ipcrendererpostmessagechannel-message-transfer")

* `channel` string
* `message` any
* `transfer` MessagePort[] (optional)

Send a message to the main process, optionally transferring ownership of zero
or more [`MessagePort`](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort) objects.

The transferred `MessagePort` objects will be available in the main process as
[`MessagePortMain`](/docs/latest/api/message-port-main) objects by accessing the `ports`
property of the emitted event.

For example:

```
// Renderer process
const { port1, port2 } = new MessageChannel()
ipcRenderer.postMessage('port', { message: 'hello' }, [port1])

// Main process
ipcMain.on('port', (e, msg) => {
const [port] = e.ports
// ...
})
```

For more information on using `MessagePort` and `MessageChannel`, see the
[MDN documentation](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel).

### `ipcRenderer.sendToHost(channel, ...args)`[â](#ipcrenderersendtohostchannel-args "Direct link to ipcrenderersendtohostchannel-args")

* `channel` string
* `...args` any[]

Like `ipcRenderer.send` but the event will be sent to the `<webview>` element in
the host page instead of the main process.

* [Methods](#methods)
+ [`on`](#ipcrendereronchannel-listener)+ [`off`](#ipcrendereroffchannel-listener)+ [`once`](#ipcrendereroncechannel-listener)+ [`addListener`](#ipcrendereraddlistenerchannel-listener)+ [`removeListener`](#ipcrendererremovelistenerchannel-listener)+ [`removeAllListeners`](#ipcrendererremovealllistenerschannel)+ [`send`](#ipcrenderersendchannel-args)+ [`invoke`](#ipcrendererinvokechannel-args)+ [`sendSync`](#ipcrenderersendsyncchannel-args)+ [`postMessage`](#ipcrendererpostmessagechannel-message-transfer)+ [`sendToHost`](#ipcrenderersendtohostchannel-args)