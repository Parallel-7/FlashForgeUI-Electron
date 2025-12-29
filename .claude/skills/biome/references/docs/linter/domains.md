# Domains

## Next


Use this domain inside Next.js projects.

### Next activation


Enable the **recommended, non-nursery** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"next": "recommended"

}

}

}
```

Enabled the **all** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"next": "all"

}

}

}
```

**Disable** all rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"next": "none"

}

}

}
```

### Next dependencies


Enabled when the following dependencies are declared:

* `next`: `>=14.0.0`

### Next rules


Rules that belong to the domain:

* [useExhaustiveDependencies](/linter/rules/use-exhaustive-dependencies) (recommended)
* [useHookAtTopLevel](/linter/rules/use-hook-at-top-level) (recommended)
* [noNextAsyncClientComponent](/linter/rules/no-next-async-client-component) [(nursery)](/linter/#nursery)
* [noSyncScripts](/linter/rules/no-sync-scripts) [(nursery)](/linter/#nursery)
* [noImgElement](/linter/rules/no-img-element) (recommended)
* [noUnwantedPolyfillio](/linter/rules/no-unwanted-polyfillio) (recommended)
* [useGoogleFontPreconnect](/linter/rules/use-google-font-preconnect) (recommended)
* [noHeadElement](/linter/rules/no-head-element) (recommended)
* [noDocumentImportInPage](/linter/rules/no-document-import-in-page) (recommended)
* [noHeadImportInDocument](/linter/rules/no-head-import-in-document) (recommended)

## Project


This domain contains rules that perform project-level analysis. This includes our module graph for dependency resolution, as well as type information. When enabling rules that belong to this domain, Biome will scan the entire project. The scanning phase will have a performance impact on the linting process. See the documentation on our [scanner](/internals/architecture/#scanner) to learn more about the scanner.

### Project activation


Enable the **recommended, non-nursery** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"project": "recommended"

}

}

}
```

Enabled the **all** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"project": "all"

}

}

}
```

**Disable** all rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"project": "none"

}

}

}
```

### Project rules


Rules that belong to the domain:

* [noPrivateImports](/linter/rules/no-private-imports) (recommended)
* [noUndeclaredDependencies](/linter/rules/no-undeclared-dependencies)
* [useImportExtensions](/linter/rules/use-import-extensions)
* [useJsonImportAttributes](/linter/rules/use-json-import-attributes)
* [noDeprecatedImports](/linter/rules/no-deprecated-imports) [(nursery)](/linter/#nursery)
* [noFloatingPromises](/linter/rules/no-floating-promises) [(nursery)](/linter/#nursery)
* [noImportCycles](/linter/rules/no-import-cycles) [(nursery)](/linter/#nursery)
* [noMisusedPromises](/linter/rules/no-misused-promises) [(nursery)](/linter/#nursery)
* [noUnnecessaryConditions](/linter/rules/no-unnecessary-conditions) [(nursery)](/linter/#nursery)
* [noUnresolvedImports](/linter/rules/no-unresolved-imports) [(nursery)](/linter/#nursery)
* [useArraySortCompare](/linter/rules/use-array-sort-compare) [(nursery)](/linter/#nursery)
* [useAwaitThenable](/linter/rules/use-await-thenable) [(nursery)](/linter/#nursery)
* [useExhaustiveSwitchCases](/linter/rules/use-exhaustive-switch-cases) [(nursery)](/linter/#nursery)
* [useFind](/linter/rules/use-find) [(nursery)](/linter/#nursery)
* [useRegexpExec](/linter/rules/use-regexp-exec) [(nursery)](/linter/#nursery)

## Qwik


Use this domain inside Qwik projects. This domain enables rules that are specific to Qwik projects.

### Qwik activation


Enable the **recommended, non-nursery** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"qwik": "recommended"

}

}

}
```

Enabled the **all** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"qwik": "all"

}

}

}
```

**Disable** all rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"qwik": "none"

}

}

}
```

### Qwik dependencies


Enabled when the following dependencies are declared:

* `@builder.io/qwik`: `>=1.0.0`
* `@qwik.dev/core`: `>=2.0.0`

### Qwik rules


Rules that belong to the domain:

* [noQwikUseVisibleTask](/linter/rules/no-qwik-use-visible-task) (recommended)
* [useImageSize](/linter/rules/use-image-size) (recommended)
* [useJsxKeyInIterable](/linter/rules/use-jsx-key-in-iterable) (recommended)
* [useQwikClasslist](/linter/rules/use-qwik-classlist) (recommended)
* [useQwikMethodUsage](/linter/rules/use-qwik-method-usage) [(nursery)](/linter/#nursery)
* [useQwikValidLexicalScope](/linter/rules/use-qwik-valid-lexical-scope) [(nursery)](/linter/#nursery)
* [noReactSpecificProps](/linter/rules/no-react-specific-props) (recommended)

## React


Use this domain inside React projects. It enables a set of rules that can help catching bugs and enforce correct practices. This domain enable rules that might conflict with the Solid domain.

### React activation


Enable the **recommended, non-nursery** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"react": "recommended"

}

}

}
```

Enabled the **all** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"react": "all"

}

}

}
```

**Disable** all rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"react": "none"

}

}

}
```

### React dependencies


Enabled when the following dependencies are declared:

* `react`: `>=16.0.0`

### React rules


Rules that belong to the domain:

* [noChildrenProp](/linter/rules/no-children-prop) (recommended)
* [noNestedComponentDefinitions](/linter/rules/no-nested-component-definitions)
* [noReactPropAssignments](/linter/rules/no-react-prop-assignments)
* [noRenderReturnValue](/linter/rules/no-render-return-value) (recommended)
* [useExhaustiveDependencies](/linter/rules/use-exhaustive-dependencies) (recommended)
* [useHookAtTopLevel](/linter/rules/use-hook-at-top-level) (recommended)
* [useJsxKeyInIterable](/linter/rules/use-jsx-key-in-iterable) (recommended)
* [useUniqueElementIds](/linter/rules/use-unique-element-ids)
* [noDuplicatedSpreadProps](/linter/rules/no-duplicated-spread-props) [(nursery)](/linter/#nursery)
* [noLeakedRender](/linter/rules/no-leaked-render) [(nursery)](/linter/#nursery)
* [noReactForwardRef](/linter/rules/no-react-forward-ref) [(nursery)](/linter/#nursery)
* [noSyncScripts](/linter/rules/no-sync-scripts) [(nursery)](/linter/#nursery)
* [noUnknownAttribute](/linter/rules/no-unknown-attribute) [(nursery)](/linter/#nursery)
* [noDangerouslySetInnerHtml](/linter/rules/no-dangerously-set-inner-html/) (recommended)
* [noDangerouslySetInnerHtmlWithChildren](/linter/rules/no-dangerously-set-inner-html-with-children) (recommended)
* [useComponentExportOnlyModules](/linter/rules/use-component-export-only-modules)
* [useReactFunctionComponents](/linter/rules/use-react-function-components)
* [noArrayIndexKey](/linter/rules/no-array-index-key) (recommended)

## Solid


Use this domain inside Solid projects. This domain enables rules that might conflict with the React domain.

### Solid activation


Enable the **recommended, non-nursery** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"solid": "recommended"

}

}

}
```

Enabled the **all** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"solid": "all"

}

}

}
```

**Disable** all rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"solid": "none"

}

}

}
```

### Solid dependencies


Enabled when the following dependencies are declared:

* `solid`: `>=1.0.0`

### Solid rules


Rules that belong to the domain:

* [noSolidDestructuredProps](/linter/rules/no-solid-destructured-props)
* [noDuplicatedSpreadProps](/linter/rules/no-duplicated-spread-props) [(nursery)](/linter/#nursery)
* [useSolidForComponent](/linter/rules/use-solid-for-component)
* [noReactSpecificProps](/linter/rules/no-react-specific-props) (recommended)

## Test


Use this domain when linting test files. It enables a set of rules that are library agnostic, and can help to catch possible misuse of the test APIs.

### Test activation


Enable the **recommended, non-nursery** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"test": "recommended"

}

}

}
```

Enabled the **all** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"test": "all"

}

}

}
```

**Disable** all rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"test": "none"

}

}

}
```

### Test dependencies


Enabled when the following dependencies are declared:

* `jest`: `>=26.0.0`
* `mocha`: `>=8.0.0`
* `ava`: `>=2.0.0`
* `vitest`: `>=1.0.0`

### Test globals


When enabled, the following global bindings are recognised by Biome:

* `after`
* `afterAll`
* `afterEach`
* `before`
* `beforeEach`
* `beforeAll`
* `describe`
* `it`
* `expect`
* `test`

### Test rules


Rules that belong to the domain:

* [noExcessiveNestedTestSuites](/linter/rules/no-excessive-nested-test-suites)
* [noDuplicateTestHooks](/linter/rules/no-duplicate-test-hooks) (recommended)
* [noExportsInTest](/linter/rules/no-exports-in-test) (recommended)
* [noFocusedTests](/linter/rules/no-focused-tests) (recommended)

## Turborepo


Use this domain inside Turborepo projects. This domain enables rules that are specific to Turborepo projects.

### Turborepo activation


Enable the **recommended, non-nursery** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"turborepo": "recommended"

}

}

}
```

No recommended rules

Since all rules in this domain are nursery rules, no rules will be activated when using the “recommended” setting. Use “all” to enable all nursery rules in this domain.

Enabled the **all** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"turborepo": "all"

}

}

}
```

**Disable** all rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"turborepo": "none"

}

}

}
```

### Turborepo dependencies


Enabled when the following dependencies are declared:

* `turbo`: `>=1.0.0`

### Turborepo rules


Rules that belong to the domain:

* [noUndeclaredEnvVars](/linter/rules/no-undeclared-env-vars) [(nursery)](/linter/#nursery)

## Vue


Use this domain inside Vue projects. This domain enables rules that are specific to Vue projects.

### Vue activation


Enable the **recommended, non-nursery** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"vue": "recommended"

}

}

}
```

No recommended rules

Since all rules in this domain are nursery rules, no rules will be activated when using the “recommended” setting. Use “all” to enable all nursery rules in this domain.

Enabled the **all** rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"vue": "all"

}

}

}
```

**Disable** all rules of the domain:

biome.json

```
{

"linter": {

"domains": {

"vue": "none"

}

}

}
```

### Vue dependencies


Enabled when the following dependencies are declared:

* `vue`: `>=3.0.0`

### Vue rules


Rules that belong to the domain:

* [noVueDataObjectDeclaration](/linter/rules/no-vue-data-object-declaration) [(nursery)](/linter/#nursery)
* [noVueDuplicateKeys](/linter/rules/no-vue-duplicate-keys) [(nursery)](/linter/#nursery)
* [noVueReservedKeys](/linter/rules/no-vue-reserved-keys) [(nursery)](/linter/#nursery)
* [noVueReservedProps](/linter/rules/no-vue-reserved-props) [(nursery)](/linter/#nursery)
* [noVueSetupPropsReactivityLoss](/linter/rules/no-vue-setup-props-reactivity-loss) [(nursery)](/linter/#nursery)
* [useVueConsistentDefinePropsDeclaration](/linter/rules/use-vue-consistent-define-props-declaration) [(nursery)](/linter/#nursery)
* [useVueDefineMacrosOrder](/linter/rules/use-vue-define-macros-order) [(nursery)](/linter/#nursery)
* [useVueMultiWordComponentNames](/linter/rules/use-vue-multi-word-component-names) [(nursery)](/linter/#nursery)
* [noVueVIfWithVFor](/linter/rules/no-vue-v-if-with-v-for) [(nursery)](/linter/#nursery)
* [useVueHyphenatedAttributes](/linter/rules/use-vue-hyphenated-attributes) [(nursery)](/linter/#nursery)
* [useVueValidVBind](/linter/rules/use-vue-valid-v-bind) [(nursery)](/linter/#nursery)
* [useVueValidVElse](/linter/rules/use-vue-valid-v-else) [(nursery)](/linter/#nursery)
* [useVueValidVElseIf](/linter/rules/use-vue-valid-v-else-if) [(nursery)](/linter/#nursery)
* [useVueValidVHtml](/linter/rules/use-vue-valid-v-html/) [(nursery)](/linter/#nursery)
* [useVueValidVIf](/linter/rules/use-vue-valid-v-if) [(nursery)](/linter/#nursery)
* [useVueValidVOn](/linter/rules/use-vue-valid-v-on) [(nursery)](/linter/#nursery)
* [useVueValidVText](/linter/rules/use-vue-valid-v-text) [(nursery)](/linter/#nursery)
