# JavaScript Rules

Below the list of rules supported by Biome, divided by group. Here’s a legend of the emojis:

* The icon  indicates that the rule is part of the recommended rules.
* The icon  indicates that the rule provides a code action (fix) that is **safe** to apply.
* The icon  indicates that the rule provides a code action (fix) that is **unsafe** to apply.
* The icon  indicates that the rule has been implemented and scheduled for the next release.

## `a11y`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noAccessKey](/linter/rules/no-access-key) | Enforce that the `accessKey` attribute is not used on any HTML element. |  |
| [noAriaHiddenOnFocusable](/linter/rules/no-aria-hidden-on-focusable) | Enforce that aria-hidden=“true” is not set on focusable elements. |  |
| [noAriaUnsupportedElements](/linter/rules/no-aria-unsupported-elements) | Enforce that elements that do not support ARIA roles, states, and properties do not have those attributes. |  |
| [noAutofocus](/linter/rules/no-autofocus) | Enforce that autoFocus prop is not used on elements. |  |
| [noDistractingElements](/linter/rules/no-distracting-elements) | Enforces that no distracting elements are used. |  |
| [noHeaderScope](/linter/rules/no-header-scope) | The scope prop should be used only on `<th>` elements. |  |
| [noInteractiveElementToNoninteractiveRole](/linter/rules/no-interactive-element-to-noninteractive-role) | Enforce that non-interactive ARIA roles are not assigned to interactive HTML elements. |  |
| [noLabelWithoutControl](/linter/rules/no-label-without-control) | Enforce that a label element or component has a text label and an associated input. |  |
| [noNoninteractiveElementInteractions](/linter/rules/no-noninteractive-element-interactions) | Disallow use event handlers on non-interactive elements. |  |
| [noNoninteractiveElementToInteractiveRole](/linter/rules/no-noninteractive-element-to-interactive-role) | Enforce that interactive ARIA roles are not assigned to non-interactive HTML elements. |  |
| [noNoninteractiveTabindex](/linter/rules/no-noninteractive-tabindex) | Enforce that `tabIndex` is not assigned to non-interactive HTML elements. |  |
| [noPositiveTabindex](/linter/rules/no-positive-tabindex) | Prevent the usage of positive integers on `tabIndex` property |  |
| [noRedundantAlt](/linter/rules/no-redundant-alt) | Enforce `img` alt prop does not contain the word “image”, “picture”, or “photo”. |  |
| [noRedundantRoles](/linter/rules/no-redundant-roles) | Enforce explicit `role` property is not the same as implicit/default role property on an element. |  |
| [noStaticElementInteractions](/linter/rules/no-static-element-interactions) | Enforce that static, visible elements (such as `<div>`) that have click handlers use the valid role attribute. |  |
| [noSvgWithoutTitle](/linter/rules/no-svg-without-title) | Enforces the usage of the `title` element for the `svg` element. |  |
| [useAltText](/linter/rules/use-alt-text) | Enforce that all elements that require alternative text have meaningful information to relay back to the end user. |  |
| [useAnchorContent](/linter/rules/use-anchor-content) | Enforce that anchors have content and that the content is accessible to screen readers. |  |
| [useAriaActivedescendantWithTabindex](/linter/rules/use-aria-activedescendant-with-tabindex) | Enforce that `tabIndex` is assigned to non-interactive HTML elements with `aria-activedescendant`. |  |
| [useAriaPropsForRole](/linter/rules/use-aria-props-for-role) | Enforce that elements with ARIA roles must have all required ARIA attributes for that role. |  |
| [useAriaPropsSupportedByRole](/linter/rules/use-aria-props-supported-by-role) | Enforce that ARIA properties are valid for the roles that are supported by the element. |  |
| [useButtonType](/linter/rules/use-button-type) | Enforces the usage of the attribute `type` for the element `button` |  |
| [useFocusableInteractive](/linter/rules/use-focusable-interactive) | Elements with an interactive role and interaction handlers must be focusable. |  |
| [useHeadingContent](/linter/rules/use-heading-content) | Enforce that heading elements (h1, h2, etc.) have content and that the content is accessible to screen readers. Accessible means that it is not hidden using the aria-hidden prop. |  |
| [useHtmlLang](/linter/rules/use-html-lang) | Enforce that `html` element has `lang` attribute. |  |
| [useIframeTitle](/linter/rules/use-iframe-title) | Enforces the usage of the attribute `title` for the element `iframe`. |  |
| [useKeyWithClickEvents](/linter/rules/use-key-with-click-events) | Enforce onClick is accompanied by at least one of the following: `onKeyUp`, `onKeyDown`, `onKeyPress`. |  |
| [useKeyWithMouseEvents](/linter/rules/use-key-with-mouse-events) | Enforce `onMouseOver` / `onMouseOut` are accompanied by `onFocus` / `onBlur`. |  |
| [useMediaCaption](/linter/rules/use-media-caption) | Enforces that `audio` and `video` elements must have a `track` for captions. |  |
| [useSemanticElements](/linter/rules/use-semantic-elements) | It detects the use of `role` attributes in JSX elements and suggests using semantic elements instead. |  |
| [useValidAnchor](/linter/rules/use-valid-anchor) | Enforce that all anchors are valid, and they are navigable elements. |  |
| [useValidAriaProps](/linter/rules/use-valid-aria-props) | Ensures that ARIA properties `aria-*` are all valid. |  |
| [useValidAriaRole](/linter/rules/use-valid-aria-role) | Elements with ARIA roles must use a valid, non-abstract ARIA role. |  |
| [useValidAriaValues](/linter/rules/use-valid-aria-values) | Enforce that ARIA state and property values are valid. |  |
| [useValidAutocomplete](/linter/rules/use-valid-autocomplete) | Use valid values for the `autocomplete` attribute on `input` elements. |  |
| [useValidLang](/linter/rules/use-valid-lang) | Ensure that the attribute passed to the `lang` attribute is a correct ISO language and/or country. |  |

## `complexity`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noAdjacentSpacesInRegex](/linter/rules/no-adjacent-spaces-in-regex) | Disallow unclear usage of consecutive space characters in regular expression literals |  |
| [noArguments](/linter/rules/no-arguments) | Disallow the use of `arguments`. |  |
| [noBannedTypes](/linter/rules/no-banned-types) | Disallow primitive type aliases and misleading types. |  |
| [noCommaOperator](/linter/rules/no-comma-operator) | Disallow comma operator. |  |
| [noEmptyTypeParameters](/linter/rules/no-empty-type-parameters) | Disallow empty type parameters in type aliases and interfaces. |  |
| [noExcessiveCognitiveComplexity](/linter/rules/no-excessive-cognitive-complexity) | Disallow functions that exceed a given Cognitive Complexity score. |  |
| [noExcessiveLinesPerFunction](/linter/rules/no-excessive-lines-per-function) | Restrict the number of lines of code in a function. |  |
| [noExcessiveNestedTestSuites](/linter/rules/no-excessive-nested-test-suites) | This rule enforces a maximum depth to nested `describe()` in test files. |  |
| [noExtraBooleanCast](/linter/rules/no-extra-boolean-cast) | Disallow unnecessary boolean casts |  |
| [noFlatMapIdentity](/linter/rules/no-flat-map-identity) | Disallow to use unnecessary callback on `flatMap`. |  |
| [noForEach](/linter/rules/no-for-each) | Prefer `for...of` statement instead of `Array.forEach`. |  |
| [noImplicitCoercions](/linter/rules/no-implicit-coercions) | Disallow shorthand type conversions. |  |
| [noStaticOnlyClass](/linter/rules/no-static-only-class) | This rule reports when a class has no non-static members, such as for a class used exclusively as a static namespace. |  |
| [noThisInStatic](/linter/rules/no-this-in-static) | Disallow `this` and `super` in `static` contexts. |  |
| [noUselessCatch](/linter/rules/no-useless-catch) | Disallow unnecessary `catch` clauses. |  |
| [noUselessConstructor](/linter/rules/no-useless-constructor) | Disallow unnecessary constructors. |  |
| [noUselessContinue](/linter/rules/no-useless-continue) | Avoid using unnecessary `continue`. |  |
| [noUselessEmptyExport](/linter/rules/no-useless-empty-export) | Disallow empty exports that don’t change anything in a module file. |  |
| [noUselessEscapeInRegex](/linter/rules/no-useless-escape-in-regex) | Disallow unnecessary escape sequence in regular expression literals. |  |
| [noUselessFragments](/linter/rules/no-useless-fragments) | Disallow unnecessary fragments |  |
| [noUselessLabel](/linter/rules/no-useless-label) | Disallow unnecessary labels. |  |
| [noUselessLoneBlockStatements](/linter/rules/no-useless-lone-block-statements) | Disallow unnecessary nested block statements. |  |
| [noUselessRename](/linter/rules/no-useless-rename) | Disallow renaming import, export, and destructured assignments to the same name. |  |
| [noUselessStringConcat](/linter/rules/no-useless-string-concat) | Disallow unnecessary concatenation of string or template literals. |  |
| [noUselessStringRaw](/linter/rules/no-useless-string-raw) | Disallow unnecessary `String.raw` function in template string literals without any escape sequence. |  |
| [noUselessSwitchCase](/linter/rules/no-useless-switch-case) | Disallow useless `case` in `switch` statements. |  |
| [noUselessTernary](/linter/rules/no-useless-ternary) | Disallow ternary operators when simpler alternatives exist. |  |
| [noUselessThisAlias](/linter/rules/no-useless-this-alias) | Disallow useless `this` aliasing. |  |
| [noUselessTypeConstraint](/linter/rules/no-useless-type-constraint) | Disallow using `any` or `unknown` as type constraint. |  |
| [noUselessUndefinedInitialization](/linter/rules/no-useless-undefined-initialization) | Disallow initializing variables to `undefined`. |  |
| [noVoid](/linter/rules/no-void) | Disallow the use of `void` operators, which is not a familiar operator. |  |
| [useArrowFunction](/linter/rules/use-arrow-function) | Use arrow functions over function expressions. |  |
| [useDateNow](/linter/rules/use-date-now) | Use `Date.now()` to get the number of milliseconds since the Unix Epoch. |  |
| [useFlatMap](/linter/rules/use-flat-map) | Promotes the use of `.flatMap()` when `map().flat()` are used together. |  |
| [useIndexOf](/linter/rules/use-index-of) | Prefer `Array#{indexOf,lastIndexOf}()` over `Array#{findIndex,findLastIndex}()` when looking for the index of an item. |  |
| [useLiteralKeys](/linter/rules/use-literal-keys) | Enforce the usage of a literal access to properties over computed property access. |  |
| [useNumericLiterals](/linter/rules/use-numeric-literals) | Disallow `parseInt()` and `Number.parseInt()` in favor of binary, octal, and hexadecimal literals |  |
| [useOptionalChain](/linter/rules/use-optional-chain) | Enforce using concise optional chain instead of chained logical expressions. |  |
| [useRegexLiterals](/linter/rules/use-regex-literals) | Enforce the use of the regular expression literals instead of the RegExp constructor if possible. |  |
| [useSimpleNumberKeys](/linter/rules/use-simple-number-keys) | Disallow number literal object member names which are not base 10 or use underscore as separator. |  |
| [useSimplifiedLogicExpression](/linter/rules/use-simplified-logic-expression) | Discard redundant terms from logical expressions. |  |
| [useWhile](/linter/rules/use-while) | Enforce the use of `while` loops instead of `for` loops when the initializer and update expressions are not needed. |  |

## `correctness`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noChildrenProp](/linter/rules/no-children-prop) | Prevent passing of children as props. |  |
| [noConstAssign](/linter/rules/no-const-assign) | Prevents from having `const` variables being re-assigned. |  |
| [noConstantCondition](/linter/rules/no-constant-condition) | Disallow constant expressions in conditions |  |
| [noConstantMathMinMaxClamp](/linter/rules/no-constant-math-min-max-clamp) | Disallow the use of `Math.min` and `Math.max` to clamp a value where the result itself is constant. |  |
| [noConstructorReturn](/linter/rules/no-constructor-return) | Disallow returning a value from a `constructor`. |  |
| [noEmptyCharacterClassInRegex](/linter/rules/no-empty-character-class-in-regex) | Disallow empty character classes in regular expression literals. |  |
| [noEmptyPattern](/linter/rules/no-empty-pattern) | Disallows empty destructuring patterns. |  |
| [noGlobalDirnameFilename](/linter/rules/no-global-dirname-filename) | Disallow the use of `__dirname` and `__filename` in the global scope. |  |
| [noGlobalObjectCalls](/linter/rules/no-global-object-calls) | Disallow calling global object properties as functions |  |
| [noInnerDeclarations](/linter/rules/no-inner-declarations) | Disallow `function` and `var` declarations that are accessible outside their block. |  |
| [noInvalidBuiltinInstantiation](/linter/rules/no-invalid-builtin-instantiation) | Ensure that builtins are correctly instantiated. |  |
| [noInvalidConstructorSuper](/linter/rules/no-invalid-constructor-super) | Prevents the incorrect use of `super()` inside classes. It also checks whether a call `super()` is missing from classes that extends other constructors. |  |
| [noInvalidUseBeforeDeclaration](/linter/rules/no-invalid-use-before-declaration) | Disallow the use of variables, function parameters, classes, and enums before their declaration |  |
| [noNestedComponentDefinitions](/linter/rules/no-nested-component-definitions) | Disallows defining React components inside other components. |  |
| [noNodejsModules](/linter/rules/no-nodejs-modules) | Forbid the use of Node.js builtin modules. |  |
| [noNonoctalDecimalEscape](/linter/rules/no-nonoctal-decimal-escape) | Disallow `\8` and `\9` escape sequences in string literals. |  |
| [noPrecisionLoss](/linter/rules/no-precision-loss) | Disallow literal numbers that lose precision |  |
| [noPrivateImports](/linter/rules/no-private-imports) | Restrict imports of private exports. |  |
| [noProcessGlobal](/linter/rules/no-process-global) | Disallow the use of `process` global. |  |
| [noQwikUseVisibleTask](/linter/rules/no-qwik-use-visible-task) | Disallow `useVisibleTask$()` functions in Qwik components. |  |
| [noReactPropAssignments](/linter/rules/no-react-prop-assignments) | Disallow assigning to React component props. |  |
| [noRenderReturnValue](/linter/rules/no-render-return-value) | Prevent the usage of the return value of `React.render`. |  |
| [noRestrictedElements](/linter/rules/no-restricted-elements) | Disallow the use of configured elements. |  |
| [noSelfAssign](/linter/rules/no-self-assign) | Disallow assignments where both sides are exactly the same. |  |
| [noSetterReturn](/linter/rules/no-setter-return) | Disallow returning a value from a setter |  |
| [noSolidDestructuredProps](/linter/rules/no-solid-destructured-props) | Disallow destructuring props inside JSX components in Solid projects. |  |
| [noStringCaseMismatch](/linter/rules/no-string-case-mismatch) | Disallow comparison of expressions modifying the string case with non-compliant value. |  |
| [noSwitchDeclarations](/linter/rules/no-switch-declarations) | Disallow lexical declarations in `switch` clauses. |  |
| [noUndeclaredDependencies](/linter/rules/no-undeclared-dependencies) | Disallow the use of dependencies that aren’t specified in the `package.json`. |  |
| [noUndeclaredVariables](/linter/rules/no-undeclared-variables) | Prevents the usage of variables that haven’t been declared inside the document. |  |
| [noUnreachable](/linter/rules/no-unreachable) | Disallow unreachable code |  |
| [noUnreachableSuper](/linter/rules/no-unreachable-super) | Ensures the `super()` constructor is called exactly once on every code path in a class constructor before `this` is accessed if the class has a superclass |  |
| [noUnsafeFinally](/linter/rules/no-unsafe-finally) | Disallow control flow statements in finally blocks. |  |
| [noUnsafeOptionalChaining](/linter/rules/no-unsafe-optional-chaining) | Disallow the use of optional chaining in contexts where the undefined value is not allowed. |  |
| [noUnusedFunctionParameters](/linter/rules/no-unused-function-parameters) | Disallow unused function parameters. |  |
| [noUnusedImports](/linter/rules/no-unused-imports) | Disallow unused imports. |  |
| [noUnusedLabels](/linter/rules/no-unused-labels) | Disallow unused labels. |  |
| [noUnusedPrivateClassMembers](/linter/rules/no-unused-private-class-members) | Disallow unused private class members |  |
| [noUnusedVariables](/linter/rules/no-unused-variables) | Disallow unused variables. |  |
| [noVoidElementsWithChildren](/linter/rules/no-void-elements-with-children) | This rules prevents void elements (AKA self-closing elements) from having children. |  |
| [noVoidTypeReturn](/linter/rules/no-void-type-return) | Disallow returning a value from a function with the return type ‘void’ |  |
| [useExhaustiveDependencies](/linter/rules/use-exhaustive-dependencies) | Enforce correct dependency usage within React hooks. |  |
| [useHookAtTopLevel](/linter/rules/use-hook-at-top-level) | Enforce that all React hooks are being called from the Top Level component functions. |  |
| [useImageSize](/linter/rules/use-image-size) | Enforces that `<img>` elements have both width and height attributes. |  |
| [useImportExtensions](/linter/rules/use-import-extensions) | Enforce file extensions for relative imports. |  |
| [useIsNan](/linter/rules/use-is-nan) | Require calls to `isNaN()` when checking for `NaN`. |  |
| [useJsonImportAttributes](/linter/rules/use-json-import-attributes) | Enforces the use of `with { type: "json" }` for JSON module imports. |  |
| [useJsxKeyInIterable](/linter/rules/use-jsx-key-in-iterable) | Disallow missing key props in iterators/collection literals. |  |
| [useParseIntRadix](/linter/rules/use-parse-int-radix) | Enforce the consistent use of the radix argument when using `parseInt()`. |  |
| [useQwikClasslist](/linter/rules/use-qwik-classlist) | Prefer using the `class` prop as a classlist over the `classnames` helper. |  |
| [useSingleJsDocAsterisk](/linter/rules/use-single-js-doc-asterisk) | Enforce JSDoc comment lines to start with a single asterisk, except for the first one. |  |
| [useUniqueElementIds](/linter/rules/use-unique-element-ids) | Prevent the usage of static string literal `id` attribute on elements. |  |
| [useValidForDirection](/linter/rules/use-valid-for-direction) | Enforce “for” loop update clause moving the counter in the right direction. |  |
| [useValidTypeof](/linter/rules/use-valid-typeof) | This rule checks that the result of a `typeof` expression is compared to a valid value. |  |
| [useYield](/linter/rules/use-yield) | Require generator functions to contain `yield`. |  |

## `nursery`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noAmbiguousAnchorText](/linter/rules/no-ambiguous-anchor-text) | Disallow ambiguous anchor descriptions. |  |
| [noContinue](/linter/rules/no-continue) | Disallow continue statements. |  |
| [noDeprecatedImports](/linter/rules/no-deprecated-imports) | Restrict imports of deprecated exports. |  |
| [noDuplicatedSpreadProps](/linter/rules/no-duplicated-spread-props) | Disallow JSX prop spreading the same identifier multiple times. |  |
| [noEmptySource](/linter/rules/no-empty-source) | Disallow empty sources. |  |
| [noEqualsToNull](/linter/rules/no-equals-to-null) | Require the use of `===` or `!==` for comparison with `null`. |  |
| [noFloatingPromises](/linter/rules/no-floating-promises) | Require Promise-like statements to be handled appropriately. |  |
| [noForIn](/linter/rules/no-for-in) | Disallow iterating using a for-in loop. |  |
| [noImportCycles](/linter/rules/no-import-cycles) | Prevent import cycles. |  |
| [noIncrementDecrement](/linter/rules/no-increment-decrement) | Disallows the usage of the unary operators ++ and —. |  |
| [noJsxLiterals](/linter/rules/no-jsx-literals) | Disallow string literals inside JSX elements. |  |
| [noLeakedRender](/linter/rules/no-leaked-render) | Prevent problematic leaked values from being rendered. |  |
| [noMisusedPromises](/linter/rules/no-misused-promises) | Disallow Promises to be used in places where they are almost certainly a |  |
| [noMultiAssign](/linter/rules/no-multi-assign) | Disallow use of chained assignment expressions |  |
| [noMultiStr](/linter/rules/no-multi-str) | Disallow creating multiline strings by escaping newlines. |  |
| [noNextAsyncClientComponent](/linter/rules/no-next-async-client-component) | Prevent client components from being async functions. |  |
| [noParametersOnlyUsedInRecursion](/linter/rules/no-parameters-only-used-in-recursion) | Disallow function parameters that are only used in recursive calls. |  |
| [noProto](/linter/rules/no-proto) | Disallow the use of the deprecated `__proto__` object property. |  |
| [noReactForwardRef](/linter/rules/no-react-forward-ref) | Replaces usages of `forwardRef` with passing `ref` as a prop. |  |
| [noReturnAssign](/linter/rules/no-return-assign) | Disallow assignments in return statements. |  |
| [noScriptUrl](/linter/rules/no-script-url) | Disallow `javascript:` URLs. |  |
| [noShadow](/linter/rules/no-shadow) | Disallow variable declarations from shadowing variables declared in the outer scope. |  |
| [noSyncScripts](/linter/rules/no-sync-scripts) | Prevent the usage of synchronous scripts. |  |
| [noTernary](/linter/rules/no-ternary) | Disallow ternary operators. |  |
| [noUndeclaredEnvVars](/linter/rules/no-undeclared-env-vars) | Disallow the use of undeclared environment variables. |  |
| [noUnknownAttribute](/linter/rules/no-unknown-attribute) | Disallow unknown DOM properties. |  |
| [noUnnecessaryConditions](/linter/rules/no-unnecessary-conditions) | Disallow unnecessary type-based conditions that can be statically determined as redundant. |  |
| [noUnresolvedImports](/linter/rules/no-unresolved-imports) | Warn when importing non-existing exports. |  |
| [noUnusedExpressions](/linter/rules/no-unused-expressions) | Disallow expression statements that are neither a function call nor an |  |
| [noUselessCatchBinding](/linter/rules/no-useless-catch-binding) | Disallow unused catch bindings. |  |
| [noUselessUndefined](/linter/rules/no-useless-undefined) | Disallow the use of useless `undefined`. |  |
| [noVueDataObjectDeclaration](/linter/rules/no-vue-data-object-declaration) | Enforce that Vue component `data` options are declared as functions. |  |
| [noVueDuplicateKeys](/linter/rules/no-vue-duplicate-keys) | Disallow duplicate keys in Vue component data, methods, computed properties, and other options. |  |
| [noVueReservedKeys](/linter/rules/no-vue-reserved-keys) | Disallow reserved keys in Vue component data and computed properties. |  |
| [noVueReservedProps](/linter/rules/no-vue-reserved-props) | Disallow reserved names to be used as props. |  |
| [noVueSetupPropsReactivityLoss](/linter/rules/no-vue-setup-props-reactivity-loss) | Disallow destructuring of `props` passed to `setup` in Vue projects. |  |
| [useArraySortCompare](/linter/rules/use-array-sort-compare) | Require Array#sort and Array#toSorted calls to always provide a compareFunction. |  |
| [useAwaitThenable](/linter/rules/use-await-thenable) | Enforce that `await` is only used on `Promise` values. |  |
| [useConsistentArrowReturn](/linter/rules/use-consistent-arrow-return) | Enforce consistent arrow function bodies. |  |
| [useDestructuring](/linter/rules/use-destructuring) | Require destructuring from arrays and/or objects |  |
| [useExhaustiveSwitchCases](/linter/rules/use-exhaustive-switch-cases) | Require switch-case statements to be exhaustive. |  |
| [useExplicitType](/linter/rules/use-explicit-type) | Enforce types in functions, methods, variables, and parameters. |  |
| [useFind](/linter/rules/use-find) | Enforce the use of Array.prototype.find() over Array.prototype.filter() followed by [0] when looking for a single result. |  |
| [useMaxParams](/linter/rules/use-max-params) | Enforce a maximum number of parameters in function definitions. |  |
| [useQwikMethodUsage](/linter/rules/use-qwik-method-usage) | Disallow `use*` hooks outside of `component$` or other `use*` hooks in Qwik applications. |  |
| [useQwikValidLexicalScope](/linter/rules/use-qwik-valid-lexical-scope) | Disallow unserializable expressions in Qwik dollar ($) scopes. |  |
| [useRegexpExec](/linter/rules/use-regexp-exec) | Enforce `RegExp#exec` over `String#match` if no global flag is provided. |  |
| [useSortedClasses](/linter/rules/use-sorted-classes) | Enforce the sorting of CSS utility classes. |  |
| [useSpread](/linter/rules/use-spread) | Enforce the use of the spread operator over `.apply()`. |  |
| [useVueConsistentDefinePropsDeclaration](/linter/rules/use-vue-consistent-define-props-declaration) | Enforce consistent `defineProps` declaration style. |  |
| [useVueDefineMacrosOrder](/linter/rules/use-vue-define-macros-order) | Enforce specific order of Vue compiler macros. |  |
| [useVueMultiWordComponentNames](/linter/rules/use-vue-multi-word-component-names) | Enforce multi-word component names in Vue components. |  |

## `performance`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noAccumulatingSpread](/linter/rules/no-accumulating-spread) | Disallow the use of spread (`...`) syntax on accumulators. |  |
| [noAwaitInLoops](/linter/rules/no-await-in-loops) | Disallow `await` inside loops. |  |
| [noBarrelFile](/linter/rules/no-barrel-file) | Disallow the use of barrel file. |  |
| [noDelete](/linter/rules/no-delete) | Disallow the use of the `delete` operator. |  |
| [noDynamicNamespaceImportAccess](/linter/rules/no-dynamic-namespace-import-access) | Disallow accessing namespace imports dynamically. |  |
| [noImgElement](/linter/rules/no-img-element) | Prevent usage of `<img>` element in a Next.js project. |  |
| [noNamespaceImport](/linter/rules/no-namespace-import) | Disallow the use of namespace imports. |  |
| [noReExportAll](/linter/rules/no-re-export-all) | Avoid re-export all. |  |
| [noUnwantedPolyfillio](/linter/rules/no-unwanted-polyfillio) | Prevent duplicate polyfills from Polyfill.io. |  |
| [useGoogleFontPreconnect](/linter/rules/use-google-font-preconnect) | Ensure the `preconnect` attribute is used when using Google Fonts. |  |
| [useSolidForComponent](/linter/rules/use-solid-for-component) | Enforce using Solid’s `<For />` component for mapping an array to JSX elements. |  |
| [useTopLevelRegex](/linter/rules/use-top-level-regex) | Require regex literals to be declared at the top level. |  |

## `security`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noBlankTarget](/linter/rules/no-blank-target) | Disallow `target="_blank"` attribute without `rel="noopener"`. |  |
| [noDangerouslySetInnerHtml](/linter/rules/no-dangerously-set-inner-html/) | Prevent the usage of dangerous JSX props |  |
| [noDangerouslySetInnerHtmlWithChildren](/linter/rules/no-dangerously-set-inner-html-with-children) | Report when a DOM element or a component uses both `children` and `dangerouslySetInnerHTML` prop. |  |
| [noGlobalEval](/linter/rules/no-global-eval) | Disallow the use of global `eval()`. |  |
| [noSecrets](/linter/rules/no-secrets) | Disallow usage of sensitive data such as API keys and tokens. |  |

## `style`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noCommonJs](/linter/rules/no-common-js) | Disallow use of CommonJs module system in favor of ESM style imports. |  |
| [noDefaultExport](/linter/rules/no-default-export) | Disallow default exports. |  |
| [noDoneCallback](/linter/rules/no-done-callback) | Disallow using a callback in asynchronous tests and hooks. |  |
| [noEnum](/linter/rules/no-enum) | Disallow TypeScript enum. |  |
| [noExportedImports](/linter/rules/no-exported-imports) | Disallow exporting an imported variable. |  |
| [noHeadElement](/linter/rules/no-head-element) | Prevent usage of `<head>` element in a Next.js project. |  |
| [noImplicitBoolean](/linter/rules/no-implicit-boolean) | Disallow implicit `true` values on JSX boolean attributes |  |
| [noInferrableTypes](/linter/rules/no-inferrable-types) | Disallow type annotations for variables, parameters, and class properties initialized with a literal expression. |  |
| [noMagicNumbers](/linter/rules/no-magic-numbers) | Reports usage of “magic numbers” — numbers used directly instead of being assigned to named constants. |  |
| [noNamespace](/linter/rules/no-namespace) | Disallow the use of TypeScript’s `namespace`s. |  |
| [noNegationElse](/linter/rules/no-negation-else) | Disallow negation in the condition of an `if` statement if it has an `else` clause. |  |
| [noNestedTernary](/linter/rules/no-nested-ternary) | Disallow nested ternary expressions. |  |
| [noNonNullAssertion](/linter/rules/no-non-null-assertion) | Disallow non-null assertions using the `!` postfix operator. |  |
| [noParameterAssign](/linter/rules/no-parameter-assign) | Disallow reassigning `function` parameters. |  |
| [noParameterProperties](/linter/rules/no-parameter-properties) | Disallow the use of parameter properties in class constructors. |  |
| [noProcessEnv](/linter/rules/no-process-env) | Disallow the use of `process.env`. |  |
| [noRestrictedGlobals](/linter/rules/no-restricted-globals) | This rule allows you to specify global variable names that you don’t want to use in your application. |  |
| [noRestrictedImports](/linter/rules/no-restricted-imports) | Disallow specified modules when loaded by import or require. |  |
| [noRestrictedTypes](/linter/rules/no-restricted-types) | Disallow user defined types. |  |
| [noShoutyConstants](/linter/rules/no-shouty-constants) | Disallow the use of constants which its value is the upper-case version of its name. |  |
| [noSubstr](/linter/rules/no-substr) | Enforce the use of `String.slice()` over `String.substr()` and `String.substring()`. |  |
| [noUnusedTemplateLiteral](/linter/rules/no-unused-template-literal) | Disallow template literals if interpolation and special-character handling are not needed |  |
| [noUselessElse](/linter/rules/no-useless-else) | Disallow `else` block when the `if` block breaks early. |  |
| [noYodaExpression](/linter/rules/no-yoda-expression) | Disallow the use of yoda expressions. |  |
| [useArrayLiterals](/linter/rules/use-array-literals) | Disallow Array constructors. |  |
| [useAsConstAssertion](/linter/rules/use-as-const-assertion) | Enforce the use of `as const` over literal type and type annotation. |  |
| [useAtIndex](/linter/rules/use-at-index) | Use `at()` instead of integer index access. |  |
| [useBlockStatements](/linter/rules/use-block-statements) | Requires following curly brace conventions. |  |
| [useCollapsedElseIf](/linter/rules/use-collapsed-else-if) | Enforce using `else if` instead of nested `if` in `else` clauses. |  |
| [useCollapsedIf](/linter/rules/use-collapsed-if) | Enforce using single `if` instead of nested `if` clauses. |  |
| [useComponentExportOnlyModules](/linter/rules/use-component-export-only-modules) | Enforce declaring components only within modules that export React Components exclusively. |  |
| [useConsistentArrayType](/linter/rules/use-consistent-array-type) | Require consistently using either `T[]` or `Array<T>` |  |
| [useConsistentBuiltinInstantiation](/linter/rules/use-consistent-builtin-instantiation) | Enforce the use of `new` for all builtins, except `String`, `Number` and `Boolean`. |  |
| [useConsistentCurlyBraces](/linter/rules/use-consistent-curly-braces) | This rule enforces consistent use of curly braces inside JSX attributes and JSX children. |  |
| [useConsistentMemberAccessibility](/linter/rules/use-consistent-member-accessibility) | Require consistent accessibility modifiers on class properties and methods. |  |
| [useConsistentObjectDefinitions](/linter/rules/use-consistent-object-definitions) | Require the consistent declaration of object literals. Defaults to explicit definitions. |  |
| [useConsistentTypeDefinitions](/linter/rules/use-consistent-type-definitions) | Enforce type definitions to consistently use either `interface` or `type`. |  |
| [useConst](/linter/rules/use-const) | Require `const` declarations for variables that are only assigned once. |  |
| [useDefaultParameterLast](/linter/rules/use-default-parameter-last) | Enforce default function parameters and optional function parameters to be last. |  |
| [useDefaultSwitchClause](/linter/rules/use-default-switch-clause) | Require the default clause in switch statements. |  |
| [useEnumInitializers](/linter/rules/use-enum-initializers) | Require that each enum member value be explicitly initialized. |  |
| [useExplicitLengthCheck](/linter/rules/use-explicit-length-check) | Enforce explicitly comparing the `length`, `size`, `byteLength` or `byteOffset` property of a value. |  |
| [useExponentiationOperator](/linter/rules/use-exponentiation-operator) | Disallow the use of `Math.pow` in favor of the `**` operator. |  |
| [useExportType](/linter/rules/use-export-type) | Promotes the use of `export type` for types. |  |
| [useExportsLast](/linter/rules/use-exports-last) | Require that all exports are declared after all non-export statements. |  |
| [useFilenamingConvention](/linter/rules/use-filenaming-convention) | Enforce naming conventions for JavaScript and TypeScript filenames. |  |
| [useForOf](/linter/rules/use-for-of) | Prefer using `for...of` loops over standard `for` loops where possible. |  |
| [useFragmentSyntax](/linter/rules/use-fragment-syntax) | This rule enforces the use of `<>...</>` over `<Fragment>...</Fragment>`. |  |
| [useGroupedAccessorPairs](/linter/rules/use-grouped-accessor-pairs) | Enforce that getters and setters for the same property are adjacent in class and object definitions. |  |
| [useImportType](/linter/rules/use-import-type) | Promotes the use of `import type` for types. |  |
| [useLiteralEnumMembers](/linter/rules/use-literal-enum-members) | Require all enum members to be literal values. |  |
| [useNamingConvention](/linter/rules/use-naming-convention) | Enforce naming conventions for everything across a codebase. |  |
| [useNodeAssertStrict](/linter/rules/use-node-assert-strict) | Promotes the usage of `node:assert/strict` over `node:assert`. |  |
| [useNodejsImportProtocol](/linter/rules/use-nodejs-import-protocol) | Enforces using the `node:` protocol for Node.js builtin modules. |  |
| [useNumberNamespace](/linter/rules/use-number-namespace) | Use the `Number` properties instead of global ones. |  |
| [useNumericSeparators](/linter/rules/use-numeric-separators) | Enforce the use of numeric separators in numeric literals. |  |
| [useObjectSpread](/linter/rules/use-object-spread) | Prefer object spread over `Object.assign()` when constructing new objects. |  |
| [useReactFunctionComponents](/linter/rules/use-react-function-components) | Enforce that components are defined as functions and never as classes. |  |
| [useReadonlyClassProperties](/linter/rules/use-readonly-class-properties) | Enforce marking members as `readonly` if they are never modified outside the constructor. |  |
| [useSelfClosingElements](/linter/rules/use-self-closing-elements) | Prevent extra closing tags for components without children. |  |
| [useShorthandAssign](/linter/rules/use-shorthand-assign) | Require assignment operator shorthand where possible. |  |
| [useShorthandFunctionType](/linter/rules/use-shorthand-function-type) | Enforce using function types instead of object type with call signatures. |  |
| [useSingleVarDeclarator](/linter/rules/use-single-var-declarator) | Disallow multiple variable declarations in the same variable statement |  |
| [useSymbolDescription](/linter/rules/use-symbol-description) | Require a description parameter for the `Symbol()`. |  |
| [useTemplate](/linter/rules/use-template) | Prefer template literals over string concatenation. |  |
| [useThrowNewError](/linter/rules/use-throw-new-error) | Require `new` when throwing an error. |  |
| [useThrowOnlyError](/linter/rules/use-throw-only-error) | Disallow throwing non-`Error` values. |  |
| [useTrimStartEnd](/linter/rules/use-trim-start-end) | Enforce the use of `String.trimStart()` and `String.trimEnd()` over `String.trimLeft()` and `String.trimRight()`. |  |
| [useUnifiedTypeSignatures](/linter/rules/use-unified-type-signatures) | Disallow overload signatures that can be unified into a single signature. |  |

## `suspicious`


| Rule name | Description | Properties |
| --- | --- | --- |
| [noAlert](/linter/rules/no-alert) | Disallow the use of `alert`, `confirm`, and `prompt`. |  |
| [noApproximativeNumericConstant](/linter/rules/no-approximative-numeric-constant) | Use standard constants instead of approximated literals. |  |
| [noArrayIndexKey](/linter/rules/no-array-index-key) | Discourage the usage of Array index in keys. |  |
| [noAssignInExpressions](/linter/rules/no-assign-in-expressions) | Disallow assignments in expressions. |  |
| [noAsyncPromiseExecutor](/linter/rules/no-async-promise-executor) | Disallows using an async function as a Promise executor. |  |
| [noBitwiseOperators](/linter/rules/no-bitwise-operators) | Disallow bitwise operators. |  |
| [noCatchAssign](/linter/rules/no-catch-assign) | Disallow reassigning exceptions in catch clauses. |  |
| [noClassAssign](/linter/rules/no-class-assign) | Disallow reassigning class members. |  |
| [noCommentText](/linter/rules/no-comment-text) | Prevent comments from being inserted as text nodes |  |
| [noCompareNegZero](/linter/rules/no-compare-neg-zero) | Disallow comparing against `-0` |  |
| [noConfusingLabels](/linter/rules/no-confusing-labels) | Disallow labeled statements that are not loops. |  |
| [noConfusingVoidType](/linter/rules/no-confusing-void-type) | Disallow `void` type outside of generic or return types. |  |
| [noConsole](/linter/rules/no-console) | Disallow the use of `console`. |  |
| [noConstEnum](/linter/rules/no-const-enum) | Disallow TypeScript `const enum` |  |
| [noConstantBinaryExpressions](/linter/rules/no-constant-binary-expressions) | Disallow expressions where the operation doesn’t affect the value |  |
| [noControlCharactersInRegex](/linter/rules/no-control-characters-in-regex) | Prevents from having control characters and some escape sequences that match control characters in regular expression literals. |  |
| [noDebugger](/linter/rules/no-debugger) | Disallow the use of `debugger` |  |
| [noDocumentCookie](/linter/rules/no-document-cookie) | Disallow direct assignments to `document.cookie`. |  |
| [noDocumentImportInPage](/linter/rules/no-document-import-in-page) | Prevents importing `next/document` outside of `pages/_document.jsx` in Next.js projects. |  |
| [noDoubleEquals](/linter/rules/no-double-equals) | Require the use of `===` and `!==`. |  |
| [noDuplicateCase](/linter/rules/no-duplicate-case) | Disallow duplicate case labels. |  |
| [noDuplicateClassMembers](/linter/rules/no-duplicate-class-members) | Disallow duplicate class members. |  |
| [noDuplicateElseIf](/linter/rules/no-duplicate-else-if) | Disallow duplicate conditions in if-else-if chains |  |
| [noDuplicateJsxProps](/linter/rules/no-duplicate-jsx-props) | Prevents JSX properties to be assigned multiple times. |  |
| [noDuplicateObjectKeys](/linter/rules/no-duplicate-object-keys) | Disallow two keys with the same name inside objects. |  |
| [noDuplicateParameters](/linter/rules/no-duplicate-parameters) | Disallow duplicate function parameter name. |  |
| [noDuplicateTestHooks](/linter/rules/no-duplicate-test-hooks) | A `describe` block should not contain duplicate hooks. |  |
| [noEmptyBlockStatements](/linter/rules/no-empty-block-statements) | Disallow empty block statements and static blocks. |  |
| [noEmptyInterface](/linter/rules/no-empty-interface) | Disallow the declaration of empty interfaces. |  |
| [noEvolvingTypes](/linter/rules/no-evolving-types) | Disallow variables from evolving into `any` type through reassignments. |  |
| [noExplicitAny](/linter/rules/no-explicit-any) | Disallow the `any` type usage. |  |
| [noExportsInTest](/linter/rules/no-exports-in-test) | Disallow using `export` or `module.exports` in files containing tests |  |
| [noExtraNonNullAssertion](/linter/rules/no-extra-non-null-assertion) | Prevents the wrong usage of the non-null assertion operator (`!`) in TypeScript files. |  |
| [noFallthroughSwitchClause](/linter/rules/no-fallthrough-switch-clause) | Disallow fallthrough of `switch` clauses. |  |
| [noFocusedTests](/linter/rules/no-focused-tests) | Disallow focused tests. |  |
| [noFunctionAssign](/linter/rules/no-function-assign) | Disallow reassigning function declarations. |  |
| [noGlobalAssign](/linter/rules/no-global-assign) | Disallow assignments to native objects and read-only global variables. |  |
| [noGlobalIsFinite](/linter/rules/no-global-is-finite) | Use `Number.isFinite` instead of global `isFinite`. |  |
| [noGlobalIsNan](/linter/rules/no-global-is-nan) | Use `Number.isNaN` instead of global `isNaN`. |  |
| [noHeadImportInDocument](/linter/rules/no-head-import-in-document) | Prevent using the `next/head` module in `pages/_document.js` on Next.js projects. |  |
| [noImplicitAnyLet](/linter/rules/no-implicit-any-let) | Disallow use of implicit `any` type on variable declarations. |  |
| [noImportAssign](/linter/rules/no-import-assign) | Disallow assigning to imported bindings |  |
| [noIrregularWhitespace](/linter/rules/no-irregular-whitespace) | Disallows the use of irregular whitespace characters. |  |
| [noLabelVar](/linter/rules/no-label-var) | Disallow labels that share a name with a variable |  |
| [noMisleadingCharacterClass](/linter/rules/no-misleading-character-class) | Disallow characters made with multiple code points in character class syntax. |  |
| [noMisleadingInstantiator](/linter/rules/no-misleading-instantiator) | Enforce proper usage of `new` and `constructor`. |  |
| [noMisplacedAssertion](/linter/rules/no-misplaced-assertion) | Checks that the assertion function, for example `expect`, is placed inside an `it()` function call. |  |
| [noMisrefactoredShorthandAssign](/linter/rules/no-misrefactored-shorthand-assign) | Disallow shorthand assign when variable appears on both sides. |  |
| [noNonNullAssertedOptionalChain](/linter/rules/no-non-null-asserted-optional-chain) | Disallow non-null assertions after optional chaining expressions. |  |
| [noOctalEscape](/linter/rules/no-octal-escape) | Disallow octal escape sequences in string literals |  |
| [noPrototypeBuiltins](/linter/rules/no-prototype-builtins) | Disallow direct use of `Object.prototype` builtins. |  |
| [noReactSpecificProps](/linter/rules/no-react-specific-props) | Prevents React-specific JSX properties from being used. |  |
| [noRedeclare](/linter/rules/no-redeclare) | Disallow variable, function, class, and type redeclarations in the same scope. |  |
| [noRedundantUseStrict](/linter/rules/no-redundant-use-strict) | Prevents from having redundant `"use strict"`. |  |
| [noSelfCompare](/linter/rules/no-self-compare) | Disallow comparisons where both sides are exactly the same. |  |
| [noShadowRestrictedNames](/linter/rules/no-shadow-restricted-names) | Disallow identifiers from shadowing restricted names. |  |
| [noSkippedTests](/linter/rules/no-skipped-tests) | Disallow disabled tests. |  |
| [noSparseArray](/linter/rules/no-sparse-array) | Prevents the use of sparse arrays (arrays with holes). |  |
| [noSuspiciousSemicolonInJsx](/linter/rules/no-suspicious-semicolon-in-jsx) | It detects possible “wrong” semicolons inside JSX elements. |  |
| [noTemplateCurlyInString](/linter/rules/no-template-curly-in-string) | Disallow template literal placeholder syntax in regular strings. |  |
| [noThenProperty](/linter/rules/no-then-property) | Disallow `then` property. |  |
| [noTsIgnore](/linter/rules/no-ts-ignore) | Prevents the use of the TypeScript directive `@ts-ignore`. |  |
| [noUnassignedVariables](/linter/rules/no-unassigned-variables) | Disallow `let` or `var` variables that are read but never assigned. |  |
| [noUnsafeDeclarationMerging](/linter/rules/no-unsafe-declaration-merging) | Disallow unsafe declaration merging between interfaces and classes. |  |
| [noUnsafeNegation](/linter/rules/no-unsafe-negation) | Disallow using unsafe negation. |  |
| [noUselessEscapeInString](/linter/rules/no-useless-escape-in-string) | Disallow unnecessary escapes in string literals. |  |
| [noUselessRegexBackrefs](/linter/rules/no-useless-regex-backrefs) | Disallow useless backreferences in regular expression literals that always match an empty string. |  |
| [noVar](/linter/rules/no-var) | Disallow the use of `var` |  |
| [noWith](/linter/rules/no-with) | Disallow `with` statements in non-strict contexts. |  |
| [useAdjacentOverloadSignatures](/linter/rules/use-adjacent-overload-signatures) | Disallow the use of overload signatures that are not next to each other. |  |
| [useAwait](/linter/rules/use-await) | Ensure `async` functions utilize `await`. |  |
| [useDefaultSwitchClauseLast](/linter/rules/use-default-switch-clause-last) | Enforce default clauses in switch statements to be last |  |
| [useErrorMessage](/linter/rules/use-error-message) | Enforce passing a message value when creating a built-in error. |  |
| [useGetterReturn](/linter/rules/use-getter-return) | Enforce `get` methods to always return a value. |  |
| [useGoogleFontDisplay](/linter/rules/use-google-font-display) | Enforces the use of a recommended `display` strategy with Google Fonts. |  |
| [useGuardForIn](/linter/rules/use-guard-for-in) | Require `for-in` loops to include an `if` statement. |  |
| [useIsArray](/linter/rules/use-is-array) | Use `Array.isArray()` instead of `instanceof Array`. |  |
| [useIterableCallbackReturn](/linter/rules/use-iterable-callback-return) | Enforce consistent return values in iterable callbacks. |  |
| [useNamespaceKeyword](/linter/rules/use-namespace-keyword) | Require using the `namespace` keyword over the `module` keyword to declare TypeScript namespaces. |  |
| [useNumberToFixedDigitsArgument](/linter/rules/use-number-to-fixed-digits-argument) | Enforce using the digits argument with `Number#toFixed()`. |  |
| [useStaticResponseMethods](/linter/rules/use-static-response-methods) | Use static `Response` methods instead of `new Response()` constructor when possible. |  |
| [useStrictMode](/linter/rules/use-strict-mode) | Enforce the use of the directive `"use strict"` in script files. |  |

## Recommended rules


* [noAccessKey](/linter/rules/no-access-key) (Severity: [error](/reference/diagnostics#error))
* [noAriaHiddenOnFocusable](/linter/rules/no-aria-hidden-on-focusable) (Severity: [error](/reference/diagnostics#error))
* [noAriaUnsupportedElements](/linter/rules/no-aria-unsupported-elements) (Severity: [error](/reference/diagnostics#error))
* [noAutofocus](/linter/rules/no-autofocus) (Severity: [error](/reference/diagnostics#error))
* [noDistractingElements](/linter/rules/no-distracting-elements) (Severity: [error](/reference/diagnostics#error))
* [noHeaderScope](/linter/rules/no-header-scope) (Severity: [error](/reference/diagnostics#error))
* [noInteractiveElementToNoninteractiveRole](/linter/rules/no-interactive-element-to-noninteractive-role) (Severity: [error](/reference/diagnostics#error))
* [noLabelWithoutControl](/linter/rules/no-label-without-control) (Severity: [error](/reference/diagnostics#error))
* [noNoninteractiveElementToInteractiveRole](/linter/rules/no-noninteractive-element-to-interactive-role) (Severity: [error](/reference/diagnostics#error))
* [noNoninteractiveTabindex](/linter/rules/no-noninteractive-tabindex) (Severity: [error](/reference/diagnostics#error))
* [noPositiveTabindex](/linter/rules/no-positive-tabindex) (Severity: [error](/reference/diagnostics#error))
* [noRedundantAlt](/linter/rules/no-redundant-alt) (Severity: [error](/reference/diagnostics#error))
* [noRedundantRoles](/linter/rules/no-redundant-roles) (Severity: [error](/reference/diagnostics#error))
* [noStaticElementInteractions](/linter/rules/no-static-element-interactions) (Severity: [error](/reference/diagnostics#error))
* [noSvgWithoutTitle](/linter/rules/no-svg-without-title) (Severity: [error](/reference/diagnostics#error))
* [useAltText](/linter/rules/use-alt-text) (Severity: [error](/reference/diagnostics#error))
* [useAnchorContent](/linter/rules/use-anchor-content) (Severity: [error](/reference/diagnostics#error))
* [useAriaActivedescendantWithTabindex](/linter/rules/use-aria-activedescendant-with-tabindex) (Severity: [error](/reference/diagnostics#error))
* [useAriaPropsForRole](/linter/rules/use-aria-props-for-role) (Severity: [error](/reference/diagnostics#error))
* [useAriaPropsSupportedByRole](/linter/rules/use-aria-props-supported-by-role) (Severity: [error](/reference/diagnostics#error))
* [useButtonType](/linter/rules/use-button-type) (Severity: [error](/reference/diagnostics#error))
* [useFocusableInteractive](/linter/rules/use-focusable-interactive) (Severity: [error](/reference/diagnostics#error))
* [useHeadingContent](/linter/rules/use-heading-content) (Severity: [error](/reference/diagnostics#error))
* [useHtmlLang](/linter/rules/use-html-lang) (Severity: [error](/reference/diagnostics#error))
* [useIframeTitle](/linter/rules/use-iframe-title) (Severity: [error](/reference/diagnostics#error))
* [useKeyWithClickEvents](/linter/rules/use-key-with-click-events) (Severity: [error](/reference/diagnostics#error))
* [useKeyWithMouseEvents](/linter/rules/use-key-with-mouse-events) (Severity: [error](/reference/diagnostics#error))
* [useMediaCaption](/linter/rules/use-media-caption) (Severity: [error](/reference/diagnostics#error))
* [useSemanticElements](/linter/rules/use-semantic-elements) (Severity: [error](/reference/diagnostics#error))
* [useValidAnchor](/linter/rules/use-valid-anchor) (Severity: [error](/reference/diagnostics#error))
* [useValidAriaProps](/linter/rules/use-valid-aria-props) (Severity: [error](/reference/diagnostics#error))
* [useValidAriaRole](/linter/rules/use-valid-aria-role) (Severity: [error](/reference/diagnostics#error))
* [useValidAriaValues](/linter/rules/use-valid-aria-values) (Severity: [error](/reference/diagnostics#error))
* [useValidAutocomplete](/linter/rules/use-valid-autocomplete) (Severity: [error](/reference/diagnostics#error))
* [useValidLang](/linter/rules/use-valid-lang) (Severity: [error](/reference/diagnostics#error))
* [noAdjacentSpacesInRegex](/linter/rules/no-adjacent-spaces-in-regex) (Severity: [warning](/reference/diagnostics#warning))
* [noArguments](/linter/rules/no-arguments) (Severity: [warning](/reference/diagnostics#warning))
* [noBannedTypes](/linter/rules/no-banned-types) (Severity: [warning](/reference/diagnostics#warning))
* [noCommaOperator](/linter/rules/no-comma-operator) (Severity: [warning](/reference/diagnostics#warning))
* [noEmptyTypeParameters](/linter/rules/no-empty-type-parameters) (Severity: [warning](/reference/diagnostics#warning))
* [noExtraBooleanCast](/linter/rules/no-extra-boolean-cast) (Severity: [information](/reference/diagnostics#information))
* [noFlatMapIdentity](/linter/rules/no-flat-map-identity) (Severity: [information](/reference/diagnostics#information))
* [noStaticOnlyClass](/linter/rules/no-static-only-class) (Severity: [warning](/reference/diagnostics#warning))
* [noThisInStatic](/linter/rules/no-this-in-static) (Severity: [warning](/reference/diagnostics#warning))
* [noUselessCatch](/linter/rules/no-useless-catch) (Severity: [information](/reference/diagnostics#information))
* [noUselessConstructor](/linter/rules/no-useless-constructor) (Severity: [information](/reference/diagnostics#information))
* [noUselessContinue](/linter/rules/no-useless-continue) (Severity: [information](/reference/diagnostics#information))
* [noUselessEmptyExport](/linter/rules/no-useless-empty-export) (Severity: [information](/reference/diagnostics#information))
* [noUselessEscapeInRegex](/linter/rules/no-useless-escape-in-regex) (Severity: [information](/reference/diagnostics#information))
* [noUselessFragments](/linter/rules/no-useless-fragments) (Severity: [information](/reference/diagnostics#information))
* [noUselessLabel](/linter/rules/no-useless-label) (Severity: [information](/reference/diagnostics#information))
* [noUselessLoneBlockStatements](/linter/rules/no-useless-lone-block-statements) (Severity: [information](/reference/diagnostics#information))
* [noUselessRename](/linter/rules/no-useless-rename) (Severity: [information](/reference/diagnostics#information))
* [noUselessStringRaw](/linter/rules/no-useless-string-raw) (Severity: [information](/reference/diagnostics#information))
* [noUselessSwitchCase](/linter/rules/no-useless-switch-case) (Severity: [information](/reference/diagnostics#information))
* [noUselessTernary](/linter/rules/no-useless-ternary) (Severity: [information](/reference/diagnostics#information))
* [noUselessThisAlias](/linter/rules/no-useless-this-alias) (Severity: [information](/reference/diagnostics#information))
* [noUselessTypeConstraint](/linter/rules/no-useless-type-constraint) (Severity: [information](/reference/diagnostics#information))
* [noUselessUndefinedInitialization](/linter/rules/no-useless-undefined-initialization) (Severity: [information](/reference/diagnostics#information))
* [useArrowFunction](/linter/rules/use-arrow-function) (Severity: [warning](/reference/diagnostics#warning))
* [useDateNow](/linter/rules/use-date-now) (Severity: [warning](/reference/diagnostics#warning))
* [useFlatMap](/linter/rules/use-flat-map) (Severity: [information](/reference/diagnostics#information))
* [useIndexOf](/linter/rules/use-index-of) (Severity: [information](/reference/diagnostics#information))
* [useLiteralKeys](/linter/rules/use-literal-keys) (Severity: [information](/reference/diagnostics#information))
* [useNumericLiterals](/linter/rules/use-numeric-literals) (Severity: [warning](/reference/diagnostics#warning))
* [useOptionalChain](/linter/rules/use-optional-chain) (Severity: [warning](/reference/diagnostics#warning))
* [useRegexLiterals](/linter/rules/use-regex-literals) (Severity: [warning](/reference/diagnostics#warning))
* [useSimpleNumberKeys](/linter/rules/use-simple-number-keys) (Severity: [warning](/reference/diagnostics#warning))
* [noChildrenProp](/linter/rules/no-children-prop) (Severity: [error](/reference/diagnostics#error))
* [noConstAssign](/linter/rules/no-const-assign) (Severity: [error](/reference/diagnostics#error))
* [noConstantCondition](/linter/rules/no-constant-condition) (Severity: [error](/reference/diagnostics#error))
* [noConstantMathMinMaxClamp](/linter/rules/no-constant-math-min-max-clamp) (Severity: [error](/reference/diagnostics#error))
* [noConstructorReturn](/linter/rules/no-constructor-return) (Severity: [error](/reference/diagnostics#error))
* [noEmptyCharacterClassInRegex](/linter/rules/no-empty-character-class-in-regex) (Severity: [error](/reference/diagnostics#error))
* [noEmptyPattern](/linter/rules/no-empty-pattern) (Severity: [error](/reference/diagnostics#error))
* [noGlobalObjectCalls](/linter/rules/no-global-object-calls) (Severity: [error](/reference/diagnostics#error))
* [noInnerDeclarations](/linter/rules/no-inner-declarations) (Severity: [error](/reference/diagnostics#error))
* [noInvalidBuiltinInstantiation](/linter/rules/no-invalid-builtin-instantiation) (Severity: [error](/reference/diagnostics#error))
* [noInvalidConstructorSuper](/linter/rules/no-invalid-constructor-super) (Severity: [error](/reference/diagnostics#error))
* [noInvalidUseBeforeDeclaration](/linter/rules/no-invalid-use-before-declaration) (Severity: [error](/reference/diagnostics#error))
* [noNonoctalDecimalEscape](/linter/rules/no-nonoctal-decimal-escape) (Severity: [error](/reference/diagnostics#error))
* [noPrecisionLoss](/linter/rules/no-precision-loss) (Severity: [error](/reference/diagnostics#error))
* [noPrivateImports](/linter/rules/no-private-imports) (Severity: [warning](/reference/diagnostics#warning))
* [noQwikUseVisibleTask](/linter/rules/no-qwik-use-visible-task) (Severity: [error](/reference/diagnostics#error))
* [noRenderReturnValue](/linter/rules/no-render-return-value) (Severity: [error](/reference/diagnostics#error))
* [noSelfAssign](/linter/rules/no-self-assign) (Severity: [error](/reference/diagnostics#error))
* [noSetterReturn](/linter/rules/no-setter-return) (Severity: [error](/reference/diagnostics#error))
* [noStringCaseMismatch](/linter/rules/no-string-case-mismatch) (Severity: [error](/reference/diagnostics#error))
* [noSwitchDeclarations](/linter/rules/no-switch-declarations) (Severity: [error](/reference/diagnostics#error))
* [noUnreachable](/linter/rules/no-unreachable) (Severity: [error](/reference/diagnostics#error))
* [noUnreachableSuper](/linter/rules/no-unreachable-super) (Severity: [error](/reference/diagnostics#error))
* [noUnsafeFinally](/linter/rules/no-unsafe-finally) (Severity: [error](/reference/diagnostics#error))
* [noUnsafeOptionalChaining](/linter/rules/no-unsafe-optional-chaining) (Severity: [error](/reference/diagnostics#error))
* [noUnusedFunctionParameters](/linter/rules/no-unused-function-parameters) (Severity: [warning](/reference/diagnostics#warning))
* [noUnusedImports](/linter/rules/no-unused-imports) (Severity: [warning](/reference/diagnostics#warning))
* [noUnusedLabels](/linter/rules/no-unused-labels) (Severity: [warning](/reference/diagnostics#warning))
* [noUnusedPrivateClassMembers](/linter/rules/no-unused-private-class-members) (Severity: [warning](/reference/diagnostics#warning))
* [noUnusedVariables](/linter/rules/no-unused-variables) (Severity: [warning](/reference/diagnostics#warning))
* [noVoidElementsWithChildren](/linter/rules/no-void-elements-with-children) (Severity: [error](/reference/diagnostics#error))
* [noVoidTypeReturn](/linter/rules/no-void-type-return) (Severity: [error](/reference/diagnostics#error))
* [useExhaustiveDependencies](/linter/rules/use-exhaustive-dependencies) (Severity: [error](/reference/diagnostics#error))
* [useHookAtTopLevel](/linter/rules/use-hook-at-top-level) (Severity: [error](/reference/diagnostics#error))
* [useImageSize](/linter/rules/use-image-size) (Severity: [error](/reference/diagnostics#error))
* [useIsNan](/linter/rules/use-is-nan) (Severity: [error](/reference/diagnostics#error))
* [useJsxKeyInIterable](/linter/rules/use-jsx-key-in-iterable) (Severity: [error](/reference/diagnostics#error))
* [useParseIntRadix](/linter/rules/use-parse-int-radix) (Severity: [information](/reference/diagnostics#information))
* [useQwikClasslist](/linter/rules/use-qwik-classlist) (Severity: [error](/reference/diagnostics#error))
* [useValidForDirection](/linter/rules/use-valid-for-direction) (Severity: [error](/reference/diagnostics#error))
* [useValidTypeof](/linter/rules/use-valid-typeof) (Severity: [error](/reference/diagnostics#error))
* [useYield](/linter/rules/use-yield) (Severity: [error](/reference/diagnostics#error))
* [noAccumulatingSpread](/linter/rules/no-accumulating-spread) (Severity: [warning](/reference/diagnostics#warning))
* [noDynamicNamespaceImportAccess](/linter/rules/no-dynamic-namespace-import-access) (Severity: [warning](/reference/diagnostics#warning))
* [noImgElement](/linter/rules/no-img-element) (Severity: [warning](/reference/diagnostics#warning))
* [noUnwantedPolyfillio](/linter/rules/no-unwanted-polyfillio) (Severity: [warning](/reference/diagnostics#warning))
* [useGoogleFontPreconnect](/linter/rules/use-google-font-preconnect) (Severity: [information](/reference/diagnostics#information))
* [noBlankTarget](/linter/rules/no-blank-target) (Severity: [error](/reference/diagnostics#error))
* [noDangerouslySetInnerHtml](/linter/rules/no-dangerously-set-inner-html/) (Severity: [error](/reference/diagnostics#error))
* [noDangerouslySetInnerHtmlWithChildren](/linter/rules/no-dangerously-set-inner-html-with-children) (Severity: [error](/reference/diagnostics#error))
* [noGlobalEval](/linter/rules/no-global-eval) (Severity: [error](/reference/diagnostics#error))
* [noHeadElement](/linter/rules/no-head-element) (Severity: [warning](/reference/diagnostics#warning))
* [noNonNullAssertion](/linter/rules/no-non-null-assertion) (Severity: [warning](/reference/diagnostics#warning))
* [useArrayLiterals](/linter/rules/use-array-literals) (Severity: [information](/reference/diagnostics#information))
* [useConst](/linter/rules/use-const) (Severity: [warning](/reference/diagnostics#warning))
* [useExponentiationOperator](/linter/rules/use-exponentiation-operator) (Severity: [information](/reference/diagnostics#information))
* [useExportType](/linter/rules/use-export-type) (Severity: [warning](/reference/diagnostics#warning))
* [useImportType](/linter/rules/use-import-type) (Severity: [warning](/reference/diagnostics#warning))
* [useLiteralEnumMembers](/linter/rules/use-literal-enum-members) (Severity: [warning](/reference/diagnostics#warning))
* [useNodejsImportProtocol](/linter/rules/use-nodejs-import-protocol) (Severity: [information](/reference/diagnostics#information))
* [useShorthandFunctionType](/linter/rules/use-shorthand-function-type) (Severity: [information](/reference/diagnostics#information))
* [useTemplate](/linter/rules/use-template) (Severity: [information](/reference/diagnostics#information))
* [noApproximativeNumericConstant](/linter/rules/no-approximative-numeric-constant) (Severity: [warning](/reference/diagnostics#warning))
* [noArrayIndexKey](/linter/rules/no-array-index-key) (Severity: [error](/reference/diagnostics#error))
* [noAssignInExpressions](/linter/rules/no-assign-in-expressions) (Severity: [error](/reference/diagnostics#error))
* [noAsyncPromiseExecutor](/linter/rules/no-async-promise-executor) (Severity: [error](/reference/diagnostics#error))
* [noCatchAssign](/linter/rules/no-catch-assign) (Severity: [warning](/reference/diagnostics#warning))
* [noClassAssign](/linter/rules/no-class-assign) (Severity: [error](/reference/diagnostics#error))
* [noCommentText](/linter/rules/no-comment-text) (Severity: [error](/reference/diagnostics#error))
* [noCompareNegZero](/linter/rules/no-compare-neg-zero) (Severity: [error](/reference/diagnostics#error))
* [noConfusingLabels](/linter/rules/no-confusing-labels) (Severity: [warning](/reference/diagnostics#warning))
* [noConfusingVoidType](/linter/rules/no-confusing-void-type) (Severity: [warning](/reference/diagnostics#warning))
* [noConstEnum](/linter/rules/no-const-enum) (Severity: [warning](/reference/diagnostics#warning))
* [noControlCharactersInRegex](/linter/rules/no-control-characters-in-regex) (Severity: [error](/reference/diagnostics#error))
* [noDebugger](/linter/rules/no-debugger) (Severity: [error](/reference/diagnostics#error))
* [noDocumentCookie](/linter/rules/no-document-cookie) (Severity: [warning](/reference/diagnostics#warning))
* [noDocumentImportInPage](/linter/rules/no-document-import-in-page) (Severity: [warning](/reference/diagnostics#warning))
* [noDoubleEquals](/linter/rules/no-double-equals) (Severity: [error](/reference/diagnostics#error))
* [noDuplicateCase](/linter/rules/no-duplicate-case) (Severity: [error](/reference/diagnostics#error))
* [noDuplicateClassMembers](/linter/rules/no-duplicate-class-members) (Severity: [error](/reference/diagnostics#error))
* [noDuplicateElseIf](/linter/rules/no-duplicate-else-if) (Severity: [error](/reference/diagnostics#error))
* [noDuplicateJsxProps](/linter/rules/no-duplicate-jsx-props) (Severity: [error](/reference/diagnostics#error))
* [noDuplicateObjectKeys](/linter/rules/no-duplicate-object-keys) (Severity: [error](/reference/diagnostics#error))
* [noDuplicateParameters](/linter/rules/no-duplicate-parameters) (Severity: [error](/reference/diagnostics#error))
* [noDuplicateTestHooks](/linter/rules/no-duplicate-test-hooks) (Severity: [error](/reference/diagnostics#error))
* [noEmptyInterface](/linter/rules/no-empty-interface) (Severity: [error](/reference/diagnostics#error))
* [noExplicitAny](/linter/rules/no-explicit-any) (Severity: [warning](/reference/diagnostics#warning))
* [noExportsInTest](/linter/rules/no-exports-in-test) (Severity: [error](/reference/diagnostics#error))
* [noExtraNonNullAssertion](/linter/rules/no-extra-non-null-assertion) (Severity: [warning](/reference/diagnostics#warning))
* [noFallthroughSwitchClause](/linter/rules/no-fallthrough-switch-clause) (Severity: [error](/reference/diagnostics#error))
* [noFocusedTests](/linter/rules/no-focused-tests) (Severity: [warning](/reference/diagnostics#warning))
* [noFunctionAssign](/linter/rules/no-function-assign) (Severity: [error](/reference/diagnostics#error))
* [noGlobalAssign](/linter/rules/no-global-assign) (Severity: [error](/reference/diagnostics#error))
* [noGlobalIsFinite](/linter/rules/no-global-is-finite) (Severity: [warning](/reference/diagnostics#warning))
* [noGlobalIsNan](/linter/rules/no-global-is-nan) (Severity: [warning](/reference/diagnostics#warning))
* [noHeadImportInDocument](/linter/rules/no-head-import-in-document) (Severity: [warning](/reference/diagnostics#warning))
* [noImplicitAnyLet](/linter/rules/no-implicit-any-let) (Severity: [error](/reference/diagnostics#error))
* [noImportAssign](/linter/rules/no-import-assign) (Severity: [error](/reference/diagnostics#error))
* [noIrregularWhitespace](/linter/rules/no-irregular-whitespace) (Severity: [warning](/reference/diagnostics#warning))
* [noLabelVar](/linter/rules/no-label-var) (Severity: [error](/reference/diagnostics#error))
* [noMisleadingCharacterClass](/linter/rules/no-misleading-character-class) (Severity: [error](/reference/diagnostics#error))
* [noMisleadingInstantiator](/linter/rules/no-misleading-instantiator) (Severity: [error](/reference/diagnostics#error))
* [noMisrefactoredShorthandAssign](/linter/rules/no-misrefactored-shorthand-assign) (Severity: [error](/reference/diagnostics#error))
* [noNonNullAssertedOptionalChain](/linter/rules/no-non-null-asserted-optional-chain) (Severity: [error](/reference/diagnostics#error))
* [noOctalEscape](/linter/rules/no-octal-escape) (Severity: [warning](/reference/diagnostics#warning))
* [noPrototypeBuiltins](/linter/rules/no-prototype-builtins) (Severity: [warning](/reference/diagnostics#warning))
* [noReactSpecificProps](/linter/rules/no-react-specific-props) (Severity: [warning](/reference/diagnostics#warning))
* [noRedeclare](/linter/rules/no-redeclare) (Severity: [error](/reference/diagnostics#error))
* [noRedundantUseStrict](/linter/rules/no-redundant-use-strict) (Severity: [warning](/reference/diagnostics#warning))
* [noSelfCompare](/linter/rules/no-self-compare) (Severity: [error](/reference/diagnostics#error))
* [noShadowRestrictedNames](/linter/rules/no-shadow-restricted-names) (Severity: [error](/reference/diagnostics#error))
* [noSparseArray](/linter/rules/no-sparse-array) (Severity: [error](/reference/diagnostics#error))
* [noSuspiciousSemicolonInJsx](/linter/rules/no-suspicious-semicolon-in-jsx) (Severity: [warning](/reference/diagnostics#warning))
* [noTemplateCurlyInString](/linter/rules/no-template-curly-in-string) (Severity: [warning](/reference/diagnostics#warning))
* [noThenProperty](/linter/rules/no-then-property) (Severity: [error](/reference/diagnostics#error))
* [noTsIgnore](/linter/rules/no-ts-ignore) (Severity: [warning](/reference/diagnostics#warning))
* [noUnsafeDeclarationMerging](/linter/rules/no-unsafe-declaration-merging) (Severity: [error](/reference/diagnostics#error))
* [noUnsafeNegation](/linter/rules/no-unsafe-negation) (Severity: [error](/reference/diagnostics#error))
* [noUselessEscapeInString](/linter/rules/no-useless-escape-in-string) (Severity: [warning](/reference/diagnostics#warning))
* [noUselessRegexBackrefs](/linter/rules/no-useless-regex-backrefs) (Severity: [warning](/reference/diagnostics#warning))
* [noWith](/linter/rules/no-with) (Severity: [error](/reference/diagnostics#error))
* [useAdjacentOverloadSignatures](/linter/rules/use-adjacent-overload-signatures) (Severity: [warning](/reference/diagnostics#warning))
* [useDefaultSwitchClauseLast](/linter/rules/use-default-switch-clause-last) (Severity: [warning](/reference/diagnostics#warning))
* [useGetterReturn](/linter/rules/use-getter-return) (Severity: [error](/reference/diagnostics#error))
* [useGoogleFontDisplay](/linter/rules/use-google-font-display) (Severity: [warning](/reference/diagnostics#warning))
* [useIsArray](/linter/rules/use-is-array) (Severity: [warning](/reference/diagnostics#warning))
* [useIterableCallbackReturn](/linter/rules/use-iterable-callback-return) (Severity: [error](/reference/diagnostics#error))
* [useNamespaceKeyword](/linter/rules/use-namespace-keyword) (Severity: [error](/reference/diagnostics#error))

Missing a rule? Help us by [contributing](https://github.com/biomejs/biome/blob/main/CONTRIBUTING.md) to the [analyzer](https://github.com/biomejs/biome/blob/main/crates/biome_analyze/CONTRIBUTING.md) or create a rule suggestion [here](https://github.com/biomejs/biome/discussions/categories/rule-suggestion).
