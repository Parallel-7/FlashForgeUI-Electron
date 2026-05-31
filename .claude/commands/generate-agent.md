Generate a new Claude Code agent configuration

You must assist the user with creating a new agent based on their input: #$ARGUMENTS

**Step 1: Understand the Agent Purpose**
Parse the user's description to identify:
- The agent's primary role and specialization
- What types of tasks it should handle
- How it relates to the existing codebase/agents
- Whether there are existing agents with overlapping responsibilities

**Step 2: Gather Agent Details via AskUserQuestion**

First, ask for the agent name:
- Should be kebab-case (e.g., `typescript-specialist`, `api-designer`)
- Short and descriptive of the agent's role

Then, ask for the agent color from ONLY these valid options:
- blue (for backend/core systems)
- cyan (for UI/design work)
- green (for testing/quality)
- yellow (for utilities/tools)
- magenta (for documentation)
- red (for critical/security)

**CRITICAL CONSTRAINTS:**
- Model MUST always be `sonnet`
- Color MUST be one of the 6 values listed above
- Any other values will cause the agent to not be recognized

**Step 3: Apply Project-Specific Guidelines**

Proactively incorporate relevant guidelines from existing agents:

For ANY code-modifying agent:
- Invoke `best-practices` skill for SOLID, DRY, KISS, YAGNI principles
- Include `typescript-best-practices` for TypeScript work
- Reference `vite` skill for build-related tasks

For Electron-related agents:
- Include security model constraints (context isolation, no node integration)
- IPC validation requirements
- Process separation (main/renderer/preload)

For UI-related agents:
- Include dual UI mode (rounded/square) compatibility requirements
- Theme system (no hardcoded colors, use CSS variables)
- Reference existing dialog patterns

For ALL agents:
- @fileoverview documentation requirement
- Development workflow (type-check → build → lint)
- Known pitfalls to avoid based on CLAUDE.md lessons

**Step 4: Build the Agent Content**

Structure the agent file with:

1. **YAML Frontmatter:**
```yaml
---
name: agent-name
description: [Single-line description with inline <example> tags]
model: sonnet
color: [selected-color]
---
```

Description format (match existing agents):
- Start with "Use this agent when..."
- Include 1-3 inline `<example>` tags showing context/usage
- Use format: `<example>Context: [situation]. user: "[input]" assistant: "[response]" <commentary>[reasoning]</commentary></example>`
- Keep the entire description on one line (no \n escapes)

2. **Agent Identity Section:**
- Define who the agent is (senior X, expert Y)
- Core responsibilities
- What makes this agent different from others

3. **Mandatory Skill Invocations:**
List which skills MUST be invoked and in what order

4. **Project Context:**
- Relevant architecture sections from ai_docs/
- Key files this agent will touch
- Important constraints

5. **Quality Standards:**
- Code quality requirements
- What the agent must do/avoid
- Review criteria

6. **Communication Style:**
- How the agent should interact with the user

**Step 5: Write the Agent File**

Create the file at `.claude\agents\{agent-name}.md` with:
- Properly formatted YAML frontmatter
- Comprehensive instructions
- Examples where helpful
- References to project documentation

**Step 6: Validate the Agent**

After creation:
- Verify YAML is valid (no \n escape sequences in description)
- Confirm model is `sonnet`
- Confirm color is one of the 6 valid values
- Check consistency with existing agents
- Ensure the agent has a distinct, non-overlapping purpose

**Important Guidelines:**
- Each agent should have a clear, unique purpose
- Avoid creating agents that overlap significantly with existing ones
- Maintain consistency in tone and structure with existing agents
- Include project-specific context from CLAUDE.md and ai_docs/
- Reference existing patterns and conventions

The goal is to create focused, effective agents that enhance the development workflow while maintaining consistency with the established agent ecosystem.
