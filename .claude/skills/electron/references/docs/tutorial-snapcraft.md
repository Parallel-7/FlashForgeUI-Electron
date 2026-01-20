# Source: https://www.electronjs.org/docs/latest/tutorial/snapcraft

On this page

This guide provides information on how to package your Electron application
for any Snapcraft environment, including the Ubuntu Software Center.

## Background and Requirements[â](#background-and-requirements "Direct link to Background and Requirements")

Together with the broader Linux community, Canonical aims to address common
software installation issues through the [`snapcraft`](https://snapcraft.io/)
project. Snaps are containerized software packages that include required
dependencies, auto-update, and work on all major Linux distributions without
system modification.

There are three ways to create a `.snap` file:

1. Using [Electron Forge](https://github.com/electron/forge) or
[`electron-builder`](https://github.com/electron-userland/electron-builder), both tools that come with `snap`
support out of the box. This is the easiest option.
2. Using `electron-installer-snap`, which takes `@electron/packager`'s output.
3. Using an already created `.deb` package.

In some cases, you will need to have the `snapcraft` tool installed.
Instructions to install `snapcraft` for your particular distribution are
available [here](https://snapcraft.io/docs/installing-snapcraft).

## Using `electron-installer-snap`[â](#using-electron-installer-snap "Direct link to using-electron-installer-snap")

The module works like [`electron-winstaller`](https://github.com/electron/windows-installer) and similar
modules in that its scope is limited to building snap packages. You can install
it with:

```
npm install --save-dev electron-installer-snap
```

### Step 1: Package Your Electron Application[â](#step-1-package-your-electron-application "Direct link to Step 1: Package Your Electron Application")

Package the application using [@electron/packager](https://github.com/electron/packager) (or a
similar tool). Make sure to remove `node_modules` that you don't need in your
final application, since any module you don't actually need will increase
your application's size.

The output should look roughly like this:

```
.
âââ dist
âââ app-linux-x64
âââ LICENSE
âââ LICENSES.chromium.html
âââ content_shell.pak
âââ app
âââ icudtl.dat
âââ libgcrypt.so.11
âââ libnode.so
âââ locales
âââ resources
âââ v8_context_snapshot.bin
âââ version
```

### Step 2: Running `electron-installer-snap`[â](#step-2-running-electron-installer-snap "Direct link to step-2-running-electron-installer-snap")

From a terminal that has `snapcraft` in its `PATH`, run `electron-installer-snap`
with the only required parameter `--src`, which is the location of your packaged
Electron application created in the first step.

```
npx electron-installer-snap --src=out/myappname-linux-x64
```

If you have an existing build pipeline, you can use `electron-installer-snap`
programmatically. For more information, see the [Snapcraft API docs](https://docs.snapcraft.io/build-snaps/syntax).

```
const snap = require('electron-installer-snap')

snap(options)
.then(snapPath => console.log(`Created snap at ${snapPath}!`))
```

## Using `snapcraft` with `@electron/packager`[â](#using-snapcraft-with-electronpackager "Direct link to using-snapcraft-with-electronpackager")

### Step 1: Create Sample Snapcraft Project[â](#step-1-create-sample-snapcraft-project "Direct link to Step 1: Create Sample Snapcraft Project")

```
$ npx create-electron-app@latest my-app
```

### Step 2: Create Sample Snapcraft Project[â](#step-2-create-sample-snapcraft-project "Direct link to Step 2: Create Sample Snapcraft Project")

Create a `snap` directory in your project root and add the following to
`snap/snapcraft.yaml`:

```
name: electron-packager-hello-world
version: '0.1'
summary: Hello World Electron app
description: |
Simple Hello World Electron app as an example
base: core22
confinement: strict
grade: stable

apps:
electron-packager-hello-world:
command: my-app/my-app --no-sandbox
extensions: [gnome]
plugs:
- browser-support
- network
- network-bind
environment:
# Correct the TMPDIR path for Chromium Framework/Electron to ensure
# libappindicator has readable resources.
TMPDIR: $XDG_RUNTIME_DIR

parts:
my-app:
plugin: nil
source: .
override-build: |
npm install electron @electron/packager
npx electron-packager . --overwrite --platform=linux --output=release-build --prune=true
cp -rv ./my-app-linux-* $SNAPCRAFT_PART_INSTALL/my-app
build-snaps:
- node/14/stable
build-packages:
- unzip
stage-packages:
- libnss3
- libnspr4
```

If you want to apply this example to an existing project, replace all instances
of `my-app` with your project's name.

### Step 3: Build the snap[â](#step-3-build-the-snap "Direct link to Step 3: Build the snap")

```
$ snapcraft

<output snipped>
Snapped electron-packager-hello-world_0.1_amd64.snap
```

### Step 4: Install the snap[â](#step-4-install-the-snap "Direct link to Step 4: Install the snap")

```
sudo snap install electron-packager-hello-world_0.1_amd64.snap --dangerous
```

### Step 5: Run the snap[â](#step-5-run-the-snap "Direct link to Step 5: Run the snap")

```
electron-packager-hello-world
```

## Using an Existing Debian Package[â](#using-an-existing-debian-package "Direct link to Using an Existing Debian Package")

Snapcraft is capable of taking an existing `.deb` file and turning it into
a `.snap` file. The creation of a snap is configured using a `snapcraft.yaml`
file that describes the sources, dependencies, description, and other core
building blocks.

### Step 1: Create a Debian Package[â](#step-1-create-a-debian-package "Direct link to Step 1: Create a Debian Package")

If you do not already have a `.deb` package, using `electron-installer-snap`
might be an easier path to create snap packages. However, multiple solutions
for creating Debian packages exist, including [Electron Forge](https://github.com/electron/forge),
[`electron-builder`](https://github.com/electron-userland/electron-builder) or
[`electron-installer-debian`](https://github.com/electron-userland/electron-installer-debian).

### Step 2: Create a snapcraft.yaml[â](#step-2-create-a-snapcraftyaml "Direct link to Step 2: Create a snapcraft.yaml")

For more information on the available configuration options, see the
[documentation on the snapcraft syntax](https://docs.snapcraft.io/build-snaps/syntax).
Let's look at an example:

```
name: myApp
version: '2.0.0'
summary: A little description for the app.
description: |
You know what? This app is amazing! It does all the things
for you. Some say it keeps you young, maybe even happy.

grade: stable
confinement: classic

parts:
slack:
plugin: dump
source: my-deb.deb
source-type: deb
after:
- desktop-gtk3
stage-packages:
- libasound2
- libnotify4
- libnspr4
- libnss3
- libpcre3
- libpulse0
- libxss1
- libxtst6
electron-launch:
plugin: dump
source: files/
prepare: |
chmod +x bin/electron-launch

apps:
myApp:
command: bin/electron-launch $SNAP/usr/lib/myApp/myApp
desktop: usr/share/applications/myApp.desktop
# Correct the TMPDIR path for Chromium Framework/Electron to ensure
# libappindicator has readable resources.
environment:
TMPDIR: $XDG_RUNTIME_DIR
```

As you can see, the `snapcraft.yaml` instructs the system to launch a file
called `electron-launch`. In this example, it passes information on to the
app's binary:

```
#!/bin/sh

exec "$@" --executed-from="$(pwd)" --pid=$$ > /dev/null 2>&1 &
```

Alternatively, if you're building your `snap` with `strict` confinement, you
can use the `desktop-launch` command:

```
apps:
myApp:
# Correct the TMPDIR path for Chromium Framework/Electron to ensure
# libappindicator has readable resources.
command: env TMPDIR=$XDG_RUNTIME_DIR PATH=/usr/local/bin:${PATH} ${SNAP}/bin/desktop-launch $SNAP/myApp/desktop
desktop: usr/share/applications/desktop.desktop
```

## Optional: Enabling desktop capture[â](#optional-enabling-desktop-capture "Direct link to Optional: Enabling desktop capture")

Capturing the desktop requires PipeWire library in some Linux configurations that use
the Wayland protocol. To bundle PipeWire with your application, ensure that the base
snap is set to `core22` or newer. Next, create a part called `pipewire` and add it to
the `after` section of your application:

```
pipewire:
plugin: nil
build-packages: [libpipewire-0.3-dev]
stage-packages: [pipewire]
prime:
- usr/lib/*/pipewire-*
- usr/lib/*/spa-*
- usr/lib/*/libpipewire*.so*
- usr/share/pipewire
```

Finally, configure your application's environment for PipeWire:

```
environment:
SPA_PLUGIN_DIR: $SNAP/usr/lib/$CRAFT_ARCH_TRIPLET/spa-0.2
PIPEWIRE_CONFIG_NAME: $SNAP/usr/share/pipewire/pipewire.conf
PIPEWIRE_MODULE_DIR: $SNAP/usr/lib/$CRAFT_ARCH_TRIPLET/pipewire-0.3
```

* [Background and Requirements](#background-and-requirements)* [Using `electron-installer-snap`](#using-electron-installer-snap)
+ [Step 1: Package Your Electron Application](#step-1-package-your-electron-application)+ [Step 2: Running `electron-installer-snap`](#step-2-running-electron-installer-snap)* [Using `snapcraft` with `@electron/packager`](#using-snapcraft-with-electronpackager)
+ [Step 1: Create Sample Snapcraft Project](#step-1-create-sample-snapcraft-project)+ [Step 2: Create Sample Snapcraft Project](#step-2-create-sample-snapcraft-project)+ [Step 3: Build the snap](#step-3-build-the-snap)+ [Step 4: Install the snap](#step-4-install-the-snap)+ [Step 5: Run the snap](#step-5-run-the-snap)* [Using an Existing Debian Package](#using-an-existing-debian-package)
+ [Step 1: Create a Debian Package](#step-1-create-a-debian-package)+ [Step 2: Create a snapcraft.yaml](#step-2-create-a-snapcraftyaml)* [Optional: Enabling desktop capture](#optional-enabling-desktop-capture)