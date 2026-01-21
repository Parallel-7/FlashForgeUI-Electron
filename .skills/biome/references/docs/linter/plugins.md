# Linter Plugins

Biome Linter supports [GritQL](/reference/gritql/) plugins. Currently, these
plugins allow you to match specific code patterns and register customized
diagnostic messages for them.

Here is an example of a plugin that reports on all usages of `Object.assign()`:

```
`$fn($args)` where {

$fn <: `Object.assign`,

register_diagnostic(

span = $fn,

message = "Prefer object spread instead of `Object.assign()`"

)

}
```

You can put a GritQL snippet in a file anywhere in your project, but be mindful
you use the `.grit` extension. Then, you can simply enable it as a plugin with
the following configuration:

```
{

"plugins": ["./path-to-plugin.grit"]

}
```

The plugin will now be enabled on all supported files the linter runs on. You
can see its results when running `biome lint` or `biome check`. For example:

Terminal window

```
$ biome lint

/packages/tailwindcss-config-analyzer/src/introspect.ts:12:17 plugin ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✖ Prefer object spread instead of `Object.assign()`

10 │ function createContextFromConfig(config: Partial<Config>) {

11 │        return createContext(

> 12 │                resolveConfig(Object.assign({}, DEFAULT_CONFIG, config)),

│                              ^^^^^^^^^^^^^

13 │        );

14 │ }
```

## Target Languages


A GritQL snippet always attempts to match against a given *target language*.
If no target language is specified, JavaScript or one of its super languages is
assumed.

If you want to use a different target language, you must specify it explicitly.
For example, here is a CSS plugin to report any selector that sets a color
outside the allowed `.color-*` classes:

```
language css;

`$selector { $props }` where {

$props <: contains `color: $color` as $rule,

not $selector <: r"\.color-.*",

register_diagnostic(

span = $rule,

message = "Don't set explicit colors. Use `.color-*` classes instead."

)

}
```

We currently do not support other target languages than JavaScript and CSS.

## Plugin API


In addition to Grit’s
[built-in functions](https://docs.grit.io/language/functions#built-in-functions),
Biome currently supports one extra function:

### `register_diagnostic()`


Registers a diagnostic to be reported whenever the pattern matches.

Supports three arguments:

* `span` (required): The syntax node to attach the diagnostic to. This is
  typically a variable that you matched within a code snippet.
* `message` (required): The message to show with the diagnostic.
* `severity`: The severity of the diagnostic. Allowed values are: `hint`,
  `info`, `warn`, and `error`. By default, `error` is used.
