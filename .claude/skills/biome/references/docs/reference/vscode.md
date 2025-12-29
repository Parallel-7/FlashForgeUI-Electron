# VS Code extension

Biome comes with an official [VS Code extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) that tightly integrates with
your code editor, providing formatting, linting, and code refactoring features to your
development workflow.

This reference document provides an overview of the extension’s features, how to install
it, and how to configure it for your projects.

Tip

If you’re upgrading from the `2.x` version of the extension, check out the [migration instructions](#migrating-from-the-2x-extension) at the end of this document.

## Installing the extension


The recommended way to install the extension is through the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)
for VS Code users, or the [Open VSX registry](https://open-vsx.org/extension/biomejs/biome) for VSCodium and other derivatives such as Cursor.

* [![](https://img.shields.io/badge/Install%20Biome-in%20VS%20Code-007ACC?style=flat&logo=biome)](vscode:extension/biomejs.biome)
* [![](https://img.shields.io/badge/Install%20Biome-in%20VSCodium-007ACC?style=flat&logo=biome)](vscodium:extension/biomejs.biome)

## Common use cases


### Single-root workspaces


A single-root workspace is your typical VS Code workspace, where there is only one workspace folder.

* Directorysrc/
  + main.ts
* biome.json
* package.json

### Multi-root workspaces


A multi-root workspace is a workspace where there are multiple workspace folders. In this case, the extension will automatically create
a Biome instance per workspace folder.

* Directoryapi/ (workspace folder)
  + biome.json
  + Directorysrc/
    - main.ts
* Directoryapp/ (workspace folder)
  + biome.json
  + Directorysrc/
    - main.ts
* my.code-workspace

## Features


### Formatting


The Biome extension registers itself as a formatter for [supported file types](/internals/language-support), and supports formatting a whole file, or a selection of code.

Run either one of the following commands from the [command palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette):

* To format a whole file, run the `Format Document` command.
* To format a selection of code, select the code and run the `Format Selection` command.

#### Formatting on save


To enable formatting on save, set VS Code’s [`editor.formatOnSave`](vscode://settings/editor.formatOnSave) setting to `true`.

### Code fixing


The Biome extension registers itself as a code action provider for [supported file types](/internals/language-support), and provides code fixes for diagnostics
that have safe fixes.

#### Fix on save


To enable **Fix on Save**, update VS Code’s [`editor.codeActionsOnSave`](vscode://settings/editor.codeActionsOnSave) setting to include the following. This will apply only [the safe fixes](/linter/#safe-fixes):

```
{

"editor.codeActionsOnSave": {

"source.fixAll.biome": "explicit"

}

}
```

If you want to apply [unsafe fixes](/linter/#unsafe-fixes) on save, you must make the [code fix of the rule safe](/linter/#configure-the-code-fix).

#### Manual quick fixes


To manually apply a quick fix, select the diagnostic and click the `Quick Fix` button.

### Import sorting


The extension is able to sort imports on save for [supported file types](/internals/language-support). To enable this feature, set VS Code’s [`editor.codeActionsOnSave`](vscode://settings/editor.codeActionsOnSave) setting to include the following:

settings.json

```
{

"editor.codeActionsOnSave": {

"source.organizeImports.biome": "explicit"

}

}
```

## Settings reference


The following settings are available for the extension.

Settings precedence

All settings are resolved using VS Code’s [settings precedence](https://code.visualstudio.com/docs/getstarted/settings#_settings-precedence) rules.
This means that the value of the setting at the most specific level will be used. This allows you to set a global setting, and override it for specific
workspace folders.

### `biome.enabled`


**Default:** `true` | **Scopes:** `global`, `workspace`, `workspace folder`

This setting controls whether the extension will create LSP session for a workspace folder. When set globally, it applies to all workspace folders, unless they themselves override the setting.

### `biome.configurationPath`


Biome v2 only

This setting will only take effect when using Biome `v2`. If you are using Biome `v1`, this setting will be ignored.

**Default:** `null` | **Scopes:** `global`, `workspace`, `workspace folder`

This setting allows you to specify the path to a custom configuration file. If left unspecified, the default configuration file will be used.

### `biome.requireConfiguration`


**Default:** `false` | **Scopes:** `global`, `workspace`, `workspace folder`

This setting controls whether Biome will register itself as a formatter and diagnostics provider.

When set to `true`, the extension will only register itself as a formatter and diagnostics provider if a `biome.json` file is present in the workspace folder.

Caution

The `biome.enabled` setting must be set to `true` (default) in the same scope for this setting to take effect.

### `biome.lsp.bin`


**Default:** `undefined` | **Scopes:** `global`, `workspace`, `workspace folder`

This setting allows you to override the path to the `biome` binary. This is useful if you want to use a different version of Biome,
or if you want to use a binary that’s not on your `PATH`. In can be either a path to a binary, or an object that maps a platform to a path.

* [string](#tab-panel-238)
* [object](#tab-panel-239)

```
{

"biome.lsp.bin": "/path/to/biome"

}
```

When using an object, the key is the platform identifier, constructed from the `<process.os>-<process.arch>` value, and the value is the path to the binary.

```
{

"biome.lsp.bin": {

"darwin-arm64": "/path/to/biome",

"win32-x64": "/path/to/biome.exe"

}

}
```



You should be aware of that `@biomejs/biome` doesn’t ship any binaries. The file `@biomejs/biome/bin` is just a tiny
wrapper that delegates the operation to the real binary. The binary installed on your machine depends on the architecture of your OS and architecture.

The binaries are packages that start with `@biomejs/cli-*`, and can be found in [this list](https://www.npmjs.com/search?q=%40biomejs%2Fcli-*).
So, if you’re pointing to the binary installed via `npm`, the configuration will look like this:

* [string](#tab-panel-240)
* [object](#tab-panel-241)

```
{

"biome.lsp.bin": "./node_modules/@biomejs/cli-linux-x64/bin"

}
```

When using an object, the key is the platform identifier, constructed from the `<process.os>-<process.arch>` value, and the value is the path to the binary.

```
{

"biome.lsp.bin": {

"darwin-arm64": "./node_modules/@biomejs/cli-darwin-arm64/bin",

"win32-x64": "./node_modules/@biomejs/cli-win32-x64/bin"

}

}
```

### `biome.runFromTemporaryLocation`


**Default:** `true (windows), false (others)` | **Scopes:** `global`, `workspace`, `workspace folder`

Whether to copy the Biome binary and run it from a temporary location.

On Windows, disabling this setting will prevent you from updating Biome in your node modules while an active
LSP session is running, because the OS locks the binary while it’s running. You’ll need to close VS Code before updating Biome.

### `biome.suggestInstallingGlobally`


**Default:** `true` | **Scopes:** `global`, `workspace`, `workspace folder`

When a global installation of Biome is required but not found in the `PATH`, the extension will suggest installing it.

This setting controls whether that suggestion popup is shown.

### `biome.lsp.trace.server`


**Default:** `off` | **Scopes:** `global`

This setting allows to set the logging level of the Biome LSP trace. The possible values are `off`, `messages`, `verbose`.
You may want to set this setting to `verbose` when you encounter issues with the extension, and you’d like to share the logs with us.

## Troubleshooting


There may be times when you encounter unexpected issues with the extension. Here a a couple tip to help you troubleshoot
the most common issues, and reset the extension’s state.

### Accessing the LSP trace


If you encounter issues with the extension, we may ask you to share the LSP trace with us. You can do so by setting the [`biome.lsp.trace.server`](#biomelsptrace_server) setting to `verbose`,
and re-running the action that caused the issue. The trace will be made available the [output](vscode://workbrench/panel) panel, under the `Biome LSP trace (xxx)` select option.

## Migrating from the `2.x` extension


If you are migrating from the `2.x` extension, we recommend the following steps, in this exact order:

1. Update the extension
2. Close the editor completely.
3. Open your task manager, and make sure to kill all processes named `biome`.
4. Open your editor.

This will destroy possible old Daemon connections that are still connected to the editor, but can’t be shutdown gracefully by the extension, which caused
some incorrect formatting when a file was saved.

### Changes


* The `biome.lspBin` setting has been deprecated in favor of `biome.lsp.bin`. It will still work for now, but we recommend updating your settings to use the new name.
* The `biome.requireConfigFile` has been renamed to `biome.requireConfiguration`. You should migrate the setting now as **the old is no longer supported**.
