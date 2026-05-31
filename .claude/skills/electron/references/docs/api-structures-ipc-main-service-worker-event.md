# Source: https://www.electronjs.org/docs/latest/api/structures/ipc-main-service-worker-event

* `type` String - Possible values include `service-worker`.
* `serviceWorker` [ServiceWorkerMain](/docs/latest/api/service-worker-main) *Readonly* - The service worker that sent this message
* `versionId` Number - The service worker version ID.
* `session` Session - The [`Session`](/docs/latest/api/session) instance with which the event is associated.
* `returnValue` any - Set this to the value to be returned in a synchronous message
* `ports` [MessagePortMain](/docs/latest/api/message-port-main)[] - A list of MessagePorts that were transferred with this message
* `reply` Function - A function that will send an IPC message to the renderer frame that sent the original message that you are currently handling. You should use this method to "reply" to the sent message in order to guarantee the reply will go to the correct process and frame.
+ `channel` string
+ `...args` any[]