# Source: https://www.electronjs.org/docs/latest/api/utility-process

On this page

`utilityProcess` creates a child process with
Node.js and Message ports enabled. It provides the equivalent of [`child_process.fork`](https://nodejs.org/dist/latest-v16.x/docs/api/child_process.html#child_processforkmodulepath-args-options) API from Node.js
but instead uses [Services API](https://chromium.googlesource.com/chromium/src/+/main/docs/mojo_and_services.md) from Chromium to launch the child process.

Process: [Main](/docs/latest/glossary#main-process)

## Methods[â](#methods "Direct link to Methods")

### `utilityProcess.fork(modulePath[, args][, options])`[â](#utilityprocessforkmodulepath-args-options "Direct link to utilityprocessforkmodulepath-args-options")

* `modulePath` string - Path to the script that should run as entrypoint in the child process.
* `args` string[] (optional) - List of string arguments that will be available as `process.argv`
in the child process.
* `options` Object (optional)
+ `env` Object (optional) - Environment key-value pairs. Default is `process.env`.
+ `execArgv` string[] (optional) - List of string arguments passed to the executable.
+ `cwd` string (optional) - Current working directory of the child process.
+ `stdio` (string[] | string) (optional) - Allows configuring the mode for `stdout` and `stderr`
of the child process. Default is `inherit`.
String value can be one of `pipe`, `ignore`, `inherit`, for more details on these values you can refer to
[stdio](https://nodejs.org/dist/latest/docs/api/child_process.html#optionsstdio) documentation from Node.js. Currently this option only supports configuring `stdout` and
`stderr` to either `pipe`, `inherit` or `ignore`. Configuring `stdin` to any property other than `ignore` is not supported and will result in an error.
For example, the supported values will be processed as following:
- `pipe`: equivalent to ['ignore', 'pipe', 'pipe']
- `ignore`: equivalent to ['ignore', 'ignore', 'ignore']
- `inherit`: equivalent to ['ignore', 'inherit', 'inherit'] (the default)
+ `serviceName` string (optional) - Name of the process that will appear in `name` property of
[ProcessMetric](/docs/latest/api/structures/process-metric) returned by [`app.getAppMetrics`](/docs/latest/api/app#appgetappmetrics)
and [`child-process-gone` event of `app`](/docs/latest/api/app#event-child-process-gone).
Default is `Node Utility Process`.
+ `allowLoadingUnsignedLibraries` boolean (optional) *macOS* - With this flag, the utility process will be
launched via the `Electron Helper (Plugin).app` helper executable on macOS, which can be
codesigned with `com.apple.security.cs.disable-library-validation` and
`com.apple.security.cs.allow-unsigned-executable-memory` entitlements. This will allow the utility process
to load unsigned libraries. Unless you specifically need this capability, it is best to leave this disabled.
Default is `false`.
+ `respondToAuthRequestsFromMainProcess` boolean (optional) - With this flag, all HTTP 401 and 407 network
requests created via the [net module](/docs/latest/api/net) will allow responding to them via the
[`app#login`](/docs/latest/api/app#event-login) event in the main process instead of the default
[`login`](/docs/latest/api/client-request#event-login) event on the [`ClientRequest`](/docs/latest/api/client-request) object. Default is
`false`.

Returns [`UtilityProcess`](/docs/latest/api/utility-process#class-utilityprocess)

note

`utilityProcess.fork` can only be called after the `ready` event has been emitted on `App`.

## Class: UtilityProcess[â](#class-utilityprocess "Direct link to Class: UtilityProcess")

> Instances of the `UtilityProcess` represent the Chromium spawned child process
> with Node.js integration.

`UtilityProcess` is an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter).

### Instance Methods[â](#instance-methods "Direct link to Instance Methods")

#### `child.postMessage(message, [transfer])`[â](#childpostmessagemessage-transfer "Direct link to childpostmessagemessage-transfer")

* `message` any
* `transfer` MessagePortMain[] (optional)

Send a message to the child process, optionally transferring ownership of
zero or more [`MessagePortMain`](/docs/latest/api/message-port-main) objects.

For example:

```
// Main process
const { port1, port2 } = new MessageChannelMain()
const child = utilityProcess.fork(path.join(__dirname, 'test.js'))
child.postMessage({ message: 'hello' }, [port1])

// Child process
process.parentPort.once('message', (e) => {
const [port] = e.ports
// ...
})
```

#### `child.kill()`[â](#childkill "Direct link to childkill")

Returns `boolean`

Terminates the process gracefully. On POSIX, it uses SIGTERM
but will ensure the process is reaped on exit. This function returns
true if the kill is successful, and false otherwise.

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

#### `child.pid`[â](#childpid "Direct link to childpid")

A `Integer | undefined` representing the process identifier (PID) of the child process.
Until the child process has spawned successfully, the value is `undefined`. When
the child process exits, then the value is `undefined` after the `exit` event is emitted.

```
const child = utilityProcess.fork(path.join(__dirname, 'test.js'))

console.log(child.pid) // undefined

child.on('spawn', () => {
console.log(child.pid) // Integer
})

child.on('exit', () => {
console.log(child.pid) // undefined
})
```

note

You can use the `pid` to determine if the process is currently running.

#### `child.stdout`[â](#childstdout "Direct link to childstdout")

A `NodeJS.ReadableStream | null` that represents the child process's stdout.
If the child was spawned with options.stdio[1] set to anything other than 'pipe', then this will be `null`.
When the child process exits, then the value is `null` after the `exit` event is emitted.

```
// Main process
const { port1, port2 } = new MessageChannelMain()
const child = utilityProcess.fork(path.join(__dirname, 'test.js'))
child.stdout.on('data', (data) => {
console.log(`Received chunk ${data}`)
})
```

#### `child.stderr`[â](#childstderr "Direct link to childstderr")

A `NodeJS.ReadableStream | null` that represents the child process's stderr.
If the child was spawned with options.stdio[2] set to anything other than 'pipe', then this will be `null`.
When the child process exits, then the value is `null` after the `exit` event is emitted.

### Instance Events[â](#instance-events "Direct link to Instance Events")

#### Event: 'spawn'[â](#event-spawn "Direct link to Event: 'spawn'")

Emitted once the child process has spawned successfully.

#### Event: 'error' *Experimental*[â](#event-error-experimental "Direct link to event-error-experimental")

Returns:

* `type` string - Type of error. One of the following values:
+ `FatalError`
* `location` string - Source location from where the error originated.
* `report` string - [`Node.js diagnostic report`](https://nodejs.org/docs/latest/api/report.html#diagnostic-report).

Emitted when the child process needs to terminate due to non continuable error from V8.

No matter if you listen to the `error` event, the `exit` event will be emitted after the
child process terminates.

#### Event: 'exit'[â](#event-exit "Direct link to Event: 'exit'")

Returns:

* `code` number - Contains the exit code for
the process obtained from waitpid on POSIX, or GetExitCodeProcess on Windows.

Emitted after the child process ends.

#### Event: 'message'[â](#event-message "Direct link to Event: 'message'")

Returns:

* `message` any

Emitted when the child process sends a message using [`process.parentPort.postMessage()`](/docs/latest/api/process#processparentport).

* [Methods](#methods)
+ [`fork`](#utilityprocessforkmodulepath-args-options)* [Class: UtilityProcess](#class-utilityprocess)
+ [Instance Methods](#instance-methods)
- [`postMessage`](#childpostmessagemessage-transfer)- [`kill`](#childkill)+ [Instance Properties](#instance-properties)
- [`pid`](#childpid)- [`stdout`](#childstdout)- [`stderr`](#childstderr)+ [Instance Events](#instance-events)
- [`'spawn'`](#event-spawn)- [`'error'`](#event-error-experimental)- [`'exit'`](#event-exit)- [`'message'`](#event-message)