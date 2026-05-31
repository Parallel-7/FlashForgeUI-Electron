---
name: gemini-cli
description: Programmatic interaction with Google's Gemini models via gemini-cli headless mode. Use this skill when Claude needs to collaborate with Gemini LLMs for tasks like advanced debugging, code analysis, research synthesis, or when building scripts that leverage Gemini's capabilities. Also use when helping users create automation scripts that use gemini-cli. Triggers include requests to "ask Gemini", "use Gemini to", "collaborate with Gemini", "get Gemini's perspective", or any scripting task involving gemini-cli.
---

# Gemini CLI - Programmatic LLM Collaboration

This skill enables Claude to collaborate with Google's Gemini models via `gemini-cli` headless mode, and to help users build scripts that leverage Gemini.

## Prerequisites

Gemini CLI must be installed and authenticated:
```bash
# Check installation
which gemini

# Authenticate if needed (interactive)
gemini
```

## Quick Start - Headless Mode

### Basic Query
```bash
gemini --prompt "Your question here"
# or short form
gemini -p "Your question here"
```

### With JSON Output (for parsing)
```bash
gemini -p "Analyze this code" --output-format json | jq -r '.response'
```

### Piping Content
```bash
cat file.py | gemini -p "Review this code for bugs"
echo "Explain this" | gemini
```

## Model Selection

### Recommended Models

| Model | Best For | Context Window |
|-------|----------|----------------|
| `gemini-3-pro-preview` | Advanced debugging, complex reasoning, architecture decisions | Very large |
| `gemini-3-flash-preview` | Quick analysis, summarization, simple tasks | Very large |
| `gemini-2.5-pro` | General purpose, balanced performance | Large |
| `gemini-2.5-flash` | Fast responses, bulk processing | Large |
| `gemini-2.5-flash-lite` | Lightweight tasks, high-volume operations | Medium |

### Model Selection Strategy

**Use `gemini-3-pro-preview` when:**
- Debugging complex issues
- Architectural decisions
- Multi-step reasoning
- Code review requiring deep analysis

**Use `gemini-3-flash-preview` when:**
- Quick code analysis
- Summarizing documentation
- Simple Q&A tasks
- High-volume batch processing

```bash
# Specify model explicitly
gemini -p "Complex debugging task" -m gemini-3-pro-preview
gemini -p "Quick summary" -m gemini-3-flash-preview
```

**Rate Limits:** If encountering rate limits, fall back to alternative models:
- `gemini-3-pro-preview` → `gemini-2.5-pro`
- `gemini-3-flash-preview` → `gemini-2.5-flash` → `gemini-2.5-flash-lite`

## Claude-Gemini Collaboration Patterns

### Pattern 1: Delegating Research/Summarization
When Claude needs information summarized from large content:
```bash
cat large_document.md | gemini -p "Summarize the key points" -m gemini-3-flash-preview
```

### Pattern 2: Getting a Second Opinion
For complex debugging or architectural decisions:
```bash
cat error_log.txt | gemini -p "Analyze this error and suggest root causes" -m gemini-3-pro-preview --output-format json
```

### Pattern 3: Batch Processing
When processing multiple files:
```bash
for file in src/*.py; do
  result=$(cat "$file" | gemini -p "Find potential bugs" -m gemini-3-flash-preview --output-format json)
  echo "$result" | jq -r '.response' > "reports/$(basename "$file").analysis"
done
```

### Pattern 4: Including Project Context
```bash
gemini -p "Explain the authentication flow" --include-directories src,docs
```

## Key CLI Options

| Option | Description |
|--------|-------------|
| `-p, --prompt` | Run in headless mode with prompt |
| `-m, --model` | Specify model |
| `--output-format` | `text`, `json`, or `stream-json` |
| `--include-directories` | Include additional directories as context |
| `-y, --yolo` | Auto-approve all actions (use carefully) |
| `--approval-mode` | `default`, `auto_edit`, or `plan` |

## Output Formats

### Text (Default)
Plain text response, suitable for display or simple processing.

### JSON
Structured response with stats and metadata:
```bash
result=$(gemini -p "Query" --output-format json)
response=$(echo "$result" | jq -r '.response')
tokens=$(echo "$result" | jq -r '.stats.models | to_entries | map(.value.tokens.total) | add')
```

### Streaming JSON
Real-time events for monitoring long operations:
```bash
gemini -p "Complex task" --output-format stream-json | while read -r event; do
  type=$(echo "$event" | jq -r '.type')
  echo "Event: $type"
done
```

## Reference Documentation

For detailed information, see:
- **[references/headless.md](references/headless.md)** - Complete headless mode documentation
- **[references/configuration.md](references/configuration.md)** - All configuration options and settings
- **[references/models.md](references/models.md)** - Full model list and configuration aliases
- **[references/examples.md](references/examples.md)** - Extended script examples

## Error Handling

```bash
result=$(gemini -p "Query" --output-format json 2>&1)
if echo "$result" | jq -e '.error' > /dev/null 2>&1; then
  error_type=$(echo "$result" | jq -r '.error.type')
  error_msg=$(echo "$result" | jq -r '.error.message')
  echo "Error ($error_type): $error_msg"
else
  echo "$result" | jq -r '.response'
fi
```

## Best Practices

1. **Always use `--output-format json`** for programmatic parsing
2. **Specify models explicitly** to ensure consistent behavior
3. **Use `jq`** for reliable JSON parsing
4. **Include relevant context** with `--include-directories`
5. **Handle errors** by checking for `.error` in JSON responses
6. **Respect rate limits** by implementing fallback models
