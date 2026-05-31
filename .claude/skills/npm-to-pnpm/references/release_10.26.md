pnpm 10.26 | pnpm




[Skip to main content](#__docusaurus_skipToContent_fallback)

Learn how to **[Mitigate supply chain attacks with pnpm](https://pnpm.io/supply-chain-security)**

[![](/img/pnpm-no-name-with-frame.svg)![](/img/pnpm-no-name-with-frame.svg)

**pnpm**](/)[Docs](/motivation)[Blog](/blog)[FAQ](/faq)[Benchmarks](/benchmarks)[Community](/community/articles)

[More](#)

* [Blog](/blog)* [FAQ](/faq)* [Community](/community/articles)* [Benchmarks](/benchmarks)

[10.x](/motivation)

* [Next](/next/motivation)* [10.x](/motivation)* [9.x](/9.x/motivation)

[English](#)

* [English](/blog/releases/10.26)* [Italiano (61%)](/it/blog/releases/10.26)* [简体中文 (99%)](/zh/blog/releases/10.26)* [日本語 (86%)](/ja/blog/releases/10.26)* [한국어 (52%)](/ko/blog/releases/10.26)* [Português Brasileiro (61%)](/pt/blog/releases/10.26)* [正體中文 (43%)](/zh-TW/blog/releases/10.26)* [Русский (38%)](/ru/blog/releases/10.26)* [Українська (80%)](/uk/blog/releases/10.26)* [Français (50%)](/fr/blog/releases/10.26)* [Türkçe (28%)](/tr/blog/releases/10.26)* [Español (67%)](/es/blog/releases/10.26)* [Bahasa Indonesia (32%)](/id/blog/releases/10.26)* [Help Us Translate](https://translate.pnpm.io)

[🧡 Sponsor Us](#)

* [Open Collective](https://opencollective.com/pnpm)* [GitHub Sponsors](https://github.com/sponsors/pnpm)* [Crypto Donations](/crypto-donations)

Search

All posts

### 2026

* [pnpm 10.28](/blog/releases/10.28)

### 2025

* [pnpm 10.27](/blog/releases/10.27)* [🚀 pnpm in 2025](/blog/2025/12/29/pnpm-in-2025)* [pnpm 10.26](/blog/releases/10.26)* [pnpm 10.25](/blog/releases/10.25)* [How We're Protecting Our Newsroom from npm Supply Chain Attacks](/blog/2025/12/05/newsroom-npm-supply-chain-security)* [pnpm 10.24](/blog/releases/10.24)* [pnpm 10.23](/blog/releases/10.23)* [pnpm 10.22](/blog/releases/10.22)* [pnpm 10.21](/blog/releases/10.21)* [pnpm 10.20](/blog/releases/10.20)* [pnpm 10.19](/blog/releases/10.19)* [pnpm 10.18](/blog/releases/10.18)* [pnpm 10.17](/blog/releases/10.17)* [pnpm 10.16](/blog/releases/10.16)* [pnpm 10.15](/blog/releases/10.15)* [pnpm 10.14](/blog/releases/10.14)

### 2022

* [The year 2022 for pnpm](/blog/2022/12/30/yearly-update)

### 2021

* [The year 2021 for pnpm](/blog/2021/12/29/yearly-update)

### 2020

* [Node-Modules configuration options with pnpm](/blog/2020/10/17/node-modules-configuration-options-with-pnpm)* [Flat node\_modules is not the only way](/blog/2020/05/27/flat-node-modules-is-not-the-only-way)

# pnpm 10.26

December 15, 2025 · 2 min read

[![Zoltan Kochan](https://pbs.twimg.com/profile_images/2005604765028245504/SudRBVMH_400x400.jpg)](https://x.com/ZoltanKochan)

[Zoltan Kochan](https://x.com/ZoltanKochan)

Lead maintainer of pnpm

pnpm 10.26 introduces stricter security defaults for git-hosted dependencies, adds `allowBuilds` for granular script permissions, and includes a new setting to block exotic transitive dependencies.

### Minor Changes[​](#minor-changes "Direct link to Minor Changes")

#### Stricter Git Dependency Security[​](#stricter-git-dependency-security "Direct link to Stricter Git Dependency Security")

**Semi-breaking.** Git-hosted dependencies are now blocked from running `prepare` scripts during installation unless they are explicitly allowed in `onlyBuiltDependencies` (or `allowBuilds`) [#10288](https://github.com/pnpm/pnpm/pull/10288). This change prevents malicious code execution from untrusted git repositories.

#### `allowBuilds`[​](#allowbuilds "Direct link to allowbuilds")

Added a new setting `allowBuilds` which provides a flexible way to manage build scripts. It accepts a map of package matchers to explicitly allow (`true`) or disallow (`false`) script execution. This replaces `onlyBuiltDependencies` and `ignoredBuiltDependencies` as the preferred configuration method [#10311](https://github.com/pnpm/pnpm/pull/10311).

Example:

```
allowBuilds:  
  esbuild: true  
  core-js: false  
  nx@21.6.4 || 21.6.5: true
```

#### `blockExoticSubdeps`[​](#blockexoticsubdeps "Direct link to blockexoticsubdeps")

Added a new setting `blockExoticSubdeps` to improve supply chain security. When set to `true`, it prevents the resolution of exotic protocols (like `git+ssh:` or direct `https:` tarballs) in transitive dependencies. Only direct dependencies are allowed to use exotic sources [#10265](https://github.com/pnpm/pnpm/pull/10265).

#### Integrity Hash for HTTP Tarballs[​](#integrity-hash-for-http-tarballs "Direct link to Integrity Hash for HTTP Tarballs")

**Semi-breaking.** pnpm now computes the integrity hash for HTTP tarball dependencies when fetching them and stores it in the lockfile. This ensures that servers cannot serve altered content on subsequent installs without detection [#10287](https://github.com/pnpm/pnpm/pull/10287).

#### `pnpm pack --dry-run`[​](#pnpm-pack---dry-run "Direct link to pnpm-pack---dry-run")

Added support for `--dry-run` to the `pack` command. This allows you to verify which files would be included in the tarball without actually creating it [#10301](https://github.com/pnpm/pnpm/issues/10301).

### Patch Changes[​](#patch-changes "Direct link to Patch Changes")

* Show deprecation in table/list formats when latest version is deprecated [#8658](https://github.com/pnpm/pnpm/issues/8658).
* Remove the `injectWorkspacePackages` setting from the lockfile on the `deploy` command [#10294](https://github.com/pnpm/pnpm/pull/10294).
* Normalize the tarball URLs before saving them to the lockfile [#10273](https://github.com/pnpm/pnpm/pull/10273).
* Fix URL normalization for redirected immutable dependencies [#10197](https://github.com/pnpm/pnpm/pull/10197).

**Tags:**

* [release](/blog/tags/release)

[Edit this page](https://github.com/pnpm/pnpm.io/edit/main/blog/releases/10.26.md)

[Newer post

🚀 pnpm in 2025](/blog/2025/12/29/pnpm-in-2025)[Older post

pnpm 10.25](/blog/releases/10.25)

* [Minor Changes](#minor-changes)* [Patch Changes](#patch-changes)

Docs

* [Getting Started](/installation)* [pnpm CLI](/pnpm-cli)* [Workspace](/workspaces)* [Settings (pnpm-workspace.yaml)](/settings)

Community

* [X (Twitter)](https://x.com/pnpmjs)* [YouTube](https://www.youtube.com/@pnpmjs)* [Reddit](https://reddit.com/r/pnpm/)* [Bluesky](https://bsky.app/profile/pnpm.io)

Contributing

* [GitHub](https://github.com/pnpm/pnpm)* [Help Us Translate](https://translate.pnpm.io)

![](/img/pnpm-light.svg)![](/img/pnpm-light.svg)

Copyright © 2015-2026 contributors of pnpm