Fix an issue (from GitHub)

You must analyze the issue from the user, as well as any additional context they may provide. Their input will be below this line
#$ARGUMENTS

If the user did not give additional context, be sure to ask them any questions to fully understand the issue. If it's clear just from the GitHub issue, 
that's also okay.

If the user did give additional context, be sure to handle that correctly before doing anything else.

## Workflow Steps
1. Get the issue context from the github link, asking any questions to the user if necessary
2. Investigate the issue in the codebase, using the codebase explorer agent, then using sequential thinking to analyze the output of that, and find the "root cause" of the issue
3. Plan clean, simple remediation steps that properly rectify the issue. Present this plan to the user, along with an explanation of why the issue/bug occurs, how you determined the root cause,
and your "reasoning" behind the remediation steps.
4. If the user approves your plan, you may immediatly implement it. After you are complete, be sure to run type checking and linting to ensure code quality. Do NOT use the senior review agent by default, but you CAN
"offer" this to the user after completing type checking and linting. For example , after you either automatically fixed the errors, or have no errors after your work, you can offer to do a "deep review" on the changes with the 
senior review agent.
5. If the user does not approve your plan, you must work interactively with them to fix the plan , or create a new one. Work together with them to realize the solution.
Once the plan is approved, follow the above steps from step 4 to implement and check your work.
6. All done!