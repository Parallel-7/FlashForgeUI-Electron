pnpm install | pnpm




[Skip to main content](#__docusaurus_skipToContent_fallback)

Learn how to **[Mitigate supply chain attacks with pnpm](https://pnpm.io/supply-chain-security)**

[![](/img/pnpm-no-name-with-frame.svg)![](/img/pnpm-no-name-with-frame.svg)

**pnpm**](/)[Docs](/motivation)[Blog](/blog)[FAQ](/faq)[Benchmarks](/benchmarks)[Community](/community/articles)

[More](#)

* [Blog](/blog)* [FAQ](/faq)* [Community](/community/articles)* [Benchmarks](/benchmarks)

[10.x](/cli/install)

* [Next](/next/cli/install)* [10.x](/cli/install)* [9.x](/9.x/cli/install)

[English](#)

* [English](/cli/install)* [Italiano (61%)](/it/cli/install)* [简体中文 (99%)](/zh/cli/install)* [日本語 (86%)](/ja/cli/install)* [한국어 (52%)](/ko/cli/install)* [Português Brasileiro (61%)](/pt/cli/install)* [正體中文 (43%)](/zh-TW/cli/install)* [Русский (38%)](/ru/cli/install)* [Українська (80%)](/uk/cli/install)* [Français (50%)](/fr/cli/install)* [Türkçe (28%)](/tr/cli/install)* [Español (67%)](/es/cli/install)* [Bahasa Indonesia (32%)](/id/cli/install)* [Help Us Translate](https://translate.pnpm.io)

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

* * CLI commands* Manage dependencies* pnpm install
Version: 10.x

On this page

# pnpm install

Aliases: `i`

`pnpm install` is used to install all dependencies for a project.

In a CI environment, installation fails if a lockfile is present but needs an
update.

Inside a [workspace](/workspaces), `pnpm install` installs all dependencies in all the
projects. If you want to disable this behavior, set the `recursive-install`
setting to `false`.

![](/assets/images/pnpm-install-922fbb8bb4d96b8f602a40e6cd07ee13.svg)

## TL;DR[​](#tldr "Direct link to TL;DR")

|  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Command Meaning|  |  |  |  |  |  | | --- | --- | --- | --- | --- | --- | | `pnpm i --offline` Install offline from the store only|  |  |  |  | | --- | --- | --- | --- | | `pnpm i --frozen-lockfile` `pnpm-lock.yaml` is not updated| `pnpm i --lockfile-only` Only `pnpm-lock.yaml` is updated | | | | | | | |

## Options for filtering dependencies[​](#options-for-filtering-dependencies "Direct link to Options for filtering dependencies")

Without a lockfile, pnpm has to create one, and it must be consistent regardless of dependencies
filtering, so running `pnpm install --prod` on a directory without a lockfile would still resolve the
dev dependencies, and it would error if the resolution is unsuccessful. The only exception for this rule
are `link:` dependencies.

Without `--frozen-lockfile`, pnpm will check for outdated information from `file:` dependencies, so
running `pnpm install --prod` without `--frozen-lockfile` on an environment where the target of `file:`
has been removed would error.

### --prod, -P[​](#--prod--p "Direct link to --prod, -P")

* Default: **false**
* Type: **Boolean**

If `true`, pnpm will not install any package listed in `devDependencies` and will remove
those insofar they were already installed.
If `false`, pnpm will install all packages listed in `devDependencies` and `dependencies`.

### --dev, -D[​](#--dev--d "Direct link to --dev, -D")

Only `devDependencies` are installed and `dependencies` are removed insofar they
were already installed.

### --no-optional[​](#--no-optional "Direct link to --no-optional")

`optionalDependencies` are not installed.

## Options[​](#options "Direct link to Options")

### --force[​](#--force "Direct link to --force")

Force reinstall dependencies: refetch packages modified in store, recreate a lockfile and/or modules directory created by a non-compatible version of pnpm. Install all optionalDependencies even they don't satisfy the current environment(cpu, os, arch).

### --offline[​](#--offline "Direct link to --offline")

* Default: **false**
* Type: **Boolean**

If `true`, pnpm will use only packages already available in the store.
If a package won't be found locally, the installation will fail.

### --prefer-offline[​](#--prefer-offline "Direct link to --prefer-offline")

* Default: **false**
* Type: **Boolean**

If `true`, staleness checks for cached data will be bypassed, but missing data
will be requested from the server. To force full offline mode, use `--offline`.

### --no-lockfile[​](#--no-lockfile "Direct link to --no-lockfile")

Don't read or generate a `pnpm-lock.yaml` file.

### --lockfile-only[​](#--lockfile-only "Direct link to --lockfile-only")

* Default: **false**
* Type: **Boolean**

When used, only updates `pnpm-lock.yaml` and `package.json`. Nothing gets written to the `node_modules` directory.

### --fix-lockfile[​](#--fix-lockfile "Direct link to --fix-lockfile")

Fix broken lockfile entries automatically.

### --frozen-lockfile[​](#--frozen-lockfile "Direct link to --frozen-lockfile")

* Default:
  + For non-CI: **false**
  + For CI: **true**, if a lockfile is present
* Type: **Boolean**

If `true`, pnpm doesn't generate a lockfile and fails to install if the lockfile
is out of sync with the manifest / an update is needed or no lockfile is
present.

This setting is `true` by default in [CI environments](https://github.com/watson/ci-info#supported-ci-tools). The following code is used to detect CI environments:

https://github.com/watson/ci-info/blob/44e98cebcdf4403f162195fbcf90b1f69fc6e047/index.js#L54-L61

```
exports.isCI = !!(  
  env.CI || // Travis CI, CircleCI, Cirrus CI, GitLab CI, Appveyor, CodeShip, dsari  
  env.CONTINUOUS_INTEGRATION || // Travis CI, Cirrus CI  
  env.BUILD_NUMBER || // Jenkins, TeamCity  
  env.RUN_ID || // TaskCluster, dsari  
  exports.name ||  
  false  
)
```

### --merge-git-branch-lockfiles[​](#--merge-git-branch-lockfiles "Direct link to --merge-git-branch-lockfiles")

Merge all git branch lockfiles.
[Read more about git branch lockfiles.](/git_branch_lockfiles)

### --reporter=<name>[​](#--reportername "Direct link to --reporter=<name>")

* Default:
  + For TTY stdout: **default**
  + For non-TTY stdout: **append-only**
* Type: **default**, **append-only**, **ndjson**, **silent**

Allows you to choose the reporter that will log debug info to the terminal about
the installation progress.

* **silent** - no output is logged to the console, not even fatal errors
* **default** - the default reporter when the stdout is TTY
* **append-only** - the output is always appended to the end. No cursor manipulations are performed
* **ndjson** - the most verbose reporter. Prints all logs in [ndjson](https://github.com/ndjson/ndjson-spec) format

If you want to change what type of information is printed, use the [loglevel](/settings#loglevel) setting.

### --use-store-server[​](#--use-store-server "Direct link to --use-store-server")

* Default: **false**
* Type: **Boolean**

danger

Deprecated feature

Starts a store server in the background. The store server will keep running
after installation is done. To stop the store server, run `pnpm server stop`

### --shamefully-hoist[​](#--shamefully-hoist "Direct link to --shamefully-hoist")

* Default: **false**
* Type: **Boolean**

Creates a flat `node_modules` structure, similar to that of `npm` or `yarn`.
**WARNING**: This is highly discouraged.

### --ignore-scripts[​](#--ignore-scripts "Direct link to --ignore-scripts")

* Default: **false**
* Type: **Boolean**

Do not execute any scripts defined in the project `package.json` and its
dependencies.

### --filter <package\_selector>[​](#--filter-package_selector "Direct link to --filter <package_selector>")

[Read more about filtering.](/filtering)

### --resolution-only[​](#--resolution-only "Direct link to --resolution-only")

Re-runs resolution: useful for printing out peer dependency issues.

### --cpu=<name>[​](#--cpuname "Direct link to --cpu=<name>")

Added in: v10.14.0

Override CPU architecture of native modules to install. Acceptable values are same as `cpu` field of `package.json`, which comes from `process.arch`.

### --os=<name>[​](#--osname "Direct link to --os=<name>")

Added in: v10.14.0

Override OS of native modules to install. Acceptable values are same as `os` field of `package.json`, which comes from `process.platform`.

### --libc=<name>[​](#--libcname "Direct link to --libc=<name>")

Added in: v10.14.0

Override libc of native modules to install. Acceptable values are same as `libc` field of `package.json`.

[Edit this page](https://github.com/pnpm/pnpm.io/edit/main/docs/cli/install.md)

[Previous

pnpm add <pkg>](/cli/add)[Next

pnpm update](/cli/update)

* [TL;DR](#tldr)* [Options for filtering dependencies](#options-for-filtering-dependencies)
    + [--prod, -P](#--prod--p)+ [--dev, -D](#--dev--d)+ [--no-optional](#--no-optional)* [Options](#options)
      + [--force](#--force)+ [--offline](#--offline)+ [--prefer-offline](#--prefer-offline)+ [--no-lockfile](#--no-lockfile)+ [--lockfile-only](#--lockfile-only)+ [--fix-lockfile](#--fix-lockfile)+ [--frozen-lockfile](#--frozen-lockfile)+ [--merge-git-branch-lockfiles](#--merge-git-branch-lockfiles)+ [--reporter=<name>](#--reportername)+ [--use-store-server](#--use-store-server)+ [--shamefully-hoist](#--shamefully-hoist)+ [--ignore-scripts](#--ignore-scripts)+ [--filter <package\_selector>](#--filter-package_selector)+ [--resolution-only](#--resolution-only)+ [--cpu=<name>](#--cpuname)+ [--os=<name>](#--osname)+ [--libc=<name>](#--libcname)

Docs

* [Getting Started](/installation)* [pnpm CLI](/pnpm-cli)* [Workspace](/workspaces)* [Settings (pnpm-workspace.yaml)](/settings)

Community

* [X (Twitter)](https://x.com/pnpmjs)* [YouTube](https://www.youtube.com/@pnpmjs)* [Reddit](https://reddit.com/r/pnpm/)* [Bluesky](https://bsky.app/profile/pnpm.io)

Contributing

* [GitHub](https://github.com/pnpm/pnpm)* [Help Us Translate](https://translate.pnpm.io)

![](/img/pnpm-light.svg)![](/img/pnpm-light.svg)

Copyright © 2015-2026 contributors of pnpm