# Version History

Find a version

## [2.3.10](/internals/changelog/version/2-3-10/) Latest

### Patch Changes

* [#8417](https://github.com/biomejs/biome/pull/8417) [`c3a2557`](https://github.com/biomejs/biome/commit/c3a255709cdbdb8e2281eac5bb65848eafeaa366) Thanks [@taga3s](https://github.com/taga3s)! - Fixed [#7809](https://github.com/biomejs/biome/issues/7809): [`noRedeclare`](https://biomejs.dev/linter/rules/no-redeclare/) no longer reports redeclarations for `infer` type in conditional types.
* [#8477](https://github.com/biomejs/biome/pull/8477) [`90e8684`](https://github.com/biomejs/biome/commit/90e86848a9dd63b63b6a91766620657ae04b5c2d) Thanks [@dyc3](https://github.com/dyc3)! - Fixed [#8475](https://github.com/biomejs/biome/issues/8475): fixed a regression in how `noExtraNonNullAssertion` flags extra non-null assertions
* [#8479](https://github.com/biomejs/biome/pull/8479) [`250b519`](https://github.com/biomejs/biome/commit/250b51974f833f17b0e0e4f5d71bf93461cf3324) Thanks [@dyc3](https://github.com/dyc3)! - Fixed [#8473](https://github.com/biomejs/biome/issues/8473): The semantic model now indexes typescript constructor method definitions, and no longer panics if you use one (a regression in 2.3.9).
* [#8448](https://github.com/biomejs/biome/pull/8448) [`2af85c1`](https://github.com/biomejs/biome/commit/2af85c16ae3cfcd460645d83fe5789c75031967a) Thanks [@mdevils](https://github.com/mdevils)! - Improved handling of `defineProps()` macro in Vue components. The [`noVueReservedKeys`](https://biomejs.dev/linter/rules/no-vue-reserved-keys/) rule now avoids false positives in non-setup scripts.
* [#8420](https://github.com/biomejs/biome/pull/8420) [`42033b0`](https://github.com/biomejs/biome/commit/42033b041f473badfcc6d1a0f52324b5388c570b) Thanks [@vsn4ik](https://github.com/vsn4ik)! - Fixed the nursery rule [`noLeakedRender`](https://biomejs.dev/linter/rules/no-leaked-render/).

  The `biome migrate eslint` command now correctly detects the rule `react/jsx-no-leaked-render` in your eslint configurations.
* [#8426](https://github.com/biomejs/biome/pull/8426) [`285d932`](https://github.com/biomejs/biome/commit/285d9321d8701e86f39b3a747563fc14e129b459) Thanks [@anthonyshew](https://github.com/anthonyshew)! - Added a Turborepo domain and a new “noUndeclaredEnvVars” rule in it for warning users of unsafe environment variable usage in Turborepos.
* [#8410](https://github.com/biomejs/biome/pull/8410) [`a21db74`](https://github.com/biomejs/biome/commit/a21db74bc02ac7ae7e0bd96de242588c6c4108e8) Thanks [@ematipico](https://github.com/ematipico)! - Fixed [#2988](https://github.com/biomejs/biome/issues/2988) where Biome couldn’t handle properly characters that contain multiple code points when running in `stdin` mode.
* [#8372](https://github.com/biomejs/biome/pull/8372) [`b352ee4`](https://github.com/biomejs/biome/commit/b352ee4759f7c3b09a2bf2084de5991e935bce4d) Thanks [@Netail](https://github.com/Netail)! - Added the nursery rule [`noAmbiguousAnchorText`](https://biomejs.dev/linter/rules/no-ambiguous-anchor-text/), which disallows ambiguous anchor descriptions.

  #### Invalid

  ```
  <a>learn more</a>
  ```

## [2.3.9](/internals/changelog/version/2-3-9/)

### Patch Changes

* [#8232](https://github.com/biomejs/biome/pull/8232) [`84c9e08`](https://github.com/biomejs/biome/commit/84c9e08b1b736dcc6d163ab1fb48c581b2de458c) Thanks [@ruidosujeira](https://github.com/ruidosujeira)! - Added the nursery rule [`noScriptUrl`](https://biomejs.dev/linter/rules/no-script-url/).

  This rule disallows the use of `javascript:` URLs, which are considered a form of `eval` and can pose security risks such as XSS vulnerabilities.

  ```
  <a href="javascript:alert('XSS')">Click me</a>
  ```
* [#8341](https://github.com/biomejs/biome/pull/8341) [`343dc4d`](https://github.com/biomejs/biome/commit/343dc4dfd48a048f0c833af318b6a10dfc4dab6d) Thanks [@arendjr](https://github.com/arendjr)! - Added the nursery rule [`useAwaitThenable`](https://biomejs.dev/linter/rules/use-await-thenable/), which enforces that `await` is only used on Promise values.

  #### Invalid

  ```
  await "value";

  const createValue = () => "value";

  await createValue();
  ```

  #### Caution

  This is a first iteration of the rule, and does not yet detect generic [“thenable”](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise#thenables) values.
* [#8034](https://github.com/biomejs/biome/pull/8034) [`e7e0f6c`](https://github.com/biomejs/biome/commit/e7e0f6c14df92d83d08f86b1e57fc82b4df775b7) Thanks [@Netail](https://github.com/Netail)! - Added the nursery rule [`useRegexpExec`](https://biomejs.dev/linter/rules/use-regexp-exec/). Enforce `RegExp#exec` over `String#match` if no global flag is provided.
* [#8137](https://github.com/biomejs/biome/pull/8137) [`d407efb`](https://github.com/biomejs/biome/commit/d407efb8c650b9288f545efedd4b7d3f9783c8d1) Thanks [@denbezrukov](https://github.com/denbezrukov)! - Reduced the internal memory used by the Biome formatter.
* [#8281](https://github.com/biomejs/biome/pull/8281) [`30b046f`](https://github.com/biomejs/biome/commit/30b046faca464404aaeecfe1ed0e8a94b0e25990) Thanks [@tylersayshi](https://github.com/tylersayshi)! - Added the rule [`useRequiredScripts`](https://biomejs.dev/linter/rules/use-required-scripts/), which enforces presence of configurable entries in the `scripts` section of `package.json` files.
* [#8290](https://github.com/biomejs/biome/pull/8290) [`d74c8bd`](https://github.com/biomejs/biome/commit/d74c8bda655a17405809d24126ee09e9e200d51e) Thanks [@dyc3](https://github.com/dyc3)! - The HTML formatter has been updated to match Prettier 3.7’s behavior for handling `<iframe>`’s `allow` attribute.

  ```
  <iframe allow="layout-animations 'none'; unoptimized-images 'none'; oversized-images 'none'; sync-script 'none'; sync-xhr 'none'; unsized-media 'none';"></iframe>

  <iframe

  allow="

  layout-animations 'none';

  unoptimized-images 'none';

  oversized-images 'none';

  sync-script 'none';

  sync-xhr 'none';

  unsized-media 'none';

  "

  ></iframe>
  ```
* [#8302](https://github.com/biomejs/biome/pull/8302) [`d1d5014`](https://github.com/biomejs/biome/commit/d1d50140f23c9c3ce4f48d9d2b97822234aad798) Thanks [@mlafeldt](https://github.com/mlafeldt)! - Fixed [#8109](https://github.com/biomejs/biome/issues/8109): return statements in Astro frontmatter no longer trigger “Illegal return statement” errors when using `experimentalFullSupportEnabled`.
* [#8346](https://github.com/biomejs/biome/pull/8346) [`f3aee1a`](https://github.com/biomejs/biome/commit/f3aee1a92fba7c61de4b6f5ada3063fb126db885) Thanks [@arendjr](https://github.com/arendjr)! - Fixed [#8292](https://github.com/biomejs/biome/issues/8292): Implement tracking
  of types of TypeScript constructor parameter properties.

  This resolves certain false negatives in `noFloatingPromises` and other typed
  rules.

  #### Example

  ```
  class AsyncClass {

  async returnsPromise() {

  return "value";

  }

  }

  class ShouldBeReported {

  constructor(public field: AsyncClass) {}

  //          ^^^^^^^^^^^^----------------- Parameter property declaration

  async shouldBeReported() {

  // `noFloatingPromises` will now report the following usage:

  this.field.returnsPromise();

  }

  }
  ```
* [#8326](https://github.com/biomejs/biome/pull/8326) [`153e3c6`](https://github.com/biomejs/biome/commit/153e3c6ba999481c8dff2531bcbbd62f4977cd19) Thanks [@ematipico](https://github.com/ematipico)! - Improved the rule `noBiomeFirstException`. The rule can now inspect if extended configurations already contain the catch-all `**` inside `files.includes` and, if so, the rule suggests removing `**` from the user configuration.
* [#8433](https://github.com/biomejs/biome/pull/8433) [`397547a`](https://github.com/biomejs/biome/commit/397547a85c46d87ccf6a8501c734b844b348865e) Thanks [@dyc3](https://github.com/dyc3)! - Fixed [#7920](https://github.com/biomejs/biome/issues/7920): The CSS parser, with Tailwind directives enabled, will no longer error when you use things like `prefix(tw)` in `@import` at rules.
* [#8378](https://github.com/biomejs/biome/pull/8378) [`cc2a62e`](https://github.com/biomejs/biome/commit/cc2a62e61b3818e59a16e0add9293c6345441ad7) Thanks [@Bertie690](https://github.com/Bertie690)! - Clarify diagnostic message for `lint/style/useUnifiedTypeSignatures`

  The rule’s diagnostic message now clearly states that multiple *similar* overload signatures are hard to read & maintain, as opposed to overload signatures in general.
* [#8296](https://github.com/biomejs/biome/pull/8296) [`9d3ef10`](https://github.com/biomejs/biome/commit/9d3ef10d007e637c43b2f5e97758767da5f03d32) Thanks [@dyc3](https://github.com/dyc3)! - `biome rage` now shows if you have experimental HTML full support enabled.
* [#8414](https://github.com/biomejs/biome/pull/8414) [`09acf2a`](https://github.com/biomejs/biome/commit/09acf2a700f480ae6acbefaab770e8db33d5e596) Thanks [@Bertie690](https://github.com/Bertie690)! - Updated the documentation & diagnostic message for `lint/nursery/noProto`, mentioning the reasons for its longstanding deprecation and why more modern alternatives are preferred.

  Notably, the rule clearly states that using `__proto__` inside object literal definitions is still allowed, being a standard way to set the prototype of a newly created object.
* [#8445](https://github.com/biomejs/biome/pull/8445) [`c3df0e0`](https://github.com/biomejs/biome/commit/c3df0e04fe6d23b41daa2cd832071d82fbc4224f) Thanks [@tt-a1i](https://github.com/tt-a1i)! - Fix `--changed` and `--staged` flags throwing “No such file or directory” error when a file has been deleted or renamed in the working directory. The CLI now filters out files that no longer exist before processing.
* [#8459](https://github.com/biomejs/biome/pull/8459) [`b17d12b`](https://github.com/biomejs/biome/commit/b17d12b497ef3ec694d53f684295e0c6e49fdcad) Thanks [@ruidosujeira](https://github.com/ruidosujeira)! - Fix [#8435](https://github.com/biomejs/biome/issues/8435): resolved false positive in `noUnusedVariables` for generic type parameters in construct signature type members (`new <T>(): T`).
* [#8439](https://github.com/biomejs/biome/pull/8439) [`a78774b`](https://github.com/biomejs/biome/commit/a78774bd8eabe159d5596bfed198d7216282e159) Thanks [@tt-a1i](https://github.com/tt-a1i)! - Fixed [#8011](https://github.com/biomejs/biome/issues/8011): [`useConsistentCurlyBraces`](https://biomejs.dev/linter/rules/use-consistent-curly-braces/) no longer suggests removing curly braces from JSX expression children containing characters that would cause parsing issues or semantic changes when converted to plain JSX text (`{`, `}`, `<`, `>`, `&`).
* [#8436](https://github.com/biomejs/biome/pull/8436) [`a392c06`](https://github.com/biomejs/biome/commit/a392c0646e285086558b96e0af7a84174d8bb190) Thanks [@ruidosujeira](https://github.com/ruidosujeira)! - Fixed [#8429](https://github.com/biomejs/biome/issues/8429). Formatter, linter, and assist settings now correctly inherit from global configuration when not explicitly specified in overrides.

  Before this fix, when an override specified only one feature (e.g., only `linter`), other features would be incorrectly disabled instead of inheriting from global settings.

  Example configuration that now works correctly:

  ```
  {

  "formatter": { "enabled": true },

  "overrides": [

  {

  "includes": ["*.vue"],

  "linter": { "enabled": false }

  }

  ]

  }
  ```

  After this fix, `.vue` files will have the linter disabled (as specified in the override) but the formatter enabled (inherited from global settings).
* [#8411](https://github.com/biomejs/biome/pull/8411) [`9f1b3b0`](https://github.com/biomejs/biome/commit/9f1b3b06586401b39e0aa886bf7c8484fd2a6ded) Thanks [@rriski](https://github.com/rriski)! - Properly handle `name`, `type_arguments`, and `attributes` slots for `JsxOpeningElement` and `JsxSelfClosingElement` GritQL patterns.

  The following biome search commands no longer throw errors:

  Terminal window

  ```
  biome search 'JsxOpeningElement(name = $elem_name) where { $elem_name <: "div" }'

  biome search 'JsxSelfClosingElement(name = $elem_name) where { $elem_name <: "div" }'
  ```
* [#8441](https://github.com/biomejs/biome/pull/8441) [`cf37d0d`](https://github.com/biomejs/biome/commit/cf37d0dee56dba8c8b9e81c880f82f365f3102bf) Thanks [@tt-a1i](https://github.com/tt-a1i)! - Fixed [#6577](https://github.com/biomejs/biome/issues/6577): [`noUselessUndefined`](https://biomejs.dev/linter/rules/no-useless-undefined/) no longer reports `() => undefined` in arrow function expression bodies. Previously, the rule would flag this pattern and suggest replacing it with `() => {}`, which conflicts with the `noEmptyBlockStatements` rule.
* [#8444](https://github.com/biomejs/biome/pull/8444) [`8caa7a0`](https://github.com/biomejs/biome/commit/8caa7a07547960d8e9101fe67e2c490ec52426e9) Thanks [@tt-a1i](https://github.com/tt-a1i)! - Fix [`noUnknownMediaFeatureName`](https://biomejs.dev/linter/rules/no-unknown-media-feature-name/) false positive for `prefers-reduced-transparency` media feature. The feature name was misspelled as `prefers-reduded-transparency` in the keywords list.
* [#8443](https://github.com/biomejs/biome/pull/8443) [`c3fa5a1`](https://github.com/biomejs/biome/commit/c3fa5a1f26d8ea90006f9ded667136d6db347a8d) Thanks [@tt-a1i](https://github.com/tt-a1i)! - Fix [`useGenericFontNames`](https://biomejs.dev/linter/rules/use-generic-font-names/) false positive when a CSS variable is used as the last value in `font-family` or `font`. The rule now correctly ignores cases like `font-family: "Noto Serif", var(--serif)` and `font: 1em Arial, var(--fallback)`.
* [#8281](https://github.com/biomejs/biome/pull/8281) [`30b046f`](https://github.com/biomejs/biome/commit/30b046faca464404aaeecfe1ed0e8a94b0e25990) Thanks [@tylersayshi](https://github.com/tylersayshi)! - Fixed [`noDuplicateDependencies`](https://biomejs.dev/linter/rules/no-duplicate-dependencies/) incorrectly triggering on files like `_package.json`.
* [#8315](https://github.com/biomejs/biome/pull/8315) [`c7915c4`](https://github.com/biomejs/biome/commit/c7915c445fbe00d94713e4a285df3e0becde64a7) Thanks [@hirokiokada77](https://github.com/hirokiokada77)! - Fixed [#5213](https://github.com/biomejs/biome/issues/5213): The [`noDoneCallback`](https://biomejs.dev/linter/rules/no-done-callback/) rule no longer flags false positives when a method is called on a regular variable bound to identifiers such as `before`, `after`, `beforeEach`, and `afterEach`.
* [#8398](https://github.com/biomejs/biome/pull/8398) [`204844f`](https://github.com/biomejs/biome/commit/204844f98f50140c4072b3ee1843994dbe73d2f7) Thanks [@Bertie690](https://github.com/Bertie690)! - The default value of the `ignoreRestSiblings` option for [`noUnusedVariables`](https://biomejs.dev/linter/rules/no-unused-variables)’
  has been reverted to its prior value of `true` after [an internal refactor](https://github.com/biomejs/biome/pull/7941) accidentally changed it.

  The diagnostic message has also been tweaked for readability.
* [#8242](https://github.com/biomejs/biome/pull/8242) [`9694e37`](https://github.com/biomejs/biome/commit/9694e373a1d34b799fb24780ddfde8680758b8b8) Thanks [@dyc3](https://github.com/dyc3)! - Fixed bugs in the HTML parser so that it will flag invalid shorthand syntaxes instead of silently accepting them. For example, `<Foo : foo="5" />` is now invalid because there is a space after the `:`.
* [#8297](https://github.com/biomejs/biome/pull/8297) [`efa694c`](https://github.com/biomejs/biome/commit/efa694c019cbdbac5328b76bb70c464ad9befbf8) Thanks [@Yonom](https://github.com/Yonom)! - Added support for negative value utilities in [`useSortedClasses`](https://biomejs.dev/linter/rules/use-sorted-classes/). Negative value utilities such as `-ml-2` or `-top-4` are now recognized and sorted correctly alongside their positive counterparts.

  ```
  // Now detected as unsorted:

  <div class="-ml-2 p-4 -mt-1" />

  // Suggested fix:

  <div class="-mt-1 -ml-2 p-4" />
  ```
* [#8335](https://github.com/biomejs/biome/pull/8335) [`3710702`](https://github.com/biomejs/biome/commit/3710702c3c489f57f82c24311023e1ffad53172a) Thanks [@dibashthapa](https://github.com/dibashthapa)! - Added the new nursery rule [`useDestructuring`](https://biomejs.dev/linter/rules/use-destructuring). This rule helps to encourage destructuring from arrays and objects.

  For example, the following code triggers because the variable name `x` matches the property `foo.x`, making it ideal for object destructuring syntax.

  ```
  var x = foo.x;
  ```
* [#8383](https://github.com/biomejs/biome/pull/8383) [`59b2f9a`](https://github.com/biomejs/biome/commit/59b2f9a780320b5eae8a4e66e2a5fe8256d52fe6) Thanks [@ematipico](https://github.com/ematipico)! - Fixed [#7927](https://github.com/biomejs/biome/issues/7927): [`noExtraNonNullAssertion`](https://biomejs.dev/linter/rules/no-extra-non-null-assertion) incorrectly flagged separate non-null assertions on both sides of an assignment.

  The rule now correctly distinguishes between nested non-null assertions (still flagged) and separate non-null assertions on different sides of an assignment (allowed).

  #### Examples

  ##### Valid (now allowed)

  ```
  arr[0]! ^= arr[1]!;
  ```

  ##### Invalid (still flagged)

  ```
  arr[0]!! ^= arr[1];

  arr[0] ^= arr[1]!!;
  ```
* [#8401](https://github.com/biomejs/biome/pull/8401) [`382786b`](https://github.com/biomejs/biome/commit/382786b29f0c1e9524fee370ef7067de82a25e91) Thanks [@Bertie690](https://github.com/Bertie690)! - [`useExhaustiveDependencies`](https://biomejs.dev/linter/rules/use-exhaustive-dependencies) now correctly validates custom hooks whose dependency arrays come before their callbacks.

  Previously, a logical error caused the rule to be unable to detect dependency arrays placed before hook callbacks, producing spurious errors and blocking further diagnostics.

  ```
  {

  "linter": {

  "rules": {

  "correctness": {

  "useExhaustiveDependencies": {

  "level": "error",

  "options": {

  "hooks": [

  {

  "name": "doSomething",

  "closureIndex": 2,

  "dependenciesIndex": 0

  }

  ]

  }

  }

  }

  }

  }

  }
  ```

  ```
  function component() {

  let thing = 5;

  // The rule will now correctly recognize `thing` as being specified

  // instead of erroring due to "missing" dependency arrays

  doSomething([thing], "blah", () => {

  console.log(thing);

  });

  }
  ```

  The rule documentation & diagnostic messages have also been reworked for improved clarity.
* [#8365](https://github.com/biomejs/biome/pull/8365) [`8f36051`](https://github.com/biomejs/biome/commit/8f36051bc30978b2900329a18176de423db25cfe) Thanks [@JacquesLeupin](https://github.com/JacquesLeupin)! - Fixed [#8360](https://github.com/biomejs/biome/issues/8360): GritQL plugins defined in child configurations with `extends: "//"` now work correctly.
* [#8306](https://github.com/biomejs/biome/pull/8306) [`8de2774`](https://github.com/biomejs/biome/commit/8de2774fb507a10e32ecf920bb5d0f801a9e869c) Thanks [@dibashthapa](https://github.com/dibashthapa)! - Fixed [#8288](https://github.com/biomejs/biome/issues/8288): Fixed the issue with false positive errors

  This new change will ignore attribute and only show diagnostics for JSX Expressions

  For example

  Valid:

  ```
  <Something checked={isOpen && items.length} />
  ```

  Invalid:

  ```
  const Component = () => {

  return isOpen && items.length;

  };
  ```
* [#8356](https://github.com/biomejs/biome/pull/8356) [`f9673fc`](https://github.com/biomejs/biome/commit/f9673fc0816908cd686eab7a48d4e8be3f51c7c7) Thanks [@ematipico](https://github.com/ematipico)! - Fixed [#7917](https://github.com/biomejs/biome/issues/7917), where Biome removed the styles contained in a `<style lang="scss">`, when `experimentalFullSupportEnabled` is enabled.
* [#8371](https://github.com/biomejs/biome/pull/8371) [`d71924e`](https://github.com/biomejs/biome/commit/d71924e26d8c71b7216247d71547e45183d85054) Thanks [@ematipico](https://github.com/ematipico)! - Fixed [#7343](https://github.com/biomejs/biome/issues/7343), where Biome failed to resolve extended configurations from parent directories using relative paths.
* [#8404](https://github.com/biomejs/biome/pull/8404) [`6a221f9`](https://github.com/biomejs/biome/commit/6a221f98304133d80a8b328b74b203a03f68f571) Thanks [@fireairforce](https://github.com/fireairforce)! - Fixed [#7826](https://github.com/biomejs/biome/issues/7826), where a class member named `async` will not cause the parse error.
* [#8249](https://github.com/biomejs/biome/pull/8249) [`893e36c`](https://github.com/biomejs/biome/commit/893e36c7c39d210ccedfe040bb414945262b5d92) Thanks [@cormacrelf](https://github.com/cormacrelf)! - Addressed [#7538](https://github.com/biomejs/biome/issues/7538). Reduced the
  volume of logging from the LSP server.

  Use `biome clean` to remove large logs.
* [#8303](https://github.com/biomejs/biome/pull/8303) [`db2c65b`](https://github.com/biomejs/biome/commit/db2c65b7eaf057eda12434e98acf5430fe77b165) Thanks [@hirokiokada77](https://github.com/hirokiokada77)! - Fixed [#8300](https://github.com/biomejs/biome/issues/8300): [`noUnusedImports`](https://biomejs.dev/linter/rules/no-unused-imports/) now detects JSDoc tags on object properties.

  ```
  import type LinkOnObjectProperty from "mod";

  const testLinkOnObjectProperty = {

  /**

  * {@link LinkOnObjectProperty}

  */

  property: 0,

  };
  ```
* [#8328](https://github.com/biomejs/biome/pull/8328) [`9cf2332`](https://github.com/biomejs/biome/commit/9cf233275d1369bcce191146660ea92b26d6f211) Thanks [@Netail](https://github.com/Netail)! - Corrected rule source reference. `biome migrate eslint` should do a bit better detecting rules in your eslint configurations.
* [#8403](https://github.com/biomejs/biome/pull/8403) [`c96dcf2`](https://github.com/biomejs/biome/commit/c96dcf2f2824a83f8df8f86b684301184dd1344b) Thanks [@dyc3](https://github.com/dyc3)! - Fixed [#8340](https://github.com/biomejs/biome/issues/8340): `noUnknownProperty` will no longer flag anything in `@plugin` when the parser option `tailwindDirectives` is enabled
* [#8284](https://github.com/biomejs/biome/pull/8284) [`4976d1b`](https://github.com/biomejs/biome/commit/4976d1bebf81f874a0378f904e03c38fdb397702) Thanks [@denbezrukov](https://github.com/denbezrukov)! - Improved the performance of the Biome Formatter by enabling the internal source maps only when needed.
* [#8260](https://github.com/biomejs/biome/pull/8260) [`a226b28`](https://github.com/biomejs/biome/commit/a226b2862daa6e8d130bf3bfd88f6693412607e6) Thanks [@ho991217](https://github.com/ho991217)! - Fixed [biome-vscode#817](https://github.com/biomejs/biome-vscode/issues/817): Biome now updates documents when the `textDocument/didSave` notification is received.
* [#8183](https://github.com/biomejs/biome/pull/8183) [`b064786`](https://github.com/biomejs/biome/commit/b064786002ec7bd80be3a4a4b94a8f61b0aa3a47) Thanks [@hornta](https://github.com/hornta)! - Fixed [#8179](https://github.com/biomejs/biome/issues/8179): The [`useConsistentArrowReturn`](https://biomejs.dev/linter/rules/use-consistent-arrow-return/) rule now correctly handles multiline expressions in its autofix when the `style` option is set to `"always"`.

  Previously, the autofix would incorrectly place a newline after the `return` keyword, causing unexpected behavior.

  Example:

  ```
  const foo = (l) => l.split("\n");
  ```

  Now correctly autofixes to:

  ```
  const foo = (l) => {

  return

  l.split('\n');

  return l.split('\n');

  }
  ```
* [#8382](https://github.com/biomejs/biome/pull/8382) [`7409cba`](https://github.com/biomejs/biome/commit/7409cbaa9be1eed34c1279920bdd33674120f0b3) Thanks [@fireairforce](https://github.com/fireairforce)! - Fixed [#8338](https://github.com/biomejs/biome/issues/8338): Ignored the `noUnknownTypeSelector` check when the `root` selector is used under View Transition pseudo-elements.

  **Example**

  ```
  ::view-transition-old(root),

  ::view-transition-new(root) {

  z-index: 1;

  }
  ```
* [#7513](https://github.com/biomejs/biome/pull/7513) [`e039f3b`](https://github.com/biomejs/biome/commit/e039f3b17cdf4e4b7c2ae9b0b0c58a9800b5703c) Thanks [@AsherDe](https://github.com/AsherDe)! - Added the nursery rule [`noVueSetupPropsReactivityLoss`](https://biomejs.dev/linter/rules/no-vue-setup-props-reactivity-loss/).

  This new rule disallows usages that cause the reactivity of `props` passed to the `setup` function to be lost.

  Invalid code example:

  ```
  export default {

  setup({ count }) {

  // `count` is no longer reactive here.

  return () => h("div", count);

  },

  };
  ```

## [2.3.8](/internals/changelog/version/2-3-8/)

### Patch Changes

* [#8188](https://github.com/biomejs/biome/pull/8188) [`4ca088c`](https://github.com/biomejs/biome/commit/4ca088c7648f37724dad07ae4e6f805e7a51ac79) Thanks [@ematipico](https://github.com/ematipico)! - Fixed [#7390](https://github.com/biomejs/biome/issues/7390), where Biome couldn’t apply the correct configuration passed via `--config-path`.

  If you have multiple **root** configuration files, running any command with `--config-path` will now apply the chosen configuration file.
* [#8171](https://github.com/biomejs/biome/pull/8171) [`79adaea`](https://github.com/biomejs/biome/commit/79adaea7d5bc382bd0a4cdcc34e59a8cb3fb6a55) Thanks [@dibashthapa](https://github.com/dibashthapa)! - Added the new rule [`noLeakedRender`](https://biomejs.dev/linter/rules/no-leaked-render). This rule helps prevent potential leaks when rendering components that use binary expressions or ternaries.

  For example, the following code triggers the rule because the component would render `0`:

  ```
  const Component = () => {

  const count = 0;

  return <div>{count && <span>Count: {count}</span>}</div>;

  };
  ```
* [#8116](https://github.com/biomejs/biome/pull/8116) [`b537918`](https://github.com/biomejs/biome/commit/b53791835ea98edf8fe4b4288240bd38abb19f2f) Thanks [@Netail](https://github.com/Netail)! - Added the nursery rule [`noDuplicatedSpreadProps`](https://biomejs.dev/linter/rules/no-duplicated-spread-props/). Disallow JSX prop spreading the same identifier multiple times.

  **Invalid:**

  ```
  <div {...props} something="else" {...props} />
  ```
* [#8256](https://github.com/biomejs/biome/pull/8256) [`f1e4696`](https://github.com/biomejs/biome/commit/f1e4696bf8f018fc23656cd7b96fda32ca46677a) Thanks [@cormacrelf](https://github.com/cormacrelf)! - Fixed a bug where logs were discarded (the kind from `--log-level=info` etc.). This is a regression introduced after an internal refactor that wasn’t adequately tested.
* [#8226](https://github.com/biomejs/biome/pull/8226) [`3f19b52`](https://github.com/biomejs/biome/commit/3f19b520c65f4fc53e61ca7cef341deadec5f518) Thanks [@dyc3](https://github.com/dyc3)! - Fixed [#8222](https://github.com/biomejs/biome/issues/8222): The HTML parser, with Vue directives enabled, can now parse `v-slot` shorthand syntax, e.g. `<template #foo>`.
* [#8007](https://github.com/biomejs/biome/pull/8007) [`182ecdc`](https://github.com/biomejs/biome/commit/182ecdc2736a54073fe79b4d3e1eaf793b73afa6) Thanks [@brandonmcconnell](https://github.com/brandonmcconnell)! - Added support for dollar-sign-prefixed filenames in the [`useFilenamingConvention`](https://biomejs.dev/linter/rules/use-filenaming-convention/) rule.

  Biome now allows filenames starting with the dollar-sign (e.g. `$postId.tsx`) by default to support naming conventions used by frameworks such as [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/guide/routing#file-based-routing) for file-based-routing.
* [#8218](https://github.com/biomejs/biome/pull/8218) [`91484d1`](https://github.com/biomejs/biome/commit/91484d1d53096a554f288c81105f71c7ea8df945) Thanks [@hirokiokada77](https://github.com/hirokiokada77)! - Added the [`noMultiStr`](https://biomejs.dev/linter/rules/no-multi-str) rule, which disallows creating multiline strings by escaping newlines.

  **Invalid:**

  ```
  const foo =

  "Line 1\n\

  Line 2";
  ```

  **Valid:**

  ```
  const foo = "Line 1\nLine 2";

  const bar = `Line 1

  Line 2`;
  ```
* [#8225](https://github.com/biomejs/biome/pull/8225) [`98ca2ae`](https://github.com/biomejs/biome/commit/98ca2ae9f3b9b25a14d63b243223583aba6e4907) Thanks [@ongyuxing](https://github.com/ongyuxing)! - Fixed [#7806](https://github.com/biomejs/biome/issues/7806): Prefer breaking after the assignment operator for conditional types with generic parameters to match Prettier.

  ```
  type True = unknown extends Type<

  "many",

  "generic",

  "parameters",

  "one",

  "two",

  "three"

  >

  ? true

  : false;

  type True =

  unknown extends Type<"many", "generic", "parameters", "one", "two", "three">

  ? true

  : false;
  ```
* [#6765](https://github.com/biomejs/biome/pull/6765) [`23f7855`](https://github.com/biomejs/biome/commit/23f78551167e5415da17b5cca8eb2a34e64e0aac) Thanks [@emilyinure](https://github.com/emilyinure)! - Fixed [#6569](https://github.com/biomejs/biome/issues/6569): Allow files to export from themselves with `noImportCycles`.

  This means the following is now allowed:

  example.js

  ```
  export function example() {

  return 1;

  }

  // Re-exports all named exports from the current module under a single namespace

  // and then imports the namespace from the current module.

  // Allows for encapsulating functions/variables into a namespace instead

  // of using a static class.

  export * as Example from "./example.js";

  import { Example } from "./example.js";
  ```
* [#8214](https://github.com/biomejs/biome/pull/8214) [`68c052e`](https://github.com/biomejs/biome/commit/68c052efa29892470d4590bffefb20448685f2d9) Thanks [@hirokiokada77](https://github.com/hirokiokada77)! - Added the [`noEqualsToNull`](https://biomejs.dev/linter/rules/no-equals-to-null) rule, which enforces the use of `===` and `!==` for comparison with `null` instead of `==` or `!=`.

  **Invalid:**

  ```
  foo == null;

  foo != null;
  ```

  **Valid:**

  ```
  foo === null;

  foo !== null;
  ```
* [#8219](https://github.com/biomejs/biome/pull/8219) [`793bb9a`](https://github.com/biomejs/biome/commit/793bb9adf179117f6cd7796140f1da2098a4eab5) Thanks [@dyc3](https://github.com/dyc3)! - Fixed [#8190](https://github.com/biomejs/biome/issues/8190): The HTML parser will now parse Vue event handlers that contain `:` correctly, e.g. `@update:modelValue="onUpdate"`.
* [#8259](https://github.com/biomejs/biome/pull/8259) [`4a9139b`](https://github.com/biomejs/biome/commit/4a9139bbe393d7f8acc226281c7a92d0cc5887ee) Thanks [@hirokiokada77](https://github.com/hirokiokada77)! - Fixed [#8254](https://github.com/biomejs/biome/issues/8254): The `noParameterAssign` rule with `propertyAssignment: "deny"` was incorrectly reporting an error when a function parameter was used on the right-hand side of an assignment to a local variable’s property.

  The rule should only flag assignments that modify the parameter binding or its properties (L-value), not the use of its value.

  **Valid:**

  ```
  (input) => {

  const local = { property: 0 };

  local.property = input;

  };
  ```
* [#8201](https://github.com/biomejs/biome/pull/8201) [`cd2edd7`](https://github.com/biomejs/biome/commit/cd2edd75d9532171c599073fc91de5a15578e84d) Thanks [@Netail](https://github.com/Netail)! - Added the nursery rule [`noTernary`](https://biomejs.dev/linter/rules/no-ternary/). Disallow ternary operators.

  **Invalid:**

  ```
  const foo = isBar ? baz : qux;
  ```
* [#8172](https://github.com/biomejs/biome/pull/8172) [`de98933`](https://github.com/biomejs/biome/commit/de98933f77091358e70d23e51aa5a2a084953722) Thanks [@JeremyMoeglich](https://github.com/JeremyMoeglich)! - Fixed [#8145](https://github.com/biomejs/biome/issues/8145): handling of large hex literals, which previously caused both false positives and false negatives.

  This affects [`noPrecisionLoss`](https://biomejs.dev/linter/rules/no-precision-loss/) and [`noConstantMathMinMaxClamp`](https://biomejs.dev/linter/rules/no-constant-math-min-max-clamp/).
* [#8210](https://github.com/biomejs/biome/pull/8210) [`7b44e9e`](https://github.com/biomejs/biome/commit/7b44e9eec8200fdde096ebdfac493b2e48fd707e) Thanks [@Netail](https://github.com/Netail)! - Corrected rule source reference. `biome migrate eslint` should do a bit better detecting rules in your eslint configurations.
* [#8213](https://github.com/biomejs/biome/pull/8213) [`e430555`](https://github.com/biomejs/biome/commit/e43055515212a81fc3ef0477fb0ce505555ad0af) Thanks [@ruidosujeira](https://github.com/ruidosujeira)! - Fixed #8209: Recognized formatting capability when either range or on-type formatting is supported, not only full-file formatting. This ensures editors and the language server correctly detect formatting support in files like JSONC.
* [#8202](https://github.com/biomejs/biome/pull/8202) [`6f49d95`](https://github.com/biomejs/biome/commit/6f49d95f3f3330c12012064a0c6facc306f9f8bf) Thanks [@hirokiokada77](https://github.com/hirokiokada77)! - Fixed [#8079](https://github.com/biomejs/biome/issues/8079): Properly handle `name` and `value` metavariables for `JsxAttribute` GritQL queries.

  The following `biome search` command no longer throws an error:

  ```
  biome search 'JsxAttribute($name, $value) as $attr where { $name <: "style" }'
  ```
* [#8276](https://github.com/biomejs/biome/pull/8276) [`f7e836f`](https://github.com/biomejs/biome/commit/f7e836fa2b5859c712bb891dc7fbb2fcf28e19a3) Thanks [@hirokiokada77](https://github.com/hirokiokada77)! - Added the [`noProto`](https://biomejs.dev/linter/rules/no-proto/) rule, which disallows the use of the `__proto__` property for getting or setting the prototype of an object.

  **Invalid**:

  ```
  obj.__proto__ = a;

  const b = obj.__proto__;
  ```

  **Valid**:

  ```
  const a = Object.getPrototypeOf(obj);

  Object.setPrototypeOf(obj, b);
  ```

## [2.3.7](/internals/changelog/version/2-3-7/)

### Patch Changes

* [#8169](https://github.com/biomejs/biome/pull/8169) [`7fdcec8`](https://github.com/biomejs/biome/commit/7fdcec8eb4ce9f28784f823ef01bd923d2c5d1cb) Thanks [@arendjr](https://github.com/arendjr)! - Fixed [#7999](https://github.com/biomejs/biome/issues/7999): Correctly place `await` after leading comment in auto-fix action from `noFloatingPromises` rule.
* [#8157](https://github.com/biomejs/biome/pull/8157) [`12d5b42`](https://github.com/biomejs/biome/commit/12d5b422e388a3f5a906930f2cf04b6835c05258) Thanks [@Conaclos](https://github.com/Conaclos)! - Fixed [#8148](https://github.com/biomejs/biome/issues/8148). [`noInvalidUseBeforeDeclaration`](https://biomejs.dev/linter/rules/no-invalid-use-before-declaration/) no longer reports some valid use before declarations.

  The following code is no longer reported as invalid:

  ```
  class classA {

  C = C;

  }

  const C = 0;
  ```
* [#8178](https://github.com/biomejs/biome/pull/8178) [`6ba4157`](https://github.com/biomejs/biome/commit/6ba41570e088765cab5b7075f55335296a005c94) Thanks [@dyc3](https://github.com/dyc3)! - Fixed [#8174](https://github.com/biomejs/biome/issues/8174), where the HTML parser would parse 2 directives as a single directive because it would not reject whitespace in Vue directives. This would cause the formatter to erroneously merge the 2 directives into one, resulting in broken code.

  ```
  <Component v-else:property="123" />

  <Component v-else :property="123" />
  ```
* [#8088](https://github.com/biomejs/biome/pull/8088) [`0eb08e8`](https://github.com/biomejs/biome/commit/0eb08e8e34f96b5a4fd8cc67f430b614736b6d4c) Thanks [@db295](https://github.com/db295)! - Fixed [#7876](https://github.com/biomejs/biome/issues/7876): The [`noUnusedImports`](https://biomejs.dev/linter/rules/no-unused-imports/) rule now ignores imports that are used by @linkcode and @linkplain (previously supported @link and @see).

  The following code will no longer be a false positive:

  ```
  import type { a } from "a"

  /**

  * {@linkcode a}

  */

  function func() {}
  ```
* [#8119](https://github.com/biomejs/biome/pull/8119) [`8d64655`](https://github.com/biomejs/biome/commit/8d6465554ef9cd97f017102892f948593b0f26f1) Thanks [@ematipico](https://github.com/ematipico)! - Improved the detection of the rule `noUnnecessaryConditions`. Now the rule isn’t triggered for variables that are mutated inside a module.

  This logic deviates from the original rule, hence `noUnnecessaryConditions` is now marked as “inspired”.

  In the following example, `hey` starts as `false`, but then it’s assigned to a string. The rule isn’t triggered inside the `if` check.

  ```
  let hey = false;

  function test() {

  hey = "string";

  }

  if (hey) {

  }
  ```
* [#8149](https://github.com/biomejs/biome/pull/8149) [`e0a02bf`](https://github.com/biomejs/biome/commit/e0a02bf2cda1b7d32a1ce756d2c8b7883a320488) Thanks [@Netail](https://github.com/Netail)! - Fixed [#8144](https://github.com/biomejs/biome/issues/8144): Improve [`noSyncScripts`](https://biomejs.dev/linter/rules/no-sync-scripts), ignore script tags with `type="module"` as these are always non-blocking.
* [#8182](https://github.com/biomejs/biome/pull/8182) [`e9f068e`](https://github.com/biomejs/biome/commit/e9f068ece0db13fc37d19d1db7e43d7643b9209f) Thanks [@hirokiokada77](https://github.com/hirokiokada77)! - Fixed [#7877](https://github.com/biomejs/biome/issues/7877): Range suppressions now handle suppressed categories properly.

  **Valid:**

  ```
  // biome-ignore-start lint: explanation

  const foo = 1;

  // biome-ignore-end lint: explanation
  ```
* [#8111](https://github.com/biomejs/biome/pull/8111) [`bf1a836`](https://github.com/biomejs/biome/commit/bf1a8364a7191b8180c4dc3e61f1287e1058e1ec) Thanks [@ryan-m-walker](https://github.com/ryan-m-walker)! - Added support for parsing and formatting the [CSS if function](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/if).

  ***Example***

  ```
  .basic-style {

  color: if(style(--scheme: dark): #eeeeee; else: #000000;);

  }
  ```
* [#8173](https://github.com/biomejs/biome/pull/8173) [`7fc07c1`](https://github.com/biomejs/biome/commit/7fc07c12abe755cb813b188f5c821d356c2c67c9) Thanks [@ematipico](https://github.com/ematipico)! - Fixed [#8138](https://github.com/biomejs/biome/issues/8138) by reverting an internal refactor that caused a regression to the rule `noUnusedPrivateClassMembers`.
* [#8119](https://github.com/biomejs/biome/pull/8119) [`8d64655`](https://github.com/biomejs/biome/commit/8d6465554ef9cd97f017102892f948593b0f26f1) Thanks [@ematipico](https://github.com/ematipico)! - Improved the type inference engine, by resolving types for variables that are assigned to multiple values.
* [#8158](https://github.com/biomejs/biome/pull/8158) [`fb1458b`](https://github.com/biomejs/biome/commit/fb1458b33c1e871ae129e14cf23d76391129eb8d) Thanks [@dyc3](https://github.com/dyc3)! - Added the `useVueValidVText` lint rule to enforce valid `v-text` directives. The rule reports when `v-text` has an argument, has modifiers, or is missing a value.

  Invalid:

  ```
  <div v-text />

  <!-- missing value -->

  <div v-text:aaa="foo" />

  <!-- has argument -->

  <div v-text.bbb="foo" />

  <!-- has modifier -->
  ```
* [#8158](https://github.com/biomejs/biome/pull/8158) [`fb1458b`](https://github.com/biomejs/biome/commit/fb1458b33c1e871ae129e14cf23d76391129eb8d) Thanks [@dyc3](https://github.com/dyc3)! - Fixed `useVueValidVHtml` so that it will now flag empty strings, e.g. `v-html=""`
* [#7078](https://github.com/biomejs/biome/pull/7078) [`bb7a15c`](https://github.com/biomejs/biome/commit/bb7a15c3d8fba790ef6f32f070dff1d719c18c33) Thanks [@emilyinure](https://github.com/emilyinure)! - Fixed [#6675](https://github.com/biomejs/biome/issues/6675): Now only flags
  noAccumulatingSpread on Object.assign when a new object is being allocated on
  each iteration. Before, all cases using Object.assign with reduce parameters
  were warned despite not making new allocations.

  The following code will no longer be a false positive:

  ```
  foo.reduce((acc, bar) => Object.assign(acc, bar), {});
  ```

  The following cases which **do** make new allocations will continue to warn:

  ```
  foo.reduce((acc, bar) => Object.assign({}, acc, bar), {});
  ```
* [#8175](https://github.com/biomejs/biome/pull/8175) [`0c8349e`](https://github.com/biomejs/biome/commit/0c8349e6869a5bc8fafdbf23f95dcee5b56c738e) Thanks [@ryan-m-walker](https://github.com/ryan-m-walker)! - Fixed CSS formatting of dimension units to use correct casing for `Q`, `Hz` and `kHz`.

  **Before:**

  ```
  .cssUnits {

  a: 1Q;

  b: 1Hz;

  c: 1kHz;

  }
  ```

  **After:**

  ```
  .cssUnits {

  a: 1Q;

  b: 1Hz;

  c: 1kHz;

  }
  ```

## [2.3.6](/internals/changelog/version/2-3-6/)

### Patch Changes

* [#8100](https://github.com/biomejs/biome/pull/8100) [`82b9a8e`](https://github.com/biomejs/biome/commit/82b9a8eb3ddeb396c9c4615fb316bdd1eb3c7a49) Thanks [@Netail](https://github.com/Netail)! - Added the nursery rule [`useFind`](https://biomejs.dev/linter/rules/use-find/). Enforce the use of Array.prototype.find() over Array.prototype.filter() followed by [0] when looking for a single result.

  **Invalid:**

  ```
  [1, 2, 3].filter((x) => x > 1)[0];

  [1, 2, 3].filter((x) => x > 1).at(0);
  ```
* [#8118](https://github.com/biomejs/biome/pull/8118) [`dbc7021`](https://github.com/biomejs/biome/commit/dbc7021016e2314344893b371de1a43f13c0c03b) Thanks [@hirokiokada77](https://github.com/hirokiokada77)! - Fixed [#8117](https://github.com/biomejs/biome/issues/8117): [`useValidLang`](https://biomejs.dev/linter/rules/use-valid-lang/) now accepts valid [BCP 47 language tags](https://developer.mozilla.org/en-US/docs/Glossary/BCP_47_language_tag) with script subtags.

  **Valid:**

  ```
  <html lang="zh-Hans-CN"></html>
  ```
* [#7672](https://github.com/biomejs/biome/pull/7672) [`f1d5725`](https://github.com/biomejs/biome/commit/f1d5725d0660ffb1e29c3694cd100b1c37bf50d5) Thanks [@Netail](https://github.com/Netail)! - Added the nursery rule [`useConsistentGraphqlDescriptions`](https://biomejs.dev/linter/rules/use-consistent-graphql-descriptions/), requiring all descriptions to follow the same style (either block or inline) inside GraphQL files.

  **Invalid:**

  ```
  enum EnumValue {

  "this is a description"

  DEFAULT

  }
  ```

  **Valid:**

  ```
  enum EnumValue {

  """

  this is a description

  """

  DEFAULT

  }
  ```
* [#8026](https://github.com/biomejs/biome/pull/8026) [`f102661`](https://github.com/biomejs/biome/commit/f10266193d9fd0bdb51eda3001b4068defb78a66) Thanks [@matanshavit](https://github.com/matanshavit)! - Fixed [#8004](https://github.com/biomejs/biome/issues/8004): [`noParametersOnlyUsedInRecursion`](https://biomejs.dev/linter/rules/no-parameters-only-used-in-recursion/) now correctly detects recursion by comparing function bindings instead of just names.

  Previously, the rule incorrectly flagged parameters when a method had the same name as an outer function but called the outer function (not itself):

  ```
  function notRecursive(arg) {

  return arg;

  }

  const obj = {

  notRecursive(arg) {

  return notRecursive(arg); // This calls the outer function, not the method itself

  },

  };
  ```

  Biome now properly distinguishes between these cases and will not report false positives.
* [#8097](https://github.com/biomejs/biome/pull/8097) [`5fc5416`](https://github.com/biomejs/biome/commit/5fc5416ae1a64dfae977241eb3f30601999039b7) Thanks [@dyc3](https://github.com/dyc3)! - Added the nursery rule [`noVueVIfWithVFor`](https://biomejs.dev/linter/rules/no-vue-v-if-with-v-for/). This rule disallows `v-for` and `v-if` on the same element.

  ```
  <!-- Invalid -->

  <div v-for="item in items" v-if="item.isActive">

  {{ item.name }}

  </div>
  ```
* [#8085](https://github.com/biomejs/biome/pull/8085) [`7983940`](https://github.com/biomejs/biome/commit/798394072bc757443501224b22f943d5e052220b) Thanks [@Netail](https://github.com/Netail)! - Added the nursery rule [`noForIn`](https://biomejs.dev/linter/rules/no-for-in/). Disallow iterating using a for-in loop.

  **Invalid:**

  ```
  for (const i in array) {

  console.log(i, array[i]);

  }
  ```
* [#8086](https://github.com/biomejs/biome/pull/8086) [`2b41e82`](https://github.com/biomejs/biome/commit/2b41e82de4f2735446599b2f73353ecd8382438f) Thanks [@matanshavit](https://github.com/matanshavit)! - Fixed [#8045](https://github.com/biomejs/biome/issues/8045): The [`noNestedTernary`](https://biomejs.dev/linter/rules/no-nested-ternary/) rule now correctly detects nested ternary expressions even when they are wrapped in parentheses (e.g. `foo ? (bar ? 1 : 2) : 3`).

  Previously, the rule would not flag nested ternaries like `foo ? (bar ? 1 : 2) : 3` because the parentheses prevented detection. The rule now looks through parentheses to identify nested conditionals.

  **Previously not detected (now flagged):**

  ```
  const result = foo ? (bar ? 1 : 2) : 3;
  ```

  **Still valid (non-nested with parentheses):**

  ```
  const result = foo ? bar : baz;
  ```
* [#8075](https://github.com/biomejs/biome/pull/8075) [`e403868`](https://github.com/biomejs/biome/commit/e403868e2231b4e4e956ff3d9443c7e55adab247) Thanks [@YTomm](https://github.com/YTomm)! - Fixed [#7948](https://github.com/biomejs/biome/issues/7948): The `useReadonlyClassProperties` code fix when `checkAllProperties` is enabled will no longer insert a newline after `readonly` and the class property.
* [#8102](https://github.com/biomejs/biome/pull/8102) [`47d940e`](https://github.com/biomejs/biome/commit/47d940e30c78fff2519c72a0c51f6cd0633a7d2b) Thanks [@lucasweng](https://github.com/lucasweng)! - Fixed [#8027](https://github.com/biomejs/biome/issues/8027). [`useReactFunctionComponents`](https://biomejs.dev/linter/rules/use-react-function-components/) no longer reports class components that implement `componentDidCatch` using class expressions.

  The rule now correctly recognizes error boundaries defined as class expressions:

  ```
  const ErrorBoundary = class extends Component {

  componentDidCatch(error, info) {}

  render() {

  return this.props.children;

  }

  };
  ```
* [#8097](https://github.com/biomejs/biome/pull/8097) [`5fc5416`](https://github.com/biomejs/biome/commit/5fc5416ae1a64dfae977241eb3f30601999039b7) Thanks [@dyc3](https://github.com/dyc3)! - Added the nursery rule [`useVueHyphenatedAttributes`](https://biomejs.dev/linter/rules/use-vue-hyphenated-attributes/), which encourages using kebab case for attribute names, per the Vue style guide’s recommendations.

  ```
  <!-- Invalid -->

  <MyComponent myProp="value" />

  <!-- Valid -->

  <MyComponent my-prop="value" />
  ```
* [#8108](https://github.com/biomejs/biome/pull/8108) [`0f0a658`](https://github.com/biomejs/biome/commit/0f0a65884b615109a1282e88f18efbaca3d223b0) Thanks [@Netail](https://github.com/Netail)! - Added the nursery rule [`noSyncScripts`](https://biomejs.dev/linter/rules/no-sync-scripts/). Prevent the usage of synchronous scripts.

  **Invalid:**

  ```
  <script src="https://third-party-script.js" />
  ```

  **Valid:**

  ```
  <script src="https://third-party-script.js" async />

  <script src="https://third-party-script.js" defer />
  ```
* [#8098](https://github.com/biomejs/biome/pull/8098) [`1fdcaf0`](https://github.com/biomejs/biome/commit/1fdcaf0336a92cde9becbf8cba502ac0091b2b1d) Thanks [@Jayllyz](https://github.com/Jayllyz)! - Added documentation URLs to rule descriptions in the JSON schema.
* [#8097](https://github.com/biomejs/biome/pull/8097) [`5fc5416`](https://github.com/biomejs/biome/commit/5fc5416ae1a64dfae977241eb3f30601999039b7) Thanks [@dyc3](https://github.com/dyc3)! - Fixed an issue with the HTML parser where it would treat Vue directives with dynamic arguments as static arguments instead.
* [#7684](https://github.com/biomejs/biome/pull/7684) [`f4433b3`](https://github.com/biomejs/biome/commit/f4433b34e3ad9686bdde08727453e3caf0409412) Thanks [@vladimir-ivanov](https://github.com/vladimir-ivanov)! - Changed [`noUnusedPrivateClassMembers`](https://biomejs.dev/linter/rules/no-unused-private-class-members/) to align more fully with meaningful reads.

  This rule now distinguishes more carefully between writes and reads of private class members.

  + A *meaningful read* is any access that affects program behavior.
  + For example, `this.#x += 1` both reads and writes `#x`, so it counts as usage.
  + Pure writes without a read (e.g. `this.#x = 1` with no getter) are no longer treated as usage.

  This change ensures that private members are only considered “used” when they are actually read in a way that influences execution.

  ***Invalid examples (previously valid)***

  ```
  class UsedMember {

  set #x(value) {

  doSomething(value);

  }

  foo() {

  // This assignment does not actually read #x, because there is no getter.

  // Previously, this was considered a usage, but now it’s correctly flagged.

  this.#x = 1;

  }

  }
  ```

  ***Valid example (Previously invalid)***

  ```
  class Foo {

  #usedOnlyInWriteStatement = 5;

  method() {

  // This counts as a meaningful read because we both read and write the value.

  this.#usedOnlyInWriteStatement += 42;

  }

  }
  ```
* [#7684](https://github.com/biomejs/biome/pull/7684) [`f4433b3`](https://github.com/biomejs/biome/commit/f4433b34e3ad9686bdde08727453e3caf0409412) Thanks [@vladimir-ivanov](https://github.com/vladimir-ivanov)! - **Improved detection of used private class members**

  The analysis for private class members has been improved: now the tool only considers a private member “used” if it is actually referenced in the code.

  + Previously, some private members might have been reported as used even if they weren’t actually accessed.
  + With this change, only members that are truly read or called in the code are counted as used.
  + Members that are never accessed will now be correctly reported as unused.

  This makes reports about unused private members more accurate and helps you clean up truly unused code.

  ***Example (previously valid)***

  ```
  type YesNo = "yes" | "no";

  export class SampleYesNo {

  private yes: () => void;

  private no: () => void;

  private dontKnow: () => void; // <- will now report as unused

  on(action: YesNo): void {

  this[action]();

  }

  }
  ```
* [#7681](https://github.com/biomejs/biome/pull/7681) [`b406db6`](https://github.com/biomejs/biome/commit/b406db667f2dddd177f7c45ecc9e98a83b796a0a) Thanks [@kedevked](https://github.com/kedevked)! - Added the new lint rule, [`useSpread`](https://biomejs.dev/linter/rules/use-spread/), ported from the ESLint rule [`prefer-spread`](https://eslint.org/docs/latest/rules/prefer-spread).

  This rule enforces the use of the **spread syntax** (`...`) over `Function.prototype.apply()` when calling variadic functions, as spread syntax is generally more concise and idiomatic in modern JavaScript (ES2015+).

  The rule provides a safe fix.

  #### Invalid

  ```
  Math.max.apply(Math, args);

  foo.apply(undefined, args);

  obj.method.apply(obj, args);
  ```

  #### Valid

  ```
  Math.max(...args);

  foo(...args);

  obj.method(...args);

  // Allowed: cases where the `this` binding is intentionally changed

  foo.apply(otherObj, args);
  ```
* [#7287](https://github.com/biomejs/biome/pull/7287) [`aa55c8d`](https://github.com/biomejs/biome/commit/aa55c8d57231e21a1b00318c0a226335ddda4792) Thanks [@ToBinio](https://github.com/ToBinio)! - Fixed [#7205](https://github.com/biomejs/biome/issues/7205): The [`noDuplicateTestHooks`](https://biomejs.dev/linter/rules/no-duplicate-test-hooks/) rule now treats chained describe variants (e.g., describe.each/for/todo) as proper describe scopes, eliminating false positives.

  The following code will no longer be a false positive:

  ```
  describe("foo", () => {

  describe.for([])("baz", () => {

  beforeEach(() => {});

  });

  describe.todo("qux", () => {

  beforeEach(() => {});

  });

  describe.todo.each([])("baz", () => {

  beforeEach(() => {});

  });

  });
  ```
* [#8013](https://github.com/biomejs/biome/pull/8013) [`0c0edd4`](https://github.com/biomejs/biome/commit/0c0edd4311610a5e064f99e13824d0b4c5a9f873) Thanks [@Jayllyz](https://github.com/Jayllyz)! - Added the GraphQL nursery rule [`useUniqueGraphqlOperationName`](https://biomejs.dev/linter/rules/use-unique-graphql-operation-name). This rule ensures that all GraphQL operations within a document have unique names.

  **Invalid:**

  ```
  query user {

  user {

  id

  }

  }

  query user {

  user {

  id

  email

  }

  }
  ```

  **Valid:**

  ```
  query user {

  user {

  id

  }

  }

  query userWithEmail {

  user {

  id

  email

  }

  }
  ```
* [#8084](https://github.com/biomejs/biome/pull/8084) [`c2983f9`](https://github.com/biomejs/biome/commit/c2983f9776d23045c7ea7a092e5eb71d18abf2e0) Thanks [@dyc3](https://github.com/dyc3)! - Fixed [#8080](https://github.com/biomejs/biome/issues/8080): The HTML parser, when parsing Vue, can now properly handle Vue directives with no argument, modifiers, or initializer (e.g. `v-else`). It will no longer treat subsequent valid attributes as bogus.

  ```
  <p v-else class="flex">World</p>

  <!-- Fixed: class now gets parsed as it's own attribute -->
  ```
* [#8104](https://github.com/biomejs/biome/pull/8104) [`041196b`](https://github.com/biomejs/biome/commit/041196bc2a1d62f2cde758884e85d180491ff2da) Thanks [@Conaclos](https://github.com/Conaclos)! - Fixed [`noInvalidUseBeforeDeclaration`](https://biomejs.dev/linter/rules/no-invalid-use-before-declaration/).
  The rule no longer reports a use of an ambient variable before its declarations.
  The rule also completely ignores TypeScript declaration files.
  The following code is no longer reported as invalid:

  ```
  CONSTANT;

  declare const CONSTANT: number;
  ```
* [#8060](https://github.com/biomejs/biome/pull/8060) [`ba7b076`](https://github.com/biomejs/biome/commit/ba7b0765894522a3436f00df9355255f8678f9d6) Thanks [@dyc3](https://github.com/dyc3)! - Added the nursery rule [`useVueValidVBind`](https://biomejs.dev/linter/rules/use-vue-valid-v-bind/), which enforces the validity of `v-bind` directives in Vue files.

  Invalid `v-bind` usages include:

  ```
  <Foo v-bind />

  <!-- Missing argument -->

  <Foo v-bind:foo />

  <!-- Missing value -->

  <Foo v-bind:foo.bar="baz" />

  <!-- Invalid modifier -->
  ```
* [#8113](https://github.com/biomejs/biome/pull/8113) [`fb8e3e7`](https://github.com/biomejs/biome/commit/fb8e3e76776b891f037edf308179fc64e4865a4d) Thanks [@Conaclos](https://github.com/Conaclos)! - Fixed [`noInvalidUseBeforeDeclaration`](https://biomejs.dev/linter/rules/no-invalid-use-before-declaration/).
  The rule now reports invalid use of classes, enums, and TypeScript’s import-equals before their declarations.

  The following code is now reported as invalid:

  ```
  new C();

  class C {}
  ```
* [#8077](https://github.com/biomejs/biome/pull/8077) [`0170dcb`](https://github.com/biomejs/biome/commit/0170dcb1f1aa99ae80c042ab38c94ed4bdcdc936) Thanks [@dyc3](https://github.com/dyc3)! - Added the rule [`useVueValidVElseIf`](https://biomejs.dev/linter/rules/use-vue-valid-v-else-if/) to enforce valid `v-else-if` directives in Vue templates. This rule reports invalid `v-else-if` directives with missing conditional expressions or when not preceded by a `v-if` or `v-else-if` directive.
* [#8077](https://github.com/biomejs/biome/pull/8077) [`0170dcb`](https://github.com/biomejs/biome/commit/0170dcb1f1aa99ae80c042ab38c94ed4bdcdc936) Thanks [@dyc3](https://github.com/dyc3)! - Added the rule [`useVueValidVElse`](https://biomejs.dev/linter/rules/use-vue-valid-v-else/) to enforce valid `v-else` directives in Vue templates. This rule reports `v-else` directives that are not preceded by a `v-if` or `v-else-if` directive.
* [#8077](https://github.com/biomejs/biome/pull/8077) [`0170dcb`](https://github.com/biomejs/biome/commit/0170dcb1f1aa99ae80c042ab38c94ed4bdcdc936) Thanks [@dyc3](https://github.com/dyc3)! - Added the rule [`useVueValidVHtml`](https://biomejs.dev/linter/rules/use-vue-valid-v-html/) to enforce valid usage of the `v-html` directive in Vue templates. This rule reports `v-html` directives with missing expressions, unexpected arguments, or unexpected modifiers.
* [#8077](https://github.com/biomejs/biome/pull/8077) [`0170dcb`](https://github.com/biomejs/biome/commit/0170dcb1f1aa99ae80c042ab38c94ed4bdcdc936) Thanks [@dyc3](https://github.com/dyc3)! - Added the rule [`useVueValidVIf`](https://biomejs.dev/linter/rules/use-vue-valid-v-if/) to enforce valid `v-if` directives in Vue templates. It disallows arguments and modifiers, and ensures a value is provided.
* [#8077](https://github.com/biomejs/biome/pull/8077) [`0170dcb`](https://github.com/biomejs/biome/commit/0170dcb1f1aa99ae80c042ab38c94ed4bdcdc936) Thanks [@dyc3](https://github.com/dyc3)! - Added the rule [`useVueValidVOn`](https://biomejs.dev/linter/rules/use-vue-valid-v-on/) to enforce valid `v-on` directives in Vue templates. This rule reports invalid `v-on` / shorthand `@` directives with missing event names, invalid modifiers, or missing handler expressions.

## [2.3.5](/internals/changelog/version/2-3-5/)

### Patch Changes

* [#8023](https://github.com/biomejs/biome/pull/8023) [`96f3e77`](https://github.com/biomejs/biome/commit/96f3e778a38aa5f48e67eb44b545cba6330dc192) Thanks [@ematipico](https://github.com/ematipico)! - Added support Svelte syntax `{@html}`. Biome now is able to parse and format the Svelte syntax [`{@html}`](https://svelte.dev/docs/svelte/@html):

  ```
  {@html   'div'}

  {@html 'div'}
  ```

  The contents of the expressions inside the `{@html <expression>}` aren’t formatted yet.
* [#8058](https://github.com/biomejs/biome/pull/8058) [`5f68bcc`](https://github.com/biomejs/biome/commit/5f68bcc9ae9208366bf5aed932b3ae3082ba21b1) Thanks [@ematipico](https://github.com/ematipico)! - Fixed a bug where the Biome Language Server would enable its project file watcher even when no project rules were enabled.

  Now the watching of nested configuration files and nested ignore files is delegated to the editor, if their LSP spec supports it.
* [#8023](https://github.com/biomejs/biome/pull/8023) [`96f3e77`](https://github.com/biomejs/biome/commit/96f3e778a38aa5f48e67eb44b545cba6330dc192) Thanks [@ematipico](https://github.com/ematipico)! - Added support Svelte syntax `{@render}`. Biome now is able to parse and format the Svelte syntax [`{@render}`](https://svelte.dev/docs/svelte/@render):

  ```
  {@render   sum(1, 2)   }

  {@render sum(1, 2)}
  ```

  The contents of the expressions inside the `{@render <expression>}` aren’t formatted yet.
* [#8006](https://github.com/biomejs/biome/pull/8006) [`f0612a5`](https://github.com/biomejs/biome/commit/f0612a511449944cacfe01f6884ca52b4f50e768) Thanks [@Bertie690](https://github.com/Bertie690)! - Updated documentation and diagnostic for `lint/complexity/noBannedTypes`. The rule should have a more detailed description and diagnostic error message.
* [#8039](https://github.com/biomejs/biome/pull/8039) [`da70d8b`](https://github.com/biomejs/biome/commit/da70d8be5d8288397a60cdea52d2a6e5f976cace) Thanks [@PFiS1737](https://github.com/PFiS1737)! - Biome now keeps a blank line after the frontmatter section in Astro files.
* [#8042](https://github.com/biomejs/biome/pull/8042) [`b7efa6f`](https://github.com/biomejs/biome/commit/b7efa6f783adc42864b15b7ff2cb2ed6803190e2) Thanks [@dyc3](https://github.com/dyc3)! - The CSS Parser, with `tailwindDirectives` enabled, will now accept at rules like `@media` and `@supports` in `@custom-variant` shorthand syntax.
* [#8064](https://github.com/biomejs/biome/pull/8064) [`3ff9d45`](https://github.com/biomejs/biome/commit/3ff9d45df031b811333d40fe62b1b24a3c5d5f43) Thanks [@dibashthapa](https://github.com/dibashthapa)! - Fixed [#7967](https://github.com/biomejs/biome/issues/7967): Fixed the issue with support for advanced SVG props
* [#8023](https://github.com/biomejs/biome/pull/8023) [`96f3e77`](https://github.com/biomejs/biome/commit/96f3e778a38aa5f48e67eb44b545cba6330dc192) Thanks [@ematipico](https://github.com/ematipico)! - Added support Svelte syntax `{@attach}`. Biome now is able to parse and format the Svelte syntax [`{@attach}`](https://svelte.dev/docs/svelte/@attach):

  ```
  <div {@attach    myAttachment   }>...</div>

  <div {@attach myAttachment}>...</div>
  ```

  The contents of the expressions inside the `{@attach <expression>}` aren’t formatted yet.
* [#8001](https://github.com/biomejs/biome/pull/8001) [`6e8a50e`](https://github.com/biomejs/biome/commit/6e8a50e720135012832e04728d6c0e38b8bb74a1) Thanks [@ematipico](https://github.com/ematipico)! - Added support Svelte syntax `{#key}`. Biome now is able to parse and format the Svelte syntax [`{#key}`](https://svelte.dev/docs/svelte/key):

  ```
  {#key   expression} <div></div> {/key}

  {#key expression}

  <div></div>

  {/key}
  ```

  The contents of the expressions inside the `{#key <expression>}` aren’t formatted yet.
* [#8023](https://github.com/biomejs/biome/pull/8023) [`96f3e77`](https://github.com/biomejs/biome/commit/96f3e778a38aa5f48e67eb44b545cba6330dc192) Thanks [@ematipico](https://github.com/ematipico)! - Added support Svelte syntax `{@const}`. Biome now is able to parse and format the Svelte syntax [`{@const}`](https://svelte.dev/docs/svelte/@const):

  ```
  {@const   name = value}

  {@const name = value}
  ```

  The contents of the expressions inside the `{@const <expression>}` aren’t formatted yet.
* [#8044](https://github.com/biomejs/biome/pull/8044) [`8f77d4a`](https://github.com/biomejs/biome/commit/8f77d4a33ceb2c85867b09c0ffe589d1e66c8db7) Thanks [@Netail](https://github.com/Netail)! - Corrected rule source references. `biome migrate eslint` should do a bit better detecting rules in your eslint configurations.
* [#8065](https://github.com/biomejs/biome/pull/8065) [`1a2d1af`](https://github.com/biomejs/biome/commit/1a2d1af3604f36703da298017fd3cacf14e118a5) Thanks [@Netail](https://github.com/Netail)! - Added the nursery rule [`useArraySortCompare`](https://biomejs.dev/linter/rules/use-array-sort-compare/). Require Array#sort and Array#toSorted calls to always provide a compareFunction.

  **Invalid:**

  ```
  const array = [];

  array.sort();
  ```

  **Valid:**

  ```
  const array = [];

  array.sort((a, b) => a - b);
  ```
* [#7673](https://github.com/biomejs/biome/pull/7673) [`a3a713d`](https://github.com/biomejs/biome/commit/a3a713d5760821d58e065280d54e9826d18be7c3) Thanks [@dyc3](https://github.com/dyc3)! - The HTML parser is now able to parse vue directives. This enables us to write/port Vue lint rules that require inspecting the `<template>` section. However, this more complex parsing may result in parsing errors where there was none before. For those of you that have opted in to the experimental support (aka `experimentalFullSupportEnabled`), we greatly appreciate your help testing this out, and your bug reports.
* [#8031](https://github.com/biomejs/biome/pull/8031) [`fa6798a`](https://github.com/biomejs/biome/commit/fa6798a62a2c13464bdb3eb61dfe6fd5e61c320e) Thanks [@ematipico](https://github.com/ematipico)! - Added support for the Svelte syntax `{#if}{/if}`. The Biome HTML parser is now able to parse and format the [`{#if}{/if} blocks`](https://svelte.dev/docs/svelte/if):

  ```
  <!-- if / else-if / else -->

  {#if porridge.temperature > 100}

  <p>too hot!</p>

  <p>too hot!</p>

  {:else if 80 > porridge.temperature}

  <p>too cold!</p>

  <p>too cold!</p>

  {:else if 100 > porridge.temperature}

  <p>too too cold!</p>

  <p>too too cold!</p>

  {:else}

  <p>just right!</p>

  <p>just right!</p>

  {/if}
  ```
* [#8041](https://github.com/biomejs/biome/pull/8041) [`beeb7bb`](https://github.com/biomejs/biome/commit/beeb7bba7cce26e932b2b4047566c4762990caf3) Thanks [@dyc3](https://github.com/dyc3)! - The CSS parser, with `tailwindDirectives` enabled, will now accept lists of selectors in `@custom-variant` shorthand syntax.

  ```
  @custom-variant cell (th:has(&), td:has(&));
  ```
* [#8028](https://github.com/biomejs/biome/pull/8028) [`c09e45c`](https://github.com/biomejs/biome/commit/c09e45c8670c9be0305f76cd4e443a4760daedec) Thanks [@fmajestic](https://github.com/fmajestic)! - The GitLab reporter now outputs format errors.
* [#8037](https://github.com/biomejs/biome/pull/8037) [`78011b1`](https://github.com/biomejs/biome/commit/78011b16f9b698f65413b934df1672970505e640) Thanks [@PFiS1737](https://github.com/PFiS1737)! - `indentScriptAndStyle` no longer indents the frontmatter in Astro files.
* [#8009](https://github.com/biomejs/biome/pull/8009) [`6374b1f`](https://github.com/biomejs/biome/commit/6374b1f6da778a132adefa17e37e9857bba7091c) Thanks [@tmcw](https://github.com/tmcw)! - Fixed an edge case in the [`useArrowFunction`](https://biomejs.dev/linter/rules/use-arrow-function/) rule.

  The rule no longer emits diagnostics for or offers to fix functions that reference
  the [arguments object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments),
  because that object is undefined for arrow functions.

  **Valid example:**

  ```
  // Valid: this function cannot be transformed into an arrow function because

  // arguments is not defined for arrow functions.

  const getFirstArg = function () {

  return arguments[0];

  };
  ```

## [2.3.4](/internals/changelog/version/2-3-4/)

### Patch Changes

* [#7989](https://github.com/biomejs/biome/pull/7989) [`4855c4a`](https://github.com/biomejs/biome/commit/4855c4a5c28d8381dd724449d43a9a60a860edaa) Thanks [@alissonlauffer](https://github.com/alissonlauffer)! - Fixed a regression in Astro frontmatter parsing where comments inside quoted strings were incorrectly detected as actual comments. This caused the parser to prematurely terminate frontmatter parsing when encountering strings like `const test = "//";`.
  For example, the following Astro frontmatter now parses correctly:

  ```
  ---

  const test = "// not a real comment";

  ---
  ```
* [#7968](https://github.com/biomejs/biome/pull/7968) [`0b28f5f`](https://github.com/biomejs/biome/commit/0b28f5f47aa968bd2511224679ae1cfbcf708fd7) Thanks [@denbezrukov](https://github.com/denbezrukov)! - Refactored formatter to use strict `Token` element for better performance. The new `Token` variant is optimized for static, ASCII-only text (keywords, operators, punctuation) with the following constraints:

  + ASCII only (no Unicode characters)
  + No newlines (`\n`, `\r`)
  + No tab characters (`\t`)

  This enables faster printing and fitting logic by using bulk string operations (`push_str`, `len()`) instead of character-by-character iteration with Unicode width calculations.
* [#7941](https://github.com/biomejs/biome/pull/7941) [`19b8280`](https://github.com/biomejs/biome/commit/19b82805e013d5befc644f85f272df19ed1264ae) Thanks [@Conaclos](https://github.com/Conaclos)! - Fixed [#7943](https://github.com/biomejs/biome/issues/7943). Rules’ `options` are now properly merged with the inherited `options` from a shared configuration.

  This means that you can now override a specific option from a rule without resetting the other options to their default.

  Given the following shared configuration:

  ```
  {

  "linter": {

  "rules": {

  "style": {

  "useNamingConvention": {

  "level": "on",

  "options": {

  "strictCase": false,

  "conventions": [

  {

  "selector": { "kind": "variable", "scope": "global" },

  "formats": ["CONSTANT_CASE"]

  }

  ]

  }

  }

  }

  }

  }

  }
  ```

  And the user configuration that extends this shared configuration:

  ```
  {

  "extends": ["shared.json"],

  "linter": {

  "rules": {

  "style": {

  "useNamingConvention": {

  "level": "on",

  "options": { "strictCase": true }

  }

  }

  }

  }

  }
  ```

  The obtained merged configuration is now as follows:

  ```
  {

  "extends": ["shared.json"],

  "linter": {

  "rules": {

  "style": {

  "useNamingConvention": {

  "level": "on",

  "options": {

  "strictCase": true,

  "conventions": [

  {

  "selector": { "kind": "variable", "scope": "global" },

  "formats": ["CONSTANT_CASE"]

  }

  ]

  }

  }

  }

  }

  }

  }
  ```
* [#7969](https://github.com/biomejs/biome/pull/7969) [`425963d`](https://github.com/biomejs/biome/commit/425963d636620d852547322f3f029df2ca05318c) Thanks [@ematipico](https://github.com/ematipico)! - Added support for the Svelte syntax `{@debug}`. The Biome HTML parser is now able to parse and format the blocks:

  ```
  {@debug     foo,bar,    something}

  {@debug foo, bar, something}
  ```
* [#7986](https://github.com/biomejs/biome/pull/7986) [`3256f82`](https://github.com/biomejs/biome/commit/3256f824a15dedf6ac23485cdef2bbc92bfc7fd9) Thanks [@lisiur](https://github.com/lisiur)! - Fixed [#7981](https://github.com/biomejs/biome/issues/7981). Now Biome correctly detects and parses `lang='tsx'` and `lang='jsx'` languages when used inside in `.vue` files, when `.experimentalFullSupportEnabled` is enabled.
* [#7921](https://github.com/biomejs/biome/pull/7921) [`547c2da`](https://github.com/biomejs/biome/commit/547c2da02590832d4941f017541142c17d1734a9) Thanks [@dyc3](https://github.com/dyc3)! - Fixed [#7854](https://github.com/biomejs/biome/issues/7854): The CSS parser, with `tailwindDirectives` enabled, will now parse `@source inline("underline");`.
* [#7856](https://github.com/biomejs/biome/pull/7856) [`c9e20c3`](https://github.com/biomejs/biome/commit/c9e20c3780b328ff59b63fa8917938d97b090148) Thanks [@Netail](https://github.com/Netail)! - Added the nursery rule [`noContinue`](https://biomejs.dev/linter/rules/no-continue/). Disallowing the usage of the `continue` statement, structured control flow statements such as `if` should be used instead.

  **Invalid:**

  ```
  let sum = 0,

  i;

  for (i = 0; i < 10; i++) {

  if (i >= 5) {

  continue;

  }

  sum += i;

  }
  ```

  **Valid:**

  ```
  let sum = 0,

  i;

  for (i = 0; i < 10; i++) {

  if (i < 5) {

  sum += i;

  }

  }
  ```

## [2.3.3](/internals/changelog/version/2-3-3/)

### Patch Changes

* [#7907](https://github.com/biomejs/biome/pull/7907) [`57bd662`](https://github.com/biomejs/biome/commit/57bd662ad5155c9a1f13085cc5422f56a44d282e) Thanks [@ematipico](https://github.com/ematipico)! - Fixed [#7839](https://github.com/biomejs/biome/issues/7839). Now the Biome parser correctly parses the Astro frontmatter even when a triple fence is inside quotes.
* [#7934](https://github.com/biomejs/biome/pull/7934) [`a35c496`](https://github.com/biomejs/biome/commit/a35c4962e2241e127444284049012c60aec71a41) Thanks [@alissonlauffer](https://github.com/alissonlauffer)! - Fixed [#7919](https://github.com/biomejs/biome/issues/7919): The HTML parser now correctly handles Unicode BOM (Byte Order Mark) characters at the beginning of HTML files, ensuring proper parsing and tokenization.
* [#7869](https://github.com/biomejs/biome/pull/7869) [`c80361d`](https://github.com/biomejs/biome/commit/c80361d9abaf810bdb2e9a81cc1e4ab814d385b0) Thanks [@matanshavit](https://github.com/matanshavit)! - Fixed [#7864](https://github.com/biomejs/biome/issues/7864): Biome now preserves component tag name casing in Svelte, Astro, and Vue files.
* [#7926](https://github.com/biomejs/biome/pull/7926) [`69cecec`](https://github.com/biomejs/biome/commit/69cececbbaccbe5c44c71afee8e242437783cabc) Thanks [@matanshavit](https://github.com/matanshavit)! - Added the rule [`noParametersOnlyUsedInRecursion`](https://biomejs.dev/linter/rules/no-parameters-only-used-in-recursion/).

  This rule detects function parameters that are exclusively used in recursive calls and can be removed to simplify the function signature since they are effectively unused.

  ```
  function factorial(n, acc) {

  if (n === 0) return 1;

  return factorial(n - 1, acc); // acc is only used here

  }
  ```

  Fixes [#6484](https://github.com/biomejs/biome/issues/6484).
* [#7774](https://github.com/biomejs/biome/pull/7774) [`2509b91`](https://github.com/biomejs/biome/commit/2509b91cde53b8f747d397fcec5e37eb47bd524d) Thanks [@dibashthapa](https://github.com/dibashthapa)! - Fixed [#7657](https://github.com/biomejs/biome/issues/7657): Added the new rule [`no-unknown-property`](https://biomejs.dev/linter/rules/no-unknown-property/) from ESLint
* [#7918](https://github.com/biomejs/biome/pull/7918) [`7165d06`](https://github.com/biomejs/biome/commit/7165d067bb0162ffcc354ea3ced63c67d71bd185) Thanks [@dyc3](https://github.com/dyc3)! - Fixed [#7913](https://github.com/biomejs/biome/issues/7913): The CSS parser, with `tailwindDirectives` enabled, will now correctly handle `@slot`.
* [#7959](https://github.com/biomejs/biome/pull/7959) [`ffae203`](https://github.com/biomejs/biome/commit/ffae2031a0104b6b9ca77cdedaf85202694f12f9) Thanks [@siketyan](https://github.com/siketyan)! - Fixed the Biome Language Server so it no longer returns an internal error when the formatter is disabled in the configuration.

## [2.3.2](/internals/changelog/version/2-3-2/)

### Patch Changes

* [#7859](https://github.com/biomejs/biome/pull/7859) [`c600618`](https://github.com/biomejs/biome/commit/c6006184a860b42fea3f0ea5fe96c47087341a90) Thanks [@Netail](https://github.com/Netail)! - Added the nursery rule [`noIncrementDecrement`](https://biomejs.dev/linter/rules/no-increment-decrement/), disallows the usage of the unary operators ++ and —.
* [#7901](https://github.com/biomejs/biome/pull/7901) [`0d17b05`](https://github.com/biomejs/biome/commit/0d17b05477a537b6d652a2e56c50bb1db013ef06) Thanks [@ematipico](https://github.com/ematipico)! - Fixed [#7837](https://github.com/biomejs/biome/issues/7837), where Biome couldn’t properly parse text expressions that contained nested curly brackets. This was breaking parsing in Astro and Svelte files.
* [#7874](https://github.com/biomejs/biome/pull/7874) [`e617d36`](https://github.com/biomejs/biome/commit/e617d363b9356bef007192a7f508e15d63f56e9b) Thanks [@Bertie690](https://github.com/Bertie690)! - Fixed [#7230](https://github.com/biomejs/biome/issues/7230): [`noUselessStringConcat`](https://biomejs.dev/linter/rules/no-useless-string-concat/) no longer emits false positives for multi-line strings with leading `+` operators.

  Previously, the rule did not check for leading newlines on the `+` operator, emitting false positives if one occurred at the start of a line.
  Notably, formatting with `operatorLinebreak="before"` would move the `+` operators to the start of lines automatically, resulting in spurious errors whenever a multi-line string was used.

  Now, the rule correctly detects and ignores multi-line concatenations with leading operators as well, working regardless of the setting of `operatorLinebreak`.

  **Example**

  ```
  // The following code used to error if the `+` operators were at the start of lines (as opposed to the end).

  // Now, the rule correctly recognizes this as a stylistic concatenation and ignores it.

  const reallyLongStringThatShouldNotError =

  "Lorem ipsum dolor sit amet consectetur adipiscing elit." +

  "Quisque faucibus ex sapien vitae pellentesque sem placerat." +

  "In id cursus mi pretium tellus duis convallis." +

  "Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus fringilla";
  ```
* [#7786](https://github.com/biomejs/biome/pull/7786) [`33ffcd5`](https://github.com/biomejs/biome/commit/33ffcd50a749ca0e188796a10b4ffffb59ead4b3) Thanks [@daivinhtran](https://github.com/daivinhtran)! - Fixed [#7601](https://github.com/biomejs/biome/issues/7601): Properly match Grit plugin’s code snippet with only one child.
* [#7901](https://github.com/biomejs/biome/pull/7901) [`0d17b05`](https://github.com/biomejs/biome/commit/0d17b05477a537b6d652a2e56c50bb1db013ef06) Thanks [@ematipico](https://github.com/ematipico)! - Fixed [#7837](https://github.com/biomejs/biome/issues/7837), where Biome Language Server panicked when opening HTML-ish files when the experimental full support is enabled.

## [2.3.1](/internals/changelog/version/2-3-1/)

### Patch Changes

* [#7840](https://github.com/biomejs/biome/pull/7840) [`72afdfa`](https://github.com/biomejs/biome/commit/72afdfa3451eb02d499c1a2a7dc826b37e3d5f8d) Thanks [@ematipico](https://github.com/ematipico)! - Fixed [#7838](https://github.com/biomejs/biome/issues/7838), which caused the new `--css-parse-*` arguments not being recognised by the `ci` command.
* [#7789](https://github.com/biomejs/biome/pull/7789) [`d5b416e`](https://github.com/biomejs/biome/commit/d5b416eae710f062fe96a4c774b3bf885857ffa8) Thanks [@fronterior](https://github.com/fronterior)! - Fixed the LSP method `workspace/didChangeWorkspaceFolders` to perform incremental updates instead of replacing the entire folder list.
* [#7852](https://github.com/biomejs/biome/pull/7852) [`bd254c7`](https://github.com/biomejs/biome/commit/bd254c7a4c8de8fa0a2cd9ae05591b6ee881a622) Thanks [@dyc3](https://github.com/dyc3)! - Fixed #7843: The CSS parser, when `tailwindDirectives` is enabled, correctly parses `--*: initial;`.
* [#7872](https://github.com/biomejs/biome/pull/7872) [`0fe13fe`](https://github.com/biomejs/biome/commit/0fe13fea24f0c955fc0f98cf75d249b65532a192) Thanks [@dyc3](https://github.com/dyc3)! - Fixed [#7861](https://github.com/biomejs/biome/issues/7861): The HTML parser will now accept Svelte attribute shorthand syntax in `.svelte` files.
* [#7866](https://github.com/biomejs/biome/pull/7866) [`7b2600b`](https://github.com/biomejs/biome/commit/7b2600b6826002311bdb5fcd89fd309496e993b2) Thanks [@dyc3](https://github.com/dyc3)! - Fixed [#7860](https://github.com/biomejs/biome/issues/7860): The css parser, with `tailwindDirectives` enabled, will now accept `@plugin` options.
* [#7853](https://github.com/biomejs/biome/pull/7853) [`fe90c78`](https://github.com/biomejs/biome/commit/fe90c785e244b2a17ba8650972fb7eb6ddc6907f) Thanks [@dyc3](https://github.com/dyc3)! - Fixed #7848: The css parser with `tailwindDirectives` enabled will now correctly parse tailwind’s source exclude syntax: `@source not "foo.css";`
* [#7878](https://github.com/biomejs/biome/pull/7878) [`c9f7fe5`](https://github.com/biomejs/biome/commit/c9f7fe5473fad55b888dedf03d06deee777397a8) Thanks [@ematipico](https://github.com/ematipico)! - Fixed [#7857](https://github.com/biomejs/biome/issues/7857): Biome now parses `<script>` tags as TypeScript when analysing `.astro` files.
* [#7867](https://github.com/biomejs/biome/pull/7867) [`b42b718`](https://github.com/biomejs/biome/commit/b42b7189e772a876fe8053a8129dbfa93ecf8255) Thanks [@smorimoto](https://github.com/smorimoto)! - Fixed incorrect option name in HTML parser error message.

  The error message for disabled text expressions incorrectly referred
  to the `html.parser.textExpression` option, which does not exist.
  Updated it to reference the correct `html.parser.interpolation` option.
