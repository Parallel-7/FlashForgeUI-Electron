# Rules sources

## Biome exclusive rules


* [noEmptySource](/linter/rules/no-empty-source)

## Rules from other sources


Note

Some **Biome** rules might **not** have options, compared to the original rule.

### GraphQL-ESLint


| GraphQL-ESLint Rules name | Biome Rules name |
| --- | --- |
| [description-style](https://the-guild.dev/graphql/eslint/rules/description-style) | [useConsistentGraphqlDescriptions](/linter/rules/use-consistent-graphql-descriptions) |
| [no-anonymous-operations](https://the-guild.dev/graphql/eslint/rules/no-anonymous-operations) | [useGraphqlNamedOperations](/linter/rules/use-graphql-named-operations) |
| [no-duplicate-fields](https://the-guild.dev/graphql/eslint/rules/no-duplicate-fields) | [noDuplicateFields](/linter/rules/no-duplicate-fields) |
| [require-deprecation-date](https://the-guild.dev/graphql/eslint/rules/require-deprecation-date) | [useDeprecatedDate](/linter/rules/use-deprecated-date) |
| [require-deprecation-reason](https://the-guild.dev/graphql/eslint/rules/require-deprecation-reason) | [useDeprecatedReason](/linter/rules/use-deprecated-reason) |
| [unique-operation-name](https://the-guild.dev/graphql/eslint/rules/unique-operation-name) | [useUniqueGraphqlOperationName](/linter/rules/use-unique-graphql-operation-name) (inspired) |

### graphql-schema-linter


| graphql-schema-linter Rules name | Biome Rules name |
| --- | --- |
| [enum-values-all-caps](https://github.com/cjoudrey/graphql-schema-linter?tab=readme-ov-file#enum-values-all-caps) | [useGraphqlNamingConvention](/linter/rules/use-graphql-naming-convention) (inspired) |

Missing a rule? Help us by [contributing](https://github.com/biomejs/biome/blob/main/CONTRIBUTING.md) to the [analyzer](https://github.com/biomejs/biome/blob/main/crates/biome_analyze/CONTRIBUTING.md) or create a rule suggestion [here](https://github.com/biomejs/biome/discussions/categories/rule-suggestion).
