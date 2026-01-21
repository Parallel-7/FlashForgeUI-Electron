# CSS Rules

Below the list of rules supported by Biome, divided by group. Here’s a legend of the emojis:

* The icon  indicates that the rule is part of the recommended rules.
* The icon  indicates that the rule provides a code action (fix) that is **safe** to apply.
* The icon  indicates that the rule provides a code action (fix) that is **unsafe** to apply.
* The icon  indicates that the rule has been implemented and scheduled for the next release.

## `a11y`


| Rule name | Description | Properties |
| --- | --- | --- |
| [useGenericFontNames](/linter/rules/use-generic-font-names) | Disallow a missing generic family keyword within font families. |  |

## `complexity`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noImportantStyles](/linter/rules/no-important-styles) | Disallow the use of the `!important` style. |  |

## `correctness`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noInvalidDirectionInLinearGradient](/linter/rules/no-invalid-direction-in-linear-gradient) | Disallow non-standard direction values for linear gradient functions. |  |
| [noInvalidGridAreas](/linter/rules/no-invalid-grid-areas) | Disallows invalid named grid areas in CSS Grid Layouts. |  |
| [noInvalidPositionAtImportRule](/linter/rules/no-invalid-position-at-import-rule) | Disallow the use of `@import` at-rules in invalid positions. |  |
| [noMissingVarFunction](/linter/rules/no-missing-var-function) | Disallow missing var function for css variables. |  |
| [noUnknownFunction](/linter/rules/no-unknown-function) | Disallow unknown CSS value functions. |  |
| [noUnknownMediaFeatureName](/linter/rules/no-unknown-media-feature-name) | Disallow unknown media feature names. |  |
| [noUnknownProperty](/linter/rules/no-unknown-property) | Disallow unknown properties. |  |
| [noUnknownPseudoClass](/linter/rules/no-unknown-pseudo-class) | Disallow unknown pseudo-class selectors. |  |
| [noUnknownPseudoElement](/linter/rules/no-unknown-pseudo-element) | Disallow unknown pseudo-element selectors. |  |
| [noUnknownTypeSelector](/linter/rules/no-unknown-type-selector) | Disallow unknown type selectors. |  |
| [noUnknownUnit](/linter/rules/no-unknown-unit) | Disallow unknown CSS units. |  |
| [noUnmatchableAnbSelector](/linter/rules/no-unmatchable-anb-selector) | Disallow unmatchable An+B selectors. |  |

## `nursery`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noEmptySource](/linter/rules/no-empty-source) | Disallow empty sources. |  |

## `style`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noDescendingSpecificity](/linter/rules/no-descending-specificity) | Disallow a lower specificity selector from coming after a higher specificity selector. |  |
| [noValueAtRule](/linter/rules/no-value-at-rule) | Disallow use of `@value` rule in css modules. |  |

## `suspicious`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noDuplicateAtImportRules](/linter/rules/no-duplicate-at-import-rules) | Disallow duplicate `@import` rules. |  |
| [noDuplicateCustomProperties](/linter/rules/no-duplicate-custom-properties) | Disallow duplicate custom properties within declaration blocks. |  |
| [noDuplicateFontNames](/linter/rules/no-duplicate-font-names) | Disallow duplicate names within font families. |  |
| [noDuplicateProperties](/linter/rules/no-duplicate-properties) | Disallow duplicate properties within declaration blocks. |  |
| [noDuplicateSelectorsKeyframeBlock](/linter/rules/no-duplicate-selectors-keyframe-block) | Disallow duplicate selectors within keyframe blocks. |  |
| [noEmptyBlock](/linter/rules/no-empty-block) | Disallow CSS empty blocks. |  |
| [noImportantInKeyframe](/linter/rules/no-important-in-keyframe) | Disallow invalid `!important` within keyframe declarations |  |
| [noIrregularWhitespace](/linter/rules/no-irregular-whitespace) | Disallows the use of irregular whitespace characters. |  |
| [noShorthandPropertyOverrides](/linter/rules/no-shorthand-property-overrides) | Disallow shorthand properties that override related longhand properties. |  |
| [noUnknownAtRules](/linter/rules/no-unknown-at-rules) | Disallow unknown at-rules. |  |
| [noUselessEscapeInString](/linter/rules/no-useless-escape-in-string) | Disallow unnecessary escapes in string literals. |  |

## Recommended rules


* [useGenericFontNames](/linter/rules/use-generic-font-names) (Severity: [error](/reference/diagnostics#error))
* [noImportantStyles](/linter/rules/no-important-styles) (Severity: [warning](/reference/diagnostics#warning))
* [noInvalidDirectionInLinearGradient](/linter/rules/no-invalid-direction-in-linear-gradient) (Severity: [error](/reference/diagnostics#error))
* [noInvalidGridAreas](/linter/rules/no-invalid-grid-areas) (Severity: [error](/reference/diagnostics#error))
* [noInvalidPositionAtImportRule](/linter/rules/no-invalid-position-at-import-rule) (Severity: [error](/reference/diagnostics#error))
* [noMissingVarFunction](/linter/rules/no-missing-var-function) (Severity: [error](/reference/diagnostics#error))
* [noUnknownFunction](/linter/rules/no-unknown-function) (Severity: [error](/reference/diagnostics#error))
* [noUnknownMediaFeatureName](/linter/rules/no-unknown-media-feature-name) (Severity: [error](/reference/diagnostics#error))
* [noUnknownProperty](/linter/rules/no-unknown-property) (Severity: [error](/reference/diagnostics#error))
* [noUnknownPseudoClass](/linter/rules/no-unknown-pseudo-class) (Severity: [error](/reference/diagnostics#error))
* [noUnknownPseudoElement](/linter/rules/no-unknown-pseudo-element) (Severity: [error](/reference/diagnostics#error))
* [noUnknownTypeSelector](/linter/rules/no-unknown-type-selector) (Severity: [error](/reference/diagnostics#error))
* [noUnknownUnit](/linter/rules/no-unknown-unit) (Severity: [error](/reference/diagnostics#error))
* [noUnmatchableAnbSelector](/linter/rules/no-unmatchable-anb-selector) (Severity: [error](/reference/diagnostics#error))
* [noDescendingSpecificity](/linter/rules/no-descending-specificity) (Severity: [warning](/reference/diagnostics#warning))
* [noDuplicateAtImportRules](/linter/rules/no-duplicate-at-import-rules) (Severity: [error](/reference/diagnostics#error))
* [noDuplicateCustomProperties](/linter/rules/no-duplicate-custom-properties) (Severity: [error](/reference/diagnostics#error))
* [noDuplicateFontNames](/linter/rules/no-duplicate-font-names) (Severity: [error](/reference/diagnostics#error))
* [noDuplicateProperties](/linter/rules/no-duplicate-properties) (Severity: [error](/reference/diagnostics#error))
* [noDuplicateSelectorsKeyframeBlock](/linter/rules/no-duplicate-selectors-keyframe-block) (Severity: [error](/reference/diagnostics#error))
* [noEmptyBlock](/linter/rules/no-empty-block) (Severity: [warning](/reference/diagnostics#warning))
* [noImportantInKeyframe](/linter/rules/no-important-in-keyframe) (Severity: [error](/reference/diagnostics#error))
* [noIrregularWhitespace](/linter/rules/no-irregular-whitespace) (Severity: [warning](/reference/diagnostics#warning))
* [noShorthandPropertyOverrides](/linter/rules/no-shorthand-property-overrides) (Severity: [error](/reference/diagnostics#error))
* [noUnknownAtRules](/linter/rules/no-unknown-at-rules) (Severity: [error](/reference/diagnostics#error))
* [noUselessEscapeInString](/linter/rules/no-useless-escape-in-string) (Severity: [warning](/reference/diagnostics#warning))

Missing a rule? Help us by [contributing](https://github.com/biomejs/biome/blob/main/CONTRIBUTING.md) to the [analyzer](https://github.com/biomejs/biome/blob/main/crates/biome_analyze/CONTRIBUTING.md) or create a rule suggestion [here](https://github.com/biomejs/biome/discussions/categories/rule-suggestion).
