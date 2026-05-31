pnpm 10.28 | pnpm




[Skip to main content](#__docusaurus_skipToContent_fallback)

Learn how to **[Mitigate supply chain attacks with pnpm](https://pnpm.io/supply-chain-security)**

[![](/img/pnpm-no-name-with-frame.svg)![](/img/pnpm-no-name-with-frame.svg)

**pnpm**](/)[Docs](/motivation)[Blog](/blog)[FAQ](/faq)[Benchmarks](/benchmarks)[Community](/community/articles)

[More](#)

* [Blog](/blog)* [FAQ](/faq)* [Community](/community/articles)* [Benchmarks](/benchmarks)

[10.x](/motivation)

* [Next](/next/motivation)* [10.x](/motivation)* [9.x](/9.x/motivation)

[English](#)

* [English](/blog/releases/10.28)* [Italiano (61%)](/it/blog/releases/10.28)* [简体中文 (99%)](/zh/blog/releases/10.28)* [日本語 (86%)](/ja/blog/releases/10.28)* [한국어 (52%)](/ko/blog/releases/10.28)* [Português Brasileiro (61%)](/pt/blog/releases/10.28)* [正體中文 (43%)](/zh-TW/blog/releases/10.28)* [Русский (38%)](/ru/blog/releases/10.28)* [Українська (80%)](/uk/blog/releases/10.28)* [Français (50%)](/fr/blog/releases/10.28)* [Türkçe (28%)](/tr/blog/releases/10.28)* [Español (67%)](/es/blog/releases/10.28)* [Bahasa Indonesia (32%)](/id/blog/releases/10.28)* [Help Us Translate](https://translate.pnpm.io)

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

# pnpm 10.28

January 10, 2026 · 2 min read

[![Zoltan Kochan](https://pbs.twimg.com/profile_images/2005604765028245504/SudRBVMH_400x400.jpg)](https://x.com/ZoltanKochan)

[Zoltan Kochan](https://x.com/ZoltanKochan)

Lead maintainer of pnpm

pnpm 10.28 introduces a new `beforePacking` hook to customize package.json at publish time, improves filtered install performance, and includes several bug fixes.

### Minor Changes[​](#minor-changes "Direct link to Minor Changes")

#### `beforePacking` Hook[​](#beforepacking-hook "Direct link to beforepacking-hook")

Added support for a new hook called `beforePacking` that allows you to customize the `package.json` contents at publish time [#3816](https://github.com/pnpm/pnpm/issues/3816).

This hook is called just before creating the tarball when running `pnpm pack` or `pnpm publish`. It gives you the opportunity to modify the package manifest that will be included in the published package without affecting your local `package.json` file.

Example usage in `.pnpmfile.cjs`:

```
module.exports = {  
  hooks: {  
    beforePacking(pkg) {  
      // Remove development-only fields  
      delete pkg.devDependencies  
      delete pkg.scripts  
      // Add publication metadata  
      pkg.publishedAt = new Date().toISOString()  
      return pkg  
    }  
  }  
}
```

See the [.pnpmfile.cjs documentation](/pnpmfile#hooksbeforepackingpkg-pkg--promisepkg) for more details.

#### Filtered Install Performance[​](#filtered-install-performance "Direct link to Filtered Install Performance")

In some cases, a filtered install (i.e. `pnpm install --filter ...`) was slower than running `pnpm install` without any filter arguments. This performance regression is now fixed. Filtered installs should be as fast or faster than a full install [#10408](https://github.com/pnpm/pnpm/pull/10408).

### Patch Changes[​](#patch-changes "Direct link to Patch Changes")

* Do not add a symlink to the project into the store's project registry if the store is in a subdirectory of the project [#10411](https://github.com/pnpm/pnpm/issues/10411).
* It should be possible to declare the `requiredScripts` setting in `pnpm-workspace.yaml` [#10261](https://github.com/pnpm/pnpm/issues/10261).

**Tags:**

* [release](/blog/tags/release)

[Edit this page](https://github.com/pnpm/pnpm.io/edit/main/blog/releases/10.28.md)

[Older post

pnpm 10.27](/blog/releases/10.27)

* [Minor Changes](#minor-changes)* [Patch Changes](#patch-changes)

Docs

* [Getting Started](/installation)* [pnpm CLI](/pnpm-cli)* [Workspace](/workspaces)* [Settings (pnpm-workspace.yaml)](/settings)

Community

* [X (Twitter)](https://x.com/pnpmjs)* [YouTube](https://www.youtube.com/@pnpmjs)* [Reddit](https://reddit.com/r/pnpm/)* [Bluesky](https://bsky.app/profile/pnpm.io)

Contributing

* [GitHub](https://github.com/pnpm/pnpm)* [Help Us Translate](https://translate.pnpm.io)

![](/img/pnpm-light.svg)![](/img/pnpm-light.svg)

Copyright © 2015-2026 contributors of pnpm