# Source: https://www.electronjs.org/docs/latest/api/command-line-switches

On this page

> Command line switches supported by Electron.

You can use [app.commandLine.appendSwitch](/docs/latest/api/command-line#commandlineappendswitchswitch-value) to append them in
your app's main script before the [ready](/docs/latest/api/app#event-ready) event of the [app](/docs/latest/api/app) module
is emitted:

```
const { app } = require('electron')

app.commandLine.appendSwitch('remote-debugging-port', '8315')
app.commandLine.appendSwitch('host-rules', 'MAP * 127.0.0.1')

app.whenReady().then(() => {
// Your code here
})
```

## Electron CLI Flags[â](#electron-cli-flags "Direct link to Electron CLI Flags")

### --auth-server-whitelist=`url`[â](#--auth-server-whitelisturl "Direct link to --auth-server-whitelisturl")

A comma-separated list of servers for which integrated authentication is enabled.

For example:

```
--auth-server-whitelist='*example.com, *foobar.com, *baz'
```

then any `url` ending with `example.com`, `foobar.com`, `baz` will be considered
for integrated authentication. Without `*` prefix the URL has to match exactly.

### --auth-negotiate-delegate-whitelist=`url`[â](#--auth-negotiate-delegate-whitelisturl "Direct link to --auth-negotiate-delegate-whitelisturl")

A comma-separated list of servers for which delegation of user credentials is required.
Without `*` prefix the URL has to match exactly.

### --disable-ntlm-v2[â](#--disable-ntlm-v2 "Direct link to --disable-ntlm-v2")

Disables NTLM v2 for POSIX platforms, no effect elsewhere.

### --disable-http-cache[â](#--disable-http-cache "Direct link to --disable-http-cache")

Disables the disk cache for HTTP requests.

### --disable-http2[â](#--disable-http2 "Direct link to --disable-http2")

Disable HTTP/2 and SPDY/3.1 protocols.

### --disable-renderer-backgrounding[â](#--disable-renderer-backgrounding "Direct link to --disable-renderer-backgrounding")

Prevents Chromium from lowering the priority of invisible pages' renderer
processes.

This flag is global to all renderer processes, if you only want to disable
throttling in one window, you can take the hack of
[playing silent audio](https://github.com/atom/atom/pull/9485/files).

### --disk-cache-size=`size`[â](#--disk-cache-sizesize "Direct link to --disk-cache-sizesize")

Forces the maximum disk space to be used by the disk cache, in bytes.

### --enable-logging[=file][â](#--enable-loggingfile "Direct link to --enable-logging[=file]")

Prints Chromium's logging to stderr (or a log file).

The `ELECTRON_ENABLE_LOGGING` environment variable has the same effect as
passing `--enable-logging`.

Passing `--enable-logging` will result in logs being printed on stderr.
Passing `--enable-logging=file` will result in logs being saved to the file
specified by `--log-file=...`, or to `electron_debug.log` in the user-data
directory if `--log-file` is not specified.

note

On Windows, logs from child processes cannot be sent to stderr.
Logging to a file is the most reliable way to collect logs on Windows.

See also `--log-file`, `--log-level`, `--v`, and `--vmodule`.

### --force-fieldtrials=`trials`[â](#--force-fieldtrialstrials "Direct link to --force-fieldtrialstrials")

Field trials to be forcefully enabled or disabled.

For example: `WebRTC-Audio-Red-For-Opus/Enabled/`

### --host-rules=`rules` *Deprecated*[â](#--host-rulesrules-deprecated "Direct link to --host-rulesrules-deprecated")

A comma-separated list of `rules` that control how hostnames are mapped.

For example:

* `MAP * 127.0.0.1` Forces all hostnames to be mapped to 127.0.0.1
* `MAP *.google.com proxy` Forces all google.com subdomains to be resolved to
"proxy".
* `MAP test.com [::1]:77` Forces "test.com" to resolve to IPv6 loopback. Will
also force the port of the resulting socket address to be 77.
* `MAP * baz, EXCLUDE www.google.com` Remaps everything to "baz", except for
"[www.google.com](http://www.google.com)".

These mappings apply to the endpoint host in a net request (the TCP connect
and host resolver in a direct connection, and the `CONNECT` in an HTTP proxy
connection, and the endpoint host in a `SOCKS` proxy connection).

**Deprecated:** Use the `--host-resolver-rules` switch instead.

### --host-resolver-rules=`rules`[â](#--host-resolver-rulesrules "Direct link to --host-resolver-rulesrules")

A comma-separated list of `rules` that control how hostnames are mapped.

For example:

* `MAP * 127.0.0.1` Forces all hostnames to be mapped to 127.0.0.1
* `MAP *.google.com proxy` Forces all google.com subdomains to be resolved to
"proxy".
* `MAP test.com [::1]:77` Forces "test.com" to resolve to IPv6 loopback. Will
also force the port of the resulting socket address to be 77.
* `MAP * baz, EXCLUDE www.google.com` Remaps everything to "baz", except for
"[www.google.com](http://www.google.com)".

These `rules` only apply to the host resolver.

### --ignore-certificate-errors[â](#--ignore-certificate-errors "Direct link to --ignore-certificate-errors")

Ignores certificate related errors.

### --ignore-connections-limit=`domains`[â](#--ignore-connections-limitdomains "Direct link to --ignore-connections-limitdomains")

Ignore the connections limit for `domains` list separated by `,`.

### --js-flags=`flags`[â](#--js-flagsflags "Direct link to --js-flagsflags")

Specifies the flags passed to the [V8 engine](https://v8.dev). In order to enable the `flags` in the main process,
this switch must be passed on startup.

```
$ electron --js-flags="--harmony_proxies --harmony_collections" your-app
```

Run `node --v8-options` or `electron --js-flags="--help"` in your terminal for the list of available flags. These can be used to enable early-stage JavaScript features, or log and manipulate garbage collection, among other things.

For example, to trace V8 optimization and deoptimization:

```
$ electron --js-flags="--trace-opt --trace-deopt" your-app
```

### --lang[â](#--lang "Direct link to --lang")

Set a custom locale.

### --log-file=`path`[â](#--log-filepath "Direct link to --log-filepath")

If `--enable-logging` is specified, logs will be written to the given path. The
parent directory must exist.

Setting the `ELECTRON_LOG_FILE` environment variable is equivalent to passing
this flag. If both are present, the command-line switch takes precedence.

### --log-net-log=`path`[â](#--log-net-logpath "Direct link to --log-net-logpath")

Enables net log events to be saved and writes them to `path`.

### --log-level=`N`[â](#--log-leveln "Direct link to --log-leveln")

Sets the verbosity of logging when used together with `--enable-logging`.
`N` should be one of [Chrome's LogSeverities](https://source.chromium.org/chromium/chromium/src/+/main:base/logging.h?q=logging::LogSeverity&ss=chromium).

Note that two complimentary logging mechanisms in Chromium -- `LOG()`
and `VLOG()` -- are controlled by different switches. `--log-level`
controls `LOG()` messages, while `--v` and `--vmodule` control `VLOG()`
messages. So you may want to use a combination of these three switches
depending on the granularity you want and what logging calls are made
by the code you're trying to watch.

See [Chromium Logging source](https://source.chromium.org/chromium/chromium/src/+/main:base/logging.h) for more information on how
`LOG()` and `VLOG()` interact. Loosely speaking, `VLOG()` can be thought
of as sub-levels / per-module levels inside `LOG(INFO)` to control the
firehose of `LOG(INFO)` data.

See also `--enable-logging`, `--log-level`, `--v`, and `--vmodule`.

### --no-proxy-server[â](#--no-proxy-server "Direct link to --no-proxy-server")

Don't use a proxy server and always make direct connections. Overrides any other
proxy server flags that are passed.

### --no-sandbox[â](#--no-sandbox "Direct link to --no-sandbox")

Disables the Chromium [sandbox](https://www.chromium.org/developers/design-documents/sandbox).
Forces renderer process and Chromium helper processes to run un-sandboxed.
Should only be used for testing.

### --no-stdio-init[â](#--no-stdio-init "Direct link to --no-stdio-init")

Disable stdio initialization during node initialization.
Used to avoid node initialization crash when the nul device is disabled on Windows platform.

### --proxy-bypass-list=`hosts`[â](#--proxy-bypass-listhosts "Direct link to --proxy-bypass-listhosts")

Instructs Electron to bypass the proxy server for the given semi-colon-separated
list of hosts. This flag has an effect only if used in tandem with
`--proxy-server`.

For example:

```
const { app } = require('electron')

app.commandLine.appendSwitch('proxy-bypass-list', '<local>;*.google.com;*foo.com;1.2.3.4:5678')
```

Will use the proxy server for all hosts except for local addresses (`localhost`,
`127.0.0.1` etc.), `google.com` subdomains, hosts that contain the suffix
`foo.com` and anything at `1.2.3.4:5678`.

### --proxy-pac-url=`url`[â](#--proxy-pac-urlurl "Direct link to --proxy-pac-urlurl")

Uses the PAC script at the specified `url`.

### --proxy-server=`address:port`[â](#--proxy-serveraddressport "Direct link to --proxy-serveraddressport")

Use a specified proxy server, which overrides the system setting. This switch
only affects requests with HTTP protocol, including HTTPS and WebSocket
requests. It is also noteworthy that not all proxy servers support HTTPS and
WebSocket requests. The proxy URL does not support username and password
authentication [per Chromium issue](https://bugs.chromium.org/p/chromium/issues/detail?id=615947).

### --remote-debugging-port=`port`[â](#--remote-debugging-portport "Direct link to --remote-debugging-portport")

Enables remote debugging over HTTP on the specified `port`.

### --v=`log_level`[â](#--vlog_level "Direct link to --vlog_level")

Gives the default maximal active V-logging level; 0 is the default. Normally
positive values are used for V-logging levels.

This switch only works when `--enable-logging` is also passed.

See also `--enable-logging`, `--log-level`, and `--vmodule`.

### --vmodule=`pattern`[â](#--vmodulepattern "Direct link to --vmodulepattern")

Gives the per-module maximal V-logging levels to override the value given by
`--v`. E.g. `my_module=2,foo*=3` would change the logging level for all code in
source files `my_module.*` and `foo*.*`.

Any pattern containing a forward or backward slash will be tested against the
whole pathname and not only the module. E.g. `*/foo/bar/*=2` would change the
logging level for all code in the source files under a `foo/bar` directory.

This switch only works when `--enable-logging` is also passed.

See also `--enable-logging`, `--log-level`, and `--v`.

### --force\_high\_performance\_gpu[â](#--force_high_performance_gpu "Direct link to --force_high_performance_gpu")

Force using discrete GPU when there are multiple GPUs available.

### --force\_low\_power\_gpu[â](#--force_low_power_gpu "Direct link to --force_low_power_gpu")

Force using integrated GPU when there are multiple GPUs available.

### --xdg-portal-required-version=`version`[â](#--xdg-portal-required-versionversion "Direct link to --xdg-portal-required-versionversion")

Sets the minimum required version of XDG portal implementation to `version`
in order to use the portal backend for file dialogs on linux. File dialogs
will fallback to using gtk or kde depending on the desktop environment when
the required version is unavailable. Current default is set to `3`.

## Node.js Flags[â](#nodejs-flags "Direct link to Node.js Flags")

Electron supports some of the [CLI flags](https://nodejs.org/api/cli.html) supported by Node.js.

note

Passing unsupported command line switches to Electron when it is not running in `ELECTRON_RUN_AS_NODE` will have no effect.

### `--inspect-brk[=[host:]port]`[â](#--inspect-brkhostport "Direct link to --inspect-brkhostport")

Activate inspector on host:port and break at start of user script. Default host:port is 127.0.0.1:9229.

Aliased to `--debug-brk=[host:]port`.

#### `--inspect-brk-node[=[host:]port]`[â](#--inspect-brk-nodehostport "Direct link to --inspect-brk-nodehostport")

Activate inspector on `host:port` and break at start of the first internal
JavaScript script executed when the inspector is available.
Default `host:port` is `127.0.0.1:9229`.

### `--inspect-port=[host:]port`[â](#--inspect-porthostport "Direct link to --inspect-porthostport")

Set the `host:port` to be used when the inspector is activated. Useful when activating the inspector by sending the SIGUSR1 signal. Default host is `127.0.0.1`.

Aliased to `--debug-port=[host:]port`.

### `--inspect[=[host:]port]`[â](#--inspecthostport "Direct link to --inspecthostport")

Activate inspector on `host:port`. Default is `127.0.0.1:9229`.

V8 inspector integration allows tools such as Chrome DevTools and IDEs to debug and profile Electron instances. The tools attach to Electron instances via a TCP port and communicate using the [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/).

See the [Debugging the Main Process](/docs/latest/tutorial/debugging-main-process) guide for more details.

Aliased to `--debug[=[host:]port`.

### `--inspect-publish-uid=stderr,http`[â](#--inspect-publish-uidstderrhttp "Direct link to --inspect-publish-uidstderrhttp")

Specify ways of the inspector web socket url exposure.

By default inspector websocket url is available in stderr and under /json/list endpoint on `http://host:port/json/list`.

### `--experimental-network-inspection`[â](#--experimental-network-inspection "Direct link to --experimental-network-inspection")

Enable support for DevTools network inspector events, for visibility into requests made by the nodejs `http` and `https` modules.

### `--no-deprecation`[â](#--no-deprecation "Direct link to --no-deprecation")

Silence deprecation warnings.

### `--throw-deprecation`[â](#--throw-deprecation "Direct link to --throw-deprecation")

Throw errors for deprecations.

### `--trace-deprecation`[â](#--trace-deprecation "Direct link to --trace-deprecation")

Print stack traces for deprecations.

### `--trace-warnings`[â](#--trace-warnings "Direct link to --trace-warnings")

Print stack traces for process warnings (including deprecations).

### `--dns-result-order=order`[â](#--dns-result-orderorder "Direct link to --dns-result-orderorder")

Set the default value of the `verbatim` parameter in the Node.js [`dns.lookup()`](https://nodejs.org/api/dns.html#dnslookuphostname-options-callback) and [`dnsPromises.lookup()`](https://nodejs.org/api/dns.html#dnspromiseslookuphostname-options) functions. The value could be:

* `ipv4first`: sets default `verbatim` `false`.
* `verbatim`: sets default `verbatim` `true`.

The default is `verbatim` and `dns.setDefaultResultOrder()` have higher priority than `--dns-result-order`.

### `--diagnostic-dir=directory`[â](#--diagnostic-dirdirectory "Direct link to --diagnostic-dirdirectory")

Set the directory to which all Node.js diagnostic output files are written. Defaults to current working directory.

Affects the default output directory of [v8.setHeapSnapshotNearHeapLimit](https://nodejs.org/docs/latest/api/v8.html#v8setheapsnapshotnearheaplimitlimit).

### `--no-experimental-global-navigator`[â](#--no-experimental-global-navigator "Direct link to --no-experimental-global-navigator")

Disable exposition of [Navigator API](https://github.com/nodejs/node/blob/main/doc/api/globals.md#navigator) on the global scope from Node.js.

## Chromium Flags[â](#chromium-flags "Direct link to Chromium Flags")

There isn't a documented list of all Chromium switches, but there are a few ways to find them.

The easiest way is through Chromium's flags page, which you can access at `about://flags`. These flags don't directly match switch names, but they show up in the process's command-line arguments.

To see these arguments, enable a flag in `about://flags`, then go to `about://version` in Chromium. You'll find a list of command-line arguments, including `--flag-switches-begin --your --list --flag-switches-end`, which contains the list of your flag enabled switches.

Most flags are included as part of `--enable-features=`, but some are standalone switches, like `--enable-experimental-web-platform-features`.

A complete list of flags exists in [Chromium's flag metadata page](https://source.chromium.org/chromium/chromium/src/+/main:chrome/browser/flag-metadata.json), but this list includes platform, environment and GPU specific, expired and potentially non-functional flags, so many of them might not always work in every situation.

Keep in mind that standalone switches can sometimes be split into individual features, so there's no fully complete list of switches.

Finally, you'll need to ensure that the version of Chromium in Electron matches the version of the browser you're using to cross-reference the switches.

* [Electron CLI Flags](#electron-cli-flags)
+ [--auth-server-whitelist=`url`](#--auth-server-whitelisturl)+ [--auth-negotiate-delegate-whitelist=`url`](#--auth-negotiate-delegate-whitelisturl)+ [--disable-ntlm-v2](#--disable-ntlm-v2)+ [--disable-http-cache](#--disable-http-cache)+ [--disable-http2](#--disable-http2)+ [--disable-renderer-backgrounding](#--disable-renderer-backgrounding)+ [--disk-cache-size=`size`](#--disk-cache-sizesize)+ [--enable-logging[=file]](#--enable-loggingfile)+ [--force-fieldtrials=`trials`](#--force-fieldtrialstrials)+ [--host-rules=`rules` *Deprecated*](#--host-rulesrules-deprecated)+ [--host-resolver-rules=`rules`](#--host-resolver-rulesrules)+ [--ignore-certificate-errors](#--ignore-certificate-errors)+ [--ignore-connections-limit=`domains`](#--ignore-connections-limitdomains)+ [--js-flags=`flags`](#--js-flagsflags)+ [--lang](#--lang)+ [--log-file=`path`](#--log-filepath)+ [--log-net-log=`path`](#--log-net-logpath)+ [--log-level=`N`](#--log-leveln)+ [--no-proxy-server](#--no-proxy-server)+ [--no-sandbox](#--no-sandbox)+ [--no-stdio-init](#--no-stdio-init)+ [--proxy-bypass-list=`hosts`](#--proxy-bypass-listhosts)+ [--proxy-pac-url=`url`](#--proxy-pac-urlurl)+ [--proxy-server=`address:port`](#--proxy-serveraddressport)+ [--remote-debugging-port=`port`](#--remote-debugging-portport)+ [--v=`log_level`](#--vlog_level)+ [--vmodule=`pattern`](#--vmodulepattern)+ [--force\_high\_performance\_gpu](#--force_high_performance_gpu)+ [--force\_low\_power\_gpu](#--force_low_power_gpu)+ [--xdg-portal-required-version=`version`](#--xdg-portal-required-versionversion)* [Node.js Flags](#nodejs-flags)
+ [`--inspect-brk[=[host:]port]`](#--inspect-brkhostport)
- [`--inspect-brk-node[=[host:]port]`](#--inspect-brk-nodehostport)+ [`--inspect-port=[host:]port`](#--inspect-porthostport)+ [`--inspect[=[host:]port]`](#--inspecthostport)+ [`--inspect-publish-uid=stderr,http`](#--inspect-publish-uidstderrhttp)+ [`--experimental-network-inspection`](#--experimental-network-inspection)+ [`--no-deprecation`](#--no-deprecation)+ [`--throw-deprecation`](#--throw-deprecation)+ [`--trace-deprecation`](#--trace-deprecation)+ [`--trace-warnings`](#--trace-warnings)+ [`--dns-result-order=order`](#--dns-result-orderorder)+ [`--diagnostic-dir=directory`](#--diagnostic-dirdirectory)+ [`--no-experimental-global-navigator`](#--no-experimental-global-navigator)* [Chromium Flags](#chromium-flags)