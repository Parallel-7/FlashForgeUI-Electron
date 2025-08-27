Edit an existing Claude Code agent configuration

You must assist the user with editing an existing agent based on their input: #$ARGUMENTS

**Step 1: Parse the Agent Reference**
Extract the agent name from the user's input. They will mention an agent like `@agent-code-documenter` or similar format. Remove the `@agent-` prefix to get the actual agent filename.

**Step 2: Locate and Read the Agent File**
The agent files are located in `.claude\agents\` directory with the format `{agent-name}.md`. Read the ENTIRE agent file to understand:
- Current agent configuration (name, description, model, color)
- Existing instructions and capabilities
- Current documentation standards and patterns
- Role and responsibilities defined

**Step 3: Analyze Requested Changes**
Parse the user's requested changes and determine:
- What specific aspects need modification (description, instructions, examples, etc.)
- Whether changes align with the agent's core purpose
- How to maintain consistency with existing agent patterns
- Any dependencies on other agents or project-specific knowledge

**Step 4: Apply Changes Systematically**
When editing the agent file:
- Preserve the YAML frontmatter structure (name, description, model, color)
- Update the description if it needs to reflect new capabilities
- Modify or add to the instruction sections as needed
- Update examples to reflect new functionality
- Ensure all changes maintain the agent's coherent identity and purpose
- Keep the professional tone and structured format

**Step 5: Validation and Review**
After making changes:
- Verify the agent file structure is intact
- Confirm all requested modifications were applied
- Ensure instructions are clear and actionable
- Check that examples are relevant and helpful
- Maintain consistency with other agents in the system

**Important Guidelines:**
- Only edit existing agents, do not create new ones unless explicitly requested
- Preserve the agent's core identity while incorporating requested changes
- Maintain the established documentation patterns and formatting
- Ensure changes enhance rather than diminish the agent's effectiveness
- Keep modifications focused and purposeful

The goal is to refine and improve existing agents based on user feedback and evolving project needs while maintaining their effectiveness and consistency within the Claude Code agent ecosystem.