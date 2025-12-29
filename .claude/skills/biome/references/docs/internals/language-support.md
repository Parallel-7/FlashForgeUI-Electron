# Language support

Legend:

* ✅: Supported
* 🚫: Not in progress
* ⌛️: In progress
* 🟡: Experimental

| Language | Parsing | Formatting | Linting | Plugin Support |
| --- | --- | --- | --- | --- |
| [JavaScript](#javascript-support) | ✅ | ✅ | ✅ | ✅ |
| [TypeScript](#typescript-support) | ✅ | ✅ | ✅ | ✅ |
| JSX | ✅ | ✅ | ✅ | ✅ |
| TSX | ✅ | ✅ | ✅ | ✅ |
| JSON | ✅ | ✅ | ✅ | 🚫 |
| JSONC | ✅ | ✅ | ✅ | 🚫 |
| HTML\* | ✅ | ✅ | ✅ | ✅ |
| [Vue](#html-super-languages-support) | 🟡 | 🟡 | 🟡 | 🟡 |
| [Svelte](#html-super-languages-support) | 🟡 | 🟡 | 🟡 | 🟡 |
| [Astro](#html-super-languages-support) | 🟡 | 🟡 | 🟡 | 🟡 |
| CSS | ✅️ | ✅️ | ✅️ | ✅ |
| [YAML](https://github.com/biomejs/biome/issues/2365) | ⌛️ | 🚫 | 🚫 | 🚫 |
| GraphQL | ✅️ | ✅️ | ✅️ | 🚫 |
| [Markdown](https://github.com/biomejs/biome/issues/3718) | ⌛️ | 🚫 | 🚫 | 🚫 |
| GritQL | ✅️ | ✅️ | 🚫 | 🚫 |

*\* currently requires [explicit opt-in](https://biomejs.dev/reference/configuration/#html)*

## JavaScript support


Biome supports the ES2024 version of the language.

Biome supports only the official syntax. The team starts development of the new syntax when a proposal reaches
[Stage 3](https://github.com/tc39/proposals#stage-3).

## TypeScript support


Biome supports TypeScript version 5.6.

## JSONC support


JSONC stands for “JSON with Comments.” This format is widely used by various tools like [VS Code](https://code.visualstudio.com/docs/languages/json#_json-with-comments), [TypeScript](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html), [Babel](https://babeljs.io/docs/config-files), etc. because it lets users add comments to configuration files. However, since JSONC isn’t a strictly defined standard, there’s some variation in how different tools handle trailing commas in JSONC files. To accommodate this, Biome doesn’t provide a dedicated language configuration for JSONC. Instead, we’ve enhanced our JSON parsing and formatting capabilities with options like `json.parser.allowComments`, `json.parser.allowTrailingCommas`, and `json.formatter.trailingCommas`. This approach allows Biome to effectively support different variants of JSON files.

For files with an extension name of `.jsonc` or those identified as `jsonc` according to the [language identifier](https://code.visualstudio.com/docs/languages/identifiers), Biome automatically applies the following default settings for parsing and formatting them:

* `json.parser.allowComments`: `true`
* `json.parser.allowTrailingCommas`: `true`
* `json.formatter.trailingCommas`: `none`

Please note, some well-known files like `tsconfig.json` and `.babelrc` don’t use the `.jsonc` extension but still allow comments and trailing commas. While others, such as `.eslintrc.json`, only allow comments. Biome is able to identify these files and adjusts the `json.parser.allowTrailingCommas` option accordingly to ensure they are correctly parsed.

[This section](/guides/configure-biome#well-known-files) gives the full list of well-known files that Biome can recognize.

## HTML super languages support


Since version `v2.3.0`, Biome supports Vue, Svelte and Astro file out of the box. This means that Biome is able to format and lint the HTML, CSS and JavaScript parts of the files.

However, this **support must be considered experimental** and subject to changes and improvements. In `v2.3.0`, we landed the architecture that enables this feature, however some formatting and linting rules must be adjusted.

In particular, as for `v2.3.0`, Biome doesn’t do any particular parsing for language specific syntax, for example the control-flow syntax of Svelte e.g. `{#if } {/if}`. This means that formatting might not match the desired expectations, and lint rules might not detect some cases.

Lint rules that work across embedded languages aren’t supported yet.

### Linting HTML-ish languages


Some lint rules don’t work across boundaries just yet. For example, the following `.vue` file, the rule `noUnusedVariables` will flag a false positive for `greeting`:

app.vue

```
<script setup lang="ts">

const greeting = "hello world"

</script>

<template>

<h1>{{ greeting }}</h1>

</template>
```

When **linting** `.svelte`, `.astro` or `.vue` files, it’s advised to turn off a few additional rules to prevent false positive linting errors caused by our partial support. Use the option `overrides` for that:

```
{

"overrides": [

{

"includes": ["**/*.svelte", "**/*.astro", "**/*.vue"],

"linter": {

"rules": {

"style": {

"useConst": "off",

"useImportType": "off"

},

"correctness": {

"noUnusedVariables": "off",

"noUnusedImports": "off"

}

}

}

}

]

}
```

### Formatting with different settings


With Biome, you can control the formatting of different languages. Now that Biome can process multiple languages in the same file,
the chances of inconsistencies can grow based on your configuration.

For example, you could risk having a file mixed with tabs and spaces when formatting a HTML-ish file that contains JavaScript and CSS code, like in the following example (we assume full support is enabled):

```
{

"javascript": {

"format": {

"indentStyle": "tab"

}

},

"css": {

"format": {

"indentStyle": "space",

"indentWidth": 4

}

}

}
```

We created a [GitHub discussion](https://github.com/biomejs/biome/discussions/7754) to address the issue, join the discussion and let us know what you think.

Note

This last section might become outdated, so it’s advised to use the [playground](https://biomejs.dev/playground), and check if your feature has been implemented.
