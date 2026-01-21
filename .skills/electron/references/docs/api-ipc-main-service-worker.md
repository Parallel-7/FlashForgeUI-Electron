# Source: https://www.electronjs.org/docs/latest/api/ipc-main-service-worker

On this page

## Class: IpcMainServiceWorker[â](#class-ipcmainserviceworker "Direct link to Class: IpcMainServiceWorker")

> Communicate asynchronously from the main process to service workers.

Process: [Main](/docs/latest/glossary#main-process)

note

This API is a subtle variation of [`IpcMain`](/docs/latest/api/ipc-main)âtargeted for
communicating with service workers. For communicating with web frames,
consult the `IpcMain` documentation.

warning

Electron's built-in classes cannot be subclassed in user code.
For more information, see [the FAQ](/docs/latest/faq#class-inheritance-does-not-work-with-electron-built-in-modules).

### Instance Methods[â](#instance-methods "Direct link to Instance Methods")

#### `ipcMainServiceWorker.on(channel, listener)`[â](#ipcmainserviceworkeronchannel-listener "Direct link to ipcmainserviceworkeronchannel-listener")

* `channel` string
* `listener` Function
+ `event` [IpcMainServiceWorkerEvent](/docs/latest/api/structures/ipc-main-service-worker-event)
+ `...args` any[]

Listens to `channel`, when a new message arrives `listener` would be called with
`listener(event, args...)`.

#### `ipcMainServiceWorker.once(channel, listener)`[â](#ipcmainserviceworkeroncechannel-listener "Direct link to ipcmainserviceworkeroncechannel-listener")

* `channel` string
* `listener` Function
+ `event` [IpcMainServiceWorkerEvent](/docs/latest/api/structures/ipc-main-service-worker-event)
+ `...args` any[]

Adds a one time `listener` function for the event. This `listener` is invoked
only the next time a message is sent to `channel`, after which it is removed.

#### `ipcMainServiceWorker.removeListener(channel, listener)`[â](#ipcmainserviceworkerremovelistenerchannel-listener "Direct link to ipcmainserviceworkerremovelistenerchannel-listener")

* `channel` string
* `listener` Function
+ `...args` any[]

Removes the specified `listener` from the listener array for the specified
`channel`.

#### `ipcMainServiceWorker.removeAllListeners([channel])`[â](#ipcmainserviceworkerremovealllistenerschannel "Direct link to ipcmainserviceworkerremovealllistenerschannel")

* `channel` string (optional)

Removes listeners of the specified `channel`.

#### `ipcMainServiceWorker.handle(channel, listener)`[â](#ipcmainserviceworkerhandlechannel-listener "Direct link to ipcmainserviceworkerhandlechannel-listener")

* `channel` string
* `listener` Function<Promise<any> | any>
+ `event` [IpcMainServiceWorkerInvokeEvent](/docs/latest/api/structures/ipc-main-service-worker-invoke-event)
+ `...args` any[]

#### `ipcMainServiceWorker.handleOnce(channel, listener)`[â](#ipcmainserviceworkerhandleoncechannel-listener "Direct link to ipcmainserviceworkerhandleoncechannel-listener")

* `channel` string
* `listener` Function<Promise<any> | any>
+ `event` [IpcMainServiceWorkerInvokeEvent](/docs/latest/api/structures/ipc-main-service-worker-invoke-event)
+ `...args` any[]

Handles a single `invoke`able IPC message, then removes the listener. See
`ipcMainServiceWorker.handle(channel, listener)`.

#### `ipcMainServiceWorker.removeHandler(channel)`[â](#ipcmainserviceworkerremovehandlerchannel "Direct link to ipcmainserviceworkerremovehandlerchannel")

* `channel` string

Removes any handler for `channel`, if present.

* [Class: IpcMainServiceWorker](#class-ipcmainserviceworker)
+ [Instance Methods](#instance-methods)
- [`on`](#ipcmainserviceworkeronchannel-listener)- [`once`](#ipcmainserviceworkeroncechannel-listener)- [`removeListener`](#ipcmainserviceworkerremovelistenerchannel-listener)- [`removeAllListeners`](#ipcmainserviceworkerremovealllistenerschannel)- [`handle`](#ipcmainserviceworkerhandlechannel-listener)- [`handleOnce`](#ipcmainserviceworkerhandleoncechannel-listener)- [`removeHandler`](#ipcmainserviceworkerremovehandlerchannel)