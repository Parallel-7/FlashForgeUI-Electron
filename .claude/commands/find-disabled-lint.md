Interactive lint disable rule cleanup

You need to find and fix all ESLint disable rules in the codebase to maintain code quality.

You MUST follow these steps:

1. **Run the lint check**: Execute `npm run lint:check-disabled` to get a list of all files containing ESLint disable rules and their locations.

2. **Evaluate results**:
   - If no disable rules found: Congratulate the user on maintaining excellent codebase quality with zero ESLint disable rules.
   - If disable rules found: Proceed to analysis phase.

3. **Analyze each disable rule** using cognitive tools (first pass):
   - Use sequential-thinking to understand why each disable rule exists
   - Use gemini_collaborate to analyze the context around each disabled rule
   - For each file with disable rules:
     - Read the file to understand the context
     - Identify what ESLint rule is being disabled and why
     - Determine if the disable is justified or if the underlying code should be fixed

4. **Design solutions** using cognitive tools (second pass):
   - Use sequential-thinking to create proper fixes for each disable rule
   - Use gemini_collaborate to validate solution approaches
   - Prioritize solutions that:
     - Fix the underlying code issue rather than keeping the disable
     - Follow project coding standards and best practices
     - Maintain functionality while improving code quality

5. **Present findings and get approval**: Show the user:
   - Total number of disable rules found
   - Each disable rule with its file location and line number
   - The specific ESLint rule being disabled
   - Analysis of why the disable exists
   - Recommended fix for each disable rule
   - Rationale for each proposed solution
   
   **WAIT for user approval before implementing any fixes**. If the user denies or asks for changes, adapt the solutions accordingly and present the revised approach.

6. **Implement fixes** (only after user approval):
   - Fix the underlying code issues
   - Remove the ESLint disable rules
   - Run `npm run lint` to verify fixes work correctly
   - Run `npm run type-check` to ensure TypeScript compilation still passes

7. **Verification**: After implementation:
   - Run `npm run lint:check-disabled` again to confirm all targeted disable rules are removed
   - Run full lint check to ensure no new issues were introduced
   - Update any related tests if necessary

**Important Notes**:
- Some disable rules may be legitimately needed (e.g., for generated code, specific edge cases)
- Always prioritize fixing the root cause over keeping disable rules
- If a disable rule is genuinely needed, document why with a detailed comment
- Maintain backward compatibility and functionality throughout the process