# GraphQL Rules

Below the list of rules supported by Biome, divided by group. Here’s a legend of the emojis:

* The icon  indicates that the rule is part of the recommended rules.
* The icon  indicates that the rule provides a code action (fix) that is **safe** to apply.
* The icon  indicates that the rule provides a code action (fix) that is **unsafe** to apply.
* The icon  indicates that the rule has been implemented and scheduled for the next release.

## `correctness`


| Rule name | Description | Properties |
| --- | --- | --- |
| [useGraphqlNamedOperations](/linter/rules/use-graphql-named-operations) | Enforce specifying the name of GraphQL operations. |  |

## `nursery`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noEmptySource](/linter/rules/no-empty-source) | Disallow empty sources. |  |
| [useConsistentGraphqlDescriptions](/linter/rules/use-consistent-graphql-descriptions) | Require all descriptions to follow the same style (either block or inline) to maintain consistency and improve readability across the schema. |  |
| [useDeprecatedDate](/linter/rules/use-deprecated-date) | Require the `@deprecated` directive to specify a deletion date. |  |
| [useUniqueFieldDefinitionNames](/linter/rules/use-unique-field-definition-names) | Require all fields of a type to be unique. |  |
| [useUniqueGraphqlOperationName](/linter/rules/use-unique-graphql-operation-name) | Enforce unique operation names across a GraphQL document. |  |
| [useUniqueInputFieldNames](/linter/rules/use-unique-input-field-names) | Require fields within an input object to be unique. |  |
| [useUniqueVariableNames](/linter/rules/use-unique-variable-names) | Require all variable definitions to be unique. |  |

## `style`


| Rule name | Description | Properties |
| --- | --- | --- |
| [useDeprecatedReason](/linter/rules/use-deprecated-reason) | Require specifying the reason argument when using `@deprecated` directive |  |
| [useGraphqlNamingConvention](/linter/rules/use-graphql-naming-convention) | Validates that all enum values are capitalized. |  |

## `suspicious`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noDuplicateFields](/linter/rules/no-duplicate-fields) | No duplicated fields in GraphQL operations. |  |

## Recommended rules


* [useGraphqlNamedOperations](/linter/rules/use-graphql-named-operations) (Severity: [error](/reference/diagnostics#error))
* [useDeprecatedReason](/linter/rules/use-deprecated-reason) (Severity: [warning](/reference/diagnostics#warning))
* [noDuplicateFields](/linter/rules/no-duplicate-fields) (Severity: [information](/reference/diagnostics#information))

Missing a rule? Help us by [contributing](https://github.com/biomejs/biome/blob/main/CONTRIBUTING.md) to the [analyzer](https://github.com/biomejs/biome/blob/main/crates/biome_analyze/CONTRIBUTING.md) or create a rule suggestion [here](https://github.com/biomejs/biome/discussions/categories/rule-suggestion).
