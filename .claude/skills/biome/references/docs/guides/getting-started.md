# Getting Started

Biome is best installed as a development dependency of your projects, but it is
also available as a [standalone executable](/guides/manual-installation) that doesn’t require Node.js.

* [npm](#tab-panel-167)
* [pnpm](#tab-panel-168)
* [bun](#tab-panel-169)
* [deno](#tab-panel-170)
* [yarn](#tab-panel-171)

```
npm i -D -E @biomejs/biome
```

```
pnpm add -D -E @biomejs/biome
```

```
bun add -D -E @biomejs/biome
```

```
deno add -D npm:@biomejs/biome
```

```
yarn add -D -E @biomejs/biome
```




Version pinning

`-E` ensures that the package manager pins the version of Biome. See the
[versioning page](/internals/versioning)
for more information about [why pinning the version is important](/internals/versioning#why-pinning-the-version-is-important).

## Configuration


Although Biome can run with zero configuration, you’ll likely want to tweak some
settings to suit your project’s needs, in which case you can run the following
command to generate a `biome.json` configuration file.

* [npm](#tab-panel-172)
* [pnpm](#tab-panel-173)
* [bun](#tab-panel-174)
* [deno](#tab-panel-175)
* [yarn](#tab-panel-176)

```
npx @biomejs/biome init
```

```
pnpm exec biome init
```

```
bunx --bun biome init
```

```
deno run -A npm:@biomejs/biome init
```

```
yarn exec biome init
```



## Usage


Lets get a quick overview of how to use Biome in your project.

### Command-line interface


Biome provides a [command-line interface](/reference/cli) to format, lint, and check your code.

* [npm](#tab-panel-177)
* [pnpm](#tab-panel-178)
* [bun](#tab-panel-179)
* [deno](#tab-panel-180)
* [yarn](#tab-panel-181)

```
# Format all files

npx @biomejs/biome format --write

# Format specific files

npx @biomejs/biome format --write <files>

# Lint files and apply safe fixes to all files

npx @biomejs/biome lint --write

# Lint files and apply safe fixes to specific files

npx @biomejs/biome lint --write <files>

# Format, lint, and organize imports of all files

npx @biomejs/biome check --write

# Format, lint, and organize imports of specific files

npx @biomejs/biome check --write <files>
```

```
# Format all files

pnpm exec biome format --write

# Format specific files

pnpm exec biome format --write <files>

# Lint and apply safe fixes to all files

pnpm exec biome lint --write

# Lint files and apply safe fixes to specific files

pnpm exec biome lint --write <files>

# Format, lint, and organize imports of all files

pnpm exec biome check --write

# Format, lint, and organize imports of specific files

pnpm exec biome check --write <files>
```

```
# Format all files

bunx biome format --write

# Format specific files

bunx biome format --write <files>

# Lint and apply safe fixes to all files

bunx biome lint --write

# Lint files and apply safe fixes to specific files

bunx biome lint --write <files>

# Format, lint, and organize imports of all files

bunx biome check --write

# Format, lint, and organize imports of specific files

bunx biome check --write <files>
```

```
# Format specific files

deno run -A npm:@biomejs/biome format --write <files>

# Format all files

deno run -A npm:@biomejs/biome format --write

# Lint files and apply safe fixes to all files

deno run -A npm:@biomejs/biome lint --write

# Lint files and apply safe fixes to specific files

deno run -A npm:@biomejs/biome lint --write <files>

# Format, lint, and organize imports of all files

deno run -A npm:@biomejs/biome check --write

# Format, lint, and organize imports of specific files

deno run -A npm:@biomejs/biome check --write <files>
```

```
# Format all files

yarn exec biome format --write

# Format specific files

yarn exec biome format --write <files>

# Lint files and apply safe fixes to all files

yarn exec biome lint --write

# Lint files and apply safe fixes to specific files

yarn exec biome lint --write <files>

# Format, lint, and organize imports of all files

yarn exec biome check --write

# Format, lint, and organize imports of specific files

yarn exec biome check --write <files>
```



### Editor integrations


Biome is available as a first-party extension in your favorite editors.

* [VS Code](/guides/editors/first-party-extensions#vs-code)
* [IntelliJ](/guides/editors/first-party-extensions#intellij)
* [Zed](/guides/editors/first-party-extensions#zed)

There are also [community extensions](/guides/editors/third-party-extensions)
for other editors, such as **Vim**, **Neovim**, and **Sublime Text**, to name
a few.

### Continuous Integration


Run `biome ci` as part of your CI pipeline to enforce code quality and consistency
across your team. It works just like the `biome check` command, but is optimized for
CI environments.

* [GitHub Actions](/recipes/continuous-integration#github-actions)
* [GitLab CI](/recipes/continuous-integration#gitlab-ci)

See the [Continuous Integration](/recipes/continuous-integration) recipes for more examples.

## Next Steps


Success! You’re now ready to use Biome. 🥳

* [Migrate from ESLint and Prettier](/guides/migrate-eslint-prettier)
* Learn more about how to [configure Biome](/guides/configure-biome)
* Learn more about how to use and configure the [formatter](/formatter)
* Learn more about how to use and configure the [linter](/linter)
* Get familiar with the [CLI commands and options](/reference/cli)
* Get familiar with the [configuration options](/reference/configuration)
* Join our [community on Discord](https://biomejs.dev/chat)
