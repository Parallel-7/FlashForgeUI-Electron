# Workspace and Monorepo Migration Workflow

## Overview

Migrate npm workspaces or monorepos to pnpm workspaces. pnpm has excellent workspace support with some key differences from npm.

## Key Differences from npm Workspaces

| Feature | npm Workspaces | pnpm Workspaces |
|---------|---------------|----------------|
| Config file | `package.json` `workspaces` field | `pnpm-workspace.yaml` |
| Dependency sharing | Flat layout, duplicates allowed | Strict deduplication via symlinks |
| Workspace protocol | `*` | `workspace:*` |
| Install command | `npm install` | `pnpm install` (auto-detects workspaces) |

## Steps

### 1. Create pnpm-workspace.yaml

**For monorepo with packages directory:**

```yaml
packages:
  - 'packages/*'
```

**For nested workspaces:**

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tools'
```

**For explicit package listing:**

```yaml
packages:
  - 'packages/core'
  - 'packages/utils'
  - 'packages/web'
```

### 2. Update workspace dependencies in package.json

npm workspaces use `*` for workspace dependencies. pnpm uses `workspace:` protocol:

**Before (npm):**
```json
{
  "dependencies": {
    "my-utils": "*",
    "my-shared-components": "*"
  }
}
```

**After (pnpm):**
```json
{
  "dependencies": {
    "my-utils": "workspace:*",
    "my-shared-components": "workspace:^"
  }
}
```

**Protocol options:**
- `workspace:*` - Use any version from workspace
- `workspace:^` - Use caret range from workspace
- `workspace:~` - Use tilde range from workspace

### 3. Remove npm workspace configuration

Remove from root `package.json`:

```json
{
  "workspaces": [
    "packages/*"
  ]
}
```

### 4. Import lockfile and install

```bash
# Generate pnpm-lock.yaml from package-lock.json
pnpm import

# Install all workspace dependencies
pnpm install
```

### 5. Update scripts for workspace commands

**npm:**
```bash
npm run test --workspace=packages/utils
npm run build --workspaces
```

**pnpm:**
```bash
pnpm --filter utils test
pnpm -r build  # or pnpm run --recursive build
pnpm -w build  # run in root workspace only
```

### 6. Handle shared devDependencies

In pnpm, devDependencies are not available to workspace consumers by default. If a workspace package needs another's devDependency:

**Option A: Move to dependencies**
```json
{
  "dependencies": {
    "typescript": "workspace:*"
  }
}
```

**Option B: Use `.npmrc` setting**
```
shared-workspace-lockfile=true
```

### 7. Update CI/CD

**GitHub Actions with workspace caching:**

```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 10.28.0

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'pnpm'

- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

## Common Monorepo Scenarios

### Turborepo Integration

pnpm works excellently with Turborepo:

```bash
pnpm add -Dw turborepo
pnpm add -D turbo turbo-gen
```

```json
{
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test"
  }
}
```

### Nx Integration

```bash
pnpm add -Dw -D nx @nx/workspace
```

Create `nx.json`:
```json
{
  "extends": "nx/presets/npm.json",
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "test", "lint"]
      }
    }
  }
}
```

### Lerna Integration

While Lerna is less necessary with pnpm, you can still use it:

```bash
pnpm add -Dw lerna
```

```json
{
  "scripts": {
    "lerna": "lerna"
  }
}
```

## Workspace-Specific Commands

```bash
# Run command in all packages
pnpm -r <command>
pnpm --recursive <command>

# Run command in specific package
pnpm --filter <package-name> <command>

# Run command in package matching pattern
pnpm --filter "./packages/**" <command>

# Run command including dependencies
pnpm --filter <package-name>... <command>

# Run command in dependents
pnpm --filter <package-name>^... <command>

# List all packages
pnpm list -r --depth 0

# Add dependency to specific workspace package
pnpm --filter <package-name> add <package>
```

## Troubleshooting Workspaces

### Issue: "Workspace package not found"

**Cause:** Package name in `workspace:` protocol doesn't match actual package name.

**Solution:** Verify package name in `package.json` matches:
```bash
grep -r '"name"' packages/*/
```

### Issue: Circular dependencies

**Cause:** Workspaces depend on each other in a cycle.

**Solution:** Restructure packages to break the cycle, often by extracting shared code to a separate package.

### Issue: Scripts can't find workspace dependencies

**Cause:** Package not linked properly in development.

**Solution:**
```bash
pnpm install
# or if issues persist
pnpm install --shamefully-hoist
```

## Advanced Workspace Configuration

**`.npmrc` workspace settings:**

```ini
# Enable strict workspace peer dependencies
strict-peer-dependencies=false

# Share workspace lockfile
shared-workspace-lockfile=true

# Auto-install peer dependencies
auto-install-peers=true
```

**`pnpm-workspace.yaml` advanced:**

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - '!**/test/**'  # exclude test directories

catalogs:
  default:
    react: ^18.2.0
    typescript: ^5.3.0
```
