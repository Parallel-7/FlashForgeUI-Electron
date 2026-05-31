# Lint Check and Codebase Cleaning Workflow

A comprehensive lint resolution workflow that analyzes, categorizes, and fixes all Biome lint errors using parallel code-cleaner agents, followed by specialist review.

## Instructions

Execute the complete codebase cleaning workflow to resolve all lint errors with zero regression.

### Phase 1: Initial Lint Check

Run `npm run lint` to check for lint errors.

**If NO errors found**: Exit early and inform the user that all lint checks pass.

**If errors found**: Proceed to Phase 2.

### Phase 2: ASCII Table Report

Generate a clean ASCII table formatted report of all lint issues. Format as:

```
+--------------------------+----------------------+------------------+------------------------+
| File                     | Rule                 | Severity         | Line(s)                |
+--------------------------+----------------------+------------------+------------------------+
| src/main/example.ts      | noUnusedVariables    | warn             | 15, 23                 |
| src/renderer/foo.ts      | noDoubleEquals       | error            | 42                     |
+--------------------------+----------------------+------------------+------------------------+
Total Errors: 42 | Total Warnings: 8 | Files Affected: 15
```

Include:
- File path (truncated if too long)
- Lint rule name
- Severity (error/warn)
- Line numbers
- Summary totals at bottom

### Phase 3: User Interview

Use AskUserQuestion to present the findings and get approval. Ask:

1. **Confirm to proceed**: "Found X lint errors across Y files. Proceed with automated cleanup?"

2. **Parallelization strategy**: "Work can be split into Z groups. How would you like to proceed?"
   - Option A: "Full parallel - Use multiple code-cleaner agents simultaneously on different file groups"
   - Option B: "Sequential - Process one group at a time for maximum safety"
   - Option C: "Manual review - Let me approve each group individually"

### Phase 4: Group Partitioning (CRITICAL: ZERO OVERLAP)

Split the work into groups with **ZERO file overlap**. Each file must belong to exactly one group.

**Suggested partitioning strategies** (choose based on error distribution):

#### By Directory:
- Group 1: `src/main/**/*.ts` (main process)
- Group 2: `src/preload/**/*.ts` (preload scripts)
- Group 3: `src/renderer/**/*.ts` (renderer process)
- Group 4: `src/shared/**/*.ts` (shared code)
- Group 5: Config files and root level

#### By Rule Category:
- Group 1: All `complexity/*` errors
- Group 2: All `correctness/*` errors
- Group 3: All `style/*` errors
- Group 4: All `suspicious/*` errors

#### By File Count (for even distribution):
- Divide files evenly among N groups (e.g., 5 files per group)

**IMPORTANT**: List exactly which files are in each group before starting. Never have two agents working on the same file.

### Phase 5: Parallel Execution

Launch multiple code-cleaner agents in parallel using the Task tool. Each agent gets:

- **Exact list of files** to process (no overlap)
- **Specific lint rules** to focus on (if partitioning by rule)
- **Clear scope boundaries**

Example parallel launch:
```
Task: code-cleaner agent for Group 1 (files: src/main/foo.ts, src/main/bar.ts)
Task: code-cleaner agent for Group 2 (files: src/renderer/baz.ts, src/renderer/qux.ts)
```

**Wait for ALL agents to complete** before proceeding.

### Phase 6: Specialist Final Pass

After all code-cleaner agents complete, launch TWO specialists in parallel:

1. **electron-specialist** - Review all changes in:
   - Main process files (`src/main/`)
   - Preload scripts (`src/preload/`)
   - IPC handlers
   - Electron-specific code

2. **typescript-specialist** - Review all changes in:
   - Type definitions
   - Complex type issues
   - TypeScript configuration consistency
   - Overall type safety

Each specialist should:
- Verify no behavioral regressions
- Check code quality and patterns
- Ensure production-ready standards
- Run `npm run type-check` on their scoped files

### Phase 7: Final Validation

Run the complete validation sequence:

```bash
npm run type-check  # Must pass with zero errors
npm run build       # Must build successfully
npm run lint        # Must pass with zero errors
npm run format      # Apply final formatting
```

**Only exit when ALL four commands pass successfully.**

## Completion Report

Provide a final summary:

```
✅ Lint Check Complete

Before: X errors, Y warnings across Z files
After:  0 errors, 0 warnings

Groups Processed: N
Agents Launched: N code-cleaner + 2 specialists

Validation Results:
✅ type-check: PASSED
✅ build: PASSED
✅ lint: PASSED
✅ format: APPLIED
```

## Important Constraints

1. **Zero Overlap**: Never assign the same file to multiple agents
2. **Wait for Completion**: Don't launch phase 6 specialists until all code-cleaners finish
3. **Full Validation**: Don't skip any of the final validation commands
4. **Transparent Reporting**: Always show the user what's happening at each phase
5. **Early Exit**: If lint passes initially, say so and exit immediately

## Error Handling

If any phase fails:
1. Report which phase and what failed
2. Show the error output
3. Ask the user how to proceed (retry/continue/abort)
