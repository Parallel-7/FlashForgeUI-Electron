# Configuration Reference

Complete configuration documentation for gemini-cli.

## Configuration Layers (Precedence)

Configuration is applied in order (higher numbers override lower):
1. Default values (hardcoded)
2. System defaults file
3. User settings file (`~/.gemini/settings.json`)
4. Project settings file (`.gemini/settings.json`)
5. System settings file (override)
6. Environment variables (including `.env` files)
7. Command-line arguments

## Settings File Locations

| File | Location | Scope |
|------|----------|-------|
| System defaults | `/etc/gemini-cli/system-defaults.json` (Linux) | Base defaults for all users |
| User settings | `~/.gemini/settings.json` | All sessions for current user |
| Project settings | `.gemini/settings.json` | Current project only |
| System override | `/etc/gemini-cli/settings.json` (Linux) | Overrides all other files |

## Environment Variables

String values in `settings.json` can reference environment variables:
```json
{
  "someKey": "$MY_API_TOKEN",
  "otherKey": "${ANOTHER_VAR}"
}
```

## Key Settings Categories

### General Settings
```json
{
  "general": {
    "previewFeatures": false,
    "preferredEditor": "code",
    "vimMode": false,
    "enableAutoUpdate": true,
    "checkpointing": { "enabled": false },
    "enablePromptCompletion": false
  }
}
```

### Model Settings
```json
{
  "model": {
    "name": "gemini-3-flash-preview",
    "maxSessionTurns": -1,
    "compressionThreshold": 0.5
  }
}
```

### Output Settings
```json
{
  "output": {
    "format": "text"
  }
}
```

### Tool Settings
```json
{
  "tools": {
    "sandbox": false,
    "autoAccept": false,
    "approvalMode": "default",
    "allowed": ["run_shell_command(git)", "run_shell_command(npm test)"],
    "useRipgrep": true,
    "enableToolOutputTruncation": true
  }
}
```

Approval modes:
- `default` - Prompts for approval
- `auto_edit` - Auto-approves edit tools
- `plan` - Read-only mode

### Security Settings
```json
{
  "security": {
    "disableYoloMode": false,
    "enablePermanentToolApproval": false,
    "environmentVariableRedaction": {
      "enabled": false,
      "allowed": [],
      "blocked": []
    }
  }
}
```

### MCP Server Settings
```json
{
  "mcp": {
    "serverCommand": "npx my-mcp-server",
    "allowed": ["server1", "server2"],
    "excluded": ["server3"]
  }
}
```

### Context/Memory Settings
```json
{
  "context": {
    "fileName": "GEMINI.md",
    "discoveryMaxDirs": 200,
    "includeDirectories": ["../shared-libs"],
    "fileFiltering": {
      "respectGitIgnore": true,
      "respectGeminiIgnore": true,
      "enableRecursiveFileSearch": true,
      "enableFuzzySearch": true
    }
  }
}
```

### Privacy Settings
```json
{
  "privacy": {
    "usageStatisticsEnabled": true
  }
}
```

### Experimental Features
```json
{
  "experimental": {
    "enableAgents": false,
    "jitContext": false,
    "skills": false,
    "plan": false
  }
}
```

## Context Files (GEMINI.md)

Context files provide project-specific instructions. Loaded from:
1. Global: `~/.gemini/GEMINI.md`
2. Project root and ancestors
3. Subdirectories (up to 200 dirs)

### Example GEMINI.md
```markdown
# Project Overview
This is a Node.js microservice for user authentication.

## Architecture
- Express.js REST API
- PostgreSQL database
- JWT authentication

## Coding Style
- Use 2 spaces for indentation
- Strict equality (=== and !==)
- Private members prefixed with underscore
```

### Memory Commands
- `/memory refresh` - Reload all context files
- `/memory show` - Display current context

## Sandboxing

Enable sandboxed execution:
```bash
# Via flag
gemini --sandbox

# Via environment
GEMINI_SANDBOX=1 gemini

# Automatic with yolo mode
gemini --yolo  # Enables sandbox by default
```

Custom sandbox with `.gemini/sandbox.Dockerfile`:
```dockerfile
FROM gemini-cli-sandbox
RUN apt-get update && apt-get install -y some-package
```

Build and run:
```bash
BUILD_SANDBOX=1 gemini -s
```

## Full Example Settings File

```json
{
  "general": {
    "previewFeatures": true,
    "vimMode": false
  },
  "model": {
    "name": "gemini-3-flash-preview"
  },
  "output": {
    "format": "text"
  },
  "tools": {
    "approvalMode": "auto_edit",
    "allowed": [
      "run_shell_command(git)",
      "run_shell_command(npm)"
    ]
  },
  "context": {
    "fileName": "GEMINI.md",
    "includeDirectories": ["../common"]
  },
  "privacy": {
    "usageStatisticsEnabled": false
  }
}
```
