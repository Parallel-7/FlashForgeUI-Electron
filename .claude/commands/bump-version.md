# Bump Version Command

You are helping the user bump the version number for FlashForgeUI-Electron. This command handles both alpha (prerelease) and stable version bumps.

## Critical Version Rules (from CLAUDE.md Recent Lessons #9)

**NEVER continue alpha versions after a stable release!**

Semver treats stable versions as newer than prereleases with the same base (1.0.3 > 1.0.3-alpha.X).

Correct flow:
```
1.0.3-alpha.1 → 1.0.3-alpha.2 → 1.0.3 (stable)
                                   ↓
1.0.4-alpha.1 → 1.0.4-alpha.2 → 1.0.4 (stable)
```

**WRONG**: 1.0.3 (stable) → 1.0.3-alpha.1 ❌
**RIGHT**: 1.0.3 (stable) → 1.0.4-alpha.1 ✓

## Your Task

1. **Read current version** from `package.json`

2. **Detect release type**:
   - If current version contains `-alpha.X`, it's an **alpha bump**
   - If current version is stable (no suffix), it's a **stable release preparation**
   - Use AskUserQuestion to clarify if ambiguous

3. **Determine new version**:

   **For Alpha Bumps** (e.g., `1.0.3-alpha.1`):
   - Increment the alpha number: `1.0.3-alpha.1` → `1.0.3-alpha.2`

   **For Stable Release** (e.g., `1.0.3-alpha.5` → `1.0.3`):
   - Use AskUserQuestion to confirm: "Ready to release 1.0.3 stable (removing -alpha.5 suffix)?"
   - If confirmed, remove `-alpha.X` suffix: `1.0.3-alpha.5` → `1.0.3`

   **After Stable, Next Alpha** (e.g., `1.0.3` → `1.0.4-alpha.1`):
   - Bump patch version AND add alpha suffix: `1.0.3` → `1.0.4-alpha.1`

4. **Update these files with the new version**:

   a. **package.json**:
      - Update the `"version"` field

   b. **README.md**:
      - Update download links for both alpha and stable releases
      - Alpha link pattern: `https://github.com/GhostTypes/FlashForgeUI-Electron/releases/download/v{VERSION}/FlashForgeUI-Setup-{VERSION}.exe`
      - Stable link pattern: `https://github.com/GhostTypes/FlashForgeUI-Electron/releases/latest/download/FlashForgeUI-Setup-{STABLE_VERSION}.exe`
      - When bumping alpha: update alpha link only
      - When releasing stable: update both alpha link (to next alpha) AND stable link

   c. **CLAUDE.md**:
      - Update the `**Last Updated:**` timestamp at the top of the file
      - Use the `mcp__time__get_current_time` MCP tool with timezone `America/New_York` to get accurate timestamp
      - Format: `**Last Updated:** YYYY-MM-DD HH:mm ET (America/New_York)`

   d. **docs/README.md**:
      - Update any version references in user-facing documentation
      - Update download links similar to main README.md

5. **Summary**:
   - Show the user which files were updated
   - Display old version → new version
   - Remind user to review changes before committing

## Example Interactions

**Alpha Bump:**
```
Current: 1.0.3-alpha.1
New:     1.0.3-alpha.2
Updated: package.json, README.md (alpha link), CLAUDE.md timestamp, docs/README.md
```

**Stable Release:**
```
Current: 1.0.3-alpha.5
Confirm: Ready to release 1.0.3 stable? [User confirms]
New:     1.0.3
Updated: package.json, README.md (stable link), CLAUDE.md timestamp, docs/README.md
```

**After Stable → Next Alpha:**
```
Current: 1.0.3
New:     1.0.4-alpha.1
Updated: package.json, README.md (alpha link), CLAUDE.md timestamp, docs/README.md
```

## Validation

Before finishing:
1. Verify all version strings were updated correctly
2. Ensure no version inconsistencies across files
3. Confirm download links are valid and point to correct releases
4. Show git diff summary to user

## Important Notes

- NEVER go backwards in version numbers
- NEVER continue alpha after stable (e.g., 1.0.3 → 1.0.3-alpha.X is WRONG)
- ALWAYS bump patch when transitioning from stable to next alpha
- Use AskUserQuestion when uncertain about user intent
- Double-check the timestamp uses the MCP time tool, not manual entry
