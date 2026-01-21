# Single Package Migration Workflow

## Overview

Migrate a single npm project to pnpm. This workflow applies to standalone packages without workspaces.

## Prerequisites

- Node.js v18.12 or higher
- Existing npm project with `package.json` and `package-lock.json`

## Steps

### 1. Install pnpm

```bash
# Using npm
npm install -g pnpm

# Using standalone script (recommended)
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Windows PowerShell
iwr https://get.pnpm.io/install.ps1 -useb | iex

# Verify installation
pnpm --version  # Should be 10.28 or later
```

### 2. Remove npm artifacts

```bash
# Remove old lockfile
rm package-lock.json

# Remove existing node_modules (highly recommended)
rm -rf node_modules
```

### 3. Generate pnpm lockfile

```bash
pnpm import
```

This reads `package-lock.json` (if still present) or `yarn.lock` and generates `pnpm-lock.yaml`.

**Note:** If you already deleted `package-lock.json`, `pnpm import` will generate a lockfile based on `package.json` dependencies.

### 4. Install dependencies

```bash
pnpm install
```

### 5. Verify the migration

```bash
# Run tests
pnpm test

# Run build
pnpm run build

# Run the application
pnpm start
```

### 6. Clean up (optional)

```bash
# If you want to completely remove npm from the project
npm uninstall -g npm  # Only if managing Node via npm
# Or simply stop using npm commands
```

## Common Issues After Migration

### Issue: "Cannot find module"

**Cause:** pnpm's strict dependency resolution may reveal missing dependencies that npm's flat layout masked.

**Solution:**
```bash
# Explicitly install the missing dependency
pnpm add <missing-package>
```

### Issue: Build scripts fail

**Cause:** Some packages assume npm-specific behaviors or file paths.

**Solutions:**
- Check for hardcoded `node_modules` paths in scripts
- Ensure all build tools are listed as dependencies (not just devDependencies)
- Review `.npmrc` settings for npm-specific configurations

### Issue: Postinstall scripts behave differently

**Cause:** pnpm runs postinstall scripts in a different order/environment.

**Solution:**
```bash
# Set enable-pre-post-scripts in .npmrc
echo "enable-pre-post-scripts=true" >> .npmrc
```

## CI/CD Updates

Update your CI configuration to use pnpm:

### GitHub Actions

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
  run: pnpm install
```

### GitLab CI

```yaml
before_script:
  - npm install -g pnpm@10.28.0
  - pnpm install
```

### Docker

```dockerfile
# Use official Node image with pnpm
FROM node:20-alpine

RUN npm install -g pnpm@10.28.0

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
```

## Next Steps

- Add `.npmrc` with pnpm-specific settings if needed
- Configure `pnpm-lock.yaml` to be committed to version control
- Update team documentation to use pnpm commands
