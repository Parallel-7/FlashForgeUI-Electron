# Source: https://www.electronjs.org/docs/latest/api/auto-updater

On this page

> Enable apps to automatically update themselves.

Process: [Main](/docs/latest/glossary#main-process)

**See also: [A detailed guide about how to implement updates in your application](/docs/latest/tutorial/updates).**

`autoUpdater` is an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter).

## Platform Notices[â](#platform-notices "Direct link to Platform Notices")

Currently, only macOS and Windows are supported. There is no built-in support
for auto-updater on Linux, so it is recommended to use the
distribution's package manager to update your app.

In addition, there are some subtle differences on each platform:

### macOS[â](#macos "Direct link to macOS")

On macOS, the `autoUpdater` module is built upon [Squirrel.Mac](https://github.com/Squirrel/Squirrel.Mac),
meaning you don't need any special setup to make it work. For server-side
requirements, you can read [Server Support](https://github.com/Squirrel/Squirrel.Mac#server-support). Note that
[App Transport Security](https://developer.apple.com/library/content/documentation/General/Reference/InfoPlistKeyReference/Articles/CocoaKeys.html#//apple_ref/doc/uid/TP40009251-SW35)
(ATS) applies to all requests made as part of the
update process. Apps that need to disable ATS can add the
`NSAllowsArbitraryLoads` key to their app's plist.

info

Your application must be signed for automatic updates on macOS.
This is a requirement of `Squirrel.Mac`.

### Windows[â](#windows "Direct link to Windows")

On Windows, you have to install your app into a user's machine before you can
use the `autoUpdater`, so it is recommended that you use
[electron-winstaller](https://github.com/electron/windows-installer) or [Electron Forge's Squirrel.Windows maker](https://www.electronforge.io/config/makers/squirrel.windows) to generate a Windows installer.

Apps built with Squirrel.Windows will trigger [custom launch events](https://github.com/Squirrel/Squirrel.Windows/blob/51f5e2cb01add79280a53d51e8d0cfa20f8c9f9f/docs/using/custom-squirrel-events-non-cs.md#application-startup-commands)
that must be handled by your Electron application to ensure proper setup and teardown.

Squirrel.Windows apps will launch with the `--squirrel-firstrun` argument immediately
after installation. During this time, Squirrel.Windows will obtain a file lock on
your app, and `autoUpdater` requests will fail until the lock is released. In practice,
this means that you won't be able to check for updates on first launch for the first
few seconds. You can work around this by not checking for updates when `process.argv`
contains the `--squirrel-firstrun` flag or by setting a 10-second timeout on your
update checks (see [electron/electron#7155](https://github.com/electron/electron/issues/7155)
for more information).

The installer generated with Squirrel.Windows will create a shortcut icon with an
[Application User Model ID](https://learn.microsoft.com/en-us/windows/win32/shell/appids) in the format of
`com.squirrel.PACKAGE_ID.YOUR_EXE_WITHOUT_DOT_EXE`, examples are
`com.squirrel.slack.Slack` and `com.squirrel.code.Code`. You have to use the
same ID for your app with `app.setAppUserModelId` API, otherwise Windows will
not be able to pin your app properly in task bar.

## Events[â](#events "Direct link to Events")

The `autoUpdater` object emits the following events:

### Event: 'error'[â](#event-error "Direct link to Event: 'error'")

Returns:

* `error` Error

Emitted when there is an error while updating.

### Event: 'checking-for-update'[â](#event-checking-for-update "Direct link to Event: 'checking-for-update'")

Emitted when checking for an available update has started.

### Event: 'update-available'[â](#event-update-available "Direct link to Event: 'update-available'")

Emitted when there is an available update. The update is downloaded
automatically.

### Event: 'update-not-available'[â](#event-update-not-available "Direct link to Event: 'update-not-available'")

Emitted when there is no available update.

### Event: 'update-downloaded'[â](#event-update-downloaded "Direct link to Event: 'update-downloaded'")

Returns:

* `event` Event
* `releaseNotes` string
* `releaseName` string
* `releaseDate` Date
* `updateURL` string

Emitted when an update has been downloaded.

On Windows only `releaseName` is available.

note

It is not strictly necessary to handle this event. A successfully
downloaded update will still be applied the next time the application starts.

### Event: 'before-quit-for-update'[â](#event-before-quit-for-update "Direct link to Event: 'before-quit-for-update'")

This event is emitted after a user calls `quitAndInstall()`.

When this API is called, the `before-quit` event is not emitted before all windows are closed. As a result you should listen to this event if you wish to perform actions before the windows are closed while a process is quitting, as well as listening to `before-quit`.

## Methods[â](#methods "Direct link to Methods")

The `autoUpdater` object has the following methods:

### `autoUpdater.setFeedURL(options)`[â](#autoupdatersetfeedurloptions "Direct link to autoupdatersetfeedurloptions")

* `options` Object
+ `url` string
+ `headers` Record<string, string> (optional) *macOS* - HTTP request headers.
+ `serverType` string (optional) *macOS* - Can be `json` or `default`, see the [Squirrel.Mac](https://github.com/Squirrel/Squirrel.Mac)
README for more information.

Sets the `url` and initialize the auto updater.

### `autoUpdater.getFeedURL()`[â](#autoupdatergetfeedurl "Direct link to autoupdatergetfeedurl")

Returns `string` - The current update feed URL.

### `autoUpdater.checkForUpdates()`[â](#autoupdatercheckforupdates "Direct link to autoupdatercheckforupdates")

Asks the server whether there is an update. You must call `setFeedURL` before
using this API.

note

If an update is available it will be downloaded automatically.
Calling `autoUpdater.checkForUpdates()` twice will download the update two times.

### `autoUpdater.quitAndInstall()`[â](#autoupdaterquitandinstall "Direct link to autoupdaterquitandinstall")

Restarts the app and installs the update after it has been downloaded. It
should only be called after `update-downloaded` has been emitted.

Under the hood calling `autoUpdater.quitAndInstall()` will close all application
windows first, and automatically call `app.quit()` after all windows have been
closed.

note

It is not strictly necessary to call this function to apply an update,
as a successfully downloaded update will always be applied the next time the
application starts.

* [Platform Notices](#platform-notices)
+ [macOS](#macos)+ [Windows](#windows)* [Events](#events)
+ [`'error'`](#event-error)+ [`'checking-for-update'`](#event-checking-for-update)+ [`'update-available'`](#event-update-available)+ [`'update-not-available'`](#event-update-not-available)+ [`'update-downloaded'`](#event-update-downloaded)+ [`'before-quit-for-update'`](#event-before-quit-for-update)* [Methods](#methods)
+ [`setFeedURL`](#autoupdatersetfeedurloptions)+ [`getFeedURL`](#autoupdatergetfeedurl)+ [`checkForUpdates`](#autoupdatercheckforupdates)+ [`quitAndInstall`](#autoupdaterquitandinstall)