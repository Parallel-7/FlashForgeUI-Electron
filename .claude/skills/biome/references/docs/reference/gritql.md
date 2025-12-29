# GritQL

GritQL is a query language for performing structural searches on source code.
This means that trivia such as whitespace or even the type of quotes used in
strings will be ignored in your search query. In addition, it offers many
features that allow you to query syntax structure such as snippets, matching,
nesting, and variables.

GritQL is [open-source](https://github.com/getgrit/gritql/) and created by [Grit.io](https://grit.io/).

Biome uses GritQL for two purposes:

* The [Analyzer Plugins](/linter/plugins).
* The [`biome search`](/reference/cli/#biome-search) command, which we hope to
  extend to our IDE extensions as well.

## Patterns


GritQL queries work through *patterns*. The most common pattern you will see is
the code snippet, which looks like ordinary source code wrapped in backticks:

```
`console.log('Hello, world!')`
```

This pattern will match any call to `console.log()` that is passed the string
`'Hello, world!'`. But because GritQL does *structural* matching, it doesn’t
care about formatting details. This also matches:

```
console.log (

'Hello, world!'

)
```

And so does this (note the change in quotes):

```
console.log("Hello, world!")
```

Note

Most shells interpret backticks as command invocations, which conflicts with
GritQL’s code snippets. So when using the `biome search` command, it’s best to
put *single quotes* around your Grit queries:

Terminal window

```
biome search '`console.log($message)`' # find all `console.log` invocations
```

## Variables


GritQL queries can also have *variables*. The following will match any call to
`console.log()` regardless of the message passed:

```
`console.log($message)`
```

This will match any of the methods on the `console` object too:

```
`console.$method($message)`
```

The same variable name can occur multiple times in a single snippet:

```
`$fn && $fn()`
```

This will match `foo && foo()`, and even `foo.bar && foo.bar()`, but not
`foo && bar()`.

## Conditions


You can add conditions to patterns by using the `where` operator. This is
commonly used together with the *match operator*, `<:`:

```
`console.$method($message)` where {

$method <: `log`

}
```

This query is identical to the `console.log($message)` pattern we saw earlier,
but it gets quickly more interesting when add other operators in the mix:

```
`console.$method($message)` where {

$method <: or { `log`, `info`, `warn`, `error` }

}
```

## Matching Biome Syntax Nodes


For more precise queries, you can match against Biome’s internal syntax nodes directly. Each node is identified by a unique `PascalCase` name.

For example, to find all JavaScript `if` statements, you can match the `JsIfStatement` node:

```
engine biome(1.0)

language js(typescript,jsx)

JsIfStatement() as $stmt where {

register_diagnostic(

span=$stmt,

message="Found an if statement"

)

}
```

You can discover node names for your code by exploring the syntax tree in the [Biome Playground](https://biomejs.dev/playground/). A complete list of all available nodes is also available in the `.ungram` files in the [`xtask/codegen`](https://github.com/biomejs/biome/tree/main/xtask/codegen) directory of the Biome repository.

Caution

Biome’s grammar can change between versions, especially for new languages. This may cause node names to change, which could break your patterns. Be prepared to update your queries when upgrading Biome.

## Language Documentation


For more information about GritQL and its syntax, see the official
[GritQL Language Documentation](https://docs.grit.io/language/overview).

Please keep in mind that Biome doesn’t support all of Grit’s features (yet).

## Integration Status


GritQL support in Biome is actively being worked on. Many things already work,
but bugs are still expected and some features are still outright missing.

For a detailed overview of which GritQL features are supported and which are
still in-progress, please see the GitHub issue:
<https://github.com/biomejs/biome/issues/2582>.

We also have a detailed RFC which guides the direction for our plugin efforts:
<https://github.com/biomejs/biome/discussions/1762>

**tl;dr**: We are working on supporting plugins, which can be either pure GritQL
plugins or JS/TS plugins that use GritQL to select the code they wish to operate
on. Stay tuned!
