# Headless Mode Reference

Complete documentation for gemini-cli headless mode - programmatic, non-interactive usage.

## Overview

Headless mode provides a non-interactive interface that:
- Accepts prompts via command line arguments or stdin
- Returns structured output (text or JSON)
- Supports file redirection and piping
- Enables automation and scripting workflows
- Provides consistent exit codes for error handling

## Basic Usage

### Direct Prompts
```bash
gemini --prompt "What is machine learning?"
gemini -p "What is machine learning?"
```

### Stdin Input
```bash
echo "Explain this code" | gemini
```

### Combining File Input with Prompts
```bash
cat README.md | gemini --prompt "Summarize this documentation"
```

## Output Formats

### Text Output (Default)
Human-readable plain text:
```bash
gemini -p "What is the capital of France?"
# Output: The capital of France is Paris.
```

### JSON Output
Structured data with response, statistics, and metadata:
```bash
gemini -p "Query" --output-format json
```

#### JSON Response Schema
```json
{
  "response": "string",
  "stats": {
    "models": {
      "[model-name]": {
        "api": {
          "totalRequests": "number",
          "totalErrors": "number",
          "totalLatencyMs": "number"
        },
        "tokens": {
          "prompt": "number",
          "candidates": "number",
          "total": "number",
          "cached": "number",
          "thoughts": "number",
          "tool": "number"
        }
      }
    },
    "tools": {
      "totalCalls": "number",
      "totalSuccess": "number",
      "totalFail": "number",
      "totalDurationMs": "number",
      "totalDecisions": {
        "accept": "number",
        "reject": "number",
        "modify": "number",
        "auto_accept": "number"
      },
      "byName": {}
    },
    "files": {
      "totalLinesAdded": "number",
      "totalLinesRemoved": "number"
    }
  },
  "error": {
    "type": "string",
    "message": "string",
    "code": "number"
  }
}
```

### Streaming JSON Output
Real-time events as newline-delimited JSON (JSONL):
```bash
gemini --output-format stream-json --prompt "Complex task"
```

#### Event Types
1. **`init`** - Session starts (includes session_id, model)
2. **`message`** - User prompts and assistant responses
3. **`tool_use`** - Tool call requests with parameters
4. **`tool_result`** - Tool execution results (success/error)
5. **`error`** - Non-fatal errors and warnings
6. **`result`** - Final session outcome with aggregated stats

#### Example Stream Output
```json
{"type":"init","timestamp":"2025-01-01T12:00:00.000Z","session_id":"abc123","model":"gemini-3-flash-preview"}
{"type":"message","role":"user","content":"List files","timestamp":"2025-01-01T12:00:01.000Z"}
{"type":"tool_use","tool_name":"Bash","tool_id":"bash-123","parameters":{"command":"ls -la"},"timestamp":"2025-01-01T12:00:02.000Z"}
{"type":"tool_result","tool_id":"bash-123","status":"success","output":"file1.txt\nfile2.txt","timestamp":"2025-01-01T12:00:03.000Z"}
{"type":"message","role":"assistant","content":"Here are the files...","delta":true,"timestamp":"2025-01-01T12:00:04.000Z"}
{"type":"result","status":"success","stats":{"total_tokens":250},"timestamp":"2025-01-01T12:00:05.000Z"}
```

#### When to Use Streaming JSON
- Real-time progress monitoring
- Event-driven automation
- Live UI updates
- Detailed execution logs
- Pipeline integration with logging/monitoring systems

### File Redirection
```bash
# Save to file
gemini -p "Explain Docker" > docker.txt
gemini -p "Explain Docker" --output-format json > docker.json

# Append to file
gemini -p "Add more details" >> docker.txt

# Pipe to other tools
gemini -p "What is Kubernetes?" --output-format json | jq '.response'
gemini -p "Explain microservices" | wc -w
```

## Command-Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--prompt`, `-p` | Run in headless mode | `gemini -p "query"` |
| `--output-format` | Output format (text, json, stream-json) | `--output-format json` |
| `--model`, `-m` | Specify model | `-m gemini-3-flash-preview` |
| `--debug`, `-d` | Enable debug mode | `--debug` |
| `--include-directories` | Include additional directories | `--include-directories src,docs` |
| `--yolo`, `-y` | Auto-approve all actions | `--yolo` |
| `--approval-mode` | Set approval mode | `--approval-mode auto_edit` |

## Practical Examples

### Code Review
```bash
cat src/auth.py | gemini -p "Review for security issues" > security-review.txt
```

### Generate Commit Messages
```bash
result=$(git diff --cached | gemini -p "Write a concise commit message" --output-format json)
echo "$result" | jq -r '.response'
```

### API Documentation Generation
```bash
result=$(cat api/routes.js | gemini -p "Generate OpenAPI spec" --output-format json)
echo "$result" | jq -r '.response' > openapi.json
```

### Batch Code Analysis
```bash
for file in src/*.py; do
  echo "Analyzing $file..."
  result=$(cat "$file" | gemini -p "Find bugs and suggest improvements" --output-format json)
  echo "$result" | jq -r '.response' > "reports/$(basename "$file").analysis"
done
```

### Log Analysis
```bash
grep "ERROR" /var/log/app.log | tail -20 | gemini -p "Analyze errors and suggest fixes" > error-analysis.txt
```

### Release Notes Generation
```bash
result=$(git log --oneline v1.0.0..HEAD | gemini -p "Generate release notes" --output-format json)
echo "$result" | jq -r '.response' >> CHANGELOG.md
```

### Token Usage Tracking
```bash
result=$(gemini -p "Explain the schema" --include-directories db --output-format json)
total_tokens=$(echo "$result" | jq -r '.stats.models // {} | to_entries | map(.value.tokens.total) | add // 0')
models_used=$(echo "$result" | jq -r '.stats.models // {} | keys | join(", ")')
echo "Used $total_tokens tokens with models: $models_used" >> usage.log
```

### Processing Stream Events
```bash
gemini --output-format stream-json --prompt "Analyze code" | while read -r line; do
  event_type=$(echo "$line" | jq -r '.type')
  case "$event_type" in
    "tool_use")
      tool=$(echo "$line" | jq -r '.tool_name')
      echo "Tool called: $tool"
      ;;
    "error")
      msg=$(echo "$line" | jq -r '.message')
      echo "Error: $msg" >&2
      ;;
    "result")
      status=$(echo "$line" | jq -r '.status')
      echo "Completed with status: $status"
      ;;
  esac
done
```
