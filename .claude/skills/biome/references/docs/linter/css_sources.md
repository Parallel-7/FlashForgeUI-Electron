# Rules sources

## Biome exclusive rules


* [noUselessEscapeInString](/linter/rules/no-useless-escape-in-string)
* [noValueAtRule](/linter/rules/no-value-at-rule)

## Rules from other sources


Note

Some **Biome** rules might **not** have options, compared to the original rule.

### Stylelint


| Stylelint Rules name | Biome Rules name |
| --- | --- |
| [at-rule-no-unknown](https://github.com/stylelint/stylelint/blob/main/lib/rules/at-rule-no-unknown/README.md) | [noUnknownAtRules](/linter/rules/no-unknown-at-rules) |
| [block-no-empty](https://github.com/stylelint/stylelint/blob/main/lib/rules/block-no-empty/README.md) | [noEmptyBlock](/linter/rules/no-empty-block) |
| [custom-property-no-missing-var-function](https://github.com/stylelint/stylelint/blob/main/lib/rules/custom-property-no-missing-var-function/README.md) | [noMissingVarFunction](/linter/rules/no-missing-var-function) |
| [declaration-block-no-duplicate-custom-properties](https://github.com/stylelint/stylelint/blob/main/lib/rules/declaration-block-no-duplicate-custom-properties/README.md) | [noDuplicateCustomProperties](/linter/rules/no-duplicate-custom-properties) |
| [declaration-block-no-duplicate-properties](https://github.com/stylelint/stylelint/blob/main/lib/rules/declaration-block-no-duplicate-properties/README.md) | [noDuplicateProperties](/linter/rules/no-duplicate-properties) |
| [declaration-block-no-shorthand-property-overrides](https://github.com/stylelint/stylelint/blob/main/lib/rules/declaration-block-no-shorthand-property-overrides/README.md) | [noShorthandPropertyOverrides](/linter/rules/no-shorthand-property-overrides) |
| [declaration-no-important](https://github.com/stylelint/stylelint/blob/main/lib/rules/declaration-no-important/README.md) | [noImportantStyles](/linter/rules/no-important-styles) |
| [font-family-no-duplicate-names](https://github.com/stylelint/stylelint/blob/main/lib/rules/font-family-no-duplicate-names/README.md) | [noDuplicateFontNames](/linter/rules/no-duplicate-font-names) |
| [font-family-no-missing-generic-family-keyword](https://github.com/stylelint/stylelint/blob/main/lib/rules/font-family-no-missing-generic-family-keyword/README.md) | [useGenericFontNames](/linter/rules/use-generic-font-names) |
| [function-linear-gradient-no-nonstandard-direction](https://github.com/stylelint/stylelint/blob/main/lib/rules/function-linear-gradient-no-nonstandard-direction/README.md) | [noInvalidDirectionInLinearGradient](/linter/rules/no-invalid-direction-in-linear-gradient) |
| [function-no-unknown](https://github.com/stylelint/stylelint/blob/main/lib/rules/function-no-unknown/README.md) | [noUnknownFunction](/linter/rules/no-unknown-function) |
| [keyframe-block-no-duplicate-selectors](https://github.com/stylelint/stylelint/blob/main/lib/rules/keyframe-block-no-duplicate-selectors/README.md) | [noDuplicateSelectorsKeyframeBlock](/linter/rules/no-duplicate-selectors-keyframe-block) |
| [keyframe-declaration-no-important](https://github.com/stylelint/stylelint/blob/main/lib/rules/keyframe-declaration-no-important/README.md) | [noImportantInKeyframe](/linter/rules/no-important-in-keyframe) |
| [media-feature-name-no-unknown](https://github.com/stylelint/stylelint/blob/main/lib/rules/media-feature-name-no-unknown/README.md) | [noUnknownMediaFeatureName](/linter/rules/no-unknown-media-feature-name) |
| [named-grid-areas-no-invalid](https://github.com/stylelint/stylelint/blob/main/lib/rules/named-grid-areas-no-invalid/README.md) | [noInvalidGridAreas](/linter/rules/no-invalid-grid-areas) |
| [no-descending-specificity](https://github.com/stylelint/stylelint/blob/main/lib/rules/no-descending-specificity/README.md) | [noDescendingSpecificity](/linter/rules/no-descending-specificity) |
| [no-duplicate-at-import-rules](https://github.com/stylelint/stylelint/blob/main/lib/rules/no-duplicate-at-import-rules/README.md) | [noDuplicateAtImportRules](/linter/rules/no-duplicate-at-import-rules) |
| [no-empty-source](https://github.com/stylelint/stylelint/blob/main/lib/rules/no-empty-source/README.md) | [noEmptySource](/linter/rules/no-empty-source) |
| [no-invalid-position-at-import-rule](https://github.com/stylelint/stylelint/blob/main/lib/rules/no-invalid-position-at-import-rule/README.md) | [noInvalidPositionAtImportRule](/linter/rules/no-invalid-position-at-import-rule) |
| [no-irregular-whitespace](https://github.com/stylelint/stylelint/blob/main/lib/rules/no-irregular-whitespace/README.md) | [noIrregularWhitespace](/linter/rules/no-irregular-whitespace) |
| [property-no-unknown](https://github.com/stylelint/stylelint/blob/main/lib/rules/property-no-unknown/README.md) | [noUnknownProperty](/linter/rules/no-unknown-property) |
| [selector-anb-no-unmatchable](https://github.com/stylelint/stylelint/blob/main/lib/rules/selector-anb-no-unmatchable/README.md) | [noUnmatchableAnbSelector](/linter/rules/no-unmatchable-anb-selector) |
| [selector-pseudo-class-no-unknown](https://github.com/stylelint/stylelint/blob/main/lib/rules/selector-pseudo-class-no-unknown/README.md) | [noUnknownPseudoClass](/linter/rules/no-unknown-pseudo-class) |
| [selector-pseudo-element-no-unknown](https://github.com/stylelint/stylelint/blob/main/lib/rules/selector-pseudo-element-no-unknown/README.md) | [noUnknownPseudoElement](/linter/rules/no-unknown-pseudo-element) |
| [selector-type-no-unknown](https://github.com/stylelint/stylelint/blob/main/lib/rules/selector-type-no-unknown/README.md) | [noUnknownTypeSelector](/linter/rules/no-unknown-type-selector) |
| [unit-no-unknown](https://github.com/stylelint/stylelint/blob/main/lib/rules/unit-no-unknown/README.md) | [noUnknownUnit](/linter/rules/no-unknown-unit) |

Missing a rule? Help us by [contributing](https://github.com/biomejs/biome/blob/main/CONTRIBUTING.md) to the [analyzer](https://github.com/biomejs/biome/blob/main/crates/biome_analyze/CONTRIBUTING.md) or create a rule suggestion [here](https://github.com/biomejs/biome/discussions/categories/rule-suggestion).
