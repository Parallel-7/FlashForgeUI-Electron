# Migrate from ESLint and Prettier

Biome provides dedicated commands to ease the migration from ESLint and Prettier.

If you don’t want to know the details, just run the following commands:

Terminal window

```
biome migrate eslint --write

biome migrate prettier --write
```

## Migrate from ESLint


Many Biome linter rules are inspired by or identical to the ESLint rules or the rules of an ESLint plugin.
We handle some ESLint plugins such as [TypeScript ESLint](https://typescript-eslint.io/), [ESLint JSX A11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y), [ESLint React](https://github.com/jsx-eslint/eslint-plugin-react), and [ESLint Unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn).
However, Biome has its own naming convention for its rules.
Biome uses `camelCaseRuleName` while ESLint uses `kebab-case-rule-name`.
Moreover, Biome has often chosen to use different names to better convey the intent of its rules.
The source of a rule can be found on the page describing the rule.
You can also find the equivalent Biome rule from an ESLint rule using the [dedicated page](/linter/rules-sources).

To ease the migration, Biome provides the `biome migrate eslint` subcommand.
This subcommand will read your ESLint configuration and attempt to port its settings to Biome.
The subcommand is able to handle both the legacy and the flat configuration files.
It supports the `extends` field of the legacy configuration and loads both shared and plugin configurations.
For flat configuration files, the subcommand will attempt to search for JavaScript extension only (`js`, `cjs`, `mjs`) to be loaded into Node.js.
The subcommand needs Node.js to load and resolve all the plugins and `extends` configured in the ESLint configuration file.
The subcommand also migrates `.eslintignore`.

Given the following ESLint configuration:

.eslintrc.json

```
{

"extends": ["plugin:unicorn/recommended"],

"plugins": ["unicorn"],

"ignore_patterns": ["dist/**"],

"globals": {

"Global1": "readonly"

},

"rules": {

"eqeqeq": "error"

},

"overrides": [

{

"files": ["tests/**"],

"rules": {

"eqeqeq": "off"

}

}

]

}
```

And the following Biome configuration:

biome.json

```
{

"linter": {

"enabled": true,

"rules": {

"recommended": true

}

}

}
```

Run the following command to migrate your ESLint configuration to Biome.

* [npm](#tab-panel-182)
* [pnpm](#tab-panel-183)
* [bun](#tab-panel-184)
* [deno](#tab-panel-185)
* [yarn](#tab-panel-186)

```
npx @biomejs/biome migrate eslint --write
```

```
pnpm exec biome migrate eslint --write
```

```
bunx --bun biome migrate eslint --write
```

```
deno run -A npm:@biomejs/biome migrate eslint --write
```

```
yarn exec biome migrate eslint --write
```



The subcommand overwrites your initial Biome configuration.
For example, it disables `recommended`.
This results in the following Biome configuration:

biome.json

```
{

"organizeImports": { "enabled": true },

"linter": {

"enabled": true,

"rules": {

"recommended": false,

"complexity": {

"noForEach": "error",

"noStaticOnlyClass": "error",

"noUselessSwitchCase": "error",

"useFlatMap": "error"

},

"style": {

"noNegationElse": "off",

"useForOf": "error",

"useNodejsImportProtocol": "error",

"useNumberNamespace": "error"

},

"suspicious": {

"noDoubleEquals": "error",

"noThenProperty": "error",

"useIsArray": "error"

}

}

},

"javascript": { "globals": ["Global1"] },

"overrides": [

{

"include": ["tests/**"],

"linter": { "rules": { "suspicious": { "noDoubleEquals": "off" } } }

}

]

}
```

For now, `biome migrate eslint` doesn’t support configuration written in YAML.

By default, Biome doesn’t migrate inspired rules.
You can use the CLI flag `--include-inspired` to migrate them.

* [npm](#tab-panel-187)
* [pnpm](#tab-panel-188)
* [bun](#tab-panel-189)
* [deno](#tab-panel-190)
* [yarn](#tab-panel-191)

```
npx @biomejs/biome migrate eslint --write --include-inspired
```

```
pnpm exec biome migrate eslint --write --include-inspired
```

```
bunx --bun biome migrate eslint --write --include-inspired
```

```
deno run -A npm:@biomejs/biome migrate eslint --write --include-inspired
```

```
yarn exec biome migrate eslint --write --include-inspired
```



Note that you are unlikely to get exactly the same behavior as ESLint because Biome has chosen not to implement some rule options or to deviate slightly from the original implementation.

Since ESLint takes VCS ignore files into account,
we recommend that you enable Biome’s [VCS integration](/guides/integrate-in-vcs).

Caution

Some plugins or shared configurations may export an object with a cyclic reference.
Biome may fail to load such a configuration.

## Migrate from Prettier


Biome tries to match the Prettier formatter as closely as possible.
However, Biome uses different defaults for its formatter.
For example, it uses tabs for indentation instead of spaces.
You can easily migrate to Biome by running `biome migrate prettier --write`.

Given the following Prettier configuration:

.prettierrc.json

```
{

"useTabs": false,

"singleQuote": true,

"overrides": [

{

"files": ["*.json"],

"options": { "tabWidth": 2 }

}

]

}
```

Run the following command to migrate your Prettier configuration to Biome.

* [npm](#tab-panel-192)
* [pnpm](#tab-panel-193)
* [bun](#tab-panel-194)
* [deno](#tab-panel-195)
* [yarn](#tab-panel-196)

```
npx @biomejs/biome migrate prettier --write
```

```
pnpm exec biome migrate prettier --write
```

```
bunx --bun biome migrate prettier --write
```

```
deno run -A npm:@biomejs/biome migrate prettier --write
```

```
yarn exec biome migrate prettier --write
```



This results in the following Biome configuration:

biome.json

```
{

"formatter": {

"enabled": true,

"formatWithErrors": false,

"indentStyle": "space",

"indentWidth": 2,

"lineEnding": "lf",

"lineWidth": 80,

"attributePosition": "auto"

},

"organizeImports": { "enabled": true },

"linter": { "enabled": true, "rules": { "recommended": true } },

"javascript": {

"formatter": {

"jsxQuoteStyle": "double",

"quoteProperties": "asNeeded",

"trailingCommas": "all",

"semicolons": "asNeeded",

"arrowParentheses": "always",

"bracketSpacing": true,

"bracketSameLine": false,

"quoteStyle": "single",

"attributePosition": "auto"

}

},

"overrides": [

{

"include": ["*.json"],

"formatter": {

"indentWidth": 2

}

}

]

}
```

The subcommand needs Node.js to load JavaScript configurations such as `.prettierrc.js`.
`biome migrate prettier` doesn’t support configuration written in JSON5, TOML, or YAML.

Since Prettier takes VCS ignore files into account,
we recommend that you enable Biome’s [VCS integration](/guides/integrate-in-vcs).
