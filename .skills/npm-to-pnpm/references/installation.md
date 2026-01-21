Installation | pnpm




[Skip to main content](#__docusaurus_skipToContent_fallback)

Learn how to **[Mitigate supply chain attacks with pnpm](https://pnpm.io/supply-chain-security)**

[![](/img/pnpm-no-name-with-frame.svg)![](/img/pnpm-no-name-with-frame.svg)

**pnpm**](/)[Docs](/motivation)[Blog](/blog)[FAQ](/faq)[Benchmarks](/benchmarks)[Community](/community/articles)

[More](#)

* [Blog](/blog)* [FAQ](/faq)* [Community](/community/articles)* [Benchmarks](/benchmarks)

[10.x](/installation)

* [Next](/next/installation)* [10.x](/installation)* [9.x](/9.x/installation)

[English](#)

* [English](/installation)* [Italiano (61%)](/it/installation)* [简体中文 (99%)](/zh/installation)* [日本語 (86%)](/ja/installation)* [한국어 (52%)](/ko/installation)* [Português Brasileiro (61%)](/pt/installation)* [正體中文 (43%)](/zh-TW/installation)* [Русский (38%)](/ru/installation)* [Українська (80%)](/uk/installation)* [Français (50%)](/fr/installation)* [Türkçe (28%)](/tr/installation)* [Español (67%)](/es/installation)* [Bahasa Indonesia (32%)](/id/installation)* [Help Us Translate](https://translate.pnpm.io)

[🧡 Sponsor Us](#)

* [Open Collective](https://opencollective.com/pnpm)* [GitHub Sponsors](https://github.com/sponsors/pnpm)* [Crypto Donations](/crypto-donations)

Search

* [Introduction](/motivation)

  + [Motivation](/motivation)+ [Feature Comparison](/feature-comparison)+ [Installation](/installation)* [Usage](/pnpm-cli)

    * [CLI commands](/cli/add)

      * [Configuration](/package_json)

        * [Features](/package-sources)

          * [Recipes](/using-changesets)

            * [Advanced](/errors)

* * Introduction* Installation
Version: 10.x

On this page

# Installation

## Prerequisites[​](#prerequisites "Direct link to Prerequisites")

If you don't use the standalone script or `@pnpm/exe` to install pnpm, then you need to have Node.js (at least v18.12) to be installed on your system.

## Using a standalone script[​](#using-a-standalone-script "Direct link to Using a standalone script")

You may install pnpm even if you don't have Node.js installed, using the following scripts.

### On Windows[​](#on-windows "Direct link to On Windows")

warning

Sometimes, Windows Defender may block our executable if you install pnpm this way.

Due to this issue, we currently recommend installing pnpm using [npm](#using-npm) or [Corepack](#using-corepack) on Windows.

Using PowerShell:

```
Invoke-WebRequest https://get.pnpm.io/install.ps1 -UseBasicParsing | Invoke-Expression
```

On Windows, Microsoft Defender can significantly slow down installation of packages. You can add pnpm to Microsoft Defender's list
of excluded folders in a PowerShell window with administrator rights by executing:

```
Add-MpPreference -ExclusionPath $(pnpm store path)
```

### On POSIX systems[​](#on-posix-systems "Direct link to On POSIX systems")

```
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

If you don't have curl installed, you would like to use wget:

```
wget -qO- https://get.pnpm.io/install.sh | sh -
```

tip

You may use the [pnpm env](/cli/env) command then to install Node.js.

### In a Docker container[​](#in-a-docker-container "Direct link to In a Docker container")

```
# bash  
wget -qO- https://get.pnpm.io/install.sh | ENV="$HOME/.bashrc" SHELL="$(which bash)" bash -  
# sh  
wget -qO- https://get.pnpm.io/install.sh | ENV="$HOME/.shrc" SHELL="$(which sh)" sh -  
# dash  
wget -qO- https://get.pnpm.io/install.sh | ENV="$HOME/.dashrc" SHELL="$(which dash)" dash -
```

### Installing a specific version[​](#installing-a-specific-version "Direct link to Installing a specific version")

Prior to running the install script, you may optionally set an env variable `PNPM_VERSION` to install a specific version of pnpm:

```
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=<version> sh -
```

## Using Corepack[​](#using-corepack "Direct link to Using Corepack")

Due to an issue with [outdated signatures in Corepack](https://github.com/nodejs/corepack/issues/612), Corepack should be updated to its latest version first:

```
npm install --global corepack@latest
```

Since v16.13, Node.js is shipping [Corepack](https://nodejs.org/api/corepack.html) for managing package managers. This is an experimental feature, so you need to enable it by running:

info

If you have installed Node.js with `pnpm env` Corepack won't be installed on your system, you will need to install it separately. See [#4029](https://github.com/pnpm/pnpm/issues/4029).

```
corepack enable pnpm
```

This will automatically install pnpm on your system.

You can pin the version of pnpm used on your project using the following command:

```
corepack use pnpm@latest-10
```

This will add a `"packageManager"` field in your local `package.json` which will instruct Corepack to always use a specific version on that project. This can be useful if you want reproducability, as all developers who are using Corepack will use the same version as you. When a new version of pnpm is released, you can re-run the above command.

## Using other package managers[​](#using-other-package-managers "Direct link to Using other package managers")

### Using npm[​](#using-npm "Direct link to Using npm")

We provide two packages of pnpm CLI, `pnpm` and `@pnpm/exe`.

* [`pnpm`](https://www.npmjs.com/package/pnpm) is an ordinary version of pnpm, which needs Node.js to run.
* [`@pnpm/exe`](https://www.npmjs.com/package/@pnpm/exe) is packaged with Node.js into an executable, so it may be used on a system with no Node.js installed.

```
npx pnpm@latest-10 dlx @pnpm/exe@latest-10 setup
```

or

```
npm install -g pnpm@latest-10
```

### Using Homebrew[​](#using-homebrew "Direct link to Using Homebrew")

If you have the package manager installed, you can install pnpm using the following command:

```
brew install pnpm
```

### Using winget[​](#using-winget "Direct link to Using winget")

If you have winget installed, you can install pnpm using the following command:

```
winget install -e --id pnpm.pnpm
```

### Using Scoop[​](#using-scoop "Direct link to Using Scoop")

If you have Scoop installed, you can install pnpm using the following command:

```
scoop install nodejs-lts pnpm
```

### Using Choco[​](#using-choco "Direct link to Using Choco")

If you have Chocolatey installed, you can install pnpm using the following command:

```
choco install pnpm
```

### Using Volta[​](#using-volta "Direct link to Using Volta")

If you have Volta installed, you can install pnpm using the following command:

```
volta install pnpm
```

tip

Do you wanna use pnpm on CI servers? See: [Continuous Integration](/continuous-integration).

## Compatibility[​](#compatibility "Direct link to Compatibility")

Here is a list of past pnpm versions with respective Node.js version support.

|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Node.js pnpm 8 pnpm 9 pnpm 10|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | | Node.js 14 ❌ ❌ ❌|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | | Node.js 16 ✔️ ❌ ❌|  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | | Node.js 18 ✔️ ✔️ ✔️|  |  |  |  |  |  |  |  |  |  |  |  | | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | | Node.js 20 ✔️ ✔️ ✔️|  |  |  |  |  |  |  |  | | --- | --- | --- | --- | --- | --- | --- | --- | | Node.js 22 ✔️ ✔️ ✔️|  |  |  |  | | --- | --- | --- | --- | | Node.js 24 ✔️ ✔️ ✔️ | | | | | | | | | | | | | | | | | | | | | | | | | | | |

## Troubleshooting[​](#troubleshooting "Direct link to Troubleshooting")

If pnpm is broken and you cannot fix it by reinstalling, you might need to remove it manually from the PATH.

Let's assume you have the following error when running `pnpm install`:

```
C:\src>pnpm install  
internal/modules/cjs/loader.js:883  
  throw err;  
  ^  
  
  
  
Error: Cannot find module 'C:\Users\Bence\AppData\Roaming\npm\pnpm-global\4\node_modules\pnpm\bin\pnpm.js'  
←[90m    at Function.Module._resolveFilename (internal/modules/cjs/loader.js:880:15)←[39m  
←[90m    at Function.Module._load (internal/modules/cjs/loader.js:725:27)←[39m  
←[90m    at Function.executeUserEntryPoint [as runMain] (internal/modules/run_main.js:72:12)←[39m  
←[90m    at internal/main/run_main_module.js:17:47←[39m {  
  code: ←[32m'MODULE_NOT_FOUND'←[39m,  
  requireStack: []  
}
```

First, try to find the location of pnpm by running: `which pnpm`. If you're on Windows, run `where.exe pnpm.*`.
You'll get the location of the pnpm command, for instance:

```
$ which pnpm  
/c/Program Files/nodejs/pnpm
```

Now that you know where the pnpm CLI is, open that directory and remove any pnpm-related files (`pnpm.cmd`, `pnpx.cmd`, `pnpm`, etc).
Once done, install pnpm again and it should work as expected.

## Using a shorter alias[​](#using-a-shorter-alias "Direct link to Using a shorter alias")

`pnpm` might be hard to type, so you may use a shorter alias like `pn` instead.

#### Adding a permanent alias on POSIX systems[​](#adding-a-permanent-alias-on-posix-systems "Direct link to Adding a permanent alias on POSIX systems")

Just put the following line to your `.bashrc`, `.zshrc`, or `config.fish`:

```
alias pn=pnpm
```

#### Adding a permanent alias in Powershell (Windows):[​](#adding-a-permanent-alias-in-powershell-windows "Direct link to Adding a permanent alias in Powershell (Windows):")

In a Powershell window with admin rights, execute:

```
notepad $profile.AllUsersAllHosts
```

In the `profile.ps1` file that opens, put:

```
set-alias -name pn -value pnpm
```

Save the file and close the window. You may need to close any open Powershell window in order for the alias to take effect.

## Updating pnpm[​](#updating-pnpm "Direct link to Updating pnpm")

To update pnpm, run the [`self-update`](/cli/self-update) command:

```
pnpm self-update
```

## Uninstalling pnpm[​](#uninstalling-pnpm "Direct link to Uninstalling pnpm")

If you need to remove the pnpm CLI from your system and any files it has written to your disk, see [Uninstalling pnpm](/uninstall).

[Edit this page](https://github.com/pnpm/pnpm.io/edit/main/docs/installation.md)

[Previous

Feature Comparison](/feature-comparison)[Next

pnpm CLI](/pnpm-cli)

* [Prerequisites](#prerequisites)* [Using a standalone script](#using-a-standalone-script)
    + [On Windows](#on-windows)+ [On POSIX systems](#on-posix-systems)+ [In a Docker container](#in-a-docker-container)+ [Installing a specific version](#installing-a-specific-version)* [Using Corepack](#using-corepack)* [Using other package managers](#using-other-package-managers)
        + [Using npm](#using-npm)+ [Using Homebrew](#using-homebrew)+ [Using winget](#using-winget)+ [Using Scoop](#using-scoop)+ [Using Choco](#using-choco)+ [Using Volta](#using-volta)* [Compatibility](#compatibility)* [Troubleshooting](#troubleshooting)* [Using a shorter alias](#using-a-shorter-alias)* [Updating pnpm](#updating-pnpm)* [Uninstalling pnpm](#uninstalling-pnpm)

Docs

* [Getting Started](/installation)* [pnpm CLI](/pnpm-cli)* [Workspace](/workspaces)* [Settings (pnpm-workspace.yaml)](/settings)

Community

* [X (Twitter)](https://x.com/pnpmjs)* [YouTube](https://www.youtube.com/@pnpmjs)* [Reddit](https://reddit.com/r/pnpm/)* [Bluesky](https://bsky.app/profile/pnpm.io)

Contributing

* [GitHub](https://github.com/pnpm/pnpm)* [Help Us Translate](https://translate.pnpm.io)

![](/img/pnpm-light.svg)![](/img/pnpm-light.svg)

Copyright © 2015-2026 contributors of pnpm