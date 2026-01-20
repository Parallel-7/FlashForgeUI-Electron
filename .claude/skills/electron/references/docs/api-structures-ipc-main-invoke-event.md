# Source: https://www.electronjs.org/docs/latest/api/structures/ipc-main-invoke-event

* `type` String - Possible values include `frame`
* `processId` Integer - The internal ID of the renderer process that sent this message
* `frameId` Integer - The ID of the renderer frame that sent this message
* `sender` [WebContents](/docs/latest/api/web-contents) - Returns the `webContents` that sent the message
* `senderFrame` [WebFrameMain](/docs/latest/api/web-frame-main) | null *Readonly* - The frame that sent this message. May be `null` if accessed after the frame has either navigated or been destroyed.