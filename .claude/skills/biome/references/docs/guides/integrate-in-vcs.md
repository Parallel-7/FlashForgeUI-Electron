# Integrate Biome with your VCS

The VCS (Version Control System) integration is meant to take advantage of **additional** features that only a VCS can provide.
At the moment, Biome only supports Git.
The integration is **opt-in**.
You have to enable `vcs.enabled` and set `vcs.clientKind` in the Biome configuration file:

biome.json

```
{

"vcs": {

"enabled": true,

"clientKind": "git"

}

}
```

This configuration doesn’t do **anything per se**. You need to opt-in the features you want.

### Use the ignore file


Enable `vcs.useIgnoreFile`, to allow Biome to ignore all the files and directories listed in the project’s VCS ignore file as well as a `.ignore` file.

biome.json

```
{

"vcs": {

"enabled": true,

"clientKind": "git",

"useIgnoreFile": true

}

}
```

### Process only changed files


This is a feature that is available only via CLI, and allows processing **only** the files that have **changed** from one revision to another.

First, you have to update your configuration file and tell Biome what’s the default branch via the `vcs.defaultBranch` field:

biome.json

```
{

"vcs": {

"enabled": true,

"clientKind": "git",

"useIgnoreFile": true,

"defaultBranch": "main"

}

}
```

Then, add the `--changed` option to your command, to process only those files that your VCS acknowledged as “changed”. Biome, with the help of the VCS, will determine the changed file from the branch `main` and your current revision:

Terminal window

```
biome check --changed
```

Caution

Biome doesn’t check what’s changed, this means that even adding spaces or newlines to a file, will mark this file as “changed”

Alternatively, you can use the option `--since` to specify an arbitrary branch. This option **takes precedence** over the option `vcs.defaultBranch`. For example, you might want to check your changes against the `next` branch:

Terminal window

```
biome check --changed --since=next
```

### Process only staged files


Before committing your changes, you may want to check formatting and linting for files added to the index (also known as staged files) without running Biome on the entire project.
To limit Biome to only processing files slated for committing, pass the `--staged` option to the command:

Terminal window

```
biome check --staged
```

The `--staged` option is not available in the `ci` command, as you are usually not expected to commit changes during CI.
