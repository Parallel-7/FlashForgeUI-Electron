# HTML Rules

Below the list of rules supported by Biome, divided by group. Here’s a legend of the emojis:

* The icon  indicates that the rule is part of the recommended rules.
* The icon  indicates that the rule provides a code action (fix) that is **safe** to apply.
* The icon  indicates that the rule provides a code action (fix) that is **unsafe** to apply.
* The icon  indicates that the rule has been implemented and scheduled for the next release.

## `a11y`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noHeaderScope](/linter/rules/no-header-scope) | The scope prop should be used only on `<th>` elements. |  |

## `nursery`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noAmbiguousAnchorText](/linter/rules/no-ambiguous-anchor-text) | Disallow ambiguous anchor descriptions. |  |
| [noScriptUrl](/linter/rules/no-script-url) | Disallow `javascript:` URLs in HTML. |  |
| [noSyncScripts](/linter/rules/no-sync-scripts) | Prevent the usage of synchronous scripts. |  |
| [noVueVIfWithVFor](/linter/rules/no-vue-v-if-with-v-for) | Disallow using `v-if` and `v-for` directives on the same element. |  |
| [useVueHyphenatedAttributes](/linter/rules/use-vue-hyphenated-attributes) | Enforce hyphenated (kebab-case) attribute names in Vue templates. |  |
| [useVueValidVBind](/linter/rules/use-vue-valid-v-bind) | Forbids `v-bind` directives with missing arguments or invalid modifiers. |  |
| [useVueValidVElse](/linter/rules/use-vue-valid-v-else) | Enforce valid usage of v-else. |  |
| [useVueValidVElseIf](/linter/rules/use-vue-valid-v-else-if) | Enforce valid `v-else-if` directives. |  |
| [useVueValidVHtml](/linter/rules/use-vue-valid-v-html/) | Enforce valid `v-html` directives. |  |
| [useVueValidVIf](/linter/rules/use-vue-valid-v-if) | Enforces valid `v-if` usage for Vue templates. |  |
| [useVueValidVOn](/linter/rules/use-vue-valid-v-on) | Enforce valid `v-on` directives with proper arguments, modifiers, and handlers. |  |
| [useVueValidVText](/linter/rules/use-vue-valid-v-text) | Enforce valid `v-text` Vue directives. |  |

## Recommended rules


* [noHeaderScope](/linter/rules/no-header-scope) (Severity: [error](/reference/diagnostics#error))

Missing a rule? Help us by [contributing](https://github.com/biomejs/biome/blob/main/CONTRIBUTING.md) to the [analyzer](https://github.com/biomejs/biome/blob/main/crates/biome_analyze/CONTRIBUTING.md) or create a rule suggestion [here](https://github.com/biomejs/biome/discussions/categories/rule-suggestion).
