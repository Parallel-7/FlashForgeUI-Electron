# Diagnostics

Biome’s diagnostics are full of information, and they usually provide all the information you need to understand errors, and fix them.

Diagnostics aren’t only used for errors, but they are also used to provide structured information, warnings and tips.information

This page provide a break down of all the information that a diagnostic can contain. Learning all the different parts of a diagnostic can help you to identify the important parts, and some “secrets” behind them.

## Diagnostic severity


The severity of the diagnostic can affect the CLI. For example, error diagnostics will force the CLI to exit with an error code.

### Fatal


Error diagnostics have red text. Fatal diagnostics are usually emitted when an unexpected error occurred inside Biome. Compared to errors, they have the [fatal tag](#diagnostic-tags).

```
 FATAL  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.

  ⚠ Biome exited as this error could not be handled and resulted in a fatal error. Please report it if necessary.
```

### Error


Error diagnostics have red text. Usually, they should be addressed because they will emit an error code when encountered by the CLI.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.
```

### Warning


Warning diagnostics have yellow text. Usually, they should be addressed. Warnings are not blockers, and they won’t stop the CLI from working.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ⚠ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.
```

### Information


Information diagnostics have green text. They provide useful information and they aren’t meant to block the CLI.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ℹ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.
```

## Diagnostic tags


Tags can be seen as metadata attached to a diagnostic, and they can affect the clients in different ways.

### Verbose


Verbose diagnostics are usually hidden. Via CLI, you can show these diagnostics using the `--verbose` option.

```
 VERBOSE  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.
```

### Internal


Internal diagnostics are emitted when an internal error occurred. Users are usually encourage to file a bug when they see one.

```
 INTERNAL  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.

  ⚠ This diagnostic was derived from an internal Biome error. Potential bug, please report it if necessary.
```

### Fixable


Fixable diagnostics are emitted for those particular situations that can be fixed by the user. They are usually used for lint diagnostics that have a code action.

```
 FIXABLE  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.
```

### Deprecated


Diagnostics that contain code that is deprecated

```
 DEPRECATED  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.
```

## Diagnostic category


The category serves to group diagnostics. Optionally, a category can have a link, for example, for categories that belong to lint rules, like in the example below.

### Simple category


This diagnostic belongs to the category “`check`”, which means that it is emitted when executing the `check` command:

```
check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.
```

### Category with link


This diagnostics belongs to the category `"lint/a11y/noAccessKey"`. The link takes the user to the webpage of the lint rule `noAccessKey`.

```
lint/a11y/noAccessKey ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.
```

## Diagnostic location


Diagnostics can have a “location”. A location is made by three, optional, parts:

* a resource, which is the origin that emitted the diagnostic;
* source code of the file;
* a span (or text range), usually the **line** and **column** inside the file.

### Diagnostic file path


The file path is usually the first information you see, at the top left of the diagnostic.

```
path/to/file.js ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.
```

### Diagnostic source code


This shows how the source code associated to a file is shown. Notice that the line and columns aren’t shown.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.

  > 1 │ Some source code
      │      ^^^^^
```

### Diagnostic line and column


**Line** and **column** is usually printed beside the file path, and it’s shown only when there’s some source code associated to it.

```
path/to/file.txt:1:6 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.

  > 1 │ Some source code
      │      ^^^^^^
```

When the diagnostics are printed inside the terminal of an IDE, you can click `path/to/file.js:2:2`, and the IDE will open the relative file, and place cursor at the beginning of the span.

```
path/to/file.js:2:2 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.

    1 │ function name() {
  > 2 │ 	return 'lorem'
      │ 	^^^^^^^^^^^^^^
    3 │ }
```

## Diagnostic advices


Additionally, our diagnostics can store advices. Advices are additionally messages that can be appended after the original message.

These advices comes with different kinds and shapes. Usually, advices are always printed, unless they are *verbose advices*.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✖ This is the message of the diagnostic. It will appear in different colours based on the severity of the diagnostic.

  ✖ This log is an error.

  ℹ This log is a warning

  ℹ This log is an information

  This log doesn't have any category. Below, you'll have a command

  $ biome command

  Below, a group.

  I am a group

    ℹ First message of a group.

    ℹ Second message of a group.

  Below, a list.

  - First item
  - Second item

  Below, a diff.

  - Old·code
  + New·code

  Below, a code frame.

  > 1 │ Lorem
      │ ^^^
    2 │ Ipsum
```
