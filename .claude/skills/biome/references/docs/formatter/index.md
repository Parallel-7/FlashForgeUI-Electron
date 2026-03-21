# Formatter

Biome is an opinionated formatter that [supports multiple languages](/internals/language-support).
It follows a similar [philosophy to Prettier](https://prettier.io/docs/en/option-philosophy.html),
only supporting a few options to avoid debates over styles, turning into debates over Biome options.
It deliberately [resists the urge to add new options](https://github.com/prettier/prettier/issues/40) to prevent [bike-shed discussions](https://en.wikipedia.org/wiki/Law_of_triviality) in teams so they can focus on what really matters instead.

## CLI


The following command checks the formatting of the files in the `src` directory.
It emits text differences if it finds code that is not formatted.

* [npm](#tab-panel-157)
* [pnpm](#tab-panel-158)
* [bun](#tab-panel-159)
* [deno](#tab-panel-160)
* [yarn](#tab-panel-161)

```
npx @biomejs/biome format ./src
```

```
pnpm exec biome format ./src
```

```
bunx --bun biome format ./src
```

```
deno run -A npm:@biomejs/biome format ./src
```

```
yarn exec biome format ./src
```



If you want to **apply** the new formatting, pass the `--write` option:

* [npm](#tab-panel-162)
* [pnpm](#tab-panel-163)
* [bun](#tab-panel-164)
* [deno](#tab-panel-165)
* [yarn](#tab-panel-166)

```
npx @biomejs/biome format --write ./src
```

```
pnpm exec biome format --write ./src
```

```
bunx --bun biome format --write ./src
```

```
deno run -A npm:@biomejs/biome format --write ./src
```

```
yarn exec biome format --write ./src
```



The command accepts a list of files and directories.

Caution

If you pass a glob as a parameter, your shell will expand it.
The result of the expansion depends on your shell.
For example, some shells don’t support the recursive glob `**` or the alternation `{}` in the following command:

Terminal window

```
biome format ./src/**/*.test.{js,ts}
```

Shell expansion has a performance cost and a limit on the number of files you can pass to the command.

For more information about all the available options, check the [CLI reference](/reference/cli#biome-format).

## Options


Biome provides some options to tune the behavior of its formatter.
Differently from other tools, Biome separates language-agnostic options from language-specific options.

The formatter options can be set on the [CLI](/reference/cli/#biome-format) or via a [Biome configuration file](/guides/configure-biome).
As of v1.9, Biome supports loading `.editorconfig` files.

It’s recommended to use a [Biome configuration file](/guides/configure-biome) to ensure that both the Biome CLI and the Biome LSP apply the same options.
The following defaults are applied:

biome.json

```
{

"formatter": {

"enabled": true,

"formatWithErrors": false,

"ignore": [],

"attributePosition": "auto",

"indentStyle": "tab",

"indentWidth": 2,

"lineWidth": 80,

"lineEnding": "lf"

},

"javascript": {

"formatter": {

"arrowParentheses":"always",

"bracketSameLine": false,

"bracketSpacing": true,

"jsxQuoteStyle": "double",

"quoteProperties": "asNeeded",

"semicolons": "always",

"trailingCommas": "all"

}

},

"json": {

"formatter": {

"trailingCommas": "none"

}

}

}
```

The main language-agnostic options supported by the Biome formatter are:

* indent style (default: `tab`): Use spaces or tabs for indentation;
* indent width (default: `2`): The number of spaces per indentation level.
* line width (default: `80`): The column width at which Biome wraps code;

See the [configuration reference](/reference/configuration#formatter) for more details.

## Ignore Code


There are times when the formatted code isn’t ideal.

For these cases, you can use a format suppression comment:

example.js

```
// biome-ignore format: <explanation>
```

Example:

example.js

```
const expr =

// biome-ignore format: the array should not be formatted

[

(2 * n) / (r - l),

0,

(r + l) / (r - l),

0,

0,

(2 * n) / (t - b),

(t + b) / (t - b),

0,

0,

0,

-(f + n) / (f - n),

-(2 * f * n) / (f - n),

0,

0,

-1,

0,

];
```

Biome doesn’t provide ignore comments that ignore an entire file.
However, you can [ignore a file using the Biome configuration file](/guides/configure-biome/#ignore-files).
