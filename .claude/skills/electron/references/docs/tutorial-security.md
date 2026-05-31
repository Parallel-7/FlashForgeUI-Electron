# Source: https://www.electronjs.org/docs/latest/tutorial/security

On this page

Reporting security issues

For information on how to properly disclose an Electron vulnerability,
see [SECURITY.md](https://github.com/electron/electron/blob/main/SECURITY.md).

For upstream Chromium vulnerabilities: Electron keeps up to date with alternating
Chromium releases. For more information, see the
[Electron Release Timelines](/docs/latest/tutorial/electron-timelines) document.

## Preface[â](#preface "Direct link to Preface")

As web developers, we usually enjoy the strong security net of the browser â
the risks associated with the code we write are relatively small. Our websites
are granted limited powers in a sandbox, and we trust that our users enjoy a
browser built by a large team of engineers that is able to quickly respond to
newly discovered security threats.

When working with Electron, it is important to understand that Electron is not
a web browser. It allows you to build feature-rich desktop applications with
familiar web technologies, but your code wields much greater power. JavaScript
can access the filesystem, user shell, and more. This allows you to build
high quality native applications, but the inherent security risks scale with
the additional powers granted to your code.

With that in mind, be aware that displaying arbitrary content from untrusted
sources poses a severe security risk that Electron is not intended to handle.
In fact, the most popular Electron apps (Atom, Slack, Visual Studio Code, etc)
display primarily local content (or trusted, secure remote content without Node
integration) â if your application executes code from an online source, it is
your responsibility to ensure that the code is not malicious.

## General guidelines[â](#general-guidelines "Direct link to General guidelines")

### Security is everyone's responsibility[â](#security-is-everyones-responsibility "Direct link to Security is everyone's responsibility")

It is important to remember that the security of your Electron application is
the result of the overall security of the framework foundation
(*Chromium*, *Node.js*), Electron itself, all NPM dependencies and
your code. As such, it is your responsibility to follow a few important best
practices:

* **Keep your application up-to-date with the latest Electron framework release.**
When releasing your product, youâre also shipping a bundle composed of Electron,
Chromium shared library and Node.js. Vulnerabilities affecting these components
may impact the security of your application. By updating Electron to the latest
version, you ensure that critical vulnerabilities (such as *nodeIntegration bypasses*)
are already patched and cannot be exploited in your application. For more information,
see "[Use a current version of Electron](#16-use-a-current-version-of-electron)".
* **Evaluate your dependencies.** While NPM provides half a million reusable packages,
it is your responsibility to choose trusted 3rd-party libraries. If you use outdated
libraries affected by known vulnerabilities or rely on poorly maintained code,
your application security could be in jeopardy.
* **Adopt secure coding practices.** The first line of defense for your application
is your own code. Common web vulnerabilities, such as Cross-Site Scripting (XSS),
have a higher security impact on Electron applications hence it is highly recommended
to adopt secure software development best practices and perform security testing.

### Isolation for untrusted content[â](#isolation-for-untrusted-content "Direct link to Isolation for untrusted content")

A security issue exists whenever you receive code from an untrusted source (e.g.
a remote server) and execute it locally. As an example, consider a remote
website being displayed inside a default [`BrowserWindow`](/docs/latest/api/browser-window). If
an attacker somehow manages to change said content (either by attacking the
source directly, or by sitting between your app and the actual destination), they
will be able to execute native code on the user's machine.

warning

Under no circumstances should you load and execute remote code with
Node.js integration enabled. Instead, use only local files (packaged together
with your application) to execute Node.js code. To display remote content, use
the [`<webview>`](/docs/latest/api/webview-tag) tag or a [`WebContentsView`](/docs/latest/api/web-contents-view)
and make sure to disable the `nodeIntegration` and enable `contextIsolation`.

Electron security warnings

Security warnings and recommendations are printed to the developer console.
They only show up when the binary's name is Electron, indicating that a developer
is currently looking at the console.

You can force-enable or force-disable these warnings by setting
`ELECTRON_ENABLE_SECURITY_WARNINGS` or `ELECTRON_DISABLE_SECURITY_WARNINGS` on
either `process.env` or the `window` object.

## Checklist: Security recommendations[â](#checklist-security-recommendations "Direct link to Checklist: Security recommendations")

You should at least follow these steps to improve the security of your application:

1. [Only load secure content](#1-only-load-secure-content)
2. [Do not enable Node.js integration for remote content](#2-do-not-enable-nodejs-integration-for-remote-content)
3. [Enable context isolation in all renderers](#3-enable-context-isolation)
4. [Enable process sandboxing](#4-enable-process-sandboxing)
5. [Use `ses.setPermissionRequestHandler()` in all sessions that load remote content](#5-handle-session-permission-requests-from-remote-content)
6. [Do not disable `webSecurity`](#6-do-not-disable-websecurity)
7. [Define a `Content-Security-Policy`](#7-define-a-content-security-policy) and use restrictive rules (i.e. `script-src 'self'`)
8. [Do not enable `allowRunningInsecureContent`](#8-do-not-enable-allowrunninginsecurecontent)
9. [Do not enable experimental features](#9-do-not-enable-experimental-features)
10. [Do not use `enableBlinkFeatures`](#10-do-not-use-enableblinkfeatures)
11. [`<webview>`: Do not use `allowpopups`](#11-do-not-use-allowpopups-for-webviews)
12. [`<webview>`: Verify options and params](#12-verify-webview-options-before-creation)
13. [Disable or limit navigation](#13-disable-or-limit-navigation)
14. [Disable or limit creation of new windows](#14-disable-or-limit-creation-of-new-windows)
15. [Do not use `shell.openExternal` with untrusted content](#15-do-not-use-shellopenexternal-with-untrusted-content)
16. [Use a current version of Electron](#16-use-a-current-version-of-electron)
17. [Validate the `sender` of all IPC messages](#17-validate-the-sender-of-all-ipc-messages)
18. [Avoid usage of the `file://` protocol and prefer usage of custom protocols](#18-avoid-usage-of-the-file-protocol-and-prefer-usage-of-custom-protocols)
19. [Check which fuses you can change](#19-check-which-fuses-you-can-change)
20. [Do not expose Electron APIs to untrusted web content](#20-do-not-expose-electron-apis-to-untrusted-web-content)

### 1. Only load secure content[â](#1-only-load-secure-content "Direct link to 1. Only load secure content")

Any resources not included with your application should be loaded using a
secure protocol like `HTTPS`. In other words, do not use insecure protocols
like `HTTP`. Similarly, we recommend the use of `WSS` over `WS`, `FTPS` over
`FTP`, and so on.

#### Why?[â](#why "Direct link to Why?")

`HTTPS` has two main benefits:

1. It ensures data integrity, asserting that the data was not modified while in
transit between your application and the host.
2. It encrypts the traffic between your user and the destination host, making it
more difficult to eavesdrop on the information sent between your app and
the host.

#### How?[â](#how "Direct link to How?")

main.js (Main Process)

```
// Bad
browserWindow.loadURL('http://example.com')

// Good
browserWindow.loadURL('https://example.com')
```

index.html (Renderer Process)

```
<!-- Bad -->
<script crossorigin src="http://example.com/react.js"></script>
<link rel="stylesheet" href="http://example.com/style.css">

<!-- Good -->
<script crossorigin src="https://example.com/react.js"></script>
<link rel="stylesheet" href="https://example.com/style.css">
```

### 2. Do not enable Node.js integration for remote content[â](#2-do-not-enable-nodejs-integration-for-remote-content "Direct link to 2. Do not enable Node.js integration for remote content")

info

This recommendation is the default behavior in Electron since 5.0.0.

It is paramount that you do not enable Node.js integration in any renderer
([`BrowserWindow`](/docs/latest/api/browser-window), [`WebContentsView`](/docs/latest/api/web-contents-view), or
[`<webview>`](/docs/latest/api/webview-tag)) that loads remote content. The goal is to limit the
powers you grant to remote content, thus making it dramatically more difficult
for an attacker to harm your users should they gain the ability to execute
JavaScript on your website.

After this, you can grant additional permissions for specific hosts. For example,
if you are opening a BrowserWindow pointed at `https://example.com/`, you can
give that website exactly the abilities it needs, but no more.

#### Why?[â](#why-1 "Direct link to Why?")

A cross-site-scripting (XSS) attack is more dangerous if an attacker can jump
out of the renderer process and execute code on the user's computer.
Cross-site-scripting attacks are fairly common - and while an issue, their
power is usually limited to messing with the website that they are executed on.
Disabling Node.js integration helps prevent an XSS from being escalated into a
so-called "Remote Code Execution" (RCE) attack.

#### How?[â](#how-1 "Direct link to How?")

main.js (Main Process)

```
// Bad
const mainWindow = new BrowserWindow({
webPreferences: {
contextIsolation: false,
nodeIntegration: true,
nodeIntegrationInWorker: true
}
})

mainWindow.loadURL('https://example.com')
```

main.js (Main Process)

```
// Good
const mainWindow = new BrowserWindow({
webPreferences: {
preload: path.join(app.getAppPath(), 'preload.js')
}
})

mainWindow.loadURL('https://example.com')
```

index.html (Renderer Process)

```
<!-- Bad -->
<webview nodeIntegration src="page.html"></webview>

<!-- Good -->
<webview src="page.html"></webview>
```

When disabling Node.js integration, you can still expose APIs to your website that
do consume Node.js modules or features. Preload scripts continue to have access
to `require` and other Node.js features, allowing developers to expose a custom
API to remotely loaded content via the [contextBridge API](/docs/latest/api/context-bridge).

### 3. Enable Context Isolation[â](#3-enable-context-isolation "Direct link to 3. Enable Context Isolation")

info

Context Isolation is the default behavior in Electron since 12.0.0.

Context isolation is an Electron feature that allows developers to run code
in preload scripts and in Electron APIs in a dedicated JavaScript context. In
practice, that means that global objects like `Array.prototype.push` or
`JSON.parse` cannot be modified by scripts running in the renderer process.

Electron uses the same technology as Chromium's [Content Scripts](https://developer.chrome.com/extensions/content_scripts#execution-environment)
to enable this behavior.

Even when `nodeIntegration: false` is used, to truly enforce strong isolation
and prevent the use of Node primitives `contextIsolation` **must** also be used.

Beware that *disabling context isolation* for a renderer process by setting
`nodeIntegration: true` *also disables process sandboxing* for that process.
See section below.

info

For more information on what `contextIsolation` is and how to enable it please
see our dedicated [Context Isolation](/docs/latest/tutorial/context-isolation) document.

### 4. Enable process sandboxing[â](#4-enable-process-sandboxing "Direct link to 4. Enable process sandboxing")

info

This recommendation is the default behavior in Electron since 20.0.0.

Additionally, process sandboxing can be enforced for all renderer processes
application wide: [Enabling the sandbox globally](/docs/latest/tutorial/sandbox#enabling-the-sandbox-globally)

*Disabling context isolation* (see above) *also disables process sandboxing*,
regardless of the default, `sandbox: false` or globally enabled sandboxing!

[Sandboxing](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/design/sandbox.md)
is a Chromium feature that uses the operating system to
significantly limit what renderer processes have access to. You should enable
the sandbox in all renderers. Loading, reading or processing any untrusted
content in an unsandboxed process, including the main process, is not advised.

info

For more information on what Process Sandboxing is and how to enable it please
see our dedicated [Process Sandboxing](/docs/latest/tutorial/sandbox) document.

### 5. Handle session permission requests from remote content[â](#5-handle-session-permission-requests-from-remote-content "Direct link to 5. Handle session permission requests from remote content")

You may have seen permission requests while using Chrome: they pop up whenever
the website attempts to use a feature that the user has to manually approve (
like notifications).

The API is based on the [Chromium permissions API](https://developer.chrome.com/extensions/permissions)
and implements the same types of permissions.

#### Why?[â](#why-2 "Direct link to Why?")

By default, Electron will automatically approve all permission requests unless
the developer has manually configured a custom handler. While a solid default,
security-conscious developers might want to assume the very opposite.

#### How?[â](#how-2 "Direct link to How?")

main.js (Main Process)

```
const { session } = require('electron')

const { URL } = require('node:url')

session
.defaultSession
.setPermissionRequestHandler((webContents, permission, callback) => {
const parsedUrl = new URL(webContents.getURL())

if (permission === 'notifications') {
// Approves the permissions request
callback(true)
}

// Verify URL
if (parsedUrl.protocol !== 'https:' || parsedUrl.host !== 'example.com') {
// Denies the permissions request
return callback(false)
}
})
```

Note: `session.defaultSession` is only available after `app.whenReady` is called.

### 6. Do not disable `webSecurity`[â](#6-do-not-disable-websecurity "Direct link to 6-do-not-disable-websecurity")

info

This recommendation is Electron's default.

You may have already guessed that disabling the `webSecurity` property on a
renderer process ([`BrowserWindow`](/docs/latest/api/browser-window),
[`WebContentsView`](/docs/latest/api/web-contents-view), or [`<webview>`](/docs/latest/api/webview-tag)) disables
crucial security features.

Do not disable `webSecurity` in production applications.

#### Why?[â](#why-3 "Direct link to Why?")

Disabling `webSecurity` will disable the same-origin policy and set
`allowRunningInsecureContent` property to `true`. In other words, it allows
the execution of insecure code from different domains.

#### How?[â](#how-3 "Direct link to How?")

main.js (Main Process)

```
// Bad
const mainWindow = new BrowserWindow({
webPreferences: {
webSecurity: false
}
})
```

main.js (Main Process)

```
// Good
const mainWindow = new BrowserWindow()
```

index.html (Renderer Process)

```
<!-- Bad -->
<webview disablewebsecurity src="page.html"></webview>

<!-- Good -->
<webview src="page.html"></webview>
```

### 7. Define a Content Security Policy[â](#7-define-a-content-security-policy "Direct link to 7. Define a Content Security Policy")

A Content Security Policy (CSP) is an additional layer of protection against
cross-site-scripting attacks and data injection attacks. We recommend that they
be enabled by any website you load inside Electron.

#### Why?[â](#why-4 "Direct link to Why?")

CSP allows the server serving content to restrict and control the resources
Electron can load for that given web page. `https://example.com` should
be allowed to load scripts from the origins you defined while scripts from
`https://evil.attacker.com` should not be allowed to run. Defining a CSP is an
easy way to improve your application's security.

#### How?[â](#how-4 "Direct link to How?")

The following CSP will allow Electron to execute scripts from the current
website and from `apis.example.com`.

```
// Bad
Content-Security-Policy: '*'

// Good
Content-Security-Policy: script-src 'self' https://apis.example.com
```

#### CSP HTTP headers[â](#csp-http-headers "Direct link to CSP HTTP headers")

Electron respects the [`Content-Security-Policy` HTTP header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)
which can be set using Electron's
[`webRequest.onHeadersReceived`](/docs/latest/api/web-request#webrequestonheadersreceivedfilter-listener)
handler:

main.js (Main Process)

```
const { session } = require('electron')

session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
callback({
responseHeaders: {
...details.responseHeaders,
'Content-Security-Policy': ['default-src \'none\'']
}
})
})
```

Note: `session.defaultSession` is only available after `app.whenReady` is called.

#### CSP meta tag[â](#csp-meta-tag "Direct link to CSP meta tag")

CSP's preferred delivery mechanism is an HTTP header. However, it is not possible
to use this method when loading a resource using the `file://` protocol. It can
be useful in some cases to set a policy on a page directly in the markup using a
`<meta>` tag:

index.html (Renderer Process)

```
<meta http-equiv="Content-Security-Policy" content="default-src 'none'">
```

### 8. Do not enable `allowRunningInsecureContent`[â](#8-do-not-enable-allowrunninginsecurecontent "Direct link to 8-do-not-enable-allowrunninginsecurecontent")

info

This recommendation is Electron's default.

By default, Electron will not allow websites loaded over `HTTPS` to load and
execute scripts, CSS, or plugins from insecure sources (`HTTP`). Setting the
property `allowRunningInsecureContent` to `true` disables that protection.

Loading the initial HTML of a website over `HTTPS` and attempting to load
subsequent resources via `HTTP` is also known as "mixed content".

#### Why?[â](#why-5 "Direct link to Why?")

Loading content over `HTTPS` assures the authenticity and integrity
of the loaded resources while encrypting the traffic itself. See the section on
[only displaying secure content](#1-only-load-secure-content) for more details.

#### How?[â](#how-5 "Direct link to How?")

main.js (Main Process)

```
// Bad
const mainWindow = new BrowserWindow({
webPreferences: {
allowRunningInsecureContent: true
}
})
```

main.js (Main Process)

```
// Good
const mainWindow = new BrowserWindow({})
```

### 9. Do not enable experimental features[â](#9-do-not-enable-experimental-features "Direct link to 9. Do not enable experimental features")

info

This recommendation is Electron's default.

Advanced users of Electron can enable experimental Chromium features using the
`experimentalFeatures` property.

#### Why?[â](#why-6 "Direct link to Why?")

Experimental features are, as the name suggests, experimental and have not been
enabled for all Chromium users. Furthermore, their impact on Electron as a whole
has likely not been tested.

Legitimate use cases exist, but unless you know what you are doing, you should
not enable this property.

#### How?[â](#how-6 "Direct link to How?")

main.js (Main Process)

```
// Bad
const mainWindow = new BrowserWindow({
webPreferences: {
experimentalFeatures: true
}
})
```

main.js (Main Process)

```
// Good
const mainWindow = new BrowserWindow({})
```

### 10. Do not use `enableBlinkFeatures`[â](#10-do-not-use-enableblinkfeatures "Direct link to 10-do-not-use-enableblinkfeatures")

info

This recommendation is Electron's default.

Blink is the name of the rendering engine behind Chromium. As with
`experimentalFeatures`, the `enableBlinkFeatures` property allows developers to
enable features that have been disabled by default.

#### Why?[â](#why-7 "Direct link to Why?")

Generally speaking, there are likely good reasons if a feature was not enabled
by default. Legitimate use cases for enabling specific features exist. As a
developer, you should know exactly why you need to enable a feature, what the
ramifications are, and how it impacts the security of your application. Under
no circumstances should you enable features speculatively.

#### How?[â](#how-7 "Direct link to How?")

main.js (Main Process)

```
// Bad
const mainWindow = new BrowserWindow({
webPreferences: {
enableBlinkFeatures: 'ExecCommandInJavaScript'
}
})
```

main.js (Main Process)

```
// Good
const mainWindow = new BrowserWindow()
```

### 11. Do not use `allowpopups` for WebViews[â](#11-do-not-use-allowpopups-for-webviews "Direct link to 11-do-not-use-allowpopups-for-webviews")

info

This recommendation is Electron's default.

If you are using [`<webview>`](/docs/latest/api/webview-tag), you might need the pages and scripts
loaded in your `<webview>` tag to open new windows. The `allowpopups` attribute
enables them to create new [`BrowserWindows`](/docs/latest/api/browser-window) using the
`window.open()` method. `<webview>` tags are otherwise not allowed to create new
windows.

#### Why?[â](#why-8 "Direct link to Why?")

If you do not need popups, you are better off not allowing the creation of
new [`BrowserWindows`](/docs/latest/api/browser-window) by default. This follows the principle
of minimally required access: Don't let a website create new popups unless
you know it needs that feature.

#### How?[â](#how-8 "Direct link to How?")

index.html (Renderer Process)

```
<!-- Bad -->
<webview allowpopups src="page.html"></webview>

<!-- Good -->
<webview src="page.html"></webview>
```

### 12. Verify WebView options before creation[â](#12-verify-webview-options-before-creation "Direct link to 12. Verify WebView options before creation")

A WebView created in a renderer process that does not have Node.js integration
enabled will not be able to enable integration itself. However, a WebView will
always create an independent renderer process with its own `webPreferences`.

It is a good idea to control the creation of new [`<webview>`](/docs/latest/api/webview-tag) tags
from the main process and to verify that their webPreferences do not disable
security features.

#### Why?[â](#why-9 "Direct link to Why?")

Since `<webview>` live in the DOM, they can be created by a script running on your
website even if Node.js integration is otherwise disabled.

Electron enables developers to disable various security features that control
a renderer process. In most cases, developers do not need to disable any of
those features - and you should therefore not allow different configurations
for newly created [`<webview>`](/docs/latest/api/webview-tag) tags.

#### How?[â](#how-9 "Direct link to How?")

Before a [`<webview>`](/docs/latest/api/webview-tag) tag is attached, Electron will fire the
`will-attach-webview` event on the hosting `webContents`. Use the event to
prevent the creation of `webViews` with possibly insecure options.

main.js (Main Process)

```
app.on('web-contents-created', (event, contents) => {
contents.on('will-attach-webview', (event, webPreferences, params) => {
// Strip away preload scripts if unused or verify their location is legitimate
delete webPreferences.preload

// Disable Node.js integration
webPreferences.nodeIntegration = false

// Verify URL being loaded
if (!params.src.startsWith('https://example.com/')) {
event.preventDefault()
}
})
})
```

Again, this list merely minimizes the risk, but does not remove it. If your goal
is to display a website, a browser will be a more secure option.

### 13. Disable or limit navigation[â](#13-disable-or-limit-navigation "Direct link to 13. Disable or limit navigation")

If your app has no need to navigate or only needs to navigate to known pages,
it is a good idea to limit navigation outright to that known scope, disallowing
any other kinds of navigation.

#### Why?[â](#why-10 "Direct link to Why?")

Navigation is a common attack vector. If an attacker can convince your app to
navigate away from its current page, they can possibly force your app to open
web sites on the Internet. Even if your `webContents` are configured to be more
secure (like having `nodeIntegration` disabled or `contextIsolation` enabled),
getting your app to open a random web site will make the work of exploiting your
app a lot easier.

A common attack pattern is that the attacker convinces your app's users to
interact with the app in such a way that it navigates to one of the attacker's
pages. This is usually done via links, plugins, or other user-generated content.

#### How?[â](#how-10 "Direct link to How?")

If your app has no need for navigation, you can call `event.preventDefault()`
in a [`will-navigate`](/docs/latest/api/web-contents#event-will-navigate) handler. If you know which pages your app
might navigate to, check the URL in the event handler and only let navigation
occur if it matches the URLs you're expecting.

We recommend that you use Node's parser for URLs. Simple string comparisons can
sometimes be fooled - a `startsWith('https://example.com')` test would let
`https://example.com.attacker.com` through.

main.js (Main Process)

```
const { app } = require('electron')

const { URL } = require('node:url')

app.on('web-contents-created', (event, contents) => {
contents.on('will-navigate', (event, navigationUrl) => {
const parsedUrl = new URL(navigationUrl)

if (parsedUrl.origin !== 'https://example.com') {
event.preventDefault()
}
})
})
```

### 14. Disable or limit creation of new windows[â](#14-disable-or-limit-creation-of-new-windows "Direct link to 14. Disable or limit creation of new windows")

If you have a known set of windows, it's a good idea to limit the creation of
additional windows in your app.

#### Why?[â](#why-11 "Direct link to Why?")

Much like navigation, the creation of new `webContents` is a common attack
vector. Attackers attempt to convince your app to create new windows, frames,
or other renderer processes with more privileges than they had before; or
with pages opened that they couldn't open before.

If you have no need to create windows in addition to the ones you know you'll
need to create, disabling the creation buys you a little bit of extra
security at no cost. This is commonly the case for apps that open one
`BrowserWindow` and do not need to open an arbitrary number of additional
windows at runtime.

#### How?[â](#how-11 "Direct link to How?")

[`webContents`](/docs/latest/api/web-contents) will delegate to its
[window open handler](/docs/latest/api/web-contents#contentssetwindowopenhandlerhandler) before creating new windows. The handler will
receive, amongst other parameters, the `url` the window was requested to open
and the options used to create it. We recommend that you register a handler to
monitor the creation of windows, and deny any unexpected window creation.

main.js (Main Process)

```
const { app, shell } = require('electron')

app.on('web-contents-created', (event, contents) => {
contents.setWindowOpenHandler(({ url }) => {
// In this example, we'll ask the operating system
// to open this event's url in the default browser.
//
// See the following item for considerations regarding what
// URLs should be allowed through to shell.openExternal.
if (isSafeForExternalOpen(url)) {
setImmediate(() => {
shell.openExternal(url)
})
}

return { action: 'deny' }
})
})
```

### 15. Do not use `shell.openExternal` with untrusted content[â](#15-do-not-use-shellopenexternal-with-untrusted-content "Direct link to 15-do-not-use-shellopenexternal-with-untrusted-content")

The shell module's [`openExternal`](/docs/latest/api/shell#shellopenexternalurl-options) API allows opening a given
protocol URI with the desktop's native utilities. On macOS, for instance, this
function is similar to the `open` terminal command utility and will open the
specific application based on the URI and filetype association.

#### Why?[â](#why-12 "Direct link to Why?")

Improper use of [`openExternal`](/docs/latest/api/shell#shellopenexternalurl-options) can be leveraged to compromise
the user's host. When openExternal is used with untrusted content, it can be
leveraged to execute arbitrary commands.

#### How?[â](#how-12 "Direct link to How?")

main.js (Main Process)

```
//  Bad
const { shell } = require('electron')

shell.openExternal(USER_CONTROLLED_DATA_HERE)
```

main.js (Main Process)

```
//  Good
const { shell } = require('electron')

shell.openExternal('https://example.com/index.html')
```

### 16. Use a current version of Electron[â](#16-use-a-current-version-of-electron "Direct link to 16. Use a current version of Electron")

You should strive for always using the latest available version of Electron.
Whenever a new major version is released, you should attempt to update your
app as quickly as possible.

#### Why?[â](#why-13 "Direct link to Why?")

An application built with an older version of Electron, Chromium, and Node.js
is an easier target than an application that is using more recent versions of
those components. Generally speaking, security issues and exploits for older
versions of Chromium and Node.js are more widely available.

Both Chromium and Node.js are impressive feats of engineering built by
thousands of talented developers. Given their popularity, their security is
carefully tested and analyzed by equally skilled security researchers. Many of
those researchers [disclose vulnerabilities responsibly](https://en.wikipedia.org/wiki/Responsible_disclosure),
which generally means that researchers will give Chromium and Node.js some time
to fix issues before publishing them. Your application will be more secure if
it is running a recent version of Electron (and thus, Chromium and Node.js) for
which potential security issues are not as widely known.

#### How?[â](#how-13 "Direct link to How?")

Migrate your app one major version at a time, while referring to Electron's
[Breaking Changes](/docs/latest/breaking-changes) document to see if any code needs to
be updated.

### 17. Validate the `sender` of all IPC messages[â](#17-validate-the-sender-of-all-ipc-messages "Direct link to 17-validate-the-sender-of-all-ipc-messages")

You should always validate incoming IPC messages `sender` property to ensure you
aren't performing actions or sending information to untrusted renderers.

#### Why?[â](#why-14 "Direct link to Why?")

All Web Frames can in theory send IPC messages to the main process, including
iframes and child windows in some scenarios. If you have an IPC message that returns
user data to the sender via `event.reply` or performs privileged actions that the renderer
can't natively, you should ensure you aren't listening to third party web frames.

You should be validating the `sender` of **all** IPC messages by default.

#### How?[â](#how-14 "Direct link to How?")

main.js (Main Process)

```
// Bad
ipcMain.handle('get-secrets', () => {
return getSecrets()
})

// Good
ipcMain.handle('get-secrets', (e) => {
if (!validateSender(e.senderFrame)) return null
return getSecrets()
})

function validateSender (frame) {
// Value the host of the URL using an actual URL parser and an allowlist
if ((new URL(frame.url)).host === 'electronjs.org') return true
return false
}
```

### 18. Avoid usage of the `file://` protocol and prefer usage of custom protocols[â](#18-avoid-usage-of-the-file-protocol-and-prefer-usage-of-custom-protocols "Direct link to 18-avoid-usage-of-the-file-protocol-and-prefer-usage-of-custom-protocols")

You should serve local pages from a custom protocol instead of the `file://` protocol.

#### Why?[â](#why-15 "Direct link to Why?")

The `file://` protocol gets more privileges in Electron than in a web browser and even in
browsers it is treated differently to http/https URLs. Using a custom protocol allows you
to be more aligned with classic web url behavior while retaining even more control about
what can be loaded and when.

Pages running on `file://` have unilateral access to every file on your machine meaning
that XSS issues can be used to load arbitrary files from the users machine. Using a custom
protocol prevents issues like this as you can limit the protocol to only serving a specific
set of files.

#### How?[â](#how-15 "Direct link to How?")

Follow the [`protocol.handle`](/docs/latest/api/protocol#protocolhandlescheme-handler) examples to
learn how to serve files / content from a custom protocol.

### 19. Check which fuses you can change[â](#19-check-which-fuses-you-can-change "Direct link to 19. Check which fuses you can change")

Electron ships with a number of options that can be useful but a large portion of
applications probably don't need. In order to avoid having to build your own version of
Electron, these can be turned off or on using [Fuses](/docs/latest/tutorial/fuses).

#### Why?[â](#why-16 "Direct link to Why?")

Some fuses, like `runAsNode` and `nodeCliInspect`, allow the application to behave differently
when run from the command line using specific environment variables or CLI arguments. These
can be used to execute commands on the device through your application.

This can let external scripts run commands that they potentially would not be allowed to, but
that your application might have the rights for.

#### How?[â](#how-16 "Direct link to How?")

[`@electron/fuses`](https://npmjs.com/package/@electron/fuses) is a module we made to make
flipping these fuses easy. Check out the README of that module for more details on usage and
potential error cases, and refer to
[How do I flip fuses?](/docs/latest/tutorial/fuses#how-do-i-flip-fuses) in our documentation.

### 20. Do not expose Electron APIs to untrusted web content[â](#20-do-not-expose-electron-apis-to-untrusted-web-content "Direct link to 20. Do not expose Electron APIs to untrusted web content")

You should not directly expose Electron's APIs, especially IPC, to untrusted web content in your
preload scripts.

#### Why?[â](#why-17 "Direct link to Why?")

Exposing raw APIs like `ipcRenderer.on` is dangerous because it gives renderer processes direct
access to the entire IPC event system, allowing them to listen for any IPC events, not just the ones
intended for them.

To avoid that exposure, we also cannot pass callbacks directly through: The first
argument to IPC event callbacks is an `IpcRendererEvent` object, which includes properties like `sender`
that provide access to the underlying `ipcRenderer` instance. Even if you only listen for specific
events, passing the callback directly means the renderer gets access to this event object.

In short, we want the untrusted web content to only have access to necessary information and APIs.

#### How?[â](#how-17 "Direct link to How?")

preload

```
// Bad
contextBridge.exposeInMainWorld('electronAPI', {
on: ipcRenderer.on
})

// Also bad
contextBridge.exposeInMainWorld('electronAPI', {
onUpdateCounter: (callback) => ipcRenderer.on('update-counter', callback)
})

// Good
contextBridge.exposeInMainWorld('electronAPI', {
onUpdateCounter: (callback) => ipcRenderer.on('update-counter', (_event, value) => callback(value))
})
```

info

For more information on what `contextIsolation` is and how to use it to secure your app,
please see the [Context Isolation](/docs/latest/tutorial/context-isolation) document.

* [Preface](#preface)* [General guidelines](#general-guidelines)
+ [Security is everyone's responsibility](#security-is-everyones-responsibility)+ [Isolation for untrusted content](#isolation-for-untrusted-content)* [Checklist: Security recommendations](#checklist-security-recommendations)
+ [1. Only load secure content](#1-only-load-secure-content)+ [2. Do not enable Node.js integration for remote content](#2-do-not-enable-nodejs-integration-for-remote-content)+ [3. Enable Context Isolation](#3-enable-context-isolation)+ [4. Enable process sandboxing](#4-enable-process-sandboxing)+ [5. Handle session permission requests from remote content](#5-handle-session-permission-requests-from-remote-content)+ [6. Do not disable `webSecurity`](#6-do-not-disable-websecurity)+ [7. Define a Content Security Policy](#7-define-a-content-security-policy)+ [8. Do not enable `allowRunningInsecureContent`](#8-do-not-enable-allowrunninginsecurecontent)+ [9. Do not enable experimental features](#9-do-not-enable-experimental-features)+ [10. Do not use `enableBlinkFeatures`](#10-do-not-use-enableblinkfeatures)+ [11. Do not use `allowpopups` for WebViews](#11-do-not-use-allowpopups-for-webviews)+ [12. Verify WebView options before creation](#12-verify-webview-options-before-creation)+ [13. Disable or limit navigation](#13-disable-or-limit-navigation)+ [14. Disable or limit creation of new windows](#14-disable-or-limit-creation-of-new-windows)+ [15. Do not use `shell.openExternal` with untrusted content](#15-do-not-use-shellopenexternal-with-untrusted-content)+ [16. Use a current version of Electron](#16-use-a-current-version-of-electron)+ [17. Validate the `sender` of all IPC messages](#17-validate-the-sender-of-all-ipc-messages)+ [18. Avoid usage of the `file://` protocol and prefer usage of custom protocols](#18-avoid-usage-of-the-file-protocol-and-prefer-usage-of-custom-protocols)+ [19. Check which fuses you can change](#19-check-which-fuses-you-can-change)+ [20. Do not expose Electron APIs to untrusted web content](#20-do-not-expose-electron-apis-to-untrusted-web-content)