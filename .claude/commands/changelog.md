# Generate Professional Changelog

Analyze git changes between two commits and generate a professional changelog suitable for GitHub releases or commit messages.

## Instructions

You are generating a professional changelog from git commit history.

**Arguments**: `#$ARGUMENTS` (optional)
- If one argument provided: Compare that commit/tag to current HEAD
- If two arguments provided: Compare first to second (e.g., `v1.0.0 v2.0.0` or `abc123 def456`)
- If no arguments: Compare last release tag to HEAD (or last 10 commits if no tags)

**CRITICAL REQUIREMENTS**:

1. **COMPREHENSIVE ANALYSIS REQUIRED**:
   - You MUST examine EVERY SINGLE COMMIT in the range - no exceptions
   - Use `git log --all` or `git log --no-merges` to ensure you capture all commits
   - Read the FULL commit message for each commit (not just the title)
   - Examine file changes using `git show --stat` or `git diff --name-status` for EACH commit
   - DO NOT skip or summarize commits - each one must be analyzed individually
   - The goal is to capture the FULL SCOPE of ALL work done between the two commits
   - If there are 50 commits, analyze all 50. If there are 500, analyze all 500.

2. **MANDATORY SECTION ORDERING**:
   - **FIRST**: Check for New Features - if any exist, create "✨ New Features" section
   - **SECOND**: Check for Improvements (refactors, enhancements, optimizations - NOT bug fixes) - if any exist, create "🔨 Improvements" section
   - **THIRD**: Check for Bug Fixes - if any exist, create "🐛 Bug Fixes" section
   - **AFTER** these three mandatory sections, you may include additional sections as needed:
     - 📚 Documentation
     - 🧪 Testing
     - 🔧 Maintenance
     - ⚡ Performance
     - 🎨 UI/Styling
     - ⚠️ Breaking Changes
   - Omit sections that have no content

**Process**:

1. **Determine the commit range**:
   - Parse arguments to identify from/to commits
   - Use `git log` to get ALL commits in range (consider using `--no-merges` to avoid merge commits)
   - Use `git diff --stat` for file change statistics
   - Count total commits to ensure you process them all

2. **Analyze EVERY SINGLE CHANGE**:
   - Process each commit individually - DO NOT skip any
   - Group commits by type using conventional commit prefixes:
     - `feat:`/`feature:` → New Features
     - `fix:` → Bug Fixes
     - `refactor:`/`refine:`/`improve:` → Improvements
     - `docs:` → Documentation
     - `test:` → Testing
     - `chore:` → Maintenance
     - `perf:` → Performance
     - `style:` → UI/Styling
   - For commits without prefixes, categorize by analyzing:
     - The full commit message (not just the first line)
     - Files changed and their patterns
     - Code diff content if needed
   - Identify breaking changes (look for `BREAKING CHANGE:` in commit bodies)

3. **Extract meaningful information**:
   - Parse FULL commit messages, not just titles
   - Identify all files changed and their significance
   - Detect new features, bug fixes, and improvements across ALL commits
   - Look for dependency updates in package.json changes
   - Note architectural or structural changes
   - Capture any performance optimizations

4. **Generate professional output**:

   Format as:
   ```markdown
   # Changelog

   ## [Version/Range]

   ### ✨ New Features
   - Feature description (commit hash)

   ### 🔨 Improvements
   - Improvement description (commit hash)

   ### 🐛 Bug Fixes
   - Fix description (commit hash)

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
   **Commits analyzed**: N total commits
   ```

5. **Best practices**:
   - Use bullet points for clarity
   - Keep descriptions concise but informative
   - Include short commit hashes (7 chars) for reference
   - Group related changes together when appropriate
   - Use emojis for visual categorization
   - Focus on user-facing changes, not internal implementation details
   - For multiple commits with similar changes, you may combine into single entry
   - Always include commit count in statistics to verify comprehensive analysis

**Important**:
- Only use git commands (log, diff, show, etc.) - do NOT use Grep, Read, or other file tools
- Output the changelog directly to the terminal for easy copying
- Make it professional and ready to paste into GitHub releases
- If arguments are invalid or range is empty, provide helpful error message
- VERIFY you have analyzed every commit by checking commit count matches your sections
