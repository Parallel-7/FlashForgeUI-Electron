# Source: https://www.electronjs.org/docs/latest/api/message-channel-main

On this page

`MessageChannelMain` is the main-process-side equivalent of the DOM
[`MessageChannel`](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel) object. Its singular function is to create a pair of
connected [`MessagePortMain`](/docs/latest/api/message-port-main) objects.

See the [Channel Messaging API](https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API) documentation for more information on using
channel messaging.

## Class: MessageChannelMain[â](#class-messagechannelmain "Direct link to Class: MessageChannelMain")

> Channel interface for channel messaging in the main process.

Process: [Main](/docs/latest/glossary#main-process)

Example:

```
// Main process
const { BrowserWindow, MessageChannelMain } = require('electron')

const w = new BrowserWindow()
const { port1, port2 } = new MessageChannelMain()
w.webContents.postMessage('port', null, [port2])
port1.postMessage({ some: 'message' })

// Renderer process
const { ipcRenderer } = require('electron')

ipcRenderer.on('port', (e) => {
// e.ports is a list of ports sent along with this message
e.ports[0].onmessage = (messageEvent) => {
console.log(messageEvent.data)
}
})
```

warning

Electron's built-in classes cannot be subclassed in user code.
For more information, see [the FAQ](/docs/latest/faq#class-inheritance-does-not-work-with-electron-built-in-modules).

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

#### `channel.port1`[â](#channelport1 "Direct link to channelport1")

A [`MessagePortMain`](/docs/latest/api/message-port-main) property.

#### `channel.port2`[â](#channelport2 "Direct link to channelport2")

A [`MessagePortMain`](/docs/latest/api/message-port-main) property.

* [Class: MessageChannelMain](#class-messagechannelmain)
+ [Instance Properties](#instance-properties)
- [`port1`](#channelport1)- [`port2`](#channelport2)