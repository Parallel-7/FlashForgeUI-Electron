# Upgrade to Biome v2

If you have a project that uses Biome v1, and you want to upgrade to v2, this guide will provide all the information
you need.

## Upgrade via CLI


1. Use your package manager to install the version `2.0.6` of Biome:

   * [npm](#tab-panel-197)
   * [pnpm](#tab-panel-198)
   * [bun](#tab-panel-199)
   * [deno](#tab-panel-200)
   * [yarn](#tab-panel-201)

   ```
   npm install --save-dev --save-exact @biomejs/biome@2.0.6
   ```

   ```
   pnpm add --save-dev --save-exact @biomejs/biome@2.0.6
   ```

   ```
   bun add --dev --exact @biomejs/biome@2.0.6
   ```

   ```
   deno add --dev npm:@biomejs/biome@2.0.6
   ```

   ```
   yarn add --dev --exact @biomejs/biome@2.0.6
   ```
2. Run the `migrate` command to update the configuration:

   * [npm](#tab-panel-202)
   * [pnpm](#tab-panel-203)
   * [bun](#tab-panel-204)
   * [deno](#tab-panel-205)
   * [yarn](#tab-panel-206)

   ```
   npx @biomejs/biome migrate --write
   ```

   ```
   pnpm exec biome migrate --write
   ```

   ```
   bunx --bun biome migrate --write
   ```

   ```
   deno run -A npm:@biomejs/biome migrate --write
   ```

   ```
   yarn exec biome migrate --write
   ```
3. You’re all set! The `migrate` command should have updated your configuration to *mitigate* possible [breaking changes](#breaking-changes). Do check the output of the command however; in some cases it’s possible that you need to perform some manual steps. If so, the migrate command will point them out to you.

## Breaking changes


While the project and team are committed to reducing the number of breaking changes, v2 comes with some breakages that are worth explaining. This section will walk through the most relevant ones, and it will explain the reasons of the breaking change and provide a solution, if applicable.

### Rome-related features aren’t supported anymore


All features related to the old Rome project aren’t supported anymore. If you still relied on those features, you must upgrade your project:

* rename `rome.json` to `biome.json`.
* rename `// rome-ignore` to `// biome-ignore`.
* rename `ROME_BINARY` to `BIOME_BINARY`.
* the suppression comment format `// biome-ignore lint(<GROUP_NAME>/<RULE_NAME>): <explanation>` is no longer supported. use `// biome-ignore lint/<GROUP_NAME>/<RULE_NAME>: <explanation>` instead.

### The option `--config-path` is removed


The CLI option `--config-path` is removed from the commands `biome lsp-proxy` and `biome start`.

The option was overriding the configuration path for all workspaces opened in the Biome daemon, which led to a configuration mismatch problem when multiple projects are opened in some editors or IDEs.

If you use an LSP-compatible editor, you can use its settings to define the configuration path of the project.

* [Zed](#tab-panel-207)
* [VS Code](#tab-panel-208)

.zed/settings.json

```
{

"lsp": {

"biome": {

"settings": {

"configuration_path": "./frontend/biome.json"

}

}

}

}
```

.vscode/settings.json

```
{

"biome.lsp": {

"configurationPath": "./frontend/biome.json"

}

}
```



If you are a developer of a plugin, please update your plugin to use the `workspace/configuration` response instead of using the `--config-path` argument. Biome’s LSP will resolve a configuration in the workspace automatically, so it is recommended to keep it empty unless you are using a custom configuration path.

### The options `ignore` and `include` are removed, and replaced by `includes`


If you ran the command `migrate` already, you shouldn’t have regressions. The reason why these two fields were merged into a single new one was because the implementation of Biome’s old glob engine was flawed, causing some edge cases that we couldn’t fix unless we changed our engine. Unfortunately, we couldn’t do this without breaking changes.

The previous glob engine would prepend the matcher `**/`to any user-provided glob. Which means that the glob `src/**` was always converted to `**/src/**`, causing some unexpected behavior in some cases:

|  | `/projectA/src/file.js` | `src/file.js` | `/projectB/frontend/src/file.js` |
| --- | --- | --- | --- |
| `src/**` | Glob *doesn’t* match path | Glob matches path | Glob *doesn’t* match path |
| `**/src/**` | Glob matches path | Glob matches path | Glob matches |

As you can see, the glob `**/src/**` is **too** eager, and it matches paths that shouldn’t have, for example `/Users/www/projectB/frontend/src/file.js`.

From v2, Biome **won’t prepend `**/`** to globs anymore.

In the previous glob engine the pattern `*` matched against any sequence of characters, including the path separator `/`.
Which means that the glob `**/src/*.js` was always converted to `**/src/**/*.js`.
From v2, Biome `*` **won’t match the path separator `/`**.

### Paths and globs are now relative to the configuration file


In v1, globs and files declared in the configuration file were relative to the working directory. This behavior could cause some unexpected behaviour, especially if coming from other tools.

In the following example, the configuration file is at root of the project, the `check` command is run from a subdirectory and configured to analyze only files inside the `src/` folder.

* biome.json
* Directorysrc/
  + deploy.js
* Directoryui/
  + package.json
  + Directorysrc/
    - main.tsx
    - utils.ts

ui/package.json

```
{

"name": "@org/ui",

"publish": false,

"scripts": {

"check": "biome check"

}

}
```

biome.json

```
{

"files": {

"includes": ["src/**"]

}

}
```

In **v1**, when you run `npm run check`, the following happens:

* Biome looks for `biome.json` inside `ui/`
* No configuration file found, Biome starts checking the parent folders
* Biome finds `biome.json` **in the parent folder**
* The *working directory* is `ui/`, because that’s where the CLI commands was ran
* Biome prepend `ui/` to `src/**`
* The glob `ui/src/**` matches `ui/src/main.tsx` and `ui/src/utils.ts`, but it doesn’t match `src/deploy.js`
* Two files are analyzed

In **v2**, when you run `npm run check`, the following happens:

* Biome looks for `biome.json` inside `ui/`
* No configuration file found, Biome starts checking the parent folders
* Biome finds `biome.json` **in the parent folder**
* The glob `src/**` doesn’t match `ui/src/main.tsx` and `ui/src/utils.ts`, but matches `src/deploy.js`
* One file is analyzed

To match the previous behavior, the glob must be updated to `ui/src/**`:

biome.json

```
{

"files": {

"includes": ["ui/src/**"]

}

}
```

### The option `all` is removed from the linter


In the very early versions of Biome, we introduced `all` as a mean to enable all rules of the linter, or enable all rules that belong to a group. At that time, Biome had few rules, and their maintenance cost was very low to the maintainers and the end-users. We didn’t think twice, and we just added it.

Now Biome has more than 300 rules, and some of those rules *conflict with each other*, causing situations where a project can’t fix the violations of the rules, because one fix triggers another rule, and vice versa.

We decided to **take a step back**, remove the option, and introduce it in the future in some other form, maybe with different semantics and configuration. We are aware that this breaking change can cause some inconvenience.

The maintainers of the project are already discussing the topic on Discord and [GitHub](https://github.com/biomejs/biome/issues/5764). You are encouraged to take part in the conversation and help us find a good solution.

As *limited* workaround, you can enable the recommended rules, and enable all the linter domains. However, you can’t disable single rules, and the domains `react` and `solid` enable rules that conflict with each other:

biome.json

```
{

"linter": {

"domains": {

"next": "all",

"react": "all",

"test": "all",

"solid": "all",

"project": "all"

},

"rules": {

"recommended": true

}

}

}
```

### Syntax `assert` no longer supported


The `assert` syntax, which reached Stage 3, is no longer supported, and it was replaced by the `with` syntax.

All LTS versions of Node.js support the new syntax, as well as all browser engines and serverless runtimes.

```
import {test} from "foo.json" assert { for: "for" }

export * from "mod" assert { type: "json" }

import {test} from "foo.json" with { for: "for" }

export * from "mod" with { type: "json" }
```

### The linter works differently


In v1, the linter worked as follows:

* The recommended rules, by default, emit only diagnostics with error.
* The non-recommended rules needed to be manually enabled, and the user had to decide the severity.

This way of working was a bit different from other linters (ESLint, clippy, golint, etc.), and it was very limited.

In v2, the linter works like other linters do, which means the following:

* Every rule is associated with a default severity level, suggested by Biome.
* The recommended rules can emit diagnostics of different severity.
* Users can now avail of the default severity of a rule, or choose the severity themselves.

If you relied on recommended rules to always emit an error, the `biome migrate` command will set the severity of those rules to `"error"`.

### `style` rules don’t emit errors anymore


We received a lot of great feedback in the past months regarding our recommended rules. We realized that it’s challenging to balance a “recommended” set of rules for our users. While some really liked our defaults, others thought that they were too noisy.

From v2, all rules that belong to the `style` group won’t emit an error unless configured otherwise. The `biome migrate` command will update the configuration so they still emit errors if you had them enabled. Make sure that the configuration conforms to your standards.

### Different default formatting of `package.json`


Biome now formats `package.json` with different defaults. Now objects and arrays are always formatted on multiple lines, regardless of their width:

package.json

```
{ "name": "project", "dependencies": { "foo": "^1.0.0" } }

{

"name": "project",

"dependencies": {

"foo": "^1.0.0"

}

}
```

If you liked the previous formatting style, you’ll have to add an override to the configuration, and use the `"auto"` as value of the `expand` option:

biome.json

```
{

"overrides": [{

"includes": ["package.json"],

"json": {

"formatter": {

"expand": "auto"

}

}

}]

}
```

### The import organizer sorts the imports differently


Biome v2 comes with a new import organizer with many new features:

* It supports customizing the sorting.
* It organizes `export` statements.
* It ignores blank lines between `import` statements.
* It merges `import`/`export`.
* Its default sorting is more consistent than before.

All these changes can lead to different sorting of the imports and exports of your project.
The configuration has also been moved from a dedicated `organizeImports` field to an [assist action](/assist/).
`biome migrate` takes care of moving the configuration as follows:

biome.json

```
{

"organizeImports": { "enabled": true }

"assist": { "actions": { "source": { "organizeImports": "on" } } }

}
```

One significant difference between the old and new default sorters is that Node.js modules without the `node:` protocol are no longer placed before other imports.
For example, the following imports were sorted in Biome 1.x:

```
import fs from "node:fs";

import path from "path";

import pkg from "@a/package";
```

In Biome 2.0, they are sorted as follows:

```
import fs from "node:fs";

import pkg from "@a/package";

import path from "path";
```

To restore the old behavior, use a custom order as follows:

biome.jsonc

```
{

"assist": {

"actions": {

"source": {

"organizeImports": {

"level": "on",

"options": {

"groups": [

// Bun modules

":BUN:",

// Node.js modules

":NODE:",

// Modules imported with the `npm:` protocol

["npm:*", "npm:*/**"],

// Modules imported with another protocol. e.g. `jsr:`

":PACKAGE_WITH_PROTOCOL:",

// URLs

":URL:",

// Libraries

":PACKAGE:",

// Absolute paths

["/**"],

// Sharp aliases

["#*", "#*/**"],

// All other paths

":PATH:"

]

}

}

}

}

}

}
```

Please note that it is not possible to achieve exactly the same behavior as Biome v1.x.
We recommend using the new default, which is much more consistent and simpler.

Read [the documentation of the import organizer](/assist/actions/organize-imports/) for more details.

### Zed extension `v0.2.0` isn’t compatible with v1


The new version of the Zed extension isn’t compatible with Biome v1, because `--config-path` isn’t supported anymore. The team
tried to maintain backwards compatibility, but unfortunately Zed has very limited debugging capabilities for extension authors.

### VS Code extension v3 needs complete restart


While this isn’t directly related to Biome v2, the new version of the VS Code extension uses a different method to connect to the
Biome Daemon. If you upgrade the extension, it’s possible you might experience **incorrect code** upon save if you use `"source.fixAll.biome": "explicit"`.
To fix this, you need to:

1. upgrade the extension;
2. close the editor;
3. kill possible dangling `biome` processes;
4. restart the editor;
