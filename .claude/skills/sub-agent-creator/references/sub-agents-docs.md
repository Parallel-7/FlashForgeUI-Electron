# Subagents Documentation

Source: https://code.claude.com/docs/en/sub-agents

## Overview

Subagents are specialized AI assistants that handle specific types of tasks. Each subagent runs in its own context window with a custom system prompt, specific tool access, and independent permissions. When Claude encounters a task that matches a subagent's description, it delegates to that subagent, which works independently and returns results.

Subagents help you:
- Preserve context by keeping exploration and implementation out of your main conversation
- Enforce constraints by limiting which tools a subagent can use
- Reuse configurations across projects with user-level subagents
- Specialize behavior with focused system prompts for specific domains
- Control costs by routing tasks to faster, cheaper models like Haiku

Claude uses each subagent's description to decide when to delegate tasks. When you create a subagent, write a clear description so Claude knows when to use it.

## Built-in Subagents

### Explore
A fast, read-only agent optimized for searching and analyzing codebases.
- **Model**: Haiku (fast, low-latency)
- **Tools**: Read-only tools (denied access to Write and Edit tools)
- **Purpose**: File discovery, code search, codebase exploration

### Plan
A research agent used during plan mode to gather context before presenting a plan.
- **Model**: Inherits from main conversation
- **Tools**: Read-only tools (denied access to Write and Edit tools)
- **Purpose**: Codebase research for planning

### General-purpose
A capable agent for complex, multi-step tasks that require both exploration and action.
- **Model**: Inherits from main conversation
- **Tools**: All tools
- **Purpose**: Complex research, multi-step operations, code modifications

## Subagent File Structure

Subagents are defined in Markdown files with YAML frontmatter. Store them in `.claude/agents/` for project-level agents.

```
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```

## Frontmatter Fields

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | Unique identifier using lowercase letters and hyphens |
| `description` | Yes | When Claude should delegate to this subagent |
| `tools` | No | Tools the subagent can use. Inherits all tools if omitted |
| `disallowedTools` | No | Tools to deny, removed from inherited or specified list |
| `model` | No | Model to use: `sonnet`, `opus`, `haiku`, or `inherit`. Defaults to `inherit` |
| `permissionMode` | No | Permission mode: `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, or `plan` |
| `skills` | No | Skills to load into the subagent's context at startup |
| `hooks` | No | Lifecycle hooks scoped to this subagent |

## CRITICAL: Formatting Requirements

These formatting rules MUST be followed strictly or the subagent will fail to load:

### 1. Description - MUST be single line
The `description` field MUST be a single line of text. Multi-line descriptions will cause validation failure.

```yaml
# CORRECT - Single line
description: Expert code reviewer. Use proactively after code changes.

# INCORRECT - Multi-line
description: |
  Expert code reviewer.
  Use proactively after code changes.
```

### 2. Prompt/Body - No literal \n characters
The system prompt (markdown body) must NOT contain literal `\n` escape sequences. Use actual newlines instead.

```yaml
# CORRECT - Actual newlines
---
name: test-runner
description: Run tests after code changes
---

You are a test runner. When invoked:
1. Run the test suite
2. Report failures

# INCORRECT - Literal \n
---
name: test-runner
description: Run tests after code changes
---

You are a test runner. When invoked:\n1. Run the test suite\n2. Report failures
```

### 3. Color field (if using)
If specifying a color for the subagent, ONLY these values are allowed:
- red
- blue
- green
- yellow
- purple
- orange
- pink
- cyan

Any other color value will cause the subagent to fail validation and not be loaded.

### 4. Model field
Allowed values: `sonnet`, `opus`, `haiku`, or `inherit`. Default is `inherit` if not specified.

### 5. Tools field
Tools should be comma-separated on a single line:
```yaml
tools: Read, Write, Edit, Bash, Grep, Glob
```

## Tool Restrictions

### Available Tools
Subagents can use any of Claude Code's internal tools. To restrict tools, use the `tools` field (allowlist) or `disallowedTools` field (denylist):

```yaml
---
name: safe-researcher
description: Research agent with restricted capabilities
tools: Read, Grep, Glob, Bash
disallowedTools: Write, Edit
---
```

### Default Behavior
- If `tools` is omitted, subagent inherits ALL tools from the main conversation
- This is the recommended approach for most custom subagents

## Model Selection

- `inherit`: Use the same model as the main conversation (default)
- `sonnet`: Capable model for complex tasks
- `opus`: Most capable model for difficult reasoning
- `haiku`: Fast, low-latency model for simple tasks

For most subagents, omit the `model` field to use `inherit`.

## Permission Modes

| Mode | Behavior |
| --- | --- |
| `default` | Standard permission checking with prompts |
| `acceptEdits` | Auto-accept file edits |
| `dontAsk` | Auto-deny permission prompts (explicitly allowed tools still work) |
| `bypassPermissions` | Skip all permission checks |
| `plan` | Plan mode (read-only exploration) |

## Skills Field

Use the `skills` field to inject skill content into a subagent's context at startup:

```yaml
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---
```

The full content of each skill is injected into the subagent's context. Subagents don't inherit skills from the parent conversation; you must list them explicitly.

## Hooks

Subagents can define hooks that run during the subagent's lifecycle:

| Event | Matcher input | When it fires |
| --- | --- | --- |
| `PreToolUse` | Tool name | Before the subagent uses a tool |
| `PostToolUse` | Tool name | After the subagent uses a tool |
| `Stop` | (none) | When the subagent finishes |

```yaml
---
name: code-reviewer
description: Review code changes with automatic linting
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh $TOOL_INPUT"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/run-linter.sh"
---
```

## Automatic Delegation

Claude automatically delegates tasks based on:
- The task description in your request
- The `description` field in subagent configurations
- Current context

To encourage proactive delegation, include phrases like "use proactively" in your subagent's `description` field.

## Subagent Locations

| Location | Scope | Priority |
| --- | --- | --- |
| `.claude/agents/` | Current project | 2 |
| `~/.claude/agents/` | All your projects | 3 |
| Plugin's `agents/` directory | Where plugin is enabled | 4 (lowest) |

## Example Subagents

### Code Reviewer
```yaml
---
name: code-reviewer
description: Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code.
tools: Read, Grep, Glob, Bash
model: inherit
---

You are a senior code reviewer ensuring high standards of code quality and security.

When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately

Review checklist:
- Code is clear and readable
- Functions and variables are well-named
- No duplicated code
- Proper error handling
- No exposed secrets or API keys
- Input validation implemented
- Good test coverage
- Performance considerations addressed

Provide feedback organized by priority:
- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (consider improving)

Include specific examples of how to fix issues.
```

### Debugger
```yaml
---
name: debugger
description: Debugging specialist for errors, test failures, and unexpected behavior. Use proactively when encountering any issues.
tools: Read, Edit, Bash, Grep, Glob
---

You are an expert debugger specializing in root cause analysis.

When invoked:
1. Capture error message and stack trace
2. Identify reproduction steps
3. Isolate the failure location
4. Implement minimal fix
5. Verify solution works

Debugging process:
- Analyze error messages and logs
- Check recent code changes
- Form and test hypotheses
- Add strategic debug logging
- Inspect variable states

For each issue, provide:
- Root cause explanation
- Evidence supporting the diagnosis
- Specific code fix
- Testing approach
- Prevention recommendations

Focus on fixing the underlying issue, not the symptoms.
```
