# Manual installation

Using Biome’s standalone CLI binary can be a great choice if you aren’t already using Node.js or `npm` (or any other package manager).
Or in other words, Biome shouldn’t be the only reason for you to have a `package.json`.

Note

If you’re already using `npm` or another package manager, then using the package manager is the [preferred way to install](/guides/getting-started#installation) Biome.
You’re already familiar with the tooling, and installing and updating are simpler.

## Supported platforms


You have to pick the correct binary for your platform for Biome work. The following table should help you do so.

| CPU Architecture | Windows | macOS | Linux | Linux (musl) |
| --- | --- | --- | --- | --- |
| `arm64` | `win32-arm64` | `darwin-arm64` (M1 or newer) | `linux-arm64` | `linux-arm64-musl` |
| `x64` | `win32-x64` | `darwin-x64` | `linux-x64` | `linux-x64-musl` |

Note

Use the Linux variant for Windows Subsystem for Linux (WSL).

## Homebrew


Biome is available as a [Homebrew formula](https://formulae.brew.sh/formula/biome) for macOS and Linux users.

Terminal window

```
brew install biome
```

## Docker


Biome publishes [official Docker images](https://github.com/biomejs/docker/pkgs/container/biome) that support
the **amd64** and **arm64** architectures for all Biome versions starting from `v1.7.0`.

```
ghcr.io/biomejs/biome:{major}

ghcr.io/biomejs/biome:{major}.{minor}

ghcr.io/biomejs/biome:{major}.{minor}.{patch}
```

Here are a couple examples on how to use the Docker image:

Note

The default workdir is `/code` in the Docker image.

Terminal window

```
# Lint files

docker run -v $(pwd):/code ghcr.io/biomejs/biome lint

docker run -v $(pwd):/code ghcr.io/biomejs/biome lint --write

# Format files

docker run -v $(pwd):/code ghcr.io/biomejs/biome format

docker run -v $(pwd):/code ghcr.io/biomejs/biome format --write
```

## Using a published binary


To install Biome, grab the executable for your platform from the [latest CLI release](https://github.com/biomejs/biome/releases) on GitHub and give it execution permission.

Terminal window

```
# macOS arm (M1 or newer)

curl -L https://github.com/biomejs/biome/releases/download/@biomejs/biome@2.3.10/biome-darwin-arm64 -o biome

chmod +x biome

# Linux (x86_64)

curl -L https://github.com/biomejs/biome/releases/download/@biomejs/biome@2.3.10/biome-linux-x64 -o biome

chmod +x biome

# Windows (x86_64, Powershell)

Invoke-WebRequest -Uri "https://github.com/biomejs/biome/releases/download/@biomejs/biome@2.3.10/biome-win32-x64.exe" -OutFile "biome.exe"
```

Now you can use Biome by simply running `./biome`.

## Next Steps


Follow our [Getting Started guide](/guides/getting-started/).
