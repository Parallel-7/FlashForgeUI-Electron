# Trigger Release Build Command

You are helping the user trigger the GitHub Actions workflow to build and release a new version of FlashForgeUI-Electron.

## Workflow Information

**Workflow Name:** "Build and Release Electron App"
**Workflow File:** `release.yml`
**Workflow ID:** 165399194

## Workflow Inputs

The workflow requires TWO inputs:

1. **`version`** (required, text)
   - Description: Version Number (e.g., 1.0.0, 1.0.4-alpha.3)
   - Examples:
     - Stable: `1.0.4`
     - Alpha/Prerelease: `1.0.4-alpha.3`
     - Beta: `1.0.4-beta.1`

2. **`prerelease`** (optional, boolean)
   - Description: Is this a Pre-Release?
   - Options:
     - `true` - Marks as pre-release (alpha, beta, rc, etc.)
     - `false` - Marks as stable release
   - Auto-detect hint: If version contains `-alpha`, `-beta`, `-rc`, etc., suggest `true`

## Your Task

1. **Check current state**:
   - Read `package.json` to see the current version
   - Check if current version contains prerelease suffixes (alpha, beta, rc)

2. **Ask user for workflow inputs**:
   Use `AskUserQuestion` to gather BOTH inputs in a SINGLE call:

   ```
   Questions:
   1. Version number (e.g., 1.0.4, 1.0.4-alpha.3)
   2. Mark as pre-release? (true/false)

   Options for version:
   - Suggest current version from package.json
   - Suggest next version based on common patterns

   Options for prerelease:
   - true (Recommended for alpha/beta/rc)
   - false (For stable releases)
   ```

   **IMPORTANT**: Use a SINGLE `AskUserQuestion` call with 2 questions to gather all inputs at once. Do not ask sequentially.

3. **Validate inputs**:
   - Version format should be valid semver (e.g., `1.0.0`, `1.0.4-alpha.3`)
   - If version contains `-alpha`, `-beta`, `-rc`, prerelease should be `true`
   - If version is plain (no suffix), prerelease should typically be `false`

4. **Confirm before triggering**:
   - Display the complete workflow command that will be run
   - Show what will be built (version, prerelease status, platforms)
   - Ask: "Ready to trigger the workflow?"

5. **Trigger the workflow**:
   After user confirms, execute:
   ```bash
   gh workflow run release.yml --ref alpha -f version=<VERSION> -f prerelease=<PRERELEASE>
   ```

6. **Monitor and report**:
   - Show the workflow run URL
   - Provide commands to monitor progress:
     ```bash
     gh run list --workflow release.yml --limit 1
     gh run watch
     gh run view --web
     ```
   - Inform user about build time (~5 minutes)

## What the Workflow Does

- **Platforms**: Builds for Windows, macOS, and Linux
- **Artifacts**:
  - Windows: `.exe` installer
  - macOS: `.dmg` package
  - Linux: `.AppImage`, `.deb`, `.rpm`
  - Update manifests: `latest*.yml`
- **GitHub Release**:
  - Creates tag: `v<VERSION>`
  - Creates release with all build artifacts
  - Marks as prerelease if `prerelease=true`

## Branch Selection

- Default branch: `alpha` (use `--ref alpha`)
- For stable releases, user may want to merge to `main` first
- Ask if they want to use a different branch if not on alpha

## Example Interactions

**Alpha Release:**
```
User: /trigger-release-build

Current version from package.json: 1.0.4-alpha.3

[AskUserQuestion with 2 questions]
User answers:
1. Version: 1.0.4-alpha.3
2. Prerelease: true

Command to run:
gh workflow run release.yml --ref alpha -f version=1.0.4-alpha.3 -f prerelease=true

This will:
- Build v1.0.4-alpha.3 as a pre-release
- Create tag v1.0.4-alpha.3
- Build for Windows, macOS, Linux
- Upload artifacts to release

Confirm? [User confirms]
[Trigger workflow]
```

**Stable Release:**
```
User: /trigger-release-build

Current version from package.json: 1.0.4

[AskUserQuestion with 2 questions]
User answers:
1. Version: 1.0.4
2. Prerelease: false

Command to run:
gh workflow run release.yml --ref main -f version=1.0.4 -f prerelease=false

This will:
- Build v1.0.4 as stable release
- Create tag v1.0.4
- Build for Windows, macOS, Linux
- Upload artifacts to release

Confirm? [User confirms]
[Trigger workflow]
```

## Error Handling

- If workflow trigger fails, check:
  - User has `gh` CLI installed and authenticated
  - User has write permissions to the repo
  - The branch exists and is accessible
  - Workflow file exists in `.github/workflows/release.yml`

## Important Notes

- **Workflow takes ~5 minutes** to complete all platform builds
- **Artifacts are NOT immediately available** - must wait for build completion
- **Always verify version format** before triggering
- **Check branch** - alpha branch for prereleases, main for stable (typically)
- **Monitor after trigger** - provide commands for user to track progress
