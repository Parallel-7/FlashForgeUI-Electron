# Source: https://www.electronjs.org/docs/latest/api/parent-port

On this page

> Interface for communication with parent process.

Process: [Utility](/docs/latest/glossary#utility-process)

`parentPort` is an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter).
*This object is not exported from the `'electron'` module. It is only available as a property of the process object in the Electron API.*

```
// Main process
const child = utilityProcess.fork(path.join(__dirname, 'test.js'))
child.postMessage({ message: 'hello' })
child.on('message', (data) => {
console.log(data) // hello world!
})

// Child process
process.parentPort.on('message', (e) => {
process.parentPort.postMessage(`${e.data} world!`)
})
```

## Events[â](#events "Direct link to Events")

The `parentPort` object emits the following events:

### Event: 'message'[â](#event-message "Direct link to Event: 'message'")

Returns:

* `messageEvent` Object
+ `data` any
+ `ports` MessagePortMain[]

Emitted when the process receives a message. Messages received on
this port will be queued up until a handler is registered for this
event.

## Methods[â](#methods "Direct link to Methods")

### `parentPort.postMessage(message)`[â](#parentportpostmessagemessage "Direct link to parentportpostmessagemessage")

* `message` any

Sends a message from the process to its parent.

* [Events](#events)
+ [`'message'`](#event-message)* [Methods](#methods)
+ [`postMessage`](#parentportpostmessagemessage)