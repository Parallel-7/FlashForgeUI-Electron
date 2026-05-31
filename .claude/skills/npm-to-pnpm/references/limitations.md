Limitations | pnpm




[Skip to main content](#__docusaurus_skipToContent_fallback)

Learn how to **[Mitigate supply chain attacks with pnpm](https://pnpm.io/supply-chain-security)**

[![](/img/pnpm-no-name-with-frame.svg)![](/img/pnpm-no-name-with-frame.svg)

**pnpm**](/)[Docs](/motivation)[Blog](/blog)[FAQ](/faq)[Benchmarks](/benchmarks)[Community](/community/articles)

[More](#)

* [Blog](/blog)* [FAQ](/faq)* [Community](/community/articles)* [Benchmarks](/benchmarks)

[10.x](/limitations)

* [Next](/next/limitations)* [10.x](/limitations)* [9.x](/9.x/limitations)

[English](#)

* [English](/limitations)* [Italiano (61%)](/it/limitations)* [简体中文 (99%)](/zh/limitations)* [日本語 (86%)](/ja/limitations)* [한국어 (52%)](/ko/limitations)* [Português Brasileiro (61%)](/pt/limitations)* [正體中文 (43%)](/zh-TW/limitations)* [Русский (38%)](/ru/limitations)* [Українська (80%)](/uk/limitations)* [Français (50%)](/fr/limitations)* [Türkçe (28%)](/tr/limitations)* [Español (67%)](/es/limitations)* [Bahasa Indonesia (32%)](/id/limitations)* [Help Us Translate](https://translate.pnpm.io)

[🧡 Sponsor Us](#)

* [Open Collective](https://opencollective.com/pnpm)* [GitHub Sponsors](https://github.com/sponsors/pnpm)* [Crypto Donations](/crypto-donations)

Search

* [Introduction](/motivation)

  * [Usage](/pnpm-cli)

    * [CLI commands](/cli/add)

      * [Configuration](/package_json)

        * [Features](/package-sources)

          * [Recipes](/using-changesets)

            * [Advanced](/errors)

              + [Error Codes](/errors)+ [Logos](/logos)+ [Limitations](/limitations)+ [Symlinked `node\_modules` structure](/symlinked-node-modules-structure)+ [How peers are resolved](/how-peers-are-resolved)+ [Uninstalling pnpm](/uninstall)+ [pnpm vs npm](/pnpm-vs-npm)

* * Advanced* Limitations
Version: 10.x

# Limitations

1. `npm-shrinkwrap.json` and `package-lock.json` are ignored. Unlike pnpm, npm
   can install the same `name@version` multiple times and with different sets of
   dependencies. npm's lockfile is designed to reflect the flat `node_modules`
   layout, however, as pnpm creates an isolated layout by default, it cannot respect
   npm's lockfile format. See [pnpm import](/cli/import) if you wish to convert a lockfile to
   pnpm's format, though.
2. Binstubs (files in `node_modules/.bin`) are always shell files, not
   symlinks to JS files. The shell files are created to help pluggable CLI apps
   in finding their plugins in the unusual `node_modules` structure. This is very
   rarely an issue and if you expect the file to be a JS file, reference the
   original file directly instead, as described in [#736](https://github.com/pnpm/pnpm/issues/736).

Got an idea for workarounds for these issues?
[Share them.](https://github.com/pnpm/pnpm/issues/new)

[Edit this page](https://github.com/pnpm/pnpm.io/edit/main/docs/limitations.md)

[Previous

Logos](/logos)[Next

Symlinked `node\_modules` structure](/symlinked-node-modules-structure)

Docs

* [Getting Started](/installation)* [pnpm CLI](/pnpm-cli)* [Workspace](/workspaces)* [Settings (pnpm-workspace.yaml)](/settings)

Community

* [X (Twitter)](https://x.com/pnpmjs)* [YouTube](https://www.youtube.com/@pnpmjs)* [Reddit](https://reddit.com/r/pnpm/)* [Bluesky](https://bsky.app/profile/pnpm.io)

Contributing

* [GitHub](https://github.com/pnpm/pnpm)* [Help Us Translate](https://translate.pnpm.io)

![](/img/pnpm-light.svg)![](/img/pnpm-light.svg)

Copyright © 2015-2026 contributors of pnpm