# Suppressions

The Biome analyzer is the foundation of the [linter](/linter) and [assist](/assist); in fact, both tools share a lot of similarities.

Among them, they share the same suppression engine, which means that you can suppress a lint rule the same way you would suppress an assist action.

With suppression, it’s possible to turn off a lint rule (or action) for a specific line of code, a range, or the entire file.

Suppression is achievable with **suppression comments**.

## Suppression syntax


Suppression comments have the following format:

```
// biome-ignore lint: <explanation>

// biome-ignore assist: <explanation>

// biome-ignore syntax: <explanation>

// biome-ignore lint/suspicious: <explanation>

// biome-ignore lint/suspicious/noDebugger: <explanation>

// biome-ignore lint/suspicious/noDebugger(foo): <explanation>

// biome-ignore-all lint: <explanation>

// biome-ignore-start lint: <explanation>

// biome-ignore-end lint: <explanation>
```

Let’s break it down:

* `biome-ignore`, `biome-ignore-all`, `biome-ignore-start` and `biome-ignore-end` are the start of a suppression comment.
* After the space follows the **category** of the suppression comment. It can be `lint`, `assist`, or `syntax`.
* The category is followed by an optional group, or group and name, separated by slashes. For example, `/suspicious` or `/suspicious/noDebugger`. The more you specify, the more specific (i.e. targeted) your suppression is.
* Some rules even allow you to specify values during suppression. These can be specified between parentheses, for example: `(foo)`. Refer to the rule documentation to see whether a rule supports suppression with values.
* `<explanation>` explanation why the rule is disabled.

If you’re unsure of the exact category of a rule/action, you can refer to their documentation page and use their *diagnostic category*.

Note

From here onwards, JavaScript is used to explain suppression comments, and the `lint` category is used.

### Inline suppressions


They disable a lint rule for the **next line** of code.

In the following example, the suppression comment `biome-ignore lint/suspicious/noDebugger: reason` will disable the `debugger;` statement at line 2, but the `debugger` at line 3 will still raise a diagnostic:

file.js

```
// biome-ignore lint/suspicious/noDebugger: reason

debugger;

debugger;
```

### Top-level suppressions


They disable a lint rule for an entire file. They must be placed **at the top of the file**, and they must start with `biome-ignore-all`.

These suppression comments are very useful when you want to suppress some lint rule *for a particular file*, and you don’t want to rely on a single configuration override to achieve that.

In the following example, the suppression comment `biome-ignore-all lint/suspicious/noDebugger: reason` will disable the lint rule for all lines in `generated.js`:

generated.js

```
// biome-ignore-all lint/suspicious/noDebugger: reason

debugger;

debugger;
```

When a top-level suppression comment isn’t at the top of the file, it is considered *unused* and Biome will emit a diagnostic with category `suppression/unused`.

### Range suppressions


They disable a lint rule from a particular *range* in the file, starting from the line with the start comment, until the line with the end comment.

To mark the beginning of a range suppression, the suppression comment must start with `// biome-ignore-start`. To mark the end of it, the suppression comment must start with `// biome-ignore-end`.

The following example will disable the rule `lint/suspicious/noDoubleEquals` for line 2 and 3, but line 5 will raise a diagnostic:

```
// biome-ignore-start lint/suspicious/noDoubleEquals: reason

a == b;

c == d;

// biome-ignore-end lint/suspicious/noDoubleEquals: reason

f == g;
```

Note

Range suppressions must have a matching `biome-ignore-end` suppression.

Range suppressions can also overlap. Consider the following example:

```
debugger;

// biome-ignore-start lint/suspicious/noDebugger: reason

debugger;

// biome-ignore-start lint/suspicious/noDoubleEquals: reason

a == b;

c == d;

// biome-ignore-end lint/suspicious/noDoubleEquals: reason

debugger;

f == g;

// biome-ignore-end lint/suspicious/noDebugger: reason
```

In the above code:

* The `debugger` statement at line 1 will raise a diagnostic because there’s no suppression comment that disables it.
* The comment `// biome-ignore-start lint/suspicious/noDebugger: reason` at line 2 starts disabling `noDebugger` from line 3 onwards.
* The comment `// biome-ignore-start lint/suspicious/noDoubleEquals: reason` at line 4 starts disabling `noDoubleEquals` from line 5 onwards.
* The comment `// biome-ignore-end lint/suspicious/noDoubleEquals: reason` at line 7 terminates the suppression of `noDoubleEquals` that was started by the suppression comment at line 4.
* The `debugger` statement at line 8 **doesn’t** raise diagnostics due to the suppression comment at line 2.
* The `f == g` statement raises a diagnostic because the rule `noDoubleEquals` isn’t suppressed anymore.
* The comment `// biome-ignore-end lint/suspicious/noDebugger: reason` at line 10 terminates the suppression of `noDebugger` that was started by the suppression comment at line 2.
