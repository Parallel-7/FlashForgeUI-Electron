# Source: https://www.electronjs.org/docs/latest/api/structures/ipc-main-service-worker-invoke-event

* `type` String - Possible values include `service-worker`.
* `serviceWorker` [ServiceWorkerMain](/docs/latest/api/service-worker-main) *Readonly* - The service worker that sent this message
* `versionId` Number - The service worker version ID.
* `session` Session - The [`Session`](/docs/latest/api/session) instance with which the event is associated.