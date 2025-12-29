# JSON Rules

Below the list of rules supported by Biome, divided by group. Here’s a legend of the emojis:

* The icon  indicates that the rule is part of the recommended rules.
* The icon  indicates that the rule provides a code action (fix) that is **safe** to apply.
* The icon  indicates that the rule provides a code action (fix) that is **unsafe** to apply.
* The icon  indicates that the rule has been implemented and scheduled for the next release.

## `nursery`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noDuplicateDependencies](/linter/rules/no-duplicate-dependencies) | Prevent the listing of duplicate dependencies. |  |
| [useRequiredScripts](/linter/rules/use-required-scripts) | Enforce the presence of required scripts in package.json. |  |

## `suspicious`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noBiomeFirstException](/linter/rules/no-biome-first-exception) | Prevents the misuse of glob patterns inside the `files.includes` field. |  |
| [noDuplicateObjectKeys](/linter/rules/no-duplicate-object-keys) | Disallow two keys with the same name inside objects. |  |
| [noQuickfixBiome](/linter/rules/no-quickfix-biome) | Disallow the use if `quickfix.biome` inside editor settings file. |  |
| [useBiomeIgnoreFolder](/linter/rules/use-biome-ignore-folder) | Promotes the correct usage for ignoring folders in the configuration file. |  |

## Recommended rules


* [noBiomeFirstException](/linter/rules/no-biome-first-exception) (Severity: [error](/reference/diagnostics#error))
* [noDuplicateObjectKeys](/linter/rules/no-duplicate-object-keys) (Severity: [error](/reference/diagnostics#error))
* [noQuickfixBiome](/linter/rules/no-quickfix-biome) (Severity: [information](/reference/diagnostics#information))
* [useBiomeIgnoreFolder](/linter/rules/use-biome-ignore-folder) (Severity: [warning](/reference/diagnostics#warning))

Missing a rule? Help us by [contributing](https://github.com/biomejs/biome/blob/main/CONTRIBUTING.md) to the [analyzer](https://github.com/biomejs/biome/blob/main/crates/biome_analyze/CONTRIBUTING.md) or create a rule suggestion [here](https://github.com/biomejs/biome/discussions/categories/rule-suggestion).
