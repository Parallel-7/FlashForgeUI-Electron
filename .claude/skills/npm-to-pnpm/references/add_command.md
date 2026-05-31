pnpm add <pkg> | pnpm




[Skip to main content](#__docusaurus_skipToContent_fallback)

Learn how to **[Mitigate supply chain attacks with pnpm](https://pnpm.io/supply-chain-security)**

[![](/img/pnpm-no-name-with-frame.svg)![](/img/pnpm-no-name-with-frame.svg)

**pnpm**](/)[Docs](/motivation)[Blog](/blog)[FAQ](/faq)[Benchmarks](/benchmarks)[Community](/community/articles)

[More](#)

* [Blog](/blog)* [FAQ](/faq)* [Community](/community/articles)* [Benchmarks](/benchmarks)

[10.x](/cli/add)

* [Next](/next/cli/add)* [10.x](/cli/add)* [9.x](/9.x/cli/add)

[English](#)

* [English](/cli/add)* [Italiano (61%)](/it/cli/add)* [简体中文 (99%)](/zh/cli/add)* [日本語 (86%)](/ja/cli/add)* [한국어 (52%)](/ko/cli/add)* [Português Brasileiro (61%)](/pt/cli/add)* [正體中文 (43%)](/zh-TW/cli/add)* [Русский (38%)](/ru/cli/add)* [Українська (80%)](/uk/cli/add)* [Français (50%)](/fr/cli/add)* [Türkçe (28%)](/tr/cli/add)* [Español (67%)](/es/cli/add)* [Bahasa Indonesia (32%)](/id/cli/add)* [Help Us Translate](https://translate.pnpm.io)

[🧡 Sponsor Us](#)

* [Open Collective](https://opencollective.com/pnpm)* [GitHub Sponsors](https://github.com/sponsors/pnpm)* [Crypto Donations](/crypto-donations)

Search

* [Introduction](/motivation)

  * [Usage](/pnpm-cli)

    * [CLI commands](/cli/add)

      + [Manage dependencies](/cli/add)

        - [pnpm add <pkg>](/cli/add)- [pnpm install](/cli/install)- [pnpm update](/cli/update)- [pnpm remove](/cli/remove)- [pnpm link](/cli/link)- [pnpm unlink](/cli/unlink)- [pnpm import](/cli/import)- [pnpm rebuild](/cli/rebuild)- [pnpm prune](/cli/prune)- [pnpm fetch](/cli/fetch)- [pnpm install-test](/cli/install-test)- [pnpm dedupe](/cli/dedupe)+ [Patch dependencies](/cli/patch)

          + [Review dependencies](/cli/audit)

            + [Run scripts](/cli/run)

              + [Manage environments](/cli/env)

                + [Inspect the store](/cli/cat-file)

                  + [Manage cache](/cli/cache-list)

                    + [Misc.](/cli/self-update)* [Configuration](/package_json)

        * [Features](/package-sources)

          * [Recipes](/using-changesets)

            * [Advanced](/errors)

* * CLI commands* Manage dependencies* pnpm add <pkg>
Version: 10.x

On this page

# pnpm add <pkg>

Installs a package and any packages that it depends on.
By default, any new package is installed as a production dependency.

## TL;DR[​](#tldr "Direct link to TL;DR")

|  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Command Meaning|  |  |  |  |  |  |  |  |  |  |  |  | | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | | `pnpm add sax` Save to `dependencies`| `pnpm add -D sax` Save to `devDependencies`| `pnpm add -O sax` Save to `optionalDependencies`| `pnpm add -g sax`  Install package globally|  |  |  |  | | --- | --- | --- | --- | | `pnpm add sax@next` Install from the `next` tag| `pnpm add sax@3.0.0` Specify version `3.0.0` | | | | | | | | | | | | | |

## Supported package sources[​](#supported-package-sources "Direct link to Supported package sources")

pnpm supports installing packages from various sources. See the [Supported package sources](/package-sources) page for detailed documentation on:

* npm registry
* JSR registry
* Workspace packages
* Local file system (tarballs and directories)
* Remote tarballs
* Git repositories (with semver, subdirectories, and more)

## Options[​](#options "Direct link to Options")

### --save-prod, -P[​](#--save-prod--p "Direct link to --save-prod, -P")

Install the specified packages as regular `dependencies`.

### --save-dev, -D[​](#--save-dev--d "Direct link to --save-dev, -D")

Install the specified packages as `devDependencies`.

### --save-optional, -O[​](#--save-optional--o "Direct link to --save-optional, -O")

Install the specified packages as `optionalDependencies`.

### --save-exact, -E[​](#--save-exact--e "Direct link to --save-exact, -E")

Saved dependencies will be configured with an exact version rather than using
pnpm's default semver range operator.

### --save-peer[​](#--save-peer "Direct link to --save-peer")

Using `--save-peer` will add one or more packages to `peerDependencies` and
install them as dev dependencies.

### --save-catalog[​](#--save-catalog "Direct link to --save-catalog")

Added in: v10.12.1

Save the new dependency to the default [catalog](/catalogs).

### --save-catalog-name <catalog\_name>[​](#--save-catalog-name-catalog_name "Direct link to --save-catalog-name <catalog_name>")

Added in: v10.12.1

Save the new dependency to the specified [catalog](/catalogs).

### --config[​](#--config "Direct link to --config")

Added in: v10.8.0

Save the dependency to [configDependencies](/config-dependencies).

### --ignore-workspace-root-check[​](#--ignore-workspace-root-check "Direct link to --ignore-workspace-root-check")

Adding a new dependency to the root workspace package fails, unless the
`--ignore-workspace-root-check` or `-w` flag is used.

For instance, `pnpm add debug -w`.

### --global, -g[​](#--global--g "Direct link to --global, -g")

Install a package globally.

### --workspace[​](#--workspace "Direct link to --workspace")

Only adds the new dependency if it is found in the workspace.

### --allow-build[​](#--allow-build "Direct link to --allow-build")

Added in: v10.4.0

A list of package names that are allowed to run postinstall scripts during installation.

Example:

```
pnpm --allow-build=esbuild add my-bundler
```

This will run `esbuild`'s postinstall script and also add it to the `onlyBuiltDependencies` field of `pnpm-workspace.yaml`. So, `esbuild` will always be allowed to run its scripts in the future.

### --filter <package\_selector>[​](#--filter-package_selector "Direct link to --filter <package_selector>")

[Read more about filtering.](/filtering)

### --cpu=<name>[​](#--cpuname "Direct link to --cpu=<name>")

Added in: v10.14.0

Override CPU architecture of native modules to install. Acceptable values are same as `cpu` field of `package.json`, which comes from `process.arch`.

### --os=<name>[​](#--osname "Direct link to --os=<name>")

Added in: v10.14.0

Override OS of native modules to install. Acceptable values are same as `os` field of `package.json`, which comes from `process.platform`.

### --libc=<name>[​](#--libcname "Direct link to --libc=<name>")

Added in: v10.14.0

Override libc of native modules to install. Acceptable values are same as `libc` field of `package.json`.

[Edit this page](https://github.com/pnpm/pnpm.io/edit/main/docs/cli/add.md)

[Previous

Scripts](/scripts)[Next

pnpm install](/cli/install)

* [TL;DR](#tldr)* [Supported package sources](#supported-package-sources)* [Options](#options)
      + [--save-prod, -P](#--save-prod--p)+ [--save-dev, -D](#--save-dev--d)+ [--save-optional, -O](#--save-optional--o)+ [--save-exact, -E](#--save-exact--e)+ [--save-peer](#--save-peer)+ [--save-catalog](#--save-catalog)+ [--save-catalog-name <catalog\_name>](#--save-catalog-name-catalog_name)+ [--config](#--config)+ [--ignore-workspace-root-check](#--ignore-workspace-root-check)+ [--global, -g](#--global--g)+ [--workspace](#--workspace)+ [--allow-build](#--allow-build)+ [--filter <package\_selector>](#--filter-package_selector)+ [--cpu=<name>](#--cpuname)+ [--os=<name>](#--osname)+ [--libc=<name>](#--libcname)

Docs

* [Getting Started](/installation)* [pnpm CLI](/pnpm-cli)* [Workspace](/workspaces)* [Settings (pnpm-workspace.yaml)](/settings)

Community

* [X (Twitter)](https://x.com/pnpmjs)* [YouTube](https://www.youtube.com/@pnpmjs)* [Reddit](https://reddit.com/r/pnpm/)* [Bluesky](https://bsky.app/profile/pnpm.io)

Contributing

* [GitHub](https://github.com/pnpm/pnpm)* [Help Us Translate](https://translate.pnpm.io)

![](/img/pnpm-light.svg)![](/img/pnpm-light.svg)

Copyright © 2015-2026 contributors of pnpm