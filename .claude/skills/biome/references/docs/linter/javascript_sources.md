# Rules sources

## Biome exclusive rules


* [noAccumulatingSpread](/linter/rules/no-accumulating-spread)
* [noConstEnum](/linter/rules/no-const-enum)
* [noDelete](/linter/rules/no-delete)
* [noDynamicNamespaceImportAccess](/linter/rules/no-dynamic-namespace-import-access)
* [noEmptyTypeParameters](/linter/rules/no-empty-type-parameters)
* [noEnum](/linter/rules/no-enum)
* [noEvolvingTypes](/linter/rules/no-evolving-types)
* [noExportedImports](/linter/rules/no-exported-imports)
* [noGlobalIsFinite](/linter/rules/no-global-is-finite)
* [noGlobalIsNan](/linter/rules/no-global-is-nan)
* [noImplicitAnyLet](/linter/rules/no-implicit-any-let)
* [noRedundantUseStrict](/linter/rules/no-redundant-use-strict)
* [noRenderReturnValue](/linter/rules/no-render-return-value)
* [noShoutyConstants](/linter/rules/no-shouty-constants)
* [noSuspiciousSemicolonInJsx](/linter/rules/no-suspicious-semicolon-in-jsx)
* [noSvgWithoutTitle](/linter/rules/no-svg-without-title)
* [noUnusedFunctionParameters](/linter/rules/no-unused-function-parameters)
* [noUnusedTemplateLiteral](/linter/rules/no-unused-template-literal)
* [noUselessCatchBinding](/linter/rules/no-useless-catch-binding)
* [noUselessContinue](/linter/rules/no-useless-continue)
* [noUselessEscapeInString](/linter/rules/no-useless-escape-in-string)
* [noUselessStringRaw](/linter/rules/no-useless-string-raw)
* [noVoidTypeReturn](/linter/rules/no-void-type-return)
* [useImportExtensions](/linter/rules/use-import-extensions)
* [useJsonImportAttributes](/linter/rules/use-json-import-attributes)
* [useNodeAssertStrict](/linter/rules/use-node-assert-strict)
* [useSimpleNumberKeys](/linter/rules/use-simple-number-keys)
* [useSimplifiedLogicExpression](/linter/rules/use-simplified-logic-expression)
* [useSortedClasses](/linter/rules/use-sorted-classes)
* [useStaticResponseMethods](/linter/rules/use-static-response-methods)
* [useStrictMode](/linter/rules/use-strict-mode)
* [useTopLevelRegex](/linter/rules/use-top-level-regex)
* [useUniqueElementIds](/linter/rules/use-unique-element-ids)

## Rules from other sources


Note

Some **Biome** rules might **not** have options, compared to the original rule.

### @eslint-react/eslint-plugin


| @eslint-react/eslint-plugin Rules name | Biome Rules name |
| --- | --- |
| [dom-no-script-url](https://eslint-react.xyz/docs/rules/dom-no-script-url) | [noScriptUrl](/linter/rules/no-script-url) |
| [no-forward-ref](https://eslint-react.xyz/docs/rules/no-forward-ref) | [noReactForwardRef](/linter/rules/no-react-forward-ref) |
| [no-nested-component-definitions](https://eslint-react.xyz/docs/rules/no-nested-component-definitions) | [noNestedComponentDefinitions](/linter/rules/no-nested-component-definitions) |
| [no-nested-components](https://eslint-react.xyz/docs/rules/no-nested-components) | [noNestedComponentDefinitions](/linter/rules/no-nested-component-definitions) |
| [no-useless-fragment](https://eslint-react.xyz/docs/rules/no-useless-fragment) | [noUselessFragments](/linter/rules/no-useless-fragments) |

### @mysticatea/eslint-plugin


| @mysticatea/eslint-plugin Rules name | Biome Rules name |
| --- | --- |
| [no-this-in-static](https://github.com/mysticatea/eslint-plugin/blob/master/docs/rules/no-this-in-static.md) | [noThisInStatic](/linter/rules/no-this-in-static) |

### @next/eslint-plugin-next


| @next/eslint-plugin-next Rules name | Biome Rules name |
| --- | --- |
| [google-font-display](https://nextjs.org/docs/messages/google-font-display) | [useGoogleFontDisplay](/linter/rules/use-google-font-display) |
| [google-font-preconnect](https://nextjs.org/docs/messages/google-font-preconnect) | [useGoogleFontPreconnect](/linter/rules/use-google-font-preconnect) |
| [no-async-client-component](https://nextjs.org/docs/messages/no-async-client-component) | [noNextAsyncClientComponent](/linter/rules/no-next-async-client-component) |
| [no-document-import-in-page](https://nextjs.org/docs/messages/no-document-import-in-page) | [noDocumentImportInPage](/linter/rules/no-document-import-in-page) |
| [no-head-element](https://nextjs.org/docs/messages/no-head-element) | [noHeadElement](/linter/rules/no-head-element) |
| [no-head-import-in-document](https://nextjs.org/docs/messages/no-head-import-in-document) | [noHeadImportInDocument](/linter/rules/no-head-import-in-document) |
| [no-img-element](https://nextjs.org/docs/messages/no-img-element) | [noImgElement](/linter/rules/no-img-element) |
| [no-sync-scripts](https://nextjs.org/docs/messages/no-sync-scripts) | [noSyncScripts](/linter/rules/no-sync-scripts) |
| [no-unwanted-polyfillio](https://nextjs.org/docs/messages/no-unwanted-polyfillio) | [noUnwantedPolyfillio](/linter/rules/no-unwanted-polyfillio) |

### @stylistic/eslint-plugin


| @stylistic/eslint-plugin Rules name | Biome Rules name |
| --- | --- |
| [jsx-self-closing-comp](https://eslint.style/rules/default/jsx-self-closing-comp) | [useSelfClosingElements](/linter/rules/use-self-closing-elements) |

### @vitest/eslint-plugin


| @vitest/eslint-plugin Rules name | Biome Rules name |
| --- | --- |
| [max-nested-describe](https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/max-nested-describe.md) | [noExcessiveNestedTestSuites](/linter/rules/no-excessive-nested-test-suites) |
| [no-disabled-tests](https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-disabled-tests.md) | [noSkippedTests](/linter/rules/no-skipped-tests) (inspired) |
| [no-done-callback](https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-done-callback.md) | [noDoneCallback](/linter/rules/no-done-callback) |
| [no-duplicate-hooks](https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-duplicate-hooks.md) | [noDuplicateTestHooks](/linter/rules/no-duplicate-test-hooks) (inspired) |
| [no-focused-tests](https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-focused-tests.md) | [noFocusedTests](/linter/rules/no-focused-tests) (inspired) |
| [no-standalone-expect](https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-standalone-expect.md) | [noMisplacedAssertion](/linter/rules/no-misplaced-assertion) (inspired) |

### Clippy


| Clippy Rules name | Biome Rules name |
| --- | --- |
| [approx\_constant](https://rust-lang.github.io/rust-clippy/master/#approx_constant) | [noApproximativeNumericConstant](/linter/rules/no-approximative-numeric-constant) |
| [collapsible\_else\_if](https://rust-lang.github.io/rust-clippy/master/#collapsible_else_if) | [useCollapsedElseIf](/linter/rules/use-collapsed-else-if) |
| [collapsible\_if](https://rust-lang.github.io/rust-clippy/master/#collapsible_if) | [useCollapsedIf](/linter/rules/use-collapsed-if) |
| [eq\_op](https://rust-lang.github.io/rust-clippy/master/#eq_op) | [noSelfCompare](/linter/rules/no-self-compare) |
| [flat\_map\_identity](https://rust-lang.github.io/rust-clippy/master/#flat_map_identity) | [noFlatMapIdentity](/linter/rules/no-flat-map-identity) |
| [if\_not\_else](https://rust-lang.github.io/rust-clippy/master/#if_not_else) | [noNegationElse](/linter/rules/no-negation-else) |
| [lossy\_float\_literal](https://rust-lang.github.io/rust-clippy/master/#lossy_float_literal) | [noPrecisionLoss](/linter/rules/no-precision-loss) |
| [map\_flatten](https://rust-lang.github.io/rust-clippy/master/#map_flatten) | [useFlatMap](/linter/rules/use-flat-map) |
| [match\_str\_case\_mismatch](https://rust-lang.github.io/rust-clippy/master/#match_str_case_mismatch) | [noStringCaseMismatch](/linter/rules/no-string-case-mismatch) |
| [min\_max](https://rust-lang.github.io/rust-clippy/master/#min_max) | [noConstantMathMinMaxClamp](/linter/rules/no-constant-math-min-max-clamp) |
| [misrefactored\_assign\_op](https://rust-lang.github.io/rust-clippy/master/#misrefactored_assign_op) | [noMisrefactoredShorthandAssign](/linter/rules/no-misrefactored-shorthand-assign) |
| [needless\_for\_each](https://rust-lang.github.io/rust-clippy/master/#needless_for_each) | [noForEach](/linter/rules/no-for-each) |
| [only\_used\_in\_recursion](https://rust-lang.github.io/rust-clippy/master/#only_used_in_recursion) | [noParametersOnlyUsedInRecursion](/linter/rules/no-parameters-only-used-in-recursion) (inspired) |
| [redundant\_else](https://rust-lang.github.io/rust-clippy/master/#redundant_else) | [noUselessElse](/linter/rules/no-useless-else) (inspired) |
| [self\_assignment](https://rust-lang.github.io/rust-clippy/master/#self_assignment) | [noSelfAssign](/linter/rules/no-self-assign) |
| [too\_many\_arguments](https://rust-lang.github.io/rust-clippy/master/#too_many_arguments) | [useMaxParams](/linter/rules/use-max-params) |
| [unreadable\_literal](https://rust-lang.github.io/rust-clippy/master/#unreadable_literal) | [useNumericSeparators](/linter/rules/use-numeric-separators) |

### Deno Lint


| Deno Lint Rules name | Biome Rules name |
| --- | --- |
| [no-process-global](https://lint.deno.land/rules/no-process-global) | [noProcessGlobal](/linter/rules/no-process-global) |

### ESLint


| ESLint Rules name | Biome Rules name |
| --- | --- |
| [array-callback-return](https://eslint.org/docs/latest/rules/array-callback-return) | [useIterableCallbackReturn](/linter/rules/use-iterable-callback-return) |
| [arrow-body-style](https://eslint.org/docs/latest/rules/arrow-body-style) | [useConsistentArrowReturn](/linter/rules/use-consistent-arrow-return) |
| [constructor-super](https://eslint.org/docs/latest/rules/constructor-super) | [noInvalidConstructorSuper](/linter/rules/no-invalid-constructor-super) |
| [curly](https://eslint.org/docs/latest/rules/curly) | [useBlockStatements](/linter/rules/use-block-statements) |
| [default-case](https://eslint.org/docs/latest/rules/default-case) | [useDefaultSwitchClause](/linter/rules/use-default-switch-clause) |
| [default-case-last](https://eslint.org/docs/latest/rules/default-case-last) | [useDefaultSwitchClauseLast](/linter/rules/use-default-switch-clause-last) |
| [default-param-last](https://eslint.org/docs/latest/rules/default-param-last) | [useDefaultParameterLast](/linter/rules/use-default-parameter-last) |
| [dot-notation](https://eslint.org/docs/latest/rules/dot-notation) | [useLiteralKeys](/linter/rules/use-literal-keys) |
| [eqeqeq](https://eslint.org/docs/latest/rules/eqeqeq) | [noDoubleEquals](/linter/rules/no-double-equals) |
| [for-direction](https://eslint.org/docs/latest/rules/for-direction) | [useValidForDirection](/linter/rules/use-valid-for-direction) |
| [getter-return](https://eslint.org/docs/latest/rules/getter-return) | [useGetterReturn](/linter/rules/use-getter-return) |
| [grouped-accessor-pairs](https://eslint.org/docs/latest/rules/grouped-accessor-pairs) | [useGroupedAccessorPairs](/linter/rules/use-grouped-accessor-pairs) |
| [guard-for-in](https://eslint.org/docs/latest/rules/guard-for-in) | [useGuardForIn](/linter/rules/use-guard-for-in) |
| [max-lines-per-function](https://eslint.org/docs/latest/rules/max-lines-per-function) | [noExcessiveLinesPerFunction](/linter/rules/no-excessive-lines-per-function) (inspired) |
| [max-params](https://eslint.org/docs/latest/rules/max-params) | [useMaxParams](/linter/rules/use-max-params) |
| [no-alert](https://eslint.org/docs/latest/rules/no-alert) | [noAlert](/linter/rules/no-alert) |
| [no-array-constructor](https://eslint.org/docs/latest/rules/no-array-constructor) | [useArrayLiterals](/linter/rules/use-array-literals) |
| [no-async-promise-executor](https://eslint.org/docs/latest/rules/no-async-promise-executor) | [noAsyncPromiseExecutor](/linter/rules/no-async-promise-executor) |
| [no-await-in-loop](https://eslint.org/docs/latest/rules/no-await-in-loop) | [noAwaitInLoops](/linter/rules/no-await-in-loops) |
| [no-bitwise](https://eslint.org/docs/latest/rules/no-bitwise) | [noBitwiseOperators](/linter/rules/no-bitwise-operators) |
| [no-case-declarations](https://eslint.org/docs/latest/rules/no-case-declarations) | [noSwitchDeclarations](/linter/rules/no-switch-declarations) |
| [no-class-assign](https://eslint.org/docs/latest/rules/no-class-assign) | [noClassAssign](/linter/rules/no-class-assign) |
| [no-compare-neg-zero](https://eslint.org/docs/latest/rules/no-compare-neg-zero) | [noCompareNegZero](/linter/rules/no-compare-neg-zero) |
| [no-cond-assign](https://eslint.org/docs/latest/rules/no-cond-assign) | [noAssignInExpressions](/linter/rules/no-assign-in-expressions) (inspired) |
| [no-console](https://eslint.org/docs/latest/rules/no-console) | [noConsole](/linter/rules/no-console) |
| [no-const-assign](https://eslint.org/docs/latest/rules/no-const-assign) | [noConstAssign](/linter/rules/no-const-assign) |
| [no-constant-binary-expression](https://eslint.org/docs/latest/rules/no-constant-binary-expression) | [noConstantBinaryExpressions](/linter/rules/no-constant-binary-expressions) |
| [no-constant-condition](https://eslint.org/docs/latest/rules/no-constant-condition) | [noConstantCondition](/linter/rules/no-constant-condition) |
| [no-constructor-return](https://eslint.org/docs/latest/rules/no-constructor-return) | [noConstructorReturn](/linter/rules/no-constructor-return) |
| [no-continue](https://eslint.org/docs/latest/rules/no-continue) | [noContinue](/linter/rules/no-continue) |
| [no-control-regex](https://eslint.org/docs/latest/rules/no-control-regex) | [noControlCharactersInRegex](/linter/rules/no-control-characters-in-regex) |
| [no-debugger](https://eslint.org/docs/latest/rules/no-debugger) | [noDebugger](/linter/rules/no-debugger) |
| [no-dupe-args](https://eslint.org/docs/latest/rules/no-dupe-args) | [noDuplicateParameters](/linter/rules/no-duplicate-parameters) |
| [no-dupe-class-members](https://eslint.org/docs/latest/rules/no-dupe-class-members) | [noDuplicateClassMembers](/linter/rules/no-duplicate-class-members) |
| [no-dupe-else-if](https://eslint.org/docs/latest/rules/no-dupe-else-if) | [noDuplicateElseIf](/linter/rules/no-duplicate-else-if) |
| [no-dupe-keys](https://eslint.org/docs/latest/rules/no-dupe-keys) | [noDuplicateObjectKeys](/linter/rules/no-duplicate-object-keys) |
| [no-duplicate-case](https://eslint.org/docs/latest/rules/no-duplicate-case) | [noDuplicateCase](/linter/rules/no-duplicate-case) |
| [no-else-return](https://eslint.org/docs/latest/rules/no-else-return) | [noUselessElse](/linter/rules/no-useless-else) (inspired) |
| [no-empty](https://eslint.org/docs/latest/rules/no-empty) | [noEmptyBlockStatements](/linter/rules/no-empty-block-statements) |
| [no-empty-character-class](https://eslint.org/docs/latest/rules/no-empty-character-class) | [noEmptyCharacterClassInRegex](/linter/rules/no-empty-character-class-in-regex) |
| [no-empty-function](https://eslint.org/docs/latest/rules/no-empty-function) | [noEmptyBlockStatements](/linter/rules/no-empty-block-statements) |
| [no-empty-pattern](https://eslint.org/docs/latest/rules/no-empty-pattern) | [noEmptyPattern](/linter/rules/no-empty-pattern) |
| [no-empty-static-block](https://eslint.org/docs/latest/rules/no-empty-static-block) | [noEmptyBlockStatements](/linter/rules/no-empty-block-statements) |
| [no-eq-null](https://eslint.org/docs/latest/rules/no-eq-null) | [noEqualsToNull](/linter/rules/no-equals-to-null) |
| [no-eval](https://eslint.org/docs/latest/rules/no-eval) | [noGlobalEval](/linter/rules/no-global-eval) |
| [no-ex-assign](https://eslint.org/docs/latest/rules/no-ex-assign) | [noCatchAssign](/linter/rules/no-catch-assign) |
| [no-extra-boolean-cast](https://eslint.org/docs/latest/rules/no-extra-boolean-cast) | [noExtraBooleanCast](/linter/rules/no-extra-boolean-cast) |
| [no-extra-label](https://eslint.org/docs/latest/rules/no-extra-label) | [noUselessLabel](/linter/rules/no-useless-label) |
| [no-fallthrough](https://eslint.org/docs/latest/rules/no-fallthrough) | [noFallthroughSwitchClause](/linter/rules/no-fallthrough-switch-clause) |
| [no-func-assign](https://eslint.org/docs/latest/rules/no-func-assign) | [noFunctionAssign](/linter/rules/no-function-assign) |
| [no-global-assign](https://eslint.org/docs/latest/rules/no-global-assign) | [noGlobalAssign](/linter/rules/no-global-assign) |
| [no-implicit-coercion](https://eslint.org/docs/latest/rules/no-implicit-coercion) | [noImplicitCoercions](/linter/rules/no-implicit-coercions) |
| [no-import-assign](https://eslint.org/docs/latest/rules/no-import-assign) | [noImportAssign](/linter/rules/no-import-assign) |
| [no-inner-declarations](https://eslint.org/docs/latest/rules/no-inner-declarations) | [noInnerDeclarations](/linter/rules/no-inner-declarations) |
| [no-irregular-whitespace](https://eslint.org/docs/latest/rules/no-irregular-whitespace) | [noIrregularWhitespace](/linter/rules/no-irregular-whitespace) |
| [no-label-var](https://eslint.org/docs/latest/rules/no-label-var) | [noLabelVar](/linter/rules/no-label-var) |
| [no-labels](https://eslint.org/docs/latest/rules/no-labels) | [noConfusingLabels](/linter/rules/no-confusing-labels) (inspired) |
| [no-lone-blocks](https://eslint.org/docs/latest/rules/no-lone-blocks) | [noUselessLoneBlockStatements](/linter/rules/no-useless-lone-block-statements) |
| [no-lonely-if](https://eslint.org/docs/latest/rules/no-lonely-if) | [useCollapsedElseIf](/linter/rules/use-collapsed-else-if) |
| [no-loss-of-precision](https://eslint.org/docs/latest/rules/no-loss-of-precision) | [noPrecisionLoss](/linter/rules/no-precision-loss) |
| [no-misleading-character-class](https://eslint.org/docs/latest/rules/no-misleading-character-class) | [noMisleadingCharacterClass](/linter/rules/no-misleading-character-class) |
| [no-multi-str](https://eslint.org/docs/latest/rules/no-multi-str) | [noMultiStr](/linter/rules/no-multi-str) |
| [no-negated-condition](https://eslint.org/docs/latest/rules/no-negated-condition) | [noNegationElse](/linter/rules/no-negation-else) |
| [no-nested-ternary](https://eslint.org/docs/latest/rules/no-nested-ternary) | [noNestedTernary](/linter/rules/no-nested-ternary) |
| [no-new-native-nonconstructor](https://eslint.org/docs/latest/rules/no-new-native-nonconstructor) | [noInvalidBuiltinInstantiation](/linter/rules/no-invalid-builtin-instantiation) |
| [no-new-wrappers](https://eslint.org/docs/latest/rules/no-new-wrappers) | [useConsistentBuiltinInstantiation](/linter/rules/use-consistent-builtin-instantiation) |
| [no-nonoctal-decimal-escape](https://eslint.org/docs/latest/rules/no-nonoctal-decimal-escape) | [noNonoctalDecimalEscape](/linter/rules/no-nonoctal-decimal-escape) |
| [no-obj-calls](https://eslint.org/docs/latest/rules/no-obj-calls) | [noGlobalObjectCalls](/linter/rules/no-global-object-calls) |
| [no-octal-escape](https://eslint.org/docs/latest/rules/no-octal-escape) | [noOctalEscape](/linter/rules/no-octal-escape) |
| [no-param-reassign](https://eslint.org/docs/latest/rules/no-param-reassign) | [noParameterAssign](/linter/rules/no-parameter-assign) |
| [no-plusplus](https://eslint.org/docs/latest/rules/no-plusplus) | [noIncrementDecrement](/linter/rules/no-increment-decrement) |
| [no-proto](https://eslint.org/docs/latest/rules/no-proto) | [noProto](/linter/rules/no-proto) |
| [no-prototype-builtins](https://eslint.org/docs/latest/rules/no-prototype-builtins) | [noPrototypeBuiltins](/linter/rules/no-prototype-builtins) |
| [no-redeclare](https://eslint.org/docs/latest/rules/no-redeclare) | [noRedeclare](/linter/rules/no-redeclare) |
| [no-regex-spaces](https://eslint.org/docs/latest/rules/no-regex-spaces) | [noAdjacentSpacesInRegex](/linter/rules/no-adjacent-spaces-in-regex) |
| [no-restricted-globals](https://eslint.org/docs/latest/rules/no-restricted-globals) | [noRestrictedGlobals](/linter/rules/no-restricted-globals) |
| [no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports) | [noRestrictedImports](/linter/rules/no-restricted-imports) |
| [no-script-url](https://eslint.org/docs/latest/rules/no-script-url) | [noScriptUrl](/linter/rules/no-script-url) |
| [no-self-assign](https://eslint.org/docs/latest/rules/no-self-assign) | [noSelfAssign](/linter/rules/no-self-assign) |
| [no-self-compare](https://eslint.org/docs/latest/rules/no-self-compare) | [noSelfCompare](/linter/rules/no-self-compare) |
| [no-sequences](https://eslint.org/docs/latest/rules/no-sequences) | [noCommaOperator](/linter/rules/no-comma-operator) |
| [no-setter-return](https://eslint.org/docs/latest/rules/no-setter-return) | [noSetterReturn](/linter/rules/no-setter-return) |
| [no-shadow](https://eslint.org/docs/latest/rules/no-shadow) | [noShadow](/linter/rules/no-shadow) |
| [no-shadow-restricted-names](https://eslint.org/docs/latest/rules/no-shadow-restricted-names) | [noShadowRestrictedNames](/linter/rules/no-shadow-restricted-names) |
| [no-sparse-arrays](https://eslint.org/docs/latest/rules/no-sparse-arrays) | [noSparseArray](/linter/rules/no-sparse-array) |
| [no-template-curly-in-string](https://eslint.org/docs/latest/rules/no-template-curly-in-string) | [noTemplateCurlyInString](/linter/rules/no-template-curly-in-string) |
| [no-ternary](https://eslint.org/docs/latest/rules/no-ternary) | [noTernary](/linter/rules/no-ternary) |
| [no-this-before-super](https://eslint.org/docs/latest/rules/no-this-before-super) | [noUnreachableSuper](/linter/rules/no-unreachable-super) |
| [no-throw-literal](https://eslint.org/docs/latest/rules/no-throw-literal) | [useThrowOnlyError](/linter/rules/use-throw-only-error) (inspired) |
| [no-unassigned-vars](https://eslint.org/docs/latest/rules/no-unassigned-vars) | [noUnassignedVariables](/linter/rules/no-unassigned-variables) |
| [no-undef](https://eslint.org/docs/latest/rules/no-undef) | [noUndeclaredVariables](/linter/rules/no-undeclared-variables) |
| [no-undef-init](https://eslint.org/docs/latest/rules/no-undef-init) | [noUselessUndefinedInitialization](/linter/rules/no-useless-undefined-initialization) |
| [no-unneeded-ternary](https://eslint.org/docs/latest/rules/no-unneeded-ternary) | [noUselessTernary](/linter/rules/no-useless-ternary) |
| [no-unreachable](https://eslint.org/docs/latest/rules/no-unreachable) | [noUnreachable](/linter/rules/no-unreachable) |
| [no-unsafe-finally](https://eslint.org/docs/latest/rules/no-unsafe-finally) | [noUnsafeFinally](/linter/rules/no-unsafe-finally) |
| [no-unsafe-negation](https://eslint.org/docs/latest/rules/no-unsafe-negation) | [noUnsafeNegation](/linter/rules/no-unsafe-negation) |
| [no-unsafe-optional-chaining](https://eslint.org/docs/latest/rules/no-unsafe-optional-chaining) | [noUnsafeOptionalChaining](/linter/rules/no-unsafe-optional-chaining) |
| [no-unused-expressions](https://eslint.org/docs/latest/rules/no-unused-expressions) | [noUnusedExpressions](/linter/rules/no-unused-expressions) |
| [no-unused-labels](https://eslint.org/docs/latest/rules/no-unused-labels) | [noUnusedLabels](/linter/rules/no-unused-labels) |
| [no-unused-private-class-members](https://eslint.org/docs/latest/rules/no-unused-private-class-members) | [noUnusedPrivateClassMembers](/linter/rules/no-unused-private-class-members) |
| [no-unused-vars](https://eslint.org/docs/latest/rules/no-unused-vars) | [noUnusedVariables](/linter/rules/no-unused-variables) |
| [no-use-before-define](https://eslint.org/docs/latest/rules/no-use-before-define) | [noInvalidUseBeforeDeclaration](/linter/rules/no-invalid-use-before-declaration) |
| [no-useless-backreference](https://eslint.org/docs/latest/rules/no-useless-backreference) | [noUselessRegexBackrefs](/linter/rules/no-useless-regex-backrefs) |
| [no-useless-catch](https://eslint.org/docs/latest/rules/no-useless-catch) | [noUselessCatch](/linter/rules/no-useless-catch) |
| [no-useless-computed-key](https://eslint.org/docs/latest/rules/no-useless-computed-key) | [useLiteralKeys](/linter/rules/use-literal-keys) |
| [no-useless-concat](https://eslint.org/docs/latest/rules/no-useless-concat) | [noUselessStringConcat](/linter/rules/no-useless-string-concat) |
| [no-useless-constructor](https://eslint.org/docs/latest/rules/no-useless-constructor) | [noUselessConstructor](/linter/rules/no-useless-constructor) |
| [no-useless-escape](https://eslint.org/docs/latest/rules/no-useless-escape) | [noUselessEscapeInRegex](/linter/rules/no-useless-escape-in-regex) |
| [no-useless-rename](https://eslint.org/docs/latest/rules/no-useless-rename) | [noUselessRename](/linter/rules/no-useless-rename) |
| [no-var](https://eslint.org/docs/latest/rules/no-var) | [noVar](/linter/rules/no-var) |
| [no-void](https://eslint.org/docs/latest/rules/no-void) | [noVoid](/linter/rules/no-void) |
| [no-with](https://eslint.org/docs/latest/rules/no-with) | [noWith](/linter/rules/no-with) |
| [object-shorthand](https://eslint.org/docs/latest/rules/object-shorthand) | [useConsistentObjectDefinitions](/linter/rules/use-consistent-object-definitions) (inspired) |
| [one-var](https://eslint.org/docs/latest/rules/one-var) | [useSingleVarDeclarator](/linter/rules/use-single-var-declarator) |
| [operator-assignment](https://eslint.org/docs/latest/rules/operator-assignment) | [useShorthandAssign](/linter/rules/use-shorthand-assign) |
| [prefer-arrow-callback](https://eslint.org/docs/latest/rules/prefer-arrow-callback) | [useArrowFunction](/linter/rules/use-arrow-function) (inspired) |
| [prefer-const](https://eslint.org/docs/latest/rules/prefer-const) | [useConst](/linter/rules/use-const) |
| [prefer-destructuring](https://eslint.org/docs/latest/rules/prefer-destructuring) | [useDestructuring](/linter/rules/use-destructuring) |
| [prefer-exponentiation-operator](https://eslint.org/docs/latest/rules/prefer-exponentiation-operator) | [useExponentiationOperator](/linter/rules/use-exponentiation-operator) |
| [prefer-numeric-literals](https://eslint.org/docs/latest/rules/prefer-numeric-literals) | [useNumericLiterals](/linter/rules/use-numeric-literals) |
| [prefer-object-has-own](https://eslint.org/docs/latest/rules/prefer-object-has-own) | [noPrototypeBuiltins](/linter/rules/no-prototype-builtins) |
| [prefer-object-spread](https://eslint.org/docs/latest/rules/prefer-object-spread) | [useObjectSpread](/linter/rules/use-object-spread) |
| [prefer-regex-literals](https://eslint.org/docs/latest/rules/prefer-regex-literals) | [useRegexLiterals](/linter/rules/use-regex-literals) |
| [prefer-rest-params](https://eslint.org/docs/latest/rules/prefer-rest-params) | [noArguments](/linter/rules/no-arguments) |
| [prefer-spread](https://eslint.org/docs/latest/rules/prefer-spread) | [useSpread](/linter/rules/use-spread) |
| [prefer-template](https://eslint.org/docs/latest/rules/prefer-template) | [useTemplate](/linter/rules/use-template) |
| [radix](https://eslint.org/docs/latest/rules/radix) | [useParseIntRadix](/linter/rules/use-parse-int-radix) |
| [require-await](https://eslint.org/docs/latest/rules/require-await) | [useAwait](/linter/rules/use-await) |
| [require-yield](https://eslint.org/docs/latest/rules/require-yield) | [useYield](/linter/rules/use-yield) |
| [symbol-description](https://eslint.org/docs/latest/rules/symbol-description) | [useSymbolDescription](/linter/rules/use-symbol-description) |
| [use-isnan](https://eslint.org/docs/latest/rules/use-isnan) | [useIsNan](/linter/rules/use-is-nan) |
| [valid-typeof](https://eslint.org/docs/latest/rules/valid-typeof) | [useValidTypeof](/linter/rules/use-valid-typeof) |
| [yoda](https://eslint.org/docs/latest/rules/yoda) | [noYodaExpression](/linter/rules/no-yoda-expression) |

### eslint-plugin-barrel-files


| eslint-plugin-barrel-files Rules name | Biome Rules name |
| --- | --- |
| [avoid-barrel-files](https://github.com/thepassle/eslint-plugin-barrel-files/blob/main/docs/rules/avoid-barrel-files.md) | [noBarrelFile](/linter/rules/no-barrel-file) (inspired) |
| [avoid-namespace-import](https://github.com/thepassle/eslint-plugin-barrel-files/blob/main/docs/rules/avoid-namespace-import.md) | [noNamespaceImport](/linter/rules/no-namespace-import) |
| [avoid-re-export-all](https://github.com/thepassle/eslint-plugin-barrel-files/blob/main/docs/rules/avoid-re-export-all.md) | [noReExportAll](/linter/rules/no-re-export-all) |

### eslint-plugin-import


| eslint-plugin-import Rules name | Biome Rules name |
| --- | --- |
| [enforce-node-protocol-usage](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/enforce-node-protocol-usage.md) | [useNodejsImportProtocol](/linter/rules/use-nodejs-import-protocol) |
| [exports-last](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/exports-last.md) | [useExportsLast](/linter/rules/use-exports-last) |
| [named](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/named.md) | [noUnresolvedImports](/linter/rules/no-unresolved-imports) (inspired) |
| [no-commonjs](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-commonjs.md) | [noCommonJs](/linter/rules/no-common-js) |
| [no-cycle](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-cycle.md) | [noImportCycles](/linter/rules/no-import-cycles) |
| [no-default-export](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-default-export.md) | [noDefaultExport](/linter/rules/no-default-export) |
| [no-deprecated](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-deprecated.md) | [noDeprecatedImports](/linter/rules/no-deprecated-imports) (inspired) |
| [no-extraneous-dependencies](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-extraneous-dependencies.md) | [noUndeclaredDependencies](/linter/rules/no-undeclared-dependencies) |
| [no-nodejs-modules](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-nodejs-modules.md) | [noNodejsModules](/linter/rules/no-nodejs-modules) |

### eslint-plugin-import-access


| eslint-plugin-import-access Rules name | Biome Rules name |
| --- | --- |
| [eslint-plugin-import-access](https://github.com/uhyo/eslint-plugin-import-access) | [noPrivateImports](/linter/rules/no-private-imports) |

### eslint-plugin-jest


| eslint-plugin-jest Rules name | Biome Rules name |
| --- | --- |
| [max-nested-describe](https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/max-nested-describe.md) | [noExcessiveNestedTestSuites](/linter/rules/no-excessive-nested-test-suites) |
| [no-disabled-tests](https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-disabled-tests.md) | [noSkippedTests](/linter/rules/no-skipped-tests) (inspired) |
| [no-done-callback](https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-done-callback.md) | [noDoneCallback](/linter/rules/no-done-callback) |
| [no-duplicate-hooks](https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-duplicate-hooks.md) | [noDuplicateTestHooks](/linter/rules/no-duplicate-test-hooks) (inspired) |
| [no-export](https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-export.md) | [noExportsInTest](/linter/rules/no-exports-in-test) (inspired) |
| [no-focused-tests](https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-focused-tests.md) | [noFocusedTests](/linter/rules/no-focused-tests) (inspired) |
| [no-standalone-expect](https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-standalone-expect.md) | [noMisplacedAssertion](/linter/rules/no-misplaced-assertion) (inspired) |

### eslint-plugin-jsdoc


| eslint-plugin-jsdoc Rules name | Biome Rules name |
| --- | --- |
| [no-multi-asterisks](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/no-multi-asterisks.md) | [useSingleJsDocAsterisk](/linter/rules/use-single-js-doc-asterisk) |

### eslint-plugin-jsx-a11y


| eslint-plugin-jsx-a11y Rules name | Biome Rules name |
| --- | --- |
| [alt-text](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/alt-text.md) | [useAltText](/linter/rules/use-alt-text) |
| [anchor-ambiguous-text](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/anchor-ambiguous-text.md) | [noAmbiguousAnchorText](/linter/rules/no-ambiguous-anchor-text) |
| [anchor-has-content](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/anchor-has-content.md) | [useAnchorContent](/linter/rules/use-anchor-content) |
| [anchor-is-valid](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/anchor-is-valid.md) | [useValidAnchor](/linter/rules/use-valid-anchor) |
| [aria-activedescendant-has-tabindex](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/aria-activedescendant-has-tabindex.md) | [useAriaActivedescendantWithTabindex](/linter/rules/use-aria-activedescendant-with-tabindex) |
| [aria-props](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/aria-props.md) | [useValidAriaProps](/linter/rules/use-valid-aria-props) |
| [aria-proptypes](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/aria-proptypes.md) | [useValidAriaValues](/linter/rules/use-valid-aria-values) |
| [aria-role](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/aria-role.md) | [useValidAriaRole](/linter/rules/use-valid-aria-role) |
| [aria-unsupported-elements](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/aria-unsupported-elements.md) | [noAriaUnsupportedElements](/linter/rules/no-aria-unsupported-elements) |
| [autocomplete-valid](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/autocomplete-valid.md) | [useValidAutocomplete](/linter/rules/use-valid-autocomplete) |
| [click-events-have-key-events](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/click-events-have-key-events.md) | [useKeyWithClickEvents](/linter/rules/use-key-with-click-events) |
| [heading-has-content](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/heading-has-content.md) | [useHeadingContent](/linter/rules/use-heading-content) |
| [html-has-lang](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/html-has-lang.md) | [useHtmlLang](/linter/rules/use-html-lang) |
| [iframe-has-title](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/iframe-has-title.md) | [useIframeTitle](/linter/rules/use-iframe-title) |
| [img-redundant-alt](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/img-redundant-alt.md) | [noRedundantAlt](/linter/rules/no-redundant-alt) |
| [interactive-supports-focus](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/interactive-supports-focus.md) | [useFocusableInteractive](/linter/rules/use-focusable-interactive) |
| [label-has-associated-control](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/label-has-associated-control.md) | [noLabelWithoutControl](/linter/rules/no-label-without-control) |
| [lang](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/lang.md) | [useValidLang](/linter/rules/use-valid-lang) |
| [media-has-caption](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/media-has-caption.md) | [useMediaCaption](/linter/rules/use-media-caption) |
| [mouse-events-have-key-events](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/mouse-events-have-key-events.md) | [useKeyWithMouseEvents](/linter/rules/use-key-with-mouse-events) |
| [no-access-key](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-access-key.md) | [noAccessKey](/linter/rules/no-access-key) |
| [no-aria-hidden-on-focusable](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-aria-hidden-on-focusable.md) | [noAriaHiddenOnFocusable](/linter/rules/no-aria-hidden-on-focusable) |
| [no-autofocus](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-autofocus.md) | [noAutofocus](/linter/rules/no-autofocus) |
| [no-distracting-elements](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-distracting-elements.md) | [noDistractingElements](/linter/rules/no-distracting-elements) |
| [no-interactive-element-to-noninteractive-role](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-interactive-element-to-noninteractive-role.md) | [noInteractiveElementToNoninteractiveRole](/linter/rules/no-interactive-element-to-noninteractive-role) |
| [no-noninteractive-element-interactions](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-noninteractive-element-interactions.md) | [noNoninteractiveElementInteractions](/linter/rules/no-noninteractive-element-interactions) |
| [no-noninteractive-element-to-interactive-role](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-noninteractive-element-to-interactive-role.md) | [noNoninteractiveElementToInteractiveRole](/linter/rules/no-noninteractive-element-to-interactive-role) |
| [no-noninteractive-tabindex](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-noninteractive-tabindex.md) | [noNoninteractiveTabindex](/linter/rules/no-noninteractive-tabindex) |
| [no-redundant-roles](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-redundant-roles.md) | [noRedundantRoles](/linter/rules/no-redundant-roles) |
| [no-static-element-interactions](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-static-element-interactions.md) | [noStaticElementInteractions](/linter/rules/no-static-element-interactions) |
| [prefer-tag-over-role](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/prefer-tag-over-role.md) | [useSemanticElements](/linter/rules/use-semantic-elements) |
| [role-has-required-aria-props](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/role-has-required-aria-props.md) | [useAriaPropsForRole](/linter/rules/use-aria-props-for-role) |
| [role-supports-aria-props](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/role-supports-aria-props.md) | [useAriaPropsSupportedByRole](/linter/rules/use-aria-props-supported-by-role) |
| [scope](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/scope.md) | [noHeaderScope](/linter/rules/no-header-scope) |
| [tabindex-no-positive](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/tabindex-no-positive.md) | [noPositiveTabindex](/linter/rules/no-positive-tabindex) |

### eslint-plugin-n


| eslint-plugin-n Rules name | Biome Rules name |
| --- | --- |
| [no-process-env](https://github.com/eslint-community/eslint-plugin-n/blob/master/docs/rules/no-process-env.md) | [noProcessEnv](/linter/rules/no-process-env) |

### eslint-plugin-no-secrets


| eslint-plugin-no-secrets Rules name | Biome Rules name |
| --- | --- |
| [no-secrets](https://github.com/nickdeis/eslint-plugin-no-secrets/blob/master/README.md) | [noSecrets](/linter/rules/no-secrets) (inspired) |

### eslint-plugin-qwik


| eslint-plugin-qwik Rules name | Biome Rules name |
| --- | --- |
| [jsx-a](https://qwik.dev/docs/advanced/eslint/#jsx-a) | [useValidAnchor](/linter/rules/use-valid-anchor) |
| [jsx-img](https://qwik.dev/docs/advanced/eslint/#jsx-img) | [useImageSize](/linter/rules/use-image-size) |
| [jsx-key](https://qwik.dev/docs/advanced/eslint/#jsx-key) | [useJsxKeyInIterable](/linter/rules/use-jsx-key-in-iterable) |
| [jsx-no-script-url](https://qwik.dev/docs/advanced/eslint/#jsx-no-script-url) | [noScriptUrl](/linter/rules/no-script-url) |
| [no-react-props](https://qwik.dev/docs/advanced/eslint/#no-react-props) | [noReactSpecificProps](/linter/rules/no-react-specific-props) |
| [no-use-visible-task](https://qwik.dev/docs/advanced/eslint/#no-use-visible-task) | [noQwikUseVisibleTask](/linter/rules/no-qwik-use-visible-task) |
| [prefer-classlist](https://qwik.dev/docs/advanced/eslint/#prefer-classlist) | [useQwikClasslist](/linter/rules/use-qwik-classlist) |
| [use-method-usage](https://qwik.dev/docs/advanced/eslint/#use-method-usage) | [useQwikMethodUsage](/linter/rules/use-qwik-method-usage) |
| [valid-lexical-scope](https://qwik.dev/docs/advanced/eslint/#valid-lexical-scope) | [useQwikValidLexicalScope](/linter/rules/use-qwik-valid-lexical-scope) |

### eslint-plugin-react


| eslint-plugin-react Rules name | Biome Rules name |
| --- | --- |
| [button-has-type](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/button-has-type.md) | [useButtonType](/linter/rules/use-button-type) |
| [forbid-elements](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/forbid-elements.md) | [noRestrictedElements](/linter/rules/no-restricted-elements) |
| [jsx-boolean-value](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-boolean-value.md) | [noImplicitBoolean](/linter/rules/no-implicit-boolean) (inspired) |
| [jsx-curly-brace-presence](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-curly-brace-presence.md) | [useConsistentCurlyBraces](/linter/rules/use-consistent-curly-braces) (inspired) |
| [jsx-fragments](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-fragments.md) | [useFragmentSyntax](/linter/rules/use-fragment-syntax) |
| [jsx-key](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-key.md) | [useJsxKeyInIterable](/linter/rules/use-jsx-key-in-iterable) |
| [jsx-no-comment-textnodes](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-comment-textnodes.md) | [noCommentText](/linter/rules/no-comment-text) |
| [jsx-no-duplicate-props](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-duplicate-props.md) | [noDuplicateJsxProps](/linter/rules/no-duplicate-jsx-props) |
| [jsx-no-leaked-render](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-leaked-render.md) | [noLeakedRender](/linter/rules/no-leaked-render) (inspired) |
| [jsx-no-literals](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-literals.md) | [noJsxLiterals](/linter/rules/no-jsx-literals) |
| [jsx-no-script-url](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-script-url.md) | [noScriptUrl](/linter/rules/no-script-url) |
| [jsx-no-target-blank](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-target-blank.md) | [noBlankTarget](/linter/rules/no-blank-target) (inspired) |
| [jsx-no-useless-fragment](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-useless-fragment.md) | [noUselessFragments](/linter/rules/no-useless-fragments) |
| [jsx-props-no-spread-multi](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-props-no-spread-multi.md) | [noDuplicatedSpreadProps](/linter/rules/no-duplicated-spread-props) |
| [no-array-index-key](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-array-index-key.md) | [noArrayIndexKey](/linter/rules/no-array-index-key) |
| [no-children-prop](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-children-prop.md) | [noChildrenProp](/linter/rules/no-children-prop) |
| [no-danger](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-danger.md) | [noDangerouslySetInnerHtml](/linter/rules/no-dangerously-set-inner-html/) |
| [no-danger-with-children](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-danger-with-children.md) | [noDangerouslySetInnerHtmlWithChildren](/linter/rules/no-dangerously-set-inner-html-with-children) |
| [no-unknown-property](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-unknown-property.md) | [noUnknownAttribute](/linter/rules/no-unknown-attribute) |
| [void-dom-elements-no-children](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/void-dom-elements-no-children.md) | [noVoidElementsWithChildren](/linter/rules/no-void-elements-with-children) |

### eslint-plugin-react-hooks


| eslint-plugin-react-hooks Rules name | Biome Rules name |
| --- | --- |
| [exhaustive-deps](https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/README.md) | [useExhaustiveDependencies](/linter/rules/use-exhaustive-dependencies) |
| [react-compiler](https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/README.md) | [noReactPropAssignments](/linter/rules/no-react-prop-assignments) |
| [rules-of-hooks](https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/README.md) | [useHookAtTopLevel](/linter/rules/use-hook-at-top-level) |

### eslint-plugin-react-prefer-function-component


| eslint-plugin-react-prefer-function-component Rules name | Biome Rules name |
| --- | --- |
| [react-prefer-function-component](https://github.com/tatethurston/eslint-plugin-react-prefer-function-component) | [useReactFunctionComponents](/linter/rules/use-react-function-components) |

### eslint-plugin-react-refresh


| eslint-plugin-react-refresh Rules name | Biome Rules name |
| --- | --- |
| [only-export-components](https://github.com/ArnaudBarre/eslint-plugin-react-refresh) | [useComponentExportOnlyModules](/linter/rules/use-component-export-only-modules) (inspired) |

### eslint-plugin-react-x


| eslint-plugin-react-x Rules name | Biome Rules name |
| --- | --- |
| [no-forward-ref](https://eslint-react.xyz/docs/rules/no-forward-ref) | [noReactForwardRef](/linter/rules/no-react-forward-ref) |
| [no-nested-components](https://eslint-react.xyz/docs/rules/no-nested-components) | [noNestedComponentDefinitions](/linter/rules/no-nested-component-definitions) |
| [no-useless-fragment](https://eslint-react.xyz/docs/rules/no-useless-fragment) | [noUselessFragments](/linter/rules/no-useless-fragments) |

### eslint-plugin-regexp


| eslint-plugin-regexp Rules name | Biome Rules name |
| --- | --- |
| [no-useless-backreference](https://ota-meshi.github.io/eslint-plugin-regexp/rules/no-useless-backreference.html) | [noUselessRegexBackrefs](/linter/rules/no-useless-regex-backrefs) |
| [prefer-regexp-exec](https://ota-meshi.github.io/eslint-plugin-regexp/rules/prefer-regexp-exec.html) | [useRegexpExec](/linter/rules/use-regexp-exec) |

### eslint-plugin-solid


| eslint-plugin-solid Rules name | Biome Rules name |
| --- | --- |
| [jsx-no-script-url](https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/jsx-no-script-url.md) | [noScriptUrl](/linter/rules/no-script-url) |
| [no-destructure](https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-destructure.md) | [noSolidDestructuredProps](/linter/rules/no-solid-destructured-props) (inspired) |
| [no-react-specific-props](https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/no-react-specific-props.md) | [noReactSpecificProps](/linter/rules/no-react-specific-props) |
| [prefer-for](https://github.com/solidjs-community/eslint-plugin-solid/blob/main/packages/eslint-plugin-solid/docs/prefer-for.md) | [useSolidForComponent](/linter/rules/use-solid-for-component) (inspired) |

### eslint-plugin-sonarjs


| eslint-plugin-sonarjs Rules name | Biome Rules name |
| --- | --- |
| [cognitive-complexity](https://github.com/SonarSource/eslint-plugin-sonarjs/blob/HEAD/docs/rules/cognitive-complexity.md) | [noExcessiveCognitiveComplexity](/linter/rules/no-excessive-cognitive-complexity) |
| [prefer-while](https://github.com/SonarSource/eslint-plugin-sonarjs/blob/HEAD/docs/rules/prefer-while.md) | [useWhile](/linter/rules/use-while) |

### eslint-plugin-turbo


| eslint-plugin-turbo Rules name | Biome Rules name |
| --- | --- |
| [no-undeclared-env-vars](https://github.com/vercel/turborepo/blob/main/packages/eslint-plugin-turbo/docs/rules/no-undeclared-env-vars.md) | [noUndeclaredEnvVars](/linter/rules/no-undeclared-env-vars) |

### eslint-plugin-unicorn


| eslint-plugin-unicorn Rules name | Biome Rules name |
| --- | --- |
| [error-message](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/error-message.md) | [useErrorMessage](/linter/rules/use-error-message) |
| [explicit-length-check](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/explicit-length-check.md) | [useExplicitLengthCheck](/linter/rules/use-explicit-length-check) |
| [filename-case](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/filename-case.md) | [useFilenamingConvention](/linter/rules/use-filenaming-convention) (inspired) |
| [new-for-builtins](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/new-for-builtins.md) | [noInvalidBuiltinInstantiation](/linter/rules/no-invalid-builtin-instantiation) |
| [no-array-for-each](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-array-for-each.md) | [noForEach](/linter/rules/no-for-each) |
| [no-document-cookie](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-document-cookie.md) | [noDocumentCookie](/linter/rules/no-document-cookie) |
| [no-empty-file](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-empty-file.md) | [noEmptySource](/linter/rules/no-empty-source) |
| [no-for-loop](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-for-loop.md) | [useForOf](/linter/rules/use-for-of) |
| [no-instanceof-array](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-instanceof-array.md) | [useIsArray](/linter/rules/use-is-array) |
| [no-lonely-if](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-lonely-if.md) | [useCollapsedIf](/linter/rules/use-collapsed-if) |
| [no-static-only-class](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-static-only-class.md) | [noStaticOnlyClass](/linter/rules/no-static-only-class) |
| [no-thenable](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-thenable.md) | [noThenProperty](/linter/rules/no-then-property) |
| [no-useless-switch-case](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-switch-case.md) | [noUselessSwitchCase](/linter/rules/no-useless-switch-case) |
| [no-useless-undefined](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-undefined.md) | [noUselessUndefined](/linter/rules/no-useless-undefined) |
| [numeric-separators-style](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/numeric-separators-style.md) | [useNumericSeparators](/linter/rules/use-numeric-separators) |
| [prefer-array-flat-map](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-flat-map.md) | [useFlatMap](/linter/rules/use-flat-map) |
| [prefer-array-index-of](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-array-index-of.md) | [useIndexOf](/linter/rules/use-index-of) |
| [prefer-at](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-at.md) | [useAtIndex](/linter/rules/use-at-index) (inspired) |
| [prefer-date-now](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-date-now.md) | [useDateNow](/linter/rules/use-date-now) |
| [prefer-module](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-module.md) | [noGlobalDirnameFilename](/linter/rules/no-global-dirname-filename) (inspired) |
| [prefer-node-protocol](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-node-protocol.md) | [useNodejsImportProtocol](/linter/rules/use-nodejs-import-protocol) |
| [prefer-number-properties](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-number-properties.md) | [useNumberNamespace](/linter/rules/use-number-namespace) |
| [prefer-string-slice](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-slice.md) | [noSubstr](/linter/rules/no-substr) |
| [prefer-string-trim-start-end](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-trim-start-end.md) | [useTrimStartEnd](/linter/rules/use-trim-start-end) |
| [require-number-to-fixed-digits-argument](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/require-number-to-fixed-digits-argument.md) | [useNumberToFixedDigitsArgument](/linter/rules/use-number-to-fixed-digits-argument) |
| [throw-new-error](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/throw-new-error.md) | [useThrowNewError](/linter/rules/use-throw-new-error) |

### eslint-plugin-unused-imports


| eslint-plugin-unused-imports Rules name | Biome Rules name |
| --- | --- |
| [no-unused-imports](https://github.com/sweepline/eslint-plugin-unused-imports/blob/master/docs/rules/no-unused-imports.md) | [noUnusedImports](/linter/rules/no-unused-imports) |
| [no-unused-vars](https://github.com/sweepline/eslint-plugin-unused-imports/blob/master/docs/rules/no-unused-vars.md) | [noUnusedVariables](/linter/rules/no-unused-variables) |

### eslint-plugin-vue


| eslint-plugin-vue Rules name | Biome Rules name |
| --- | --- |
| [define-macros-order](https://eslint.vuejs.org/rules/define-macros-order) | [useVueDefineMacrosOrder](/linter/rules/use-vue-define-macros-order) |
| [multi-word-component-names](https://eslint.vuejs.org/rules/multi-word-component-names) | [useVueMultiWordComponentNames](/linter/rules/use-vue-multi-word-component-names) (inspired) |
| [no-deprecated-data-object-declaration](https://eslint.vuejs.org/rules/no-deprecated-data-object-declaration) | [noVueDataObjectDeclaration](/linter/rules/no-vue-data-object-declaration) (inspired) |
| [no-dupe-keys](https://eslint.vuejs.org/rules/no-dupe-keys) | [noVueDuplicateKeys](/linter/rules/no-vue-duplicate-keys) |
| [no-reserved-keys](https://eslint.vuejs.org/rules/no-reserved-keys) | [noVueReservedKeys](/linter/rules/no-vue-reserved-keys) |
| [no-reserved-props](https://eslint.vuejs.org/rules/no-reserved-props) | [noVueReservedProps](/linter/rules/no-vue-reserved-props) |
| [no-setup-props-reactivity-loss](https://eslint.vuejs.org/rules/no-setup-props-reactivity-loss) | [noVueSetupPropsReactivityLoss](/linter/rules/no-vue-setup-props-reactivity-loss) (inspired) |
| [no-shared-component-data](https://eslint.vuejs.org/rules/no-shared-component-data) | [noVueDataObjectDeclaration](/linter/rules/no-vue-data-object-declaration) (inspired) |

### typescript-eslint


| typescript-eslint Rules name | Biome Rules name |
| --- | --- |
| [adjacent-overload-signatures](https://typescript-eslint.io/rules/adjacent-overload-signatures) | [useAdjacentOverloadSignatures](/linter/rules/use-adjacent-overload-signatures) |
| [array-type](https://typescript-eslint.io/rules/array-type) | [useConsistentArrayType](/linter/rules/use-consistent-array-type) |
| [ban-ts-comment](https://typescript-eslint.io/rules/ban-ts-comment) | [noTsIgnore](/linter/rules/no-ts-ignore) (inspired) |
| [ban-types](https://typescript-eslint.io/rules/ban-types) | [noBannedTypes](/linter/rules/no-banned-types) |
| [consistent-type-definitions](https://typescript-eslint.io/rules/consistent-type-definitions) | [useConsistentTypeDefinitions](/linter/rules/use-consistent-type-definitions) |
| [consistent-type-exports](https://typescript-eslint.io/rules/consistent-type-exports) | [useExportType](/linter/rules/use-export-type) (inspired) |
| [consistent-type-imports](https://typescript-eslint.io/rules/consistent-type-imports) | [useImportType](/linter/rules/use-import-type) (inspired) |
| [default-param-last](https://typescript-eslint.io/rules/default-param-last) | [useDefaultParameterLast](/linter/rules/use-default-parameter-last) |
| [dot-notation](https://typescript-eslint.io/rules/dot-notation) | [useLiteralKeys](/linter/rules/use-literal-keys) |
| [explicit-function-return-type](https://typescript-eslint.io/rules/explicit-function-return-type) | [useExplicitType](/linter/rules/use-explicit-type) (inspired) |
| [explicit-member-accessibility](https://typescript-eslint.io/rules/explicit-member-accessibility) | [useConsistentMemberAccessibility](/linter/rules/use-consistent-member-accessibility) |
| [explicit-module-boundary-types](https://typescript-eslint.io/rules/explicit-module-boundary-types) | [useExplicitType](/linter/rules/use-explicit-type) (inspired) |
| [max-params](https://typescript-eslint.io/rules/max-params) | [useMaxParams](/linter/rules/use-max-params) |
| [naming-convention](https://typescript-eslint.io/rules/naming-convention) | [useNamingConvention](/linter/rules/use-naming-convention) (inspired) |
| [no-array-constructor](https://typescript-eslint.io/rules/no-array-constructor) | [useArrayLiterals](/linter/rules/use-array-literals) |
| [no-deprecated](https://typescript-eslint.io/rules/no-deprecated) | [noDeprecatedImports](/linter/rules/no-deprecated-imports) (inspired) |
| [no-dupe-class-members](https://typescript-eslint.io/rules/no-dupe-class-members) | [noDuplicateClassMembers](/linter/rules/no-duplicate-class-members) |
| [no-empty-function](https://typescript-eslint.io/rules/no-empty-function) | [noEmptyBlockStatements](/linter/rules/no-empty-block-statements) |
| [no-empty-interface](https://typescript-eslint.io/rules/no-empty-interface) | [noEmptyInterface](/linter/rules/no-empty-interface) (inspired) |
| [no-explicit-any](https://typescript-eslint.io/rules/no-explicit-any) | [noExplicitAny](/linter/rules/no-explicit-any) |
| [no-extra-non-null-assertion](https://typescript-eslint.io/rules/no-extra-non-null-assertion) | [noExtraNonNullAssertion](/linter/rules/no-extra-non-null-assertion) |
| [no-extraneous-class](https://typescript-eslint.io/rules/no-extraneous-class) | [noStaticOnlyClass](/linter/rules/no-static-only-class) |
| [no-floating-promises](https://typescript-eslint.io/rules/no-floating-promises) | [noFloatingPromises](/linter/rules/no-floating-promises) |
| [no-for-in-array](https://typescript-eslint.io/rules/no-for-in-array) | [noForIn](/linter/rules/no-for-in) (inspired) |
| [no-inferrable-types](https://typescript-eslint.io/rules/no-inferrable-types) | [noInferrableTypes](/linter/rules/no-inferrable-types) |
| [no-invalid-void-type](https://typescript-eslint.io/rules/no-invalid-void-type) | [noConfusingVoidType](/linter/rules/no-confusing-void-type) |
| [no-loss-of-precision](https://typescript-eslint.io/rules/no-loss-of-precision) | [noPrecisionLoss](/linter/rules/no-precision-loss) |
| [no-magic-numbers](https://typescript-eslint.io/rules/no-magic-numbers) | [noMagicNumbers](/linter/rules/no-magic-numbers) |
| [no-misused-new](https://typescript-eslint.io/rules/no-misused-new) | [noMisleadingInstantiator](/linter/rules/no-misleading-instantiator) |
| [no-misused-promises](https://typescript-eslint.io/rules/no-misused-promises) | [noMisusedPromises](/linter/rules/no-misused-promises) |
| [no-namespace](https://typescript-eslint.io/rules/no-namespace) | [noNamespace](/linter/rules/no-namespace) |
| [no-non-null-asserted-optional-chain](https://typescript-eslint.io/rules/no-non-null-asserted-optional-chain) | [noNonNullAssertedOptionalChain](/linter/rules/no-non-null-asserted-optional-chain) |
| [no-non-null-assertion](https://typescript-eslint.io/rules/no-non-null-assertion) | [noNonNullAssertion](/linter/rules/no-non-null-assertion) |
| [no-redeclare](https://typescript-eslint.io/rules/no-redeclare) | [noRedeclare](/linter/rules/no-redeclare) |
| [no-require-imports](https://typescript-eslint.io/rules/no-require-imports) | [noCommonJs](/linter/rules/no-common-js) |
| [no-restricted-imports](https://typescript-eslint.io/rules/no-restricted-imports) | [noRestrictedImports](/linter/rules/no-restricted-imports) |
| [no-restricted-types](https://typescript-eslint.io/rules/no-restricted-types) | [noRestrictedTypes](/linter/rules/no-restricted-types) |
| [no-this-alias](https://typescript-eslint.io/rules/no-this-alias) | [noUselessThisAlias](/linter/rules/no-useless-this-alias) (inspired) |
| [no-unnecessary-condition](https://typescript-eslint.io/rules/no-unnecessary-condition) | [noUnnecessaryConditions](/linter/rules/no-unnecessary-conditions) (inspired) |
| [no-unnecessary-type-constraint](https://typescript-eslint.io/rules/no-unnecessary-type-constraint) | [noUselessTypeConstraint](/linter/rules/no-useless-type-constraint) |
| [no-unsafe-declaration-merging](https://typescript-eslint.io/rules/no-unsafe-declaration-merging) | [noUnsafeDeclarationMerging](/linter/rules/no-unsafe-declaration-merging) |
| [no-unused-vars](https://typescript-eslint.io/rules/no-unused-vars) | [noUnusedVariables](/linter/rules/no-unused-variables) |
| [no-use-before-define](https://typescript-eslint.io/rules/no-use-before-define) | [noInvalidUseBeforeDeclaration](/linter/rules/no-invalid-use-before-declaration) |
| [no-useless-constructor](https://typescript-eslint.io/rules/no-useless-constructor) | [noUselessConstructor](/linter/rules/no-useless-constructor) |
| [no-useless-empty-export](https://typescript-eslint.io/rules/no-useless-empty-export) | [noUselessEmptyExport](/linter/rules/no-useless-empty-export) |
| [only-throw-error](https://typescript-eslint.io/rules/only-throw-error) | [useThrowOnlyError](/linter/rules/use-throw-only-error) (inspired) |
| [parameter-properties](https://typescript-eslint.io/rules/parameter-properties) | [noParameterProperties](/linter/rules/no-parameter-properties) (inspired) |
| [prefer-as-const](https://typescript-eslint.io/rules/prefer-as-const) | [useAsConstAssertion](/linter/rules/use-as-const-assertion) |
| [prefer-enum-initializers](https://typescript-eslint.io/rules/prefer-enum-initializers) | [useEnumInitializers](/linter/rules/use-enum-initializers) |
| [prefer-find](https://typescript-eslint.io/rules/prefer-find) | [useFind](/linter/rules/use-find) |
| [prefer-for-of](https://typescript-eslint.io/rules/prefer-for-of) | [useForOf](/linter/rules/use-for-of) |
| [prefer-function-type](https://typescript-eslint.io/rules/prefer-function-type) | [useShorthandFunctionType](/linter/rules/use-shorthand-function-type) |
| [prefer-literal-enum-member](https://typescript-eslint.io/rules/prefer-literal-enum-member) | [useLiteralEnumMembers](/linter/rules/use-literal-enum-members) |
| [prefer-namespace-keyword](https://typescript-eslint.io/rules/prefer-namespace-keyword) | [useNamespaceKeyword](/linter/rules/use-namespace-keyword) |
| [prefer-optional-chain](https://typescript-eslint.io/rules/prefer-optional-chain) | [useOptionalChain](/linter/rules/use-optional-chain) |
| [prefer-readonly](https://typescript-eslint.io/rules/prefer-readonly) | [useReadonlyClassProperties](/linter/rules/use-readonly-class-properties) |
| [prefer-regexp-exec](https://typescript-eslint.io/rules/prefer-regexp-exec) | [useRegexpExec](/linter/rules/use-regexp-exec) |
| [require-array-sort-compare](https://typescript-eslint.io/rules/require-array-sort-compare) | [useArraySortCompare](/linter/rules/use-array-sort-compare) |
| [require-await](https://typescript-eslint.io/rules/require-await) | [useAwait](/linter/rules/use-await) |
| [switch-exhaustiveness-check](https://typescript-eslint.io/rules/switch-exhaustiveness-check) | [useExhaustiveSwitchCases](/linter/rules/use-exhaustive-switch-cases) |
| [unified-signatures](https://typescript-eslint.io/rules/unified-signatures) | [useUnifiedTypeSignatures](/linter/rules/use-unified-type-signatures) |
| [use-await-thenable](https://typescript-eslint.io/rules/use-await-thenable) | [useAwaitThenable](/linter/rules/use-await-thenable) (inspired) |

Missing a rule? Help us by [contributing](https://github.com/biomejs/biome/blob/main/CONTRIBUTING.md) to the [analyzer](https://github.com/biomejs/biome/blob/main/crates/biome_analyze/CONTRIBUTING.md) or create a rule suggestion [here](https://github.com/biomejs/biome/discussions/categories/rule-suggestion).
