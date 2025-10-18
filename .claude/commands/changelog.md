# Generate Professional Changelog

Analyze git changes between two commits and generate a professional changelog suitable for GitHub releases or commit messages.

## Instructions

You are generating a professional changelog from git commit history.

**Arguments**: `#$ARGUMENTS` (optional)
- If one argument provided: Compare that commit/tag to current HEAD
- If two arguments provided: Compare first to second (e.g., `v1.0.0 v2.0.0` or `abc123 def456`)
- If no arguments: Compare last release tag to HEAD (or last 10 commits if no tags)

**Process**:

1. **Determine the commit range**:
   - Parse arguments to identify from/to commits
   - Use `git log` to get commits in range
   - Use `git diff --stat` for file change statistics

2. **Analyze the changes**:
   - Group commits by type using conventional commit prefixes:
     - `feat:`/`feature:` → Features
     - `fix:` → Bug Fixes
     - `refactor:`/`refine:` → Code Improvements
     - `docs:` → Documentation
     - `test:` → Testing
     - `chore:` → Maintenance
     - `perf:` → Performance
     - `style:` → UI/Styling
   - For commits without prefixes, categorize by file patterns and content
   - Identify breaking changes (BREAKING CHANGE in commit body or `!` after type)

3. **Extract meaningful information**:
   - Parse commit messages for context
   - Identify files changed and their significance
   - Detect new features, bug fixes, and improvements
   - Look for dependency updates in package.json changes

4. **Generate professional output**:

   Format as:
   ```markdown
   # Changelog

   ## [Version/Range]

   ### ✨ Features
   - Feature description (commit hash)

   ### 🐛 Bug Fixes
   - Fix description (commit hash)

   ### 🔨 Code Improvements
   - Improvement description (commit hash)

   ### 📚 Documentation
   - Documentation changes (commit hash)

   ### 🧪 Testing
   - Testing changes (commit hash)

   ### 🔧 Maintenance
   - Maintenance items (commit hash)

   ### ⚡ Performance
   - Performance improvements (commit hash)

   ### 🎨 UI/Styling
   - UI/styling changes (commit hash)

   ### ⚠️ Breaking Changes
   - Breaking change description

   ---
   **Statistics**: X files changed, Y insertions(+), Z deletions(-)
   ```

5. **Best practices**:
   - Use bullet points for clarity
   - Keep descriptions concise but informative
   - Include short commit hashes (7 chars) for reference
   - Group related changes together
   - Omit empty sections
   - Use emojis for visual categorization
   - Focus on user-facing changes, not internal implementation details
   - For multiple commits with similar changes, combine into single entry

**Important**:
- Only use git commands (log, diff, show, etc.) - do NOT use Grep, Read, or other file tools
- Output the changelog directly to the terminal for easy copying
- Make it professional and ready to paste into GitHub releases
- If arguments are invalid or range is empty, provide helpful error message
