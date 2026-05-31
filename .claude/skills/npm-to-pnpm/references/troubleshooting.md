# Troubleshooting npm to pnpm Migration

## Overview

Common issues encountered when migrating from npm to pnpm and their solutions.

## Quick Reference

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| "Cannot find module" | Missing or hidden dependency | Add explicitly with `pnpm add` |
| Build fails | Path assumptions | Update paths in config/scripts |
| Tests fail | npm-specific behavior | Check mocks, stubs, environment |
| Slow install | First-time caching | Subsequent installs will be faster |
| Hook scripts fail | Different execution context | Review `.pnpmfile.cjs` options |

## Detailed Issues

### Module Resolution Issues

#### "Cannot find module" errors

**Why this happens:** pnpm's strict dependency enforcement exposes packages that were "accidentally" available through npm's flat layout or transitive dependencies.

**Solutions:**

1. **Add the missing dependency explicitly:**
```bash
pnpm add <missing-package>
# or for dev only
pnpm add -D <missing-package>
```

2. **Check if it's a peer dependency:**
```bash
pnpm add --auto-install-peers
# or set in .npmrc:
auto-install-peers=true
```

3. **Enable shamefully-hoist (temporary workaround):**
```bash
pnpm install --shamefully-hoist
# or in .npmrc:
shamefully-hoist=true
```

#### __dirname, __filename undefined

**Why this happens:** ESM modules don't have these globals.

**Solution:**
```javascript
// For ESM, use:
import { fileURLToPath } from 'url'
import { dirname } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
```

### Build and Tooling Issues

#### Webpack/Vite builds fail

**Symptoms:** Module resolution fails, "Can't resolve" errors

**Solutions:**

1. **Update resolver configuration:**

For Vite:
```javascript
// vite.config.js
export default {
  resolve: {
    preserveSymlinks: true  // May be needed for pnpm
  }
}
```

For Webpack:
```javascript
// webpack.config.js
module.exports = {
  resolve: {
    symlinks: true,  // Default, but ensure it's set
    modules: ['node_modules', 'node_modules/.pnpm/node_modules']
  }
}
```

2. **Clear build cache:**
```bash
rm -rf .next dist .cache
pnpm build
```

#### TypeScript can't find modules

**Solution:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "paths": {
      "*": ["node_modules/*"]
    }
  }
}
```

#### ESLint/Prettier plugins not found

**Solution:**
```bash
# Install locally instead of globally
pnpm add -D eslint prettier

# Or use pnpm exec
pnpm exec eslint .
```

### CI/CD Issues

#### "pnpm: command not found" in CI

**GitHub Actions:**
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
```

**Docker:**
```dockerfile
RUN npm install -g pnpm@10.28.0
# OR
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
```

#### Cache not working in CI

**Solution:** Ensure you're using `--frozen-lockfile`:
```bash
pnpm install --frozen-lockfile
```

#### Tests pass locally but fail in CI

**Cause:** Environment differences or caching issues

**Solution:**
```bash
# Clear caches in CI
pnpm store prune

# Use fresh install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Package Scripts Issues

#### Lifecycle scripts not running

**Cause:** pnpm requires explicit enabling for some lifecycle scripts

**Solution:**
```ini
# .npmrc
enable-pre-post-scripts=true
```

#### pre/post hooks in wrong order

**Cause:** pnpm runs scripts in a specific order

**Documentation:** See `install_command.md` for lifecycle order

#### Scripts can't find binaries

**Solution:** Use `pnpm exec` or `npx`-like behavior:
```bash
pnpm exec <command>
# or add to PATH in script
export PATH="$(pnpm bin):$PATH"
```

### Performance Issues

#### First install is slow

**Normal:** First install with pnpm downloads and caches packages. Subsequent installs will be much faster due to:

- Global content-addressable store
- Hard links instead of copying
- Strict deduplication

#### Install is slower than npm

**Possible causes:**

1. **Large number of small packages:** pnpm overhead per package
2. **Network issues:** pnpm makes more requests
3. **Cache not configured:**

```ini
# .npmrc
store-dir=~/.pnpm-store
```

### Native Modules

#### Native module builds fail

**Cause:** pnpm's isolated structure confuses node-gyp

**Solution:**
```bash
# Rebuild native modules
pnpm rebuild

# Or install with build scripts enabled
pnpm install --ignore-scripts=false
```

#### Electron apps not working

**Solution:**
```bash
# Use electron-rebuild with pnpm
pnpm add -D electron-rebuild
pnpm exec electron-rebuild
```

### Workspace-Specific Issues

#### Workspace dependencies not linking

**Diagnosis:**
```bash
pnpm list --depth=0
```

**Solution:**
1. Check `pnpm-workspace.yaml` syntax
2. Verify package names in `package.json`
3. Use `workspace:*` protocol explicitly

#### Circular workspace dependencies

**Error:** "Cannot resolve circular dependency"

**Solution:** Restructure packages to break the cycle:

1. Extract shared code to a separate package
2. Use dependency inversion
3. Consider if you actually need circular deps (usually a design smell)

### Lockfile Issues

#### pnpm-lock.yaml has conflicts

**Solution:**
```bash
# Regenerate from scratch
rm pnpm-lock.yaml
pnpm install

# Or import fresh from npm
pnpm import
```

#### Lockfile out of sync with package.json

**Solution:**
```bash
pnpm install --force  # WARNING: reads package.json only
```

### Version-Specific Issues (pnpm 10.x)

#### Stricter git dependency security (10.26+)

**Error:** Git-hosted dependencies blocked from running prepare scripts

**Solution:**
```json
// .npmrc
{
  "onlyBuiltDependencies": [
    "esbuild",
    "your-git-package"
  ]
}
```

Or use new `allowBuilds`:
```json
{
  "allowBuilds": {
    "esbuild": true,
    "suspicious-package": false
  }
}
```

#### Exotic tarball dependencies blocked (10.26+)

**Error:** "blockExoticSubdeps" setting prevents transitive tarballs

**Solution:**
```ini
# .npmrc (not recommended for security)
block-exotic-subdeps=false

# Or explicitly allow specific packages
allowBuilds:
  your-package: true
```

### Getting Help

If issues persist:

1. **Check the official docs:** https://pnpm.io
2. **Search issues:** https://github.com/pnpm/pnpm/issues
3. **Ask on Discord:** https://pnpm.io/pnpm/discord
4. **Create minimal reproduction:** Isolate the issue to a single dependency

### Diagnostic Commands

```bash
# Check pnpm version
pnpm --version

# Check store location
pnpm store path

# Validate lockfile
pnpm install --frozen-lockfile --dry-run

# List all dependencies
pnpm list --depth=0

# Check why a package is installed
pnpm why <package>

# Check for outdated
pnpm outdated

# Audit for vulnerabilities
pnpm audit
```
