# Source: https://www.electronjs.org/docs/latest/api/notification

On this page

> Create OS desktop notifications

Process: [Main](/docs/latest/glossary#main-process)

note

If you want to show notifications from a renderer process you should use the
[web Notifications API](/docs/latest/tutorial/notifications)

## Class: Notification[â](#class-notification "Direct link to Class: Notification")

> Create OS desktop notifications

Process: [Main](/docs/latest/glossary#main-process)

`Notification` is an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter).

It creates a new `Notification` with native properties as set by the `options`.

warning

Electron's built-in classes cannot be subclassed in user code.
For more information, see [the FAQ](/docs/latest/faq#class-inheritance-does-not-work-with-electron-built-in-modules).

### Static Methods[â](#static-methods "Direct link to Static Methods")

The `Notification` class has the following static methods:

#### `Notification.isSupported()`[â](#notificationissupported "Direct link to notificationissupported")

Returns `boolean` - Whether or not desktop notifications are supported on the current system

### `new Notification([options])`[â](#new-notificationoptions "Direct link to new-notificationoptions")

* `options` Object (optional)
+ `title` string (optional) - A title for the notification, which will be displayed at the top of the notification window when it is shown.
+ `subtitle` string (optional) *macOS* - A subtitle for the notification, which will be displayed below the title.
+ `body` string (optional) - The body text of the notification, which will be displayed below the title or subtitle.
+ `silent` boolean (optional) - Whether or not to suppress the OS notification noise when showing the notification.
+ `icon` (string | [NativeImage](/docs/latest/api/native-image)) (optional) - An icon to use in the notification. If a string is passed, it must be a valid path to a local icon file.
+ `hasReply` boolean (optional) *macOS* - Whether or not to add an inline reply option to the notification.
+ `timeoutType` string (optional) *Linux* *Windows* - The timeout duration of the notification. Can be 'default' or 'never'.
+ `replyPlaceholder` string (optional) *macOS* - The placeholder to write in the inline reply input field.
+ `sound` string (optional) *macOS* - The name of the sound file to play when the notification is shown.
+ `urgency` string (optional) *Linux* - The urgency level of the notification. Can be 'normal', 'critical', or 'low'.
+ `actions` [NotificationAction[]](/docs/latest/api/structures/notification-action) (optional) *macOS* - Actions to add to the notification. Please read the available actions and limitations in the `NotificationAction` documentation.
+ `closeButtonText` string (optional) *macOS* - A custom title for the close button of an alert. An empty string will cause the default localized text to be used.
+ `toastXml` string (optional) *Windows* - A custom description of the Notification on Windows superseding all properties above. Provides full customization of design and behavior of the notification.

### Instance Events[â](#instance-events "Direct link to Instance Events")

Objects created with `new Notification` emit the following events:

info

Some events are only available on specific operating systems and are labeled as such.

#### Event: 'show'[â](#event-show "Direct link to Event: 'show'")

Returns:

* `event` Event

Emitted when the notification is shown to the user. Note that this event can be fired
multiple times as a notification can be shown multiple times through the
`show()` method.

#### Event: 'click'[â](#event-click "Direct link to Event: 'click'")

Returns:

* `event` Event

Emitted when the notification is clicked by the user.

#### Event: 'close'[â](#event-close "Direct link to Event: 'close'")

Returns:

* `event` Event

Emitted when the notification is closed by manual intervention from the user.

This event is not guaranteed to be emitted in all cases where the notification
is closed.

On Windows, the `close` event can be emitted in one of three ways: programmatic dismissal with `notification.close()`, by the user closing the notification, or via system timeout. If a notification is in the Action Center after the initial `close` event is emitted, a call to `notification.close()` will remove the notification from the action center but the `close` event will not be emitted again.

#### Event: 'reply' *macOS*[â](#event-reply-macos "Direct link to event-reply-macos")

Returns:

* `event` Event
* `reply` string - The string the user entered into the inline reply field.

Emitted when the user clicks the "Reply" button on a notification with `hasReply: true`.

#### Event: 'action' *macOS*[â](#event-action-macos "Direct link to event-action-macos")

Returns:

* `event` Event
* `index` number - The index of the action that was activated.

#### Event: 'failed' *Windows*[â](#event-failed-windows "Direct link to event-failed-windows")

Returns:

* `event` Event
* `error` string - The error encountered during execution of the `show()` method.

Emitted when an error is encountered while creating and showing the native notification.

### Instance Methods[â](#instance-methods "Direct link to Instance Methods")

Objects created with the `new Notification()` constructor have the following instance methods:

#### `notification.show()`[â](#notificationshow "Direct link to notificationshow")

Immediately shows the notification to the user. Unlike the web notification API,
instantiating a `new Notification()` does not immediately show it to the user. Instead, you need to
call this method before the OS will display it.

If the notification has been shown before, this method will dismiss the previously
shown notification and create a new one with identical properties.

#### `notification.close()`[â](#notificationclose "Direct link to notificationclose")

Dismisses the notification.

On Windows, calling `notification.close()` while the notification is visible on screen will dismiss the notification and remove it from the Action Center. If `notification.close()` is called after the notification is no longer visible on screen, calling `notification.close()` will try remove it from the Action Center.

### Instance Properties[â](#instance-properties "Direct link to Instance Properties")

#### `notification.title`[â](#notificationtitle "Direct link to notificationtitle")

A `string` property representing the title of the notification.

#### `notification.subtitle`[â](#notificationsubtitle "Direct link to notificationsubtitle")

A `string` property representing the subtitle of the notification.

#### `notification.body`[â](#notificationbody "Direct link to notificationbody")

A `string` property representing the body of the notification.

#### `notification.replyPlaceholder`[â](#notificationreplyplaceholder "Direct link to notificationreplyplaceholder")

A `string` property representing the reply placeholder of the notification.

#### `notification.sound`[â](#notificationsound "Direct link to notificationsound")

A `string` property representing the sound of the notification.

#### `notification.closeButtonText`[â](#notificationclosebuttontext "Direct link to notificationclosebuttontext")

A `string` property representing the close button text of the notification.

#### `notification.silent`[â](#notificationsilent "Direct link to notificationsilent")

A `boolean` property representing whether the notification is silent.

#### `notification.hasReply`[â](#notificationhasreply "Direct link to notificationhasreply")

A `boolean` property representing whether the notification has a reply action.

#### `notification.urgency` *Linux*[â](#notificationurgency-linux "Direct link to notificationurgency-linux")

A `string` property representing the urgency level of the notification. Can be 'normal', 'critical', or 'low'.

Default is 'low' - see [NotifyUrgency](https://developer-old.gnome.org/notification-spec/#urgency-levels) for more information.

#### `notification.timeoutType` *Linux* *Windows*[â](#notificationtimeouttype-linux-windows "Direct link to notificationtimeouttype-linux-windows")

A `string` property representing the type of timeout duration for the notification. Can be 'default' or 'never'.

If `timeoutType` is set to 'never', the notification never expires. It stays open until closed by the calling API or the user.

#### `notification.actions`[â](#notificationactions "Direct link to notificationactions")

A [NotificationAction[]](/docs/latest/api/structures/notification-action) property representing the actions of the notification.

#### `notification.toastXml` *Windows*[â](#notificationtoastxml-windows "Direct link to notificationtoastxml-windows")

A `string` property representing the custom Toast XML of the notification.

### Playing Sounds[â](#playing-sounds "Direct link to Playing Sounds")

On macOS, you can specify the name of the sound you'd like to play when the
notification is shown. Any of the default sounds (under System Preferences >
Sound) can be used, in addition to custom sound files. Be sure that the sound
file is copied under the app bundle (e.g., `YourApp.app/Contents/Resources`),
or one of the following locations:

* `~/Library/Sounds`
* `/Library/Sounds`
* `/Network/Library/Sounds`
* `/System/Library/Sounds`

See the [`NSSound`](https://developer.apple.com/documentation/appkit/nssound) docs for more information.

* [Class: Notification](#class-notification)
+ [Static Methods](#static-methods)
- [`isSupported`](#notificationissupported)+ [`new Notification([options])`](#new-notificationoptions)+ [Instance Events](#instance-events)
- [`'show'`](#event-show)- [`'click'`](#event-click)- [`'close'`](#event-close)- [`'reply'`](#event-reply-macos)- [`'action'`](#event-action-macos)- [`'failed'`](#event-failed-windows)+ [Instance Methods](#instance-methods)
- [`show`](#notificationshow)- [`close`](#notificationclose)+ [Instance Properties](#instance-properties)
- [`title`](#notificationtitle)- [`subtitle`](#notificationsubtitle)- [`body`](#notificationbody)- [`replyPlaceholder`](#notificationreplyplaceholder)- [`sound`](#notificationsound)- [`closeButtonText`](#notificationclosebuttontext)- [`silent`](#notificationsilent)- [`hasReply`](#notificationhasreply)- [`urgency`](#notificationurgency-linux)- [`timeoutType`](#notificationtimeouttype-linux-windows)- [`actions`](#notificationactions)- [`toastXml`](#notificationtoastxml-windows)+ [Playing Sounds](#playing-sounds)