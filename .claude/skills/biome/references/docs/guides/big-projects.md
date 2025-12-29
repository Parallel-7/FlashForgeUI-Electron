# Use Biome in big projects

Biome can provide some tools that can help you to use it properly in big
projects, such as monorepo or workspaces that contain multiple projects.

## Use multiple configuration files


When you use Biome’s features - either with the CLI or LSP - the tool looks for
the nearest configuration file using the current working directory.

If Biome doesn’t find the configuration file there, it **starts traversing
upwards** the directories of the file system, until it finds one.

You can leverage this feature to apply different settings based on the
project/folder.

Let’s suppose we have a project that contains a backend app and a frontend
app.

* Directoryapp
  + Directorybackend
    - biome.json
    - package.json
  + Directoryfrontend
    - biome.json
    - Directorylegacy-app
      * package.json
    - Directorynew-app
      * package.json

This means that when you run Biome inside `app/backend`, Biome will use the
configuration file `app/backend/biome.json`. And when you run from
`app/frontend/legacy-app` or `app/frontend/new-app`, Biome will use the
configuration file `app/frontend/biome.json`.

## Monorepo


Monorepos are particular repositories where multiple packages are stored and
maintained in one big repository. Each package can contain its own
configuration.

Since v2, Biome supports monorepos out of the box, and you’ll need to set up the
project in the following way.

1. Create a `biome.json` file at the root of the monorepo. We will use the
   recommended rules, and customise the formatter options:

   biome.json

   ```
   {

   "linter": {

   "enabled": true,

   "rules": {

   "recommended": true

   }

   },

   "formatter": {

   "lineWidth": 120,

   "indentStyle": "space",

   "indentWidth": 6

   }

   }
   ```

   This file is called the **root configuration** and it sets the base options
   inside the project. However, nested configurations can decide to adhere to
   these options or not. Let’s see how.
2. Create nested configuration files, one in each package where it is needed.
   These nested configuration files must have the field `"root"` set to
   `false`. Also, we want these packages to follow the formatting standards
   set up in the root configuration. In order to so, we will use a **new
   microsyntax** available in Biome v2, which is `"extends": "//"`. This syntax
   tells Biome to extend from the **root configuration**, regardless of where
   the nested configuration is.

   Let’s create two configuration files, one inside `packages/logger` and one
   inside `packages/generate`. In the former we will disable `noConsole`, and
   in `packages/generate` we will disable the formatter because those are files
   that are code-generated:

   packages/logger/biome.json

   ```
   {

   "root": false,

   "extends": "//",

   "linter": {

   "rules": {

   "suspicious": {

   "noConsole": "off"

   }

   }

   }

   }
   ```

   packages/generate/biome.json

   ```
   {

   "root": false,

   "extends": "//",

   "formatter": {

   "enabled": false

   }

   }
   ```

   For convenience, when you use the microsyntax `extends: "//"`, you can
   **omit** `"root": false`, because it is already implied that this
   configuration isn’t a root configuration:

   packages/generate/biome.json

   ```
   {

   "root": false,

   "extends": "//",

   "formatter": {

   "enabled": false

   }

   }
   ```
3. Now, let’s suppose we have a new package in `packages/analytics` that is
   maintained by a different team. This team follows entirely different coding
   standards, so they *don’t* want to inherit options from the root
   configuration. For them, they just need to omit `"extends": "//"` from the
   configuration file, and change the formatting options:

   packages/analytics/biome.json

   ```
   {

   "root": false,

   "formatter": {

   "lineWidth": 100,

   }

   }
   ```
4. Now that everything is set up, you have a few options. You can run `biome`
   commands from the root of the project, or from the single packages. Biome
   will respect all settings!

Tip

Sometimes, Biome may find a nested configuration file that doesn’t have a
correct `"root": false` setting. This can happen if you have another project
that uses Biome in a vendored folder or Git submodule, for instance. In such a
case, we suggest ignoring the nested project entirely using
[the `files.includes` field](/reference/configuration/#filesincludes).

## Other ways to share a configuration file


As we saw above, the `extends` field allows you to split your configuration
across multiple files. This way, you can share common settings across different
projects or folders. The `"extends": "//"` syntax is a convenient shortcut when
you want nested configurations to extend from the root configuration, but
sometimes you may want to use an even more customised setup.

Apart from `"//"`, the `extends` setting accept array values as well. In this
case, every value in the array must be a path to another config to extend.

For example, here is how you might set up your configuration to extend a
`common.json` configuration file:

biome.json

```
{

"extends": ["./common.json"]

}
```

The entries defined in `extends` are resolved from the path where the
`biome.json` file is defined. They are processed in the order they are listed,
with settings in later files overriding earlier ones.

Files that you `extend` from cannot `extend` other files in turn.

Note that paths in a configuration file are always resolved from the folder in
which the `biome.json`/`biome.jsonc` file resides. When using the `extends`
field, this means that paths in a shared configuration are interpreted from the
location of the configuration that is extending it, and not from the folder
of the file being extended.

For example, let’s assume a project that contains two directories `backend/` and
`frontend/`, each having their own `biome.json` that both extend a `common.json`
configuration in the root folder:

* Directorybackend/
  + Directorysrc/
    - …
  + Directorytest/
    - …
  + biome.json
* Directoryfrontend/
  + Directorysrc/
    - …
  + Directorytest/
    - …
  + biome.json
* common.json

common.json

```
{

"files": {

"includes": ["src/**/*.js", "test/**/*.js"],

},

"linter": {

"includes": ["**", "!test"]

}

}
```

frontend/biome.json

```
{

"extends": ["../common.json"]

}
```

* When running Biome from the `frontend/` folder, it will be configured to
  format and lint all JavaScript files in the `frontend/src/` and
  `frontend/test/` folders, and only format the files in the `frontend/src/`
  folder. This works because the paths specified in `common.json` are
  interpreted from the `frontend/` folder, because that’s where the `biome.json`
  file resides.
* Assuming `backend/biome.json` looks the same as `frontend/biome.json`, it will
  have the same behaviour, except the paths will be interpreted from the
  `backend/` folder.

Note that in this setup, both `frontend/biome.json` and `backend/biome.json` are
considered root configurations. You won’t be able to run Biome from the root of
the repository, unless you use the `--config-path` CLI option and point it at
one of the configurations.

### Exporting a Biome configuration from an NPM package


Biome is also able to resolve configuration files from the `node_modules/`
folder. So you can export your configuration file from a package, and import it
in multiple projects.

In order to do so, the first thing to do is to set up your “shared” Biome
configuration in a certain way. Let’s suppose that you want to share a
configuration from a package called `@org/shared-configs`, using the specifier
`@org/shared-configs/biome`. You have to create an `exports` entry in the
`package.json` of this package:

package.json

```
{

"name": "@org/shared-configs",

"type": "module",

"exports": {

"./biome": "./biome.json"

}

}
```

Make sure that `@org/shared-configs` is correctly installed in your project, and
update the `biome.json` file to look like the following snippet:

biome.json

```
{

"extends": ["@org/shared-configs/biome"]

}
```

Biome will attempt to resolve your library `@org/shared-configs/` from your
working directory. The working directory is:

* when using the CLI, the folder where you execute your scripts from.
  Usually it matches the location of your `package.json` file;
* when using the LSP, the root folder of your project.

Caution

Paths starting with a dot `.` or ending with `.json` or `.jsonc` are always
treated as relative paths, so they won’t be resolved from `node_modules/`.

For more information about the resolution algorithm, refer to the
[Node.js documentation](https://nodejs.org/api/esm.html#resolution-and-loading-algorithm).
