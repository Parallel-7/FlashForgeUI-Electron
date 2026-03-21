# Extended Examples

Comprehensive script examples for gemini-cli automation.

## CI/CD Integration

### Pre-commit Code Review
```bash
#!/bin/bash
# .git/hooks/pre-commit

staged_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(py|js|ts)$')

if [ -n "$staged_files" ]; then
  for file in $staged_files; do
    echo "Reviewing $file..."
    issues=$(cat "$file" | gemini -p "List only critical bugs or security issues. Reply 'NONE' if clean." -m gemini-3-flash-preview)
    
    if [[ "$issues" != *"NONE"* ]]; then
      echo "Issues found in $file:"
      echo "$issues"
      exit 1
    fi
  done
fi

exit 0
```

### PR Description Generator
```bash
#!/bin/bash
# Generate PR description from commits

base_branch="${1:-main}"
commits=$(git log --oneline "$base_branch"..HEAD)
diff=$(git diff "$base_branch"..HEAD --stat)

result=$(echo -e "Commits:\n$commits\n\nChanges:\n$diff" | \
  gemini -p "Generate a PR description with summary, key changes, and testing notes" \
  -m gemini-3-flash-preview --output-format json)

echo "$result" | jq -r '.response'
```

### Automated Documentation Update
```bash
#!/bin/bash
# Update README based on code changes

for file in src/*.py; do
  module=$(basename "$file" .py)
  docstring=$(cat "$file" | gemini -p "Extract the main purpose and public API of this module in 2-3 sentences" -m gemini-3-flash-preview)
  echo "### $module" >> docs/api.md
  echo "$docstring" >> docs/api.md
  echo "" >> docs/api.md
done
```

## Development Workflows

### Interactive Debug Assistant
```bash
#!/bin/bash
# debug-assist.sh - Get debugging help

error_file="${1:-/tmp/error.log}"

if [ -f "$error_file" ]; then
  context=$(tail -100 "$error_file")
else
  echo "Paste error (Ctrl+D when done):"
  context=$(cat)
fi

result=$(echo "$context" | gemini -p "Analyze this error. Provide:
1. Root cause
2. Specific fix
3. Prevention strategy" -m gemini-3-pro-preview --output-format json)

echo "$result" | jq -r '.response'
```

### Code Refactoring Suggestions
```bash
#!/bin/bash
# suggest-refactor.sh <file>

file="$1"
if [ ! -f "$file" ]; then
  echo "Usage: $0 <file>"
  exit 1
fi

result=$(cat "$file" | gemini -p "Suggest specific refactoring improvements for:
- Code organization
- Performance
- Readability
Provide concrete code examples." -m gemini-3-pro-preview --output-format json)

echo "$result" | jq -r '.response'
```

### Test Generation
```bash
#!/bin/bash
# generate-tests.sh <source-file>

source_file="$1"
test_file="${source_file%.py}_test.py"

result=$(cat "$source_file" | gemini -p "Generate pytest unit tests for all public functions. Include:
- Happy path tests
- Edge cases
- Error cases" -m gemini-3-pro-preview --output-format json)

echo "$result" | jq -r '.response' > "$test_file"
echo "Generated: $test_file"
```

## Analysis Scripts

### Codebase Analysis
```bash
#!/bin/bash
# analyze-codebase.sh

output_dir="./analysis"
mkdir -p "$output_dir"

# Analyze architecture
find src -name "*.py" -exec cat {} \; | \
  gemini -p "Analyze the overall architecture. Identify:
- Design patterns used
- Component relationships
- Potential improvements" -m gemini-3-pro-preview > "$output_dir/architecture.md"

# Find code smells
for file in src/**/*.py; do
  result=$(cat "$file" | gemini -p "List code smells and anti-patterns. Be specific." -m gemini-3-flash-preview --output-format json)
  response=$(echo "$result" | jq -r '.response')
  if [[ "$response" != *"None found"* ]] && [[ "$response" != *"No issues"* ]]; then
    echo "## $file" >> "$output_dir/code-smells.md"
    echo "$response" >> "$output_dir/code-smells.md"
    echo "" >> "$output_dir/code-smells.md"
  fi
done

echo "Analysis complete. See $output_dir/"
```

### Dependency Audit
```bash
#!/bin/bash
# audit-deps.sh

# For Python
if [ -f "requirements.txt" ]; then
  deps=$(cat requirements.txt)
  gemini -p "Review these Python dependencies for:
- Known security issues
- Outdated packages
- Better alternatives
$deps" -m gemini-3-flash-preview
fi

# For Node.js
if [ -f "package.json" ]; then
  deps=$(cat package.json | jq '.dependencies, .devDependencies')
  echo "$deps" | gemini -p "Review these npm dependencies for:
- Known security issues
- Outdated packages
- Better alternatives" -m gemini-3-flash-preview
fi
```

### Log Analysis Pipeline
```bash
#!/bin/bash
# analyze-logs.sh <log-file>

log_file="$1"
output_dir="./log-analysis"
mkdir -p "$output_dir"

# Extract errors
errors=$(grep -i "error\|exception\|fail" "$log_file" | tail -200)

# Analyze with Gemini
result=$(echo "$errors" | gemini -p "Analyze these log entries:
1. Categorize error types
2. Identify patterns
3. Suggest fixes for each category
4. Priority ranking" -m gemini-3-pro-preview --output-format json)

echo "$result" | jq -r '.response' > "$output_dir/error-analysis.md"

# Generate summary
summary=$(echo "$result" | jq -r '.response' | gemini -p "Create a 3-sentence executive summary" -m gemini-3-flash-preview)
echo "$summary" > "$output_dir/summary.txt"

echo "Analysis saved to $output_dir/"
```

## Batch Processing

### Multi-File Processing with Progress
```bash
#!/bin/bash
# batch-process.sh <directory> <prompt>

dir="$1"
prompt="$2"
output_dir="./batch-results"
mkdir -p "$output_dir"

files=($(find "$dir" -name "*.py" -type f))
total=${#files[@]}
current=0

for file in "${files[@]}"; do
  ((current++))
  echo "[$current/$total] Processing: $file"
  
  result=$(cat "$file" | gemini -p "$prompt" -m gemini-3-flash-preview --output-format json)
  
  basename=$(basename "$file")
  echo "$result" | jq -r '.response' > "$output_dir/${basename}.analysis"
  
  # Rate limiting - pause between requests
  sleep 1
done

echo "Batch complete. Results in $output_dir/"
```

### Parallel Processing
```bash
#!/bin/bash
# parallel-process.sh

process_file() {
  file="$1"
  prompt="$2"
  output_dir="$3"
  
  result=$(cat "$file" | gemini -p "$prompt" -m gemini-3-flash-preview --output-format json 2>&1)
  basename=$(basename "$file")
  echo "$result" | jq -r '.response' > "$output_dir/${basename}.result"
}

export -f process_file

find src -name "*.py" | parallel -j 4 process_file {} "Analyze for bugs" ./results
```

## Claude-Gemini Collaboration

### Research Task Delegation
```bash
#!/bin/bash
# delegate-research.sh <topic>

topic="$1"

# Use Gemini for research (larger context window)
research=$(gemini -p "Research and summarize: $topic
Include:
- Key concepts
- Current state of the art
- Important references
- Practical applications" -m gemini-3-pro-preview --output-format json)

# Extract response
summary=$(echo "$research" | jq -r '.response')

# Save for Claude to use
echo "$summary" > "/tmp/research-$$.md"
echo "Research saved to /tmp/research-$$.md"
echo "Tokens used: $(echo "$research" | jq -r '.stats.models | to_entries | map(.value.tokens.total) | add')"
```

### Second Opinion Script
```bash
#!/bin/bash
# second-opinion.sh <context-file>

context_file="$1"

if [ ! -f "$context_file" ]; then
  echo "Usage: $0 <context-file>"
  exit 1
fi

result=$(cat "$context_file" | gemini -p "Review this analysis and provide:
1. Agreement/disagreement with key points
2. Additional considerations missed
3. Alternative approaches
4. Confidence assessment" -m gemini-3-pro-preview --output-format json)

echo "$result" | jq -r '.response'
```

### Large Document Processing
```bash
#!/bin/bash
# process-large-doc.sh <document>

document="$1"

# Gemini's large context window handles full documents
result=$(cat "$document" | gemini -p "Comprehensive analysis:
1. Executive summary (3 sentences)
2. Key themes and arguments
3. Critical evaluation
4. Recommendations" -m gemini-3-pro-preview --output-format json)

echo "$result" | jq -r '.response'
```

## Monitoring and Streaming

### Real-time Task Monitor
```bash
#!/bin/bash
# monitor-task.sh

gemini -p "Analyze the codebase and create a comprehensive report" \
  --include-directories src \
  --output-format stream-json | while read -r line; do
  
  type=$(echo "$line" | jq -r '.type')
  timestamp=$(echo "$line" | jq -r '.timestamp')
  
  case "$type" in
    "init")
      model=$(echo "$line" | jq -r '.model')
      echo "[$timestamp] Started with model: $model"
      ;;
    "tool_use")
      tool=$(echo "$line" | jq -r '.tool_name')
      echo "[$timestamp] Using tool: $tool"
      ;;
    "tool_result")
      status=$(echo "$line" | jq -r '.status')
      echo "[$timestamp] Tool completed: $status"
      ;;
    "message")
      role=$(echo "$line" | jq -r '.role')
      if [ "$role" = "assistant" ]; then
        echo "[$timestamp] Assistant responding..."
      fi
      ;;
    "result")
      status=$(echo "$line" | jq -r '.status')
      tokens=$(echo "$line" | jq -r '.stats.total_tokens // "N/A"')
      echo "[$timestamp] Completed: $status (tokens: $tokens)"
      ;;
    "error")
      msg=$(echo "$line" | jq -r '.message')
      echo "[$timestamp] ERROR: $msg" >&2
      ;;
  esac
done
```

## Error Handling

### Robust Query Function
```bash
#!/bin/bash

gemini_query() {
  local prompt="$1"
  local model="${2:-gemini-3-flash-preview}"
  local max_retries="${3:-3}"
  local retry_delay="${4:-5}"
  
  local attempt=0
  local result
  
  while [ $attempt -lt $max_retries ]; do
    ((attempt++))
    
    result=$(gemini -p "$prompt" -m "$model" --output-format json 2>&1)
    
    # Check for errors
    if echo "$result" | jq -e '.error' > /dev/null 2>&1; then
      error_type=$(echo "$result" | jq -r '.error.type')
      error_msg=$(echo "$result" | jq -r '.error.message')
      
      echo "Attempt $attempt failed: $error_type - $error_msg" >&2
      
      # Handle rate limits
      if [[ "$error_type" == *"RateLimit"* ]]; then
        echo "Rate limited, waiting ${retry_delay}s..." >&2
        sleep "$retry_delay"
        continue
      fi
      
      # Non-retryable error
      return 1
    fi
    
    # Success
    echo "$result" | jq -r '.response'
    return 0
  done
  
  echo "Max retries exceeded" >&2
  return 1
}

# Usage
response=$(gemini_query "Your prompt here" "gemini-3-flash-preview" 3 5)
```
