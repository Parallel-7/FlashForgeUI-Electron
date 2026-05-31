# Investigate slowness in Biome

Biome is intended to be fast. *Very fast.* And yet, sometimes it happens that we
fail to live up to that promise. Most often, the cause is a specific file or a
dependency that is causing woes. Or sometimes you accidentally forget to ignore
a `dist/` or a `build/` folder. Whichever the cause, it can be rough to find out
what is causing this slowness, so this guide is intended to help you figure it
out.

## First things first


Before going too deep, we can perform a few steps to see if our issue is caused
by one of the following:

* If you have a `dist/` or `build/` folder with output files, or other such
  folders with minified files, please verify if ignoring those using
  the `!!` syntax in
  [`files.includes`](https://biomejs.dev/reference/configuration/#interaction-with-the-scanner)
  makes a difference.
* Do you have [project rules](/linter/domains/#project) enabled? They are known
  to cause performance overhead, in return for more advanced analysis. Also see
  our [FAQ entry](/linter/#why-is-biome-linter-so-slow-compared-to-v1) on this
  topic. See if disabling them makes a difference.
  + If disabling them does help, but you want to find out what specifically made
    it so slow, a first step can be to add `**/node_modules` to
    [`files.includes`](https://biomejs.dev/reference/configuration/#filesincludes)
    with the `!!` syntax.
    Did that help? Great! But you probably don’t want to keep it like this,
    because type information from dependencies won’t be available anymore. You
    can tweak `files.includes` further to ignore a specific dependency instead
    of the entire `node_modules/` folder, but you will probably want to read on
    to figure out which dependency to ignore…

If none of the above helped, or if they did help, but you want to dig deeper, we
can use tracing to see if there is a specific file that might be the culprit…

## Tracing


Since version 2.0, Biome has improved tracing capabilities to help with this
investigation. Specifically, we’ll combine the following command-line arguments:

* Every Biome CLI command can be passed a `--log-file=<path>` argument, which
  will write all log messages for that invocation to the given path instead of
  stdout.
* The `--log-level=<level>` parameter accepts a `tracing` value. When
  `--log-level=tracing` is used, Biome also prints timing information from
  tracing spans to the log.
* Using `--log-kind=json` we can request Biome to write its logs in JSON format.

If we combine these three arguments, we can create a log file with JSON messages
containing all relevant timing information for Biome. For instance:

Terminal window

```
biome lint --log-level=tracing --log-kind=json --log-file=tracing.json
```

This writes a `tracing.json` file, but it can contain a *lot* of data. So we’ll
use [`jq`](https://github.com/jqlang/jq) to filter through this information.

For example, if you want to figure out which paths take the longest when
building the module graph, you can use the following command:

Terminal window

```
cat tracing.json | jq 'select(.span.name == "update_module_graph_internal") | { path: .span.path, time_busy: .["time.busy"], time_idle: .["time.idle"] }' > filtered.json
```

Now you will have a file called `filtered.json` with all the relevant timings,
together with the paths used during the invocations.

Similarly, if you want to figure out which files were slowest to analyse, you
can use the following command:

Terminal window

```
cat tracing.json | jq '. | select(.span.name == "pull_diagnostics") | { path: .span.path, time_busy: .["time.busy"], time_idle: .["time.idle"] }' > filtered.json
```

Other span names that might be interesting to pull info from:

* `format_file` tells you how long files take to format.
* `open_file_internal` tells you how long files take to open, including parsing.
  It has a `reason` field that also can tell you *why* a file is opened: either
  by the scanner, updated by the watcher, or a client request, which is usually
  for linting or formatting. *(since Biome 2.1.2)*
