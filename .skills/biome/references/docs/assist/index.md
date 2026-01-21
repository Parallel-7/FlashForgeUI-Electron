# Assist

Biome Assist offers a series of actions meant to improve code quality and developer experience.

Contrary to linter rules, assist actions always offer a code fix. They might sort properties or fields, simplify binary expressions, perform refactorings, and more. Assist actions are not meant to catch bugs or impose a particular coding style. There are currently **4 assist actions available**.

Assist code fixes are generally safe to apply. If an assist fix breaks your code, we would consider this a bug and appreciate bug reports.

Assist works best in editors and IDEs. However, it’s possible to enforce the use of assist actions even with the CLI. Assist actions are very close to [LSP code actions](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#codeActionKind) in semantics, and they are divided in [groups](#groups).

Biome assist is enabled by default, and some rules are in the recommended rule set. The following example shows how to enable the `useSortedKeys` action:

biome.json

```
{

"assist": {

"enabled": true,

"actions": {

"source": {

"useSortedKeys": "on"

}

}

}

}
```

## Use assist actions in your IDE


If you have an LSP-compatible IDE, then you can configure Biome to execute particular actions on save. Each assist action has a particular code called “code action”. While the majority of names follow the same pattern, there might be few exceptions (e.g. `organizeImports`), so refer to the documentation page of each action to learn to associated code.

First, you need to setup your editor for apply all fixes on save. The configuration changes based on your editor. The code action name is `source.fixAll.biome`:

* [VS Code](#tab-panel-141)
* [Zed](#tab-panel-142)
* [Other editors](#tab-panel-143)

.vscode/settings.json

```
{

"editor.codeActionsOnSave": {

"source.fixAll.biome": "explicit",

}

}
```

.zed/settings.json

```
{

"code_actions_on_format": {

"source.fixAll.biome": true,

}

}
```

Use the source action code `source.fixAll.biome`



Then, you can add the code of each action. For example, the action [`useSortedKeys`](/assist/actions/use-sorted-keys) has a code action called `source.action.useSortedKeys.biome`. If you use VSCode, you can copy this code and place it in the `editor.codeActionsOnSave` section, and Biome will apply it when you save a document:

* [VS Code](#tab-panel-144)
* [Zed](#tab-panel-145)
* [Other editors](#tab-panel-146)

.vscode/settings.json

```
{

"editor.codeActionsOnSave": {

"source.action.useSortedKeys.biome": "explicit",

"source.fixAll.biome": "explicit"

}

}
```

.zed/settings.json

```
{

"code_actions_on_format": {

"source.action.useSortedKeys.biome": true,

"source.fixAll.biome": true

}

}
```

Use the source action code `source.action.useSortedKeys.biome`



## Enforce assist actions via CLI


Assist actions can be enforced via CLI via `check` command:

* [npm](#tab-panel-147)
* [pnpm](#tab-panel-148)
* [bun](#tab-panel-149)
* [deno](#tab-panel-150)
* [yarn](#tab-panel-151)

```
npx @biomejs/biome check
```

```
pnpm exec biome check
```

```
bunx --bun biome check
```

```
deno run -A npm:@biomejs/biome check
```

```
yarn exec biome check
```



However, the `check` is meant for running multiple tools at once, so if you want to check only the assist actions, you should run:

* [npm](#tab-panel-152)
* [pnpm](#tab-panel-153)
* [bun](#tab-panel-154)
* [deno](#tab-panel-155)
* [yarn](#tab-panel-156)

```
npx @biomejs/biome check --formatter-enabled=false --linter-enabled=false
```

```
pnpm exec biome check --formatter-enabled=false --linter-enabled=false
```

```
bunx --bun biome check --formatter-enabled=false --linter-enabled=false
```

```
deno run -A npm:@biomejs/biome check --formatter-enabled=false --linter-enabled=false
```

```
yarn exec biome check --formatter-enabled=false --linter-enabled=false
```



### Don’t enforce assist


By default, Biome enforces assists when running the `check` command. If you wish *to not enforce assist*, you can use the `--enforce-assist` CLI flag to `false`. This way, Biome won’t emit a diagnostic error if some actions haven’t been applied:

Terminal window

```
biome check --enforce-assist=false
```

## Suppression assist actions


You can refer to the [suppression page](/analyzer/suppressions).

## Groups


### Source


This group represents those actions that can be safely applied to a document upon saving. These actions are all generally safe, they typically don’t change the functionality of the program.
