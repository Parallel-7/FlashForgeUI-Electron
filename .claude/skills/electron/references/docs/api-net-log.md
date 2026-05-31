# Source: https://www.electronjs.org/docs/latest/api/net-log

On this page

> Logging network events for a session.

Process: [Main](/docs/latest/glossary#main-process)

```
const { app, netLog } = require('electron')

app.whenReady().then(async () => {
await netLog.startLogging('/path/to/net-log')
// After some network events
const path = await netLog.stopLogging()
console.log('Net-logs written to', path)
})
```

See [`--log-net-log`](/docs/latest/api/command-line-switches#--log-net-logpath) to log network events throughout the app's lifecycle.

note

All methods unless specified can only be used after the `ready` event
of the `app` module gets emitted.

## Methods[â](#methods "Direct link to Methods")

### `netLog.startLogging(path[, options])`[â](#netlogstartloggingpath-options "Direct link to netlogstartloggingpath-options")

* `path` string - File path to record network logs.
* `options` Object (optional)
+ `captureMode` string (optional) - What kinds of data should be captured. By
default, only metadata about requests will be captured. Setting this to
`includeSensitive` will include cookies and authentication data. Setting
it to `everything` will include all bytes transferred on sockets. Can be
`default`, `includeSensitive` or `everything`.
+ `maxFileSize` number (optional) - When the log grows beyond this size,
logging will automatically stop. Defaults to unlimited.

Returns `Promise<void>` - resolves when the net log has begun recording.

Starts recording network events to `path`.

### `netLog.stopLogging()`[â](#netlogstoplogging "Direct link to netlogstoplogging")

Returns `Promise<void>` - resolves when the net log has been flushed to disk.

Stops recording network events. If not called, net logging will automatically end when app quits.

## Properties[â](#properties "Direct link to Properties")

### `netLog.currentlyLogging` *Readonly*[â](#netlogcurrentlylogging-readonly "Direct link to netlogcurrentlylogging-readonly")

A `boolean` property that indicates whether network logs are currently being recorded.

* [Methods](#methods)
+ [`startLogging`](#netlogstartloggingpath-options)+ [`stopLogging`](#netlogstoplogging)* [Properties](#properties)
+ [`currentlyLogging`](#netlogcurrentlylogging-readonly)