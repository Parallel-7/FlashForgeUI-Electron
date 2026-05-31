# Source: https://www.electronjs.org/docs/latest/tutorial/window-customization

TheÂ [`BrowserWindow`](/docs/latest/api/browser-window)Â module is the foundation of your Electron application, and
it exposes many APIs that let you customize the look and behavior of your appâs windows.
This section covers how to implement various use cases for window customization on macOS,
Windows, and Linux.

note

`BrowserWindow` is a subclass of the [`BaseWindow`](/docs/latest/api/base-window) module. Both modules allow
you to create and manage application windows in Electron, with the main difference
being that `BrowserWindow` supports a single, full size web view while `BaseWindow`
supports composing many web views. `BaseWindow` can be used interchangeably with `BrowserWindow`
in the examples of the documents in this section.

[## ðï¸ Custom Title Bar

Application windows have a default chrome applied by the OS. Not to be confused with the Google Chrome browser, windowÂ \_chrome\_Â refers to the parts of the window (e.g. title bar, toolbars, controls) that are not a part of the main web content. While the default title bar provided by the OS chrome is sufficient for simple use cases, many applications opt to remove it. Implementing a custom title bar can help your application feel more modern and consistent across platforms.](/docs/latest/tutorial/custom-title-bar)

[## ðï¸ Custom Window Interactions

By default, windows are dragged using the title bar provided by the OS chrome. Apps that remove the default title bar need to use the app-region CSS property to define specific areas that can be used to drag the window. Setting app-region: drag marks a rectagular area as draggable.](/docs/latest/tutorial/custom-window-interactions)

[## ðï¸ Custom Window Styles

!Frameless Window](/docs/latest/tutorial/custom-window-styles)