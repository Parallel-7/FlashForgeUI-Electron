ESLint Code Quality Checking

Run ESLint code quality checking and fix any issues found.

You MUST follow these steps:

1. Run `npm run lint` to check for linting errors

2. If there are NO errors:
   - Present a congratulatory message to the user about the project having excellent code quality
   - Include a brief summary of what was checked

3. If there ARE errors:
   - First, attempt automatic fixes by running `npm run lint:fix` (no user confirmation needed)
   - Run `npm run lint` again to check if auto-fix resolved the issues
   
   If auto-fix RESOLVED all issues:
   - Present what was automatically fixed to the user
   - Show a nice message about the project now having good code quality
   
   If auto-fix did NOT resolve all remaining issues:
   - Use the code context provider tool to get comprehensive information about the areas of the codebase where errors occurred
   - Use sequential-thinking to analyze the situation and locate the root cause of the linting errors
   - After locating the root cause, use sequential-thinking again to plan and create a solution that addresses the *root cause*
   - Present the remaining errors found and your proposed fix to the user
   - Once approved, implement the fix
   - Re-run `npm run lint` to verify the fix worked

4. If the user denies the proposed fix and asks for changes, work interactively with them to design a new solution

5. Always ensure the final result passes linting before completing the task

Remember: Focus on improving code quality and following established patterns, not just disabling lint rules.