Project Status Overview

Run comprehensive project health checks and present any issues in a structured format.

You MUST follow these steps:

1. Run all project health checks in parallel using the Bash tool:
   - `npm run type-check` to collect TypeScript errors
   - `npm run lint` to collect linting errors/warnings
   - `npm run docs:check` to collect files missing documentation
   - `npm run linecount` to collect information about oversized files

2. Analyze results and present findings:

   **If NO issues are found**:
   - Present a congratulatory message about excellent project health
   - Include brief summary of what was checked
   - Show key metrics (files checked, lines of code, etc.)

   **If issues ARE found**:
   - Present findings in a structured, professional format:
     ```
     ## Project Status Report

     ### TypeScript Issues
     [List any type errors found]

     ### Code Quality Issues  
     [List any linting errors/warnings found]

     ### Documentation Issues
     [List any files missing documentation]

     ### File Size Issues
     [List any oversized files that may need attention]

     ### Recommended Actions
     [Brief list of suggested next steps]
     ```

3. Keep the presentation rapid and focused - NO deep analysis or thinking
4. Do NOT make any code changes - this is strictly informational
5. Present all information clearly and professionally

Remember: You are STRICTLY presenting information to the user rapidly. Focus on clear, structured reporting of project health status.