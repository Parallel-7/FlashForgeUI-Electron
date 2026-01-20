# Source: https://www.electronjs.org/docs/latest/api/environment-variables

On this page

> Control application configuration and behavior without changing code.

Certain Electron behaviors are controlled by environment variables because they
are initialized earlier than the command line flags and the app's code.

POSIX shell example:

```
$ export ELECTRON_ENABLE_LOGGING=true
$ electron
```

Windows console example:

```
> set ELECTRON_ENABLE_LOGGING=true
> electron
```

## Production Variables[â](#production-variables "Direct link to Production Variables")

The following environment variables are intended primarily for use at runtime
in packaged Electron applications.

### `NODE_OPTIONS`[â](#node_options "Direct link to node_options")

Electron includes support for a subset of Node's [`NODE_OPTIONS`](https://nodejs.org/api/cli.html#cli_node_options_options). The majority are supported with the exception of those which conflict with Chromium's use of BoringSSL.

Example:

```
export NODE_OPTIONS="--no-warnings --max-old-space-size=2048"
```

Unsupported options are:

```
--use-bundled-ca
--force-fips
--enable-fips
--openssl-config
--use-openssl-ca
```

`NODE_OPTIONS` are explicitly disallowed in packaged apps, except for the following:

```
--max-http-header-size
--http-parser
```

If the [`nodeOptions` fuse](/docs/latest/tutorial/fuses#nodeoptions) is disabled, `NODE_OPTIONS` will be ignored.

### `NODE_EXTRA_CA_CERTS`[â](#node_extra_ca_certs "Direct link to node_extra_ca_certs")

See [Node.js cli documentation](https://github.com/nodejs/node/blob/main/doc/api/cli.md#node_extra_ca_certsfile) for details.

```
export NODE_EXTRA_CA_CERTS=/path/to/cert.pem
```

If the [`nodeOptions` fuse](/docs/latest/tutorial/fuses#nodeoptions) is disabled, `NODE_EXTRA_CA_CERTS` will be ignored.

### `GOOGLE_API_KEY`[â](#google_api_key "Direct link to google_api_key")

Geolocation support in Electron requires the use of Google Cloud Platform's
geolocation webservice. To enable this feature, acquire a
[Google API key](https://developers.google.com/maps/documentation/geolocation/get-api-key)
and place the following code in your main process file, before opening any
browser windows that will make geolocation requests:

```
process.env.GOOGLE_API_KEY = 'YOUR_KEY_HERE'
```

By default, a newly generated Google API key may not be allowed to make geolocation requests.
To enable the geolocation webservice for your project, enable it through the
[API library](https://console.cloud.google.com/apis/library).

N.B. You will need to add a
[Billing Account](https://cloud.google.com/billing/docs/how-to/payment-methods#add_a_payment_method)
to the project associated to the API key for the geolocation webservice to work.

### `ELECTRON_NO_ASAR`[â](#electron_no_asar "Direct link to electron_no_asar")

Disables ASAR support. This variable is only supported in forked child processes
and spawned child processes that set `ELECTRON_RUN_AS_NODE`.

### `ELECTRON_RUN_AS_NODE`[â](#electron_run_as_node "Direct link to electron_run_as_node")

Starts the process as a normal Node.js process.

In this mode, you will be able to pass [cli options](https://nodejs.org/api/cli.html) to Node.js as
you would when running the normal Node.js executable, with the exception of the following flags:

* "--openssl-config"
* "--use-bundled-ca"
* "--use-openssl-ca",
* "--force-fips"
* "--enable-fips"

These flags are disabled owing to the fact that Electron uses BoringSSL instead of OpenSSL when building Node.js'
`crypto` module, and so will not work as designed.

If the [`runAsNode` fuse](/docs/latest/tutorial/fuses#runasnode) is disabled, `ELECTRON_RUN_AS_NODE` will be ignored.

### `ELECTRON_NO_ATTACH_CONSOLE` *Windows*[â](#electron_no_attach_console-windows "Direct link to electron_no_attach_console-windows")

Don't attach to the current console session.

### `ELECTRON_FORCE_WINDOW_MENU_BAR` *Linux*[â](#electron_force_window_menu_bar-linux "Direct link to electron_force_window_menu_bar-linux")

Don't use the global menu bar on Linux.

### `ELECTRON_TRASH` *Linux*[â](#electron_trash-linux "Direct link to electron_trash-linux")

Set the trash implementation on Linux. Default is `gio`.

Options:

* `gvfs-trash`
* `trash-cli`
* `kioclient5`
* `kioclient`

## Development Variables[â](#development-variables "Direct link to Development Variables")

The following environment variables are intended primarily for development and
debugging purposes.

### `ELECTRON_ENABLE_LOGGING`[â](#electron_enable_logging "Direct link to electron_enable_logging")

Prints Chromium's internal logging to the console.

Setting this variable is the same as passing `--enable-logging`
on the command line. For more info, see `--enable-logging` in
[command-line switches](/docs/latest/api/command-line-switches#--enable-loggingfile).

### `ELECTRON_LOG_FILE`[â](#electron_log_file "Direct link to electron_log_file")

Sets the file destination for Chromium's internal logging.

Setting this variable is the same as passing `--log-file`
on the command line. For more info, see `--log-file` in
[command-line switches](/docs/latest/api/command-line-switches#--log-filepath).

### `ELECTRON_DEBUG_NOTIFICATIONS`[â](#electron_debug_notifications "Direct link to electron_debug_notifications")

Adds extra logs to [`Notification`](/docs/latest/api/notification) lifecycles on macOS to aid in debugging. Extra logging will be displayed when new Notifications are created or activated. They will also be displayed when common actions are taken: a notification is shown, dismissed, its button is clicked, or it is replied to.

Sample output:

```
Notification created (com.github.Electron:notification:EAF7B87C-A113-43D7-8E76-F88EC9D73D44)
Notification displayed (com.github.Electron:notification:EAF7B87C-A113-43D7-8E76-F88EC9D73D44)
Notification activated (com.github.Electron:notification:EAF7B87C-A113-43D7-8E76-F88EC9D73D44)
Notification replied to (com.github.Electron:notification:EAF7B87C-A113-43D7-8E76-F88EC9D73D44)
```

### `ELECTRON_LOG_ASAR_READS`[â](#electron_log_asar_reads "Direct link to electron_log_asar_reads")

When Electron reads from an ASAR file, log the read offset and file path to
the system `tmpdir`. The resulting file can be provided to the ASAR module
to optimize file ordering.

### `ELECTRON_ENABLE_STACK_DUMPING`[â](#electron_enable_stack_dumping "Direct link to electron_enable_stack_dumping")

Prints the stack trace to the console when Electron crashes.

This environment variable will not work if the `crashReporter` is started.

### `ELECTRON_DEFAULT_ERROR_MODE` *Windows*[â](#electron_default_error_mode-windows "Direct link to electron_default_error_mode-windows")

Shows the Windows's crash dialog when Electron crashes.

This environment variable will not work if the `crashReporter` is started.

### `ELECTRON_OVERRIDE_DIST_PATH`[â](#electron_override_dist_path "Direct link to electron_override_dist_path")

When running from the `electron` package, this variable tells
the `electron` command to use the specified build of Electron instead of
the one downloaded by `npm install`. Usage:

```
export ELECTRON_OVERRIDE_DIST_PATH=/Users/username/projects/electron/out/Testing
```

### `ELECTRON_SKIP_BINARY_DOWNLOAD`[â](#electron_skip_binary_download "Direct link to electron_skip_binary_download")

If you want to install your project's dependencies but don't need to use Electron functionality,
you can set the `ELECTRON_SKIP_BINARY_DOWNLOAD` environment variable to prevent the binary from being
downloaded. For instance, this feature can be useful in continuous integration environments when
running unit tests that mock out the `electron` module.

```
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install
```

* [Production Variables](#production-variables)
+ [`NODE_OPTIONS`](#node_options)+ [`NODE_EXTRA_CA_CERTS`](#node_extra_ca_certs)+ [`GOOGLE_API_KEY`](#google_api_key)+ [`ELECTRON_NO_ASAR`](#electron_no_asar)+ [`ELECTRON_RUN_AS_NODE`](#electron_run_as_node)+ [`ELECTRON_NO_ATTACH_CONSOLE` *Windows*](#electron_no_attach_console-windows)+ [`ELECTRON_FORCE_WINDOW_MENU_BAR` *Linux*](#electron_force_window_menu_bar-linux)+ [`ELECTRON_TRASH` *Linux*](#electron_trash-linux)* [Development Variables](#development-variables)
+ [`ELECTRON_ENABLE_LOGGING`](#electron_enable_logging)+ [`ELECTRON_LOG_FILE`](#electron_log_file)+ [`ELECTRON_DEBUG_NOTIFICATIONS`](#electron_debug_notifications)+ [`ELECTRON_LOG_ASAR_READS`](#electron_log_asar_reads)+ [`ELECTRON_ENABLE_STACK_DUMPING`](#electron_enable_stack_dumping)+ [`ELECTRON_DEFAULT_ERROR_MODE` *Windows*](#electron_default_error_mode-windows)+ [`ELECTRON_OVERRIDE_DIST_PATH`](#electron_override_dist_path)+ [`ELECTRON_SKIP_BINARY_DOWNLOAD`](#electron_skip_binary_download)