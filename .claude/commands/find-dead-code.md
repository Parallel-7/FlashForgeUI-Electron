# Find Dead Code

Analyze the codebase using Knip to identify unused code, dependencies, and exports.

## Overview
This command uses **Knip** - a comprehensive dead code detection tool that analyzes TypeScript projects to find unused files, exports, dependencies, and more. Knip is specifically configured for this Electron application's multi-entry-point architecture.

## Available npm Scripts

Before running the analysis, familiarize yourself with these Knip commands:

- `npm run knip` - Run complete analysis (all issue types)
- `npm run knip:fix` - Auto-fix unused exports and dependencies
- `npm run knip:production` - Analyze production code only
- `npm run knip:exports` - Focus on unused exports only
- `npm run knip:dependencies` - Focus on dependencies and devDependencies
- `npm run knip:files` - Focus on unused files only

## Step 1: Run Knip Analysis

Execute the full analysis:

```bash
npm run knip
```

Knip will report several categories of issues:
- **Unused files**: Complete files never imported
- **Unused exports**: Exported symbols never used
- **Unused dependencies**: npm packages in package.json not imported
- **Unused devDependencies**: Dev packages not used
- **Unused exported members**: Class/enum members never accessed
- **Unlisted binaries**: Binaries used in scripts but not in dependencies
- **Unresolved imports**: Import statements that can't be resolved

## Step 2: Understand the Configuration

The project's `knip.json` is configured for Electron's multi-process architecture:

```json
{
  "entry": [
    "src/index.ts",              // Main process
    "src/renderer.ts",           // Main renderer
    "src/preload.ts",            // Main preload
    "src/ui/**/*-preload.ts",    // All UI preload scripts
    "src/ui/**/*-renderer.ts",   // All UI renderer scripts
    "src/webui/server/WebUIManager.ts",  // WebUI server
    "src/webui/static/app.ts"    // WebUI client
  ]
}
```

**Known Ignores:**
- `ff-api` and `slicer-meta` - Local file dependencies, always flagged incorrectly
- `powershell` - Windows binary used in npm scripts
- Jest/ESLint config imports - Test infrastructure

## Step 3: Categorize Findings

When analyzing Knip output, categorize each finding:

### ✅ SAFE TO DELETE (High Confidence)

**Criteria:**
- Files with no imports AND no dynamic loading patterns
- Dependencies confirmed not imported anywhere
- Exports used only within their own file (with `ignoreExportsUsedInFile` off)
- Validation/utility code with no usages found

**Example Safe Deletions:**
- Backward compatibility modules (like `printer-polling.ts`)
- Completely unused utility files
- npm packages not imported anywhere

### ⚠️ NEEDS MANUAL REVIEW (Medium Confidence)

**Criteria:**
- Exports that might be used via IPC from renderer to main process
- Utility functions that look reusable but currently unused
- Type definitions that might be imported as types only
- Dependencies that might be peer dependencies or transitive
- Exports from barrel files (index.ts) that re-export

**Common Patterns Needing Review:**
- IPC handler exports
- Preload API exports
- Component base classes/interfaces
- Error utilities and validators
- Schema definitions

### ❌ FALSE POSITIVES (Keep These)

**Criteria (these are already in ignorePatterns):**
- `ff-api` and `slicer-meta` local dependencies
- `powershell` binary
- Test infrastructure imports

**Additional Known False Positives:**
- Class members used in subclasses
- Enum members accessed dynamically
- Type-only imports/exports

## Step 4: Verify High-Impact Changes

Before deleting files or dependencies, verify:

### 4.1 For Unused Files
```bash
# Search for dynamic imports or requires
grep -r "filename" src/

# Check if it's a module entry point
grep "filename" package.json tsconfig.json webpack.config.js
```

### 4.2 For Unused Dependencies
```bash
# Verify not imported
grep -r "from 'package-name'" src/
grep -r "require('package-name')" src/

# Check if it's a peer dependency or type package
npm ls package-name
```

### 4.3 For Unused Exports
```bash
# Check if used via IPC
grep -r "ExportName" src/ipc/
grep -r "ExportName" src/ui/

# Check if it's a type export
grep -r "import type.*ExportName" src/
```

## Step 5: Use Auto-Fix Carefully

Knip's `--fix` flag can automatically remove unused code:

```bash
# Preview what would be fixed
npm run knip

# Apply fixes (USE WITH CAUTION)
npm run knip:fix
```

**IMPORTANT:** Always:
1. Review `npm run knip` output first
2. Commit current work before running `--fix`
3. Test thoroughly after auto-fixing
4. Use `git diff` to review all changes

## Step 6: Generate Report

Present findings in this format:

```markdown
# Dead Code Analysis Report

**Analysis Date:** [timestamp]
**Tool Used:** Knip v5.64.1
**Configuration:** knip.json (Electron multi-entry-point)

---

## Summary

- Unused files: [count]
- Unused exports: [count]
- Unused dependencies: [count]
- Unused devDependencies: [count]

---

## 🗑️ SAFE TO DELETE (High Confidence)

### Complete Files ([count])
1. `file.ts` - [reason: no imports, no dynamic loading, confirmed unused]

### Dependencies ([count])
1. `package-name` - [reason: not imported, not in peer deps]

### Exports ([count])
- `ExportName` from `file.ts:line` - [reason: only used in own file]

---

## ⚠️ NEEDS MANUAL REVIEW ([count])

### Exports That Might Be IPC-Related
- `HandlerFunction` from `ipc/handlers.ts:45` - Check if called from renderer

### Utility Exports
- `helperFunction` from `utils/helpers.ts:20` - Might be needed later

---

## ❌ FALSE POSITIVES (Already Ignored)

- ff-api, slicer-meta - Local file dependencies
- powershell - Windows binary
- [any others discovered]

---

## Recommended Actions

1. **Immediate cleanup**: [list safe files/deps to remove]
2. **Manual review**: [list items needing investigation]
3. **Configuration updates**: [any knip.json adjustments needed]

**Next Steps:**
- Delete safe files manually: `rm file1.ts file2.ts`
- Remove unused deps: `npm uninstall package1 package2`
- Or use auto-fix: `npm run knip:fix` (review with git diff after)
```

## Critical Rules

**Configuration is Already Tuned:**
- All Electron entry points are configured
- Known false positives are ignored
- Preload/renderer files are entry points (not flagged as unused)

**Manual Verification Still Needed For:**
- Exports that cross process boundaries (main ↔ renderer via IPC)
- Dynamic imports or requires
- Barrel exports (index.ts re-exports)
- Type-only exports

**Never Auto-Fix Without Review:**
- Always run `npm run knip` first
- Commit before using `--fix`
- Test the app after changes
- Review `git diff` carefully

## Common Electron Patterns

### IPC Handlers (Often Flagged as Unused)
IPC handlers are registered dynamically and exports might be flagged:
```typescript
// This export might show as unused
export function handleSomething() { ... }

// But it's used here
ipcMain.handle('something', handleSomething);
```

### Preload APIs (False Positives)
Preload scripts expose APIs to renderer, but usage crosses process boundaries:
```typescript
// Preload exports might be flagged
export interface MyAPI { ... }

// But it's used in renderer process
window.myAPI.doThing();
```

### Component Exports (Check Carefully)
Base components might export interfaces/types used by subclasses:
```typescript
// Might be flagged but actually used
export interface ComponentConfig { ... }

// Used by all component implementations
class MyComponent implements ComponentConfig { ... }
```

## Success Criteria

A successful analysis:
1. Identifies real dead code to delete
2. Minimizes false positives through proper configuration
3. Provides actionable recommendations
4. Maintains app functionality after cleanup

## Troubleshooting

**If Knip reports too many false positives:**
1. Check if entry points are configured correctly in `knip.json`
2. Verify `ignoreDependencies` includes local packages
3. Add specific exports to `ignoreExports` if needed

**If Knip misses actual dead code:**
1. Remove entries from `ignore` patterns
2. Use `--include` flags to focus on specific issue types
3. Check if files are accidentally in entry patterns

Remember: **Knip is a powerful tool, but Electron's dynamic nature means manual verification is essential for high-confidence deletions.**
