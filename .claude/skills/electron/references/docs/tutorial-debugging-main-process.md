# Source: https://www.electronjs.org/docs/latest/tutorial/debugging-main-process

On this page

The DevTools in an Electron browser window can only debug JavaScript that's
executed in that window (i.e. the web pages). To debug JavaScript that's
executed in the main process you will need to use an external debugger and
launch Electron with the `--inspect` or `--inspect-brk` switch.

## Command Line Switches[â](#command-line-switches "Direct link to Command Line Switches")

Use one of the following command line switches to enable debugging of the main
process:

### `--inspect=[port]`[â](#--inspectport "Direct link to --inspectport")

Electron will listen for V8 inspector protocol messages on the specified `port`,
an external debugger will need to connect on this port. The default `port` is
`9229`.

```
electron --inspect=9229 your/app
```

### `--inspect-brk=[port]`[â](#--inspect-brkport "Direct link to --inspect-brkport")

Like `--inspect` but pauses execution on the first line of JavaScript.

## External Debuggers[â](#external-debuggers "Direct link to External Debuggers")

You will need to use a debugger that supports the V8 inspector protocol.

* Connect Chrome by visiting `chrome://inspect` and selecting to inspect the
launched Electron app present there.
* [Debugging in VSCode](/docs/latest/tutorial/debugging-vscode)

* [Command Line Switches](#command-line-switches)
+ [`--inspect=[port]`](#--inspectport)+ [`--inspect-brk=[port]`](#--inspect-brkport)* [External Debuggers](#external-debuggers)