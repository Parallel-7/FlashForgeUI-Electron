Fix lint errors

You must assist the user with linter errors in the codebase. If they want you to focus on something , it will appear here : #$ARGUMENTS

If the user has given you specific things to focus on , like existing linter output, steps 1-2 should be skipped.
If the user has NOT given you anything to focus on, start from step 1

## Step 1: Run Lint Check
Execute `npm run lint` to identify all linting errors in the codebase.

## Step 2: Analyze Results
- **If NO errors**: Congratulate the user briefly on maintaining a lint-error-free project
- **If errors exist**: Proceed to comprehensive error analysis

## Step 3: Error Analysis (when errors exist)
For each linting error:

1. **Read the affected file(s)** to understand the context and actual code
2. **Identify root cause** - don't just look at the error message, understand WHY the linter is complaining
3. **Categorize the error type**:
   - Unused imports/variables (may indicate dead code)
   - Type safety issues (missing types, unsafe any usage)
   - Code style violations (formatting, naming conventions)
   - Logic errors (unreachable code, infinite loops)
   - Security concerns (unsafe patterns)

## Step 4: Remediation Planning
Create a structured plan that:

1. **Groups similar errors** for efficient batch fixing
2. **Prioritizes by severity**: Security > Logic > Types > Style > Cosmetic
3. **Explains the actual fix needed** (not just "satisfy the linter")
4. **Identifies if any errors indicate larger architectural issues**

## Step 5: Present Plan to User
Format the analysis as:

```
## Lint Analysis Results

### Error Categories Found:
- [Category]: X errors
- [Category]: Y errors

### Remediation Plan:
1. **High Priority** - [Specific fixes needed and why]
2. **Medium Priority** - [Specific fixes needed and why]
3. **Low Priority** - [Specific fixes needed and why]

### Recommended Approach:
[Step-by-step implementation strategy]
```

## Critical Rules:
- **NEVER add eslint-disable comments** without explicit user approval as absolute last resort
- **NEVER blindly remove code** just to satisfy linter - understand why it exists first
- **ALWAYS explain the underlying cause**, not just the surface-level fix
- **ASK USER for approval** before implementing fixes if unsure about intended behavior
- **Use TodoWrite tool** to track remediation progress if implementing fixes

## Tools to Use:
- `Bash` for running npm run lint
- `Read` for examining source files with errors
- `Grep` for searching patterns across codebase if needed
- `TodoWrite` for tracking remediation steps
- Specialized agents like `unused-code-analyzer` if appropriate

Remember: The goal is intelligent analysis and planning, not just mechanical linter satisfaction.