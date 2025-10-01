TypeScript Type Checking

Run TypeScript type checking and fix any issues found.

You MUST follow these steps:

1. Run `npm run type-check` to check for TypeScript errors

2. If there are NO errors:
   - Present a congratulatory message to the user about the project being 100% type-safe
   - Include a brief summary of what was checked (number of files, etc.)

3. If there ARE errors:
   - Use the code context provider tool to get comprehensive information about the areas of the codebase where errors occurred
   - Use sequential-thinking to analyze the situation and locate the root cause of the type errors
   - After locating the root cause, use sequential-thinking again to plan and create a solution that addresses the *root cause*
   - Present the errors found and your proposed fix to the user
   - Once approved, implement the fix
   - Re-run `npm run type-check` to verify the fix worked

4. If the user denies the proposed fix and asks for changes, work interactively with them to design a new solution

5. Always ensure the final result passes type checking before completing the task

Remember: Focus on fixing the root cause of type issues, not just suppressing errors with any/unknown types.