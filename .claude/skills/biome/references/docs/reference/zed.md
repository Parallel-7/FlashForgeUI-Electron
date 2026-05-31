# Zed extension

## Installation


Requires Zed >= **v0.131.0**.

This extension is available in the extensions view inside the Zed editor. Open `zed: extensions` and search for *Biome*. It runs the Biome binary under the hood and checks for Biome installations in the following order:

1. Path specified in Zed’s configuration, for example like this:

.zed/settings.json

```
{

"lsp": {

"biome": {

"binary": {

"path": "/var/biome-2.2.3/bin/biome",

"arguments": [

"lsp-proxy"

]

}

}

}

}
```

2. Locally installed Biome via `package.json`
3. System-wide installed Biome in `PATH`

If neither exists, it will ask Zed to install Biome using `npm` and use that.

## Configuration


By default, the biome.json file is required to be in the **root of the workspace**.

Otherwise, it can be configured through the lsp settings:

settings.json

```
{

"lsp": {

"biome": {

"settings": {

"config_path": "<path>/biome.json"

}

}

}

}
```

### Formatting


To use the language server as a formatter, specify biome as your formatter in the settings:

settings.json

```
{

"languages": {

"JavaScript": { "formatter": { "language_server": { "name": "biome" } } },

"TypeScript": { "formatter": { "language_server": { "name": "biome" } } },

"TSX": { "formatter": { "language_server": { "name": "biome" } } },

"JSON": { "formatter": { "language_server": { "name": "biome" } } },

"JSONC": { "formatter": { "language_server": { "name": "biome" } } },

"CSS": { "formatter": { "language_server": { "name": "biome" } } },

"GraphQL": { "formatter": { "language_server": { "name": "biome" } } },

}

}
```

See [Language Support](/internals/language-support) for more information.

### Enable biome only when biome.json is present


settings.json

```
{

"lsp": {

"biome": {

"settings": {

"require_config_file": true

}

}

}

}
```

### Run code actions on format:


settings.json

```
{

"languages": {

"JavaScript": {

"formatter": { "language_server": { "name": "biome" } },

"code_actions_on_format": {

"source.fixAll.biome": true,

"source.organizeImports.biome": true

}

},

"TypeScript": {

"formatter": { "language_server": { "name": "biome" } },

"code_actions_on_format": {

"source.fixAll.biome": true,

"source.organizeImports.biome": true

}

},

"TSX": {

"formatter": { "language_server": { "name": "biome" } },

"code_actions_on_format": {

"source.fixAll.biome": true,

"source.organizeImports.biome": true

}

}

}

}
```

If you want to apply [unsafe fixes](/linter/#unsafe-fixes) on save, you must make the [code fix of the rule safe](/linter/#configure-the-code-fix).

### Project based configuration


You can include these settings in Zed Project Settings (`.zed/settings.json`) at the root of your project folder or as Zed User Settings (`~/.config/zed/settings.json`) which will apply to all projects by default.

#### Disable biome for a particular project


You can exclude biome for a given language (e.g. GraphQL) on project with:

settings.json

```
{

"languages": {

"GraphQL": {

"language_servers": [ "!biome", "..." ]

}

}

}
```

### Global Settings


It is not recommended to add `biome` to top-level `language_servers`, `formatter` or `code_actions_on_format` keys in your Zed setting.json. Specifying biome as `language_server` or `formatter` globally may break functionality for languages that biome does not support (Rust, Python, etc). See [language support](/internals/language-support) for a complete list of supported languages.

This documentation previously recommended global settings; please switch your Zed settings to explicitly configure biome on a per language basis.
