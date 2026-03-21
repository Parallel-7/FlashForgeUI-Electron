# pnpm CLI Command Reference (npm equivalents)

## Quick Translation Guide

| npm command | pnpm equivalent | Notes |
|-------------|-----------------|-------|
| `npm install` | `pnpm install` | Creates `pnpm-lock.yaml` |
| `npm install <pkg>` | `pnpm add <pkg>` | Default: save to dependencies |
| `npm install <pkg> -D` | `pnpm add <pkg> -D` | Save to devDependencies |
| `npm install <pkg> -g` | `pnpm add <pkg> -g` | Global install |
| `npm uninstall <pkg>` | `pnpm remove <pkg>` | Remove dependency |
| `npm update` | `pnpm update` | Update dependencies |
| `npm run <script>` | `pnpm <script>` or `pnpm run <script>` | Run package script |
| `npm test` | `pnpm test` or `pnpm t` | Run tests |
| `npm audit` | `pnpm audit` | Security audit |
| `npm ci` | `pnpm install --frozen-lockfile` | Clean install |
| `npx <cmd>` | `pnpm exec <cmd>` or `pnpm dlx <cmd>` | Execute package binary |
| `npm init` | `pnpm init` | Create package.json |
| `npm publish` | `pnpm publish` | Publish to registry |
| `npm cache clean` | `pnpm store prune` | Clean cache |
| `npm view <pkg>` | `pnpm view <pkg>` | View package info |

## Dependency Management

### Adding packages

```bash
# Add to dependencies
pnpm add <pkg>
pnpm add <pkg>@<version>
pnpm add <pkg> --tag next

# Add to devDependencies
pnpm add -D <pkg>
pnpm add --save-dev <pkg>

# Add to optionalDependencies
pnpm add -O <pkg>

# Add exact version (no caret/range)
pnpm add -E <pkg>
pnpm add --save-exact <pkg>

# Add to workspace root
pnpm add -w <pkg>
pnpm add --workspace-root <pkg>

# Add to specific workspace package
pnpm --filter <pkg-name> add <dependency>
```

### Removing packages

```bash
# Remove from dependencies
pnpm remove <pkg>
pnpm rm <pkg>
pnpm uninstall <pkg>

# Remove from devDependencies
pnpm remove -D <pkg>

# Remove globally
pnpm remove -g <pkg>

# Remove from workspace
pnpm --filter <pkg-name> remove <dependency>
```

### Updating packages

```bash
# Update all dependencies (respect ranges in package.json)
pnpm update

# Update specific package
pnpm update <pkg>

# Update to latest version (ignoring ranges)
pnpm update --latest <pkg>

# Update interactively
pnpm update -i

# Update in workspace
pnpm --filter <pkg-name> update <dependency>
```

## Installation

```bash
# Install all dependencies
pnpm install
pnpm i

# Install with frozen lockfile (CI)
pnpm install --frozen-lockfile

# Install ignoring lockfile (regenerate)
pnpm install --force

# Install with specific registry
pnpm install --registry=https://registry.npmjs.org/

# Install with strict peer dependencies
pnpm install --strict-peer-dependencies

# Install auto-fixing peer dependencies
pnpm install --fix-lockfile
```

## Running Scripts

```bash
# Run script
pnpm run <script>
pnpm <script>

# Run script with arguments
pnpm run build -- --production

# Run script in all workspace packages
pnpm -r <script>
pnpm --recursive <script>

# Run script in specific package
pnpm --filter <pkg-name> <script>

# Run with environment variables
pnpm run build --production=true

# Run script with bail flag (stop on first failure)
pnpm -r --bail <script>
```

## Workspace Commands

```bash
# Run command in all packages
pnpm -r <cmd>
pnpm --recursive <cmd>

# Run command in specific package
pnpm --filter <pkg-name> <cmd>

# Run in package and its dependencies
pnpm --filter <pkg-name>... <cmd>

# Run in package and its dependents
pnpm --filter ...<pkg-name> <cmd>

# List packages
pnpm list -r --depth=0

# Add dependency to workspace
pnpm -w add <pkg>

# Install only some workspace packages
pnpm install --filter @my-scope/*
```

## Execution

```bash
# Execute locally installed binary
pnpm exec <cmd>
pnpm x <cmd>

# Execute without installing (like npx)
pnpm dlx <cmd>

# Execute with arguments
pnpm exec jest --coverage

# Execute in specific context
pnpm --filter <pkg-name> exec <cmd>
```

## Cache and Store

```bash
# View store location
pnpm store path

# Check store status
pnpm store status

# Prune unreferenced packages
pnpm store prune

# Add package to store
pnpm store add <pkg>

# Warm up cache (useful for CI)
cat pnpm-lock.yaml | pnpm fetch
```

## Information Commands

```bash
# List installed dependencies
pnpm list
pnpm ls

# List with depth limit
pnpm list --depth=0

# List all workspace packages
pnpm list -r

# Show why package is installed
pnpm why <pkg>

# View package info from registry
pnpm view <pkg>
pnpm info <pkg>

# View specific version info
pnpm view <pkg>@<version>

# View package versions
pnpm view <pkg> versions

# Check for outdated
pnpm outdated

# Search packages
pnpm search <term>
```

## Misc Commands

```bash
# Create package.json
pnpm init

# Publish package
pnpm publish
pnpm publish --access public

# Pack package (create tarball)
pnpm pack

# Rebuild native modules
pnpm rebuild

# Audit dependencies
pnpm audit
pnpm audit --fix

# Check licenses
pnpm licenses list

# Generate lockfile from package-lock.json/yarn.lock
pnpm import

# Import scripts
pnpm import <dir>

# Show help
pnpm help
pnpm help <command>

# Show pnpm version
pnpm --version
pnpm -v

# Check if update available
pnpm add -g pnpm
```

## Configuration (.npmrc)

```bash
# Get config value
pnpm config get <key>

# Set config value
pnpm config set <key> <value>

# Delete config value
pnpm config delete <key>

# List all config
pnpm config list

# Edit config
pnpm config edit
```

## Common .npmrc Settings for npm Migrants

```ini
# Enable shamefully-hoist (useful for migration)
shamefully-hoist=true

# Auto install peer dependencies
auto-install-peers=true

# Strict peer dependency checking
strict-peer-dependencies=false

# Enable pre/post scripts
enable-pre-post-scripts=true

# Store location
store-dir=~/.pnpm-store

# Registry
registry=https://registry.npmjs.org/

# Workspace lockfile sharing
shared-workspace-lockfile=true
```
