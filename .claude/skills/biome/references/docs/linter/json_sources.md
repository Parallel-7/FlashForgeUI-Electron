# Rules sources

## Biome exclusive rules


* [noBiomeFirstException](/linter/rules/no-biome-first-exception)
* [noDuplicateObjectKeys](/linter/rules/no-duplicate-object-keys)
* [noQuickfixBiome](/linter/rules/no-quickfix-biome)
* [useBiomeIgnoreFolder](/linter/rules/use-biome-ignore-folder)
* [useRequiredScripts](/linter/rules/use-required-scripts)

## Rules from other sources


Note

Some **Biome** rules might **not** have options, compared to the original rule.

### eslint-plugin-package-json


| eslint-plugin-package-json Rules name | Biome Rules name |
| --- | --- |
| [unique-dependencies](https://github.com/JoshuaKGoldberg/eslint-plugin-package-json/blob/main/docs/rules/unique-dependencies.md) | [noDuplicateDependencies](/linter/rules/no-duplicate-dependencies) |

### eslint-plugin-package-json-dependencies


| eslint-plugin-package-json-dependencies Rules name | Biome Rules name |
| --- | --- |
| [duplicate-dependencies](https://github.com/idan-at/eslint-plugin-package-json-dependencies/blob/master/docs/rules/duplicate-dependencies.md) | [noDuplicateDependencies](/linter/rules/no-duplicate-dependencies) |

Missing a rule? Help us by [contributing](https://github.com/biomejs/biome/blob/main/CONTRIBUTING.md) to the [analyzer](https://github.com/biomejs/biome/blob/main/crates/biome_analyze/CONTRIBUTING.md) or create a rule suggestion [here](https://github.com/biomejs/biome/discussions/categories/rule-suggestion).
